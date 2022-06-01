//jshint esversion: 6
const cron = require("node-cron");
const express = require("express");
const readline = require('readline');
const {google} = require('googleapis');
const fs = require("fs");
const axios = require('axios');
//const datstore = require('../../radharani/e2fdatastore');
//require("babel-core/register");
//require("babel-polyfill");

const uuidv4 = require('uuid/v4');
const moment = require('moment');

const ENV = 'PROD';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const TOKEN_PATH = 'token.json';

let URL = 'http://localhost:90/api/company/tickets/import';
let SHEET_STORE_URL = 'http://localhost:90/api/company/links/gsheet';

if(ENV === 'PROD') {
    URL = 'https://oxytra.com/api/company/tickets/import';
    SHEET_STORE_URL = 'https://oxytra.com/api/company/links/gsheet';
}
else {
    URL = 'http://localhost:90/api/company/tickets/import';
    SHEET_STORE_URL = 'http://localhost:90/api/company/links/gsheet';
}

//const {Logger} = require('../e2f/e2fcrwler');
//import { loggers } from 'winston';

let app = express();

const winston = require('winston');
const {combine, timestamp, label, printf} = winston.format;
const DailyRotateFile = require('winston-daily-rotate-file');

var customLevels = {
    levels: {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    },
    colors: {
      debug: 'blue',
      info: 'green',
      warn: 'yellow',
      error: 'red'
    }
};

const myFormat = printf(({ level, message, label, timestamp }) => {
    return `${timestamp} [${label}] ${level}: ${message}`;
});

var timeFormatFn = function() {
    'use strict';
    return moment().format(cfg.timeFormat);
};

var timeFormatFn = function() {
    'use strict';
    return moment().format(cfg.timeFormat);
};

winston.configure({
    defaultMeta: {service: 'gsheet-crawler'},
    format: combine(label({label: 'gsheet'}), timestamp(), myFormat),
    transports:[
       new winston.transports.File({filename: `gsheet_execution_log_${moment().format("D_M_YYYY")}.log`, })
    ]
});

function log() {
    var time = moment().format("HH:mm:ss.SSS");
    var args = Array.from(arguments);

    args.unshift(time);
    console.log.apply(console, args);
    winston.info(args.join(' '));
}


/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}
  
/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error('Error while trying to retrieve access token', err);
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
            if (err) return console.error(err);
            log('Token stored to', TOKEN_PATH);
        });
        callback(oAuth2Client);
        });
    });
}

function login() {
    log('info', "Finding tenent codes ...");

    return new Promise((resolve, reject) => {
        try
        {
            // Load client secrets from a local file.
            fs.readFile('credentials.json', (err, content) => {
                if (err) return log('Error loading client secret file:', err);
                // Authorize a client with credentials, then call the Google Sheets API.
                authorize(JSON.parse(content), async function(authclient) {
                    try
                    {
                        const sheets = await getTenentsSheetCodes();

                        if(sheets && Array.isArray(sheets) && sheets.length>0) {
                            for (let index = 0; index < sheets.length; index++) {
                                const sheet = sheets[index];
                                let runid = `${uuidv4()}_${moment().format("DD-MMM-YYYY HH:mm:ss.SSS")}`;
                                sheet.runid = runid;
                                log(`Fetching data from ${sheet.name}`);
                                await listMajors(authclient, sheet);
                            }
                        }
                        log(`All sheet traverses`);
                        resolve(sheets);
                    }
                    catch(ex1) {
                        log(`Error : ${ex1}`);
                        reject(ex1);
                    }
                });
            });
        }
        catch(ex) {
            log(`Error : ${ex}`);
            reject(ex);
        }
    });
}

