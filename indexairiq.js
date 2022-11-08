//In this program we will be logging into github and will be downloading specific file.

//jshint esversion:6
//const tty = require('tty');
const cron = require("node-cron");
const express = require("express");
const fs = require("fs");

const uuidv4 = require('uuid/v4');
const puppeteer = require('puppeteer');
const metadata = require('./metadata_airiq');
const delay = require('delay');
const moment = require('moment');
// const winston = require('winston');
// const {combine, timestamp, label, printf} = winston.format;
// const DailyRotateFile = require('winston-daily-rotate-file');

const logger = require('./src/common/logger').Logger;

logger.init('airiq');

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

// const myFormat = printf(({ level, message, label, timestamp }) => {
//     return `${timestamp} [${label}] ${level}: ${message}`;
// });

var timeFormatFn = function() {
    'use strict';
    return moment().format(cfg.timeFormat);
};

// winston.configure({
//     defaultMeta: {service: 'indexairiq-crawler'},
//     format: combine(label({label: 'airiqcrawler'}), timestamp(), myFormat),
//     transports:[
//        new winston.transports.File({filename: `airiq_execution_log_${moment().format("D_M_YYYY")}.log`, })
//     ]
// });

const USERINPUT = {
    id: 1,
    controlid: '',
    delaybefore: -1,
    selector: '',
    checkcontent: '',
    type: '',
    value: '',
    action: '',
    delayafter: -1,
    checkselector: '',
    next: 2
};

app = express();

app.use(
    express.urlencoded({
      extended: true
    })
);
  
app.use(express.json());

const TIMEOUT = 10000; //6000;
const POSTBACK_TIMEOUT = 12000; //8000
const POLLINGDELAY = 100;

// var browser = null;
// var page = null;
// var pageConfig = null;
//var capturedData = {};
const PORT = 3131;
//jshint ignore:start

function getStore(context) {
    // if(capturedData) return capturedData;

    // capturedData = {}

    // return capturedData;

    if(context && context.capturedData) {
        return context.capturedData;
    }
    else {
        context.capturedData = {}

        return context.capturedData;
    }
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

async function takeSnapshot(filename) {
    var time = moment().format("HH_mm_ss_SSS");
    await page.screenshot({path: `${filename}-${time}.png`});
}

let pageLoaded = true;
async function navigatePage(pageName) {
    var browser = null;
    var page = null;
    var pageConfig = null;

    try
    {
        log('before launch of browser');
        browser = await puppeteer.launch(
            {
                headless: true,
                ignoreHTTPSErrors: true,
                ignoreDefaultArgs: ['--enable-automation'],
                args: ['--start-fullscreen','--no-sandbox','--disable-setuid-sandbox'],
                timeout: 30000
                //args: ['--start-fullscreen']
            }).catch((reason) => {
                log(reason);
                return;
            });
        //const page = await browser.newPage();
        log('Browser launched');
        let pages = await browser.pages().catch((reason) => log(`Error in browser.pages ${reason}`));
        log('Got the pages');
        page = pages.length>0?pages[0]:await browser.newPage().catch((reason) => log(`Error in browser.newPage ${reason}`));
        log('after new page created');
        await page.setViewport({ width: 1366, height: 768}).catch((reason) => log(`Error in page.setViewport ${reason}`));
        log('after setting viewport');
        await page.setCacheEnabled(true).catch((reason) => log(`Cache enable Error : ${reason}`));
        log('after cache enabled');
        /*page.setRequestInterception(true);
        page.on("load", interceptedRequest => {
            log("Load -> " + interceptedRequest.url());
        });*/
        //const response = await page.goto("https://github.com/login");
        await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1").catch((reason) => log(`Error in page.setUserAgent ${reason}`));
        log('user agent set');
        //let response = await page.goto(pageName, {waitUntil:'load', timeout:30000}); //wait for 10 secs as timeout
        //let response = await page.goto(pageName, {waitUntil:'load'}); //wait for 10 secs as timeout
        // let response = await page.goto(pageName, {waitUntil:'load'}).catch(async (reason) => {
        //     log('Navigation error : ${reason}');
        // }); 
        // let response = await page.goto(pageName, {waitUntil:['networkidle2', 'load']}).catch(async (reason) => {
        //     log(`Navigation error : ${reason}`);
        // }); 
        let response = await page.goto(pageName, {waitUntil:'load', timeout:30000}).catch(async (reason) => {
            log(`Navigation error : ${reason}`);
        }); 

        //log(await page.cookies());
        //await page.waitForNavigation();
        //takeSnapshot('After_pageload');
        log('after navigation done');
        //log(await page.cookies());
        //await page.waitForNavigation();
        //log('after navigation done');
        //assumed page loaded
        pageConfig = metadata.pages.find(pg => {
            return response.url().indexOf(pg.name)>-1;
        });
        
        page.on('domcontentloaded',()=> {
            //log('Content Loaded - dom even fired');
            pageLoaded = true;
        });

        page.on('load',()=> {
            //log('Load - dom even fired');
            pageLoaded = true;
        });

        var actionItem = pageConfig.actions[0];

        //block image loading
        await page.setCacheEnabled(true);
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            let url = req.url().toLowerCase();
            if(req.resourceType() === 'image' || req.resourceType() === 'font' || url.indexOf('fonts')>-1
             || url.indexOf('animate')>-1 || url.indexOf('des')>-1 || url.indexOf('tabs')>-1){
                req.abort();
            }
            else {
                //log(`Req.Type : ${req.resourceType()} - ${req.url()}`);
                req.continue();
            }
        });

        page.hackyWaitForFunction = (predicate, opts = {}, isLoadedCtrl=false, chkControl=null) => {
            const start = new Date()
            const {timeout = 10000, polling = 10} = opts
        
            return new Promise((resolve, reject) => {
              const check = async () => {
                const result = await predicate();
                //log(`result => ${result}`);
                if (result) {
                  resolve(result);
                } else if ((new Date() - start) > timeout) {
                  reject('Function timed out');
                } else {
                  setTimeout(check, polling);
                }
              }
        
              setTimeout(check, polling);
            })
        }

        // await page.waitFor(5000).catch((reason) => { log(`Error -> ${reason}`)});
        // //takeSnapshot('After_pageload');
        // log('Waited for 5secs more');

        log('Wait handler added');

        /* puppeteer issues*/
        // const elementHandle = await page.$('body').catch((reason)=> log(reason));
        // elementHandle.constructor.prototype.boundingBox = async function() {
        //   const box = await this.executionContext().evaluate(element => {
        //     const rect = element.getBoundingClientRect();
        //     const x = Math.max(rect.left, 0);
        //     const width = Math.min(rect.right, window.innerWidth) - x;
        //     const y = Math.max(rect.top, 0);
        //     const height = Math.min(rect.bottom, window.innerHeight) - y;
        //     return { x: x, width: width, y: y, height: height };
        //   }, this);
        //   return box;
        // };
        // elementHandle.dispose();
        /*End of fixes */

        //log(actionItem);

        for(var iidx=0; iidx<actionItem.userinputs.length; iidx++) {
            try
            {
                var val = actionItem.userinputs[iidx];
                var idx = iidx;

                //log(JSON.stringify(val) + ' - ' + idx);
                if(val.action==='keyed') {
                    //log('Going to click');
                    await page.click(val.selector).then(function(val1, val2) {
                        //log('Click finished');
                    });
                    //log('Clicked');
                    await page.keyboard.type(val.value).then(function(val1, val2) {
                        //log('Key pressed');
                    });
                    //log('Keyed');
                }
                else if(val.action==='click') { 
                    let chkControl = null;
                    pageLoaded = false;
                    await page.click(val.selector);
                    //await page.waitFor(200);
                    // if(val.haspostback!==undefined && val.haspostback!==null && val.haspostback) {
                    //     //log(`N01 : haspostback? ${val.selector}`);
                    //     if(!pageLoaded) {
                    //         //log(`N01 : ${pageLoaded}`); //domcontentloaded, load, networkidle0
                            
                    //         await page.hackyWaitForFunction(async (isLoaded) => {
                    //             //let time = new Date().toLocaleTimeString();
                    //             //console.log(`${time} N01 checking isLoaded ${pageLoaded}`);
                    //             //let chkControl = await page.$(val.checkselector).catch((reason)=> log(reason));
                    //             // let chkControl = await page.$eval(val.checkselector, e => e.outerHTML).catch((reason)=> a=1);
                    //             // return (pageLoaded || (chkControl!==null && chkControl!==undefined));
                    //             return pageLoaded;
                    //         }, {polling: POLLINGDELAY, timeout: POSTBACK_TIMEOUT}, pageLoaded, val.checkselector).catch(async (reason) => { 
                    //             log(`N01 = ${reason} - ${pageLoaded}`); 
                    //             //await takeSnapshot('N01');
                    //             chkControl = await page.$(val.checkselector).catch((reason)=> log(reason));
                    //             if(chkControl===null || chkControl===undefined)
                    //                 await page.waitFor(1000); //Lets wait for another 1 sec and then proceed further. But this is exceptional case
                    //         });    
                    //     }
                    // }
                    
                    // if((chkControl===null || chkControl===undefined) && val.checkselector!=='' && val.checkselector!==undefined && val.checkselector!==null) {
                    if(val.checkselector!=='' && val.checkselector!==undefined && val.checkselector!==null) {
                        
                        let selectedItem = await page.waitForSelector(val.checkselector, {timeout: TIMEOUT}).catch(async (reason) => {
                            log(`2.eclick - child - ${reason}`);
                            //await takeSnapshot('2_eclick-child');
                        });
                        if(selectedItem===null || selectedItem===undefined) {
                            selectedItem = await page.$(task.checkselector).catch(reason=> log('2_checkselector not found', reason));
                        }
                    }

                    // if(val.checkselector!=='' && val.checkselector!==null) {
                    //     await page.waitForSelector(val.checkselector, {timeout: TIMEOUT});
                    // }
                }
            }
            catch(err) {
                log('err1');
                log(err);
            }
        }
    }
    catch(fe) {

    }

    return {browser, page, pageConfig};
}

