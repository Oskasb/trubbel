import {processServerCommand} from "./ServerCommandProcessor.js";
import {getUrlParam} from "../../application/utils/DebugUtils.js";
import {getSetting} from "../../application/utils/StatusUtils.js";

let worker;

let randomDelay = 0;

let msgEvent = {
	stamp:0,
	msg:""
}

let messageIndex = 0;

let relayToWorker = function(msg) {
//	let json = JSON.stringify({stamp:client.getStamp(), msg:msg})
	client.lastRequestFrame = GameAPI.getFrame().frame;

	let idx = messageIndex;
	messageIndex++;



	if (randomDelay === 0) {
		msg.idx = idx;
		worker.postMessage([ENUMS.Protocol.CLIENT_TO_WORKER, msg]);
	} else {
		setTimeout(function() {
			msg.idx = idx;
			worker.postMessage([ENUMS.Protocol.CLIENT_TO_WORKER, msg]);
		}, MATH.randomBetween(randomDelay*0.2, randomDelay))
	}

}

function setupUniqueConnection(stamp) {
	console.log("Set Stamp from message", stamp);
	client.setStamp(stamp);
	setTimeout(function() {
		GameAPI.initGameMain();
	}, 1000)

}

function handleWorkerMessage(msg) {
	let protocolKey = msg.data[0];

	if (protocolKey === ENUMS.Protocol.SET_SERVER_STAMP) {
		setupUniqueConnection(msg.data[1]);
	} else if (protocolKey === ENUMS.Protocol.MESSAGE_RELAYED) {
		msgEvent.stamp = msg.data[1].stamp;
		msgEvent.msg = msg.data[1].msg;
		if (msgEvent.stamp === client.getStamp()) {
			console.log("Not return back to self")
		} else {
			evt.dispatch(ENUMS.Event.ON_SOCKET_MESSAGE, msgEvent)
		}

		//	console.log("Worker Socket -> Client Message", msg[1], msgEvent);
	} else if (protocolKey === ENUMS.Protocol.SERVER_DISPATCH) {

		if (msg.data[1].stamp === client.getStamp()) {
			//	console.log("local dispatch", msg.data)
			processServerCommand(msg.data[0], msg.data[1]);
		} else {
			//	console.log("remote dispatch", msg.data)
			processServerCommand(msg.data[0], msg.data[1]);
			//	console.log("Not listening to remote dispatches", msg.data)
		}

	} else {
		if (protocolKey === ENUMS.Protocol.WORKER_LOADED) {
			console.log("Notify worker loaded, apply init settings here...")
			worker.postMessage([ENUMS.Protocol.WORKER_LOADED, {runLocally:getUrlParam('local')}])
		} else {
			console.log("Worker Socket Unhandled Message", msg);
		}

	}
}

// './client/js/data_pipeline/worker/ServerWorkerMain.js'
function initWorker() {
	worker = new Worker("./Server/Worker/ServerWorkerMain.js", { type: "module" });
	evt.on(ENUMS.Event.SEND_SOCKET_MESSAGE, relayToWorker)

	worker.onmessage = function(msg) {

		randomDelay = getSetting(ENUMS.Settings.NETWORK_RANDOM_DELAY)

		if (randomDelay === 0) {
			handleWorkerMessage(msg);
		} else {

			setTimeout(function() {
				handleWorkerMessage(msg);
			}, MATH.randomBetween(randomDelay*0.2, randomDelay))

		}

	};
}



class ClientConnection {
	constructor() {
		initWorker()
	}

}

export { ClientConnection };