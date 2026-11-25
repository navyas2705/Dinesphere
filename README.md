# DineSphere: Restaurant Management System

A full-stack restaurant management web app built with Flask and SQLite.

## Features
- Point of Sale (POS) with live cart and 5% GST
- Order history with printable receipts
- Menu and customer management (full CRUD)
- Sales analytics dashboard
- Read-only SQL Query Studio
- One-click database reset

## ER Model
CUSTOMER 1:M ORDERS 1:M ORDER_DETAILS M:1 MENU
The schema is in Third Normal Form (3NF).

## Tech Stack
Python, Flask, SQLite, HTML, Tailwind CSS, JavaScript

## How to Run
1. Install Python 3.8 or newer.
2. Clone the repo and open the folder:
   ```
   git clone https://github.com/Navya Subramani/dinesphere.git
   cd dinesphere
   ```
3. Create and activate a virtual environment:
   ```
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
4. Install dependencies and start the app:
   ```
   pip install -r requirements.txt
   python backend\app.py
   ```
5. Open http://127.0.0.1:5000 in your browser.

On Windows you can also double-click `run.bat`.

## Project Structure
```
dinesphere/
├── backend/
│   ├── app.py
│   ├── config.py
│   ├── database.py
│   ├── models.py
│   ├── build_mysql_script.py
│   └── test_models.py
├── database/
│   ├── schema.sql
│   ├── seed.sql
│   └── dinesphere.db      
├── static/
│   ├── css/style.css
│   └── js/app.js
├── templates /index.html
├── venv/
├── requirements.txt
└── run.bat
```