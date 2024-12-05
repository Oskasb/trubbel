import {DebrisModel} from "./DebrisModel.js";
import {poolFetch, poolReturn} from "../../application/utils/PoolUtils.js";



let debrisModels = [];

function updatePhysicalDebris(intensity) {

    while (debrisModels.length < intensity) {
        let model = poolFetch('DebrisModel')
        model.activateDebrisModel();
        debrisModels.push(model);
    }

    while (debrisModels.length > intensity) {
        let model = debrisModels.pop();
        model.deactivateDebrisModel();
        poolReturn(model);
    }

}

class PhysicalWorldDebris {
    constructor() {
        this.isActive = false;


    }

    updateDebris(intensity) {
        if (intensity !== 0) {
            updatePhysicalDebris(intensity)
        } else {

        }

    }

}

export {PhysicalWorldDebris};