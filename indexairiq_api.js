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
const goFirstCommonLib = require('./gofirstpnrcrawl');
const airasiaCommonLib = require('./airasiapnrcrawl');
const spicejetCommonLib = require('./spicejetpnrcrawl');

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
const port = 6161;
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

router.get('/spicejet/:pnr/:email', async function(req, res, next) {
    try {
      var data = {};
      var payload = req.body;
      var url = '';
      
      if(req.params.email.trim().indexOf('@')>-1) {
        url =`https://www.spicejet.com/trips/details?pnr=${req.params.pnr}&email=${req.params.email}`;
      }
      else {
        url =`https://www.spicejet.com/trips/details?pnr=${req.params.pnr}&lastName=${req.params.email}`;
      }
      //var url = `https://www.spicejet.com/trips/details?pnr=${req.params.pnr}&last=${req.params.last}`;
      /*
      // var token = await getToken(url, cachedToken);

      // logger.log('info', `Request for Email: ${req.params.email} and PNR: ${req.params.pnr}`);

      // if(!token) {
      //   token = cachedToken;
      // }

      // if(token) {
      //   cachedToken = token;
      //   data = await getFlightStat(token, {pnr: req.params.pnr, email: req.params.email});
      // }
      */

      data = await getSpicejetFlightAPIData(url, req.params.email, req.params.pnr);
      res.status(200).json(data);
    } catch (err) {
      console.error(`Error while getting programming languages `, err.message);
      next(err);
    }
});

async function getSpicejetFlightAPIData(url, email, pnr) {
  var data = {};
  //var payload = req.body;

  try
  {
    var token = await getToken(url, cachedToken);

    logger.log('info', `Request for Email: ${email} and PNR: ${pnr}`);

    if(!token) {
      token = cachedToken;
    }

    if(token) {
      cachedToken = token;
      data = await getFlightStat(token, {pnr: pnr, email: email});
    }
  }
  catch(e) {
    console.error(`Error while getting programming languages `, err.message);
    data.message = err.message;
  }

  return data;
}

router.get('/spicejetv2/:pnr/:email', async function(req, res, next) {
  log('SpiceJet API process started');

  try
  {
      excutionStarted = true;
      capturedData = {};
      process.on('unhandledRejection', (reason, promise) => {
          log('Unhandled Rejection at:', reason);
      });

      //get all other data of spicejet via api
      var url = '';
      
      if(req.params.email.trim().indexOf('@')>-1) {
        url =`https://www.spicejet.com/trips/details?pnr=${req.params.pnr}&email=${req.params.email}`;
      }
      else {
        url =`https://www.spicejet.com/trips/details?pnr=${req.params.pnr}&lastName=${req.params.email}`;
      }      
      var sgpnrdata = await getSpicejetFlightAPIData(url, req.params.email, req.params.pnr);

      let runid = `${uuidv4()}_${moment().format("DD-MMM-YYYY HH:mm:ss.SSS")}`;
      //let crawlingUri = "https://www.flygofirst.com/";
      let crawlingUri = `https://book.spicejet.com/RetrieveBooking.aspx`;
      spicejetCommonLib.ProcessActivityV2(crawlingUri, {'pnr': req.params.pnr, 'email': req.params.email}, runid).then((data)=> {
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
          sgpnrdata.flight_status = data.flightStatus;
          if(sgpnrdata.remarks) {
            sgpnrdata.remarks += ' ' + data.remarks;
          }
          else {
            sgpnrdata.remarks = data.remarks;
          }

          res.status(200).json(sgpnrdata);
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

async function getFlightStat(token, payload) {
  var data = null;

  let url = '';
  
  if(payload.email.trim().indexOf('@')>-1) {
    url = `https://www.spicejet.com/api/v1/booking/retrieveBookingByPNR?recordLocator=${payload.pnr}&emailAddress=${payload.email}`;
  }
  else {
    url = `https://www.spicejet.com/api/v1/booking/retrieveBookingByPNR?recordLocator=${payload.pnr}&lastName=${payload.email}`;
  }

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
  
  flightStat.status = data.info.status == 2 ? 'Confirmed' : (data.info.status == 3 ? 'Cancelled' : `Not Confirmed - ${data.info.status}`);
  flightStat.paymentStatus = data.info.paidStatus == 0 ? 'Incomplete' : (data.info.paidStatus == 1 ? 'Paid' : `No Info - ${data.info.paidStatus}`);
  flightStat.pax = data.breakdown.passengers ? Object.keys(data.breakdown.passengers).length : 0;
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

router.get('/gofirst/:pnr/:email', async function(req, res, next) {
  log('GoFirst API process started');

  try
  {
      excutionStarted = true;
      capturedData = {};
      process.on('unhandledRejection', (reason, promise) => {
          log('Unhandled Rejection at:', reason);
      });

      let runid = `${uuidv4()}_${moment().format("DD-MMM-YYYY HH:mm:ss.SSS")}`;
      //let crawlingUri = "https://www.flygofirst.com/";
      let crawlingUri = `https://book.flygofirst.com/Booking/Retrieve?rl=${req.params.pnr}&ln=${req.params.email}`;
      goFirstCommonLib.ProcessActivityV2(crawlingUri, {'pnr': req.params.pnr, 'email': req.params.email}, runid).then((data)=> {
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
          res.status(200).json(data);
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

//common code
app.use('/api', router)

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

