const express = require("express");
const router = express.Router();
const utils = require("./utilities");
const logger = require("../config/logger");

// Timelog Middleware
router.use((req, res, next) => {
    // console.log("Time: ", Date.now());
    logger.info("Meeting API route");
    next();
});

/* Get and Verify meeting details */
router.get("/meeting/:session", (req, res) => {
    if (req.params.session != "style.css") {
        utils.getMeetingDetails(req.params.session, "index.ejs", res);
    } else {
        res.render("index.ejs", { data: { roomId: req.params.session } });
    }
});

// Get token (add new user to session)
router.post("/meeting/api/get-token", function (req, res) {
    // The video-call to connect
    var sessionName = req.body.sessionName;

    console.log("Getting a token | {sessionName}={" + sessionName + "}");

    utils.getToken(sessionName, res);
});

// Remove user from session
router.post("/meeting/api/remove-user", function (req, res) {
    // Retrieve params from POST body
    var sessionName = req.body.sessionName;
    var token = req.body.token;
    console.log(
        "Removing user | {sessionName, token}={" +
            sessionName +
            ", " +
            token +
            "}"
    );

    utils.removeUser(sessionName, token, res);
});

/* Manual Close Session API */
router.get("/meeting/end-meeting/:session", (req, res) => {
    res.render("endMeeting.ejs", { data: { roomId: req.params.session } });
});

// Close session
router.delete("/meeting/api/close-session", function (req, res) {
    // Retrieve params from POST body
    var sessionName = req.body.sessionName;
    console.log("Closing session | {sessionName}=" + sessionName);

    utils.closeSession(sessionName, res);
});

// Close session
router.delete("/meeting/end-meeting/api/close-session", function (req, res) {
    // Retrieve params from POST body
    var sessionName = req.body.sessionName;
    console.log("Closing session | {sessionName}=" + sessionName);

    utils.closeSession(sessionName, res);
});

// Fetch session info
router.post("/meeting/api/fetch-info", function (req, res) {
    // Retrieve params from POST body
    var sessionName = req.body.sessionName;
    console.log("Fetching session info | {sessionName}=" + sessionName);

    utils.fetchSessionInfo(sessionName, res);
});

// Fetch all session info
router.get("/meeting/api/fetch-all", function (req, res) {
    console.log("Fetching all session info");
    utils.fetchAllActiveSessions(res);
});

module.exports = router;
