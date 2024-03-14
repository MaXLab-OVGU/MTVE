"""MaxLabProject URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/3.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import TemplateView

from video_app.views import (
    account_view,
    clone_meeting_view,
    create_room_view,
    delete_meeting_view,
    download_view,
    editExp,
    experiments_history_view,
    experiments_view,
    home_screen_view,
    logout_view,
    registration_view,
    request_password_reset_email,
    reset_user_password,
    verification_view,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", home_screen_view, name="home"),
    path("register/", registration_view, name="register"),
    path("logout/", logout_view, name="logout"),
    path("account/", account_view, name="account"),
    path("activate/<email>/<token>", verification_view, name="activate"),
    path(
        "request-reset-link/", request_password_reset_email, name="request-reset-link"
    ),
    path("experiments/", experiments_view, name="experiments"),
    path("experimentsHistory/", experiments_history_view, name="experimentsHistory"),
    path(
        "reset-user-password/<email>/<token>",
        reset_user_password,
        name="reset-user-password",
    ),
    path("create-room/", create_room_view, name="create-room"),
    path("download/<str:type>/<str:roomid>", download_view, name="download"),
    path(
        "download/<str:type>/<str:roomid>/<str:force>", download_view, name="download"
    ),
    re_path(
        r"^experiments/(?P<message>[\w|\W]+)/$", experiments_view, name="experiments"
    ),
    path("edit_room/<str:room_id>", editExp, name="edit_room"),
    path("clone_room/<str:room_id>", clone_meeting_view, name="clone_room"),
    path(
        "deleteRoom/<str:roomid>/<str:withrecording>",
        delete_meeting_view,
        name="delete",
    ),
    path(
        "experiments/<str:message>/<str:roomid>", experiments_view, name="experiments"
    ),
]
