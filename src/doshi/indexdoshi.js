//jshint esversion: 6
//jshint ignore:start
const cron = require("node-cron");
const express = require("express");
const fs = require("fs");
const datastore = require('../../radharani/doshidatastore');
//require("babel-core/register");
//require("babel-polyfill");

const uuidv4 = require('uuid/v4');
const moment = require('moment');

import {Logger, DoshiCrawler} from './doshicrwler';
//import { loggers } from 'winston';

let app = express();

async function startProcess() {
    Logger.log('info', "Starting process ...");

    this.cities = await datastore.fetchCities();
    this.airlines = await datastore.fetchAirlines();

    if(this.cities===null || this.cities===undefined || this.cities.length===0) return;
    if(this.airlines===null || this.airlines===undefined || this.airlines.length===0) return;

    let doshicrawler = new DoshiCrawler({url: '', output: 'json', cities: this.cities, airlines: this.airlines});
    let response = doshicrawler.postData({url: 'https://api.doshitravels.com/ticket/getFlightDetails', data: {}});

    response.then(data => {
        Logger.log("info", JSON.stringify(data.success));

        Logger.log('info', JSON.stringify(doshicrawler.finalData));

        let runid = `${uuidv4()}_${moment().format("DD-MMM-YYYY HH:mm:ss.SSS")}`;
        datastore.saveCircleBatchData(runid, doshicrawler.finalData, "", function(rrid) {
            datastore.finalization(rrid, () => {
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
cron.schedule("*/20 * * * *", function() {
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
        startProcess();
    }
    catch(e) {
        Logger.log('error', e);
    }
    finally {
        excutionStarted = false;
    }
});

app.listen("3235");

//jshint ignore:end