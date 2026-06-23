const STORAGE_KEY = "writersVaultV5";
const SETTINGS_KEY = "writersVaultV5Settings";

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

const defaultSettings = {
  email: "",
  supabaseUrl: "",
  supabaseAnonKey: "",
  openaiApiKey: "",
  openaiModel: "gpt-4.1-mini"
};

let data = loadData();
let settings = loadSettings();

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultData);
  try { return { ...structuredClone(defaultData), ...JSON.parse(saved) }; }
  catch { return structuredClone(defaultData); }
}
function loadSettings() {
  const saved = localStorage.getItem(SETTINGS_KEY);
  if (!saved) return structuredClone(defaultSettings);
  try { return { ...structuredClone(defaultSettings), ...JSON.parse(saved) }; }
  catch { return structuredClone(defaultSettings); }
}
function saveData(render = true) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
  if (render) renderAll();
}
function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings, null, 2));
  renderAccount();
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

function createSeries(title = null, shouldRender = true) {
  const name = title || prompt("Series title?") || "Untitled Series";
  const series = { id: uid(), title: name, genre: "", synopsis: "", theme: "", mysteries: "", foreshadowing: "", created: new Date().toISOString() };
  data.series.push(series);
  data.activeSeriesId = series.id;
  if (shouldRender) saveData(); else saveData(false);
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
  if (shouldRender) saveData(); else saveData(false);
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
function renderAICharacterSelect() {
  const select = document.getElementById("aiCharacterSelect");
  if (!select) return;
  const chars = data.characters.filter(visibleByScope);
  select.innerHTML = chars.length ? chars.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join("") : `<option>No characters yet</option>`;
}
function renderRawData() {
  const raw = document.getElementById("rawData");
  if (raw) raw.value = JSON.stringify(data, null, 2);
}
function renderAccount() {
  const hasCloud = settings.supabaseUrl && settings.supabaseAnonKey;
  document.getElementById("accountStatus").textContent = data.user?.email || settings.email || "Local Mode";
  document.getElementById("syncStatus").textContent = hasCloud ? "Cloud-ready settings saved." : "Saved in this browser.";
  setVal("userEmail", settings.email);
  setVal("supabaseUrl", settings.supabaseUrl);
  setVal("supabaseAnonKey", settings.supabaseAnonKey);
  setVal("openaiApiKey", settings.openaiApiKey);
  setVal("openaiModel", settings.openaiModel);
}
function renderAll() {
  ensureProject();
  renderSelectors();
  renderOverview();
  renderManuscript();
  renderAllLists();
  renderAICharacterSelect();
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
    ai: "AI Tools", exports: "Export", backup: "Backup"
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
function exportManuscriptPDF() {
  const book = activeBook();
  if (!book) return alert("No book selected.");
  const area = document.getElementById("printArea");
  area.innerHTML = `<h1>${escapeHTML(book.title)}</h1>${(book.manuscript || []).map(ch => `<h2>${escapeHTML(ch.title)}</h2><p>${escapeHTML(ch.content).replaceAll("\n\n","</p><p>").replaceAll("\n","<br>")}</p>`).join("")}`;
  window.print();
}
function exportData() {
  downloadFile("writers-vault-v5-backup.json", JSON.stringify(data, null, 2), "application/json");
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
  if (!confirm("Delete all saved writing data from this browser?")) return;
  data = structuredClone(defaultData);
  saveData();
}

function openModal(id) { document.getElementById(id).classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id).classList.add("hidden"); }
function saveCloudSettings() {
  settings.email = val("userEmail");
  settings.supabaseUrl = val("supabaseUrl");
  settings.supabaseAnonKey = val("supabaseAnonKey");
  saveSettings();
  alert("Cloud settings saved. This build includes the UI/scaffold; connect the Supabase table using README instructions.");
}
function saveAISettings() {
  settings.openaiApiKey = val("openaiApiKey");
  settings.openaiModel = val("openaiModel") || "gpt-4.1-mini";
  saveSettings();
  alert("AI settings saved.");
}
function signInDemo() {
  settings.email = val("userEmail") || "writer@example.com";
  data.user = { email: settings.email, mode: "demo" };
  saveSettings();
  saveData();
}
function signOut() {
  data.user = null;
  saveData();
}
function syncToCloud() {
  if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
    alert("Cloud settings are not configured yet. Open Settings and add Supabase details.");
    return;
  }
  localStorage.setItem("writersVaultV5LastCloudPayload", JSON.stringify({ email: settings.email, data }, null, 2));
  document.getElementById("syncStatus").textContent = "Cloud payload prepared locally.";
  alert("Cloud sync scaffold is ready. To make it live, connect the Supabase table from README.");
}

