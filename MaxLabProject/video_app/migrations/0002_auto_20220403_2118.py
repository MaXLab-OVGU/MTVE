# Generated by Django 2.2.5 on 2022-04-03 19:18

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('video_app', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='room',
            name='room_id',
            field=models.AutoField(primary_key=True, serialize=False),
        ),
    ]