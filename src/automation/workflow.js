//jshint esversion:6
var logger = require('../customlogger.js');
import fs from 'fs';

export class WorkflowBase {
    constructor(contextData) {
        super();
        this.context = new Context({});
        if(contextData instanceof Context) {
            this.context = contextData;
        }

        this.settings = new Settings();
        this.activities = [];
        this.activities = [new StartActivity(), new EndActivity()];
    }
    
    load(filePath) {
        this.filePath = filePath;
        
        if(fs.exists(this.filePath)) throw 'Workflow path/file not present';

        try {
            //file exists. Lets load it. Format must be json.
            this.workflowData = require(this.filePath);

            if(validate(this.workflowData)) {
                this.activities = this.workflowData.activities;
                this.settings = this.workflowData.settings;
            }
        }
        catch(ex) {
            log('error', ex);
            throw ex;
        }
    }

    validate(objWorkflowData) {
        let flag = true;
        try
        {
            if(objWorkflowData===null || objWorkflowData===undefined) return false;

            flag &= objWorkflowData.activities!==undefined && objWorkflowData.activities!==null && objWorkflowData.activities.length>0;
            if(!flag) throw 'No activities present';

            flag &= objWorkflowData.settings!==undefined && objWorkflowData.settings!==null;
            if(!flag) throw 'Invalid settings passed';
        }
        catch(ex) {
            logger.log('error', ex);
            flag = false;
        }

        return flag;
    }
}

export class Context {
    constructor(payload) {
        this.payload = {sessionName: 'default'} || payload;
        this.session[this.payload.sessionName] = {};
        this.currentSession = this.session[this.payload.sessionName];

        this.currentSession.result = {condition: '', complete: false, severity: '', return_value: {}};
    }

    Add(name, value) {
        try
        {
            if(name!==undefined && name!==null && value!==undefined && value!==null) {
                this.currentSession[name]=value;
            }

            logger.log('info', `${name} added to session`);
        }
        catch(ex) {
            logger.log('error', ex);
        }
    }

    Remove(name) {
        //Find the key in the list and remove that key from the list
        delete this.currentSession[name];
    }

    Get(name) {
        return this.currentSession[name];
    }

}