@echo off
call node %~dp0\index.js --help
REM set the custom path here if needed:
set "realm_path=%appdata%\osu\client.realm"
IF EXIST "%realm_path%" (
	REM edit the line below to add arguments:

	call node %~dp0\index.js "%realm_path%"

	REM for example: node %~dp0\index.js "%realm_path% --number-of-brackets=5 --graceperiod-play-count=1000
) ELSE (
	ECHO FILE MISSING: "%realm_path%"
	ECHO ^(Please edit ^"run.bat^" if ^"client.realm^" is somewhere else^)
)
PAUSE
