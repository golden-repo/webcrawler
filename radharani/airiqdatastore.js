//jshint esversion:6
//jshint ignore:start

const mysql = require('mysql');
const moment = require('moment');
const DEFAULT_COMPANY_ID = 1;
const DEFAULT_USER_ID = 104;
var pool = null;

const logger = require('../src/common/logger').Logger;
logger.init('airiq');

function log() {
    var time = moment().format("HH:mm:ss.SSS");
    var args = Array.from(arguments);

    args.unshift(time);
    console.log.apply(console, args);
    // winston.info(args.join(' '));
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
    pool = mysql.createPool({
        connectionLimit : 2,
        connectTimeout  : 60 * 60 * 1000,
        acquireTimeout  : 60 * 60 * 1000,
        timeout         : 60 * 60 * 1000,        
        host: "localhost",
        user: "root",
        password: "",
        database: "oxytra",
        port: 3306
    });
    
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
    // pool = mysql.createPool({
    //     connectionLimit: 2,
    //     connectTimeout: 15000,
    //     host: "www.oxytra.com",
    //     user: "linoceuser",
    //     password: "l1n0ceUser@2022",
    //     database: "linoce",
    //     port: 3306
    // });    

    return pool;
}

async function saveData(result, runid, callback) {
    getDBPool().getConnection(async function(err, con) {
        try
        {
            if(err) {
                console.log(err);
                await saveData(result, runid, callback);
                return;
            }
            //console.log('DB connected');
            var srccity = result.departure.circle;
            var dstcity = result.arrival.circle;
            var aircode = result.flight;
            var airline = `${result.flight}_${result.flight_number}`;
            var sql = `select id from city_tbl where code = '${srccity}'`;
            //var sql = `INSERT INTO city_tbl ( city, code ) SELECT '${srccity}', '${srccity}' WHERE NOT EXISTS (SELECT * FROM city_tbl WHERE code = '${srccity}')`;
            var insertStatus = {};
            con.query(sql, function (err, data) {
                if (err) 
                    console.log(err);
                let cityid = 0;
                if(data && data.length) {
                    cityid = data[0].id;
                }
                //console.log(JSON.stringify(data));
                //console.log(`${srccity} & ${dstcity} record inserted`);
                if(cityid===0) {
                    let insertQry = `INSERT INTO city_tbl ( city, code ) values ('${srccity}', '${srccity}')`;
                    con.query(insertQry, function(err1, data1) {
                        if (err1) 
                            console.log(err1);
                        insertStatus.firstQueryFeedback = data1;
                    });
                }
            
                //second query
                sql = `select id from city_tbl where code = '${dstcity}'`;
                //sql = `INSERT INTO city_tbl ( city, code ) SELECT '${dstcity}', '${dstcity}' WHERE NOT EXISTS (SELECT * FROM city_tbl WHERE code = '${dstcity}')`;
                con.query(sql, function (err1, data1) {
                    if (err1) 
                        console.log(err1);
                    //console.log(JSON.stringify(data));
                    //console.log(`${srccity} & ${dstcity} record inserted`);
                    cityid=0;
                    
                    if(data1 && data1.length>0) {
                        cityid = data1[0].id;
                    }
                    
                    //third query
                    //sql = `INSERT INTO airline_tbl (aircode,airline, image) SELECT '${aircode}','${airline}', 'faculty_1540217511.png' WHERE NOT EXISTS (SELECT * FROM airline_tbl WHERE aircode = '${aircode}')`;
                    if(cityid===0) {
                        insertQry = `INSERT INTO city_tbl ( city, code ) values ('${dstcity}', '${dstcity}')`;
                        con.query(insertQry, async function (err2, data2) {
                            if (err2) 
                                console.log(err2);
                            //console.log(JSON.stringify(data));
                            //console.log(`${srccity} & ${dstcity} record inserted`);
                            insertStatus.secondQueryFeedback = data2;
                        });
                    }

                    sql = `SELECT id FROM airline_tbl WHERE aircode = '${aircode}'`;
                    var airline_id=0;
                    //sql = `INSERT INTO city_tbl ( city, code ) SELECT '${dstcity}', '${dstcity}' WHERE NOT EXISTS (SELECT * FROM city_tbl WHERE code = '${dstcity}')`;
                    con.query(sql, async function (err2, data2) {
                        if (err2) 
                            console.log(err2);
                        if(data2 && data2.length>0)
                            airline_id = data2[0].id;
                        
                        if(airline_id===0) {
                            insertQry = `INSERT INTO airline_tbl (aircode,airline, image) values ('${aircode}','${airline}', 'flight.png')`;
                            con.query(insertQry, async function (err3, data3) {
                                if (err3) 
                                    console.log(err3);
                                //console.log(JSON.stringify(data));
                                //console.log(`${srccity} & ${dstcity} record inserted`);
                                insertStatus.thirdQueryFeedback = data3;
                            });
                        }

                        var saveResult = await saveTicketInformation(con, result, insertStatus, runid, function(insertresult) {
                            //con.destroy();
                            con.release();
                            insertStatus = insertresult;
        
                            if(callback) {
                                callback(insertStatus);
                            }
                        });
                    });
                    //con.destroy();
                });
            });
        }
        catch(ex) {
            console.log(ex);
        }
    });
}

