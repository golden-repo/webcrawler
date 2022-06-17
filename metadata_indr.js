//jshint esversion: 6
var colors = require('colors');
const moment = require('moment');

const ALLOWPERSIST = true;

//helper methods
function repeatSource(elementData) {
    var data = [];
    //repeatsource could be number like 10 times.
    //repeatsource could be array of fixed data.
    //repeatsource could be function which will prepare data for iteration
    try
    {
        elementData = elementData.trim();
        let strreg = /^\w+( - )\w+$/gm;
        data = elementData.match(strreg).map((val, idx) => val.replace(' - ',' / '));
    }
    catch(e) {
        console.log(e);
    }

    return data;
}

function parseContent(content, idx, store, runid,) {
    //console.log(`Data : \n${content}`);
    let contentItem = contentParser(content, store, runid);
    //console.log(`Data : ${JSON.stringify(contentItem)}`);
    // if(content.indexOf('Seats Available, Please send offline request')>-1 ||
    //     content.indexOf('On Request')>-1) 

    if(content.indexOf('Please send offline request')>-1) 
    {
        contentItem=null;
    }
    return contentItem;
}

function contentParser(content, store, runid) {
    let deal = {};

    try
    {
        //let src_dest = content.match(/([a-zA-Z0-9-:]*)([^\s])/gm);
        let src_dest = content.trim().split('\t');
        let disp_date = null;
        let rate = 0.00;
        let qty = 0;
        let flight_number = '';
        let start_date = '';
        let start_time = '';
        let end_date = '';
        let end_time = '';
        let source = '';
        let destination = '';
        deal.ticket_type = 'Economy';
        for (let index = 0; index < src_dest.length; index++) {
            const data = src_dest[index];
            let date_part = '';

            switch (index) {
                case 0:
                    deal.flight = data.trim();
                case 2:
                    deal.flight_number = data.trim();
                case 3:
                    source = data.trim();
                    break;
                case 4:
                    destination = data.trim();
                    break;
                case 5:
                    date_part = data.trim().split(' ');
                    start_date = date_part[0].trim(); // data.trim();
                    start_time = date_part[1].trim(); // data.trim();
                    break;
                case 6:
                    date_part = data.trim().split(' ');
                    end_date = date_part[0].trim(); // data.trim();
                    end_time = date_part[1].trim(); // data.trim();
                    break;
                // case 6:
                //     end_date = data.trim();
                //     break;
                // case 7:
                //     end_time = data.trim();
                //     break;
                case 7:
                    qty = parseInt(data.trim(), 10);
                    break;
                case 8:
                    rate = parseFloat(data.trim());
                    break;
                default:
                    break;
            }
        }
        //deal.flight_number = flight_number;
        let arrvEpoch = Date.parse(`${end_date} ${end_time}`);

        deal.ticket_type = 'Economy';
        deal.departure = {'circle': source, 'date': start_date, 'time': start_time, 'epoch_date': Date.parse(`${start_date} ${start_time}`)};

        if(isNaN(arrvEpoch)) {
            deal.arrival = {'circle': destination, 'date': start_date, 'time': end_time, 'epoch_date': Date.parse(`${start_date} ${end_time}`)};
        }
        else {
            deal.arrival = {'circle': destination, 'date': end_date, 'time': end_time, 'epoch_date': Date.parse(`${end_date} ${end_time}`)};
        }

        deal.availability = qty;
        deal.price = rate;
    }
    catch(e) {
        console.log(e)
    }

    return deal;
}

