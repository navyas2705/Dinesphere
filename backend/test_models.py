import models

print("Customers:", len(models.get_all_customers()))
print("Menu items:", len(models.get_all_menu_items()))

# Place an order: 2x Dosa (item 1) + 1x Naan (item 3) -> 280 + 75 = 355
order_id = models.create_order(1, [
    {'item_id': 1, 'quantity': 2},
    {'item_id': 3, 'quantity': 1},
])
order = models.get_order_by_id(order_id)
print(f"\nOrder #{order_id} for {order['Customer_Name']}, total = {order['Total_Amount']}")
for line in order['items']:
    print(f"  {line['Quantity']} x {line['Item_Name']} = {line['Subtotal']}")

# Rollback test: item 999 doesn't exist, so the whole order must fail
before = len(models.get_all_orders())
try:
    models.create_order(1, [{'item_id': 1, 'quantity': 1}, {'item_id': 999, 'quantity': 1}])
except ValueError as e:
    print("\nExpected error:", e)
print("Orders unchanged after failed order:", len(models.get_all_orders()) == before)

# Delete restriction test: dish 1 is now used in an order
try:
    models.delete_menu_item(1)
except ValueError as e:
    print("Expected error:", e)

print("\nDashboard:", models.get_dashboard_stats())

# Clean up the test order
models.delete_order(order_id)
print("\nTest order deleted. Done!")