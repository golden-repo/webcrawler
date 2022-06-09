//jshint esversion:6
//const tty = require('tty');
const cron = require("node-cron");
const express = require("express");
const fs = require("fs");
const router = express.Router();

const uuidv4 = require('uuid/v4');
//const puppeteer = require('puppeteer');
//const metadata = require('./metadata_airiq');
const delay = require('delay');
const moment = require('moment');
const fetch = require('isomorphic-fetch');
// const winston = require('winston');
// const {combine, timestamp, label, printf} = winston.format;
// const DailyRotateFile = require('winston-daily-rotate-file');

const logger = require('./src/common/logger').Logger;

logger.init('goflysmart');

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

const USERINPUT = {
    id: 1,
    controlid: '',
    delaybefore: -1,
    selector: '',
    checkcontent: '',
    type: '',
    value: '',
    action: '',
    delayafter: -1,
    checkselector: '',
    next: 2
};

app = express();
const port = 7171;
const TIMEOUT = 10000; //6000;
const POSTBACK_TIMEOUT = 12000; //8000
const POLLINGDELAY = 100;

var browser = null;
var page = null;
var pageConfig = null;
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

async function takeSnapshot(filename) {
    var time = moment().format("HH_mm_ss_SSS");
    await page.screenshot({path: `${filename}-${time}.png`});
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  res.status(500);
  res.render('error', { error: err });
}

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(errorHandler);

app.get("/", (req, res) => {
    res.json({ message: "ok" });
});

// **** Router *****
/* GET programming languages. */
var cachedToken = null;

router.post('/', async function(req, res, next) {
    try {
      const datastore = require('./radharani/goflysmartdatastore');
      var adult = parseInt(req.body.adult);
      var child = parseInt(req.body.child);
      var infant = parseInt(req.body.infant);
      var destination = req.body.destination;
      var origin = req.body.origin;
      var departure_date = encodeURIComponent(moment(req.body.departure_date).format("MM/DD/YYYY"));
      var page = 1;
      var deptid = parseInt(req.body.sourceCityId);
      var arrvid = parseInt(req.body.destinationCityId);

      var email = '9382207002';
      var password = 'Sumit@12356';

      var payload = req.body;
      var url = `https://goflysmartapi.azurewebsites.net/api/search?adults=${adult}&child=${child}&infant=${infant}&destination=${destination}&origin=${origin}&departure_date=${departure_date}&page=${page}`;
      var token = await getToken(email, password);

      logger.log('info', `Request for Email: ${email} and Password: ${password}`);

      logger.log('info', `Search Url => : ${url}`);

      if(token) {
        cachedToken = token;
        data = await searchFlight(token, url, payload);
        let runid = `${uuidv4()}_${moment().format("DD-MMM-YYYY HH:mm:ss.SSS")}`;

        if(data && data.length>0) {
            await datastore.saveCircleBatchData(runid, data, '');
            //let deptid = data[0].departure.id;
            //let arrvid = data[0].arrival.id;
        }

        if(deptid>0 && arrvid>0) {
          await datastore.updateExhaustedCircleInventory(runid, deptid, arrvid, (val) => {
              console.log(JSON.stringify(val));
          }).catch(reason => {
            logger.log('error', `Error while saving data into DB - ${url}`);
          });
        }
      }

      res.status(200).json(data);
    } catch (err) {
      //console.error(`Error while getting programming languages `, err.message);
      //logger.log('error', "Error while saving data into DB");
      logger.log('error', `Error in API - ${err}`);
      next(err);
    }
});

