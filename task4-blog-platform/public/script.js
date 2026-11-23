const $view = document.getElementById("view");
const $nav = document.getElementById("nav");
const S = { token: localStorage.getItem("token"), name: localStorage.getItem("name"), id: localStorage.getItem("id") };
const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const when = (d) => new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
const $ = (id) => document.getElementById(id);

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
  $nav.innerHTML = `<button onclick="home()">Home</button>` + (S.token
    ? `<button onclick="editor()">+ New Post</button><button onclick="logout()">Logout (${esc(S.name)})</button>`
    : `<button onclick="login()">Login / Register</button>`);
}
$("brand").onclick = () => home();
function logout(silent) {
  ["token", "name", "id"].forEach(k => localStorage.removeItem(k));
  S.token = S.name = S.id = null;
  silent ? login() : home();
}

// ---------- Home: list of posts ----------
async function home() {
  nav();
  $view.innerHTML = "<h2>Latest Posts</h2><div id='list'></div>";
  try {
    const posts = await api("/api/posts");
    $("list").innerHTML = posts.length ? posts.map(p => `
      <div class="card click" onclick="openPost('${p._id}')">
        <h3>${esc(p.title)}</h3>
        <p class="muted">by ${esc(p.author?.name || "Unknown")} · ${when(p.createdAt)} · 💬 ${p.commentCount}</p>
        <p>${esc(p.content.slice(0, 160))}${p.content.length > 160 ? "…" : ""}</p>
      </div>`).join("") : '<p class="empty">No posts yet. Log in and write the first one!</p>';
  } catch (e) { $("list").innerHTML = `<p class="empty">${esc(e.message)}</p>`; }
}

// ---------- Single post + comments ----------
async function openPost(id) {
  nav();
  $view.innerHTML = '<p class="empty">Loading…</p>';
  try {
    const p = await api("/api/posts/" + id);
    const mine = S.id && p.author && p.author._id === S.id;
    $view.innerHTML = `
      <button class="btn sec sm" onclick="home()">← Back</button>
      <div class="card" style="margin-top:12px">
        <h2>${esc(p.title)}</h2>
        <p class="muted">by ${esc(p.author?.name || "Unknown")} · ${when(p.createdAt)}</p>
        <div class="content">${esc(p.content)}</div>
        ${mine ? `<div class="row"><button class="btn sm" onclick="editor('${p._id}')">Edit</button><button class="btn red sm" onclick="delPost('${p._id}')">Delete</button></div>` : ""}
      </div>
      <div class="card"><h3>Comments</h3><div id="comments"></div>
        ${S.token ? `<form id="cf" class="form" style="box-shadow:none;padding:12px 0 0"><textarea id="ct" rows="2" placeholder="Write a comment…" required></textarea><button class="btn">Post comment</button><p class="msg" id="msg"></p></form>`
          : `<p class="muted" style="margin-top:10px">Please <a href="#" onclick="login();return false">log in</a> to comment.</p>`}
      </div>`;
    loadComments(p);
    if (S.token) $("cf").onsubmit = async (e) => {
      e.preventDefault();
      try { await api(`/api/posts/${id}/comments`, "POST", { text: $("ct").value }); $("ct").value = ""; loadComments(p); }
      catch (er) { $("msg").textContent = er.message; }
    };
  } catch (e) { $view.innerHTML = `<p class="empty">${esc(e.message)}</p>`; }
}
async function loadComments(p) {
  const list = await api(`/api/posts/${p._id}/comments`);
  $("comments").innerHTML = list.length ? list.map(c => {
    const canDel = S.id && (c.author?._id === S.id || p.author?._id === S.id);
    return `<div class="comment"><strong>${esc(c.author?.name || "Unknown")}</strong> <span class="muted">${when(c.createdAt)}</span>
      <p>${esc(c.text)}</p>${canDel ? `<button class="btn red sm" onclick="delComment('${c._id}','${p._id}')">Delete</button>` : ""}</div>`;
  }).join("") : '<p class="muted">No comments yet. Be the first!</p>';
}
async function delComment(cid, pid) { await api("/api/comments/" + cid, "DELETE"); openPost(pid); }
async function delPost(id) { if (confirm("Delete this post and its comments?")) { await api("/api/posts/" + id, "DELETE"); home(); } }

// ---------- Create / edit post ----------
async function editor(id) {
  if (!S.token) return login();
  nav();
  let p = { title: "", content: "" };
  if (id) p = await api("/api/posts/" + id);
  $view.innerHTML = `<form id="pf" class="form"><h2>${id ? "Edit" : "New"} Post</h2>
    <input id="pt" placeholder="Title" required value="${esc(p.title)}" />
    <textarea id="pc" rows="10" placeholder="Write your post…" required>${esc(p.content)}</textarea>
    <div class="row"><button class="btn">${id ? "Save changes" : "Publish"}</button><button type="button" class="btn sec" onclick="home()">Cancel</button></div>
    <p class="msg" id="msg"></p></form>`;
  $("pf").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const body = { title: $("pt").value, content: $("pc").value };
      const saved = id ? await api("/api/posts/" + id, "PUT", body) : await api("/api/posts", "POST", body);
      openPost(saved._id);
    } catch (er) { $("msg").textContent = er.message; }
  };
}

// ---------- Login / Register ----------
function login(register) {
  nav();
  $view.innerHTML = `<form id="af" class="form narrow"><h2>${register ? "Create account" : "Login"}</h2>
    ${register ? '<input id="an" placeholder="Full name" required />' : ""}
    <input id="ae" type="email" placeholder="Email" required /><input id="ap" type="password" minlength="6" placeholder="Password (min 6 chars)" required />
    <button class="btn">${register ? "Register" : "Login"}</button><p class="msg" id="msg"></p>
    <button type="button" class="btn sec" onclick="login(${!register})">${register ? "Have an account? Login" : "New here? Register"}</button></form>`;
  $("af").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const body = { email: $("ae").value, password: $("ap").value };
      if (register) body.name = $("an").value;
      const d = await api(register ? "/api/auth/register" : "/api/auth/login", "POST", body);
      S.token = d.token; S.name = d.name; S.id = d.id;
      localStorage.setItem("token", d.token); localStorage.setItem("name", d.name); localStorage.setItem("id", d.id);
      home();
    } catch (er) { $("msg").textContent = er.message; }
  };
}

home();
