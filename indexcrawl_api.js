//jshint esversion:6
//const tty = require('tty');
const cron = require("node-cron");
const express = require("express");
const fs = require("fs");
const router = express.Router();

const uuidv4 = require('uuid/v4');
const puppeteer = require('puppeteer');
//const metadata = require('./metadata_airiq');
const delay = require('delay');
const moment = require('moment');
const fetch = require('isomorphic-fetch');
const airtbCrawlCommonLib = require('./airtb_crawl');
//const airiqCrawlCommonLib = require('./airiqV2_crawl');

const airiqController = require('./airiq-controller');
const gfsController = require('./goflysmart-controller');

// const winston = require('winston');
// const {combine, timestamp, label, printf} = winston.format;
// const DailyRotateFile = require('winston-daily-rotate-file');

const logger = require('./src/common/logger').Logger;

logger.init('crawlapi');

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
const port = 7676;
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

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.get("/", (req, res) => {
    res.json({ message: "ok" });
});

// **** Router *****
/* GET programming languages. */
var cachedToken = null;

/* Commented as it's moved to airiq_api
router.get('/spicejet/:pnr/:email', async function(req, res, next) {
    try {
      var data = {};
      var payload = req.body;
      var url = `https://www.spicejet.com/trips/details?pnr=${req.params.pnr}&email=${req.params.email}`;
      var token = await getToken(url, cachedToken);

      logger.log('info', `Request for Email: ${req.params.email} and PNR: ${req.params.pnr}`);

      if(!token) {
        token = cachedToken;
      }

      if(token) {
        cachedToken = token;
        data = await getFlightStat(token, {pnr: req.params.pnr, email: req.params.email});
      }

      res.status(200).json(data);
    } catch (err) {
      console.error(`Error while getting programming languages `, err.message);
      next(err);
    }
});
*/

