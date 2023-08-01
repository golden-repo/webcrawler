const uuidv4 = require('uuid/v4');
const puppeteer = require('puppeteer');
//const metadata = require('./metadata_airiq');
const delay = require('delay');
const moment = require('moment');
const fetch = require('isomorphic-fetch');
const airiqCrawlCommonLib = require('./airiqV2_crawl');
const gfsCrawlCommonLib = require('./gfsV2_crawl');

// const winston = require('winston');
// const {combine, timestamp, label, printf} = winston.format;
// const DailyRotateFile = require('winston-daily-rotate-file');

// const winston = require('winston');
// const {combine, timestamp, label, printf} = winston.format;
// const DailyRotateFile = require('winston-daily-rotate-file');

const logger = require('./src/common/logger').Logger;

logger.init('crawlapi');

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

function log() {
    var time = moment().format("HH:mm:ss.SSS");
    var args = Array.from(arguments);

    args.unshift(time);
    console.log.apply(console, args);
    //winston.info(args.join(' '));
    var msg = args.join(' ');
    logger.log('info', msg);    
}

function init_routes(router) {
    router.get('/gfs/available-sectors', getAvailableSectors);
}

// get available sectors of AirIQ
async function getAvailableSectors(req, res, next) {
    log('GFS API process started');

    try
    {
        const datastore = require('./radharani/goflysmartdatastore');
        let arrvid, deptid;
        let deptdate = '';
        arrvid = deptid = 0;

        excutionStarted = true;
        capturedData = {};
        process.on('unhandledRejection', (reason, promise) => {
            log('Unhandled Rejection at:', reason);
        });

        //let searchPayload = req.body;
        let payload =  {'email': '9382207002', 'password': 'Sumit@12356'};
        let extraData = [
            {id: 1, key: 'workflowName', value: 'gfs:available-sectors'}
        ];
        let runid = `${uuidv4()}_${moment().format("DD-MMM-YYYY HH:mm:ss.SSS")}`;
        //let crawlingUri = "https://www.flygofirst.com/";
        let crawlingUri = `https://goflysmartapi.azurewebsites.net/`;
        // searchPayload.sourceCity = await datastore.getCityItem(searchPayload.source);
        // searchPayload.destinationCity = await datastore.getCityItem(searchPayload.destination);
        // searchPayload.sector = `${searchPayload.source} // ${searchPayload.destination}`;

        gfsCrawlCommonLib.process(crawlingUri, payload, extraData, runid).then(async (data)=> {
            log(`Search payload => ${JSON.stringify(data)}`);
            try
            {
                log('Process completed.');

                process.removeAllListeners("unhandledRejection");
                process.removeAllListeners('exit');
                process.removeAllListeners();
            }
            catch(e) {
                log(e);
            }
            finally {
                excutionStarted = false;
            }
            // if(browser) {
            //     browser.close();
            //     log('Closing browser');
            // }
            res.status(200).json(data);
        }).catch((reason) => {
            log(reason);
            log(JSON.stringify(capturedData));
            excutionStarted = false;

            next(reason);
        });
    }
    catch(e) {
        log(e);
        excutionStarted = false;
        next(e);
    }
}

module.exports = {"init": init_routes};