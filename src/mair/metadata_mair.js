//jshint esversion: 6
//jshint ignore:start
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
        //console.log(`RepeatSource : ${elementData}`);
        let strreg = /\>(.*?)\</gm;
        data = elementData.match(strreg).map((val, idx) => val.replace('>','').replace('<','')).filter((val, idx) => {
            //console.log(`${idx} - ${val}`);
            //if(idx>0 && idx%2===0) {
            //if(idx>0 && val.indexOf('Guwahati // Kolkata')>-1) {
            if(idx>0) {
                //console.log(`${idx} - ${val}`);
                return val.replace('>','').replace('<','');
            }
            else
                return false;
        });
    }
    catch(e) {
        console.log(e);
    }

    return data;
}

var source = "";
var destination = "";

function parseAirlinesData(content) {
    let airline = content.trim().match(/\s\b[A-Z]\w+\b/gm);

    if(airline!==null && airline.length>1) {
        source = airline[0].trim();
        destination = airline[1].trim();
    }
}

function parseContent(content) {
    //console.log(`Data : \n${content}`);
    let contentItem = contentParser(content);
    //console.log(`Data : ${JSON.stringify(contentItem)}`);
    // if(content.indexOf('Seats Available, Please send offline request')>-1 ||
    //     content.indexOf('On Request')>-1) 

    if(content.indexOf('Please send offline request')>-1) 
    {
        contentItem=null;
    }
    return contentItem;
}

function contentParser(content) {
    let deal = {};
    let deals = [];

    try
    {
        //get class value
        let src_dest = content.match(/^.*\b(\d{2}\/\d{2}\/\d{4})\b.*$/gm);
        for(var i=0; i<src_dest.length; i++) {
            deal = {};
            let row = src_dest[i];
            let src_date = '';
            let src_time = '';
            let dst_date = '';
            let dst_time = '';
            
            //console.log(`Row ${i} => ${row}`);
            let row_parts = row.split('\t');
            for(var j=0; j<row_parts.length; j++) {
                let fieldValue = row_parts[j].trim();
                
                deal.ticket_type = 'Economy';
                //deal.departure = deal.departure || {circle: destination};
                //dal.arrival = deal.arrival || {circle: source};

                if(fieldValue!==null && fieldValue!=="") {
                    //console.log(`\tField ${j} => ${fieldValue}`);

                    switch (j) {
                        case 0: //date
                            let dateParts = fieldValue.split('/');
                            src_date = dateParts[1]+'/'+dateParts[0]+'/'+dateParts[2];
                            dst_date = fieldValue;
                            break;
                        case 1: //amount
                            deal.price = parseFloat(fieldValue);
                            break;
                        case 3: //airline
                            deal.flight = fieldValue;
                            break;
                        case 4: //flight no
                            deal.flight_number = fieldValue;
                            break;
                        case 5: //dept.time
                            src_time = fieldValue;
                            break;
                        case 6: //arrv.time
                            dst_time = fieldValue;
                            break;
                        case 7: //qty
                            deal.availability = parseInt(fieldValue);
                            break;
                        default:
                            break;
                    }                    
                }
            }
            deal.departure = {'circle': source, 'date': src_date, 'time': src_time, 'epoch_date': Date.parse(`${src_date} ${src_time}:00.000`)};
            deal.arrival = {'circle': destination, 'date': src_date, 'time': dst_time, 'epoch_date': Date.parse(`${src_date} ${dst_time}:00.000`)};

            //console.log(`Data => ${JSON.stringify(deal)}`);

            deals.push(deal);
        }
    }
    catch(e) {
        console.log(e);
    }

    return deals;
}