async function searchFlight(token, url, payload) {
  var data = null;

  //let url = `https://www.spicejet.com/api/v1/booking/retrieveBookingByPNR?recordLocator=${payload.pnr}&emailAddress=${payload.email}`;

  await fetch(url, {
    method: 'GET',
    cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
    headers: {
        "Content-Type": `application/json`,
        "Authorization": token,
        "Connection": `keep-alive`
    },
    redirect: "follow",
    referrer: "no-referrer",
  })
  .then(async response => {
      //this.log("info", "Response received");
      var rsp = response;
      // if(options && options.headers["Content-Type"].indexOf('json') > -1) {
      //     rsp = await response.json();
      // }

      rsp = await response.json();
      if(rsp) {
        data = rsp.data;
        logger.log('info', `Response from getFlightStat => ${JSON.stringify(data)}`);

        data = await prepareFlightStatData(data, payload);
      }
  })
  .catch(reason => {
      //console.log(`Error -> ${reason}`);
      logger.log('error', `Error while calling searchFlight - ${reason}`);
      flag = false;
  });

  return data;
}

function prepareFlightStatData(data, payload) {
    var circleData = [];
    var ticket = {};
    var flightDataList = (data && data.data) ? data.data : [];
    if(flightDataList && flightDataList.length == 0) return null;

    for (let index = 0; index < flightDataList.length; index++) {
      try
      {
        const flightData = flightDataList[index];
        let deptDate = moment.utc(flightData.travel_date).utcOffset(330).format("YYYY-MM-DD");
        let arrvDate = moment.utc(flightData.arrival_date).utcOffset(330).format("YYYY-MM-DD");
        ticket = {};

        var flightCode = (flightData.flight_no && flightData.flight_no.indexOf(' ')>-1) ? flightData.flight_no.split(' ')[0] : '';
        
        ticket.flight = flightData.airline.name;
        ticket.flight_code = flightCode;
        ticket.flight_number = flightData.flight_no;
        ticket.ticket_type = 'Economy';

        ticket.departure = {
            "circle": flightData.destination.origin.code,
            "date": deptDate,
            "time": flightData.departure_time,
            "epoch_date": Date.parse(`${deptDate} ${flightData.departure_time}:00.000`)
        }        
        
        ticket.arrival = {
            "circle": flightData.destination.destination.code,
            "date": arrvDate,
            "time": flightData.arrival_time,
            "epoch_date": Date.parse(`${arrvDate} ${flightData.arrival_time}:00.000`)
        }

        ticket.availability = flightData.seats_available ? parseInt(flightData.seats_available) : (parseInt(payload.adult) + parseInt(payload.child));
        ticket.price = parseFloat(flightData.adult) + 50.0; //default API price charge
        ticket.recid = flightData.id;

        logger.log('info', `Ticket ${index} - ${JSON.stringify(ticket)}`);

        circleData.push(ticket);
      }
      catch(e) {
        logger.log('error', `Error in prepareFlightStatData - ${e}`);
      }
    }

    return circleData;
}

async function getToken(email, password) {
  var token = null;
  var url = `https://goflysmartapi.azurewebsites.net/api/login`;
  var payload = JSON.stringify({"email": email,"password": password});

  await fetch(url, {
    method: 'POST',
    cache: "no-cache",
    headers: {
        "Content-Type": `application/json`,
        "Connection": `keep-alive`,
    },
    redirect: "follow",
    referrer: "no-referrer",
    body: payload
  })
  .then(async response => {
      //this.log("info", "Response received");
      var rsp = response;
      // if(options && options.headers["Content-Type"].indexOf('json') > -1) {
      //     rsp = await response.json();
      // }

      //console.log(`${JSON.stringify(response)}`);

      if(response && response.status == 200) {
        rsp = await response.json();
        if(rsp && rsp.access_token) {
          token = rsp.access_token;
        }
        logger.log('info', `Response from getToken => ${JSON.stringify(rsp)}`);
      }
  })
  .catch(reason => {
      //console.log(`Error -> ${reason}`);
      logger.log('error', `Error while using getToken - ${reason}`);
  });

  return token;
}

function getData() {
    return {
        'status': false,
        'data': 1,
        'message': 'data response payload',
        'error': -1
    }
}

//common code
app.use('/api/goflysmart', router)

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
