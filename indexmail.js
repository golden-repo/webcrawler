//jshint esversion:6
//const tty = require('tty');
const cron = require("node-cron");
const express = require("express");
const fs = require("fs");

const uuidv4 = require('uuid/v4');
const puppeteer = require('puppeteer');
const datastore = require('./radharani/notifydatastore');
const delay = require('delay');
const moment = require('moment');
const DEFAULT_PROCESSOR_ID = "NTFY0001";

// const winston = require('winston');
// const {combine, timestamp, label, printf} = winston.format;
// const DailyRotateFile = require('winston-daily-rotate-file');

const logger = require('./src/common/logger').Logger;
logger.init('notifier');

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
    host: 'mail.linocetech.com', //'mail.travelmergers.com',
    //secure: true,
    port: 587,
    auth: {
        user: 'read-only@linocetech.com',
        pass: 'Readonly@2021' //'TM@ve1merger@2o2l'  //'tm@readonly'
    },
    tls: {
      // do not fail on invalid certs
      rejectUnauthorized: false
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000
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
                log('Sending email ...');
                var result = await email.send({
                    template: data.templatename || 'booking',
                    message: {
                        from: 'No-Reply LinoceTech <read-only@linocetech.com>',
                        replyTo: data.email || 'Info LinoceTech <read-only@linocetech.com>',
                        to: `${payload.email};${data.receipients}`,
                        cc: `${data.email}`,
                        bcc: 'No-Reply LinoceTech <read-only@linocetech.com>'
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
                log(`Invalid payload provided`);
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

                let result = await sendEmail(ntfy_data, payload.Data, runid, processorid).catch((reason) => log(reason));
            }

            resolve(data);
        }
        else {
            reject('No data available to process');
        }
    });
}

app = express();

var excutionStarted = false;
cron.schedule("*/1 * * * *", async function() {
    log("Cron started");
    if(excutionStarted) {
        log('Previous process still running ...');
        return false;
    }

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

        let data = await datastore.bookPendingNotifications(runid, DEFAULT_PROCESSOR_ID).catch(reason => log(reason));
        if(data && Array.isArray(data)) {
            await processEmail(runid, DEFAULT_PROCESSOR_ID, data).catch(reason => log(reason));

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
});
app.listen("9191");

//jshint ignore:end
