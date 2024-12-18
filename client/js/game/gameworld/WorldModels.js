import { ConfigData } from "../../application/utils/ConfigData.js";
import * as ScenarioUtils from "../gameworld/ScenarioUtils.js";
import { WorldModel} from "./WorldModel.js";
import { WorldEncounter } from "../encounter/WorldEncounter.js";
import { WorldTreasure} from "../encounter/WorldTreasure.js";
import {poolFetch, poolReturn} from "../../application/utils/PoolUtils.js";
import {saveEncounterEdits, saveWorldModelEdits} from "../../application/utils/ConfigUtils.js";
import {WorldAdventure} from "../gamescenarios/WorldAdventure.js";
import {isDev} from "../../application/utils/DebugUtils.js";
import {getPlayerStatus, testStatusConditions} from "../../application/utils/StatusUtils.js";

let locationModelConfigs;
let worldModels = [];
let worldBoxes = [];
let conditionalEncounterConfigs = {};
let worldEncounters = [];
let nodeEncounterConfigs = {};
let worldTreasures = [];
let worldEstates = [];
let activeEstates = [];
let skippedTreasures = {};
let skippedEncounters = {};
let dynamicSpawnPoints = [];

let loadedConfigs = {}
let loadedTemplates = {};

let activateEvent = {world_encounters:[]};

let heightTestNear = [];
let heightIntersects = [];

let encounterConfigs = null;


function getWorldEncounterById(id) {
    if (!id) {
        return worldEncounters;
    }
    for (let i = 0; i < worldEncounters.length; i++) {
        if (id === worldEncounters[i].id) {
            return worldEncounters[i]
        }
    }
}



function removeWorldModels() {
    while (worldModels.length) {
        let model = worldModels.pop()
        model.deleteWorldModel()
    }
}

function resetLodState() {
    for (let i = 0; i < worldModels.length; i++) {
        worldModels[i].refreshLodState();
    }
}

let setlocationModelConfigs = function(config) {
    locationModelConfigs = config;
    initWorldModels()
}

function clearDynamicSpawnPoints() {
    while (dynamicSpawnPoints.length) {
        let sPoint = dynamicSpawnPoints.pop()
        sPoint.removeSpawnPoint()
        poolReturn(sPoint);
    }
}

function getSPointById(id) {
    for (let i = 0; i < dynamicSpawnPoints.length; i++) {
        if (id === dynamicSpawnPoints[i].id) {
        //    console.log("Sp Found", id)
            return dynamicSpawnPoints[i];
        }
    }
}


function populateDynamicSpawnPoints(worldLevel) {

    clearDynamicSpawnPoints()
    let config = GameAPI.gameMain.getWorldLevelConfig(worldLevel);
    let spawns = config['spawns'] || 100;
    let lvlMin = config['level_min'] || 1;
    let lvlMax = config['level_max'] || 50;
    let yMax = config['y_max'] || 50;
    for (let i = 0; i < spawns; i++) {
        let point = poolFetch('DynamicSpawnPoint');
        point.initDynamicSpawnPoint(i, spawns, worldLevel, yMax, lvlMin, lvlMax);
        dynamicSpawnPoints.push(point);
    }
}

function activateDynamicSpawnPoints() {
    for (let i = 0; i < dynamicSpawnPoints.length; i++) {
        let sPoint = dynamicSpawnPoints[i]
    //    if (sPoint.isActive === false) {
            sPoint.activateSpawnPoint();
    //    }
    }
}

function deactivateDynamicSpawnPoints() {
    for (let i = 0; i < dynamicSpawnPoints.length; i++) {
        let sPoint = dynamicSpawnPoints[i]
    //    if (sPoint.isActive === true) {
            sPoint.removeSpawnPoint();
    //    }
    }
}

function loadModelFromConfig(config, id, preventInstantiation) {
    if (config.DELETED === true) {
        console.log("Skip Deleted World Model")
        return;
    }
    let model = new WorldModel(config, id, preventInstantiation)
    worldModels.push(model);

    return model;
}

