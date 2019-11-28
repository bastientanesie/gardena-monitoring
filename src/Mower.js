"use strict";

const debug = require('debug')('mower');
const EventEmitter = require('events');
const {
    MOWER_EVENT_CHANGE,
    MOWER_STATE,
    MOWER_ACTIVITY,
    MOWER_ERROR
} = require('./constants');

/**
 * Nombre d'éléments gardés dans les listes
 * @type {number}
 */
const LIST_ITEM_LIMIT = Infinity;

class Mower extends EventEmitter {
    /**
     * @param {String} id
     */
    constructor(id) {
        super();
        this._id = id;
        this._operatingHours = 0;
        this._name = null;
        this._serial = null;
        this._modelType = null;
        this._lastState = null;
        this._lastActivity = null;
        this._lastError = null;
        this._lastBatteryLevel = null;
        this._lastBatteryState = null;
        this._lastRfLinkLevel = null;
        this._lastRfLinkState = null;

        this._states = new Map([]);
        this._activities = new Map([]);
        this._errors = new Map([]);
        this._batteryLevels = new Map([]);
        this._batteryStates = new Map([]);
        this._rfLinkLevels = new Map([]);
        this._rfLinkStates = new Map([]);

        this._disableEmitter = false;
    }

    /**
     *
     * @param {Object} jsonObject
     */
    static fromJson(jsonObject) {
        const mower = new this(jsonObject.id);
        mower._disableEmitter = true;
        mower.name = jsonObject.name;
        mower.serial = jsonObject.serial;
        mower.modelType = jsonObject.modelType;
        mower.operatingHours = jsonObject.operatingHours;

        jsonObject.states.forEach((state) => {
            mower.addState(
                state[1],
                new Date(state[0])
            );
        });
        jsonObject.activities.forEach((activity) => {
            mower.addActivity(
                activity[1],
                new Date(activity[0])
            );
        });
        jsonObject.batteryStates.forEach((batteryState) => {
            mower.addBatteryState(
                batteryState[1],
                new Date(batteryState[0])
            );
        });
        jsonObject.batteryLevels.forEach((batteryLevel) => {
            mower.addBatteryLevel(
                parseInt(batteryLevel[1]),
                new Date(batteryLevel[0])
            );
        });
        jsonObject.rfLinkStates.forEach((rfLinkState) => {
            mower.addRfLinkState(
                rfLinkState[1],
                new Date(rfLinkState[0])
            );
        });
        jsonObject.rfLinkLevels.forEach((rfLinkLevel) => {
            mower.addRfLinkLevel(
                parseInt(rfLinkLevel[1]),
                new Date(rfLinkLevel[0])
            );
        });
        jsonObject.errors.forEach((error) => {
            mower.addError(
                error[1],
                new Date(error[0])
            );
        });

        mower._disableEmitter = false;

        return mower;
    }

    /**
     * @returns {String}
     */
    get id() {
        return this._id;
    }

    /**
     * @returns {Number}
     */
    get operatingHours() {
        return this._operatingHours;
    }

    /**
     * @returns {String|null}
     */
    get name() {
        return this._name;
    }

    /**
     * @returns {String|null}
     */
    get serial() {
        return this._serial;
    }

    /**
     * @returns {String|null}
     */
    get modelType() {
        return this._modelType;
    }

    /**
     * OK - The service is fully operation can receive commands.
     * WARNING - The user must pay attention to the "lastErrorCode" field. Automatic operation might be impaired.
     * ERROR - The user must pay attention to the "lastErrorCode" field. Automatic operation is impossible.
     * UNAVAILABLE - The service is online but can not be used. See service description for more details.
     *
     * @returns {String|null}
     */
    get state() {
        return this._lastState;
    }

