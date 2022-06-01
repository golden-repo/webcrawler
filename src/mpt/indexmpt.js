//jshint esversion: 6
const cron = require("node-cron");
const express = require("express");
const fs = require("fs");
const datstore = require('../../radharani/mptdatastore');
//require("babel-core/register");
//require("babel-polyfill");

const uuidv4 = require('uuid/v4');
const moment = require('moment');

import {Logger, MPTCrawler} from './mptcrwler';
//import { loggers } from 'winston';

let app = express();

function login() {
    Logger.log('info', "Logging in ...");

    let mptcrawler = new MPTCrawler({url: '', output: 'json'});
    // https://fd.metropolitantravels.com/api/flights?_=1557470967694
    let response = mptcrawler.getData({url: 'https://fd.metropolitantravels.com/login', data: {
        email: "sneha.rrh@gmail.com", //"radharaniholidays@gmail.com",
        pwd: "Sumit@12356"
    }});

    response.then(data => {
        Logger.log("info", JSON.stringify(data.result));
        Logger.log('info', JSON.stringify(mptcrawler.finalData));

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

    let mptcrawler = new MPTCrawler({url: '', output: 'json', token: token});
    let response = mptcrawler.getData({url: 'https://fd.metropolitantravels.com/api/flights?_=1557470967694', data: {
        usrId: 109,
        usrType: "N"
    }, token: token});

    response.then(data => {
        Logger.log("info", JSON.stringify(data.result));

        Logger.log('info', JSON.stringify(mptcrawler.finalData));

        let runid = `${uuidv4()}_${moment().format("DD-MMM-YYYY HH:mm:ss.SSS")}`;
        datstore.saveCircleBatchData(runid, mptcrawler.finalData, "", function(rrid) {
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
cron.schedule("*/5 * * * *", function() {
    Logger.log("info", "Cron started");
    if(excutionStarted) {
        Logger.log("info", 'Previous process still running ...');
        return false;
    }
    else {
        try
        {
            excutionStarted = true;
            process.on('unhandledRejection', (reason, promise) => {
                Logger.log('info','Unhandled Rejection at:', reason);
            });
            startProcess();
            //login();
            console.log("Process done");
        }
        catch(e) {
            Logger.log('error', e);
        }
        finally {
            excutionStarted = false;
        }
    }
});

app.listen("3236");
