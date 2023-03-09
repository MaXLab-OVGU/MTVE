var OV;
var session;

var sessionName;
var sessionID;
var token;
var numVideos = 0;
var handler = 0;
var recorder = new MRecordRTC();
var meeting_start_time = null;
var publisher;
var localRecorder;
var recordingStopped = false;
var numberOfStreamsPlaying = 0;

// function randomDelay() {
// 	// Adds a random delay of upto 1 sec
// 	max = 10;
// 	min = 0;
// 	delayInMilliseconds = Math.floor(Math.random() * (max - min + 1) + min) * 100;

// 	setTimeout(function () {
// 		console.log("Delay of - " + delayInMilliseconds + " ms");
// 		joinSession();
// 	}, delayInMilliseconds);
// }

const joinSession = () => {
	$("#join").show();
	$("#session").hide();
	$("#endmeeting").hide();
	$("#permission").hide();
	$("#permission-denied").hide();
	sessionName = ROOM_ID;
	console.log(sessionName);

	getToken(() => {
		//Get an OpenVidu object ---
		OV = new OpenVidu();

		OV.setAdvancedConfiguration({ noStreamPlayingEventExceptionTimeout: 20000 });
		OV.enableProdMode();

		//Init a session ---
		session = OV.initSession();

		session.on("connectionCreated", (event) => {
			console.log("connectionCreated");
		});

		session.on("connectionDestroyed", (event) => {
			console.log("connectionDestroyed");
		});

		// On every new Stream received...
		session.on("streamCreated", (event) => {
			// Subscribe to the Stream to receive it
			// HTML video will be appended to element with 'video-container' id
			var subscriber = session.subscribe(event.stream, "video-container");
			console.log("Session subscribed");

			// When the HTML video has been appended to DOM...
			subscriber.on("videoElementCreated", (event) => {
				// updateNumVideos(1);
				console.log("Subscriber Video Element Created");
			});

			// When the HTML video has been appended to DOM...
			subscriber.on("videoElementDestroyed", (event) => {
				// Add a new HTML element for the user's name and nickname over its video
				// updateNumVideos(-1);
				console.log("Subscriber Video Element Destroyed");
			});

			// When the subscriber stream has started playing media...
			subscriber.on("streamPlaying", (event) => {
				console.log("Subscriber Stream Playing");
				numberOfStreamsPlaying = numberOfStreamsPlaying + 1;
				console.log(numberOfStreamsPlaying);
				// setTimeout(endMeeting, parseInt(DURATION));
				// if (RECORDING_AUDIO_ENABLED === "1") {
				// 	console.log("Recording Started");
				// 	startRecording();
				// }
			});
		});

		session.on("streamDestroyed", (event) => {
			console.log("streamDestroyed");
		});

		session.on("sessionDisconnected", (event) => {
			console.log("streamDestroyed");
			if (RECORDING_AUDIO_ENABLED === "1") {
				stopRecording();
				console.log("Recording Stopped");
			}
			$("#join").hide();
			$("#session").hide();
			$("#endmeeting").show();
		});

		session.on("recordingStarted", (event) => {});

		session.on("recordingStopped", (event) => {});

		// On every asynchronous exception...
		session.on("exception", (exception) => {
			console.warn(exception);
		});

		// Connect to the session passing the retrieved token and some more data from
		//   the client (in this case a JSON with the nickname chosen by the user)

		session
			.connect(token)
			.then(() => {
				handler = setInterval(function () {
					// Check every 1 second if required number of participants joined the meeting
					fetchNumberofconnections(function (session_info) {
						if (
							session_info.session_details.connections.numberOfElements >=
							parseInt(REQUIRED_PARTICIPANTS)
						) {
							clearInterval(handler);
							handler = 0;
							meeting_start_time = session_info.meeting_start_time;
							$("#session-title").text(sessionName);
							$("#join").hide();
							$("#session").show();
							$("#endmeeting").hide();
							$("#permission").hide();
							$("#permission-denied").hide();

							//Get our camera stream
							publisher = OV.initPublisher("video-container", {
								audioSource: undefined, // The source of audio. If undefined default microphone
								videoSource: undefined, // The source of video. If undefined default webcam
								publishAudio: true, // Whether you want to start publishing with your audio unmuted or not
								publishVideo: VIDEO_ENABLED === "1", // Whether you want to start publishing with your video enabled or not
								resolution: RESOLUTION, // The resolution of your video
								frameRate: FRAME_RATE, // The frame rate of your video
								insertMode: "APPEND", // How the video is inserted in the target element 'video-container'
								mirror: true, // Whether to mirror your local video or not
							});

							//Specify the actions when events take place in our publisher
							// When the publisher stream has started playing media...
							publisher.on("accessAllowed", (event) => {});

							publisher.on("accessDenied", (event) => {});

							publisher.on("accessDialogOpened", (event) => {});

							publisher.on("accessDialogClosed", (event) => {});

							// When the publisher stream has started playing media...
							publisher.on("streamCreated", (event) => {});

							// When our HTML video has been added to DOM...
							publisher.on("videoElementCreated", (event) => {
								// updateNumVideos(1);
								$(event.element).prop("muted", true); // Mute local video
								numberOfStreamsPlaying = numberOfStreamsPlaying + 1;
								internalHandler = setInterval(function () {
									if (numberOfStreamsPlaying >= parseInt(REQUIRED_PARTICIPANTS)) {
										clearInterval(internalHandler);
										if (RECORDING_AUDIO_ENABLED === "1") {
											console.log("Recording started");
											startRecording();
										} else {
											setTimeout(endMeeting, parseInt(DURATION));
										}
									}
								}, 1000);
							});

							// When the HTML video has been appended to DOM...
							publisher.on("videoElementDestroyed", (event) => {
								// Add a new HTML element for the user's name and nickname over its video
								// updateNumVideos(-1);
							});

							// When the publisher stream has started playing media...
							publisher.on("streamPlaying", (event) => {
								console.log("Publisher Stream playing");
							});

							//Set Streamid
							publisher.stream.streamId =
								ROOM_ID + "_" + ROOM_NAME + "_" + meeting_start_time;
							console.log(publisher.stream.streamId);

							//Publish your stream
							session.publish(publisher);
							console.log("Stream Published");
						} else {
							console.log("Waiting for users");
						}
					});
				}, 1000);
			})
			.catch((error) => {
				console.warn(
					"There was an error connecting to the session:",
					error.code,
					error.message
				);
			});
		return false;
	});
};

