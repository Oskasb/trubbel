import {configDataList, detachConfig} from "../application/utils/ConfigUtils.js";
import { VisualGamePiece } from "./visuals/VisualGamePiece.js";
import { GameActor } from "./actor/GameActor.js";
import { PlayerParty } from "./Player/PlayerParty.js";
import { Item } from "./gamepieces/Item.js";
import { ConfigData } from "../application/utils/ConfigData.js";
import { RemoteClient } from "../Transport/io/RemoteClient.js";
import {trackDebugConfig} from "../application/utils/DebugUtils.js";
import {evt} from "../application/event/evt.js";
import {getRemoteClients} from "../Transport/io/ServerCommandProcessor.js";
import {ClientStronghold} from "./gameworld/ClientStronghold.js";
import {getPlayerStatus, setPlayerStatus} from "../application/utils/StatusUtils.js";
import {storePlayerActorStatus, storePlayerStatus} from "../application/setup/Database.js";
import {ENUMS} from "../application/ENUMS.js";
import {getItemRecipe, initRecipeByItemConfig} from "../application/utils/CraftingUtils.js";
import {getItemConfigs} from "../application/utils/ActorUtils.js";

let strongholds = [];
let statsConfig = {};
let visualConfigs = {};
let actorConfigs = {};
let itemConfigs = {};
let actors = [];
let items = [];
let actorIndex = 1; // zero index get culled by connection
let remoteClients = {}
let opponentList = []; // temp list for fetching opponents
let parsedEquipSlotData

let looseItems = []


let registerActor = function(actor) {
    if (actors.indexOf(actor) === -1) {
        actors.push(actor);
    }
}


function getItemConfigByTemplate(templateId) {
    return itemConfigs[templateId];
}

let loadItem = function(event) {

    let itemConfig = getItemConfigByTemplate([event['id']]);
 //   let visualConfig = visualConfigs[itemConfig['visual_id']];
  //  let visualPiece = new VisualGamePiece(visualConfig);

 //   let visualReadyCB = function(visualGP) {

    //    console.log("Visual Piece: ", visualGP)
    //    visualGP.obj3d = item.obj3d;

    //


    let item = new Item(event['id'], itemConfig, event['itemId'])

    if (itemLoadQueue.indexOf(item.id) !== -1) {
        console.log("Queued Item Loaded", item);
        MATH.splice(itemLoadQueue, item.id);
    }

        items.push(item);
        /*
        if (event.pos) {
            item.getPos().copy(event.pos);
        }
        if (visualGP.isSkinnedItem) {
        //    console.log("Bind Skinned visualGP Item")
        } else {
            visualGP.getSpatial().call.applyInstanceBuffers()
        }
*/
        item.status.call.initItemStatus();
        event.callback(item)


  //  visualPiece.attachModelAsset(visualReadyCB);
}



function setupActor(event, actor) {

    registerActor(actor);
    // actor.setStatusKey(ENUMS.ActorStatus.ACTOR_INDEX, actor.index);
    let status;
    if (typeof (event.status) === 'object') {
        status = event.status;
    } else {
        let statsData = statsConfig[actor.config['stats_id']];
        status = statsData.status;
        actor.setStatusKey(ENUMS.ActorStatus.CONFIG_ID, event.id)
    }

    if (status) {
        for (let key in status) {
            actor.setStatusKey(key, status[key])
        }
    }

    if (event.tile) {

        let onReady = function(readyActor) {
            //   console.log("On Ready: ", readyActor)
            let gameWalkGrid = readyActor.getGameWalkGrid()
            let activateEncounterGrid = GameAPI.call.getActiveEncounter();

            readyActor.setSpatialPosition(activateEncounterGrid.getPos());
            gameWalkGrid.setTargetPosition(event.tile.getPos())

            if (event.callback) {
                event.callback(readyActor);
            }
        }

        actor.activateGameActor(onReady);
        return;
    } else if (event.pos) {
        actor.setSpatialPosition(event.pos);
    } else {
        //   GameAPI.getGamePieceSystem().addActorToPlayerParty(actor);
        //   GameAPI.getGamePieceSystem().playerParty.selectPartyActor(actor)
    }

    if (event.callback) {
        event.callback(actor);
    }
}




