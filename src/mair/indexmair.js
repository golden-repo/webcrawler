//In this program we will be logging into github and will be downloading specific file.

//jshint esversion:6
//const tty = require('tty');
const cron = require("node-cron");
const express = require("express");
const fs = require("fs");

const uuidv4 = require('uuid/v4');
const puppeteer = require('puppeteer');
const metadata = require('./metadata_mair');
const delay = require('delay');
const moment = require('moment');

const logger = require('../common/logger').Logger;

logger.init('mair');

// const winston = require('winston');
// const {combine, timestamp, label, printf} = winston.format;
// const DailyRotateFile = require('winston-daily-rotate-file');

// const myFormat = printf(({ level, message, label, timestamp }) => {
//     return `${timestamp} [${label}] ${level}: ${message}`;
// });

var timeFormatFn = function() {
    'use strict';
    return moment().format(cfg.timeFormat);
};

// winston.configure({
//     defaultMeta: {service: 'indexmair-crawler'},
//     format: combine(label({label: 'mair'}), timestamp(), myFormat),
//     transports:[
//        new winston.transports.File({filename: `mair_execution_log_${moment().format("D_M_YYYY")}.log`, })
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

// const TIMEOUT = 8000;
// const POSTBACK_TIMEOUT = 5000;
const TIMEOUT = 5000;
const POSTBACK_TIMEOUT = 8000;

var browser = null;
var page = null;
var pageConfig = null;
var capturedData = {};
//jshint ignore:start

