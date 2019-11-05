require('dotenv').config();
const OauthAdapter = require('./OauthAdapter');
const GardenaAdapter = require('./GardenaAdapter');
const WebsocketHandler = require('./WebsocketHandler');
const fs = require('fs');
const debug = require('debug')('gardena');

const DB_FILEPATH = './db.json';

function launchWebSocketLoop(devices, gardenaAdapter, locationId) {
    gardenaAdapter.getWebsocket(locationId).then((websocket) => {
        new WebsocketHandler(
            devices,
            websocket.attributes.url,
            () => {
                fs.writeFileSync(DB_FILEPATH, JSON.stringify(devices), { flag: 'w+' });
                debug('Database saved');
                launchWebSocketLoop(devices, gardenaAdapter, locationId);
            }
        );
    });
}

let devices = {};

const oauth = new OauthAdapter(process.env.OAUTH_ENDPOINT, process.env.OAUTH_API_KEY);

oauth.getAccessToken(
    process.env.OAUTH_USERNAME,
    process.env.OAUTH_PASSWORD
).then((token) => {
    const gardena = new GardenaAdapter(
        process.env.GARDENA_ENDPOINT,
        process.env.OAUTH_API_KEY,
        token.access_token
    );

    if (fs.existsSync(DB_FILEPATH)) {
        devices = JSON.parse(fs.readFileSync(DB_FILEPATH).toString());
        debug(`Database loaded`);
    }
    // Sauvegarde auto toutes les 5min
    setInterval(() => {
        fs.writeFileSync(DB_FILEPATH, JSON.stringify(devices), { flag: 'w+' });
        debug('Database auto-saved');
    }, 5 * 60 * 1000);

    gardena.getLocations().then((locations) => {
        for (let location of locations) {
            debug('Location "%s": %s', location.attributes.name, location.id);
            launchWebSocketLoop(devices, gardena, location.id);
        }
    });
});