let loadActor = function(event) {

    if (typeof (event.status) === 'object') {
        event.id = event.status[ENUMS.ActorStatus.CONFIG_ID];
    }

    if (!actorConfigs[event.id]) {
        console.log("Bad config for event id", event.id, actorConfigs);
        return;
    }

    let actorConfig = detachConfig(actorConfigs[event.id]);
    let actor = new GameActor(actorIndex, actorConfig, parsedEquipSlotData);
    actorIndex++;
   // console.log("Actor Config: ", actorConfig)

    setupActor(event, actor)

}


let processConnectionMessage = function(event) {

    if (!GameAPI.getGamePieceSystem().getSelectedGameActor()) {
    //    return;
    }

    if (client.getStamp() === 0) {
        GuiAPI.screenText("No connection stamp yet", ENUMS.Message.HINT, 4)
        console.log("No connection stamp yet")
        return;
    }

    if (event.stamp === client.getStamp()) {
        console.log("Respond to Host", event)
        return;
    }

    if (!remoteClients[event.stamp]) {
        remoteClients[event.stamp] = new RemoteClient(event.stamp);
    } else {
        remoteClients[event.stamp].processClientMessage(event.msg);
    }

}

let itemLoadQueue = [];


function estateLoadedCB(estate) {
    console.log("Estate Loaded ", estate);
}

function recipeItemLoaded(item) {
    if (items.indexOf(item) === -1) {
        console.log("Recipe Loaded", item);
        items.push(item);
    } else {
        console.log("Recipe Loaded more than once", [item.status.statusMap]);
    }
}

function initSpecialItems() {
    let configs = getItemConfigs();
    console.log("initSpecialItems Item Configs ", configs);

    for (let key in configs) {
        let cfg = configs[key]
        if (typeof (cfg['status']) === 'object') {
            if (cfg.status['ITEM_TYPE'] === ENUMS.itemTypes.ESTATE) {
                evt.dispatch(ENUMS.Event.LOAD_ITEM,  {id: key, callback:estateLoadedCB})
            } else if (cfg.status['ITEM_TYPE']) {
            //    initRecipeByItemConfig(key, cfg)
            }
        }
    }
}

class GamePieceSystem {
    constructor() {
        this.playerActorId = -1;
        this.playerParty = new PlayerParty();
        this.selectedActor = null;
    }

    loadServerItem(itemId) {
        if (itemLoadQueue.indexOf(itemId) === -1) {
            itemLoadQueue.push(itemId);
            evt.dispatch(ENUMS.Event.SEND_SOCKET_MESSAGE, {request:ENUMS.ClientRequests.LOAD_SERVER_ITEM, status:itemId})
            console.log("Init load request", itemId);
        }
    }

    getActors() {
        return actors;
    }

    getItems() {
        return items;
    }

    getItemConfig(template) {
        return getItemConfigByTemplate(template);
    }

    detachRemoteByActor(actor) {
        let clientStamp = actor.getStatus(ENUMS.ActorStatus.CLIENT_STAMP);
        let remoteClients = getRemoteClients();
        let remoteClient = remoteClients[clientStamp];
        if (!remoteClient) {
            console.log("Remote Client Expected", clientStamp, remoteClients);
        } else {
            remoteClient.closeRemoteClient();
            remoteClients[clientStamp] = null;
        }
    }

    hideNonPartyActors() {
        for (let i = 0; i < actors.length; i++) {
            if (this.playerParty.isMember(actors[i])) {

            } else {
                this.detachRemoteByActor(actors[i]);
            }
        }
    }

    addLooseItem(item) {
        console.log("Add Loose Item NYI", item)
        looseItems.push(item)
    }

    grabLooseItems(actor) {

        for (let i = 0; i < looseItems.length; i++) {
            let item = looseItems[i];
            let itemActorId = item.getStatus(ENUMS.ItemStatus.ACTOR_ID);
            if (actor.getStatus(ENUMS.ActorStatus.ACTOR_ID) === itemActorId) {
                looseItems.splice(i, 1);
                i--
                console.log("Grab Loose Item ", item)
                actor.equipItem(item);
            }

        }

    }

