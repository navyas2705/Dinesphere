from datetime import datetime
from database import fetch_all, fetch_one, execute, get_connection


# =====================================================================
# 1. CUSTOMER
# =====================================================================

def get_all_customers(search=None):
    """All customers with their order count and total spend (LEFT JOIN)."""
    query = """
        SELECT c.Customer_ID, c.Customer_Name, c.Phone_No, c.Email,
               COUNT(o.Order_ID) AS Total_Orders,
               COALESCE(SUM(o.Total_Amount), 0) AS Total_Spent
        FROM CUSTOMER c
        LEFT JOIN ORDERS o ON c.Customer_ID = o.Customer_ID
    """
    params = []
    if search:
        query += " WHERE c.Customer_Name LIKE ? OR c.Phone_No LIKE ? OR c.Email LIKE ?"
        term = f"%{search}%"
        params = [term, term, term]
    query += " GROUP BY c.Customer_ID ORDER BY c.Customer_ID DESC"
    return fetch_all(query, params)


def get_customer_by_id(customer_id):
    return fetch_one("SELECT * FROM CUSTOMER WHERE Customer_ID = ?", (customer_id,))


def create_customer(name, phone, email=""):
    return execute(
        "INSERT INTO CUSTOMER (Customer_Name, Phone_No, Email) VALUES (?, ?, ?)",
        (name.strip(), phone.strip(), email.strip()),
        return_id=True,
    )


def update_customer(customer_id, name, phone, email=""):
    return execute(
        "UPDATE CUSTOMER SET Customer_Name = ?, Phone_No = ?, Email = ? WHERE Customer_ID = ?",
        (name.strip(), phone.strip(), email.strip(), customer_id),
    )


def delete_customer(customer_id):
    """Also deletes the customer's orders (ON DELETE CASCADE)."""
    return execute("DELETE FROM CUSTOMER WHERE Customer_ID = ?", (customer_id,))


# =====================================================================
# 2. MENU
# =====================================================================

def get_all_menu_items(category=None, search=None):
    query = "SELECT * FROM MENU WHERE 1=1"
    params = []
    if category and category != 'All':
        query += " AND Category = ?"
        params.append(category)
    if search:
        query += " AND (Item_Name LIKE ? OR Category LIKE ?)"
        term = f"%{search}%"
        params += [term, term]
    query += " ORDER BY Category, Item_Name"
    return fetch_all(query, params)


def get_menu_item_by_id(item_id):
    return fetch_one("SELECT * FROM MENU WHERE Item_ID = ?", (item_id,))


def get_menu_categories():
    rows = fetch_all("SELECT DISTINCT Category FROM MENU ORDER BY Category")
    return [r['Category'] for r in rows]


def create_menu_item(name, category, price):
    return execute(
        "INSERT INTO MENU (Item_Name, Category, Price) VALUES (?, ?, ?)",
        (name.strip(), category.strip(), float(price)),
        return_id=True,
    )


def update_menu_item(item_id, name, category, price):
    return execute(
        "UPDATE MENU SET Item_Name = ?, Category = ?, Price = ? WHERE Item_ID = ?",
        (name.strip(), category.strip(), float(price), item_id),
    )


def delete_menu_item(item_id):
    """Blocks deletion if the dish appears in any past order."""
    used = fetch_one("SELECT COUNT(*) AS cnt FROM ORDER_DETAILS WHERE Item_ID = ?", (item_id,))
    if used and used['cnt'] > 0:
        raise ValueError(f"Cannot delete item #{item_id}: it is used in existing orders.")
    return execute("DELETE FROM MENU WHERE Item_ID = ?", (item_id,))


# =====================================================================
# 3. ORDERS and ORDER_DETAILS
# =====================================================================

