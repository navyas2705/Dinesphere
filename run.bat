@echo off
cd /d "%~dp0"
title DineSphere: Restaurant Management System

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate
pip install -r requirements.txt --quiet

echo.
echo Starting DineSphere at http://localhost:5000
echo Press Ctrl+C to stop.
echo.
python backend\app.py
pause