function loadAdventureFromConfig(worldLevel, config, id) {
    if (config.DELETED === true) {
        console.log("Skip Deleted World Adventure")
        return;
    }
    let adventure = new WorldAdventure()
    adventure.call.applyLoadedConfig(config);
    adventure.id = config.edit_id;
    GameAPI.gameAdventureSystem.registerAdventure(worldLevel, adventure)
}



function loadEditorModels(configs) {
    for (let key in configs) {
        let add = true;
        for (let i = 0; i < worldModels.length; i++) {
            if (worldModels[i].id === key) {
                worldModels[i].call.applyLoadedConfig(configs[key], key);
                add = false;
            }
        }
        if (add === true) {
            loadModelFromConfig(configs[key], key)
        }
    }
}

function updateConditionalWorldEncounters() {
    console.log('updateConditionalWorldEncounters');
    let worldLevel = getPlayerStatus(ENUMS.PlayerStatus.PLAYER_WORLD_LEVEL);
    if (worldLevel === getPlayerStatus(ENUMS.PlayerStatus.PLAYER_ID)) {
        worldLevel = '19';
    }
    let configs = conditionalEncounterConfigs[worldLevel];
    if (typeof (configs) === 'object') {
        for (let key in configs) {

            let wEnc = getWorldEncounterById(key);
            if (!wEnc) {
                let cfg = configs[key];
                let conditions = cfg['conditions'];
                let pass = testStatusConditions(conditions);
                if (pass) {
                    console.log("Add Conditional Enc", key);
                    let spawnPoint = GameAPI.worldModels.getEncounterSpawnPoint(key);
                    spawnPoint.applyConfig(cfg);
                    return;


                    let onReady = function(encounter) {
                        console.log("Conditional Enc Ready", encounter);
                        encounter.activateWorldEncounter();
                    //    encounter.hideWorldEncounter()
                        // encounter.call.lodUpdated(-2);
                    }
                    let enc = new WorldEncounter(key, cfg, onReady);
                    worldEncounters.push(enc);
                }
            }

        }
    }


}

function loadModelsFromEditor(worldLevel) {
    // console.log("loadModelsFromEditor")
    if (loadedConfigs['model']) {
        if (loadedConfigs['model'][worldLevel]) {
        //    console.log("loadModelsFromEditor", loadedConfigs['model'], worldLevel)
            loadEditorModels(loadedConfigs['model'][worldLevel])
        }
    }
}

let worldLevelLocations = []
let lastWorldLevel = "20";

let initWorldModels = function(worldLevel) {
    resetLodState()

    if (worldLevel !== lastWorldLevel || dynamicSpawnPoints.length === 0) {
        if (!worldLevel) {
            worldLevel = lastWorldLevel;
        } else {
            lastWorldLevel = worldLevel;
        }
        populateDynamicSpawnPoints(worldLevel);
    }

    activateDynamicSpawnPoints()
    updateConditionalWorldEncounters()


    let config = locationModelConfigs;
    // console.log("worldLevel Models; ", worldLevel, loadedConfigs, config);

    removeWorldModels(worldLevel)

    MATH.emptyArray(worldLevelLocations);

    loadModelsFromEditor(worldLevel)

    let modelsData = function(models) {
        for (let i = 0; i < models.length;i++) {
            let model = new WorldModel(models[i])
            let add = true;
            for (let i = 0; i < worldModels.length; i++) {
                if (worldModels[i].id === model.id) {
                    add = false;
                }
            }
            if (add === true) {
                worldModels.push(model);
            }


        }
    }

    let locationData = function(data) {
        for (let i = 0; i < data.length;i++) {

            if (worldLevel === "20") {
                if (!data[i].config['world_level']) {
                    modelsData(data[i].config.models);
                    worldLevelLocations.push(data[i])
                }
            }

            if (data[i].config['world_level'] === worldLevel) {
            //    console.log("Specific World Level Models", worldLevel, data[i])
                modelsData(data[i].config.models);
                worldLevelLocations.push(data[i])
            }
        }
    }

    for (let i = 0; i < config.length;i++) {
        locationData(config[i].data);
    }

}