def create_order(customer_id, items):
    """
    Places an order as ONE transaction:
      1. insert the ORDERS row
      2. insert one ORDER_DETAILS row per item (price read from MENU)
      3. update the order's Total_Amount
    If anything fails, everything is rolled back.

    items format: [{'item_id': 1, 'quantity': 2}, ...]
    """
    if not items:
        raise ValueError("Cannot place an order with no items.")

    conn = get_connection()
    try:
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        cur = conn.execute(
            "INSERT INTO ORDERS (Customer_ID, Order_Date, Total_Amount) VALUES (?, ?, 0)",
            (customer_id, now),
        )
        order_id = cur.lastrowid

        total = 0.0
        lines_added = 0
        for item in items:
            item_id = int(item['item_id'])
            qty = int(item.get('quantity', 1))
            if qty <= 0:
                continue

            row = conn.execute("SELECT Price FROM MENU WHERE Item_ID = ?", (item_id,)).fetchone()
            if row is None:
                raise ValueError(f"Menu item #{item_id} does not exist.")

            subtotal = round(row['Price'] * qty, 2)
            total += subtotal
            conn.execute(
                "INSERT INTO ORDER_DETAILS (Order_ID, Item_ID, Quantity, Subtotal) VALUES (?, ?, ?, ?)",
                (order_id, item_id, qty, subtotal),
            )
            lines_added += 1

        if lines_added == 0:
            raise ValueError("Order must contain at least one item with quantity above 0.")

        conn.execute(
            "UPDATE ORDERS SET Total_Amount = ? WHERE Order_ID = ?",
            (round(total, 2), order_id),
        )
        conn.commit()
        return order_id
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_all_orders(limit=50):
    """Orders joined with customer name and number of lines."""
    return fetch_all(
        """
        SELECT o.Order_ID, o.Customer_ID, c.Customer_Name, c.Phone_No,
               o.Order_Date, o.Total_Amount,
               (SELECT COUNT(*) FROM ORDER_DETAILS od
                WHERE od.Order_ID = o.Order_ID) AS Total_Items
        FROM ORDERS o
        JOIN CUSTOMER c ON o.Customer_ID = c.Customer_ID
        ORDER BY o.Order_ID DESC
        LIMIT ?
        """,
        (limit,),
    )


def get_order_by_id(order_id):
    """One order with customer info and all its lines (joined with MENU)."""
    order = fetch_one(
        """
        SELECT o.Order_ID, o.Customer_ID, c.Customer_Name, c.Phone_No, c.Email,
               o.Order_Date, o.Total_Amount
        FROM ORDERS o
        JOIN CUSTOMER c ON o.Customer_ID = c.Customer_ID
        WHERE o.Order_ID = ?
        """,
        (order_id,),
    )
    if not order:
        return None

    order['items'] = fetch_all(
        """
        SELECT od.Order_Detail_ID, od.Item_ID, m.Item_Name, m.Category,
               m.Price AS Unit_Price, od.Quantity, od.Subtotal
        FROM ORDER_DETAILS od
        JOIN MENU m ON od.Item_ID = m.Item_ID
        WHERE od.Order_ID = ?
        ORDER BY od.Order_Detail_ID
        """,
        (order_id,),
    )
    return order


def delete_order(order_id):
    """Also deletes its ORDER_DETAILS rows (ON DELETE CASCADE)."""
    return execute("DELETE FROM ORDERS WHERE Order_ID = ?", (order_id,))


# =====================================================================
# 4. ANALYTICS
# =====================================================================

def get_dashboard_stats():
    stats = {}
    stats['total_revenue'] = round(
        fetch_one("SELECT COALESCE(SUM(Total_Amount), 0) AS t FROM ORDERS")['t'], 2)
    stats['total_orders'] = fetch_one("SELECT COUNT(*) AS c FROM ORDERS")['c']
    stats['total_customers'] = fetch_one("SELECT COUNT(*) AS c FROM CUSTOMER")['c']
    stats['total_menu_items'] = fetch_one("SELECT COUNT(*) AS c FROM MENU")['c']

    stats['top_items'] = fetch_all(
        """
        SELECT m.Item_Name, m.Category,
               SUM(od.Quantity) AS Units_Sold,
               SUM(od.Subtotal) AS Revenue_Generated
        FROM ORDER_DETAILS od
        JOIN MENU m ON od.Item_ID = m.Item_ID
        GROUP BY m.Item_ID
        ORDER BY Units_Sold DESC
        LIMIT 5
        """
    )

    stats['category_sales'] = fetch_all(
        """
        SELECT m.Category,
               SUM(od.Quantity) AS Total_Sold,
               SUM(od.Subtotal) AS Total_Sales
        FROM ORDER_DETAILS od
        JOIN MENU m ON od.Item_ID = m.Item_ID
        GROUP BY m.Category
        ORDER BY Total_Sales DESC
        """
    )
    return stats
