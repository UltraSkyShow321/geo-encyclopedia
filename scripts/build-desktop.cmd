@echo off
cd /d D:\OpenCodeProjects\geo-encyclopedia\apps\desktop
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
call npx.cmd electron-builder --win > D:\OpenCodeProjects\geo-encyclopedia\logs\desktop-build.log 2>&1
