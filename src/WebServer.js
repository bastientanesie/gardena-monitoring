"use strict";

const debug = require('debug')('gardena:webserver');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

class WebServer {

    /**
     * @param {Notifier} notifier
     */
    constructor(notifier) {
        this._app = express();
        this._port = 5555;
        this._app.use(cors());
        this._app.use(bodyParser.json());

        this._app.get('/', (req, res) => {
            res.json({
                message: 'Hello World!',
                subscriptions: notifier.getSubscriptionCount()
            });
        });

        this._app.post('/subscribe', (req, res) => {
            notifier.addSubscription(req.body);
            res.json({ message: 'success' });
        });

        this._app.get('/send', async (req, res) => {
            const messageCount = await notifier.broadcast('Hello World');
            if (messageCount < 1) {
                return res.json({ message: 'no subscriptions' });
            }
            return res.json({ message: `${messageCount} messages sent` });
        });
    }

    start() {
        this._app.listen(this._port, () => {
            debug('Listening on port %s', this._port);
        });
    }
}

module.exports = WebServer;