function getTenentsSheetCodes() {
    // return [
    //     {"id": 1, "name": "gsheet of bookmyfly", "sheetid": "1B0RfMO6cuT_MAuCj9m6nuqugl09VNLYmFxdbbfOU9qs", "status": 1, "sourcecode": "bmf", "target_companyid": 1},
    //     {"id": 2, "name": "gsheet of radharani holidays", "sheetid": "1QY_t4LkLuZMO_DlLjVaeThHvXW8B9IAjs47FNGTpeY8", "status": 1, "sourcecode": "rrh", "target_companyid": 1}
    // ]
    return new Promise((resolve, reject) => {
        axios.get(SHEET_STORE_URL)
        .then(response => {
            log(JSON.stringify(response.data));
            resolve(response.data);
        })
        .catch(error => {
            log(error);
            reject(error);
        });    
    });
}

function listMajors(auth, sheetconf) {
    return new Promise((resolve, reject) => {
        const sheetid = sheetconf.sheetid;
        const sheets = google.sheets({version: 'v4', auth});
    
        sheets.spreadsheets.get({
            spreadsheetId: sheetid,
            ranges: [],
            includeGridData: false
        }, async function(err, response) {
            if (err) {
                console.error(err);
                //return;
                reject(err);
            }
    
            try
            {
                // TODO: Change code below to process the `response` object:
                // log(JSON.stringify(response, null, 2));
                // log(`Sheets => ${JSON.stringify(response.data.sheets)}`);
                log(`First Sheet => ${JSON.stringify(response.data.sheets[0].properties.title)}`);
                const sheet_items = [];
        
                for (let index = 0; index < response.data.sheets.length; index++) {
                    const sheet = response.data.sheets[index];
                    sheet_items.push(sheet.properties.title);
        
                    log(`Sheet Name : ${sheet.properties.title}`);
                    var tickets = await get_sheet_data(sheetconf, sheet.properties.title, sheets).catch(reason=> log(`Error received: ${reason}`));

                    if(tickets && Array.isArray(tickets)) {
                        log(`Going to save sheet data`);
                        result = await save_sheet_data(tickets).catch(reason => log(`Error received (Saving sheet data): ${reason}`));
                    }
                }
                // const sheet_name = response.data.sheets[0].properties.title;
        
                resolve(true);
            }
            catch(ex) {
                log(`Error in listMajors: ${ex}`);
                reject(ex);
            }
        });
    });
}
  
