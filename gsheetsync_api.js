//jshint esversion:6
//const tty = require('tty');
const cron = require("node-cron");
const express = require("express");
const fs = require("fs");
const router = express.Router();

const uuidv4 = require('uuid/v4');
const delay = require('delay');
const moment = require('moment');
const fetch = require('isomorphic-fetch');
// const goFirstCommonLib = require('./gofirstpnrcrawl');
// const airasiaCommonLib = require('./airasiapnrcrawl');
// const spicejetCommonLib = require('./spicejetpnrcrawl');
const activityProcessorLibrary = require('./activitylib');

// const winston = require('winston');
// const {combine, timestamp, label, printf} = winston.format;
// const DailyRotateFile = require('winston-daily-rotate-file');

const logger = require('./src/common/logger').Logger;

logger.init('gsheetsyncapi');

app = express();
const port = 7171;
const TIMEOUT = 10000; //6000;
const POSTBACK_TIMEOUT = 12000; //8000
const POLLINGDELAY = 100;

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

//Routes
router.post('/gsheetsync/activities/:employeeid', async function(req, res, next) {
    log('GSheet sync api');
    let empid = req.params.employeeid;

    try
    {
        let activityPayload = await activityProcessorLibrary.prepareActivityPayload(empid, req.body);
        console.log(`Activity payload : ${JSON.stringify(activityPayload)}`);
        var employee = await activityProcessorLibrary.saveActivityByEployee(empid, activityPayload);

        console.log(`Employee -> ${JSON.stringify(employee)}`);
        res.status(200).json(activityPayload);
    }
    catch(e) {
        log(e);
        next(e);
    }
});

router.get('/gsheetsync/activities/:employeeid/:financialyear', async function(req, res, next) {
    log('GSheet sync api');
    let empid = req.params.employeeid;
    let finyear = req.params.financialyear;

    try
    {
        // let activityPayload = await activityProcessorLibrary.prepareActivityPayload(empid, req.body);
        // console.log(`Activity payload : ${JSON.stringify(activityPayload)}`);
        // var employee = await activityProcessorLibrary.saveActivityByEployee(empid, activityPayload);

        // console.log(`Employee -> ${JSON.stringify(employee)}`);
        var employeeCSRActivities = await activityProcessorLibrary.getEmployeeCSRActivities(empid, finyear);

        res.status(200).json(employeeCSRActivities);
    }
    catch(e) {
        log(e);
        next(e);
    }
});

router.get('/gsheetsync/employees', async function(req, res, next) {
    log('Get employees');

    try
    {
        var employees = await activityProcessorLibrary.getEmployees();

        res.status(200).json(employees);
    }
    catch(e) {
        log(e);
        next(e);
    }
});

router.get('/gsheetsync/employees/syncstatus/:startdate?/:enddate?', async function(req, res, next) {
    log('Get employees');
    let startdate = req.params.startdate;
    let enddate = req.params.enddate;

    try
    {
        var employeeSyncStatus = await activityProcessorLibrary.getEmployeeCSRSyncStatus(startdate, enddate);

        res.status(200).json(employeeSyncStatus);
    }
    catch(e) {
        log(e);
        next(e);
    }
});

//common code
app.use('/api', router);

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
