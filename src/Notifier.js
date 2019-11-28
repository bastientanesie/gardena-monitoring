"use strict";

const debug = require('debug')('gardena:notifier');
const webpush = require('web-push');

class Notifier {
    /**
     * @param {String} vapidPublicKey
     * @param {String} vapidPrivateKey
     * @param {String} vapidEmail
     */
    constructor(vapidPublicKey, vapidPrivateKey, vapidEmail) {
        webpush.setVapidDetails(
            `mailto:${vapidEmail}`,
            vapidPublicKey,
            vapidPrivateKey
        );

        this._subscriptions = new Set([]);
    }

    /**
     * @param {Object} subscription JSON.stringify of a PushSubscription
     */
    addSubscription(subscription) {
        this._subscriptions.add(subscription);
    }

    /**
     * @returns {number}
     */
    getSubscriptionCount() {
        return this._subscriptions.size;
    }

    /**
     * @param {Object} data
     * @returns {Promise<Number>} Nombre de notifications envoyées
     */
    async broadcast(data) {
        debug('broadcast to %s subs: %s', this._subscriptions.size, data);
        if (this._subscriptions.size < 1) {
            return 0;
        }

        let messageCount = 0;
        await Promise.all(Array.from(this._subscriptions.values()).map(async (subscription) => {
            if (await this._sendNotification(subscription, data)) {
                messageCount++;
            }
        }));

        debug('broadcast: sent %s messages', messageCount);

        return messageCount;
    }

    /**
     * @param {Object} subscription
     * @param {*} dataToSend
     * @returns {Promise<boolean>}
     * @see https://www.npmjs.com/package/web-push#sendnotificationpushsubscription-payload-options
     * @private
     */
    async _sendNotification(subscription, dataToSend = '') {
        try {
            // payload must be a String or a node Buffer
            const payload = JSON.stringify({
                timestamp: Date.now(),
                data: dataToSend
            });
            const response = await webpush.sendNotification(subscription, payload);
            if (response.statusCode === 201) {
                return true;
            }
            debug('Error: %s %o', response.statusCode, response);
            return false;
        }
        catch (error) {
            debug('Error: %s', error.message);
            this._subscriptions.delete(subscription);
            return false;
        }
    }

    /**
     * @returns {Object}
     */
    serialize() {
        return {
            subscriptions: Array.from(this._subscriptions.values())
        };
    }

    /**
     * @param {Array<Object>} jsonObject
     */
    populateFromJson(jsonObject) {
        jsonObject.forEach((subscription) => {
            this.addSubscription(subscription);
        });
    }
}

module.exports = Notifier;