let deactivateWorldEncounters = function () {
    if (isDev()) {
        console.log("deactivateWorldEncounters")
    }

    GuiAPI.getWorldInteractionUi().deactivateWorldInteractUi()
    deactivateDynamicSpawnPoints();
    while (worldEncounters.length) {
        let encounter = worldEncounters.pop()
        encounter.deactivateWorldEncounter()
    }
    while (worldTreasures.length) {
        let trsr = worldTreasures.pop()
        trsr.deactivateWorldTreasure()
    }
}



let activateSkippedEncounter = function(encId, cb) {
    let onReady = function(encounter) {
        worldEncounters.push(encounter);
        encounter.activateWorldEncounter()
        cb(encounter);
    }

    new WorldEncounter(encId, skippedEncounters[encId], onReady)
}

let activateWorldEncounters = function(event) {

    deactivateWorldEncounters();

    if (event.world_level) {
        initWorldModels(event.world_level)
    } else {
        activateDynamicSpawnPoints()
    }



//    GuiAPI.getWorldInteractionUi().initWorldInteractUi();
    let activeActor = GameAPI.getGamePieceSystem().selectedActor;
    if (activeActor) {
        activeActor.setStatusKey(ENUMS.ActorStatus.TRAVEL_MODE, ENUMS.TravelMode.TRAVEL_MODE_WALK);
        activeActor.setStatusKey(ENUMS.ActorStatus.PARTY_SELECTED, true);
    }

    let completedEncounters = GameAPI.gameAdventureSystem.getCompletedEncounters();
    let lootedTreasures = GameAPI.gameAdventureSystem.getLootedTreasures();
    activateEvent = event;

    let onReady = function(encounter) {
        worldEncounters.push(encounter);
        encounter.activateWorldEncounter()
    }
    let encountersData = function(encounters, index, listId) {
        for (let i = 0; i < encounters.length;i++) {
            let encId = ""+listId+"_"+index+"_"+i;
            if (completedEncounters.indexOf(encId) === -1) {
                new WorldEncounter(encId, encounters[i], onReady)
            } else {
                console.log("Not loading completed encounter..", encId);
                skippedEncounters[encId] = encounters[i];
            }

        }
    }

    let treasuresData = function(treasures, index, listId) {
        for (let i = 0; i < treasures.length;i++) {
            let treasureId = "trsr_"+listId+"_"+index+"_"+i;
       //     console.log("Load World Treasure: ", treasureId, treasures[i])
            let onReady = function(treasure) {
                worldTreasures.push(treasure);
                treasure.activateWorldTreasure()
            }
            if (lootedTreasures.indexOf(treasureId) === -1) {
                new WorldTreasure(treasureId, treasures[i], onReady)
            } else {
                console.log("Not loading looted treasures..", treasureId);
                skippedTreasures[treasureId] = treasures[i];
            }

        }
    }

    let locationData = function(data, listId) {
        for (let i = 0; i < data.length;i++) {
            if (data[i].config['encounters']) {
            //    console.log("locationData: ", data[i].config['encounter'])
                encountersData(data[i].config.encounters, i, listId);
            }
            if (data[i].config['treasures']) {
                treasuresData(data[i].config.treasures, i, listId);
            }
        }
    }

    for (let i = 0; i < encounterConfigs.length;i++) {
        if (activateEvent.world_encounters.indexOf(encounterConfigs[i].id) !== -1) {
            locationData(encounterConfigs[i].data, encounterConfigs[i].id);
        }
    }

}

let initWorldEncounters = function(config) {
    //  console.log("World Models; ", config);
    encounterConfigs = config;
    activateWorldEncounters(activateEvent);
}