async function saveTicketInformation(conn, result, options, runid,callback) {
    var saveResult = {};
    var srccity = result.departure.circle;
    var dstcity = result.arrival.circle;
    var aircode = result.flight;
    var airline = `${result.flight}_${result.flight_number}`;

    var srcCity = 0;
    var destCity = 0;
    var airline = 0;
    getCity(conn, srccity, function(data) {
        srcCity = data;
        getCity(conn, dstcity, function(data1) {
            destCity = data1;
            getAirline(conn, aircode, function(airlineData) {
                airline = airlineData;

                var results = [];
                results.push(srcCity);
                results.push(destCity);
                results.push(airline);
            
                if(results!==null) {
                    if(results.length>0) {
                        srccity = parseInt(results[0]);
                    }
                    if(results.length>1) {
                        dstcity = parseInt(results[1]);
                    }
                    if(results.length>2) {
                        aircode = parseInt(results[2]);
                    }
            
                    result.departure.id = srccity;
                    result.arrival.id = dstcity;
                    result.flight_id = aircode;
            
                    saveTicket(conn, result, runid, function(saveresult) {
                        saveResult = saveresult;
                        if(callback) {
                            callback(saveResult);
                        }
                    });
                }
            });
        });
    });
}

async function saveTicket(conn, result, runid, callback) {
    let deptDate1 = moment(new Date(result.departure.epoch_date)).format("YYYY-MM-DD HH:mm:ss");
    let arrvDate1 = moment(new Date(result.arrival.epoch_date)).format("YYYY-MM-DD HH:mm:ss");
    let deptDate = moment(new Date(result.departure.epoch_date)).format("YYYY-MM-DD HH:mm");
    let arrvDate = moment(new Date(result.arrival.epoch_date)).format("YYYY-MM-DD HH:mm");
    let emptyDate = moment(new Date(0,0,0,0,0,0)).format("YYYY-MM-DD HH:mm");
    let currentDate = moment.utc(new Date().toGMTString()).format("YYYY-MM-DD HH:mm:ss"); //moment(new Date()).format("YYYY-MM-DD HH:mm");

    var qrySql = `select id from tickets_tbl where source='${result.departure.id}' and destination=${result.arrival.id} and departure_date_time='${deptDate}' and arrival_date_time='${arrvDate}' and airline='${result.flight_id}' and data_collected_from='neptunenext'`;
    conn.query(qrySql, function (err, data) {
        if(err) {
            console.log(err);
        }
        let insertStatus = {};

        //console.log((data.length>0?'Update':'Insert') + JSON.stringify(result));
        if(data.length>0) {
            //var updateSql = `update tickets_tbl set no_of_person=${result.availability}, max_no_of_person=${result.availability}, availibility= ${result.availability}, price=${result.price}, total=${result.price}+baggage+meal+markup+admin_markup-discount where source='${result.departure.id}' and destination='${result.arrival.id}' and departure_date_time='${deptDate}' and arrival_date_time='${arrvDate}' and airline='${result.flight_id}' and data_collected_from='neptunenext'`;
            var updateSql = `update tickets_tbl set no_of_person=${result.availability}, max_no_of_person=${result.availability}, availibility= ${result.availability}, available='${result.availability>0?'YES':'NO'}', price=${result.price}, total=${result.price}, last_sync_key='${runid}', updated_by=${DEFAULT_USER_ID}, updated_on='${currentDate}' where source='${result.departure.id}' and destination='${result.arrival.id}' and departure_date_time='${deptDate}' and arrival_date_time='${arrvDate}' and airline='${result.flight_id}' and data_collected_from='neptunenext'`;
            //console.log(`Duplicate ticket (${data[0].id}) exists. Updating record.`);
            //console.log(JSON.stringify(result));

            conn.query(updateSql, function (err, data) {
                if (err) {
                    console.log(err);
                }
                else {
                    //console.log(JSON.stringify(data));
                    //console.log(JSON.stringify(result));
                    //console.log(`${data.insertId} ticket record inserted - ${JSON.stringify(data)}`);
                    insertStatus = data;
                }
        
                if(callback) {
                    callback(insertStatus);
                }
            });
        }
        else {
            var insertSql = `INSERT INTO tickets_tbl (source, destination, source1, destination1, trip_type, departure_date_time, arrival_date_time, flight_no, terminal, departure_date_time1, arrival_date_time1, flight_no1, terminal1, terminal2, terminal3, no_of_person, max_no_of_person, no_of_stops, stops_name, no_of_stops1, stops_name1, class, class1, airline, airline1, aircode, aircode1, pnr, ticket_no, price, baggage, meal, markup, admin_markup, discount, total, sale_type, refundable, availibility, user_id, remarks, approved, available, data_collected_from, last_sync_key, companyid, created_by) 
            VALUES ('${result.departure.id}','${result.arrival.id}',0,0,'ONE','${deptDate}','${arrvDate}','NPTNX-${result.flight_number}','NA', '${emptyDate}','${emptyDate}','','','','',${result.availability},${result.availability},0,'NA',0,'NA', '${result.ticket_type.toUpperCase()}','','${result.flight_id}',0,'${result.flight}','','','TKT-',${result.price}, 0,0,0,0,0,${result.price},'request','N',${result.availability},${DEFAULT_USER_ID},'',1, '${result.availability>0?'YES':'NO'}', 'neptunenext', '${runid}', ${DEFAULT_COMPANY_ID}, ${DEFAULT_USER_ID})`;
            //console.log(insertSql);
            conn.query(insertSql, function (err, data) {
                if (err) {
                    console.log(err);
                }
                else {
                    //console.log(JSON.stringify(data));
                    //console.log(JSON.stringify(result));
                    //console.log(`${data.insertId} ticket record inserted`);
                    insertStatus = data;
                }
        
                if(callback) {
                    callback(insertStatus);
                }
            });
        }
    });
}

