import {Vector3} from "../../../libs/three/math/Vector3.js";
import {Quaternion} from "../../../libs/three/math/Quaternion.js";
import {clearActorEncounterStatus} from "../../application/utils/StatusUtils.js";
import {statusMapFromMsg} from "../../../../Server/game/utils/GameServerFunctions.js";
import {ENUMS} from "../../application/ENUMS.js";


let testSkip = function(key) {
    if (spatialMap.indexOf(key) !== -1) {
        return true;
    }
    if (skipMap.indexOf(key) !== -1) {
        return true;
    }
    return false;
}

let testHardState = function(key) {
    if (hardStateMap.indexOf(key) !== -1) {
        return true;
    }
    return false;
}

function checkBroadcast(actor) {

    if (actor) {
        if (actor.call.getRemote()) {
            return false;
        }

        if (typeof(actor.getStatus) === 'function') {
            let clientStamp =client.getStamp();
            let actorClientStamp = actor.getStatus(ENUMS.ActorStatus.CLIENT_STAMP)
            if (clientStamp !== actorClientStamp) {
                return false;
            }
        }
    }

    let encounterHosted = false;
    let dynEnc = GameAPI.call.getDynamicEncounter()
    if (dynEnc) {
        let encActors = dynEnc.status.call.getStatus(ENUMS.EncounterStatus.ENCOUNTER_ACTORS)
        if (encActors.indexOf(actor.id) !== -1) {
            encounterHosted = true;
        }
    }

    if (encounterHosted || actor.isPlayerActor()) {
        return true;
    } else {
        return false;
    }

}


function fullSend(status, statusMap) {
    for (let key in statusMap) {
        if (key !== ENUMS.ActorStatus.ACTOR_ID)  {

            if (testSkip(key) === false) {
                status.sendStatus.push(key)
                status.sendStatus.push(statusMap[key])

                if (!status.lastBroadcast[key]) {
                    status.lastBroadcast[key] = [0];
                }

                status.lastBroadcast[key][0] = MATH.stupidChecksumArray(statusMap[key])
            }
        }
    }
    status.lastBroadcast[ENUMS.ActorStatus.QUAT_W][0] = status.lastBroadcast[ENUMS.ActorStatus.QUAT_W][0]+0.1;
}

function sendUpdatedOnly(status, statusMap) {

    for (let key in statusMap) {
        if (testSkip(key) === false) {
            if (!status.lastBroadcast[key]) {
                status.lastBroadcast[key] = [0];
            }
            let checksum = MATH.stupidChecksumArray(statusMap[key])
            if (checksum !== status.lastBroadcast[key][0]) {
                status.lastBroadcast[key][0] = checksum;
                status.sendStatus.push(key)
                status.sendStatus.push(statusMap[key])
            }
        }
    }
}

let hardStateMap = [
    ENUMS.ActorStatus.EQUIP_REQUESTS,
    ENUMS.ActorStatus.INVENTORY_ITEMS,
    ENUMS.ActorStatus.IN_COMBAT,
    ENUMS.ActorStatus.TURN_STATE,
    ENUMS.ActorStatus.HAS_TURN,
    ENUMS.ActorStatus.HP,
    ENUMS.ActorStatus.MAX_HP,
    ENUMS.ActorStatus.HAS_TURN_INDEX,
    ENUMS.ActorStatus.TURN_DONE,
    ENUMS.ActorStatus.DAMAGE_APPLIED,
    ENUMS.ActorStatus.HEALING_APPLIED,
    ENUMS.ActorStatus.SELECTED_DESTINATION,
    ENUMS.ActorStatus.PARTY_SELECTED,
    ENUMS.ActorStatus.DEAD,
    ENUMS.ActorStatus.SELECTED_ACTION,
    ENUMS.ActorStatus.ACTION_STATE_KEY,
    ENUMS.ActorStatus.COMBAT_STATUS,
    ENUMS.ActorStatus.ENGAGED_TARGETS,
    ENUMS.ActorStatus.ENGAGE_MAX,
    ENUMS.ActorStatus.ENGAGE_COUNT,
    ENUMS.ActorStatus.QUAT_X,
    ENUMS.ActorStatus.QUAT_Y,
    ENUMS.ActorStatus.QUAT_Z,
    ENUMS.ActorStatus.QUAT_W,
    ENUMS.ActorStatus.STAND_STATE,
    ENUMS.ActorStatus.MOVE_STATE,
    ENUMS.ActorStatus.BODY_STATE,
    ENUMS.ActorStatus.STRONGHOLD_ID,
    ENUMS.ActorStatus.SLOT_HEAD,
    ENUMS.ActorStatus.SLOT_BODY,
    ENUMS.ActorStatus.SLOT_CHEST,
    ENUMS.ActorStatus.SLOT_WRIST,
    ENUMS.ActorStatus.SLOT_HANDS,
    ENUMS.ActorStatus.SLOT_WAIST,
    ENUMS.ActorStatus.SLOT_LEGS,
    ENUMS.ActorStatus.SLOT_SKIRT,
    ENUMS.ActorStatus.SLOT_FEET,
    ENUMS.ActorStatus.SLOT_HAND_R,
    ENUMS.ActorStatus.SLOT_HAND_L,
    ENUMS.ActorStatus.SLOT_BACK,
    ENUMS.ActorStatus.SLOT_WRIST_L,
    ENUMS.ActorStatus.SLOT_WRIST_R
];