async function ProcessActivity(targetUri, runid=uuid5(), context) {
    //await navigatePage("https://github.com/login");
    var browser = null;
    var page = null;
    var pageConfig = null;    
    let processed = false;
    try
    {
        if(targetUri===undefined || targetUri===null || targetUri==="")
            return;

        var result = await navigatePage(targetUri).catch((reason) => log(`navigation error | Error : ${reason}`));
        context.browser = browser = result.browser;
        context.page = page = result.page;
        context.pageConfig = pageConfig = result.pageConfig;

        //log('Page navigated...');
        if(browser!==null && page!==null) {
            //log('URL -> ' + page.url());

            for(pageIdx=1; pageIdx<metadata.pages.length; pageIdx++) {
                pageConfig = metadata.pages[pageIdx];
                // pageConfig = metadata.pages.find(pg => {
                //     return page.url().indexOf(pg.name)>-1;
                // });
                let repeatsourceContent = null;
                let repeatsourceData = null;
                let repeatsourceType = null;
                let repeatsource = null;

                let isrepeat = (pageConfig.actions[0].repeat===undefined 
                    || pageConfig.actions[0].repeat===null)?false:pageConfig.actions[0].repeat;
                if(isrepeat) {
                    // let ctrlItem = await page.evaluate(() => {
                    //     let chatCtrl = document.querySelector('div.meshim_widget_components_chatButton_Button.ltr');
                    //     if(chatCtrl!==null) {
                    //         chatCtrl.setAttribute('style', 'display:none');
                    //     }
                    // });

                    repeatsource = pageConfig.actions[0].repeatsource;
                    repeatsourceType = (repeatsource===undefined || repeatsource===null)?null:((repeatsource instanceof Array)?
                        'array':((repeatsource instanceof Number)?'number':(typeof(repeatsource)==='function'?'function':null)));
                    if(repeatsourceType==='array' || repeatsourceType==='number') {
                        repeatsourceData = repeatsource;
                    }
                    else if(repeatsourceType==='function') {
                        repeatsourceData = repeatsource;
                    }
                    
                    if( pageConfig.actions[0].repeatsourceselector!==undefined && 
                        pageConfig.actions[0].repeatsourceselector!==null && isrepeat)
                    {
                        //repeatsourceControl = await objPage.$$(pageConfig.actions[0].repeatsourceselector);
                        let type = (pageConfig.actions[0].repeatsourceContentType===undefined || 
                                pageConfig.actions[0].repeatsourceContentType===undefined)?'html':
                                (pageConfig.actions[0].repeatsourceContentType);

                        if(type==='html') {
                            await page.waitForSelector(pageConfig.actions[0].repeatsourceselector, {timeout: TIMEOUT}).catch(async (reason) => {
                                log(`E1 => ${reason}`);
                                //await takeSnapshot('E1-RepetSelector');
                            });
                            repeatsourceContent = await page.$eval(pageConfig.actions[0].repeatsourceselector, e => e.innerHTML).catch(reason => log(`E2 => ${reason}`));
                        }
                        else if(type==='text') {
                            await page.waitForSelector(pageConfig.actions[0].repeatsourceselector, {timeout: TIMEOUT}).catch(reason => log(`E3 => ${reason}`));;
                            repeatsourceContent = await page.$eval(pageConfig.actions[0].repeatsourceselector, e => e.innerText).catch(reason => log(`E4 => ${reason}`));;
                        }

                        if(repeatsourceType==='array' || repeatsourceType==='number') {
                            repeatsourceData = repeatsource;
                        }
                        else if(repeatsourceType==='function') {
                            //log('getting repeatSourceData');
                            repeatsourceData = repeatsource(repeatsourceContent, context); //it should return array
                            //log('got repeatSourceData');
                            if(repeatsourceData instanceof Number) {
                                repeatsourceType = 'number';
                            }
                            else if(repeatsourceData instanceof Array) {
                                repeatsourceType = 'array';
                            }
                            else if(repeatsourceData instanceof Object) {
                                repeatsourceType = 'object';
                            }

                            if(repeatsourceData===undefined)
                            {
                                repeatsourceData = null;
                            }
                        }
                    }
                }

                if(pageConfig!==null) //We landed to right page now
                {
                    let loopCount = 1;
                    if(repeatsourceType===null || repeatsourceType==='object') {
                        loopCount = 1;
                    }
                    else if(repeatsourceType==='number') {
                        loopCount = parseInt(repeatsourceData);
                    }
                    else if(repeatsourceType==='array') {
                        loopCount = repeatsourceData.length;
                    }

                    //for(var i=0; i<loopCount; i++) { //
                    var i=0;
                    while(i<loopCount) {
                        let repeatsourceDataValue = (repeatsourceType==='array')?repeatsourceData[i]:'NA';

                        let src_dest = repeatsourceDataValue.match(/\w+/gi);
                        let key = '';
                        if(src_dest!==null && src_dest.length>1) {
                            key = (src_dest[0].trim() + '_' + src_dest[1].trim());
                            let storeData = getStore(context);
                            storeData[key]=[];
                        }

                        log(`${i} - ${repeatsourceDataValue}`);
                        //remove false from here, this is just for testing.
                        if(pageConfig.actions[0].userinputs.length>0) {
                            //for(var iidx=0; iidx<pageConfig.actions[0].userinputs.length; iidx++) {
                            var iidx = 0;
                            var piidx = 0;
                            pageConfig.actions[0].userinputs.map((val, ndx) => {
                                val.retrycount = 0;
                            });
                            //while(iidx<pageConfig.actions[0].userinputs.length) {
                            while(iidx<pageConfig.actions[0].userinputs.length) {
                                var userInput =  pageConfig.actions[0].userinputs[iidx];
                                processed = true;
                                
                                //this is the place we need to use repeat functionality
                                if(repeatsourceType===null) {
                                    await performUserOperation(page, userInput, null, i, runid, context).catch(reason => log(`E5 => ${reason}`));
                                }
                                else if(repeatsourceType==='number') {
                                    await performUserOperation(page, userInput, null, i, runid, context).catch(reason => log(`E6 => ${reason}`));
                                }
                                else if(repeatsourceType==='array') {
                                    try
                                    {
                                        //log(`Perform user operation ${i} - ${userInput.action}`);
                                        await performUserOperation(page, userInput, repeatsourceData[i], i, runid, context).catch(reason => log(`E7 => ${reason}`));
                                        // await performUserOperation(page, userInput, repeatsourceData[i], function(input, sourcedata) {
                                        //     log(`Error happened at index ${i}`);
                                        //     i--; break;
                                        // });
                                        //log(`Perform user operation ${i} - ${userInput.action} Done`);
                                    }
                                    catch(e) {
                                        log(e)
                                        //if(e.toLowerCase()==='control missing') {
                                        log('Retrying once again.')
                                        //iidx = pageConfig.actions[0].userinputs.length-2;
                                        iidx = piidx;
                                        i--;
                                        //break;
                                        //}
                                        continue;
                                    }
                                }
                                else if(repeatsourceType==='object') {
                                    //no idea what to do here
                                }
                                piidx = iidx;
                                if(userInput.next!==undefined && userInput.next!=null) {
                                    let nextActivity = userInput.next;
                                    let nextActivityId = -1;
                                    if(typeof(nextActivity) === 'number')
                                    {
                                        nextActivityId = parseInt(nextActivity);
                                    }
                                    else if(typeof(nextActivity) === 'function') {
                                        if(userInput.retrycount!==undefined && userInput.retrycount!==null) {
                                            let retryCount = parseInt(userInput.retrycount);
                                            userInput.retrycount=++retryCount;
                                        }

                                        nextActivityId = await nextActivity.call(this, userInput);
                                    }
                                    if(nextActivityId>-1) {
                                        nextActivityId = pageConfig.actions[0].userinputs.findIndex((val, idx) => {
                                            return (val.id===nextActivityId);
                                        });
                                    }
                                    if(nextActivityId>-1)
                                        iidx = nextActivityId;
                                    else if(nextActivityId===-1)
                                        iidx = 999;
                                    else
                                        iidx++;
                                }
                                else {
                                    iidx++;
                                }
                            }

                            log(`END :: ${i} - ${repeatsourceDataValue}`);
                        }
                        else {
                            //there is no user input. Kind of code cleaning process.
                            try
                            {
                                let storeObj = getStore(context);
                                let totalRowsFetched = 0;
                                let keys = Object.keys(storeObj);
                                for(var sdx=0; sdx<keys.length; sdx++) {
                                    let keyName = keys[sdx].trim();
                                    totalRowsFetched += storeObj[keyName].length;
                                }
                                log(`Total records processed : ${totalRowsFetched}`);
                                
                                let action = pageConfig.actions[0];
                                if(totalRowsFetched>0 && action.type==='code' && action.methodname!==undefined && action.methodname!==null) {
                                    let methodName = action.methodname;
                                    log(`Processing : ${methodName} method`);

                                    if(methodName!==undefined && methodName!==null) {
                                        await action[methodName].call(action, runid);
                                        log(`${methodName} finished`);
                                    }
                                }
                            }
                            catch(ep) {
                                log(ep);
                            }
                        }
                        i++;
                        //going for next circle
                        //log('moving to next circle');
                        let impactedRows = await metadata.circlecrawlfinished(runid, getStore(context), key, function(status) {
                            log(`Finaliation of ${key} - ${status}`);
                        });
                        //log(`Next operation ${i} starting`);
                    }
                }
            }

            if(browser) {
                await browser.close().then(() => {
                    log(`Browser closed`);
                })
                .catch((reason) => log(`Browser close : ${reason}`));
            }
            log('Operation completed');
            if(processed) {
                let data = await metadata.finalizeData(runid, context);
                log(`Finalize airiq DB -> ${JSON.stringify(data)}`);
            }
            else {
                log(`No record crawled so finalization didn't called`);
            }
        }
    }
    catch(fe) {
        log(`Global error in ProcessActivity : ${fe}`);
    }
    // finally {
    //     exhaustSeats4Rest()
    // }
}

