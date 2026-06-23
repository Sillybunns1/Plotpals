const STORAGE_KEY = "writersVaultV8";
const CLOUD_TABLE = "writer_vaults";

const defaultData = {
  activeSeriesId: null,
  activeBookId: null,
  activeChapterId: null,
  selectedCharacterId: null,
  user: null,
  series: [],
  books: [],
  characters: [],
  relationships: [],
  timeline: [],
  chapterPlans: [],
  threads: [],
  scenes: [],
  world: []
};

let supabaseClient = null;
let data = loadData();
let cloudSaveTimer = null;
let authMode = "login";
let isRendering = false;

function initSupabase() {
  if (!window.supabase) {
    setLoginMessage("Supabase could not load. Check your internet connection.");
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
function val(id) { return document.getElementById(id)?.value.trim() || ""; }
function setVal(id, value) { const el = document.getElementById(id); if (el) el.value = value || ""; }
function clearFields(ids) { ids.forEach(id => setVal(id, "")); }
function escapeHTML(str = "") {
  return String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function stripHTML(html = "") {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
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
  if (!data.series) data.series = [];
  if (!data.books) data.books = [];
  if (!data.scenes) data.scenes = [];
  if (!data.activeSeriesId && data.series[0]) data.activeSeriesId = data.series[0].id;
  if (!data.activeBookId && data.activeSeriesId) {
    const firstBook = data.books.find(b => b.seriesId === data.activeSeriesId);
    data.activeBookId = firstBook?.id || null;
  }
  const book = activeBook();
  if (book && (!book.manuscript || !book.manuscript.length)) {
    book.manuscript = [{ id: uid(), title: "Chapter One", content: "", created: new Date().toISOString() }];
    data.activeChapterId = book.manuscript[0].id;
  }
}

function switchAuthMode(mode) {
  authMode = mode;
  document.getElementById("loginTab").classList.toggle("active", mode === "login");
  document.getElementById("signupTab").classList.toggle("active", mode === "signup");
  document.getElementById("authSubmitBtn").textContent = mode === "login" ? "Login" : "Create Account";
  setLoginMessage("");
}
async function submitAuth() { return authMode === "login" ? signIn() : signUp(); }
function setLoginMessage(message) {
  const el = document.getElementById("loginMessage");
  if (el) el.textContent = message || "";
}
function setProjectMessage(message) {
  const el = document.getElementById("projectMessage");
  if (el) el.textContent = message || "";
}
async function refreshSession() {
  if (!supabaseClient) return;
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData?.session?.user || null;
  data.user = user ? { id: user.id, email: user.email } : null;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
  updateAuthGate();
}
function updateAuthGate() {
  const loggedIn = !!data.user?.id;
  const hasProject = !!(data.activeSeriesId && data.activeBookId);
  document.getElementById("loginScreen").classList.toggle("hidden", loggedIn);
  document.getElementById("projectScreen").classList.toggle("hidden", !loggedIn || hasProject);
  document.getElementById("appShell").classList.toggle("hidden", !loggedIn || !hasProject);
  renderAccount();
  if (loggedIn && !hasProject) renderProjectScreen();
}
async function signUp() {
  if (!supabaseClient) return setLoginMessage("Supabase could not load. Check your internet connection.");
  const email = val("loginEmail");
  const password = val("loginPassword");
  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) return setLoginMessage(error.message);
  setLoginMessage("Account created. Check your email if confirmation is required, then login.");
}
async function signIn() {
  if (!supabaseClient) return setLoginMessage("Supabase could not load. Check your internet connection.");
  const email = val("loginEmail");
  const password = val("loginPassword");
  const { data: result, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return setLoginMessage(error.message);
  data.user = { id: result.user.id, email: result.user.email };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
  await loadFromCloud(false);
  data.activeSeriesId = null;
  data.activeBookId = null;
  updateAuthGate();
}
async function signOut() {
  if (supabaseClient) await supabaseClient.auth.signOut();
  data.user = null;
  data.activeSeriesId = null;
  data.activeBookId = null;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
  updateAuthGate();
}
async function sendPasswordResetFromLogin() {
  if (!supabaseClient) return setLoginMessage("Supabase could not load.");
  const email = val("loginEmail");
  if (!email) return setLoginMessage("Enter your email first.");
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
  setLoginMessage(error ? error.message : "Password reset email sent.");
}
function renderAccount() {
  const status = document.getElementById("accountStatus");
  const sync = document.getElementById("syncStatus");
  if (!status || !sync) return;
  status.textContent = data.user?.email || "Not signed in";
  sync.textContent = data.user?.id ? "Signed in. Auto-save enabled." : "Login required.";
}

function renderProjectScreen() {
  const seriesOptions = data.series.length
    ? data.series.map(s => `<option value="${s.id}">${escapeHTML(s.title)}</option>`).join("")
    : `<option value="">No series yet</option>`;
  const projectSeries = document.getElementById("projectSeriesSelect");
  const newBookSeries = document.getElementById("newBookSeriesSelect");
  if (projectSeries) projectSeries.innerHTML = seriesOptions;
  if (newBookSeries) newBookSeries.innerHTML = seriesOptions;
  projectSeriesChanged();
}
function projectSeriesChanged() {
  const seriesId = val("projectSeriesSelect");
  const books = data.books.filter(b => b.seriesId === seriesId);
  const bookSelect = document.getElementById("projectBookSelect");
  if (bookSelect) {
    bookSelect.innerHTML = books.length
      ? books.map(b => `<option value="${b.id}">${escapeHTML(b.title)}</option>`).join("")
      : `<option value="">No books in this series</option>`;
  }
}
function createSeriesFromProject() {
  const name = val("newSeriesTitle") || "Untitled Series";
  const series = { id: uid(), title: name, genre: "", synopsis: "", theme: "", mysteries: "", foreshadowing: "", created: new Date().toISOString() };
  data.series.push(series);
  data.activeSeriesId = null;
  data.activeBookId = null;
  setVal("newSeriesTitle", "");
  saveData(false);
  renderProjectScreen();
  setProjectMessage("Series created. Now create or select a book.");
}
function createBookFromProject() {
  const seriesId = val("newBookSeriesSelect");
  if (!seriesId) return setProjectMessage("Create or select a series first.");
  const name = val("newBookTitle") || "Untitled Book";
  const book = {
    id: uid(), seriesId, title: name, status: "Planning", summary: "", theme: "", notes: "",
    manuscript: [{ id: uid(), title: "Chapter One", content: "", created: new Date().toISOString() }],
    created: new Date().toISOString()
  };
  data.books.push(book);
  setVal("newBookTitle", "");
  saveData(false);
  renderProjectScreen();
  setProjectMessage("Book created. Select it and open workspace.");
}
function openWorkspace() {
  const seriesId = val("projectSeriesSelect");
  const bookId = val("projectBookSelect");
  if (!seriesId || !bookId) return setProjectMessage("Select both a series and a book.");
  data.activeSeriesId = seriesId;
  data.activeBookId = bookId;
  const book = activeBook();
  data.activeChapterId = book?.manuscript?.[0]?.id || null;
  saveData();
  updateAuthGate();
}
function backToProjects() {
  saveCurrentManuscriptChapter(false, false);
  data.activeSeriesId = null;
  data.activeBookId = null;
  saveData(false, false);
  updateAuthGate();
}

function scheduleCloudSave() {
  if (!data.user?.id || !supabaseClient) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => syncToCloud(false), 1600);
}
async function syncToCloud(showAlert = true) {
  if (!supabaseClient) {
    if (showAlert) alert("Supabase is not loaded. Check your internet connection.");
    return;
  }
  const currentProject = { seriesId: data.activeSeriesId, bookId: data.activeBookId, chapterId: data.activeChapterId };
  await refreshSession();
  data.activeSeriesId = currentProject.seriesId;
  data.activeBookId = currentProject.bookId;
  data.activeChapterId = currentProject.chapterId;
  if (!data.user?.id) {
    if (showAlert) alert("Login first.");
    return;
  }
  const payload = { user_id: data.user.id, user_email: data.user.email, vault_data: data, updated_at: new Date().toISOString() };
  const { error } = await supabaseClient.from(CLOUD_TABLE).upsert(payload, { onConflict: "user_id" });
  if (error) {
    document.getElementById("syncStatus").textContent = "Sync failed.";
    if (showAlert) alert("Cloud sync failed. Check the Supabase table/RLS setup. " + error.message);
    console.error(error);
    return;
  }
  document.getElementById("syncStatus").textContent = "Synced " + new Date().toLocaleTimeString();
  const autosave = document.getElementById("autosaveStatus");
  if (autosave) autosave.textContent = "Saved";
  if (showAlert) alert("Synced to Supabase.");
}
async function loadFromCloud(showAlert = true) {
  if (!supabaseClient) {
    if (showAlert) alert("Supabase is not loaded. Check your internet connection.");
    return;
  }
  const session = await supabaseClient.auth.getSession();
  const user = session.data?.session?.user;
  if (!user) {
    if (showAlert) alert("Login first.");
    return;
  }
  const { data: rows, error } = await supabaseClient.from(CLOUD_TABLE).select("vault_data, updated_at").eq("user_id", user.id).limit(1);
  if (error) {
    if (showAlert) alert("Could not load cloud data. Check the Supabase table/RLS setup. " + error.message);
    console.error(error);
    return;
  }
  if (!rows || !rows.length || !rows[0].vault_data) {
    data.user = { id: user.id, email: user.email };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
    if (showAlert) alert("No cloud vault found yet. Use Sync Now to create one.");
    return;
  }
  data = { ...structuredClone(defaultData), ...rows[0].vault_data, user: { id: user.id, email: user.email } };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
  if (showAlert) {
    renderAll();
    alert("Loaded from Supabase.");
  }
}

function toggleSidebar() {
  document.getElementById("appShell").classList.toggle("collapsed");
}

function setView(view, id = null) {
  saveCurrentManuscriptChapter(false, false);
  if (view === "write" && id) data.activeChapterId = id;
  if (view === "characterDetail" && id) data.selectedCharacterId = id;
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(view).classList.add("active");
  const titles = {
    overview: "Overview", write: "Manuscript Editor", chapters: "Chapter Planner", threads: "Plot Threads", characters: "Characters",
    characterDetail: "Character Detail", scenes: "Scenes", timeline: "Timeline", world: "Worldbuilding", relationships: "Relationships",
    stats: "Writing Statistics", exports: "Export", backup: "Backup"
  };
  document.getElementById("viewTitle").textContent = titles[view] || "Workspace";
  renderAll();
}
function renderNestedNav() {
  const nav = document.getElementById("nestedNav");
  if (!nav) return;
  const book = activeBook();
  const chapters = book?.manuscript || [];
  const plans = data.chapterPlans.filter(visibleByScope);
  const threads = data.threads.filter(visibleByScope);
  const scenes = data.scenes.filter(visibleByScope);
  const timeline = data.timeline.filter(visibleByScope);
  const rels = data.relationships.filter(visibleByScope);
  const roles = ["Main", "Side", "Love Interest", "Antagonist", "Mentor", "Other"];
  const charsByRole = role => data.characters.filter(c => visibleByScope(c) && (c.role || "Other") === role);
  nav.innerHTML = `
    <div class="nav-section">
      <button class="nav-parent" onclick="setView('overview')"><span class="nav-label">Overview</span><span>⌂</span></button>
    </div>
    <div class="nav-section">
      <button class="nav-parent" onclick="setView('write')"><span class="nav-label">Manuscript Editor</span><span class="nav-count">${chapters.length}</span></button>
      <div class="nav-children">
        ${chapters.map((c,i)=>`<button class="nav-child" onclick="setView('write','${c.id}')"><span>${i+1}. ${escapeHTML(c.title||"Untitled")}</span></button>`).join("")}
      </div>
    </div>
    <div class="nav-section">
      <button class="nav-parent"><span class="nav-label">Plot</span><span>▾</span></button>
      <div class="nav-children">
        <button class="nav-child" onclick="setView('chapters')"><span>Chapter Planner</span><span class="nav-count">${plans.length}</span></button>
        ${plans.map(p=>`<button class="nav-grandchild" onclick="setView('chapters')">${escapeHTML(p.number||"Untitled")}</button>`).join("")}
        <button class="nav-child" onclick="setView('threads')"><span>Plot Threads</span><span class="nav-count">${threads.length}</span></button>
        ${threads.map(t=>`<button class="nav-grandchild" onclick="setView('threads')">${escapeHTML(t.title||"Untitled")}</button>`).join("")}
      </div>
    </div>
    <div class="nav-section">
      <button class="nav-parent" onclick="setView('characters')"><span class="nav-label">Characters</span><span class="nav-count">${data.characters.filter(visibleByScope).length}</span></button>
      <div class="nav-children">
        ${roles.map(role=>`
          <button class="nav-child" onclick="setView('characters')"><span>${role}</span><span class="nav-count">${charsByRole(role).length}</span></button>
          ${charsByRole(role).map(c=>`<button class="nav-grandchild" onclick="setView('characterDetail','${c.id}')">${escapeHTML(c.name||"Unnamed")}</button>`).join("")}
        `).join("")}
      </div>
    </div>
    <div class="nav-section">
      <button class="nav-parent"><span class="nav-label">Worldbuilding</span><span>▾</span></button>
      <div class="nav-children">
        <button class="nav-child" onclick="setView('world')"><span>World Notes</span><span class="nav-count">${data.world.filter(visibleByScope).length}</span></button>
        <button class="nav-child" onclick="setView('scenes')"><span>Scenes</span><span class="nav-count">${scenes.length}</span></button>
        ${scenes.map(s=>`<button class="nav-grandchild" onclick="setView('scenes')">${escapeHTML(s.name||"Untitled")}</button>`).join("")}
        <button class="nav-child" onclick="setView('relationships')"><span>Relationships</span><span class="nav-count">${rels.length}</span></button>
        ${rels.map(r=>`<button class="nav-grandchild" onclick="setView('relationships')">${escapeHTML(characterName(r.a))} + ${escapeHTML(characterName(r.b))}</button>`).join("")}
        <button class="nav-child" onclick="setView('timeline')"><span>Timeline</span><span class="nav-count">${timeline.length}</span></button>
        ${timeline.map(t=>`<button class="nav-grandchild" onclick="setView('timeline')">${escapeHTML(t.when||"Unplaced")}</button>`).join("")}
      </div>
    </div>
    <div class="nav-section">
      <button class="nav-parent" onclick="setView('stats')"><span class="nav-label">Writing Stats</span><span>↗</span></button>
      <button class="nav-parent" onclick="setView('exports')"><span class="nav-label">Export</span><span>⇩</span></button>
      <button class="nav-parent" onclick="setView('backup')"><span class="nav-label">Backup</span><span>☁</span></button>
    </div>
  `;
}

function addManuscriptChapter() {
  const book = activeBook();
  if (!book) return alert("Open a book first.");
  saveCurrentManuscriptChapter(false, false);
  if (!book.manuscript) book.manuscript = [];
  const chapter = { id: uid(), title: `Chapter ${book.manuscript.length + 1}`, content: "", created: new Date().toISOString() };
  book.manuscript.push(chapter);
  data.activeChapterId = chapter.id;
  saveData();
}
function selectManuscriptChapter(id) { setView("write", id); }
function saveCurrentManuscriptChapter(render = false, scheduleCloud = true) {
  if (isRendering) return;
  const ch = activeManuscriptChapter();
  const editor = document.getElementById("richEditor");
  if (!ch || !editor) return;
  ch.title = val("currentChapterTitle");
  ch.content = editor.innerHTML;
  const autosave = document.getElementById("autosaveStatus");
  if (autosave) autosave.textContent = "Saving...";
  saveData(render, scheduleCloud);
  updateEditorStats();
}
function deleteManuscriptChapter(id) {
  const book = activeBook();
  if (!book) return;
  if (!confirm("Delete this manuscript chapter?")) return;
  book.manuscript = (book.manuscript || []).filter(c => c.id !== id);
  data.activeChapterId = book.manuscript[0]?.id || null;
  saveData();
}
function moveChapter(direction) {
  const book = activeBook();
  if (!book?.manuscript) return;
  const index = book.manuscript.findIndex(c => c.id === data.activeChapterId);
  const newIndex = index + direction;
  if (index < 0 || newIndex < 0 || newIndex >= book.manuscript.length) return;
  const [chapter] = book.manuscript.splice(index, 1);
  book.manuscript.splice(newIndex, 0, chapter);
  saveData();
}
function formatDoc(command) {
  document.execCommand(command, false, null);
  document.getElementById("richEditor").focus();
  saveCurrentManuscriptChapter(false);
}
function formatBlock(tag) {
  document.execCommand("formatBlock", false, tag);
  document.getElementById("richEditor").focus();
  saveCurrentManuscriptChapter(false);
}
function insertSceneBreak() {
  document.execCommand("insertHTML", false, "<p style='text-align:center;'>✦ ✦ ✦</p>");
  saveCurrentManuscriptChapter(false);
}
function toggleFullscreen() { document.getElementById("manuscriptPanel").classList.toggle("fullscreen"); }
function updateEditorStats() {
  const ch = activeManuscriptChapter();
  const text = stripHTML(ch?.content || "");
  const book = activeBook();
  const chapterWords = countWords(text);
  const bookWords = (book?.manuscript || []).reduce((sum, c) => sum + countWords(stripHTML(c.content || "")), 0);
  const paragraphs = ((ch?.content || "").match(/<p|<div|<h[1-6]/gi) || []).length || (text.trim() ? 1 : 0);
  setText("chapterWordCount", chapterWords);
  setText("bookWordCountInline", bookWords);
  setText("chapterCharCount", text.length);
  setText("chapterParagraphCount", paragraphs);
}
function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }

function scopedItem(scope) {
  return scope === "series" ? { scope, seriesId: data.activeSeriesId, bookId: null } : { scope, seriesId: data.activeSeriesId, bookId: data.activeBookId };
}
function visibleByScope(item) { return item.seriesId === data.activeSeriesId && (item.scope === "series" || item.bookId === data.activeBookId); }
function characterName(id) { return data.characters.find(c => c.id === id)?.name || "Unknown"; }
function characterRelationships(characterId) {
  return data.relationships.filter(r => visibleByScope(r) && (r.a === characterId || r.b === characterId));
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
  const file = document.getElementById("charPhoto").files[0];
  const finish = photo => {
    data.characters.push({ id: uid(), ...scopedItem(val("charScope")), name: val("charName"), role: val("charRole"),
      species: val("charSpecies"), photo, description: val("charDescription"), personality: val("charPersonality"),
      wound: val("charWound"), arc: val("charArc"), voice: val("charVoice"), relationships: val("charRelationships"), created: new Date().toISOString()
    });
    clearFields(["charName","charSpecies","charDescription","charPersonality","charWound","charArc","charVoice","charRelationships"]);
    document.getElementById("charPhoto").value = "";
    saveData();
  };
  if (!file) return finish("");
  const reader = new FileReader();
  reader.onload = () => finish(reader.result);
  reader.readAsDataURL(file);
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
function addScene() {
  if (!data.scenes) data.scenes = [];
  data.scenes.push({ id: uid(), ...scopedItem(val("sceneScope")), name: val("sceneName"), location: val("sceneLocation"),
    summary: val("sceneSummary"), purpose: val("scenePurpose"), created: new Date().toISOString()
  });
  clearFields(["sceneName","sceneLocation","sceneSummary","scenePurpose"]);
  saveData();
}
function addRelationship() {
  data.relationships.push({ id: uid(), ...scopedItem(val("relScope")), a: val("relA"), b: val("relB"), type: val("relType"),
    notes: val("relNotes"), created: new Date().toISOString()
  });
  clearFields(["relType","relNotes"]);
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
  const manuscriptWords = (b?.manuscript || []).reduce((sum, ch) => sum + countWords(stripHTML(ch.content || "")), 0);
  setText("statWords", manuscriptWords);
  setText("statChapters", (b?.manuscript || []).length);
  setText("statCharacters", data.characters.filter(visibleByScope).length);
  setText("statThreads", data.threads.filter(t => visibleByScope(t) && t.status !== "Closed").length);
  setText("projectPath", `${s?.title || "No series"} → ${b?.title || "No book selected"}`);
  setText("sidebarProjectName", b?.title || "Project");
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
  if (!list) return;
  list.innerHTML = "";
  (book?.manuscript || []).forEach((ch, i) => {
    const words = countWords(stripHTML(ch.content || ""));
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <button class="chapter-button ${ch.id === data.activeChapterId ? "active" : ""}" onclick="selectManuscriptChapter('${ch.id}')">
        ${i + 1}. ${escapeHTML(ch.title || "Untitled")}<br><small>${words} words</small>
      </button>
      <button class="delete-btn" onclick="deleteManuscriptChapter('${ch.id}')">Delete</button>
    `;
    list.appendChild(wrapper);
  });
  const ch = activeManuscriptChapter();
  setVal("currentChapterTitle", ch?.title || "");
  const editor = document.getElementById("richEditor");
  if (editor) {
    isRendering = true;
    editor.innerHTML = ch?.content || "";
    isRendering = false;
  }
  updateEditorStats();
}
function renderCharacterSelects() {
  const chars = data.characters.filter(visibleByScope);
  const options = chars.length ? chars.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join("") : `<option value="">No characters yet</option>`;
  const a = document.getElementById("relA");
  const b = document.getElementById("relB");
  if (a) a.innerHTML = options;
  if (b) b.innerHTML = options;
}
function renderCardList(collection, elId, titleKey, bodyFn) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = "";
  data[collection].filter(visibleByScope).forEach(item => el.appendChild(makeCard(item[titleKey], bodyFn(item), () => deleteItem(collection, item.id))));
}
function renderAllLists() {
  renderCardList("chapterPlans", "chapterPlanList", "number", item => `
    <span class="tag">Book</span>${detail("POV", item.pov)}${detail("Target Words", item.wordTarget)}
    ${detail("Goal", item.goal)}${detail("Conflict", item.conflict)}${detail("Outcome", item.outcome)}
    ${detail("Emotional Beat", item.emotion)}${detail("Foreshadowing", item.foreshadowing)}
  `);
  renderCardList("threads", "threadList", "title", item => `
    <span class="tag">${escapeHTML(item.scope)}</span><span class="tag">${escapeHTML(item.status)}</span>
    ${detail("Setup", item.setup)}${detail("Payoff", item.payoff)}
  `);
  renderCardList("world", "worldList", "name", item => `
    <span class="tag">${escapeHTML(item.scope)}</span><span class="tag">${escapeHTML(item.category)}</span>
    ${detail("Description", item.description)}${detail("Rules / Notes", item.rules)}
  `);
  renderCardList("scenes", "sceneList", "name", item => `
    <span class="tag">${escapeHTML(item.scope)}</span>${detail("Location", item.location)}
    ${detail("Summary", item.summary)}${detail("Purpose", item.purpose)}
  `);

  renderCharactersByRole();
  renderCharacterDetail();

  const tl = document.getElementById("timelineList");
  if (tl) {
    tl.innerHTML = "";
    data.timeline.filter(visibleByScope).forEach(item => {
      const div = document.createElement("article");
      div.className = "item-card timeline-item";
      div.innerHTML = `<div class="card-header"><h3>${escapeHTML(item.when || "Unplaced Event")}</h3><button class="delete-btn">Delete</button></div>
      <div class="card-body"><span class="tag">${escapeHTML(item.scope)}</span>${detail("Event", item.event)}${detail("Impact", item.impact)}</div>`;
      div.querySelector("button").onclick = () => deleteItem("timeline", item.id);
      tl.appendChild(div);
    });
  }

  const map = document.getElementById("relationshipMap");
  const list = document.getElementById("relationshipList");
  if (map && list) {
    map.innerHTML = "";
    list.innerHTML = "";
    const rels = data.relationships.filter(visibleByScope);
    if (!rels.length) map.innerHTML = "<p>No relationships yet.</p>";
    rels.forEach(item => {
      const node = document.createElement("div");
      node.className = "rel-node";
      node.textContent = `${characterName(item.a)} → ${characterName(item.b)} (${item.type || "connection"})`;
      map.appendChild(node);
      list.appendChild(makeCard(`${characterName(item.a)} + ${characterName(item.b)}`, `<span class="tag">${escapeHTML(item.scope)}</span>${detail("Type", item.type)}${detail("Notes", item.notes)}`, () => deleteItem("relationships", item.id)));
    });
  }
}
function renderCharactersByRole() {
  const el = document.getElementById("characterRoleGroups");
  if (!el) return;
  const roles = ["Main", "Side", "Love Interest", "Antagonist", "Mentor", "Other"];
  el.innerHTML = roles.map(role => {
    const chars = data.characters.filter(c => visibleByScope(c) && (c.role || "Other") === role);
    return `<div class="role-group"><h3>${role}</h3><div class="card-grid">${
      chars.length ? chars.map(c => `
        <article class="item-card">
          <div class="card-header"><h3>${escapeHTML(c.name)}</h3><button class="delete-btn" onclick="deleteItem('characters','${c.id}')">Delete</button></div>
          ${c.photo ? `<img class="character-photo" src="${c.photo}" alt="${escapeHTML(c.name)}">` : ""}
          <div class="card-body">
            <span class="tag">${escapeHTML(c.species || "")}</span>
            ${detail("Personality", c.personality)}
            ${detail("Arc", c.arc)}
            <button onclick="setView('characterDetail','${c.id}')">Open Character</button>
          </div>
        </article>
      `).join("") : `<p class="muted">No ${role} characters yet.</p>`
    }</div></div>`;
  }).join("");
}
function renderCharacterDetail() {
  const el = document.getElementById("characterDetailContent");
  if (!el) return;
  const c = data.characters.find(x => x.id === data.selectedCharacterId);
  if (!c) { el.innerHTML = `<div class="panel"><p>Select a character from the sidebar.</p></div>`; return; }
  const rels = characterRelationships(c.id);
  el.innerHTML = `
    <div class="panel character-detail-grid">
      <div>${c.photo ? `<img class="character-photo" src="${c.photo}" alt="${escapeHTML(c.name)}">` : `<div class="character-photo panel">No Photo</div>`}</div>
      <div>
        <h3>${escapeHTML(c.name)}</h3>
        <span class="tag">${escapeHTML(c.role || "")}</span><span class="tag">${escapeHTML(c.species || "")}</span>
        ${detail("Description", c.description)}
        ${detail("Personality", c.personality)}
        ${detail("Core Wound / Fear / Desire", c.wound)}
        ${detail("Arc", c.arc)}
        ${detail("Voice", c.voice)}
        ${detail("Relationship Notes", c.relationships)}
        <h3>Linked Relationships</h3>
        ${rels.length ? rels.map(r => `<p><strong>${escapeHTML(characterName(r.a))} + ${escapeHTML(characterName(r.b))}:</strong> ${escapeHTML(r.type || "")}<br>${escapeHTML(r.notes || "")}</p>`).join("") : "<p>No linked relationships yet.</p>"}
      </div>
    </div>`;
}
function renderWritingStats() {
  const book = activeBook();
  const chapters = book?.manuscript || [];
  const counts = chapters.map(c => countWords(stripHTML(c.content || "")));
  const total = counts.reduce((a,b) => a + b, 0);
  const avg = counts.length ? Math.round(total / counts.length) : 0;
  const longest = counts.length ? Math.max(...counts) : 0;
  const bibleItems = data.characters.filter(visibleByScope).length + data.threads.filter(visibleByScope).length + data.timeline.filter(visibleByScope).length + data.world.filter(visibleByScope).length + data.relationships.filter(visibleByScope).length + data.scenes.filter(visibleByScope).length;
  setText("statsTotalWords", total);
  setText("statsAvgWords", avg);
  setText("statsLongestChapter", longest);
  setText("statsBibleItems", bibleItems);
  const list = document.getElementById("chapterStatsList");
  if (list) list.innerHTML = chapters.map((c, i) => `<div class="chapter-stat-row"><span>${i + 1}. ${escapeHTML(c.title || "Untitled")}</span><strong>${counts[i]} words</strong></div>`).join("") || "<p>No chapters yet.</p>";
}
function renderRawData() {
  const raw = document.getElementById("rawData");
  if (raw) raw.value = JSON.stringify(data, null, 2);
}
function renderAll() {
  if (!data.user?.id) { updateAuthGate(); return; }
  ensureProject();
  if (!data.activeSeriesId || !data.activeBookId) { updateAuthGate(); return; }
  renderOverview();
  renderManuscript();
  renderCharacterSelects();
  renderAllLists();
  renderWritingStats();
  renderRawData();
  renderAccount();
  renderNestedNav();
  runSearch();
}
function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }

function searchableItems() {
  const b = activeBook();
  const manuscript = (b?.manuscript || []).map(ch => ({ type: "Manuscript", title: ch.title, text: (ch.title + " " + stripHTML(ch.content || "")).toLowerCase() }));
  const collections = [
    ["Character", data.characters, "name"], ["Relationship", data.relationships, "type"], ["Timeline", data.timeline, "when"],
    ["Chapter Plan", data.chapterPlans, "number"], ["Plot Thread", data.threads, "title"], ["Worldbuilding", data.world, "name"], ["Scene", data.scenes, "name"]
  ];
  return [
    { type: "Series", title: activeSeries()?.title, text: JSON.stringify(activeSeries() || {}).toLowerCase() },
    { type: "Book", title: b?.title, text: JSON.stringify(b || {}).toLowerCase() },
    ...manuscript,
    ...collections.flatMap(([type, arr, key]) => arr.filter(visibleByScope).map(item => ({ type, title: item[key] || "Untitled", text: JSON.stringify(item).toLowerCase() })))
  ];
}
function runSearch() {
  const search = document.getElementById("globalSearch");
  const box = document.getElementById("searchResults");
  if (!search || !box) return;
  const q = search.value.trim().toLowerCase();
  if (!q) { box.classList.add("hidden"); box.innerHTML = ""; return; }
  const matches = searchableItems().filter(item => item.text.includes(q));
  box.classList.remove("hidden");
  box.innerHTML = `<h3>Search Results</h3>` + (matches.length ? matches.map(m => `<p><strong>${escapeHTML(m.type)}:</strong> ${escapeHTML(m.title || "Untitled")}</p>`).join("") : "<p>No matches found.</p>");
}

function manuscriptHTML() {
  const book = activeBook();
  return (book?.manuscript || []).map(ch => `<h2>${escapeHTML(ch.title || "Untitled")}</h2>${ch.content || ""}`).join("<div style='page-break-after: always;'></div>");
}
function seriesBibleHTML() {
  const s = activeSeries();
  const b = activeBook();
  const chars = data.characters.filter(visibleByScope);
  const threads = data.threads.filter(visibleByScope);
  const world = data.world.filter(visibleByScope);
  const timeline = data.timeline.filter(visibleByScope);
  const rels = data.relationships.filter(visibleByScope);
  const scenes = data.scenes.filter(visibleByScope);
  const plans = data.chapterPlans.filter(visibleByScope);
  return `
  <h1>${escapeHTML(s?.title || "Series Bible")}</h1>
  <h2>Series Overview</h2>
  <p><strong>Genre/Tone:</strong> ${escapeHTML(s?.genre || "")}</p>
  <p><strong>Synopsis:</strong> ${escapeHTML(s?.synopsis || "")}</p>
  <p><strong>Theme:</strong> ${escapeHTML(s?.theme || "")}</p>
  <p><strong>Mysteries:</strong> ${escapeHTML(s?.mysteries || "")}</p>
  <p><strong>Foreshadowing:</strong> ${escapeHTML(s?.foreshadowing || "")}</p>
  <h2>Active Book</h2><h3>${escapeHTML(b?.title || "")}</h3><p>${escapeHTML(b?.summary || "")}</p>
  <h2>Characters</h2>${chars.map(c => `<h3>${escapeHTML(c.name)}</h3><p><strong>Role:</strong> ${escapeHTML(c.role || "")}</p><p>${escapeHTML(c.description || "")}</p><p>${escapeHTML(c.personality || "")}</p>`).join("")}
  <h2>Chapter Plans</h2>${plans.map(p => `<h3>${escapeHTML(p.number)}</h3><p>${escapeHTML(p.goal || "")}</p>`).join("")}
  <h2>Plot Threads</h2>${threads.map(t => `<h3>${escapeHTML(t.title)}</h3><p>${escapeHTML(t.setup || "")}</p>`).join("")}
  <h2>Scenes</h2>${scenes.map(s => `<h3>${escapeHTML(s.name)}</h3><p>${escapeHTML(s.summary || "")}</p>`).join("")}
  <h2>Timeline</h2>${timeline.map(t => `<p><strong>${escapeHTML(t.when || "")}</strong>: ${escapeHTML(t.event || "")}</p>`).join("")}
  <h2>Worldbuilding</h2>${world.map(w => `<h3>${escapeHTML(w.name)}</h3><p>${escapeHTML(w.description || "")}</p>`).join("")}
  <h2>Relationships</h2>${rels.map(r => `<h3>${escapeHTML(characterName(r.a))} + ${escapeHTML(characterName(r.b))}</h3><p>${escapeHTML(r.type || "")}: ${escapeHTML(r.notes || "")}</p>`).join("")}`;
}
function buildHTMLDoc(title, bodyHTML) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(title)}</title>
  <style>body{font-family:Georgia,serif;line-height:1.6;font-size:12pt;} h1{text-align:center;} h2{margin-top:32px;}</style>
  </head><body><h1>${escapeHTML(title)}</h1>${bodyHTML}</body></html>`;
}
function exportFullManuscriptTxt() {
  const book = activeBook();
  if (!book) return alert("No book selected.");
  const text = (book.manuscript || []).map(ch => `${ch.title}\n\n${stripHTML(ch.content || "")}`).join("\n\n\n");
  downloadFile(`${safeFile(book.title)}-full-manuscript.txt`, text, "text/plain");
}
function exportFullManuscriptDocx() {
  const book = activeBook();
  if (!book) return alert("No book selected.");
  downloadFile(`${safeFile(book.title)}-full-manuscript.docx`, buildHTMLDoc(book.title || "Manuscript", manuscriptHTML()), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
}
function exportSeriesBibleDocx() {
  const s = activeSeries();
  if (!s) return alert("No series selected.");
  downloadFile(`${safeFile(s.title)}-series-bible.docx`, buildHTMLDoc(`${s.title} Series Bible`, seriesBibleHTML()), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
}
function exportFullManuscriptPDF() {
  const book = activeBook();
  if (!book) return alert("No book selected.");
  printHTML(buildHTMLDoc(book.title || "Manuscript", manuscriptHTML()));
}
function exportSeriesBiblePDF() {
  const s = activeSeries();
  if (!s) return alert("No series selected.");
  printHTML(buildHTMLDoc(`${s.title} Series Bible`, seriesBibleHTML()));
}
function printHTML(html) {
  document.getElementById("printArea").innerHTML = html;
  window.print();
}
function exportData() { downloadFile("writers-vault-v8-backup.json", JSON.stringify(data, null, 2), "application/json"); }
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
    try {
      const currentUser = data.user;
      data = { ...structuredClone(defaultData), ...JSON.parse(reader.result), user: currentUser };
      saveData();
      alert("Backup imported.");
    } catch { alert("Could not import this file."); }
  };
  reader.readAsText(file);
}
function resetAll() {
  if (!confirm("Delete all local writing data from this browser? This does not delete cloud data.")) return;
  const currentUser = data.user;
  data = { ...structuredClone(defaultData), user: currentUser };
  saveData(true, false);
}

document.getElementById("globalSearch").addEventListener("input", runSearch);
document.getElementById("clearSearch").addEventListener("click", () => { setVal("globalSearch", ""); runSearch(); });
["seriesTitleEdit","seriesGenreEdit","seriesSynopsisEdit","seriesThemeEdit","seriesMysteriesEdit","seriesForeshadowingEdit","bookTitleEdit","bookStatusEdit","bookSummaryEdit","bookThemeEdit","bookNotesEdit"].forEach(id => {
  document.getElementById(id).addEventListener("input", () => saveOverviewFields(true));
});
document.getElementById("currentChapterTitle").addEventListener("input", () => saveCurrentManuscriptChapter(true));
document.getElementById("richEditor").addEventListener("input", () => saveCurrentManuscriptChapter(false));
document.getElementById("richEditor").addEventListener("blur", () => syncToCloud(false));

initSupabase();
refreshSession().then(() => {
  if (data.user?.id) {
    loadFromCloud(false).then(() => {
      data.activeSeriesId = null;
      data.activeBookId = null;
      updateAuthGate();
    });
  } else {
    updateAuthGate();
  }
});
