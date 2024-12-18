
import {Object3D} from "../../../libs/three/core/Object3D.js";
import * as CombatFxUtils from "../combat/feedback/CombatFxUtils.js";

let cfgDefault = {
    "sprite": [3, 5],
    "height": 2.6,
    "rgba": [1, 0.1, 0.9, 1],
    "size": 1
}

let attachEncounterFx = function(indicator) {

    indicator.fxObj3d.copy(indicator.encounterObj3d);
    let config = indicator.config
    indicator.fxObj3d.position.y += config.height;

    let rgba = config.rgba;

    if (indicator.encounterFx !== null) {
        detachEncounterFx(indicator)
    }

    let effectCb = function(efct) {
        efct.activateEffectFromConfigId()
        efct.setEffectPosition(indicator.fxObj3d.position)
        //    let options = CombatFxOptions.setupOptsBoneToGround(efct, gamePiece)
        //    options.toSize*=0.5;
        efct.setEffectSpriteXY(config.sprite[0], config.sprite[1]);
        efct.scaleEffectSize(config.size);
        efct.setEffectColorRGBA(CombatFxUtils.setRgba(rgba[0], rgba[1], rgba[2], rgba[3]))
        //    efct.activateSpatialTransition(options)
        indicator.encounterFx = efct;

        GameAPI.registerGameUpdateCallback(indicator.call.updateEffect)
    }

    EffectAPI.buildEffectClassByConfigId('normal_stamps_8x8', 'stamp_normal_pool',  effectCb)

}

let detachEncounterFx = function(indicator) {
    if (indicator.encounterFx !== null) {
        indicator.encounterFx.recoverEffectOfClass();
        GameAPI.unregisterGameUpdateCallback(indicator.call.updateEffect)
        indicator.encounterFx = null;
    } else {
    //    console.log("Indicator Fx not present")
    }

}


class EncounterIndicator {
    constructor(obj3d) {
        this.encounterObj3d = obj3d
        this.fxObj3d = new Object3D();
        this.config = cfgDefault;

        this.encounterFx = null;

        let updateEffect = function(tpf) {
            if (this.encounterFx === null) {
                return;
            }
            this.fxObj3d.position.copy(this.encounterObj3d.position);
            this.fxObj3d.position.y += this.config.height;
            this.fxObj3d.rotateY(tpf);
            this.encounterFx.setEffectPosition(this.fxObj3d.position)
            this.encounterFx.setEffectQuaternion(this.fxObj3d.quaternion)
        }.bind(this)

        let lodUpdated = function(lodLevel) {

        }

        this.call = {
            lodUpdated:lodUpdated,
            updateEffect:updateEffect
        }

    }

    setSpriteXY(x, y) {
        this.encounterFx.setEffectSpriteXY(x, y);
    }

    setRGBA(rgba) {
        this.encounterFx.setEffectColorRGBA(rgba)
    }

    setSize(size) {
        this.encounterFx.scaleEffectSize(size);
    }

    applyIndicatorConfig(config) {
        this.config = config;
    }

    showIndicator() {
        attachEncounterFx(this);
    }

    hideIndicator() {
        detachEncounterFx(this);
    }

}

export { EncounterIndicator }