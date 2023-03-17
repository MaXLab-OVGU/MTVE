/* CONFIGURATION */

var OpenVidu = require("openvidu-node-client").OpenVidu;
var OpenViduRole = require("openvidu-node-client").OpenViduRole;

// Node imports
var express = require("express");
var moment = require("moment");
var mysql = require("mysql2");
var fs = require("fs");
var https = require("https");
var bodyParser = require("body-parser"); // Pull information from HTML POST (express4)
const dotenv = require("dotenv");
const fixWebmDuration = require("fix-webm-duration");

// Initializing app and config
var app = express(); // Create our app with express
dotenv.config();

// Custom imports
const config = require("./config/config");
const logger = require("./config/logger");

// Height Width calculations for video frames
app.locals.videoHeight = (NO_OF_PARTICIPANTS) => {
	if (NO_OF_PARTICIPANTS <= 2) {
		return 100;
	} else if (NO_OF_PARTICIPANTS <= 8) {
		return 50;
	} else {
		return 33.33;
	}
};

app.locals.videoWidth = (NO_OF_PARTICIPANTS) => {
	if (NO_OF_PARTICIPANTS == 1) {
		return 100;
	} else if (NO_OF_PARTICIPANTS <= 4) {
		return 50;
	} else if (NO_OF_PARTICIPANTS <= 6) {
		return 33.33;
	} else {
		return 25;
	}
};

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(
	bodyParser.urlencoded({
		extended: "true",
	})
); // Parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // Parse application/json
app.use(
	bodyParser.json({
		type: "application/vnd.api+json",
	})
); // Parse application/vnd.api+json as json

// Listen (start app with node server.js)
var options = {
	key: fs.readFileSync(config.OPENVIDU_KEY_FILE),
	cert: fs.readFileSync(config.OPENVIDU_CERT_FILE),
};
https.createServer(options, app).listen(config.PORT);
// Environment variable: URL where our OpenVidu server is listening
var OPENVIDU_URL = config.OPENVIDU_URL;
console.log(OPENVIDU_URL);
// Environment variable: secret shared with our OpenVidu server
var OPENVIDU_SECRET = config.OPENVIDU_SECRET;

// Entrypoint to OpenVidu Node Client SDK
var OV = new OpenVidu(OPENVIDU_URL, OPENVIDU_SECRET);

// Collection to pair session names with OpenVidu Session objects
var mapSessions = {};
// Collection to pair session names with tokens
var mapSessionNamesTokens = {};

var meetingDetails = {};

// console.log("App listening on port " + config.PORT);
logger.info("App listening on port " + config.PORT);

var connection = mysql.createPool(config.DB_CONNECTION);

/* Session API */
app.get("/meeting/:session", (req, res) => {
	if (req.params.session != "style.css") {
		getMeetingDetails(req.params.session, res);
	} else {
		res.render("index.ejs", { data: { roomId: req.params.session } });
	}
});
// Get token (add new user to session)
app.post("/meeting/api/get-token", function (req, res) {
	// The video-call to connect
	var sessionName = req.body.sessionName;

	// Role associated to this user
	var role = OpenViduRole.PUBLISHER;

	console.log("Getting a token | {sessionName}={" + sessionName + "}");

	// Build connectionProperties object with PUBLISHER role
	var connectionProperties = {
		role: role,
	};

	if (mapSessions[sessionName]) {
		// Session already exists
		console.log("Existing session " + sessionName);

		// Get the existing Session from the collection
		var mySession = mapSessions[sessionName];

		// Generate a new Connection asynchronously with the recently created connectionProperties
		mySession
			.createConnection(connectionProperties)
			.then((connection) => {
				// Store the new token in the collection of tokens
				mapSessionNamesTokens[sessionName].push(connection.token);
				// Return the token to the client
				res.status(200).send({
					0: connection.token,
				});
			})
			.catch((error) => {
				console.error(error);
				if (error.message === "404") {
					delete mapSessions[sessionName];
					delete mapSessionNamesTokens[sessionName];
					newSession(sessionName, connectionProperties, res);
				}
			});
	} else {
		newSession(sessionName, connectionProperties, res);
	}
});

function newSession(sessionName, connectionProperties, res) {
	// New session
	console.log("New session " + sessionName);

	console.log(meetingDetails[sessionName].is_recording_audio_enabled);

	// Create a new OpenVidu Session asynchronously
	OV.createSession()
		.then((session) => {
			// Store the new Session in the collection of Sessions
			mapSessions[sessionName] = session;
			// Store a new empty array in the collection of tokens
			mapSessionNamesTokens[sessionName] = [];

			// Generate a new connection asynchronously with the recently created connectionProperties
			session
				.createConnection(connectionProperties)
				.then((connection) => {
					// Store the new token in the collection of tokens
					mapSessionNamesTokens[sessionName].push(connection.token);

					// Return the Token to the client
					res.status(200).send({
						0: connection.token,
					});
				})
				.catch((error) => {
					console.error(error);
				});
		})
		.catch((error) => {
			console.error(error);
		});
}

