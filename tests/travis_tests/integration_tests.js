/**
 * to run these tests:
 *
 * $ npm install nodeunit -g
 *
 * $ nodeunit integration_tests.js
 */

// don't produce an application.log file with server performance data
process.env['PERFORMANCE_TEST'] = 'FALSE';
// don't throttle mock clients
process.env['MAX_SOCKETS'] = 1000;
// set the authentication token that the mapper/consumer uses
process.env['CONSUMER_TOKEN'] = 'test';
// send arg validation http requests to localhost:8080
process.env['PLENARIO_HOST'] = 'localhost:8080';

// run the socket server locally, listening on 8081
var index = require('../../app/index');

// test that data is received from mapper and sent to clients correctly
// the whole shabang - the complete rigmarole - tip to tail - soup to nuts
exports.send_receive_data = function (test) {
    // connect mock mapper to localhost:8081
    var mapper = require('socket.io-client')('http://localhost:8081/', {query: 'consumer_token=' + process.env.CONSUMER_TOKEN});

    var http = require('http');
    var express = require('express');
    var app = express();
    var bodyParser = require('body-parser');
    app.use(bodyParser.json());

    // mock Plenario server will listen for http validation requests on 8080
    var plenario_server = http.createServer(app);
    plenario_server.listen(8080);

    // if user passes invalid nodes, features, or sensors, return error
    var nodes = ['001', '002', '003'];
    var features = ['temperature', 'relative_humidity', 'magnetic_field'];
    var sensors = ['oss33', 'yuu99', 'htu21d', 'tmp112'];
    app.get('/v1/api/sensor-networks/array_of_things/query', function (req, res) {
        if (req.query.nodes) {
            req.query.nodes = req.query.nodes.split(',');
        }
        if (req.query.features_of_interest) {
            req.query.features_of_interest = req.query.features_of_interest.split(',');
        }
        if (req.query.sensors) {
            req.query.sensors = req.query.sensors.split(',');
        }
        if ((!req.query.nodes || (req.query.nodes && req.query.nodes.every(function (n) {
                return (nodes.indexOf(n) >= 0)
            })))
            && (!req.query.features_of_interest || (req.query.features_of_interest && req.query.features_of_interest.every(function (f) {
                return (features.indexOf(f) >= 0)
            })))
            && (!req.query.sensors || (req.query.sensors && req.query.sensors.every(function (s) {
                return (sensors.indexOf(s) >= 0)
            })))) {
            res.json({data: []});
        }
        else {
            res.json({error: "Validation error!"});
        }
    });

    // all client args should be case insensitive
    var data1 = [];
    var socket1 = require('socket.io-client')('http://localhost:8081?nodes=001,002');
    socket1.on('data', function (data) {
        data1.push(data);
    });
    socket1.on('internal_error', function (err) {
        console.log(err);
        test.ok(false);
    });
    var data2 = [];
    var socket2 = require('socket.io-client')('http://localhost:8081?features_of_interest=Temperature,Relative_Humidity');
    socket2.on('data', function (data) {
        data2.push(data);
    });
    socket2.on('internal_error', function (err) {
        console.log(err);
        test.ok(false);
    });
    var data3 = [];
    var socket3 = require('socket.io-client')('http://localhost:8081?sensors=TMP112,HTU21D');
    socket3.on('data', function (data) {
        data3.push(data);
    });
    socket3.on('internal_error', function (err) {
        console.log(err);
        test.ok(false);
    });
    var data4 = [];
    var socket4 = require('socket.io-client')('http://localhost:8081?nodes=001&features_of_interest=temperature&sensors=tmp112');
    socket4.on('data', function (data) {
        data4.push(data);
    });
    socket4.on('internal_error', function (err) {
        console.log(err);
        test.ok(false);
    });
    // should receive an internal_error due to invalid node ID
    var internal_error = false;
    var socket5 = require('socket.io-client')('http://localhost:8081?nodes=bad_node');
    socket5.on('data', function (data) {
        test.ok(false)
    });
    socket5.on('internal_error', function (err) {
        internal_error = true;
    });

    // emit data to socket server
    mapper.emit('internal_data', {
        "node_id": "001",
        "node_config": "34",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "oss33",
        "feature_of_interest": "magnetic_field",
        "results": {
            x: 4.3,
            y: 2.3,
            z: 7.7
        }
    });
    mapper.emit('internal_data', {
        "node_id": "002",
        "node_config": "34",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "oss33",
        "feature_of_interest": "magnetic_field",
        "results": {
            x: 4.3,
            y: 2.3,
            z: 7.7
        }
    });
    mapper.emit('internal_data', {
        "node_id": "003",
        "node_config": "34",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "yuu99",
        "feature_of_interest": "temperature",
        "results": {
            temperature: 89.02
        }
    });
    mapper.emit('internal_data', {
        "node_id": "003",
        "node_config": "34",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "yuu99",
        "feature_of_interest": "relative_humidity",
        "results": {
            humidity: 33.65
        }
    });
    mapper.emit('internal_data', {
        "node_id": "003",
        "node_config": "34",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "htu21d",
        "feature_of_interest": "relative_humidity",
        "results": {
            humidity: 31.67
        }
    });
    mapper.emit('internal_data', {
        "node_id": "003",
        "node_config": "34",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "htu21d",
        "feature_of_interest": "temperature",
        "results": {
            temperature: 77.54
        }
    });
    mapper.emit('internal_data', {
        "node_id": "003",
        "node_config": "34",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "tmp112",
        "feature_of_interest": "temperature",
        "results": {
            temperature: 99.72
        }
    });
    mapper.emit('internal_data', {
        "node_id": "001",
        "node_config": "34",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "tmp112",
        "feature_of_interest": "temperature",
        "results": {
            temperature: 57.8
        }
    });
    // nobody should receive this
    mapper.emit('internal_data', {
        "node_id": "004",
        "node_config": "34",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "oss33",
        "feature_of_interest": "magnetic_field",
        "results": {
            x: 4.3,
            y: 2.3,
            z: 7.7
        }
    });

    setTimeout(function () {
        test.equals(data1.length, 3);
        test.equals(data2.length, 6);
        test.equals(data3.length, 4);
        test.equals(data4.length, 1);
        test.ok(internal_error);
        test.done();
    }, 3000);
};
