import { Object3D } from "../../../libs/three/core/Object3D.js";
import { GameWalkGrid } from "../gameworld/GameWalkGrid.js";
import { Vector3 } from "../../../libs/three/math/Vector3.js";
import {Quaternion} from "../../../libs/three/math/Quaternion.js";
import { poolFetch, poolReturn } from "../../application/utils/PoolUtils.js";
import { ActorTurnSequencer } from "./ActorTurnSequencer.js";
import { ActorStatus } from "./ActorStatus.js";
import { ControlState} from "../piece_functions/ControlState.js";
import { ActorText } from "../../application/ui/gui/game/ActorText.js";
import { ActorMovement } from "./ActorMovement.js";
import { TravelMode } from "./TravelMode.js";
import { ActorEquipment } from "./ActorEquipment.js";
import { ActorInventory } from "./ActorInventory.js";
import { ActorStatusProcessor } from "./ActorStatusProcessor.js";
import {StatusFeedback} from "../visuals/StatusFeedback.js";
import {evt} from "../../application/event/evt.js";
import {activateActorVisuals, deactivateActorVisuals} from "../../application/utils/ActorUtils.js";
import {isDev} from "../../application/utils/DebugUtils.js";
import {saveItemStatus} from "../../application/setup/Database.js";
import {requestItemSlotChange} from "../../application/utils/EquipmentUtils.js";
import {sendItemToStash, stashItem} from "../../application/utils/StashUtils.js";
import {ENUMS} from "../../application/ENUMS.js";
import {getActorEquipmentStatusKey} from "../../../../Server/game/utils/EquipmentUtils.js";

// let index = 1; // zero index get culled by connection
let tempVec = new Vector3();
let tempStore = [];
let tempObj = new Object3D();
let tempObj2 = new Object3D();
let tempQuat = new Quaternion();

let broadcastTimeout;
let lastSendTime = 0;


