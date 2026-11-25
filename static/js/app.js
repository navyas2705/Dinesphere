// =====================================================================
// DineSphere frontend, Phase 5: POS
// =====================================================================
const API = '/api';
const TAX_RATE = 0.05;

// --- App state (data held in memory while the page is open) ---
let menuItems = [];
let customers = [];
let cart = [];            // [{item_id, name, price, quantity}]
let activeCategory = 'All';


// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
function money(n) {
    return '₹' + Number(n).toLocaleString('en-IN', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    });
}

// Prevents text from the database being treated as HTML
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
}

// Talks to the Flask API. Throws an Error if the server says success: false
async function api(path, options = {}) {
    const res = await fetch(API + path, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    const body = await res.json();
    if (!body.success) throw new Error(body.error || 'Request failed');
    return body;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const color = type === 'success' ? 'bg-green-600' : 'bg-red-600';
    toast.className = `${color} text-white px-4 py-3 rounded-lg shadow-lg text-sm`;
    toast.textContent = message;
    document.getElementById('toastContainer').appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}


// ---------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('tab-' + tabId).classList.remove('hidden');

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tabBtn-' + tabId).classList.add('active');

    // Refresh the data each time a tab is opened
    if (tabId === 'orders')    loadOrders();
    if (tabId === 'menu')      renderMenuTable();
    if (tabId === 'customers') loadCustomers();
    if (tabId === 'analytics') loadAnalytics();
}


// ---------------------------------------------------------------------
// Load data from the API
// ---------------------------------------------------------------------
async function loadMenu() {
    const body = await api('/menu');
    menuItems = body.data;
}

async function loadCustomers() {
    const body = await api('/customers');
    customers = body.data;
    renderCustomerSelect();
    renderCustomersTable();
}


// ---------------------------------------------------------------------
// POS: category pills and menu cards
// ---------------------------------------------------------------------
function renderCategoryPills() {
    const categories = ['All', ...new Set(menuItems.map(i => i.Category))];
    document.getElementById('categoryPills').innerHTML = categories.map(cat => `
        <button class="pill ${cat === activeCategory ? 'active' : ''}"
                onclick="setCategory('${cat.replace(/'/g, "\\'")}')">
            ${escapeHtml(cat)}
        </button>
    `).join('');
}

function setCategory(cat) {
    activeCategory = cat;
    renderCategoryPills();
    renderMenu();
}

function renderMenu() {
    const search = document.getElementById('posSearch').value.trim().toLowerCase();

    const visible = menuItems.filter(item =>
        (activeCategory === 'All' || item.Category === activeCategory) &&
        (item.Item_Name.toLowerCase().includes(search) ||
         item.Category.toLowerCase().includes(search))
    );

    const grid = document.getElementById('menuGrid');
    if (visible.length === 0) {
        grid.innerHTML = '<p class="text-slate-500 col-span-full">No dishes found.</p>';
        return;
    }

    grid.innerHTML = visible.map(item => `
        <div class="dish-card" onclick="addToCart(${item.Item_ID})">
            <p class="text-xs text-orange-600 font-semibold uppercase">${escapeHtml(item.Category)}</p>
            <h3 class="font-semibold mt-1">${escapeHtml(item.Item_Name)}</h3>
            <div class="flex items-center justify-between mt-3">
                <span class="font-bold">${money(item.Price)}</span>
                <span class="text-sm bg-orange-100 text-orange-700 px-2 py-1 rounded-md">+ Add</span>
            </div>
        </div>
    `).join('');
}


// ---------------------------------------------------------------------
// POS: cart
// ---------------------------------------------------------------------
function addToCart(itemId) {
    const existing = cart.find(c => c.item_id === itemId);
    if (existing) {
        existing.quantity += 1;
    } else {
        const item = menuItems.find(i => i.Item_ID === itemId);
        cart.push({
            item_id: item.Item_ID,
            name: item.Item_Name,
            price: item.Price,
            quantity: 1
        });
    }
    renderCart();
}

function changeQty(itemId, delta) {
    const line = cart.find(c => c.item_id === itemId);
    if (!line) return;
    line.quantity += delta;
    if (line.quantity <= 0) {
        cart = cart.filter(c => c.item_id !== itemId);
    }
    renderCart();
}

function removeFromCart(itemId) {
    cart = cart.filter(c => c.item_id !== itemId);
    renderCart();
}

function clearCart() {
    cart = [];
    renderCart();
}

