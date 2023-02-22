import os

MODEL_TYPE = "openai"  # ['openai', 'vosk']
# If you want to use the vosk model, make sure the required models are present in the MODEL_PATH_VOSK
# Refer https://alphacephei.com/vosk/models
MODEL_NAME_OPENAI = "base"  # ['tiny.en', 'tiny', 'base.en', 'base', 'small.en', 'small', 'medium.en', 'medium', 'large']
MODEL_PATH_VOSK = os.path.join(
    "Models", "vosk-model-small-de-0.15"
)  # path of the vosk model, ignore if using openai
SOURCE_FOLDER_PATH = "video_files"  # path of the folder containing audio/video files
TRANSCRIPTION_OUTPUT_PATH = "transcription_output"  # path to store the transcriptions

# Supported Audio/Video formats
SUPPORTED_FROMATS = [".webm", ".wav", ".mp4"]

# Transcription Language code, examples ['en', 'de']
# Set None for auto detection
TRANSCRIPTION_LANGUAGE = 'de'