const socketClient = require('socket.io-client');
const socket = socketClient('http://localhost:8081?network=array_of_things_chicago', {
    transports: ['websocket']
})
.on('internal_error', console.log)
.on('data', console.log);