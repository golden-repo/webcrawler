//jshint esversion:6
//jshint ignore:start

const uuidv4 = require('uuid/v4');
const delay = require('delay');
const moment = require('moment');
const fetch = require('isomorphic-fetch');

var pool = null;
const logger = require('./src/common/logger').Logger;
logger.init('flstat');

function log() {
    var time = moment().format("HH:mm:ss.SSS");
    var args = Array.from(arguments);

    args.unshift(time);
    console.log.apply(console, args);
    //winston.info(args.join(' '));
    var msg = args.join(' ');
    logger.log('info', msg);    
}

function _postData(searchOption) {
    // Default options are marked with *

    let data = searchOption.data || {
        'departure_air_code': '',
        'arrival_air_code': '',
        'departure_date': '00000000',
    }

    searchOption = searchOption || {
        url: ``,
        data: data
    };

    let json_post = {
        method: "GET", // *GET, POST, PUT, DELETE, etc.
        // mode: "cors", // no-cors, cors, *same-origin
        cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
        // credentials: "same-origin", // include, *same-origin, omit
        headers: {
            "Content-Type": "application/json",
            // "Content-Type": "application/x-www-form-urlencoded",
        },
        redirect: "follow", // manual, *follow, error
        referrer: "no-referrer" // no-referrer, *client
        // body: JSON.stringify(searchOption.data), // body data type must match "Content-Type" header
    };

    return fetch(searchOption.url, json_post)
    .then(async response => {
        logger.log("info", "Response received");
        this.data = await response.json();
        // this.finalData = await this.transformData(this.data);
        return this.data;
    })
    .catch(reason => {
        logger.log("error", reason);
        throw reason;
    }); // parses JSON response into native Javascript objects 
}

async function find_flight_status(search_data) {
    try
    {
        let origin = search_data.departure_air_code;
        let destination = search_data.arrival_air_code;
        let departure_date = search_data.departure_date;

        let result = await _postData({
            url: `https://www.ixigo.com/api/v2/flights/list?departAirportCode=${origin}&arrivalAirportCode=${destination}&departDt=${departure_date}&error=jsonError&searchType=route&apiVersion=2.0`,
            data: {}
        });

        return result;
    }
    catch(ex) {
        log(`find flight status -> ${ex}`);
        throw ex;
    }

    return false;
}

function getBookingId(context, flight_data) {
    let booking_id = (context && context.booking_id) ? parseInt(context.booking_id, 10) : -1;
    let flight_dept_date = (context && context.flight_dept_date) ? moment(context.flight_dept_date).format('YYYYMMDD') : null;
    let airline_code = (context && context.airline_code) ? context.airline_code : null;
    let flight_no = (context && context.flight_no) ? context.flight_no : null;
    let origin = (context && context.origin) ? context.origin : null;
    let destination = (context && context.destination) ? context.destination : null;

    let dept_date = moment(flight_data.timings.scheduledDepTime).format('YYYYMMDD');
    
    let is_matched = (origin === flight_data.originAirport.code) && (destination === flight_data.destAirport.code) && (dept_date === flight_dept_date) 
                    && (airline_code === flight_data.airlineCode) && (flight_data.flightNumber == flight_no);

    return is_matched ? booking_id : -1;
}

function getSourceCity(city_code, context) {
    let cities = context.city_list;

    for (let idx = 0; idx < cities.length; idx++) {
        let city = cities[idx];
        if(city.code == city_code) {
            return city.id;
        }
    }

    return -1;
}

function getAirlineId(airline_code, context) {
    let airlines = context.airline_list;

    for (let idx = 0; idx < airlines.length; idx++) {
        let airline = airlines[idx];
        if(airline.aircode == airline_code) {
            return airline.id;
        }
    }

    return -1;
}

async function transform_flight_data(flight_stat, context) {
    let stats = [];
    let stat = {};
    let data = (flight_stat && flight_stat.data) ? flight_stat.data : null;
    try {
        if(data && Array.isArray(data) && data.length>0) {
            for (let idx = 0; idx < data.length; idx++) {
                const flight_data = data[idx];
                
                try {
                    stat = {};
                    stat.booking_id = getBookingId(context, flight_data);
                    stat.stat_key = flight_data.newKey;
                    stat.source = getSourceCity(flight_data.originAirport.code, context);
                    stat.dept_aircode = flight_data.originAirport.code;
                    stat.destination = getSourceCity(flight_data.destAirport.code, context);
                    stat.arrv_aircode = flight_data.destAirport.code;
                    stat.airlineid = getAirlineId(flight_data.airlineCode, context);
                    stat.airline_name = flight_data.airlineName;
                    stat.airline_code = flight_data.airlineCode;
                    stat.airline_phone = flight_data.airlinePhone;
                    stat.flightno = flight_data.flightNumber;
                    stat.status = flight_data.status;
                    stat.status_name = flight_data.providerStatus;
                    
                    stat.sch_dept_time = moment.utc(flight_data.timings.scheduledDepTime).utcOffset(330).format('YYYY-MM-DD HH:mm');
                    stat.sch_arrv_time = moment.utc(flight_data.timings.scheduledArrTime).utcOffset(330).format('YYYY-MM-DD HH:mm');
                    
                    if(flight_data.timings.estimatedDepTime) {
                        stat.est_dept_time = moment.utc(flight_data.timings.estimatedDepTime).utcOffset(330).format('YYYY-MM-DD HH:mm');
                    }
                    // else {
                    //     stat.est_dept_time = moment(flight_data.timings.scheduledDepTime).format('YYYY-MM-DD HH:mm');
                    // }

                    if(flight_data.timings.estimatedArrTime) {
                        stat.est_arrv_time = moment.utc(flight_data.timings.estimatedArrTime).utcOffset(330).format('YYYY-MM-DD HH:mm');
                    }
                    // else {
                    //     stat.est_arrv_time = moment(flight_data.timings.scheduledArrTime).format('YYYY-MM-DD HH:mm');
                    // }
                    
                    if(flight_data.timings.actualDepTime) {
                        stat.act_dept_time = moment.utc(flight_data.timings.actualDepTime).utcOffset(330).format('YYYY-MM-DD HH:mm');
                    }
                    if(flight_data.timings.actualArrTime) {
                        stat.act_arrv_time = moment.utc(flight_data.timings.actualArrTime).utcOffset(330).format('YYYY-MM-DD HH:mm');
                    }
                    stat.delay = flight_data.delay;
                    stat.is_arrival_delayed = flight_data.isArrivalDelayed;
                    stat.is_departure_delayed = flight_data.isDepartureDelayed;
                    stat.dept_terminal = flight_data.terminalInfo.departureTerminal?flight_data.terminalInfo.departureTerminal:'';
                    stat.arrv_terminal = flight_data.terminalInfo.arrivalTerminal?flight_data.terminalInfo.arrivalTerminal:'';
                    stat.dept_gate = flight_data.terminalInfo.departureGate?flight_data.terminalInfo.departureGate:'';
                    stat.arrv_gate = flight_data.terminalInfo.arrivalGate?flight_data.terminalInfo.arrivalGate:'';
                    stat.baggage = flight_data.terminalInfo.baggage?flight_data.terminalInfo.baggage:'';

                    stats.push(stat);
                }
                catch(eex) {
                    log(`Flight stat data filler [ERROR] -> ${eex}`);
                }
            }
        }
    }
    catch(ex) {
        log(`find flight status -> ${ex}`);
        throw ex;
    }

    return stats;
}

module.exports = {find : find_flight_status, transform: transform_flight_data};