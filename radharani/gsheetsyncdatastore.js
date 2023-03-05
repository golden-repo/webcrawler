//jshint esversion:6
//jshint ignore:start

const mysql = require('mysql');
const moment = require('moment');
const { Promise } = require('es6-promise');
const DEFAULT_COMPANY_ID = 1;
const DEFAULT_USER_ID = 104;
var pool = null;

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

    // pool = mysql.createPool({
    //     connectionLimit : 2,
    //     connectTimeout  : 60 * 60 * 1000,
    //     acquireTimeout  : 60 * 60 * 1000,
    //     timeout         : 60 * 60 * 1000,        
    //     host: "localhost",
    //     user: "root",
    //     password: "",
    //     database: "csr_tracker",
    //     port: 3306
    // });

    // //Remote DB
    pool = mysql.createPool({
        connectionLimit: 2,
        connectTimeout: 15000,
        host: "www.oxytra.com",
        user: "csr_user",
        password: "csrUser@2023",
        database: "csr_tracker",
        port: 3306
    });

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

//Helper methods
async function getDBConnection() {
    return new Promise((resolve, reject) => {
        getDBPool().getConnection((err, conn) => {
            if(err) {
                console.log(err);
                reject(err);
            }
            
            resolve(conn);
        });
    });
}

async function executeQuery(sql) {
    var connection = await getDBConnection();
    var result = await executeQueryWithConnection(sql, connection).finally(() => {
        if(connection) {
            connection.release();
        }
    });

    return result;
}

async function executeQueryWithConnection(sql, conn) {
    return new Promise((resolve, reject) => {
        if(conn) {
            try
            {
                conn.query(sql, function (err, data) {
                    if (err) {
                        console.log(err);
                        reject(err);
                    }

                    //console.log(`Executing query : [${sql}]`);
                    resolve(data);
                });
            }
            catch(ex) {
                console.log(ex);
                reject(ex);
            }
        }
        else {
            reject('Invalid connection. Query execution aborted');
        }
    });
}

async function executeNonQuery(sql) {
    var connection = await getDBConnection();
    // var result = await executeNonQueryWithConnection(sql, connection);
    // if(connection) {
    //     connection.release();
    // }

    var result = await executeNonQueryWithConnection(sql, connection).finally(() => {
        if(connection) {
            connection.release();
        }
    });

    return result;
}

async function executeNonQueryWithConnection(sql, conn) {
    return new Promise((resolve, reject) => {
        if(conn) {
            try
            {
                conn.query(sql, function (err, data) {
                    if (err) {
                        console.log(err);
                        reject(err);
                    }

                    //console.log(`Executing query : [${sql}]`);
                    //console.log(`Data : [${JSON.stringify(data)}]`);
                    resolve(data);
                });
            }
            catch(ex) {
                console.log(ex);
                reject(ex);
            }
        }
        else {
            reject('Invalid connection. Query execution aborted');
        }
    });
}

//end of helper methods

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

