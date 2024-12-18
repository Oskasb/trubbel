import {Object3D} from "../../../libs/three/core/Object3D.js";
import {inheritAsParent, inheritConfigTransform} from "../../application/utils/ModelUtils.js";
import {WorldBox} from "./WorldBox.js";
import {LodTest} from "../visuals/LodTest.js";
import {poolFetch, poolReturn, registerPool} from "../../application/utils/PoolUtils.js";
import {addPhysicsToModel, getBodyByPointer, removePhysicalModel} from "../../application/utils/PhysicsUtils.js";
import {Box3} from "../../../libs/three/math/Box3.js";
import {getSetting} from "../../application/utils/StatusUtils.js";
import {ENUMS} from "../../application/ENUMS.js";




function showLocationModel(model) {

//    console.log("SHOW LocationModel", model);

    if (model.requestRemove === true) {
        model.requestRemove = false;
        return;
    }


    let addModelInstance = function(instance) {
        ThreeAPI.getScene().remove(instance.spatial.obj3d)
        instance.spatial.stickToObj3D(model.obj3d);
        model.instance = instance;
        model.instanceCallback(instance);
    }.bind(this)

    if (model.config.asset) {
        client.dynamicMain.requestAssetInstance(model.config.asset, addModelInstance)
    }

}


function hideLocationModel(model) {
//    console.log("Hide", model);
    if (model.instance === null) {
    //    console.log("No INstance", model)
        model.requestRemove = true;
    } else {
        model.instance.decommissionInstancedModel();
        model.instance = null;
    }
}

