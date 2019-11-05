const fs = require('fs');
const debug = require('debug');
const WebSocket = require('ws');

class WebsocketHandler {
    constructor(devices, websocketUrl, onDisconnect) {
        this._devices = devices;
        this._socket = null;
        this._debug = debug('gardena:websocket');

        this._socket = new WebSocket(websocketUrl);

        this._socket.on('open', () => {
            this._debug(`connected`);
        });

        this._socket.on('close', () => {
            this._debug(`disconnected`);
            if (typeof onDisconnect === 'function') {
                onDisconnect.call();
            }
        });

        this._socket.on('message', (data) => {
            const event = JSON.parse(data);
            const type = event.type.charAt(0).toUpperCase() + event.type.slice(1).toLowerCase();

            if (this[`_handle${type}`] && typeof this[`_handle${type}`] === 'function') {
                this[`_handle${type}`].call(this, event);
            } else {
                this._debug('--- (Generic) %s ---', type);
                this._debug(event);
            }
        });
    }

    _handleLocation(event) {
        this._debug('--- Location ---');
        this._debug('id: %s', event.id);
        this._debug('Name: %s', event.attributes.name);
    }

    _handleDevice(event) {
        this._debug('--- Device ---');
        this._debug('id: %s', event.id);

        if (! this._devices.hasOwnProperty(event.id)) {
            this._devices[event.id] = {
                id: event.id,
                location: null,
                services: null
            };
        }

        if (! event.hasOwnProperty('relationships')) {
            this._debug('WARNING/unsupported event: %O', event);
            return;
        }

        if (event.relationships.hasOwnProperty('location')) {
            this._devices[event.id].location = event.relationships.location;
        }
        if (event.relationships.hasOwnProperty('services')) {
            this._devices[event.id].services = event.relationships.services;
        }
    }

    _handleCommon(event) {
        this._debug('--- Common ---');
        this._debug('id: %s', event.id);

        if (! this._devices.hasOwnProperty(event.id)) {
            this._devices[event.id] = {
                id: event.id
            };
        }
        if (! this._devices[event.id].hasOwnProperty('common')) {
            this._devices[event.id].common = {
                name: null,
                serial: null,
                modelType: null,
                battery: {
                    levels: [],
                    states: []
                },
                rfLink: {
                    levels: [],
                    states: []
                }
            }
        }

        if (! event.hasOwnProperty('attributes')) {
            this._debug('WARNING/unsupported event: %O', event);
            return;
        }

        if (event.attributes.hasOwnProperty('name')) { // UserDefinedNameWrapper
            this._devices[event.id].common.name = event.attributes.name.value;
        }
        if (event.attributes.hasOwnProperty('serial')) { // SerialNumberWrapper
            this._devices[event.id].common.serial = event.attributes.serial.value;
        }
        if (event.attributes.hasOwnProperty('modelType')) { // DeviceModel
            this._devices[event.id].common.modelType = event.attributes.modelType.value;
        }
        if (event.attributes.hasOwnProperty('batteryLevel')) { // TimestampedPercent
            this._devices[event.id].common.battery.levels.push({
                timestamp: event.attributes.batteryLevel.timestamp,
                value: event.attributes.batteryLevel.value
            });
        }
        if (event.attributes.hasOwnProperty('batteryState')) { // TimestampedBatteryState
            this._devices[event.id].common.battery.states.push({
                timestamp: event.attributes.batteryState.timestamp,
                value: event.attributes.batteryState.value
            });
            // OK - The battery operates normally.
            // LOW - The battery is getting depleted but is still OK for the short term device operation.
            // REPLACE_NOW - The battery must be replaced now, the next device operation might fail with it.
            // OUT_OF_OPERATION - The battery must be replaced because device fails to operate with it.
            // CHARGING - The battery is being charged.
            // NO_BATTERY - This device has no battery.
            // UNKNOWN - The battery state can not be determined.
        }
        if (event.attributes.hasOwnProperty('rfLinkLevel')) { // TimestampedPercent
            this._devices[event.id].common.rfLink.levels.push({
                timestamp: event.attributes.rfLinkLevel.timestamp,
                value: event.attributes.rfLinkLevel.value
            });
        }
        if (event.attributes.hasOwnProperty('rfLinkState')) { // TimestampedRFLinkState
            this._devices[event.id].common.rfLink.states.push({
                timestamp: event.attributes.rfLinkState.timestamp,
                value: event.attributes.rfLinkState.value // RFLinkState
            });
            // The device is ONLINE if radio exchange is expected to be possible.
        }
    }