function contentParserold(content) {
    let deal = {};

    try
    {
        //get class value
        let src_dest = content.match(/\((.*?)\)/gm);
        if(src_dest!==null && src_dest!==undefined && src_dest.length>0) {
            let classValue = `Class (${src_dest[0].replace('(','').replace(')','')})`;
            deal.flight = classValue;
            deal.flight_number = 'AIQ-000';
            deal.ticket_type = 'Economy';
        }
        else {
            deal.flight = '';
            deal.flight_number = 'AIQ-000';
            deal.ticket_type = 'Economy';
        }

        //capture circle value;
        src_dest = content.match(/(([a-zA-Z].*)\s\/\/\s([a-zA-Z].*))/gm);
        if(src_dest!==null && src_dest!==undefined && src_dest.length>0) {
            let circle = src_dest[0].split('//');
            if(circle.length>1) {
                deal.departure = {"circle": circle[0].trim()};
                deal.arrival = {"circle": circle[1].trim()};
            }
        }
        else {
            deal.departure = {"circle": ''};
            deal.arrival = {"circle": ''};
        }

        //Date time
        src_dest = content.match(/([0-9]{2})\s([a-zA-Z]{3})\s([0-9]{4})|([0-9]{0,2}:[0-9]{0,2})/gm);
        if(src_dest!==null && src_dest!==undefined && src_dest.length>0) {
            let date = src_dest[0].trim(); //src_dest[0].replace(' ','/');
            let time = src_dest[1].trim();

            //console.log(`${date} - ${time}`);
            deal.departure = {"circle": deal.departure.circle, "date": date, "time": time, epoch_date: Date.parse(`${date} ${time}:00.000`)}; //+05:30
            deal.arrival = {"circle": deal.arrival.circle, "date": date, "time": time, epoch_date: Date.parse(`${date} ${time}:00.000`)}; //+05:30
        }    
        else {
            deal.departure = {"circle": deal.departure.circle, "date": '', "time": '', epoch_date: new Date()};
            deal.arrival = {"circle": deal.arrival.circle, "date": '', "time": '', epoch_date: new Date()};
        }

        //Availability
        // src_dest = content.match(/^(\d+?([0-9]{0,2}))$/gm);
        // ^(\d+?([0-9]{0,2}))([+]{0,1})\s+$
        src_dest = content.match(/^(\d+?([0-9]{0,2}))([+]{0,1})\s+$/gm);
        
        if(src_dest!==null && src_dest!==undefined && src_dest.length>0) {
            let qty = parseInt(src_dest[0].trim());

            deal.availability = qty;
        }
        else {
            deal.availability = -1;
        }

        //Price
        src_dest = content.match(/((AQP)\d+)/gm);
        if(src_dest!==null && src_dest!==undefined && src_dest.length>0) {
            //console.log(src_dest[0].replace('AQP','').trim());
            let price = parseFloat(src_dest[0].replace('AQP','').trim());

            deal.price = price;
        }
        else {
            deal.price = -1;
        }
    }
    catch(e) {
        console.log(e);
    }

    return deal;
}

function assessContent(rawContent, parsedContent, store, runid, idx, callback) {
    let key = null;

    if(parsedContent.availability===-1) { //data not present
        return parsedContent;
    }
    //console.log(`Assess: ${JSON.stringify(parsedContent)}`);

    key = `${parsedContent.departure.circle}_${parsedContent.arrival.circle}`;
    if(store[key]===undefined || store[key]===null) {
        store[key] = [];
    }


    if(store!==undefined && store!==null && store[key]!==undefined && store[key]!==null && store[key] instanceof Array) {
        parsedContent.runid = runid;
        if(store.attributes!==undefined && store.attributes!==null && store.attributes.length) {
            let attrValue = store.attributes[idx].value;
            let recid = parseInt(attrValue.match(/\d+/gm));

            parsedContent.recid = recid;
        }
        else {
            parsedContent.recid = -1;
        }

        let iidx = store[key].findIndex((obj, ndx) => {
            return obj.recid === parsedContent.recid;
        });

        if(iidx===-1) {
            store[key].push(parsedContent);
        }
    }

    //console.log(`Data : ${JSON.stringify(parsedContent)}`);
    if(callback) {
        callback(store);
    }

    return parsedContent;
}

