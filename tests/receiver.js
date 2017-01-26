/**
 * simple testing script to connect a socket to the server
 * prints data, transport upgrades, and internal errors
 */

var io = require('socket.io-client');

var socket = io.connect('http://streaming.plenar.io?network=plenario_development');

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