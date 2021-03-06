"use strict";

const request = require('request');
const debug = require('debug')('gardena:api');

class GardenaAdapter {
    constructor(apiEndpoint, apiKey, accessToken) {
        this._apiKey = apiKey;

        this._httpClient = request.defaults({
            baseUrl: apiEndpoint,
            headers: {
                'Authorization-Provider': 'husqvarna',
                'X-Api-Key': this._apiKey
            },
            auth: {
                bearer: accessToken
            }
        });
    }

    /**
     * Récupère les "jardins"
     *
     * @returns {Promise<Object>}
     */
    getLocations() {
        return new Promise((resolve, reject) => {
            this._httpClient.get('/locations', (error, response, body) => {
                if (error) {
                    return reject(error);
                }
                if (response.statusCode !== 200) {
                    return reject(`Invalid HTTP status code : ${response.statusCode} - ${JSON.parse(body).message}`);
                }

                return resolve(JSON.parse(body).data);
            });
        });
    }

    /**
     * Récupère les infos d'un "jardin"
     *
     * @param {String} locationId
     * @returns {Promise<Object>}
     */
    getLocation(locationId) {
        return new Promise((resolve, reject) => {
            this._httpClient.get(`/locations/${locationId}`, (error, response, body) => {
                if (error) {
                    return reject(error);
                }
                if (response.statusCode !== 200) {
                    return reject(`Invalid HTTP status code : ${response.statusCode} - ${JSON.parse(body).message}`);
                }

                return resolve(JSON.parse(body));
            });
        });
    }

    /**
     * Récupère un websocket pour récupérer les infos du "jardin"
     *
     * @param {String} locationId
     * @returns {Promise<Object>}
     */
    getWebsocket(locationId) {
        return new Promise((resolve, reject) => {
            this._httpClient.post('/websocket', {
                headers: {
                    'Content-Type': 'application/vnd.api+json'
                },
                body: JSON.stringify({
                    data: {
                        id: `request-${Date.now()}`,
                        type: 'WEBSOCKET',
                        attributes: {
                            locationId: locationId
                        }
                    }
                })
            }, (error, response, body) => {
                if (error) {
                    return reject(error);
                }
                if (response.statusCode !== 201) {
                    return reject(`Invalid HTTP status code : ${response.statusCode} - ${JSON.parse(body).message}`);
                }

                return resolve(JSON.parse(body).data);
            });
        });
    }
}

module.exports = GardenaAdapter;
