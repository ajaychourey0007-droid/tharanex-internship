const $ = (id) => document.getElementById(id);
let token = localStorage.getItem("token");
let isRegister = false, editingId = null, filter = "";

const esc = (s = "") => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function api(url, method = "GET", body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) { logout(); }
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

// ---------- Auth ----------
function setMode(reg) {
  isRegister = reg;
  $("name").hidden = !reg;
  $("name").required = reg;
  $("authSubmit").textContent = reg ? "Create Account" : "Login";
  $("tabLogin").classList.toggle("active", !reg);
  $("tabRegister").classList.toggle("active", reg);
  $("authMsg").textContent = "";
}
$("tabLogin").onclick = () => setMode(false);
$("tabRegister").onclick = () => setMode(true);

$("authForm").onsubmit = async (e) => {
  e.preventDefault();
  try {
    const body = { email: $("email").value, password: $("password").value };
    if (isRegister) body.name = $("name").value;
    const data = await api(isRegister ? "/api/auth/register" : "/api/auth/login", "POST", body);
    token = data.token;
    localStorage.setItem("token", token);
    localStorage.setItem("name", data.name);
    e.target.reset();
    showApp();
  } catch (err) { $("authMsg").textContent = err.message; }
};

function logout() {
  token = null;
  localStorage.removeItem("token");
  localStorage.removeItem("name");
  $("authView").hidden = false;
  $("appView").hidden = true;
  $("userBox").hidden = true;
}
$("logoutBtn").onclick = logout;

function showApp() {
  $("authView").hidden = true;
  $("appView").hidden = false;
  $("userBox").hidden = false;
  $("userName").textContent = "👤 " + (localStorage.getItem("name") || "");
  loadTasks();
}

// ---------- Tasks ----------
async function loadTasks() {
  try {
    const tasks = await api("/api/tasks" + (filter ? "?status=" + filter : ""));
    $("taskList").innerHTML = tasks.length ? tasks.map(card).join("") : '<p class="empty">No tasks yet. Add your first one above!</p>';
  } catch (err) { $("taskList").innerHTML = `<p class="empty">${esc(err.message)}</p>`; }
}

function card(t) {
  const due = t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "No due date";
  return `<div class="task ${t.priority} ${t.status}">
    <h3>${esc(t.title)}</h3>
    ${t.description ? `<p>${esc(t.description)}</p>` : ""}
    <div class="meta"><span>${esc(t.priority)} priority</span><span>${esc(t.status)}</span><span>📅 ${due}</span></div>
    <div class="actions">
      <button class="small" onclick="toggleDone('${t._id}','${t.status}')">${t.status === "done" ? "Reopen" : "Mark done"}</button>
      <button class="small" onclick='startEdit(${JSON.stringify(t).replace(/'/g, "&#39;")})'>Edit</button>
      <button class="small del" onclick="removeTask('${t._id}')">Delete</button>
    </div></div>`;
}

$("taskForm").onsubmit = async (e) => {
  e.preventDefault();
  const body = {
    title: $("title").value, description: $("description").value,
    priority: $("priority").value, status: $("status").value, dueDate: $("dueDate").value || null,
  };
  try {
    await api(editingId ? "/api/tasks/" + editingId : "/api/tasks", editingId ? "PUT" : "POST", body);
    resetForm();
    loadTasks();
  } catch (err) { $("taskMsg").textContent = err.message; }
};

function startEdit(t) {
  editingId = t._id;
  $("title").value = t.title; $("description").value = t.description || "";
  $("priority").value = t.priority; $("status").value = t.status;
  $("dueDate").value = t.dueDate ? t.dueDate.slice(0, 10) : "";
  $("formTitle").textContent = "Edit Task"; $("saveBtn").textContent = "Save Changes"; $("cancelEdit").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function resetForm() {
  editingId = null; $("taskForm").reset(); $("taskMsg").textContent = "";
  $("formTitle").textContent = "Add Task"; $("saveBtn").textContent = "Add Task"; $("cancelEdit").hidden = true;
}
$("cancelEdit").onclick = resetForm;

async function toggleDone(id, status) {
  await api("/api/tasks/" + id, "PUT", { status: status === "done" ? "todo" : "done" });
  loadTasks();
}
async function removeTask(id) {
  if (!confirm("Delete this task?")) return;
  await api("/api/tasks/" + id, "DELETE");
  loadTasks();
}

document.querySelectorAll(".chip").forEach((b) => b.onclick = () => {
  document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
  b.classList.add("active");
  filter = b.dataset.f;
  loadTasks();
});

if (token) showApp();
