import os
import shutil
from os.path import basename
from pathlib import Path
from zipfile import ZipFile


class download_utility:
    BASE_DIR = "/home/maxlab-conference/meeting_recordings/"

    def __init__(
        self, room_id, type=None, no_of_participants=None, force_download=False
    ):
        self.path = self.BASE_DIR + room_id
        self.room_id = room_id
        self.type = type
        self.no_of_participants = no_of_participants
        self.force_download = force_download
        self.text_type = "Recordings" if type == "video" else "Transcriptions"

    def getZipFile(self):
        ext = None
        fileList = []
        print(self.type)
        if self.type == "video":
            ext = "webm"
        else:
            ext = ".txt"

        # check if Path Exists
        if not os.path.isdir(self.path):
            return "Recordings Not Found", None, None

        # check If all the recordings/transcription are present
        for root, directories, files in os.walk(self.path):
            for filename in files:
                if filename.endswith(ext):
                    fileList.append(os.path.join(root, filename))

        # check if zip file exists:
        if os.path.isfile(f"{self.path}/{self.room_id}_{self.text_type}.zip"):
            with ZipFile(
                f"{self.path}/{self.room_id}_{self.text_type}.zip", "r"
            ) as zipObj:
                listOfiles = zipObj.namelist()
                print(len(listOfiles), len(fileList), self.no_of_participants)
                if len(listOfiles) >= self.no_of_participants:
                    print("inside")
                    return (
                        None,
                        f"{self.path}/{self.room_id}_{self.text_type}.zip",
                        f"{self.room_id}_{self.text_type}.zip",
                    )

                if (
                    len(listOfiles) >= len(fileList)
                    and len(fileList) >= self.no_of_participants
                ):
                    print("inside2")
                    return (
                        None,
                        f"{self.path}/{self.room_id}_{self.text_type}.zip",
                        f"{self.room_id}_{self.text_type}.zip",
                    )
            os.remove(f"{self.path}/{self.room_id}_{self.text_type}.zip")

        if len(fileList) < self.no_of_participants and self.force_download is False:
            return (
                f"Not all the {self.text_type} are present for the room {self.room_id}. Do you wish to proceed with download ?",
                None,
                None,
            )

        with ZipFile(f"{self.path}/{self.room_id}_{self.text_type}.zip", "w") as zip:
            for filename in fileList:
                zip.write(filename, basename(filename))

        return (
            None,
            f"{self.path}/{self.room_id}_{self.text_type}.zip",
            f"{self.room_id}_{self.text_type}.zip",
        )

    def deleteRecordings(self):
        dirpath = Path(self.path)
        if dirpath.exists():
            shutil.rmtree(dirpath)
