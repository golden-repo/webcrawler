//jshint esversion: 6
var sequencer = require('../common/sequencer');

export default class Activity {
    constructor(objActivityConf, executingWorkflow) {
        super();

        this.id = sequencer();
        this.executingWorkflow = executingWorkflow;
        this.properties = {};
        this.context = executingWorkflow.context;
        this.connects = [];

        //custom code
        if(objActivityConf.pre_process!==undefined && objActivityConf.pre_process!==null && typeof(objActivityConf.pre_process)==='function')
            this.pre_process = objActivityConf.pre_process;
        else
            this.pre_process = function() {};

        if(objActivityConf.process!==undefined && objActivityConf.process!==null && typeof(objActivityConf.process)==='function')
            this.process = objActivityConf.pre_process;
        else
            this.process = function() {};

        if(objActivityConf.parse!==undefined && objActivityConf.parse!==null && typeof(objActivityConf.parse)==='function')
            this.parse = objActivityConf.parse;
        else
            this.parse = function(raw) {};

        if(objActivityConf.assess!==undefined && objActivityConf.assess!==null && typeof(objActivityConf.assess)==='function')
            this.assess = objActivityConf.assess;
        else
            this.assess = function(parsedData) {};
        
        if(objActivityConf.onerror!==undefined && objActivityConf.onerror!==null && typeof(objActivityConf.onerror)==='function')
            this.onerror = objActivityConf.onerror;
        else
            this.onerror = function(error) {};
    }

    addProperty(name, value) {
        if(name===undefined || name===null || value===undefined || value===null) return;

        this.properties[name]=value;
    }

    getProperties() {
        return Object.assign({}, this.properties);
    }
}
