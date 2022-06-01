//jshint esversion:6
//jshint ignore:start

const mysql = require('mysql');
const moment = require('moment');
const DEFAULT_COMPANY_ID = 1;
const DEFAULT_USER_ID = 104;

const DEFAULT_BATCH = 20;

var pool = null;
const logger = require('../src/common/logger').Logger;
logger.init('notifier');

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
    
    //Remote: Pankh DB
    // pool = mysql.createPool({
    //     connectionLimit : 2,
    //     connectTimeout  : 60 * 60 * 1000,
    //     acquireTimeout  : 60 * 60 * 1000,
    //     timeout         : 60 * 60 * 1000,        
    //     host: "www.oxytra.com",
    //     user: "oxyuser_uat",
    //     password: "Oxy@321-#",
    //     database: "oxytra_uat",
    //     port: 3306
    // });    

    //Remote DB
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

module.exports = {bookPendingNotifications, getNotifications};