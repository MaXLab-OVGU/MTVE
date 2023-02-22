import os

# Create logs folder if not exists

LOG_DIR_NAME = "logs"
LOG_FILE_NAME = "meetings_app.logs"
LOG_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    LOG_DIR_NAME,
)

if not os.path.isdir(LOG_DIR):
    os.mkdir(LOG_DIR)

if not os.path.isfile(os.path.join(LOG_DIR, LOG_FILE_NAME)):
    f = open(os.path.join(LOG_DIR, LOG_FILE_NAME), "x")
    f.close()


LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {
            "format": "{levelname} {asctime} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "null": {
            "level": "DEBUG",
            "class": "logging.NullHandler",
        },
        "logfile": {
            "level": "DEBUG",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": "../logs/meetings_app.logs",
            "maxBytes": 50000,
            "backupCount": 2,
            "formatter": "simple",
        },
        "console": {
            "level": "INFO",
            "class": "logging.StreamHandler",
            "formatter": "simple",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["logfile"],
            "propagate": True,
            "level": "WARN",
        },
        "django.request": {
            "handlers": ["logfile"],
            "level": "DEBUG",
            "propagate": True,
        },
        "django.db.backends": {
            "handlers": ["logfile"],
            "level": "INFO",
            "propagate": False,
        },
        "video_app": {
            "handlers": ["console", "logfile"],
            "level": "DEBUG",
        },
    },
}