function finalization(runid, context, callback) {
    let pool = getDBPool();
    let source = (context && context.source) ? context.source : -1;
    let destination = (context && context.destination) ? context.destination : -1;

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
    
                var sql = `update tickets_tbl set no_of_person=0, max_no_of_person=0, availibility=0, available='NO', last_sync_key='MIGHT_BE_SOLD_OR_ON_REQUEST', updated_by=${DEFAULT_USER_ID}, updated_on='${currentDate}' where available='YES' and source=${source} and destination=${destination} and data_collected_from='airiq' and last_sync_key<>'${runid}'`;
                var output = false;
                try {
                    conn.query(sql, function (err, data) {
                        if (err || data===null || data===undefined) {
                            console.log(err);
                            reject(err);
                            return;
                        }
                        else {
                            output = data;
                        }

                        try
                        {
                            conn.release();
                            conn.destroy();
                            pool.end((err) => {
                                if(err) {
                                    console.log(`Unable to end the pool ${err}`);
                                }
                                resolve(output);
                            });
                        }
                        catch(e5) {
                            console.log(e5);
                            reject(e5);
                        }                        
    
                        //console.log(JSON.stringify(data));
                        // if(callback) {
                        //     callback(data);
                        // }
                    });
                }
                catch(e1) {
                    console.log(e1);
                    reject(e1);
                }
                finally {

                }
            }
            catch(ex) {
                console.log(ex);
                reject(ex);
            }
        });
    });
}

async function getCity(conn, city, callback) {
    var sql = `select id from city_tbl where code='${city}'`;
    conn.query(sql, function (err, data) {
        if (err || data===null || data===undefined) {
            console.log(err);
        }
        if(data!=null && data.length>0) {
            data = data[0].id;
        }
        if(callback) {
            callback(data);
        }
    });
}

async function getCities(conn, callback) {
    var sql = `select * from city_tbl`;
    conn.query(sql, function (err, data) {
        if (err || data===null || data===undefined) {
            console.log(err);
        }
        if(callback) {
            callback(data);
        }
    });
}

async function getAirline(conn, aircode='', callback) {
    var sql = `select id from airline_tbl where aircode='${aircode}'`;

    conn.query(sql, function (err, data) {
        if (err || data===null || data===undefined) {
            console.log(err);
        }

        if(data!=null && data.length>0) {
            data = data[0].id;
        }
        if(callback) {
            callback(data);
        }
    });
}

function getAirlines(conn, callback) {
    var sql = `select * from airline_tbl`;

    conn.query(sql, function (err, data) {
        if (err || data===null || data===undefined) {
            console.log(err);
        }

        if(callback) {
            callback(data);
        }
    });
}