function renderCart() {
    const box = document.getElementById('cartItems');

    if (cart.length === 0) {
        box.innerHTML = '<p class="text-sm text-slate-400 text-center py-6">Cart is empty. Click a dish to add it.</p>';
    } else {
        box.innerHTML = cart.map(line => `
            <div class="flex items-center justify-between gap-2 border-b pb-2">
                <div class="min-w-0">
                    <p class="text-sm font-semibold truncate">${escapeHtml(line.name)}</p>
                    <p class="text-xs text-slate-500">${money(line.price)} each</p>
                </div>
                <div class="flex items-center gap-1">
                    <button onclick="changeQty(${line.item_id}, -1)" class="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300">−</button>
                    <span class="w-6 text-center text-sm">${line.quantity}</span>
                    <button onclick="changeQty(${line.item_id}, 1)" class="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300">+</button>
                </div>
                <div class="text-right w-20">
                    <p class="text-sm font-semibold">${money(line.price * line.quantity)}</p>
                    <button onclick="removeFromCart(${line.item_id})" class="text-xs text-red-500 hover:underline">remove</button>
                </div>
            </div>
        `).join('');
    }

    // Totals: Subtotal = sum of (price x quantity); GST is 5% of that
    const subtotal = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);
    const tax = subtotal * TAX_RATE;
    document.getElementById('cartSubtotal').textContent = money(subtotal);
    document.getElementById('cartTax').textContent = money(tax);
    document.getElementById('cartTotal').textContent = money(subtotal + tax);
}

function renderCustomerSelect() {
    const select = document.getElementById('customerSelect');
    const previous = select.value;
    select.innerHTML =
        '<option value="">-- Select customer --</option>' +
        customers.map(c =>
            `<option value="${c.Customer_ID}">${escapeHtml(c.Customer_Name)} (${escapeHtml(c.Phone_No)})</option>`
        ).join('');
    select.value = previous;
}


