//jshint esversion:6
//jshint ignore:start

const mysql = require('mysql');
const moment = require('moment');
const DEFAULT_COMPANY_ID = 1;
const DEFAULT_USER_ID = 104;

const DEFAULT_BATCH = 20;

var pool = null;
const logger = require('../src/common/logger').Logger;
logger.init('flstat');

const config = {
    API_HOST: "https://oxytra.com" //development : http://example.com:90
    //API_HOST: "http://example.com:90"
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

function getDBPool() {
    if(pool && !pool._closed) return pool;

    //Local DB
    // pool = mysql.createPool({
    //     connectionLimit: 30,
    //     connectTimeout: 15000,
    //     timeout: 60*1000,
    //     host: "139.59.92.9",
    //     user: "oxyusr",
    //     password: "oxy@123",
    //     database: "oxytra",
    //     port: 3306
    // });

    //Local DB
    // pool = mysql.createPool({
    //     connectionLimit : 2,
    //     connectTimeout  : 60 * 60 * 1000,
    //     acquireTimeout  : 60 * 60 * 1000,
    //     timeout         : 60 * 60 * 1000,        
    //     host: "localhost",
    //     user: "root",
    //     password: "",
    //     database: "oxytra",
    //     port: 3306
    // });    
    
    // //Remote DB
    // pool = mysql.createPool({
    //     connectionLimit: 2,
    //     connectTimeout: 15000,
    //     host: "www.oxytra.com",
    //     user: "oxyusr",
    //     password: "oxy@321-#",
    //     database: "oxytra",
    //     port: 3306
    // });

    //New production
    pool = mysql.createPool({
        connectionLimit: 2,
        connectTimeout: 15000,
        host: "www.oxytra.com",
        user: "linoceuser",
        password: "l1n0ceUser@2022",
        database: "linoce",
        port: 3306
    });    

    return pool;
}

//********* Get pending notifications *********/
async function getNotifications(conn, runid, processorid, callback) {
    var sql = ` select mst.*, ntfy.* 
                from notification_tbl ntfy
                inner join
                (
                    select c.id as companyid, c.display_name, c.baseurl, c.address,
                    st.code as state_code, st.name as state_name, ct.code as country_code, ct.name as country_name, u.id as primary_userid, u.email, u.mobile
                    from company_tbl c
                    inner join user_tbl u on c.primary_user_id=u.id and u.active=1
                    inner join metadata_tbl st on st.category='lookup' and st.associated_object_type='state' and st.active=1 and st.display_name='Name' and st.id=c.state
                    inner join metadata_tbl ct on ct.category='lookup' and ct.associated_object_type='country' and ct.active=1 and ct.display_name='Name' and ct.id=c.country
                ) mst on mst.companyid=ntfy.companyid
                where ntfy.mode='EMAIL' and ntfy.status=1 and ntfy.runid='${runid}' and ntfy.processorid='${processorid}'
                limit ${DEFAULT_BATCH}`;
    conn.query(sql, function (err, data) {
        if (err || data===null || data===undefined) {
            log(err);
            data = null;
        }
        if(data!=null && data.length>0) {
            log(`****** No of pending notifications : ${data.length}`);
        }
        if(callback) {
            callback(data);
        }
    });
}

function bookPendingNotifications(runid, processorid) {
    let pool = getDBPool();

    return new Promise((resolve, reject) => {
        pool.getConnection(function(err, conn) {
            try
            {
                if(err) {
                    console.log(err);
                    reject(err);
                    return;
                }
                let currentDate = moment.utc(new Date().toGMTString()).format("YYYY-MM-DD HH:mm:ss"); //moment(new Date()).format("YYYY-MM-DD HH:mm");
                
                var sql = `update notification_tbl set runid='${runid}', picked_on=now(), processorid='${processorid}', status=1 where status=0 and mode='EMAIL' and runid is null limit ${DEFAULT_BATCH}`;
                
                try {
                    conn.query(sql, function (err, data) {
                        if (err || data===null || data===undefined) {
                            log(err);
                            reject(err);
                        }
                        else {
                            getNotifications(conn, runid, processorid, (ntfy_data) => {
                                let nfty_retrun = null;
                                if(ntfy_data && ntfy_data.length>0) {
                                    log(`Pending notification count : ${ntfy_data.length}`);
                                    nfty_retrun = ntfy_data;
                                    //resolve(ntfy_data);
                                }
                                else {
                                    log(`****** No more pending notifications left ******`);
                                    nfty_retrun = 'No data found';
                                    //reject('No data found');
                                }

                                try
                                {
                                    conn.release();
                                    conn.destroy();
                                    pool.end((err) => {
                                        if(err) {
                                            console.log(`Unable to end the pool ${err}`);
                                        }
                                        resolve(nfty_retrun);
                                    });
                                }
                                catch(e5) {
                                    console.log(e5);
                                    reject(e5);
                                }
                            });
                        }
                    });
                }
                catch(e1) {
                    log(e1);
                    reject(e1);
                }
            }
            catch(ex) {
                log(ex);
                reject(ex);
            }
        });
    });
}

function getCities() {
    let pool = getDBPool();

    return new Promise((resolve, reject) => {
        pool.getConnection(function(err, conn) {
            try
            {
                if(err) {
                    console.log(err);
                    reject(err);
                    return;
                }

                var sql = `select * from city_tbl`;
                
                try {
                    conn.query(sql, function (err, data) {
                        if (err || data===null || data===undefined) {
                            log(err);
                            reject(err);
                        }
                        else {
                            try
                            {
                                conn.release();
                                conn.destroy();
                                pool.end((err) => {
                                    if(err) {
                                        console.log(`Unable to end the pool ${err}`);
                                    }
                                    resolve(data);
                                });
                            }
                            catch(e5) {
                                console.log(e5);
                                reject(e5);
                            }
                        }
                    });
                }
                catch(e1) {
                    log(e1);
                    reject(e1);
                }
            }
            catch(ex) {
                log(ex);
                reject(ex);
            }
        });
    });
}

function getAirlines() {
    let pool = getDBPool();

    return new Promise((resolve, reject) => {
        pool.getConnection(function(err, conn) {
            try
            {
                if(err) {
                    console.log(err);
                    reject(err);
                    return;
                }

                var sql = `select * from airline_tbl`;
                
                try {
                    conn.query(sql, function (err, data) {
                        if (err || data===null || data===undefined) {
                            log(err);
                            reject(err);
                        }
                        else {
                            try
                            {
                                conn.release();
                                conn.destroy();
                                pool.end((err) => {
                                    if(err) {
                                        console.log(`Unable to end the pool ${err}`);
                                    }
                                    resolve(data);
                                });
                            }
                            catch(e5) {
                                console.log(e5);
                                reject(e5);
                            }
                        }
                    });
                }
                catch(e1) {
                    log(e1);
                    reject(e1);
                }
            }
            catch(ex) {
                log(ex);
                reject(ex);
            }
        });
    });
}

function getNearbyBookings(runid, processorid) {
    let pool = getDBPool();

    return new Promise((resolve, reject) => {
        pool.getConnection(function(err, conn) {
            try
            {
                if(err) {
                    console.log(err);
                    reject(err);
                    return;
                }
                let currentDate = moment.utc(new Date().toGMTString()).format("YYYY-MM-DD HH:mm:ss"); //moment(new Date()).format("YYYY-MM-DD HH:mm");
                
                var sql = `select 	bkf.departure_date_time, bkf.arrival_date_time, bkf.no_of_person, c1.city as origin, c1.code as origin_code, c2.city as destination, c2.code as destination_code, 
                                    TIMESTAMPDIFF(HOUR,now(),bkf.departure_date_time) as hours_left, date_format(bkf.departure_date_time, '%Y-%m-%d') as dept_date, bkf.pnr, bkf.flight_no, bkf.aircode, bkf.booking_id,
                                    convert(replace(replace(bkf.flight_no, bkf.aircode, ""),"-",""), UNSIGNED INTEGER) as flight_number,  
                                    concat(bkf.aircode, "~", convert(replace(replace(bkf.flight_no, bkf.aircode, ""),"-",""), UNSIGNED INTEGER), "~", c1.code, "~", c2.code, date_format(bkf.departure_date_time, '%d%m%Y')) as keyname
                            from bookings_tbl bk
                            inner join bookings_flights_tbl bkf on bk.id=bkf.booking_id
                            inner join city_tbl c1 on bkf.source=c1.id
                            inner join city_tbl c2 on bkf.destination=c2.id
                            where bk.status=2 and (bkf.departure_date_time>now() and TIMESTAMPDIFF(HOUR,now(),bkf.departure_date_time)<=100) or (bkf.arrival_date_time>now() and bkf.arrival_date_time < date_add(now(), interval 1 day))`;
                
                try {
                    conn.query(sql, function (err, data) {
                        if (err || data===null || data===undefined) {
                            log(err);
                            reject(err);
                        }
                        else {
                            try
                            {
                                conn.release();
                                conn.destroy();
                                pool.end((err) => {
                                    if(err) {
                                        console.log(`Unable to end the pool ${err}`);
                                    }
                                    resolve(data);
                                });
                            }
                            catch(e5) {
                                console.log(e5);
                                reject(e5);
                            }
                        }
                    });
                }
                catch(e1) {
                    log(e1);
                    reject(e1);
                }
            }
            catch(ex) {
                log(ex);
                reject(ex);
            }
        });
    });
}

function getFlightStat(conn, statkey) {
    let stat_data = null;
    let sql = `select * from flight_stat_tbl where stat_key='${statkey}'`;

    return new Promise((resolve, reject) => {
        try
        {
            conn.query(sql, function (err, data) {
                if (err) {
                    console.log(err);
                    reject(err);
                }
                else {
                    stat_data = data;
                }
                resolve(stat_data);
                // if(callback) {
                //     callback(insertStatus);
                // }
            });
        }
        catch(e) {
            reject(e);
            console.log(e);
        }
    });

    //return stat_data;
}

function insert_flight_stat(conn, stat) {
    let insertStatus = null;

    var insertSql = `INSERT INTO flight_stat_tbl (stat_key, booking_id, source, dept_aircode, destination, arrv_aircode, airlineid, airline_name, airline_code, airline_phone, flightno, status, status_name, sch_dept_time, 
                    sch_arrv_time, est_dept_time, est_arrv_time, act_dept_time, act_arrv_time, delay, is_arrival_delayed, is_departure_delayed, dept_terminal, arrv_terminal, dept_gate, arrv_gate, baggage) 
                VALUES ('${stat.stat_key}', ${stat.booking_id}, ${stat.source}, '${stat.dept_aircode}', ${stat.destination}, '${stat.arrv_aircode}', ${stat.airlineid}, '${stat.airline_name}', '${stat.airline_code}', '${stat.airline_phone}', 
                '${stat.flightno}', '${stat.status}', '${stat.status_name}', 
                ${stat.sch_dept_time ? "'" + stat.sch_dept_time + "'" : null}, ${stat.sch_arrv_time ? "'" + stat.sch_arrv_time + "'": null}, 
                ${stat.est_dept_time ? "'" + stat.sch_dept_time + "'" : null}, ${stat.est_arrv_time ? "'" + stat.est_arrv_time + "'": null}, 
                ${stat.act_dept_time ? "'" + stat.act_dept_time + "'" : null}, ${stat.act_arrv_time ? "'" + stat.act_arrv_time + "'": null}, 
                ${stat.delay}, ${stat.is_arrival_delayed ? 1 : 0}, ${stat.is_departure_delayed ? 1 : 0}, '${stat.dept_terminal}', '${stat.arrv_terminal}', '${stat.dept_gate}', '${stat.arrv_gate}', '${stat.baggage}')`;
    //console.log(insertSql);
    return new Promise((resolve, reject) => {
        try
        {
            conn.query(insertSql, function (err, data) {
                if (err) {
                    console.log(err);
                    reject(err);
                }
                else {
                    insertStatus = data.insertId;
                }
                resolve(insertStatus);
            });
        }
        catch(e) {
            reject(e);
            console.log(e);
        }
    });
}

function update_flight_stat(conn, stat) {
    let insertStatus = null;

    var updateSql = `update flight_stat_tbl set updated_on=now(), status='${stat.status}', status_name='${stat.status_name}', 
                    sch_dept_time=${stat.sch_dept_time ? "'" + stat.sch_dept_time + "'" : null }, sch_arrv_time=${stat.sch_arrv_time ? "'" + stat.sch_arrv_time + "'" : null}, 
                    est_dept_time=${stat.est_dept_time ? "'" + stat.est_dept_time + "'" : null }, est_arrv_time=${stat.est_arrv_time ? "'" + stat.est_arrv_time + "'" : null}, 
                    act_dept_time=${stat.act_dept_time ? "'" + stat.act_dept_time + "'" : null }, act_arrv_time=${stat.act_arrv_time ? "'" + stat.act_arrv_time + "'" : null}, 
                    delay=${stat.delay}, is_arrival_delayed=${stat.is_arrival_delayed ? 1 : 0}, is_departure_delayed=${stat.is_departure_delayed ? 1 : 0}, dept_terminal='${stat.dept_terminal}', 
                    arrv_terminal='${stat.arrv_terminal}', dept_gate='${stat.dept_gate}', arrv_gate='${stat.arrv_gate}', baggage='${stat.baggage}' where id= ${stat.id} and stat_key='${stat.stat_key}'`;

    //console.log(insertSql);
    return new Promise((resolve, reject) => {
        try
        {
            conn.query(updateSql, function (err, data) {
                let updatedresult = null;
                if (err) {
                    console.log(err);
                    reject(err);
                }
                else {
                    updatedresult = data;
                }
                resolve(updatedresult);
            });
        }
        catch(e) {
            reject(e);
            console.log(e);
        }
    });
}

function checkFlightStatusChanged(oldflightstat, newflightstat) {
    let flag = false;
    let bookingid = parseInt(newflightstat.booking_id, 10);

    flag =  oldflightstat.status != newflightstat.status ||
            (oldflightstat.sch_dept_time ? moment(oldflightstat.sch_dept_time).format('YYYY-MM-DD HH:mm') : null) != newflightstat.sch_dept_time || 
            (oldflightstat.sch_arrv_time ? moment(oldflightstat.sch_arrv_time).format('YYYY-MM-DD HH:mm') : null) != newflightstat.sch_arrv_time || 
            (oldflightstat.est_dept_time ? moment(oldflightstat.est_dept_time).format('YYYY-MM-DD HH:mm') : null) != newflightstat.est_dept_time || 
            (oldflightstat.est_arrv_time ? moment(oldflightstat.est_arrv_time).format('YYYY-MM-DD HH:mm') : null) != newflightstat.est_arrv_time || 
            (oldflightstat.act_dept_time ? moment(oldflightstat.act_dept_time).format('YYYY-MM-DD HH:mm') : null) != newflightstat.act_dept_time || 
            (oldflightstat.act_arrv_time ? moment(oldflightstat.act_arrv_time).format('YYYY-MM-DD HH:mm') : null) != newflightstat.act_arrv_time || 
            oldflightstat.is_arrival_delayed != newflightstat.is_arrival_delayed || 
            oldflightstat.is_departure_delayed != newflightstat.is_departure_delayed || 
            oldflightstat.dept_terminal != newflightstat.dept_terminal || 
            oldflightstat.arrv_terminal != newflightstat.arrv_terminal || 
            oldflightstat.dept_gate != newflightstat.dept_gate || 
            oldflightstat.arrv_gate != newflightstat.arrv_gate || 
            oldflightstat.baggage != newflightstat.baggage || 
            oldflightstat.delay != newflightstat.delay;

    
    return {'booking_id': bookingid, 'result': flag};
}

function saveFlightStat(flightstats) {
    let pool = getDBPool();

    return new Promise((resolve, reject) => {
        pool.getConnection(async (err, conn) => {
            try
            {
                if(err) {
                    console.log(err);
                    reject(err);
                    return;
                }

                for (let idx = 0; idx < flightstats.length; idx++) {
                    try
                    {
                        const flightstat = flightstats[idx];
                        let existing_flight_stat = await getFlightStat(conn, flightstat.stat_key);
                        if(existing_flight_stat && existing_flight_stat.length>0) {
                            //update flight stat
                            flightstat.id = existing_flight_stat[0].id;
                            flightstat.stat_key = existing_flight_stat[0].stat_key;
                            let result = await update_flight_stat(conn, flightstat);
                            let check_status_change = await checkFlightStatusChanged(existing_flight_stat[0], flightstat);
                            if(check_status_change && check_status_change.result && check_status_change.booking_id>0) {
                                //This is place to send email to booking email id and company email.
                                log(`Change identified -> Sending email | BK-${check_status_change.booking_id} | Id: ${flightstat.id}`)
                                log(`Notify booker about the change : BK-${check_status_change.booking_id} | ${JSON.stringify(flightstat)}`);
                                _postData({
                                    'url': `${config.API_HOST}/api/company/notify`,
                                    'data': {
                                        'docno': flightstat.id,
                                        'doctype': 'flight_status_change',
                                        'template': 'flight_status_change',
                                        'booking_id': parseInt(check_status_change.booking_id, 10),
                                        'stat_key': flightstat.stat_key
                                    }
                                });
                            }

                            log(`Flight stat Updated : ${flightstat.id} - ${flightstat.stat_key} | BK-${check_status_change.booking_id} | Check Status : ${JSON.stringify(check_status_change)}`);
                        }
                        else {
                            //insert new record
                            let result = await insert_flight_stat(conn, flightstat);
                            
                            if(result>0) {
                                flightstat.id = result;
                            }

                            if(flightstat.booking_id>0 && flightstat.id>0) {
                                _postData({
                                    'url': `${config.API_HOST}/api/company/notify`,
                                    'data': {
                                        'docno': flightstat.id,
                                        'doctype': 'flight_status_change',
                                        'template': 'flight_status_change',
                                        'booking_id': parseInt(flightstat.booking_id, 10),
                                        'stat_key': flightstat.stat_key
                                    }
                                });
                            }

                            log(`Flight stat Insert : ${result} - ${flightstat.stat_key}`);
                        }
                    }
                    catch(eex) {
                        log(`Save flight stat error : ${eex}`);
                    }
                }

                try
                {
                    conn.release();
                    conn.destroy();
                    pool.end((err) => {
                        if(err) {
                            console.log(`Unable to end the pool ${err}`);
                        }
                        resolve(true);
                    });
                }
                catch(e5) {
                    console.log(e5);
                    reject(e5);
                }
            }
            catch(ex) {
                log(ex);
                reject(ex);
            }
        });
    });
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
        method: "POST", // *GET, POST, PUT, DELETE, etc.
        // mode: "cors", // no-cors, cors, *same-origin
        cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
        // credentials: "same-origin", // include, *same-origin, omit
        headers: {
            "Content-Type": "application/json",
            // "Content-Type": "application/x-www-form-urlencoded",
        },
        redirect: "follow", // manual, *follow, error
        referrer: "no-referrer", // no-referrer, *client
        body: JSON.stringify(searchOption.data), // body data type must match "Content-Type" header
    };

    return fetch(searchOption.url, json_post)
    .then(async response => {
        logger.log("info", "Response received");
        this.data = await response.json();
        //this.data = response;
        // this.finalData = await this.transformData(this.data);
        return this.data;
    })
    .catch(reason => {
        logger.log("error", JSON.stringify(reason));
        throw reason;
    }); // parses JSON response into native Javascript objects 
}

module.exports = {bookPendingNotifications, getNotifications, getNearbyBookings, getCities, getAirlines, saveFlightStat};