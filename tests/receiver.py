# simple testing script to connect a socket to the server
# receive data and internal errors

import json
from socketIO_client import SocketIO


def on_data(data):
    print json.dumps(data)


def on_error(err):
    print json.dumps(err)


def open_client():
    socketIO = SocketIO("streaming.plenar.io")

    socketIO.on('data', on_data)
    socketIO.on('internal_error', on_error)
    socketIO.wait()