/*
function dataParser(content) {
    let deal = {};
    //console.log(content);
    //let src_dest = content.match(/(\w+\s[0-9]{2}:[0-9]{2}|[0-9]{2}\s\w+\s[0-9]{4})|(\w+\s-\s\w+\s([A-Z0-9])\w+(\w+:\s[0-9]{0,2}))/gm);
    //let src_dest = content.match(/(^\w+)|((Flight.*)([0-9,]){1,8})|(\w+\s[0-9]{2}:[0-9]{2}|[0-9]{2}\s\w+\s[0-9]{4})|(\w+\s-\s\w+\s([A-Z0-9])\w+(\w+:\s[0-9]{0,2}))/gm);
    let lines = content.split('\n');
    if(lines!==null && lines.length>0) {
        deal.flight = lines[1].trim();
    }
    let src_dest = content.match(/([0-9]{1,5}-[0-9]{1,5})|((Flight.*)([0-9,]){1,8})|(\w+\s[0-9]{2}:[0-9]{2}|[0-9]{2}\s\w+\s[0-9]{4})|(\w+\s-\s\w+\s([A-Z0-9])\w+(\w+:\s[0-9]{0,2}))/g);
    
    if(src_dest.length>6) {
        deal.flight_number = src_dest[0].trim();
        let departure = src_dest[1].split(' ');
        if(departure!==null && departure.length>0) {
            deal.departure = {
                circle: departure[0],
                time: departure[1],
                date: src_dest[2],
                epoch_date: Date.parse(`${src_dest[2]} ${departure[1]}:00.000`)
            };
        }

        let arrival = src_dest[3].split(' ');
        if(arrival!==null && arrival.length>0) {
            deal.arrival = {
                circle: arrival[0],
                time: arrival[1],
                date: src_dest[4],
                epoch_date: Date.parse(`${src_dest[4]} ${arrival[1]}:00.000`)
            };
        }

        let seat_details = src_dest[5];
        if(seat_details!==null) {
            let parts = seat_details.match(/([^-:])\w+/gm);
            if(parts!==null && parts.length>3) {
                deal.ticket_type = parts[0].trim();
                deal.availability = parseInt(parts[3].trim());
            }
        }

        let pricingText = src_dest[6];
        if(pricingText!==null) {
            let price = pricingText.match(/([0-9,]){1,8}/gm);
            if(price!==null && price.length>0) {
                deal.price = parseInt(price[0].trim().replace(',',''));
            }
        }
    }

    return {condition: 'good', completion: 'good', result: deal};
}
*/

function assessor(content, result, store, runid, callback) {
    let key = `${result.result.departure.circle}_${result.result.arrival.circle}`;
    if(store[key]===undefined || store[key]===null) {
        store[key] = [];
    }

    let rslt = result.result;
    let existingIndex = store[key].findIndex(x => x.flight === rslt.flight && 
        x.departure.circle === rslt.departure.circle && 
        x.arrival.circle === rslt.arrival.circle && 
        x.departure.epoch_date === rslt.departure.epoch_date && 
        x.arrival.epoch_date === rslt.arrival.epoch_date && 
        x.ticket_type === rslt.ticket_type);

    // if(existingIndex>-1) {
    //     console.log(`Record already exists ${existingIndex} - ${JSON.stringify(rslt)}in list not adding to list`);
    // }
    //console.log(JSON.stringify(result.result));
    if(existingIndex===-1) {
        store[key].push(result.result);

        //console.log(JSON.stringify(result.result));
        if(ALLOWPERSIST) {
            try {
                this.persistData(result.result, runid, function(returnVal) {
                    if(callback)
                        callback(store);
                });
            }
            catch(ee1) {
                console.log('ee1');
                console.log(ee1);
            }
        }
        else {
            if(callback)
                callback(store);
        }
    }
    else {
        //console.log(`Record already exists ${existingIndex} - ${JSON.stringify(rslt)}in list not adding to list`.red);
        if(callback)
            callback(store);
    }
}