function equipActorItemList(actor, equippedList) {

    let equipQueue = [];
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
            //    console.log("EQUIP: ", equippedList[i])
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


class GameActor {
    constructor(index, config, parsedEquipSlotData) {

        this.combatStandState = 'STAND_COMBAT';
        this.combatBodyState = 'ENGAGING';
        this.combatMoveState = 'MOVE_COMBAT'

        this.id = index+"_"+client.getStamp();
        this.index = index;

        this.insideEncounter = false;

        this.framePos = new Vector3();
        this.lastFramePos = new Vector3();

        this.actorStatusProcessor = new ActorStatusProcessor();
        this.actorText = new ActorText(this);
        this.actorStatus = new ActorStatus(this);
        this.actorInventory = new ActorInventory(this);
        this.statusFeedback = new StatusFeedback();
        this.controlState = new ControlState();
        this.travelMode = new TravelMode();
        this.actorMovement = new ActorMovement();
        this.activated = false;

        this.onActivationCallbacks = [];

        this.actorObj3d = new Object3D();
        this.pos = this.actorObj3d.position;
        this.config = config;
        this.actorEquipment = new ActorEquipment(parsedEquipSlotData)

        this.visualActor = null;

        this.lookDirection = new Vector3()

        this.gameWalkGrid = new GameWalkGrid();

        this.actorTurnSequencer = new ActorTurnSequencer()

        this.lastSendTime = 0;

        this.activeActions = [];

        let setAsSelection = function () {
            let data = {
                MAIN_CHAR_STATUS:this.actorStatus.statusMap
            }
            PipelineAPI.setCategoryData('CHARACTERS', data)
        }.bind(this);

        let updateGameActor = function(tpf) {
            this.updateGameActor(tpf);
        }.bind(this);

        let onActive = function() {
            culled = true;
        //    this.actorText.say("   ++++   ")
        //    /*
            if (this.preDeactivated) {
                this.actorText.say("PRE    DEA")
                console.log("Pre Deactivated happened, fix callback chain..")
                return;
            }
        //    */

            // skeleton not always ready here...
            this.actorEquipment.activateActorEquipment(this, this.config['equip_slots'])

            this.activated = true;
            let equippedList = this.getStatus(ENUMS.ActorStatus.EQUIPPED_ITEMS)
            equipActorItemList(this, equippedList)

            while (this.onActivationCallbacks.length) {
                this.onActivationCallbacks.pop()();
            }
            GameAPI.registerGameUpdateCallback(updateGameActor);

        }.bind(this);


        let getActorPos = function() {
            return this.getSpatialPosition();
        }.bind(this);

        this.turnEndCallbacks = [];

        let turnEnd = function() {
            while (this.turnEndCallbacks.length) {
                let cb = this.turnEndCallbacks.pop();
                if (typeof (cb) === 'function') {
                    cb (this);
                } else {
                    console.log("Turn end CB not function... ", cb)
                }
            }

            this.setStatusKey(ENUMS.ActorStatus.TURN_DONE, this.getStatus(ENUMS.ActorStatus.HAS_TURN_INDEX))
            this.setStatusKey(ENUMS.ActorStatus.HAS_TURN, false);
            this.setStatusKey(ENUMS.ActorStatus.PARTY_SELECTED, false);
        }.bind(this)




        let spatialTransition;
        let setSpatialTransition = function(transition) {
            spatialTransition = transition;
        }

        let getActiveSpatialTransition = function() {
            return spatialTransition;
        }

        let remote = null;

        function setRemote(rem) {
            remote = rem;
        }

        function getRemote() {
            return remote;
        }

        let remove = function() {
            this.removeGameActor();
        }.bind(this);


        let getActionByKey = function(actionKey, actorStatusKey) {
            for (let i = 0; i < this.activeActions.length; i++) {
                if (this.activeActions[i].getActionKey() === actionKey) {
                    return this.activeActions[i];
                }
            }
            let actionKeys = this.getStatus(ENUMS.ActorStatus[actorStatusKey]);
            if (actionKeys.indexOf(actionKey) !== -1) {
                return actionKey
            } else {
                return false;
            }
        }.bind(this);

        let deactivateAction = function(actor, action) {
            actor.actorText.say("Action Completed")
            MATH.splice(this.activeActions, action);
        }.bind(this);

        let activateActionKey = function(actionKey, actorStatusKey) {
            let action = poolFetch('ActorAction');

            if (actorStatusKey === ENUMS.ActorStatus.TRAVEL) {
                while (this.activeActions.length) {
                    this.activeActions.pop().call.updateActionCompleted();
                }

                let deactivateTravel = function() {
                    this.setStatusKey(ENUMS.ActorStatus.TRAVEL_MODE, ENUMS.TravelMode.TRAVEL_MODE_INACTIVE)
                }.bind(this)
                action.onCompletedCallbacks.push(deactivateTravel);
            }

            this.activeActions.push(action);
            action.setActionKey(this, actionKey);
            action.onCompletedCallbacks.push(deactivateAction);
            return action;
        }.bind(this);

        let inventoryItemAdded = function(itemId, switchItemId) {
            if (itemId === null) {
                this.actorText.say('No room for more')
            } else {
                this.actorText.say('Got that loot')
                if (switchItemId !== "") {
                    console.log("Switch Inv Item: ", switchItemId);
                }
            }
        }.bind(this);


        let equipItem = function(item) {
            this.equipItem(item);
        }.bind(this)



        let culled = true;

        let actorReady = function() {

        }

        let frustumCulled = function(bool) {
            if (culled !== bool) {
                culled = bool;
                if (culled) {
                    this.hideGameActor();
                } else {
                    this.showGameActor(actorReady);
                }
            }

        }.bind(this)

        function isCulled() {
            return culled;
        }

        let pos = this.actorObj3d.position;
        function getPosition() {
            return pos;
        }

        this.call = {
            equipItem:equipItem,
            setRemote:setRemote,
            getRemote:getRemote,
            getActionByKey:getActionByKey,
            activateActionKey:activateActionKey,
            remove:remove,
            turnEnd:turnEnd,
            onActive:onActive,
            setAsSelection:setAsSelection,
            updateGameActor:updateGameActor,
            getActorPos:getActorPos,
            setSpatialTransition:setSpatialTransition,
            getActiveSpatialTransition:getActiveSpatialTransition,
            inventoryItemAdded:inventoryItemAdded,
            frustumCulled:frustumCulled,
            isCulled:isCulled,
            getPosition:getPosition
        }
    }

    getEquippedItems() {
        return this.actorEquipment.items;
    }

    isPlayerActor() {
        if (this.call.getRemote() === null) {
            let isParty = GameAPI.getGamePieceSystem().isPlayerPartyActor(this);
            if (isParty) {
                if (this.call.getRemote()) {
                    return false;
                }
                return true;
            }
        }
        return false;
    }


    getTileSelector() {
        return this.gameWalkGrid.gridTileSelector;
    }

    getGameWalkGrid() {
        return this.gameWalkGrid;
    }

    getActorTurnSequencer() {
        return this.actorTurnSequencer;
    };

    getVisualJointWorldTransform(jointKey, storeObj3d) {

        if (this.getVisualGamePiece() === null) {
            console.log("No getVisualGamePiece")
            return;
        }

        if (!this.getVisualGamePiece().getModel()) {
            console.log("No Model Ready")
        } else {
            this.getVisualGamePiece().getModel().getJointKeyWorldTransform(jointKey, storeObj3d);
        }
    }

    checkBroadcast(actor) {

        if (actor) {
            if (actor.call.getRemote()) {
                return false;
            }

            if (typeof(actor.getStatus) === 'function') {
                let clientStamp =client.getStamp();
                let actorClientStamp = actor.getStatus(ENUMS.ActorStatus.CLIENT_STAMP)
                if (clientStamp !== actorClientStamp) {
                //    return false;
                }
            }
        }

        let encounterHosted = false;
        let dynEnc = GameAPI.call.getDynamicEncounter()
        if (dynEnc) {
            let encActors = dynEnc.status.call.getStatus(ENUMS.EncounterStatus.ENCOUNTER_ACTORS)
            if (encActors.indexOf(this.id) !== -1) {
                encounterHosted = true;
            }
        }

        if (encounterHosted || actor.isPlayerActor()) {
            return true;
        } else {
            return false;
        }

    }

    sendStatus(delay) {

        if (this.checkBroadcast(this)) {
            this.actorStatus.setStatusKey(ENUMS.ActorStatus.CLIENT_STAMP, client.getStamp());
            let gameTime = GameAPI.getGameTime();
            if (this.lastSendTime < gameTime -delay) {
                this.actorStatus.broadcastStatus(gameTime);
                this.lastSendTime = gameTime;
            }
        }
    }

    setStatusKey(key, status) {

        let currentStatus = this.actorStatus.getStatusByKey(key)

        let isUpdated = false;
        if (currentStatus !== status) {
            isUpdated = true;
        } else {
            if (typeof (currentStatus.length) === 'number') {
                for (let i = 0; i < currentStatus[i]; i++) {
                    if (currentStatus[i] !== status[i]) {
                        isUpdated = true;
                        continue;
                    }
                }
            }
        }



        if (isUpdated === true) {
            this.statusFeedback.setStatusKey(key, status, this);
            this.actorStatus.setStatusKey(key, status);
            this.sendStatus(0.1)
        }   else {
            this.sendStatus(8)
        }

    }

    getStatus(key) {
        if (!key) {
            return this.actorStatus.statusMap
        }
        return getActorEquipmentStatusKey(this, key)
    }

    setControlKey(key, status) {
        return this.controlState.setControlByKey(key, status);
    }

    getControl(key) {
        return this.controlState.getControlByKey(key);
    }

    getPos() {

        if (!this.call) {
            return ThreeAPI.tempVec3;
        }

        return this.call.getPosition();
    }

    getQuat() {
        console.log("actor getQuat()")
        return this.gameWalkGrid.getGridMovementObj3d().quaternion;
    }

    getObj3d() {
        console.log("actor getObj3d()")
        return this.gameWalkGrid.getGridMovementObj3d();
    }

    sendChatMessage(string, channel) {
        evt.dispatch(ENUMS.Event.SEND_SOCKET_MESSAGE, {
            request:ENUMS.ClientRequests.SEND_CHAT_MESSAGE,
            text:string,
            info:{channel: channel || ENUMS.Channel.CHANNEL_SAY}
        })
    }

    processItemLooted(item) {

        let itemType = item.getStatus(ENUMS.ItemStatus.ITEM_TYPE)
        if (itemType === ENUMS.itemTypes.DEED || itemType === ENUMS.itemTypes.KIT || itemType === ENUMS.itemTypes.RECIPE || itemType === ENUMS.itemTypes.ESTATE || itemType === ENUMS.itemTypes.MATERIAL || itemType === ENUMS.itemTypes.CURRENCY) {
            stashItem(item, false);
            return;
        }

        let slotId = item.getEquipSlotId();
        let existingItem = this.actorEquipment.getEquippedItemBySlotId(slotId);

        if (existingItem !== null) {
            slotId = this.actorInventory.getFirstEmptySlotKey();
        }

        requestItemSlotChange(this, item, slotId)

    }

    equipItem(item) {
        this.actorEquipment.call.equipActorItem(item);
    }

    unequipItem(item) {
        this.actorEquipment.call.unequipActorItem(item);
    }

    getVisualGamePiece() {
        return this.visualActor;
    }

    activateUiState(stateKey) {
        let list = this.getStatus(ENUMS.ActorStatus.ACTIVE_UI_STATES);
        if (list.indexOf(stateKey) === -1) {
            list.push(stateKey);
        }
    }

    deactivateUiState(stateKey) {
        let list = this.getStatus(ENUMS.ActorStatus.ACTIVE_UI_STATES);
        if (list.indexOf(stateKey) !== -1) {
            MATH.splice(list, stateKey);
        } else {
            console.log("UI State not active? ", stateKey);
        }
    }

    getCenterMass() {
        let pos = this.getSpatialPosition();
        pos.y += this.getStatus(ENUMS.ActorStatus.HEIGHT) * 0.7;
        return pos;
    }

    showGameActor(onReady) {
        activateActorVisuals(this, onReady);
    }

    hideGameActor() {
        deactivateActorVisuals(this);
    }

    activateGameActor(onActorReady) {
    //<    console.log("activateGameActor GA ", this)
        if (this.getStatus(ENUMS.ActorStatus.IS_ACTIVE) === 1) {
            return;
        }
        this.setStatusKey(ENUMS.ActorStatus.IS_ACTIVE, 1);
        this.setStatusKey(ENUMS.ActorStatus.EXISTS, 1);
        this.actorTurnSequencer.setGameActor(this);

        this.call.onActive()

        if (typeof (onActorReady) === 'function') {
            onActorReady(this);
        }

    }

    deactivateGameActor() {
    //
        if (isDev()) {
            this.actorText.say("----OFF")
        }

        this.setStatusKey(ENUMS.ActorStatus.IS_ACTIVE, 0);
        if (this.activated === true) {
       //     console.log("Deactivate GA ", this)
            this.actorEquipment.removeAllItems();
            GameAPI.unregisterGameUpdateCallback(this.call.updateGameActor);
            this.activated = false;
            this.actorStatusProcessor.clearActorStatus(this);
            this.hideGameActor();
        } else {
            this.preDeactivated = true;
        }
    //    this.visualActor = null;
    }

    leavePlayerParty() {
        let removedPartyActor = GameAPI.getGamePieceSystem().playerParty.removePartyActor(this)
    }

    removeGameActor() {
        if (this.isPlayerActor()) {
            console.log("Not Removing Player Actor")
            this.actorText.say("Try removing me?")
            return;
        } else {
        //    console.log("Removing Non Player Actor", this)
        }
        this.setStatusKey(ENUMS.ActorStatus.EXISTS, 0);
        this.leavePlayerParty()
        let actors = GameAPI.getGamePieceSystem().getActors();
        MATH.splice(actors, this);
        this.deactivateGameActor()
    }

    activateWalkGrid(tileRange, onActiveCB) {
        let gameWalkGrid = this.getGameWalkGrid()
        gameWalkGrid.activateWalkGrid(this, tileRange, onActiveCB)
        gameWalkGrid.call.updateWalkGrid()
    }

    prepareTilePath(toPos) {
        let gameWalkGrid = this.getGameWalkGrid()
        let tilePath = gameWalkGrid.buildGridPath(toPos, this.getSpatialPosition())
        if (tilePath) {
            this.setDestination(tilePath.getEndTile().getPos());
        }

    }

    setAdventureProgress(advId, progressIndex) {
        this.actorStatus.setStatusAdvProgress(advId, progressIndex);
    }

    getAdventureProgress(advId) {
        return this.actorStatus.getStatusAdvProgress(advId);
    }

    moveActorOnGridTo(pos, onMoveEnded) {
        let gameWalkGrid = this.getGameWalkGrid()
        gameWalkGrid.buildGridPath(pos, this.getSpatialPosition())
        gameWalkGrid.applySelectedPath(null, onMoveEnded )
    }

    getForward() {
        tempVec.set(0, 0, 1);
        this.getSpatialQuaternion(tempObj)
        tempVec.applyQuaternion(tempObj);
        return tempVec;
    }

    getActorGridMovementTargetPosition() {
        let tiles = GameAPI.call.getActiveEncounter().getRandomWalkableTiles(2);
        if (tiles[0] === this.gameWalkGrid.getTileAtPosition(this.getSpatialPosition())) {
            return tiles[1].getPos()
        } else {
            return tiles[0].getPos()
        }
    }

    turnTowardsPos(posVec) {
        this.lookDirection.copy(posVec);
        this.getSpatialPosition(tempVec)
        this.lookDirection.y = tempVec.y;
        this.lookDirection.sub(tempVec);
        this.lookDirection.normalize();
    }

    applyHeading(direction, alpha) {
        tempObj.position.set(0, 0, 0)
        tempObj.lookAt(direction);
        this.getSpatialQuaternion(tempObj2.quaternion)
        tempObj2.quaternion.slerp(tempObj.quaternion, alpha || 0.1)
        this.setSpatialQuaternion(tempObj2.quaternion);
    }

    setDestination(posVec) {
    //    console.log("setDestination ", posVec)
        let destination = this.actorStatus.getStatusByKey(ENUMS.ActorStatus.SELECTED_DESTINATION);
        MATH.vec3ToArray(posVec, destination);
        this.actorStatus.setStatusKey(ENUMS.ActorStatus.SELECTED_DESTINATION, destination);
    }

    getDestination(storeVec) {
        if (!storeVec) {
            storeVec = tempVec;
        }
        let destination = this.actorStatus.getStatusByKey(ENUMS.ActorStatus.SELECTED_DESTINATION);
        MATH.vec3FromArray(storeVec, destination);
        return storeVec;
    }

    setSpatialVelocity(velVec) {
    //    let pos = this.getSpatialPosition();
    //    pos.add(velVec),
    //    evt.dispatch(ENUMS.Event.DEBUG_DRAW_CROSS, {pos:pos, color:'GREEN', size:0.35})
        MATH.testVec3ForNaN(velVec)
        this.actorStatus.setStatusVelocity(velVec);
    }

    getSpatialVelocity(store) {
        return this.actorStatus.getStatusVelocity(store);
    }

    setSpatialQuaternion(quat) {
        this.actorObj3d.quaternion.copy(quat)
        this.actorStatus.setStatusQuaternion(quat);
    }

    getSpatialQuaternion(store) {
        return this.actorStatus.getStatusQuaternion(store);
    }

    setSpatialPosition(posVec) {
    //    evt.dispatch(ENUMS.Event.DEBUG_DRAW_CROSS, {pos:posVec, color:'WHITE', size:0.35})
        this.actorObj3d.position.copy(posVec)
        this.actorStatus.setStatusPosition(posVec);
    }

    getSpatialPosition(store) {
        return this.actorStatus.getStatusPosition(store);
    }

    setSpatialScale(scaleVec) {
        this.actorStatus.setStatusScale(scaleVec);
        this.actorObj3d.scale.copy(scaleVec)
    }

    getHeadPosition() {
        let pos = this.getSpatialPosition()
        pos.y += this.getStatus(ENUMS.ActorStatus.HEIGHT);
        return pos;
    }

    transitionTo(pos, time) {

        let onCompleted = function() {
            poolReturn(transition);
        }

        let onUpdate = function(pos) {
            this.setSpatialPosition(pos);
        }.bind(this);

        let transition = poolFetch('SpatialTransition');
        transition.targetPos.copy(pos);
        this.actorObj3d.position.copy(this.getSpatialPosition());
        transition.initSpatialTransition(this.actorObj3d.position, transition.targetPos, time, onCompleted, null, null, onUpdate)
        this.setDestination(pos);
    }

    getSpatialScale(store) {
        return this.actorStatus.getStatusScale(store);
    }

    updateGameActor(tpf) {

        let remote = this.call.getRemote()
        this.getSpatialPosition(this.framePos);

        if (remote === null) {

            if (this.getStatus(ENUMS.ActorStatus.TRAVEL_MODE) === ENUMS.TravelMode.TRAVEL_MODE_FLY) {

                this.getSpatialVelocity(this.lookDirection);
                this.framePos.add(this.lookDirection);
                this.setSpatialPosition(this.framePos);
                this.setStatusKey(ENUMS.ActorStatus.FRAME_TRAVEL_DISTANCE, this.lookDirection.length());
            } else {

                if (this.lastFramePos.length() === 0) {
                    this.lastFramePos.copy(this.framePos);
                }

                tempVec.copy(this.framePos);
                tempVec.sub(this.lastFramePos);
                this.setSpatialPosition(this.framePos);
                let speed = tempVec.length();

                if (speed > 100) {
                    console.log("bad speed")
                }

                this.setSpatialVelocity(tempVec);
                //    console.log(tempVec.length())
                //    this.framePos.add(tempVec);

                if (speed < 0.001) {
                    this.setStatusKey(ENUMS.ActorStatus.FRAME_TRAVEL_DISTANCE, 0);
                } else {
                    this.setStatusKey(ENUMS.ActorStatus.FRAME_TRAVEL_DISTANCE, speed);
                    //    tempVec.add(this.framePos);
                    // this.lookDirection.copy(tempVec);
                    this.getSpatialVelocity(this.lookDirection)
                    this.lookDirection.y = 0;

                //    let bodyPointer = this.getStatus(ENUMS.ActorStatus.RIGID_BODY_CONTACT);
                //    this.actorText.say(""+bodyPointer);

                }

                this.applyHeading(this.lookDirection, this.getStatus(ENUMS.ActorStatus.ACTOR_YAW_RATE) * tpf);
            }

            this.travelMode.updateTravelMode(this);
        } else {

        //    let now = GameAPI.getGameTime();
            let fraction = tpf/remote.timeDelta;
        //    this.getSpatialPosition(this.framePos);
            if (remote.lastUpdate.vel.manhattanDistanceTo(remote.vel) > 0.01) {
                remote.lastUpdate.vel.lerp(remote.vel, fraction);
                this.setSpatialVelocity(remote.lastUpdate.vel);
            } else {
                if (remote.vel.lengthSq() < 0.1) {
                    remote.vel.set(0, 0, 0);
                    this.setSpatialVelocity(remote.vel);
                }
            }

            if (remote.lastUpdate.scale.manhattanDistanceTo(remote.scale) > 0.01) {
                remote.lastUpdate.scale.lerp(remote.scale, fraction);
                this.setSpatialScale(remote.lastUpdate.scale);
            }
            if (remote.lastUpdate.pos.manhattanDistanceTo(remote.pos) > 0.01) {
                remote.lastUpdate.pos.lerp(remote.pos, fraction);
                this.framePos.copy(remote.lastUpdate.pos);
            }

            if (MATH.compareQuaternions(remote.lastUpdate.quat, remote.quat) > 0.001) {
                remote.lastUpdate.quat.slerp(remote.quat, fraction);
                this.setSpatialQuaternion(remote.lastUpdate.quat);
            }

            this.setSpatialPosition(this.framePos);
        }

        tempObj.position.copy(this.framePos);

        this.lastFramePos.copy(this.framePos);
        this.getSpatialQuaternion(tempObj.quaternion);

        this.actorStatusProcessor.processActorStatus(this);

    }

}

export { GameActor }