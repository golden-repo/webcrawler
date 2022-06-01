"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.E2FCrawler = exports.Logger = void 0;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

//jshint esversion: 6
var cron = require("node-cron");

var express = require("express");

var fs = require("fs");

var uuidv4 = require('uuid/v4');

var delay = require('delay');

var moment = require('moment');

var fetch = require('isomorphic-fetch'); //import moment from "moment";
// import "isomorphic-fetch";


var Logger =
/*#__PURE__*/
function () {
  function Logger() {
    _classCallCheck(this, Logger);
  }

  _createClass(Logger, null, [{
    key: "log",
    value: function log(type, message) {
      switch (type) {
        case "info":
          Logger._write("info", message);

          break;

        case "warning":
          Logger._write("warning", message);

          break;

        case "error":
          Logger._write("error", message);

          break;

        default:
          break;
      }
    }
  }, {
    key: "_write",
    value: function _write(type) {
      var time = moment().format("HH:mm:ss.SSS"); //arguments.splice(0)

      var args = Array.from(arguments); //args.splice(0);

      args.unshift(time);
      args.unshift(type.toUpperCase());
      console.log.apply(console, args);
    }
  }]);

  return Logger;
}();

exports.Logger = Logger;

var E2FCrawler =
/*#__PURE__*/
function () {
  function E2FCrawler(options) {
    _classCallCheck(this, E2FCrawler);

    this.options = options || {
      url: '',
      output: 'json'
    };
  }

  _createClass(E2FCrawler, [{
    key: "postData",
    value: function postData() {
      var searchOption = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {
        url: '',
        data: {
          usrId: 109,
          usrType: 'N'
        }
      };
      // Default options are marked with *
      return fetch(searchOption.url, {
        method: "POST",
        // *GET, POST, PUT, DELETE, etc.
        mode: "cors",
        // no-cors, cors, *same-origin
        cache: "no-cache",
        // *default, no-cache, reload, force-cache, only-if-cached
        credentials: "same-origin",
        // include, *same-origin, omit
        headers: {
          "Content-Type": "application/json" // "Content-Type": "application/x-www-form-urlencoded",

        },
        redirect: "follow",
        // manual, *follow, error
        referrer: "no-referrer",
        // no-referrer, *client
        body: JSON.stringify(searchOption.data) // body data type must match "Content-Type" header

      }).then(function (response) {
        Logger.log("info", "Response received");
        return response.json();
      }).catch(function (reason) {
        Logger.log("error", reason);
      }); // parses JSON response into native Javascript objects 
    }
  }]);

  return E2FCrawler;
}(); // function postData(searchOption={url: '', data: {usrId: 109, usrType: 'N'}}) {
//     // Default options are marked with *
//     return fetch(searchOption.url, {
//         method: "POST", // *GET, POST, PUT, DELETE, etc.
//         mode: "cors", // no-cors, cors, *same-origin
//         cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
//         credentials: "include", // include, *same-origin, omit
//         headers: {
//             "Content-Type": "application/json",
//             // "Content-Type": "application/x-www-form-urlencoded",
//         },
//         redirect: "follow", // manual, *follow, error
//         referrer: "client", // no-referrer, *client
//         body: JSON.stringify(searchOption.data), // body data type must match "Content-Type" header
//     })
//     .then(response => {
//         console.log("info", "Response received");
//         return response.json();
//     })
//     .catch(reason => {
//         console.log("error", reason);
//     }); // parses JSON response into native Javascript objects 
// }
// let resp = postData({url: 'https://expressdev.ease2fly.com/api/destinations/get-destinations-list', data: {
//     usrId: 109,
//     usrType: "N"
// }})
// .then(data => {
//     //console.log(JSON.stringify(data.result));
//     return data.result;
// })
// .catch(error => {
//     console.log(error);
// });
// console.log(resp);


exports.E2FCrawler = E2FCrawler;
"use strict";

var _e2fcrwler = require("./e2fcrwler");

var _winston = require("winston");

//jshint esversion: 6
var cron = require("node-cron");

var express = require("express");

var fs = require("fs");

