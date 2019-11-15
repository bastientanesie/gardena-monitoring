require('dotenv').config();
const OauthAdapter = require('./src/OauthAdapter');
const GardenaAdapter = require('./src/GardenaAdapter');
const WebsocketHandler = require('./src/WebsocketHandler');
const Mower = require('./src/Mower');
const fs = require('fs');
const debug = require('debug')('gardena');
const debugWeb = require('debug')('gardena:webserver');
const debugPush = require('debug')('gardena:push');

const DB_FILEPATH = './data/db.json';
const ACCESS_TOKEN_FILEPATH = './data/access_token.json';

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

const oauth = new OauthAdapter(
    process.env.OAUTH_ENDPOINT,
    process.env.OAUTH_API_KEY,
    ACCESS_TOKEN_FILEPATH
);

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
        fs.writeFileSync(DB_FILEPATH, json, { flag: 'w' });
        debug('Database auto-saved');
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
    }));
    fs.writeFileSync(DB_FILEPATH, json, { flag: 'w' });
    debug('Database saved before exit');
    process.exit(code);
};

process.on('SIGTERM', handleExit);
process.on('SIGINT', handleExit);
// process.on('SIGKILL', handleExit);

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const webpush = require('web-push');

webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

const subscriptions = new Set([]);

// function to send the notification to the subscribed device
async function sendNotification(subscription, dataToSend = '') {
    // @see https://www.npmjs.com/package/web-push#sendnotificationpushsubscription-payload-options
    const response = await webpush.sendNotification(subscription, dataToSend);
    if (response.statusCode === 201) {
        return true;
    }
    debugPush('Error - Notification failed: %s %o', response.statusCode, response);
    return false;
}

const app = express();
const port = 5555;
app.use(cors());
app.use(bodyParser.json());
app.listen(port, () => {
    debugWeb('Listening on port %s', port);
});

app.get('/', (req, res) => {
    res.json({
        message: 'Hello World!',
        subscriptions: subscriptions.size
    });
    // res.send('Hello World!');
});

// The new /save-subscription endpoint
app.post('/subscribe', async (req, res) => {
    const subscription = req.body;
    subscriptions.add(subscription);
    debugWeb('New subscription: %o', subscription.endpoint);
    res.json({ message: 'success' });
});

// Route to test send notification
app.get('/send', async (req, res) => {
    if (subscriptions.size < 1) {
        return res.json({ message: 'no subscriptions' });
    }
    let messageCount = 0;
    const message = 'Hello World';
    debugPush('Sending notifications...');
    return Promise.all(Array.from(subscriptions.values()).map(async (subscription) => {
        if (await sendNotification(subscription, message)) {
            debugPush(`notification sent to ${subscription.endpoint}`);
            messageCount++;
        }
    })).then(() => {
        debugPush(`Finished notifying: ${messageCount}`);
        return res.json({ message: `${messageCount} messages sent` });
    });
});