    /**
     * The mower is usually either "active" or not, depending on the schedule.
     * If mower is active then it would be in out of "OK_" states, otherwise in one of "PARKED_" states. All other states are special cases.
     * PAUSED - The mower in a waiting state with hatch closed.
     * OK_CUTTING - The mower id cutting in AUTO mode (schedule).
     * OK_CUTTING_TIMER_OVERRIDDEN - The mower is cutting outside schedule.
     * OK_SEARCHING - The mower is searching for the charging station.
     * OK_LEAVING - The mower is leaving charging station.
     * OK_CHARGING - The mower has to be mowing but insufficient charge level keeps it in the charging station.
     * PARKED_TIMER - The mower is parked according to timer, will start again at configured time.
     * PARKED_PARK_SELECTED - The mower is parked until further notice.
     * PARKED_AUTOTIMER - The mower skips mowing because of insufficient grass height.
     * NONE - No activity is happening, perhaps due to an error.
     *
     * @returns {String|null}
     */
    get activity() {
        return this._lastActivity;
    }

    /**
     * @returns {Number|null}
     */
    get batteryLevel() {
        return this._lastBatteryLevel;
    }

    /**
     * OK - The battery operates normally.
     * LOW - The battery is getting depleted but is still OK for the short term device operation.
     * REPLACE_NOW - The battery must be replaced now, the next device operation might fail with it.
     * OUT_OF_OPERATION - The battery must be replaced because device fails to operate with it.
     * CHARGING - The battery is being charged.
     * NO_BATTERY - This device has no battery.
     * UNKNOWN - The battery state can not be determined.
     *
     * @returns {String|null}
     */
    get batteryState() {
        return this._lastBatteryState;
    }

    /**
     * @returns {Number|null}
     */
    get rfLinkLevel() {
        return this._lastRfLinkLevel;
    }

    /**
     * 	The device is ONLINE if radio exchange is expected to be possible.
     *
     * @returns {String|null}
     */
    get rfLinkState() {
        return this._lastRfLinkState;
    }

