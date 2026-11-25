import os
import sqlite3
from pathlib import Path
from config import DB_PATH, BASE_DIR


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row            # rows behave like dictionaries
    conn.execute("PRAGMA foreign_keys = ON")  # SQLite needs this to enforce FKs
    return conn


def fetch_all(query, params=()):
    """Runs a SELECT and returns a list of dictionaries."""
    conn = get_connection()
    try:
        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def fetch_one(query, params=()):
    """Runs a SELECT and returns one dictionary, or None."""
    conn = get_connection()
    try:
        row = conn.execute(query, params).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def execute(query, params=(), return_id=False):
    """Runs INSERT / UPDATE / DELETE. Returns new ID or rows affected."""
    conn = get_connection()
    try:
        cur = conn.execute(query, params)
        conn.commit()
        return cur.lastrowid if return_id else cur.rowcount
    finally:
        conn.close()


def run_readonly_query(query, limit=500):
    """
    Runs a user-typed query on a READ-ONLY connection (used by SQL Studio).
    Returns (column_names, rows). Any attempt to change data raises an error.
    """
    uri = Path(DB_PATH).resolve().as_uri() + '?mode=ro'
    conn = sqlite3.connect(uri, uri=True)
    try:
        cur = conn.execute(query)          # only ONE statement is allowed
        columns = [c[0] for c in cur.description] if cur.description else []
        rows = [list(r) for r in cur.fetchmany(limit)]
        return columns, rows
    finally:
        conn.close()


def init_db(force_reseed=False):
    """
    Creates the tables if needed and loads seed.sql when the database is empty.
    force_reseed=True wipes all data first and loads the seed data again.
    """
    conn = get_connection()
    try:
        with open(os.path.join(BASE_DIR, 'database', 'schema.sql'), encoding='utf-8') as f:
            conn.executescript(f.read())

        if force_reseed:
            conn.executescript("""
                DELETE FROM ORDER_DETAILS;
                DELETE FROM ORDERS;
                DELETE FROM MENU;
                DELETE FROM CUSTOMER;
                DELETE FROM sqlite_sequence;
            """)

        count = conn.execute("SELECT COUNT(*) FROM CUSTOMER").fetchone()[0]
        if count == 0:
            with open(os.path.join(BASE_DIR, 'database', 'seed.sql'), encoding='utf-8') as f:
                conn.executescript(f.read())
        conn.commit()
    finally:
        conn.close()