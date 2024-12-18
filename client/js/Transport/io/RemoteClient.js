import {poolFetch, poolReturn} from "../../application/utils/PoolUtils.js";
import {Vector3} from "../../../libs/three/math/Vector3.js";
import {Quaternion} from "../../../libs/three/math/Quaternion.js";
import {DynamicEncounter} from "../../game/encounter/DynamicEncounter.js";
import {Remote} from "./Remote.js";
import {ActorAction} from "../../game/actor/ActorAction.js";
import {notifyCameraStatus} from "../../3d/camera/CameraFunctions.js";
import {ENUMS} from "../../application/ENUMS.js";


let equipQueue = []
let index = 0;
let tempVec = new Vector3()
let tempQuat = new Quaternion();

function messageByKey(msg, key ) {
    let keyIndex = msg.indexOf(key);
//    console.log(keyIndex, [msg], key)
    if (keyIndex === -1) {
        return null;
    }
    return msg[keyIndex+1];
}

let onRemoteClientActionDone = function(actingActor) {
    console.log("Remote Action Done: ", actingActor)
  //  actingActor.actorText.say('Action Done')
    // action.call.closeAttack()
}

let spatialMap = [
    ENUMS.ActorStatus.POS_X,
    ENUMS.ActorStatus.POS_Y,
    ENUMS.ActorStatus.POS_Z,
    ENUMS.ActorStatus.VEL_X,
    ENUMS.ActorStatus.VEL_Y,
    ENUMS.ActorStatus.VEL_Z,
    ENUMS.ActorStatus.SCALE_X,
    ENUMS.ActorStatus.SCALE_Y,
    ENUMS.ActorStatus.SCALE_Z,
    ENUMS.ActorStatus.QUAT_X,
    ENUMS.ActorStatus.QUAT_Y,
    ENUMS.ActorStatus.QUAT_Z,
    ENUMS.ActorStatus.QUAT_W
]


class RemoteClient {
    constructor(stamp) {
        this.index = index;
        this.lastMessageFrame = 0;
        this.lastRequestFrame = 0;
        index++
        this.isPaused = false;
        this.stamp = stamp;
        this.actors = [];
        this.actions = [];
        this.items = [];
        this.encounter = null;
        this.remoteIndex = [];
        this.closeTimeout = null;
        this.isClosed = false;
        GuiAPI.screenText("Player Joined: "+this.index, ENUMS.Message.HINT, 4)

        let timeout = function() {
            this.closeRemoteClient();
        }.bind(this)

        this.call = {
            timeout:timeout
        }

    }

    getActorByIndex(index) {
        for (let i = 0; i < this.actors.length; i++) {
            if (this.actors[i].index === index) {
                return this.actors[i];
            }
        }
    }


    getRemotePlayerName() {
        let actor = this.actors[0];
        if (actor) {
            let name = actor.getStatus(ENUMS.ActorStatus.NAME);
            return name;
        }
        return 'NameNotFound'
    }

    applyRemoteChatMessage(text) {
        let actor = this.actors[0];
        if (actor) {
            actor.actorText.say(text);
        }
    }

    getActorById(id) {
        for (let i = 0; i < this.actors.length; i++) {
            let actor = this.actors[i];
            let remote = actor.call.getRemote();
            let remoteId = remote.remoteId;
            if (actor.id === id) {

                if (actor.id !== remoteId) {
                    console.log("Remote ID missmatch")
                }

                if (actor.getStatus(ENUMS.ActorStatus.ACTOR_ID) !== id) {
            //        console.log("Remote Actor ID missmatch", id, actor.getStatus(ENUMS.ActorStatus.ACTOR_ID), actor)
                    actor.setStatusKey(ENUMS.ActorStatus.ACTOR_ID, id);
                }

                return this.actors[i];
            }
        }
    }

    removeRemoteActor(actorId) {
        if (this.isClosed !== true) {
            let actor = this.getActorById(actorId);
            MATH.splice(this.actors, actor);
            actor.removeGameActor();
        }
    }

    getActionById(id) {
        for (let i = 0; i < this.actions.length; i++) {
            let action = this.actions[i];
            if (action.id === id) {

                if (action.call.getStatus(ENUMS.ActionStatus.ACTION_ID) !== id) {
                    console.log("Remote Action ID missmatch", id, action.call.getStatus(ENUMS.ActionStatus.ACTION_ID), action)
                    action.call.setStatusKey(ENUMS.ActionStatus.ACTION_ID, id);
                }

            //    let actor = this.getActorById(action.call.getStatus(ENUMS.ActionStatus.ACTOR_ID))
            //    actor.actorText.say(actor.getStatus(ENUMS.ActorStatus.SELECTED_ACTION))

                return action;
            }
        }
    }

