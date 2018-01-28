#!/bin/sh

cd /home/pi/temp

API_KEY=`cat /home/pi/kubjaringi/apikey.txt`
HOST="https://kubjaringi.herokuapp.com"
curl ${HOST}/file-upload -X POST -F temperatures=@temperatures.rrd -F "apikey=$API_KEY"