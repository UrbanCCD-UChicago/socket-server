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
// send argument validation http requests to localhost:8080
process.env['PLENARIO_HOST'] = 'localhost:8080';

// run the socket server locally, listening on 8081
var index = require('../../app/index');

// test that data is received from mapper and sent to clients correctly
// the whole shabang - the complete rigmarole - tip to tail - soup to nuts
exports.send_receive_data = function (test) {
    // connect mock mapper to the socket server at localhost:8081
    var mapper = require('socket.io-client')('http://localhost:8081/',
        {query: 'consumer_token=test'});

    var http = require('http');
    var express = require('express');
    var app = express();
    var bodyParser = require('body-parser');
    app.use(bodyParser.json());

    // mock Plenario server will listen for http validation requests on 8080
    var plenario_server = http.createServer(app);
    plenario_server.listen(8080);

    // all valid test networks, nodes, features, sensors
    var networks = [
        "array_of_things",
        "internet_of_stuff"
    ];
    var nodes = {
        array_of_things: ['001', '002', '003'],
        internet_of_stuff: ['bb8']
    };
    var features = {
        array_of_things: ['temperature', 'relative_humidity', 'magnetic_field'],
        internet_of_stuff: ['temperature']
    };
    var sensors = {
        array_of_things: ['oss33', 'yuu99', 'htu21d', 'tmp112'],
        internet_of_stuff: ['tmp113']
    };

    // if user passes invalid network, nodes, features, or sensors, return error
    app.get('/v1/api/sensor-networks/:network/check', function (req, res) {
        var network = req.params.network.toLowerCase();
        if (networks.indexOf(network) >= 0 &&
            (req.query.nodes == undefined ||
            req.query.nodes.toLowerCase().split(',').every(function (node) {
                return nodes[network].indexOf(node) >= 0
            })) &&
            (req.query.features == undefined ||
            req.query.features.toLowerCase().split(',').every(function (feature) {
                return features[network].indexOf(feature) >= 0
            })) &&
            (req.query.sensors == undefined ||
            req.query.sensors.toLowerCase().split(',').every(function (sensor) {
                return sensors[network].indexOf(sensor) >= 0
            }))) {
            // just needs to return an empty array of invalid objects
            // in order to correctly validate each field
            res.json({
                data: [
                    {
                        field: "nodes",
                        invalid: []
                    },
                    {
                        field: "features",
                        invalid: []
                    },
                    {
                        field: "sensors",
                        invalid: []
                    }
                ]
            });
        }
        else {
            res.json({error: "Validation error!"});
        }
    });

    // all client args should be case insensitive
    var data1 = [];
    var socket1 = require('socket.io-client')('http://localhost:8081?' +
        'network=array_of_things&' +
        'nodes=001,002');
    socket1.on('data', function (data) {
        data1.push(data);
    });
    socket1.on('internal_error', function (err) {
        console.log(err);
        test.ok(false);
    });

    var data2 = [];
    var socket2 = require('socket.io-client')('http://localhost:8081?' +
        'network=array_of_things&' +
        'features=Temperature,Relative_Humidity');
    socket2.on('data', function (data) {
        data2.push(data);
    });
    socket2.on('internal_error', function (err) {
        console.log(err);
        test.ok(false);
    });

    var data3 = [];
    var socket3 = require('socket.io-client')('http://localhost:8081?' +
        'network=array_of_things&' +
        'sensors=TMP112,HTU21D');
    socket3.on('data', function (data) {
        data3.push(data);
    });
    socket3.on('internal_error', function (err) {
        console.log(err);
        test.ok(false);
    });

    var data4 = [];
    var socket4 = require('socket.io-client')('http://localhost:8081?' +
        'network=array_of_things&' +
        'nodes=001&' +
        'features=temperature&sensors=tmp112');
    socket4.on('data', function (data) {
        data4.push(data);
    });
    socket4.on('internal_error', function (err) {
        console.log(err);
        test.ok(false);
    });

    var data5 = [];
    var socket5 = require('socket.io-client')('http://localhost:8081?' +
        'network=internet_of_stuff&' +
        'nodes=BB8');
    socket5.on('data', function (data) {
        data5.push(data);
    });
    socket5.on('internal_error', function (err) {
        console.log(err);
        test.ok(false);
    });

    // should receive an internal_error due to invalid node ID
    var internal_error6 = false;
    var socket6 = require('socket.io-client')('http://localhost:8081?' +
        'network=array_of_things&' +
        'nodes=bad_node,001');
    socket6.on('data', function (data) {
        test.ok(false)
    });
    socket6.on('internal_error', function (err) {
        internal_error6 = true;
    });

    // should receive an internal_error due to invalid network
    var internal_error7 = false;
    var socket7 = require('socket.io-client')('http://localhost:8081?' +
        'network=bad_network');
    socket7.on('data', function (data) {
        test.ok(false)
    });
    socket7.on('internal_error', function (err) {
        internal_error7 = true;
    });

    // should receive an internal_error due to missing network parameter
    var internal_error8 = false;
    var socket8 = require('socket.io-client')('http://localhost:8081');
    socket8.on('data', function (data) {
        test.ok(false)
    });
    socket8.on('internal_error', function (err) {
        internal_error8 = true;
    });

    // emit data to socket server
    // all data fields coming from mapper are lowercase
    // sockets: 1
    mapper.emit('internal_data', {
        "network": "array_of_things",
        "node_id": "001",
        "node_config": "34",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "oss33",
        "feature": "magnetic_field",
        "results": {
            x: 4.3,
            y: 2.3,
            z: 7.7
        }
    });
    // sockets: 1
    mapper.emit('internal_data', {
        "network": "array_of_things",
        "node_id": "002",
        "node_config": "34",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "oss33",
        "feature": "magnetic_field",
        "results": {
            x: 4.3,
            y: 2.3,
            z: 7.7
        }
    });
    // sockets: 2
    mapper.emit('internal_data', {
        "network": "array_of_things",
        "node_id": "003",
        "node_config": "34",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "yuu99",
        "feature": "temperature",
        "results": {
            temperature: 89.02
        }
    });
    // sockets: 2
    mapper.emit('internal_data', {
        "network": "array_of_things",
        "node_id": "003",
        "node_config": "34",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "yuu99",
        "feature": "relative_humidity",
        "results": {
            humidity: 33.65
        }
    });
    // sockets: 2,3
    mapper.emit('internal_data', {
        "network": "array_of_things",
        "node_id": "003",
        "node_config": "34",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "htu21d",
        "feature": "relative_humidity",
        "results": {
            humidity: 31.67
        }
    });
    // sockets: 2,3
    mapper.emit('internal_data', {
        "network": "array_of_things",
        "node_id": "003",
        "node_config": "34",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "htu21d",
        "feature": "temperature",
        "results": {
            temperature: 77.54
        }
    });
    // sockets: 2,3
    mapper.emit('internal_data', {
        "network": "array_of_things",
        "node_id": "003",
        "node_config": "34",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "tmp112",
        "feature": "temperature",
        "results": {
            temperature: 99.72
        }
    });
    // sockets: 1,2,3,4
    mapper.emit('internal_data', {
        "network": "array_of_things",
        "node_id": "001",
        "node_config": "34",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "tmp112",
        "feature": "temperature",
        "results": {
            temperature: 57.8
        }
    });
    // sockets: 5
    mapper.emit('internal_data', {
        "network": "internet_of_stuff",
        "node_id": "bb8",
        "node_config": "145",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "tmp113",
        "feature": "temperature",
        "results": {
            temperature: 90.2
        }
    });
    // nobody should receive this
    mapper.emit('internal_data', {
        "network": "array_of_things",
        "node_id": "004",
        "node_config": "34",
        "datetime": "2016-08-05T00:00:08.246000",
        "sensor": "oss33",
        "feature": "magnetic_field",
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
        test.equals(data5.length, 1);
        test.ok(internal_error6);
        test.ok(internal_error7);
        test.ok(internal_error8);
        test.done();
    }, 3000);
};
