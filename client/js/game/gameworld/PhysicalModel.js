import {Object3D} from "../../../libs/three/core/Object3D.js";
import {Vector3} from "../../../libs/three/math/Vector3.js";
import {testAABOXIntersectPosition} from "../../application/utils/ModelUtils.js";
import {poolFetch, poolReturn} from "../../application/utils/PoolUtils.js";
import {configDataList} from "../../application/utils/ConfigUtils.js";
import {Box3} from "../../../libs/three/math/Box3.js";
import {colorMapFx} from "../visuals/Colors.js";
import {bodyTransformToObj3d, getBodyAngularVelocity, getBodyVelocity} from "../../application/utils/PhysicsUtils.js";

let configData = null;
let tempVec = new Vector3()
let passObj = new Object3D()

function onConfig(data) {
    configData = data;
}

setTimeout(function() {
    configDataList('PHYSICS', 'ASSET_SHAPES', onConfig)
}, 1000);

let tempBox = new Box3()

class PhysicalModel {
    constructor() {
        this.debugColor = 'BLUE'
        this.obj3d = new Object3D();
        this.lastVelocity = new Vector3();
        this.moveTriggered = false;
        let model = null;
        let instance = null;
        this.shapes = [];
        this.rigidBodies = [];
        this.assetId = null;
        this.box = new Box3();

        this.onUpdateCallbacks = [];

        this.onMoveStartedCallbacks = [];
        this.onMoveEndedCallbacks = [];
        this.onVelocityUpdateCallbacks = [];

        let addPhysicsStateCallbacks = function(onMoveStart, onMoveEnd, onVelocityUpdate) {
            this.onMoveStartedCallbacks.push(onMoveStart);
            this.onMoveEndedCallbacks.push(onMoveEnd);
            this.onVelocityUpdateCallbacks.push(onVelocityUpdate);
        }.bind(this);

        let applyPhysicalConfig = function(data) {
            onConfig(data);
            let rebuild = this.assetId;
            this.deactivatePhysicalModel();
            if (rebuild) {
                this.initPhysicalWorldModel(rebuild, this.obj3d)
            }
        }.bind(this);

        if (!configData) {
            configDataList('PHYSICS', 'ASSET_SHAPES', applyPhysicalConfig)
        }

        let getModel = function() {
            return model;
        }.bind(this)

        let setModel = function(m) {
            instance = null;
            model = m;
        }.bind(this)

        let setInstance = function(i) {
            model = null;
            instance = i;
        }.bind(this)

        let getInstance = function() {
            return instance;
        }.bind(this)

        this.call = {
            setInstance:setInstance,
            getInstance:getInstance,
            setModel:setModel,
            getModel:getModel,
            addPhysicsStateCallbacks: addPhysicsStateCallbacks
        }


    }

    getPos() {
        return this.obj3d.position;
    }

    initPhysicalWorldModel(assetId, obj3d, updateCB) {

        if (configData === null) {
            let _this = this;
            setTimeout(function() {
                console.log("Premature physics init", assetId)
                _this.initPhysicalWorldModel(assetId, obj3d, updateCB)
            }, 500)
            return;
        }

        if (typeof (updateCB) === 'function') {
            this.onUpdateCallbacks.push(updateCB);
        }

        this.assetId = assetId;
        this.obj3d.copy(obj3d);

        this.box.min.set(999999999, 99999999, 99999999);
        this.box.max.set(-999999999, -99999999, -99999999);
        this.static = false;

        this.includePhysicalModel();

    }

    includePhysicalModel() {
        let shapes = null;
        if (configData[this.assetId]) {
            shapes = configData[this.assetId]['shapes'];
        } else {
            shapes = configData['default']['shapes'];
        }

        let bodyReadyCB = function(body) {
            bodyTransformToObj3d(body, this.obj3d);
            this.rigidBodies.push(body);
            window.AmmoAPI.includeBody(body);

            if (this.static === false) {
                //        console.log("Rigid Body: ",assetId, body)
            } else {

            }

        }.bind(this)

        if (!shapes[0].mass) {
            this.static = true;
        }

        passObj.copy(this.obj3d);

        for (let i = 0; i < shapes.length; i++) {
            let conf = shapes[i];
            //    let shape = poolFetch('PhysicalShape');

            AmmoAPI.setupRigidBody(passObj, conf['shape'], conf['mass'], conf['friction'], conf['pos'], conf['rot'], conf['scale'], conf['asset'], conf['convex'], bodyReadyCB)

        }
    }

    testinclusion() {

    }

    testExclusion() {

    }

    deactivatePhysicalModel() {
     //   this.call.setModel("null");
        while (this.onUpdateCallbacks.length) {
            this.onUpdateCallbacks.pop();
        }

        while (this.onMoveStartedCallbacks.length) {
            this.onMoveStartedCallbacks.pop();
        }
        while (this.onMoveEndedCallbacks.length) {
            this.onMoveEndedCallbacks.pop();
        }
        while (this.onVelocityUpdateCallbacks.length) {
            this.onVelocityUpdateCallbacks.pop();
        }

        while (this.rigidBodies.length) {
            let body = this.rigidBodies.pop();
            AmmoAPI.excludeBody(body);
        }
    }

    fitAAB(debugDraw) {
        this.box.min.copy(this.getPos());
        this.box.max.copy(this.getPos())
        for (let i = 0; i < this.rigidBodies.length; i++) {
            let body = this.rigidBodies[i];

            window.AmmoAPI.getBodyAABB(body, tempBox);
            if (debugDraw === true) {
                let color = 'CYAN';
                if (body.isStaticObject()) {
                    color = 'BLUE'
                }
                evt.dispatch(ENUMS.Event.DEBUG_DRAW_AABOX, {min:tempBox.min, max:tempBox.max, color:color})
            }
            MATH.fitBoxAround(this.box, tempBox.min, tempBox.max);
        }
        return this.box;
    }

    sampleBodyState() {

        if (this.static) {
            return;
        }

   //     console.log("sampleBodyState body", this.rigidBodies);

        for (let i = 0; i < this.rigidBodies.length; i++) {
            let body = this.rigidBodies[i];
            if (!body.getMotionState) {
                console.log("Bad physics body", body);
                return;
            }
            bodyTransformToObj3d(body, this.obj3d);

            let vel = getBodyVelocity(body)

            if (vel.lengthSq() > 0.3) {
                let angVel = getBodyAngularVelocity(body)
                if (this.moveTriggered === false) {
                    this.moveTriggered = true;
                    MATH.callAll(this.onMoveStartedCallbacks, this, body, vel)
                }
                MATH.callAll(this.onVelocityUpdateCallbacks, this, body, vel)
            } else {
                if (this.moveTriggered === true) {
                    this.moveTriggered = false;
                    MATH.callAll(this.onMoveEndedCallbacks, this, body, vel)
                }
            }

            this.lastVelocity.copy(vel);

            for (let i = 0; i < this.onUpdateCallbacks.length; i++) {
                this.onUpdateCallbacks[i](this.obj3d, body.kB);
            }


        }

    };

    updatePhysicalModel() {
        this.sampleBodyState()
    }

}

export {PhysicalModel}