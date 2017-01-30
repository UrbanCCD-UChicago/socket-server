var util = require('util');
var http = require('http');
var os = require('os');
var fs = require('fs');


/**
 * Encode an object to a URI string of query parameters.
 *
 * @param: {Object} o
 */
function encode(o) {
  var str = [];
  for (var p in o)
    if (o.hasOwnProperty(p))
      str.push(encodeURIComponent(p) + "=" + encodeURIComponent(o[p]));
  return str.join("&");
}


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

        var network = args.network;
        delete args.network;

        var host = 'http://' + process.env.PLENARIO_HOST;
        var checkEndpoint = host + '/v1/api/sensor-networks/' + network + '/check';
        var request = checkEndpoint + '?' + encode(args);

        http.get(request, function (response) {
            if (response.statusCode === 200) {
                fulfill();
            }
            
            var output = '';
            response.on('data', function(data) { output += data; });
            response.on('end', function() {
                var responseMessage = JSON.parse(output);
                reject(responseMessage);
            })
        });
    });
    return p
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
module.exports.log_performance = log_performance;
