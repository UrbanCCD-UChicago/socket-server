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
    var q = socket.handshake.query;
    Object.keys(q).forEach(function (key) {
        if (key != 'EIO' && key != 'b64' && key != 't' && key != 'transport') {
            if (typeof q[key] == 'object') {
                args[key] = q[key];
            }
            else {
                try {
                    args[key] = JSON.parse(q[key]);
                }
                catch (err) {
                    args[key] = q[key].split(',');
                }
            }
        }
    });
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
    console.log(args);
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
        console.log(validation_query(args));
        http.get(validation_query(args), function (response) {
            var output = '';
            response.on('data', function (data) {
                output += data;
            });
            response.on('end', function () {
                // if the plenar.io query API throws an error,
                // JSON.parse will try to parse the html error page and fail
                try {
                    if (JSON.parse(output).error) {
                        reject({error: JSON.parse(output).error});
                    }
                    else {
                        fulfill(output);
                    }
                }
                catch (err) {
                    reject({error: 'Error parsing validation query return. ' + err});
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
var validation_query = function (args) {
    var validation_query = util.format('http://' + process.env.PLENARIO_HOST + '/v1/api/sensor-networks/%s/query?limit=0', args.sensor_network);
    Object.keys(args).forEach(function (key) {
        if (key != 'sensor_network') {
            validation_query += '&' + key + '=' + args[key]
        }
    });
    return validation_query
};

/**
 * check if consumer should emit a given data event to a certain room
 *
 * @param: {Object} data
 * @param: {String} room_name = stringified JSON of arguments used to filter data
 */
var valid_data = function(data, room_name) {
    var room_args = JSON.parse(room_name);
    return (((!room_args.nodes) || (room_args.nodes.indexOf(data.node_id) >= 0)) &&
    ((!room_args.features_of_interest) || (room_args.features_of_interest.indexOf(data.feature_of_interest) >= 0)) &&
    ((!room_args.sensors) || (room_args.sensors.indexOf(data.sensor) >= 0)))
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
module.exports.validation_query = validation_query;
module.exports.valid_data = valid_data;