    /**
     * This field should be paid attention to if the mower is in one of the two error states.
     * NO_MESSAGE - No explanation provided.
     * OUTSIDE_WORKING_AREA - Outside working area.
     * NO_LOOP_SIGNAL - No loop signal.
     * WRONG_LOOP_SIGNAL - Wrong loop signal.
     * LOOP_SENSOR_PROBLEM_FRONT - Loop sensor problem, front.
     * LOOP_SENSOR_PROBLEM_REAR - Loop sensor problem, rear.
     * LOOP_SENSOR_PROBLEM_LEFT - Loop sensor problem, left.
     * LOOP_SENSOR_PROBLEM_RIGHT - Loop sensor problem, right.
     * WRONG_PIN_CODE - Wrong PIN code.
     * TRAPPED - Trapped.
     * UPSIDE_DOWN - Upside down.
     * EMPTY_BATTERY - Empty battery.
     * NO_DRIVE - No drive.
     * TEMPORARILY_LIFTED - Mower lifted.
     * LIFTED - Lifted.
     * STUCK_IN_CHARGING_STATION - Stuck in charging station.
     * CHARGING_STATION_BLOCKED - Charging station blocked.
     * COLLISION_SENSOR_PROBLEM_REAR - Collision sensor problem, rear.
     * COLLISION_SENSOR_PROBLEM_FRONT - Collision sensor problem, front.
     * WHEEL_MOTOR_BLOCKED_RIGHT - Wheel motor blocked, right.
     * WHEEL_MOTOR_BLOCKED_LEFT - Wheel motor blocked, left.
     * WHEEL_DRIVE_PROBLEM_RIGHT - Wheel drive problem, right.
     * WHEEL_DRIVE_PROBLEM_LEFT - Wheel drive problem, left.
     * CUTTING_MOTOR_DRIVE_DEFECT - Cutting system blocked.
     * CUTTING_SYSTEM_BLOCKED - Cutting system blocked.
     * INVALID_SUB_DEVICE_COMBINATION - Invalid sub-device combination.
     * MEMORY_CIRCUIT_PROBLEM - Memory circuit problem.
     * CHARGING_SYSTEM_PROBLEM - Charging system problem.
     * STOP_BUTTON_PROBLEM - STOP button problem.
     * TILT_SENSOR_PROBLEM - Tilt sensor problem.
     * MOWER_TILTED - Mower tilted.
     * WHEEL_MOTOR_OVERLOADED_RIGHT - Wheel motor overloaded, right.
     * WHEEL_MOTOR_OVERLOADED_LEFT - Wheel motor overloaded, left.
     * CHARGING_CURRENT_TOO_HIGH - Charging current too high.
     * ELECTRONIC_PROBLEM - Electronic problem.
     * CUTTING_MOTOR_PROBLEM - Cutting motor problem.
     * LIMITED_CUTTING_HEIGHT_RANGE - Limited cutting height range.
     * CUTTING_HEIGHT_PROBLEM_DRIVE - Cutting height problem, drive.
     * CUTTING_HEIGHT_PROBLEM_CURR - Cutting height problem, current.
     * CUTTING_HEIGHT_PROBLEM_DIR - Cutting height problem, direction.
     * CUTTING_HEIGHT_BLOCKED - Cutting height blocked.
     * CUTTING_HEIGHT_PROBLEM - Cutting height problem.
     * BATTERY_PROBLEM - Battery problem.
     * TOO_MANY_BATTERIES - Battery problem.
     * ALARM_MOWER_SWITCHED_OFF - Alarm! Mower switched off.
     * ALARM_MOWER_STOPPED - Alarm! Mower stopped.
     * ALARM_MOWER_LIFTED - Alarm! Mower lifted.
     * ALARM_MOWER_TILTED - Alarm! Mower tilted.
     * ALARM_MOWER_IN_MOTION - Alarm! Mower in motion.
     * ALARM_OUTSIDE_GEOFENCE - Alarm! Outside geofence.
     * SLIPPED - Slipped - Mower has Slipped.Situation not solved with moving pattern.
     * INVALID_BATTERY_COMBINATION - Invalid battery combination - Invalid combination of different battery types.
     * UNINITIALISED - Radio module sent uninitialised value. We do not know the status of the mower.
     * WAIT_UPDATING - Mower waiting, updating firmware.
     * WAIT_POWER_UP - Mower powering up.
     * OFF_DISABLED - Mower disabled on main switch.
     * OFF_HATCH_OPEN - Mower in waiting state with hatch open.
     * OFF_HATCH_CLOSED - Mower in waiting state with hatch closed.
     * PARKED_DAILY_LIMIT_REACHED - Mower has completed cutting due to daily limit reached.
     *
     * @returns {String|null}
     */
    get error() {
        return this._lastError;
    }

    /**
     * @param {Number} value
     */
    set operatingHours(value) {
        this._operatingHours = value;
    }

    /**
     * @param {String} value
     */
    set name(value) {
        this._name = value;
    }

    /**
     * @param {String} value
     */
    set serial(value) {
        this._serial = value;
    }

    /**
     * @param {String} value
     */
    set modelType(value) {
        this._modelType = value;
    }

    /**
     * @param {String} value
     * @param {Date} eventDate
     */
    addState(value, eventDate) {
        const previousState = this._lastState;
        this._states.set(eventDate, value);
        this._lastState = this._findLastByMapKey(this._states);

        // Changement d'état
        if (previousState !== this._lastState) {
            this.emit(MOWER_EVENT_CHANGE, MOWER_STATE, this._lastState);
        }

        this._cleanupMap(this._states);
    }

    /**
     * @param {String} value
     * @param {Date} eventDate
     */
    addActivity(value, eventDate) {
        const previousActivity = this._lastActivity;
        this._activities.set(eventDate, value);
        this._lastActivity = this._findLastByMapKey(this._activities);

        // Changement d'état
        if (previousActivity !== this._lastActivity) {
            this.emit(MOWER_EVENT_CHANGE, MOWER_ACTIVITY, this._lastActivity);
        }

        this._cleanupMap(this._activities);
    }

