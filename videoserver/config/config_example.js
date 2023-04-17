// Change the filename to config.js after making the required changes
// Check the current environment
const env = process.env.MEETINGS_APP_ENV; // 'dev' or 'prod'
exports.PORT = 5000;

exports.OPENVIDU_URL = "https://openvidu.domain.com/";
exports.OPENVIDU_SECRET = "GENERATED_KEY"; // Same as the one provided in the openvidu instance

if (env == "prod") {
	exports.OPENVIDU_KEY_FILE = "privkey.pem";
	exports.OPENVIDU_CERT_FILE = "cert.pem";

	// Local Recording config
	// If local recording is enabled, then how to handle the recordings
	exports.DOWNLOAD_LOCAL_RECORDING = false;
	exports.UPLOAD_LOCAL_RECORDING = true;

	exports.DB_CONNECTION = {
		connectionLimit: 100,
		host: "localhost",
		user: "DB_USER",
		password: "DB_PASSWORD",
		database: "DB_NAME",
		multipleStatements: true,
	};
} else {
	exports.OPENVIDU_KEY_FILE = "privkey.pem";
	exports.OPENVIDU_CERT_FILE = "cert.pem";

	// Local Recording config
	// If local recording is enabled, then how to handle the recordings
	exports.DOWNLOAD_LOCAL_RECORDING = false;
	exports.UPLOAD_LOCAL_RECORDING = true;

	exports.DB_CONNECTION = {
		connectionLimit: 100,
		host: "localhost",
		user: "DB_USER",
		password: "DB_PASSWORD",
		database: "DB_NAME",
		multipleStatements: true,
	};
}
