import {poolFetch, poolReturn} from "../../application/utils/PoolUtils.js";
import {notifyCameraStatus} from "../../3d/camera/CameraFunctions.js";
import {Vector3} from "../../../libs/three/math/Vector3.js";
import {CameraStatusProcessor} from "../../application/utils/CameraStatusProcessor.js";
import {
    applyPhysicalInfluenceRayProbe,
    getModelByBodyPointer,
    getPhysicalWorld, getTerrainBodyPointer, processRayHitKickInfluence,
    rayAllIntersects,
    rayTest, updateViewObstruction
} from "../../application/utils/PhysicsUtils.js";
import {ENUMS} from "../../application/ENUMS.js";
import {hasCombatState} from "../../../../Server/game/actor/ActorStatusFunctions.js";
import {ItemSlot} from "../gamepieces/ItemSlot.js";
import {aaBoxTestVisibility} from "../../application/utils/ModelUtils.js";
import {ActorStatus} from "./ActorStatus.js";
import {storePlayerActorStatus} from "../../application/setup/Database.js";
import {DomSettings} from "../../application/ui/dom/DomSettings.js";
import {getSetting} from "../../application/utils/StatusUtils.js";
import {getPlayerActor} from "../../application/utils/ActorUtils.js";
import {visualPhysicsImpulse} from "../visuals/effects/VisualPhysisEffects.js";
import {DomPartyJoin} from "../../application/ui/dom/DomPartyJoin.js";
import {activateSeekPartyEncounter} from "../../application/utils/PlayerUtils.js";

let tempVec = new Vector3()
let tempVec2 = new Vector3();
let tempVec3 = new Vector3();
let tempVec4 = new Vector3();
let tempVec5 = new Vector3();
let tempVec6 = new Vector3();
let cameraStatusProcessor = new CameraStatusProcessor()

function registerPathPoints(actor) {
    let pathPoints = actor.getStatus(ENUMS.ActorStatus.PATH_POINTS);

    MATH.emptyArray(pathPoints);

    let walkGrid = actor.getGameWalkGrid();
    let pathTiles = walkGrid.getActivePathTiles();

    if (pathTiles.length > 1) {
        for (let i = 0; i < pathTiles.length; i++) {
            let pathPoint = pathTiles[i].pathPoint;
            pathPoints[i] = pathPoint.point;
        }
    }
}

function updatePathPointVisuals(actor) {
    let pathPoints = actor.getStatus(ENUMS.ActorStatus.PATH_POINTS);
    if (actor.visualActor !== null) {
        actor.visualActor.visualPathPoints.updatePathPoints(actor, pathPoints)
    }

}


