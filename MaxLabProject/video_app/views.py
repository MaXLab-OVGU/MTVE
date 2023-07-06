from video_app.download_utility import download_utility
from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate, logout
from .forms import (
    AccountAuthenticationForm,
    RegistrationForm,
    CloneRoomForm,
    AccountUpdateFrom,
    CreateRoomForm,
    UpdateRoomForm,
)
from .models import Account, Room, Room_History
from django.urls import reverse
from django.core.mail import EmailMessage, message
from django.utils.encoding import force_bytes, force_text
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.contrib.sites.shortcuts import get_current_site
from .utils import token_generator
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from random import randint
from django.http import HttpResponse, Http404
from django.conf import settings
import ast
import logging

logger = logging.getLogger(__name__)


def home_screen_view(request):
    context = {}

    user = request.user

    if user.is_authenticated:
        logger.info("User already logged in. Redirecting to experiments page.")
        return redirect("experiments")

    if request.POST:
        form = AccountAuthenticationForm(request.POST)
        if form.is_valid():
            email = request.POST["email"]
            password = request.POST["password"]
            user = authenticate(email=email, password=password)

            if user:
                context = {"email": email}
                login(request, user)
                logger.info("User login successful. Redirecting to experiments page.")
                return redirect("experiments")

    else:
        logger.info("Accessing Login page")
        form = AccountAuthenticationForm()
    context["login_form"] = form
    return render(request, "new_accounts/login.html", context)


def registration_view(request):
    context = {}
    if request.POST:
        form = RegistrationForm(request.POST)
        if form.is_valid():
            account = form.save(commit=False)
            email = form.cleaned_data.get("email")
            account.save()
            email_to_send = generate_activation_email(request, account, email, "activate")
            email_to_notify = generate_activation_email(request, account, settings.NOTIFY_EMAILS, "new_user_notification")
            email_to_send.send(fail_silently=False)
            email_to_notify.send(fail_silently=False)
            
            context["success_message"] = "Please click on the link sent to your Email address for Account Activation"
            return render(request, "new_accounts/register.html", context)
        else:
            context["registration_form"] = form
    else:
        form = RegistrationForm()
        context["registration_form"] = form
    return render(request, "new_accounts/register.html", context)


def logout_view(request):
    logout(request)
    return redirect("home")


def account_view(request):
    if not request.user.is_authenticated:
        return redirect("home")

    context = {}

    if request.POST:
        username = request.user.username
        form = AccountUpdateFrom(request.POST, instance=request.user)
        if form.is_valid():
            form.initial = {
                "email": request.POST["email"],
                "username": request.POST["username"],
            }
            form.save()
            context["success_message"] = "Account Updated"
        else:
            request.user.username = username

    else:
        form = AccountUpdateFrom(
            initial={
                "email": request.user.email,
                "username": request.user.username,
            }
        )
    context["account_form"] = form
    return render(request, "accounts/account.html", context)


def experiments_view(request, message=None, roomid=None):
    context = {}

    if not request.user.is_authenticated:
        return redirect("home")
    context["email"] = request.user.email
    user = Account.objects.get(email=request.user.email)
    if user.is_admin:
        context["exps"] = Room.objects.order_by("-room_id").filter(is_deleted=False)
        context["admin"] = True
    else:
        context["exps"] = Room.objects.order_by("-room_id").filter(email=request.user.email, is_deleted=False)

    if message is not None:
        if message == "delete":
            context["deleteModalDisplay"] = True
            context["message"] = "Do you really wish to delete the meeting ?"
            context["delete_roomid"] = roomid
        else:
            context["modaldisplay"] = True
            context["message"] = message.split("!#!")[0]
            context["roomid"] = message.split("!#!")[1]
            context["type"] = message.split("!#!")[2]
    return render(request, "experiments/experiments.html", context)


