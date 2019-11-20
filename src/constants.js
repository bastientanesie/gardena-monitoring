module.exports = Object.freeze({
    DB_FILEPATH: `${__dirname}/../data/db.json`,
    ACCESS_TOKEN_FILEPATH: `${__dirname}/../data/access_token.json`,

    WEBSOCKET_EVENT_DISCONNECTED: 'websocket:disconnected',
    WEBSOCKET_EVENT_MOWER_CHANGE: 'websocket:mower_change',

    MOWER_EVENT_CHANGE: 'mower:change',
    MOWER_STATE: 'mower:state',
    MOWER_ACTIVITY: 'mower:activity',
    MOWER_ERROR: 'mower:error',
});
