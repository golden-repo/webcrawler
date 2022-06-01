//jshint esversion: 6
//jshint ignore:start
const cron = require("node-cron");
const express = require("express");
const fs = require("fs");

const uuidv4 = require('uuid/v4');
const delay = require('delay');
const moment = require('moment');
const fetch = require('isomorphic-fetch');
const datastore = require('../../radharani/goibibodatastore');


//import moment from "moment";
// import "isomorphic-fetch";
//let url = `http://developer.goibibo.com/api/search/?app_id=f8803086&app_key=012f84558a572cb4ccc4b4c84a15d523&format=json&source=CCU&destination=DEL&dateofdeparture=20190520&seatingclass=E&adults=1&children=1&infants=1&counter=100`;
const GOIBIBO_URL = 'http://developer.goibibo.com/api/search/?';

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

export class GOIBIBOCrawler {
    constructor(options) {
        this.options = options || {url: '', output: 'json', token: '', airlines: []};
    }

    postData(searchOption={url: '', data: {usrId: 109, usrType: 'N'}, token: ''}) {
        // Default options are marked with *
        let json_post = {
            method: "POST", // *GET, POST, PUT, DELETE, etc.
            mode: "cors", // no-cors, cors, *same-origin
            cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
            credentials: "same-origin", // include, *same-origin, omit
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.options.token}`,
                // "Content-Type": "application/x-www-form-urlencoded",
            },
            redirect: "follow", // manual, *follow, error
            referrer: "no-referrer", // no-referrer, *client
            body: JSON.stringify(searchOption.data), // body data type must match "Content-Type" header
        };

        return fetch(searchOption.url, json_post)
        .then(async response => {
            //Logger.log("info", "Response received");
            this.data = await response.json();
            this.finalData = await this.transformData(this.data);
            return this.data;
        })
        .catch(reason => {
            Logger.log("error", reason);
            throw reason;
        }); // parses JSON response into native Javascript objects 
    }

    getData(searchOption={url: '', src_id: 0, dst_id: 0, data: {}}) {

        return new Promise((resolve, reject) => {
            try
            {
                let json_get = {
                    method: "GET", // *GET, POST, PUT, DELETE, etc.
                    headers: {
                        "Content-Type": "application/json",
                    },
                };
        
                fetch(searchOption.url, json_get)
                .then(response => {
                    //Logger.log("info", "Response received");
                    response.json().then(responseData => {
                        let finalData = this.transformData(responseData, searchOption.src_id, searchOption.dst_id);
                        resolve(finalData);
                    })
                    .catch(reason => {
                        Logger.log(reason);
                        reject(reason);
                    });
                })
                .catch(reason => {
                    Logger.log("error", reason);
                    reject(reason);
                }); // parses JSON response into native Javascript objects     
            }
            catch(ex) {
                Logger.log('error', ex);
                reject(ex);
            }
        });
    }

    transformData(data, src_id, dst_id) {
        if(data===null || data===undefined || !data.data || !data.data.onwardflights || data.data.onwardflights.length===0) return;

        let parsedDataSet = [];
        let parsedRecord = {};
        data = data.data.onwardflights;

        for(var i=0; i<data.length; i++) {
            try
            {
                let dataItem = data[i];
                if(parseInt(dataItem.seatsavailable)>0 && parseInt(dataItem.stops)===0) {
                    let dept_date = new Date(dataItem.depdate.split('t')[0]+' ' + dataItem.deptime);
                    let arrv_date = new Date(dataItem.arrdate.split('t')[0]+' ' + dataItem.arrtime);
                    let airlineid = -1;
                    let airline = this.options.airlines.find((obj) => {
                        return obj.aircode.toLowerCase()===dataItem.carrierid.toLowerCase();
                    });
                    if(airline!==null && airline!==undefined) {
                        airlineid = airline.id;
                    }
                    else {
                        //we should insert new airline here and update the airline code
                    }

                    parsedRecord = {
                        source: src_id,
                        origin: dataItem.origin,
                        target: dataItem.destination,
                        destination: dst_id,
                        stop: parseInt(dataItem.stops),
                        flight: dataItem.airline,
                        flight_no: dataItem.flightno,
                        departure_date_time: dept_date,
                        arrival_date_time: arrv_date,
                        class: 'Economy',
                        departure_terminal: dataItem.depterminal,
                        arrival_terminal: dataItem.arrterminal,
                        no_of_seats: parseInt(dataItem.seatsavailable),
                        bookingclass: dataItem.bookingclass,
                        airline: airlineid,
                        aircraft_type: dataItem.aircraftType,
                        carrierid: dataItem.carrierid,
                        adultbasefare: parseInt('0'+dataItem.fare.adultbasefare),
                        childbasefare: parseInt('0'+dataItem.fare.childbasefare),
                        infantbasefare: parseInt('0'+dataItem.fare.infantbasefare),
                        adult_tax_fees: parseInt('0'+dataItem.fare.adulttotalfare) - parseInt('0'+dataItem.fare.adultbasefare),
                        child_tax_fees: parseInt('0'+dataItem.fare.childtotalfare) - parseInt('0'+dataItem.fare.childbasefare),
                        infant_tax_fees: parseInt('0'+dataItem.fare.infanttotalfare) - parseInt('0'+dataItem.fare.infantbasefare),
                        warning: dataItem.warnings,
                        created_by: 104,
                        created_on: new Date(),
                    };

                    parsedDataSet.push(parsedRecord);
                    Logger.log('info', 'Data', JSON.stringify(parsedRecord));
                }
            }
            catch(e) {
                Logger.log('error', e);
            }
        }

        return parsedDataSet;
    }

    async _getCircleName(circle, index) {
        let circleName = '';
        if(circle!==null && circle!==undefined && circle.indexOf('to')>-1) {
            let circles = circle.split('to');
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

    async processCircleData(circleData, options) {
        let live_tickets = [];
        let startDate = options.startdate;
        let currentDate = options.startdate;
        let endDate = options.enddate;
        let app_id = options.app_id;
        let app_key = options.app_key;
        let source = circleData.source_city_code;
        let destination = circleData.destination_city_code;
        let url = '';

        let days = 1;
        while(currentDate<=endDate) {
            let date = moment(currentDate).format('YYYYMMDD');
            url = `${GOIBIBO_URL}app_id=${app_id}&app_key=${app_key}&format=json&source=${source}&destination=${destination}&dateofdeparture=${date}&seatingclass=E&adult=1&children=0&infant=0&counter=100`;

            console.log(`Index : ${days}`);
            let ticket_data = {};
            await this.getData({url: url, src_id: circleData.source_city_id, dst_id: circleData.destination_city_id})
            .then(value => {
                if(value) {
                    //Logger.log('info', 'received tickets are null ?', (value===null || value===undefined));
                    ticket_data = value;
                }
            })
            .catch(reason => {
                //console.log(reason);
                Logger.log('error', reason);
            });
            currentDate.setDate(currentDate.getDate() + 1);
            if(ticket_data!==null && ticket_data!==undefined) {
                //Logger.log('info', 'Going to save data');
                await this.save_live_ticket(ticket_data)
                .then(value => {
                    //Logger.log('info', value);
                })
                .catch(reason => {
                    Logger.log('error', reason);
                });
                live_tickets.push(ticket_data);
                // Logger.log('info', 'Added to collection');
            }

            days++;
            this.freeze(1500);
        }

        return live_tickets;
    }

    freeze(time) {
        const stop = new Date().getTime() + time;
        while(new Date().getTime() < stop);       
    }    

    async save_live_ticket(tickets) {
        if(tickets===null || tickets===undefined || tickets.length===0) {
            return 0;
        }

        try
        {
            for (let index = 0; index < tickets.length; index++) {
                const ticket = tickets[index];
                let dept_date_time = moment(ticket.departure_date_time).format('YYYYMMDDHHmmss');
                let key = `${ticket.origin}${ticket.target}${dept_date_time}${ticket.bookingclass}${ticket.carrierid}`
                Logger.log('info', index+1, key);
                ticket.runid = key;
                await datastore.save_live_ticket(ticket).then(value => {
                    //Logger.log('info', 'datastore.save_live_ticket');
                }).catch(reason => {
                    Logger.log('error', reason);
                });
            }
        }
        catch(ex) {
            Logger.log('error', ex);
        }
        if(tickets && tickets.length>=0)
            Logger.log('info', `Tickets count : ${tickets.length}`);

        return 1;
    }
}

//jshint ignore:end