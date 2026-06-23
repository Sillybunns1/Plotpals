const STORAGE_KEY = "writersVaultV6";
const CLOUD_TABLE = "writer_vaults";

const defaultData = {
  activeSeriesId: null,
  activeBookId: null,
  activeChapterId: null,
  user: null,
  series: [],
  books: [],
  characters: [],
  relationships: [],
  timeline: [],
  chapterPlans: [],
  threads: [],
  world: []
};

let supabaseClient = null;
let data = loadData();
let cloudSaveTimer = null;

function initSupabase() {
  if (!window.supabase) {
    console.warn("Supabase library did not load. Local mode only.");
    return;
  }
  supabaseClient = window.supabase.createClient(
    window.WRITERS_VAULT_SUPABASE_URL,
    window.WRITERS_VAULT_SUPABASE_KEY
  );
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultData);
  try { return { ...structuredClone(defaultData), ...JSON.parse(saved) }; }
  catch { return structuredClone(defaultData); }
}
function saveData(render = true, scheduleCloud = true) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
  if (render) renderAll();
  if (scheduleCloud) scheduleCloudSave();
}
function val(id) { return document.getElementById(id).value.trim(); }
function setVal(id, value) { const el = document.getElementById(id); if (el) el.value = value || ""; }
function clearFields(ids) { ids.forEach(id => setVal(id, "")); }
function escapeHTML(str = "") {
  return String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function detail(label, value) {
  if (!value) return "";
  return `<p><strong>${escapeHTML(label)}:</strong> ${escapeHTML(value).replaceAll("\n", "<br>")}</p>`;
}
function countWords(text = "") { return (text.trim().match(/\b[\w’'-]+\b/g) || []).length; }
function activeSeries() { return data.series.find(s => s.id === data.activeSeriesId) || null; }
function activeBook() { return data.books.find(b => b.id === data.activeBookId) || null; }
function activeManuscriptChapter() {
  const book = activeBook();
  if (!book) return null;
  return (book.manuscript || []).find(c => c.id === data.activeChapterId) || null;
}
function ensureProject() {
  if (!data.series.length) createSeries("Untitled Series", false);
  if (!data.books.length) createBook("Untitled Book", false);
  if (!data.activeSeriesId) data.activeSeriesId = data.series[0]?.id || null;
  if (!data.activeBookId) data.activeBookId = data.books.find(b => b.seriesId === data.activeSeriesId)?.id || data.books[0]?.id || null;
  const book = activeBook();
  if (book && (!book.manuscript || !book.manuscript.length)) {
    book.manuscript = [{ id: uid(), title: "Chapter One", content: "", created: new Date().toISOString() }];
    data.activeChapterId = book.manuscript[0].id;
  }
}

async function refreshSession() {
  if (!supabaseClient) return;
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData?.session?.user || null;
  data.user = user ? { id: user.id, email: user.email } : null;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
  renderAccount();
}
async function signUp() {
  if (!supabaseClient) return setAuthMessage("Supabase could not load. Check internet connection.");
  const email = val("authEmail");
  const password = val("authPassword");
  const { data: result, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) return setAuthMessage(error.message);
  setAuthMessage("Sign up successful. Check your email if confirmation is required.");
  await refreshSession();
}
async function signIn() {
  if (!supabaseClient) return setAuthMessage("Supabase could not load. Check internet connection.");
  const email = val("authEmail");
  const password = val("authPassword");
  const { data: result, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return setAuthMessage(error.message);
  data.user = { id: result.user.id, email: result.user.email };
  saveData(true, false);
  setAuthMessage("Signed in.");
  closeModal("authModal");
  await loadFromCloud(false);
}
async function signOut() {
  if (supabaseClient) await supabaseClient.auth.signOut();
  data.user = null;
  saveData(true, false);
  setAuthMessage("Signed out.");
}
async function sendPasswordReset() {
  if (!supabaseClient) return setAuthMessage("Supabase could not load.");
  const email = val("authEmail");
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
  setAuthMessage(error ? error.message : "Password reset email sent.");
}
function setAuthMessage(message) {
  const el = document.getElementById("authMessage");
  if (el) el.textContent = message;
}
function renderAccount() {
  const status = document.getElementById("accountStatus");
  const sync = document.getElementById("syncStatus");
  if (!status || !sync) return;
  if (data.user?.email) {
    status.textContent = data.user.email;
    sync.textContent = "Signed in. Cloud sync available.";
  } else {
    status.textContent = "Local Mode";
    sync.textContent = "Sign in to sync across devices.";
  }
}

function scheduleCloudSave() {
  if (!data.user?.id || !supabaseClient) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => syncToCloud(false), 1500);
}

async function syncToCloud(showAlert = true) {
  if (!supabaseClient) {
    if (showAlert) alert("Supabase is not loaded. Check your internet connection.");
    return;
  }
  await refreshSession();
  if (!data.user?.id) {
    if (showAlert) alert("Sign in first.");
    return;
  }

  const payload = {
    user_id: data.user.id,
    user_email: data.user.email,
    vault_data: data,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient
    .from(CLOUD_TABLE)
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    const msg = "Cloud sync failed. Make sure the writer_vaults table exists and RLS policies are set. " + error.message;
    document.getElementById("syncStatus").textContent = "Sync failed.";
    if (showAlert) alert(msg);
    console.error(msg);
    return;
  }

  document.getElementById("syncStatus").textContent = "Synced " + new Date().toLocaleTimeString();
  if (showAlert) alert("Synced to Supabase.");
}

async function loadFromCloud(showAlert = true) {
  if (!supabaseClient) {
    if (showAlert) alert("Supabase is not loaded. Check your internet connection.");
    return;
  }
  await refreshSession();
  if (!data.user?.id) {
    if (showAlert) alert("Sign in first.");
    return;
  }

  const { data: rows, error } = await supabaseClient
    .from(CLOUD_TABLE)
    .select("vault_data, updated_at")
    .eq("user_id", data.user.id)
    .limit(1);

  if (error) {
    const msg = "Could not load cloud data. Make sure the writer_vaults table exists and RLS policies are set. " + error.message;
    if (showAlert) alert(msg);
    console.error(msg);
    return;
  }

  if (!rows || !rows.length || !rows[0].vault_data) {
    if (showAlert) alert("No cloud vault found yet. Use Sync Now to create one.");
    return;
  }

  const currentUser = data.user;
  data = { ...structuredClone(defaultData), ...rows[0].vault_data, user: currentUser };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
  renderAll();
  document.getElementById("syncStatus").textContent = "Loaded cloud save.";
  if (showAlert) alert("Loaded from Supabase.");
}

function createSeries(title = null, shouldRender = true) {
  const name = title || prompt("Series title?") || "Untitled Series";
  const series = { id: uid(), title: name, genre: "", synopsis: "", theme: "", mysteries: "", foreshadowing: "", created: new Date().toISOString() };
  data.series.push(series);
  data.activeSeriesId = series.id;
  if (shouldRender) saveData(); else saveData(false, false);
}
function createBook(title = null, shouldRender = true) {
  if (!data.activeSeriesId && !data.series.length) createSeries("Untitled Series", false);
  const name = title || prompt("Book title?") || "Untitled Book";
  const book = {
    id: uid(), seriesId: data.activeSeriesId, title: name, status: "Planning", summary: "", theme: "", notes: "",
    manuscript: [{ id: uid(), title: "Chapter One", content: "", created: new Date().toISOString() }],
    created: new Date().toISOString()
  };
  data.books.push(book);
  data.activeBookId = book.id;
  data.activeChapterId = book.manuscript[0].id;
  if (shouldRender) saveData(); else saveData(false, false);
}
function setActiveSeries(id) {
  data.activeSeriesId = id;
  const firstBook = data.books.find(b => b.seriesId === id);
  data.activeBookId = firstBook?.id || null;
  data.activeChapterId = firstBook?.manuscript?.[0]?.id || null;
  saveData();
}
function setActiveBook(id) {
  data.activeBookId = id;
  const book = activeBook();
  data.activeChapterId = book?.manuscript?.[0]?.id || null;
  saveData();
}

function makeCard(title, body, onDelete) {
  const template = document.getElementById("cardTemplate");
  const node = template.content.cloneNode(true);
  node.querySelector("h3").textContent = title || "Untitled";
  node.querySelector(".card-body").innerHTML = body;
  node.querySelector(".delete-btn").onclick = onDelete;
  return node;
}
function deleteItem(collection, id) {
  data[collection] = data[collection].filter(item => item.id !== id);
  saveData();
}
function scopedItem(scope) {
  return scope === "series"
    ? { scope, seriesId: data.activeSeriesId, bookId: null }
    : { scope, seriesId: data.activeSeriesId, bookId: data.activeBookId };
}
function visibleByScope(item) {
  return item.seriesId === data.activeSeriesId && (item.scope === "series" || item.bookId === data.activeBookId);
}

function addManuscriptChapter() {
  const book = activeBook();
  if (!book) return alert("Create or select a book first.");
  if (!book.manuscript) book.manuscript = [];
  const chapter = { id: uid(), title: `Chapter ${book.manuscript.length + 1}`, content: "", created: new Date().toISOString() };
  book.manuscript.push(chapter);
  data.activeChapterId = chapter.id;
  saveData();
}
function selectManuscriptChapter(id) { data.activeChapterId = id; saveData(); }
function saveCurrentManuscriptChapter(render = false) {
  const ch = activeManuscriptChapter();
  if (!ch) return;
  ch.title = val("currentChapterTitle");
  ch.content = document.getElementById("manuscriptEditor").value;
  saveData(render);
  document.getElementById("chapterWordCount").textContent = countWords(ch.content);
}
function deleteManuscriptChapter(id) {
  const book = activeBook();
  if (!book) return;
  if (!confirm("Delete this manuscript chapter?")) return;
  book.manuscript = (book.manuscript || []).filter(c => c.id !== id);
  data.activeChapterId = book.manuscript[0]?.id || null;
  saveData();
}
function wrapSelection(before, after) {
  const editor = document.getElementById("manuscriptEditor");
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const selected = editor.value.slice(start, end);
  editor.value = editor.value.slice(0, start) + before + selected + after + editor.value.slice(end);
  editor.focus();
  editor.selectionStart = start + before.length;
  editor.selectionEnd = end + before.length;
  saveCurrentManuscriptChapter(false);
}
function insertText(text) {
  const editor = document.getElementById("manuscriptEditor");
  const start = editor.selectionStart;
  editor.value = editor.value.slice(0, start) + text + editor.value.slice(start);
  editor.focus();
  editor.selectionStart = editor.selectionEnd = start + text.length;
  saveCurrentManuscriptChapter(false);
}
function toggleFullscreen() {
  document.querySelector(".manuscript-panel").classList.toggle("fullscreen");
}

function addChapterPlan() {
  data.chapterPlans.push({ id: uid(), seriesId: data.activeSeriesId, bookId: data.activeBookId, scope: "book",
    number: val("chapterNumber"), pov: val("chapterPOV"), wordTarget: val("chapterWordTarget"),
    goal: val("chapterGoal"), conflict: val("chapterConflict"), outcome: val("chapterOutcome"),
    emotion: val("chapterEmotion"), foreshadowing: val("chapterForeshadowing"), created: new Date().toISOString()
  });
  clearFields(["chapterNumber","chapterPOV","chapterWordTarget","chapterGoal","chapterConflict","chapterOutcome","chapterEmotion","chapterForeshadowing"]);
  saveData();
}
function addCharacter() {
  data.characters.push({ id: uid(), ...scopedItem(val("charScope")), name: val("charName"), role: val("charRole"),
    species: val("charSpecies"), description: val("charDescription"), personality: val("charPersonality"),
    wound: val("charWound"), arc: val("charArc"), voice: val("charVoice"), relationships: val("charRelationships"), created: new Date().toISOString()
  });
  clearFields(["charName","charSpecies","charDescription","charPersonality","charWound","charArc","charVoice","charRelationships"]);
  saveData();
}
function addThread() {
  data.threads.push({ id: uid(), ...scopedItem(val("threadScope")), title: val("threadTitle"), status: val("threadStatus"),
    setup: val("threadSetup"), payoff: val("threadPayoff"), created: new Date().toISOString()
  });
  clearFields(["threadTitle","threadSetup","threadPayoff"]);
  saveData();
}
function addTimeline() {
  data.timeline.push({ id: uid(), ...scopedItem(val("timeScope")), when: val("timeWhen"), event: val("timeEvent"),
    impact: val("timeImpact"), created: new Date().toISOString()
  });
  clearFields(["timeWhen","timeEvent","timeImpact"]);
  saveData();
}
function addWorld() {
  data.world.push({ id: uid(), ...scopedItem(val("worldScope")), name: val("worldName"), category: val("worldCategory"),
    description: val("worldDescription"), rules: val("worldRules"), created: new Date().toISOString()
  });
  clearFields(["worldName","worldDescription","worldRules"]);
  saveData();
}
function addRelationship() {
  data.relationships.push({ id: uid(), ...scopedItem(val("relScope")), a: val("relA"), b: val("relB"), type: val("relType"),
    notes: val("relNotes"), created: new Date().toISOString()
  });
  clearFields(["relA","relB","relType","relNotes"]);
  saveData();
}

function renderSelectors() {
  const seriesSelect = document.getElementById("activeSeries");
  seriesSelect.innerHTML = data.series.map(s => `<option value="${s.id}" ${s.id === data.activeSeriesId ? "selected" : ""}>${escapeHTML(s.title)}</option>`).join("");
  const bookSelect = document.getElementById("activeBook");
  const books = data.books.filter(b => b.seriesId === data.activeSeriesId);
  bookSelect.innerHTML = books.length
    ? books.map(b => `<option value="${b.id}" ${b.id === data.activeBookId ? "selected" : ""}>${escapeHTML(b.title)}</option>`).join("")
    : `<option>No books yet</option>`;
}
function renderOverview() {
  const s = activeSeries();
  const b = activeBook();
  setVal("seriesTitleEdit", s?.title);
  setVal("seriesGenreEdit", s?.genre);
  setVal("seriesSynopsisEdit", s?.synopsis);
  setVal("seriesThemeEdit", s?.theme);
  setVal("seriesMysteriesEdit", s?.mysteries);
  setVal("seriesForeshadowingEdit", s?.foreshadowing);
  setVal("bookTitleEdit", b?.title);
  setVal("bookStatusEdit", b?.status);
  setVal("bookSummaryEdit", b?.summary);
  setVal("bookThemeEdit", b?.theme);
  setVal("bookNotesEdit", b?.notes);

  const manuscriptWords = (b?.manuscript || []).reduce((sum, ch) => sum + countWords(ch.content), 0);
  document.getElementById("statWords").textContent = manuscriptWords;
  document.getElementById("statChapters").textContent = (b?.manuscript || []).length;
  document.getElementById("statCharacters").textContent = data.characters.filter(visibleByScope).length;
  document.getElementById("statThreads").textContent = data.threads.filter(t => visibleByScope(t) && t.status !== "Closed").length;
  document.getElementById("projectPath").textContent = `${s?.title || "No series"} → ${b?.title || "No book selected"}`;
}
function saveOverviewFields(render = false) {
  const s = activeSeries();
  const b = activeBook();
  if (s) {
    s.title = val("seriesTitleEdit"); s.genre = val("seriesGenreEdit"); s.synopsis = val("seriesSynopsisEdit");
    s.theme = val("seriesThemeEdit"); s.mysteries = val("seriesMysteriesEdit"); s.foreshadowing = val("seriesForeshadowingEdit");
  }
  if (b) {
    b.title = val("bookTitleEdit"); b.status = val("bookStatusEdit"); b.summary = val("bookSummaryEdit");
    b.theme = val("bookThemeEdit"); b.notes = val("bookNotesEdit");
  }
  saveData(render);
}

function renderManuscript() {
  const book = activeBook();
  const list = document.getElementById("manuscriptChapterList");
  list.innerHTML = "";
  (book?.manuscript || []).forEach(ch => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <button class="chapter-button ${ch.id === data.activeChapterId ? "active" : ""}" onclick="selectManuscriptChapter('${ch.id}')">
        ${escapeHTML(ch.title || "Untitled")}<br><small>${countWords(ch.content)} words</small>
      </button>
      <button class="delete-btn" onclick="deleteManuscriptChapter('${ch.id}')">Delete</button>
    `;
    list.appendChild(wrapper);
  });
  const ch = activeManuscriptChapter();
  setVal("currentChapterTitle", ch?.title || "");
  const editor = document.getElementById("manuscriptEditor");
  editor.value = ch?.content || "";
  document.getElementById("chapterWordCount").textContent = countWords(editor.value);
}
function renderCardList(collection, elId, titleKey, bodyFn) {
  const el = document.getElementById(elId);
  el.innerHTML = "";
  data[collection].filter(visibleByScope).forEach(item => {
    el.appendChild(makeCard(item[titleKey], bodyFn(item), () => deleteItem(collection, item.id)));
  });
}
function renderAllLists() {
  renderCardList("chapterPlans", "chapterPlanList", "number", item => `
    <span class="tag">Book</span>${detail("POV", item.pov)}${detail("Target Words", item.wordTarget)}
    ${detail("Goal", item.goal)}${detail("Conflict", item.conflict)}${detail("Outcome", item.outcome)}
    ${detail("Emotional Beat", item.emotion)}${detail("Foreshadowing", item.foreshadowing)}
  `);
  renderCardList("characters", "characterList", "name", item => `
    <span class="tag">${escapeHTML(item.scope)}</span><span class="tag">${escapeHTML(item.role)}</span><span class="tag">${escapeHTML(item.species)}</span>
    ${detail("Description", item.description)}${detail("Personality", item.personality)}
    ${detail("Core Wound / Fear / Desire", item.wound)}${detail("Arc", item.arc)}${detail("Voice", item.voice)}${detail("Relationships", item.relationships)}
  `);
  renderCardList("threads", "threadList", "title", item => `
    <span class="tag">${escapeHTML(item.scope)}</span><span class="tag">${escapeHTML(item.status)}</span>
    ${detail("Setup", item.setup)}${detail("Payoff", item.payoff)}
  `);
  renderCardList("world", "worldList", "name", item => `
    <span class="tag">${escapeHTML(item.scope)}</span><span class="tag">${escapeHTML(item.category)}</span>
    ${detail("Description", item.description)}${detail("Rules / Notes", item.rules)}
  `);

  const tl = document.getElementById("timelineList");
  tl.innerHTML = "";
  data.timeline.filter(visibleByScope).forEach(item => {
    const div = document.createElement("article");
    div.className = "item-card timeline-item";
    div.innerHTML = `<div class="card-header"><h3>${escapeHTML(item.when || "Unplaced Event")}</h3><button class="delete-btn">Delete</button></div>
    <div class="card-body"><span class="tag">${escapeHTML(item.scope)}</span>${detail("Event", item.event)}${detail("Impact", item.impact)}</div>`;
    div.querySelector("button").onclick = () => deleteItem("timeline", item.id);
    tl.appendChild(div);
  });

  const map = document.getElementById("relationshipMap");
  const list = document.getElementById("relationshipList");
  map.innerHTML = "";
  list.innerHTML = "";
  const rels = data.relationships.filter(visibleByScope);
  if (!rels.length) map.innerHTML = "<p>No relationships yet.</p>";
  rels.forEach(item => {
    const node = document.createElement("div");
    node.className = "rel-node";
    node.textContent = `${item.a || "A"} → ${item.b || "B"} (${item.type || "connection"})`;
    map.appendChild(node);
    list.appendChild(makeCard(`${item.a} + ${item.b}`, `<span class="tag">${escapeHTML(item.scope)}</span>${detail("Type", item.type)}${detail("Notes", item.notes)}`, () => deleteItem("relationships", item.id)));
  });
}
function renderRawData() {
  const raw = document.getElementById("rawData");
  if (raw) raw.value = JSON.stringify(data, null, 2);
}
function renderAll() {
  ensureProject();
  renderSelectors();
  renderOverview();
  renderManuscript();
  renderAllLists();
  renderRawData();
  renderAccount();
  runSearch();
}

function setView(view) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(view).classList.add("active");
  document.querySelector(`[data-view="${view}"]`).classList.add("active");
  const titles = {
    overview: "Overview", write: "Manuscript Editor", chapters: "Chapter Planner", characters: "Characters",
    plot: "Plot Threads", timeline: "Timeline", world: "Worldbuilding", relationships: "Relationships",
    exports: "Export", backup: "Backup"
  };
  document.getElementById("viewTitle").textContent = titles[view];
}
function searchableItems() {
  const b = activeBook();
  const manuscript = (b?.manuscript || []).map(ch => ({ type: "Manuscript", title: ch.title, text: JSON.stringify(ch).toLowerCase() }));
  const collections = [
    ["Character", data.characters, "name"], ["Relationship", data.relationships, "type"], ["Timeline", data.timeline, "when"],
    ["Chapter Plan", data.chapterPlans, "number"], ["Plot Thread", data.threads, "title"], ["Worldbuilding", data.world, "name"]
  ];
  return [
    { type: "Series", title: activeSeries()?.title, text: JSON.stringify(activeSeries() || {}).toLowerCase() },
    { type: "Book", title: b?.title, text: JSON.stringify(b || {}).toLowerCase() },
    ...manuscript,
    ...collections.flatMap(([type, arr, key]) => arr.filter(visibleByScope).map(item => ({ type, title: item[key] || "Untitled", text: JSON.stringify(item).toLowerCase() })))
  ];
}
function runSearch() {
  const q = document.getElementById("globalSearch").value.trim().toLowerCase();
  const box = document.getElementById("searchResults");
  if (!q) { box.classList.add("hidden"); box.innerHTML = ""; return; }
  const matches = searchableItems().filter(item => item.text.includes(q));
  box.classList.remove("hidden");
  box.innerHTML = `<h3>Search Results</h3>` + (matches.length ? matches.map(m => `<p><strong>${escapeHTML(m.type)}:</strong> ${escapeHTML(m.title || "Untitled")}</p>`).join("") : "<p>No matches found.</p>");
}

function manuscriptText() {
  const book = activeBook();
  return (book?.manuscript || []).map(ch => `${ch.title}\n\n${ch.content}`).join("\n\n\n");
}
function exportManuscriptTxt() {
  const book = activeBook();
  if (!book) return alert("No book selected.");
  downloadFile(`${safeFile(book.title)}.txt`, manuscriptText(), "text/plain");
}
function exportManuscriptDoc() {
  const book = activeBook();
  if (!book) return alert("No book selected.");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(book.title)}</title></head><body><h1>${escapeHTML(book.title)}</h1>${(book.manuscript || []).map(ch => `<h2>${escapeHTML(ch.title)}</h2><p>${escapeHTML(ch.content).replaceAll("\n\n","</p><p>").replaceAll("\n","<br>")}</p>`).join("")}</body></html>`;
  downloadFile(`${safeFile(book.title)}.doc`, html, "application/msword");
}
function exportSeriesBibleDoc() {
  const s = activeSeries();
  const b = activeBook();
  if (!s) return alert("No series selected.");
  const chars = data.characters.filter(visibleByScope);
  const threads = data.threads.filter(visibleByScope);
  const world = data.world.filter(visibleByScope);
  const timeline = data.timeline.filter(visibleByScope);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(s.title)} Bible</title></head><body>
  <h1>${escapeHTML(s.title)} Bible</h1>
  <h2>Series</h2><p>${escapeHTML(s.synopsis || "")}</p><p><strong>Theme:</strong> ${escapeHTML(s.theme || "")}</p>
  <h2>Book</h2><h3>${escapeHTML(b?.title || "")}</h3><p>${escapeHTML(b?.summary || "")}</p>
  <h2>Characters</h2>${chars.map(c => `<h3>${escapeHTML(c.name)}</h3><p>${escapeHTML(c.personality || "")}</p><p>${escapeHTML(c.arc || "")}</p>`).join("")}
  <h2>Timeline</h2>${timeline.map(t => `<p><strong>${escapeHTML(t.when || "")}</strong>: ${escapeHTML(t.event || "")}</p>`).join("")}
  <h2>Plot Threads</h2>${threads.map(t => `<h3>${escapeHTML(t.title)}</h3><p>${escapeHTML(t.setup || "")}</p><p>${escapeHTML(t.payoff || "")}</p>`).join("")}
  <h2>Worldbuilding</h2>${world.map(w => `<h3>${escapeHTML(w.name)}</h3><p>${escapeHTML(w.description || "")}</p>`).join("")}
  </body></html>`;
  downloadFile(`${safeFile(s.title)}-series-bible.doc`, html, "application/msword");
}
function exportManuscriptPDF() {
  const book = activeBook();
  if (!book) return alert("No book selected.");
  const area = document.getElementById("printArea");
  area.innerHTML = `<h1>${escapeHTML(book.title)}</h1>${(book.manuscript || []).map(ch => `<h2>${escapeHTML(ch.title)}</h2><p>${escapeHTML(ch.content).replaceAll("\n\n","</p><p>").replaceAll("\n","<br>")}</p>`).join("")}`;
  window.print();
}
function exportData() {
  downloadFile("writers-vault-v6-backup.json", JSON.stringify(data, null, 2), "application/json");
}
function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
function safeFile(name) { return (name || "manuscript").replace(/[^\w\d-]+/g, "-"); }
function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try { data = { ...structuredClone(defaultData), ...JSON.parse(reader.result) }; saveData(); alert("Backup imported."); }
    catch { alert("Could not import this file."); }
  };
  reader.readAsText(file);
}
function resetAll() {
  if (!confirm("Delete all local writing data from this browser? This does not delete cloud data.")) return;
  data = structuredClone(defaultData);
  saveData(true, false);
}

function openModal(id) { document.getElementById(id).classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id).classList.add("hidden"); }

document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));
document.getElementById("globalSearch").addEventListener("input", runSearch);
document.getElementById("clearSearch").addEventListener("click", () => { setVal("globalSearch", ""); runSearch(); });

["seriesTitleEdit","seriesGenreEdit","seriesSynopsisEdit","seriesThemeEdit","seriesMysteriesEdit","seriesForeshadowingEdit","bookTitleEdit","bookStatusEdit","bookSummaryEdit","bookThemeEdit","bookNotesEdit"].forEach(id => {
  document.getElementById(id).addEventListener("input", () => saveOverviewFields(true));
});
document.getElementById("currentChapterTitle").addEventListener("input", () => saveCurrentManuscriptChapter(true));
document.getElementById("manuscriptEditor").addEventListener("input", () => saveCurrentManuscriptChapter(false));

initSupabase();
refreshSession().then(renderAll);