function transformData(textValue, providedData) {
    var value = textValue;

    try {
        let variables = [];
        let varStarted = false;
        let varEnd = false;
        let variable = "";
        for(var i=0; i<textValue.length; i++)  {
            let chr = textValue.charAt(i);
            if(chr==='$') {
                varStarted = true;
                variable+=chr;
            }
            else if(chr==='{') {
                //varStarted = varStarted?true:false;
                if(varStarted) {
                    variable+=chr;
                }
            }
            else if(chr==='}') {
                if(varStarted) {
                    varEnd = true;
                    variable+=chr;
                }

                if(varStarted && varEnd) {
                    variables.push(variable);
                    varStarted=false;
                    varEnd=false;
                    variable="";
                }
            }
            else {
                if(varStarted) {
                    variable+=chr;
                }
            }
        }

        for(var i=0; i<variables.length; i++) {
            value = value.replace(variables[i], providedData);
        }
    }
    catch(e) {
        log(e);
    }
    //log('Transformed Data :', value);
    return value;
}

async function performUserOperation(objPage, userInput, data, ndx, runid, context, callback) {
    var browser = context.browser;
    var page = context.page;
    var pageConfig = context.pageConfig;

    try
    {
        let delay = 200; //300
        userInput = userInput || USERINPUT;
        var onError = false;
        
        let inputSelector = userInput.selector;
        if(inputSelector.indexOf('${')>-1) {
            userInput.selector = transformData(userInput.selector, data);
        }
        
        //log(`performUserOperation ${userInput.action} starting`);
        await page.waitFor(delay);

        switch (userInput.action) {
            case 'keyed':
                if(typeof(userInput.value)==="string") {
                    //await objPage.click(userInput.selector);
                    if(userInput.selector) {
                        //log('1', userInput.selector);
                        //let inputControl = await objPage.$(userInput.selector).catch((reason)=> log(reason));
                        let inputControl = await page.$(userInput.selector).catch((reason)=> log(reason));
                        //let inputControl = await page.evaluate((selector) => document.querySelector(selector).click(), userInput.selector);
                        if(inputControl && inputControl.click) {
                            await inputControl.click().catch(reason=> log(reason));
                        }
                        
                        await page.evaluate(function(ui) {
                            let element = document.querySelector(ui.selector);
                            if(element)
                                element.value='';
                            
                        }, userInput).catch(reason => log(`E9 => ${reason}`));;
                    }
                    let keyedValue = userInput.value;
                    if(userInput.value.indexOf('${')>-1) {
                        keyedValue = transformData(userInput.value, data);
                    }
                    await page.keyboard.type(keyedValue).catch(reason => log(`E11 => ${reason}`));
                    if(userInput.delayafter>-1)
                        delay = userInput.delayafter;

                    await page.waitFor(delay).catch(reason => log(`E12 => ${reason}`)); //400
                    //log(`performUserOperation ${userInput.action} KEY CODE SENT`, keyedValue);
                }
                else if(typeof(userInput.value)==="object") { 
                    if(userInput.selector) {
                        //log('2', userInput.selector);
                        let inputControl = await objPage.$(userInput.selector).catch((reason)=> log(reason));
                        if(inputControl && inputControl.click) {
                            inputControl.click();
                            if(userInput.checkselector!=='' && userInput.checkselector!==null) {
                                await objPage.waitForSelector(userInput.checkselector, {timeout: TIMEOUT});
                            }
                            else
                            {
                                await delay(200);
                            }
                        }
                    }

                    var eventType = userInput.value.eventtype;
                    var delayValue = parseInt(userInput.value.delay);

                    for(var ndx=0; ndx<userInput.value.keys.length; ndx++) {
                        var keyValue = userInput.value.keys[ndx];
                        overrideEventType = eventType;
                        if(keyValue.indexOf('^')>-1)
                        {
                            if(keyValue.split('^')[1]!=="")
                                overrideEventType = keyValue.split('^')[1];
                            }
                            keyValue = keyValue.split('^')[0];

                        if(keyValue!==null && keyValue!=="") {
                            if(overrideEventType==="keydown" || overrideEventType==="down") {
                                await objPage.keyboard.down(keyValue);
                            }
                            else if(overrideEventType==="keyup" || overrideEventType==="up") {
                                await objPage.keyboard.up(keyValue);
                            }
                        }

                        if(delayValue>0) {
                            await delay(delayValue);
                        }
                    }
                }
                else if(typeof(userInput.value)==='function') { 
                    await page.keyboard.type(String.fromCharCode(27));
                }
                break;
            case 'click':
                //objPage.$(//*[@id="04c6e90faac2675aa89e2176d2eec7d8-4ea1851c99601c376d6e040dd01aedc5dd40213b"])
                var inputControl = null;

                try
                {
                    if(userInput.checkcontent!==null && userInput.checkcontent!=="") {
                        try
                        {
                            let position = 0;
                            if(userInput.controlid!=="" && userInput.controlid!==null) {
                                //log('3', userInput.controlid);
                                position = 4;
                                inputControl = await objPage.$$(userInput.controlid).catch((reason)=> log(`1 - ${reason}`));
                            }
                            else if(userInput.selector!=="" && userInput.selector!==null) {
                                //log('4', userInput.selector);
                                position = 5;
                                inputControl = await objPage.$$(userInput.selector).catch((reason)=> log(`2 - ${reason}`));
                            }
                        }
                        catch(en1) {
                            log(`en1 - ${position}`);
                            log(en1);
                        }
                    }
                    else {
                        try
                        {
                            let position=0;
                            if(userInput.controlid!=="" && userInput.controlid!==null) {
                                //log('5', userInput.controlid);
                                position = 1;
                                inputControl = await objPage.$(userInput.controlid).catch((reason)=> log(`3 - ${reason}`));
                            }
                            else if(userInput.selector!=="" && userInput.selector!==null) {
                                if(userInput.isarray!=null && userInput.isarray) {
                                    //log('6', userInput.selector);
                                    position = 2;
                                    //inputControl = await objPage.$$(userInput.selector).catch((reason)=> log(`4 - ${reason}`));
                                    //await page.waitForNavigation();
                                    inputControl = await page.$$(userInput.selector).catch((reason)=> log(`4 - ${reason}`));
                                    //inputControl = await objPage.$(userInput.selector);
                                    //log('Array type Input Control', inputControl);
                                }
                                  else {
                                    //log('7', userInput.selector);
                                    position = 3;
                                    inputControl = await page.$(userInput.selector).catch((reason)=> log(`4 - ${reason}`));
                                    //inputControl = await objPage.$(userInput.selector).catch((reason)=> log(`5 - ${reason}`));
                                }
                            }
                        }
                        catch(en2) {
                            log(`en2 - ${position}`);
                            log(en2);
                        }
                    }

                    if((userInput.checkcontent!==null && 
                        userInput.checkcontent!=="") && inputControl instanceof Array) {
                        for(var idx=0; idx<inputControl.length; idx++) {
                            let innerText = await inputControl[idx].getProperty('textContent').catch(reason => log(`E12 => ${reason}`));
                            innerText = innerText._remoteObject.value;
                            let jsonValue = await inputControl[idx].jsonValue().catch(reason => log(`E13 => ${reason}`));
                            log("Text -> "+innerText);
                            
                            let contentValue = userInput.value;
                            if(userInput.value.indexOf('${')>-1) {
                                contentValue = transformData(userInput.value, data);
                            }

                            if(contentValue!==null && 
                                contentValue!=="") 
                            {
                                if(innerText===contentValue) {
                                    inputControl = inputControl[idx];
                                    //userInput.selector = `${userInput.selector}:nth-child(${idx+1})`;
                                    break;
                                }
                            }
                            else {
                                inputControl = inputControl[0];
                                //userInput.selector = `${userInput.selector}:nth-child(${idx+1})`;
                                break;
                            }
                        }

                        if(inputControl instanceof Array) {
                            inputControl = inputControl[0];
                            //userInput.selector = `${userInput.selector}:nth-child(${idx+1})`;
                        }
                    }
                }
                catch(err) {
                    log('err');
                    log(err);
                }

                //set the inputControl to userInput object
                userInput.inputControl = inputControl;

                if(inputControl!=null) {
                    //log("Going to start operation", inputControl);
                    // if(inputControl.click)
                    //     inputControl.click();
                    // else
                    // {
                    //     log(inputControl);
                    // }
                    if(!(inputControl instanceof Array)) {
                        let chkControl = null;
                        // if(userInput.delaybefore>-1)
                        //     await page.waitFor(userInput.delaybefore).catch(reason => log(`E14 => ${reason}`));
                        pageLoaded = false;
                        // await page.waitForSelector(userInput.selector, {timeout: TIMEOUT}).catch(async (reason) => {
                        //     log(`Was waiting for action selector but didn't found ${userInput.selector}`);
                        // });
                        let actionSelector = await page.$(userInput.selector).catch((reason)=> log(`Finding action selector failed - ${reason}`));
                        if(actionSelector == null) 
                            log(`Action selector ${userInput.selector} is null. So can't [click] it`);

                        //This is perfect running code
                        //await page.click(userInput.selector).catch(reason => log(`E13 => ${reason}`));
                        await inputControl.click().catch(reason => log(`E13 => ${reason}`));
                        await page.waitFor(delay);
                        
                        // if((chkControl===null || chkControl===undefined) && userInput.checkselector!=='' && userInput.checkselector!==null) {
                        if(userInput.checkselector!=='' && userInput.checkselector!==null) {
                            try
                            {
                                await page.waitForSelector(userInput.checkselector, {timeout: TIMEOUT}).catch(async (reason) => {
                                    log(`E16 => ${reason}`)
                                    let chkSelector = await page.$(userInput.checkselector).catch((reason)=> log(`E16-DoubleCheck - ${reason}`));
                                    if(chkSelector===null || chkSelector===undefined)
                                    {
                                        //await takeSnapshot('E16-DoubleCheck');
                                        log(`E16-DoubleCheck - checkselector null=> ${userInput.checkselector}`)
                                    }
                                });
                            }
                            catch(e2) {
                                log(`e2 => ${e2}`);
                                //return;
                                userInput.exit = true;
                                if(userInput.retrycount!==undefined && userInput.retrycount!==null) {
                                    let retryCount = parseInt(userInput.retrycount);
                                    userInput.retrycount = ++retryCount;
                                }
                                else {
                                    userInput.retrycount = 1;
                                }
                                userInput.inputControl = [];
                                return -1;
                            }
                        }
                        //log("Input Control not Array", `click ${userInput.selector} done`);
                    }
                    else {
                        //inputControl.forEach((ctrl, idx) => {
                        //log(`Length -> ${inputControl.length}`);
                        if(inputControl.length>0) {
                            let foundTheCrawlDate = false;
                            for(var idx=0; idx<inputControl.length; idx++) {
                                //let ctrl = inputControl[idx];
                                let deptdate = null;
                                let processCrawl = true;
                                if(context && context.date) {
                                    deptdate = moment(context.date);
                                    processCrawl = false;
                                }
                                let ctrl = await getControl(page, userInput, idx, inputControl).catch(reason => log(`E17 => ${reason}`));
                                let elementValue = await page.evaluate(el => el.textContent, ctrl);
                                let attributeValue = await page.evaluate(el => el.getAttribute('title'), ctrl);
                                //console.log(`Target Element value (1) : ${elementValue}`);
                                if(attributeValue) {
                                    attributeValue = attributeValue.indexOf('(')>-1 ? attributeValue.substring(3, attributeValue.indexOf('(')-1) : attributeValue;
                                    let processingDate = moment(attributeValue.trim(), "MMM DD YYYY HH:mm:ss Z").format('YYYY-MM-DD');
                                    //console.log(`Element title (1) : ${processingDate}`);

                                    processCrawl = foundTheCrawlDate = deptdate.format('YYYY-MM-DD') === processingDate;
                                    if(processCrawl)
                                    {
                                        console.log(`Match sector ${context.sector} & date ${processingDate} found`);
                                    }
                                }

                                //log(`Perform ${userInput.tasks.length} tasks`, `On ${inputControl.length} controls`, ctrl);
                                if(processCrawl && userInput.tasks!==null && userInput.tasks.length>0) {
                                    //userInput.tasks.forEach((tsk, i) => {
                                    //log("Array inputControl", idx, ctrl);
                                    //noprotect
                                    onError = false;
                                    for(var i=0; i<userInput.tasks.length; i++) {
                                        let tsk = userInput.tasks[i];
                                        //let targetElement = ctrl;
                                        let targetElement = await getControl(page, userInput, idx, inputControl).catch(reason => log(`E17.1 => ${reason}`));
                                        // elementValue = await page.evaluate(el => el.textContent, targetElement);
                                        // attributeValue = await page.evaluate(el => el.getAttribute('title'), targetElement);
                                        // console.log(`Target Element value (2) : ${elementValue}`);
                                        // if(attributeValue) {
                                        //     attributeValue = attributeValue.indexOf('(')>-1 ? attributeValue.substring(3, attributeValue.indexOf('(')-1) : attributeValue;
                                        //     console.log(`Element title (2) : ${moment(attributeValue.trim(), "MMM DD YYYY HH:mm:ss Z").format('YYYY-MM-DD')}`);
                                        // }

                                        if(tsk.selector!==undefined && tsk.selector!==null && tsk.selector!=="") {
                                            //log('Selector : ' + tsk.selector);
                                            if(tsk.selector!=='' && tsk.selector!==null) {
                                                onError = false;
                                                try
                                                {
                                                    //await page.waitFor(200);
                                                    await page.waitForSelector(tsk.selector, {timeout: TIMEOUT}).catch(reason => log(`E18 => ${reason}`));
                                                    // // if(userInput.haspostback!==undefined && userInput.haspostback!==null && userInput.haspostback) {
                                                    //     //log(`N03 : haspostback? ${userInput.selector}`);
                                                    //     if(!pageLoaded) {
                                                    //         //log(`N03 : ${pageLoaded}`); //domcontentloaded, load, networkidle0
                                                    //         await page.hackyWaitForFunction(async (isLoaded) => {
                                                    //             //let time = new Date().toLocaleTimeString();
                                                    //             //console.log(`${time} N03 checking isLoaded ${pageLoaded}`);
                                                    //             //let chkControl = await page.$(userInput.checkselector).catch((reason)=> log(reason));
                                                    //             //let chkControl = await page.$eval(userInput.checkselector, e => e.outerHTML).catch((reason)=> a=1);
                                                    //             //return (pageLoaded || (chkControl!==null && chkControl!==undefined));
                                                    //             return pageLoaded;
                                                    //         }, {polling: POLLINGDELAY, timeout: POSTBACK_TIMEOUT}, pageLoaded, tsk.selector).catch(async (reason) => { 
                                                    //             log(`N04 = ${reason} - ${pageLoaded}`); 
                                                    //             //await takeSnapshot('N04');
                                                    //             chkControl = await page.$(tsk.selector).catch((reason)=> log(reason));
                                                    //             if(chkControl===null || chkControl===undefined)
                                                    //                 await page.waitFor(1000); //Lets wait for another 1 sec and then proceed further. But this is exceptional case
                                                    //         });    
                            
                                                    //         // await page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: POSTBACK_TIMEOUT}).catch(async (reason) => { 
                                                    //         //     log(`N03 = ${reason} - ${pageLoaded}`); 
                                                    //         //     await takeSnapshot('N03');
                                                    //         // });    
                                                    //     }
                                                    // // }                                                    
                                                }
                                                catch(e1) {
                                                    log('e1');
                                                    log(e1);
                                                    //await page.screenshot({path: `${tsk.selector}_${moment(new Date()).format('DD-MMM-YYY_HH_mm_ss')}.png`});
                                                    onError = true;
                                                    throw 'control missing';
                                                    // if(callback) 
                                                    //     callback(userInput, data);
                                                    //if(callback) callback(e1);
                                                    //return;
                                                }
                                            }
                                            //log('8', tsk.selector);
                                            //targetElement = await objPage.$(tsk.selector).catch((reason)=> log(reason));
                                            targetElement = await page.$(tsk.selector).catch((reason)=> log(`tgt-elm - ${reason}`)).catch(reason => log(`E19 => ${reason}`));
                                            // elementValue = await page.evaluate(el => el.textContent, targetElement);
                                            // console.log(`Element value : ${elementValue}`);
                                        }
                                        //log("Going to perform Task", i, tsk.selector);
                                        let returnValue = await performTask(objPage, userInput, inputControl, targetElement, tsk, i, runid, context).catch(reason => log(`E20 => ${reason}`));
                                        //log("Task done", JSON.stringify(tsk), i);
                                        //await page.waitFor(200).catch(reason => log(`E21 => ${reason}`)); //delay to get UI refreshed with json data
                                        if(returnValue===-1 || (userInput.exit!==undefined && userInput.exit!==null && userInput.exit)) 
                                        {
                                            //userInput.exit = false;
                                            userInput.inputControl = [];
                                            return -1;
                                        }
                                    };
                                }
                                else if(userInput.action && userInput.action==='click') {
                                    //log('not sure what to click');
                                }

                                if(foundTheCrawlDate) {
                                    break;
                                }
                            };
                        }
                        else {
                            let ui = userInput;
                            //let cnt = ui.tasks.length
                        }
                    }
                }
                
                break;
            case 'select':
                try
                {
                    if(typeof(userInput.value)==="string") {
                        let keyedValue = userInput.value;
                        if(userInput.value.indexOf('${')>-1) {
                            keyedValue = transformData(userInput.value, data);
                        }
                        //await objPage.click(userInput.selector);
                        if(userInput.selector) {
                            //log('1', userInput.selector);
                            //let inputControl = await objPage.$(userInput.selector).catch((reason)=> log(reason));
                            // let inputControl = await page.$(userInput.selector).catch((reason)=> log(reason));
                            // //let inputControl = await page.evaluate((selector) => document.querySelector(selector).click(), userInput.selector);
                            // if(inputControl && inputControl.click) {
                            //     await inputControl.click().catch(reason=> log(reason));
                            // }
                            
                            // await page.evaluate(function(ui) {
                            //     let element = document.querySelector(ui.selector);
                            //     if(element)
                            //         element.value='';
                                
                            // }, userInput).catch(reason => log(`E9 => ${reason}`));;

                            await page.select(userInput.selector, keyedValue).catch(reason => log(`Error in select : ${reason}`));
                        }
                        // await page.keyboard.type(keyedValue).catch(reason => log(`E11 => ${reason}`));
                        if(userInput.delayafter>-1)
                            delay = userInput.delayafter;
    
                        await page.waitFor(delay).catch(reason => log(`E12 => ${reason}`)); //400
                        //log(`performUserOperation ${userInput.action} KEY CODE SENT`, keyedValue);
                    }
                }
                catch(ex) {
                    log(ex);
                }
                break;                
            default:
                break;
        }
    }
    catch(fe) {
        log(fe);
        throw fe;
    }
    //log(`End of == performUserOperation ${userInput.action} starting`);
}

