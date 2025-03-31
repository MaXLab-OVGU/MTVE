/* CONFIGURATION */

// Node imports
var express = require("express");
var fs = require("fs");
var https = require("https");
var bodyParser = require("body-parser"); // Pull information from HTML POST (express4)
const dotenv = require("dotenv");
const fixWebmDuration = require("fix-webm-duration");
const path = require("path");

// Initializing app and config
var app = express(); // Create our app with express
dotenv.config();

// Custom imports
// const config = require("./config/config");
const logger = require("./config/logger");
const { getVideoHeight, getVideoWidth } = require('./utils');

// Import routes
const meetingRoutes = require("./routes/meeting");
const recordingRoutes = require("./routes/recording");

// Height Width calculations for video frames
app.locals.videoHeight = getVideoHeight;
app.locals.videoWidth = getVideoWidth;

app.set("view engine", "ejs");
app.use("/meeting/static", express.static(path.join(__dirname, "public")));
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

// Routes
app.use("/", meetingRoutes);
app.use("/", recordingRoutes);

// Start the server
app.listen(5000, () => {
    logger.info("App listening on port 5000");
});
