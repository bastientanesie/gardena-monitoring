"use strict";

const debug = require('debug')('gardena:webserver');
const debugIo = require('debug')('gardena:io');
const http = require('http');
const express = require('express');
const cors = require('cors');
const EventEmitter = require('events');
const bodyParser = require('body-parser');
const initSocketIo = require('socket.io');
const {
    SOCKET_ORIGINS,
    SOCKET_EVENT_CONNECTED
} = require('./constants');

class WebServer extends EventEmitter {
    /**
     * @param {Notifier} notifier
     * @returns {Server}
     */
    constructor(notifier) {
        super();

        const app = express();
        this._port = 5555;
        app.use(cors());
        app.use(bodyParser.json());

        app.get('/', (req, res) => {
            res.json({
                message: 'Hello World!',
                subscriptions: notifier.getSubscriptionCount()
            });
        });

        app.post('/subscribe', (req, res) => {
            notifier.addSubscription(req.body);
            res.json({ message: 'success' });
        });

        app.get('/send', async (req, res) => {
            const messageCount = await notifier.broadcast('Hello World');
            if (messageCount < 1) {
                return res.json({ message: 'no subscriptions' });
            }
            return res.json({ message: `${messageCount} messages sent` });
        });

        this._server = http.createServer(app);
        this._socket = this._createSocketServer(this._server);
    }

    /**
     * @returns {Server} Socket.io Server
     */
    start() {
        this._server.listen(this._port, () => {
            debug('Listening on port %s', this._port);
        });
    }

    /**
     * @param {Array<Object>} updatedDevices
     */
    broadcastSocketUpdate(updatedDevices) {
        this._socket.sockets.emit('update', updatedDevices);
    }

    /**
     * @param {Server} httpServer
     * @returns {Server} Socket.io Server
     * @private
     */
    _createSocketServer(httpServer) {
        /** @type {Server} */
        const socket = initSocketIo(httpServer);
        socket.origins(SOCKET_ORIGINS);

        socket.on('connection', (client) => {
            this.emit(SOCKET_EVENT_CONNECTED, (devices) => {
                client.emit('update', devices);
            });

            /* @var {Socket} client */
            debugIo('New connection');

            client.on('register', (...args) => {
                debugIo('Register: %O', args);
            });
            client.on('event', (...args) => {
                debugIo('Event: %O', args);
            });
            client.on('disconnect', () => {
                debugIo('Disconnected',);
            });
        });

        return socket;
    }
}

module.exports = WebServer;