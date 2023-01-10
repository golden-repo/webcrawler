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

const logger = require('./src/common/logger').Logger;
const datastore = require('./radharani/gsheetsyncdatastore');

logger.init('gsheetsyncapi');

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

// var timeFormatFn = function() {
//     'use strict';
//     return moment().format(cfg.timeFormat);
// };

const TIMEOUT = 10000; //6000;
const POSTBACK_TIMEOUT = 12000; //8000
const POLLINGDELAY = 100;

var browser = null;
var page = null;
var pageConfig = null;
var capturedData = {};
//jshint ignore:start

var context = {};
var context_type = () => {

    var contextObj = function() {
        this._data = [];
        this.parameters = [];
    };

    contextObj.prototype.getContextData = function(key) {
        var data = null;
        if(this._data && Array.isArray(this._data)) {
            this._data.forEach((item_key, item_val) => {
                if(item_key.key == key) {
                    data = item_key.val;
                    // break;
                }
            });
        }

        return data;
    }

    contextObj.prototype.setContextData = function(key, val) {
        if (key === null || key === undefined) return -1;

        var item_val = this.getContextData(key);
        if(item_val === null || item_val === undefined) {
            this._data.push({key, val});
        }

        return this;
    }

    function init() {
        var ct = new contextObj();
        
        return ct;
    }

    return init();
};
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

function init_context() {
    // this.context = context_type.call(this);
    this.context = context_type();
}

function getContext() {
    if(this.context === null || this.context === undefined) {
        init_context();
    }
    return this.context;
}

async function saveActivityByEployee(employeeid, activities) {
    var employee = await datastore.getEmployee(employeeid);
    var activityList = await datastore.getActivities();
    var result = null;

    if(employee && employee.id>0 && activities && activities.length>0) {

        for (let index = 0; index < activities.length; index++) {
            const activity = activities[index];
            if(activity && activity.activityName !== undefined && activity.activityName !== '') {
                activityItem = activityList.find(act => act.activity_name.toLowerCase() == activity.activityName.toLowerCase());
                if(activityItem && activityItem.id>0) {
                    activity.activityId = activityItem.id;
                    activity.activity_name = activityItem.activity_name;
                    activity.employeeId = employee.code;
                    activity.empid = employee.id;
                }
            }
        }

        result = await datastore.saveActivitiesByEmployee(activities);
    }

    return result;
}

async function prepareActivityPayload(employeeid, payload) {
    let activityItems = [];

    if(payload && payload.activities && Array.isArray(payload.activities)) {
        for (let index = 0; index < payload.activities.length; index++) {
            const activityItem = payload.activities[index];

            let activity = new ActivityDTO({'employeeId': employeeid, 'activityItems': []});
            activity.activityId = activityItem.activityId;
            activity.activityName = activityItem.activityName;

            for (let idx = 0; idx < activityItem.tracker.length; idx++) {
                const trackerItem = activityItem.tracker[idx];
                let activityItemDto = new ActivityItemDTO({'month': trackerItem.month, 'startDate': trackerItem.date, 'planned': trackerItem.planned, 'achived': trackerItem.achived});
                activity.activityItems.push(activityItemDto);
            }

            activityItems.push(activity);
        }
    }

    return activityItems;
}

async function getEmployeeCSRActivities(empid, finyear) {
    var employee = await datastore.getEmployee(empid);
    var employeeCSRActivities = null;
    if(employee && employee.id>0) {
        employeeCSRActivities = await datastore.getEmployeeCSRActivities(employee.id, finyear);
    }

    return employeeCSRActivities;
}

async function getEmployees() {
    var employee = await datastore.getEmployees();
    return employee;
}

async function getEmployeeCSRSyncStatus(startDate, endDate) {
    if(startDate == null || endDate == null || startDate == undefined || startDate == '' || endDate == undefined || endDate == '') {
        let finYear = getCurrentFinancialYear();
        startDate = `${finYear.split('-')[0]}-04-01`;
        endDate = `${finYear.split('-')[1]}-03-31`;
    }

    var employeeDataSyncStatus = await datastore.getEmployeeCSRSyncStatus(startDate, endDate);

    return employeeDataSyncStatus;
}

function getCurrentFinancialYear() {
    var fiscalyear = "";
    var today = new Date();
    if ((today.getMonth() + 1) <= 3) {
      fiscalyear = (today.getFullYear() - 1) + "-" + today.getFullYear()
    } else {
      fiscalyear = today.getFullYear() + "-" + (today.getFullYear() + 1)
    }
    return fiscalyear;
}

class ActivityDTO {
    employeeId;
    activityId;
    activityName;
    activityItems;

    constructor(data) {
        this.employeeId = data.employeeId;
        this.activityId = data.activityId;
        this.activityItems = data.activityItems;
    }
}

class ActivityItemDTO {
    month;
    startDate;
    planned;
    achived;

    constructor(data) {
        this.month = data.month;
        this.startDate = this.getStartDate(data);
        this.planned = data.planned;
        this.achived = data.achived;
    }

    getStartDate = function(activityData) {
        let monthName = activityData.month;
        let monthNumber = moment().month();
        let year = activityData.data == null ? moment().year() : moment(activityData.startDate).year();

        if((monthNumber>=0 && monthNumber<=2)) {
            year = year - 1;
        }

        let date = null;
        switch (monthName.toLowerCase()) {
            case "april":
                date = moment({year: year, month: 3, day: 1}).format("YYYY-MM-DD");
                break;
            case "may":
                date = moment({year: year, month: 4, day: 1}).format("YYYY-MM-DD");
                break;
            case "june":
                date = moment({year: year, month: 5, day: 1}).format("YYYY-MM-DD");
                break;
            case "july":
                date = moment({year: year, month: 6, day: 1}).format("YYYY-MM-DD");
                break;
            case "august":
                date = moment({year: year, month: 7, day: 1}).format("YYYY-MM-DD");
                break;
            case "september":
                date = moment({year: year, month: 8, day: 1}).format("YYYY-MM-DD");
                break;
            case "october":
                date = moment({year: year, month: 9, day: 1}).format("YYYY-MM-DD");
                break;
            case "november":
                date = moment({year: year, month: 10, day: 1}).format("YYYY-MM-DD");
                break;
            case "december":
                date = moment({year: year, month: 11, day: 1}).format("YYYY-MM-DD");
                break;
            case "january":
                date = moment({year: year+1, month: 0, day: 1}).format("YYYY-MM-DD");
                break;
            case "february":
                date = moment({year: year+1, month: 1, day: 1}).format("YYYY-MM-DD");
                break;
            case "march":
                date = moment({year: year+1, month: 2, day: 1}).format("YYYY-MM-DD");
                break;
            default:
                date = moment({year: year, month: 3, day: 1}).format("YYYY-MM-DD");
                break;
        }

        return date;
    }
}

module.exports = {ActivityDTO, ActivityItemDTO, saveActivityByEployee, prepareActivityPayload, getEmployeeCSRActivities, getEmployees, getEmployeeCSRSyncStatus, getCurrentFinancialYear};