function getStore() {
    if(capturedData) return capturedData;

    capturedData = {}

    return capturedData;
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
    try
    {
        log('before launch of browser');
        browser = await puppeteer.launch(
            {
                headless:true,
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
        //let response = await page.goto(pageName, {waitUntil:'load', timeout:30000}); //wait for 10 secs as timeout
        let response = await page.goto(pageName, {waitUntil:'load', timeout:40000}).catch(async (reason) => {
            log(`Navigation error : ${reason}`);
        }); 
        // let response = await page.goto(pageName, {waitUntil:['networkidle2', 'load']}).catch(async (reason) => {
        //     log(`Navigation error : ${reason}`);
        // }); 
        //wait for 10 secs as timeout
        //log('Response = ${response}');
        //log(await page.cookies());
        //await page.waitForNavigation();
        //takeSnapshot('After_pageload');
        log('after navigation done');
        //assumed page loaded
        pageConfig = metadata.pages.find(pg => {
            //return response.url().indexOf(pg.name)>-1;
            return pageName.indexOf(pg.name)>-1;
        });
        
        page.on('domcontentloaded',()=> {
            log('dom even fired');
            pageLoaded = true;
        });

        var actionItem = pageConfig.actions[0];
        
        page.hackyWaitForFunction = (predicate, opts = {}) => {
            const start = new Date()
            const {timeout = 10000, polling = 10} = opts
        
            return new Promise((resolve, reject) => {
                const check = async () => {
                    try
                    {
                        const result = await predicate();
                        //console.log(`result => ${result}`);
                        if (result) {
                            resolve(result);
                        } else if (new Date() - start > timeout) {
                            resolve('Timeout over');
                        } else {
                            setTimeout(check, polling);
                        }
                    }
                    catch(e) {
                        reject(e);
                    }
                }
                setTimeout(check, polling);
            });
        }

        //log(`Page Config : ${JSON.stringify(pageConfig)}`);

        await page.waitFor(5000).catch((reason) => { log(`Error -> ${reason}`)});
        log('Waited for 5secs more');

        for(var iidx=0; iidx<actionItem.userinputs.length; iidx++) {
            try
            {
                var val = actionItem.userinputs[iidx];
                var idx = iidx;

                //log(JSON.stringify(val) + ' - ' + idx);
                if(val.action==='keyed') {
                    // //log('Going to click');
                    // await page.click(val.selector).then(function(val1, val2) {
                    //     //log('Click finished');
                    // });
                    // //log('Clicked');
                    // await page.keyboard.type(val.value).then(function(val1, val2) {
                    //     //log('Key pressed');
                    // });
                    // //log('Keyed');
                    await page.type(val.selector, val.value, {delay: 20}).then((val1, val2) => {
                        log(`Text typed : ${val.selector} - ${val.value}`);
                    }).catch((reason) => log(`page.type Error : ${reason}`));
                }
                else if(val.action==='click') { 
                    pageLoaded = false;
                    //log(`Button clicking`);
                    await page.click(val.selector).catch((reason) => log(`page.click Error ${reason}`));
                    //log(`Button clicked`);
                    //await page.waitFor(200);
                    if(val.haspostback!==undefined && val.haspostback!==null && val.haspostback) {
                        //log(`N01 : haspostback? ${val.selector} - ${pageLoaded}`);
                        if(!pageLoaded) {
                            //log(`N01 : ${pageLoaded}`); //domcontentloaded, load, networkidle0
                            //takeSnapshot('After_login_pageload');
                            await page.hackyWaitForFunction((isLoaded) => {
                                let time = new Date().toLocaleTimeString();
                                //console.log(`${time} N01 checking isLoaded ${pageLoaded}`);
                                return pageLoaded;
                            }, {polling: 50, timeout: POSTBACK_TIMEOUT}, pageLoaded).catch(async (reason) => { 
                                log(`N01 = ${reason} - ${pageLoaded}`); 
                                //await takeSnapshot('N01');
                                await page.waitFor(1000).catch(reason => log(`page.waitFor Error : ${reason}`)); //Lets wait for another 1 sec and then proceed further. But this is exceptional case
                            });    

                            // await page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: POSTBACK_TIMEOUT}).catch(async (reason) => { 
                            //     log(`N01 = ${reason} - ${pageLoaded}`); 
                            //     await takeSnapshot('N01');
                            // });
                        }
                    }
                    //await page.waitFor(300);

                    if(val.checkselector!=='' && val.checkselector!==null) {
                        let elements = await page.$$(val.checkselector);
                        //log(`${val.checkselector} : ${JSON.stringify(elements)}`);
                        await page.waitForSelector(val.checkselector, {timeout: TIMEOUT}).catch(async (reason) => {
                            log(`ERR1 - TIMEOUT = ${TIMEOUT} - ${reason}`); 
                        });
                    }
                }
            }
            catch(err) {
                log('err1');
                log(err);
            }
        }
    }
    catch(fe) {
        log('fe');
        log(fe);
    }
}

async function ProcessActivity(targetUri, runid=uuid5()) {
    //await navigatePage("https://github.com/login");
    try
    {
        if(targetUri===undefined || targetUri===null || targetUri==="")
            return;

        await navigatePage(targetUri).catch((reason) => {
            log(`Error in navigation ${reason}`);
        });

        //takeSnapshot('After_navigating_out_login');
        if(browser!==null && page!==null) {
            //log('URL -> ' + page.url());
            log('Page navigated...');

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
                            await page.waitForSelector(pageConfig.actions[0].repeatsourceselector, {timeout: TIMEOUT}).catch(reason => log(`E1 => ${reason}`));
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
                            repeatsourceData = repeatsource(repeatsourceContent); //it should return array
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

                    //log(`repeatsourceType: ${repeatsourceType} | isrepeat: ${isrepeat}`);
                    //for(var i=0; i<loopCount; i++) { //
                    var i=0;
                    while(i<loopCount) {
                        let repeatsourceDataValue = (repeatsourceType==='array')?repeatsourceData[i]:'NA';

                        let src_dest = repeatsourceDataValue.match(/\w+/gi);
                        let key = '';
                        if(src_dest!==null && src_dest.length>1) {
                            key = (src_dest[0].trim() + '_' + src_dest[1].trim());
                            let storeData = getStore();
                            storeData[key]=[];
                        }

                        log(`${i} - ${repeatsourceDataValue} - ${loopCount}`);
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
                                
                                //log(`PageConfig : ${JSON.stringify(pageConfig)}`);
                                //this is the place we need to use repeat functionality
                                if(repeatsourceType===null) {
                                    log(`Perform user operation ${i} - ${userInput.action}`);
                                    await performUserOperation(page, userInput, null, i, runid).catch(reason => log(`E5 => ${reason}`));
                                    log(`Perform user operation ${i} - ${userInput.action} Done`);
                                }
                                else if(repeatsourceType==='number') {
                                    await performUserOperation(page, userInput, null, i, runid).catch(reason => log(`E6 => ${reason}`));
                                }
                                else if(repeatsourceType==='array') {
                                    try
                                    {
                                        //log(`Perform user operation ${i} - ${userInput.action}`);
                                        await performUserOperation(page, userInput, repeatsourceData[i], i, runid).catch(reason => log(`E7 => ${reason}`));
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
                        }
                        else {
                            //there is no user input. Kind of code cleaning process.
                            try
                            {
                                let storeObj = getStore();
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
                        // if(key==="" || key===undefined || key===null) {
                        //     key = Object.keys(getStore())[i-1];
                        // }
                        if(pageConfig.actions[0].userinputs.length>0) {
                            let keys = Object.keys(getStore());
                            for(var indx=0; indx<keys.length; indx++) {
                                try
                                {
                                    let keyName = keys[indx].trim();
                                    let impactedRows = await metadata.circlecrawlfinished(runid, getStore(), keyName, log);

                                    log(keyName, `Count => ${getStore()[keyName].length}`);
                                }
                                catch(eex) {
                                    log('Error', `Error (ProcessActivity) ${eex}`);
                                }
                            }
                            log(`Next operation ${i} starting`);
                        }
                    }
                }
            }

            await browser.close();
            log('Operation completed');
        }
    }
    catch(fe) {
        log(fe);
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

async function performUserOperation(objPage, userInput, data, ndx, runid, callback) {
    try
    {
        let delay = 200; //300 org: 200
        userInput = userInput || USERINPUT;
        var onError = false;
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
                            let innerText = await inputControl[idx].getProperty('text').catch(reason => log(`E12 => ${reason}`));
                            innerText = innerText._remoteObject.value;
                            let jsonValue = await inputControl[idx].jsonValue().catch(reason => log(`E13 => ${reason}`));
                            //log("Text -> "+innerText);
                            if(userInput.checkcontent!==null && 
                                userInput.checkcontent!=="" && 
                                innerText===userInput.checkcontent) 
                            {
                                inputControl = inputControl[idx];
                                break;
                            }
                            else {
                                inputControl = inputControl[0];
                                break;
                            }
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
                    if(!(inputControl instanceof Array)) {
                        // if(userInput.delaybefore>-1)
                        //     await page.waitFor(userInput.delaybefore).catch(reason => log(`E14 => ${reason}`));
                        pageLoaded = false;
                        await page.click(userInput.selector).catch(reason => log(`E13 => ${reason}`));
                        //await page.waitFor(200);
                        if(userInput.haspostback!==undefined && userInput.haspostback!==null && userInput.haspostback) {
                            //log(`N03 : haspostback? ${userInput.selector}`);
                            if(!pageLoaded) {
                                //log(`N03 : ${pageLoaded}`); //domcontentloaded, load, networkidle0
                                await page.hackyWaitForFunction((isLoaded) => {
                                    let time = new Date().toLocaleTimeString();
                                    //console.log(`${time} N03 checking isLoaded ${pageLoaded}`);
                                    return pageLoaded;
                                }, {polling: 50, timeout: POSTBACK_TIMEOUT}, pageLoaded).catch(async (reason) => { 
                                    log(`N03 = ${reason} - ${pageLoaded}`); 
                                    //await takeSnapshot('N03');
                                    await page.waitFor(1000); //Lets wait for another 1 sec and then proceed further. But this is exceptional case
                                });    

                                // await page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: POSTBACK_TIMEOUT}).catch(async (reason) => { 
                                //     log(`N03 = ${reason} - ${pageLoaded}`); 
                                //     await takeSnapshot('N03');
                                // });    
                            }
                        }
    
                        //await page.waitFor(300);

                        // if(userInput.delayafter>-1)
                        //     delay = userInput.delayafter;
                        // await page.waitFor(delay).catch(reason => log(`E15 => ${reason}`));

                        //page.waitForNavigation({ waitUntil: 'networkidle2' });

                        if(userInput.checkselector!=='' && userInput.checkselector!==null) {
                            try
                            {
                                await page.waitForSelector(userInput.checkselector, {timeout: TIMEOUT}).catch(reason => log(`E16 => ${reason}`));
                            }
                            catch(e2) {
                                log('e2');
                                log(e2);
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
                            for(var idx=0; idx<inputControl.length; idx++) {
                                //let ctrl = inputControl[idx];
                                let ctrl = await getControl(userInput, idx, inputControl).catch(reason => log(`E17 => ${reason}`));
                                //log(`Perform ${userInput.tasks.length} tasks`, `On ${inputControl.length} controls`, ctrl);
                                if(userInput.tasks!==null && userInput.tasks.length>0) {
                                    //userInput.tasks.forEach((tsk, i) => {
                                    //log("Array inputControl", idx, ctrl);
                                    //noprotect
                                    onError = false;
                                    for(var i=0; i<userInput.tasks.length; i++) {
                                        let tsk = userInput.tasks[i];
                                        //let targetElement = ctrl;
                                        let targetElement = await getControl(userInput, idx, inputControl).catch(reason => log(`E17.1 => ${reason}`));
                                        if(tsk.selector!==undefined && tsk.selector!==null && tsk.selector!=="") {
                                            //log('Selector : ' + tsk.selector);
                                            if(tsk.selector!=='' && tsk.selector!==null) {
                                                onError = false;
                                                try
                                                {
                                                    await page.waitForSelector(tsk.selector, {timeout: TIMEOUT}).catch(reason => log(`E18 => ${reason}`));
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
                                        }
                                        //log("Going to perform Task", i);
                                        let returnValue = await performTask(objPage, userInput, inputControl, targetElement, tsk, i, runid).catch(reason => log(`E20 => ${reason}`));
                                        //log("Task done", tsk, i);
                                        await page.waitFor(200).catch(reason => log(`E21 => ${reason}`)); //delay to get UI refreshed with json data
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
                            };
                        }
                        else {
                            let ui = userInput;
                            //let cnt = ui.tasks.length
                        }
                    }
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
async function getControl(uinput, idx, ctrls) {
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

async function performTask(objPage, userInput, inputControl, element, task, idx, runid) {
    try
    {
        //log('Start performTask => ', idx, task.selector, task.action);
        await page.waitFor(200).catch(reason => log(`E122 => ${reason}`));
        if(task && task.action) {
            if(task.action==='click') {
                try
                {
                    //log(typeof(element));
                    let selector = task.selector || element._remoteObject.description;
                    //log(`performTask Section : ${selector}`);
                    //Right code
                    // await page.evaluate(() => {
                    //     document.querySelector(selector).scrollIntoView();
                    // });
                    if(task!==null && task.selector!==null && task.selector!==undefined && task.selector!=="") {
                        //log('task.selector direct', task.selector);
                        pageLoaded = false;
                        await page.click(task.selector).catch(reason=> log('task.selector', reason));
                        //await page.waitFor(200);
                    }
                    else {
                        if(element.click) {
                            try
                            {
                                pageLoaded = false;
                                await element.click().catch((reason)=> {
                                    log('click error', reason);
                                });
                                //await page.waitFor(200); //300
                            }
                            catch(ee1) {
                                log('element error', ee1);
                            }
                        }
                    }

                    if(task.haspostback!==undefined && task.haspostback!==null && task.haspostback) {
                        //log(`N02 : haspostback? ${task.selector}`);
                        let delay = task.postbackdelay || POSTBACK_TIMEOUT;
                        //log(`Delay = ${delay}`);
                        if(!pageLoaded) {
                            //log(`N02 : ${pageLoaded}`); //domcontentloaded, load, networkidle0
                            await page.hackyWaitForFunction((isLoaded) => {
                                let time = new Date().toLocaleTimeString();
                                //console.log(`${time} N02 checking isLoaded ${pageLoaded}`);
                                return pageLoaded;
                            }, {polling: 50, timeout: delay}, pageLoaded).catch(async (reason) => { 
                                log(`N02 = ${reason} - ${pageLoaded}`); 
                                //await takeSnapshot('N02');
                                await page.waitFor(1000); //Lets wait for another 1 sec and then proceed further. But this is exceptional case
                            });    
                        }
                    }

                    if(task.checkselector!=='' && task.checkselector!==undefined && task.checkselector!==null) {
                        //let selectedItem = await page.$(task.checkselector).catch(reason=> log('checkselector not found', reason));
                        let selectedItem = await page.waitForSelector(task.checkselector, {timeout: TIMEOUT}).catch(async (reason) => {
                            log(`eclick - child - ${reason}`);
                            await takeSnapshot('eclick-child');
                        });

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
                let storeData = getStore();
                if(task.read_type==='inner-text') {
                    try
                    {
                        //log('9', task.selector);
                        //await page.waitFor(500).catch(reason => log(`E22 => ${reason}`));
                        //let contentsElements = await page.$$(task.selector).catch((reason)=> log('Read content : ', reason));

                        // Scroll one viewport at a time, pausing to let content load
                        const bodyHandle = await page.$('body');
                        const { height } = await bodyHandle.boundingBox();
                        await bodyHandle.dispose();

                        // const viewportHeight = page.viewport().height;
                        // let viewportIncr = 0;
                        // while (viewportIncr + viewportHeight < height) {
                        //     await page.evaluate(_viewportHeight => {
                        //         window.scrollBy(0, _viewportHeight);
                        //     }, viewportHeight);
                        //     await page.waitFor(25);
                        //     viewportIncr = viewportIncr + viewportHeight;
                        // }
                        
                        await page.waitFor(100);

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

                        // Scroll back to top
                        // await page.evaluate(_ => {
                        //     window.scrollTo(0, 0);
                        // });

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
                        for(var i=0; i<content.length; i++) {
                            let contentItem = content[i];
                            for(var iidx=0; iidx<task.plugins.length; iidx++) {
                                let plugin = task.plugins[iidx];
                            // task.plugins.forEach((plugin, iidx) => {
                                let parsedContent = null;
                                if(plugin.parser!==null && typeof(plugin.parser)==='function') {
                                    parsedContent = plugin.parser(contentItem, i);
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
                                    plugin.assess(contentItem, parsedContent, storeData, runid, i, function(store) {
                                        if(store)
                                        {
                                            //capturedData = store;
                                            if(parsedContent!==undefined && parsedContent!==null 
                                                && parsedContent.length>0) 
                                            {
                                                log(`Data : ${JSON.stringify(parsedContent)}`);
                                            }
                                        }
                                    });
                                }
                            };
                        }
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
cron.schedule("*/5 * * * *", function() {
    log("Cron started");
    if(excutionStarted) {
        log('Previous process still running ...');
        return false;
    }

    try
    {
        excutionStarted = true;
        capturedData = {};

        process.on('uncaughtExceptionMonitor', (err, origin) => {
            // MyMonitoringTool.logSync(err, origin);
            log(`Unhandled exception : Error : ${JSON.stringify(err)} | Origin : ${origin}`);
        });        

        process.on('unhandledRejection', (reason, promise) => {
            //log('Unhandled Rejection at:', reason.stack || reason);
            log('Unhandled Rejection at:', reason);
            // Recommended: send the information to sentry.io
            // or whatever crash reporting service you use
        });

        let runid = `${uuidv4()}_${moment().format("DD-MMM-YYYY HH:mm:ss.SSS")}`;
        //let crawlingUri = "https://www.neptunenext.com/agent/general/index";
        //let crawlingUri = "https://airiq.in/Admin/Search.aspx";
        //let crawlingUri = "http://www.makeourholiday.com/AgentLogin.aspx";
        let crawlingUri = "http://www.mittalair.com/AgentLogin.aspx";
        log(`Starting the crawl - ${runid}`);
        
        ProcessActivity(crawlingUri, runid).then(()=> {
            //what to do after the promise being called
            try
            {
                log('Process completed.');

                //log(JSON.stringify(capturedData));
                //log('Closing Browser');
                //page.waitFor(500);
                // browser.close();
                //console.log(process._getActiveRequests());
                //console.log(process._getActiveHandles());
                // process.listeners.map((listn, idx) => {
                //     console.log(listn);
                // });

                process.removeAllListeners("unhandledRejection");
                // process.removeAllListeners('exit');
                // process.removeAllListeners();
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
            log(reason);
            log(JSON.stringify(capturedData));
            //log('Closing Browser');
            //page.waitFor(500);
            excutionStarted = false;
            //browser.close();
        }).finally(() => {
            log('Process Activity finally called');
            excutionStarted = false;
        });
    }
    catch(e) {
        log(e);
        excutionStarted = false;
    }
});

app.listen("5134");