async function getFlightStat(token, payload) {
  var data = null;

  let url = `https://www.spicejet.com/api/v1/booking/retrieveBookingByPNR?recordLocator=${payload.pnr}&emailAddress=${payload.email}`;

  await fetch(url, {
    method: 'POST',
    cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
    headers: {
        "Content-Type": `application/json`,
        "Authorization": token,
        "Connection": `keep-alive`,
        "Origin": `https://www.spicejet.com`
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
        data = rsp.bookingData;
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

function prepareFlightStatData(data) {
  var flightStat = {};
  if(!data) return flightStat;

  flightStat.sector = (data.journeys && data.journeys.length>0) ? `${data.journeys[0].designator.origin} - ${data.journeys[0].designator.destination}` : '';
  flightStat.departureTime = (data.journeys && data.journeys.length>0) ? moment(data.journeys[0].designator.departure).format('YYYY-MM-DD HH:mm') : '';
  flightStat.arrivalTime = (data.journeys && data.journeys.length>0) ? moment(data.journeys[0].designator.arrival).format('YYYY-MM-DD HH:mm') : '';

  flightStat.flightno = (data.journeys && data.journeys.length>0 && data.journeys[0].segments && data.journeys[0].segments.length>0) ? 
    `${data.journeys[0].segments[0].identifier.carrierCode}-${data.journeys[0].segments[0].identifier.identifier}` : '';
  
  flightStat.status = data.info.status == 2 ? 'Confirmed' : `Not Confirmed - ${data.info.status}`;
  flightStat.paymentStatus = data.info.paidStatus == 0 ? 'Incomplete' : (data.info.paidStatus == 1 ? 'Paid' : `No Info - ${data.info.paidStatus}`);
  // flightStat.billAmount = data.breakdown.totalAmount;
  // flightStat.paidAmount = (data.breakdown.totalAmount - data.breakdown.balanceDue);
  // flightStat.dueAmount = data.breakdown.balanceDue;

  return flightStat;
}

async function getToken(refUrl, previousToken) {
  var token = null;
  var url = `https://www.spicejet.com/api/v1/token`; //`https://www.spicejet.com/trips/details?pnr=REKHST&email=INFO.AIRIQ@GMAIL.COM`

  await fetch(url, {
    method: 'POST',
    cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
    headers: {
        "Content-Type": `application/json`,
        "Authorization": previousToken,
        "Connection": `keep-alive`,
        "Origin": `https://www.spicejet.com`,
        "Referer": refUrl,
        "DNT": 1,
        "sec-ch-ua": " Not A;Brand\";v=\"99\", \"Chromium\";v=\"98\", \"Google Chrome\";v=\"98",
        "sec-ch-ua-mobile": "?0",
        "os": "desktop",
        "sec-ch-ua-platform": "\"Windows\"",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty"
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

      //console.log(`${JSON.stringify(response)}`);
      logger.log('info', `Response from getToken => ${JSON.stringify(response)}`);

      if(response && response.status == 200) {
        rsp = await response.json();
        if(rsp && rsp.data) {
          token = rsp.data.token;
        }
      }
  })
  .catch(reason => {
      console.log(`Error -> ${reason}`);
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

// router.post('/airiq', async function(req, res, next) {
//   log('AIRIQ API process started');

//   try
//   {
//       const datastore = require('./radharani/airiqV2datastore');
//       let arrvid, deptid;
//       let deptdate = '';
//       arrvid = deptid = 0;

//       excutionStarted = true;
//       capturedData = {};
//       process.on('unhandledRejection', (reason, promise) => {
//           log('Unhandled Rejection at:', reason);
//       });

//       let searchPayload = req.body;

//       let runid = `${uuidv4()}_${moment().format("DD-MMM-YYYY HH:mm:ss.SSS")}`;
//       //let crawlingUri = "https://www.flygofirst.com/";
//       let crawlingUri = `https://airiq.in/`;
//       searchPayload.sourceCity = await datastore.getCityItem(searchPayload.source);
//       searchPayload.destinationCity = await datastore.getCityItem(searchPayload.destination);
//       searchPayload.sector = `${searchPayload.source} // ${searchPayload.destination}`;
//       //searchPayload.departure_date = moment(searchPayload.departure_date, 'YYYY-MM-DD').format('DD/MMM/YYYY');

//       airiqCrawlCommonLib.ProcessActivityV2(crawlingUri, searchPayload, runid).then(async (data)=> {

//           log(`Search payload => ${JSON.stringify(searchPayload)}`);
//           try
//           {
//               log('Process completed.');

//               process.removeAllListeners("unhandledRejection");
//               process.removeAllListeners('exit');
//               process.removeAllListeners();
//           }
//           catch(e) {
//               log(e);
//           }
//           finally {
//               excutionStarted = false;
//           }
//           if(browser) {
//               browser.close();
//               log('Closing browser');
//           }
//           //save the ticket into DB
          
//           let runid = `${uuidv4()}_${moment().format("DD-MMM-YYYY HH:mm:ss.SSS")}`;
//           let tickets = [];
//           if(data)
//             tickets.push(data);
          
//           if(tickets && tickets.length>0) {
//             await datastore.saveCircleBatchData(runid, tickets, '');
//             deptid = tickets[0].departure.id;
//             arrvid = tickets[0].arrival.id;
//             deptdate = moment(tickets[0].departure.date, 'YYYY-MM-DD').format('YYYYMMDD');
//             data = tickets[0];
//           }
//           else {
//             deptid = searchPayload.sourceCity.id;
//             arrvid = searchPayload.destinationCity.id;
//             deptdate = moment(searchPayload.departure_date, 'YYYY-MM-DD').format('YYYYMMDD');
//             data = null;
//           }

//           if(deptid>0 && arrvid>0) {
//             await datastore.updateExhaustedCircleInventory(runid, deptid, arrvid, deptdate, (val) => {
//                 console.log(JSON.stringify(val));
//             }).catch(reason => {
//               logger.log('error', `Error while saving data into DB - ${url}`);
//             });
//           }

//           res.status(200).json(data);
//       }).catch((reason) => {
//           log(reason);
//           log(JSON.stringify(capturedData));
//           excutionStarted = false;

//           next(reason);
//       });
//   }
//   catch(e) {
//       log(e);
//       excutionStarted = false;
//       next(e);
//   }
// });

router.post('/airtb', async function(req, res, next) {
  log('AIR TB API process started');

  try
  {
      const datastore = require('./radharani/airtbdatastore');
      let arrvid, deptid;
      let deptdate = '';
      arrvid = deptid = 0;

      excutionStarted = true;
      capturedData = {};
      process.on('unhandledRejection', (reason, promise) => {
          log('Unhandled Rejection at:', reason);
      });

      let searchPayload = req.body;

      let runid = `${uuidv4()}_${moment().format("DD-MMM-YYYY HH:mm:ss.SSS")}`;
      //let crawlingUri = "https://www.flygofirst.com/";
      let crawlingUri = `https://airtb.in/index.aspx`;
      searchPayload.sourceCity = await datastore.getCityItem(searchPayload.source);
      searchPayload.destinationCity = await datastore.getCityItem(searchPayload.destination);

      airtbCrawlCommonLib.ProcessActivityV2(crawlingUri, searchPayload, runid).then(async (data)=> {

          log(`Search payload => ${JSON.stringify(searchPayload)}`);
          try
          {
              log('Process completed.');

              process.removeAllListeners("unhandledRejection");
              process.removeAllListeners('exit');
              process.removeAllListeners();
          }
          catch(e) {
              log(e);
          }
          finally {
              excutionStarted = false;
          }
          if(browser) {
              browser.close();
              log('Closing browser');
          }
          //save the ticket into DB
          
          let runid = `${uuidv4()}_${moment().format("DD-MMM-YYYY HH:mm:ss.SSS")}`;
          let tickets = data;
          // if(data)
          //   tickets.push(data);
          
          if(tickets && tickets.length>0) {
            await datastore.saveCircleBatchData(runid, tickets, '');
            deptid = tickets[0].departure.id;
            arrvid = tickets[0].arrival.id;
            deptdate = moment(tickets[0].departure.date, 'YYYY-MM-DD').format('YYYYMMDD');
            data = tickets[0];
          }
          else {
            deptid = searchPayload.sourceCity.id;
            arrvid = searchPayload.destinationCity.id;
            deptdate = moment(searchPayload.departure_date, 'YYYY-MM-DD').format('YYYYMMDD');
            data = null;
          }

          if(deptid>0 && arrvid>0) {
            await datastore.updateExhaustedCircleInventory(runid, deptid, arrvid, deptdate, (val) => {
                console.log(JSON.stringify(val));
            }).catch(reason => {
              logger.log('error', `Error while saving data into DB - ${url}`);
            });
          }

          res.status(200).json(tickets);
      }).catch((reason) => {
          log(reason);
          log(JSON.stringify(capturedData));
          excutionStarted = false;

          next(reason);
      });
  }
  catch(e) {
      log(e);
      excutionStarted = false;
      next(e);
  }
});

/* //commenting it as it's moved to airiq_api
router.get('/airasia/:pnr/:email', async function(req, res, next) {
  try {
    var data = {};
    var payload = req.body;
    var pnr = req.params.pnr;
    var addldata = req.params.email;

    logger.log('info', `Request for Email: ${req.params.email} and PNR: ${req.params.pnr}`);

    if(pnr && addldata) {
      data = await airasiaCommonLib.searchPNR(pnr, addldata);
    }

    res.status(200).json(data);
  } catch (err) {
    console.error(`Error while getting programming languages `, err.message);
    next(err);
  }
});
*/

//configure AirIQ routes
airiqController.init(router);
//configure GFS routes
//gfsController.init(router);
//common code
app.use('/api/crawl', router)

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

