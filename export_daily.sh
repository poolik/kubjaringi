#!/bin/sh

cd /home/pi/temp
rrdtool xport -s now-8d -e now --showtime --step 7200 \
DEF:a=/home/pi/temp/temperatures.rrd:temps_inside:AVERAGE \
XPORT:a:"Temperatuur" > temperature1w.xml

rrdtool xport -s now-1month -e now --showtime --step 10800 \
DEF:a=/home/pi/temp/temperatures.rrd:temps_inside:AVERAGE \
XPORT:a:"Temperatuur" > temperature1m.xml

rrdtool xport -s now-3month -e now --showtime --step 43200 \
DEF:a=/home/pi/temp/temperatures.rrd:temps_inside:AVERAGE \
XPORT:a:"Temperatuur" > temperature3m.xml

rrdtool xport -s now-1y -e now --showtime --step 86400 \
DEF:a=/home/pi/temp/temperatures.rrd:temps_inside:AVERAGE \
XPORT:a:"Temperatuur" > temperature1y.xml

API_KEY=`cat /home/pi/kubjaringi/apikey.txt`
HOST="https://kubjaringi.herokuapp.com"
curl ${HOST}/file-upload -X POST -F temperature1w=@temperature1w.xml -F temperature1m=@temperature1m.xml -F temperature3m=@temperature3m.xml -F temperature1y=@temperature1y.xml -F "apikey=$API_KEY"