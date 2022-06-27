//jshint esversion:6
//const tty = require('tty');
const cron = require("node-cron");
const express = require("express");
const fs = require("fs");
const router = express.Router();

const uuidv4 = require('uuid/v4');
const puppeteer = require('puppeteer');
const metadata = require('./metadata_airiq');
const delay = require('delay');
const moment = require('moment');
const fetch = require('isomorphic-fetch');
// const winston = require('winston');
// const {combine, timestamp, label, printf} = winston.format;
// const DailyRotateFile = require('winston-daily-rotate-file');

const logger = require('./src/common/logger').Logger;

logger.init('airiqapi');

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

var timeFormatFn = function() {
    'use strict';
    return moment().format(cfg.timeFormat);
};

var capturedData = {};
//jshint ignore:start

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

function getSubscription() {
    var subscription = 'fe65ec9eec2445d9802be1d6c0295158';

    return subscription;
}

function preparePayload(pnr, additionalData) {
    var data = {'addtnlDetail': additionalData, 'recordLocator': pnr, 'sessionType': 'WebAnonUser'};

    return data;
}

function prepareFlightStatData(responsePayload) {
    var result = {};

    if(responsePayload) {
        try
        {
            var journey = (responsePayload.journeys && responsePayload.journeys.length>0) ? responsePayload.journeys[0] : null;
            var segment = (journey && journey.segments && journey.segments.length>0) ? journey.segments[0] : null;
            result.sector = journey ? `${journey.designator.origin}-${journey.designator.destination}` : null;
            result.departureTime = journey ? moment(journey.designator.departure).format('YYYY-MM-DD HH:mm') : null;
            result.arrivalTime = journey ? moment(journey.designator.arrival).format('YYYY-MM-DD HH:mm') : null;
            result.arrivalTerminal = journey ? journey.designator.arrivalTerminal : null;
            result.departureTerminal = journey ? journey.designator.departureTerminal : null;
            result.stops = journey ? journey.stops : -1;
            result.paymentStatus = (responsePayload.info && responsePayload.info.paidStatus == 1) ? 'Paid' : 'Incomplete';
            result.status = (responsePayload.info && responsePayload.info.status == 2) ? 'Confirmed' : 'Not Confirmed';
            result.pax = (responsePayload.passengers && responsePayload.passengers.length > 0) ? responsePayload.passengers.length : 0;
            result.fligtno = segment && segment.flightReference ? segment.flightReference.substring(9, segment.flightReference.length-7).trim() : null;
            result.fligtno = result.fligtno ? result.fligtno.replace(' ', '-').trim() : '';
        }
        catch(ex) {
            result.error = ex.message;
        }
    }

    return result;
}

async function searchPNR(pnr, additionalData) {
    var data = null;

    var subscription = getSubscription();

    let url = `https://api.airasia.co.in/b2c-CheckIn/v2/check-in/retrieve/byRecordLocator`;
  
    await fetch(url, {
      method: 'POST',
      cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
      headers: {
          "Content-Type": `application/json`,
          "Connection": `keep-alive`,
        //   "Origin": `https://www.spicejet.com`,
          "User-Agent": `Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1`,
          "Ocp-Apim-Subscription-Key": `${subscription}`
      },
      redirect: "follow",
      referrer: "no-referrer",
      body: JSON.stringify(preparePayload(pnr, additionalData))
    })
    .then(async response => {
        //this.log("info", "Response received");
        var rsp = response;
        // if(options && options.headers["Content-Type"].indexOf('json') > -1) {
        //     rsp = await response.json();
        // }
  
        rsp = await response.json();
        if(rsp && rsp.data) {
          data = rsp.data; //rsp.bookingData;
          logger.log('info', `Response from getFlightStat => ${JSON.stringify(data)}`);
  
          data = await prepareFlightStatData(data);
        }
    })
    .catch(reason => {
        console.log(`Error -> ${reason}`);
        flag = false;
    });  
  
    return data;  
}

module.exports = {searchPNR};