// Remove user from session
app.post("/meeting/api/remove-user", function (req, res) {
	// Retrieve params from POST body
	var sessionName = req.body.sessionName;
	var token = req.body.token;
	console.log("Removing user | {sessionName, token}={" + sessionName + ", " + token + "}");

	// If the session exists
	if (mapSessions[sessionName] && mapSessionNamesTokens[sessionName]) {
		var tokens = mapSessionNamesTokens[sessionName];
		var index = tokens.indexOf(token);

		// If the token exists
		if (index !== -1) {
			// Token removed
			tokens.splice(index, 1);
			console.log(sessionName + ": " + tokens.toString());
		} else {
			var msg = "Problems in the app server: the TOKEN wasn't valid";
			res.status(500).send(msg);
		}
		if (tokens.length == 0) {
			// Last user left: session must be removed
			console.log(sessionName + " empty!");
			delete mapSessions[sessionName];
			if (mapSessionNamesTokens[sessionName]) {
				delete mapSessionNamesTokens[sessionName];
				updateMeeting(sessionName, "NOT STARTED")
					.then(() => delete meetingDetails[sessionName])
					.catch((error) => console.error(error));
			}
		}
		res.status(200).send();
	}
});

// Close session
app.delete("/meeting/api/close-session", function (req, res) {
	// Retrieve params from POST body
	var sessionName = req.body.sessionName;
	console.log("Closing session | {sessionName}=" + sessionName);

	// If the session exists
	if (mapSessions[sessionName]) {
		var session = mapSessions[sessionName];
		session.close();
		delete mapSessions[sessionName];
		if (mapSessionNamesTokens[sessionName]) {
			delete mapSessionNamesTokens[sessionName];
			updateMeeting(sessionName, "NOT STARTED")
				.then(() => delete meetingDetails[sessionName])
				.catch((error) => console.error(error));
		}
		res.status(200).send();
	}
});

/* Recording API */

// Start recording
app.post("/meeting/api/recording/start", function (req, res) {
	// Retrieve params from POST body
	var sessionId = req.body.session;
	var recordingProperties = {
		outputMode: req.body.outputMode,
		hasAudio: req.body.hasAudio,
		hasVideo: req.body.hasVideo,
		resolution: req.body.resolution,
		frameRate: parseInt(req.body.frameRate),
	};
	console.log("Starting recording | {sessionId}=" + sessionId);

	OV.startRecording(sessionId, recordingProperties)
		.then((recording) => res.status(200).send(recording))
		.catch((error) => res.status(400).send(error.message));
});

// Stop recording
app.post("/meeting/api/recording/stop", function (req, res) {
	// Retrieve params from POST body
	var recordingId = req.body.recording;
	console.log("Stopping recording | {recordingId}=" + recordingId);

	OV.stopRecording(recordingId)
		.then((recording) => res.status(200).send(recording))
		.catch((error) => res.status(400).send(error.message));
});

// Delete recording
app.get("/delete/:recordingId", (req, res) => {
	// if (req.params.session != "style.css") {
	// 	getMeetingDetails(req.params.session, res);
	// } else {
	// 	res.render("index.ejs", { data: { roomId: req.params.session } });
	// }
	res.render("delete.ejs", { data: { recordingId: req.params.recordingId } });
});

// Delete recording
app.delete("/api/recording/delete", function (req, res) {
	// Retrieve params from DELETE body
	var recordingId = req.body.recording;
	console.log("Deleting recording | {recordingId}=" + recordingId);

	OV.deleteRecording(recordingId)
		.then(() => res.status(200).send())
		.catch((error) => res.status(400).send(error.message));
});

