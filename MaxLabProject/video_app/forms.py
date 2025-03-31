from django import forms
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.forms import UserCreationForm
from django.forms import fields
from django.forms.fields import EmailField
from django.forms.widgets import Select

from .models import Account, Room

AUDIO_VIDEO = [("av", "av"), ("a", "a"), ("nr", "nr")]

RESOLUTION_VALUES = [
    ("640x480", "640x480"),
    ("1280x720", "1280x720"),
    ("1920x1080", "1920x1080"),
    ("3840x2160", "3840x2160"),
]


def valid_email_domain(email):
    valid_doms = settings.ALLOWED_EMAIL_DOMAINS
    for val in valid_doms:
        if email.endswith(val):
            return True
    return False


class RegistrationForm(UserCreationForm):
    email = forms.EmailField(
        max_length=100, help_text="Required. Add a valid email address"
    )

    class Meta:
        model = Account
        fields = ("email", "username", "password1", "password2")

    def clean_email(self):
        email = self.cleaned_data["email"]
        if not valid_email_domain(email):
            raise forms.ValidationError(
                "Invalid email. Domain name should be among - "
                + str(settings.ALLOWED_EMAIL_DOMAINS)
            )
        return email


class AccountAuthenticationForm(forms.ModelForm):
    password = forms.CharField(label="password", widget=forms.PasswordInput)

    class Meta:
        model = Account
        fields = ("email", "password")

    def clean(self):
        if self.is_valid():
            email = self.cleaned_data["email"]
            password = self.cleaned_data["password"]
            auth = authenticate(email=email, password=password)
            if not auth:
                raise forms.ValidationError(
                    "Invalid email/password or Please make sure you have activated you account."
                )


class AccountUpdateFrom(forms.ModelForm):
    class Meta:
        model = Account
        fields = ("email", "username")

    def clean_email(self):
        if self.is_valid():
            email = self.cleaned_data["email"]
            if not valid_email_domain(email):
                raise forms.ValidationError(
                    "Invalid email. Domain name should be among - "
                    + str(settings.ALLOWED_EMAIL_DOMAINS)
                )
            try:
                account = Account.objects.exclude(pk=self.instance.pk).get(email=email)
            except Account.DoesNotExist:
                return email
            raise forms.ValidationError(f" Email {email} is already in use")

    def clean_usernamme(self):
        if self.is_valid():
            username = self.cleaned_data["username"]
            try:
                account = Account.objects.exclude(pk=self.instance.pk).get(
                    username=username
                )
            except Account.DoesNotExist:
                return username
            raise forms.ValidationError(f" Username {username} is already in use")


class RoomForm(forms.ModelForm):
    communication = forms.CharField(widget=forms.Select(choices=AUDIO_VIDEO))
    recording = forms.CharField(widget=forms.Select(choices=AUDIO_VIDEO))
    room_id = forms.CharField(required=False)
    resolution = forms.CharField(widget=forms.Select(choices=RESOLUTION_VALUES))

    class Meta:
        model = Room
        fields = (
            "room_name",
            "number_of_participants",
            "duration",
            "resolution",
            "frame_rate",
            "communication",
            "recording",
            "room_id",
        )
