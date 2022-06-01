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
        //let strreg = /^\w+( - )\w+$/gm;
        //let strreg = /\w+( \/ )\w+/gm;
        //let strreg = /[0-9a-zA-Z ]*( \/ )[0-9a-zA-Z ]*/gm;
        //let strreg = /[0-9a-zA-Z ]{3}(-)[0-9a-zA-Z ]{3}/gm;
        //let strreg = /[0-9a-zA-Z ]{4}(-)[0-9a-zA-Z ]{4}/gm;
        //let strreg = /[^"\v]+/gm;
        
        //data = elementData.match(strreg).map((val, idx) => val.replace(' - ',' / '));
        //only support oneway for now. two way will not be allowed.

        if(elementData.indexOf('\n') > -1) {
            elementData = elementData.split('\n');
        }
        else {
            elementData = elementData.split('\r');
        }
        for (let index = 0; index < elementData.length; index++) {
            const element = elementData[index];
            
            //if(index>0 && element.match(/\([A-Za-z]{3}([- ]){1,}[A-Za-z]{3}\)/gm)) {
            if(index>0 && element.match(/^[A-Za-z ]{3,}([-]){1,}[A-Za-z ]{3,}$/gm)) {
                data.push(element.trim());
            }

            if(index>0 && element.match(/\b[A-Za-z]{3}([-]){1,}[A-Za-z]{3}\b/gm)) //\b[A-Za-z]{3}([-]){1,}[A-Za-z]{3}\b  | \([A-Z]{3}([- ])[A-Z]{3}
            {   
                // \([A-Z]{3}([- ])[A-Z]{3}
                element.match(/\b[A-Za-z]{3}([-]){1,}[A-Za-z]{3}\b/gm).map((val, idx) => {
                    //data.push(val.replace('(', '').trim());
                    data.push(element.trim());
                })
            }
                
        }

        //data = elementData.match(strreg).map((val, idx) => val.trim());
    }
    catch(e) {
        console.log(e);
    }

    return data;
}

function parseContent(content, idx, store, runid, option) {
    // console.log(`Data : \n${content}`);
    var option = option || {'source': '', 'destination': '', 'key': ''};
    content = content.replace(/\t/g, '\n');
    let contentItem = contentParser(content, store, runid, option);
    console.log(`Data : ${JSON.stringify(contentItem)}`);
    // if(content.indexOf('Seats Available, Please send offline request')>-1 ||
    //     content.indexOf('On Request')>-1) 

    if(content.indexOf('Please send offline request')>-1 || isNaN(contentItem.price)) 
    {
        contentItem=null;
    }
    return contentItem;
}

