/**
 * $ npm install nodeunit -g
 *
 * $ nodeunit tests.js
 */

var socket_util = require('../app/socket_util');
var _ = require('underscore');

// default should be everything from array_of_things
exports.parse_empty_args = function (test) {
    var socket = {handshake: {query: {}}};
    var args = socket_util.parse_args(socket);

    test.ok(_.isEqual(args, {sensor_network: 'array_of_things'}));
    test.done();
};

// accounts for various query arg formats coming from Python and Node.js clients
exports.parse_args = function (test) {
    var socket1 = {
        handshake: {
            query: {
                sensor_network: 'array_of_things',
                sensors: '[HTU21D]',
                features_of_interest: '[temperature,humidity]',
                nodes: '[000,02B,011]'
            }
        }
    };
    var args1 = socket_util.parse_args(socket1);
    var socket2 = {
        handshake: {
            query: {
                sensor_network: 'array_of_things',
                sensors: 'HTU21D',
                features_of_interest: 'temperature,humidity',
                nodes: '000,02B,011'
            }
        }
    };
    var args2 = socket_util.parse_args(socket2);
    var socket3 = {
        handshake: {
            query: {
                sensor_network: 'array_of_things',
                sensors: ['HTU21D'],
                features_of_interest: ['temperature', 'humidity'],
                nodes: ['000', '02B', '011']
            }
        }
    };
    var args3 = socket_util.parse_args(socket3);

    var correct_args = {
        sensor_network: 'array_of_things',
        sensors: ['HTU21D'],
        features_of_interest: ['temperature', 'humidity'],
        nodes: ['000', '02B', '011']
    };

    test.ok(_.isEqual(args1, correct_args));
    test.ok(_.isEqual(args2, correct_args));
    test.ok(_.isEqual(args3, correct_args));
    test.done();
};

// check that validation query is generated correctly
exports.make_validation_query = function (test) {
    var args = {
        sensor_network: 'array_of_things',
        sensors: ['HTU21D'],
        features_of_interest: ['temperature', 'humidity'],
        nodes: ['000', '02B', '011']
    };
    test.equal(socket_util.make_validation_query(args),
        'http://' + process.env.PLENARIO_HOST + '/v1/api/sensor-networks/array_of_things/query?limit=0&' +
        'sensors=HTU21D&' +
        'features_of_interest=temperature,humidity&' +
        'nodes=000,02B,011');
    test.done();
};

// check that data is being correctly filtered to be sent to rooms
exports.filter_data = function (test) {
    var args = {
        sensor_network: 'array_of_things',
        sensors: ['HTU21D'],
        features_of_interest: ['temperature', 'humidity'],
        nodes: ['000', '02B', '011']
    };
    var room_name = JSON.stringify(args);

    // correct
    var data1 = {
        "node_id": "000",
        "node_config": "011ab78",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "HTU21D",
        "feature_of_interest": "temperature",
        "results": {
            temperature: 37.90
        }
    };
    // bad FoI
    var data2 = {
        "node_id": "000",
        "node_config": "011ab78",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "HTU21D",
        "feature_of_interest": "atmospheric_pressure",
        "results": {
            pressure: 87.22
        }
    };
    // bad node
    var data3 = {
        "node_id": "00C",
        "node_config": "011ab78",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "HTU21D",
        "feature_of_interest": "humidity",
        "results": {
            humidity: 67.31
        }
    };
    // bad sensor
    var data4 = {
        "node_id": "02B",
        "node_config": "011ab78",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "TGR67",
        "feature_of_interest": "humidity",
        "results": {
            humidity: 81.77
        }
    };

    test.ok(socket_util.valid_data(data1, room_name));
    test.ok(!socket_util.valid_data(data2, room_name));
    test.ok(!socket_util.valid_data(data3, room_name));
    test.ok(!socket_util.valid_data(data4, room_name));
    test.done();
};