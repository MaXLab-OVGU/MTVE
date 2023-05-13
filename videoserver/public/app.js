var OV;
var session;

var sessionName;
var sessionID;
var token;
// var numVideos = 0;
var handler = 0;
// var recorder = new MRecordRTC();
var meeting_start_time = null;
var publisher;
var localRecorder;
var recordingStopped = false;
var userLeft = false;
var sessionDisconnected = false;
var numberOfStreamsPlaying = 0;
var startTime;
var fileName;

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
    $("#recordingMessageSuccess").hide();
    $("#recordingMessageError").hide();
    sessionName = ROOM_ID;
    console.log(sessionName);

    getToken(() => {
        //Get an OpenVidu object ---
        OV = new OpenVidu();

        OV.setAdvancedConfiguration({
            noStreamPlayingEventExceptionTimeout: 20000,
        });
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
                console.log("Subscriber Video Element Created");
            });

            // When the HTML video has been appended to DOM...
            subscriber.on("videoElementDestroyed", (event) => {
                // Add a new HTML element for the user's name and nickname over its video
                console.log("Subscriber Video Element Destroyed");
            });

            // When the subscriber stream has started playing media...
            subscriber.on("streamPlaying", (event) => {
                console.log("Subscriber Stream Playing");
                numberOfStreamsPlaying = numberOfStreamsPlaying + 1;
                console.log(numberOfStreamsPlaying);
            });
        });

        session.on("streamDestroyed", (event) => {
            console.log("Stream Destroyed");
        });

        session.on("sessionDisconnected", (event) => {
            console.log("streamDestroyed");
            if (RECORDING_AUDIO_ENABLED === "1") {
                stopLocalRecording();
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
                            session_info.session_details.connections
                                .numberOfElements >=
                            parseInt(REQUIRED_PARTICIPANTS)
                        ) {
                            clearInterval(handler);
                            handler = 0;
                            meeting_start_time =
                                session_info.meeting_start_time;
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
                                $(event.element).prop("muted", true); // Mute local video
                                if (RECORDING_AUDIO_ENABLED === "1") {
                                    startRemoteRecording();
                                }
                                numberOfStreamsPlaying =
                                    numberOfStreamsPlaying + 1;
                                internalHandler = setInterval(function () {
                                    if (
                                        numberOfStreamsPlaying >=
                                        parseInt(REQUIRED_PARTICIPANTS)
                                    ) {
                                        clearInterval(internalHandler);
                                        if (RECORDING_AUDIO_ENABLED === "1") {
                                            startLocalRecording();
                                        } else {
                                            setTimeout(
                                                endMeeting,
                                                parseInt(DURATION)
                                            );
                                        }
                                    }
                                }, 1000);
                            });

                            // When the HTML video has been appended to DOM...
                            publisher.on("videoElementDestroyed", (event) => {
                                console.log("Video Element Destroyed");
                            });

                            // When the publisher stream has started playing media...
                            publisher.on("streamPlaying", (event) => {
                                console.log("Publisher Stream playing");
                            });

                            //Set Streamid
                            fileName =
                                ROOM_ID +
                                "_" +
                                ROOM_NAME +
                                "_" +
                                meeting_start_time;

                            fileName = fileName.replace(/:/g, "_");

                            publisher.stream.streamId = fileName;

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
function startRemoteRecording() {
    var outputMode = "COMPOSED";
    var hasAudio = RECORDING_AUDIO_ENABLED === "1";
    var hasVideo = RECORDING_VIDEO_ENABLED === "1";

    httpRequest(
        "POST",
        "api/recording/start",
        {
            session: session.sessionId,
            outputMode: outputMode,
            hasAudio: hasAudio,
            hasVideo: hasVideo,
        },
        "Something went wrong. Could not initialize remote reording.",
        (res) => {
            console.log("Remote recording started");
            sessionID = res.id;
        }
    );
}

function startLocalRecording() {
    // Initialize localRecorder
    localRecorder = OV.initLocalRecorder(publisher.stream);

    // Update the recording name
    var localRecordIdArray = localRecorder.id.split("_");
    localRecorder.id = [
        fileName,
        [
            localRecordIdArray[localRecordIdArray.length - 3],
            localRecordIdArray[localRecordIdArray.length - 2],
            localRecordIdArray[localRecordIdArray.length - 1],
        ].join("_"),
    ].join("___");

    // Start recording
    localRecorder.record("video/webm;codecs=vp9");
    startTime = Date.now();
    console.log("Local recording started");
    setTimeout(endMeeting, parseInt(DURATION));
}

//Recording - Stop
function stopLocalRecording() {
    if (!recordingStopped) {
        if (localRecorder.state == "RECORDING") {
            localRecorder.stop().then((res) => {
                console.log("Local Recording stopped");
                saveLocalRecording();
            });
        } else if (localRecorder.state == "FINISHED") {
            saveLocalRecording();
        }
        recordingStopped = true;
    }
}

function saveLocalRecording() {
    buggyBlob = localRecorder.getBlob();
    videoDuration = Date.now() - startTime;

    console.log("Fixing Local recorded video");

    ysFixWebmDuration(buggyBlob, videoDuration, { logger: false }).then(
        function (fixedBlob) {
            localRecorder.blob = fixedBlob;
            if (DOWNLOAD_LOCAL_RECORDING == "true") {
                console.log("Downloading fixed video");
                localRecorder.download();
            }
            if (UPLOAD_LOCAL_RECORDING == "true") {
                console.log("Uploading fixed video");
                localRecorder
                    .uploadAsMultipartfile("/meeting/api/recording/save")
                    .then((data) => {
                        console.log(data);
                        $("#recordingMessageSuccess").show();
                    })
                    .catch((err) => {
                        console.log(err);
                        $("#recordingMessageError").show();
                    });
            }
        }
    );
}

// ---------------------- End RECORDING API --------------------------

// ---------------------- SESSION API -----------------------------------
function leaveSession() {
    //Leave the session by calling 'disconnect' method over the Session object ---
	if (!sessionDisconnected) {
		session.disconnect();
	}
	sessionDisconnected = true;
}

//End Meeting
function endMeeting() {
    if (RECORDING_AUDIO_ENABLED === "1") stopLocalRecording();
	closeSession(sessionName);
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

	if (!userLeft) {
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
	userLeft = true;
    
}

//close session
function closeSession(sessionName) {
    $("#endMeetingSuccess").hide();
    $("#endMeetingError").hide();

    httpRequest(
        "DELETE",
        "api/close-session",
        {
            sessionName: sessionName,
        },
        "Session couldn't be closed",
        (res) => {
            $("#endMeetingSuccess").show();
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
        if (RECORDING_AUDIO_ENABLED === "1") stopLocalRecording();
        removeUser();
        leaveSession();
    }
};

function permissionDenied() {
    $("#join").hide();
    $("#session").hide();
    $("#endmeeting").hide();
    $("#permission").hide();
    $("#permission-denied").show();
}
