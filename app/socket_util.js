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
 * @param {Object} input_args = socket.handshake.query
 * @return {Object} args
 */
var parse_args = function (input_args) {
    var args = {network: input_args.network.toLowerCase()};
    Object.keys(input_args).forEach(function (key) {
        if (key != 'EIO' && key != 'b64' && key != 't' && key != 'transport'  && key != 'network') {
            if (typeof input_args[key] == 'object') {
                args[key] = input_args[key].toString().toLowerCase().split(',');
            }
            else {
                try {
                    args[key] = JSON.parse(input_args[key]).toString().toLowerCase().split(',');
                }
                catch (err) {
                    input_args[key] = input_args[key].toLowerCase();
                    input_args[key] = input_args[key].replace('[','');
                    input_args[key] = input_args[key].replace(']','');
                    args[key] = input_args[key].split(',');
                }
            }
        }
    });
    return args
};

/**
 * validate all user parameters
 *
 * @param: {Object} args
 */
var validate_args = function (args) {
    var p = new Promise(function (fulfill, reject) {
        http.get(check_query(args), function (response) {
            var output = '';
            response.on('data', function (data) {
                output += data;
            });
            response.on('end', function () {
                // if the plenar.io query API throws an error,
                // JSON.parse will try to parse the html error page and fail
                try {
                    output = JSON.parse(output);
                    if (output.error) {
                        reject({error: output.error});
                    }
                    else {
                        // check if all input values are in the returned metadata JSON
                        for (var i = 0; i < output.data.length; i++){
                            if (output.data[i].invalid.length > 0) {
                                reject({error: 'Invalid ' + output.data[i].field +
                                               ' name(s): ' + output.data[i].invalid})
                            }
                        }
                        fulfill({});
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
 * generate validation query for /check endpoint
 *
 * @param: {Object} formatted user args
 */
var check_query = function (args) {
    var query = util.format('http://' + process.env.PLENARIO_HOST + '/v1/api/sensor-networks/%s/check?', args.network);
    Object.keys(args).forEach(function (key) {
        if (key != 'network') {
            query += '&' + key + '=' + args[key].toString();
        }
    });
    return query
};

/**
 * check if consumer should emit a given data event to a certain room
 *
 * @param: {Object} data
 * @param: {String} room_name = stringified JSON of arguments used to filter data
 */
var valid_data = function(data, room_name) {
    var room_args = JSON.parse(room_name);
    return (room_args.network == data.network &&
    ((!room_args.nodes) || (room_args.nodes.indexOf(data.node_id) >= 0)) &&
    ((!room_args.features) || (room_args.features.indexOf(data.feature) >= 0)) &&
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
        }) + ',' + os.EOL)
};

module.exports.parse_args = parse_args;
module.exports.validate_args = validate_args;
module.exports.check_query = check_query;
module.exports.log_performance = log_performance;
module.exports.valid_data = valid_data;
