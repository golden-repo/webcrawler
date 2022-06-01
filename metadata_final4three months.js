//jshint esversion: 6
var colors = require('colors');

const ALLOWPERSIST = true;

//helper methods
function repeatSource(elementData) {
    var data = [];
    //repeatsource could be number like 10 times.
    //repeatsource could be array of fixed data.
    //repeatsource could be function which will prepare data for iteration
    try
    {
        let lines = elementData.split('\n');
        for(var i=1; i<lines.length; i++) {
            if(lines[i]!==null && lines[i]!=="") {
                data.push(lines[i]);
            }
        }
        //console.log(JSON.stringify(data));
    }
    catch(e) {
        console.log(e);
    }

    return data;
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
                epoch_date: Date.parse(`${src_dest[2]} ${departure[1]}:00.000+05:30`)
            };
        }

        let arrival = src_dest[3].split(' ');
        if(arrival!==null && arrival.length>0) {
            deal.arrival = {
                circle: arrival[0],
                time: arrival[1],
                date: src_dest[4],
                epoch_date: Date.parse(`${src_dest[4]} ${arrival[1]}:00.000+05:30`)
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
    const datastore = require('./radharani/datastore');

    datastore.saveData(result, runid, function(data) {
        //console.log(`Proceed with next record ${JSON.stringify(data)}`);
        if(callback) callback(data);
    });
}

function finalizeData(runid, datasourceUrl) {
    const datastore = require('./radharani/datastore');
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

module.exports = {
    pages: [
        {
            id: 1,
            name: 'index',
            actions: [
                {
                    name: 'index',
                    type: 'authentication',
                    userinputs: [
                        {
                            id: 1,
                            controlid: '',
                            selector: '#email',
                            checkcontent: '',
                            type: 'textbox',
                            value: '9800412356',
                            action: 'keyed',
                            checkselector: ''
                        },
                        {
                            id: 2,
                            controlid: '',
                            selector: '#password',
                            checkcontent: '',
                            type: 'textbox',
                            value: 'Radha@12356',
                            action: 'keyed',
                            checkselector: ''
                        },
                        {
                            id: 3,
                            controlid: '',
                            selector: '#login_submit',
                            checkcontent: '',
                            type: 'button',
                            value: '',
                            action: 'click',
                            checkselector: '#myNavbar > ul > li.normal_srchreali.bg-green > a'
                        }                        
                    ]
                }
            ]
        },
        {
            id: 2,
            name: 'index',
            actions: [
                {
                    name: 'index',
                    type: 'homepage',
                    userinputs: [
                        {
                            id: 1,
                            controlid: '',
                            selector: '#myNavbar > ul > li.normal_srchreali.bg-green > a',
                            checkcontent: '',
                            type: 'hyperlink',
                            value: '',
                            action: 'click',
                            checkselector: '#special_fare_flight_form > div:nth-child(2) > div > div.col-lg-3.col-md-3.col-sm-12.col-xs-12.destination-wrapper.no_padding_sm > div.col-md-12.no_padding_sm.font_16 > h4'
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
                    repeatsourceselector: '.chosen-results',
                    repeatsourceContentType: 'text',
                    repeatsource: repeatSource,
                    userinputs: [
                        {
                            id: 1,
                            controlid: '',
                            selector: '.chosen-search > input[type="text"]',
                            checkcontent: '',
                            type: 'textbox',
                            value: '${data}',
                            action: 'keyed',
                            checkselector: ''
                        },                        
                        {
                            id: 2,
                            controlid: '',
                            selector: '.chosen-results > li',
                            isarray: false,
                            checkcontent: 'Please Select',
                            type: 'hyperlink',
                            value: '',
                            action: 'click',
                            checkselector: 'div.fc-left > h2'
                        },
                        {
                            id: 3,
                            controlid: '',
                            selector: '.fc-event-container > a',
                            isarray: true,
                            tasks: [
                                {
                                    task_id: 1,
                                    task_name: 'click event',
                                    controlid: '',
                                    selector: '.fc-event-container > a',
                                    action: 'click',
                                    checkselector: '.madgrid',
                                },
                                {
                                    task_id: 2,
                                    task_name: 'read content',
                                    action: 'read',
                                    selector: '.madgrid',
                                    read_type: 'inner-text',
                                    plugins: [
                                        {
                                            parser: dataParser,
                                            assess: assessor,
                                            persistData: persistDataItem
                                        }
                                    ]
                                },
                                {
                                    task_id: 3,
                                    task_name: 'click calender',
                                    action: 'click',
                                    selector: '#headingOne > h4 > a',
                                    checkselector: '#special-fare-calendar'
                                }
                            ],
                            checkcontent: '',
                            type: '',
                            value: '',
                            action: 'click',
                            checkselector: ''
                        },
                        {
                            id: 4,
                            controlid: '',
                            selector: 'button.fc-next-button.fc-button.fc-state-default.fc-corner-left.fc-corner-right',
                            isarray: false,
                            checkcontent: 'Please Select',
                            type: 'hyperlink',
                            value: '',
                            action: 'click',
                            checkselector: ''
                        },
                        {
                            id: 5,
                            controlid: '',
                            selector: '.fc-event-container > a',
                            isarray: true,
                            tasks: [
                                {
                                    task_id: 1,
                                    task_name: 'click event',
                                    action: 'click',
                                    checkselector: '.madgrid',
                                },
                                {
                                    task_id: 2,
                                    task_name: 'read content',
                                    action: 'read',
                                    selector: '.madgrid',
                                    read_type: 'inner-text',
                                    plugins: [
                                        {
                                            parser: dataParser,
                                            assess: assessor,
                                            persistData: persistDataItem
                                        }
                                    ]
                                },
                                {
                                    task_id: 3,
                                    task_name: 'click calender',
                                    action: 'click',
                                    selector: '#headingOne > h4 > a',
                                    checkselector: '#special-fare-calendar'
                                }
                            ],
                            checkcontent: '',
                            type: '',
                            value: '',
                            action: 'click',
                            checkselector: ''
                        },
                        {
                            id: 6,
                            controlid: '',
                            selector: 'button.fc-next-button.fc-button.fc-state-default.fc-corner-left.fc-corner-right',
                            isarray: false,
                            checkcontent: 'Please Select',
                            type: 'hyperlink',
                            value: '',
                            action: 'click',
                            checkselector: ''
                        },
                        {
                            id: 7,
                            controlid: '',
                            selector: '.fc-event-container > a',
                            isarray: true,
                            tasks: [
                                {
                                    task_id: 1,
                                    task_name: 'click event',
                                    action: 'click',
                                    checkselector: '.madgrid',
                                },
                                {
                                    task_id: 2,
                                    task_name: 'read content',
                                    action: 'read',
                                    selector: '.madgrid',
                                    read_type: 'inner-text',
                                    plugins: [
                                        {
                                            parser: dataParser,
                                            assess: assessor,
                                            persistData: persistDataItem
                                        }
                                    ]
                                },
                                {
                                    task_id: 3,
                                    task_name: 'click calender',
                                    action: 'click',
                                    selector: '#headingOne > h4 > a',
                                    checkselector: '#special-fare-calendar'
                                }
                            ],
                            checkcontent: '',
                            type: '',
                            value: '',
                            action: 'click',
                            checkselector: ''
                        },
                        {
                            id: 8,
                            controlid: '',
                            selector: 'button.fc-next-button.fc-button.fc-state-default.fc-corner-left.fc-corner-right',
                            isarray: false,
                            checkcontent: 'Please Select',
                            type: 'hyperlink',
                            value: '',
                            action: 'click',
                            checkselector: ''
                        },
                        {
                            id: 9,
                            controlid: '',
                            selector: '.fc-event-container > a',
                            isarray: true,
                            tasks: [
                                {
                                    task_id: 1,
                                    task_name: 'click event',
                                    action: 'click',
                                    checkselector: '.madgrid',
                                },
                                {
                                    task_id: 2,
                                    task_name: 'read content',
                                    action: 'read',
                                    selector: '.madgrid',
                                    read_type: 'inner-text',
                                    plugins: [
                                        {
                                            parser: dataParser,
                                            assess: assessor,
                                            persistData: persistDataItem

                                        }
                                    ]
                                },
                                {
                                    task_id: 3,
                                    task_name: 'click calender',
                                    action: 'click',
                                    selector: '#headingOne > h4 > a',
                                    checkselector: '#special-fare-calendar'
                                }
                            ],
                            checkcontent: '',
                            type: '',
                            value: '',
                            action: 'click',
                            checkselector: ''
                        },
                        {
                            id: 10,
                            controlid: '',
                            selector: '#airport_info_chosen > a',
                            isarray: false,
                            checkcontent: 'Please Select',
                            type: 'hyperlink',
                            value: '',
                            action: 'click',
                            checkselector: ''
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
                    repeatsource: repeatSource,
                    finalization: finalizeData,
                    userinputs: [
                    ]
                }
            ]            
        }
    ]
};