class LocationModel {
    constructor(parentObj3d, config) {
    //    console.log("LocationModel", config);
        this.parentObj3d = parentObj3d;
        this.obj3d = new Object3D();
        this.instance = null;
        this.config = config;
        this.lodLevel = config.visibility;
        this.solidity = config.solidity || 0.5;
        this.boxes = [];
        this.isVisible = false;

        this.box = new Box3();

        let paletteKey = config.paletteKey || 'DEFAULT'
        this.palette = poolFetch('VisualModelPalette')
        this.palette.initPalette()
        this.bodyPointers = [];


        this.requestRemove = false;

        inheritConfigTransform(this.obj3d, this.config);
        inheritAsParent(this.obj3d, parentObj3d);

        if (config.boxes) {
            let boxes = config.boxes;

            this.clearLocationBoxes()

            for (let i = 0; i < boxes.length; i++) {
        //        console.log("Add box")
                let box = new WorldBox();
                box.activateBoxByConfig(boxes[i])
                box.attachToParent(parentObj3d);
            //    ThreeAPI.registerTerrainLodUpdateCallback(box.getPos(), box.call.lodUpdated)
                this.boxes.push(box);
            }
        }

        let lodTest = new LodTest()

        let physicalModel = null;

        MATH.emptyArray(this.bodyPointers);

        this.physicsUpdate = function(obj3d, bodyPointer) {
            if (this.bodyPointers.indexOf(bodyPointer) === -1) {
            //    console.log("update body pointer", bodyPointer)
                this.bodyPointers.push(bodyPointer);
            }

        //    console.log("update", obj3d.position.y)
            if (getSetting(ENUMS.Settings.DEBUG_VIEW_PHYSICS_KINEMATICS)) {
                evt.dispatch(ENUMS.Event.DEBUG_DRAW_LINE, {from:ThreeAPI.getCameraCursor().getPos(), to:obj3d.position, color:'GREEN'});
                renderDebugAAB(true);
            }


            if (this.instance) {
                this.instance.getSpatial().stickToObj3D(obj3d);
            }
        }.bind(this);

        let applySelectedPaletteKey = function() {
            this.palette.applyPaletteSelection(paletteKey, this.instance);
        }.bind(this);

        let setInstance = function(instance) {
            this.instance = instance;
            applySelectedPaletteKey();
            this.call.playerContact(false)
        }.bind(this);

        this.instanceCallback = function(instance) {
            this.call.setInstance(instance)
        }.bind(this);

        let model = this;

        let alignPhysicalModel = function() {
            config = this.config;
            if (physicalModel !== null) {
                removePhysicalModel(physicalModel);
                physicalModel = addPhysicsToModel(config.asset, this.obj3d, this.physicsUpdate);
                physicalModel.call.setModel(model)
            }
        }.bind(this)

        let lodUpdated = function(lodLevel) {
            config = model.config;
            model.lodLevel = lodLevel;

            for (let i = 0; i < this.boxes.length; i++) {
                this.boxes[i].call.lodUpdated(lodLevel);
            }

            if (lodLevel === 0) { //  || lodLevel === -71) {

                if (physicalModel === null) {
                    if (this.instance === null) {
                        this.instanceCallback = function(instance) {

                            physicalModel = addPhysicsToModel(config.asset, this.obj3d, this.physicsUpdate);
                        //    console.log("Set model 1", model)
                            physicalModel.call.setModel(model)
                            this.call.setInstance(instance)
                        }.bind(this);
                    } else {

                        physicalModel = addPhysicsToModel(config.asset, this.obj3d, this.physicsUpdate);
                     //   console.log("Set model 2", model)
                        physicalModel.call.setModel(model)
                    }

                } else {
                //    console.log("Set model 3", model)
                    physicalModel.call.setModel(model)
                }

            } else {

                if (this.instance !== null) {
                    if (physicalModel !== null) {
                        removePhysicalModel(physicalModel);
                        physicalModel = null;
                    }
                }

            }
            let visibility = config.visibility || 2;

            lodTest.lodTestModel(model, lodLevel, visibility, showLocationModel, hideLocationModel)

        }.bind(this)


        let scalarTransition = null;
        let obstructing = false;
        let frameSolidity = this.solidity;


        let transitionEnded = function(value, transition) {
            if (transition) {
                scalarTransition = null;
                poolReturn(transition);
            }
            if (scalarTransition !== null) {
                scalarTransition.cancelScalarTransition();
            }
        }

        let applySolidity = function(value) {
            frameSolidity = value;
            this.palette.setSeeThroughSolidity(frameSolidity)
            if (this.instance) {
                this.palette.applyPaletteToInstance(this.instance)
            } else {
        //        console.log("palette expects instance")
            }

            this.palette.setSeeThroughSolidity(frameSolidity)
        }.bind(this);

        let transitSolidity = function(to, time) {

                if (scalarTransition !== null) {
                    transitionEnded();
                }

                scalarTransition = poolFetch('ScalarTransition');
                scalarTransition.initScalarTransition(frameSolidity, to, time, transitionEnded, 'curveSqrt', applySolidity)
        }

        let obsFrame = 0;

        let setObstructing = function(bool, frame) {

            if (bool === true || frame > obsFrame) {
                if (obstructing !== bool) {
                      obstructing = bool;
                    if (bool) {
                        transitSolidity( 1 - getSetting(ENUMS.Settings.OBSTRUCTION_PENETRATION) * 0.01, 0.7);
                    } else {
                        transitSolidity(this.solidity, 0.7);
                    }
                }
            }

            obsFrame = frame;

        }.bind(this);



        let viewObstructing = function(bool) {
            let frame = GameAPI.getFrame().frame;
            if (frame !== obsFrame) {

                if (this.worldModel) {
                    let wmNeighbors = this.worldModel.locationModels;
                    for (let i = 0; i < wmNeighbors.length; i++) {
                        wmNeighbors[i].call.setObstructing(bool, frame);
                    }
                }

            }

        }.bind(this);


        let setPaletteKey = function(key) {
            paletteKey = key;
            applySelectedPaletteKey();
        }

        let getPaletteKey = function() {
            return paletteKey;
        }

        let calcAABB = function(debugDraw) {
            this.box.min.copy(this.obj3d.position);
            this.box.max.copy(this.obj3d.position);

            for (let i = 0; i <  this.boxes.length; i++) {
                let box = this.boxes[i];
                box.call.parentUpdated(this.parentObj3d)
                let aabb = box.call.updateBoxAABB(debugDraw);
                if (aabb) {
                    MATH.fitBoxAround(this.box, aabb.min, aabb.max)
                }                           }

            if (physicalModel !== null) {
                let physBox = physicalModel.fitAAB(debugDraw);
                MATH.fitBoxAround(this.box, physBox.min, physBox.max);
            }
            return this.box;
        }.bind(this);

        let renderDebugAAB = function(debugDraw) {
            calcAABB(debugDraw);
        //    evt.dispatch(ENUMS.Event.DEBUG_DRAW_AABOX, {min:this.box.min, max:this.box.max, color:'YELLOW'})
            if (debugDraw === true) {
                evt.dispatch(ENUMS.Event.DEBUG_DRAW_AABOX, {min:this.box.min, max:this.box.max, color:'YELLOW'})
            }

        }.bind(this);

        let setAssetId = function(aid) {
            this.config.model = aid;
        //    hideLocationModel(this);
        }.bind(this);

        function getPhysicalModel() {
            return physicalModel;
        }

        let imprintLocationModelToGround = function(cb) {

            if (physicalModel === null) {
                lodUpdated(0);
                setTimeout(function () {
                    console.log("Init phys model before imprinting")
                    imprintLocationModelToGround(cb)
                }, 10)
            } else {
                ThreeAPI.imprintModelAABBToGround(this.box, cb)
            }


        }.bind(this);

        this.call = {
            setAssetId:setAssetId,
            alignPhysicalModel:alignPhysicalModel,
            setInstance:setInstance,
            setPaletteKey:setPaletteKey,
            getPaletteKey:getPaletteKey,
            lodUpdated:lodUpdated,
            playerContact:viewObstructing,
            setObstructing:setObstructing,
            viewObstructing:viewObstructing,
            renderDebugAAB:renderDebugAAB,
            getPhysicalModel:getPhysicalModel,
            imprintLocationModelToGround:imprintLocationModelToGround
        }

    }

    getPos() {
        return this.obj3d.position;
    }


    hierarchyUpdated() {
        this.obj3d.quaternion.set(0, 0, 0, 1);
        this.obj3d.position.set(0, 0, 0)
        inheritConfigTransform(this.obj3d, this.config);
        inheritAsParent(this.obj3d, this.parentObj3d);
    //    this.obj3d.quaternion.premultiply(this.parentObj3d.quaternion);


        if (this.instance) {
            this.instance.spatial.stickToObj3D(this.obj3d);
        }

        for (let i = 0; i <  this.boxes.length; i++) {
            let box = this.boxes[i];
            box.call.parentUpdated(this.parentObj3d)
        }

    }

    clearLocationBoxes() {
        MATH.emptyArray(this.bodyPointers);
        while (this.boxes.length) {
            let box = this.boxes.pop()
            box.call.lodUpdated(-1);
            box.call.removeWorldBox(box);
        }
    }

    removeLocationModel() {
        this.clearLocationBoxes();
        this.call.lodUpdated(-2);
        hideLocationModel(this);
    }


}

export {LocationModel}