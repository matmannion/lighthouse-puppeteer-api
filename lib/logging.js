const fs = require('fs');
const logstashAppender = require('log4js-node-clogs');

let log4js = {
    getLogger: function (name) {
        throw new Error("logging.initialise has not been called");
    },
    configure: function (filename) {
    }
};

try {
  fs.statSync('logs').isDirectory();
} catch (e) {
  if (e.code === 'ENOENT') fs.mkdirSync('logs');
}

function initialiseBuildfile() {
    log4js = require('log4js');
    return exports;
}
exports.initialiseBuildfile = initialiseBuildfile;

function initialise(options) {
    log4js = require('log4js');
    var environment = options.environment;
    log4js.loadAppender('logstash', logstashAppender);
    log4js.configure('logging-' + environment + '.json');
    return exports;
}
exports.initialise = initialise;

function getLogger(name) {
    return log4js.getLogger(name || 'app');
}
exports.getLogger = getLogger;

function connectLogger() {
    const logger = log4js.getLogger('web');
    return log4js.connectLogger(logger, { level: log4js.levels.INFO });
}
exports.connectLogger = connectLogger;

function connectLogstashLogger() {
    const logger = log4js.getLogger('request');
    return function(req, res, next) {
      logstashAppender.parseExpress(req, res, logger);
      next();
    }
}
exports.connectLogstashLogger = connectLogstashLogger;

function getAuditLogger() {
  return logstashAppender.getAuditLogger(log4js);
}
exports.getAuditLogger = getAuditLogger;

exports.requestInfo = logstashAppender.requestInfo;

exports.auditEventType = {
  lighthouse: 'LIGHTHOUSE',
};
