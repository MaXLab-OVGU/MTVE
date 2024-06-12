const express = require("express");
const router = express.Router();
const utils = require("./utilities");
const logger = require("../config/logger");

/* Recording API */
// Timelog Middleware
router.use((req, res, next) => {
    next();
});

// Start recording
router.post("/meeting/api/recording/start", function (req, res) {
    // Retrieve params from POST body
    var sessionId = req.body.session;
    var recordingProperties = {
        outputMode: req.body.outputMode,
        hasAudio: req.body.hasAudio,
        hasVideo: req.body.hasVideo,
        resolution: req.body.resolution,
        frameRate: parseInt(req.body.frameRate),
    };
    logger.info("Starting recording | {sessionId}=" + sessionId);

    utils.startRemoteRecording(sessionId, recordingProperties, res);
});

// Stop recording
router.post("/meeting/api/recording/stop", function (req, res) {
    // Retrieve params from POST body
    var recordingId = req.body.recording;
    logger.info("Stopping recording | {recordingId}=" + recordingId);

    utils.stopRemoteRecording(sessionId, recordingProperties, res);
});

// Save recording
// Endpoint to handle video file uploads
router.post("/meeting/api/recording/save", function (req, res) {
    logger.info("File Upload Api");
    utils.uploadLocalRecording(req, res);
});

module.exports = router;