function processAnimationState(actor) {

    if (actor.getStatus(ENUMS.ActorStatus.DEAD) === true) {
        actor.setStatusKey(ENUMS.ActorStatus.TRAVEL_MODE, ENUMS.TravelMode.TRAVEL_MODE_INACTIVE);
        actor.setStatusKey(ENUMS.ActorStatus.RETREATING, actor.getStatus(ENUMS.ActorStatus.ACTIVATED_ENCOUNTER || ''));
        //     actor.setStatusKey(ENUMS.ActorStatus.BODY_STATE, 'FALL_DOWN');
        actor.setStatusKey(ENUMS.ActorStatus.MOVE_STATE, 'LIE_DEAD');
       actor.setStatusKey(ENUMS.ActorStatus.STAND_STATE, 'LIE_DEAD');
        return;
    }

    if (hasCombatState(actor, ENUMS.CombatStatus.PUSHED)) {
        actor.setStatusKey(ENUMS.ActorStatus.TRAVEL_MODE, ENUMS.TravelMode.TRAVEL_MODE_INACTIVE);
        actor.setStatusKey(ENUMS.ActorStatus.MOVE_STATE, 'FALL_DOWN');
        actor.setStatusKey(ENUMS.ActorStatus.STAND_STATE, 'FALL_DOWN');
        return;
    }


    let isLeaping = actor.getStatus(ENUMS.ActorStatus.IS_LEAPING)
    if (isLeaping) {
        actor.setStatusKey(ENUMS.ActorStatus.MOVE_STATE, 'STAND_COMBAT')
        actor.setStatusKey(ENUMS.ActorStatus.BODY_STATE, 'GUARD_SIDE')
    } else {
        if (actor.getStatus(ENUMS.ActorStatus.IN_COMBAT)) {
            actor.setStatusKey(ENUMS.ActorStatus.MOVE_STATE, actor.combatMoveState)
            actor.setStatusKey(ENUMS.ActorStatus.STAND_STATE, actor.combatStandState)
            actor.setStatusKey(ENUMS.ActorStatus.BODY_STATE, actor.combatBodyState)
        } else {
            if (actor.getStatus(ENUMS.ActorStatus.ACTIVATING_ENCOUNTER)) {
                actor.setStatusKey(ENUMS.ActorStatus.MOVE_STATE, 'MOVE_COMBAT')
                actor.setStatusKey(ENUMS.ActorStatus.STAND_STATE, 'STAND_COMBAT')
                actor.setStatusKey(ENUMS.ActorStatus.BODY_STATE, 'GUARD_INSIDE')
            } else {
                actor.setStatusKey(ENUMS.ActorStatus.MOVE_STATE, 'MOVE')
                actor.setStatusKey(ENUMS.ActorStatus.STAND_STATE, 'IDLE_LEGS')
                actor.setStatusKey(ENUMS.ActorStatus.BODY_STATE, 'IDLE_HANDS')
            }
        }
    }

}


let partySeekers = [];
let domPartyJoin = null;

// Very Naive party creation logic, will break if multiple players make simultaneous requests

function processPartyStatus(actor) {
    let partyStatus = actor.getStatus(ENUMS.ActorStatus.REQUEST_PARTY);
    let worldActors = GameAPI.getGamePieceSystem().getActors();
    let playerParty = GameAPI.getGamePieceSystem().playerParty
    if (partyStatus && playerParty.actors.length === 1) {
        for (let i = 0; i < worldActors.length; i++) {
            let otherActor = worldActors[i];
            if (otherActor !== actor && playerParty.isMember(otherActor) === false) {
                let compareStatus = otherActor.getStatus(ENUMS.ActorStatus.REQUEST_PARTY);
                if (compareStatus === partyStatus) {
                    if (playerParty.actors.length === 1) {
                        //         GuiAPI.screenText("Party Created")
                    }
                    // console.log("JOIN PARTY: ", playerParty, actor.id)
                    GuiAPI.screenText("PARTY JOINED", ENUMS.Message.HINT, 4);
                    // otherActor.actorText.say("Joining")
                    if (playerParty.isMember(otherActor) === false) {
                        playerParty.addPartyActor(otherActor);
                        activateSeekPartyEncounter("")
                    }
                }
            }
        }
    } else if (playerParty.actors.length === 1) {
        for (let i = 0; i < worldActors.length; i++) {
            let otherActor = worldActors[i];
            if (otherActor !== actor && playerParty.isMember(otherActor) === false) {
                let actorId = otherActor.getStatus(ENUMS.ActorStatus.ACTOR_ID)
                let encId = otherActor.getStatus(ENUMS.ActorStatus.REQUEST_PARTY);

                let seekerIndex = partySeekers.indexOf(actorId)

                if (encId !== "") {
                    if (seekerIndex === -1) {

                        if (domPartyJoin === null) {
                            domPartyJoin = new DomPartyJoin();
                            domPartyJoin.call.setSeekerList(partySeekers);
                        }

                        partySeekers.push(actorId);
                        partySeekers.push(encId);
                    }
                } else {
                    if (seekerIndex !== -1) {
                        partySeekers.splice(seekerIndex, 2);
                    }
                }
            }
        }
    }

    if (partySeekers.length === 0) {
        if (domPartyJoin !== null) {
            domPartyJoin.call.close();
            domPartyJoin = null;
        }
    }

    if (playerParty.isMember(actor)) {

    }

}


