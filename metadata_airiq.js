//jshint esversion: 6
var colors = require('colors');
const moment = require('moment');
const logger = require('./src/common/logger').Logger;

logger.init('airiq');

function log() {
    var time = moment().format("HH:mm:ss.SSS");
    var args = Array.from(arguments);

    args.unshift(time);
    console.log.apply(console, args);
    //winston.info(args.join(' '));
    var msg = args.join(' ');
    logger.log('info', msg);    
}

const ALLOWPERSIST = true;

//helper methods
function repeatSource(elementData, context) {
    var data = [];
    //repeatsource could be number like 10 times.
    //repeatsource could be array of fixed data.
    //repeatsource could be function which will prepare data for iteration
    try
    {
        let fromIndex = -1;
        //let starttingSector = 'Delhi // Dubai';
        //let ignoringSectors = ['Dubai // Delhi', 'Goa // Delhi'];
        let ignoringSectors = [];
        //let includeSectors = ['Goa // Ahmedabad'];
        let includeSectors = [] //['Bagdogra // Kolkata'];

        if(context && context.sector) {
            includeSectors.push(context.sector);
        }

        let strreg = /\>(.*?)\</gm;
        if(elementData) {
            data = elementData.match(strreg).map((val, idx) => val.replace('>','').replace('<','')).filter((val, idx) => {
                //console.log(`${idx} - ${val}`);
                //if(idx>0 && idx%2===0) {
                //if(idx>0 && val.indexOf('Bagdogra // Kolkata')>-1) {

                let isRound = val.trim().split('//').length>2; //means round sectors
                // if(idx>0 && val.indexOf(starttingSector)>-1)
                //     fromIndex = idx;

                if(ignoringSectors.includes(val.trim())) return false;

                if(idx>0 && !isRound && (includeSectors.length == 0 || includeSectors.includes(val.trim()))) {
                //if(idx>0 && !isRound && val.trim().indexOf(starttingSector.trim()) == -1) {
                    //console.log(`${idx} - ${val}`);
                    return val.replace('>','').replace('<','');
                }
                else
                    return false;
            });
        }
    }
    catch(e) {
        console.log(e);
    }

    log(`Repeated source -> ${JSON.stringify(data)}`);
    return data;
}

function parseContent(content, idx, context) {
    //console.log(`Data : \n${content}`);
    //let contentItem = contentParser(content);
    let contentItem = contentParserV2(content, context);
    
    //console.log(`Data : ${JSON.stringify(contentItem)}`);
    // if(content.indexOf('Seats Available, Please send offline request')>-1 ||
    //     content.indexOf('On Request')>-1) 

    if(content.indexOf('Please send offline request')>-1) 
    {
        contentItem=null;
    }
    return contentItem;
}