//this only happen for array kind of controls
async function getControl(page, uinput, idx, ctrls) {
    let inputControlItem = ctrls[idx];
    try
    {
        inputControlItem = await page.$$(uinput.selector).catch((reason)=> log(`41 - ${reason}`));
        if(inputControlItem!==undefined && inputControlItem!==null) {
            inputControlItem = inputControlItem[idx];
        }
    }
    catch(e) {
        log(e);
    }

    return inputControlItem;
}

/*helper method */
async function autoScroll(page){
    await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
            var totalHeight = 0;
            var distance = 100;
            var timer = setInterval(() => {
                var scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if(totalHeight >= scrollHeight){
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

async function autoScrollToHight(page, hightPercentage){
    await page.evaluate(async (hp) => {
        await new Promise((resolve, reject) => {
            var scrollHeight = 0;
            if(hp>0)
                scrollHeight = (document.body.scrollHeight/hp)*100;
            
            //console.log('Scrolling ...');
            if(hp>0)
                window.scrollBy(0, scrollHeight);
            else
                window.scrollTo(0, 0);

            resolve();
        });
    }, hightPercentage);
}

async function setProprtyItem(page, selector, property, value) {
    await page.evaluate(async (sel, prop, val) => {
        await new Promise((resolve, reject) => {
            try
            {
                let elm = document.querySelector(sel);
                if(elm)
                    elm.style.display = 'none';
                // if(elm) {
                //     elm.setProperty('style', 'display: none');
                // }
                //window.scrollBy(0, scrollHeight);
                resolve();
            }
            catch(eex) {
                reject(eex);
            }
        });
    }, selector, property, value);
}

/*end of helper */

async function performTask(objPage, userInput, inputControl, element, task, idx, runid, context) {
    var browser = context.browser;
    var page = context.page;
    var pageConfig = context.pageConfig;

    try
    {
        //log('Start performTask => ', idx, task.selector, task.action);
        //await page.waitFor(200).catch(reason => log(`E122 => ${reason}`));
        if(task && task.action) {
            if(task.action==='click') {
                try
                {
                    //log(typeof(element));
                    //let selector = task.selector || ((element && element._remoteObject) ? element._remoteObject.description : null);
                    //Right code
                    // await page.evaluate(() => {
                    //     document.querySelector(selector).scrollIntoView();
                    // });
                    let chkControl = null;
                    if(task!==null && task.selector!==null && task.selector!==undefined && task.selector!=="") {
                        //log('task.selector direct', task.selector);
                        pageLoaded = false;

                        let actionSelector = await page.$(task.selector).catch((reason)=> log(`Finding action selector in task failed - ${reason}`));
                        if(actionSelector == null) 
                            log(`Action selector in task ${task.selector} is null. So can't [click] it`);

                        await page.click(task.selector).catch(reason=> log('task.selector', reason));
                        //await page.waitFor(200);
                    }
                    else {
                        if(element.click) {
                            try
                            {
                                await element.click().catch((reason)=> {
                                    log('click error', reason);
                                });
                                await page.waitFor(200); //300
                            }
                            catch(ee1) {
                                log('element error', ee1);
                            }
                        }
                    }

                    //if((chkControl===null || chkControl===undefined) && task.checkselector!=='' && task.checkselector!==undefined && task.checkselector!==null) {
                    if(task.checkselector!=='' && task.checkselector!==undefined && task.checkselector!==null) {
                        
                        let selectedItem = await page.waitForSelector(task.checkselector, {timeout: TIMEOUT}).catch(async (reason) => {
                            log(`eclick - child - ${reason}`);
                            //await takeSnapshot('eclick-child');
                        });
                        if(selectedItem===null || selectedItem===undefined) {
                            selectedItem = await page.$(task.checkselector).catch(reason=> log('checkselector not found', reason));
                        }
                        //let selectedItem = await page.$(task.checkselector).catch(reason=> log('checkselector not found', reason));

                        if(selectedItem===undefined || selectedItem===null) {
                            userInput.exit = true;
                            userInput.inputControl = [];
                            return -1;
                        }
                    }
                }
                catch(eclick) {
                    log('eclick');
                    log(eclick);
                }
            }
            else if(task.action==='read') {
                let targetElement = element;
                let content = [];
                let storeData = getStore(context);
                if(task.read_type==='inner-text') {
                    try
                    {
                        //log('9', task.selector);
                        //await page.waitFor(500).catch(reason => log(`E22 => ${reason}`));
                        //let contentsElements = await page.$$(task.selector).catch((reason)=> log('Read content : ', reason));

                        // Scroll one viewport at a time, pausing to let content load
                        //right code for scrolling
                        
                        const bodyHandle = await page.$('body');
                        const { height } = await bodyHandle.boundingBox();
                        await bodyHandle.dispose();

                        //wrong code
                        await page.evaluate(_height => {
                            window.scrollTo(0, _height);
                        }, height);

                        //right code
                        // const viewportHeight = page.viewport().height;
                        // let viewportIncr = 0;
                        // while (viewportIncr + viewportHeight < height) {
                        //     await page.evaluate(_viewportHeight => {
                        //         window.scrollBy(0, _viewportHeight);
                        //     }, viewportHeight);
                        //     await page.waitFor(25);
                        //     viewportIncr = viewportIncr + viewportHeight;
                        // }
                        
                        //await page.waitFor(100);
                        await page.waitFor(50);

                        let contentsElements = await page.$$(task.selector).catch((reason)=> log('Read content : ', reason)).catch(reason => log(`E23 => ${reason}`));
                        for(var i=0; i<contentsElements.length; i++) {
                            let msg = await (await contentsElements[i].getProperty('innerText').catch((reason)=> {
                                log('Read inner text', reason);
                            })).jsonValue().catch((reason) => {
                                log('Read inner text json', reason);
                            });
                            content.push(msg);
                        }
                        
                        await page.waitFor(50);

                        //right code for scrolling
                        // Scroll back to top
                        await page.evaluate(_ => {
                            window.scrollTo(0, 0);
                        });

                        // Some extra delay to let images load
                        await page.waitFor(50);
                    }
                    catch(erd_txt) {
                        log('erd_txt');
                        log(erd_txt);
                    }
                }
                else if(task.read_type==='inner-html') {
                    try
                    {
                        //let content = await page.$eval(task.selector||userInput.selector); //targetElement._remoteObject.value;
                        content = await page.$eval(task.selector, e => e.innerHTML).catch(reason => log(`E24 => ${reason}`)); //targetElement._remoteObject.value;
                        //content = await page.$$eval(task.selector, e => e.innerHTML); //targetElement._remoteObject.value;
                        //log(content);
                    }
                    catch(erd_html) {
                        log('erd_html');
                        log(erd_html);
                    }
                }
                else if(task.read_type==='attributes') {
                    storeData.attributes = [];
                    //await page.waitFor(500).catch(reason => log(`E122 => ${reason}`));
                    let attrs = task.attributes?task.attributes:[];
                    let contentsElements = await page.$$(task.selector).catch((reason)=> log('Read content : ', reason)).catch(reason => log(`E123 => ${reason}`));
                    for(var i=0; i<contentsElements.length; i++) {
                        for(var i1=0; i1<attrs.length; i1++) {
                            let attrName = attrs[i1];
                            let attrValue = await (await contentsElements[i].getProperty(attrName).catch((reason)=> {
                                log('Read attr value', reason);
                            })).jsonValue().catch((reason) => {
                                log('Read attr value json', reason);
                            });

                            if(attrValue!==undefined && attrValue!==null && attrValue!=='') {
                                content.push({'name': attrName, 'value': attrValue});
                                storeData.attributes.push({'name': attrName, 'value': attrValue});
                            }
                        }
                    }
                }
                if(task.plugins!==null && task.plugins.length>0 && content!==null && content!=='')
                {
                    try
                    {
                        //log(`Executing plugins | Content length ${content.length}`);
                        for(var i=0; i<content.length; i++) {
                            let contentItem = content[i];
                            for(var iidx=0; iidx<task.plugins.length; iidx++) {
                                let plugin = task.plugins[iidx];
                            // task.plugins.forEach((plugin, iidx) => {
                                let parsedContent = null;
                                if(plugin.parser!==null && typeof(plugin.parser)==='function') {
                                    parsedContent = plugin.parser(contentItem, i, context);
                                    //log('Parsed Content: ', JSON.stringify(parsedContent));
                                    if(parsedContent===null) {
                                        userInput.exit = true;
                                        userInput.inputControl = [];
                                        return -1;
                                    }
                                }
                                if(plugin.assess!==null && typeof(plugin.assess)==='function') {
                                    //capturedData = plugin.assess(contentItem, parsedContent, capturedData);
                                    //getStore()
                                    plugin.assess(contentItem, parsedContent, storeData, runid, i, context, function(store) {
                                        if(store)
                                        {
                                            //capturedData = store;
                                            if(parsedContent!==undefined && parsedContent!==null 
                                                && parsedContent.flight!==null && parsedContent.flight!==undefined) 
                                            {
                                                log(`Data : ${JSON.stringify(parsedContent)}`);
                                            }
                                        }
                                    });
                                }
                            };
                        }
                        //log(`Executing plugins end ---`);
                    }
                    catch (ex1) {
                        log('ex1');
                        log(ex1);
                    }
                }
            }
        }
        //log('End performTask => ', idx, task);
    }
    catch(fe) {
        log('fe error');
        log(fe);
        throw(fe);
    }
    return 0;
}

//jshint ignore:end
////*[@id="04c6e90faac2675aa89e2176d2eec7d8-4ea1851c99601c376d6e040dd01aedc5dd40213b"]
//var stdin = process.openStdin();
//require('tty').setRawMode(true);

// var stdin = process.openStdin();
// if(stdin.isTTY) {
//     log('Keypress Event added');
//     stdin.on("keypress", function(chunk, key) {
//         log('Chunk : ' + chunk + "\n");
//         log('Key : ' + key + "\n");

//         if(key && (key.name=='c' || key.name=='C')) {
//             if(browser) {
//                 browser.close();
//             }
//         }
//     });
// }

var excutionStarted = false;
//"0 0 */6 * * *"
// cron.schedule("0 0 */6 * * *", function() {
//     log("Cron started");
//     if(excutionStarted) {
//         log('Previous process still running ...');
//         return false;
//     }

// payload = {
//     'sector': 'Bagdogra // Kolkata',
//     'date': '2022-03-10',
//     'transit_time': '02:00'
// };

async function searchByCrawl(payload) {
    try
    {
        excutionStarted = true;
        capturedData = {};
        process.on('unhandledRejection', (reason, promise) => {
            //log('Unhandled Rejection at:', reason.stack || reason);
            log('Unhandled Rejection at:', reason);
        });

        let runid = `${uuidv4()}_${moment().format("DD-MMM-YYYY HH:mm:ss.SSS")}`;
        //let crawlingUri = "https://www.neptunenext.com/agent/general/index";
        let crawlingUri = "https://airiq.in/Admin/Search.aspx";
        log(`Starting the crawl - ${runid}`);
        await ProcessActivity(crawlingUri, runid, payload).then(()=> {
            //what to do after the promise being called
            try
            {
                log('Process completed.');

                process.removeAllListeners("unhandledRejection");
                process.removeAllListeners('exit');
                process.removeAllListeners();
                //process.listeners("unhandledRejection").
            }
            catch(e) {
                log(e);
            }
            finally {
                //process.exit(0);
                excutionStarted = false;
            }
            return;
        }).catch((reason) => {
            log(`Error in searchByCrawl (1) : ${reason}`);
            log(`Error in searchByCrawl (2) : ${JSON.stringify(capturedData)}`);
            //log('Closing Browser');
            //page.waitFor(500);
            excutionStarted = false;
            //browser.close();
        }).finally(async () => {
            log('Process Activity finally called');
            excutionStarted = false;
            if(payload.browser) {
                let browser = payload.browser;
                await browser.close().then(() => {
                    log(`Browser closed (2)`);
                })
                .catch((reason) => log(`Browser close : ${reason}`));
            }
        })
    }
    catch(e) {
        log(e);
        excutionStarted = false;
    }
}

// });

// app.listen("3131");

async function search(req, res, next) {
    let payload = req.body || {
        'sector': '',
        'date': '',
        'transit_time': '',
        'tickets': []
    };

    await searchByCrawl(payload).then((value) => {
        log(`Search by crawl ${JSON.stringify(value)}`);
    })
    .catch((reason) => {
        log(`Error in search ${reason}`);
    });

    log('Done!');
    
    res.setHeader('Content-Type', 'application/json');
    res.json({
        status: true,
        message: 'Data saved to tickets table',
        data: {
            'sector': payload.sector,
            'date': payload.date,
            'transit_time': payload.transit_time,
            'tickets': payload.tickets
        }
    });
}

app.post('/api/search', search);

app.listen(PORT, () => {
    log(`Example app listening at http://localhost:${PORT}`);
});