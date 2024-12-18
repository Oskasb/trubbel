import {ENUMS} from "../../../client/js/application/ENUMS.js";
import {MATH} from "../../../client/js/application/MATH.js";
import {
    getGameServer,
    registerGameServerUpdateCallback,
    unregisterGameServerUpdateCallback
} from "../utils/GameServerFunctions.js";
import {processClientMessage} from "../utils/MsgProcessFunctions.js";

class ConnectedClient { // This is running on both the client in a worker and on the node server.
    constructor(sendFunction, isLocal) {
        this.send = sendFunction
        this.isLocal = isLocal; // running in worker, if false it runs on node through the websocket
        this.stamp = -1;
        this.connectedTime = 0;
        let pingDelay = 30;
        let pingTime = 0;

        this.expectedMessageIndex = 0;
        this.disorderedMessageQueue = []

        this.sendToServer = null;

        let returnDataMessage = function(message) {
        //    console.log("returnDataMessage ", [message])
            if (this.isLocal === true) {
                if (message.remote === true || this.stamp === -1) {
            //        console.log("passing message to client ", [message])
                    sendFunction(message) // worker postMessage can send Objects, so no need to stringify for local
                } else {
                    // the information is generated locally and redundant except for debugging and validation
            //        console.log("Not passing redundant message to client ", [message])
                }

            } else {
                message.remote = true;
                sendFunction(JSON.stringify(message)) // socket speaks binary and json, Object not allowed.
                // this goes to the local "ConnectedPlayer" in the client worker, handleMessage then returnDataMessage
            }
        }.bind(this)

        let sendToServer = function(message) {
        //    console.log("Send to server ", message)
            this.sendToServer(JSON.stringify(message)) // socket speaks binary and json, Object not allowed.
        }.bind(this)


        let tickConnectedClient = function(tpf, serverTime) {
            if (pingTime > pingDelay) {
        //        returnDataMessage({request:ENUMS.ClientRequests.SERVER_PING, command:ENUMS.ServerCommands.PLAYER_UPDATE, tpf:tpf, serverTime:serverTime, stamp:this.stamp, local:this.isLocal})
                pingTime -= pingDelay;
            }
            pingTime+=tpf;
            this.connectedTime += tpf;
        }.bind(this)

        this.call = {
            returnDataMessage:returnDataMessage,
            sendToServer:sendToServer,
            tickConnectedClient:tickConnectedClient
        }

    }

    setStamp(stamp) {
        this.stamp = stamp;
    }

    handleMessage(message, source) {

        let data = message;
        if (!this.isLocal) {
            data = JSON.parse(message);
            data.local = this.isLocal
            data.remote = true
        }

        if (source === "NODE WS") {


            if (data.idx !== undefined) {
                //    console.log(message)
                if (data.idx === this.expectedMessageIndex) {

                //    console.log("idx ok", data.idx)
                    this.expectedMessageIndex++;

                } else {

                    if (data.idx < this.expectedMessageIndex) {
                //        console.log("Index is lower than expected",data.idx , this.expectedMessageIndex );

                    } else {
                        console.log("idx HIGH", data.idx, this.expectedMessageIndex, this.disorderedMessageQueue.length);

                        let queueEntry = {
                            idx:data.idx,
                            msg:message,
                            src:source
                        }

                        this.disorderedMessageQueue.push(queueEntry);
                        return;
                    }
                }
            }
        }



    //    console.log("worker handleMessage", source, message)
        if (this.isLocal) { // two cases for local player, with or without remote server

            if (this.stamp === -1) { // without remote server run the game server logic from here, same code as the remote

                processClientMessage(data, this)
            } else { // remote server is running so just passing its messages back to client
                if (data.remote === true) {
                //    console.log("Pass from server to client main: ", ENUMS.getKey('ClientRequests', data.request), data.stamp, data);
                    this.call.returnDataMessage(data);
                } else {
                    if (source === 'WORKER') {
                    //    console.log("Pass message from Worker to Node", data)
                        //    this.call.sendToServer(2);
                        this.call.sendToServer(data);
                    }
                //    processClientMessage(data, this) // local server debug runs local player messages
                    // the information generated by the local game server should be a copy of what comes from the socket, can compare here
                }

                // for dev mode debugging also run the server locally anyway since the chrome console is nice

            }
        } else {
            // we are on the node server, so running the game server logic
        //    console.log("node server handleMessage", source, message)
            processClientMessage(data, this)
            /*
            let spam = function() {
                this.call.returnDataMessage(data)
            }.bind(this)

            setInterval(function() {
                //    console.log("Send Spam")
                spam()
            }, 1500)
            */
        }


        for (let i = 0; i < this.disorderedMessageQueue.length; i++) {
            let queueEntry = this.disorderedMessageQueue[i];

            if (queueEntry.idx === this.expectedMessageIndex) {
                MATH.splice(this.disorderedMessageQueue, queueEntry);
                console.log("Recover message from queue", queueEntry);
                this.handleMessage(queueEntry.msg, queueEntry.src);
                i = this.disorderedMessageQueue.length +1;
                return;
            }
        }

    }

    activateConnectedClient() {
        registerGameServerUpdateCallback(this.call.tickConnectedClient)
    }

    deactivateConnectedClient() {
        let player = getGameServer().getConnectedPlayerByStamp(this.stamp)
        getGameServer().disconnectConnectedPlayer(player);
        player.removeServerPlayer();
        unregisterGameServerUpdateCallback(this.call.tickConnectedClient)
    }


}

export {ConnectedClient}