    /**
     * @param {String} value
     * @param {Date} eventDate
     */
    addError(value, eventDate) {
        const previousError = this._lastError;
        this._errors.set(eventDate, value);
        this._lastError = this._findLastByMapKey(this._errors);

        // Changement d'état
        if (previousError !== this._lastError) {
            this.emit(MOWER_EVENT_CHANGE, MOWER_ERROR, this._lastError);
        }

        this._cleanupMap(this._errors);
    }

    /**
     * @param {Number} value
     * @param {Date} eventDate
     */
    addBatteryLevel(value, eventDate) {
        this._batteryLevels.set(eventDate, value);
        this._lastBatteryLevel = this._findLastByMapKey(this._batteryLevels);
        this._cleanupMap(this._batteryLevels);
    }

    /**
     * @param {String} value
     * @param {Date} eventDate
     */
    addBatteryState(value, eventDate) {
        this._batteryStates.set(eventDate, value);
        this._lastBatteryState = this._findLastByMapKey(this._batteryStates);
        this._cleanupMap(this._batteryStates);
    }

    /**
     * @param {Number} value
     * @param {Date} eventDate
     */
    addRfLinkLevel(value, eventDate) {
        this._rfLinkLevels.set(eventDate, value);
        this._lastRfLinkLevel = this._findLastByMapKey(this._rfLinkLevels);
        this._cleanupMap(this._rfLinkLevels);
    }

    /**
     * @param {String} value
     * @param {Date} eventDate
     */
    addRfLinkState(value, eventDate) {
        this._rfLinkStates.set(eventDate, value);
        this._lastRfLinkState = this._findLastByMapKey(this._rfLinkStates);
        this._cleanupMap(this._rfLinkStates);
    }

    /**
     * @returns {Object}
     */
    serialize() {
        return {
            id: this.id,
            name: this.name,
            serial: this.serial,
            modelType: this.modelType,
            operatingHours: this.operatingHours,
            lastState: this.state,
            lastActivity: this.activity,
            lastBatteryLevel: this.batteryLevel,
            lastBatteryState: this.batteryState,
            lastRfLinkLevel: this.rfLinkLevel,
            lastRfLinkState: this.rfLinkState,
            lastError: this.error,
            states: Array.from(this._states.entries()),
            activities: Array.from(this._activities.entries()),
            batteryStates: Array.from(this._batteryStates.entries()),
            batteryLevels: Array.from(this._batteryLevels.entries()),
            rfLinkStates: Array.from(this._rfLinkStates.entries()),
            rfLinkLevels: Array.from(this._rfLinkLevels.entries()),
            errors: Array.from(this._errors.entries())
        };
    }

    /**
     * @param {String} event
     * @param {*[]} args
     * @returns {boolean}
     */
    emit(event, ...args) {
        if (this._disableEmitter) {
            return false;
        }
        return super.emit(event, ...args);
    }

    /**
     * Retourne le plus grand (ou plus récent) objet de la liste donnée
     *
     * @param {Map} map
     * @param {Function|null} compareFunction
     * @returns {*|null}
     * @private
     */
    _findLastByMapKey(map, compareFunction = null) {
        if (map.size < 1) {
            return null;
        }
        if (! compareFunction) {
            compareFunction = (a, b) => {
                if (a === b) return 0;
                return a < b ? 1 : -1;
            };
        }
        // Trié du plus récent au plus vieux
        const sortedKeys = Array.from(map.keys()).sort(compareFunction);
        return map.get(sortedKeys[0]);
    }

    /**
     * Nettoie la liste pour ne garder que les éléments les plus grands (ou plus récents)
     *
     * @param {Map} map
     * @param {Number} limit
     * @param {Function|null} compareFunction
     * @private
     */
    _cleanupMap(map, limit = LIST_ITEM_LIMIT, compareFunction = null) {
        if (map.size <= limit) {
            return;
        }
        if (! compareFunction) {
            compareFunction = (a, b) => {
                if (a === b) return 0;
                return a < b ? 1 : -1;
            };
        }
        const sortedKeys = Array.from(map.keys()).sort(compareFunction);

        sortedKeys.slice(limit - sortedKeys.length).forEach((key) => {
            map.delete(key);
        });
    }
}

module.exports = Mower;
