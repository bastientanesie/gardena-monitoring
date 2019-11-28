require('dotenv').config();
const debug = require('debug')('gardena');
const Monitor = require('./src/Monitor');
const Notifier = require('./src/Notifier');
const WebServer = require('./src/WebServer');

const notifier = new Notifier(
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
    process.env.VAPID_EMAIL
);

const webServer = new WebServer(notifier);

const monitor = new Monitor(
    notifier,
    webServer,
    process.env.OAUTH_ENDPOINT,
    process.env.GARDENA_ENDPOINT,
    process.env.API_KEY
);

// Lance le service de monitoring
monitor.start(
    process.env.GARDENA_USERNAME,
    process.env.GARDENA_PASSWORD
);

const handleExit = (code) => {
    monitor.persistStateToFile();
    debug('Database saved before exit');
    process.exit(code);
};
process.on('SIGTERM', handleExit);
process.on('SIGINT', handleExit);