let detailsMap = [
    ENUMS.ActorStatus.NAME,
    ENUMS.ActorStatus.ACTIVATION_STATE,
    ENUMS.ActorStatus.EQUIP_REQUESTS,
    ENUMS.ActorStatus.PATH_POINTS,
    ENUMS.ActorStatus.SELECTED_TARGET,
    ENUMS.ActorStatus.ATTITUDE,
    ENUMS.ActorStatus.STAND_STATE,
    ENUMS.ActorStatus.MOVE_STATE,
    ENUMS.ActorStatus.BODY_STATE,
  //  ENUMS.ActorStatus.IN_COMBAT,
    ENUMS.ActorStatus.ACTIONS,
    ENUMS.ActorStatus.SELECTED_DESTINATION,
    ENUMS.ActorStatus.SELECTED_ACTION,
    ENUMS.ActorStatus.ACTION_STATE_KEY,
  //  ENUMS.ActorStatus.HAS_TURN,
  //  ENUMS.ActorStatus.HAS_TURN_INDEX,
    ENUMS.ActorStatus.TURN_DONE,
    ENUMS.ActorStatus.SEQUENCER_INITIATIVE,
    ENUMS.ActorStatus.SEQUENCER_SELECTED,
    ENUMS.ActorStatus.SELECTED_TARGET,
    ENUMS.ActorStatus.SELECTED_ENCOUNTER,
    ENUMS.ActorStatus.REQUEST_PARTY,
    // ENUMS.ActorStatus.DAMAGE_APPLIED,
    ENUMS.ActorStatus.NAVIGATION_STATE,
    ENUMS.ActorStatus.IS_LEAPING,
  //  ENUMS.ActorStatus.TURN_STATE,
    ENUMS.ActorStatus.REQUEST_TURN_STATE,
    ENUMS.ActorStatus.COMBAT_STATUS,
    ENUMS.ActorStatus.SLOT_HEAD,
    ENUMS.ActorStatus.SLOT_BODY,
    ENUMS.ActorStatus.SLOT_CHEST,
    ENUMS.ActorStatus.SLOT_WRIST,
    ENUMS.ActorStatus.SLOT_HANDS,
    ENUMS.ActorStatus.SLOT_WAIST,
    ENUMS.ActorStatus.SLOT_LEGS,
    ENUMS.ActorStatus.SLOT_SKIRT,
    ENUMS.ActorStatus.SLOT_FEET,
    ENUMS.ActorStatus.SLOT_HAND_R,
    ENUMS.ActorStatus.SLOT_HAND_L,
    ENUMS.ActorStatus.SLOT_BACK,
    ENUMS.ActorStatus.SLOT_WRIST_L,
    ENUMS.ActorStatus.SLOT_WRIST_R,
    ENUMS.ActorStatus.ENCOUNTER_UPDATE_INDEX
];