// Fetch session info
app.post("/meeting/api/fetch-info", function (req, res) {
	// Retrieve params from POST body
	var sessionName = req.body.sessionName;
	var numberRequiredParticipants = meetingDetails[sessionName]["number_of_participants"];
	console.log("Fetching session info | {sessionName}=" + sessionName);

	// If the session exists
	if (mapSessions[sessionName]) {
		mapSessions[sessionName]
			.fetch()
			.then((changed) => {
				var meeting_start_time = null;
				console.log("Any change: " + changed);
				if (
					mapSessions[sessionName].activeConnections.length >= numberRequiredParticipants
				) {
					console.log("updating Meeting");
					meeting_start_time = moment().format("YYYY-MM-DD HH:mm:ss");
					updateMeeting(sessionName, "IN PROGRESS", meeting_start_time)
						.then((message) => console.log(message))
						.catch((error) => console.error(error));

					logMeetingSession(
						sessionName,
						mapSessions[sessionName].sessionId,
						meeting_start_time,
						0
					)
						.then((message) => console.log(message))
						.catch((error) => console.error(error));

					updateMeetingSession(sessionName, mapSessions[sessionName].sessionId)
						.then((message) => console.log(message))
						.catch((error) => console.error(error));
				}
				res.status(200).send({
					session_details: sessionToJson(mapSessions[sessionName]),
					meeting_start_time: meeting_start_time,
				});
			})
			.catch((error) => res.status(400).send(error.message));
	} else {
		var msg = "Problems in the app server: the SESSION does not exist";
		console.log(msg);
		res.status(500).send(msg);
	}
});

// Fetch all session info
app.get("/meeting/api/fetch-all", function (req, res) {
	console.log("Fetching all session info");
	OV.fetch()
		.then((changed) => {
			var sessions = [];
			OV.activeSessions.forEach((s) => {
				sessions.push(sessionToJson(s));
			});
			console.log("Any change: " + changed);
			res.status(200).send(sessions);
		})
		.catch((error) => res.status(400).send(error.message));
});

// Force disconnect
app.delete("/meeting/api/force-disconnect", function (req, res) {
	// Retrieve params from POST body
	var sessionName = req.body.sessionName;
	var connectionId = req.body.connectionId;
	// If the session exists
	if (mapSessions[sessionName]) {
		mapSessions[sessionName]
			.forceDisconnect(connectionId)
			.then(() => res.status(200).send())
			.catch((error) => res.status(400).send(error.message));
	} else {
		var msg = "Problems in the app server: the SESSION does not exist";
		console.log(msg);
		res.status(500).send(msg);
	}
});

// Force unpublish
app.delete("/meeting/api/force-unpublish", function (req, res) {
	// Retrieve params from POST body
	var sessionName = req.body.sessionName;
	var streamId = req.body.streamId;
	// If the session exists
	if (mapSessions[sessionName]) {
		mapSessions[sessionName]
			.forceUnpublish(streamId)
			.then(() => res.status(200).send())
			.catch((error) => res.status(400).send(error.message));
	} else {
		var msg = "Problems in the app server: the SESSION does not exist";
		console.log(msg);
		res.status(500).send(msg);
	}
});

app.put("/meeting/api/update-meeting-status", function (req, res) {
	updateMeeting(req.body.meeting_id, req.body.status)
		.then((message) => res.status(201).send(message))
		.catch((error) => res.status(500).send(error));
});

function checkIfMeetingisValid(rows) {
	if (typeof rows === "undefined" || rows === null) {
		return [false, "Meeting Not Found"];
	}
	if (rows.status == "COMPLETED") {
		return [false, "Meeting Already Used. Please Create a New Meeting"];
	}
	return [true, null];
}
function getMeetingDetails(session_name, res) {
	getResults(session_name, function (err, rows) {
		if (err != null) {
			res.render("InvalidMeeting.ejs", { data: "Something went wrong. Please Check Logs" });
		} else {
			[is_valid, message] = checkIfMeetingisValid(rows);
			if (!is_valid) {
				res.render("InvalidMeeting.ejs", { data: message });
			} else {
				meetingDetails[session_name] = rows;
				console.log(rows);
				res.render("index.ejs", { data: { roomId: session_name, roomDetails: rows } });
			}
		}
	});
}
function getResults(session_name, callback) {
	const getResultsQuery =
		"SELECT room_name," +
		"number_of_participants," +
		"duration," +
		"resolution," +
		"frame_rate," +
		"is_recording_audio_enabled," +
		"is_recording_video_enabled," +
		"is_video_enabled," +
		"status," +
		"is_audio_enabled " +
		"FROM   video_app_room " +
		"WHERE  room_id = ?";
	connection.getConnection((error, connection) => {
		if (error) {
			console.error("Error connecting to Database ", error);
			return callback(err, null);
		}
		connection.query(getResultsQuery, [session_name], function (err, rows, fields) {
			if (err) {
				console.error("Error while fetching data from database", err);
				return callback(err, null);
			}
			return callback(null, rows[0]);
		});
		connection.release();
	});
}
let updateMeeting = (meeting_id, status, meeting_start_time = null) => {
	let updateMeetingQuery = "";
	if (meeting_start_time != null) {
		updateMeetingQuery =
			"update video_app_room set status =?,meeting_start_time=?  where room_id=?";
	} else {
		updateMeetingQuery = "update video_app_room set status =? where room_id=?";
	}

	return new Promise((resolve, reject) => {
		connection.getConnection((error, connection) => {
			if (error) reject(error);
			else {
				if (meeting_start_time != null) {
					console.log(updateMeetingQuery);
					connection.query(
						updateMeetingQuery,
						[status, meeting_start_time, meeting_id],
						(err, result) => {
							if (err) reject(err);
							else
								resolve(
									"Update Meeting: " + result.affectedRows + " record(s) updated"
								);
						}
					);
				} else {
					connection.query(updateMeetingQuery, [status, meeting_id], (err, result) => {
						if (err) reject(err);
						else
							resolve(
								"Update Meeting: " + result.affectedRows + " record(s) updated"
							);
					});
				}
			}
			connection.release();
		});
	});
};

