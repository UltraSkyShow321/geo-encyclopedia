@echo off
cd /d D:\OpenCodeProjects\geo-encyclopedia\apps\mobile\android
set ANDROID_HOME=D:\Android\sdk
call gradlew.bat assembleRelease > D:\OpenCodeProjects\geo-encyclopedia\logs\apk-build.log 2>&1
