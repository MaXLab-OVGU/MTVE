import os
import datetime
import json
from datetime import datetime
import pandas as pd
import config

# Vosk specific imports
from vosk import Model, KaldiRecognizer, SetLogLevel
from pydub import AudioSegment
import wave

# Openai specific imports
import whisper
from stable_whisper import modify_model


# Get model
def get_vosk_model(model_path):
    # Verify the model and audio path
    if not os.path.exists(model_path):
        print("Model path does not exist")
        return None

    # Read Vosk Model
    print(f"Reading your vosk model '{model_path}'...")
    try:
        model = Model(model_path)
    except:
        print("Failed to create a model")
        return None

    return model


def mono_wav(audio_folder_path, input_file_name, skip=0):
    # Create tmp path
    if not os.path.isdir(os.path.join(audio_folder_path, "tmp")):
        os.mkdir(os.path.join(audio_folder_path, "tmp"))

    # Set input and output paths
    source = os.path.join(audio_folder_path, input_file_name)
    output_path = os.path.join(
        audio_folder_path,
        "tmp",
        os.path.splitext(input_file_name)[0]
        + datetime.now().strftime("_%Y%m%d_%H%M%S")
        + ".wav",
    )

    # Perform conversion
    filename, file_extension = os.path.splitext(source)
    sound = AudioSegment.from_file(source, format=file_extension[1:])  # load source
    sound = sound.set_channels(1)  # mono
    sound = sound.set_frame_rate(16000)  # 16000Hz

    audio = sound[skip * 1000 :]
    outputfile = audio.export(output_path, format="wav", codec="pcm_s16le")

    outputfile.close()

    return output_path


def generate_vosk_transcription(filepath, filename, model):
    # open audio file
    wf = wave.open(filepath, "rb")

    rec = KaldiRecognizer(model, wf.getframerate())

    # To store our results
    transcription = []

    rec.SetWords(True)

    while True:
        data = wf.readframes(5000)
        if len(data) == 0:
            break
        if rec.AcceptWaveform(data):
            # Convert json output to dict
            result_dict = json.loads(rec.Result())
            # Extract text values and append them to transcription list
            if result_dict.get("text", "") != "":
                transcription.append(
                    [
                        filename,
                        result_dict.get("text", ""),
                        result_dict.get("result", "")[0].get("start", ""),
                        result_dict.get("result", "")[-1].get("end", ""),
                    ]
                )

    # Get final bits of audio and flush the pipeline
    final_result = json.loads(rec.FinalResult())
    if final_result.get("text", "") != "":
        transcription.append(
            [
                filename,
                final_result.get("text", ""),
                final_result.get("result", "")[0].get("start", ""),
                final_result.get("result", "")[-1].get("end", ""),
            ]
        )

    return transcription


def get_openai_model(model_name="base"):
    # initialize model
    print(f"Initializing openai's '{model_name}'model")
    if model_name in [
        "tiny.en",
        "tiny",
        "base.en",
        "base",
        "small.en",
        "small",
        "medium.en",
        "medium",
        "large",
    ]:
        try:
            model = whisper.load_model(model_name)
            # Using the stable whisper to modifiy the model for better timestamps accuracy
            modify_model(model)
        except:
            print("Unable to initialize openai model")
            return None
    else:
        print(
            "Model  not found; available models = ['tiny.en', 'tiny', 'base.en', 'base', 'small.en', 'small', 'medium.en', 'medium', 'large']"
        )
        return None

    return model


def generate_openai_transcription(source_folder_path, filename, model):
    filepath = os.path.join(source_folder_path, filename)

    if config.TRANSCRIPTION_LANGUAGE is None:
        output = model.transcribe(filepath)
    else:
        decode_options = dict(language=config.TRANSCRIPTION_LANGUAGE)
        transcribe_options = dict(task="transcribe", **decode_options)
        output = model.transcribe(filepath, **transcribe_options)

    transcription = []

    for s in output["segments"]:
        transcription.append([filename, s["text"].strip(), s["start"], s["end"]])

    return transcription


# To group together videos and assign speakers
def separate_filename(filename):
    fname = filename.split(".")[0]

    part_1 = "_".join(fname.split("_")[0:-3])
    part_2 = "_".join(fname.split("_")[-3:])

    if part_1 == "":
        part_1 = part_2

    return part_1, part_2


def group_videos(arr):
    name_dict = {}

    for name in arr:
        part_1, part_2 = separate_filename(name)

        if part_1 in name_dict:
            name_dict[part_1].append(part_2)
        else:
            name_dict[part_1] = [part_2]

    return name_dict


def assign_speaker(filename, name_dict):
    part_1, part_2 = separate_filename(filename)

    return "Speaker " + str(name_dict[part_1].index(part_2) + 1)


def generate_transcriptions_from_files(
    model_type="openai",
    model_name_openai="base",
    model_path_vosk="",
    source_folder_path="",
):
    if not os.path.exists(source_folder_path):
        print("Audio/Video folder path does not exist")
        return None

    if model_type == "openai":
        model = get_openai_model(model_name_openai)
    elif model_type == "vosk":
        model = get_vosk_model(model_path_vosk)
    else:
        model = None

    if model == None:
        print("Unable to get desired model")
        return None
    else:
        print("Model was successfully initialized")

    # Get audio/video files from the folder
    files = [
        f
        for f in os.listdir(source_folder_path)
        if os.path.isfile(os.path.join(source_folder_path, f))
        and os.path.splitext(f)[1] in config.SUPPORTED_FROMATS
    ]

    if len(files) == 0:
        print("No files to read in folder")
        return None

    # Generate transcriptions
    transcriptions = []
    for f in files:
        if model_type == "vosk":
            new_f = mono_wav(source_folder_path, f)
            transcriptions += generate_vosk_transcription(new_f, f, model)
        elif model_type == "openai":
            transcriptions += generate_openai_transcription(
                source_folder_path, f, model
            )

    df = pd.DataFrame(
        transcriptions, columns=["Filename", "Text", "Start time", "End time"]
    )

    # Group videos and assign speaker
    df["Conversation"] = df["Filename"].apply(lambda x: separate_filename(x)[0])
    df.sort_values(["Conversation", "Start time"], inplace=True)
    name_dict = group_videos(df["Filename"].unique())
    df["Speaker"] = df["Filename"].apply(lambda x: assign_speaker(x, name_dict))
    cols = ["Filename", "Conversation", "Speaker", "Text", "Start time", "End time"]
    df = df[cols]

    if not os.path.isdir(config.TRANSCRIPTION_OUTPUT_PATH):
        os.mkdir(config.TRANSCRIPTION_OUTPUT_PATH)

    df.to_excel(
        os.path.join(
            config.TRANSCRIPTION_OUTPUT_PATH,
            "transcription_output"
            + datetime.now().strftime("_%Y%m%d_%H%M%S")
            + ".xlsx",
        ),
        index=False,
    )

    print("Transcription completed")

    return transcriptions


model_type = config.MODEL_TYPE
model_name_openai = config.MODEL_NAME_OPENAI
model_path_vosk = config.MODEL_PATH_VOSK
source_folder_path = config.SOURCE_FOLDER_PATH

if (
    generate_transcriptions_from_files(
        model_type=model_type,
        model_name_openai=model_name_openai,
        model_path_vosk=model_path_vosk,
        source_folder_path=source_folder_path,
    )
    is None
):
    print("Failed to generate transcriptions")