let spatialMap = [
    ENUMS.ActorStatus.POS_X,
    ENUMS.ActorStatus.POS_Y,
    ENUMS.ActorStatus.POS_Z,
    ENUMS.ActorStatus.VEL_X,
    ENUMS.ActorStatus.VEL_Y,
    ENUMS.ActorStatus.VEL_Z,
    ENUMS.ActorStatus.QUAT_X,
    ENUMS.ActorStatus.QUAT_Y,
    ENUMS.ActorStatus.QUAT_Z,
    ENUMS.ActorStatus.QUAT_W
]

let skipMap = [
    ENUMS.ActorStatus.DAMAGE_APPLIED,
    ENUMS.ActorStatus.HEALING_APPLIED,
    ENUMS.ActorStatus.PARTY_SELECTED,
    ENUMS.ActorStatus.SEQUENCER_SELECTED,
    ENUMS.ActorStatus.STATUS_PITCH,
    ENUMS.ActorStatus.STATUS_ROLL,
    ENUMS.ActorStatus.STATUS_YAW,
    ENUMS.ActorStatus.STATUS_ANGLE_PITCH,
    ENUMS.ActorStatus.STATUS_ANGLE_ROLL,
    ENUMS.ActorStatus.STATUS_ANGLE_YAW,
    ENUMS.ActorStatus.STATUS_ANGLE_NORTH,
    ENUMS.ActorStatus.STATUS_ANGLE_EAST,
    ENUMS.ActorStatus.STATUS_ANGLE_SOUTH,
    ENUMS.ActorStatus.STATUS_ANGLE_WEST,
    ENUMS.ActorStatus.STATUS_CLIMB_RATE,
    ENUMS.ActorStatus.STATUS_ELEVATION,
    ENUMS.ActorStatus.STATUS_CLIMB_0,
    ENUMS.ActorStatus.STATUS_CLIMB_1,
    ENUMS.ActorStatus.STATUS_CLIMB_2,
    ENUMS.ActorStatus.STATUS_CLIMB_3,
    ENUMS.ActorStatus.STATUS_CLIMB_4,
    ENUMS.ActorStatus.STATUS_SPEED,
    ENUMS.ActorStatus.ACTOR_YAW_RATE,
    ENUMS.ActorStatus.SELECTING_DESTINATION,
    ENUMS.ActorStatus.STATUS_INPUT_SAMPLERS,
    ENUMS.ActorStatus.STATUS_WALK_SELECTION,
    ENUMS.ActorStatus.STATUS_LEAP_SELECTION,
    ENUMS.ActorStatus.ACTION_STATE_KEY,
    ENUMS.ActorStatus.SELECTED_ACTION,
    ENUMS.ActorStatus.ACTION_STEP_PROGRESS,
    ENUMS.ActorStatus.RIGID_BODY_CONTACT,
    ENUMS.ActorStatus.POS_X,
    ENUMS.ActorStatus.POS_Y,
    ENUMS.ActorStatus.POS_Z,
    ENUMS.ActorStatus.VEL_X,
    ENUMS.ActorStatus.VEL_Y,
    ENUMS.ActorStatus.VEL_Z,
    ENUMS.ActorStatus.QUAT_X,
    ENUMS.ActorStatus.QUAT_Y,
    ENUMS.ActorStatus.QUAT_Z,
    ENUMS.ActorStatus.QUAT_W
]

function sendSpatial(status, statusMap) {

    let updated = false;

    for (let i = 0; i < spatialMap.length; i++) {
        let key = spatialMap[i]
        if (!status.lastBroadcast[key]) {
            status.lastBroadcast[key] = [0];
        }
        let checksum = MATH.stupidChecksumArray(statusMap[key])
        if (Math.abs(checksum - status.lastBroadcast[key][0]) > 0.05) {
            updated = true;
            status.lastBroadcast[key][0] = checksum;
        }
    }

    if (updated) {
        for (let i = 0; i < spatialMap.length; i++) {
            let key = spatialMap[i]
            status.sendStatus.push(key)
            status.sendStatus.push(statusMap[key])
        }
    }
}

