/**
 * testing script to slowly connect 500 client sockets to the server
 * (without overburdening your laptop lol)
 */

var io = require('socket.io-client');
var os = require('os');

var num_sockets = 500;

function open_socket() {
    var socket = io.connect('http://streaming.plenar.io');

    socket.on('data', function (data) {
        console.log(data);
    });
    socket.on('internal_error', function (err) {
        console.log(err);
    });
}

function open_recurse(count) {
    setTimeout(function() {
        open_socket();
        console.log('sockets open:' + count);
        console.log('load average:' + os.loadavg()[0]);
        if (os.loadavg()[0] < 5 && count < num_sockets) {
            count++;
            open_recurse(count)
        }
    }, 700)
}

open_recurse(1);