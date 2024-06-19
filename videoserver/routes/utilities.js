/* CONFIGURATION */
var moment = require("moment");

var OpenVidu = require("openvidu-node-client").OpenVidu;
var OpenViduRole = require("openvidu-node-client").OpenViduRole;
var config = require("../config/config");
const logger = require("../config/logger");
var mysql = require("mysql2");
var fs = require("fs");
const HttpStatus = require("http-status-codes");
const Busboy = require("busboy");
const { default: PQueue } = require("p-queue");
const path = require("path");

var connection = mysql.createPool(config.DB_CONNECTION);

// Environment variable: URL where our OpenVidu server is listening
var OPENVIDU_URL = config.OPENVIDU_URL;
logger.info(OPENVIDU_URL);
// Environment variable: secret shared with our OpenVidu server
var OPENVIDU_SECRET = config.OPENVIDU_SECRET;

// Entrypoint to OpenVidu Node Client SDK
var OV = new OpenVidu(OPENVIDU_URL, OPENVIDU_SECRET);

// Collection to pair session names with OpenVidu Session objects
var mapSessions = {};
// Collection to pair session names with tokens
var mapSessionNamesTokens = {};

var meetingDetails = {};

var sessionList = [];

class SessionManager {
    constructor(sessionName, joinId) {
        this.sessionName = sessionName;
        this.joinId = joinId;
        this.createdAt = Date.now();
    }
}

function countSessionRequests(sessionName) {
    return sessionList.filter((session) => session.sessionName === sessionName)
        .length;
}

function checkSessionRequests(sessionName, joinId) {
    return sessionList.find(
        (session) =>
            session.sessionName === sessionName && session.joinId === joinId
    );
}

function removeSessionRequests(sessionName, joinId = -1, res = null) {
    if (joinId > 0)
        sessionList = sessionList.filter(
            (session) =>
                session.sessionName !== sessionName && session.joinId !== joinId
        );
    else
        sessionList = sessionList.filter(
            (session) => session.sessionName !== sessionName
        );
    if (res) sendResponse(res, 200, "Removed session requests");
}

function getToken(sessionName, sessionDuration, res) {
    logger.info("Getting a token | {sessionName}={" + sessionName + "}");

    sessionObject = new SessionManager(
        sessionName,
        countSessionRequests(sessionName) + 1
    );

    sessionList.push(sessionObject);

    logger.debug("Session List: " + JSON.stringify(sessionList, null, 2));

    if (sessionObject.joinId == 1) {
        newSession(sessionName, res);
    } else {
        if (sessionObject.joinId > 1) {
            if (mapSessions[sessionName]) {
                sessionObjectFirst = checkSessionRequests(sessionName, 1);
                timeDiff = Date.now() - sessionObjectFirst.createdAt;
                // If the previous session was started more than 30 seconds
                // plus the session duration, remove the session requests
                timeBuffer = parseInt(sessionDuration) + 30000;
                if (timeDiff > timeBuffer) {
                    removeSessionRequests(sessionName, sessionObject.joinId);
                    sendResponse(
                        res,
                        303,
                        "Session not yet created. Please try again in a moment."
                    );
                } else {
                    existingSession(sessionName, res);
                }
            } else {
                removeSessionRequests(sessionName, sessionObject.joinId);
                sendResponse(
                    res,
                    303,
                    "Session not yet created. Please try again in a moment."
                );
            }
        }
    }
}

function newSession(sessionName, res) {
    // New session
    logger.info("New session " + sessionName);

    // Role associated to this user
    var role = OpenViduRole.PUBLISHER;

    // Build connectionProperties object with PUBLISHER role
    var connectionProperties = {
        role: role,
    };

    // Create a new OpenVidu Session asynchronously
    OV.createSession()
        .then((session) => {
            // Store the new Session in the collection of Sessions
            mapSessions[sessionName] = session;
            logger.info(
                "New session created: " + mapSessions[sessionName].sessionId
            );
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
                    sendResponse(
                        res,
                        500,
                        "Error connecting to the new session: " + error.message
                    );
                    removeSessionRequests(sessionName);
                });
        })
        .catch((error) => {
            sendResponse(res, 500, "Error creating session: " + error.message);
        });
}

function existingSession(sessionName, res) {
    logger.info("Existing session " + mapSessions[sessionName].sessionId);

    // Get the existing Session from the collection
    var mySession = mapSessions[sessionName];

    logger.debug("Active connections: " + mySession.activeConnections.length);

    // Role associated to this user
    var role = OpenViduRole.PUBLISHER;

    // Build connectionProperties object with PUBLISHER role
    var connectionProperties = {
        role: role,
    };

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
            sendResponse(
                res,
                500,
                "Error connecting to an existing session: " + error.message
            );
            removeSessionRequests(sessionName);
            delete mapSessions[sessionName];
            delete mapSessionNamesTokens[sessionName];
        });
}