def experiments_history_view(request, message=None, roomid=None):
    context = {}
    if not request.user.is_authenticated:
        return redirect("home")
    user = Account.objects.get(email=request.user.email)
    context["email"] = request.user.email
    if user.is_admin:
        context["exps_hist"] = Room_History.objects.order_by("-meeting_start_time").filter(room_id__is_deleted=False)
        context["admin"] = True
    else:
        context["exps_hist"] = Room_History.objects.order_by("-meeting_start_time").filter(
            room_id__email=request.user.email, room_id__is_deleted=False
        )
    return render(request, "experiments/experimentsHistory.html", context)


def verification_view(request, email, token):
    if request.method == "GET":
        try:
            decoded_email = force_text(urlsafe_base64_decode(email))
            user = Account.objects.get(email=decoded_email)
            if user.is_active:
                return redirect("home")

            if not token_generator.check_token(user, token):
                user.delete()
                return render(request, "new_accounts/activationFailure.html")

            user.is_active = True
            user.save()
        except Exception as e:
            return render(request, "new_accounts/error.html")

    return render(request, "new_accounts/activationSuccess.html")


def request_password_reset_email(request):
    context = {}
    if request.method == "GET":
        return render(request, "new_accounts/reset-password-email.html")

    if request.method == "POST":
        email = request.POST["email"]
        account = Account.objects.filter(email=email).first()
        if account:
            email_to_send = generate_activation_email(request, account, email, "request-reset-link")
            email_to_send.send(fail_silently=False)

        context[
            "success_message"
        ] = "If Email is present in our databse then a Password reset link has been sent to your email."
        return render(request, "new_accounts/reset-password-email.html", context)


def reset_user_password(request, email, token):
    if request.method == "GET":
        context = {"email": email, "token": token}
        user = Account.objects.get(email=force_text(urlsafe_base64_decode(email)))

        if not PasswordResetTokenGenerator().check_token(user, token):
            return render(request, "new_accounts/passwordFailure.html")
        else:
            return render(request, "new_accounts/reset-user-password.html", context)
    if request.method == "POST":
        user = Account.objects.get(email=force_text(urlsafe_base64_decode(email)))
        if PasswordResetTokenGenerator().check_token(user, token):
            context = {"email": email, "token": token}
            password1 = request.POST["password1"]
            password2 = request.POST["password2"]

            if password1 != password2:
                context["error_message"] = "Password do not match"
                return render(request, "new_accounts/reset-user-password.html", context)
            user.set_password(password1)
            user.save()
            context["success_message"] = "Password reset successfull. Please login with you new password"
            return render(request, "new_accounts/reset-user-password.html", context)
        else:
            return render(request, "new_accounts/passwordFailure.html")


def create_room_view(request):
    if not request.user.is_authenticated:
        return redirect("home")

    context = {}
    if request.method == "GET":
        return render(request, "experiments/createroom.html")

    if request.method == "POST":
        form = CreateRoomForm(request.POST)
        try:
            if form.is_valid():
                room = form.save(commit=False)
                room.email = request.user.email
                room.username = request.user.username

                # if request.POST['room_id'] == '':
                #     while True:
                #         room_id = generate_random_id()
                #         if not Room.objects.filter(room_id=room_id).exists():
                #             room.room_id = room_id
                #             break
                # else:
                #     room.room_id = request.POST['room_id']

                if request.POST["communication"] == "a":
                    room.is_video_enabled = False
                if request.POST["recording"] == "a":
                    room.is_recording_video_enabled = False
                if request.POST["recording"] == "nr":
                    room.is_recording_video_enabled = False
                    room.is_recording_audio_enabled = False

                room.save()
                context["success_message"] = "Room Created Successfully"
            else:
                context["room_form"] = form
        except Exception as e:
            raise
        return render(request, "experiments/createroom.html", context)


def csrf_failure(request, reason=""):
    return redirect("logout")


