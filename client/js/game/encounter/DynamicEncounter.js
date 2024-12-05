import {EncounterStatus} from "./EncounterStatus.js";
import {applyStatusMessageToMap} from "../../../../Server/game/utils/GameServerFunctions.js";
import {debugTrackStatusMap} from "../../application/utils/DebugUtils.js";
import {getPlayerActor} from "../../application/utils/ActorUtils.js";


class DynamicEncounter {
    constructor(id, worldEncId) {
    //    console.log("New Dyn Enc ", id, worldEncId);
        this.id = id;
        this.status = new EncounterStatus(id, worldEncId)
        this.status.setStatusKey(ENUMS.EncounterStatus.ACTIVATION_STATE, ENUMS.ActivationState.ACTIVATING)
        this.isRemote = false;
        this.page = GuiAPI.activatePage('page_encounter_info');
    }

    setStatusKey(key, status) {
        let write = this.status.setStatusKey(key, status);
        return write
    }

    getStatus(key) {
        return this.status.getStatusByKey(key);
    }


    applyEncounterStatusUpdate(statusMsg) {
        applyStatusMessageToMap(statusMsg, this.status.statusMap);
        let updateIndex = this.status.statusMap[ENUMS.EncounterStatus.UPDATE_INDEX];
        let encId = this.status.statusMap[ENUMS.EncounterStatus.ENCOUNTER_ID];

        if (this.id !== encId) {
            console.log("Actor should be in the encounter...")
        } else {
            let actor = getPlayerActor();
            let UI = actor.getStatus(ENUMS.ActorStatus.ENCOUNTER_UPDATE_INDEX)
            if (UI !== updateIndex) {
                console.log("Actor updating seq index...", updateIndex);
                actor.actorText.say(updateIndex);
                actor.setStatusKey(ENUMS.ActorStatus.ENCOUNTER_UPDATE_INDEX, updateIndex);
                actor.sendStatus(-1);
            }

        }

        debugTrackStatusMap('ENCOUNTER_STATUS', this.status.statusMap)
    }

    setEncounterGrid(encounterGrid) {
        this.encounterGrid = encounterGrid;
    }

    closeDynamicEncounter() {
        console.log("closeDynamicEncounter", this)
        this.page.closeGuiPage();
    }

}

export { DynamicEncounter }