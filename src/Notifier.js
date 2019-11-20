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
     * @param {Object} dataToSend
     * @returns {Promise<boolean>}
     * @see https://www.npmjs.com/package/web-push#sendnotificationpushsubscription-payload-options
     * @private
     */
    async _sendNotification(subscription, dataToSend = '') {
        const response = await webpush.sendNotification(subscription, dataToSend);
        if (response.statusCode === 201) {
            return true;
        }
        debug('Error - Notification failed: %s %o', response.statusCode, response);
        return false;
    }
}

module.exports = Notifier;
