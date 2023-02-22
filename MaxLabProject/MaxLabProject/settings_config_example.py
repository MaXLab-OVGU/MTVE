# Rename the file to settings_config.py after making the necessary changes.

import environ

env = environ.Env()

# Environment specific settings
if env("MEETINGS_APP_ENV") == "prod":
    DEBUG = False  # Keep False for prod, True for dev

    SECRET_KEY = "ENTER A GENERATED SECRET KEY FOR PROD" # Generate a secret key and provide the same in the gunicorn.service file

    ALLOWED_HOSTS = ["example.domain.com"] # Domain name of the prod server

    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.mysql",
            "NAME": "DB_NAME",
            "USER": "DB_USER",
            "PASSWORD": "DB_PASSWORD",
            "HOST": "localhost",
            "PORT": "3306",
        }
    }

    VIDEO_SERVER_URL = "https://example.domain.com:5000/meeting/"

else:
    # Dev configurations to run on local system

    DEBUG = True # Keep False for prod, True for dev

    # SECRET_KEY = "ENTER A GENERATED SECRET KEY FOR DEV" # Not needed for dev systems

    ALLOWED_HOSTS = ["localhost"]

    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.mysql",
            "NAME": "DB_NAME",
            "USER": "DB_USER",
            "PASSWORD": "DB_PASSWORD",
            "HOST": "localhost",
            "PORT": "3306",
        }
    }

    VIDEO_SERVER_URL = "https://localhost:5000/meeting/"

# Email server configs
EMAIL_HOST = "mail.domain.com"
EMAIL_PORT = 123
EMAIL_USE_TLS = True
EMAIL_HOST_USER = "USERNAME"
EMAIL_HOST_PASSWORD = "PASSWORD"
DEFAULT_FROM_EMAIL = "DEFAULT_FROM_EMAIL"

# Openvidu server url
# Replace openvidu.domain.com with the domain of the server hosting the openvidu instance
# Keep the later part same, unless the recording location changed on the openvidu instance as well
OPENVIDU_URL = "https://openvidu.domain.com/openvidu/recordings/"

# Allowed domains
# Email Domains allowed to create user in application
ALLOWED_EMAIL_DOMAINS = ["@domain.com"]