//jshint esversion:6
//jshint ignore:start

const mysql = require('mysql');
const moment = require('moment');
var pool = null;

function getDBPool() {
    if(pool) return pool;

    //Local DB
    pool = mysql.createPool({
        connectionLimit: 30,
        connectTimeout: 15000,
        host: "139.59.92.9",
        user: "oxyusr",
        password: "oxy@123",
        database: "oxytra",
        port: 3306
    });

    //Remote DB
    // pool = mysql.createPool({
    //     connectionLimit: 30,
    //     connectTimeout: 15000,
    //     host: "www.oxytra.com",
    //     user: "oxyusr",
    //     password: "oxy@321-#",
    //     database: "oxytra",
    //     port: 3306
    // });

    return pool;
}

async function saveData(result, runid, callback) {
    // var con = mysql.createConnection({
    //     host: "139.59.92.9",
    //     user: "oxyusr",
    //     password: "oxy@123",
    //     database: "oxytra",
    //     port: 3306
    // });


    //con.connect(function(err, data) {
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

    var qrySql = `select id from tickets_tbl where source='${result.departure.id}' and destination=${result.arrival.id} and departure_date_time='${deptDate}' and arrival_date_time='${arrvDate}' and airline='${result.flight_id}' and data_collected_from='neptunenext'`;
    conn.query(qrySql, function (err, data) {
        if(err) {
            console.log(err);
        }
        let insertStatus = {};

        console.log((data.length>0?'Update':'Insert') + JSON.stringify(result));
        if(data.length>0) {
            //var updateSql = `update tickets_tbl set no_of_person=${result.availability}, max_no_of_person=${result.availability}, availibility= ${result.availability}, price=${result.price}, total=${result.price}+baggage+meal+markup+admin_markup-discount where source='${result.departure.id}' and destination='${result.arrival.id}' and departure_date_time='${deptDate}' and arrival_date_time='${arrvDate}' and airline='${result.flight_id}' and data_collected_from='neptunenext'`;
            var updateSql = `update tickets_tbl set no_of_person=${result.availability}, max_no_of_person=${result.availability}, availibility= ${result.availability}, available='${result.availability>0?'YES':'NO'}', price=${result.price}, total=${result.price}, last_sync_key='${runid}' where source='${result.departure.id}' and destination='${result.arrival.id}' and departure_date_time='${deptDate}' and arrival_date_time='${arrvDate}' and airline='${result.flight_id}' and data_collected_from='neptunenext'`;
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
            var insertSql = `INSERT INTO tickets_tbl (source, destination, source1, destination1, trip_type, departure_date_time, arrival_date_time, flight_no, terminal, departure_date_time1, arrival_date_time1, flight_no1, terminal1, terminal2, terminal3, no_of_person, max_no_of_person, no_of_stops, stops_name, no_of_stops1, stops_name1, class, class1, airline, airline1, aircode, aircode1, pnr, ticket_no, price, baggage, meal, markup, admin_markup, discount, total, sale_type, refundable, availibility, user_id, remarks, approved, available, data_collected_from, last_sync_key) 
            VALUES ('${result.departure.id}','${result.arrival.id}',0,0,'ONE','${deptDate}','${arrvDate}','NPTNX-${result.flight_number}','NA','${emptyDate}','${emptyDate}','','','','',${result.availability},${result.availability},0,'NA',0,'NA','${result.ticket_type.toUpperCase()}','','${result.flight_id}',0,'${result.flight}','','','TKT-',${result.price},0,0,0,0,0,${result.price},'request','N',${result.availability},104,'',1,'${result.availability>0?'YES':'NO'}', 'neptunenext', '${runid}')`;
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
    getDBPool().getConnection(function(err, conn) {
        try
        {
            if(err) {
                console.log(err);
            }
            var sql = `update tickets_tbl set no_of_person=0, max_no_of_person=0, availibility=0, available='NO' where available='YES' and data_collected_from='neptunenext' and last_sync_key<>'${runid}'`;
            
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

async function getAirline(conn, aircode, callback) {
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
//jshint ignore:end

module.exports = {saveData, finalization};