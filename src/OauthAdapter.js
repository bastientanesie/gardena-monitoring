"use strict";

const request = require('request');
const fs = require('fs');
const debug = require('debug');

class OauthAdapter {
    constructor(apiEndpoint, apiKey, tokenFilepath) {
        this._apiKey = apiKey;
        this._tokenFilepath = tokenFilepath;

        this._httpClient = request.defaults({
            baseUrl: apiEndpoint,
            headers: {
                'Authorization-Provider': 'husqvarna',
                'X-Api-Key': this._apiKey
            }
        });

        this._debug = debug('gardena:oauth');
    }

    /**
     * Récupère un nouvel Access Token depuis l'API
     *
     * @param {String} username
     * @param {String} password
     * @returns {Promise<Object>}
     */
    _requestNewAccessToken(username, password) {
        return new Promise((resolve, reject) => {
            this._httpClient.post('/oauth2/token', {
                form: {
                    grant_type: 'password',
                    client_id: this._apiKey,
                    username: username,
                    password: password
                }
            }, (error, response, body) => {
                if (error) {
                    return reject(error);
                }
                this._debug(`/oauth2/token %O`, body);
                if (response.statusCode !== 200) {
                    return reject(`Invalid HTTP status code : ${response.statusCode} ${response.statusMessage}`);
                }

                try {
                    fs.writeFileSync(this._tokenFilepath, body, { flag: 'w+' });
                    this._debug(`New access token saved`);
                    return resolve(JSON.parse(body));
                } catch (error) {
                    return reject(error);
                }
            });
        });
    }

    /**
     * Récupère les infos à jour à propos du token donné
     *
     * @param {String} accessToken
     * @returns {Promise<Object>}
     */
    validateAccessToken(accessToken) {
        return new Promise((resolve, reject) => {
            this._httpClient.get(`/token/${accessToken}`, {
                headers: {
                    'Authorization-Provider': 'husqvarna',
                    'X-Api-Key': this._apiKey
                },
            }, (error, response, body) => {
                if (error) {
                    return reject(error);
                }
                // this._debug(`/token %0`, body);
                if (response.statusCode !== 200) {
                    return reject(`Invalid HTTP status code : ${response.statusCode} ${response.statusMessage}`);
                }

                return resolve(JSON.parse(body));
            });
        });
    }

    /**
     * Récupère les infos de l'utilisateur donné
     *
     * @param {String} userId
     * @param {String} accessToken
     * @returns {Promise<Object>}
     */
    getUser(userId, accessToken) {
        return new Promise((resolve, reject) => {
            oauthRequest.get(`/users/${userId}`, {
                headers: {
                    'Authorization-Provider': 'husqvarna',
                    'X-Api-Key': this._apiKey
                },
                auth: {
                    bearer: accessToken
                }
            }, (error, response, body) => {
                if (error) {
                    return reject(error);
                }
                // this._debug(`/users %O`, body);
                if (response.statusCode !== 200) {
                    return reject(`Invalid HTTP status code : ${response.statusCode} ${response.statusMessage}`);
                }

                return resolve(JSON.parse(body));
            });
        });
    }

    /**
     * Retourne l'Access Token actuel (depuis le cache ou depuis l'API)
     *
     * @param {String} username
     * @param {String} password
     * @returns {Promise<Object>}
     */
    getAccessToken(username, password) {
        if (fs.existsSync(this._tokenFilepath)) {
            this._debug(`Using stored access token`);
            return Promise.resolve(
                JSON.parse(fs.readFileSync(this._tokenFilepath).toString())
            );
        }
        else {
            return this._requestNewAccessToken(username, password);
        }
    }
}

module.exports = OauthAdapter;
