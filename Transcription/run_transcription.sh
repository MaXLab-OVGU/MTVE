#!/bin/sh

PYTHON_ENVIORNMENT="transcription_env/bin"

PYTHON_TRANSCRIPTION_SCRIPT="transcription.py"

# Run transcription command

"$PYTHON_ENVIORNMENT"/python "$PYTHON_TRANSCRIPTION_SCRIPT" --model_name "$MODEL_NAME" --audio_file_path "$VIDEO_FILES_PATH"