    _handleMower(event) {
        this._debug('--- Mower ---');
        this._debug('id: %s', event.id);

        if (! this._devices.hasOwnProperty(event.id)) {
            this._devices[event.id] = {
                id: event.id
            }
        }
        if (! this._devices[event.id].hasOwnProperty('mower')) {
            this._devices[event.id].mower = {
                operatingHours: null,
                states: [],
                activities:[],
                errors: []
            }
        }

        if (! event.hasOwnProperty('attributes')) {
            this._debug('WARNING/unsupported event: %O', event);
            return;
        }

        if (event.attributes.hasOwnProperty('state')) { // TimestampedServiceState
            this._devices[event.id].mower.states.push({
                timestamp: event.attributes.state.timestamp,
                value: event.attributes.state.value // ServiceState
            });
            // OK - The service is fully operation can receive commands.
            // WARNING - The user must pay attention to the "lastErrorCode" field. Automatic operation might be impaired.
            // ERROR - The user must pay attention to the "lastErrorCode" field. Automatic operation is impossible.
            // UNAVAILABLE - The service is online but can not be used. See service description for more details.
        }
        if (event.attributes.hasOwnProperty('activity')) { // TimestampedMowerActivity
            this._devices[event.id].mower.activities.push({
                timestamp: event.attributes.activity.timestamp,
                value: event.attributes.activity.value // MowerActivity
            });
            // The mower is usually either "active" or not, depending on the schedule.
            // If mower is active then it would be in out of "OK_" states, otherwise in one of "PARKED_" states. All other states are special cases.
            // PAUSED - The mower in a waiting state with hatch closed.
            // OK_CUTTING - The mower id cutting in AUTO mode (schedule).
            // OK_CUTTING_TIMER_OVERRIDDEN - The mower is cutting outside schedule.
            // OK_SEARCHING - The mower is searching for the charging station.
            // OK_LEAVING - The mower is leaving charging station.
            // OK_CHARGING - The mower has to be mowing but insufficient charge level keeps it in the charging station.
            // PARKED_TIMER - The mower is parked according to timer, will start again at configured time.
            // PARKED_PARK_SELECTED - The mower is parked until further notice.
            // PARKED_AUTOTIMER - The mower skips mowing because of insufficient grass height.
            // NONE - No activity is happening, perhaps due to an error.
        }
        if (event.attributes.hasOwnProperty('lastErrorCode')) { // TimestampedMowerError
            this._devices[event.id].mower.errors.push({
                timestamp: event.attributes.lastErrorCode.timestamp,
                value: event.attributes.lastErrorCode.value // MowerError
            });
            // This field should be paid attention to if the mower is in one of the two error states.
            // NO_MESSAGE - No explanation provided.
            // OUTSIDE_WORKING_AREA - Outside working area.
            // NO_LOOP_SIGNAL - No loop signal.
            // WRONG_LOOP_SIGNAL - Wrong loop signal.
            // LOOP_SENSOR_PROBLEM_FRONT - Loop sensor problem, front.
            // LOOP_SENSOR_PROBLEM_REAR - Loop sensor problem, rear.
            // LOOP_SENSOR_PROBLEM_LEFT - Loop sensor problem, left.
            // LOOP_SENSOR_PROBLEM_RIGHT - Loop sensor problem, right.
            // WRONG_PIN_CODE - Wrong PIN code.
            // TRAPPED - Trapped.
            // UPSIDE_DOWN - Upside down.
            // EMPTY_BATTERY - Empty battery.
            // NO_DRIVE - No drive.
            // TEMPORARILY_LIFTED - Mower lifted.
            // LIFTED - Lifted.
            // STUCK_IN_CHARGING_STATION - Stuck in charging station.
            // CHARGING_STATION_BLOCKED - Charging station blocked.
            // COLLISION_SENSOR_PROBLEM_REAR - Collision sensor problem, rear.
            // COLLISION_SENSOR_PROBLEM_FRONT - Collision sensor problem, front.
            // WHEEL_MOTOR_BLOCKED_RIGHT - Wheel motor blocked, right.
            // WHEEL_MOTOR_BLOCKED_LEFT - Wheel motor blocked, left.
            // WHEEL_DRIVE_PROBLEM_RIGHT - Wheel drive problem, right.
            // WHEEL_DRIVE_PROBLEM_LEFT - Wheel drive problem, left.
            // CUTTING_MOTOR_DRIVE_DEFECT - Cutting system blocked.
            // CUTTING_SYSTEM_BLOCKED - Cutting system blocked.
            // INVALID_SUB_DEVICE_COMBINATION - Invalid sub-device combination.
            // MEMORY_CIRCUIT_PROBLEM - Memory circuit problem.
            // CHARGING_SYSTEM_PROBLEM - Charging system problem.
            // STOP_BUTTON_PROBLEM - STOP button problem.
            // TILT_SENSOR_PROBLEM - Tilt sensor problem.
            // MOWER_TILTED - Mower tilted.
            // WHEEL_MOTOR_OVERLOADED_RIGHT - Wheel motor overloaded, right.
            // WHEEL_MOTOR_OVERLOADED_LEFT - Wheel motor overloaded, left.
            // CHARGING_CURRENT_TOO_HIGH - Charging current too high.
            // ELECTRONIC_PROBLEM - Electronic problem.
            // CUTTING_MOTOR_PROBLEM - Cutting motor problem.
            // LIMITED_CUTTING_HEIGHT_RANGE - Limited cutting height range.
            // CUTTING_HEIGHT_PROBLEM_DRIVE - Cutting height problem, drive.
            // CUTTING_HEIGHT_PROBLEM_CURR - Cutting height problem, current.
            // CUTTING_HEIGHT_PROBLEM_DIR - Cutting height problem, direction.
            // CUTTING_HEIGHT_BLOCKED - Cutting height blocked.
            // CUTTING_HEIGHT_PROBLEM - Cutting height problem.
            // BATTERY_PROBLEM - Battery problem.
            // TOO_MANY_BATTERIES - Battery problem.
            // ALARM_MOWER_SWITCHED_OFF - Alarm! Mower switched off.
            // ALARM_MOWER_STOPPED - Alarm! Mower stopped.
            // ALARM_MOWER_LIFTED - Alarm! Mower lifted.
            // ALARM_MOWER_TILTED - Alarm! Mower tilted.
            // ALARM_MOWER_IN_MOTION - Alarm! Mower in motion.
            // ALARM_OUTSIDE_GEOFENCE - Alarm! Outside geofence.
            // SLIPPED - Slipped - Mower has Slipped.Situation not solved with moving pattern.
            // INVALID_BATTERY_COMBINATION - Invalid battery combination - Invalid combination of different battery types.
            // UNINITIALISED - Radio module sent uninitialised value. We do not know the status of the mower.
            // WAIT_UPDATING - Mower waiting, updating firmware.
            // WAIT_POWER_UP - Mower powering up.
            // OFF_DISABLED - Mower disabled on main switch.
            // OFF_HATCH_OPEN - Mower in waiting state with hatch open.
            // OFF_HATCH_CLOSED - Mower in waiting state with hatch closed.
            // PARKED_DAILY_LIMIT_REACHED - Mower has completed cutting due to daily limit reached.
        }
        if (event.attributes.hasOwnProperty('operatingHours')) { // HoursWrapper
            this._devices[event.id].mower.operatingHours = event.attributes.operatingHours.value;
        }
    }
}

module.exports = WebsocketHandler;