function persistDataItem(result, runid, callback) {
    //const datastore = require('./radharani/datastore');
    const datastore = require('./radharani/indrdatastore');

    datastore.saveData(result, runid, function(data) {
        //console.log(`Proceed with next record ${JSON.stringify(data)}`);
        if(callback) callback(data);
    });
}

function finalizeData(runid, datasourceUrl) {
    //const datastore = require('./radharani/datastore');
    const datastore = require('./radharani/indrdatastore');
    // const datasource = require(datasourceUrl);

    try
    {
        datastore.finalization(runid);

        // datastore.finalization(runid, function(data) {
        //     console.log(`Proceed with next record ${JSON.stringify(data)}`);
        //     //callback(data);
        // });
    }
    catch(e3) {
        console.log(e3);
    }
}

function circleCrawlingFinished(runid, store, circleKey, callback) {
    return new Promise(async (resolve, reject) => {
        const datastore = require('./radharani/indrdatastore');

        try
        {
            //console.log('circleCrawlingFinished called');
            // if(circleKey===null || circleKey===undefined || circleKey==="") return -1;
            // if(store[circleKey]===null || store[circleKey]===undefined || !(store[circleKey] instanceof Array)) return -1;
            if(store['attributes']!==undefined) {
                delete store['attributes'];
            }
    
            let key_count = Object.keys(store).length;
            //console.log('going to call saveCircleBatchData');
            if(Object.keys(store).length>0) {
                //Object.keys(store).forEach(async key => {
                for (let index = 0; index < Object.keys(store).length; index++) {
                    const key = Object.keys(store)[index];
                    try
                    {
                        circleKey = key;
        
                        let targetRunId = runid;
                        let circleData = await datastore.saveCircleBatchData(runid, store[circleKey], circleKey);
                        try
                        {
                            if(targetRunId!==null && targetRunId!==undefined && circleData.length>0) {
                                let deptId = circleData[0].departure.id;
                                let arrvId = circleData[0].arrival.id;
                                let records = circleData.length;
                                //let cdata = circleData;
                                //updatedRecs = store[circleKey];
                                let status = await datastore.updateExhaustedCircleInventory(runid, deptId, arrvId);
                                if(status!==null && status!==undefined) {
                                    let msg = `Clear exhausted inventory [${circleData[0].departure.circle}-${circleData[0].arrival.circle} -> ${records}] ${status.affectedRows} - ${status.message})`;
                                    console.log(msg);
                                    --key_count;

                                    if(key_count===0) {
                                        resolve('All circle processed');
                                    }
                                    // if(callback) {
                                    //     callback(msg);
                                    // }
                                }
                            }
                        }
                        catch(eex1) {
                            console.log(`Error in circleCrawlingFinished:saveCircleBatchData : ${eex1}`);
                            return reject(eex1);
                        }
                    }
                    catch(ex1) {
                        console.log(`Error in circleCrawlingFinished:forEach : ${ex1}`);
                        return reject(ex1);
                        // console.log(ex1);
                    }
                };

                //datastore.dispose();
            }
            else {
                let msg = 'No data available to update';
                console.log(msg);
                resolve(msg);
            }
        }
        catch(e3) {
            console.log(e3);
            return reject(e3);
        }
    });
}