// ---------------------------------------------------------------------
// POS: place the order
// ---------------------------------------------------------------------
async function submitOrder() {
    const customerId = document.getElementById('customerSelect').value;

    if (!customerId) {
        showToast('Please select a customer first.', 'error');
        return;
    }
    if (cart.length === 0) {
        showToast('Add at least one dish to the cart.', 'error');
        return;
    }

    try {
        const body = await api('/orders', {
            method: 'POST',
            body: JSON.stringify({
                customer_id: Number(customerId),
                items: cart.map(l => ({ item_id: l.item_id, quantity: l.quantity }))
            })
        });
        showToast(body.message);
        clearCart();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ---------------------------------------------------------------------
// Modal helpers (open and close popup windows)
// ---------------------------------------------------------------------
function openModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}


// ---------------------------------------------------------------------
// ORDERS tab
// ---------------------------------------------------------------------
let orders = [];

async function loadOrders() {
    try {
        const body = await api('/orders');
        orders = body.data;
        renderOrdersTable();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400">No orders yet.</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(o => `
        <tr class="border-t hover:bg-slate-50">
            <td class="p-3 font-semibold">#${o.Order_ID}</td>
            <td class="p-3">
                ${escapeHtml(o.Customer_Name)}
                <div class="text-xs text-slate-500">${escapeHtml(o.Phone_No)}</div>
            </td>
            <td class="p-3">${escapeHtml(o.Order_Date)}</td>
            <td class="p-3 text-center">${o.Total_Items}</td>
            <td class="p-3 text-right font-semibold">${money(o.Total_Amount)}</td>
            <td class="p-3 text-right whitespace-nowrap">
                <button onclick="viewReceipt(${o.Order_ID})" class="text-orange-600 hover:underline mr-3">Receipt</button>
                <button onclick="deleteOrder(${o.Order_ID})" class="text-red-600 hover:underline">Delete</button>
            </td>
        </tr>
    `).join('');
}

async function viewReceipt(orderId) {
    try {
        const body = await api(`/orders/${orderId}/receipt`);
        const r = body.data;

        const lines = r.items.map(it => `
            <div class="mb-2">
                <div>${escapeHtml(it.Item_Name)}</div>
                <div class="flex justify-between text-slate-600">
                    <span>${it.Quantity} x ${money(it.Unit_Price)}</span>
                    <span>${money(it.Subtotal)}</span>
                </div>
            </div>
        `).join('');

        document.getElementById('printableReceipt').innerHTML = `
            <div class="text-center mb-3">
                <p class="font-bold text-base">${escapeHtml(r.restaurant_name)}</p>
                <p class="text-xs text-slate-500">Tax Invoice</p>
            </div>
            <div class="border-t border-dashed border-slate-400 py-2 text-xs">
                <div>Order #: ${r.order_id}</div>
                <div>Date: ${escapeHtml(r.order_date)}</div>
                <div>Customer: ${escapeHtml(r.customer_name)}</div>
                <div>Phone: ${escapeHtml(r.customer_phone)}</div>
            </div>
            <div class="border-t border-dashed border-slate-400 py-3">${lines}</div>
            <div class="border-t border-dashed border-slate-400 pt-2 space-y-1">
                <div class="flex justify-between"><span>Subtotal</span><span>${money(r.subtotal)}</span></div>
                <div class="flex justify-between"><span>GST (${r.tax_rate})</span><span>${money(r.tax_amount)}</span></div>
                <div class="flex justify-between font-bold text-base border-t border-slate-400 pt-1">
                    <span>TOTAL</span><span>${money(r.grand_total)}</span>
                </div>
            </div>
            <p class="text-center text-xs mt-4">Thank you for dining with us!</p>
        `;
        openModal('receiptModal');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteOrder(orderId) {
    if (!confirm(`Delete order #${orderId} and all its items? This cannot be undone.`)) return;
    try {
        const body = await api(`/orders/${orderId}`, { method: 'DELETE' });
        showToast(body.message);
        loadOrders();
    } catch (err) {
        showToast(err.message, 'error');
    }
}


// ---------------------------------------------------------------------
// MENU tab
// ---------------------------------------------------------------------

// Reload the menu from the server and redraw everything that shows it
async function refreshMenuViews() {
    await loadMenu();
    if (activeCategory !== 'All' && !menuItems.some(i => i.Category === activeCategory)) {
        activeCategory = 'All';
    }
    renderCategoryPills();
    renderMenu();
    renderMenuTable();
}

function renderMenuTable() {
    const tbody = document.getElementById('menuTableBody');

    if (menuItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-400">No dishes yet.</td></tr>';
        return;
    }

    tbody.innerHTML = menuItems.map(item => `
        <tr class="border-t hover:bg-slate-50">
            <td class="p-3 text-slate-500">${item.Item_ID}</td>
            <td class="p-3 font-semibold">${escapeHtml(item.Item_Name)}</td>
            <td class="p-3">${escapeHtml(item.Category)}</td>
            <td class="p-3 text-right">${money(item.Price)}</td>
            <td class="p-3 text-right whitespace-nowrap">
                <button onclick="openMenuModal(${item.Item_ID})" class="text-blue-600 hover:underline mr-3">Edit</button>
                <button onclick="deleteMenuItem(${item.Item_ID})" class="text-red-600 hover:underline">Delete</button>
            </td>
        </tr>
    `).join('');
}

function openMenuModal(itemId = null) {
    // Fill the category suggestions with existing categories
    const cats = [...new Set(menuItems.map(i => i.Category))];
    document.getElementById('categoryList').innerHTML =
        cats.map(c => `<option value="${escapeHtml(c)}"></option>`).join('');

    if (itemId) {
        const item = menuItems.find(i => i.Item_ID === itemId);
        document.getElementById('menuModalTitle').textContent = 'Edit Dish';
        document.getElementById('menuItemId').value = item.Item_ID;
        document.getElementById('menuName').value = item.Item_Name;
        document.getElementById('menuCategory').value = item.Category;
        document.getElementById('menuPrice').value = item.Price;
    } else {
        document.getElementById('menuModalTitle').textContent = 'Add Dish';
        document.getElementById('menuItemId').value = '';
        document.getElementById('menuName').value = '';
        document.getElementById('menuCategory').value = '';
        document.getElementById('menuPrice').value = '';
    }
    openModal('menuModal');
}

async function saveMenuItem(event) {
    event.preventDefault();   // stops the browser from reloading the page

    const id = document.getElementById('menuItemId').value;
    const payload = {
        Item_Name: document.getElementById('menuName').value,
        Category: document.getElementById('menuCategory').value,
        Price: document.getElementById('menuPrice').value
    };

    try {
        const body = await api(id ? `/menu/${id}` : '/menu', {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(payload)
        });
        showToast(body.message);
        closeModal('menuModal');
        await refreshMenuViews();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteMenuItem(itemId) {
    if (!confirm(`Delete menu item #${itemId}?`)) return;
    try {
        const body = await api(`/menu/${itemId}`, { method: 'DELETE' });
        showToast(body.message);
        await refreshMenuViews();
    } catch (err) {
        // e.g. "Cannot delete item: it is used in existing orders."
        showToast(err.message, 'error');
    }
}


// ---------------------------------------------------------------------
// CUSTOMERS tab
// ---------------------------------------------------------------------
function renderCustomersTable() {
    const tbody = document.getElementById('customersTableBody');
    const term = document.getElementById('customerSearch').value.trim().toLowerCase();

    const visible = customers.filter(c =>
        c.Customer_Name.toLowerCase().includes(term) ||
        c.Phone_No.toLowerCase().includes(term) ||
        (c.Email || '').toLowerCase().includes(term)
    );

    if (visible.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-slate-400">No customers found.</td></tr>';
        return;
    }

    tbody.innerHTML = visible.map(c => `
        <tr class="border-t hover:bg-slate-50">
            <td class="p-3 text-slate-500">${c.Customer_ID}</td>
            <td class="p-3 font-semibold">${escapeHtml(c.Customer_Name)}</td>
            <td class="p-3">${escapeHtml(c.Phone_No)}</td>
            <td class="p-3">${escapeHtml(c.Email || '-')}</td>
            <td class="p-3 text-center">${c.Total_Orders}</td>
            <td class="p-3 text-right font-semibold">${money(c.Total_Spent)}</td>
            <td class="p-3 text-right whitespace-nowrap">
                <button onclick="openCustomerModal(${c.Customer_ID})" class="text-blue-600 hover:underline mr-3">Edit</button>
                <button onclick="deleteCustomer(${c.Customer_ID})" class="text-red-600 hover:underline">Delete</button>
            </td>
        </tr>
    `).join('');
}

function openCustomerModal(customerId = null) {
    if (customerId) {
        const c = customers.find(x => x.Customer_ID === customerId);
        document.getElementById('customerModalTitle').textContent = 'Edit Customer';
        document.getElementById('customerId').value = c.Customer_ID;
        document.getElementById('customerName').value = c.Customer_Name;
        document.getElementById('customerPhone').value = c.Phone_No;
        document.getElementById('customerEmail').value = c.Email || '';
    } else {
        document.getElementById('customerModalTitle').textContent = 'Add Customer';
        document.getElementById('customerId').value = '';
        document.getElementById('customerName').value = '';
        document.getElementById('customerPhone').value = '';
        document.getElementById('customerEmail').value = '';
    }
    openModal('customerModal');
}

async function saveCustomer(event) {
    event.preventDefault();

    const id = document.getElementById('customerId').value;
    const payload = {
        Customer_Name: document.getElementById('customerName').value,
        Phone_No: document.getElementById('customerPhone').value,
        Email: document.getElementById('customerEmail').value
    };

    try {
        const body = await api(id ? `/customers/${id}` : '/customers', {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(payload)
        });
        showToast(body.message);
        closeModal('customerModal');
        await loadCustomers();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteCustomer(customerId) {
    if (!confirm(`Delete customer #${customerId}? All of their orders will be deleted too.`)) return;
    try {
        const body = await api(`/customers/${customerId}`, { method: 'DELETE' });
        showToast(body.message);
        await loadCustomers();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ---------------------------------------------------------------------
// ANALYTICS tab
// ---------------------------------------------------------------------
async function loadAnalytics() {
    try {
        const body = await api('/dashboard');
        const s = body.data;

        document.getElementById('kpiRevenue').textContent = money(s.total_revenue);
        document.getElementById('kpiOrders').textContent = s.total_orders;
        document.getElementById('kpiCustomers').textContent = s.total_customers;
        document.getElementById('kpiMenu').textContent = s.total_menu_items;

        // Top 5 dishes
        const top = document.getElementById('topItems');
        if (s.top_items.length === 0) {
            top.innerHTML = '<p class="text-sm text-slate-400">No sales yet.</p>';
        } else {
            top.innerHTML = s.top_items.map((it, i) => `
                <div class="flex items-center gap-3 py-2 border-b last:border-0">
                    <span class="w-7 h-7 rounded-full bg-orange-100 text-orange-700 text-sm font-bold flex items-center justify-center">${i + 1}</span>
                    <div class="flex-1 min-w-0">
                        <p class="font-semibold text-sm truncate">${escapeHtml(it.Item_Name)}</p>
                        <p class="text-xs text-slate-500">${escapeHtml(it.Category)}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-sm font-semibold">${it.Units_Sold} sold</p>
                        <p class="text-xs text-slate-500">${money(it.Revenue_Generated)}</p>
                    </div>
                </div>
            `).join('');
        }

        // Category sales as horizontal bars
        const cat = document.getElementById('categorySales');
        if (s.category_sales.length === 0) {
            cat.innerHTML = '<p class="text-sm text-slate-400">No sales yet.</p>';
        } else {
            const max = Math.max(...s.category_sales.map(c => c.Total_Sales), 1);
            cat.innerHTML = s.category_sales.map(c => `
                <div class="mb-3">
                    <div class="flex justify-between text-sm mb-1">
                        <span class="font-semibold">${escapeHtml(c.Category)}</span>
                        <span>${money(c.Total_Sales)}</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-2.5">
                        <div class="bg-orange-500 h-2.5 rounded-full" style="width: ${(c.Total_Sales / max) * 100}%"></div>
                    </div>
                    <p class="text-xs text-slate-500 mt-1">${c.Total_Sold} items sold</p>
                </div>
            `).join('');
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}


// ---------------------------------------------------------------------
// SQL STUDIO tab
// ---------------------------------------------------------------------
const QUICK_QUERIES = {
    customer: 'SELECT * FROM CUSTOMER;',
    menu:     'SELECT * FROM MENU ORDER BY Category, Item_Name;',
    orders:   'SELECT * FROM ORDERS;',
    details:  'SELECT * FROM ORDER_DETAILS;',
    join: `SELECT o.Order_ID, c.Customer_Name, o.Order_Date,
       m.Item_Name, od.Quantity, od.Subtotal
FROM ORDERS o
JOIN CUSTOMER c      ON o.Customer_ID = c.Customer_ID
JOIN ORDER_DETAILS od ON od.Order_ID = o.Order_ID
JOIN MENU m          ON od.Item_ID = m.Item_ID
ORDER BY o.Order_ID, od.Order_Detail_ID;`
};

function setSqlQuery(key) {
    document.getElementById('sqlInput').value = QUICK_QUERIES[key];
    executeSqlQuery();
}

async function executeSqlQuery() {
    const query = document.getElementById('sqlInput').value.trim();
    const status = document.getElementById('sqlStatus');
    const head = document.getElementById('sqlHead');
    const bodyEl = document.getElementById('sqlBody');

    if (!query) {
        showToast('Type a query first.', 'error');
        return;
    }

    try {
        const body = await api('/database/query', {
            method: 'POST',
            body: JSON.stringify({ query })
        });

        status.textContent = `${body.count} row(s) returned.`;
        status.className = 'text-sm text-green-600';

        head.innerHTML = '<tr>' +
            body.columns.map(c => `<th class="p-3">${escapeHtml(c)}</th>`).join('') +
            '</tr>';

        if (body.data.length === 0) {
            bodyEl.innerHTML = `<tr><td colspan="${Math.max(body.columns.length, 1)}" class="p-6 text-center text-slate-400">No rows.</td></tr>`;
            return;
        }

        bodyEl.innerHTML = body.data.map(row => `
            <tr class="border-t hover:bg-slate-50">
                ${row.map(v => `<td class="p-3">${v === null ? '<span class="text-slate-400">NULL</span>' : escapeHtml(String(v))}</td>`).join('')}
            </tr>
        `).join('');
    } catch (err) {
        status.textContent = 'Error: ' + err.message;
        status.className = 'text-sm text-red-600';
        head.innerHTML = '';
        bodyEl.innerHTML = '';
    }
}

// Ctrl+Enter runs the query
document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter' && e.target.id === 'sqlInput') {
        executeSqlQuery();
    }
});

async function resetDatabase() {
    if (!confirm('Reset the database? ALL current data will be deleted and the original demo data restored.')) return;
    try {
        const body = await api('/database/reset', { method: 'POST' });
        showToast(body.message);

        // Refresh everything the page is showing
        cart = [];
        activeCategory = 'All';
        await Promise.all([loadMenu(), loadCustomers()]);
        renderCategoryPills();
        renderMenu();
        renderMenuTable();
        renderCart();
        document.getElementById('sqlHead').innerHTML = '';
        document.getElementById('sqlBody').innerHTML = '';
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ---------------------------------------------------------------------
// Start-up
// ---------------------------------------------------------------------
async function initApp() {
    try {
        await Promise.all([loadMenu(), loadCustomers()]);
        renderCategoryPills();
        renderMenu();
        renderCart();
    } catch (err) {
        showToast('Could not load data: ' + err.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', initApp);