    initGamePieceSystem = function() {
        parsedEquipSlotData = new ConfigData("GAME", "EQUIP_SLOTS").parseConfigData()

        let statsData = function(data) {
            statsConfig = data;
        //    console.log("statsConfig", statsConfig)
        }

        configDataList("GAME","CHARACTER_STATS", statsData)

        let onData = function(data) {
            visualConfigs = data;
            //        console.log("visualConfigs", visualConfigs)
        }

        configDataList("GAME","VISUALS", onData)

        let onActorsData = function(data) {
            actorConfigs = data;
            //        console.log("actorConfigs", actorConfigs)
        }

        configDataList("GAME","ACTORS", onActorsData)

        let onItemsData = function(data) {
            itemConfigs = data;
            //        console.log("onItemsData", itemConfigs)

        }

        configDataList("GAME","ITEMS", onItemsData)

        evt.on(ENUMS.Event.LOAD_ACTOR, loadActor)
        evt.on(ENUMS.Event.LOAD_ITEM,  loadItem)

        evt.on(ENUMS.Event.ON_SOCKET_MESSAGE,  processConnectionMessage)

        let setActorStatus = function(values) {
            let actor = this.selectedActor;
            console.log("SET_ACTOR_STATUS", actor, values);
            for (let i = 0; i < values.length; i++) {
                let key = values[i].key;
                let status = values[i].status;
                console.log("SET_ACTOR_STATUS", actor, key, status);
                actor.setStatusKey(key, status);
            }

        }.bind(this)

        evt.on(ENUMS.Event.SET_ACTOR_STATUS, setActorStatus)
        trackDebugConfig('WORLD', 'actors', actors);
    }

    registerRecipeItem(item) {
        recipeItemLoaded(item)
    }

    initSpecialItems() {
        initSpecialItems()
    }

    getPlayerParty() {
        return this.playerParty;
    }

    addActorToPlayerParty(actor) {
        this.playerParty.addPartyActor(actor);
    }

    listCombatActorOpponents(actor) {
        let attitude = actor.getStatus(ENUMS.ActorStatus.ATTITUDE);

        MATH.emptyArray(opponentList);

        for (let i = 0; i < actors.length; i++) {
            let align =  actors[i].getStatus(ENUMS.ActorStatus.ATTITUDE);
            if (align !== attitude) {
                opponentList.push(actors[i].id)
            }
        }
        return opponentList;
    }

    setSelectedGameActor = function(gameActor) {
    //    console.log("Set Selected Actor: ", gameActor);
        GuiAPI.screenText("PLAYER CONTROL "+gameActor.id,  ENUMS.Message.SYSTEM, 4)

        if (gameActor.getStatus(ENUMS.ActorStatus.HAS_POSITION) === true) {
            gameActor.getSpatialPosition(ThreeAPI.getCameraCursor().getCursorObj3d().position)
        } else {
            gameActor.setSpatialPosition(ThreeAPI.getCameraCursor().getCursorObj3d().position)
            gameActor.getGameWalkGrid().setGridMovementActor(gameActor)
        }

        gameActor.setStatusKey(ENUMS.ActorStatus.HAS_POSITION, true)
        evt.dispatch(ENUMS.Event.SET_CAMERA_MODE, {mode:'game_travel'})
        gameActor.call.setAsSelection();
        setPlayerStatus(ENUMS.PlayerStatus.ACTIVE_ACTOR_ID, gameActor.getStatus(ENUMS.ActorStatus.ACTOR_ID))
        let playerActors = getPlayerStatus(ENUMS.PlayerStatus.PLAYER_ACTORS);
        if (playerActors.indexOf(gameActor.getStatus(ENUMS.ActorStatus.ACTOR_ID)) === -1) {
            playerActors.push(gameActor.getStatus(ENUMS.ActorStatus.ACTOR_ID))
        }
        this.selectedActor = gameActor;
        gameActor.setStatusKey(ENUMS.ActorStatus.NAME, getPlayerStatus(ENUMS.PlayerStatus.PLAYER_NAME));

        storePlayerActorStatus();
        storePlayerStatus();
    }

    isPlayerPartyActor(actor) {
        return this.playerParty.isMember(actor);
    }

    getSelectedGameActor = function() {
        return this.selectedActor;
    }

    getStrongholdById(shid) {
        for (let i = 0; i < strongholds.length;i++) {
            if (strongholds[i].id === shid) {
                return strongholds[i];
            }
        }
        let sh = new ClientStronghold(shid);
        strongholds.push(sh);
        return sh;
    }



}

export { GamePieceSystem }