function loadConfigEdits(levelModelConfigs) {
    console.log("loadWorldLevelConfigEdits", levelModelConfigs)
    for (let id in levelModelConfigs) {
        let wModel = GameAPI.worldModels.getActiveWorldModel(id);
        if (wModel !== null) {
            wModel.call.applyLoadedConfig(levelModelConfigs[id], id)
        } else {
            wModel = loadModelFromConfig(levelModelConfigs[id], id)
            //
        }
    //    wModel.call.lodUpdated(0);
    }
}

class WorldModels {
    constructor() {
        this.configData =  new ConfigData("WORLD_LOCATIONS","MODELS", null, null, null, setlocationModelConfigs)
        this.configData =  new ConfigData("WORLD_ENCOUNTERS","ENCOUNTERS", null, null, null, initWorldEncounters)

        evt.on(ENUMS.Event.LOAD_ADVENTURE_ENCOUNTERS, activateWorldEncounters)
    }

    getEncounterConfigs() {
        return encounterConfigs;
    }

    deactivateEncounters() {
        deactivateWorldEncounters()
    }

    getActiveLocationData() {
        return worldLevelLocations
    }

    getActiveWorldModels() {
        return worldModels;
    }

    setLoadedConfig(root, folder, id, config) {

        if (!loadedConfigs[root]) {
            loadedConfigs[root] = {};
        }

        if (!loadedConfigs[root][folder]) {
            loadedConfigs[root][folder] = {};
        }

        loadedConfigs[root][folder][id] = config;

        if (root === 'encounter') {
            let sPoint = getSPointById(id);
            if (!sPoint) {
                this.addConfigEncounter(folder, config, id, false);
            }
        }

        if (root === 'adventure') {

            loadAdventureFromConfig(folder, config, id, false);

        } else if (folder === lastWorldLevel) {

            if (root === 'model') {
                let wModel = GameAPI.worldModels.getActiveWorldModel(id);
                if (wModel !== null) {
                    wModel.call.applyLoadedConfig(config, id)
                } else {
                    loadModelFromConfig(config, id)
                }
            }


        }

    }




    getLoadedConfig(root, folder, id) {
        if (!loadedConfigs[root]) {
            loadedConfigs[root] = {};
        }

        if (!loadedConfigs[root][folder]) {
            loadedConfigs[root][folder] = {};
        }

        return loadedConfigs[root][folder][id];

    }

    loadWorldLevelConfigEdits(worldLevel) {



        let modelConfigs = loadedConfigs['model'];
        let levelConfigs = modelConfigs[worldLevel];
        if (worldLevel === getPlayerStatus(ENUMS.PlayerStatus.PLAYER_ID)) {
            loadConfigEdits(modelConfigs['19'])
        }
        loadConfigEdits(levelConfigs)

    }

    setLoadedTemplate(root, folder, id, config) {

        let map = {
            id:id,
            root:root,
            folder:folder,
            config:config
        }

        loadedTemplates[id] = map;
    }

    getLoadedTemplates() {
        return loadedTemplates;
    }

    getActiveWorldModel(id) {
        for (let i = 0; i < worldModels.length; i++) {
            if (worldModels[i].id === id) {
                return worldModels[i];
            }
        }
        return null;
    }

    removeActiveWorldModel(id) {
        for (let i = 0; i < worldModels.length; i++) {
            if (worldModels[i].id === id) {
                worldModels[i].deleteWorldModel();
                return;
            }
        }
        console.log("No such worldModel", id)
    }



    getWorldEncounters() {
        return worldEncounters;
    }

    getDynamicSpawnPoints() {
        return dynamicSpawnPoints;
    }



    getEncounterSpawnPoint(wEncId) {

        let sPoint = getSPointById(wEncId);
        if (!sPoint) {
            if (isDev()) {
                console.log("Sp Created", wEncId)
            }

            sPoint = poolFetch('DynamicSpawnPoint')
            dynamicSpawnPoints.unshift(sPoint);
        }

        return sPoint;
    }

    activateEncounters() {
        activateWorldEncounters(activateEvent)
    }