function finalization(runid, callback) {
    return new Promise((resolve, reject) => {
        getDBPool().getConnection(function(err, conn) {
            try
            {
                if(err) {
                    console.log(err);
                    return reject(err);
                }
                let currentDate = moment.utc(new Date().toGMTString()).format("YYYY-MM-DD HH:mm:ss"); //moment(new Date()).format("YYYY-MM-DD HH:mm");
    
                var sql = `update tickets_tbl set no_of_person=0, max_no_of_person=0, availibility=0, available='NO', last_sync_key='MIGHT_BE_SOLD_OR_ON_REQUEST', updated_by=${DEFAULT_USER_ID}, updated_on='${currentDate}' where available='YES' and data_collected_from='cheap' and last_sync_key<>'${runid}'`;
                
                try {
                    conn.query(sql, function (err, data) {
                        if (err || data===null || data===undefined) {
                            console.log(err);
                        }
                        conn.release();
    
                        //console.log(JSON.stringify(data));
                        // if(callback) {
                        //     callback(data);
                        // }
                        resolve(data);
                    });
                }
                catch(e1) {
                    console.log(e1);
                    return reject(e1);
                }
            }
            catch(ex) {
                console.log(ex);
                return reject(ex);
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
    getDBPool().getConnection(function(err, conn) {
        try
        {
            if(err) {
                console.log(err);
            }
            let currentDate = moment.utc(new Date().toGMTString()).format("YYYY-MM-DD HH:mm:ss"); //moment(new Date()).format("YYYY-MM-DD HH:mm");
            
            var sql = `update tickets_tbl set no_of_person=0, max_no_of_person=0, availibility=0, available='NO', last_sync_key='MIGHT_BE_SOLD_OR_ON_REQUEST', updated_by=${DEFAULT_USER_ID}, updated_on='${currentDate}' where available='YES' and data_collected_from='cheap' and source=${deptid} and destination=${arrvid} and last_sync_key<>'${runid}'`;
            
            try {
                conn.query(sql, function (err, data) {
                    if (err || data===null || data===undefined) {
                        console.log(err);
                    }
                    conn.release();

                    //console.log(JSON.stringify(data));
                    if(callback) {
                        callback(data);
                    }
                });
            }
            catch(e1) {
                console.log(e1);
            }
        }
        catch(ex) {
            console.log(ex);
        }
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

function saveCircleBatchData(runid, circleData, circleKey) {
    return new Promise((resolve, reject) => {
        let impactedRecCount = 0;
        getDBPool().getConnection(function(err, con) {
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
                                                        //con.destroy();
                                                        resolve(status);
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
        var processedRecord = 0;
        for(var i=0; i<circleDataList.length; i++) {
            let ticket = circleDataList[i];

            if(ticket.type==='ONEWAY') {
                //var tkinfo = await new Promise((resolve, reject) => {
                var ticketInfo = await getTicketData(conn, ticket, async function(ticketInfo) {

                });
                //});
                //saveTicketData(conn, circleDataList[i])

                try
                {
                    if(ticketInfo!==null && ticketInfo.length===0) {
                        //to be inserted
                        var status = await insertTicketData(conn, ticket, runid, function(status) {
                        });
                        if(status) {
                            ticket.id = status.insertId;
                        }
                    }
                    else if(ticketInfo!==null && ticketInfo.length>0) {
                        //to be updated
                        var status = await updateTicketData(conn, ticket, runid, function(status) {
                        });
                    }

                    processedRecord++;
                    //resolve(ticket);
                }
                catch(ex1) {
                    console.log(ex1);
                    //return reject(ex1);
                }

                console.log(`Ticket Info : ${ticket.id} - ${processedRecord}`);
            }
        }

        console.log(`Complete ...`);
        if(callback) {
            callback(circleDataList);
        }
    }
    catch(e) {
        console.log(e);
    }
}

function getTicketData(conn, ticket, callback) {
    return new Promise((resolve, reject) => {
        try
        {
            if(ticket.departure.id && ticket.arrival.id) {
                let deptDate = moment(new Date(ticket.departure.epoch_date)).format("YYYY-MM-DD HH:mm");
                let qry = `select id from tickets_tbl where source=${ticket.departure.id} and destination=${ticket.arrival.id} and ticket_no='TKT-${ticket.recid}' and data_collected_from='cheap'`;
        
                conn.query(qry, function(err, data) {
                    if(err) {
                        data = null;
                        reject(err);
                    }
    
                    resolve(data);
                    // if(callback)
                    //     callback(data);
                });
            }
            else {
                reject(`Invalid departure and/or arrival city`);
            }
        }
        catch(e) {
            console.log(e);
            reject(e);
        }
    });
}

function updateTicketData(conn, ticket, runid, callback) {
    return new Promise((resolve, reject) => {
        try
        {
            let updateStatus = null;
            let deptDate = moment(new Date(ticket.departure.epoch_date)).format("YYYY-MM-DD HH:mm");
            let ticket_no = ticket.recid;
            let currentDate = moment.utc(new Date().toGMTString()).format("YYYY-MM-DD HH:mm:ss"); //moment(new Date()).format("YYYY-MM-DD HH:mm");
        
            var updateSql = `update tickets_tbl set no_of_person=${ticket.availability}, max_no_of_person=${ticket.availability}, availibility= ${ticket.availability}, available='${ticket.availability>0?'YES':'NO'}', price=${ticket.price}, total=${ticket.price}, last_sync_key='${runid}', updated_by=${DEFAULT_USER_ID}, updated_on='${currentDate}' where source='${ticket.departure.id}' and destination='${ticket.arrival.id}' and ticket_no='TKT-${ticket_no}' and data_collected_from ='cheap'`;
        
            conn.query(updateSql, function (err, data) {
                if (err) {
                    console.log(err);
                    return reject(err);
                }
                else {
                    updateStatus = data;
                    resolve(updateStatus);
                }
        
                // if(callback) {
                //     callback(updateStatus);
                // }
            });
        }
        catch(eex) {
            console.log(eex);
            return reject(eex);
        }
    });
}

function insertTicketData(conn, ticket, runid, callback) {
    return new Promise((resolve, reject) => {
        try
        {
            let insertStatus = null;
            let deptDate = moment(new Date(ticket.departure.epoch_date)).format("YYYY-MM-DD HH:mm");
            let arrvDate = moment(new Date(ticket.arrival.epoch_date)).format("YYYY-MM-DD HH:mm");
            let emptyDate = moment(new Date(0,0,0,0,0,0)).format("YYYY-MM-DD HH:mm");
            let ticket_no = ticket.recid;
        
            var insertSql = `INSERT INTO tickets_tbl (source, destination, source1, destination1, trip_type, departure_date_time, arrival_date_time, flight_no, terminal, departure_date_time1, arrival_date_time1, flight_no1, terminal1, terminal2, terminal3, no_of_person, max_no_of_person, no_of_stops, stops_name, no_of_stops1, stops_name1, class, class1, airline, airline1, aircode, aircode1, pnr, ticket_no, price, baggage, meal, markup, admin_markup, discount, total, sale_type, refundable, availibility, user_id, remarks, approved, available, data_collected_from, last_sync_key, companyid, created_by, booking_freeze_by) 
            VALUES ('${ticket.departure.id}','${ticket.arrival.id}',0,0,'ONE','${deptDate}','${arrvDate}','${ticket.flight_number}','NA', '${emptyDate}','${emptyDate}','','','','',${ticket.availability},${ticket.availability},0,'NA',0,'NA', '${ticket.ticket_type.toUpperCase()}','','${ticket.flight_id}',0,'${ticket.flight}','','','TKT-${ticket_no}', ${ticket.price},0,0,0,300,0,${ticket.price},'request','N',${ticket.availability},${DEFAULT_USER_ID},'',0, '${ticket.availability>0?'YES':'NO'}', 'cheap', '${runid}', ${DEFAULT_COMPANY_ID}, ${DEFAULT_USER_ID}, '${deptDate}')`;
            //console.log(insertSql);
            conn.query(insertSql, function (err, data) {
                if (err) {
                    console.log(err);
                    return reject(err);
                }
                else {
                    insertStatus = data;
                    resolve(insertStatus);
                }
        
                // if(callback) {
                //     callback(insertStatus);
                // }
            });
        }
        catch(ex) {
            console.log(ex);
            return reject(ex);
        }
    });
}

function getMissingCities(conn, cities, circleData) {
    let missingData = [];
    if(circleData===null || circleData===undefined) return missingData;

    let processedCities = [];
    for(var i=0; i<circleData.length; i++) {
        try
        {
            //for departure city
            let city = circleData[i].departure.circle ? circleData[i].departure.circle.toLowerCase().trim() : null;

            if(city && processedCities.indexOf(city)===-1) {
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
                                console.log(`City name found in synonyms : ${city}`);
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
            city = circleData[i].arrival.circle ? circleData[i].arrival.circle.toLowerCase().trim() : null;
            
            if(city && processedCities.indexOf(city)===-1) {
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
                                console.log(`City name found in synonyms : ${city}`);
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
        catch(eex) {
            console.log(eex);
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
            return data.airline.toLowerCase()===airline || data.aircode.toLowerCase()===airline;
        });
        if(savedAirlineRecord===undefined || savedAirlineRecord===null) {
            if(missingData.indexOf(circleData[i].flight)===-1)
                missingData.push(circleData[i].flight);
        }
    }

    return missingData;
}

function transformCircleData(conn, circleData, cities) {
    circleData.map(async (ticket, idx) => {
        let deptCityName = ticket.departure.circle ? ticket.departure.circle.toLowerCase().trim() : null;
        let arrvCityName = ticket.arrival.circle ? ticket.arrival.circle.toLowerCase().trim() : null;
        let deptCity = null;
        let arrvCity = null;
        
        if(deptCityName !==null && deptCity===null) {
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
                            console.log(`City name found in synonyms : ${deptCityName}`);
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

        if(arrvCityName!==null && arrvCity===null) {
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
                            console.log(`City name found in synonyms : ${arrvCityName}`);
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
        let flight = ticket.flight ? ticket.flight.toLowerCase() : null;
        let flightData = null;
        
        if(flight!==null && flightData===null) {
            flightData = airlines.find((airline, ndx)=> {
                return airline.airline.toLowerCase().indexOf(flight)>-1 || airline.aircode.toLowerCase().indexOf(flight)>-1;
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

        try
        {
            conn.query(qry, function(err, data) {
                if(callback)
                    callback(data.insertId);
            });
        }
        catch(e) {
            console.log(e);
//            reject(e);
        }
//    });
}

function saveAirline(conn, airline, callback) {
    // return new Promise((resolve, reject) => {
        let qry = `insert into airline_tbl(aircode, airline, image) values('${airline.substr(0,3).toUpperCase()}', '${airline}', 'flight.png')`;

        try
        {
            conn.query(qry, function(err, data) {
                if(callback) 
                    callback(data.insertId);
            });
        }
        catch(e) {
            console.log(e);
        }
    // });
}

//Activity management
async function saveActivitiesByEmployee(activities) {
    if(activities != null && activities.length>0) {
        for (let index = 0; index < activities.length; index++) {
            const activity = activities[index];
            
            for (let idx = 0; idx < activity.activityItems.length; idx++) {
                const activityItem = activity.activityItems[idx];

                try
                {
                    let employeeActivityRecord = await getEmployeeActivity(activity.empid, activity.activityId, activityItem.month, activityItem.startDate);
                    if(employeeActivityRecord && employeeActivityRecord.id>0) {
                        activityItem.csrid = employeeActivityRecord.id
                        activityItem.code = employeeActivityRecord.uid
                    }
                    var result = await saveEmployeeActivity(activity.empid, activity.activityId, activityItem, employeeActivityRecord);
                    console.log(`Result after save : ${JSON.stringify(result)}`);
                }
                catch(e) {
                    console.log(`Error while saving employee activity : ${e}`);
                }
            }
        }
    }
}

async function getEmployeeActivity(empid, activityid, monthName, startDate) {
    var employeeCSRRecord = null;
    var sql = `select * from employee_csr_tracker where employeeid=${empid} and activityid=${activityid} and month='${monthName}' and startdate = '${moment(startDate).format('YYYY-MM-DD 00:00:00')}'`;

    var csrRecord = await executeQuery(sql); 
    if(csrRecord && Array.isArray(csrRecord) && csrRecord.length>0) {
        console.log(`CSR record -> ${JSON.stringify(csrRecord[0])}`);
        employeeCSRRecord = csrRecord[0];
    }
    return employeeCSRRecord;
}

async function getEmployeeCSRActivities(empid, finyear) {
    var employeeCSRRecord = null;
    var startYear = finyear.trim().split('-')[0].trim();
    var endYear = finyear.trim().split('-')[1].trim();
    var startDate = moment(`${startYear}-04-01`, 'YYYY-MM-DD').format('YYYY-MM-DD 00:00:00');
    var endDate = moment(`${endYear}-04-01`, 'YYYY-MM-DD').format('YYYY-MM-DD 00:00:00');

    var sql = `select emp.id as empid, emp.name as employeename, act.id as actid, act.activity_name, csr.id, csr.uid, csr.month, date_format(csr.startdate, '%Y-%m-%d') as startdate, 
                csr.planned, csr.achived, csr.created_by, csr.created_on, csr.updated_by, csr.updated_on
            from employee_csr_tracker csr 
            inner join employees_tbl emp on emp.id=csr.employeeid
            inner join activities_tbl act on act.id=csr.activityid
            where csr.employeeid=${empid} 
            and (csr.startdate>='${startDate}' and csr.startdate<'${endDate}')
            order by emp.id, act.id, csr.id`;

    var csrRecord = await executeQuery(sql); 
    return csrRecord;
}

async function saveEmployeeActivity(employeeid, activityid, activityItem, employeeActivityRecord) {
    var sql = null;
    var employeeCSRRecord = null;

    if(activityItem && activityItem.csrid>0) {
        if(employeeActivityRecord && (employeeActivityRecord.planned!==activityItem.planned || employeeActivityRecord.achived!==activityItem.achived)) {
            sql = `update employee_csr_tracker set planned = ${activityItem.planned}, achived = ${activityItem.achived}, updated_on = current_timestamp() where id=${activityItem.csrid}`;
        }
    }
    else {
        sql = `insert into employee_csr_tracker(employeeid, activityid, uid, month, startdate, planned, achived) values(${employeeid}, ${activityid}, uuid(), '${activityItem.month}', 
            '${moment(activityItem.startDate).format('YYYY-MM-DD 00:00:00')}', ${activityItem.planned}, ${activityItem.achived})`;
    }
 
    if(sql && sql !== '') {
        employeeCSRRecord = await executeNonQuery(sql);
        console.log(`Employee Record : ${JSON.stringify(employeeCSRRecord)}`);
    }

    return employeeCSRRecord;
}

async function getEmployee(employeeid) {
    //var connection = await getDBConnection();
    var employee = null;
    var sql = `select * from employees_tbl where code = '${employeeid}'`;
 
    var employeeRecord = await executeQuery(sql);
    if(employeeRecord && Array.isArray(employeeRecord) && employeeRecord[0]) {
        console.log(`Employee Record : ${JSON.stringify(employeeRecord[0])}`);
        employee = transformEmployeeRecord(employeeRecord[0]);
    }

    return employee;
}

async function getEmployees() {
    var employees = null;
    var sql = `select * from employees_tbl where status=1;`;
 
    employees = await executeQuery(sql);

    return employees;
}

async function getEmployeeCSRSyncStatus(startDate, endDate) {
    var sql = `select a.id, a.code, a.name, 
        max(case when a.month='April' then a.lastupdated_on else '' end) as April,
        max(case when a.month='May' then a.lastupdated_on else '' end) as May,
        max(case when a.month='June' then a.lastupdated_on else '' end) as June,
        max(case when a.month='July' then a.lastupdated_on else '' end) as July,
        max(case when a.month='August' then a.lastupdated_on else '' end) as August,
        max(case when a.month='September' then a.lastupdated_on else '' end) as September,
        max(case when a.month='October' then a.lastupdated_on else '' end) as October,
        max(case when a.month='November' then a.lastupdated_on else '' end) as November,
        max(case when a.month='December' then a.lastupdated_on else '' end) as December,
        max(case when a.month='January' then a.lastupdated_on else '' end) as January,
        max(case when a.month='February' then a.lastupdated_on else '' end) as February,
        max(case when a.month='March' then a.lastupdated_on else '' end) as March
        from 
        (
            select emp.id, emp.code, emp.name, csr.month, date_format(max(case when csr.updated_on is null then csr.created_on else csr.updated_on end), '%Y-%m-%d %H:%i:%s') as lastupdated_on
            from employees_tbl emp
            left join employee_csr_tracker csr on emp.id=csr.employeeid
            where csr.month is null or (csr.month <> 'Full year' and (date_format(csr.startdate, '%Y-%m-%d)')>='${startDate}' && date_format(csr.startdate, '%Y-%m-%d')<='${endDate}'))
            group by emp.id, emp.code, emp.name, csr.month
        ) a
        group by a.id, a.code, a.name`;

        var employeeDataSyncStatus = await executeQuery(sql);

        return employeeDataSyncStatus;
}

async function getActivities() {
    var activities = null;
    var sql = `select * from activities_tbl`;
 
    activities = await executeQuery(sql);

    return activities;
}

function transformEmployeeRecord(employeeRecord) {
    var employee = null;

    if(employeeRecord) {
        employee = {
            'id': employeeRecord.id,
            'name': employeeRecord.name,
            'code': employeeRecord.code,
            'location': employeeRecord.location,
            'created_on': employeeRecord.created_on,
            'created_by': employeeRecord.created_by,
            'updated_on': employeeRecord.updated_on,
            'updated_by': employeeRecord.updated_by,
        };
    }

    return employee;
}

async function saveEmployeeConfig(config) {
    var plannedSql = null;
    var achivedSql = null;
    var employeeCSRRecord = null;
    let plannedConfig = config.planned;
    let achivedConfig = config.achived;

    var configData = await getConfigByFinYear(config.finyear);

    if(configData && configData.length>0) {
        let finYear = configData[0].finyear;
        plannedSql = `update config_tbl set apr=${plannedConfig.april}, may=${plannedConfig.may}, jun=${plannedConfig.june}, jul=${plannedConfig.july}, aug=${plannedConfig.august}, sep=${plannedConfig.september}, 
            oct=${plannedConfig.october}, nov=${plannedConfig.november}, \`dec\`=${plannedConfig.december}, jan=${plannedConfig.january}, feb=${plannedConfig.february}, mar=${plannedConfig.march}, 
            updated_on = current_timestamp() where finyear='${finYear}' and category='planned'`;

        achivedSql = `update config_tbl set apr=${achivedConfig.april}, may=${achivedConfig.may}, jun=${achivedConfig.june}, jul=${achivedConfig.july}, aug=${achivedConfig.august}, sep=${achivedConfig.september}, 
            oct=${achivedConfig.october}, nov=${achivedConfig.november}, \`dec\`=${achivedConfig.december}, jan=${achivedConfig.january}, feb=${achivedConfig.february}, mar=${achivedConfig.march}, 
            updated_on = current_timestamp() where finyear='${finYear}' and category='achived'`;
    }
    else {
        let finYear = config.finyear;
        let finStartDate = config.fin_start_date;
        let finEndDate = config.fin_end_date;

        plannedSql = `insert into config_tbl(finyear, fin_start_date, fin_end_date, category, apr, may, jun, jul, aug, sep, oct, nov, \`dec\`, jan, feb, mar, created_on)
            values('${finYear}', '${finStartDate}', '${finEndDate}', 'planned', ${plannedConfig.april}, ${plannedConfig.may}, ${plannedConfig.june}, 
            ${plannedConfig.july}, ${plannedConfig.august}, ${plannedConfig.september}, ${plannedConfig.october}, ${plannedConfig.november}, ${plannedConfig.december}, 
            ${plannedConfig.january}, ${plannedConfig.february}, ${plannedConfig.march}, now())`;

        achivedSql = `insert into config_tbl(finyear, fin_start_date, fin_end_date, category, apr, may, jun, jul, aug, sep, oct, nov, \`dec\`, jan, feb, mar, created_on)
            values('${finYear}', '${finStartDate}', '${finEndDate}', 'achived', ${achivedConfig.april}, ${achivedConfig.may}, ${achivedConfig.june}, 
            ${achivedConfig.july}, ${achivedConfig.august}, ${achivedConfig.september}, ${achivedConfig.october}, ${achivedConfig.november}, ${achivedConfig.december}, 
            ${achivedConfig.january}, ${achivedConfig.february}, ${achivedConfig.march}, now())`;
    }
 
    if(plannedSql && achivedSql) {
        plannedRecord = await executeNonQuery(plannedSql);
        achivedRecord = await executeNonQuery(achivedSql);
    }

    return {'planned': plannedRecord, 'achived': achivedRecord};
}

async function getConfigByFinYear(finyear) {
    var configs = null;
    if(finyear == null || finyear == '' || finyear == undefined) return;

    var sql = `select * from config_tbl where finyear='${finyear}'`;
 
    configs = await executeQuery(sql);

    return configs;
}

async function getEmployeeByInfo(employeeinfo) {
    //var connection = await getDBConnection();
    var employee = null;
    var sql = null;

    if(employeeinfo && employeeinfo.code && employeeinfo.code !== '') {
        sql = `select * from employees_tbl where code = '${employeeinfo.code}'`;
    }
    else if(employeeinfo && employeeinfo.id > 0) {
        sql = `select * from employees_tbl where id = ${employeeinfo.id}`;
    }
 
    if(sql) {
        var employeeRecord = await executeQuery(sql);
        if(employeeRecord && Array.isArray(employeeRecord) && employeeRecord[0]) {
            console.log(`Employee Record : ${JSON.stringify(employeeRecord[0])}`);
            employee = transformEmployeeRecord(employeeRecord[0]);
        }
    }

    return employee;
}

async function saveEmployees(employees) {
    let results = [];
    if(employees && employees.length>0) {
        for (let index = 0; index < employees.length; index++) {
            let employee = employees[index];
            let existingEmployee = await getEmployeeByInfo(employee);
            if(existingEmployee && existingEmployee.id>0) {
                let result = await updateEmployee(employee);
                results.push(result);
            }
            else {
                let result = await insertEmployee(employee);
                results.push(result);
            }
        }
    }

    return results
}

async function insertEmployee(employee) {
    let code = (employee.code !== '') ? employee.code : null;

    if(code) {
        achivedSql = `insert into employees_tbl(name, code, location, created_on, status)
        values('${employee.name}', '${employee.code}', '${employee.location}', now(), 1)`;
    }
    else {
        achivedSql = `insert into employees_tbl(name, code, location, created_on, status)
        values('${employee.name}', uuid(), '${employee.location}', now(), 1)`;
    }

    let plannedRecord = await executeNonQuery(achivedSql);

    return plannedRecord;
}

async function updateEmployee(employee) {
    achivedSql = `update employees_tbl set name='${employee.name}', location='${employee.location}', updated_on=now(), status=1 where code='${employee.code}'`;

    let plannedRecord = await executeNonQuery(achivedSql);

    return plannedRecord;
}

//jshint ignore:end

module.exports = {saveActivitiesByEmployee, getEmployee, getActivities, getEmployeeCSRActivities, getEmployees, getEmployeeCSRSyncStatus, saveEmployeeConfig, getConfigByFinYear, saveEmployees};