function sendDetails(status, statusMap) {

    for (let i = 0; i < detailsMap.length; i++) {
        let key = detailsMap[i]
        if (!status.lastBroadcast[key]) {
            status.lastBroadcast[key] = [0];
        }
        let checksum = MATH.stupidChecksumArray(statusMap[key])
        if (checksum !== status.lastBroadcast[key][0]) {
            status.lastBroadcast[key][0] = checksum;
            status.sendStatus.push(key)
            status.sendStatus.push(statusMap[key])
        }
    }
}

class ActorStatus {
    constructor(actor) {

        this.actor = actor;
        this.lastBroadcast = {};
        this.sendStatus = [];
        this.lastFullSend = 0;
        this.lastDeltaSend = 0;
        this.spatialDelay = 0;

        this.tempVec = new Vector3();
        this.tempQuat = new Quaternion();
        this.statusMap = {}
        this.statusMap[ENUMS.ActorStatus.ACTOR_ID] = this.actor.id;
        this.statusMap[ENUMS.ActorStatus.ACTIVATION_STATE] = ENUMS.ActivationState.INIT;
        this.statusMap[ENUMS.ActorStatus.IS_ACTIVE] = 0;
        this.statusMap[ENUMS.ActorStatus.ATTITUDE] = 'NEUTRAL';
        this.statusMap[ENUMS.ActorStatus.MOVE_STATE] = 'MOVE';
        this.statusMap[ENUMS.ActorStatus.STAND_STATE] = 'IDLE_HANDS';
        this.statusMap[ENUMS.ActorStatus.BODY_STATE] = 'IDLE_LEGS';
        this.statusMap[ENUMS.ActorStatus.SPATIAL_DELTA] = 0.2;
        this.statusMap[ENUMS.ActorStatus.EQUIP_REQUESTS] = [];
        this.statusMap[ENUMS.ActorStatus.EQUIPPED_ITEMS] = [];
        this.statusMap[ENUMS.ActorStatus.INVENTORY_ITEMS] = [];
        this.statusMap[ENUMS.ActorStatus.PATH_POINTS] = [];
        this.statusMap[ENUMS.ActorStatus.PASSIVE_ACTIONS] = [];
        this.statusMap[ENUMS.ActorStatus.ACTIONS] = [];
        this.statusMap[ENUMS.ActorStatus.COMBAT_STATUS] = [];
        this.statusMap[ENUMS.ActorStatus.VEL_X] = 0;
        this.statusMap[ENUMS.ActorStatus.VEL_Y] = 0;
        this.statusMap[ENUMS.ActorStatus.VEL_Z] = 0;
        this.statusMap[ENUMS.ActorStatus.POS_X] = 0;
        this.statusMap[ENUMS.ActorStatus.POS_Y] = 0;
        this.statusMap[ENUMS.ActorStatus.POS_Z] = 0;
        this.statusMap[ENUMS.ActorStatus.SCALE_X] = 1;
        this.statusMap[ENUMS.ActorStatus.SCALE_Y] = 1;
        this.statusMap[ENUMS.ActorStatus.SCALE_Z] = 1;
        this.statusMap[ENUMS.ActorStatus.QUAT_X] = 0;
        this.statusMap[ENUMS.ActorStatus.QUAT_Y] = 0;
        this.statusMap[ENUMS.ActorStatus.QUAT_Z] = 0;
        this.statusMap[ENUMS.ActorStatus.QUAT_W] = 1;
        this.statusMap[ENUMS.ActorStatus.SELECTED_TARGET] = "";
        this.statusMap[ENUMS.ActorStatus.REQUEST_PARTY] = "";
        this.statusMap[ENUMS.ActorStatus.ACTIVATING_ENCOUNTER] = "";
        this.statusMap[ENUMS.ActorStatus.ACTIVATED_ENCOUNTER]  = "";
        this.statusMap[ENUMS.ActorStatus.DEACTIVATING_ENCOUNTER] = "";
        this.statusMap[ENUMS.ActorStatus.PARTY_SELECTED]  = false;
        this.statusMap[ENUMS.ActorStatus.PLAYER_PARTY]  = [];
        this.statusMap[ENUMS.ActorStatus.SELECTED_DESTINATION]  = [0, 0, 0];
        this.statusMap[ENUMS.ActorStatus.SELECTED_ACTION] = "";
        this.statusMap[ENUMS.ActorStatus.ACTION_STATE_KEY] = 0;
        this.statusMap[ENUMS.ActorStatus.ACTION_STEP_PROGRESS]  = 0;
        this.statusMap[ENUMS.ActorStatus.RIGID_BODY_CONTACT]  = 0;
        this.statusMap[ENUMS.ActorStatus.ENGAGE_MAX]  = 0;
        this.statusMap[ENUMS.ActorStatus.ENGAGE_COUNT]  = 0;
        this.statusMap[ENUMS.ActorStatus.ENGAGED_TARGETS]  = [];
        this.statusMap[ENUMS.ActorStatus.IS_LEAPING]  = false;
        this.statusMap[ENUMS.ActorStatus.SEQUENCER_SELECTED]  = false;
        this.statusMap[ENUMS.ActorStatus.DEAD] = false;
        this.statusMap[ENUMS.ActorStatus.NAVIGATION_STATE] = ENUMS.NavigationState.WORLD;
        this.statusMap[ENUMS.ActorStatus.STRONGHOLD_ID] = ""
        this.statusMap[ENUMS.ActorStatus.CAMERA_FOLLOW_SPEED] = 10;
        this.statusMap[ENUMS.ActorStatus.CAMERA_LOOK_SPEED] = 10;
        this.statusMap[ENUMS.ActorStatus.CAMERA_ZOOM] = 15;
        this.statusMap[ENUMS.ActorStatus.CONTROL_TWITCHINESS] = 4;
        this.statusMap[ENUMS.ActorStatus.CAM_DRAG_FACTOR] = 30;
        this.statusMap[ENUMS.ActorStatus.WORLD_LEVEL] = "20";
        this.statusMap[ENUMS.ActorStatus.ACTOR_LEVEL] = 1;
        this.statusMap[ENUMS.ActorStatus.SLOT_HEAD] = "";
        this.statusMap[ENUMS.ActorStatus.SLOT_BODY] = "";
        this.statusMap[ENUMS.ActorStatus.SLOT_CHEST] = "";
        this.statusMap[ENUMS.ActorStatus.SLOT_WRIST] = "";
        this.statusMap[ENUMS.ActorStatus.SLOT_HANDS] = "";
        this.statusMap[ENUMS.ActorStatus.SLOT_WAIST] = "";
        this.statusMap[ENUMS.ActorStatus.SLOT_LEGS] = "";
        this.statusMap[ENUMS.ActorStatus.SLOT_SKIRT] = "";
        this.statusMap[ENUMS.ActorStatus.SLOT_FEET] = "";
        this.statusMap[ENUMS.ActorStatus.SLOT_HAND_R] = "";
        this.statusMap[ENUMS.ActorStatus.SLOT_HAND_L] = "";
        this.statusMap[ENUMS.ActorStatus.SLOT_BACK] = "";
        this.statusMap[ENUMS.ActorStatus.SLOT_WRIST_L] = "";
        this.statusMap[ENUMS.ActorStatus.SLOT_WRIST_R] = "";
        this.statusMap[ENUMS.ActorStatus.SELECTED_ADVENTURE] = "";
        this.statusMap[ENUMS.ActorStatus.ACTIVE_ADVENTURE] = "";
        this.statusMap[ENUMS.ActorStatus.COMPLETED_ADVENTURES] = [];
        this.statusMap[ENUMS.ActorStatus.ADVENTURE_PROGRESS] = [];
        this.statusMap[ENUMS.ActorStatus.ACTOR_STATUS_FLAGS] = [];
        this.statusMap[ENUMS.ActorStatus.ACTIVE_UI_STATES] = [];
        this.statusMap[ENUMS.ActorStatus.NAME] = "";
        this.statusMap[ENUMS.ActorStatus.ENCOUNTER_UPDATE_INDEX] = 0;

        let updateTO = null;
        this.request = {request:ENUMS.ClientRequests.APPLY_ACTOR_STATUS, status:this.sendStatus}
        let send = function() {
            evt.dispatch(ENUMS.Event.SEND_SOCKET_MESSAGE, this.request)
        }.bind(this);


        let frameQueue = function() {
            clearTimeout(updateTO)
            updateTO = setTimeout(send, 0);
        }.bind(this);

        this.call = {
            frameQueue:frameQueue
        }

    }

