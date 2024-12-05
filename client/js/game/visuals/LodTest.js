import {aaBoxTestVisibility, borrowBox} from "../../application/utils/ModelUtils.js";
import {getSetting} from "../../application/utils/StatusUtils.js";


function testLodVisibility(lodLevel, visibility) {
    if (lodLevel !== -1 && lodLevel < visibility+1) {
        return true;
    } else {
        return false
    }
}

class LodTest {
    constructor() {

        let size;
        let position;
        let hideFunction;
        let locationModel;
        let isBoxTesting = false;


        let aaBoxTestLocationModel = function() {
            let isVisible = aaBoxTestVisibility(position, size, size, size)


            if (isVisible) {
                if (getSetting(ENUMS.Settings.DEBUG_VIEW_LOD_TESTS)) {
                    let borrowedBox = borrowBox();
                    evt.dispatch(ENUMS.Event.DEBUG_DRAW_AABOX, {min:borrowedBox.min, max:borrowedBox.max, color:'YELLOW'})
                    evt.dispatch(ENUMS.Event.DEBUG_DRAW_LINE, {from:ThreeAPI.getCameraCursor().getPos(), to:position, color:'YELLOW', drawFrames:10});
                }

            } else {
                if (getSetting(ENUMS.Settings.DEBUG_VIEW_LOD_TESTS)) {
                    let borrowedBox = borrowBox();
                    evt.dispatch(ENUMS.Event.DEBUG_DRAW_AABOX, {min:borrowedBox.min, max:borrowedBox.max, color:'RED'})
                    evt.dispatch(ENUMS.Event.DEBUG_DRAW_LINE, {from:ThreeAPI.getCameraCursor().getPos(), to:position, color:'RED', drawFrames:10});
                }
                isBoxTesting = false;
                locationModel.isVisible = false;
                hideFunction(locationModel);
                ThreeAPI.unregisterPostrenderCallback(aaBoxTestLocationModel)
            }

        }.bind(this)

        let cameraTestVisibility = function(model, visibility, hideCallback) {
            size = visibility*2
            position = model.obj3d.position;
            hideFunction = hideCallback;
            locationModel = model;
            isBoxTesting = true;
            ThreeAPI.addPostrenderCallback(aaBoxTestLocationModel);
        }

        let checkBoxTesting = function() {
            if  (isBoxTesting) {
                ThreeAPI.unregisterPostrenderCallback(aaBoxTestLocationModel)
                isBoxTesting = false;
            }
        }

        this.call = {
            checkBoxTesting:checkBoxTesting,
            cameraTestVisibility:cameraTestVisibility
        }


    }


    lodTestModel(model, lodLevel, visibility, showCallback, hideCallback) {

        if (lodLevel === -2) {
            this.call.checkBoxTesting()
            hideCallback(model);
            model.isVisible = false;
            return;
        }

        let levelVisible = testLodVisibility(lodLevel, visibility)

        if (getSetting(ENUMS.Settings.DEBUG_VIEW_LOD_TESTS)) {
            let position = model.obj3d.position;
        //    let borrowedBox = borrowBox();
        //    evt.dispatch(ENUMS.Event.DEBUG_DRAW_AABOX, {min:borrowedBox.min, max:borrowedBox.max, color:'YELLOW'})
            let color = 'GREEN'
            if (lodLevel < 2) {
                color = 'YELLOW'
            }
            evt.dispatch(ENUMS.Event.DEBUG_DRAW_LINE, {from:ThreeAPI.getCameraCursor().getPos(), to:position, color:color, drawFrames:2});
        }

        if (levelVisible) {
            if (model.isVisible !== true) {
                showCallback(model)
                this.call.checkBoxTesting()
            }
            model.isVisible = true;
        } else {
            if (model.isVisible === true) {
                if (lodLevel === -2) {
                    this.call.checkBoxTesting()
                    hideCallback(model);
                    model.isVisible = false;
                } else if (lodLevel > visibility) {
                    hideCallback(model);
                    model.isVisible = false;
                } else {
                    this.call.cameraTestVisibility(model, visibility, hideCallback)
                }
            }
        }
    }

}

export {LodTest}