function contentParserV2(content, context) {
    let deal =  {availability: -1};
    let transTime = '00:00'; //hr:mm
    if(context && context.transit_time) {
        transTime = context.transit_time;
    }

    try
    {
        content = content.replace(/\n/g, '');
        contentParts = content.split('\t');

        for (let index = 0; contentParts.length>1 && index < contentParts.length; index++) {
            const part = contentParts[index].trim();
            
            switch (index) {
                case 0:
                    //for airline
                    deal.flight = part.toLowerCase();
                    deal.flight_number = 'SPL-000';
                    deal.ticket_type = 'Economy';
                    break;
                case 1:
                    let circle = part.split('//');
                    if(circle.length>1) {
                        deal.departure = {"circle": circle[0].trim()};
                        deal.arrival = {"circle": circle[1].trim()};
                    }
                    else {
                        deal.departure = {"circle": ''};
                        deal.arrival = {"circle": ''};
                    }
                    break;
                case 3:
                    let dept_arv_date = part.match(/([0-9]{2})\s([a-zA-Z]{3})\s([0-9]{4})|([0-9]{0,2}:[0-9]{0,2})/gm);

                    if(dept_arv_date && dept_arv_date.length>0) {
                        let date = dept_arv_date[0].trim(); //src_dest[0].replace(' ','/');
                        let time = dept_arv_date.length>1 ? dept_arv_date[1].trim() : '00:00';
            
                        //console.log(`${date} - ${time}`);
                        deal.departure = {"circle": deal.departure.circle, "date": date, "time": time, epoch_date: Date.parse(`${date} ${time}:00.000`)}; //+05:30
                        deal.arrival = {"circle": deal.arrival.circle, "date": date, "time": time, epoch_date: Date.parse(`${date} ${time}:00.000`)}; //+05:30
                    }

                    break;
                case 4:
                    if(part) {
                        deal.flight_number = part;
                    }
                    else {
                        deal.flight_number = part;
                    }

                    break;
                case 5:
                    let time = part.trim();
                    if(time) {
                        deal.departure.time = time;
                        deal.arrival.time = time;

                        let deptDate = moment(`${deal.departure.date} ${deal.departure.time}:00.000`, 'DD MMM YYYY HH:mm:ss');
                        let arrvDate = moment(`${deal.arrival.date} ${deal.arrival.time}:00.000`, 'DD MMM YYYY HH:mm:ss');
                        if(deptDate.format('YYYY-MM-DD HH:mm') == arrvDate.format('YYYY-MM-DD HH:mm')) {
                            let hr = transTime.indexOf(':')>-1 ? parseInt(transTime.split(':')[0], 10) : 0;
                            let mn = transTime.indexOf(':')>-1 ? parseInt(transTime.split(':')[1], 10) : 0;

                            if(hr>0) {
                                arrvDate = arrvDate.add(hr, 'hours');
                            }
                            if(mn>0) {
                                arrvDate = arrvDate.add(mn, 'minutes');
                            }

                            deal.arrival.date = arrvDate.format('YYYY-MM-DD');
                            deal.arrival.time = arrvDate.format('HH:mm');
                        }

                        deal.departure.epoch_date = Date.parse(`${deal.departure.date} ${deal.departure.time}:00.000`);
                        deal.arrival.epoch_date = Date.parse(`${deal.arrival.date} ${deal.arrival.time}:00.000`);;
                    }

                    break;
                case 6:
                    let qty = parseInt(part.replace('+', ''));
        
                    if(qty>0) {
                        deal.availability = qty;
                    }
                    else {
                        deal.availability = -1;
                    }
                    break;
                case 7:
                    src_dest = content.match(/((AQP)\d+)/gm);
                    if(src_dest!==null && src_dest!==undefined && src_dest.length>0) {
                        //console.log(src_dest[0].replace('AQP','').trim());
                        let price = parseFloat(src_dest[0].replace('AQP','').trim());
            
                        deal.price = price + 50;
                    }
                    else {
                        deal.price = -1;
                    }
                    break;
                default:
                    break;
            }
        }
    }
    catch(e) {
        console.log(e);
    }

    return deal;
}