//-----------------------------RECORDING API-----------------------------------------------------
//Recording - Start
// function startRecording(event) {
//     recorder.disableLogs = true
//     recorder.addStream(event.element.srcObject);
//     recorder.mediaType = {
//         recorderType: RecordRTC.StereoAudioRecorder,
//         audio: RECORDING_AUDIO_ENABLED === '1',
//         video: RECORDING_VIDEO_ENABLED === '1',

//     };
//     recorder.mimeType = {
//         audio: 'audio/wav',
//         video: 'video/webm',
//         disableLogs: true,
//     };
//     console.log("recording started");
//     recorder.startRecording();
// }

function startRecording() {
	var outputMode = "COMPOSED";
	var hasAudio = RECORDING_AUDIO_ENABLED === "1";
	var hasVideo = RECORDING_VIDEO_ENABLED === "1";

	localRecorder = OV.initLocalRecorder(publisher.stream);
	var localRecordIdArray = localRecorder.id.split("_");

	localRecorder.id = [
		[ROOM_ID, ROOM_NAME, meeting_start_time].join("_"),
		[
			localRecordIdArray[localRecordIdArray.length - 3],
			localRecordIdArray[localRecordIdArray.length - 2],
			localRecordIdArray[localRecordIdArray.length - 1],
		].join("_"),
	].join("___");
	localRecorder.record("video/webm;codecs=vp9");
	console.log("Local recording started");

	httpRequest(
		"POST",
		"api/recording/start",
		{
			session: session.sessionId,
			outputMode: outputMode,
			hasAudio: hasAudio,
			hasVideo: hasVideo,
		},
		"Something went wring. Could not initialize remote reording.",
		(res) => {
			console.log("Remote recording started");
			sessionID = res.id;
			setTimeout(endMeeting, parseInt(DURATION));
			//$("#textarea-http").text(JSON.stringify(res, null, "\t"));
		}
	);
}

//Recording - Stop
// function stopRecording() {
// 	recorder.stopRecording(function () {
// 		var blobs =
// 			RECORDING_VIDEO_ENABLED === "1" ? recorder.getBlob().video : recorder.getBlob().audio;
// 		userID = Math.floor(Math.random() * 9000);
// 		getSeekableBlob(blobs, function (seekable_blob) {
// 			var formData = new FormData();
// 			formData.append("blob", seekable_blob, "test_video");
// 			formData.append("blob_type", "video");
// 			formData.append("userId", userID);
// 			formData.append("roomId", ROOM_ID);
// 			formData.append("meeting_start_time", meeting_start_time);
// 			formData.append("transcriptionEnabled", TRANSCRIPTION_ENABLED);

// 			console.log("sending video " + userID);

// 			transcription("/transcription/start", formData, function () {
// 				console.log("Video successfully uploaded!");
// 			});
// 		});
// 	});
// }

