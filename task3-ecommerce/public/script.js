const $view = document.getElementById("view");
const $nav = document.getElementById("nav");
const S = {
  token: localStorage.getItem("token"),
  name: localStorage.getItem("name"),
  role: localStorage.getItem("role"),
  cart: JSON.parse(localStorage.getItem("cart") || "[]"),
  products: [], search: "", editing: null,
};
const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "₹" + Number(n).toLocaleString("en-IN");
const saveCart = () => localStorage.setItem("cart", JSON.stringify(S.cart));

async function api(url, method = "GET", body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(S.token ? { Authorization: "Bearer " + S.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && S.token) logout(true);
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function nav() {
  const count = S.cart.reduce((a, c) => a + c.qty, 0);
  $nav.innerHTML = `
    <button onclick="go('shop')">Shop</button>
    <button onclick="go('cart')">Cart (${count})</button>
    ${S.token ? `<button onclick="go('orders')">My Orders</button>` : ""}
    ${S.role === "admin" ? `<button onclick="go('admin')">Admin</button>` : ""}
    ${S.token ? `<button onclick="logout()">Logout (${esc(S.name)})</button>` : `<button onclick="go('login')">Login</button>`}`;
}
document.querySelector("header h1").onclick = () => go("shop");

function go(page) {
  nav();
  ({ shop, cart, orders, admin, login }[page] || shop)();
}
function logout(silent) {
  ["token", "name", "role"].forEach(k => localStorage.removeItem(k));
  S.token = S.name = S.role = null;
  go(silent ? "login" : "shop");
}

// ---------- Shop ----------
async function shop() {
  $view.innerHTML = `<h2>Products</h2><input id="q" placeholder="Search products…" value="${esc(S.search)}" style="margin-bottom:14px" /><div id="list" class="grid"></div>`;
  document.getElementById("q").oninput = (e) => { S.search = e.target.value; loadProducts(); };
  loadProducts();
}
async function loadProducts() {
  const box = document.getElementById("list");
  try {
    S.products = await api("/api/products?search=" + encodeURIComponent(S.search));
    box.innerHTML = S.products.length ? S.products.map(p => `
      <div class="card">
        <div class="img">${p.image ? `<img src="${esc(p.image)}" alt="" />` : "📦"}</div>
        <strong>${esc(p.name)}</strong>
        <span class="muted">${esc(p.description)}</span>
        <span class="price">${money(p.price)}</span>
        <span class="muted">${p.stock > 0 ? p.stock + " in stock" : "Out of stock"}</span>
        <button class="btn" ${p.stock < 1 ? "disabled" : ""} onclick="addToCart('${p._id}')">Add to cart</button>
      </div>`).join("") : '<p class="empty">No products found.</p>';
  } catch (e) { box.innerHTML = `<p class="empty">${esc(e.message)}</p>`; }
}
function addToCart(id) {
  const p = S.products.find(x => x._id === id);
  if (!p) return;
  const line = S.cart.find(c => c.productId === id);
  if (line) { if (line.qty < p.stock) line.qty++; }
  else S.cart.push({ productId: id, name: p.name, price: p.price, qty: 1 });
  saveCart(); nav();
}

// ---------- Cart & checkout ----------
function cart() {
  if (!S.cart.length) { $view.innerHTML = '<h2>Your Cart</h2><p class="empty">Your cart is empty.</p>'; return; }
  const total = S.cart.reduce((a, c) => a + c.price * c.qty, 0);
  $view.innerHTML = `<h2>Your Cart</h2>
    ${S.cart.map((c, i) => `<div class="line"><div class="row"><div><strong>${esc(c.name)}</strong><br><span class="muted">${money(c.price)} each</span></div>
      <div class="qty"><button onclick="chg(${i},-1)">−</button><span>${c.qty}</span><button onclick="chg(${i},1)">+</button></div>
      <strong>${money(c.price * c.qty)}</strong><button class="btn red sm" onclick="rm(${i})">Remove</button></div></div>`).join("")}
    <div class="total">Total: ${money(total)}</div>
    <div class="form wide"><h3>Checkout</h3>
      <textarea id="addr" rows="3" placeholder="Delivery address"></textarea>
      <button class="btn" onclick="checkout()">Place Order</button><p class="msg" id="msg"></p></div>`;
}
function chg(i, d) { S.cart[i].qty += d; if (S.cart[i].qty < 1) S.cart.splice(i, 1); saveCart(); nav(); cart(); }
function rm(i) { S.cart.splice(i, 1); saveCart(); nav(); cart(); }
async function checkout() {
  if (!S.token) return go("login");
  try {
    await api("/api/orders", "POST", { items: S.cart.map(c => ({ productId: c.productId, qty: c.qty })), address: document.getElementById("addr").value });
    S.cart = []; saveCart(); go("orders");
  } catch (e) { document.getElementById("msg").textContent = e.message; }
}

// ---------- Orders ----------
async function orders() {
  if (!S.token) return go("login");
  $view.innerHTML = "<h2>My Orders</h2><div id='o'></div>";
  try {
    const list = await api("/api/orders/mine");
    document.getElementById("o").innerHTML = list.length ? list.map(orderCard).join("") : '<p class="empty">No orders yet.</p>';
  } catch (e) { document.getElementById("o").innerHTML = `<p class="empty">${esc(e.message)}</p>`; }
}
function orderCard(o, admin) {
  return `<div class="line"><div class="row"><strong>Order #${o._id.slice(-6).toUpperCase()}</strong><span class="badge ${o.status}">${o.status}</span></div>
    <p class="muted">${new Date(o.createdAt).toLocaleString()}${admin && o.user ? " · " + esc(o.user.name) + " (" + esc(o.user.email) + ")" : ""}</p>
    ${o.items.map(i => `<p>${esc(i.name)} × ${i.qty} — ${money(i.price * i.qty)}</p>`).join("")}
    <p class="muted">📍 ${esc(o.address)}</p><strong>Total: ${money(o.total)}</strong>
    ${admin ? `<div class="row" style="margin-top:8px"><select id="st-${o._id}">${["placed", "packed", "shipped", "delivered", "cancelled"].map(s => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select>
      <button class="btn sm" onclick="setStatus('${o._id}')">Update status</button></div>` : ""}</div>`;
}

// ---------- Admin ----------
async function admin() {
  if (S.role !== "admin") return go("shop");
  const e = S.editing || {};
  $view.innerHTML = `<h2>Admin Panel</h2>
    <form class="form wide" id="pf"><h3>${e._id ? "Edit" : "Add"} Product</h3>
      <input id="pn" placeholder="Name" required value="${esc(e.name)}" />
      <input id="pd" placeholder="Description" value="${esc(e.description)}" />
      <div class="row"><input id="pp" type="number" min="0" placeholder="Price (₹)" required value="${e.price ?? ""}" />
        <input id="ps" type="number" min="0" placeholder="Stock" required value="${e.stock ?? ""}" /></div>
      <input id="pi" placeholder="Image URL (optional)" value="${esc(e.image)}" />
      <div class="row"><button class="btn">${e._id ? "Save" : "Add product"}</button>${e._id ? '<button type="button" class="btn sec" onclick="S.editing=null;admin()">Cancel</button>' : ""}</div>
      <p class="msg" id="msg"></p></form>
    <h3 style="margin-bottom:8px">Products</h3><div id="plist"></div>
    <h3 style="margin:16px 0 8px">All Orders</h3><div id="olist"></div>`;
  document.getElementById("pf").onsubmit = saveProduct;
  try {
    S.products = await api("/api/products");
    document.getElementById("plist").innerHTML = S.products.map(p => `<div class="line"><div class="row"><div><strong>${esc(p.name)}</strong><br><span class="muted">${money(p.price)} · stock ${p.stock}</span></div>
      <button class="btn sec sm" onclick="editP('${p._id}')">Edit</button><button class="btn red sm" onclick="delP('${p._id}')">Delete</button></div></div>`).join("");
    const os = await api("/api/orders");
    document.getElementById("olist").innerHTML = os.length ? os.map(o => orderCard(o, true)).join("") : '<p class="empty">No orders yet.</p>';
  } catch (er) { document.getElementById("msg").textContent = er.message; }
}
async function saveProduct(ev) {
  ev.preventDefault();
  const body = { name: pn.value, description: pd.value, price: +pp.value, stock: +ps.value, image: pi.value };
  try {
    S.editing && S.editing._id ? await api("/api/products/" + S.editing._id, "PUT", body) : await api("/api/products", "POST", body);
    S.editing = null; admin();
  } catch (er) { document.getElementById("msg").textContent = er.message; }
}
function editP(id) { S.editing = S.products.find(p => p._id === id); admin(); window.scrollTo({ top: 0, behavior: "smooth" }); }
async function delP(id) { if (confirm("Delete this product?")) { await api("/api/products/" + id, "DELETE"); admin(); } }
async function setStatus(id) {
  await api(`/api/orders/${id}/status`, "PUT", { status: document.getElementById("st-" + id).value });
  admin();
}

// ---------- Login / Register ----------
function login(register) {
  $view.innerHTML = `<form class="form" id="af"><h2>${register ? "Create account" : "Login"}</h2>
    ${register ? '<input id="an" placeholder="Full name" required />' : ""}
    <input id="ae" type="email" placeholder="Email" required /><input id="ap" type="password" minlength="6" placeholder="Password (min 6 chars)" required />
    <button class="btn">${register ? "Register" : "Login"}</button><p class="msg" id="msg"></p>
    <button type="button" class="btn sec" onclick="login(${!register})">${register ? "Have an account? Login" : "New here? Register"}</button></form>`;
  document.getElementById("af").onsubmit = async (ev) => {
    ev.preventDefault();
    try {
      const body = { email: ae.value, password: ap.value };
      if (register) body.name = an.value;
      const d = await api(register ? "/api/auth/register" : "/api/auth/login", "POST", body);
      S.token = d.token; S.name = d.name; S.role = d.role;
      localStorage.setItem("token", d.token); localStorage.setItem("name", d.name); localStorage.setItem("role", d.role);
      go(S.cart.length ? "cart" : "shop");
    } catch (er) { document.getElementById("msg").textContent = er.message; }
  };
}

go("shop");
