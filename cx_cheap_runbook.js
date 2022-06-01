var fs = require('fs');
var colors = require('colors');
const moment = require('moment');
const delay = require('delay');
const uuidv4 = require('uuid/v4');
const fetch = require('isomorphic-fetch');
const https = require('https');

var html2json = require('html2json').html2json;
var json2html = require('html2json').json2html;

class CheapPortal_Crawl {
    //this.config, this.context and this.parameters are implecitely available to access

    /*

    */
    async tx_set_user_input(taskinfo) {
        // const page = this.context.getContextData('page');
        //var params = this.hlp_get_passed_parameters(taskinfo);
        var selector = this.input_parameters.selector;
        var value = this.input_parameters.value;

        await this.page.waitForSelector(selector).catch(reason => {
            console.log(`E1 => ${reason}`);
            this.log(`E1 => ${reason}`);
            element_loaded = false;
        });

        await this.page.type(selector, value);

        this.output_parameters.status = true;
        return true;
    }

    /*

    */
    async tx_click_button(taskinfo) {
        //const page = this.context.getContextData('page');
        //var params = this.hlp_get_passed_parameters(taskinfo);
        var flag = true;
        var timeout = this.input_parameters.timeout ? parseInt(this.input_parameters.timeout, 10) : 30000;
        var time = moment().format("HH_mm_ss_SSS");

        var selector = this.input_parameters.selector;
        await this.page.click(selector).catch(reason => {
            console.log(`E13 => ${reason}`);
            flag = false;
        });

        await this.page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: timeout}).catch((reason) => {
            this.log('error', `Error (button click) => ${reason}`);
            console.log('error', `Error (button click) => ${reason}`);
        });

        //await this.page.screenshot({path: `cheap-${time}.png`});

        return flag;
    }

    /*

    */
    async tx_element_present(task_info) {
        var flag = true;
        var content = '';
        var element_loaded = true;
        var timeout = this.input_parameters.timeout ? parseInt(this.input_parameters.timeout, 10) : 10000;

        var selector = this.input_parameters.selector;
        await this.page.waitForSelector(selector, {timeout: timeout}).catch(reason => {
            this.log('error',`E16 => ${reason}`);
            element_loaded = false;
        });

        var chkControl = await this.page.$(selector).catch((reason)=> this.log(reason));
        
        element_loaded = !(chkControl===null || chkControl===undefined);
        
        return element_loaded;
    }

    /*

    */
    async tx_read_global_variable(taskinfo) {
        var flag = true;
        var content = '';
        var element_loaded = true;

        var varname = this.input_parameters.varname;
        content = await this.page.evaluate((vname) => window[vname], varname).catch(reason => {
            this.log('error',`E18 => ${reason}`);
            flag = false;
        });

        this.output_parameters.token = content ? content.trim() : null;

        this.log('info', `${this.output_parameters.token} -> this.output_parameters.token`);

        return flag;
    }

    /*

    */
    async tx_read_content(taskinfo) {
        var flag = true;
        var content = '';
        var element_loaded = true;

        var selector = this.input_parameters.selector;
        var content_type = this.input_parameters.content_type;
        if(!content_type) {
            content_type = 'html';
        }
        await this.page.waitForSelector(selector).catch(reason => {
            console.log(`E16 => ${reason}`);
            element_loaded = false;
        });

        if(element_loaded) {
            if(content_type === 'html') {
                // Get inner HTML
                content = await this.page.evaluate((sel) => document.querySelector(sel).innerHTML, selector).catch(reason => {
                    console.log(`E18 => ${reason}`);
                    flag = false;
                });
            } else {
                // Get inner text
                content = await this.page.evaluate((sel) => document.querySelector(sel).innerText, selector).catch(reason => {
                    console.log(`E17 => ${reason}`);
                    flag = false;
                });
            }
        }

        //this.log('info', `Content => ${content}`);

        this.output_parameters.content = content.trim();

        return content.trim()!=='';
    }

    /*

    */
    async tx_parse_content(taskinfo) {
        var flag = true;
        var content = this.input_parameters.content;
        var content_type = this.input_parameters.content_type;
        var regex = this.input_parameters.regex;
        

        //this.log('info', `Content to parse => ${content}`);
        //var clear_html_regex = /(<([^>]+)>)/ig;
        // var clear_html_regex = /(<([^>]+)>)(\s*)/ig;
        var clear_html_regex = /(<([^>]+)>)/ig;
        
        content = content.replace(clear_html_regex, "\n");

        if(!content_type) {
            content_type = 'html';
        }

        var content_list = content.split('\n');
        var items = [];
        for (let index = 0; index < content_list.length; index++) {
            let contnet_listitem = content_list[index];
            if(contnet_listitem.trim() !== '') {
                contnet_listitem = contnet_listitem.trim().replace('\t',' ');
                items.push(contnet_listitem);
            }
        }

        this.context.setContextData('circles', items);
        this.output_parameters.content = items;

        return flag;
    }

    /*

    */
    async tx_call_api(taskinfo) {
        var flag = true;
        var url = this.input_parameters.url;
        var method = this.input_parameters.method;
        var token = this.input_parameters.token;
        var content_type = this.input_parameters.content_type;
        var tickets = null;

        const httpsAgent = new https.Agent({
            rejectUnauthorized: false,
        });        

        // Default options are marked with *
        let options = {
            method: method.toUpperCase(), // *GET, POST, PUT, DELETE, etc.
            cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                // "Content-Type": "application/x-www-form-urlencoded",
            },
            redirect: "follow", // manual, *follow, error
            referrer: "no-referrer", // no-referrer, *client
            // body: JSON.stringify(searchOption.data), // body data type must match "Content-Type" header
            agent: httpsAgent,
        };

        tickets = await fetch(url, options)
        .then(async response => {
            this.log("info", "Response received");
            var rsp = response;
            if(content_type === 'json') {
                rsp = await response.json();
            }
            return rsp;
        })
        .catch(reason => {
            this.log("error", reason);
            flag = false;
            //throw reason;
        }); // parses JSON response into native Javascript objects 

        //this.context.setContextData('circles', items);

        //this.log('info', JSON.stringify(tickets));

        this.output_parameters.tickets = tickets;

        return flag;
    }

    tx_transform_ticket_data(taskinfo) {
        var flag = true;
        var token = this.input_parameters.token;
        var tickets = this.input_parameters.tickets;

        var transformedTickets = [];

        if(tickets && tickets.length>0) {
            for (let index = 0; index < tickets.length; index++) {
                const ticket = tickets[index];
                
                try
                {
                    var tkt = {};
                    tkt.ticket_type='Economy';
                    tkt.type=ticket.flight_number.indexOf('//') > -1 ? 'ROUNDTRIP' : 'ONEWAY';
                    tkt.flight=this.hlp_getFlightCode(ticket.airline.id);
                    tkt.flight_number=ticket.flight_number;
                    tkt.departure = {};
                    tkt.arrival = {};
                    tkt.rtn_departure = {};
                    tkt.rtn_arrival = {};
                    tkt.recid = `TKT-CHP-${ticket.id}`;

                    if(tkt.type === 'ONEWAY' && parseInt(ticket.available_seats, 10)>0) {
                        let sectrs = ticket.sector_name.split('-');
                        if(sectrs.length==2) {
                            tkt.departure.circle = sectrs[0].trim();
                            tkt.arrival.circle = sectrs[1].trim();

                            tkt.departure.date = tkt.arrival.date = moment(ticket.departure_at).utcOffset('+05:30').format('YYYY-MM-DD');
                            if(ticket.departure_time) {
                                tkt.departure.time = ticket.departure_time.split('-').length>0 ? ticket.departure_time.split('-')[0] : moment(ticket.departure_at).format('HH:mm');
                                tkt.arrival.time = ticket.departure_time.split('-').length>0 ? ticket.departure_time.split('-')[1] : moment(ticket.departure_at).format('HH:mm');
                            }
                            else {
                                tkt.departure.time = tkt.arrival.time = moment(ticket.departure_at).format('HH:mm');
                            }

                            tkt.departure.epoch_date = Date.parse(`${tkt.departure.date} ${tkt.departure.time}:00.000`);
                            tkt.arrival.epoch_date = Date.parse(`${tkt.arrival.date} ${tkt.arrival.time}:00.000`);

                            tkt.availability = parseInt(ticket.available_seats, 10);
                            tkt.max_no_of_person = tkt.availability;
                            tkt.price = parseFloat(ticket.price);

                            transformedTickets.push(tkt);
                        }
                    }
                }
                catch(ex) {
                    this.log('error', ex);
                }
            }
        }

        this.output_parameters.tickets = transformedTickets;
        this.log('info', JSON.stringify(transformedTickets));

        return flag;
    }

    /*

    */
    async tx_read_ticket_data(taskinfo) {
        var flag = true;
        var content = this.input_parameters.content;
        var selector = this.input_parameters.selector;
        var page_size_selector = this.input_parameters.page_size_selector;
        var page_size_value = this.input_parameters.page_size_value;
        var content_selector = this.input_parameters.content_selector;
        var element_loaded = true;
        var tickets = [];
        var timeout = parseInt(this.input_parameters.timeout);
        var delay = parseInt(this.input_parameters.delay);
        var i = 0;
        var timeout = 4000;

        for (let index = 0; index < content.length; index++) {
            const item = content[index];
            element_loaded = true;

            console.log(`Circle -> ${item}`);
            this.log('info', `Circle : ${item}`);

            if(item && item.trim() === 'Select Sector') {
                await this.page.select(selector, item).catch(reason => console.log(`Error (read ticket_data): ${reason}`));

                //await this.page.waitFor(timeout);
                // await this.page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: timeout}).catch((reason) => {
                //     this.log('error', `Error (select) => ${reason}`);
                //     console.log('error', `Error (select) => ${reason}`);
                // });

                //{visible: true, timeout: timeout}
                await this.page.waitForSelector(content_selector, {timeout: timeout}).catch(reason => {
                    console.log(`E20 => ${reason}`);
                    //this.log('info', `E20 : ${reason}`);
                    // element_loaded = false;
                });

                this.log('info', 'Select Sector over');
            }

            if(item && item.trim()!=='Select Sector') {
                await this.page.select(selector, item).catch(reason => console.log(`${reason}`));
                await this.page.waitFor(timeout);
                await this.page.select(page_size_selector, page_size_value).catch(reason => console.log(`${reason}`));
                
                //await this.page.waitFor(timeout);
                // await this.page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: timeout}).catch((reason) => {
                //     this.log('error', `Error (select circle) => ${reason}`);
                //     console.log('error', `Error (select circle) => ${reason}`);
                // });

                //{visible: true, timeout: timeout}
                await this.page.waitForSelector(content_selector, {timeout: timeout}).catch(reason => {
                    console.log(`E21 => ${reason}`);
                    //this.log('info', `E21 : ${reason}`);
                    // element_loaded = false;
                });
                this.log('info', 'Actual sector');

                if(element_loaded) {
                    //timeout = 10000;
                    // Get inner HTML
                    var htmlcontent = await this.page.$eval(content_selector, e => e.innerHTML).catch(reason => console.log(`E24 => ${reason}`)); //targetElement._remoteObject.value;
                    // var htmlcontent = await this.page.evaluate((sel) => document.querySelector(sel).innerHTML, content_selector).catch(reason => {
                    //     console.log(`E18 => ${reason}`);
                    //     flag = false;
                    // });
                    this.log('info', `HTML Content loaded`);

                    // var clear_html_regex = /(<([^>]+)>)/ig;
        
                    // content = content.replace(clear_html_regex, "");
                    var jsoncontent = html2json(htmlcontent);

                    if(jsoncontent) {
                        var ticket = {};
                        for (let idx = 0; idx < jsoncontent.child.length; idx++) {
                            const record = jsoncontent.child[idx];
                            ticket = {};
                            ticket.ticket_type='Economy';
                            ticket.type='ONEWAY';
                            ticket.flight='SPL';
                            ticket.flight_number='SPL_000-000';
                            ticket.departure = {};
                            ticket.arrival = {};
                            ticket.rtn_departure = {};
                            ticket.rtn_arrival = {};
                            for (let cellidx = 0; record.child && cellidx < record.child.length; cellidx++) {
                                const cell_node = record.child[cellidx];
                                if(cell_node && cell_node.node==='element')
                                {
                                    for (let celliidx = 0; cell_node.child && celliidx < cell_node.child.length; celliidx++) {
                                        try
                                        {
                                            const cell_item = cell_node.child[celliidx];
                                            if(cell_item.node === 'text') {
                                                switch (cellidx) {
                                                    case 1:                                                        
                                                        var circle = cell_item.text.replace('\t', ' ').trim();
                                                        if(circle !== null && circle !== '') {
                                                            var airports = circle.split('-');
                                                            if(airports && airports.length===1)
                                                                airports = circle.trim().toLowerCase().split('to');
                                                            if(airports && airports.length===1)
                                                                airports = circle.split(' ');

                                                            if(airports) {
                                                                ticket.departure = {'circle': airports[0]?airports[0].trim():airports[0]};
                                                                ticket.arrival = {'circle': airports[1]?airports[1].trim():airports[1]};
                                                                if(airports.length>2) {
                                                                    ticket.rtn_departure = {'circle': airports[1]?airports[1].trim():airports[1]};
                                                                    ticket.rtn_arrival = {'circle': airports[2]?airports[2].trim():airports[2]};
                                                                }
                                                            }
                                                        }

                                                        break;
                                                    case 3:
                                                        var date = cell_item.text.replace('\t', '').trim()
                                                        ticket.departure.date = date;
                                                        ticket.arrival.date = date;
                                                        //ticket.dept_date = cell_item.text.replace('\t', '').trim();
                                                        break;
                                                    case 5:
                                                        var date = cell_item.text.replace('\t', '').trim()
                                                        if(date && date!==undefined && date!=='') {
                                                            ticket.rtn_departure.date = date;
                                                            ticket.rtn_arrival.date = date;
                                                        }
    
                                                        //ticket.rtn_date = cell_item.text.replace('\t', '').trim();
                                                        break;
                                                    case 7:
                                                        if(ticket.departure.time ===  undefined) {
                                                            var st_time = cell_item.text.replace('\t', '').trim();
                                                            ticket.departure.time = st_time;
                                                            //ticket.start_dept_time = cell_item.text.replace('\t', '').trim();
                                                        }
                                                        else {
                                                            var ed_time = cell_item.text.replace('\t', '').trim();
                                                            //ticket.start_arrv_time = cell_item.text.replace('\t', '').trim();
                                                            if(ed_time!==undefined && ed_time.trim()==='')
                                                                ed_time = ticket.departure.time;

                                                            ticket.arrival.time = ed_time;
                                                        }
                                                        break;
                                                    case 9:
                                                        //return type ticket;
                                                        if(ticket.rtn_departure.time ===  undefined) {
                                                            var rtst_time = cell_item.text.replace('\t', '').trim();
                                                            //ticket.rtn_dept_time = cell_item.text.replace('\t', '').trim();
                                                            if(rtst_time && rtst_time!==undefined && rtst_time!=='') {
                                                                ticket.rtn_departure.time = rtst_time
                                                                if(ticket.rtn_dept_time !== '') {
                                                                    ticket.type='ROUNDTRIP';
                                                                }
                                                            }
                                                        }
                                                        else {
                                                            var rted_time = cell_item.text.replace('\t', '').trim();
                                                            if(rted_time && rted_time!==undefined && rted_time!=='') {
                                                                ticket.rtn_arrival.time = rted_time
                                                                if(ticket.rtn_arrival.time<ticket.rtn_departure.time) {
                                                                    //date changed so return arrival date should be one day more.
                                                                    var rtn_arrival_date = moment(ticket.rtn_arrival.date, 'DD-MMM-YYYY');
                                                                    ticket.rtn_arrival.date = rtn_arrival_date.add(1, 'day').format('DD-MMM-YYYY');
                                                                }
                                                                //ticket.rtn_arrv_time = cell_item.text.replace('\t', '').trim();
                                                            }
                                                        }
                                                        break;
                                                    case 11:
                                                        ticket.availability = parseInt(cell_item.text.replace('\t', '').trim());
                                                        if(isNaN(ticket.availability)) {
                                                            ticket.availability = 0.00;
                                                        }
                                                        break;
                                                    case 15:
                                                        ticket.max_no_of_person = parseInt(cell_item.text.replace('\t', '').trim());
                                                        if(isNaN(ticket.max_no_of_person)) {
                                                            ticket.max_no_of_person = 0.00;
                                                        }
                                                        break;
                                                    case 17:
                                                        ticket.price = parseFloat(cell_item.text.replace('\t', '').trim());
                                                        if(isNaN(ticket.price)) {
                                                            ticket.price = 0.00;
                                                        }
                                                        break;
                                                    default:
                                                        break;
                                                }
                                            }
                                            else if(cell_item.node === 'element' && cell_item.tag === 'a') {
                                                switch (cellidx) {
                                                    case 19:
                                                        let id = cell_item.attr.href.trim().match(/\d+/gm);

                                                        ticket.url = cell_item.attr.href.trim();
                                                        ticket.id = ticket.recid = (id && id.length>0) ? parseInt(id[0]) : 0;
                                                        break;
                                                    default:
                                                        break;
                                                }
                                            }
                                        }
                                        catch(ex) {
                                            console.log(ex);
                                        }
                                    }
                                }
                            }

                            if(ticket && ticket.id>0 && ticket.type==='ONEWAY') {
                                if(ticket.rtn_departure.circle && ticket.rtn_arrival.circle) {
                                    console.log(`\t(${i}) Ticket Save == (${ticket.departure.circle}-${ticket.arrival.circle}) | (${ticket.rtn_departure.circle}-${ticket.rtn_arrival.circle})`);
                                    console.log(`\t\t(${i}) Ticket == ${ticket.departure.date} - [${ticket.departure.time} - ${ticket.arrival.time}] | ${ticket.rtn_departure.date} - [${ticket.rtn_departure.time} - ${ticket.rtn_arrival.time}]`);
                                    this.log('info', `\t(${i}) Ticket Save == (${ticket.departure.circle}-${ticket.arrival.circle}) | (${ticket.rtn_departure.circle}-${ticket.rtn_arrival.circle})`);
                                    this.log('info', `\t\t(${i}) Ticket == ${ticket.departure.date} - [${ticket.departure.time} - ${ticket.arrival.time}] | ${ticket.rtn_departure.date} - [${ticket.rtn_departure.time} - ${ticket.rtn_arrival.time}]`);
                                } else {
                                    console.log(`\t(${i}) Ticket Save == (${ticket.departure.circle}-${ticket.arrival.circle})`);
                                    console.log(`\t\t(${i}) Ticket == ${ticket.departure.date} - [${ticket.departure.time} - ${ticket.arrival.time}]`);
                                    this.log('info', `\t(${i}) Ticket Save == (${ticket.departure.circle}-${ticket.arrival.circle})`);
                                    this.log('info', `\t\t(${i}) Ticket == ${ticket.departure.date} - [${ticket.departure.time} - ${ticket.arrival.time}]`);
                                }

                                ticket.departure.epoch_date = Date.parse(`${ticket.departure.date} ${ticket.departure.time}:00.000`);
                                ticket.arrival.epoch_date = Date.parse(`${ticket.arrival.date} ${ticket.arrival.time}:00.000`);

                                if(ticket.rtn_departure.date && ticket.rtn_arrival.date) {
                                    ticket.rtn_departure.epoch_date = Date.parse(`${ticket.rtn_departure.date} ${ticket.rtn_departure.time}:00.000`);
                                    ticket.rtn_arrival.epoch_date = Date.parse(`${ticket.rtn_arrival.date} ${ticket.rtn_arrival.time}:00.000`);
                                }

                                tickets.push(ticket);
                                i++;
                            }
                        }
                    }
                }
            }
        }

        this.context.setContextData('tickets', tickets);
        this.output_parameters.tickets = tickets;

        this.log('info', JSON.stringify(tickets));

        return flag;
    }

    async tx_save2db(taskinfo) {
        var flag = true;

        let runid = `${uuidv4()}_${moment().format("DD-MMM-YYYY HH:mm:ss.SSS")}`;
        var tickets = this.input_parameters.tickets;
        const datastore = require('./radharani/cheapdatastore');

        try
        {
            if(tickets && tickets.length>0) {
                await datastore.saveCircleBatchData(runid, tickets, '');

                var finalizedDataset = await datastore.finalization(runid);
                this.output_parameters.updated_tickets = finalizedDataset;
                this.log('info', JSON.stringify(finalizedDataset));
            }
            else {
                this.log('info', 'No tickets available');
                flag = false;
            }
        }
        catch(ex) {
            this.log('Error', ex);
            flag = false;
        }

        return flag;
    }

    async tx_close(taskinfo) {
        var browser = this.context.getContextData('browser');
        
        await browser.close();
        console.log('Operation completed');
    }

    hlp_get_passed_parameters(taskinfo) {
        var params = {};
        taskinfo.parameters.forEach(parameter => {
            if(parameter && parameter.direction==='input') {
                if(parameter.sourcetype === 'value') {
                    params[parameter.name] = parameter.value;
                } else if(parameter.sourcetype === 'variable') {
                    params[parameter.name] = parameter.value;
                }
            }
        });

        return params;
    }

    hlp_getFlightCode(flightid) {
        let flightcode = 'SPL';

        switch (flightid) {
            case 1:
                flightcode = "G8"
                break;
            case 2:
                flightcode = "6E"
                break;
            case 3:
                flightcode = "SG"
                break;        
            case 4:
                flightcode = "I5"
                break;        
            default:
                break;
        }

        return flightcode;
    }
}

module.exports = CheapPortal_Crawl;