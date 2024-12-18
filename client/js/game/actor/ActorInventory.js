import {isDev} from "../../application/utils/DebugUtils.js";
import {saveItemStatus} from "../../application/setup/Database.js";

class ActorInventory {
    constructor(actor) {
        this.actor = actor;
        this.inventoryStatus = [
            "", "", "",
            "", "", "",
            "", "", "",
            "", "", ""
        ];
        this.items = {}

        for (let i = 0; i < this.inventoryStatus.length; i++) {
            this.items["SLOT_"+i] = {index:i, item:null}
        }

        actor.actorStatus.setStatusKey(ENUMS.ActorStatus.INVENTORY_ITEMS, this.inventoryStatus);
    }

    getFirstEmptySlotKey() {

        let invItems = this.actor.getStatus(ENUMS.ActorStatus.INVENTORY_ITEMS);
        for (let i =0; i< invItems.length; i++) {
            if (invItems[i] === "") {
                return 'SLOT_'+i;
            }
        }
        return null;
    }

    isInventorySlot(toSlot) {
        if (typeof (this.items[toSlot]) === 'object') {
            return true;
        } else {
            return false;
        }
    }


    getInvItemSlotId(item) {
        for (let key in this.items) {
            if (this.items[key].item === item) {
                return key;
            }
        }
        return null;
    }



    addInventoryItem(item, slot, callback) {
    //    if (isDev()) {
            console.log("Add Inv Item ", item, slot)
    //    }

        let slotKey = null;
        if (typeof (slot) === 'string') {
            slotKey = slot;
        } else if (typeof (slot) === 'number') {
            slotKey = 'SLOT_'+slot;
        } else {
            slotKey = this.getFirstEmptySlotKey();
            if (slotKey === null) {
                console.log("Inventory full...")
                if (typeof (callback) === 'function') {
                    callback(null);
                    return;
                }
            }
        }

        let invStatus = this.actor.getStatus(ENUMS.ActorStatus.INVENTORY_ITEMS);
        let currentInvSlotKey = this.getInvItemSlotId(item);
        if (currentInvSlotKey !== null) {
            if (currentInvSlotKey === slotKey) {
                console.log("Item already in place", slotKey, item);
                return;
            }
            invStatus[this.items[currentInvSlotKey].index] = "";
        }


        let slotItem = this.items[slotKey];
        if (!slotItem) {
            console.log("Bad slot lookup ", slotKey, this.items)
        }


        let switchItem = null;
        if (slotItem) {
            switchItem = slotItem.item;
        }



        if (item === null) {
            invStatus[this.items[slotKey].index] = "";
        } else {

            if (this.actor.isPlayerActor()) {
                saveItemStatus(item.getStatus())
            }

            invStatus[this.items[slotKey].index] = item.getStatus(ENUMS.ItemStatus.ITEM_ID);
            item.setStatusKey(ENUMS.ItemStatus.EQUIPPED_SLOT, slotKey);
        }

        this.items[slotKey].item = item;
        if (typeof (callback) === 'function') {
            callback(item, switchItem);
        }
    }

    getItemAtIndex(slotIndex) {
        return this.items["SLOT_"+slotIndex].item;
    }

    getItemAtSlot(slotId) {
        if (typeof (this.items[slotId]) === 'object') {
            return this.items[slotId].item;
        } else {
            return null;
        }
    }

    fetchInventoryItems(store) {
        let invItems = this.actor.getStatus(ENUMS.ActorStatus.INVENTORY_ITEMS);

        for (let i = 0; i < invItems.length; i++) {
            let id=invItems[i];
            if (id !== "") {
                let item = GameAPI.getItemById(invItems[i])
                store.push(item);
            }
        }
    }

}

export { ActorInventory }