function updateExhaustedCircleInventory(runid, deptid, arrvid, callback) {
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
                
                var sql = `update tickets_tbl set no_of_person=0, max_no_of_person=0, availibility=0, available='NO', last_sync_key='MIGHT_BE_SOLD_OR_ON_REQUEST', updated_by=${DEFAULT_USER_ID}, updated_on='${currentDate}' where available='YES' and data_collected_from='airiq' and source=${deptid} and destination=${arrvid} and last_sync_key<>'${runid}'`;
                
                try {
                    conn.query(sql, function (err, data) {
                        if (err || data===null || data===undefined) {
                            console.log(err);
                            reject(err);
                        }
                        conn.release();
                        conn.destroy();
                        pool.end((err) => {
                            if(err) {
                                console.log(`Unable to end the pool ${err}`);
                            }
                            // resolve(status);
                            resolve(data);
                        });
    
                        //console.log(JSON.stringify(data));
                        // if(callback) {
                        //     callback(data);
                        // }
                    });
                }
                catch(e1) {
                    console.log(e1);
                    reject(e1);
                }
            }
            catch(ex) {
                console.log(ex);
                reject(ex);
            }
        });
    });
}

// function updateExhaustedCircle(conn, runid, deptid, arrvid, callback) {
//     // return new Promise((resolve, reject) => {
//         let qry = `update tickets_tbl (aircode, airline, image) values('${airline.substr(0,3).toUpperCase()}', '${airline}', 'flight.png')`;

//         try
//         {
//             conn.query(qry, function(err, data) {
//                 if(callback) 
//                     callback(data.insertId);
//             });
//         }
//         catch(e) {
//             console.log(e);
//         }
//     // });
// }

/* Commented code of saveCircleBatchData

function saveCircleBatchData(runid, circleData, circleKey, callback) {
    let impactedRecCount = 0;
    getDBPool().getConnection(function(err, con) {
        try
        {
            if(err) {
                throw err;
            }

            //console.log('DB connected');

            let airlines = [];
            let cities = [];
            getAirlines(con, function(airlineData) {
                airlines = airlineData;
                let missingAirlines = getMissingAirlines(airlines, circleData);
                saveMissingAirlines(con, missingAirlines, function(updatedAirlines) {
                    airlines = updatedAirlines;
                    transformAirlineData(con, circleData, airlines);
                    //console.log('Got airlines');
                    getCities(con, function(citiesData) {
                        cities = citiesData;
                        let missingCity = getMissingCities(con, cities, circleData)
                        saveMissingCity(con, missingCity, function(updatedCities) {
                            cities = updatedCities;
                            let circleDataList = transformCircleData(con, circleData, cities);
                            saveTicketsData(con, circleDataList, runid, function(status) {
                                con.release();
                                if(callback) {
                                    callback(circleDataList);
                                }
                                //con.destroy();
                            });
                        });
                    });
                });
            });
        }
        catch(e) {
            console.log(e);
        }
    });

    return impactedRecCount;
}

*/

function saveCircleBatchData(runid, circleData, circleKey) {
    return new Promise((resolve, reject) => {
        let impactedRecCount = 0;
        let pool = getDBPool();
        pool.getConnection(function(err, con) {
            try
            {
                if(err) {
                    //throw err;
                    console.log(err);
                    reject(err);
                }
    
                let airlines = [];
                let cities = [];
                getAirlines(con, function(airlineData) {
                    try
                    {
                        airlines = airlineData;
                        let missingAirlines = getMissingAirlines(airlines, circleData);
                        saveMissingAirlines(con, missingAirlines, function(updatedAirlines) {
                            try
                            {
                                airlines = updatedAirlines;
                                transformAirlineData(con, circleData, airlines);
                                //console.log('Got airlines');
                                getCities(con, function(citiesData) {
                                    try
                                    {
                                        cities = citiesData;
                                        let missingCity = getMissingCities(con, cities, circleData)
                                        saveMissingCity(con, missingCity, function(updatedCities) {
                                            try
                                            {
                                                cities = updatedCities;
                                                let circleDataList = transformCircleData(con, circleData, cities);
                                                saveTicketsData(con, circleDataList, runid, function(status) {
                                                    try
                                                    {
                                                        con.release();
                                                        con.destroy();
                                                        pool.end((err) => {
                                                            if(err) {
                                                                console.log(`Unable to end the pool ${err}`);
                                                            }
                                                            resolve(status);
                                                        });
                                                    }
                                                    catch(e5) {
                                                        console.log(e5);
                                                        reject(e5);
                                                    }
                                                });
                                            }
                                            catch(e4) {
                                                console.log(e4);
                                                reject(e4);
                                            }
                                        });
                                    }
                                    catch(e3) {
                                        console.log(e3);
                                        reject(e3);
                                    }
                                });
                            }
                            catch(e2) {
                                console.log(e2);
                                reject(e2);
                            }
                        });
                    }
                    catch(e1) {
                        console.log(e1);
                        reject(e1);
                    }
                });
            }
            catch(e) {
                console.log(e);
                reject(e);
            }
        });
    
        return impactedRecCount;
    });
}

