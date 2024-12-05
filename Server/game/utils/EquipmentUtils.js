import {ENUMS} from "../../../client/js/application/ENUMS.js";
import {MATH} from "../../../client/js/application/MATH.js";
import {getInvSlotIndex} from "../../../client/js/application/utils/EquipmentUtils.js";
import {getServerConfig, getServerItemByItemId} from "./GameServerFunctions.js";


function readConfig(root, folder) {

    if (typeof (window) !== "undefined") {
        return window.CONFIGS[root][folder];
    } else {
        let serverConfigs = getServerConfig(root);
        if (!serverConfigs) {
            console.log("No configs found.", root);
        } else {
            if (!serverConfigs[folder]) {
                console.log("No configs found.", folder, serverConfigs);
            } else {
                return serverConfigs[folder]
            }
        }
    }

}

function getItemConfigByTemplateId(itemId) {
    let cfgs = readConfig("GAME","ITEMS")
//    console.log("getItemConfigByItemId", cfgs)
    for (let i = 0; i < cfgs.length; i++) {
        if (cfgs[i].id === itemId) {
            return cfgs[i];
        }
    }

    return null;
}

function equipActorItem(actor, serverItem, slotId) {
    let invItems = actor.getStatus(ENUMS.ActorStatus.INVENTORY_ITEMS);
    let currentItemId = actor.getStatus(ENUMS.ActorStatus[ENUMS.EquipmentSlots[slotId]])

    if (currentItemId !== "") {

        if (currentItemId === serverItem.id) {

        } else {
            console.log("Equip item on top of existing equipped item, switching...", currentItemId)
            actor.unequipItemBySlot(slotId)

            let switchItem = getServerItemByItemId(currentItemId);

            if (switchItem) {

                let switchFromSlot = switchItem.getStatus(ENUMS.ItemStatus.EQUIPPED_SLOT);
                if (typeof (switchFromSlot) === "string") {
                    addItemToInventory(actor, switchItem, serverItem.getStatus(ENUMS.ItemStatus.EQUIPPED_SLOT), true)
                } else {
                    console.log("There should be a slot id here... ", currentItemId);
                }

            } else {
                console.log("There should be an item here when switching", currentItemId);
            }

            serverItem.setStatusKey(ENUMS.ItemStatus.EQUIPPED_SLOT, slotId);
        }

    } else {
        let fromSlot = invItems.indexOf(serverItem.id);

        if (fromSlot === -1) {
            console.log("Equip item from non-inv source")
        } else {
            invItems[fromSlot] = "";
        }

        console.log("Equip item on empty slot...")
    }
    actor.equipServerItem(serverItem, slotId)
  //  applyItemToActor(actor, serverItem, slotId)
}

function applyItemToActor(actor, serverItem, slotId) {
        return;
        console.log("applyItemToActor", actor.equippedItems, serverItem.id, slotId);
        if (actor.equippedItems.indexOf(serverItem) === -1) {
            actor.equippedItems.push(serverItem);
            serverItem.setStatusKey(ENUMS.ItemStatus.ACTOR_ID, actor.status.getStatus(ENUMS.ActorStatus.ACTOR_ID))
            serverItem.setStatusKey(ENUMS.ItemStatus.ITEM_ID, serverItem.id)
            serverItem.setStatusKey(ENUMS.ItemStatus.EQUIPPED_SLOT, slotId)
            //    console.log("Server Equip: to actor_id",serverItem.id, this.status.getStatus(ENUMS.ActorStatus.ACTOR_ID))
            actor.setStatusKey(ENUMS.ActorStatus[slotId], serverItem.id)
            console.log("Equip Slot", ENUMS.ActorStatus[slotId], serverItem.id)
            actor.clearInventoryItemId(serverItem.id);
        } else {
            console.log("Item already equipped", serverItem.id)
        }

}


function unequipActorItem(actor, serverItem) {
    console.log("unequipActorItem", actor.equippedItems, serverItem.id, slotId);
}



function addItemToInventory(actor, serverItem, slotId, isASwitch) {
    let invItems = actor.getStatus(ENUMS.ActorStatus.INVENTORY_ITEMS);


    if (slotId === undefined) {
        console.log("Undefined slotId, needs fixing");
        return;
    }

    if (slotId !== "") {
        let slotIndex = getInvSlotIndex(ENUMS.InventorySlots[slotId]);
        let currentItemId = invItems[slotIndex];

        if (currentItemId === "") {


            if (isASwitch === true) {
                actor.unequipEquippedItem(serverItem, slotId)
            } else {
                let currentIndex = invItems.indexOf(serverItem.id)

                if (currentIndex !== -1) {
                    console.log("Move inv item into free inv slot");
                    invItems[currentIndex] = "";
                    serverItem.setStatusKey(ENUMS.ItemStatus.EQUIPPED_SLOT, slotId)
                } else {
                    console.log("Put item into free inv slot", slotId, serverItem.id);
                    actor.unequipEquippedItem(serverItem, slotId)
                };
            }

            invItems[slotIndex] = serverItem.id;
        } else if (currentItemId !== serverItem.id) {
            console.log("Put item on top of inv item", currentItemId);
            invItems[slotIndex] = serverItem.id;
            let currentItem = getServerItemByItemId(currentItemId);
            if (currentItem) {
                addItemToInventory(actor, currentItem, "")
                currentItem.dispatchItemStatus();
            } else {
                console.log("inv status id without item, clearing it")
            }
        } else if (currentItemId === serverItem.id) {
            console.log("Put item on top of itself, should not be possible")
        } else {
            console.log("This should never happen...")
        }

    } else { // determine slot here on the server...
        let invSlotIndex = actor.getFirstFreeInvSlotIndex();
        console.log("Put item into inventory", "SLOT_"+invSlotIndex, serverItem.id)
        addItemToInventory(actor, serverItem, "SLOT_"+invSlotIndex)

    }
}