function processFrustumCulling(actor) {
    let size = actor.getStatus(ENUMS.ActorStatus.SIZE);
    let isVisible = aaBoxTestVisibility(actor.getSpatialPosition(), size, size, size);

  //  console.log("processFrustumCulling", actor);

    actor.call.frustumCulled(!isVisible);

    /*

    let cPos = ThreeAPI.getCameraCursor().getLookAroundPoint();
    tempVec.copy(cPos);
    tempVec.y += 0.25;

    if (isVisible === false) {
        evt.dispatch(ENUMS.Event.DEBUG_DRAW_LINE, {from:tempVec, to:actor.getPos(), color:'RED'});
    } else {
        evt.dispatch(ENUMS.Event.DEBUG_DRAW_LINE, {from:tempVec, to:actor.getPos(), color:'CYAN'});
    }
*/
}

function processActorSizeStatus(actor) {
    let size = actor.getStatus(ENUMS.ActorStatus.SIZE);

    tempVec.set(size, size, size);
    actor.setSpatialScale(tempVec);
}

function processInCombat(actor) {
    if (actor.getStatus(ENUMS.ActorStatus.DEAD) === true) {
        return;
    }

    let hp = actor.getStatus(ENUMS.ActorStatus.HP)
    if (hp < 1) {
        actor.setStatusKey(ENUMS.ActorStatus.DEAD, true);
    }

    let dmgApplied = actor.getStatus(ENUMS.ActorStatus.DAMAGE_APPLIED);
    let healApplied = actor.getStatus(ENUMS.ActorStatus.HEALING_APPLIED);
    if (dmgApplied) {
        //    console.log("processing dmg applied")
        actor.actorText.pieceTextPrint(dmgApplied, ENUMS.Message.DAMAGE_NORMAL_TAKEN, 3)
        actor.setStatusKey(ENUMS.ActorStatus.DAMAGE_APPLIED, 0)
    }

    if (healApplied) {

        actor.actorText.pieceTextPrint(healApplied, ENUMS.Message.HEALING_GAINED, 3)
        actor.setStatusKey(ENUMS.ActorStatus.HEALING_APPLIED, 0)
    }

    actor.setStatusKey(ENUMS.ActorStatus.TRAVEL_MODE, ENUMS.TravelMode.TRAVEL_MODE_BATTLE);

    if (actor.getStatus(ENUMS.ActorStatus.HAS_TURN) === false) {
        //    actor.actorText.say(actor.getStatus(ENUMS.ActorStatus.TURN_DONE))
        //    actor.setStatusKey(ENUMS.ActorStatus.TRAVEL_MODE, ENUMS.TravelMode.TRAVEL_MODE_INACTIVE);
    } else {

    }
}

function processOutOfCombat(actor) {
    if (actor.getStatus(ENUMS.ActorStatus.DEAD) === false) {
        actor.setStatusKey(ENUMS.ActorStatus.HP, actor.getStatus(ENUMS.ActorStatus.MAX_HP));
    }
}

function processActorCombatStatus(actor) {

    if (actor.getStatus(ENUMS.ActorStatus.IN_COMBAT)) {
        processInCombat(actor);
    } else {
        processOutOfCombat(actor)
    }
}





function updateViewPhysicalObstruction(actor) {
//    updateViewObstruction(actor.getPos());
}

let lastContact = 0;
let lastContactModel = null;



function updateRigidBodyContact(actor) {

    let ptr = actor.getStatus(ENUMS.ActorStatus.RIGID_BODY_CONTACT);

    let terrainPtr = getTerrainBodyPointer();

    if (ptr === terrainPtr) {
        ptr = 0;
    }

    if (ptr !== lastContact) {

        if (lastContact !== 0) {
            if (lastContactModel) {
                lastContactModel.call.playerContact(false)
            }
        }

        if (ptr !== 0) {
            let physicalModel = getModelByBodyPointer(ptr)
            if (physicalModel) {
                let model = physicalModel.call.getModel()
                //     console.log(physicalModel, model);
                if (!model) {
                    console.log("Probably Primitive, figure out")
                    lastContactModel = null
                } else {
                    model.call.playerContact(true)
                    lastContactModel = model
                }
            } else {
                lastContactModel = null
            }

        }

        lastContact = ptr;

     //   console.log( "contact" , lastContactModel)
    }

}

