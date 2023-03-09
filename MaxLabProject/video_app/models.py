from random import randint

from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from datetime import datetime


class MyAccountManager(BaseUserManager):
    def create_user(self, email, username, password=None):
        if not email:
            raise ValueError("user must have an email address")
        if not username:
            raise ValueError("user must have an username")

        user = self.model(
            # convert to lower case character
            email=self.normalize_email(email),
            username=username,
        )

        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username, password):
        user = self.create_user(
            # convert to lower case character
            email=self.normalize_email(email),
            username=username,
            password=password,
        )
        user.is_admin = True
        user.is_staff = True
        user.is_active = True
        user.is_superuser = True
        user.save(using=self._db)
        return user


class Account(AbstractBaseUser):
    email = models.EmailField(verbose_name="email",
                              max_length=100, unique=True)
    username = models.CharField(max_length=100, unique=True)
    date_joined = models.DateTimeField(
        verbose_name='date joined', auto_now_add=True)
    last_login = models.DateTimeField(verbose_name='last login', auto_now=True)
    is_admin = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=True)
    is_active = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', ]

    objects = MyAccountManager()

    def __str__(self) -> str:
        return self.email

    def has_perm(self, perm, obj=None):
        return self.is_admin

    def has_module_perms(self, app_label):
        return True


class Room(models.Model):
    room_id = models.AutoField(primary_key=True)
    room_name = models.CharField(max_length=250)
    username = models.CharField(max_length=250)
    email = models.EmailField(max_length=250)
    number_of_participants = models.IntegerField(default=2)
    duration = models.IntegerField(default=30)
    resolution = models.CharField(max_length=10, default='640x480')
    frame_rate = models.IntegerField(default=30)
    date_created = models.DateTimeField(
        verbose_name='date created', auto_now_add=True)
    is_audio_enabled = models.BooleanField(default=True)
    is_video_enabled = models.BooleanField(default=True)
    is_recording_audio_enabled = models.BooleanField(default=True)
    is_recording_video_enabled = models.BooleanField(default=True)
    status = models.CharField(max_length=100, default="NOT STARTED")
    meeting_start_time = models.DateTimeField(default=datetime.now, blank=True)
    is_deleted = models.BooleanField(default=False)

    def __str__(self) -> str:
        return f"{self.room_name} with {self.number_of_participants} participants for {self.duration} mins {self.is_recording_audio_enabled} {self.is_recording_video_enabled}"

class Room_History(models.Model):
    room_id = models.ForeignKey(Room, db_column='room_id', on_delete=models.CASCADE)
    room_name = models.CharField(max_length=250, default='Exp')
    number_of_participants = models.IntegerField(default=2)
    duration = models.IntegerField(default=30)
    resolution = models.CharField(max_length=10, default='640x480')
    frame_rate = models.IntegerField(default=30)
    session_id = models.CharField(max_length=50, blank=False, unique=True)
    meeting_start_time = models.DateTimeField(default=datetime.now)
    is_audio_enabled = models.BooleanField(default=True)
    is_video_enabled = models.BooleanField(default=True)
    is_recording_audio_enabled = models.BooleanField(default=True)
    is_recording_video_enabled = models.BooleanField(default=True)
    is_recorded = models.BooleanField(default=False)

    def __str__(self) -> str:
        return f"{self.room_id} with {self.session_id} session_id at {self.meeting_start_time}"