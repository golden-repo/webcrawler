//jshint esversion:6
//const tty = require('tty');
const cron = require("node-cron");
const express = require("express");
const fs = require("fs");
const router = express.Router();

const uuidv4 = require('uuid/v4');
const puppeteer = require('puppeteer');
//const metadata = require('./metadata_airiq');
const delay = require('delay');
const moment = require('moment');
const fetch = require('isomorphic-fetch');
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

var timeFormatFn = function() {
    'use strict';
    return moment().format(cfg.timeFormat);
};

const TIMEOUT = 10000; //6000;
const POSTBACK_TIMEOUT = 12000; //8000
const POLLINGDELAY = 100;

var browser = null;
var page = null;
var pageConfig = null;
var capturedData = {};
//jshint ignore:start

var context = {};
var context_type = () => {

    var contextObj = function() {
        this._data = [];
        this.parameters = [];
    };

    contextObj.prototype.getContextData = function(key) {
        var data = null;
        if(this._data && Array.isArray(this._data)) {
            this._data.forEach((item_key, item_val) => {
                if(item_key.key == key) {
                    data = item_key.val;
                    // break;
                }
            });
        }

        return data;
    }

    contextObj.prototype.setContextData = function(key, val) {
        if (key === null || key === undefined) return -1;

        var item_val = this.getContextData(key);
        if(item_val === null || item_val === undefined) {
            this._data.push({key, val});
        }
        else {
            if(this._data && Array.isArray(this._data)) {
                this._data.forEach((item_key, item_val) => {
                    if(item_key.key == key) {
                        item_key.val = `${val}`;
                    }
                });
            }            
        }

        return this;
    }

    function init() {
        var ct = new contextObj();
        
        return ct;
    }

    return init();
};
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

let pageLoaded = true;

