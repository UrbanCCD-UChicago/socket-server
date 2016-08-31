var util = require('util');
var http = require('http');
var os = require('os');
var fs = require('fs');

// TODO: check that this function parses args from Java clients correctly
// it works for Node.js and Python
/**
 * take in client arguments from query.args in the initial handshake
 * generate a formatted dictionary of arguments for data filtering
 *
 * @param {socket} socket
 * @return {Object} args
 */
var parse_args = function (socket) {
    var args = {};
    if (socket.handshake.query.nodes) {
        var nodes = socket.handshake.query.nodes;
        if (!Array.isArray(nodes)) {
            nodes = nodes.replace('[', '');
            nodes = nodes.replace(']', '');
            nodes = nodes.split(',');
        }
        args.nodes = nodes
    }
    if (socket.handshake.query.features_of_interest) {
        var features = socket.handshake.query.features_of_interest;
        if (!Array.isArray(features)) {
            features = features.replace('[', '');
            features = features.replace(']', '');
            features = features.split(',');
        }
        args.features_of_interest = features
    }
    if (socket.handshake.query.sensors) {
        var sensors = socket.handshake.query.sensors;
        if (!Array.isArray(sensors)) {
            sensors = sensors.replace('[', '');
            sensors = sensors.replace(']', '');
            sensors = sensors.split(',');
        }
        args.sensors = sensors
    }
    // if user doesn't pass any args, or doesn't pass a sensor_network arg,
    // stream them everything from ObservationStream

    // since ObservationStream is assumed to carry only AoT data,
    // setting the sensor_network does not filter streaming results - it is only used in validation
    if (!(socket.handshake.query.sensor_network)) {
        args.sensor_network = 'array_of_things'
    }
    else {
        args.sensor_network = socket.handshake.query.sensor_network
    }
    return args
};

/**
 * send a GET request to the query API that will return no data, but will identify validation errors
 *
 * @param {Object} args
 * @return {Promise} p yields nothing on fulfillment, yields parsing errors on rejection
 */
var validate_args = function (args) {
    var p = new Promise(function (fulfill, reject) {
        var validation_query = make_validation_query(args);
        http.get(validation_query, function (response) {
            var output = '';
            response.on('data', function (data) {
                output += data;
            });
            response.on('end', function () {
                // if the plenar.io query API throws an error,
                // JSON.parse will try to parse the html error page and fail
                try {
                    if (JSON.parse(output).error) {
                        reject(JSON.parse(output).error);
                    }
                    else {
                        fulfill(output);
                    }
                }
                catch (err) {
                    reject('Error parsing validation query return. ' + err);
                }
            });
        });
    });
    return p
};

/**
 * generate validation query for query API
 *
 * @param: {Object} args
 */
var make_validation_query = function (args) {
    var validation_query = util.format('http://' + process.env.PLENARIO_HOST + '/v1/api/sensor-networks/%s/query?limit=0', args.sensor_network);
    for (var i = 0; i < Object.keys(args).length; i++) {
        if (Object.keys(args)[i] != 'sensor_network') {
            validation_query += '&' + Object.keys(args)[i] + '=' + args[Object.keys(args)[i]]
        }
    }
    return validation_query
};

/**
 * log performance data JSON to file in /var/app/current
 *
 * @param: {Integer} socket_count
 */
var log_performance = function (socket_count) {
    fs.appendFile('performance.log', JSON.stringify({
            loadavg: os.loadavg(),
            freemem: os.freemem(),
            sockets: socket_count,
            time: Date.now()
        }) + os.EOL)
};


module.exports.parse_args = parse_args;
module.exports.validate_args = validate_args;
module.exports.log_performance = log_performance;
module.exports.make_validation_query = make_validation_query;