/**
 * simple testing script to connect a socket to the server
 * prints data, transport upgrades, and internal errors
 */

var io = require('socket.io-client');

var socket = io.connect('http://localhost:8081?sensor_network=plenario_development&' +
    'nodes=node_dev_1,node_dev_2&' +
    'sensors=sensor_dev_1,sensor_dev_2,sensor_dev_3,sensor_dev_4&' +
    'features=magnetic_field,gas_concentration,temperature,relative_humidity');

socket.on('data', function (data) {
    console.log(data);
});
socket.io.engine.on('upgrade', function(transport){
    console.log('upgraded to:');
    console.log(transport.query.transport);
});
socket.on('internal_error', function (err) {
    console.log(err);
});