    getItemById(id) {
        for (let i = 0; i < this.items.length; i++) {
            let item = this.items[i];
            if (item.id === id) {

                if (item.getStatus(ENUMS.ItemStatus.ITEM_ID) !== id) {
                    console.log("Remote Item ID missmatch", id, item)
                    item.setStatusKey(ENUMS.ItemStatus.ITEM_ID, id);
                }

                return item;
            }
        }
    }

    applyRemoteSpatial(actor, timeDelta) {

        let remote = actor.call.getRemote();
        if (MATH.distanceBetween(remote.pos, remote.lastUpdate.pos) > 50) {
            this.lastRequestFrame = GameAPI.getFrame().frame
            remote.copyLastFrame();
        }

        tempQuat.copy(remote.quat)
        actor.getSpatialScale(remote.scale);
        remote.timeDelta = timeDelta;
    /*
        tempVec.copy(remote.pos);
        tempVec.add(remote.vel);
        evt.dispatch(ENUMS.Event.DEBUG_DRAW_LINE, {from:remote.pos, to:tempVec, color:'GREEN', drawFrames:Math.floor(timeDelta/GameAPI.getFrame().tpf)});
   */
    }


    applyRemoteEquipment(actor) {
        return;
        let equippedList = actor.getStatus(ENUMS.ActorStatus.EQUIPPED_ITEMS);
        let actorItems = actor.actorEquipment.items;

        let equipCb = function(item) {
            equipQueue.splice(equipQueue.indexOf(item.configId))
            actor.equipItem(item);
        }

        for (let i = 0; i < equippedList.length; i++) {
            let isEquipped = false;
            for (let j = 0; j < actorItems.length; j++) {
                if (actorItems[j].configId === equippedList[i]) {
                    isEquipped = true;
                }
            }

            if (isEquipped === false) {
                if (equipQueue.indexOf(equippedList[i]) === -1) {
                 //   console.log("EQUIP: ", equippedList[i])
                    equipQueue.push(equippedList[i])
                    evt.dispatch(ENUMS.Event.LOAD_ITEM, {id: equippedList[i], callback:equipCb})
                }
            }
        }

        for (let i = 0; i < actorItems.length; i++) {
            if (equippedList.indexOf(actorItems[i].configId) === -1) {
                actor.unequipItem(actorItems[i])
            }
        }
    }

    deactivateEncounter() {
        let actorList = this.encounter.status.call.getStatus(ENUMS.EncounterStatus.ENCOUNTER_ACTORS)
        console.log("Remotely deactivate Encounter ", actorList, this.actors, this.remoteIndex)
    //    GuiAPI.screenText(status+" BATTLE")

        //    console.log("DEACTIVATING: ", actorList, this.actors)
        for (let i = 0; i < actorList.length; i++) {
            let actor = this.getActorById(actorList[i])

            if (!actor) {
                console.log("Actor probably player:", actorList[i], this.actors)
                GameAPI.getGamePieceSystem().playerParty.clearPartyStatus();
            } else {
                if (actor.getStatus(ENUMS.ActorStatus.ATTITUDE) !== 'FRIENDLY') {
                    MATH.splice(this.actors, actor);
                    if (typeof (actor) === 'object') {
                        MATH.splice(this.remoteIndex, actor.id);
                        actor.call.remove()
                    } else {
                        console.log("Bad remote actor removal ", actorList[i], this.actors);
                    }
                }
            }
        }
        this.encounter = null;
    }

    handleItemMessage(itemId, msg) {

        console.log("Item Messasge", msg);

        let item = GameAPI.getItemById(itemId);
        this.lastRequestFrame = GameAPI.getFrame().frame
        if (item === null) {
            console.log("Remote Client item not yet loaded...")
        } else {
            item.call.applyStatusMessage(msg);
        }
    }

