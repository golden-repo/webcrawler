//jshint esversion: 6
const cron = require("node-cron");
const express = require("express");
const fs = require("fs");
const datstore = require('../../radharani/e2fdatastore');
//require("babel-core/register");
//require("babel-polyfill");

const uuidv4 = require('uuid/v4');
const moment = require('moment');

import {Logger, E2FCrawler} from './e2fcrwler';
//import { loggers } from 'winston';

let app = express();

function login() {
    Logger.log('info', "Logging in ...");

    let e2fcrawler = new E2FCrawler({url: '', output: 'json'});
    let response = e2fcrawler.postData({url: 'https://eflyapi.ease2fly.com/api/auth/login', "rejectUnauthorized": false, data: {
        email:"info@oxytra.com",
        pwd:"Sumit@12356"
    }});

    response.then(data => {
        Logger.log("info", JSON.stringify(data.result));
        Logger.log('info', JSON.stringify(e2fcrawler.finalData));

        let token = data.result.token;
        startProcess(token);
        //let runid = `${uuidv4()}_${moment().format("DD-MMM-YYYY HH:mm:ss.SSS")}`;
    })
    .catch(error => {
        Logger.log("error", error);
    });
}

function startProcess(token) {
    Logger.log('info', "Starting process ...");

    let e2fcrawler = new E2FCrawler({url: '', output: 'json', token: token});
    let response = e2fcrawler.postData({url: 'https://eflyapi.ease2fly.com/api/destinations/get-destinations-list', "rejectUnauthorized": false, data: {
        usrId: 109,
        usrType: "N"
    }, token: token});

    response.then(data => {
        Logger.log("info", JSON.stringify(data.result));

        Logger.log('info', JSON.stringify(e2fcrawler.finalData));

        let runid = `${uuidv4()}_${moment().format("DD-MMM-YYYY HH:mm:ss.SSS")}`;
        datstore.saveCircleBatchData(runid, e2fcrawler.finalData, "", function(rrid) {
            datstore.finalization(rrid, () => {
                Logger.log('info', 'Finished');

                process.removeAllListeners("unhandledRejection");
                process.removeAllListeners('exit');
                process.removeAllListeners();
                return;
            });
            return;
        });
    }).catch(error => {
        Logger.log("error", error);
    });
}

var excutionStarted = false;
cron.schedule("*/10 * * * *", function() {
    Logger.log("info", "Cron started");
    if(excutionStarted) {
        Logger.log("info", 'Previous process still running ...');
        return false;
    }

    try
    {
        excutionStarted = true;
        process.on('unhandledRejection', (reason, promise) => {
            Logger.log('info','Unhandled Rejection at:', reason);
        });
        //startProcess();
        login();
    }
    catch(e) {
        Logger.log('error', e);
    }
    finally {
        excutionStarted = false;
    }
});

app.listen("3232");