    applyServerCommandStatus(message) {
    //    console.log("Apply Server Command msg ", message);
        let map = message;
        if (typeof (message.length) === 'number') {
            map = statusMapFromMsg(message)
        }

        for (let key in map) {

            if (testHardState(key) === true) {
            //    console.log("Apply Server Command msg testHardState", key, map[key]);
                if (this.statusMap[key] !== map[key]) {
                    this.actor.statusFeedback.setStatusKey(key, map[key], this.actor)
                }
                this.statusMap[key] = map[key];
            } else {
            //    console.log("Not hard state testHardState", key, map[key]);
            }
        }

    }


    getStatusByKey(key) {
        if (typeof (this.statusMap[key]) === 'undefined') {
            this.statusMap[key] = 0;
        }
        return this.statusMap[key]
    }

    setStatusKey(key, status) {


        if (key === ENUMS.ActorStatus.DEACTIVATING_ENCOUNTER && status !== '') {

            let dynEnc = GameAPI.call.getDynamicEncounter()

            if (dynEnc) {
                dynEnc.setStatusKey(ENUMS.EncounterStatus.ACTIVATION_STATE, ENUMS.ActivationState.DEACTIVATING);
            } else {
                clearActorEncounterStatus(this.actor);
            }

        //    console.log("Set Deactivate", status)
        }

        if (typeof (this.statusMap[key]) === typeof (status)) {
            this.statusMap[key] = status;
        } else {
            if (typeof (this.statusMap[key]) === 'undefined' || this.statusMap[key] === 0  || this.statusMap[key] === null) {
                this.statusMap[key] = status;
            } else {
                console.log("changing type for status is bad", key, status, this.statusMap[ENUMS.ActorStatus.ACTOR_ID])
            }
        }
    }

