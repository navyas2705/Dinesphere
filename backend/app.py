import sqlite3
from flask import Flask, request, jsonify, render_template
from config import PORT, BASE_DIR
from database import init_db, run_readonly_query
import models

import os

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, 'templates'),
    static_folder=os.path.join(BASE_DIR, 'static'),
)


# ---------------------------------------------------------------------
# Small helpers so every response has the same shape
# ---------------------------------------------------------------------
def ok(data=None, message=None, status=200):
    body = {'success': True}
    if message:
        body['message'] = message
    if data is not None:
        body['data'] = data
    return jsonify(body), status


def fail(error, status=400):
    return jsonify({'success': False, 'error': str(error)}), status


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/api/health')
def health():
    return jsonify({'status': 'healthy', 'application': 'DineSphere'})


# =====================================================================
# CUSTOMER
# =====================================================================
@app.route('/api/customers', methods=['GET'])
def list_customers():
    search = request.args.get('search', '').strip()
    return ok(models.get_all_customers(search or None))


@app.route('/api/customers/<int:customer_id>', methods=['GET'])
def get_customer(customer_id):
    customer = models.get_customer_by_id(customer_id)
    if not customer:
        return fail('Customer not found', 404)
    return ok(customer)


@app.route('/api/customers', methods=['POST'])
def add_customer():
    data = request.get_json() or {}
    name = (data.get('Customer_Name') or '').strip()
    phone = (data.get('Phone_No') or '').strip()
    email = (data.get('Email') or '').strip()

    if not name or not phone:
        return fail('Customer name and phone number are required.')

    new_id = models.create_customer(name, phone, email)
    return ok(models.get_customer_by_id(new_id), 'Customer added successfully', 201)


@app.route('/api/customers/<int:customer_id>', methods=['PUT'])
def edit_customer(customer_id):
    if not models.get_customer_by_id(customer_id):
        return fail('Customer not found', 404)

    data = request.get_json() or {}
    name = (data.get('Customer_Name') or '').strip()
    phone = (data.get('Phone_No') or '').strip()
    email = (data.get('Email') or '').strip()

    if not name or not phone:
        return fail('Customer name and phone number are required.')

    models.update_customer(customer_id, name, phone, email)
    return ok(models.get_customer_by_id(customer_id), 'Customer updated successfully')


@app.route('/api/customers/<int:customer_id>', methods=['DELETE'])
def remove_customer(customer_id):
    if not models.get_customer_by_id(customer_id):
        return fail('Customer not found', 404)
    models.delete_customer(customer_id)
    return ok(message=f'Customer #{customer_id} and their orders were removed.')


# =====================================================================
# MENU
# =====================================================================
@app.route('/api/menu', methods=['GET'])
def list_menu():
    category = request.args.get('category', '').strip()
    search = request.args.get('search', '').strip()
    return ok(models.get_all_menu_items(category or None, search or None))


# NOTE: this route must stay above /api/menu/<int:item_id> only for readability;
# Flask tells them apart because <int:...> only matches numbers.
@app.route('/api/menu/categories', methods=['GET'])
def list_categories():
    return ok(models.get_menu_categories())


@app.route('/api/menu/<int:item_id>', methods=['GET'])
def get_menu_item(item_id):
    item = models.get_menu_item_by_id(item_id)
    if not item:
        return fail('Menu item not found', 404)
    return ok(item)


def read_menu_payload():
    """Reads and validates name/category/price from the request body."""
    data = request.get_json() or {}
    name = (data.get('Item_Name') or '').strip()
    category = (data.get('Category') or '').strip()
    price = data.get('Price')

    if not name or not category or price in (None, ''):
        raise ValueError('Item name, category and price are required.')
    try:
        price = float(price)
    except (TypeError, ValueError):
        raise ValueError('Price must be a number.')
    if price < 0:
        raise ValueError('Price cannot be negative.')
    return name, category, price


@app.route('/api/menu', methods=['POST'])
def add_menu_item():
    try:
        name, category, price = read_menu_payload()
    except ValueError as e:
        return fail(e)
    new_id = models.create_menu_item(name, category, price)
    return ok(models.get_menu_item_by_id(new_id), 'Menu item created successfully', 201)