function contentParser(content, store, runid, option) {
    let deal = {};

    try
    {
        // let src_dest = content.match(/^([a-zA-Z0-9].*)$/gm);
        //let src_dest = content.match(/([a-zA-Z0-9,].*)$/gm);
        let src_dest = content.trim().split('\n');
        let source_city = option.source;
        let destination_city = option.destination;

        let disp_date = null;
        let rate = 0.00;
        let qty = 0;
        let flight_number = 'SPL-000';
        let start_time = '';
        let end_time = '';
        deal.ticket_type = 'Economy';
        deal.flight = 'SPL';
        for (let index = 0; index < src_dest.length; index++) {
            const data = src_dest[index];

            switch (index) {
                case 2:
                    //this is disp date
                    disp_date = data.trim();
                    break;
                case 4:
                    flight_number = data.trim().toUpperCase();
                    deal.flight = data.trim().substr(0,2).toUpperCase();
                    break;
                case 10:
                    //this is rate
                    rate = parseFloat(data.replace(',', '').trim());
                    break;
                case 5:
                    //this is both time (start and end)
                    times = data.trim().replace('–','^').replace('-','^').split('^');
                    if(times && times.length>0)
                        start_time = times[0].trim();
                    if(times && times.length>1)
                        end_time = times[1].trim();
                    break;
                case 8:
                    //this is available seats
                    qty = parseInt(data.trim());
                    break;
                default:
                    break;
            }
        }
        deal.flight_number = flight_number;
        deal.ticket_type = 'Economy';
        deal.departure = {'circle': source_city, 'date': disp_date, 'time': start_time, 'epoch_date': Date.parse(`${disp_date} ${start_time}`)};
        deal.arrival = {'circle': destination_city, 'date': disp_date, 'time': end_time, 'epoch_date': Date.parse(`${disp_date} ${end_time}`)};
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

function assessContent(rawContent, parsedContent, store, runid, idx, option, callback) {
    let key = null;

    var option = option || {'source': '', 'destination': '', 'key': ''};
    if(parsedContent.availability===-1) { //data not present
        return parsedContent;
    }
    //console.log(`Assess: ${JSON.stringify(parsedContent)}`);

    key = `${parsedContent.departure.circle}_${parsedContent.arrival.circle}`;
    if(store!==undefined && store!==null && store[key]!==undefined && store[key]!==null && store[key] instanceof Array) {
        parsedContent.runid = runid;
        if(store.attributes!==undefined && store.attributes!==null && store.attributes.length>idx)
            parsedContent.recid = parseInt(store.attributes[idx].value);
        else {
            //parsedContent.recid = -1;
            parsedContent.recid = `${option.key}-${parsedContent.arrival.epoch_date}`;
            console.log(`Attributes: ${idx} - ${JSON.stringify(store.attributes)}`);
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
    const datastore = require('./radharani/sngdatastore');

    datastore.saveData(result, runid, function(data) {
        //console.log(`Proceed with next record ${JSON.stringify(data)}`);
        if(callback) callback(data);
    });
}

async function finalizeData(runid, datasourceUrl='') {
    //const datastore = require('./radharani/datastore');
    const datastore = require('./radharani/sngdatastore');
    // const datasource = require(datasourceUrl);

    try
    {
        await datastore.finalization(runid);

        // datastore.finalization(runid, function(data) {
        //     console.log(`Proceed with next record ${JSON.stringify(data)}`);
        //     //callback(data);
        // });
    }
    catch(e3) {
        console.log(e3);
    }

    return;
}

function circleCrawlingFinished(runid, store, circleKey, callback) {
    const datastore = require('./radharani/sngdatastore');

    return new Promise(async (resolve, reject) => {
        try
        {
            //console.log('circleCrawlingFinished called');
            if(circleKey===null || circleKey===undefined || circleKey==="") {
                reject(`Invalid circle key passed - circleKey => ${circleKey}`);
                return -1;
            }

            if(store[circleKey]===null || store[circleKey]===undefined || !(store[circleKey] instanceof Array)) {
                reject('Invalid circle data passed');
                return -1;
            }

            //console.log('going to call saveCircleBatchData');
            if(circleKey && store && store[circleKey] && store[circleKey].length>0) {
                let targetRunId = runid;
                //let returnValue = datastore.saveCircleBatchData(runid, store[circleKey], circleKey, function(circleData) {
                let circleData = await datastore.saveCircleBatchData(runid, store[circleKey], circleKey); //, function(circleData) {
                if(targetRunId!==null && targetRunId!==undefined && circleData.length>0) {
                    let deptId = circleData[0].departure.id;
                    let arrvId = circleData[0].arrival.id;
                    let records = circleData.length;
                    //let cdata = circleData;
                    //updatedRecs = store[circleKey];
                    let status = await datastore.updateExhaustedCircleInventory(runid, deptId, arrvId); //, function(status) {
                    if(status!==null && status!==undefined) {
                        let msg = `Clear exhausted inventory [${circleData[0].departure.circle}-${circleData[0].arrival.circle} -> ${records}] ${status.affectedRows} - ${status.message})`;
                        console.log(msg);
                        // if(callback) {
                        //     callback(msg);
                        // }

                        resolve(circleData);
                    }
                    else {
                        reject("After exhausted circle inventory, return status invalid");
                    }
                    //});
                }
                else {
                    reject("Circle data couldn't be saved");
                }
                //});
            }
            else {
                reject("Circle data shouldn't be empty");
            }
        }
        catch(e3) {
            console.log(e3);

            reject(e3);
        }
    });
}

module.exports = {
    finalizeData: finalizeData,
    circlecrawlfinished: circleCrawlingFinished,
    pages: [        
        {
            id: 1,
            name: 'Start',
            actions: [
                {
                    name: 'Start',
                    type: 'code',
                    repeat: true,
                    repeatsourceselector: 'body > section.search > div > form > select', //'body > div.main-agileits > div.sub-main > form > select', /* Correct value : #ctl00_mainbody_Panel1*//*#ctl00_mainbody_Panel1 > div > .ChngColor > a > span*/
                    repeatsourceContentType: 'text', /* html */
                    repeatsource: repeatSource,
                    userinputs: [
                        // {
                        //     id: 100,
                        //     controlid: '',
                        //     delaybefore: 200,
                        //     selector: '#ctl00_mainbody_txt_fromDate',
                        //     checkcontent: '',
                        //     type: 'textbox',
                        //     value: function() {
                        //         var dt = new Date();
                        //         return dt.getMonth()+1 + "/" + dt.getDate() + "/" + dt.getFullYear();
                        //     },
                        //     action: 'keyed',
                        //     delayafter: 200,
                        //     checkselector: '',
                        //     next: 0
                        // },                        
                        {
                            id: 1,
                            controlid: '',
                            delaybefore: 500,
                            selector: 'body > section.search > div > form > select', //'body > div.main-agileits > div.sub-main > form > select',
                            checkcontent: '',
                            type: 'select',
                            value: '${data}',
                            action: 'select',
                            delayafter: 3000,
                            checkselector: '',
                            next: 5
                        },
                        // {
                        //     id: 0,
                        //     controlid: '',
                        //     delaybefore: 100,
                        //     selector: '#ctl00_mainbody_ddsegment',
                        //     isarray: false,
                        //     checkcontent: 'Select from Dropdown',
                        //     type: 'select', /* hyperlink */
                        //     value: '${data}',
                        //     action: 'select', /* click */
                        //     checkselector: '',
                        //     delayafter: -1,
                        //     next: 3 /* 2 */
                        // },
                        // {
                        //     id: 2,
                        //     controlid: '',
                        //     delaybefore: 100,
                        //     selector: '#ctl00_mainbody_ddsegment',
                        //     checkcontent: '',
                        //     type: 'textbox',
                        //     value: '${data}',
                        //     action: 'keyed',
                        //     delayafter: 200,
                        //     checkselector: '',
                        //     next: 3
                        // },
                        // {
                        //     id: 3,
                        //     controlid: '',
                        //     delaybefore: 100,
                        //     selector: '#ctl00_mainbody_DD_no_days',
                        //     checkcontent: '',
                        //     type: 'textbox',
                        //     value: '+ Next 15',
                        //     action: 'keyed',
                        //     delayafter: 200,
                        //     checkselector: '',
                        //     next: 4
                        // },                        
                        // {
                        //     id: 4,
                        //     controlid: '',
                        //     delaybefore: 100,
                        //     selector: '#ctl00_mainbody_btn_Search',
                        //     isarray: false,
                        //     checkcontent: '',
                        //     type: '',
                        //     value: '',
                        //     action: 'click',
                        //     haspostback: true,
                        //     delayafter: 400,
                        //     checkselector: '',
                        //     next: 5
                        // },
                        // {
                        //     id: 3,
                        //     controlid: '',
                        //     delaybefore: 300,
                        //     selector: 'input#check_out.form-control.hasDatepicker',
                        //     isarray: false,
                        //     checkcontent: '',
                        //     type: '',
                        //     value: ``,
                        //     action: 'click',
                        //     checkselector: 'div#ui-datepicker-div[style*="display: block"]',
                        //     delayafter: 800,
                        //     next: 4
                        // },
                        {
                            id: 5,
                            controlid: '',
                            selector: '#txtHint > table > tbody > tr.sub-head5',
                            isarray: true,
                            checkcontent: '',
                            type: '',
                            value: ``,
                            action: 'click',
                            checkselector: '',
                            tasks: [
                                // {
                                //     task_id: 1,
                                //     task_name: 'read content',
                                //     action: 'read',
                                //     selector: `#ctl00_mainbody_GV_Report1 > tbody > tr[style*="font-size:12px;"] > td:nth-last-child(-n+1) > input:nth-last-child(-n+1)`,
                                //     read_type: 'attributes',
                                //     attributes: ['value'],
                                //     plugins: [
                                //         {
                                //             parser: function(content) {
                                //                 //.flit-detls tr .tble_item1_txt>input[type=hidden i]
                                //                 //console.log(`attr value - ${JSON.stringify(content)}`);
                                //                 return content;
                                //             },
                                //             assess: function(contentItem, parsedContent, store, runid, idx, option, callback) {
                                //                 if(callback) {
                                //                     callback(store);
                                //                 }
                                //                 //return parsedContent;
                                //             },
                                //             persistData: function() { }
                                //         }
                                //     ]
                                // },
                                {
                                    task_id: 2,
                                    task_name: 'read content',
                                    action: 'read',
                                    selector: `#txtHint > table > tbody > tr.sub-head5`, /*.flit-detls*/ 
                                    read_type: 'inner-text',
                                    plugins: [
                                        {
                                            parser: parseContent,
                                            assess: assessContent,
                                            persistData: function() { }
                                        }
                                    ]
                                },
                                // {
                                //     task_id: 1,
                                //     task_name: 'read content',
                                //     action: 'read',
                                //     selector: '.ui-datepicker-title',
                                //     read_type: 'inner-text',
                                //     plugins: [
                                //         {
                                //             parser: function(content) {
                                //                 //console.log(`Month-1: ${content}`);
                                //             },
                                //             assess: function(parsedData) {
                                //                 //console.log(JSON.stringify(parsedData));
                                //             },
                                //             persistData: function() {}
                                //         }
                                //     ]
                                // },
                                // {
                                //     task_id: 2,
                                //     task_name: 'click content',
                                //     action: 'click',
                                //     selector: '',
                                //     read_type: 'inner-text',
                                //     plugins: [
                                //         {
                                //             parser: function(content) {
                                //                 console.log(`No idea what is this: ${content}`);
                                //             },
                                //             assess: function(parsedData) {
                                //                 console.log(JSON.stringify(parsedData));
                                //             },
                                //             persistData: function() {}
                                //         }
                                //     ]
                                // },
                                // {
                                //     task_id: 3,
                                //     task_name: 'read content',
                                //     selector: 'a#SearchBtn.btn',
                                //     value: '',
                                //     action: 'click',
                                //     haspostback: true,
                                //     checkselector: 'div.flit-detls, #empty_lbl' /* .flit-detls */
                                // },
                                // {
                                //     task_id: 4,
                                //     task_name: 'read content',
                                //     action: 'read',
                                //     selector: `#ctl00_mainbody_GV_Report1 > tbody > tr[style*="font-size:12px;"] > td:nth-last-child(-n+1) > input:nth-last-child(-n+1)`,
                                //     read_type: 'attributes',
                                //     attributes: ['value'],
                                //     plugins: [
                                //         {
                                //             parser: function(content) {
                                //                 //.flit-detls tr .tble_item1_txt>input[type=hidden i]
                                //                 //console.log(`attr value - ${JSON.stringify(content)}`);
                                //                 return content;
                                //             },
                                //             assess: function(contentItem, parsedContent, store, runid, idx, callback) {
                                //                 if(callback) {
                                //                     callback(store);
                                //                 }
                                //                 //return parsedContent;
                                //             },
                                //             persistData: function() { }
                                //         }
                                //     ]
                                // },
                                // {
                                //     task_id: 5,
                                //     task_name: 'read content',
                                //     action: 'read',
                                //     selector: 'div.flit-detls, #empty_lbl', /*.flit-detls */
                                //     read_type: 'inner-text',
                                //     plugins: [
                                //         {
                                //             parser: parseContent,
                                //             assess: assessContent,
                                //             persistData: function() { }
                                //         }
                                //     ]
                                // },
                                // {
                                //     task_id: 6,
                                //     task_name: 'click content',
                                //     action: 'click',
                                //     selector: 'input#check_out.form-control.hasDatepicker',
                                //     read_type: 'inner-text'
                                // }        
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
                                        return resolve(999); //end
                                        //return resolve(5);
                                    }
                                });
                            }
                        },
                        // {
                        //     id: 5,
                        //     controlid: '',
                        //     selector: '#ui-datepicker-div > div > a.ui-datepicker-next.ui-corner-all',
                        //     isarray: false,
                        //     checkcontent: '',
                        //     type: '',
                        //     value: ``,
                        //     action: 'click',
                        //     checkselector: '',
                        //     next: function(userInput) {
                        //         //checkselector: '#ui-datepicker-div > table > tbody > tr > td.event'
                        //         return new Promise((resolve, reject) => {
                        //             //console.log(`User input has controls : ${userInput.inputControl.length}`);
                        //             //if(userInput.inputControl.length>0) {
                        //             if((userInput.exit!==undefined && userInput.exit!==null && userInput.exit) || userInput.retrycount>3) {
                        //                 userInput.exit = false;
                        //                 userInput.retrycount = 0;
                        //                 return resolve(999);
                        //             }
                        //             else {
                        //                 return resolve(6);
                        //             }
                        //         });
                        //     }
                        // },
                        // {
                        //     id: 6,
                        //     controlid: '',
                        //     selector: '.ui-datepicker-title',
                        //     isarray: false,
                        //     checkcontent: '',
                        //     type: '',
                        //     value: ``,
                        //     action: 'click',
                        //     checkselector: '',
                        //     tasks: [
                        //         {
                        //             task_id: 1,
                        //             task_name: 'read content',
                        //             action: 'read',
                        //             selector: '.ui-datepicker-title',
                        //             read_type: 'inner-text',
                        //             plugins: [
                        //                 {
                        //                     parser: function(content) {
                        //                         //console.log(`Month-2: ${content}`);
                        //                     },
                        //                     assess: function() {},
                        //                     persistData: function() {}
                        //                 }
                        //             ]
                        //         },
                        //     ],
                        //     next: 4
                        // }
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