    relaySpatial(delay) {

        if (checkBroadcast(this.actor)) {

         //   if (delay < this.spatialDelay) {
                this.spatialDelay = 0.1;
        //    }

            let gameTime = GameAPI.getGameTime();
            if (this.lastDeltaSend < gameTime - this.spatialDelay) {
                MATH.emptyArray(this.sendStatus);
                this.sendStatus.push(ENUMS.ActorStatus.ACTOR_ID)
                this.sendStatus.push(this.statusMap[ENUMS.ActorStatus.ACTOR_ID])
                this.lastDeltaSend = gameTime;
                sendSpatial(this, this.statusMap)
                if (this.sendStatus.length > 2) {
                    evt.dispatch(ENUMS.Event.SEND_SOCKET_MESSAGE, this.request)
                }
            }
        }
    }

    broadcastStatus(gameTime) {
        if (checkBroadcast(this.actor)) {
            MATH.emptyArray(this.sendStatus);
            this.sendStatus.push(ENUMS.ActorStatus.ACTOR_ID)
            this.sendStatus.push(this.statusMap[ENUMS.ActorStatus.ACTOR_ID])

            if (this.lastFullSend < gameTime -2) {
                this.lastFullSend = gameTime;
                sendSpatial(this, this.statusMap)
                fullSend(this, this.statusMap)
            } else {
                sendDetails(this, this.statusMap);
                sendUpdatedOnly(this, this.statusMap)
            }

            if (this.sendStatus.length > 2) {
                //    console.log(sendStatus)
                evt.dispatch(ENUMS.Event.SEND_SOCKET_MESSAGE, this.request)
            }
        }

    }

    setStatusVelocity(velVec) {
        if (MATH.testVec3ForNaN(velVec)) {
            return;
        }

        let diff = this.getStatusVelocity().sub(velVec).lengthSq();

            this.setStatusKey(ENUMS.ActorStatus.VEL_X, velVec.x)
            this.setStatusKey(ENUMS.ActorStatus.VEL_Y, velVec.y)
            this.setStatusKey(ENUMS.ActorStatus.VEL_Z, velVec.z)
        if (diff > 0.1) {
            this.relaySpatial()
        }



    }