function processSelectedActorTurnState(actor) {

    let turnState = actor.getStatus(ENUMS.ActorStatus.TURN_STATE)


    if (turnState === ENUMS.TurnState.TURN_INIT) {
    //    actor.actorText.say(turnState)
        actor.setStatusKey(ENUMS.ActorStatus.TRAVEL_MODE, ENUMS.TravelMode.TRAVEL_MODE_BATTLE)
        actor.setStatusKey(ENUMS.ActorStatus.REQUEST_TURN_STATE, ENUMS.TurnState.TURN_MOVE)
    //    actor.setStatusKey(ENUMS.ActorStatus.TURN_STATE, ENUMS.TurnState.TURN_MOVE)
    } else if (turnState === ENUMS.TurnState.TURN_MOVE) {
    //    console.log("Update TURN_MOVE", actor)

    //    actor.actorText.say('play me')

    } else if (turnState === ENUMS.TurnState.ACTION_APPLY) {
        //    console.log("Update TURN_MOVE", actor)

        actor.setStatusKey(ENUMS.ActorStatus.TRAVEL_MODE, ENUMS.TravelMode.TRAVEL_MODE_PASSIVE)

    //    actor.actorText.say('action apply')

    } else if (turnState === ENUMS.TurnState.TURN_CLOSE) {
            console.log("Update TURN_CLOSE", actor)
    //    actor.actorText.say('turn done')
    //    actor.setStatusKey(ENUMS.ActorStatus.REQUEST_TURN_STATE, ENUMS.TurnState.NO_TURN)
    }


}


function processActorEncounterInit(actor) {
    //    let activating = actor.getStatus(ENUMS.ActorStatus.ACTIVATING_ENCOUNTER);
  let activated = actor.getStatus(ENUMS.ActorStatus.ACTIVATED_ENCOUNTER);

    if (activated !== "" && actor.insideEncounter === false) {
        console.log("Player Enc Activate")
        actor.insideEncounter = true;

        if (actor.isPlayerActor()) {
            GameAPI.getGamePieceSystem().hideNonPartyActors();
        } else {
            let playerParty = GameAPI.getGamePieceSystem().playerParty;

            if (!playerParty.isMember(actor)) {
                GameAPI.getGamePieceSystem().detachRemoteByActor(actor);
            }
        }

    }

}

function processActorEncounterExit(actor) {
    let activated = actor.getStatus(ENUMS.ActorStatus.ACTIVATED_ENCOUNTER);

    if (activated === ""  && actor.insideEncounter === true) {
        console.log("Player Enc Deactivate")
        actor.insideEncounter = false;
        // Remotes get rebuilt by incoming server traffic
    //    GameAPI.getGamePieceSystem().revealNonPartyActors();
    }

}

let lastNavState = ENUMS.NavigationState.NONE;
let sourceTraveLMode = ENUMS.TravelMode.TRAVEL_MODE_WALK;
let htmlPages = {
    settings:null,
    map:null,
    inventory:null
}
let settingsPage = null;