function removeUser(sessionName, token, res) {
    // If the session exists
    if (mapSessions[sessionName] && mapSessionNamesTokens[sessionName]) {
        var tokens = mapSessionNamesTokens[sessionName];
        var index = tokens.indexOf(token);

        // If the token exists
        if (index !== -1) {
            // Token removed
            tokens.splice(index, 1);
            logger.info(sessionName + ": " + tokens.toString());
        } else {
            var msg = "Problems in the app server: the TOKEN wasn't valid";
            res.status(500).send(msg);
        }
        if (tokens.length == 0) {
            // Last user left: session must be removed
            logger.info(sessionName + " empty!");
            delete mapSessions[sessionName];
            if (mapSessionNamesTokens[sessionName]) {
                delete mapSessionNamesTokens[sessionName];
                updateMeeting(sessionName, "NOT STARTED")
                    .then(() => delete meetingDetails[sessionName])
                    .catch((error) =>
                        logger.crit(
                            "Error updating meeting status after removing all users - " +
                                error
                        )
                    );
            }
        }
        res.status(200).send();
    } else {
        var msg =
            "Problems in the app server: the TOKEN or session does not exist";
        res.status(500).send(msg);
    }
}

function closeSession(sessionName, res) {
    // If the session exists
    if (mapSessions[sessionName]) {
        var session = mapSessions[sessionName];
        try {
            session.close();
        } catch (error) {
            logger.crit("Error closing session - " + error);
        }
        delete mapSessions[sessionName];
        if (mapSessionNamesTokens[sessionName]) {
            delete mapSessionNamesTokens[sessionName];
            updateMeeting(sessionName, "NOT STARTED")
                .then(() => delete meetingDetails[sessionName])
                .catch((error) =>
                    logger.crit(
                        "Error updating meeting status after closing session - " +
                            error
                    )
                );
        }
        removeSessionRequests(sessionName);
        res.status(200).send();
    } else {
        res.status(400).send("Meeting does not exist");
    }
}

function fetchSessionInfo(sessionName, res) {
    var numberRequiredParticipants =
        meetingDetails[sessionName]["number_of_participants"];

    // If the session exists
    if (mapSessions[sessionName]) {
        mapSessions[sessionName]
            .fetch()
            .then((changed) => {
                var meeting_start_time = null;
                // logger.info("Any change: " + changed);
                if (
                    mapSessions[sessionName].activeConnections.length >=
                    numberRequiredParticipants
                ) {
                    logger.info("updating Meeting");
                    meeting_start_time = moment()
                        .utc()
                        .format("YYYY-MM-DD HH:mm:ss");
                    updateMeeting(sessionName, "IN PROGRESS")
                        .then((message) => logger.info(message))
                        .catch((error) =>
                            logger.crit(
                                "Error updating meeting status after starting meeting - " +
                                    error
                            )
                        );

                    logMeetingSession(
                        sessionName,
                        mapSessions[sessionName].sessionId,
                        meeting_start_time,
                        0
                    )
                        .then((message) => logger.info(message))
                        .catch((error) =>
                            logger.crit(
                                "Error logging meeting session - " + error
                            )
                        );

                    updateMeetingSession(
                        sessionName,
                        mapSessions[sessionName].sessionId
                    )
                        .then((message) => logger.info(message))
                        .catch((error) =>
                            logger.crit(
                                "Error updating meeting session - " + error
                            )
                        );
                }
                res.status(200).send({
                    session_details: sessionToJson(mapSessions[sessionName]),
                    meeting_start_time: meeting_start_time,
                });
            })
            .catch((error) => res.status(400).send(error.message));
    } else {
        var msg = "Problems in the app server: the SESSION does not exist";
        logger.info(msg);
        res.status(500).send(msg);
    }
}

function fetchAllActiveSessions(res) {
    OV.fetch()
        .then((changed) => {
            var sessions = [];
            OV.activeSessions.forEach((s) => {
                sessions.push(sessionToJson(s));
            });
            logger.info("Any change: " + changed);
            res.status(200).send(sessions);
        })
        .catch((error) => res.status(400).send(error.message));
}

function startRemoteRecording(sessionId, recordingProperties, res) {
    OV.startRecording(sessionId, recordingProperties)
        .then((recording) => res.status(200).send(recording))
        .catch((error) => res.status(400).send(error.message));
}

function stopRemoteRecording(recordingId, res) {
    OV.stopRecording(recordingId)
        .then((recording) => res.status(200).send(recording))
        .catch((error) => res.status(400).send(error.message));
}

