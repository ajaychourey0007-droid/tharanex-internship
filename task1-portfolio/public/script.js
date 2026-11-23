document.getElementById("year").textContent = new Date().getFullYear();

const esc = (s = "") => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function loadProjects() {
  const box = document.getElementById("projectList");
  try {
    const res = await fetch("/api/projects");
    const projects = await res.json();
    box.innerHTML = projects.map(p => `
      <div class="card">
        <h4>${esc(p.title)}</h4>
        <p>${esc(p.description)}</p>
        <div class="tags">${(p.tech || []).map(t => `<span>${esc(t)}</span>`).join("")}</div>
        <a href="${esc(p.github)}" target="_blank" rel="noopener">GitHub</a>
        <a href="${esc(p.live)}" target="_blank" rel="noopener">Live</a>
      </div>`).join("");
  } catch {
    box.innerHTML = "<p>Could not load projects right now.</p>";
  }
}

document.getElementById("contactForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = document.getElementById("status");
  const data = Object.fromEntries(new FormData(e.target));
  status.textContent = "Sending…";
  try {
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    status.textContent = "Thanks! Your message was sent.";
    e.target.reset();
  } catch (err) {
    status.textContent = "Error: " + err.message;
  }
});

loadProjects();
