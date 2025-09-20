// ======= CONFIG =======
// Replace with your Apps Script Web App URL (created below).
// app.js
const SHEET_ENDPOINT = "https://script.google.com/macros/s/AKfycbyvA4luu_oydDgQGAktFnRK3q0Yz4GTPbqEOgZjPfCNxxLYn0LRIT8urJ6xQ8W2oyuD/exec";


// Optional: cache-busting on refresh button
const cacheBuster = () => `cb=${Date.now()}`;

// Local progress key
const LS_KEY = "mathhub_progress_v1";

// ======= STATE =======
let problems = [];
let progress = new Set(JSON.parse(localStorage.getItem(LS_KEY) || "[]"));

// ======= DOM =======
const cardsEl = document.getElementById("cards");
const searchInput = document.getElementById("searchInput");
const topicFilter = document.getElementById("topicFilter");
const difficultyFilter = document.getElementById("difficultyFilter");
const refreshBtn = document.getElementById("refreshBtn");
const progressBar = document.getElementById("progressBar");
const progressLabel = document.getElementById("progressLabel");
const countLabel = document.getElementById("countLabel");

// ======= HELPERS =======
function saveProgress() {
  localStorage.setItem(LS_KEY, JSON.stringify([...progress]));
  renderProgress();
}

function renderProgress() {
  const total = problems.length || 1;
  const pct = Math.round((progress.size / total) * 100);
  progressBar.style.width = pct + "%";
  progressLabel.textContent = `${pct}% done`;
}

function normalize(str) {
  return (str || "").toLowerCase().trim();
}

function passesFilters(p) {
  const q = normalize(searchInput.value);
  const topic = topicFilter.value;
  const diff = difficultyFilter.value;

  const hit =
    normalize(p.title).includes(q) ||
    normalize(p.topic).includes(q) ||
    normalize(p.notes).includes(q);

  const topicOk = !topic || p.topic === topic;
  const diffOk = !diff || p.difficulty === diff;

  return hit && topicOk && diffOk;
}

function render() {
  // Populate topic dropdown
  const topics = [...new Set(problems.map(p => p.topic).filter(Boolean))].sort();
  const currentTopic = topicFilter.value;
  topicFilter.innerHTML = `<option value="">All Topics</option>` +
    topics.map(t => `<option ${t===currentTopic?'selected':''} value="${t}">${t}</option>`).join("");

  // Cards
  const filtered = problems.filter(passesFilters);
  countLabel.textContent = `${filtered.length} problem${filtered.length!==1?'s':''}`;

  cardsEl.innerHTML = filtered.map(p => {
    const done = progress.has(p.id);
    return `
      <article class="card" data-id="${p.id}">
        <h3>${escapeHtml(p.title)}</h3>
        <div class="badges">
          ${p.topic ? `<span class="badge">#${escapeHtml(p.topic)}</span>` : ""}
          ${p.difficulty ? `<span class="badge">${escapeHtml(p.difficulty)}</span>` : ""}
          ${p.source ? `<span class="badge">${escapeHtml(p.source)}</span>` : ""}
        </div>
        ${p.notes ? `<p class="notes">${escapeHtml(p.notes)}</p>` : ""}
        <div class="links">
          ${p.pdfUrl ? `<a class="btn" href="${p.pdfUrl}" target="_blank" rel="noopener">📄 PDF</a>` : ""}
          ${p.forumUrl ? `<a class="btn" href="${p.forumUrl}" target="_blank" rel="noopener">💬 Forum</a>` : ""}
        </div>
        <div class="actions">
          <input class="toggle" id="done-${p.id}" type="checkbox" ${done?'checked':''} />
          <label for="done-${p.id}" class="done-label">${done?'Marked done':'Mark as done'}</label>
        </div>
      </article>
    `;
  }).join("");

  // Attach listeners for toggles
  cardsEl.querySelectorAll(".toggle").forEach(box => {
    box.addEventListener("change", e => {
      const card = e.target.closest(".card");
      const id = card.dataset.id;
      if (e.target.checked) progress.add(id); else progress.delete(id);
      saveProgress();
      // Update label text without rerendering all
      const label = card.querySelector(".done-label");
      label.textContent = e.target.checked ? "Marked done" : "Mark as done";
    });
  });

  renderProgress();
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ======= FETCH =======
async function fetchProblems() {
  const url = `${SHEET_ENDPOINT}?${cacheBuster()}`;
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const data = await res.json();

  // Expecting a shape like { data: [ {id,title,pdfUrl,forumUrl,topic,difficulty,source,notes}, ... ] }
  problems = (data.data || []).map((row, i) => ({
    id: String(row.id || i+1),
    title: row.title || "Untitled",
    pdfUrl: row.pdfUrl || "",
    forumUrl: row.forumUrl || "",
    topic: row.topic || "",
    difficulty: row.difficulty || "",
    source: row.source || "",
    notes: row.notes || ""
  }));

  render();
}

// ======= EVENTS =======
searchInput.addEventListener("input", render);
topicFilter.addEventListener("change", render);
difficultyFilter.addEventListener("change", render);
refreshBtn.addEventListener("click", () => fetchProblems().catch(console.error));

// ======= INIT =======
fetchProblems().catch(err => {
  cardsEl.innerHTML = `<div class="card"><h3>Could not load data</h3><p>${escapeHtml(err.message)}</p></div>`;
  renderProgress();
});