async function navigatePageV2(pageName) {
    try
    {
        //log('before launch of browser');
        browser = await puppeteer.launch(
            {
                headless:true,
                ignoreHTTPSErrors: true,
                ignoreDefaultArgs: ['--enable-automation'],
                args: ['--start-fullscreen','--no-sandbox','--disable-setuid-sandbox', '--disable-gpu'],
                timeout: 30000
                // args: ['--start-fullscreen']
            }).catch((reason) => {
                log(reason);
                return;
            });
        //const page = await browser.newPage();
        let pages = await browser.pages();
        page = pages.length>0?pages[0]:await browser.newPage();
        await page.setCacheEnabled(true);
        await page.setRequestInterception(true);

        //log('after new page created');
        await page.setViewport({ width: 1800, height: 1300});
        //log('after view port');
        /*page.setRequestInterception(true);
        page.on("load", interceptedRequest => {
            log("Load -> " + interceptedRequest.url());
        });*/
        //const response = await page.goto("https://github.com/login");
        //await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1");

        //await page.setUserAgent("Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.103 Safari/537.36");
        //await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1").catch((reason) => log(`Error in page.setUserAgent ${reason}`));
        log('user agent set');

        await page.setExtraHTTPHeaders({
            'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1',
            'upgrade-insecure-requests': '1',
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'en-US,en;q=0.9,en;q=0.8'
        })        

        log('Intercepting request ...');

        page.on('request', (req) => {
            let url = req.url().toLowerCase();
            if(req.resourceType() === 'stylesheet' || req.resourceType() === 'image' || req.resourceType() === 'font' || url.indexOf('fonts')>-1
             || url.indexOf('animate')>-1 || url.indexOf('des')>-1 || url.indexOf('tabs')>-1 || url.indexOf('css')>-1){
                //log('info', `Url Disallowed : ${url}`);
                req.abort();
            }
            else {
                //log(`Req.Type : ${req.resourceType()} - ${req.url()}`);
                //log('info', `Url Allowed : ${url}`);
                req.continue();
            }
        });

        page.on('domcontentloaded',()=> {
            log('dom even fired');
            console.log('domcontentloaded loaded');
            pageLoaded = true;
        });

        page.on('load',()=> {
            log('dom load even fired');
            console.log('load loaded');
            pageLoaded = true;
        });        
        
        //let response = await page.goto(pageName, {waitUntil:'load', timeout:30000}); //wait for 10 secs as timeout
        let response = await page.goto(pageName, {waitUntil:'load', timeout:30000}).catch(reason => {
            log(`Error goto => ${reason}`);
        }); //wait for 10 secs as timeout
        //log(await page.cookies());
        //await page.waitForNavigation();
        //log('after navigation done');
        //assumed page loaded

        page.hackyWaitForFunction = (predicate, opts = {}, isLoadedCtrl=false, chkControl=null) => {
            const start = new Date()
            const {timeout = 10000, polling = 10} = opts
        
            return new Promise((resolve, reject) => {
              const check = async () => {
                const result = await predicate();
                //console.log(`result => ${result}`);
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

        // pageConfig = metadata.pages.find(pg => {
        //     return response.url().indexOf(pg.name)>-1;
        // });

        //var actionItem = pageConfig.actions[0];

        //block image loading
    }
    catch(fe) {

    }
}

function init_context() {
    // this.context = context_type.call(this);
    this.context = context_type();
}

function getContext() {
    if(this.context === null || this.context === undefined) {
        init_context();
    }
    return this.context;
}

function hlp_get_passed_parameters(taskinfo, direction='') {
    var params = {};
    var drc = direction;
    if(direction === '') {
        drc = 'input';
    }
    taskinfo.parameters.forEach(parameter => {
        if(parameter && parameter.direction===drc) {
            if(parameter.sourcetype === 'value') {
                params[parameter.name] = parameter.value;
            } else if(parameter.sourcetype === 'variable') {
                params[parameter.name] = replaceVariable(parameter.value, getContext());
            }
        }
    });

    return params;
}

function getActionExecutor(context, action=null, task_info=null, callback) {
    if(task_info && task_info.name==='end') {
        return null;
    }

    var config = context.getContextData('runbook').config;
    var source = this;
    var taskinfo = {};
    var task_name = '';
    var task_prefix = 'tx';

    if(config && config.task_prefix) {
        task_prefix = config.task_prefix;
    }

    if(action) {
        if(action.codefile!==undefined && action.codefile!==null && action.codefile!=='') {
            source = require(action.codefile);
            log('info', `source of ${action.codefile} loaded`);
            if(source instanceof Object) {
                source = Object.create(source.prototype, {
                    context: {
                        writable: false,
                        configurable: true,
                        value: context,
                    },
                    parameters: {
                        writable: true,
                        configurable: true,
                        value: task_info.parameters,
                    },
                    config: {
                        writable: true,
                        configurable: true,
                        value: action,
                    },
                    page: {
                        writable: false,
                        configurable: false,
                        value: context.getContextData('page'),
                    },
                    log: {
                        writable: false,
                        configurable: false,
                        value: log,
                    },
                    input_parameters: {
                        writable: false,
                        configurable: false,
                        value: hlp_get_passed_parameters(task_info, 'input'),
                    },
                    output_parameters: {
                        writable: false,
                        configurable: false,
                        value: hlp_get_passed_parameters(task_info, 'output'),
                    }
                });
            }
        }

        if(task_info===null || task_info===undefined) {
            if(action.tasks && Array.isArray(action.tasks) && action.tasks.length>0) {
                taskinfo = action.tasks[0];
            }
        }
        else {
            taskinfo = task_info;
        }

        if(taskinfo && taskinfo.name) {
            task_name = `${task_prefix}_${taskinfo.name}`;
        }

        log('info', `Task Name (child method) => ${task_name}`);
    }

    return {sourceobj: source, executor: source[task_name], task_name};
}

function load_rb_config(tenantname='') {
    var rb_file_name = '';
    switch (tenantname) {
        case 'airtb':
            rb_file_name = './airtb_crawl_runbook.json';
            break;
        case 'airiq':
            rb_file_name = './airiqV2_crawl_runbook.json';
            break;
        case 'airiq:available-sectors':
            rb_file_name = './airiq_available-sectors_runbook.json';
            break;
        default:
            break;
    }

    return require(rb_file_name);
}

function replaceVariable(expr, context) {
    var vars = [];
    let i=0;
    let j=0;

    while ((j = expr.indexOf('${', i))>-1) {
        i++;
        const varName = expr.substr(j+2, (expr.indexOf('}', j)-(j+2)));
        if(varName && varName!=='') {
            const contatValue = context.getContextData(varName) || context.parameters[varName] || '';
            
            vars.push({key: varName, val: contatValue});

            if(expr.trim().length === ('${'+varName+'}').length) {
                expr = contatValue;
                break;
            } else {
                expr = expr.replace('${'+varName+'}', contatValue);
            }
        }
    }

    return expr;
}

function getNextActionTask(context, action = null, taskinfo = null) {
    var nxttaskinfo = null;
    if(taskinfo && action) {
        let evaluatedResult = false;
        for (let index = 0; ((index < taskinfo.connects.length) && (evaluatedResult === false)); index++) {
            evaluatedResult = false;
            const connect = taskinfo.connects[index];
            if(connect) {
                evaluatedResult = eval(replaceVariable(connect.expression, context));

                if(evaluatedResult === true) {
                    for (let index = 0; index < action.tasks.length; index++) {
                        const tsk = action.tasks[index];
                        if(tsk.id == connect.taskid) {
                            nxttaskinfo = tsk;
                            break;
                        }
                    }
                }
            }
        }
    }

    return nxttaskinfo;
}

async function ProcessActivityV2(targetUri, payload, runid=uuid5()) {
    var data = {};

    try
    {
        if(targetUri===undefined || targetUri===null || targetUri==="")
            return;

        var config_data = {};
        init_context();
        await navigatePageV2(targetUri);
        log('Page navigated...');
        if(browser!==null && page!==null) {
            log('URL -> ' + page.url());

            config_data = load_rb_config('airiq');
            let contextObj = getContext();
            contextObj.setContextData('targeturi', targetUri);
            contextObj.setContextData('browser', browser);
            contextObj.setContextData('page', page);
            contextObj.setContextData('runbook', config_data);
            contextObj.setContextData('payload', payload);

            for(pageIdx=0; pageIdx<config_data.pages.length; pageIdx++) {
                pageConfig = config_data.pages[pageIdx];
                contextObj.setContextData('pageconfig', pageConfig);

                for (let aindex = 0; aindex < pageConfig.actions.length; aindex++) {
                    const action = pageConfig.actions[aindex];
                    
                    var task_info = action.tasks[0];
                    // var action = pageConfig.actions[0];
                    var actionExecutorFinder = getActionExecutor(contextObj, action, task_info, (status) => {
                        log('info', status);
                    });

                    var task_name = actionExecutorFinder.task_name;
                    var source = actionExecutorFinder.sourceobj;
                    var actionExecutor = actionExecutorFinder.executor;
                    log('info', `Task Name : ${task_name}`);
    
                    while(actionExecutorFinder !== null) {
                        // actionExecutor.execute();
                        let result = await actionExecutor.call(source, task_info);
                        contextObj.setContextData('result', result);
                        if(Array.isArray(contextObj.parameters)) {
                            contextObj.parameters = source.output_parameters;
                        }
                        else {
                            contextObj.parameters = Object.assign(contextObj.parameters, source.output_parameters);
                        }

                        task_info = getNextActionTask(contextObj, action, task_info);
    
                        actionExecutorFinder = getActionExecutor(contextObj, action, task_info, (status) => {
                            log('info', status);
                        });

                        if(actionExecutorFinder) {
                            task_name = actionExecutorFinder.task_name;
                            source = actionExecutorFinder.sourceobj;
                            actionExecutor = actionExecutorFinder.executor;
                            log('info', `Next Task Name : ${task_name}`);
                        }
                    }
                }
            }

            data = contextObj.getContextData('responsePayload');
            log('info', `Execution completed`);
        }
    }
    catch(ex) {
        log(`Retrying once again.${ex}`);
    }

    if(data && Object.keys(data).length>0) {
        return data;
    }
    else {
        return null;
    }
}

async function ProcessActivityV3(targetUri, payload, extradata, runid=uuid5()) {
    var data = {};
    let workflowName = getContextValue(extradata, 'workflowName');

    try
    {
        if(targetUri===undefined || targetUri===null || targetUri==="")
            return;

        var config_data = {};
        init_context();
        await navigatePageV2(targetUri);
        log('Page navigated...');
        if(browser!==null && page!==null) {
            log('URL -> ' + page.url());

            config_data = load_rb_config(workflowName); //airiq
            let contextObj = getContext();
            contextObj.setContextData('targeturi', targetUri);
            contextObj.setContextData('browser', browser);
            contextObj.setContextData('page', page);
            contextObj.setContextData('runbook', config_data);
            contextObj.setContextData('payload', payload);

            for(pageIdx=0; pageIdx<config_data.pages.length; pageIdx++) {
                pageConfig = config_data.pages[pageIdx];
                contextObj.setContextData('pageconfig', pageConfig);

                for (let aindex = 0; aindex < pageConfig.actions.length; aindex++) {
                    const action = pageConfig.actions[aindex];
                    
                    var task_info = action.tasks[0];
                    // var action = pageConfig.actions[0];
                    var actionExecutorFinder = getActionExecutor(contextObj, action, task_info, (status) => {
                        log('info', status);
                    });

                    var task_name = actionExecutorFinder.task_name;
                    var source = actionExecutorFinder.sourceobj;
                    var actionExecutor = actionExecutorFinder.executor;
                    log('info', `Task Name : ${task_name}`);
    
                    while(actionExecutorFinder !== null) {
                        // actionExecutor.execute();
                        let result = await actionExecutor.call(source, task_info);
                        contextObj.setContextData('result', result);
                        if(Array.isArray(contextObj.parameters)) {
                            contextObj.parameters = source.output_parameters;
                        }
                        else {
                            contextObj.parameters = Object.assign(contextObj.parameters, source.output_parameters);
                        }

                        task_info = getNextActionTask(contextObj, action, task_info);
    
                        actionExecutorFinder = getActionExecutor(contextObj, action, task_info, (status) => {
                            log('info', status);
                        });

                        if(actionExecutorFinder) {
                            task_name = actionExecutorFinder.task_name;
                            source = actionExecutorFinder.sourceobj;
                            actionExecutor = actionExecutorFinder.executor;
                            log('info', `Next Task Name : ${task_name}`);
                        }
                    }
                }
            }

            data = contextObj.getContextData('responsePayload');
            log('info', `Execution completed`);
        }
    }
    catch(ex) {
        log(`Retrying once again.${ex}`);
    }
    finally
    {
        if(browser) {
            browser.close();
            log('Closing browser');
        }
    }

    if(data && Object.keys(data).length>0) {
        return data;
    }
    else {
        return null;
    }
}

function getContextValue(contextData, keyName) {
    if(contextData == null || contextData == undefined || contextData.length == 0) return null;
    let keyValue = null;

    for (let index = 0; index < contextData.length; index++) {
        const contextItem = contextData[index];
        if(contextItem.key == keyName) {
            keyValue = contextItem.value;
            break;
        }
    }

    return keyValue;
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
        let delay = 200; //300
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
                    let fn = userInput.value;
                    await page.keyboard.type(fn());
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
                        await page.click(userInput.selector).catch(reason => log(`E13 => ${reason}`));
                        //await page.waitFor(200);
                        if(userInput.haspostback!==undefined && userInput.haspostback!==null && userInput.haspostback) {
                            //log(`N03 : haspostback? ${userInput.selector}`);
                            if(!pageLoaded) {
                                //log(`N03 : ${pageLoaded}`); //domcontentloaded, load, networkidle0
                                await page.hackyWaitForFunction(async (isLoaded) => {
                                    //let time = new Date().toLocaleTimeString();
                                    //console.log(`${time} N03 checking isLoaded ${pageLoaded}`);
                                    //let chkControl = await page.$(userInput.checkselector).catch((reason)=> log(reason));
                                    //let chkControl = await page.$eval(userInput.checkselector, e => e.outerHTML).catch((reason)=> a=1);
                                    //return (pageLoaded || (chkControl!==null && chkControl!==undefined));
                                    return pageLoaded;
                                }, {polling: POLLINGDELAY, timeout: POSTBACK_TIMEOUT}, pageLoaded, userInput.checkselector).catch(async (reason) => { 
                                    log(`N03 = ${reason} - ${pageLoaded}`); 
                                    //await takeSnapshot('N03');
                                    chkControl = await page.$(userInput.checkselector).catch((reason)=> log(reason));
                                    if(chkControl===null || chkControl===undefined)
                                        await page.waitFor(1000); //Lets wait for another 1 sec and then proceed further. But this is exceptional case
                                });    

                                // await page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: POSTBACK_TIMEOUT}).catch(async (reason) => { 
                                //     log(`N03 = ${reason} - ${pageLoaded}`); 
                                //     await takeSnapshot('N03');
                                // });    
                            }
                        }
                        
                        if((chkControl===null || chkControl===undefined) && userInput.checkselector!=='' && userInput.checkselector!==null) {
                            try
                            {
                                await page.waitForSelector(userInput.checkselector, {timeout: TIMEOUT}).catch(async (reason) => {
                                    log(`E16 => ${reason}`)
                                    let chkSelector = await page.$(userInput.checkselector).catch((reason)=> log(`E16-DoubleCheck - ${reason}`));
                                    if(chkSelector===null || chkSelector===undefined)
                                    {
                                        await takeSnapshot('E16-DoubleCheck');
                                    }
                                });
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
                                        if(tsk.selector!==undefined && tsk.selector!==null && tsk.selector!=="" 
                                            && targetElement===null && targetElement===undefined) {
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
                                        //log("Going to perform Task", i, tsk.selector);
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
        if(typeof(uinput.selector)==='function') {
            inputControlItem = this.call(uinput.selector, uinput, idx, ctrls);
        }
        else {
            inputControlItem = await page.$$(uinput.selector).catch((reason)=> log(`41 - ${reason}`));
            if(inputControlItem!==undefined && inputControlItem!==null) {
                inputControlItem = inputControlItem[idx];
            }
        }
    }
    catch(e) {
        log(e);
    }

    return inputControlItem;
}

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
                    //Right code
                    // await page.evaluate(() => {
                    //     document.querySelector(selector).scrollIntoView();
                    // });
                    let chkControl = null;
                    if(task!==null && task.selector!==null && task.selector!==undefined && task.selector!=="") {
                        //log('task.selector direct', task.selector);
                        pageLoaded = false;
                        await page.click(task.selector).catch(reason=> log('task.selector', reason));
                        //await page.waitFor(200);
                        if(task.haspostback!==undefined && task.haspostback!==null && task.haspostback) {
                            //log(`N02 : haspostback? ${task.selector}`);
                            if(!pageLoaded) {
                                //log(`N02 : ${pageLoaded}`); //domcontentloaded, load, networkidle0
                                let previousLoadValue = pageLoaded;
                                await page.hackyWaitForFunction(async (isLoaded) => {
                                    // if(previousLoadValue!==pageLoaded) {
                                    //     let time = new Date().toLocaleTimeString();
                                    //     console.log(`${time} N02 checking isLoaded ${pageLoaded}`);
                                    // }
                                    //chkControl = await page.$(task.checkselector).catch((reason)=> log(reason));
                                    //chkControl = await page.$eval(task.checkselector, e => e.outerHTML).catch((reason)=> a=1);
                                    //return (pageLoaded || (chkControl!==null && chkControl!==undefined));
                                    return pageLoaded;
                                }, {polling: POLLINGDELAY, timeout: POSTBACK_TIMEOUT}, pageLoaded, task.checkselector).catch(async (reason) => { 
                                    log(`N02 = ${reason} - ${pageLoaded}`); 
                                    //await takeSnapshot('N02');
                                    // chkControl = await page.$(task.checkselector).catch((reason)=> log(reason));
                                    // if(chkControl===null || chkControl===undefined)
                                    await page.waitFor(1000); //Lets wait for another 1 sec and then proceed further. But this is exceptional case
                                });
                            }
                        }
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

                    if((chkControl===null || chkControl===undefined) && task.checkselector!=='' && task.checkselector!==undefined && task.checkselector!==null) {
                        
                        let selectedItem = await page.waitForSelector(task.checkselector, {timeout: TIMEOUT}).catch(async (reason) => {
                            log(`eclick - child - ${reason}`);
                            await takeSnapshot('eclick-child');
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
                let storeData = getStore();
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
                        for(var i=0; i<content.length; i++) {
                            let contentItem = content[i];
                            for(var iidx=0; iidx<task.plugins.length; iidx++) {
                                let plugin = task.plugins[iidx];
                            // task.plugins.forEach((plugin, iidx) => {
                                let parsedContent = null;
                                if(plugin.parser!==null && typeof(plugin.parser)==='function') {
                                    parsedContent = plugin.parser(contentItem, i, storeData, runid);
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
                                                && parsedContent.flight!==null && parsedContent.flight!==undefined) 
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

async function start() {
    try
    {
        excutionStarted = true;
        capturedData = {};
        process.on('unhandledRejection', (reason, promise) => {
            log('Unhandled Rejection at:', reason);
        });

        let runid = `${uuidv4()}_${moment().format("DD-MMM-YYYY HH:mm:ss.SSS")}`;
        let crawlingUri = "https://www.cheapfixdeparture.com/index.php";
        ProcessActivityV2(crawlingUri, runid).then(()=> {
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
            if(browser) {
                browser.close();
                log('Closing browser');
            }
            return;
        }).catch((reason) => {
            log(reason);
            log(JSON.stringify(capturedData));
            excutionStarted = false;
        });
    }
    catch(e) {
        log(e);
        excutionStarted = false;
    }
}

module.exports = {ProcessActivityV2, 'process':ProcessActivityV3};