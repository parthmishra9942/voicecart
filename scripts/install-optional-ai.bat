@echo off
REM Background installer for the optional @xenova/transformers provider.
REM Writes a plain log so we can poll progress from another shell.
echo [%date% %time%] start > "%TEMP%\xenova-install.log"
npm install --no-save --loglevel=info @xenova/transformers --prefix "C:\Users\parth\voicecart" >> "%TEMP%\xenova-install.log" 2>&1
echo [%date% %time%] done exit=%ERRORLEVEL% >> "%TEMP%\xenova-install.log"