async function saveTicketsData(conn, circleDataList, runid, callback) {
    try
    {
        let status = null;

        for(var i=0; i<circleDataList.length; i++) {
            let ticket = circleDataList[i];
            let ticketInfo = await getTicketData(conn, ticket); //, function(ticketInfo) {
            if(ticketInfo!==null && ticketInfo.length===0 && ticket.price>0) {
                //to be inserted
                status = await insertTicketData(conn, ticket, runid, function(status) {
                    //status should be inserted it etc.
                    ticket.id = status.insertId;
                });
            }
            else if(ticketInfo!==null && ticketInfo.length>0 && ticket.price>0) {
                //to be updated
                status = await updateTicketData(conn, ticket, runid); //, function(status) {
                if(status) {
                    //status should be update status value
                    console.log(status);
                };
            }
        }

        if(callback) {
            callback(status);
        }
    }
    catch(e) {
        console.log(e);
    }
}

function getTicketData(conn, ticket, callback) {
    try
    {
        let deptDate = moment(new Date(ticket.departure.epoch_date)).format("YYYY-MM-DD HH:mm");
        let qry = `select id from tickets_tbl where source=${ticket.departure.id} and destination=${ticket.arrival.id} and ticket_no='TKT-${ticket.recid}' and data_collected_from ='airiq'`;

        return new Promise((resolve, reject) => {
            conn.query(qry, function(err, data) {
                if(err) {
                    data = null;
                    reject(err);
                }
                else {
                    resolve(data);
                }
                // if(callback)
                //     callback(data);
            });
        });
    }
    catch(e) {
        console.log(e);
    }
}

function updateTicketData(conn, ticket, runid, callback) {
    let updateStatus = null;
    let deptDate = moment(new Date(ticket.departure.epoch_date)).format("YYYY-MM-DD HH:mm");
    let arrvDate = moment(new Date(ticket.arrival.epoch_date)).format("YYYY-MM-DD HH:mm");    
    let ticket_no = ticket.recid;
    let currentDate = moment.utc(new Date().toGMTString()).format("YYYY-MM-DD HH:mm:ss"); //moment(new Date()).format("YYYY-MM-DD HH:mm");

    //var updateSql = `update tickets_tbl set departure_date_time='${deptDate}', arrival_date_time='${arrvDate}', no_of_person=${ticket.availability}, max_no_of_person=${ticket.availability}, availibility= ${ticket.availability}, available='${ticket.availability>0?'YES':'NO'}', price=${ticket.price}, total=${ticket.price}, last_sync_key='${runid}', updated_by=${DEFAULT_USER_ID}, updated_on='${currentDate}' where source='${ticket.departure.id}' and destination='${ticket.arrival.id}' and ticket_no='TKT-${ticket_no}' and data_collected_from ='airiq'`;
    var updateSql = `update tickets_tbl set departure_date_time='${deptDate}', arrival_date_time='${arrvDate}', no_of_person=${ticket.availability}, max_no_of_person=${ticket.availability}, availibility= ${ticket.availability}, available='${ticket.availability>0?'YES':'NO'}', price=${ticket.price}, total=${ticket.price}, last_sync_key='${runid}', updated_by=${DEFAULT_USER_ID}, updated_on='${currentDate}' where source='${ticket.departure.id}' and destination='${ticket.arrival.id}' and ticket_no='TKT-${ticket_no}' and data_collected_from ='airiq'`;

    return new Promise((resolve, reject) => {
        conn.query(updateSql, function (err, data) {
            if (err) {
                console.log(err);

                reject(err);
            }
            else {
                updateStatus = data;

                resolve(updateStatus);
            }
        });
    });
}

