import {buildEffectEvent, defaultEffectValues} from "./EffectEventDefaults.js";
import {transitionEffectOff, transitionEffectOn} from "./VisualTriggerFx.js";
import {MATH} from "../../../application/MATH.js";
import {getSetting} from "../../../application/utils/StatusUtils.js";
import {ENUMS} from "../../../application/ENUMS.js";

let fxConf = {
    color:'VELOCITY_FX',
    effect:{}
}

let impulseCfg = {
    color:'FORCE_FX',
    effect:{}
}

function visualPhysicsShockwave(pos, size, duration, color) {
    impulseCfg.color = color  || 'FORCE_FX';
    MATH.copyObjectValues(defaultEffectValues['PHYSICS_IMPULSE'], impulseCfg.effect );
    impulseCfg.effect.duration = duration*1.3;
    impulseCfg.effect.fromSize = size*0.1;
    impulseCfg.effect.toSize = size*5;
    transitionEffectOn(pos, impulseCfg);
    MATH.copyObjectValues(defaultEffectValues['PHYSICS_SHOCKWAVE'], impulseCfg.effect );
    impulseCfg.effect.duration = duration * 1.0;
    impulseCfg.effect.fromSize = size*0.1;
    impulseCfg.effect.toSize = size*3;
    transitionEffectOn(pos, impulseCfg);
}

function visualPhysicsImpulse(pos, force, power) {
    impulseCfg.color = 'FORCE_FX'
    MATH.copyObjectValues(defaultEffectValues['PHYSICS_IMPULSE'], impulseCfg.effect );
    let vfxIntensity = getSetting(ENUMS.Settings.PHYSICS_VFX_INTENSITY) / 10;
    fxConf.effect.duration *= 0.5 + vfxIntensity * 0.5;
    transitionEffectOn(pos, impulseCfg);
    MATH.copyObjectValues(defaultEffectValues['PHYSICS_HIT'], impulseCfg.effect );
    impulseCfg.effect.duration *= vfxIntensity;
    transitionEffectOn(pos, impulseCfg);
}

function visualPhysicsStart(physicalModel, body, vel) {
    let pos = physicalModel.getPos();
    MATH.copyObjectValues(defaultEffectValues['PHYSICS_START'], fxConf.effect );
    let vfxIntensity = getSetting(ENUMS.Settings.PHYSICS_VFX_INTENSITY) / 10;
    fxConf.effect.duration *= 0.5 + vfxIntensity * 0.5;
    fxConf.effect.fromSize *= vfxIntensity;
    fxConf.effect.toSize *= vfxIntensity;
    transitionEffectOn(pos, fxConf);
}

function visualPhysicsTranslate(physicalModel, body, vel) {
    let pos = physicalModel.getPos();
    MATH.copyObjectValues(defaultEffectValues['PHYSICS_TRANSLATE'], fxConf.effect );
    let vfxIntensity = getSetting(ENUMS.Settings.PHYSICS_VFX_INTENSITY) / 10;
    fxConf.effect.duration *= 0.5 + vfxIntensity * 0.5;
    fxConf.effect.fromSize *= vfxIntensity;
    fxConf.effect.toSize *= vfxIntensity;
    transitionEffectOn(pos, fxConf);
}

function visualPhysicsStop(physicalModel, body, vel) {
    let pos = physicalModel.getPos();
    MATH.copyObjectValues(defaultEffectValues['PHYSICS_STOP'], fxConf.effect );
    let vfxIntensity = getSetting(ENUMS.Settings.PHYSICS_VFX_INTENSITY) / 10;
    fxConf.effect.duration *= 0.5 + vfxIntensity * 0.5;
    fxConf.effect.fromSize *= vfxIntensity;
    fxConf.effect.toSize *= vfxIntensity;
    transitionEffectOff(pos, fxConf);
}

export {
    visualPhysicsShockwave,
    visualPhysicsImpulse,
    visualPhysicsStart,
    visualPhysicsTranslate,
    visualPhysicsStop
};