var uuidv4 = require('uuid/v4');

var moment = require('moment');

_e2fcrwler.Logger.log('info', "Starting process ...");

var e2fcrawler = new _e2fcrwler.E2FCrawler({
  url: '',
  output: 'json'
});
var response = e2fcrawler.postData({
  url: 'https://expressdev.ease2fly.com/api/destinations/get-destinations-list',
  data: {
    usrId: 109,
    usrType: "N"
  }
});
response.then(function (data) {
  _e2fcrwler.Logger.log("info", JSON.stringify(data.result));
}).catch(function (error) {
  _e2fcrwler.Logger.log("error", error);
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9lMmYvZTJmY3J3bGVyLmpzIiwic3JjL2UyZi9pbmRleGUyZi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQSxJQUFNLElBQUksR0FBRyxPQUFPLENBQUMsV0FBRCxDQUFwQjs7QUFDQSxJQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsU0FBRCxDQUF2Qjs7QUFDQSxJQUFNLEVBQUUsR0FBRyxPQUFPLENBQUMsSUFBRCxDQUFsQjs7QUFFQSxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsU0FBRCxDQUF0Qjs7QUFDQSxJQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsT0FBRCxDQUFyQjs7QUFDQSxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsUUFBRCxDQUF0Qjs7QUFDQSxJQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsa0JBQUQsQ0FBckIsQyxDQUVBO0FBQ0E7OztJQUVhLE07Ozs7Ozs7Ozt3QkFDRSxJLEVBQU0sTyxFQUFTO0FBQ3RCLGNBQVEsSUFBUjtBQUNJLGFBQUssTUFBTDtBQUNBLFVBQUEsTUFBTSxDQUFDLE1BQVAsQ0FBYyxNQUFkLEVBQXFCLE9BQXJCOztBQUNJOztBQUNKLGFBQUssU0FBTDtBQUNJLFVBQUEsTUFBTSxDQUFDLE1BQVAsQ0FBYyxTQUFkLEVBQXdCLE9BQXhCOztBQUNBOztBQUNKLGFBQUssT0FBTDtBQUNJLFVBQUEsTUFBTSxDQUFDLE1BQVAsQ0FBYyxPQUFkLEVBQXNCLE9BQXRCOztBQUNBOztBQUNKO0FBQ0k7QUFYUjtBQWFIOzs7MkJBRWEsSSxFQUFNO0FBQ2hCLFVBQUksSUFBSSxHQUFHLE1BQU0sR0FBRyxNQUFULENBQWdCLGNBQWhCLENBQVgsQ0FEZ0IsQ0FFaEI7O0FBQ0EsVUFBSSxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQU4sQ0FBVyxTQUFYLENBQVgsQ0FIZ0IsQ0FJaEI7O0FBRUEsTUFBQSxJQUFJLENBQUMsT0FBTCxDQUFhLElBQWI7QUFDQSxNQUFBLElBQUksQ0FBQyxPQUFM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bkI7QUFDSCxDQUZELEVBRUcsS0FGSCxDQUVTLFVBQUEsS0FBSyxFQUFJO0FBQ2Qsb0JBQU8sR0FBUCxDQUFXLE9BQVgsRUFBb0IsS0FBcEI7QUFDSCxDQUpEIiwiZmlsZSI6ImluZGV4ZTJmLWNvbXBpbGVkLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy9qc2hpbnQgZXN2ZXJzaW9uOiA2XHJcbmNvbnN0IGNyb24gPSByZXF1aXJlKFwibm9kZS1jcm9uXCIpO1xyXG5jb25zdCBleHByZXNzID0gcmVxdWlyZShcImV4cHJlc3NcIik7XHJcbmNvbnN0IGZzID0gcmVxdWlyZShcImZzXCIpO1xyXG5cclxuY29uc3QgdXVpZHY0ID0gcmVxdWlyZSgndXVpZC92NCcpO1xyXG5jb25zdCBkZWxheSA9IHJlcXVpcmUoJ2RlbGF5Jyk7XHJcbmNvbnN0IG1vbWVudCA9IHJlcXVpcmUoJ21vbWVudCcpO1xyXG5jb25zdCBmZXRjaCA9IHJlcXVpcmUoJ2lzb21vcnBoaWMtZmV0Y2gnKTtcclxuXHJcbi8vaW1wb3J0IG1vbWVudCBmcm9tIFwibW9tZW50XCI7XHJcbi8vIGltcG9ydCBcImlzb21vcnBoaWMtZmV0Y2hcIjtcclxuXHJcbmV4cG9ydCBjbGFzcyBMb2dnZXIge1xyXG4gICAgc3RhdGljIGxvZyh0eXBlLCBtZXNzYWdlKSB7XHJcbiAgICAgICAgc3dpdGNoICh0eXBlKSB7XHJcbiAgICAgICAgICAgIGNhc2UgXCJpbmZvXCI6XHJcbiAgICAgICAgICAgIExvZ2dlci5fd3JpdGUoXCJpbmZvXCIsbWVzc2FnZSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBcIndhcm5pbmdcIjpcclxuICAgICAgICAgICAgICAgIExvZ2dlci5fd3JpdGUoXCJ3YXJuaW5nXCIsbWVzc2FnZSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBcImVycm9yXCI6XHJcbiAgICAgICAgICAgICAgICBMb2dnZXIuX3dyaXRlKFwiZXJyb3JcIixtZXNzYWdlKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHN0YXRpYyBfd3JpdGUodHlwZSkge1xyXG4gICAgICAgIHZhciB0aW1lID0gbW9tZW50KCkuZm9ybWF0KFwiSEg6bW06c3MuU1NTXCIpO1xyXG4gICAgICAgIC8vYXJndW1lbnRzLnNwbGljZSgwKVxyXG4gICAgICAgIHZhciBhcmdzID0gQXJyYXkuZnJvbShhcmd1bWVudHMpO1xyXG4gICAgICAgIC8vYXJncy5zcGxpY2UoMCk7XHJcbiAgICBcclxuICAgICAgICBhcmdzLnVuc2hpZnQodGltZSk7XHJcbiAgICAgICAgYXJncy51bnNoaWZ0KHR5cGUudG9VcHBlckNhc2UoKSk7XHJcbiAgICAgICAgY29uc29sZS5sb2cuYXBwbHkoY29uc29sZSwgYXJncyk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBFMkZDcmF3bGVyIHtcclxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcclxuICAgICAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zIHx8IHt1cmw6ICcnLCBvdXRwdXQ6ICdqc29uJ307XHJcbiAgICB9XHJcblxyXG4gICAgcG9zdERhdGEoc2VhcmNoT3B0aW9uPXt1cmw6ICcnLCBkYXRhOiB7dXNySWQ6IDEwOSwgdXNyVHlwZTogJ04nfX0pIHtcclxuICAgICAgICAvLyBEZWZhdWx0IG9wdGlvbnMgYXJlIG1hcmtlZCB3aXRoICpcclxuICAgICAgICByZXR1cm4gZmV0Y2goc2VhcmNoT3B0aW9uLnVybCwge1xyXG4gICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLCAvLyAqR0VULCBQT1NULCBQVVQsIERFTEVURSwgZXRjLlxyXG4gICAgICAgICAgICBtb2RlOiBcImNvcnNcIiwgLy8gbm8tY29ycywgY29ycywgKnNhbWUtb3JpZ2luXHJcbiAgICAgICAgICAgIGNhY2hlOiBcIm5vLWNhY2hlXCIsIC8vICpkZWZhdWx0LCBuby1jYWNoZSwgcmVsb2FkLCBmb3JjZS1jYWNoZSwgb25seS1pZi1jYWNoZWRcclxuICAgICAgICAgICAgY3JlZGVudGlhbHM6IFwic2FtZS1vcmlnaW5cIiwgLy8gaW5jbHVkZSwgKnNhbWUtb3JpZ2luLCBvbWl0XHJcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxyXG4gICAgICAgICAgICAgICAgLy8gXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWRcIixcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcmVkaXJlY3Q6IFwiZm9sbG93XCIsIC8vIG1hbnVhbCwgKmZvbGxvdywgZXJyb3JcclxuICAgICAgICAgICAgcmVmZXJyZXI6IFwibm8tcmVmZXJyZXJcIiwgLy8gbm8tcmVmZXJyZXIsICpjbGllbnRcclxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoc2VhcmNoT3B0aW9uLmRhdGEpLCAvLyBib2R5IGRhdGEgdHlwZSBtdXN0IG1hdGNoIFwiQ29udGVudC1UeXBlXCIgaGVhZGVyXHJcbiAgICAgICAgfSlcclxuICAgICAgICAudGhlbihyZXNwb25zZSA9PiB7XHJcbiAgICAgICAgICAgIExvZ2dlci5sb2coXCJpbmZvXCIsIFwiUmVzcG9uc2UgcmVjZWl2ZWRcIik7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5qc29uKCk7XHJcbiAgICAgICAgfSlcclxuICAgICAgICAuY2F0Y2gocmVhc29uID0+IHtcclxuICAgICAgICAgICAgTG9nZ2VyLmxvZyhcImVycm9yXCIsIHJlYXNvbik7XHJcbiAgICAgICAgfSk7IC8vIHBhcnNlcyBKU09OIHJlc3BvbnNlIGludG8gbmF0aXZlIEphdmFzY3JpcHQgb2JqZWN0cyBcclxuICAgIH1cclxufVxyXG5cclxuLy8gZnVuY3Rpb24gcG9zdERhdGEoc2VhcmNoT3B0aW9uPXt1cmw6ICcnLCBkYXRhOiB7dXNySWQ6IDEwOSwgdXNyVHlwZTogJ04nfX0pIHtcclxuLy8gICAgIC8vIERlZmF1bHQgb3B0aW9ucyBhcmUgbWFya2VkIHdpdGggKlxyXG4vLyAgICAgcmV0dXJuIGZldGNoKHNlYXJjaE9wdGlvbi51cmwsIHtcclxuLy8gICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLCAvLyAqR0VULCBQT1NULCBQVVQsIERFTEVURSwgZXRjLlxyXG4vLyAgICAgICAgIG1vZGU6IFwiY29yc1wiLCAvLyBuby1jb3JzLCBjb3JzLCAqc2FtZS1vcmlnaW5cclxuLy8gICAgICAgICBjYWNoZTogXCJuby1jYWNoZVwiLCAvLyAqZGVmYXVsdCwgbm8tY2FjaGUsIHJlbG9hZCwgZm9yY2UtY2FjaGUsIG9ubHktaWYtY2FjaGVkXHJcbi8vICAgICAgICAgY3JlZGVudGlhbHM6IFwiaW5jbHVkZVwiLCAvLyBpbmNsdWRlLCAqc2FtZS1vcmlnaW4sIG9taXRcclxuLy8gICAgICAgICBoZWFkZXJzOiB7XHJcbi8vICAgICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxyXG4vLyAgICAgICAgICAgICAvLyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZFwiLFxyXG4vLyAgICAgICAgIH0sXHJcbi8vICAgICAgICAgcmVkaXJlY3Q6IFwiZm9sbG93XCIsIC8vIG1hbnVhbCwgKmZvbGxvdywgZXJyb3JcclxuLy8gICAgICAgICByZWZlcnJlcjogXCJjbGllbnRcIiwgLy8gbm8tcmVmZXJyZXIsICpjbGllbnRcclxuLy8gICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShzZWFyY2hPcHRpb24uZGF0YSksIC8vIGJvZHkgZGF0YSB0eXBlIG11c3QgbWF0Y2ggXCJDb250ZW50LVR5cGVcIiBoZWFkZXJcclxuLy8gICAgIH0pXHJcbi8vICAgICAudGhlbihyZXNwb25zZSA9PiB7XHJcbi8vICAgICAgICAgY29uc29sZS5sb2coXCJpbmZvXCIsIFwiUmVzcG9uc2UgcmVjZWl2ZWRcIik7XHJcbi8vICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKTtcclxuLy8gICAgIH0pXHJcbi8vICAgICAuY2F0Y2gocmVhc29uID0+IHtcclxuLy8gICAgICAgICBjb25zb2xlLmxvZyhcImVycm9yXCIsIHJlYXNvbik7XHJcbi8vICAgICB9KTsgLy8gcGFyc2VzIEpTT04gcmVzcG9uc2UgaW50byBuYXRpdmUgSmF2YXNjcmlwdCBvYmplY3RzIFxyXG4vLyB9XHJcblxyXG4vLyBsZXQgcmVzcCA9IHBvc3REYXRhKHt1cmw6ICdodHRwczovL2V4cHJlc3NkZXYuZWFzZTJmbHkuY29tL2FwaS9kZXN0aW5hdGlvbnMvZ2V0LWRlc3RpbmF0aW9ucy1saXN0JywgZGF0YToge1xyXG4vLyAgICAgdXNySWQ6IDEwOSxcclxuLy8gICAgIHVzclR5cGU6IFwiTlwiXHJcbi8vIH19KVxyXG4vLyAudGhlbihkYXRhID0+IHtcclxuLy8gICAgIC8vY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkoZGF0YS5yZXN1bHQpKTtcclxuLy8gICAgIHJldHVybiBkYXRhLnJlc3VsdDtcclxuLy8gfSlcclxuLy8gLmNhdGNoKGVycm9yID0+IHtcclxuLy8gICAgIGNvbnNvbGUubG9nKGVycm9yKTtcclxuLy8gfSk7XHJcblxyXG4vLyBjb25zb2xlLmxvZyhyZXNwKTsiLCIvL2pzaGludCBlc3ZlcnNpb246IDZcclxuY29uc3QgY3JvbiA9IHJlcXVpcmUoXCJub2RlLWNyb25cIik7XHJcbmNvbnN0IGV4cHJlc3MgPSByZXF1aXJlKFwiZXhwcmVzc1wiKTtcclxuY29uc3QgZnMgPSByZXF1aXJlKFwiZnNcIik7XHJcblxyXG5jb25zdCB1dWlkdjQgPSByZXF1aXJlKCd1dWlkL3Y0Jyk7XHJcbmNvbnN0IG1vbWVudCA9IHJlcXVpcmUoJ21vbWVudCcpO1xyXG5cclxuaW1wb3J0IHtMb2dnZXIsIEUyRkNyYXdsZXJ9IGZyb20gJy4vZTJmY3J3bGVyJztcclxuaW1wb3J0IHsgbG9nZ2VycyB9IGZyb20gJ3dpbnN0b24nO1xyXG5cclxuTG9nZ2VyLmxvZygnaW5mbycsIFwiU3RhcnRpbmcgcHJvY2VzcyAuLi5cIik7XHJcblxyXG5sZXQgZTJmY3Jhd2xlciA9IG5ldyBFMkZDcmF3bGVyKHt1cmw6ICcnLCBvdXRwdXQ6ICdqc29uJ30pO1xyXG5sZXQgcmVzcG9uc2UgPSBlMmZjcmF3bGVyLnBvc3REYXRhKHt1cmw6ICdodHRwczovL2V4cHJlc3NkZXYuZWFzZTJmbHkuY29tL2FwaS9kZXN0aW5hdGlvbnMvZ2V0LWRlc3RpbmF0aW9ucy1saXN0JywgZGF0YToge1xyXG4gICAgdXNySWQ6IDEwOSxcclxuICAgIHVzclR5cGU6IFwiTlwiXHJcbn19KTtcclxuXHJcbnJlc3BvbnNlLnRoZW4oZGF0YSA9PiB7XHJcbiAgICBMb2dnZXIubG9nKFwiaW5mb1wiLCBKU09OLnN0cmluZ2lmeShkYXRhLnJlc3VsdCkpOyAgICBcclxufSkuY2F0Y2goZXJyb3IgPT4ge1xyXG4gICAgTG9nZ2VyLmxvZyhcImVycm9yXCIsIGVycm9yKTtcclxufSk7Il19