function insertTicketData(conn, ticket, runid, callback) {
    let insertStatus = null;
    let deptDate = moment(new Date(ticket.departure.epoch_date)).format("YYYY-MM-DD HH:mm");
    let arrvDate = moment(new Date(ticket.arrival.epoch_date)).format("YYYY-MM-DD HH:mm");
    let emptyDate = moment(new Date(0,0,0,0,0,0)).format("YYYY-MM-DD HH:mm");
    let ticket_no = ticket.recid;

    var insertSql = `INSERT INTO tickets_tbl (source, destination, source1, destination1, trip_type, departure_date_time, arrival_date_time, flight_no, terminal, departure_date_time1, arrival_date_time1, flight_no1, terminal1, terminal2, terminal3, no_of_person, max_no_of_person, no_of_stops, stops_name, no_of_stops1, stops_name1, class, class1, airline, airline1, aircode, aircode1, pnr, ticket_no, price, baggage, meal, markup, admin_markup, discount, total, sale_type, refundable, availibility, user_id, remarks, approved, available, data_collected_from, last_sync_key, companyid, created_by, booking_freeze_by) 
    VALUES ('${ticket.departure.id}','${ticket.arrival.id}',0,0,'ONE','${deptDate}','${arrvDate}','${ticket.flight_number}','NA', '${emptyDate}','${emptyDate}','','','','',${ticket.availability},${ticket.availability},0,'NA',0,'NA', '${ticket.ticket_type.toUpperCase()}','','${ticket.flight_id}',0,'${ticket.flight}','','','TKT-${ticket_no}', ${ticket.price},0,0,0,300,0,${ticket.price},'request','N',${ticket.availability},${DEFAULT_USER_ID},'',1, '${ticket.availability>0?'YES':'NO'}', 'airiq', '${runid}', ${DEFAULT_COMPANY_ID}, ${DEFAULT_USER_ID}, '${deptDate}')`;

    //console.log(insertSql);

    return new Promise((resolve, reject) => {
        conn.query(insertSql, function (err, data) {
            if (err) {
                console.log(err);
                
                reject(err);
            }
            else {
                insertStatus = data;

                resolve(insertStatus);
            }
        });    
    });
}

// function getMissingCities(conn, cities, circleData) {
//     let missingData = [];
//     if(circleData===null || circleData===undefined) return missingData;

//     let processedCities = [];
//     for(var i=0; i<circleData.length; i++) {
//         //for departure city
//         let city = circleData[i].departure.circle.toLowerCase();

//         if(processedCities.indexOf(city)===-1) {
//             let savedCityRecord = cities.find((data, idx) => {
//                 //return data.city.toLowerCase().indexOf(city)===-1;
//                 return data.city.toLowerCase().indexOf(city)>-1;
//             });
//             if(savedCityRecord===undefined || savedCityRecord===null) {
//                 if(missingData.indexOf(circleData[i].departure.circle)===-1)
//                     missingData.push(circleData[i].departure.circle);
//             }
//             processedCities.push(city);
//         }

//         //for arrival city
//         city = circleData[i].arrival.circle.toLowerCase();
        
//         if(processedCities.indexOf(city)===-1) {
//             savedCityRecord = cities.find((data, idx) => {
//                 //return data.city.toLowerCase().indexOf(city)===-1;
//                 return data.city.toLowerCase().indexOf(city)>-1;
//                 //return data.city.toLowerCase()===city;
//             });
//             if(savedCityRecord===undefined || savedCityRecord===null) {
//                 if(missingData.indexOf(circleData[i].arrival.circle)===-1)
//                     missingData.push(circleData[i].arrival.circle);
//             }        
//             processedCities.push(city);
//         }
//     }

//     return missingData;
// }

function getMissingCities(conn, cities, circleData) {
    let missingData = [];
    if(circleData===null || circleData===undefined) return missingData;

    let processedCities = [];
    for(var i=0; i<circleData.length; i++) {
        //for departure city
        let city = circleData[i].departure.circle.toLowerCase().trim();

        if(processedCities.indexOf(city)===-1) {
            let savedCityRecord = cities.find((data, idx) => {
                //return data.city.toLowerCase().indexOf(city)===-1;
                var flag = false;
                // flag = data.city.toLowerCase().indexOf(city)>-1 || (data.code !== '' && data.code.trim().toLowerCase() === city);
                flag = data.city.toLowerCase().startsWith(city) || (data.code !== '' && data.code.trim().toLowerCase() === city);
                
                if(!flag) {
                    //now check synonyms
                    var synonyms = data.synonyms ? data.synonyms.trim().toLowerCase().split(',') : [];
                    for (let index = 0; !flag && index < synonyms.length; index++) {
                        const synonyms_city_name = synonyms[index];
                        flag = synonyms_city_name.trim().toLowerCase()===city;

                        if(flag) {
                            log(`City name found in synonyms : ${city}`);
                        }
                    }
                }
                // return data.city.toLowerCase().indexOf(city)>-1 || (data.code !== '' && data.code.trim().toLowerCase() === city);
                return flag;
            });
            if(savedCityRecord===undefined || savedCityRecord===null) {
                if(missingData.indexOf(circleData[i].departure.circle)===-1)
                    missingData.push(circleData[i].departure.circle);
            }
            processedCities.push(city);
        }

        //for arrival city
        city = circleData[i].arrival.circle.toLowerCase().trim();
        
        if(processedCities.indexOf(city)===-1) {
            savedCityRecord = cities.find((data, idx) => {
                //return data.city.toLowerCase().indexOf(city)===-1;
                //return data.city.toLowerCase().indexOf(city)>-1 || (data.code !== '' && data.code.trim().toLowerCase() === city);
                
                //var flag = data.city.toLowerCase().indexOf(city)>-1 || (data.code !== '' && data.code.trim().toLowerCase() === city);
                flag = data.city.toLowerCase().startsWith(city) || (data.code !== '' && data.code.trim().toLowerCase() === city);
                if(!flag) {
                    //now check synonyms
                    var synonyms = data.synonyms ? data.synonyms.trim().toLowerCase().split(',') : [];
                    for (let index = 0; !flag && index < synonyms.length; index++) {
                        const synonyms_city_name = synonyms[index];
                        flag = synonyms_city_name.trim().toLowerCase()===city;

                        if(flag) {
                            log(`City name found in synonyms : ${city}`);
                        }
                    }
                }
                // return data.city.toLowerCase().indexOf(city)>-1 || (data.code !== '' && data.code.trim().toLowerCase() === city);
                return flag;
            });
            if(savedCityRecord===undefined || savedCityRecord===null) {
                if(missingData.indexOf(circleData[i].arrival.circle)===-1)
                    missingData.push(circleData[i].arrival.circle);
            }        
            processedCities.push(city);
        }
    }

    return missingData;
}