    handleActionMessage(actionId, msg) {

        if (actionId === "none") {
            return;
        }
        this.lastRequestFrame = GameAPI.getFrame().frame
        let isNew = false;
        let action = this.getActionById(actionId);
        if (!action) {
            isNew = true;
            action = poolFetch('ActorAction');
            action.id = actionId;

        //    let actorId = action.call.getStatus(ENUMS.ActionStatus.ACTOR_ID)
        //    let actor = this.getActorById(actorId)

       //     console.log("Start new Action ", actionId)
            this.actions.push(action);
            action.isRemote = true;
        }


        let statusMap = action.status.statusMap;
        for (let i = 0; i < msg.length; i++) {
            let key = msg[i];
            i++
            let status = msg[i]
            statusMap[key] = status;
            // action.call.setStatusKey(key, status);
        }

        if (isNew) {
            action.setActionKeyFromRemote(action.call.getStatus(ENUMS.ActionStatus.ACTION_KEY))
        }

        let actorKey = action.call.getStatus(ENUMS.ActionStatus.ACTOR_ID)
        if (actorKey === "none" ) {
        //    GuiAPI.screenText("SYNC ACTION "+this.index,  ENUMS.Message.SYSTEM, 1.5)
            // console.log("No Actor Key yet", msg);
            return;
        }

        let actor = this.getActorById(actorKey);
        if (!actor) {
            GuiAPI.screenText("No Actor "+this.index,  ENUMS.Message.SYSTEM, 1.5)
            // console.log("No such actor... ", msg);
            return;
        } else {
            if (action.initiated === false) {
                let actionKey = action.call.getStatus(ENUMS.ActionStatus.ACTION_KEY);
                action.call.initStatus(actor, actionKey)
                if (actionKey === "none") {
                    GuiAPI.screenText("No Action Key "+this.index,  ENUMS.Message.SYSTEM, 1.5)
           //         console.log("No key yet")
                    return;
                }
            //    action.setActionKey(actor, actionKey)

                let getActionByKey = function(key) {
                    if (key === actorKey) {
                        return action;
                    }
                };

                actor.call.getRemote().call.setGetActionFunction(getActionByKey);
            }
        }

        let actionState = action.call.getStatus(ENUMS.ActionStatus.ACTION_STATE)

        if (action.remoteState === actionState) {
            return;
        } else {
            action.remoteState = actionState;
            action.call.processActionStateChange(action, actionState);
        }

        if (actionState === ENUMS.ActionState.COMPLETED) {
            GuiAPI.screenText("ACTION COMPLETED "+this.index,  ENUMS.Message.SYSTEM, 1.5)
            action.call.updateActionCompleted();
            action.call.setStatusKey(ENUMS.ActionStatus.ACTOR_ID, "none")
            action.call.setStatusKey(ENUMS.ActionStatus.ACTION_KEY, "none")
            action.isRemote = false;
            MATH.splice(this.actions, action);
        }

    }


    pauseRemoteClient() {
        this.lastRequestFrame = GameAPI.getFrame().frame
        while (this.actors.length) {
            let remove = this.actors.pop();

            remove.actorText.say("Entering Battle")
            setTimeout(function () {
                remove.removeGameActor();
            }, 1000)

        }

        this.isPaused = true;
    }

    unpauseRemoteClient() {
        this.lastRequestFrame = GameAPI.getFrame().frame
        this.isPaused = false;
    }

    handleEncounterMessage(encounterId, msg) {
     //       console.log("Encounter Message; ", msg);
        this.lastRequestFrame = GameAPI.getFrame().frame
            if (!this.encounter) {
                let playerParty = GameAPI.getGamePieceSystem().playerParty;
                let participate = false;
                for (let i = 0; i < playerParty.actors.length; i++) {
                    let otherActor = playerParty.actors[i];
                    let stamp = otherActor.getStatus(ENUMS.ActorStatus.CLIENT_STAMP);
                    if (stamp !== 0) {
                        if (msg.indexOf(stamp) !== -1) {
                            GuiAPI.screenText("PARTY BATTLE "+this.index,  ENUMS.Message.SYSTEM, 1.2)
                        //    console.log("Participate: ", otherActor, msg, stamp)
                            participate = true;
                        }
                    }
                }

                if (participate === false) {
                    // not my encounter;
                    if (msg.indexOf(ENUMS.ActivationState.DEACTIVATING) !== -1) {
                        this.encounter = null;
                        this.unpauseRemoteClient()
                    } else {
                        this.pauseRemoteClient()
                    }
                    return
                }
                this.encounter = new DynamicEncounter(encounterId, msg)
                this.encounter.isRemote = true;
            }

        let statusPre = this.encounter.status.call.getStatus(ENUMS.EncounterStatus.ACTIVATION_STATE)

        for (let i = 2; i < msg.length; i++) {
            let key = msg[i];
            i++
            let status = msg[i]
            this.encounter.setStatusKey(key, status);
        }

        let activationState = this.encounter.status.call.getStatus(ENUMS.EncounterStatus.ACTIVATION_STATE)

        if (activationState !== statusPre) {

            if (activationState === ENUMS.ActivationState.ACTIVATING) {
                GameAPI.call.getGameEncounterSystem().activateByRemote(this.encounter)
            }

            if (activationState === ENUMS.ActivationState.DEACTIVATING) {

                let victory = this.encounter.status.call.getStatus(ENUMS.EncounterStatus.PLAYER_VICTORY)

                GameAPI.call.getGameEncounterSystem().deactivateActiveEncounter(!victory, victory);
                this.deactivateEncounter(status)

            }

            GuiAPI.screenText("ENCOUNTER "+activationState, ENUMS.Message.SYSTEM, 2);
            // console.log(statusPre, activationState)

        }
    }

