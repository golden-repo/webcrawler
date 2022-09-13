//jshint esversion: 6
var colors = require('colors');
const moment = require('moment');
const { parseTwoDigitYear } = require('moment');

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
            if(index>=0 && element.match(/[0-9a-zA-Z ]*([-])[0-9a-zA-Z ]*/gm))
                data.push(element);
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
    let contentItem = contentParser(content, store, runid, option);
    //console.log(`Data : ${JSON.stringify(contentItem)}`);
    // if(content.indexOf('Seats Available, Please send offline request')>-1 ||
    //     content.indexOf('On Request')>-1) 

    if(content.indexOf('Please send offline request')>-1) 
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
        content = content.replace(/\t\t/gi, '\tNA\t');
        content = content.replace(/\t/gi, '\n');
        content = content.replace(/\n\n/gi, '\nNA\n');
        content = content.replace(/Hurry !!/gi, '');
        let src_dest = content.match(/([a-zA-Z0-9,].*)$/gm);
        let price_pattern = /([0-9,]+)/gm;
        
        let disp_date = null;
        let rate = 0.00;
        let qty = 0;
        let flight_number = '';
        let start_time = '';
        let end_time = '';
        flight_number = 'SPL-000';
        deal.flight = 'SPL';
        deal.ticket_type = 'Economy';
        for (let index = 0; index < src_dest.length; index++) {
            let data = src_dest[index];

            switch (index) {
                case 0:
                    //this is disp date
                    disp_date = data.trim();
                    disp_date = moment(disp_date, 'DD MMM YYYY').format("MM-DD-YYYY");
                    break;
                case 2:
                    //this is rate
                    let sector = data.trim();
                    let sectors = sector.split('-');
                    if(sectors && sectors.length>0) {
                        // option.source = sectors[0].trim();
                        // option.destination = sectors[1].trim();
                    }
                    break;
                case 10:
                    //this is rate
                    if(data.match(price_pattern) && data.match(price_pattern).length>0)
                        data = data.match(price_pattern)[0].trim();

                    rate = parseFloat(data.replace(',', '').trim());
                    break;
                case 6:
                    //deal.flight = data.trim();
                    // let timePart = data.trim();
                    // let qtyPart = 0;
                    // if(data.split(' ').length>1) {
                    //     timePart = data.split(' ', 1)[0];
                    //     qtyPart = data.split(' ', 1)[1];
                    // }
                    // else {

                    // }
                    start_time = data.trim();
                    break;
                case 8:
                    //deal.flight = data.trim();
                    end_time = data.trim();
                    let is_qty_present = end_time.split(' ').length>2; //it should be more than 1 means 2 or more
                    qty = -1;
                    if(is_qty_present) {
                        let arr = end_time.split(' ');
                        qty = parseInt(arr[arr.length-1]);
                        end_time = end_time.substr(0,end_time.lastIndexOf(' ')).trim();
                    }
                    break;
                case 4:
                    //this is flight number
                    //flight_number = 'SPL-000';
                    flight_number = data.trim().replace(' ', '');
                    let flightParts = flight_number.split('-');
                    if(flightParts!==null && flightParts.length>0) {
                        deal.flight = flightParts[0].trim();
                    }
                    else {
                        if(!deal.flight || deal.flight==='')
                            deal.flight = 'SPL';
                    }
                    break;
                default:
                    break;
            }
        }
        deal.flight_number = flight_number;
        deal.ticket_type = 'Economy';

        var start_date = Date.parse(`${disp_date} ${start_time}`);
        var end_date = Date.parse(`${disp_date} ${end_time}`);
        var end_date_part = disp_date;

        if(end_date < start_date) {
            //end_date.setDate(end_date.getDate() + 1);
            var dt = new Date(end_date);
            end_date = dt.setDate(dt.getDate() + 1);
            end_date_part = moment(end_date).format('MM-DD-YYYY');
        }

        deal.departure = {'circle': option.source, 'date': disp_date, 'time': start_time, 'epoch_date': start_date};
        deal.arrival = {'circle': option.destination, 'date': end_date_part, 'time': end_time, 'epoch_date': end_date};
        // deal.departure = {'circle': option.source, 'date': disp_date, 'time': start_time, 'epoch_date': Date.parse(`${start_time}`)};
        // deal.arrival = {'circle': option.destination, 'date': disp_date, 'time': end_time, 'epoch_date': Date.parse(`${end_time}`)};
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
    if(!parsedContent.availability || parsedContent.availability===-1 || !parsedContent.arrival.date || !parsedContent.departure.date || parsedContent.price===0) { //data not present
        return parsedContent;
    }
    //console.log(`Assess: ${JSON.stringify(parsedContent)}`);

    key = `${parsedContent.departure.circle}_${parsedContent.arrival.circle}`;
    if(store!==undefined && store!==null && store[key]!==undefined && store[key]!==null && store[key] instanceof Array) {
        parsedContent.runid = runid;
        if(store.attributes!==undefined && store.attributes!==null && store.attributes.length>idx)
            parsedContent.recid = parseInt(store.attributes[idx].value);
        else {
            parsedContent.recid = -1;
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
    const datastore = require('./radharani/dsdatastore');

    datastore.saveData(result, runid, function(data) {
        //console.log(`Proceed with next record ${JSON.stringify(data)}`);
        if(callback) callback(data);
    });
}

async function finalizeData(runid, datasourceUrl) {
    //const datastore = require('./radharani/datastore');
    const datastore = require('./radharani/dsdatastore');
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
}

function circleCrawlingFinished(runid, store, circleKey, callback) {
    const datastore = require('./radharani/dsdatastore');

    return new Promise(async (resolve, reject) => {
        try
        {
            //console.log('circleCrawlingFinished called');
            if(circleKey===null || circleKey===undefined || circleKey==="") {
                reject(`Invalid circle key passed - circleKey => ${circleKey}`);
                //return -1;
            }

            if(store[circleKey]===null || store[circleKey]===undefined || !(store[circleKey] instanceof Array)) {
                reject('Invalid circle data passed');
                //return -1;
            }

            //console.log('going to call saveCircleBatchData');
            if(circleKey && store && store[circleKey] && store[circleKey].length>0) {
                let targetRunId = runid;
                let circleData = await datastore.saveCircleBatchData(runid, store[circleKey], circleKey); //, async function(circleData) {
                if(targetRunId!==null && targetRunId!==undefined && circleData && circleData.length>0) {
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
            name: 'Default1',
            actions: [
                {
                    name: 'Default1',
                    type: 'code',
                    userinputs: [
                        {
                            id: 1,
                            controlid: '',
                            selector: 'body',
                            checkcontent: '',
                            type: 'button',
                            value: '',
                            action: 'click',
                            haspostback: true,
                            checkselector: '#ctl00_mainbody_Radio2',
                            delayafter: 300
                        },
                        {
                            id: 2,
                            controlid: '',
                            selector: '#ctl00_mainbody_Radio2',
                            checkcontent: '',
                            type: 'button',
                            value: '',
                            action: 'click',
                            haspostback: true,
                            checkselector: '#ctl00_mainbody_txt_fromDate',
                            delayafter: 300
                        }                        
                    ]
                }
            ]
        },        
        {
            id: 2,
            name: 'DealPage2A',
            actions: [
                {
                    name: 'DealPage2A',
                    type: 'code',
                    repeat: true,
                    repeatsourceselector: '#ctl00_mainbody_Panel1', /* Correct value : #ctl00_mainbody_Panel1*//*#ctl00_mainbody_Panel1 > div > .ChngColor > a > span*/
                    repeatsourceContentType: 'text', /* html */
                    repeatsource: repeatSource,
                    userinputs: [
                        {
                            id: 100,
                            controlid: '',
                            delaybefore: 100,
                            selector: `#ctl00_mainbody_Panel1 > a:nth-of-type(n+{i})`,
                            isarray: false,
                            checkcontent: '',
                            type: '',
                            value: ``,
                            action: 'click',
                            checkselector: '#ctl00_mainbody_GV_Report1 > tbody',
                            delayafter: 5000,
                            next: 1
                        },                        
                        {
                            id: 1,
                            controlid: '',
                            delaybefore: 500,
                            selector: '#ctl00_mainbody_UpdatePanel2 > div.col-md-12 > div.col-lg-8.col-md-8.col-sm-12.col-xs-12 > div.col-md-3.col-sm-6.col-xs-6',
                            checkcontent: '',
                            type: '',
                            value: '',
                            action: 'action',
                            delayafter: 200,
                            checkselector: '',
                            do: function(element) {
                                if(element) {
                                    element.style.display = 'block';
                                }
                                return true;
                            },
                            next: 2
                        },                        
                        {
                            id: 2,
                            controlid: '',
                            delaybefore: 100,
                            selector: '#ctl00_mainbody_DD_no_days',
                            checkcontent: '',
                            type: 'textbox',
                            value: 'Next 30 dates',
                            action: 'keyed',
                            delayafter: 200,
                            checkselector: '',
                            next: 3
                        },
                        {
                            id: 3,
                            controlid: '',
                            delaybefore: 200,
                            selector: '#ctl00_mainbody_txt_fromDate',
                            checkcontent: '',
                            type: 'textbox',
                            value: function() {
                                var dt = new Date();
                                return dt.getMonth()+1 + "-" + dt.getDate() + "-" + dt.getFullYear();
                            },
                            action: 'keyed',
                            delayafter: 100,
                            checkselector: '',
                            next: 4
                        },                        

                        // {
                        //     id: 1,
                        //     controlid: '',
                        //     delaybefore: 100,
                        //     selector: '#ctl00_mainbody_ddsegment',
                        //     checkcontent: '',
                        //     type: 'textbox',
                        //     value: '${data}',
                        //     action: 'keyed',
                        //     delayafter: 200,
                        //     checkselector: '',
                        //     next: 0
                        // },
                        // {
                        //     id: 0,
                        //     controlid: '',
                        //     delaybefore: 100,
                        //     selector: '#add-listing > div > div.row.with-forms > div.col-md-8 > select',
                        //     isarray: false,
                        //     /*checkcontent: 'Select from Dropdown',*/
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
                        {
                            id: 4,
                            controlid: '',
                            delaybefore: 100,
                            selector: '#ctl00_mainbody_btn_Search',
                            isarray: false,
                            checkcontent: '',
                            type: '',
                            value: '',
                            action: 'click',
                            haspostback: false,
                            delayafter: 5000,
                            checkselector: '#ctl00_mainbody_GV_Report1 > tbody',
                            next: 5
                        },
                        {
                            id: 5,
                            controlid: '',
                            selector: '#ctl00_mainbody_GV_Report1 > tbody',
                            isarray: true,
                            checkcontent: '',
                            type: '',
                            value: ``,
                            action: 'click',
                            delayafter: 200,
                            checkselector: '#ctl00_mainbody_GV_Report1 > tbody > tr:nth-child(n+2) > td:nth-child(8) >input:nth-child(7)',
                            tasks: [
                                // {
                                //     task_id: 1,
                                //     task_name: 'click content',
                                //     selector: '#ctl00_mainbody_Panel1 > a',
                                //     value: '',
                                //     action: 'click',
                                //     haspostback: false,
                                //     delayafter: 200,
                                //     checkselector: '#ctl00_mainbody_GV_Report1 > tbody' /* .flit-detls */
                                // },
                                {
                                    task_id: 2,
                                    task_name: 'read content',
                                    action: 'read',
                                    selector: `#ctl00_mainbody_GV_Report1 > tbody > tr:nth-child(n+2) > td:nth-child(6) >input:nth-child(8)`,
                                    read_type: 'attributes',
                                    attributes: ['value'],
                                    plugins: [
                                        {
                                            parser: function(content) {
                                                //.flit-detls tr .tble_item1_txt>input[type=hidden i]
                                                //console.log(`attr value - ${JSON.stringify(content)}`);
                                                let strreg = /\d*$/gm;
        
                                                //data = elementData.match(strreg).map((val, idx) => val.replace(' - ',' / '));
                                                data = content.value.match(strreg).map((val, idx) => val.trim());

                                                if(data && data.length>0) {
                                                    content.value = parseInt(data[0].trim());
                                                }
                                                
                                        
                                                return content;
                                            },
                                            assess: function(contentItem, parsedContent, store, runid, idx, option, callback) {
                                                if(store.attributes && store.attributes[idx] && store.attributes[idx].value) {
                                                    store.attributes[idx].value = contentItem.value;
                                                }
                                                
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
                                    task_id: 3,
                                    task_name: 'read content',
                                    action: 'read',
                                    selector: `#ctl00_mainbody_GV_Report1 > tbody > tr:nth-child(n+2)`, /*.flit-detls*/ 
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
                                //     selector: '#ctl00_mainbody_GV_Report1 > tbody',
                                //     value: '',
                                //     action: 'click',
                                //     haspostback: false,
                                //     checkselector: '#ctl00_mainbody_LnkResetSector',
                                //     delayafter: 10000,
                                // },                                
                                {
                                    task_id: 7,
                                    task_name: 'click content',
                                    selector: '#ctl00_mainbody_LnkResetSector',
                                    value: '',
                                    action: 'click',
                                    haspostback: false,
                                    checkselector: '#ctl00_mainbody_Panel1',
                                    delayafter: 500,
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