    getStatusVelocity(store) {
        if (!store) {
            store = this.tempVec;
        }
        store.set(
            this.getStatusByKey(ENUMS.ActorStatus.VEL_X),
            this.getStatusByKey(ENUMS.ActorStatus.VEL_Y),
            this.getStatusByKey(ENUMS.ActorStatus.VEL_Z)
        )
        MATH.testVec3ForNaN(store)
        return store;
    }

    setStatusPosition(posVec) {
        if (MATH.testVec3ForNaN(posVec)) {
            return;
        }

        let diff = this.getStatusPosition().sub(posVec).lengthSq();

            this.setStatusKey(ENUMS.ActorStatus.POS_X, posVec.x)
            this.setStatusKey(ENUMS.ActorStatus.POS_Y, posVec.y)
            this.setStatusKey(ENUMS.ActorStatus.POS_Z, posVec.z)
        if (diff > 0.1) {
            this.relaySpatial(this.getStatusByKey(ENUMS.ActorStatus.SPATIAL_DELTA))
        }

    }

    getStatusPosition(store) {
        if (!store) {
            store = this.tempVec;
        }
        store.set(
            this.getStatusByKey(ENUMS.ActorStatus.POS_X),
            this.getStatusByKey(ENUMS.ActorStatus.POS_Y),
            this.getStatusByKey(ENUMS.ActorStatus.POS_Z)
        )
        MATH.testVec3ForNaN(store)
        return store;
    }

    setStatusScale(scaleVec) {
        if (MATH.testVec3ForNaN(scaleVec)) {
            return;
        }

        this.setStatusKey(ENUMS.ActorStatus.SCALE_X, scaleVec.x)
        this.setStatusKey(ENUMS.ActorStatus.SCALE_Y, scaleVec.y)
        this.setStatusKey(ENUMS.ActorStatus.SCALE_Z, scaleVec.z)
    }

    getStatusScale(store) {
        if (!store) {
            store = this.tempVec;
        }
        store.set(
            this.getStatusByKey(ENUMS.ActorStatus.SCALE_X),
            this.getStatusByKey(ENUMS.ActorStatus.SCALE_Y),
            this.getStatusByKey(ENUMS.ActorStatus.SCALE_Z)
        )
        MATH.testVec3ForNaN(store)
        return store;
    }

    setStatusQuaternion(quat) {
        if (MATH.testVec3ForNaN(quat)) {
            return;
        }

        this.setStatusKey(ENUMS.ActorStatus.QUAT_X, quat.x)
        this.setStatusKey(ENUMS.ActorStatus.QUAT_Y, quat.y)
        this.setStatusKey(ENUMS.ActorStatus.QUAT_Z, quat.z)
        this.setStatusKey(ENUMS.ActorStatus.QUAT_W, quat.w)
        this.relaySpatial(this.getStatusByKey(ENUMS.ActorStatus.SPATIAL_DELTA))
    }

    getStatusQuaternion(store) {
        if (!store) {
            store = this.tempQuat;
        }
        store.x = this.getStatusByKey(ENUMS.ActorStatus.QUAT_X)
        store.y = this.getStatusByKey(ENUMS.ActorStatus.QUAT_Y)
        store.z = this.getStatusByKey(ENUMS.ActorStatus.QUAT_Z)
        store.w = this.getStatusByKey(ENUMS.ActorStatus.QUAT_W)
        MATH.testVec3ForNaN(store)
        return store;
    }

    setStatusAdvProgress(advId, value) {
        let advList = this.getStatusByKey(ENUMS.ActorStatus.ADVENTURE_PROGRESS)
        let idx = advList.indexOf(advId)
        if (idx === -1) {
            advList.push(advId);
            advList.push(value);
        } else {
            advList[idx+1] = value;
        }
    }

    getStatusAdvProgress(advId) {
        let advList = this.getStatusByKey(ENUMS.ActorStatus.ADVENTURE_PROGRESS)
        let idx = advList.indexOf(advId)
        if (idx === -1) {
            return 0;
        } else {
            return advList[idx+1];
        }
    }

}

export { ActorStatus }