var fs = require('fs');
var colors = require('colors');
const moment = require('moment');
const delay = require('delay');
const uuidv4 = require('uuid/v4');
var html2json = require('html2json').html2json;
var json2html = require('html2json').json2html;
const POLLINGDELAY = 100;

class CheapPortal_Crawl {
    //this.config, this.context and this.parameters are implecitely available to access

    /*

    */
    async tx_set_user_input(taskinfo) {
        // const page = this.context.getContextData('page');
        //var params = this.hlp_get_passed_parameters(taskinfo);
        var selector = this.input_parameters.selector;
        var value = this.input_parameters.value;
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
        var timeout = 40000;

        var selector = this.input_parameters.selector;
        await this.page.click(selector).catch(reason => {
            console.log(`E13 => ${reason}`);
            flag = false;
        });

        await this.page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: timeout}).catch((reason) => {
            this.log('error', `Error (button click) => ${reason}`);
            console.log('error', `Error (button click) => ${reason}`);
        });
        
        return flag;
    }

    /*

    */
    async tx_read_content(taskinfo) {
        var flag = true;
        var contents = [];
        var content = '';
        var element_loaded = true;

        var selector = this.input_parameters.selector;
        var content_type = 'html';  //this.input_parameters.content_type;
        var content_selector = this.input_parameters.content_selector;
        var timeout = 4000;
        var pageLoaded = false;
        //content_type = 'html';

        await this.page.waitForSelector(selector).catch(reason => {
            console.log(`E16 => ${reason}`);
            element_loaded = false;
        });

        if(element_loaded) {
            if(content_type === 'html') {
                // Get inner HTML
                // content = await this.page.evaluate((sel) => document.querySelector(sel).innerHTML, selector).catch(reason => {
                //     console.log(`E18 => ${reason}`);
                //     flag = false;
                // });

                var elements = await this.page.$$(selector);

                if(elements && Array.isArray(elements)) {
                    for (let index = 0; index < elements.length; index++) {
                        try
                        {
                            const element = elements[index];

                            const id = element._remoteObject.description;
                            var circle = (await element.getProperty('innerText'))._remoteObject.value;

                            this.log('info', `Circle => ${circle}`);
                            console.log(`Circle => ${circle}`);

                            //await element.click();
                            // await this.page.waitFor(timeout);
                            //this.clickByText(this.page, circle);
                            console.log(`ID : ${id}`);
                            this.log('info', `ID => ${id}`);
                            await this.page.click(id);
                            pageLoaded = false;
                            await this.page.waitFor(timeout);
                            
                            //element.click();
                            // await this.page.waitForNavigation({waitUntil: 'load', }).catch((reason) => {
                            //     this.log('error', `Error => ${reason}`);
                            //     console.log('error', `Error => ${reason}`);
                            // });
                            //networkidle0
                            //domcontentloaded
                            // await this.page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: 4000}).catch((reason) => {
                            //     this.log('error', `Error => ${reason}`);
                            //     console.log('error', `Error => ${reason}`);
                            // });
                            console.log(`New ID : ${id}.activeControl`);
                            this.log('info', `New ID : ${id}.activeControl`);
                            // var chkselector = `${id}.activeControl`;
                            // if(!pageLoaded) {
                            //     //log(`N03 : ${pageLoaded}`); //domcontentloaded, load, networkidle0
                            //     await this.page.hackyWaitForFunction(async (isLoaded) => {
                            //         return pageLoaded;
                            //     }, {polling: POLLINGDELAY, timeout: timeout}, pageLoaded, chkselector).catch(async (reason) => { 
                            //         this.log(`N03 = ${reason} - ${pageLoaded}`); 
                            //         //await takeSnapshot('N03');
                            //         var chkControl = await this.page.$(chkselector).catch((reason)=> log(reason));
                            //         if(chkControl===null || chkControl===undefined)
                            //             await this.page.waitFor(1000); //Lets wait for another 1 sec and then proceed further. But this is exceptional case
                            //     });    
                            // }

                            // await this.page.waitForSelector(`${id}.activeControl`, {timeout: timeout}).catch(reason => {
                            //     console.log(`E21 => ${reason}`);
                            //     this.log('info', `E21 : ${reason}`);
                            //     // element_loaded = false;
                            // });
            
                            content = await this.page.evaluate((sel) => document.querySelector(sel).innerHTML, content_selector).catch(reason => {
                                console.log(`E18 => ${reason}`);
                                flag = false;
                            });

                            //this.log('info', `Content => ${content}`);
                            contents.push({'circle': circle, 'content': html2json(content)});
                        }
                        catch(ex) {
                            this.log('Error', ex);
                        }
                    }
                }
            }
        }

        this.output_parameters.contents = contents;

        return contents && contents.length>0;
    }

    /*

    */
    async tx_parse_content(taskinfo) {
        var flag = true;
        var contents = this.input_parameters.contents;
        var content_type = 'html';
        var regex = this.input_parameters.regex;
        var tickets = []; // ticket.type='ONEWAY';
        var ticket = {'ticket_type': 'Economy', 'type': 'ONEWAY', 'departure': {}, 'arrival': {}};
        
        //var clear_html_regex = /(<([^>]+)>)/ig;
        // var clear_html_regex = /(<([^>]+)>)(\s*)/ig;
        var clear_html_regex = /(<([^>]+)>)/ig;
        
        for (let index = 0; index < contents.length; index++) {
            const circle_data = contents[index];
            
            if(circle_data && circle_data.circle) {
                var circle = circle_data.circle;
                var content = circle_data.content;

                for (let rowindex = 0; rowindex < content.child.length; rowindex++) {
                    const element = content.child[rowindex];
                    if(element.node==='element' && element.tag==='tbody') {
                        const cells = element.child[1].child;
                        console.log('==========================================================================');
                        console.log(`Circle : ${circle}`);
                        const circles = circle.split('-');
                        ticket = {'ticket_type': 'Economy', 'type': 'ONEWAY', 'departure': {'circle': circles[0]}, 'arrival': {'circle': circles[1]}};
                        for (let cellindx = 0; cellindx < cells.length; cellindx++) {
                            const cell = cells[cellindx];
                            if(cell && cell.node==='element' && cell.tag==='td') {
                                const elcell = cell.child[1];
                                if(elcell && elcell.node==='element' && elcell.tag==='span') {
                                    try
                                    {
                                        const value = elcell.child[0].text;

                                        switch (cellindx) {
                                            case 1:
                                                ticket.departure.date = moment(value, 'DD/MM/YYYY').format('MM-DD-YYYY');
                                                ticket.arrival.date = moment(value, 'DD/MM/YYYY').format('MM-DD-YYYY');
                                                break;
                                            case 3:
                                                ticket.price = parseFloat(value);
                                                break;
                                            case 7:
                                                ticket.flight = value.toUpperCase();
                                                break;
                                            case 9:
                                                ticket.flight_number = value.toUpperCase();
                                                break;
                                            case 11:
                                                ticket.departure.time = value;
                                                break;
                                            case 13:
                                                ticket.arrival.time = value;

                                                if(ticket.arrival.time<ticket.departure.time) {
                                                    ticket.arrival.date = moment(ticket.arrival.date, 'MM-DD-YYYY').add(1, 'day').format('MM-DD-YYYY');
                                                }
                                                break;
                                            case 15:
                                                ticket.availability = parseInt(value, 10);
                                                break;
                                            default:
                                                break;
                                        }
                                        console.log(`${cellindx} | Value : ${value}`);
                                    }
                                    catch(ex) {
                                        this.log(ex);
                                        console.log(`Error => ${ex}`);
                                    }
                                }
                            }
                        }

                        if(ticket) {
                            ticket.recid = Math.abs(this.hashCode(`tudan-${ticket.flight_number}-${ticket.departure.circle}-${ticket.arrival.circle}-${ticket.departure.date}-${ticket.departure.time}-${ticket.price}`));
                            ticket.departure.epoch_date = Date.parse(`${ticket.departure.date} ${ticket.departure.time}:00.000`);
                            ticket.arrival.epoch_date = Date.parse(`${ticket.arrival.date} ${ticket.arrival.time}:00.000`);

                            if(ticket.recid && ticket.recid!==0) {
                                tickets.push(ticket);
                            }

                            console.log(`Ticket : ${JSON.stringify(ticket)}`);
                            this.log(`Ticket : ${JSON.stringify(ticket)}`);
                        }
                    }
                }
            }
        }

        console.log('===============================================================================');
        this.log(`Ticket -> ${JSON.stringify(tickets)}`);

        this.context.setContextData('tickets', tickets);
        this.output_parameters.content = tickets;

        return flag;
    }

    async tx_save2db(taskinfo) {
        var flag = true;

        let runid = `${uuidv4()}_${moment().format("DD-MMM-YYYY HH:mm:ss.SSS")}`;
        var tickets = this.input_parameters.tickets;
        const datastore = require('../../radharani/tudandatastore');

        try
        {
            if(tickets.length>0) {
                await datastore.saveCircleBatchData(runid, tickets, '', (updatedTickets) => {
                    if(updatedTickets) {
                        this.log('info', `Ticket length : ${updatedTickets.length}`);
                    }
                    // let impactedRows = metadata.circlecrawlfinished(runid, getStore(), key, function(status) {
                    //     log(`Finaliation of ${key} - ${status}`);
                    // });
                });

                var finalizedDataset = await datastore.finalization(runid);

                this.log('info', JSON.stringify(finalizedDataset));
            }
            else {
                this.log('info', 'No tickets found - Not saving into DB');
            }
        }
        catch(ex) {
            this.log('Error', ex);
        }

        return flag;
    }

    async tx_close(taskinfo) {
        var browser = this.context.getContextData('browser');
        
        await browser.close();
        console.log('Operation completed');
    }

    async clickByText(objpage, text) {
        const escapedText = this.escapeXpathString(text);
        const linkHandlers = await objpage.$x(`//a[contains(text(), ${escapedText})]`);
        
        if (linkHandlers.length > 0) {
            await objpage.click(`a[contains(text(), ${text}`);
            //await linkHandlers[0].click();
        } else {
            throw new Error(`Link not found: ${text}`);
        }
    }

    escapeXpathString(str) {
        const splitedQuotes = str.replace(/'/g, `', "'", '`);
        return `concat('${splitedQuotes}', '')`;
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

    hashCode(str) {
        return str.split('').reduce((prevHash, currVal) =>
            (((prevHash << 5) - prevHash) + currVal.charCodeAt(0))|0, 0);
    }    
}

module.exports = CheapPortal_Crawl;