function saveMissingCity(conn, missingCities, callback) {
    let updatedCities = [];
    if(missingCities===undefined || missingCities===null || missingCities.length===0) {
        getCities(conn, function(updatedCitiesData) {
            updatedCities = updatedCitiesData;
            if(callback) {
                callback(updatedCities);
            }
        });
    }
    else {
        let recCount = 0;
        for(var i=0; i<missingCities.length; i++) {
            saveCity(conn, missingCities[i], function(id) {
                //console.log(`Inserted record id ${id}`);
                recCount++;
                if(recCount===missingCities.length) {
                    getCities(conn, function(updatedCitiesData) {
                        updatedCities = updatedCitiesData;
                        if(callback) {
                            callback(updatedCities);
                        }
                    });
                }
            });
        }
    }
}

function saveMissingAirlines(conn, missingAirlines, callback) {
    let updatedAirlines = [];
    if(missingAirlines===undefined || missingAirlines===null || missingAirlines.length===0) {
        getAirlines(conn, function(updatedAirlinesData) {
            updatedAirlines = updatedAirlinesData;
            if(callback) {
                callback(updatedAirlines);
            }
        });
    }
    else {
        let recCount = 0;
        for(var i=0; i<missingAirlines.length; i++) {
            saveAirline(conn, missingAirlines[i], function(id) {
                //console.log(`Inserted record id ${id}`);
                recCount++;
                if(recCount===missingAirlines.length) {
                    getAirlines(conn, function(updatedAirlinesData) {
                        updatedAirlines = updatedAirlinesData;
                        if(callback) {
                            callback(updatedAirlines);
                        }
                    });
                }
            });
        }
    }
}

function getMissingAirlines(airlines, circleData) {
    let missingData = [];
    if(circleData===null || circleData===undefined) return missingData;

    for(var i=0; i<circleData.length; i++) {
        let airline = circleData[i].flight.toLowerCase();
        let savedAirlineRecord = airlines.find((data, idx) => {
            return data.airline.toLowerCase()===airline;
        });
        if(savedAirlineRecord===undefined || savedAirlineRecord===null) {
            if(missingData.indexOf(circleData[i].flight)===-1)
                missingData.push(circleData[i].flight);
        }
    }

    return missingData;
}

// function transformCircleData(conn, circleData, cities) {
//     circleData.map(async (ticket, idx) => {
//         let deptCityName = ticket.departure.circle.toLowerCase();
//         let arrvCityName = ticket.arrival.circle.toLowerCase();
//         let deptCity = null;
//         let arrvCity = null;
        
//         if(deptCity===null) {
//             deptCity = cities.find((city, ndx)=> {
//                 return city.city.toLowerCase().indexOf(deptCityName)>-1;
//             });
//         }
//         if(deptCity!==null && deptCity!==undefined) {
//             ticket.departure.circle = `${ticket.departure.circle} (${deptCity.code})`;
//             ticket.departure.id = deptCity.id;
//         }
//         else {
//             //insert city and set the same id here.
//             ticket.departure.id = -1;
//         }

//         if(arrvCity===null) {
//             arrvCity = cities.find((city, ndx)=> {
//                 return city.city.toLowerCase().indexOf(arrvCityName)>-1;
//             });
//         }
        
//         if(arrvCity!==null && arrvCity!==undefined) {
//             ticket.arrival.circle = `${ticket.arrival.circle} (${arrvCity.code})`;
//             ticket.arrival.id = arrvCity.id;
//         }
//         else {
//             ticket.arrival.id = -1;
//         }
//     });

//     return circleData;
// }

