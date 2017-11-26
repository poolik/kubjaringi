#!/bin/sh

cd /home/pi/temp

API_KEY=`cat /home/pi/ingliste/apikey.txt`
HOST="https://ingliste.herokuapp.com"
curl ${HOST}/file-upload -X POST -F temperatures=@temperatures.rrd -F "apikey=$API_KEY"