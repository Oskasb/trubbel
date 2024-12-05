import {Vector3} from "../../../../libs/three/math/Vector3.js";
import {effectMap} from "../Effects.js";
import {colorMapFx} from "../Colors.js";
import {MATH} from "../../../application/MATH.js";

let effectEvent = {
    pos:new Vector3(),
    dir:new Vector3(),
    rgba:{r:0.1, g:0.4, b:0.1, a:0.5},
    fromSize:0.2,
    toSize:1.8,
    duration:0.25,
    sprite:[0, 1],
    effectCall:'',
    effectName:'stamp_additive_pool'
}

let base = {
    pos:new Vector3(),
    dir:new Vector3(),
    rgba:{r:0.1, g:0.4, b:0.1, a:0.5},
    fromSize:0.2,
    toSize:1.8,
    duration:0.25,
    sprite:[0, 1],
    effectCall:'',
    effectConfig:'additive_particles_8x8',
    effectName:'particle_additive_pool'
}

function copyDefaults(defaults, target) {
    MATH.copyObjectValues(defaults, target);
}

let defaultEffectValues = {
    GLITTER: {
        sprite:[1, 5],
        fromSize:0.15,
        toSize:1.2,
        duration:1.35,
        effectConfig:'additive_stamps_8x8',
        effectName:'stamp_additive_pool',
        effectCall:'sprayUpwards',
        rgba:colorMapFx['GLITTER_FX']
    },
    SMOKE: {
        sprite:[2, 1],
        fromSize:0.4,
        toSize:1.75,
        duration:1.5,
        effectCall:'',
        effectConfig:'normal_stamps_8x8',
        effectName:'stamp_normal_pool',
        rgba:colorMapFx['SMOKE_FX']
    },
    PHYSICS_SHOCKWAVE: {
        fromSize:0,
        toSize:1,
        duration:0.25,
        sprite:[0, 0],
        effectConfig:'additive_stamps_8x8',
        effectName:'stamp_additive_pool'
    },
    PHYSICS_IMPULSE: {
        fromSize:0.3,
        toSize:1.5,
        duration:0.25,
        sprite:[0, 0],
        effectConfig:'additive_particles_8x8',
        effectName:'particle_additive_pool'
    },
    PHYSICS_HIT: {
        fromSize:0.2,
        toSize:0.8,
        duration:0.2,
        sprite:[1, 5],
        effectConfig:'additive_stamps_8x8',
        effectName:'stamp_additive_pool'
    },
    PHYSICS_START: {
        fromSize:0.5,
        toSize:2.1,
        duration:0.25,
        sprite:[0, 1],
        effectConfig:'additive_stamps_8x8',
        effectName:'stamp_additive_pool'
    },
    PHYSICS_TRANSLATE: {
        fromSize:4.0,
        toSize:1.5,
        duration:0.35,
        sprite:[1, 2],
        effectConfig:'additive_particles_8x8',
        effectName:'particle_additive_pool'
    },
    PHYSICS_STOP: {
        fromSize:0.4,
        toSize:2.1,
        duration:0.55,
        sprite:[0, 1],
        effectConfig:'additive_stamps_8x8',
        effectName:'stamp_additive_pool'
    }

}

function buildEffectEvent(defaultValues) {
    copyDefaults(base, effectEvent);
    copyDefaults(defaultValues, effectEvent);
    return effectEvent;
}

export {
    defaultEffectValues,
    buildEffectEvent
}