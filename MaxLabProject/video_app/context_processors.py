from django.conf import settings  # import the settings file


def video_server(request):
    return {
        "VIDEO_SERVER_URL": settings.VIDEO_SERVER_URL,
        "OPENVIDU_SERVER_URL": settings.OPENVIDU_URL,
    }