function transformCircleData(conn, circleData, cities) {
    circleData.map(async (ticket, idx) => {
        let deptCityName = ticket.departure.circle.toLowerCase().trim();
        let arrvCityName = ticket.arrival.circle.toLowerCase().trim();
        let deptCity = null;
        let arrvCity = null;
        
        if(deptCity===null) {
            deptCity = cities.find((data, ndx)=> {
                var flag = false;
                // flag = data.city.toLowerCase().indexOf(city)>-1 || (data.code !== '' && data.code.trim().toLowerCase() === city);
                flag = data.city.toLowerCase().startsWith(deptCityName) || (data.code !== '' && data.code.trim().toLowerCase() === deptCityName);
                
                if(!flag) {
                    //now check synonyms
                    var synonyms = data.synonyms ? data.synonyms.trim().toLowerCase().split(',') : [];
                    for (let index = 0; !flag && index < synonyms.length; index++) {
                        const synonyms_city_name = synonyms[index];
                        flag = synonyms_city_name.trim().toLowerCase()===deptCityName;

                        if(flag) {
                            log(`City name found in synonyms : ${deptCityName}`);
                        }
                    }
                }                

                return flag;
                //return city.city.toLowerCase().indexOf(deptCityName)>-1;
            });
        }
        if(deptCity!==null && deptCity!==undefined) {
            ticket.departure.circle = `${ticket.departure.circle} (${deptCity.code})`;
            ticket.departure.id = deptCity.id;
        }
        else {
            //insert city and set the same id here.
            ticket.departure.id = -1;
        }

        if(arrvCity===null) {
            arrvCity = cities.find((data, ndx)=> {
                // return city.city.toLowerCase().indexOf(arrvCityName)>-1;
                var flag = false;
                // flag = data.city.toLowerCase().indexOf(city)>-1 || (data.code !== '' && data.code.trim().toLowerCase() === city);
                flag = data.city.toLowerCase().startsWith(arrvCityName) || (data.code !== '' && data.code.trim().toLowerCase() === arrvCityName);
                
                if(!flag) {
                    //now check synonyms
                    var synonyms = data.synonyms ? data.synonyms.trim().toLowerCase().split(',') : [];
                    for (let index = 0; !flag && index < synonyms.length; index++) {
                        const synonyms_city_name = synonyms[index];
                        flag = synonyms_city_name.trim().toLowerCase()===arrvCityName;

                        if(flag) {
                            log(`City name found in synonyms : ${arrvCityName}`);
                        }
                    }
                }                

                return flag;                
            });
        }
        
        if(arrvCity!==null && arrvCity!==undefined) {
            ticket.arrival.circle = `${ticket.arrival.circle} (${arrvCity.code})`;
            ticket.arrival.id = arrvCity.id;
        }
        else {
            ticket.arrival.id = -1;
        }
    });

    return circleData;
}

function transformAirlineData(conn, circleData, airlines) {
    circleData.map((ticket, idx) => {
        let flight = ticket.flight.toLowerCase();
        let flightData = null;
        
        if(flightData===null) {
            flightData = airlines.find((airline, ndx)=> {
                return airline.airline.toLowerCase().indexOf(flight)>-1;
            });
        }
        if(flightData!==null && flightData!==undefined) {
            ticket.flight_id = flightData.id;
        }
        else {
            ticket.flight_id = -1;
        }
    });

    //return circleData;
}

function saveCity(conn, city, callback) {
    //return new Promise((resolve, reject) => {
        //let qry = `insert into city_tbl(city) values('${city}')`;
        let qry = `insert into city_tbl(city, code) values('${city}', '')`;

        return new Promise((resolve, reject) => {
            try
            {
                conn.query(qry, function(err, data) {
                    if(err) {
                        reject(err);
                    }
                    else {
                        if(data && data.insertId) {
                            resolve(data.insertId);
                        }
                        else {
                            reject(`Invalid data received. Missing InsertId`);
                        }
                    }
                    // if(callback)
                    //     callback(data.insertId);
                });
            }
            catch(e) {
                console.log(e);
                reject(e);
            }
        });
}

function saveAirline(conn, airline, callback) {
    return new Promise((resolve, reject) => {
        let qry = `insert into airline_tbl(aircode, airline, image) values('${airline.substr(0,3).toUpperCase()}', '${airline}', 'flight.png')`;
        try
        {
            conn.query(qry, function(err, data) {
                if(err) {
                    reject(err);
                }
                else {
                    if(data && data.insertId) {
                        resolve(data.insertId);
                    }
                    else {
                        reject(`Invalid data received. Missing InsertId`);
                    }
                }
            });
        }
        catch(e) {
            console.log(e);
            reject(e);
        }
    });
}

//jshint ignore:end

module.exports = {saveData, finalization, saveCircleBatchData, updateExhaustedCircleInventory};