    activateCompletedEncounter(encId, onReady) {
        activateSkippedEncounter(encId, onReady);
    }

    getEncounterByHostActorId(actorId) {
        for (let i = 0; i < worldEncounters.length; i++) {
            let hostActor = worldEncounters[i].getHostActor()
            if (hostActor === null) {

            } else {
                if (hostActor.id === actorId) {
                    return worldEncounters[i]
                }
            }

        }
        console.log("No worldEnc for host actor available", actorId)
        return null;
    }

    getEncounterById(id) {
        return getWorldEncounterById(id)
    }


    addConfigEncounter(worldLevel, config, id, save) {

        if (save === true) {
            let onReady = function(wEnc) {
                saveEncounterEdits(wEnc)
            }

            new WorldEncounter(id, config, onReady)
        }


        if (typeof (config['node_id']) === 'string') {
            nodeEncounterConfigs[config['node_id']] = config;
        //    console.log("Register Node Enc config ", config['node_id'], id, nodeEncounterConfigs);
        } else if (typeof (config['conditions']) === 'object') {
        //    nodeEncounterConfigs[config['node_id']] = config;

            if (!conditionalEncounterConfigs[worldLevel]) {
                conditionalEncounterConfigs[worldLevel] = {};
            }
            conditionalEncounterConfigs[worldLevel][id] = config;
            console.log("Register conditional Enc config ", config, id, conditionalEncounterConfigs);
        } else {
            let sPoint = GameAPI.worldModels.getEncounterSpawnPoint(id);
            sPoint.applyConfig(config);
        }

    }

    getNodeEncounterConfigs() {
        return nodeEncounterConfigs;
    }

    addConfigModel(config, id, preventInstantiation) {
        return loadModelFromConfig(config, id, preventInstantiation);
    }

    removeWorldModel(worldModel) {
        worldModel.deleteWorldModel();
    }

    registerWorldBox(box) {
        if (worldBoxes.indexOf(box) === -1) {
            worldBoxes.push(box)
        } else {
            console.log("Box Already Added", box);
        }

    };

    getWorldModelCount() {
        return worldModels.length;
    }

    getActiveWorldEstates() {
        return activeEstates;
    }

    registerWorldEstate(itemEstate) {
        worldEstates.push(itemEstate);
    }

    activateWorldLevelEstates(worldLevel) {
        console.log("activateWorldLevelEstates", worldLevel);
        MATH.emptyArray(activeEstates);
        for (let i = 0; i < worldEstates.length; i++) {
            let estate = worldEstates[i];
            let ewl = estate.call.getWorldLevel();

            if (ewl === worldLevel) {
                estate.call.estateActivate(true)
                activeEstates.push(estate);
            } else {
                estate.call.estateActivate(false)
            }
        }
        console.log("ewl", activeEstates);
    }

    getActiveEstateAtPosition(pos) {
        for (let i = 0; i < activeEstates.length; i++) {
            let estate = activeEstates[i];
            let isInside = estate.call.posIsInside(pos);
            if (isInside === true) {
                return estate;
            }
        }
        return false;
    }

    getWorldBoxCount() {
        return worldBoxes.length;
    }

    unregisterWorldBox(box) {
        MATH.splice(worldBoxes, box);
    };

    notifyConditionsPossiblyChanged() {
        updateConditionalWorldEncounters()
    }

    queryWorldModelHeight = function(posVec3, boxHeight) {

        for (let i = 0; i < worldBoxes.length; i++) {
            let isNear = worldBoxes[i].testIsNearPosition(posVec3)
            if (isNear) {
                heightTestNear.push(worldBoxes[i])
            }
        }

        let highestIntersection = -99999;

        while (heightTestNear.length) {
            let box = heightTestNear.pop();
            boxHeight = box.testIntersectPosition(posVec3, boxHeight)
        }

        return boxHeight;

    }

    removeActiveWorldModels() {
        clearDynamicSpawnPoints();
        removeWorldModels();
        deactivateWorldEncounters();
    }

}

export { WorldModels }