function contentParser(content) {
    let deal = {};

    try
    {
        
        content = content.replace(/\n/g, '');
        //get class value
        let src_dest = content.match(/\((.*?)\)/gm);
        if(src_dest!==null && src_dest!==undefined && src_dest.length>0) {
            let classValue = `Class (${src_dest[0].replace('(','').replace(')','')})`;
            deal.flight = classValue;
            deal.flight_number = 'SPL-000';
            deal.ticket_type = 'Economy';
        }
        else {
            deal.flight = 'SPL_000-000';
            deal.flight_number = 'SPL-000';
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

function assessContent(rawContent, parsedContent, store, runid, idx, context, callback) {
    let key = null;


    if(parsedContent.availability===-1 || parsedContent.price===-1) { //data not present
        return parsedContent;
    }
    //console.log(`Assess: ${JSON.stringify(parsedContent)}`);

    key = `${parsedContent.departure.circle}_${parsedContent.arrival.circle}`;
    if(store!==undefined && store!==null && store[key]!==undefined && store[key]!==null && store[key] instanceof Array) {
        parsedContent.runid = runid;
        if(store.attributes!==undefined && store.attributes!==null && store.attributes.length)
            parsedContent.recid = store.attributes[idx].value;
        else
            parsedContent.recid = -1;

        store[key].push(parsedContent);
    }

    if(context) {
        if(!context.tickets)
        {
            context.tickets = [];
        }

        context.tickets.push(parsedContent);
    }

    //console.log(`Data : ${JSON.stringify(parsedContent)}`);
    if(callback) {
        callback(store);
    }

    return parseContent;
}

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
                epoch_date: Date.parse(`${src_dest[2]} ${departure[1]}:00.000`) /* +05:30 */
            };
        }

        let arrival = src_dest[3].split(' ');
        if(arrival!==null && arrival.length>0) {
            deal.arrival = {
                circle: arrival[0],
                time: arrival[1],
                date: src_dest[4],
                epoch_date: Date.parse(`${src_dest[4]} ${arrival[1]}:00.000`) /* +05:30 */
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
    const datastore = require('./radharani/airiqdatastore');

    datastore.saveData(result, runid, function(data) {
        //console.log(`Proceed with next record ${JSON.stringify(data)}`);
        if(callback) callback(data);
    });
}

function finalizeData(runid, context, datasourceUrl) {
    //const datastore = require('./radharani/datastore');
    const datastore = require('./radharani/airiqdatastore');
    // const datasource = require(datasourceUrl);

    try
    {
        return datastore.finalization(runid, context);

        // datastore.finalization(runid, function(data) {
        //     console.log(`Proceed with next record ${JSON.stringify(data)}`);
        //     //callback(data);
        // });
    }
    catch(e3) {
        console.log(e3);
    }
}

async function circleCrawlingFinished(runid, store, circleKey, callback) {
    const datastore = require('./radharani/airiqdatastore');

    try
    {
        //console.log('circleCrawlingFinished called');
        if(circleKey===null || circleKey===undefined || circleKey==="") return -1;
        if(store[circleKey]===null || store[circleKey]===undefined || !(store[circleKey] instanceof Array)) return -1;
        //console.log('going to call saveCircleBatchData');
        if(store[circleKey].length>0) {
            let targetRunId = runid;
            let returnValue = await datastore.saveCircleBatchData(runid, store[circleKey], circleKey, async function(circleData) {
                if(targetRunId!==null && targetRunId!==undefined && circleData.length>0) {
                    let deptId = circleData[0].departure.id;
                    let arrvId = circleData[0].arrival.id;
                    let records = circleData.length;
                    //let cdata = circleData;
                    //updatedRecs = store[circleKey];
                    let clearEmptyStock = await datastore.updateExhaustedCircleInventory(runid, deptId, arrvId, function(status) {
                        if(status!==null && status!==undefined) {
                            let msg = `Clear exhausted inventory [${circleData[0].departure.circle}-${circleData[0].arrival.circle} -> ${records}] ${status.affectedRows} - ${status.message})`;
                            console.log();
                            if(callback) {
                                callback(msg);
                            }
                        }
                    });
                }
            });
        }
    }
    catch(e3) {
        console.log(e3);
    }
}

module.exports = {
    finalizeData: finalizeData,
    circlecrawlfinished: circleCrawlingFinished,
    pages: [
        {
            id: 1,
            name: 'airiq',
            actions: [
                {
                    name: 'airiq',
                    type: 'authentication',
                    userinputs: [
                        {
                            id: 1,
                            controlid: '',
                            selector: '#user_txt',
                            checkcontent: '',
                            type: 'textbox',
                            value: '9800412356',
                            action: 'keyed',
                            checkselector: ''
                        },
                        {
                            id: 2,
                            controlid: '',
                            selector: '#pwd_txt',
                            checkcontent: '',
                            type: 'textbox',
                            value: 'Sumit@12356',
                            action: 'keyed',
                            checkselector: ''
                        },
                        {
                            id: 3,
                            controlid: '',
                            selector: '#LinkButton1',
                            checkcontent: '',
                            type: 'button',
                            value: '',
                            action: 'click',
                            haspostback: true,
                            checkselector: '#horizontalTab > ul > li'
                        }                        
                    ]
                }
            ]
        },
        {
            id: 3,
            name: 'webscrapping',
            actions: [
                {
                    name: 'webscrapping',
                    type: 'code',
                    repeat: true,
                    repeatsourceselector: '#dest_cmd',
                    repeatsourceContentType: 'html',
                    repeatsource: repeatSource,
                    userinputs: [
                        {
                            id: 100,
                            controlid: '',
                            delaybefore: 200,
                            selector: 'input#check_out.form-control.hasDatepicker',
                            checkcontent: '',
                            type: 'textbox',
                            value: '',
                            action: 'keyed',
                            delayafter: 200,
                            checkselector: '',
                            next: 0
                        },                        
                        {
                            id: 0,
                            controlid: '',
                            delaybefore: 100,
                            selector: '#select2-dest_cmd-container',
                            isarray: false,
                            checkcontent: 'Select City or Airport',
                            type: 'hyperlink',
                            value: '',
                            action: 'click',
                            checkselector: '',
                            delayafter: -1,
                            next: 1
                        },
                        {
                            id: 1,
                            controlid: '',
                            delaybefore: 100,
                            selector: 'span.select2-search.select2-search--dropdown > input',
                            checkcontent: '',
                            type: 'textbox',
                            value: '${data}',
                            action: 'keyed',
                            delayafter: 100,
                            checkselector: '',
                            next: 2
                        },                        
                        {
                            id: 2,
                            controlid: '',
                            delaybefore: 100,
                            selector: '#select2-dest_cmd-results > li', /*'#select2-dest_cmd-results > li:first-child' */
                            isarray: false,
                            checkcontent: 'Please Select',
                            type: 'hyperlink',
                            value: '${data}',
                            action: 'click',
                            haspostback: true,
                            delayafter: 200,
                            checkselector: 'input#check_out.form-control.hasDatepicker',
                            next: 3
                        },
                        {
                            id: 3,
                            controlid: '',
                            delaybefore: 300,
                            selector: 'input#check_out.form-control.hasDatepicker',
                            isarray: false,
                            checkcontent: '',
                            type: '',
                            value: ``,
                            action: 'click',
                            checkselector: 'div#ui-datepicker-div[style*="display: block"]',
                            delayafter: 400,
                            next: 4
                        },
                        {
                            id: 4,
                            controlid: '',
                            selector: '#ui-datepicker-div > table > tbody > tr > td.event',
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
                                    selector: '.ui-datepicker-title',
                                    read_type: 'inner-text',
                                    plugins: [
                                        {
                                            parser: function(content) {
                                                //console.log(`Event: ${content}`);
                                            },
                                            assess: function(parsedData) {
                                                //console.log(`assess: ${JSON.stringify(parsedData)}`);
                                            },
                                            persistData: function() {}
                                        }
                                    ]
                                },
                                {
                                    task_id: 2,
                                    task_name: 'click content',
                                    action: 'click',
                                    selector: '',
                                    read_type: 'inner-text',
                                    plugins: [
                                        {
                                            parser: function(content) {
                                                //console.log(`No idea what is this: ${content}`);
                                            },
                                            assess: function(parsedData) {
                                                //console.log(JSON.stringify(parsedData));
                                            },
                                            persistData: function() {}
                                        }
                                    ]
                                },
                                {
                                    task_id: 3,
                                    task_name: 'read content',
                                    selector: 'a#SearchBtn.btn',
                                    value: '',
                                    action: 'click',
                                    haspostback: true,
                                    checkselector: 'div.flit-detls, #empty_lbl' /* .flit-detls */
                                },
                                {
                                    task_id: 4,
                                    task_name: 'read content',
                                    action: 'read',
                                    selector: '.flit-detls tr>input[type=hidden i], #empty_lbl',
                                    read_type: 'attributes',
                                    attributes: ['value'],
                                    plugins: [
                                        {
                                            parser: function(content, idx, context) {
                                                //.flit-detls tr .tble_item1_txt>input[type=hidden i]
                                                //console.log(`attr value - ${JSON.stringify(content)}`);
                                                return content;
                                            },
                                            assess: function(contentItem, parsedContent, store, runid, idx, context, callback) {
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
                                    task_id: 5,
                                    task_name: 'read content',
                                    action: 'read',
                                    selector: 'div.flit-detls, #empty_lbl', /*.flit-detls */
                                    read_type: 'inner-text',
                                    plugins: [
                                        {
                                            parser: parseContent,
                                            assess: assessContent,
                                            persistData: function() { }
                                        }
                                    ]
                                },
                                {
                                    task_id: 6,
                                    task_name: 'click content',
                                    action: 'click',
                                    selector: 'input#check_out.form-control.hasDatepicker',
                                    read_type: 'inner-text'
                                }        
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