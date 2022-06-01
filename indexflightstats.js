//jshint esversion:6
//const tty = require('tty');
const cron = require("node-cron");
const express = require("express");
const fs = require("fs");

const uuidv4 = require('uuid/v4');
const puppeteer = require('puppeteer');
const datastore = require('./radharani/fsdatastore');
const delay = require('delay');
const moment = require('moment');
const fetch = require('isomorphic-fetch');

const DEFAULT_PROCESSOR_ID = "FLT0001";
//const DEFAULT_PROCESSOR_ID = "NTFY0001";
const FLIGHT_STATUS_PROVIDER = {
    IXIGO: 0
}

// const winston = require('winston');
// const {combine, timestamp, label, printf} = winston.format;
// const DailyRotateFile = require('winston-daily-rotate-file');

const logger = require('./src/common/logger').Logger;
logger.init('flstat');

var nodemailer = require('nodemailer');
const Email = require('email-templates');

// =================================
var timeFormatFn = function() {
    'use strict';
    return moment().format(cfg.timeFormat);
};

function getStore() {
    if(capturedData) return capturedData;

    capturedData = {}

    return capturedData;
}

function log() {
    var time = moment().format("HH:mm:ss.SSS");
    var args = Array.from(arguments);

    args.unshift(time);
    console.log.apply(console, args);
    //winston.info(args.join(' '));
    var msg = args.join(' ');
    logger.log('info', msg);    
}

// create transporter object with smtp server details
const transporter = nodemailer.createTransport({
    host: 'mail.travelmergers.com',
    //secure: true,
    port: 587,
    auth: {
        user: 'read-only@travelmergers.com',
        pass: 'tm@readonly'
    }
});

const email = new Email({
    transport: transporter,
    send: true,
    preview: false,
});

// send email
// transporter.sendMail({
//     from: 'info@travelmergers.com', //info@travelmergers.com
//     to: 'test-zku6rixo9@srv1.mail-tester.com', //test-njwmfz38n@srv1.mail-tester.com | majumdar.himadri@gmail.com
//     subject: 'Can you please come and meet me?',
//     html: '<h1>Example HTML Message Body</h1>'
// }, (error, info) => {
//     if(error) {
//         console.log(error);
//     }
//     else {
//         console.log(info);
//     }
// });

// Sumit Agarwal <radharaniholidays@gmail.com>;

// const data = {
//     "fname": "Himadri",
//     "lname": "Majumdar",
//     "email": "Himadri Majumdar <himadri_75@yahoo.com>",
//     "reply_email": "Sumit Agarwal <info@oxytra.com>",
//     "data": "This data coming from code - booking information",
//     "order": {
//         "orderid": "BK-01006",
//         "orddate": "2020-10-16 10:30",
//         "value": 3500.00,
//         "sector": "CCU-DEL",
//         "departure_date": "2020-10-20 10:30",
//         "arrival_date": "2020-10-20 12:30",
//         "pax": "2 + 1 (Infant)"
//     },
//     "sender": {
//         "name": "Oxytra",
//         "email": "Oxytra - Admin <info@oxytra.com>",
//         "siteurl": "www.oxytra.com",
//         "undersigned": "Operation - Oxytra",
//         "mobile": "+91 9800412356"
//     }
//   };

// email.send({
//     template: 'booking',
//     message: {
//       from: 'No-Reply TravelMergers <read-only@travelmergers.com>',
//       replyTo: data.reply_email,
//       to: data.email,
//       bcc: 'Info TravelMergers <info@travelmergers.com>'
//     },
//     locals: data
// }).then(() => console.log('email has been sent!'));

function sendEmail(data, payload, runid, processorid) {
    return new Promise(async (resolve, reject) => {
        try
        {
            log(`Data => ${JSON.stringify(data)}`);
            log(`Payload => ${JSON.stringify(payload)}`);

            if(!data || !data.templatename) {
                log('Invalid template provided');
                payload = null;
            }

            if(payload && payload.email) {
                var result = await email.send({
                    template: data.templatename || 'booking',
                    message: {
                        from: 'No-Reply TravelMergers <read-only@travelmergers.com>',
                        replyTo: data.email || 'Info TravelMergers <info@travelmergers.com>',
                        to: `${payload.email}`,
                        cc: `${data.email}`,
                        bcc: 'Info TravelMergers <info@travelmergers.com>'
                    },
                    locals: payload
                }).then(() => {
                    log(`Notification id: ${data.id} processed. Email sent!`);

                    return true;
                })
                .catch((reason) => { 
                    log(reason);
                    return false;
                });
    
                if(result) {
                    log('Email processed !!');
                    resolve(result);
                    //this is the place to update to DB
                }
                else {
                    log(result);
                    reject('Invalid result received!');
                }
            }
            else {
                reject('Invalid payload provide !!');
            }
        }
        catch(ex) {
            log(ex);
            reject(ex)
        }
    })
}