def generate_activation_email(request, account, email, type):
    domain = get_current_site(request).domain
    encoded_email = urlsafe_base64_encode(force_bytes(email))
    if type == "activate":
        link = reverse(
            type,
            kwargs={
                "email": encoded_email,
                "token": token_generator.make_token(account),
            },
        )
        email_subject = "MaxLab Account Activation"
        message = f"Hello {account.username}\n Please click on the link to activate your account\n"
        activate_url = "http://" + domain + link

        email_body = message + activate_url
        email_message = EmailMessage(
            subject=email_subject,
            body=email_body,
            to=[email],
        )
    elif type == "request-reset-link":
        link = reverse(
            "reset-user-password",
            kwargs={
                "email": encoded_email,
                "token": PasswordResetTokenGenerator().make_token(account),
            },
        )
        email_subject = "MaxLab Password Reset Link"
        message = f"Hello {account.username}\n Please click on the link to reset your password\n"
        activate_url = "http://" + domain + link

        email_body = message + activate_url
        email_message = EmailMessage(
            subject=email_subject,
            body=email_body,
            to=[email],
        )
    elif type == "new_user_notification":
        
        email_subject = "MaxLab New User Signed up"
        message = f"Hello,\nA new user {account.username} has just signed up on the Maxlab app.\n"
        activate_url = "http://" + domain

        email_body = message + activate_url
        email_message = EmailMessage(
            subject=email_subject,
            body=email_body,
            to=email,
        )

    return email_message


def download_view(request, type, roomid, force="False"):
    if not request.user.is_authenticated:
        return HttpResponse("Unauthorized Access", status=401)
    print("hurray===-=-=-=-=-=")
    force = False if force == "False" else True
    expObj = Room.objects.get(room_id=roomid)
    number_of_participants = expObj.number_of_participants
    filedownloadObj = download_utility(roomid, type, number_of_participants, force)
    message, zip_file_path, file_name = filedownloadObj.getZipFile()

    if message is not None:
        return redirect("experiments", message=f"{message}!#!{roomid}!#!{type}")

    zip_file = open(zip_file_path, "rb")
    response = HttpResponse(zip_file, content_type="application/zip")
    response["Content-Disposition"] = 'attachment; filename="%s"' % file_name
    return response


def editExp(request, room_id):
    if not request.user.is_authenticated:
        return redirect("home")
    expObj = Room.objects.get(room_id=room_id)
    if request.method == "POST":
        form = UpdateRoomForm(request.POST, instance=expObj)
        if form.is_valid():
            if request.POST["communication"] == "a":
                expObj.is_video_enabled = False
            else:
                expObj.is_video_enabled = True

            if request.POST["recording"] == "a":
                expObj.is_recording_video_enabled = False
                expObj.is_recording_audio_enabled = True
            if request.POST["recording"] == "nr":
                expObj.is_recording_video_enabled = False
                expObj.is_recording_audio_enabled = False
            if request.POST["recording"] == "av":
                expObj.is_recording_video_enabled = True
                expObj.is_recording_audio_enabled = True
            form.save()
            return redirect("experiments")
    return render(request, "experiments/editRoom.html", {"expObj": expObj})


def clone_meeting_view(request, room_id):
    if not request.user.is_authenticated:
        return redirect("home")
    expObj = Room.objects.get(room_id=room_id)
    if request.method == "POST":
        form = CloneRoomForm(request.POST)
        print(form)
        if form.is_valid():
            room = form.save(commit=False)
            room.email = request.user.email
            room.username = request.user.username

            # if request.POST['room_id'] == '':
            #     while True:
            #         room_id = generate_random_id()
            #         if not Room.objects.filter(room_id=room_id).exists():
            #             room.room_id = room_id
            #             break
            # else:
            #     room.room_id = request.POST['room_id']

            if request.POST["communication"] == "a":
                room.is_video_enabled = False
            if request.POST["recording"] == "a":
                room.is_recording_video_enabled = False
            if request.POST["recording"] == "nr":
                room.is_recording_video_enabled = False
                room.is_recording_audio_enabled = False

            room.save()
            return redirect("experiments")
    return render(request, "experiments/cloneRoom.html", {"expObj": expObj})


def delete_meeting_view(request, roomid, withrecording="False"):
    if not request.user.is_authenticated:
        return redirect("home")
    # deleting room
    Room.objects.filter(room_id=roomid).update(is_deleted=True)

    return redirect("experiments")