/*
function circleCrawlingFinished(runid, store, circleKey, callback) {
    return new Promise((resolve, reject) => {
        const datastore = require('./radharani/indrdatastore');

        try
        {
            //console.log('circleCrawlingFinished called');
            // if(circleKey===null || circleKey===undefined || circleKey==="") return -1;
            // if(store[circleKey]===null || store[circleKey]===undefined || !(store[circleKey] instanceof Array)) return -1;
            if(store['attributes']!==undefined) {
                delete store['attributes'];
            }
    
            let key_count = Object.keys(store).length;
            //console.log('going to call saveCircleBatchData');
            if(Object.keys(store).length>0) {
                Object.keys(store).forEach(key => {
                    try
                    {
                        circleKey = key;
        
                        let targetRunId = runid;
                        let returnValue = datastore.saveCircleBatchData(runid, store[circleKey], circleKey, function(circleData) {
                            try
                            {
                                if(targetRunId!==null && targetRunId!==undefined && circleData.length>0) {
                                    let deptId = circleData[0].departure.id;
                                    let arrvId = circleData[0].arrival.id;
                                    let records = circleData.length;
                                    //let cdata = circleData;
                                    //updatedRecs = store[circleKey];
                                    let clearEmptyStock = datastore.updateExhaustedCircleInventory(runid, deptId, arrvId, function(status) {
                                        if(status!==null && status!==undefined) {
                                            let msg = `Clear exhausted inventory [${circleData[0].departure.circle}-${circleData[0].arrival.circle} -> ${records}] ${status.affectedRows} - ${status.message})`;
                                            console.log(msg);
                                            --key_count;

                                            if(key_count===0) {
                                                resolve('All circle processed');
                                            }
                                            // if(callback) {
                                            //     callback(msg);
                                            // }
                                        }
                                    });
                                }
                            }
                            catch(eex1) {
                                console.log(`Error in circleCrawlingFinished:saveCircleBatchData : ${eex1}`);
                                return reject(eex1);
                            }
                        });
                    }
                    catch(ex1) {
                        console.log(`Error in circleCrawlingFinished:forEach : ${ex1}`);
                        return reject(ex1);
                        // console.log(ex1);
                    }
                });
            }
            else {
                let msg = 'No data available to update';
                console.log(msg);
                resolve(msg);
            }
        }
        catch(e3) {
            console.log(e3);
            return reject(e3);
        }
    });
}
*/

