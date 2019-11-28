"use strict";

const debug = require('debug')('gardena');
const fs = require('fs');
const OauthAdapter = require('./OauthAdapter');
const GardenaAdapter = require('./GardenaAdapter');
const Mower = require('./Mower');
const WebsocketHandler = require('./WebsocketHandler');
const {
    DB_FILEPATH,
    ACCESS_TOKEN_FILEPATH,
    WEBSOCKET_EVENT_DISCONNECTED,
    WEBSOCKET_EVENT_MOWER_CHANGE,
    MOWER_STATE,
    MOWER_ACTIVITY,
    MOWER_ERROR
} = require('./constants');

class Monitor {
    /**
     * @param {Notifier} notifier
     * @param {String} oauthEndpoint
     * @param {String} gardenaEndpoint
     * @param {String} apiKey
     */
    constructor(
        notifier,
        oauthEndpoint,
        gardenaEndpoint,
        apiKey
    ) {
        this._notifier = notifier;
        this._devices = new Map([]);
        this._locations = new Map([]);
        this._jwt = null;
        this._gardenaEndpoint = gardenaEndpoint;
        this._apiKey = apiKey;

        this._oauth = new OauthAdapter(
            oauthEndpoint,
            apiKey,
            ACCESS_TOKEN_FILEPATH
        );
    }

    /**
     * @param {String} username Gardena account username
     * @param {String} password Gardena account password
     * @returns {Promise<void>}
     */
    async start(username, password) {
        try {
            this._jwt = await this._oauth.getAccessToken(username, password);
        } catch (error) {
            debug(`Error: failed to obtain access token: %s`, error);
            return;
        }

        const gardena = new GardenaAdapter(
            this._gardenaEndpoint,
            this._apiKey,
            this._jwt.access_token
        );

        if (fs.existsSync(DB_FILEPATH)) {
            this._loadStateFromFile();
        }
        else {
            try {
                for (let location of await gardena.getLocations()) {
                    this._locations.set(location.id, location);
                }
            } catch (error) {
                debug(`Error: failed to fetch locations: %s`, error);
                return;
            }
        }

        this._setupAutosave(30);

        // Lancement de la boucle de websockets
        for (let location of Array.from(this._locations.values())) {
            debug('Location "%s": %s', location.attributes.name, location.id);
            this._launchWebSocketLoop(gardena, location.id, this._onMowerEvent);
        }
    }

    /**
     * @private
     */
    _loadStateFromFile() {
        const state = JSON.parse(
            fs.readFileSync(DB_FILEPATH).toString()
        );

        state.devices.forEach((device) => {
            this._devices.set(
                device.id,
                Mower.fromJson(device)
            );
        });

        state.locations.forEach((location) => {
            this._locations.set(location.id, location);
        });

        this._notifier.populateFromJson(state.notifier.subscriptions);
        debug(`Database loaded`);
    }

    /**
     * Persiste l'état actuel dans un fichier
     */
    persistStateToFile() {
        const deviceArray = Array.from(this._devices.values()).map(
            (device) => device.serialize()
        );
        const locationArray = Array.from(this._locations.values());
        const json = JSON.stringify({
            devices: deviceArray,
            locations: locationArray,
            notifier: this._notifier.serialize()
        }, null, 2);
        fs.writeFileSync(DB_FILEPATH, json, { flag: 'w' });
    }

    /**
     * Lance la sauvegarde automatique régulière
     * @param {Number} intervalInSeconds
     * @private
     */
    _setupAutosave(intervalInSeconds) {
        setInterval(() => {
            this.persistStateToFile();
            debug('Database auto-saved');
        }, intervalInSeconds * 1000);
    }

    /**
     * @param {GardenaAdapter} gardenaAdapter
     * @param {String} locationId
     * @param {Function} mowerEventListener
     * @returns {Promise<void>}
     * @private
     */
    async _launchWebSocketLoop(gardenaAdapter, locationId, mowerEventListener) {
        const websocket = await gardenaAdapter.getWebsocket(locationId);
        const handler = new WebsocketHandler(
            this._devices,
            websocket.attributes.url,
            mowerEventListener
        );

        handler.on(WEBSOCKET_EVENT_DISCONNECTED, async () => {
            await this._launchWebSocketLoop(...arguments);
        });
        handler.on(WEBSOCKET_EVENT_MOWER_CHANGE, (...args) => this._onMowerEvent(...args));
    }

    /**
     * @param {String} eventType
     * @param {Object|string} eventData
     * @returns {Function<Promise>}
     * @private
     */
    async _onMowerEvent(eventType, eventData) {
        switch (eventType) {
            case MOWER_STATE:
                return this._notifier.broadcast(`Nouvel état : ${eventData}`);
            case MOWER_ACTIVITY:
                return this._notifier.broadcast(`Nouvelle activité : ${eventData}`);
            case MOWER_ERROR:
                return this._notifier.broadcast(`Nouvelle erreur : ${eventData}`);
            default:
                debug('Unhandled event %s: %o', eventType, eventData);
        }
    }
}

module.exports = Monitor;