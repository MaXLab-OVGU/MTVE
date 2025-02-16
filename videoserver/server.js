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
const config = require("./config/config");
const logger = require("./config/logger");

// Import routes
const meetingRoutes = require("./routes/meeting");
const recordingRoutes = require("./routes/recording");

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

app.use("/", meetingRoutes);
app.use("/", recordingRoutes);

// Listen (start app with node server.js)
var options = {
    key: fs.readFileSync(config.OPENVIDU_KEY_FILE),
    cert: fs.readFileSync(config.OPENVIDU_CERT_FILE),
};
https.createServer(options, app).listen(config.PORT, '0.0.0.0', () => {
    logger.info("App listening on port " + config.PORT);
});