function processEmail(runid, processorid, data) {
    return new Promise(async (resolve, reject) => {
        if(data && data.length>0) {
            for (let index = 0; index < data.length; index++) {
                const ntfy_data = data[index];
                let payload = JSON.parse(ntfy_data['payloaddata']);

                let result = await sendEmail(ntfy_data, payload, runid, processorid).catch((reason) => log(reason));
            }

            resolve(data);
        }
        else {
            reject('No data available to process');
        }
    });
}

function getFlightStatusFinder(provider) {
    let finder = null;
    switch (provider) {
        case FLIGHT_STATUS_PROVIDER.IXIGO:
            finder = require('./flightstatus_provider_ixigo');
            break;
        default:
            finder = require('./flightstatus_provider_ixigo');
            break;
    }

    return finder;
}

function fetchFlightStatus(bookingData, context) {
    return new Promise(async (resolve, reject) => {
        try
        {
            let post_data = {
                'departure_air_code': bookingData.origin_code,
                'arrival_air_code': bookingData.destination_code,
                'departure_date': moment(bookingData.departure_date_time).format('YYYYMMDD'),
            }
            // let url = `https://www.ixigo.com/api/v2/flights/list?departAirportCode=CCU&arrivalAirportCode=BLR&departDt=20210426&error=jsonError&searchType=route&apiVersion=2.0`
            try
            {
                let status_finder = getFlightStatusFinder(FLIGHT_STATUS_PROVIDER.IXIGO);
                let result = await status_finder.find(post_data)
                .then(stat => {
                    return status_finder.transform(stat, {
                        'booking_id': bookingData.booking_id,
                        'flight_dept_date': bookingData.departure_date_time,
                        'airline_code': bookingData.aircode,
                        'flight_no': parseInt(bookingData.flight_no.replace(bookingData.aircode, '').replace("-","").trim(), 10),
                        'origin': bookingData.origin_code,
                        'destination': bookingData.destination_code,
                        'airline_list': context.airlines,
                        'city_list': context.cities
                    });
                })
                .catch(reason => log(`Status find error : ${reason}`));

                log(`Result => ${JSON.stringify(result)}`);

                resolve(result);
            }
            catch(eex) {
                log(`Inner Exception => ${eex}`);
                reject(eex);
            }
        }
        catch(ex) {
            log(`Exception => ${ex}`);
            reject(ex);
        }
    });
}

function updateFlightStatus(bookingData, context) {
    return new Promise(async (resolve, reject) => {
        let data = [];
        if(bookingData && bookingData.length>0) {
            var processed_keys = {};
            for (let index = 0; index < bookingData.length; index++) {
                try
                {
                    const booking_data = bookingData[index];
                    let keyname = booking_data['keyname'];
                    // let payload = JSON.parse(ntfy_data['payloaddata']);

                    //let result = await sendEmail(ntfy_data, payload, runid, processorid).catch((reason) => log(reason));
                    if(!processed_keys[keyname]) {
                        let result = await fetchFlightStatus(booking_data, context);
                        data.push(...result);
                        processed_keys[keyname] = true
                    }
                    else {
                        log(`Key already processed ${keyname}`);
                    }
                }
                catch(eex) {
                    log(`Booking traverser Error : ${eex}`);
                }
            }

            if(data && data.length>0) {
                let status = await datastore.saveFlightStat(data);
            }

            resolve(data)
        }
        else {
            reject('No data available to process');
        }
    });
}

app = express();

// cron.schedule("*/2 * * * *", async function() {
//     log("Cron started");
//     if(excutionStarted) {
//         log('Previous process still running ...');
//         return false;
//     }
var excutionStarted = false;
async function processor() {
    try
    {
        excutionStarted = true;
        capturedData = {};
        process.on('unhandledRejection', (reason, promise) => {
            //log('Unhandled Rejection at:', reason.stack || reason);
            log('Unhandled Rejection at:', reason);
            // Recommended: send the information to sentry.io
            // or whatever crash reporting service you use
        });

        let runid = `${uuidv4()}_${moment().format("DD-MMM-YYYY HH:mm:ss.SSS")}`;

        let data = await datastore.getNearbyBookings(runid, DEFAULT_PROCESSOR_ID).catch(reason => log(reason));
        let cities = await datastore.getCities().catch(reason => log(reason));
        let airlines = await datastore.getAirlines().catch(reason => log(reason));
        if(data && Array.isArray(data)) {
            //await processEmail(runid, DEFAULT_PROCESSOR_ID, data).catch(reason => log(reason));

            await updateFlightStatus(data, {cities, airlines}).catch(reason => log(`updateFlightStatus Error: ${reason}`));

            log('Completed!');
            excutionStarted = false;
        }
        else {
            log(`No data found from notification engine : Msg -> ${data}`);
            excutionStarted = false;
        }
    }
    catch(ex) {
        log(e);
        excutionStarted = false;
    }
}

cron.schedule("*/10 * * * *", processor);
app.listen("9292");

//processor();

//jshint ignore:end