function getMeetingDetails(session_name, render_page, res) {
    getResults(session_name, function (err, rows) {
        if (err != null) {
            res.render("InvalidMeeting.ejs", {
                data: "Something went wrong. Please Check Logs",
            });
        } else {
            [is_valid, message] = checkIfMeetingisValid(rows);
            if (!is_valid) {
                res.render("InvalidMeeting.ejs", { data: message });
            } else {
                meetingDetails[session_name] = rows;
                logger.info(rows);
                res.render(render_page, {
                    data: { roomId: session_name, roomDetails: rows },
                    localRecording: {
                        upload: config.UPLOAD_LOCAL_RECORDING,
                        download: config.DOWNLOAD_LOCAL_RECORDING,
                    },
                });
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
            logger.crit("Error connecting to Database ", error);
            return callback(err, null);
        }
        connection.query(
            getResultsQuery,
            [session_name],
            function (err, rows, fields) {
                if (err) {
                    logger.crit("Error while fetching data from database", err);
                    return callback(err, null);
                }
                return callback(null, rows[0]);
            }
        );
        connection.release();
    });
}

function checkIfMeetingisValid(rows) {
    if (typeof rows === "undefined" || rows === null) {
        return [false, "Meeting Not Found"];
    }
    if (rows.status == "COMPLETED") {
        return [false, "Meeting Already Used. Please Create a New Meeting"];
    }
    return [true, null];
}

let updateMeeting = (meeting_id, status) => {
    let updateMeetingQuery = "";
    updateMeetingQuery = "update video_app_room set status =? where room_id=?";

    return new Promise((resolve, reject) => {
        connection.getConnection((error, connection) => {
            if (error) reject(error);
            else {
                connection.query(
                    updateMeetingQuery,
                    [status, meeting_id],
                    (err, result) => {
                        if (err) reject(err);
                        else
                            resolve(
                                "Update Meeting: " +
                                    result.affectedRows +
                                    " record(s) updated"
                            );
                    }
                );
            }
            connection.release();
        });
    });
};

let logMeetingSession = (
    room_id,
    session_id,
    meeting_start_time,
    is_recorded
) => {
    const logMeetingSessionQuery =
        "insert into `video_app_room_history` (`room_id`, `session_id`, `meeting_start_time`, `is_recorded`, `duration`, `frame_rate`, `is_audio_enabled`, `is_recording_audio_enabled`, `is_recording_video_enabled`, `is_video_enabled`, `number_of_participants`, `resolution`, `room_name`) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";

    return new Promise((resolve, reject) => {
        connection.getConnection((error, connection) => {
            if (error) reject(error);
            else {
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
                        if (err) {
                            if (err.code === "ER_DUP_ENTRY") {
                                resolve("Entry already added in the table");
                            } else {
                                reject(err);
                            }
                        } else
                            resolve(
                                "Log Session: " +
                                    result.affectedRows +
                                    " record(s) updated"
                            );
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
                logger.info(updateMeetingSessionQuery);
                connection.query(
                    updateMeetingSessionQuery,
                    [room_id, session_id],
                    (err, result) => {
                        if (err) reject(err);
                        else
                            resolve(
                                "Update Session: " +
                                    result.affectedRows +
                                    " record(s) updated"
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
    json.defaultRecordingProperties =
        session.properties.defaultRecordingProperties;
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

function uploadLocalRecording(req, res) {
    const busboy = Busboy({
        headers: req.headers,
    });
    const workQueue = new PQueue({ concurrency: 1 });

    async function handleError(fn) {
        workQueue.add(async () => {
            try {
                await fn();
            } catch (e) {
                req.unpipe(busboy);
                workQueue.pause();
                logger.crit("Busboy error - " + e);
            }
        });
    }

    busboy.on("field", (name, value) => {
        handleError(() => {
            logger.info("Field Name - " + name);
            logger.info("Field Value - " + value);
        });
    });

    busboy.on("file", function (fieldname, file, filename, encoding, mimetype) {
        handleError(() => {
            file.on("data", function (data) {
                // logger.info('File [' + fieldname + '] got ' + data.length + ' bytes');
            });
            file.on("end", function () {
                logger.info("File upload finished - " + filename.filename);
            });
            var saveTo = path.join(
                config.LOCAL_RECORDING_FOLDER,
                filename.filename
            );
            if (fs.existsSync(config.LOCAL_RECORDING_FOLDER)) {
                var outStream = fs.createWriteStream(saveTo);
                file.pipe(outStream);
            } else {
                throw Error("Save Folder does not exist!");
            }
        });
    });

    busboy.on("finish", function () {
        handleError(() => {
            res.writeHead(HttpStatus.OK, {
                Connection: "close",
            });
            res.end("That's all folks!");
        });
    });
    return req.pipe(busboy);
}

function sendResponse(res, status, message) {
    if (status == 200) {
        logger.info("Response: " + message);
    } else if (status > 300 && status < 400) {
        logger.warn("Response: " + message);
    } else {
        logger.crit("Response: " + message);
    }

    try {
        res.status(status).send(message);
    } catch (error) {
        logger.crit("Error sending response to client: " + error);
    }
}

exports.getToken = getToken;
exports.removeUser = removeUser;
exports.closeSession = closeSession;
exports.fetchSessionInfo = fetchSessionInfo;
exports.fetchAllActiveSessions = fetchAllActiveSessions;
exports.getMeetingDetails = getMeetingDetails;
exports.startRemoteRecording = startRemoteRecording;
exports.stopRemoteRecording = stopRemoteRecording;
exports.uploadLocalRecording = uploadLocalRecording;
exports.removeSessionRequests = removeSessionRequests;