function removeItemFromInventory(actor, serverItem) {

}

function getUpdatedItemAddModifiers(item) {

    let config = getItemConfigByTemplateId(item.getStatus(ENUMS.ItemStatus.TEMPLATE))

    let addMods = config['status_add_modifiers']

    if (typeof (window) === 'undefined') {
        addMods = config.data['status_add_modifiers']
    //    console.log("Server addMods: ", addMods)
    }

 //   if (Object.keys(addModifiers).length > 0) {

 //   }

    let addModifiers = item.call.getAddModifiers();
    if (addMods) {

    //    if (typeof (window) === 'undefined') {
   //         console.log("Server addModifiers: ", addModifiers)
   //     }

        let modStatus = item.status.statusMap[ENUMS.ItemStatus.MODIFIERS]
        if (typeof (modStatus) !== 'undefined') {
            for (let i = 0; i < addMods.length; i++) {
                if (addModifiers[addMods[i].status]) {
                    addModifiers[addMods[i].status][0] = addMods[i].value
                } else {
                    addModifiers[addMods[i].status] = [addMods[i].value];
                }
                modStatus[i*2] = addMods[i].status;
                modStatus[i*2 + 1] = addMods[i].value;
                //   console.log("Add Modifier ", addMods, modStatus, addModifiers)
            }
        }
    }
    return addModifiers;
}

let eqStatusStore = [];

function getItemListStatusKeyModifiers(items, key, store) {
    let modifiersList = getUpdatedItemListModifiers(items);
    for (let i = 0; i < modifiersList.length; i++) {
    //    console.log("Modifiers list: ", modifiersList.length);
        let mod = modifiersList[i];
        if (mod[key]) {
            for (let j = 0; j < mod[key].length; j++) {
                store.push(mod[key][j]);
            }
        }
    }
}

let tempStore = [];

function getActorEquipmentStatusKey(actor, key) {
    MATH.emptyArray(tempStore);
//    actor.actorEquipment.call.getEquipmentStatusKey(key, tempStore);
    let itemList = getActorEquippedItems(actor)
    getItemListStatusKeyModifiers(itemList, key, tempStore);
    if (key === ENUMS.ActorStatus.MAX_HP) {
        if (typeof (window) === 'undefined') {
            console.log("Server list: ", itemList.length, key, tempStore.length)
        }
    }

//
    let status = actor.actorStatus.getStatusByKey(key);
    if (tempStore.length) {

        if (status.length) {
            for (let i = 0; i < status.length; i++) {
                tempStore.push(status[i])
            }
            return tempStore;
        } else if (typeof(status) === 'number') {
            while (tempStore.length) {
                status+=tempStore.pop();
            }
        }
    }
    return status;

}

let tempModifiers = [];

function getUpdatedItemListModifiers(items) {
    MATH.emptyArray(tempModifiers)
    for (let i = 0; i < items.length; i++) {
        if (items[i] !== null) {
            let addModifiers = getUpdatedItemAddModifiers(items[i])
/*
            if (Object.keys(addModifiers).length > 0) {
                if (typeof (window) === 'undefined') {
                    console.log("Server addModifiers: ", addModifiers)
                }
            }
*/


            for (let key in addModifiers) {
                let modifier = {};
                modifier[key] = addModifiers[key];
                tempModifiers.push(modifier)


                //    console.log("addModifiers: ", key, addModifiers)
            }
        }

    }
    return tempModifiers;
}


let equippedList = [];
function getActorEquippedItems(actor) {
    MATH.emptyArray(equippedList);

    for (let key in ENUMS.EquipmentSlots) {
        let itemId = actor.actorStatus.statusMap[ENUMS.EquipmentSlots[key]];
        if (itemId !== "") {

            if (typeof (window) === 'undefined') {

                let serverItem = getServerItemByItemId(itemId)
                if (serverItem) {
                    equippedList.push( serverItem);
                //    console.log("ServerItem ID found: ", itemId, equippedList);
                } else {
                    //      console.log("Not serverItem by ID: ", itemId);
                }


            } else {
                equippedList.push( GameAPI.getItemById(itemId));
            }

        }
    }
    return equippedList;

}

export {
    equipActorItem,
    unequipActorItem,
    addItemToInventory,
    removeItemFromInventory,
    getUpdatedItemAddModifiers,
    getActorEquipmentStatusKey,
    getUpdatedItemListModifiers,
    getActorEquippedItems
}