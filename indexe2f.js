//jshint esversion: 6
const cron = require("node-cron");
const express = require("express");
const fs = require("fs");

const uuidv4 = require('uuid/v4');
const moment = require('moment');

import {Logger, E2FCrawler} from './e2fcrwler';
import { loggers } from 'winston';

Logger.log('info', "Starting process ...");

let e2fcrawler = new E2FCrawler({url: '', output: 'json'});
let response = e2fcrawler.postData({url: 'https://expressdev.ease2fly.com/api/destinations/get-destinations-list', data: {
    usrId: 109,
    usrType: "N"
}});

response.then(data => {
    Logger.log("info", JSON.stringify(data.result));    
}).catch(error => {
    Logger.log("error", error);
});