function processActorUiNavigationState(actor) {
    let navState = actor.getStatus(ENUMS.ActorStatus.NAVIGATION_STATE);

    if (lastNavState !== navState) {

        gtag('event', 'NAVIGATION_STATECHANGE', {
            "event_category": "UI",
            "event_label": navState
        });


        if (lastNavState === ENUMS.NavigationState.WORLD) {
            sourceTraveLMode = actor.getStatus(ENUMS.ActorStatus.TRAVEL_MODE);
            actor.setStatusKey(ENUMS.ActorStatus.TRAVEL_MODE, ENUMS.TravelMode.TRAVEL_MODE_PASSIVE)
            actor.setStatusKey(ENUMS.ActorStatus.PARTY_SELECTED, false)
        } else {
            for (let key in htmlPages) {
                if (htmlPages[key] !== null) {
                    htmlPages[key].closeHtmlElement()
                    poolReturn(htmlPages[key])
                    htmlPages[key] = null;
                }
            }
        }


        if (navState === ENUMS.NavigationState.WORLD) {
            actor.actorText.say("WORLD");
        //    console.log("Recover Travel Mode", sourceTraveLMode)
            actor.setStatusKey(ENUMS.ActorStatus.TRAVEL_MODE, sourceTraveLMode)
        } else if (navState === ENUMS.NavigationState.PARTY) {
            actor.actorText.say("PARTY");
        } else if (navState === ENUMS.NavigationState.CHARACTER) {
            GuiAPI.inspectActor(actor);
            actor.actorText.say("CHARACTER");
        } else if (navState === ENUMS.NavigationState.HOME) {
            let shId = actor.getStatus(ENUMS.ActorStatus.STRONGHOLD_ID);
            let sh = GameAPI.getGamePieceSystem().getStrongholdById(shId)

            MATH.vec3FromArray(tempVec, sh.getStatus(ENUMS.StrongholdStatus.ENTRANCE));

            actor.setSpatialPosition(tempVec);

            actor.actorText.say("HOME");
        } else if (navState === ENUMS.NavigationState.INVENTORY) {
            actor.actorText.say("INVENTORY");
        } else if (navState === ENUMS.NavigationState.MAP) {
            actor.actorText.say("MAP");
        } else if (navState === ENUMS.NavigationState.SETTINGS) {
            actor.actorText.say("SETTINGS");
            let returnState = lastNavState;
            let onCloseCB = function() {
                settingsPage.closeDomSettings();
            };

            settingsPage = new DomSettings();
            settingsPage.initDomSettings(onCloseCB)
            actor.setStatusKey(ENUMS.ActorStatus.NAVIGATION_STATE, returnState)

        }
        lastNavState = navState;
        GuiAPI.setNavigationState(navState);
    }


}

let lastWorldLevel = "20";
function processWorldTransition(actor) {

    let worldLevel =  GameAPI.getPlayer().getStatus(ENUMS.PlayerStatus.PLAYER_WORLD_LEVEL);

    if (worldLevel !== actor.getStatus(ENUMS.ActorStatus.WORLD_LEVEL)) {
        lastWorldLevel = worldLevel;
        actor.setStatusKey(ENUMS.ActorStatus.WORLD_LEVEL, worldLevel)
        GameAPI.getPlayer().teleportPlayer(worldLevel, actor.getPos(), true)

    //    let fromLevel = lastWorldLevel;
        actor.actorText.say("Enter world level "+worldLevel)

    //    GameAPI.leaveActiveGameWorld();
    //    GameAPI.activateWorldLevel(worldLevel);
    }

}

let unequipList = [];

function processActorEquipment(actor) {


    let equipRequests = actor.getStatus(ENUMS.ActorStatus.EQUIP_REQUESTS)

    let equipment = actor.actorEquipment;
    equipment.call.synchEquipment();
    return;
    let isLoading = false;

    for (let i = 0; i < equipment.slots.length;i++) {
        let slotId = equipment.slots[i]['slot_id'];
        let slotItem = equipment.getEquippedItemBySlotId(slotId);

        let equippedId = actor.getStatus(ENUMS.ActorStatus[slotId]);

        if (equipRequests.indexOf(equippedId) !== -1) {
        //    console.log("Equipped item still in request")
        }


        let slotItemId = "";
        if (slotItem !== null) {
            slotItemId = slotItem.getStatus(ENUMS.ItemStatus.ITEM_ID);
        }

        if (equippedId !== slotItemId) {
            if (equippedId === undefined) {
                return;
            }
        //    console.log("Slot status missmatch", equippedId , slotItemId)
        }



        if (equipRequests.indexOf(slotId) !== -1) {
            if (equipRequests[equipRequests.indexOf(slotId) +1] === equippedId) {
                console.log("Clear Equip Request ", slotId)
                equipRequests[equipRequests.indexOf(slotId) +1] = "remove";
                MATH.splice(equipRequests, slotId);
                MATH.splice(equipRequests, "remove");
            }
        }

        if (slotItemId !== equippedId) {

            if (slotItemId !== "") {
            //    console.log("Diff: ", slotItemId, equippedId)
                equipment.call.unequipActorItem(slotItem, true);
             //   console.log("Item UNequipped by server", slotId, slotItem);
            } else {
            //    console.log("Empty Slot", slotId, slotItemId, equippedId)
            }

            if (equippedId === "") {
                console.log("Slot Cleared by server", slotId);
            } else {
             //   equipment.call.unequipActorItem(slotItem, true);
                let item = GameAPI.getItemById(equippedId);
                if (!item) {
                    isLoading = true;
                } else {
                    equipment.call.equipActorItem(item);
                }
            }
        }


        if (isLoading) {
            if (Math.random() < 0.05) {
        //        actor.actorText.say("Loading Items")
            }
        }

    }
}

