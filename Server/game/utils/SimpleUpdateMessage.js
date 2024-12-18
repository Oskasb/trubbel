
import {MATH} from "../../../client/js/application/MATH.js";
import {getGameServer} from "./GameServerFunctions.js";

class SimpleUpdateMessage {
    constructor() {
        let message = {
            command:null,
            request:null,
            status:null
        }
        let lastBroadcast = {};
        let sendStatus = [];
        let lastFullSend = 0;

        let skipKey = null;

        function fullSend(statusMap) {
            for (let key in statusMap) {
                if (key !== skipKey)  {

                    if (key === 'undefined') {
                    //    console.log("SIMPLE SEND FULL: ",key, sendStatus)
                    } else {

                        sendStatus.push(key)
                        sendStatus.push(statusMap[key])

/*
                        if (key === ENUMS.ItemStatus.EQUIPPED_SLOT) {
                            console.log("Send EQ SLot: ", statusMap[key],  statusMap[ENUMS.ItemStatus.TEMPLATE])
                        }
*/
                        if (!lastBroadcast[key]) {
                            lastBroadcast[key] = [0];
                        }

                        lastBroadcast[key][0] = MATH.stupidChecksumArray(statusMap[key])
                    }


                }
            }
        }

        function sendUpdatedOnly(statusMap) {

            for (let key in statusMap) {
                if (key !== skipKey) {
                    if (!lastBroadcast[key]) {
                        lastBroadcast[key] = [0];
                    }
                    let checksum = MATH.stupidChecksumArray(statusMap[key])
                    if (checksum !== lastBroadcast[key][0]) {
                        lastBroadcast[key][0] = checksum;
                        if (key === 'undefined') {
                        //    console.log("SIMPLE SEND: ",key, sendStatus)
                        } else {
                            sendStatus.push(key)
                            sendStatus.push(statusMap[key])
                        }

                    }
                }
            }
        }

        function buildMessage(statusMessageKey, statusMap, clientRequest, forceFullSend) {
            message.request = clientRequest;
            message.status = sendStatus;
            let gameTime = getGameServer().serverTime;
            MATH.emptyArray(sendStatus);
            sendStatus.push(statusMessageKey)
            sendStatus.push(statusMap[statusMessageKey])
            skipKey = statusMessageKey;

                if (lastFullSend < gameTime -5 || forceFullSend === true) {
                    lastFullSend = gameTime;
                    fullSend(statusMap)
                 //   console.log("Send fullSend", sendStatus)
                } else {
                    sendUpdatedOnly(statusMap)
                //    console.log("Send Updated", sendStatus)
                }

                if (sendStatus.length > 2) {
                    return message;
                } else {
                    return false
                }

        }

        this.call = {
            buildMessage:buildMessage
        }

    }

}

export { SimpleUpdateMessage }