//jshint esversion:6
var logger = require('../customlogger.js');
import fs from 'fs';
import WorkflowBase from './workflow';

export class Executor {
    constructor(workflow) {
        if(workflow === null || workflow === undefined) {
            throw "Invalid workflow passed";
        }
        if(workflow.activities === null || workflow.activities === undefined || workflow.activities.length === 0) {
            throw "Workflow doesn't have any activity. Can't proceed further";
        }

        this.workflow = workflow;
        this.status = 'Starting'
    }
    
    execute() {
        let currentActivity = this.workflow.activities.find((activity, idx) => {
            return activity.type === 'START';
        });

        while (currentActivity!==null && currentActivity!==undefined && currentActivity.type!=='END') {
            
        }
    }
}