function processActorPhysicalInfluence(actor) {

    let playerActor = getPlayerActor();

    if (!playerActor) {
        return;
    }

    let distance = MATH.distanceBetween(actor.getPos(), playerActor.getPos());

    if (distance > getSetting(ENUMS.Settings.DEBRIS_RANGE) * 2) {
        return;
    }


    let probeCount = getSetting(ENUMS.Settings.ACTOR_INFLUENCE_PROBES);
    let probeReach = getSetting(ENUMS.Settings.ACTOR_INFLUENCE_REACH) * 0.2;

    let time = GameAPI.getGameTime() * 30 / probeCount;

    tempVec.copy(actor.getPos());
    actor.getSpatialVelocity(tempVec4);
    tempVec4.multiplyScalar(2);
    tempVec.add(tempVec4);
    tempVec.y += 0.1;
    applyPhysicalInfluenceRayProbe(tempVec, actor.getPos(), probeCount, probeReach, getSetting(ENUMS.Settings.ACTOR_INFLUENCE_POWER), visualPhysicsImpulse)

};

function processInventoryStatus(actor) {

}

function processAdventureStatus(actor) {

    let worldAdventures = GameAPI.gameAdventureSystem.getWorldAdventures();

    let selectedAdventureId = actor.getStatus(ENUMS.ActorStatus.SELECTED_ADVENTURE);

        if (selectedAdventureId !== "") {
            let selectedAdventure = GameAPI.gameAdventureSystem.getAdventureById(selectedAdventureId);
            if (selectedAdventure) {
                let node = selectedAdventure.call.getTargetNode()

                if (node) {
                    tempVec2.copy(node.getPos())
                } else {
                    tempVec2.copy(selectedAdventure.getPos())
                }
            //    tempVec2.copy(actor.getPos());
                tempVec2.sub(actor.getPos());
               tempVec2.normalize();
                //     tempVec.multiplyScalar(0.5);
                tempVec2.add(actor.getPos());
                GameAPI.getPlayer().setFocusOnPosition(tempVec2)
                actor.turnTowardsPos(tempVec2)
            }

        } else {
            GameAPI.getPlayer().setFocusOnPosition(null)
        }


    let activeAdventure = actor.getStatus(ENUMS.ActorStatus.ACTIVE_ADVENTURE);
    if (activeAdventure !== "") {

    } else {
        let completedAdventures = actor.getStatus(ENUMS.ActorStatus.COMPLETED_ADVENTURES);
    }
}

function updateDatabaseStatus(actor) {

    if (Math.random() < 0.1) {
        if (actor.getStatus(ENUMS.ActorStatus.IN_COMBAT === false)) {
            storePlayerActorStatus();
        }

    }

}


class ActorStatusProcessor {
    constructor() {
        this.indicators = {};
        this.actorIndicator = null;
        this.partySelectIndicator = null;
        this.sequencerSelectIndicator = null;
        this.turnActiveIndicator = null;
    }