    processClientMessage(msg) {
        let gameTime = GameAPI.getGameTime();
        this.lastMessageFrame = GameAPI.getFrame().frame;
        let stamp = this.stamp;
        GuiAPI.screenText(""+this.index,  ENUMS.Message.SYSTEM, 0.2)
        let actors = this.actors;
        let remoteId = null

        if (msg[0] === ENUMS.EncounterStatus.ENCOUNTER_ID) {
            this.handleEncounterMessage(msg[1], msg);
            return;
        }

        if (this.isPaused === false) {
            if (msg[0] === ENUMS.ActorStatus.ACTOR_ID) {
                //     console.log("REMOTE INDEX: ", msg[1])
                remoteId = msg[1];
                //    GuiAPI.screenText("REQUEST REMOTE ACTOR "+ remoteId)
            } else if (msg[0] === ENUMS.ActionStatus.ACTION_ID) {
                this.handleActionMessage(msg[1], msg);
                return;
            } else if (msg[0] === ENUMS.ItemStatus.ITEM_ID) {
                this.handleItemMessage(msg[1], msg);
                return;
            } else {
                console.log("Index for Actor missing ", msg);
                return;
            }

            //    GuiAPI.screenText("Remote Index "+remoteId,  ENUMS.Message.HINT, 0.5)
            if (typeof(remoteId) === 'string') {
                let actor = this.getActorById(remoteId);
                if (!actor) {
                    let onLoadedCB = function(actr) {
                    //    console.log("Remote Actor Loaded", actr)
                        actr.id = remoteId;
                        GuiAPI.screenText("REMOTE LOADED "+this.index,  ENUMS.Message.SYSTEM, 1.2)

                        let onReady = function(readyActor) {
                            actors.push(readyActor);
                        }
                        let remote = new Remote(stamp, remoteId);
                        actr.call.setRemote(remote)
                        actr.activateGameActor(onReady)
                    }

                    let configId = messageByKey(msg, ENUMS.ActorStatus.CONFIG_ID)


                    if (configId === null) {
                    //    console.log("No configId", remoteId, msg, this.actors);
                        GuiAPI.screenText("loading config "+this.index,  ENUMS.Message.SYSTEM, 0.5)
                        return;
                    }

                    if (this.remoteIndex.indexOf(remoteId) === -1) {
                        this.remoteIndex.push(remoteId)
                        ThreeAPI.tempVec3.copy(ThreeAPI.getCameraCursor().getPos())
                        evt.dispatch(ENUMS.Event.LOAD_ACTOR, {id:configId, pos:ThreeAPI.tempVec3, callback:onLoadedCB})
                    }

                } else {
                    //    actor.actorText.say(remoteId+' '+actor.index)

                    let hasSpatial = false;

                    for (let i = 2; i < msg.length; i++) {

                        let key = msg[i];
                        i++
                        let status = msg[i]
                        if (spatialMap.indexOf(key) !== -1) {
                            hasSpatial = true;
                            actor.call.getRemote().updateSpatial(key, status);
                        } else {

                            if (status !== 0 && key === ENUMS.ActorStatus.DAMAGE_APPLIED) {
                                console.log("DMG MSG: ", status);
                            }

                            actor.setStatusKey(key, status);
                        }

                        if (key === ENUMS.ActorStatus.EXISTS) {
                            if (status === 0) {
                                console.log("Actor does not EXIST, handle?")
                            }
                        }
                    }


                    let delta = gameTime - actor.getStatus(ENUMS.ActorStatus.LAST_UPDATE);

                    actor.setStatusKey(ENUMS.ActorStatus.UPDATE_DELTA, MATH.clamp(delta, 0, 2));
                    actor.setStatusKey(ENUMS.ActorStatus.LAST_UPDATE, gameTime);

                    if (hasSpatial) {
                        let spatialMaxDelta = actor.getStatus(ENUMS.ActorStatus.SPATIAL_DELTA);
                        let spatialDelta = gameTime - actor.call.getRemote().updateTime
                        this.applyRemoteSpatial(actor, MATH.clamp(spatialDelta, 0.02, spatialMaxDelta));
                        actor.call.getRemote().updateTime = gameTime;
                    }

                    this.applyRemoteEquipment(actor)
                    //    this.applyRemoteAction(actor);
                    //    console.log(msg)

                }
            } else {
                GuiAPI.screenText("No Remote Target "+this.index,  ENUMS.Message.HINT, 2.5)
                console.log("NO REMOTE: ", msg)
            }
        }


    }


    closeRemoteClient() {
        GuiAPI.screenText("Player Left: "+this.index, ENUMS.Message.HINT, 4)
        while (this.actors.length) {
            this.actors.pop().removeGameActor();
        }
        this.isClosed = true;
    }

    getStamp() {
        return this.stamp;
    }

}

export {RemoteClient}