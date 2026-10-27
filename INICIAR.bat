@echo off
cd /d "%~dp0"
echo RoomFix Map - demo local
echo.
echo Abri http://127.0.0.1:8765 en el navegador.
echo Mantene esta ventana abierta durante la demostracion.
echo Para detener el servidor: Ctrl+C.
echo.
python -m http.server 8765 --bind 127.0.0.1
pause