module.exports = {
    circlecrawlfinished: circleCrawlingFinished,
    pages: [
        {
            id: 1,
            name: 'Signin',
            actions: [
                {
                    name: 'Signin',
                    type: 'authentication',
                    userinputs: [
                        {
                            id: 1,
                            controlid: '',
                            selector: '#formsignin > div > input[name="username"]',
                            checkcontent: '',
                            type: 'textbox',
                            value: '9800412356',
                            action: 'keyed',
                            checkselector: ''
                        },
                        {
                            id: 2,
                            controlid: '',
                            selector: '#formsignin > div > input[name="password"]',
                            checkcontent: '',
                            type: 'textbox',
                            value: 'Sumit@12356',
                            action: 'keyed',
                            checkselector: ''
                        },
                        {
                            id: 3,
                            controlid: '',
                            selector: '#formsignin > div > div > button[name="loginsubmit"]',
                            checkcontent: '',
                            type: 'button',
                            value: '',
                            action: 'click',
                            haspostback: true,
                            checkselector: 'body > div > div.content-wrapper > section:nth-child(3) > div > div > div > table > tbody'
                        }
                    ]
                }
            ]
        },
        {
            id: 3,
            name: 'index',
            actions: [
                {
                    name: 'index',
                    type: 'code',
                    repeat: false,
                    repeatsourceselector: '', /*#ctl00_mainbody_Panel1 > div > .ChngColor > a > span*/
                    repeatsourceContentType: 'text',
                    repeatsource: '',
                    userinputs: [
                        {
                            id: 5,
                            controlid: '',
                            selector: 'body > div > div.content-wrapper > section:nth-child(3) > div > div > div > table > tbody > tr:nth-child(1)',
                            isarray: true,
                            checkcontent: '',
                            type: '',
                            value: ``,
                            action: 'click',
                            checkselector: '',
                            tasks: [
                                {
                                    task_id: 1,
                                    task_name: 'read content',
                                    action: 'read',
                                    selector: `body > div > div.content-wrapper > section:nth-child(3) > div > div > div > table > tbody > tr > td:nth-last-child(-n+1) > a`,
                                    read_type: 'attributes',
                                    attributes: ['href'],
                                    plugins: [
                                        {
                                            parser: function(content) {
                                                //.flit-detls tr .tble_item1_txt>input[type=hidden i]
                                                //console.log(`attr value - ${JSON.stringify(content)}`);
                                                if(content !== null && content !== undefined) {
                                                    let value = content.value;
                                                    if(value !== null && value !== undefined && value !== '') {
                                                        content.value = value.substring(value.indexOf('id=')+3);
                                                    }
                                                    //content.indexOf('id=')>-1
                                                    //content = content.substring(content.indexOf('id=')+3);
                                                }
                                                return content;
                                            },
                                            assess: function(contentItem, parsedContent, store, runid, idx, callback) {
                                                if(callback) {
                                                    callback(store);
                                                }
                                                //return parsedContent;
                                            },
                                            persistData: function() { }
                                        }
                                    ]
                                },
                                {
                                    task_id: 2,
                                    task_name: 'read content',
                                    action: 'read',
                                    selector: `body > div > div.content-wrapper > section:nth-child(3) > div > div > div > table > tbody > tr`, /*.flit-detls*/ 
                                    read_type: 'inner-text',
                                    plugins: [
                                        {
                                            parser: parseContent,
                                            assess: assessContent,
                                            persistData: function() { }
                                        }
                                    ]
                                },
                            ],
                            next: function(userInput) {
                                return new Promise((resolve, reject) => {
                                    //console.log(`User input has controls : ${userInput.inputControl.length}`);
                                    //if(userInput.inputControl.length>0) {
                                    if((userInput.exit!==undefined && userInput.exit!==null && userInput.exit) || userInput.retrycount>3) {
                                        userInput.exit = false;
                                        userInput.retrycount = 0;
                                        return resolve(999);
                                    }
                                    else {
                                        return resolve(5);
                                    }
                                });
                            }
                        },
                        {
                            id: 5,
                            controlid: '',
                            selector: '#ui-datepicker-div > div > a.ui-datepicker-next.ui-corner-all',
                            isarray: false,
                            checkcontent: '',
                            type: '',
                            value: ``,
                            action: 'click',
                            checkselector: '',
                            next: function(userInput) {
                                //checkselector: '#ui-datepicker-div > table > tbody > tr > td.event'
                                return new Promise((resolve, reject) => {
                                    //console.log(`User input has controls : ${userInput.inputControl.length}`);
                                    //if(userInput.inputControl.length>0) {
                                    if((userInput.exit!==undefined && userInput.exit!==null && userInput.exit) || userInput.retrycount>3) {
                                        userInput.exit = false;
                                        userInput.retrycount = 0;
                                        return resolve(999);
                                    }
                                    else {
                                        return resolve(6);
                                    }
                                });
                            }
                        },
                        {
                            id: 6,
                            controlid: '',
                            selector: '.ui-datepicker-title',
                            isarray: false,
                            checkcontent: '',
                            type: '',
                            value: ``,
                            action: 'click',
                            checkselector: '',
                            tasks: [
                                {
                                    task_id: 1,
                                    task_name: 'read content',
                                    action: 'read',
                                    selector: '.ui-datepicker-title',
                                    read_type: 'inner-text',
                                    plugins: [
                                        {
                                            parser: function(content) {
                                                //console.log(`Month-2: ${content}`);
                                            },
                                            assess: function() {},
                                            persistData: function() {}
                                        }
                                    ]
                                },
                            ],
                            next: 4
                        }
                    ]
                }
            ]
        }
        /*{
            id: 4,
            name: 'finalization',
            actions: [
                {
                    name: 'finalization',
                    type: 'code',
                    methodname: 'finalization',
                    repeat: false,
                    repeatsourceselector: '.chosen-results',
                    repeatsourceContentType: 'text',
                    repeatsource: repeatSource,
                    finalization: finalizeData,
                    userinputs: [
                    ]
                }
            ]            
        }*/
    ]
};