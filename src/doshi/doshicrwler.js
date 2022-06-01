//jshint esversion: 6
//jshint ignore:start
const cron = require("node-cron");
const express = require("express");
const fs = require("fs");

const uuidv4 = require('uuid/v4');
const delay = require('delay');
const moment = require('moment');
//const momenttz = require('moment-timezone');
const fetch = require('isomorphic-fetch');

//import moment from "moment";
// import "isomorphic-fetch";

export class Logger {
    static log(type, message) {
        switch (type) {
            case "info":
            Logger._write(arguments);
                break;
            case "warning":
                Logger._write(arguments);
                break;
            case "error":
                Logger._write(arguments);
                break;
            default:
                break;
        }
    }

    static _write(type) {
        var time = moment().format("HH:mm:ss.SSS");
        //arguments.splice(0)
        var args = Array.from(arguments[0]);
        type = args[0];
        args.splice(0,1);
    
        args.unshift(time);
        args.unshift(type.toUpperCase());
        console.log.apply(console, args);
    }
}

export class DoshiCrawler {
    constructor(options) {
        this.options = options || {url: '', output: 'json', cities: [], airlines: []};

        this.cities = this.options.cities;
        this.airlines = this.options.airlines;
    }

    postData(searchOption={url: '', data: {}}) {
        // Default options are marked with *
        return fetch(searchOption.url, {
            method: "POST", // *GET, POST, PUT, DELETE, etc.
            mode: "cors", // no-cors, cors, *same-origin
            cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
            credentials: "same-origin", // include, *same-origin, omit
            headers: {
                "Content-Type": "application/json",
                // "Content-Type": "application/x-www-form-urlencoded",
            },
            redirect: "follow", // manual, *follow, error
            referrer: "https://doshitravels.com/home", // no-referrer, *client
            body: JSON.stringify(searchOption.data), // body data type must match "Content-Type" header
        })
        .then(async response => {
            Logger.log("info", "Response received");
            this.data = await response.json();
            this.finalData = await this.transformData(this.data);
            return this.data;
        })
        .catch(reason => {
            Logger.log("error", reason);
            throw reason;
        }); // parses JSON response into native Javascript objects 
    }

    async transformData(data) {
        if(data===null || data===undefined || !data.success || data.tickets.length===0) return;

        let parsedDataSet = [];
        let parsedRecord = {};
        data = data.tickets;

        for(var i=0; i<data.length; i++) {
            try
            {
                let dataItem = data[i];
                let source = dataItem.route.name.split('-')[0];
                let destination = dataItem.route.name.split('-')[1];
                if((source===null || source===undefined || source.trim()==="") ||
                    (destination===null || destination===undefined || destination.trim()==="")) 
                {
                    continue;
                }

                parsedRecord = {
                    flight: dataItem.airLine,
                    flight_number: dataItem.flightNumber,
                    departure: {
                        id: -1,
                        circle: await this._getCircleName(dataItem.route.name, 0).then(result => result).catch(reason => Logger.log('error', reason)),
                        time: moment(dataItem.departure, 'YYYY-MM-DDTHH:mm:ss.SSSZ').utcOffset("+05:30").format("HH:mm"),
                        date: moment(dataItem.departure, 'YYYY-MM-DDTHH:mm:ss.SSSZ').utcOffset("+05:30").format("YYYY-MM-DD"),
                        epoch_date: await this._getDate(moment(dataItem.departure, 'YYYY-MM-DDTHH:mm:ss.SSSZ').utcOffset("+05:30").format("YYYY-MM-DD"), 
                            moment(dataItem.departure, 'YYYY-MM-DDTHH:mm:ss.SSSZ').utcOffset("+05:30").format("HH:mm")).then(result => result).catch(reason => Logger.log('error', reason))
                    },
                    arrival: {
                        id: -1,
                        circle: await this._getCircleName(dataItem.route.name, 1).then(result => result).catch(reason => Logger.log('error', reason)),
                        time: moment(dataItem.arrival, 'YYYY-MM-DDTHH:mm:ss.SSSZ').utcOffset("+05:30").format("HH:mm"),
                        date: moment(dataItem.arrival, 'YYYY-MM-DDTHH:mm:ss.SSSZ').utcOffset("+05:30").format("YYYY-MM-DD"),
                        epoch_date: await this._getDate(moment(dataItem.arrival, 'YYYY-MM-DDTHH:mm:ss.SSSZ').utcOffset("+05:30").format("YYYY-MM-DD"), 
                            moment(dataItem.arrival, 'YYYY-MM-DDTHH:mm:ss.SSSZ').utcOffset("+05:30").format("HH:mm")).then(result => result).catch(reason => Logger.log('error', reason))
                    },

                    ticket_type: dataItem.flightClass,
                    pnr: dataItem.PNR[0],
                    availability: dataItem.quantity,
                    price: (dataItem.price.total),
                    flight_id: 1,
                    runid: '',
                    recid: dataItem._id
                };

                parsedDataSet.push(parsedRecord);
                Logger.log('info', 'Data', JSON.stringify(parsedRecord));
            }
            catch(e) {
                Logger.log('error', e);
            }
        }

        return parsedDataSet;
    }

    async _getCircleName(circle, index) {
        let circleName = '';
        if(circle!==null && circle!==undefined && circle.indexOf('-')>-1) {
            let circles = circle.split('-');
            if(circles.length>0) {
                circleName = circles[index].trim();
            }
        }

        return circleName;
    }

    async _getDate(strDate, strTime) {
        let dt = Date.now();
        try{
            dt = Date.parse(`${strDate} ${strTime}`);
        }
        catch(e) {
            Logger.log('error', e);
        }

        return dt;
    }
}

//jshint ignore:end