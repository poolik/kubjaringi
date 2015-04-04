#!/bin/sh

temp=`cat /sys/bus/w1/devices/28*/w1_slave | awk '/t=/ {print substr($10,3) / 1000.0}'`
cd /home/pi/temp
rrdtool update temperatures.rrd N:${temp}

rrdtool xport -s now-3h -e now --step 300 \
DEF:a=/home/pi/temp/temperatures.rrd:temps_inside:AVERAGE \
XPORT:a:"Temperatuur" > temperature3h.xml

rrdtool xport -s now-24h -e now --step 900 \
DEF:a=/home/pi/temp/temperatures.rrd:temps_inside:AVERAGE \
XPORT:a:"Temperatuur" > temperature24h.xml

rrdtool xport -s now-48h -e now --step 1800 \
DEF:a=/home/pi/temp/temperatures.rrd:temps_inside:AVERAGE \
XPORT:a:"Temperatuur" > temperature48h.xml

API_KEY=`cat /home/pi/ingliste/apikey.txt`
HOST="https://ingliste.herokuapp.com/"
curl ${HOST}/file-upload -X POST -F temperature3h=@temperature3h.xml -F temperature24h=@temperature24h.xml -F temperature48h=temperature48h.xml -F "apikey=$API_KEY"