function localChapterAnalysis(ch) {
  const text = ch?.content || "";
  const words = countWords(text);
  const hasDialogue = /["“”]/.test(text);
  const hasSceneBreak = /---|\*\s?\*\s?\*/.test(text);
  const paragraphs = text.split(/\n\s*\n/).filter(Boolean).length;
  return `LOCAL CHAPTER ANALYSIS

Chapter: ${ch?.title || "Untitled"}
Word Count: ${words}
Paragraphs: ${paragraphs}

Pacing:
- ${words < 500 ? "This chapter is very short. It may read more like a scene or fragment." : "Length is workable for a draft chapter/scene."}
- ${paragraphs < 4 ? "Consider breaking action and emotion into more paragraphs for readability." : "Paragraphing has enough shape to review."}

Dialogue:
- ${hasDialogue ? "Dialogue appears to be present." : "No clear dialogue detected. If this is meant to be an emotional/interpersonal chapter, consider adding spoken tension."}

Scene Structure:
- Check that the chapter has a goal, conflict, turning point, and consequence.
- Make sure the ending leaves either a question, emotional shift, or decision.

Continuity:
- Compare this chapter against your Characters, Timeline, and Plot Threads tabs.
- Add any important new detail to the bible so it does not get lost.`;
}
function localCharacterAnalysis(char) {
  const ch = activeManuscriptChapter();
  const chapterText = ch?.content || "";
  const mentioned = char?.name && chapterText.toLowerCase().includes(char.name.toLowerCase());
  return `LOCAL CHARACTER CONSISTENCY CHECK

Character: ${char?.name || "None selected"}

Profile Summary:
Role: ${char?.role || ""}
Species/Identity: ${char?.species || ""}
Personality: ${char?.personality || ""}
Core Wound/Fear/Desire: ${char?.wound || ""}
Arc: ${char?.arc || ""}
Voice: ${char?.voice || ""}

Current Chapter Mention:
- ${mentioned ? "This character is mentioned in the current chapter." : "This character name was not detected in the current chapter."}

Checklist:
- Does the character speak in their established voice?
- Are their actions connected to their wound, fear, desire, or arc?
- Are they reacting based on what they know, not what the author knows?
- Did this chapter change them, reveal them, or pressure them?
- If something changed, update the character profile.`;
}
function localTimelineAnalysis() {
  const events = data.timeline.filter(visibleByScope);
  return `LOCAL TIMELINE CONSISTENCY CHECK

Events Found: ${events.length}

Timeline Notes:
${events.map((e, i) => `${i + 1}. ${e.when || "Unplaced"} — ${e.event || "No event description"}`).join("\n") || "No timeline events yet."}

Checklist:
- Add exact or relative dates whenever possible.
- Mark whether each event belongs to the whole series or only this book.
- Check character ages against major events.
- Check cause/effect order.
- Add missing events from manuscript chapters after drafting.`;
}

async function callOpenAI(prompt) {
  if (!settings.openaiApiKey) return null;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${settings.openaiApiKey}`
    },
    body: JSON.stringify({
      model: settings.openaiModel || "gpt-4.1-mini",
      input: prompt
    })
  });
  if (!response.ok) throw new Error("AI request failed.");
  const result = await response.json();
  return result.output_text || JSON.stringify(result, null, 2);
}
async function analyzeCurrentChapter() {
  const ch = activeManuscriptChapter();
  const context = JSON.stringify({
    series: activeSeries(),
    book: activeBook(),
    characters: data.characters.filter(visibleByScope),
    timeline: data.timeline.filter(visibleByScope),
    threads: data.threads.filter(visibleByScope)
  }, null, 2);
  const prompt = `Analyze this book chapter for pacing, emotional beat, conflict, clarity, continuity, and character consistency. Give practical revision notes.\n\nPROJECT CONTEXT:\n${context}\n\nCHAPTER:\n${ch?.title}\n\n${ch?.content}`;
  const out = document.getElementById("aiResults");
  out.value = "Analyzing...";
  try {
    const live = await callOpenAI(prompt);
    out.value = live || localChapterAnalysis(ch);
  } catch (err) {
    out.value = localChapterAnalysis(ch) + "\n\nLive AI failed, so local checklist mode was used.";
  }
  setView("ai");
}
async function runCharacterChecker() {
  const id = val("aiCharacterSelect");
  const char = data.characters.find(c => c.id === id);
  const ch = activeManuscriptChapter();
  const prompt = `Check this character for consistency against the current chapter. Focus on voice, personality, arc, relationships, and contradictions.\n\nCHARACTER:\n${JSON.stringify(char, null, 2)}\n\nCURRENT CHAPTER:\n${ch?.title}\n\n${ch?.content}`;
  const out = document.getElementById("aiResults");
  out.value = "Checking character...";
  try {
    const live = await callOpenAI(prompt);
    out.value = live || localCharacterAnalysis(char);
  } catch (err) {
    out.value = localCharacterAnalysis(char) + "\n\nLive AI failed, so local checklist mode was used.";
  }
}
async function runTimelineChecker() {
  const prompt = `Check this story timeline for contradictions, unclear order, missing cause/effect, and age/time issues.\n\nSERIES:\n${JSON.stringify(activeSeries(), null, 2)}\n\nBOOK:\n${JSON.stringify(activeBook(), null, 2)}\n\nTIMELINE:\n${JSON.stringify(data.timeline.filter(visibleByScope), null, 2)}\n\nCHAPTER PLANS:\n${JSON.stringify(data.chapterPlans.filter(visibleByScope), null, 2)}`;
  const out = document.getElementById("aiResults");
  out.value = "Checking timeline...";
  try {
    const live = await callOpenAI(prompt);
    out.value = live || localTimelineAnalysis();
  } catch (err) {
    out.value = localTimelineAnalysis() + "\n\nLive AI failed, so local checklist mode was used.";
  }
}

document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));
document.getElementById("globalSearch").addEventListener("input", runSearch);
document.getElementById("clearSearch").addEventListener("click", () => { setVal("globalSearch", ""); runSearch(); });

["seriesTitleEdit","seriesGenreEdit","seriesSynopsisEdit","seriesThemeEdit","seriesMysteriesEdit","seriesForeshadowingEdit","bookTitleEdit","bookStatusEdit","bookSummaryEdit","bookThemeEdit","bookNotesEdit"].forEach(id => {
  document.getElementById(id).addEventListener("input", () => saveOverviewFields(true));
});
document.getElementById("currentChapterTitle").addEventListener("input", () => saveCurrentManuscriptChapter(true));
document.getElementById("manuscriptEditor").addEventListener("input", () => saveCurrentManuscriptChapter(false));

renderAll();
