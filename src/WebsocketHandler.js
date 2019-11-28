"use strict";

const debug = require('debug')('gardena:websocket');
const WebSocket = require('ws');
const Mower = require('./Mower');
const {
    WEBSOCKET_EVENT_DISCONNECTED,
    WEBSOCKET_EVENT_MOWER_CHANGE,
    MOWER_EVENT_CHANGE
} = require('./constants');
const EventEmitter = require('events');

class WebsocketHandler extends EventEmitter {
    /**
     * @param {Map} devices
     * @param {String} websocketUrl
     * @param {Function} mowerEventListener
     */
    constructor(devices, websocketUrl, mowerEventListener) {
        super();

        this._devices = devices;
        this._socket = new WebSocket(websocketUrl);

        this._socket.on('open', () => {
            debug(`connected`);
        });

        this._socket.on('close', () => {
            debug(`disconnected`);
            this.emit(WEBSOCKET_EVENT_DISCONNECTED);
        });

        this._socket.on('message', (data) => {
            const event = JSON.parse(data);
            const type = event.type.charAt(0).toUpperCase() + event.type.slice(1).toLowerCase();

            const mower = this._getOrCreateMower(event.id);

            if (this[`_handle${type}`] && typeof this[`_handle${type}`] === 'function') {
                debug('Event: %s', type);
                this[`_handle${type}`].call(this, event, mower);
            } else {
                debug('Event: %s (Generic) ', type);
                debug('%o', event);
            }
        });
    }

    _handleLocation(event, mower) {
        // debug('Location: %s', event.attributes.name);
    }

    _handleDevice(event, mower) {
        // debug('Device: %s', event.id);
    }

    _handleCommon(event, mower) {
        if (! event.hasOwnProperty('attributes')) {
            throw new Error(`Unexpected "common" event format : ${JSON.stringify(event)}`);
        }

        if (event.attributes.hasOwnProperty('name')) { // UserDefinedNameWrapper
            mower.name = event.attributes.name.value;
        }
        if (event.attributes.hasOwnProperty('serial')) { // SerialNumberWrapper
            mower.serial = event.attributes.serial.value;
        }
        if (event.attributes.hasOwnProperty('modelType')) { // DeviceModel
            mower.modelType = event.attributes.modelType.value;
        }
        if (event.attributes.hasOwnProperty('batteryLevel')) { // TimestampedPercent
            mower.addBatteryLevel(
                parseInt(event.attributes.batteryLevel.value),
                new Date(event.attributes.batteryLevel.timestamp)
            );
        }
        if (event.attributes.hasOwnProperty('batteryState')) { // TimestampedBatteryState
            mower.addBatteryState(
                event.attributes.batteryState.value,
                new Date(event.attributes.batteryState.timestamp)
            );
        }
        if (event.attributes.hasOwnProperty('rfLinkLevel')) { // TimestampedPercent
            mower.addRfLinkLevel(
                parseInt(event.attributes.rfLinkLevel.value),
                new Date(event.attributes.rfLinkLevel.timestamp)
            );
        }
        if (event.attributes.hasOwnProperty('rfLinkState')) { // TimestampedRFLinkState
            mower.addRfLinkState(
                event.attributes.rfLinkState.value, // RFLinkState
                event.attributes.rfLinkState.timestamp
                    ? new Date(event.attributes.rfLinkState.timestamp)
                    : new Date()
            );
        }
    }

    _handleMower(event, mower) {
        if (! event.hasOwnProperty('attributes')) {
            throw new Error(`Unexpected "mower" event format : ${JSON.stringify(event)}`);
        }

        if (event.attributes.hasOwnProperty('state')) { // TimestampedServiceState
            mower.addState(
                event.attributes.state.value, // ServiceState
                new Date(event.attributes.state.timestamp)
            );
        }
        if (event.attributes.hasOwnProperty('activity')) { // TimestampedMowerActivity
            mower.addActivity(
                event.attributes.activity.value, // MowerActivity
                new Date(event.attributes.activity.timestamp)
            );
        }
        if (event.attributes.hasOwnProperty('lastErrorCode')) { // TimestampedMowerError
            mower.addError(
                event.attributes.lastErrorCode.value, // MowerError
                new Date(event.attributes.lastErrorCode.timestamp)
            );
        }
        if (event.attributes.hasOwnProperty('operatingHours')) { // HoursWrapper
            mower.operatingHours = parseInt(event.attributes.operatingHours.value);
        }
    }

    /**
     * @param {String} deviceId
     * @returns {Mower}
     * @private
     */
    _getOrCreateMower(deviceId) {
        let mower = null;
        if (this._devices.has(deviceId) === true) {
            mower = this._devices.get(deviceId);
        }
        else {
            mower = new Mower(deviceId);
            this._devices.set(deviceId, mower);
        }

        if (mower.listenerCount(MOWER_EVENT_CHANGE) < 1) {
            mower.on(MOWER_EVENT_CHANGE, (type, data) => {
                debug('mower event', type);
                this.emit(WEBSOCKET_EVENT_MOWER_CHANGE, type, data);
            });
        }

        return mower;
    }
}

module.exports = WebsocketHandler;
