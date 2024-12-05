import {Object3D} from "../../../libs/three/core/Object3D.js";
import {LocationModel} from "./LocationModel.js";
import {detachConfig} from "../../application/utils/ConfigUtils.js";
import {getSetting} from "../../application/utils/StatusUtils.js";
import {visualPhysicsStart, visualPhysicsStop, visualPhysicsTranslate} from "../visuals/effects/VisualPhysisEffects.js";

let defaultConfig = {
    "asset": "asset_box_dynamic",
    "pos": [0, 0, 0],
    "rot": [0, 0, 0],
    "scale": [0.1, 0.1, 0.1],
    "solidity": 1.0,
    "visibility": 1
}

class DebrisModel {
    constructor() {
        this.obj3d = new Object3D()

        let config = detachConfig(defaultConfig);
        let scaleMin = getSetting(ENUMS.Settings.DEBRIS_SCALE_MIN) / 200;
        let scaleMax = getSetting(ENUMS.Settings.DEBRIS_SCALE_MAX) / 200;
        let deform = getSetting(ENUMS.Settings.DEBRIS_DEFORM) / 10;
        let scale = MATH.decimalify(MATH.randomBetween(scaleMin, scaleMax), 1000);
        config.scale[0] = defaultConfig.scale[0]*MATH.decimalify(scale * MATH.randomBetween(1-deform, 1), 1000);
        config.scale[1] = defaultConfig.scale[1]*scale;
        config.scale[2] = defaultConfig.scale[2]*MATH.decimalify(scale * MATH.randomBetween(1-deform, 1), 1000);
        let locationModel = new LocationModel(this.obj3d, config)

        locationModel.call.lodUpdated(0);
        let physicalModel = null

        let update = function() {

            let pModel = locationModel.call.getPhysicalModel();

            if (physicalModel !== pModel) {
                physicalModel = pModel;
                if (pModel !== null) {
                    physicalModel.call.addPhysicsStateCallbacks(visualPhysicsStart, visualPhysicsStop, visualPhysicsTranslate);
                }
            }

            let pos = ThreeAPI.getCameraCursor().getPos();
            let distance = MATH.distanceBetween(pos, locationModel.obj3d.position);
            let rangeMax = getSetting(ENUMS.Settings.DEBRIS_RANGE)

            if (distance > rangeMax) {
                MATH.randomVector(this.obj3d.position);
                this.obj3d.position.multiplyScalar(rangeMax * 0.9);
                this.obj3d.position.add(pos);
                this.obj3d.position.y = ThreeAPI.terrainAt(this.obj3d.position) + config.scale[1]*50 + 0.0;
                locationModel.obj3d.position.copy(this.obj3d.position);
                locationModel.call.alignPhysicalModel();
            }

        }.bind(this);

        function close() {
        //    locationModel.call.lodUpdated(-2);
            ThreeAPI.unregisterPostrenderCallback(update)
        }

        function activate() {
            ThreeAPI.addPostrenderCallback(update)
         //   locationModel.call.lodUpdated(0);
        }

        this.call = {
            close:close,
            activate:activate
        }

    }

    setPos(posVec) {

    }

    activateDebrisModel() {

        this.call.activate();
    }

    deactivateDebrisModel() {

        this.call.close();
    }

}

export { DebrisModel };