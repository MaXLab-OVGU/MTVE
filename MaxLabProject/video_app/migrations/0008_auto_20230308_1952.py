# Generated by Django 3.2.6 on 2023-03-08 18:52

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('video_app', '0007_auto_20221211_0125'),
    ]

    operations = [
        migrations.AlterField(
            model_name='room',
            name='duration',
            field=models.IntegerField(default=30),
        ),
        migrations.AlterField(
            model_name='room_history',
            name='duration',
            field=models.IntegerField(default=30),
        ),
    ]
