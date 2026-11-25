import os
from config import BASE_DIR

HEADER = """-- =====================================================================
-- DineSphere: Restaurant Management System (MySQL script)
-- Tables: CUSTOMER, MENU, ORDERS, ORDER_DETAILS
-- =====================================================================

CREATE DATABASE IF NOT EXISTS dinesphere_db
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dinesphere_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS ORDER_DETAILS;
DROP TABLE IF EXISTS ORDERS;
DROP TABLE IF EXISTS MENU;
DROP TABLE IF EXISTS CUSTOMER;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE CUSTOMER (
    Customer_ID   INT AUTO_INCREMENT PRIMARY KEY,
    Customer_Name VARCHAR(100) NOT NULL,
    Phone_No      VARCHAR(20)  NOT NULL,
    Email         VARCHAR(100)
) ENGINE=InnoDB;

CREATE TABLE MENU (
    Item_ID   INT AUTO_INCREMENT PRIMARY KEY,
    Item_Name VARCHAR(100)   NOT NULL,
    Category  VARCHAR(50)    NOT NULL,
    Price     DECIMAL(10, 2) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE ORDERS (
    Order_ID     INT AUTO_INCREMENT PRIMARY KEY,
    Customer_ID  INT NOT NULL,
    Order_Date   DATETIME DEFAULT CURRENT_TIMESTAMP,
    Total_Amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    FOREIGN KEY (Customer_ID) REFERENCES CUSTOMER(Customer_ID) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE ORDER_DETAILS (
    Order_Detail_ID INT AUTO_INCREMENT PRIMARY KEY,
    Order_ID        INT NOT NULL,
    Item_ID         INT NOT NULL,
    Quantity        INT NOT NULL DEFAULT 1,
    Subtotal        DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (Order_ID) REFERENCES ORDERS(Order_ID) ON DELETE CASCADE,
    FOREIGN KEY (Item_ID)  REFERENCES MENU(Item_ID)   ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------
"""

with open(os.path.join(BASE_DIR, 'database', 'seed.sql'), encoding='utf-8') as f:
    seed = f.read()

out_path = os.path.join(BASE_DIR, 'database', 'dinesphere_mysql.sql')
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(HEADER + seed)

print("Created:", out_path)