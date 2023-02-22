![Logo](https://sophie.ovgu.de/static/images/MTV.svg)
# MTV - Magdeburg Tool for Videoconferences

MTV is a software tool (citeware) for economic experiments facilitating researchers to gather
video data from communication-based experiments in a way that these can be later used for
automatic analysis through machine learning techniques. 
It is developed by the Magdeburg Experimental Laboratory of Economic Research of the Otto von Guericke University Magdeburg (https://maxlab.ovgu.de/). If you have questions, please feel free to contact us: maxlab@ovgu.de.

When you report results of experiments conducted with MTV, the licence requires that you mention its use in your publication and cite our Working Paper. The correct citation is: 

> Bershadskyy, Dmitri, Sunil Ghadwal, and Jannik Greif.  "MTV-Magdeburg Tool for Videoconferences." Working Paper Series (2022).




## Getting help and reporting bugs

Please contribute your experience using MTV by sending us emails, or contacting us in case of problems.

If you find bugs or have a good idea about a feature, please use the Github issue tracker for this project or send us an email via maxlab@ovgu.de.
## Installation

The tutorial sets up the app on a server with domain name – videoapp.domain.com, with user – videoapp_user. 
Change the above two values from the locations below based on your setup. 

### Prerequisites

#### 1. Python 3.8
#### 2. MySQL [(Reference)](https://www.digitalocean.com/community/tutorials/how-to-install-mysql-on-ubuntu-20-04)

Follow the steps below to create user, database and grant access of that database to the user

```
mysql -u root -p 
CREATE USER 'username'@'localhost' IDENTIFIED BY 'username'; 
CREATE DATABASE database_name; 
GRANT ALL PRIVILEGES ON database_name.* TO 'username'@'localhost'; 
FLUSH PRIVILEGES; 
exit;
```

#### 3. Python virtualenv library
    
```
sudo apt install python3-virtualenv 
sudo apt-get install libmysqlclient-dev python3-dev 
python3 -m pip install --upgrade pip setuptools wheel 
```

#### 4. Nginx [(Reference)](https://www.digitalocean.com/community/tutorials/how-to-install-nginx-on-ubuntu-20-04)
Setting up Nginx
```
sudo apt update 
sudo apt install nginx
```
Adjusting Firewall
```
sudo ufw app list 
sudo ufw allow 'Nginx HTTP' 
sudo ufw allow 'Nginx HTTPS' 
sudo ufw allow 'OpenSSH' 
sudo ufw allow 5000 
sudo ufw allow 8000 
sudo ufw enable 
sudo ufw status
```
Managing Nginx
```
sudo systemctl start nginx 
sudo systemctl stop nginx
sudo systemctl restart nginx
sudo systemctl reload nginx
```

#### 5. SSL certificate [(Reference)](https://certbot.eff.org/instructions?ws=nginx&os=ubuntufocal)
[snapd](https://snapcraft.io/docs/installing-snapd) is preinstalled for Ubuntu 18.04 and above
```
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
sudo certbot --nginx
sudo certbot renew --dry-run
```
Add
```
return 301 https://$host$request_uri; 
``` 
to the default server configuration in the file etc/nginx/sites-enabled/default

#### 6. Setup Openvidu instance on a separate server [(Reference)](https://docs.openvidu.io/en/stable/deployment/ce/on-premises/)

#### 7. Nodejs
```
sudo apt install nodejs
```

#### 8. Npm
```
sudo apt install npm
```

#### 9. Pm2 npm package
```
npm install pm2 -g
```

### Setting up Project files
Create directory for project
```
mkdir Project_Home 
cd Project_Home 
mkdir logs 
```
Note: Creating the logs folder before starting gunicorn is crucial

Unzip the complete project in this folder. 
Place the following files in the specified locations. For config files, refer to the example files provided in the 
project.

| Filename           | Location                                                       | Comment                                                         |
|--------------------|----------------------------------------------------------------|-----------------------------------------------------------------|
| .env               | ~/Project_Home/MTV-main/MaxLabProject/               | Edit the file to specify whether the application is prod or dev |
| settings_config.py | ~/Project_Home/MTV-main/MaxLabProject/MaxLabProject/ | Config file for the Meetingsapp                                 |
| .env               | ~/Project_Home/MTV-main/videoserver/                 | Edit the file to specify whether the application is prod or dev |
| config.js          | ~/Project_Home/MTV-main/videoserver/config/          | Config file for the videoserver                                 |

### Setting up Meetings App
#### 1. Setup virutal environment
Create virtual env
```
cd ~/Project_Home/MTV-main/MaxLabProject/ 
virtualenv maxlabenv
```

Activate the virtual env
```
source maxlabenv/bin/activate
```

Execute the below command to install all the requirements
```
pip install -r requirements.txt
```

#### 2. Setup database and static files
```
python manage.py migrate 
python manage.py collectstatic
```

#### 3. To test the application
```
python manage.py runserver 0.0.0.0:8000
```
Check the URL: http://videoapp.domain.com:8000/ 
(The url will not have any static files(css, js, icons), just the basic login components.)

#### 4. Setup gunicorn
Create the file
```
vi /etc/systemd/system/gunicorn.socket
```
Paste the following content in the file and save it
```
[Unit]
Description=gunicorn socket

[Socket]
ListenStream=/run/gunicorn.sock

[Install]
WantedBy=sockets.target
```

Create the file
```
vi /etc/systemd/system/gunicorn.service
```
Paste the following content in the file and save it
```
[Unit]
Description=gunicorn daemon
Requires=gunicorn.socket
After=network.target

[Service]
Environment=SECRET_KEY= ENTER_A_GENERATED_SECRET_KEY_FOR_PROD
User=videoapp_user
Group=www-data
WorkingDirectory=/home/videoapp_user/Project_Home/MTV-main/MaxLabProject/
ExecStart=/home/videoapp_user/Project_Home/MTV-main/MaxLabProject/maxlabenv/bin/gunicorn \
          --access-logfile /home/videoapp_user/Project_Home/MTV-main/logs/gunicorn_access.log \
          --error-logfile /home/videoapp_user/Project_Home/MTV-main/logs/gunicorn_error.log \
          --workers 3 \
          --timeout 600 \
          --bind unix:/run/gunicorn.sock \
          MaxLabProject.wsgi:application

[Install]
WantedBy=multi-user.target
```

Changes in gunicorn.service:
- Secret key: same as the one in project settings_config.py
- User: The username of the user running the service
- WorkingDirectory: Home directory of the meetings app – MaxLabProject
- ExecStart: Location of gunicorn in virtualenv

Start and enable gunicorn
```
sudo systemctl start gunicorn.socket
sudo systemctl enable gunicorn.socket
```

To stop
```
sudo systemctl stop gunicorn.socket
```

Check gunicorn logs
```
sudo journalctl -u gunicorn
```

#### 5. Configure Nginx with gunicorn
Edit the default nginx file
```
vi /etc/nginx/sites-available/default
```
Replace the contents of the files with the following content
```
server {
    server_name videoapp.domain.com;
    location / {
        proxy_pass http://unix:/run/gunicorn.sock;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 100M;
        proxy_temp_file_write_size 64k;
        proxy_connect_timeout 10080s;
        proxy_send_timeout 10080s;
        proxy_read_timeout 10080s;
        add_header Access-Control-Allow-Origin *;
    }
    location /static/ {
        alias /home/videoapp_user/Project_Home/MTV-main/MaxLabProject/static/;
    }
    # The part below should already be present in the file, use that one instead
    listen [::]:443 ssl ipv6only=on; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/videoapp.domain.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/videoapp.domain.com/privkey.pem; # managed by
    Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = videoapp.domain.com) {
    return 301 https://$host$request_uri;
    } # managed by Certbot
    listen 80 ;
    listen [::]:80 ;
    server_name videoapp.domain.com;
    return 404; # managed by Certbot
}
```

Note : Change static folder location and server name in the file from all locations
Once done, you should be able to access the application on https://videoapp.domain.com, with all the static components as well.

Note: If the server is running, but the static files are not getting loaded with error 403:Forbidden, make sure that all directories leading upto the static folder have the read permission for external users (chmod 755).

### Setting up Videoserver
#### 1. Installing node moduls
```
cd ~/Project_Home/MTV-main/videoserver 
npm install
```
#### 2. Manage server
```
pm2 start server.js
pm2 stop server.js
pm2 restart server.js
```

### Setting up Transcription Utility
#### 1. Setup virtual environment
Create virtual env
```
cd ~/Project_Home/MTV-main/Transcription/
virtualenv transcription_env
```
Activate the virtual env
```
source transcription_env/bin/activate
```
Execute the below command to install all the requirements
```
pip install -r requirements.txt 
```
Install ffmpeg
```
sudo apt install ffmpeg 
```
#### 2. Steps to run the utility
- Place the required video files in the 'video_files' directory
- Run the 'run_transcription.sh' file to start the transcription process
- The results will be placed in the 'transcription_output' directory, in an excel file with the timestamp of the execution


## Limitations

### Transcription
The generated transcription output can contain errors regarding the correct sequence of conversations. This is caused by how the model determines the start and end time of each sequence. This can be fixed by manually going through the transcription and change the start time to the correct order and rearrange by start time. 

The transcription model is set to use German as default language. This can be changed in the `config.py ` located in the Transcription dictionary. The language can be set to a specific language or be detected dynamically. 

### Videocommunication

__Important:__ We are aware that one or more participants can be stuck on the waiting screen before the communication starts. This is caused by participants joining the room simultaneously. This can be fixed by refreshing the page for participants stuck on the waiting screen. This error can be bypassed by including short delays between participants, if the communication gets started automatically (see examples below).

The videocommunication can be set to different standard resolutions (640x480 to 3840x2160) and FPS (30 to 60). However, currently not every combination of resolution and FPS is possible. 60 FPS videos are only possible up to HD resolution (1280x720).

In order to locally download the individual recordings, the browser tab can not be closed before the videocommunication ended. 






## Examples

### oTree
This example showcases a communication between two participants. The communication open in a new browser tab, which is closed after 30 seconds and the participants can advance to the next page.
#### `__init__.py`
```python
from otree.api import *

class C(BaseConstants):
    NAME_IN_URL = 'MTV_Example'
    PLAYERS_PER_GROUP = 2
    NUM_ROUNDS = 1
    URL = 'meeting_url' #input meeting URL

class Subsession(BaseSubsession):
    pass         
class Group(BaseGroup):
    pass
class Player(BasePlayer):
    pass

### PAGES ###

class Wait(WaitPage):
    pass

class Communication(Page):
    @staticmethod
    def js_vars(player):
        return dict(url = C.URL, id = player.participant.id_in_session)

page_sequence = [Wait,Communication]

```

#### `Communication.html`
```html
{% extends "global/Page.html" %}
{% load otree static %}
{% block title %}
    Videocommunication 
{% endblock %}
{% block content %}
<script>
    var url = js_vars.url;
    var participant = js_vars.id;
    participant = 1 ? delay = 1000 : delay = 2000; 
    window.onload = function(){setTimeout(function(){startCommunication();},delay);};
    function showButton() { 
        document.getElementById("nextButton").style.display = "inline"; 
    }
    function startCommunication() {
        var newWindow = window.open(url);
        setTimeout(() => newWindow.close(),30000);
        setTimeout(() => showButton(),30000);
    }
</script>
<div id="nextButton" style="display:none">
    Please click "Next" once the video communication is finished.
    <br><br>
    {% next_button %}
</div>
{% endblock %}
```

### zTree
The videocommunication can be integrated into zTree by opening a browser tab using the external program function. The browser tab can be close the same way after a predefined time (i.e. a bit longer than the communication duration).
