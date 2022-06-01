//jshint esversion: 6
var sequencer = require('../common/sequencer');
var logger = require('../customlogger');

import Activity from './Activity';

export default class StartActivity extends Activity {
    constructor (activityConf, executingWorkflow) {
        super(activityConf, executingWorkflow);

        this.type = 'END';
    }

    execute(methodType) {
        let returnValue = null;
        try
        {
            switch (methodType) {
                case 'pre-process':
                    returnValue = super.pre_process();
                    break;
                case 'process':
                    returnValue = super.process();
                    break;
                case 'parse':
                    returnValue = super.parse();
                    break;
                case 'assess':
                    returnValue = super.assess();
                    break;
                default:
                    break;
            }
        }
        catch(ex) {
            logger.log('error', ex);
            super.onerror(ex);
        }

        return returnValue;
    }
}