@app.route('/api/menu/<int:item_id>', methods=['PUT'])
def edit_menu_item(item_id):
    if not models.get_menu_item_by_id(item_id):
        return fail('Menu item not found', 404)
    try:
        name, category, price = read_menu_payload()
    except ValueError as e:
        return fail(e)
    models.update_menu_item(item_id, name, category, price)
    return ok(models.get_menu_item_by_id(item_id), 'Menu item updated successfully')


@app.route('/api/menu/<int:item_id>', methods=['DELETE'])
def remove_menu_item(item_id):
    if not models.get_menu_item_by_id(item_id):
        return fail('Menu item not found', 404)
    try:
        models.delete_menu_item(item_id)
    except ValueError as e:        # item is used in existing orders
        return fail(e)
    return ok(message=f'Menu item #{item_id} deleted successfully.')


# =====================================================================
# ORDERS and ORDER_DETAILS
# =====================================================================
@app.route('/api/orders', methods=['GET'])
def list_orders():
    return ok(models.get_all_orders())


@app.route('/api/orders/<int:order_id>', methods=['GET'])
def get_order(order_id):
    order = models.get_order_by_id(order_id)
    if not order:
        return fail('Order not found', 404)
    return ok(order)


@app.route('/api/orders', methods=['POST'])
def place_order():
    """
    Expected body:
    {"customer_id": 1, "items": [{"item_id": 1, "quantity": 2}, ...]}
    """
    data = request.get_json() or {}
    customer_id = data.get('customer_id')
    items = data.get('items') or []

    if not customer_id:
        return fail('Please select a customer for this order.')
    if not items:
        return fail('Order must contain at least one menu item.')
    if not models.get_customer_by_id(customer_id):
        return fail('Selected customer does not exist.')

    try:
        order_id = models.create_order(customer_id, items)
    except (ValueError, KeyError, TypeError) as e:
        return fail(e)
    except sqlite3.Error as e:
        return fail(f'Database error: {e}', 500)

    return ok(models.get_order_by_id(order_id), f'Order #{order_id} placed successfully!', 201)


@app.route('/api/orders/<int:order_id>', methods=['DELETE'])
def remove_order(order_id):
    if not models.get_order_by_id(order_id):
        return fail('Order not found', 404)
    models.delete_order(order_id)
    return ok(message=f'Order #{order_id} and its items were removed.')


@app.route('/api/orders/<int:order_id>/receipt', methods=['GET'])
def get_receipt(order_id):
    order = models.get_order_by_id(order_id)
    if not order:
        return fail('Order not found', 404)

    subtotal = float(order['Total_Amount'])
    tax_amount = round(subtotal * 0.05, 2)          # 5% GST

    receipt = {
        'restaurant_name': 'DineSphere Indian Kitchen & Bistro',
        'order_id': order['Order_ID'],
        'order_date': order['Order_Date'],
        'customer_name': order['Customer_Name'],
        'customer_phone': order['Phone_No'],
        'customer_email': order['Email'],
        'items': order['items'],
        'subtotal': subtotal,
        'tax_rate': '5%',
        'tax_amount': tax_amount,
        'grand_total': round(subtotal + tax_amount, 2),
    }
    return ok(receipt)


# =====================================================================
# ANALYTICS
# =====================================================================
@app.route('/api/dashboard', methods=['GET'])
def dashboard():
    return ok(models.get_dashboard_stats())

# =====================================================================
# DATABASE UTILITIES (SQL Studio and Reset)
# =====================================================================
@app.route('/api/database/reset', methods=['POST'])
def reset_database():
    init_db(force_reseed=True)
    return ok(message='Database reset. Original demo data restored.')


@app.route('/api/database/query', methods=['POST'])
def run_query():
    data = request.get_json() or {}
    query = (data.get('query') or '').strip().rstrip(';').strip()

    if not query:
        return fail('Query cannot be empty.')

    first_word = query.split(None, 1)[0].upper()
    if first_word not in ('SELECT', 'WITH', 'PRAGMA', 'EXPLAIN'):
        return fail('SQL Studio is read-only. Only SELECT queries are allowed.')

    try:
        columns, rows = run_readonly_query(query)
    except sqlite3.Error as e:
        return fail(e)

    return jsonify({'success': True, 'columns': columns, 'count': len(rows), 'data': rows})

# ---------------------------------------------------------------------
init_db()

if __name__ == '__main__':
    app.run(debug=True, port=PORT)