let logMeetingSession = (room_id, session_id, meeting_start_time, is_recorded) => {
	const logMeetingSessionQuery =
		"insert into `video_app_room_history` (`room_id`, `session_id`, `meeting_start_time`, `is_recorded`, `duration`, `frame_rate`, `is_audio_enabled`, `is_recording_audio_enabled`, `is_recording_video_enabled`, `is_video_enabled`, `number_of_participants`, `resolution`, `room_name`) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";

	return new Promise((resolve, reject) => {
		connection.getConnection((error, connection) => {
			if (error) reject(error);
			else {
				console.log(logMeetingSessionQuery);
				connection.query(
					logMeetingSessionQuery,
					[
						room_id,
						session_id,
						meeting_start_time,
						is_recorded,
						"1.0",
						"30",
						"1",
						"0",
						"0",
						"1",
						"2",
						"640x480",
						"Exp",
					],
					(err, result) => {
						if (err) reject(err);
						else resolve("Log Session: " + result.affectedRows + " record(s) updated");
					}
				);
			}
			connection.release();
		});
	});
};

let updateMeetingSession = (room_id, session_id) => {
	const updateMeetingSessionQuery =
		"UPDATE video_app_room_history T1 INNER JOIN video_app_room T2 SET T1.duration = T2.duration, T1.frame_rate=T2.frame_rate, T1.is_audio_enabled = T2.is_audio_enabled, T1.is_video_enabled = T2.is_video_enabled, T1.is_recording_audio_enabled = T2.is_recording_audio_enabled, T1.is_recording_video_enabled = T2.is_recording_video_enabled, T1.number_of_participants = T2.number_of_participants, T1.resolution = T2.resolution, T1.room_name = T2.room_name WHERE T2.room_id = ? AND T1.session_id = ?";

	return new Promise((resolve, reject) => {
		connection.getConnection((error, connection) => {
			if (error) reject(error);
			else {
				console.log(updateMeetingSessionQuery);
				connection.query(
					updateMeetingSessionQuery,
					[room_id, session_id],
					(err, result) => {
						if (err) reject(err);
						else
							resolve(
								"Update Session: " + result.affectedRows + " record(s) updated"
							);
					}
				);
			}
			connection.release();
		});
	});
};

function sessionToJson(session) {
	var json = {};
	json.sessionId = session.sessionId;
	json.createdAt = session.createdAt;
	json.customSessionId = !!session.properties.customSessionId
		? session.properties.customSessionId
		: "";
	json.recording = session.recording;
	json.mediaMode = session.properties.mediaMode;
	json.recordingMode = session.properties.recordingMode;
	json.defaultRecordingProperties = session.properties.defaultRecordingProperties;
	var connections = {};
	connections.numberOfElements = session.activeConnections.length;
	var jsonArrayConnections = [];
	session.activeConnections.forEach((con) => {
		var c = {};
		c.connectionId = con.connectionId;
		c.createdAt = con.createdAt;
		c.role = con.role;
		c.serverData = con.serverData;
		c.record = con.record;
		c.token = con.token;
		c.clientData = con.clientData;
		var pubs = [];
		con.publishers.forEach((p) => {
			jsonP = {};
			jsonP.streamId = p.streamId;
			jsonP.createdAt = p.createdAt;
			jsonP.hasAudio = p.hasAudio;
			jsonP.hasVideo = p.hasVideo;
			jsonP.audioActive = p.audioActive;
			jsonP.videoActive = p.videoActive;
			jsonP.frameRate = p.frameRate;
			jsonP.typeOfVideo = p.typeOfVideo;
			jsonP.videoDimensions = p.videoDimensions;
			pubs.push(jsonP);
		});
		var subs = [];
		con.subscribers.forEach((s) => {
			subs.push(s);
		});
		c.publishers = pubs;
		c.subscribers = subs;
		jsonArrayConnections.push(c);
	});
	connections.content = jsonArrayConnections;
	json.connections = connections;
	return json;
}