async function get_sheet_data(sheetconf, sheet_name, sheets) {
    return new Promise((resolve, reject) => {
        const sheetid = sheetconf.sheetid;
        const companyid = parseInt(sheetconf.target_companyid, 10);
        const runid = sheetconf.runid;
        const sourcecode = sheetconf.sourcecode;
        sheets.spreadsheets.values.get({spreadsheetId: sheetid, range: `${sheet_name}`}, (err, res) => {

            try
            {
                if (err) {
                    log(`The API returned an error: ${err}`);
                    reject(err);
                }

                const tickets = [];
                var rows = null;
                if(res && res.data) {
                    rows = res.data.values;
                }
                if (rows && rows.length) {
                    log(`Sheet Name : ${sheet_name}`);
                    log("-".repeat(100));
                    log('Ticket #, Dept.Date, Sector, Flight #, Arrv.Date, PNR, PAX, Price, Remarks');
                    // Print columns A and E, which correspond to indices 0 and 4.
                    log("=".repeat(100));
                    rows.map((row, idx) => {
                        if(idx >=2) {
                            const qty = parseInt(row[9], 10);
                            const price = parseFloat(row[10]);
                            if(row[9] && row[9] !== '' && row[10] && row[10] !== '' && row[1] && row[1] !== '' && row[2] && row[2] !== '' && row[3] && row[3] !== '') {
                                let dept_datetime = moment(row[1]+'T'+row[6]+':00+05:30', 'DD-MMM-YYYY HH:mm');
                                let arrv_datetime = moment(row[1]+'T'+row[7]+':00+05:30', 'DD-MMM-YYYY HH:mm');
                                if(ENV === 'PROD') {
                                    dept_datetime = moment(row[1]+'T'+row[6]+':00+00:00', 'DD-MMM-YYYY HH:mm');
                                    arrv_datetime = moment(row[1]+'T'+row[7]+':00+00:00', 'DD-MMM-YYYY HH:mm');
                                }

                                row[10] = row[10].replace(',', '');
                                let price = isNaN(row[10]) ? 0.00 : parseFloat(row[10]);  
                                let no_of_pax = isNaN(row[9]) ? 0 : parseInt(row[9], 10);  
                                let remarks = isNaN(row[11]) ? row[11] : '';

                                if(isNaN(row[10]) && (row[10].toLowerCase() === 'sold' || row[10].toLowerCase() === 'close' || row[10].toLowerCase() === 'cancel')) {
                                    price = 0.00;
                                    no_of_pax = 0;
                                }
                                
                                //log(`${row[0]}, ${dept_datetime.format('DD-MMM-YYYY HH:mm:ss ZZ')}, ${row[2]}-${row[3]}, ${row[4]}-${row[5]}, ${arrv_datetime.format('DD-MMM-YYYY HH:mm:ss ZZ')}, ${row[8].trim()}, ${no_of_pax}, ${price}`);
                                log(`${row[0]}, ${dept_datetime.format('DD-MMM-YYYY HH:mm:ss')}, ${row[2]}-${row[3]}, ${row[4]}-${row[5]}, ${arrv_datetime.format('DD-MMM-YYYY HH:mm:ss')}, ${row[8].trim()}, ${no_of_pax}, ${price}, ${remarks}`);
                                tickets.push({
                                    "ticket_no": `${sourcecode.toUpperCase()+'-'+row[0].trim()}`,
                                    // "departure_date_time": dept_datetime.format('DD-MMM-YYYY HH:mm:ss ZZ'),
                                    // "arrival_date_time": arrv_datetime.format('DD-MMM-YYYY HH:mm:ss ZZ'),
                                    "departure_date_time": dept_datetime.format('DD-MMM-YYYY HH:mm:ss'),
                                    "arrival_date_time": arrv_datetime.format('DD-MMM-YYYY HH:mm:ss'),
                                    "source_city": row[2],
                                    "destination_city": row[3],
                                    "airline": row[4],
                                    "aircode": row[4],
                                    "flight_code": `${row[4]}-${row[5]}`,
                                    "pnr": row[8].trim(),
                                    "no_of_person": no_of_pax,
                                    "price": price,
                                    "companyid": companyid,
                                    "data_collected_from": sourcecode,
                                    "class": 'ECONOMY',
                                    "trip_type": 'ONE',
                                    "runid": runid,
                                    'remarks': remarks
                                })
                            }
                        }
                    });
                    log("=".repeat(100));

                    log(JSON.stringify(tickets));
                    resolve(tickets);
                } else {
                    log(`No data found. ${sheet_name}`);
                    reject(`No data found. ${sheet_name}`);
                }
            }
            catch(ex) {
                log(`Error in get_sheet_data : ${ex}`);
                reject(ex);
            }
        });
    });
}

async function save_sheet_data(tickets) {
    return new Promise((resolve, reject) => {
        log(`Tickets payload - URL : ${URL}`);
        log(`Tickets payload: ${JSON.stringify(tickets)}`);
        axios.post(URL, tickets)
        .then(response => {
            log(JSON.stringify(response.data));
            //log(response.data.explanation);
            resolve(response);
        })
        .catch(error => {
            log(error);
            reject(error);
        });
    });
}

var excutionStarted = false;
cron.schedule("*/5 * * * *", async function() {
    log("info", "Cron started");
    if(excutionStarted) {
        log("info", 'Previous process still running ...');
        return false;
    }

    try
    {
        excutionStarted = true;
        process.on('unhandledRejection', (reason, promise) => {
            log('info','Unhandled Rejection at:', reason);
        });
        //startProcess();
        await login();

        log('info','Process completed:');
    }
    catch(e) {
        log('error', e);
    }
    finally {
        excutionStarted = false;
    }
});

app.listen("4401");