function stopRecording() {
	// var forceRecordingId = sessionID;
	// httpRequest(
	// 	"POST",
	// 	"api/recording/stop",
	// 	{
	// 		recording: forceRecordingId,
	// 	},
	// 	"Stop recording WRONG",
	// 	(res) => {
	// 		console.log(res);
	// 		$("#textarea-http").text(JSON.stringify(res, null, "\t"));
	// 	}
	// );

	if (!recordingStopped) {
		if (localRecorder.state == "RECORDING") {
			localRecorder.stop().then((res) => {
				localRecorder.download();
			});
		} else if (localRecorder.state == "FINISHED") {
			localRecorder.download();
		}
		recordingStopped = true;
	}
}

function deleteRecording(recordingid) {
	console.log(recordingid);
	httpRequest(
		"DELETE",
		"api/recording/delete",
		{
			recording: recordingid,
		},
		"Delete recording WRONG",
		(res) => {
			console.log("DELETE ok");
			$("delete-status").text("Recording deleted successfully");
		}
	);
}

//Call Transcription Function
async function transcription(url, data, callback) {
	var request = new XMLHttpRequest();
	request.onreadystatechange = function () {
		if ((request.readyState == 4 ** request.status) == 200) {
			callback(location.href + request.responseText);
		}
	};
	// request.setRequestHeader('Access-Control-Allow-Origin', '*')
	request.open("POST", "https://sophie.ovgu.de/videoapp/transcription/start", true);
	request.send(data);
}

// ---------------------- End RECORDING API --------------------------

// ---------------------- SESSION API -----------------------------------
function leaveSession() {
	//Leave the session by calling 'disconnect' method over the Session object ---
	session.disconnect();
}

//End Meeting
function endMeeting() {
	if (RECORDING_AUDIO_ENABLED === "1") stopRecording();

	closeSession();
}

//get Token (identification of each client in the session)
function getToken(callback) {
	httpRequest(
		"POST",
		"api/get-token",
		{
			sessionName: sessionName,
		},
		"Request of TOKEN gone WRONG:",
		(res) => {
			token = res[0]; // Get token from response
			callback(token); // Continue the join operation
		}
	);
}

//Remove User from Session
function removeUser() {
	httpRequest(
		"POST",
		"api/remove-user",
		{
			sessionName: sessionName,
			token: token,
		},
		"User couldn't be removed from session",
		(res) => {
			console.warn("You have been removed from session " + sessionName);
		}
	);
}

//close session
function closeSession() {
	httpRequest(
		"DELETE",
		"api/close-session",
		{
			sessionName: sessionName,
		},
		"Session couldn't be closed",
		(res) => {
			console.warn("Session " + sessionName + " has been closed");
		}
	);
}

//fetch Info about the current session - Used for getting the number of user currently connected
function fetchNumberofconnections(callback) {
	session_info = 0;
	httpRequestSync(
		"POST",
		"api/fetch-info",
		{
			sessionName: sessionName,
		},
		"Session couldn't be fetched",
		(res) => {
			session_info = res;
		}
	);
	callback(session_info);
}
// ---------------------- END SESSION API -----------------------------------

function httpRequest(method, url, body, errorMsg, callback) {
	var http = new XMLHttpRequest();
	http.open(method, url, true);
	http.setRequestHeader("Content-type", "application/json");
	http.addEventListener("readystatechange", processRequest, false);
	http.send(JSON.stringify(body));

	function processRequest() {
		if (http.readyState == 4) {
			if (http.status == 200) {
				try {
					callback(JSON.parse(http.responseText));
				} catch (e) {
					callback(e);
				}
			} else {
				console.warn(errorMsg + " (" + http.status + ")");
				console.warn(http.responseText);
			}
		}
	}
}

function httpRequestSync(method, url, body, errorMsg, callback) {
	var http = new XMLHttpRequest();
	http.open(method, url, false);
	http.setRequestHeader("Content-type", "application/json");
	http.addEventListener("readystatechange", processRequest, false);
	http.send(JSON.stringify(body));

	function processRequest() {
		if (http.readyState == 4) {
			if (http.status == 200) {
				try {
					callback(JSON.parse(http.responseText));
				} catch (e) {
					callback(e);
				}
			} else {
				console.warn(errorMsg + " (" + http.status + ")");
				console.warn(http.responseText);
			}
		}
	}
}

events = "";

window.onbeforeunload = function () {
	// Gracefully leave session
	if (session) {
		if (RECORDING_AUDIO_ENABLED === "1") stopRecording();
		removeUser();
		leaveSession();
	}
};

// function updateNumVideos(i) {
//     numVideos += i;
//     $('video').removeClass();
//     switch (numVideos) {
//         case 1:
//             $('video').addClass('two');
//             break;
//         case 2:
//             $('video').addClass('two');
//             break;
//         case 3:
//             $('video').addClass('three');
//             break;
//         case 4:
//             $('video').addClass('four');
//             break;
//     }
// }

function permissionDenied() {
	$("#join").hide();
	$("#session").hide();
	$("#endmeeting").hide();
	$("#permission").hide();
	$("#permission-denied").show();
}