    attachIndicator(indicatorKey, actor, spriteX, spriteY, spin, scale, pulsate, rate) {
        this.indicators[indicatorKey] = poolFetch('VisualIndicator');
        this.indicators[indicatorKey].indicateActor(actor, spriteX, spriteY, spin, scale, pulsate, rate)
    }

    detachIndicator(indicatorKey) {
        let indicator = this.indicators[indicatorKey];
        if (indicator) {
            this.indicators[indicatorKey] = null;
            indicator.removeIndicatorFx()
            poolReturn(indicator);
        }
    }


    indicateSelectionStatus(actor) {

        if (!this.indicators['actor']) {
            this.attachIndicator('actor', actor, 0, 4)
        }

        if (actor.getStatus(ENUMS.ActorStatus.PARTY_SELECTED)) {
            if (!this.indicators[ENUMS.ActorStatus.PARTY_SELECTED]) {
                this.attachIndicator(ENUMS.ActorStatus.PARTY_SELECTED, actor, 1, 3, 0, 0.85, 0.05, 6)
            }
        } else {
            if (this.indicators[ENUMS.ActorStatus.PARTY_SELECTED]) {
                this.detachIndicator(ENUMS.ActorStatus.PARTY_SELECTED)
            }
        }

        if (actor.getStatus(ENUMS.ActorStatus.SEQUENCER_SELECTED)) {

            if (!this.indicators[ENUMS.ActorStatus.SEQUENCER_SELECTED]) {
                this.attachIndicator(ENUMS.ActorStatus.SEQUENCER_SELECTED, actor, 1, 3, 0, 1.3, 0.07, 8)
            }
        } else {
            if (this.indicators[ENUMS.ActorStatus.SEQUENCER_SELECTED]) {
                this.detachIndicator(ENUMS.ActorStatus.SEQUENCER_SELECTED)
            }
        }

        if (actor.getStatus(ENUMS.ActorStatus.HAS_TURN)) {

            if (!this.indicators[ENUMS.ActorStatus.HAS_TURN]) {
                this.attachIndicator(ENUMS.ActorStatus.HAS_TURN, actor, 0, 6, 0.5, 1.12, 0, 0)
            }

            if (actor === GameAPI.getGamePieceSystem().selectedActor) {
                processSelectedActorTurnState(actor)
            } else {
                let turnState = actor.getStatus(ENUMS.ActorStatus.TURN_STATE)
            //    actor.actorText.say(turnState)
            }

        } else {
            if (this.indicators[ENUMS.ActorStatus.HAS_TURN]) {
                this.detachIndicator(ENUMS.ActorStatus.HAS_TURN)
            }
        }

    }





    processActorStatus(actor) {
        processFrustumCulling(actor);
        processActorSizeStatus(actor);
        processActorCombatStatus(actor);
        processActorEncounterInit(actor);
        processActorEquipment(actor);
        processActorPhysicalInfluence(actor);
        if (actor.isPlayerActor()) {
            cameraStatusProcessor.processCameraStatus(actor)
            processActorUiNavigationState(actor);
            registerPathPoints(actor);
            processPartyStatus(actor);
            updateRigidBodyContact(actor);
            updateViewPhysicalObstruction(actor);
            processActorEncounterExit(actor);
            processWorldTransition(actor);
            processInventoryStatus(actor);
            processAdventureStatus(actor);
            updateDatabaseStatus(actor);
        }
        processAnimationState(actor);
        this.indicateSelectionStatus(actor);
        updatePathPointVisuals(actor);
    }

    clearActorStatus(actor) {
        for (let key in this.indicators) {
            this.detachIndicator(key);
        }
        let pathPoints = actor.getStatus(ENUMS.ActorStatus.PATH_POINTS);
        actor.setStatusKey(ENUMS.ActorStatus.IN_COMBAT, false);
        MATH.emptyArray(pathPoints)

        if (actor.visualActor !== null) {
            actor.visualActor.visualPathPoints.updatePathPoints(actor, pathPoints)
        }

    }

}

export {ActorStatusProcessor}