function assessContent(rawContent, parsedContent, store, runid, idx, callback) {
    let key = null;

    if(parsedContent!==null && parsedContent!==undefined) { //data not present
        parsedContent = parsedContent.filter((content, idx) => {
            let flag = false;
            if(content.availability>-1) {
                content.runid = runid;
                flag = true;
            }

            return flag;
        });
    }
    //console.log(`Assess: ${JSON.stringify(parsedContent)}`);

    key = `${source}_${destination}`;
    if(store!==undefined && store!==null && (store[key]===undefined || store[key]===null)) {
        store[key] = []; //set an empty array for further operation
    }

    if(store!==undefined && store!==null && store[key]!==undefined && store[key]!==null && store[key] instanceof Array) {
        //parsedContent.runid = runid;
        // if(store.attributes!==undefined && store.attributes!==null && store.attributes.length)
        //     parsedContent.recid = store.attributes[idx].value;
        // else
        //     parsedContent.recid = -1;

        //store[key].push(parsedContent);
        store[key] = parsedContent;
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
    //const datastore = require('../radharani/mohdatastore');
    const datastore = require('../../radharani/mairdatastore');

    datastore.saveData(result, runid, function(data) {
        //console.log(`Proceed with next record ${JSON.stringify(data)}`);
        if(callback) callback(data);
    });
}

async function finalizeData(runid, datasourceUrl) {
    //const datastore = require('./radharani/datastore');
    //const datastore = require('../../radharani/mohdatastore');
    const datastore = require('../../radharani/mairdatastore');
    // const datasource = require(datasourceUrl);

    try
    {
        let data = await datastore.finalization(runid);

        // datastore.finalization(runid, function(data) {
        //     console.log(`Proceed with next record ${JSON.stringify(data)}`);
        //     //callback(data);
        // });
        //console.log(`${data}`);
    }
    catch(e3) {
        console.log(e3);
    }
}

async function circleCrawlingFinished(runid, store, circleKey, logger) {
    const datastore = require('../../radharani/mairdatastore');
    let returnValue = null;
    try
    {
        //console.log('circleCrawlingFinished called');
        if(circleKey===null || circleKey===undefined || circleKey==="") return -1;
        if(store[circleKey]===null || store[circleKey]===undefined || !(store[circleKey] instanceof Array)) return -1;
        //console.log('going to call saveCircleBatchData');
        console.log(`${circleKey} -> Count => ${store[circleKey].length}`);
        logger(circleKey, `${circleKey} -> Count => ${store[circleKey].length}`);
        returnValue = await datastore.saveCircleBatchData(runid, store[circleKey], circleKey);
        console.log(`Return : ${JSON.stringify(returnValue)}`);
        logger(circleKey, `Return : ${JSON.stringify(returnValue)}`);
    }
    catch(e3) {
        console.log(e3);
        logger(circleKey, `ERROR : ${e3}`);
    }

    return returnValue;
}

module.exports = {
    circlecrawlfinished: circleCrawlingFinished,
    pages: [
        {
            id: 1,
            name: 'AgentLogin',
            actions: [
                {
                    name: 'AgentLogin',
                    type: 'authentication',
                    userinputs: [
                        {
                            id: 1,
                            controlid: '',
                            selector: '#SiteBody_UserId',
                            checkcontent: '',
                            type: 'textbox',
                            value: '9382207002',
                            action: 'keyed',
                            checkselector: ''
                        },
                        {
                            id: 2,
                            controlid: '',
                            selector: '#SiteBody_Passkey',
                            checkcontent: '',
                            type: 'textbox',
                            value: 'Sumit@12356',
                            action: 'keyed',
                            checkselector: ''
                        },
                        {
                            id: 3,
                            controlid: '',
                            selector: '#SiteBody_Login',
                            checkcontent: '',
                            type: 'button',
                            value: '',
                            action: 'click',
                            haspostback: true,
                            checkselector: '#ContentPlaceHolder1_UpdatePanel1'
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
                    type: 'homepage',
                    repeat: false,
                    userinputs: [
                        {
                            id: 4,
                            controlid: '',
                            selector: 'a.bb',
                            isarray: true,
                            checkcontent: '',
                            type: '',
                            value: ``,
                            action: 'click',
                            haspostback: true,
                            checkselector: '#content1 > div',
                            tasks: [
                                {
                                    task_id: 1,
                                     task_name: 'click content',
                                    action: 'click',
                                    selector: '',
                                    read_type: 'inner-text',
                                    haspostback: true,
                                    postbackdelay: 2500,
                                    plugins: [
                                        {
                                            parser: function(content) {
                                                console.log(`No idea what is this: ${content}`);
                                            },
                                            assess: function(parsedData) {
                                                //console.log(JSON.stringify(parsedData));
                                            },
                                            persistData: function() {}
                                        }
                                    ]
                                },
                                {
                                    task_id: 2,
                                    task_name: 'read content',
                                    action: 'read',
                                    selector: '#ContentPlaceHolder1_lblSectorHeading', /*.flit-detls */
                                    read_type: 'inner-text',
                                    plugins: [
                                        {
                                            parser: parseAirlinesData,
                                            assess: function(parsedContent) {},
                                            persistData: function() {}
                                        }
                                    ]
                                },                                
                                {
                                    task_id: 3,
                                    task_name: 'read content',
                                    action: 'read',
                                    selector: '#content1 > div > table',
                                    read_type: 'inner-text',
                                    plugins: [
                                        {
                                            parser: parseContent,
                                            assess: assessContent,
                                            persistData: function() {}
                                        }
                                    ]
                                }        
                            ],
                            next: 999
                        }
                    ]
                }
            ]
        },
        {
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
                    repeatsource: function() {}, //repeatSource,
                    finalization: finalizeData,
                    userinputs: [
                    ]
                }
            ]            
        }
    ]
};

//jshint ignore:end