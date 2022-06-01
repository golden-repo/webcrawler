require('winston-daily-rotate-file');

const winston = require('winston');

var _appName = 'application';
var Logger = {};
var _logger = null;
// var Logger = (exports.Logger = {});

Logger.init = function(appName) {
    _appName = appName;
    if(!appName || appName === '') return null;

    let logger = _init();
}

function _init() {

    winston.loggers.add('logger', {
        transports: [
            new (winston.transports.Console)(
                {
                    level: 'info',
                    colorize: true
                }),
    
            //new files will be generated each day, the date patter indicates the frequency of creating a file.
            new winston.transports.DailyRotateFile({
                    name: 'debug-log',
                    filename: `${_appName}-Debug-%DATE%.log`,
                    level: 'info',
                    datePattern: 'YYYY-MM-DD',
                    prepend: true,
                    zippedArchive: false,
                    maxSize: '100m',
                    maxFiles: '3d',
                    json: false,
                    format: winston.format.simple()
                }
            ),
            new (winston.transports.DailyRotateFile)({
                name: 'error-log',
                filename: `${_appName}-Error-%DATE%.log`,
                level: 'error',
                datePattern: 'YYYY-MM-DD',  //YYYY-MM-DD-HH
                prepend: true,
                zippedArchive: false,
                maxSize: '100m',
                maxFiles: '3d',
                json: false,
                format: winston.format.simple()                
            })
        ]
    });
    
    _logger = winston.loggers.get('logger');

    return _logger;
}

// logger.setApplicationName = function(appname) {
//     _appName = appname;
//     if(this.transports && this.transports.length>0) {
//         for (let index = 0; index < this.transports.length; index++) {
//             const transport = this.transports[index];
//             if(transport && transport.filename) {
//                 if(transport.options && transport.options.name) {
//                     let nameKey = transport.options.name;
//                     switch (nameKey) {
//                         case 'debug-log':
//                             transport.filename = `${_appName}-Debug-%DATE%.log`;
//                             break;                    
//                         case 'error-log':
//                             transport.filename = `${_appName}-Error-%DATE%.log`;
//                             break;                    
//                         default:
//                             break;
//                     }
//                 }
//             }
//         }
//     }
// };

Logger.log = function(level, msg) {
    var message = new Date().toISOString() + " : " + msg;

    if(msg && msg.toLowerCase().indexOf('error')>-1) {
        level = 'error';
    }

    if(level) {
        if(level === 'info') {
            _logger.info(message);
        }
        else if(level === 'error') {
            _logger.error(message);
        }
        else {
            _logger.info(message);
        }
    }
    else {
        _logger.info(message);
    }
};  

//Object.defineProperty(exports, "LOG", {value: logger});

exports.Logger = Logger;