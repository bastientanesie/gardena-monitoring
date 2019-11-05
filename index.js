require('dotenv').config();
const OauthAdapter = require('./OauthAdapter');
const GardenaAdapter = require('./GardenaAdapter');
const WebsocketHandler = require('./WebsocketHandler');
const Mower = require("./Mower");
const fs = require('fs');
const debug = require('debug')('gardena');

const DB_FILEPATH = './db.json';

function launchWebSocketLoop(devices, gardenaAdapter, locationId) {
    gardenaAdapter.getWebsocket(locationId).then((websocket) => {
        new WebsocketHandler(
            devices,
            websocket.attributes.url,
            () => {
                launchWebSocketLoop(devices, gardenaAdapter, locationId);
            }
        );
    });
}

let devices = new Map([]);

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

    // Loading database
    if (fs.existsSync(DB_FILEPATH)) {
        JSON.parse(
            fs.readFileSync(DB_FILEPATH).toString()
        ).forEach((device) => {
            devices.set(
                device.id,
                Mower.fromJson(device)
            );
        });
        debug(`Database loaded`);
    }

    // Sauvegarde auto toutes les 5min
    setInterval(() => {
        const json = JSON.stringify(Array.from(devices.values()).map((device) => {
            return device.serialize();
        }), null, 2);
        fs.writeFile(DB_FILEPATH, json, { flag: 'w' }, (error) => {
            if (error) {
                throw error;
            }
            debug('Database auto-saved');
        });
    }, 30 * 1000);

    // Lancement de la boucle de websockets
    gardena.getLocations().then((locations) => {
        for (let location of locations) {
            debug('Location "%s": %s', location.attributes.name, location.id);
            launchWebSocketLoop(devices, gardena, location.id);
        }
    });
});

const handleExit = (code) => {
    const json = JSON.stringify(Array.from(devices.values()).map((device) => {
        return device.serialize();
    }), null, 2);
    fs.writeFile(DB_FILEPATH, json, { flag: 'w' }, (error) => {
        if (error) {
            throw error;
        }
        debug('Database saved before exit');
        process.exit(code);
    });
};

process.on('exit', handleExit);
process.on('SIGTERM', handleExit);
process.on('SIGINT', handleExit);
process.on('SIGKILL', handleExit);