package com.company;

public class Main {

    public static void main(String[] args) {
        socket = IO.socket("http://streaming.plenar.io");
        socket.on(Socket.EVENT_CONNECT, new Emitter.Listener() {

            @Override
            public void call(Object... args) {
                socket.emit("foo", "hi");
                socket.disconnect();
            }

        }).on("data", new Emitter.Listener() {

            @Override
            public void call(Object... args) {}

        }).on("internal_error", new Emitter.Listener() {

            @Override
            public void call(Object... args) {}

        });
        socket.connect();
    }
}