//jshint esversion: 6
const cron = require("node-cron");
const express = require("express");
const fs = require("fs");
const datastore = require('../../radharani/goibibodatastore');
//require("babel-core/register");
//require("babel-polyfill");

const uuidv4 = require('uuid/v4');
const moment = require('moment');

const SCAN_DAYS = 45;

import {Logger, GOIBIBOCrawler} from './goibibocrawler';
//import { loggers } from 'winston';

let app = express();

let app_key = '012f84558a572cb4ccc4b4c84a15d523';
let app_id = 'f8803086';
let url = `http://developer.goibibo.com/api/search/?app_id=f8803086&app_key=012f84558a572cb4ccc4b4c84a15d523&format=json&source=CCU&destination=DEL&dateofdeparture=20190520&seatingclass=E&adults=1&children=0&infants=0&counter=100`;

async function startProcess() {
    Logger.log('info', "Starting process ...");
    let token = '';

    let circleCrawlableData = await datastore.getCirclesWithDeptDates();
    let airlineMasterData = await datastore.getAirlineMasterData();
    let goibibocrawler = new GOIBIBOCrawler({url: '', output: 'json', token: token, airlines: airlineMasterData});

    if(circleCrawlableData !== null && circleCrawlableData !== undefined && circleCrawlableData.length>0) {
        //circleCrawlableData.forEach(circleData => {
        for (let index = 0; index < circleCrawlableData.length; index++) {
            
            let circleData = circleCrawlableData[index];
            let dt = new Date();
            let dt1 = new Date();
            dt1.setDate(dt1.getDate()+SCAN_DAYS);
            await datastore.cleanCircleLiveTicketData(circleData, {startdate: dt, enddate: dt1, app_id: app_id, app_key: app_key, harddelete: false}).catch(reason => {
                //console.log(`Error1 : ${reason}`);
                Logger.log('Error 1', reason);
            });

            let circleData4FullPeriod = await goibibocrawler.processCircleData(circleData, {startdate: dt, enddate: dt1, app_id: app_id, app_key: app_key}).catch(reason => {
                //console.log(`Error2 : ${reason}`);
                Logger.log('Error 2', reason);
            });

            if(circleData4FullPeriod!==null && circleData4FullPeriod!==undefined && circleData4FullPeriod.length>0) {
                //now time to insert into DB live_tickets_tbl;
                Logger.log(`One circle completed ${circleData.source_city_id} - ${circleData.destination_city_id}`);
            }
        }
    }

    // let response = e2fcrawler.postData({url: 'https://expressdev.ease2fly.com/api/destinations/get-destinations-list', data: {
    //     usrId: 109,
    //     usrType: "N"
    // }, token: token});

    // response.then(data => {
    //     Logger.log("info", JSON.stringify(data.result));

    //     Logger.log('info', JSON.stringify(e2fcrawler.finalData));

    //     let runid = `${uuidv4()}_${moment().format("DD-MMM-YYYY HH:mm:ss.SSS")}`;
    //     datstore.saveCircleBatchData(runid, e2fcrawler.finalData, "", function(rrid) {
    //         datstore.finalization(rrid, () => {
    //             Logger.log('info', 'Finished');

    //             process.removeAllListeners("unhandledRejection");
    //             process.removeAllListeners('exit');
    //             process.removeAllListeners();
    //             return;
    //         });
    //         return;
    //     });
    // }).catch(error => {
    //     Logger.log("error", error);
    // });
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
        startProcess();
        process.removeAllListeners("unhandledRejection");
        process.removeAllListeners('exit');
        process.removeAllListeners();
    }
    catch(e) {
        Logger.log('error', e);
    }
    finally {
        excutionStarted = false;
    }
});

app.listen("3238");
