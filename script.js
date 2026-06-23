const STORAGE_KEY = "plotpals";
const CLOUD_TABLE = "writer_vaults";

const defaultData = {
  activeSeriesId: null, activeBookId: null, activeChapterId: null, activeSceneId: null, selectedCharacterId: null,
  user: null, series: [], books: [], characters: [], relationships: [], timeline: [], chapterPlans: [], threads: [],
  scenes: [], world: [], locations: [], magicSystems: [], organizations: [], mysteries: [], foreshadowing: [], plotArcs: [], plotCards: [],
  structureBeats: [], music: {}, theme: 'dark', pinnedNote: '', libraryView: 'stories', lastOpened: null, currentView: 'projectDashboard'
};

let supabaseClient = null;
let data = loadData();
let cloudSaveTimer = null;
let authMode = "login";
let isRendering = false;

const addFormVisibility = {};
function toggleAddForm(id){
  const el=document.getElementById(id);
  addFormVisibility[id]=!addFormVisibility[id];
  if(el) el.classList.toggle("hidden", !addFormVisibility[id]);
}
function hideAddForm(id){
  addFormVisibility[id]=false;
  const el=document.getElementById(id);
  if(el) el.classList.add("hidden");
}
function showAddFormButtonLabel(label){return `+ Add ${label}`;}


const menuState = {
  library: true,
  manuscript: true,
  plot: true,
  characters: true,
  worldbuilding: true,
  series: true,
  storynotes: true,
  cloud: false
};

function toggleMenuSection(section){
  menuState[section] = !menuState[section];
  renderNestedNav();
}

function sectionClass(section){
  return menuState[section] ? "menu-section open" : "menu-section";
}

function sectionArrow(section){
  return menuState[section] ? "▾" : "›";
}


function initSupabase() {
  if (!window.supabase) { setLoginMessage("Supabase could not load. Check your internet connection."); return; }
  supabaseClient = window.supabase.createClient(window.WRITERS_VAULT_SUPABASE_URL, window.WRITERS_VAULT_SUPABASE_KEY);
}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2)}
function loadData(){const saved=localStorage.getItem(STORAGE_KEY); if(!saved) return structuredClone(defaultData); try{return {...structuredClone(defaultData),...JSON.parse(saved)}}catch{return structuredClone(defaultData)}}
function saveData(render=true,scheduleCloud=true){localStorage.setItem(STORAGE_KEY,JSON.stringify(data,null,2)); if(render) renderAll(); if(scheduleCloud) scheduleCloudSave()}
function val(id){return document.getElementById(id)?.value.trim()||""}
function setVal(id,value){const el=document.getElementById(id); if(el) el.value=value||""}
function setText(id,value){const el=document.getElementById(id); if(el) el.textContent=value}
function setHTML(id,html){const el=document.getElementById(id); if(el) el.innerHTML=html}
function readImageUpload(input,onDone){
  const file=input?.files?.[0];
  if(!file) return;
  if(!file.type || !file.type.startsWith("image/")){ alert("Please choose an image file."); if(input) input.value=""; return; }
  const reader=new FileReader();
  reader.onload=()=>{
    const original=reader.result;
    if(file.type.includes("gif") || file.type.includes("svg")){ onDone(original); if(input) input.value=""; return; }
    const img=new Image();
    img.onload=()=>{
      try{
        const max=1400;
        const scale=Math.min(1,max/Math.max(img.width||max,img.height||max));
        const canvas=document.createElement("canvas");
        canvas.width=Math.max(1,Math.round((img.width||max)*scale));
        canvas.height=Math.max(1,Math.round((img.height||max)*scale));
        const ctx=canvas.getContext("2d");
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        const compressed=canvas.toDataURL("image/jpeg",0.86);
        onDone(compressed || original);
      }catch(e){ onDone(original); }
      if(input) input.value="";
    };
    img.onerror=()=>{ onDone(original); if(input) input.value=""; };
    img.src=original;
  };
  reader.onerror=()=>alert("This image could not be uploaded. Please try a different file.");
  reader.readAsDataURL(file);
}
function clickHiddenFileInput(id,event){
  if(event){ event.preventDefault(); event.stopPropagation(); }
  const input=document.getElementById(id);
  if(input) input.click();
  else alert("Upload input could not be found. Try opening the detail page and uploading again.");
}

function triggerOverviewImageUpload(inputId,event){
  clickHiddenFileInput(inputId,event);
}

function previewOverviewImage(inputId,previewId){
  const input=document.getElementById(inputId);
  const preview=document.getElementById(previewId);
  const file=input?.files?.[0];
  if(!preview) return;
  if(!file){ preview.textContent="No image selected."; return; }
  if(!file.type || !file.type.startsWith("image/")){
    alert("Please choose an image file.");
    input.value="";
    preview.textContent="No image selected.";
    return;
  }
  const url=URL.createObjectURL(file);
  preview.innerHTML=`Selected: ${escapeHTML(file.name)}<img src="${url}" alt="Selected image preview">`;
}

function clearOverviewImagePreview(previewId){
  const preview=document.getElementById(previewId);
  if(preview) preview.textContent="No image selected.";
}
function applyTheme(){
  document.body.classList.toggle("light-mode", data.theme === "light");
}
function clearFields(ids){ids.forEach(id=>setVal(id,""))}
function escapeHTML(str=""){return String(str).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function escapeAttr(str=""){return escapeHTML(str)}
function stripHTML(html=""){const div=document.createElement("div"); div.innerHTML=html; return div.textContent||div.innerText||""}
function detail(label,value){if(!value)return""; return `<p><strong>${escapeHTML(label)}:</strong> ${escapeHTML(value).replaceAll("\n","<br>")}</p>`}
function countWords(text=""){return (text.trim().match(/\b[\w’'-]+\b/g)||[]).length}
function activeSeries(){return data.series.find(s=>s.id===data.activeSeriesId)||null}
function activeBook(){return data.books.find(b=>b.id===data.activeBookId)||null}
function activeChapter(){const b=activeBook(); return (b?.manuscript||[]).find(c=>c.id===data.activeChapterId)||null}
function activeScene(){const ch=activeChapter(); return (ch?.scenes||[]).find(s=>s.id===data.activeSceneId)||null}
function isSeriesProject(){return (activeSeries()?.type||"series")==="series"}
function ensureCollections(){["series","books","characters","relationships","timeline","chapterPlans","threads","scenes","world","locations","magicSystems","organizations","mysteries","foreshadowing","plotArcs","plotCards","structureBeats"].forEach(k=>{if(!data[k])data[k]=[]}); if(!data.music)data.music={}; if(!data.worldCategories)data.worldCategories=[]; if(!data.theme)data.theme="dark"; if(!data.libraryView)data.libraryView="stories"; if(!data.currentView)data.currentView="projectDashboard"; if(!data.editorCollapsedChapters)data.editorCollapsedChapters={}; if(typeof data.manuscriptSidebarCollapsed!=="boolean")data.manuscriptSidebarCollapsed=false; }
function ensureProject(){ensureCollections(); const b=activeBook(); if(b){if(!b.manuscript)b.manuscript=[]; if(!b.manuscript.length){const scene={id:uid(),title:"Scene 1",content:"",pov:"",locationId:"",date:"",mood:"",purpose:"",characterIds:[],organizationIds:[],magicSystemIds:[],itemArtifactIds:[],floraFaunaIds:[],plotCardId:"",created:new Date().toISOString()}; const ch={id:uid(),title:"Chapter One",scenes:[scene],created:new Date().toISOString()}; b.manuscript.push(ch); data.activeChapterId=ch.id; data.activeSceneId=scene.id} b.manuscript.forEach(ch=>{if(!ch.scenes){ch.scenes=[{id:uid(),title:ch.title||"Scene 1",content:ch.content||"",pov:"",locationId:"",date:"",mood:"",purpose:"",characterIds:[],organizationIds:[],magicSystemIds:[],itemArtifactIds:[],floraFaunaIds:[],plotCardId:"",created:ch.created||new Date().toISOString()}]; delete ch.content} (ch.scenes||[]).forEach(sc=>{if(!Array.isArray(sc.characterIds))sc.characterIds=[]; if(!Array.isArray(sc.organizationIds))sc.organizationIds=[]; if(!Array.isArray(sc.magicSystemIds))sc.magicSystemIds=[]; if(!Array.isArray(sc.itemArtifactIds))sc.itemArtifactIds=[]; if(!Array.isArray(sc.floraFaunaIds))sc.floraFaunaIds=[]; if(typeof sc.plotCardId!=="string")sc.plotCardId="";});}); if(!data.activeChapterId)data.activeChapterId=b.manuscript[0]?.id||null; if(!data.activeSceneId)data.activeSceneId=activeChapter()?.scenes?.[0]?.id||null}}

function switchAuthMode(mode){authMode=mode;document.getElementById("loginTab").classList.toggle("active",mode==="login");document.getElementById("signupTab").classList.toggle("active",mode==="signup");document.getElementById("authSubmitBtn").textContent=mode==="login"?"Login":"Create Account";setLoginMessage("")}
async function submitAuth(){return authMode==="login"?signIn():signUp()}
function setLoginMessage(message){const el=document.getElementById("loginMessage"); if(el)el.textContent=message||""}
function setProjectMessage(message){const el=document.getElementById("projectMessage"); if(el)el.textContent=message||""}
async function refreshSession(){if(!supabaseClient)return; const {data:sessionData}=await supabaseClient.auth.getSession(); const user=sessionData?.session?.user||null; data.user=user?{id:user.id,email:user.email}:null; localStorage.setItem(STORAGE_KEY,JSON.stringify(data,null,2)); updateAuthGate()}
function updateAuthGate(){applyTheme(); const loggedIn=!!data.user?.id; const hasProject=!!(data.activeSeriesId&&data.activeBookId); document.getElementById("loginScreen").classList.toggle("hidden",loggedIn); document.getElementById("projectScreen").classList.toggle("hidden",!loggedIn||hasProject); document.getElementById("appShell").classList.toggle("hidden",!loggedIn||!hasProject); renderAccount(); if(loggedIn&&!hasProject)renderProjectScreen()}
async function signUp(){if(!supabaseClient)return setLoginMessage("Supabase could not load."); const {error}=await supabaseClient.auth.signUp({email:val("loginEmail"),password:val("loginPassword")}); if(error)return setLoginMessage(error.message); setLoginMessage("Account created. Check email if confirmation is required, then login.")}
async function signIn(){
  if(!supabaseClient)return setLoginMessage("Supabase could not load. Check your internet connection and make sure the Supabase script is available.");
  const email=val("loginEmail"), password=val("loginPassword");
  if(!email||!password)return setLoginMessage("Enter both email and password.");
  setLoginMessage("Logging in...");
  const {data:result,error}=await supabaseClient.auth.signInWithPassword({email,password});
  if(error)return setLoginMessage(error.message);
  data.user={id:result.user.id,email:result.user.email};
  localStorage.setItem(STORAGE_KEY,JSON.stringify(data,null,2));
  await loadFromCloud(false);
  data.activeSeriesId=null; data.activeBookId=null;
  setLoginMessage("");
  updateAuthGate();
}
async function signOut(){if(supabaseClient)await supabaseClient.auth.signOut(); data.user=null; data.activeSeriesId=null; data.activeBookId=null; localStorage.setItem(STORAGE_KEY,JSON.stringify(data,null,2)); updateAuthGate()}
async function sendPasswordResetFromLogin(){if(!supabaseClient)return setLoginMessage("Supabase could not load."); const email=val("loginEmail"); if(!email)return setLoginMessage("Enter your email first."); const {error}=await supabaseClient.auth.resetPasswordForEmail(email); setLoginMessage(error?error.message:"Password reset email sent.")}
function renderAccount(){setText("accountStatus",data.user?.email||"Not signed in"); setText("syncStatus",data.user?.id?"Signed in. Auto-save enabled.":"Login required.")}


function showCreateProjectPanel(){
  document.getElementById("createProjectPanel")?.classList.remove("hidden");
}
function hideCreateProjectPanel(){
  document.getElementById("createProjectPanel")?.classList.add("hidden");
}
function importDataFromDashboard(){
  document.getElementById("dashboardImportFile")?.click();
}
function savePinnedNote(){
  data.pinnedNote = val("dashboardPinnedNote");
  saveData(false);
  renderProjectScreen();
}
function activeProjects(){return (data.series||[]).filter(s=>!s.deletedAt)}
function trashedProjects(){return (data.series||[]).filter(s=>s.deletedAt)}
function firstProjectBook(){
  const recent = data.lastOpened;
  if(recent){
    const series = data.series.find(s => s.id === recent.seriesId && !s.deletedAt);
    const book = data.books.find(b => b.id === recent.bookId && b.seriesId === recent.seriesId);
    if(series && book) return { series, book };
  }
  const firstSeries = activeProjects()[0];
  if(!firstSeries) return null;
  const firstBook = data.books.find(b => b.seriesId === firstSeries.id);
  if(!firstBook) return null;
  return { series:firstSeries, book:firstBook };
}
function quickOpenFirstProject(){
  const item = firstProjectBook();
  if(!item) { showCreateProjectPanel(); return; }
  openProjectFromDashboard(item.series.id, item.book.id);
}
function setLibraryView(view){data.libraryView=view; saveData(false); renderProjectScreen();}
function toggleFavoriteProject(seriesId,event){
  if(event) event.stopPropagation();
  const s=data.series.find(p=>p.id===seriesId); if(!s)return;
  s.favorite=!s.favorite; saveData(false); renderProjectScreen();
}
function softDeleteProject(seriesId,event){
  if(event) event.stopPropagation();
  const s=data.series.find(p=>p.id===seriesId); if(!s)return;
  if(!confirm(`Move "${s.title}" to Trash? You can restore it later.`))return;
  s.deletedAt=new Date().toISOString();
  if(data.activeSeriesId===seriesId){data.activeSeriesId=null;data.activeBookId=null;}
  saveData(false); renderProjectScreen(); setProjectMessage(`Moved "${s.title}" to Trash.`);
}
function restoreProject(seriesId,event){
  if(event) event.stopPropagation();
  const s=data.series.find(p=>p.id===seriesId); if(!s)return;
  delete s.deletedAt; saveData(false); renderProjectScreen(); setProjectMessage(`Restored "${s.title}".`);
}
function permanentlyDeleteProject(seriesId,event){
  if(event) event.stopPropagation();
  const project=data.series.find(s=>s.id===seriesId); if(!project)return;
  if(!confirm(`Permanently delete "${project.title}" and all attached books/bible items? This cannot be undone.`))return;
  removeProjectData(seriesId); saveData(false); renderProjectScreen(); setProjectMessage(`Permanently deleted "${project.title}".`);
}
function removeProjectData(seriesId){
  const bookIds=data.books.filter(b=>b.seriesId===seriesId).map(b=>b.id);
  data.books=data.books.filter(b=>b.seriesId!==seriesId);
  ["characters","relationships","timeline","chapterPlans","threads","scenes","world","locations","magicSystems","organizations","mysteries","foreshadowing","plotArcs","plotCards","structureBeats"].forEach(k=>{data[k]=(data[k]||[]).filter(item=>item.seriesId!==seriesId&&!bookIds.includes(item.bookId));});
  if(data.music) delete data.music[seriesId];
  data.series=data.series.filter(s=>s.id!==seriesId);
}
function projectWordCount(book){
  return (book?.manuscript || []).flatMap(ch => ch.scenes || []).reduce((sum, sc) => sum + countWords(stripHTML(sc.content || "")), 0);
}
function projectSceneCount(book){
  return (book?.manuscript || []).flatMap(ch => ch.scenes || []).length;
}
function openProjectFromDashboard(seriesId, bookId){
  const project=data.series.find(s=>s.id===seriesId);
  if(project?.deletedAt){ setProjectMessage("Restore this project from Trash before opening it."); return; }
  if(!bookId){ setProjectMessage("This project has no books yet. Create a book first."); showCreateProjectPanel(); return; }
  data.activeSeriesId = seriesId;
  data.activeBookId = bookId;
  data.lastOpened = {seriesId, bookId, openedAt:new Date().toISOString()};
  const book = activeBook();
  const firstChapter = book?.manuscript?.[0];
  data.activeChapterId = firstChapter?.id || null;
  data.activeSceneId = firstChapter?.scenes?.[0]?.id || null;
  saveData();
  updateAuthGate();
  setView("projectDashboard");
}
function renderProjectScreen(){
  ensureCollections();
  applyTheme();

  const name = data.user?.email ? data.user.email.split("@")[0] : "Writer";
  setText("dashboardName", name.charAt(0).toUpperCase() + name.slice(1));

  const selectableProjects = activeProjects();
  const projectOptions = selectableProjects.length
    ? selectableProjects.map(s=>`<option value="${s.id}">${escapeHTML(s.title)} (${s.type==="standalone"?"Standalone":"Series"})</option>`).join("")
    : `<option value="">No active projects yet</option>`;
  setHTML("projectSeriesSelect", projectOptions);
  setHTML("newBookSeriesSelect", `<option value="">None — make this a Standalone Book</option>` + (projectOptions.includes("No active") ? "" : projectOptions));
  projectSeriesChanged();

  const q = (val("projectSearch") || "").toLowerCase();
  const view = data.libraryView || "stories";
  let projects = view === "trash" ? trashedProjects() : activeProjects();
  if(view === "favorites") projects = projects.filter(s => s.favorite);
  if(view === "recent") projects = projects.slice().sort((a,b)=>{
    const ao = data.lastOpened?.seriesId === a.id ? data.lastOpened.openedAt : (a.openedAt || a.created || "");
    const bo = data.lastOpened?.seriesId === b.id ? data.lastOpened.openedAt : (b.openedAt || b.created || "");
    return String(bo).localeCompare(String(ao));
  });
  projects = projects.filter(s => !q || JSON.stringify(s).toLowerCase().includes(q) || data.books.some(b => b.seriesId === s.id && b.title.toLowerCase().includes(q)));

  document.querySelectorAll(".story-nav[data-library]").forEach(btn=>btn.classList.toggle("active", btn.dataset.library === view));
  const titleMap={stories:"My Stories", favorites:"Favorites", recent:"Recently Opened", trash:"Trash"};
  setHTML("dashboardLibraryTitle", `${titleMap[view] || "My Stories"}`);

  const cards = projects.map((s) => {
    const books = data.books.filter(b => b.seriesId === s.id);
    const primaryBook = books[0];
    const words = books.reduce((sum, b) => sum + projectWordCount(b), 0);
    const scenes = books.reduce((sum, b) => sum + projectSceneCount(b), 0);
    const progress = Math.min(100, Math.round(words / 50000 * 100));
    const status = primaryBook?.status || (s.type === "standalone" ? "Planning" : `${books.length} book${books.length === 1 ? "" : "s"}`);
    const buttons = view === "trash"
      ? `<button class="ghost-btn" onclick="restoreProject('${s.id}',event)">Restore</button><button class="delete-btn" onclick="permanentlyDeleteProject('${s.id}',event)">Delete Forever</button>`
      : `<button class="ghost-btn" onclick="toggleFavoriteProject('${s.id}',event)">${s.favorite ? "★ Favorited" : "☆ Favorite"}</button><button class="delete-btn" onclick="softDeleteProject('${s.id}',event)">Delete</button>`;
    const shelfBooks = books.slice(0, 4);
    const shelf = shelfBooks.length ? `<div class="main-bookshelf-preview">${shelfBooks.map(b=>{
      const cover = b.cover
        ? `<img class="main-book-cover" src="${b.cover}" alt="${escapeHTML(b.title||"Book cover")}">`
        : `<div class="main-book-cover main-book-cover-placeholder"><span>No Cover</span><button type="button" onclick="triggerBookCoverUpload('${b.id}',event)">+ Add</button></div>`;
      return `<div class="main-book-cover-card" onclick="event.stopPropagation(); openProjectFromDashboard('${s.id}','${b.id}')" title="${escapeAttr(b.title||"Untitled Book")}">${cover}<input id="bookCoverUpload_${b.id}" type="file" accept="image/*" class="hidden" onchange="updateBookCover('${b.id}',this)"><small>${escapeHTML(b.title||"Untitled")}</small></div>`;
    }).join("")}${books.length>4?`<div class="main-book-more">+${books.length-4}</div>`:""}</div>` : `<div class="main-bookshelf-preview empty-shelf"><button type="button" onclick="event.stopPropagation(); openProjectFromDashboard('${s.id}','${primaryBook?.id || ""}')">Open Project</button></div>`;
    return `<article class="story-card story-card-bookshelf" onclick="openProjectFromDashboard('${s.id}','${primaryBook?.id || ""}')">
      <div class="story-card-body">
        <div class="story-card-title-row"><h3>${escapeHTML(s.title)}</h3><span>${s.favorite ? "★" : ""}</span></div>
        <span class="tag">${escapeHTML(s.type === "standalone" ? "Standalone" : "Series")}</span>
        ${s.deletedAt ? `<span class="tag danger-tag">In Trash</span>` : ""}
        ${shelf}
        <p>${escapeHTML(status)}</p>
        <p>${books.length} book${books.length === 1 ? "" : "s"} · ${scenes} scenes</p>
        <div class="progress-bar"><span style="width:${progress}%"></span></div>
        <p>${words.toLocaleString()} words</p>
        <div class="story-card-actions">${buttons}</div>
      </div>
    </article>`;
  }).join("");

  const emptyMessage = view === "trash" ? "Trash is empty." : view === "favorites" ? "No favorites yet. Star a story from My Stories." : "No stories here yet.";
  setHTML("dashboardStoryCards", (cards || `<p class="muted">${emptyMessage}</p>`) + (view === "trash" ? "" : `<div class="add-story-card" onclick="showCreateProjectPanel()"><div><div style="font-size:3rem;">✒</div><strong>+ New Book<br>or Series</strong></div></div>`));

  const item = firstProjectBook();
  if(item) {
    const ch = item.book.manuscript?.[0];
    const sc = ch?.scenes?.[0];
    setHTML("continueWritingCard", `<div class="continue-card">
      <strong>${escapeHTML(sc?.title || ch?.title || item.book.title)}</strong>
      <span>${escapeHTML(item.series.title)} — ${escapeHTML(item.book.title)}</span>
      <div class="progress-bar"><span style="width:65%"></span></div>
      <button onclick="quickOpenFirstProject()">Resume Writing</button>
    </div>`);
  } else {
    setHTML("continueWritingCard", `<p>No stories yet.</p><button onclick="showCreateProjectPanel()">Create your first story</button>`);
  }

  const allBooks = data.books.filter(b => activeProjects().some(s => s.id === b.seriesId));
  const allWords = allBooks.reduce((sum, b) => sum + projectWordCount(b), 0);
  const allScenes = allBooks.reduce((sum, b) => sum + projectSceneCount(b), 0);
  const allChapters = allBooks.reduce((sum, b) => sum + (b.manuscript || []).length, 0);
  setText("dashWords", allWords.toLocaleString());
  setText("dashChapters", allChapters);
  setText("dashScenes", allScenes);
  setText("dashCharacters", (data.characters || []).length);

  const recent = [
    ...allBooks.slice(-3).map(b => `Edited ${escapeHTML(b.title)}`),
    ...(data.characters || []).slice(-2).map(c => `Added character: ${escapeHTML(c.name)}`),
    ...(data.threads || []).slice(-2).map(t => `Created plot thread: ${escapeHTML(t.title)}`)
  ].slice(-5).reverse();

  setHTML("recentActivity", recent.length ? recent.map(r => `<p>${r}</p>`).join("") : "<p>No recent activity yet.</p>");
  setVal("dashboardPinnedNote", data.pinnedNote || "");

  const playlistProjects = activeProjects().filter(s => { const m=normalizeMusicRecord(data.music?.[s.id]||{}); return (m.tracks&&m.tracks.length)||(m.playlists&&m.playlists.length)||m.notes; });
  setHTML("dashboardPlaylistPreview", playlistProjects.length ? playlistProjects.map(s=>{
    const m=normalizeMusicRecord(data.music[s.id]||{});
    return `<p><strong>${escapeHTML(s.title)}</strong><br>${(m.tracks||[]).length} uploaded track(s) • ${(m.playlists||[]).length} playlist(s)</p>`;
  }).join("") : "<p>No project music yet. Add uploaded tracks inside a project.</p>");
}
function toggleTheme(){
  data.theme = data.theme === "light" ? "dark" : "light";
  applyTheme();
  saveData(false);
}
function selectedProjectId(){
  return val("projectSeriesSelect");
}
function deleteSelectedProject(){
  const seriesId = selectedProjectId();
  if(!seriesId) return setProjectMessage("Select a project first.");
  softDeleteProject(seriesId);
}
function normalizeMusicRecord(music){
  music = music || {};
  if(!Array.isArray(music.tracks)) music.tracks = [];
  if(!Array.isArray(music.playlists)) music.playlists = [];
  if(typeof music.notes !== "string") music.notes = "";
  if(!music.activePlaylistId && music.playlists[0]) music.activePlaylistId = music.playlists[0].id;
  if(!music.expandedPlaylists) music.expandedPlaylists = {};
  // Backward compatibility for old link-based playlist data.
  if(music.link && !music.legacyLink) music.legacyLink = music.link;
  music.tracks.forEach(t=>{
    if(!t.id) t.id = uid();
    if(!t.title) t.title = t.name || "Untitled Track";
  });
  music.playlists.forEach(pl=>{
    if(!pl.id) pl.id = uid();
    if(!pl.name) pl.name = "Untitled Playlist";
    if(!Array.isArray(pl.trackIds)) pl.trackIds = [];
    if(music.expandedPlaylists[pl.id] === undefined) music.expandedPlaylists[pl.id] = false;
  });
  return music;
}
function musicForProject(){
  const id = data.activeSeriesId;
  if(!data.music) data.music = {};
  if(!data.music[id]) data.music[id] = { notes:"", tracks:[], playlists:[], activePlaylistId:null };
  data.music[id] = normalizeMusicRecord(data.music[id]);
  return data.music[id];
}
function saveMusicNotes(){
  const music = musicForProject();
  music.notes = val("musicNotes");
  saveData();
}
function fileToDataURL(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function openMusicDB(){
  return new Promise((resolve,reject)=>{
    if(!window.indexedDB) return reject(new Error("IndexedDB is not supported in this browser."));
    const request = indexedDB.open("PlotPalsMusicFiles", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if(!db.objectStoreNames.contains("tracks")) db.createObjectStore("tracks", { keyPath:"id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function saveMusicBlob(trackId, file){
  const db = await openMusicDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction("tracks", "readwrite");
    tx.objectStore("tracks").put({ id: trackId, blob: file, name: file.name, type: file.type, size: file.size, savedAt: new Date().toISOString() });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
async function getMusicBlob(trackId){
  const db = await openMusicDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction("tracks", "readonly");
    const req = tx.objectStore("tracks").get(trackId);
    req.onsuccess = () => resolve(req.result?.blob || null);
    req.onerror = () => reject(req.error);
  });
}
async function deleteMusicBlob(trackId){
  try{
    const db = await openMusicDB();
    return new Promise((resolve)=>{
      const tx = db.transaction("tracks", "readwrite");
      tx.objectStore("tracks").delete(trackId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }catch(err){ return false; }
}
async function resolveMusicTrackSrc(track){
  if(!track) return "";
  if(track.src) return track.src;
  if(track.storage === "indexeddb"){
    const blob = await getMusicBlob(track.id);
    if(blob) return URL.createObjectURL(blob);
  }
  return "";
}
async function uploadMusicTracks(event){
  const files = Array.from(event.target.files || []);
  if(!files.length) return;
  const music = musicForProject();
  let added = 0;
  setText("musicUploadStatus", "Uploading music into this project...");
  for(const file of files){
    if(!file.type.startsWith("audio/")) continue;
    const id = uid();
    try{
      await saveMusicBlob(id, file);
      music.tracks.push({ id, title: file.name.replace(/\.[^/.]+$/, ""), fileName: file.name, type: file.type, size: file.size, storage:"indexeddb", uploadedAt:new Date().toISOString() });
    }catch(err){
      // Fallback for browsers that block IndexedDB: smaller files can still be saved as data URLs.
      const src = await fileToDataURL(file);
      music.tracks.push({ id, title: file.name.replace(/\.[^/.]+$/, ""), fileName: file.name, type: file.type, size: file.size, src, storage:"localStorage", uploadedAt:new Date().toISOString() });
    }
    added++;
  }
  if(!music.playlists.length){
    const pl = { id: uid(), name: "Project Playlist", trackIds: music.tracks.map(t=>t.id) };
    music.playlists.push(pl);
    music.activePlaylistId = pl.id;
  }
  event.target.value = "";
  setText("musicUploadStatus", added ? `${added} music file(s) uploaded and saved to this project.` : "No audio files were selected.");
  saveData();
}
function createMusicPlaylist(){
  const name = val("newMusicPlaylistName") || "New Playlist";
  const music = musicForProject();
  const pl = { id: uid(), name, trackIds: [] };
  music.playlists.push(pl);
  music.activePlaylistId = pl.id;
  setVal("newMusicPlaylistName", "");
  saveData();
}
function setActiveMusicPlaylist(id){
  const music = musicForProject();
  music.activePlaylistId = id;
  saveData();
}
function toggleMusicPlaylistOpen(id){
  const music = musicForProject();
  if(!music.expandedPlaylists) music.expandedPlaylists = {};
  music.expandedPlaylists[id] = !music.expandedPlaylists[id];
  music.activePlaylistId = id;
  saveData();
}
function musicPlaylistDragStart(event, playlistId, trackId){
  event.dataTransfer.setData("text/plain", JSON.stringify({ playlistId, trackId }));
  event.dataTransfer.effectAllowed = "move";
}
function musicPlaylistDragOver(event){
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}
function musicPlaylistDrop(event, playlistId, targetTrackId){
  event.preventDefault();
  let payload = null;
  try{ payload = JSON.parse(event.dataTransfer.getData("text/plain") || "{}"); }catch(err){ return; }
  if(!payload?.trackId || payload.playlistId !== playlistId) return;
  const music = musicForProject();
  const pl = music.playlists.find(p=>p.id===playlistId);
  if(!pl) return;
  const ids = (pl.trackIds || []).filter(id=>id!==payload.trackId);
  if(targetTrackId){
    const targetIndex = ids.indexOf(targetTrackId);
    ids.splice(targetIndex < 0 ? ids.length : targetIndex, 0, payload.trackId);
  } else {
    ids.push(payload.trackId);
  }
  pl.trackIds = ids;
  music.activePlaylistId = playlistId;
  if(!music.expandedPlaylists) music.expandedPlaylists = {};
  music.expandedPlaylists[playlistId] = true;
  saveData();
}
function renameMusicPlaylist(id){
  const music = musicForProject();
  const pl = music.playlists.find(p=>p.id===id);
  if(!pl) return;
  const name = prompt("Rename playlist", pl.name);
  if(name && name.trim()){ pl.name = name.trim(); saveData(); }
}
function deleteMusicPlaylist(id){
  const music = musicForProject();
  music.playlists = music.playlists.filter(p=>p.id!==id);
  if(music.activePlaylistId===id) music.activePlaylistId = music.playlists[0]?.id || null;
  saveData();
}
function toggleTrackInPlaylist(playlistId, trackId){
  const music = musicForProject();
  let pl = music.playlists.find(p=>p.id===playlistId);
  if(!pl){
    pl = { id: uid(), name: "Project Playlist", trackIds: [] };
    music.playlists.push(pl);
    music.activePlaylistId = pl.id;
  }
  pl.trackIds = pl.trackIds || [];
  if(pl.trackIds.includes(trackId)) pl.trackIds = pl.trackIds.filter(id=>id!==trackId);
  else pl.trackIds.push(trackId);
  saveData();
}
async function deleteMusicTrack(trackId){
  const music = musicForProject();
  music.tracks = music.tracks.filter(t=>t.id!==trackId);
  music.playlists.forEach(pl=>pl.trackIds = (pl.trackIds||[]).filter(id=>id!==trackId));
  await deleteMusicBlob(trackId);
  saveData();
}
function musicPlayerState(){
  const music = musicForProject();
  if(!music.playerState) music.playerState = { trackId:null, playlistId:null, title:"Project Music Player" };
  return music.playerState;
}
function getMusicTrack(trackId){
  const music = musicForProject();
  return music.tracks.find(t=>t.id===trackId) || null;
}
function updateMusicNowPlaying(title){
  const label = title || musicPlayerState().title || "Project Music Player";
  setText("globalMusicNowPlaying", label);
  setText("projectPlaylistNowPlaying", label);
}
async function loadTrackIntoPlayers(trackId, autoplay=true){
  const music = musicForProject();
  const track = music.tracks.find(t=>t.id===trackId);
  if(!track) return;
  const src = await resolveMusicTrackSrc(track);
  if(!src){ alert("This uploaded music file could not be found in browser storage. Try uploading it again."); return; }
  const state = musicPlayerState();
  state.trackId = trackId;
  state.title = track.title || "Now Playing";
  state.src = src;
  state.updatedAt = new Date().toISOString();
  [document.getElementById("plotpalsAudioPlayer"), document.getElementById("globalAudioMirror")].filter(Boolean).forEach(audio=>{
    if(audio.src !== src) audio.src = src;
  });
  updateMusicNowPlaying(state.title);
  const globalAudio = document.getElementById("globalAudioMirror") || document.getElementById("plotpalsAudioPlayer");
  if(globalAudio && autoplay) globalAudio.play().catch(()=>{});
  saveData(false);
}
async function playTrack(trackId){
  await loadTrackIntoPlayers(trackId, true);
}
function playPlaylist(playlistId){
  const music = musicForProject();
  const pl = music.playlists.find(p=>p.id===playlistId);
  music.activePlaylistId = playlistId;
  const state = musicPlayerState();
  state.playlistId = playlistId;
  const firstId = pl?.trackIds?.find(id=>music.tracks.some(t=>t.id===id));
  if(firstId) playTrack(firstId);
  else saveData(false);
}
function playNextMusicTrack(){
  const music = musicForProject();
  const state = musicPlayerState();
  const pl = music.playlists.find(p=>p.id===state.playlistId) || music.playlists.find(p=>p.id===music.activePlaylistId) || music.playlists[0];
  const ids = pl?.trackIds?.filter(id=>music.tracks.some(t=>t.id===id)) || music.tracks.map(t=>t.id);
  if(!ids.length) return;
  const idx = Math.max(0, ids.indexOf(state.trackId));
  playTrack(ids[(idx+1)%ids.length]);
}
function syncMusicPlayers(source){
  const page = document.getElementById("plotpalsAudioPlayer");
  const global = document.getElementById("globalAudioMirror");
  if(!page || !global) return;
  const master = source === "page" ? page : global;
  const mirror = source === "page" ? global : page;
  if(master.src && mirror.src !== master.src) mirror.src = master.src;
  if(Math.abs((mirror.currentTime||0) - (master.currentTime||0)) > 1.25) mirror.currentTime = master.currentTime || 0;
}
function wireMusicPlayerSync(){
  const page = document.getElementById("plotpalsAudioPlayer");
  const global = document.getElementById("globalAudioMirror");
  const state = musicPlayerState();
  [page, global].filter(Boolean).forEach(audio=>{
    if(audio.dataset.synced === "true") return;
    audio.dataset.synced = "true";
    audio.addEventListener("play", ()=>{
      const other = audio === page ? global : page;
      if(other && !other.paused) other.pause();
      syncMusicPlayers(audio === page ? "page" : "global");
      updateMusicNowPlaying(state.title);
    });
    audio.addEventListener("pause", ()=>syncMusicPlayers(audio === page ? "page" : "global"));
    audio.addEventListener("seeked", ()=>syncMusicPlayers(audio === page ? "page" : "global"));
    audio.addEventListener("timeupdate", ()=>{
      if(audio.paused) return;
      const other = audio === page ? global : page;
      if(other && other.paused) syncMusicPlayers(audio === page ? "page" : "global");
    });
    audio.addEventListener("ended", playNextMusicTrack);
  });
  if(state.src){
    [page, global].filter(Boolean).forEach(audio=>{ if(audio.src !== state.src) audio.src = state.src; });
  }
  updateMusicNowPlaying(state.title);
}
function renderMusicPlayerPanel(music){
  const active = music.playlists.find(p=>p.id===music.activePlaylistId) || music.playlists[0];
  const activeTracks = active ? (active.trackIds||[]).map(id=>music.tracks.find(t=>t.id===id)).filter(Boolean) : [];
  return `<article class="item-card theme-card playlist-card music-player-card">
    <div class="card-header"><h3>Music Player</h3>${active?`<button onclick="playPlaylist('${active.id}')">Play Playlist</button>`:""}</div>
    <div class="card-body">
      <p><strong>${escapeHTML(active?.name || "No playlist selected")}</strong></p>
      <p class="muted small-text">Now playing: <span id="projectPlaylistNowPlaying">Project Music Player</span></p>
      <audio id="plotpalsAudioPlayer" controls preload="metadata"></audio>
      <div class="music-track-list">
        ${activeTracks.length ? activeTracks.map(t=>`<button class="music-track-btn" onclick="playTrack('${t.id}')">▶ ${escapeHTML(t.title)}</button>`).join("") : "<p>Add uploaded tracks to a playlist to play them here.</p>"}
      </div>
      ${detail("Notes", music.notes)}
    </div>
  </article>`;
}
function musicSortValue(track, key){
  if(!track) return "";
  if(key === "artist") return (track.artist || track.title || track.fileName || "").toLowerCase();
  if(key === "duration") return Number(track.duration || 0);
  if(key === "newest" || key === "oldest") return new Date(track.uploadedAt || track.created || 0).getTime() || 0;
  return (track.title || track.fileName || "").toLowerCase();
}
function getSortedMusicLibrary(music){
  const search = (val("musicLibrarySearch") || "").trim().toLowerCase();
  const sort = val("musicLibrarySort") || "az";
  let tracks = [...(music.tracks || [])];
  if(search){
    tracks = tracks.filter(t => [t.title, t.artist, t.album, t.fileName].some(v => String(v || "").toLowerCase().includes(search)));
  }
  tracks.sort((a,b)=>{
    if(sort === "newest") return musicSortValue(b,"newest") - musicSortValue(a,"newest");
    if(sort === "oldest") return musicSortValue(a,"oldest") - musicSortValue(b,"oldest");
    if(sort === "duration") return musicSortValue(a,"duration") - musicSortValue(b,"duration");
    if(sort === "artist") return String(musicSortValue(a,"artist")).localeCompare(String(musicSortValue(b,"artist"))) || String(musicSortValue(a,"az")).localeCompare(String(musicSortValue(b,"az")));
    if(sort === "za") return String(musicSortValue(b,"az")).localeCompare(String(musicSortValue(a,"az")));
    return String(musicSortValue(a,"az")).localeCompare(String(musicSortValue(b,"az")));
  });
  return tracks;
}
function renderPlaylistTrackRow(pl, track){
  return `<div class="playlist-song-row" draggable="true" ondragstart="musicPlaylistDragStart(event,'${pl.id}','${track.id}')" ondragover="musicPlaylistDragOver(event)" ondrop="musicPlaylistDrop(event,'${pl.id}','${track.id}')">
    <span class="drag-handle" title="Drag to reorder">☰</span>
    <button class="music-track-btn" onclick="playTrack('${track.id}')">▶ ${escapeHTML(track.title)}</button>
    <button class="delete-btn small-btn" onclick="toggleTrackInPlaylist('${pl.id}','${track.id}')">Remove</button>
  </div>`;
}
function renderMusic(){
  const music = musicForProject();
  setVal("musicNotes", music.notes);
  const activePlaylistId = music.activePlaylistId || music.playlists[0]?.id || "";
  const playlistTabs = music.playlists.length ? `<div class="music-playlist-tabs">${music.playlists.map(pl=>`<button class="${pl.id===activePlaylistId?"active":""}" onclick="setActiveMusicPlaylist('${pl.id}')">${escapeHTML(pl.name)}</button>`).join("")}</div>` : "<p>No playlists yet. Create one above or upload music to auto-create a Project Playlist.</p>";
  const playlists = music.playlists.map(pl=>{
    const isOpen = !!music.expandedPlaylists?.[pl.id];
    const tracks = (pl.trackIds||[]).map(id=>music.tracks.find(t=>t.id===id)).filter(Boolean);
    const songs = isOpen ? `<div class="playlist-song-list" ondragover="musicPlaylistDragOver(event)" ondrop="musicPlaylistDrop(event,'${pl.id}',null)">
      ${tracks.length ? tracks.map(t=>renderPlaylistTrackRow(pl,t)).join("") : `<p class="muted small-text">No songs in this playlist yet. Add songs from the music library below.</p>`}
      ${tracks.length ? `<p class="muted small-text">Drag songs by the ☰ handle to arrange the playlist order.</p>` : ""}
    </div>` : "";
    return `<article class="item-card theme-card playlist-card ${isOpen?"open":""}">
      <div class="card-header playlist-toggle-header" onclick="toggleMusicPlaylistOpen('${pl.id}')">
        <h3>${isOpen?"▾":"▸"} ${escapeHTML(pl.name)}</h3>
        <div onclick="event.stopPropagation()"><button onclick="playPlaylist('${pl.id}')">Play</button><button onclick="renameMusicPlaylist('${pl.id}')">Rename</button><button class="delete-btn" onclick="deleteMusicPlaylist('${pl.id}')">Delete</button></div>
      </div>
      <div class="card-body"><p>${tracks.length} track(s)</p>${songs}</div>
    </article>`;
  }).join("");
  const sortedTracks = getSortedMusicLibrary(music);
  const emptyLibraryMessage = music.tracks.length ? "<p>No tracks match your search.</p>" : "<p>No uploaded music yet.</p>";
  const library = sortedTracks.length ? sortedTracks.map(t=>`<article class="item-card music-library-track"><div class="card-header"><h3>${escapeHTML(t.title)}</h3><button class="delete-btn" onclick="deleteMusicTrack('${t.id}')">Delete</button></div><div class="card-body"><p class="muted small-text">${escapeHTML(t.fileName||"")} • ${t.storage==="indexeddb"?"Uploaded to browser music storage":"Saved in project data"}</p><button onclick="playTrack('${t.id}')">Play Track</button><div class="playlist-checks">${music.playlists.length ? music.playlists.map(pl=>`<label><input type="checkbox" ${pl.trackIds?.includes(t.id)?"checked":""} onchange="toggleTrackInPlaylist('${pl.id}','${t.id}')" /> ${escapeHTML(pl.name)}</label>`).join("") : "<p>Create a playlist to organize this track.</p>"}</div></div></article>`).join("") : emptyLibraryMessage;
  const legacy = music.legacyLink ? `<div class="panel"><h3>Old Saved Link</h3><p>Your old playlist link was kept for reference:</p><a class="playlist-link" target="_blank" href="${escapeHTML(music.legacyLink)}">${escapeHTML(music.legacyLink)}</a></div>` : "";
  setHTML("musicLinks", `${renderMusicPlayerPanel(music)}<div class="panel"><h3>Playlists</h3>${playlistTabs}<div class="card-grid playlist-card-grid">${playlists}</div><p class="muted small-text">Click a playlist to reveal its songs. Playlists keep your custom drag-and-drop order and are not auto-sorted.</p></div><div class="panel"><h3>Uploaded Music Library</h3><div class="card-grid">${library}</div></div>${legacy}`);
  renderGlobalMusicPlayer();
}
function renderGlobalMusicPlayer(){
  const el = document.getElementById("globalMusicPlayer");
  if(!el) return;
  const music = musicForProject();
  const hasTracks = music.tracks && music.tracks.length;
  if(!hasTracks){ el.innerHTML = ""; return; }
  if(!document.getElementById("globalAudioMirror")){
    el.innerHTML = `<div class="global-music-inner"><span id="globalMusicNowPlaying">Project Music Player</span><audio id="globalAudioMirror" controls preload="metadata"></audio></div>`;
  }
  const state = musicPlayerState();
  if(state.src){
    const globalPlayer = document.getElementById("globalAudioMirror");
    if(globalPlayer && globalPlayer.src !== state.src) globalPlayer.src = state.src;
  }
  updateMusicNowPlaying(state.title);
  wireMusicPlayerSync();
}
function projectSeriesChanged(){const seriesId=val("projectSeriesSelect"); const books=data.books.filter(b=>b.seriesId===seriesId); setHTML("projectBookSelect",books.length?books.map(b=>`<option value="${b.id}">${escapeHTML(b.title)}</option>`).join(""):`<option value="">No books in this project</option>`)}
function projectTypeChanged(){
  const type=val("newProjectType")||"series";
  const label=document.getElementById("seriesTitleLabel");
  const input=document.getElementById("newSeriesTitle");
  if(label) label.textContent = type === "standalone" ? "Series / Project Title (optional)" : "Series / Project Title";
  if(input) input.placeholder = type === "standalone" ? "Optional — Book Title is enough" : "Series title";
}
function makeStarterBook(seriesId,name){const scene={id:uid(),title:"Scene 1",content:"",pov:"",locationId:"",date:"",mood:"",purpose:"",characterIds:[],organizationIds:[],magicSystemIds:[],itemArtifactIds:[],floraFaunaIds:[],plotCardId:"",created:new Date().toISOString()}; return {id:uid(),seriesId,title:name,status:"Planning",summary:"",theme:"",notes:"",cover:"",manuscript:[{id:uid(),title:"Chapter One",scenes:[scene],created:new Date().toISOString()}],created:new Date().toISOString()}}
function createStandaloneBook(name){const series={id:uid(),title:name,type:"standalone",genre:"",synopsis:"",theme:"",mysteries:"",foreshadowing:"",created:new Date().toISOString()}; data.series.push(series); data.books.push(makeStarterBook(series.id,name)); return series;}
function createSeriesFromProject(){const type=val("newProjectType")||"series"; const bookTitle=val("newBookTitle"); const seriesTitle=val("newSeriesTitle"); if(type==="standalone"){const name=bookTitle||seriesTitle||"Untitled Book"; createStandaloneBook(name); clearFields(["newSeriesTitle","newBookTitle"]); saveData(false); renderProjectScreen(); return setProjectMessage("Standalone book created. No Series/Project Title required.");} const name=seriesTitle||"Untitled Series"; const series={id:uid(),title:name,type,genre:"",synopsis:"",theme:"",mysteries:"",foreshadowing:"",created:new Date().toISOString()}; data.series.push(series); setVal("newSeriesTitle",""); saveData(false); renderProjectScreen(); setProjectMessage("Series created. Now create/select a book.")}
function createBookFromProject(){let seriesId=val("newBookSeriesSelect"); const name=val("newBookTitle")||"Untitled Book"; if(!seriesId){const series=createStandaloneBook(name); seriesId=series.id;} else {data.books.push(makeStarterBook(seriesId,name));} setVal("newBookTitle",""); saveData(false); renderProjectScreen(); setProjectMessage(seriesId?"Book created.":"Standalone book created.")}
function openWorkspace(){const seriesId=val("projectSeriesSelect"), bookId=val("projectBookSelect"); if(!seriesId||!bookId)return setProjectMessage("Select both a project and a book."); data.activeSeriesId=seriesId; data.activeBookId=bookId; const book=activeBook(); data.activeChapterId=book?.manuscript?.[0]?.id||null; data.activeSceneId=book?.manuscript?.[0]?.scenes?.[0]?.id||null; saveData(); updateAuthGate()}
function backToProjects(){saveCurrentScene(false,false); data.activeSeriesId=null; data.activeBookId=null; saveData(false,false); updateAuthGate()}

function scheduleCloudSave(){if(!data.user?.id||!supabaseClient)return; clearTimeout(cloudSaveTimer); cloudSaveTimer=setTimeout(()=>syncToCloud(false),1600)}
async function syncToCloud(showAlert=true){if(!supabaseClient){if(showAlert)alert("Supabase is not loaded.");return} const currentProject={seriesId:data.activeSeriesId,bookId:data.activeBookId,chapterId:data.activeChapterId,sceneId:data.activeSceneId}; await refreshSession(); data.activeSeriesId=currentProject.seriesId; data.activeBookId=currentProject.bookId; data.activeChapterId=currentProject.chapterId; data.activeSceneId=currentProject.sceneId; if(!data.user?.id){if(showAlert)alert("Login first.");return} const payload={user_id:data.user.id,user_email:data.user.email,vault_data:data,updated_at:new Date().toISOString()}; const {error}=await supabaseClient.from(CLOUD_TABLE).upsert(payload,{onConflict:"user_id"}); if(error){setText("syncStatus","Sync failed."); if(showAlert)alert("Cloud sync failed. Check Supabase table/RLS. "+error.message); return} setText("syncStatus","Synced "+new Date().toLocaleTimeString()); setText("autosaveStatus","Saved"); if(showAlert)alert("Synced to Supabase.")}
async function loadFromCloud(showAlert=true){if(!supabaseClient){if(showAlert)alert("Supabase is not loaded.");return} const session=await supabaseClient.auth.getSession(); const user=session.data?.session?.user; if(!user){if(showAlert)alert("Login first.");return} const {data:rows,error}=await supabaseClient.from(CLOUD_TABLE).select("vault_data, updated_at").eq("user_id",user.id).limit(1); if(error){if(showAlert)alert("Could not load cloud data. "+error.message);return} if(!rows||!rows.length||!rows[0].vault_data){data.user={id:user.id,email:user.email}; localStorage.setItem(STORAGE_KEY,JSON.stringify(data,null,2)); if(showAlert)alert("No cloud vault found yet."); return} data={...structuredClone(defaultData),...rows[0].vault_data,user:{id:user.id,email:user.email}}; ensureCollections(); localStorage.setItem(STORAGE_KEY,JSON.stringify(data,null,2)); if(showAlert){renderAll(); alert("Loaded from Supabase.")}}

function toggleSidebar(){document.getElementById("appShell").classList.toggle("collapsed")}
function setView(view,id=null,extra=null){saveCurrentScene(false,false); data.currentView=view; if(view==="write"){if(id)data.activeChapterId=id; if(extra)data.activeSceneId=extra; if(!data.activeSceneId)data.activeSceneId=activeChapter()?.scenes?.[0]?.id||null} if(view==="characterDetail"&&id){ if(data.selectedCharacterId!==id) characterDetailEditMode=false; data.selectedCharacterId=id; } if(view==="worldDetail"&&id){ if(data.selectedWorldId!==id) worldDetailEditMode=false; data.selectedWorldId=id; } if(view==="worldCategory"&&id){ data.selectedWorldCategory=id; } if(view==="locationDetail"&&id){ if(data.selectedLocationId!==id) locationDetailEditMode=false; data.selectedLocationId=id; } if(view==="magicDetail"&&id){ if(data.selectedMagicId!==id) magicDetailEditMode=false; data.selectedMagicId=id; } if(view==="organizationDetail"&&id){ if(data.selectedOrganizationId!==id) organizationDetailEditMode=false; data.selectedOrganizationId=id; } document.querySelectorAll(".view").forEach(v=>v.classList.remove("active")); const viewEl=(view==="worldCategory"?document.getElementById("worldCategoryView"):document.getElementById(view))||document.getElementById("projectDashboard"); viewEl?.classList.add("active"); const titles={projectDashboard:"Project Dashboard",overview:"Overview",write:"Scene-Based Writing",storyBoard:"Story Structure Board",chapters:"Chapter Planner",threads:"Plot Threads",mysteries:"Mystery Tracker",foreshadowing:"Foreshadowing Tracker",plotBoard:"Plot Board",characters:"Characters",characterDetail:"Character Detail",relationships:"Relationship System",locations:"Locations",locationDetail:"Location Detail",magic:"Magic System",magicDetail:"Magic/System Detail",organizations:"Organizations",organizationDetail:"Organization Detail",scenes:"Scene Database",timeline:"Timeline",world:"Worldbuilding",worldCategory:worldCategoryLabel(data.selectedWorldCategory||"Other"),worldDetail:"Worldbuilding Detail",seriesTools:"Series-Level Tools",music:"Project Playlist",stats:"Writing Analytics",exports:"Export",backup:"Backup"}; setText("viewTitle",view==="projectDashboard"?`${activeSeries()?.title||"Project"} Dashboard`:(titles[view]||"Workspace")); renderAll()}
function renderNestedNav(){
  const nav=document.getElementById("nestedNav");
  if(!nav)return;
  const isProjectDashboard = data.currentView === "projectDashboard";
  const hasBookContext = !!data.activeBookId && !isProjectDashboard;
  const book=hasBookContext ? activeBook() : null;
  const chapters=book?.manuscript||[];
  const plans=data.chapterPlans.filter(visibleByScope);
  const threads=data.threads.filter(visibleByScope);
  const mysteries=(data.mysteries||[]).filter(seriesScope);
  const foreshadowing=(data.foreshadowing||[]).filter(seriesScope);
  const plotCards=(data.plotCards||[]).filter(visibleByScope);
  const locations=(data.locations||[]).filter(seriesScope);
  const orgs=(data.organizations||[]).filter(seriesScope);
  const magic=(data.magicSystems||[]).filter(seriesScope);
  const timeline=(data.timeline||[]).filter(seriesScope);
  const rels=(data.relationships||[]).filter(seriesScope);
  const roles=["Main","Side","Love Interest","Antagonist","Mentor","Other"];
  const charsByRole=role=>data.characters.filter(c=>seriesScope(c)&&(c.role||"Other")===role);
  const seriesOnly=isSeriesProject();

  nav.innerHTML=`
    <div class="${sectionClass('library')}">
      <button class="menu-heading" onclick="toggleMenuSection('library')">
        <span>Library</span><span>${sectionArrow('library')}</span>
      </button>
      <div class="menu-content">
        <button class="story-nav" onclick="backToProjects()">📖 My Stories</button>
        <button class="story-nav" onclick="setView('projectDashboard')">🏠 Project Dashboard</button>
        <button class="story-nav" onclick="setView('overview')">📝 Edit Overview</button>
        <button class="story-nav" onclick="setView('stats')">📈 Writing Stats</button>
        <button class="story-nav" onclick="setView('music')">♫ Project Playlist</button>
      </div>
    </div>

    ${hasBookContext ? `
    <div class="${sectionClass('manuscript')}">
      <button class="menu-heading" onclick="toggleMenuSection('manuscript')">
        <span>Manuscript</span><span>${sectionArrow('manuscript')}</span>
      </button>
      <div class="menu-content">
        <button class="story-nav nav-parent" onclick="setView('write')">
          <span>📘 Manuscript Editor</span><span class="nav-count">${chapters.length}</span>
        </button>
        ${chapters.map((c,i)=>{
          const collapsed=!!data.editorCollapsedChapters?.[c.id];
          return `
          <div class="sidebar-chapter-group">
            <div class="sidebar-chapter-row">
              <button class="story-nav nav-child ${c.id===data.activeChapterId?"active":""}" onclick="setView('write','${c.id}')">
                <span>${i+1}. ${escapeHTML(c.title||"Untitled")}</span><span class="nav-count">${(c.scenes||[]).length}</span>
              </button>
              <button class="sidebar-tree-toggle" title="${collapsed?"Expand chapter":"Collapse chapter"}" onclick="toggleEditorChapter('${c.id}')">${collapsed?"▸":"▾"}</button>
            </div>
            <div class="sidebar-scene-tree ${collapsed?"hidden":""}">
              ${(c.scenes||[]).map((s,j)=>`
                <button class="story-nav nav-grandchild ${s.id===data.activeSceneId?"active":""}" onclick="setView('write','${c.id}','${s.id}')">
                  <span>${j+1}. ${escapeHTML(s.title||"Scene")}</span>
                  <span class="nav-count">${countWords(stripHTML(s.content||""))}</span>
                </button>
              `).join("")}
            </div>
          </div>`;
        }).join("")}
      </div>
    </div>` : ""}

    <div class="${sectionClass('plot')}">
      <button class="menu-heading" onclick="toggleMenuSection('plot')">
        <span>Plot</span><span>${sectionArrow('plot')}</span>
      </button>
      <div class="menu-content">
        <button class="story-nav nav-parent" onclick="setView('storyBoard')">🧭 Story Structure</button>

        <button class="story-nav nav-parent" onclick="setView('chapters')">
          <span>📄 Chapter Planner</span><span class="nav-count">${plans.length}</span>
        </button>
        ${plans.map(p=>`
          <button class="story-nav nav-grandchild" onclick="setView('chapters')">${escapeHTML(p.number||"Untitled Chapter")}</button>
        `).join("")}

        <button class="story-nav nav-parent" onclick="setView('threads')">
          <span>🧵 Plot Threads</span><span class="nav-count">${threads.length}</span>
        </button>
        ${threads.map(t=>`
          <button class="story-nav nav-grandchild" onclick="setView('threads')">${escapeHTML(t.title||"Untitled Thread")}</button>
        `).join("")}

        <button class="story-nav nav-parent" onclick="setView('mysteries')">
          <span>🔎 Mystery Tracker</span><span class="nav-count">${mysteries.length}</span>
        </button>
        ${mysteries.map(m=>`
          <button class="story-nav nav-grandchild" onclick="setView('mysteries')">${escapeHTML(m.question||"Mystery")}</button>
        `).join("")}

        <button class="story-nav nav-parent" onclick="setView('foreshadowing')">
          <span>🕯️ Foreshadowing</span><span class="nav-count">${foreshadowing.length}</span>
        </button>
        ${foreshadowing.map(f=>`
          <button class="story-nav nav-grandchild" onclick="setView('foreshadowing')">${escapeHTML(f.hint||"Foreshadowing")}</button>
        `).join("")}

        <button class="story-nav nav-parent" onclick="setView('plotBoard')">
          <span>🗂️ Plot Board</span><span class="nav-count">${plotCards.length}</span>
        </button>
      </div>
    </div>

    <div class="${sectionClass('characters')}">
      <button class="menu-heading" onclick="toggleMenuSection('characters')">
        <span>Characters</span><span>${sectionArrow('characters')}</span>
      </button>
      <div class="menu-content">
        <button class="story-nav nav-parent" onclick="setView('characters')">
          <span>👥 All Characters</span><span class="nav-count">${data.characters.filter(seriesScope).length}</span>
        </button>
        ${roles.map(role=>`
          <button class="story-nav nav-child" onclick="setView('characters')">
            <span>${role}</span><span class="nav-count">${charsByRole(role).length}</span>
          </button>
          ${charsByRole(role).map(c=>`
            <button class="story-nav nav-grandchild" onclick="setView('characterDetail','${c.id}')">${escapeHTML(c.name||"Unnamed")}</button>
          `).join("")}
        `).join("")}
        <button class="story-nav nav-parent" onclick="setView('relationships')">
          <span>💞 Relationships</span><span class="nav-count">${rels.length}</span>
        </button>
      </div>
    </div>

    <div class="${sectionClass('worldbuilding')}">
      <button class="menu-heading" onclick="toggleMenuSection('worldbuilding')">
        <span>World Building</span><span>${sectionArrow('worldbuilding')}</span>
      </button>
      <div class="menu-content">
        ${renderWorldBuildingSidebarCategories()}
      </div>
    </div>

    <div class="${sectionClass('series')}">
      <button class="menu-heading" onclick="toggleMenuSection('series')">
        <span>Series</span><span>${sectionArrow('series')}</span>
      </button>
      <div class="menu-content">
        <button class="story-nav nav-parent" onclick="setView('seriesTools')">★ Series-Level Tools</button>
        ${hasBookContext ? `<button class="story-nav nav-parent" onclick="setView('scenes')">
          <span>🎬 Scene Database</span><span class="nav-count">${(activeBook()?.manuscript||[]).flatMap(ch=>ch.scenes||[]).length}</span>
        </button>` : ""}
        <button class="story-nav nav-parent" onclick="setView('timeline')">
          <span>⏳ Timeline</span><span class="nav-count">${timeline.length}</span>
        </button>
        ${timeline.map(t=>`
          <button class="story-nav nav-grandchild" onclick="setView('timeline')">${escapeHTML(t.when||"Timeline Event")}</button>
        `).join("")}
      </div>
    </div>

    <div class="${sectionClass('storynotes')}">
      <button class="menu-heading" onclick="toggleMenuSection('storynotes')">
        <span>Story Notes</span><span>${sectionArrow('storynotes')}</span>
      </button>
      <div class="menu-content">
        <button class="story-nav nav-parent" onclick="setView('exports')">⇩ Export</button>
        <button class="story-nav nav-parent" onclick="setView('backup')">☁ Backup</button>
      </div>
    </div>

    <div class="${sectionClass('cloud')}">
      <button class="menu-heading" onclick="toggleMenuSection('cloud')">
        <span>Cloud</span><span>${sectionArrow('cloud')}</span>
      </button>
      <div class="menu-content">
        <button class="story-nav" onclick="syncToCloud()">☁️ Sync Now</button>
        <button class="story-nav" onclick="loadFromCloud()">⇩ Load Cloud</button>
        <button class="story-nav" onclick="signOut()">🚪 Sign Out</button>
      </div>
    </div>
  `;
}


function toggleManuscriptSidebar(){
  data.manuscriptSidebarCollapsed=!data.manuscriptSidebarCollapsed;
  saveData(true,false);
}
function toggleEditorChapter(chapterId){
  if(!data.editorCollapsedChapters)data.editorCollapsedChapters={};
  data.editorCollapsedChapters[chapterId]=!data.editorCollapsedChapters[chapterId];
  saveData(true,false);
}
function sceneCharacterIds(scene){
  return sceneTrackedIds(scene,"characterIds");
}
function sceneTrackedIds(scene,key){
  if(!scene)return [];
  if(!Array.isArray(scene[key]))scene[key]=[];
  return scene[key];
}
function toggleSceneTrackedItem(key,itemId,checked){
  const scene=activeScene();
  if(!scene)return;
  const ids=sceneTrackedIds(scene,key);
  if(checked && !ids.includes(itemId))ids.push(itemId);
  if(!checked)scene[key]=ids.filter(id=>id!==itemId);
  setText("autosaveStatus","Saving...");
  saveData(true);
}
function sceneTrackingCard(title,emptyText,key,items){
  const scene=activeScene();
  const selected=sceneTrackedIds(scene,key);
  return `<div class="tracker-card"><div class="tracker-heading"><strong>${escapeHTML(title)}</strong><span>Select anything that appears, is used, or is meaningfully referenced.</span></div>${items.length?`<div class="character-checkbox-grid">${items.map(item=>`<label class="character-check"><input type="checkbox" ${selected.includes(item.id)?"checked":""} onchange="toggleSceneTrackedItem('${key}','${item.id}',this.checked)"> <span>${escapeHTML(item.name||item.title||"Untitled")}</span></label>`).join("")}</div>`:`<p class="muted">${escapeHTML(emptyText)}</p>`}</div>`;
}
function renderSceneTracking(){
  const chars=(data.characters||[]).filter(seriesScope);
  const orgs=(data.organizations||[]).filter(seriesScope);
  const magic=(data.magicSystems||[]).filter(seriesScope);
  const artifacts=(data.world||[]).filter(w=>seriesScope(w)&&worldTrackingKeyForCategory(w.category)==="itemArtifactIds");
  const floraFauna=(data.world||[]).filter(w=>seriesScope(w)&&worldTrackingKeyForCategory(w.category)==="floraFaunaIds");
  const html=`
    ${sceneTrackingCard("Characters in this scene","Create characters first, then they will appear here.","characterIds",chars)}
    ${sceneTrackingCard("Organizations in this scene","Create organizations first, then they will appear here.","organizationIds",orgs)}
    ${sceneTrackingCard("Magic / Systems in this scene","Create magic systems first, then they will appear here.","magicSystemIds",magic)}
    ${sceneTrackingCard("Items / Artifacts in this scene","Create Items / Artifacts in World Building first, then they will appear here.","itemArtifactIds",artifacts)}
    ${sceneTrackingCard("Flora & Fauna in this scene","Create Flora & Fauna entries in World Building first, then they will appear here.","floraFaunaIds",floraFauna)}
  `;
  setHTML("sceneTrackingTop",html);
  setHTML("sceneTrackingBottom",html);
}
function renderSceneCharacterTracker(){ renderSceneTracking(); }
function saveScenePlotPoint(){
  const scene=activeScene();
  if(!scene)return;
  scene.plotCardId=val("scenePlotPoint");
  setText("autosaveStatus","Saving...");
  saveData(true);
}

function addManuscriptChapter(){const book=activeBook(); if(!book)return alert("Open a book first."); saveCurrentScene(false,false); const scene={id:uid(),title:"Scene 1",content:"",pov:"",locationId:"",date:"",mood:"",purpose:"",characterIds:[],organizationIds:[],magicSystemIds:[],itemArtifactIds:[],floraFaunaIds:[],plotCardId:"",created:new Date().toISOString()}; const ch={id:uid(),title:`Chapter ${(book.manuscript||[]).length+1}`,scenes:[scene],created:new Date().toISOString()}; book.manuscript.push(ch); data.activeChapterId=ch.id; data.activeSceneId=scene.id; saveData()}
function addSceneToActiveChapter(){const ch=activeChapter(); if(!ch)return alert("Select a chapter first."); saveCurrentScene(false,false); if(!ch.scenes)ch.scenes=[]; const scene={id:uid(),title:`Scene ${ch.scenes.length+1}`,content:"",pov:"",locationId:"",date:"",mood:"",purpose:"",characterIds:[],organizationIds:[],magicSystemIds:[],itemArtifactIds:[],floraFaunaIds:[],plotCardId:"",created:new Date().toISOString()}; ch.scenes.push(scene); data.activeSceneId=scene.id; saveData()}
function selectScene(chapterId,sceneId){setView("write",chapterId,sceneId)}
function saveCurrentScene(render=false,scheduleCloud=true){if(isRendering)return; const scene=activeScene(); const ch=activeChapter(); const editor=document.getElementById("richEditor"); if(!scene||!ch||!editor)return; ch.title=val("currentChapterTitle")||ch.title; scene.title=val("currentSceneTitle")||scene.title; scene.pov=val("scenePOV"); scene.locationId=val("sceneLocation"); scene.plotCardId=val("scenePlotPoint"); scene.date=val("sceneDate"); scene.mood=val("sceneMood"); scene.purpose=val("scenePurpose"); scene.content=editor.innerHTML; setText("autosaveStatus","Saving..."); saveData(render,scheduleCloud); updateEditorStats()}
function deleteManuscriptChapter(id){const book=activeBook(); if(!book)return; if(!confirm("Delete this chapter and all scenes?"))return; book.manuscript=book.manuscript.filter(c=>c.id!==id); data.activeChapterId=book.manuscript[0]?.id||null; data.activeSceneId=book.manuscript[0]?.scenes?.[0]?.id||null; saveData()}
function deleteScene(chId,sceneId){const ch=(activeBook()?.manuscript||[]).find(c=>c.id===chId); if(!ch)return; if(!confirm("Delete this scene?"))return; ch.scenes=(ch.scenes||[]).filter(s=>s.id!==sceneId); data.activeSceneId=ch.scenes[0]?.id||null; saveData()}
function moveScene(direction){const ch=activeChapter(); if(!ch?.scenes)return; const index=ch.scenes.findIndex(s=>s.id===data.activeSceneId); const ni=index+direction; if(index<0||ni<0||ni>=ch.scenes.length)return; const [scene]=ch.scenes.splice(index,1); ch.scenes.splice(ni,0,scene); saveData()}
function formatDoc(command){document.execCommand(command,false,null);document.getElementById("richEditor").focus();saveCurrentScene(false)}
function formatBlock(tag){document.execCommand("formatBlock",false,tag);document.getElementById("richEditor").focus();saveCurrentScene(false)}
function insertSceneBreak(){document.execCommand("insertHTML",false,"<p style='text-align:center;'>✦ ✦ ✦</p>");saveCurrentScene(false)}
function toggleFullscreen(){document.getElementById("manuscriptPanel").classList.toggle("fullscreen")}
function updateEditorStats(){const scene=activeScene(); const text=stripHTML(scene?.content||""); const book=activeBook(); const bookWords=(book?.manuscript||[]).flatMap(c=>c.scenes||[]).reduce((sum,s)=>sum+countWords(stripHTML(s.content||"")),0); setText("sceneWordCount",countWords(text)); setText("bookWordCountInline",bookWords); setText("sceneCharCount",text.length); setText("sceneParagraphCount",((scene?.content||"").match(/<p|<div|<h[1-6]/gi)||[]).length||(text.trim()?1:0))}

function scopedItem(scope){return scope==="series"?{scope,seriesId:data.activeSeriesId,bookId:null}:{scope,seriesId:data.activeSeriesId,bookId:data.activeBookId}}
function visibleByScope(item){return item.seriesId===data.activeSeriesId&&(item.scope==="series"||item.bookId===data.activeBookId)}
function seriesScope(item){return item.seriesId===data.activeSeriesId}
function characterName(id){return data.characters.find(c=>c.id===id)?.name||"Unknown"}
function locationName(id){return data.locations.find(l=>l.id===id)?.name||""}
function characterRelationships(characterId){return data.relationships.filter(r=>seriesScope(r)&&(r.a===characterId||r.b===characterId))}
function getAppearanceConfig(kind){
  const configs={
    character:{collection:"characters",label:"Character",nameKey:"name",trackedKey:"characterIds"},
    organization:{collection:"organizations",label:"Organization",nameKey:"name",trackedKey:"organizationIds"},
    magic:{collection:"magicSystems",label:"Magic / System",nameKey:"name",trackedKey:"magicSystemIds"},
    location:{collection:"locations",label:"Location",nameKey:"name",trackedKey:"locationId"},
    plotCard:{collection:"plotCards",label:"Plot Point",nameKey:"title",trackedKey:"plotCardId"},
    world:{collection:"world",label:"Worldbuilding",nameKey:"name",trackedKey:"worldCategory"}
  };
  return configs[kind]||null;
}
function getAppearanceItem(kind,itemId){const cfg=getAppearanceConfig(kind); return cfg?(data[cfg.collection]||[]).find(item=>item.id===itemId):null;}
function appearanceLogEntries(kind,itemId){
  const cfg=getAppearanceConfig(kind), item=getAppearanceItem(kind,itemId), rows=[];
  if(!cfg||!item)return rows;
  const itemName=String(item[cfg.nameKey]||"").trim();
  const itemNameLower=itemName.toLowerCase();
  projectScenesAll().forEach(({book,chapter,scene},globalIndex)=>{
    const chapterIndex=(book.manuscript||[]).findIndex(ch=>ch.id===chapter.id);
    const sceneIndex=(chapter.scenes||[]).findIndex(sc=>sc.id===scene.id);
      const reasons=[];
      const text=stripHTML(scene.content||"").toLowerCase();
      const trackedKey = kind==="world" ? worldTrackingKeyForCategory(item.category) : cfg.trackedKey;
      if(trackedKey){
        if(Array.isArray(scene[trackedKey]) && scene[trackedKey].includes(itemId))reasons.push("selected in scene tracker");
        if(!Array.isArray(scene[trackedKey]) && scene[trackedKey]===itemId)reasons.push(kind==="plotCard"?"selected plot point":kind==="location"?"scene location":"selected in scene tracker");
      }
      if(kind==="character" && scene.pov===itemId)reasons.push("POV");
      if(itemNameLower.length>2 && text.includes(itemNameLower) && !reasons.includes("auto-detected mention"))reasons.push("auto-detected mention");
      if(reasons.length)rows.push({book,chapter,scene,chapterIndex,sceneIndex,reasons:[...new Set(reasons)]});
  });
  return rows;
}
function renderAppearanceLogToggle(title,rows,emptyText="No appearances detected yet."){
  const count=Array.isArray(rows)?rows.length:0;
  const label=count===1?"1 appearance":`${count} appearances`;
  const body=count?`<p class="muted">Mirrors every chapter and scene where this is selected, assigned, or mentioned.</p><div class="appearance-log">${rows.map(row=>`<button type="button" class="mini-link" onclick="setView('write','${row.chapter.id}','${row.scene.id}')">${escapeHTML(row.book?.title?row.book.title+" → ":"")}${escapeHTML(row.chapter.title||`Chapter ${row.chapterIndex+1}`)} → ${escapeHTML(row.scene.title||`Scene ${row.sceneIndex+1}`)} <small>(${escapeHTML(row.reasons.join(", "))})</small></button>`).join("")}</div>`:`<p class="muted">${escapeHTML(emptyText)}</p>`;
  return `<section class="character-section appearance-log-detail"><details class="appearance-log-toggle"><summary><span class="appearance-log-title">${escapeHTML(title)}</span><span class="appearance-log-count">${escapeHTML(label)}</span></summary><div class="appearance-log-content">${body}</div></details></section>`;
}
function renderSharedAppearanceLog(kind,itemId){
  return renderAppearanceLogToggle("Appearance Log",appearanceLogEntries(kind,itemId));
}
function characterAppearances(characterId){return appearanceLogEntries("character",characterId).map(row=>`${row.chapter.title} — ${row.scene.title}${row.reasons.length?` (${row.reasons.join(", ")})`:""}`)}
function itemNamesFromIds(items,ids){
  if(!Array.isArray(ids)||!ids.length)return [];
  return ids.map(id=>(items||[]).find(item=>item.id===id)?.name).filter(Boolean);
}
function sceneAppearancesHTML(scene){
  if(!scene)return "";
  const characters=itemNamesFromIds(data.characters,scene.characterIds);
  if(scene.pov){const pov=characterName(scene.pov); if(pov&&pov!=="Unknown"&&!characters.includes(pov))characters.unshift(`${pov} (POV)`);}
  const organizations=itemNamesFromIds(data.organizations,scene.organizationIds);
  const magic=itemNamesFromIds(data.magicSystems,scene.magicSystemIds);
  const location=scene.locationId?locationName(scene.locationId):"";
  const artifacts=itemNamesFromIds(data.world,scene.itemArtifactIds);
  const floraFauna=itemNamesFromIds(data.world,scene.floraFaunaIds);
  const plot=scene.plotCardId?((data.plotCards||[]).find(p=>p.id===scene.plotCardId)?.title||""):"";
  const rows=[
    ["Plot Point",plot?[plot]:[]],
    ["Characters",characters],
    ["Location",location?[location]:[]],
    ["Organizations",organizations],
    ["Magic / Systems",magic],
    ["Items / Artifacts",artifacts],
    ["Flora & Fauna",floraFauna]
  ].filter(([,vals])=>vals.length);
  if(!rows.length)return `<section class="character-section"><h3>Appearances</h3><p class="muted">Nothing has been marked for this scene yet.</p></section>`;
  return `<section class="character-section"><h3>Appearances</h3><div class="appearance-log">${rows.map(([label,vals])=>`<p><strong>${escapeHTML(label)}:</strong> ${vals.map(escapeHTML).join(", ")}</p>`).join("")}</div></section>`;
}

function addChapterPlan(){data.chapterPlans.push({id:uid(),...scopedItem("book"),number:val("chapterNumber"),pov:val("chapterPOV"),wordTarget:val("chapterWordTarget"),structureBeat:val("chapterStructureBeat"),goal:val("chapterGoal"),conflict:val("chapterConflict"),outcome:val("chapterOutcome"),emotion:val("chapterEmotion"),foreshadowing:val("chapterForeshadowing"),created:new Date().toISOString()}); clearFields(["chapterNumber","chapterPOV","chapterWordTarget","chapterGoal","chapterConflict","chapterOutcome","chapterEmotion","chapterForeshadowing"]); saveData()}
function addThread(){data.threads.push({id:uid(),...scopedItem(val("threadScope")),title:val("threadTitle"),status:val("threadStatus"),setup:val("threadSetup"),payoff:val("threadPayoff"),created:new Date().toISOString()}); clearFields(["threadTitle","threadSetup","threadPayoff"]); saveData()}
function addMystery(){data.mysteries.push({id:uid(),...scopedItem("series"),question:val("mysteryQuestion"),introduced:val("mysteryIntroduced"),payoff:val("mysteryPayoff"),status:val("mysteryStatus"),hints:val("mysteryHints"),answer:val("mysteryAnswer"),created:new Date().toISOString()}); clearFields(["mysteryQuestion","mysteryIntroduced","mysteryPayoff","mysteryHints","mysteryAnswer"]); saveData()}
function addForeshadowing(){data.foreshadowing.push({id:uid(),...scopedItem("series"),hint:val("foreshadowHint"),appears:val("foreshadowAppears"),payoff:val("foreshadowPayoff"),status:val("foreshadowStatus"),notes:val("foreshadowNotes"),created:new Date().toISOString()}); clearFields(["foreshadowHint","foreshadowAppears","foreshadowPayoff","foreshadowNotes"]); saveData()}
function plotBoardItems(){return (data.plotCards||[]).filter(visibleByScope).sort((a,b)=>(a.order??0)-(b.order??0))}
function plotArcItems(){return (data.plotArcs||[]).filter(visibleByScope).sort((a,b)=>(a.order??0)-(b.order??0))}
function normalizePlotBoard(){
  ensureCollections();
  const cards=(data.plotCards||[]).filter(visibleByScope);
  let arcs=plotArcItems();
  if(!arcs.length && cards.length){
    [...new Set(cards.map(c=>c.arcId||c.status||"Ideas"))].forEach((name,i)=>{
      const id=uid();
      data.plotArcs.push({id,...scopedItem("book"),title:String(name||"Plot Arc"),order:i,created:new Date().toISOString()});
      cards.filter(c=>(c.arcId||c.status||"Ideas")===name).forEach((c,j)=>{c.arcId=id; c.order=j});
    });
    arcs=plotArcItems();
  }
  if(!arcs.length){
    const id=uid();
    data.plotArcs.push({id,...scopedItem("book"),title:"Main Arc",order:0,created:new Date().toISOString()});
    arcs=plotArcItems();
  }
  const firstArc=arcs[0]?.id;
  cards.forEach((c,i)=>{if(!c.arcId)c.arcId=firstArc; if(c.order===undefined)c.order=i});
}
function addPlotArc(){
  const title=val("plotArcTitle"); if(!title)return;
  normalizePlotBoard();
  data.plotArcs.push({id:uid(),...scopedItem("book"),title,order:plotArcItems().length,created:new Date().toISOString()});
  clearFields(["plotArcTitle"]); saveData();
}
function renamePlotArc(arcId){
  const arc=(data.plotArcs||[]).find(a=>a.id===arcId); if(!arc)return;
  const title=prompt("Rename this arc:",arc.title||""); if(!title)return;
  arc.title=title; saveData();
}
function deletePlotArc(arcId){
  const cards=(data.plotCards||[]).filter(c=>c.arcId===arcId);
  if(cards.length && !confirm("Delete this arc and its plot points?"))return;
  if(!cards.length && !confirm("Delete this arc?"))return;
  data.plotCards=(data.plotCards||[]).filter(c=>c.arcId!==arcId);
  data.plotArcs=(data.plotArcs||[]).filter(a=>a.id!==arcId);
  saveData();
}
function addPlotCard(){
  normalizePlotBoard();
  const arcId=val("plotCardArc")||plotArcItems()[0]?.id||"";
  if(!val("plotCardTitle"))return;
  const order=(data.plotCards||[]).filter(c=>c.arcId===arcId).length;
  data.plotCards.push({id:uid(),...scopedItem("book"),title:val("plotCardTitle"),arcId,status:"",notes:val("plotCardNotes"),order,created:new Date().toISOString()});
  clearFields(["plotCardTitle","plotCardNotes"]); saveData();
}
function onPlotCardDragStart(event,cardId){event.dataTransfer.setData("text/plain",cardId); event.dataTransfer.effectAllowed="move";}
function onPlotCardDragOver(event){event.preventDefault(); event.dataTransfer.dropEffect="move";}
function onPlotCardDrop(event,targetArcId,targetCardId=null){
  event.preventDefault();
  const cardId=event.dataTransfer.getData("text/plain"); if(!cardId)return;
  const card=(data.plotCards||[]).find(c=>c.id===cardId); if(!card)return;
  card.arcId=targetArcId;
  const cards=(data.plotCards||[]).filter(visibleByScope).filter(c=>c.arcId===targetArcId && c.id!==cardId).sort((a,b)=>(a.order??0)-(b.order??0));
  let insertIndex=cards.length;
  if(targetCardId){const idx=cards.findIndex(c=>c.id===targetCardId); if(idx>=0)insertIndex=idx;}
  cards.splice(insertIndex,0,card);
  cards.forEach((c,i)=>c.order=i);
  saveData();
}
let characterCustomSectionDrafts=[];
let characterDetailEditMode=false;
let worldCustomSectionDrafts=[];
let worldDetailEditMode=false;
let locationDetailEditMode=false;
let magicDetailEditMode=false;
let organizationDetailEditMode=false;
function bulletize(text){return (text||"").split(/\n/).map(line=>line.trim()?(/^\s*[-*•]/.test(line)?line:`• ${line}`):line).join("\n")}
function addBulletToTextarea(target){const el=typeof target==="string"?document.getElementById(target):target; if(!el)return; const start=el.selectionStart??el.value.length, end=el.selectionEnd??start; const before=el.value.slice(0,start), selected=el.value.slice(start,end), after=el.value.slice(end); const insert=selected?bulletize(selected):"• "; el.value=before+insert+after; el.focus(); el.selectionStart=el.selectionEnd=before.length+insert.length; el.dispatchEvent(new Event("input",{bubbles:true}))}
function addBulletButtons(container=document){container.querySelectorAll("textarea").forEach(t=>{if(t.dataset.bulletReady)return; t.dataset.bulletReady="1"; const btn=document.createElement("button"); btn.type="button"; btn.className="bullet-helper"; btn.textContent="• Bullet"; btn.onclick=()=>addBulletToTextarea(t); t.insertAdjacentElement("beforebegin",btn)})}
function startBulletButtonObserver(){addBulletButtons(); if(window.__plotpalsBulletObserverStarted||!document.body)return; window.__plotpalsBulletObserverStarted=true; const observer=new MutationObserver(mutations=>{if(mutations.some(m=>m.addedNodes&&m.addedNodes.length))addBulletButtons()}); observer.observe(document.body,{childList:true,subtree:true})}
function addCharacterCustomSectionDraft(){const title=val("charCustomTitle").trim(), text=val("charCustomText").trim(); if(!title&&!text)return; characterCustomSectionDrafts.push({id:uid(),title:title||"Untitled Section",text}); clearFields(["charCustomTitle","charCustomText"]); renderCharacterCustomDraftList()}
function renderCharacterCustomDraftList(){const el=document.getElementById("charCustomDraftList"); if(!el)return; el.innerHTML=characterCustomSectionDrafts.map(sec=>`<div class="custom-section-chip"><strong>${escapeHTML(sec.title)}</strong><button type="button" onclick="removeCharacterCustomSectionDraft('${sec.id}')">Remove</button></div>`).join("")}
function removeCharacterCustomSectionDraft(id){characterCustomSectionDrafts=characterCustomSectionDrafts.filter(s=>s.id!==id); renderCharacterCustomDraftList()}
function addCustomSectionToCharacter(characterId){const title=prompt("Section title?"); if(!title)return; const text=prompt("Section text? You can add more later by creating another section.")||""; const c=data.characters.find(x=>x.id===characterId); if(!c)return; if(!Array.isArray(c.customSections))c.customSections=[]; c.customSections.push({id:uid(),title,text}); saveData(true)}
function deleteCustomSectionFromCharacter(characterId,sectionId){const c=data.characters.find(x=>x.id===characterId); if(!c||!Array.isArray(c.customSections))return; c.customSections=c.customSections.filter(s=>s.id!==sectionId); saveData(true)}
function formatMultiline(text){if(!text)return""; return escapeHTML(text).replace(/\n/g,"<br>")}
function detailBlock(label,text){return text?`<section class="character-section"><h4>${escapeHTML(label)}</h4><p>${formatMultiline(text)}</p></section>`:""}

function updateCharacterPhoto(characterId,input){const c=data.characters.find(x=>x.id===characterId); if(!c)return; readImageUpload(input,(src)=>{c.photo=src; saveData(true)})}
function triggerCharacterPhotoUpload(characterId,event){clickHiddenFileInput(`characterPhotoUpload_${characterId}`,event)}


const defaultWorldCategories=["Locations","Organizations","Religions","Races / Species","Magic Systems","Governments","Historical Events","Cultures","Items / Artifacts","Languages","Flora & Fauna","Other"];
function canonicalWorldCategory(category="Other"){
  const c=String(category||"Other").trim().toLowerCase().replace(/&/g,"and").replace(/\s+/g," ");
  if(c.includes("location"))return "locations";
  if(c.includes("organization")||c.includes("organisation"))return "organizations";
  if(c.includes("religion"))return "religions";
  if(c.includes("race")||c.includes("species"))return "races-species";
  if(c.includes("magic")||c.includes("system"))return "magic-systems";
  if(c.includes("government"))return "governments";
  if(c.includes("historical")||c.includes("history event"))return "historical-events";
  if(c==="culture"||c.includes("culture"))return "cultures";
  if(c.includes("item")||c.includes("artifact")||c.includes("artefact"))return "items-artifacts";
  if(c.includes("language"))return "languages";
  if(c.includes("flora")||c.includes("fauna"))return "flora-fauna";
  if(c.includes("other"))return "other";
  return c.replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"other";
}
function worldCategories(){
  const labels={};
  defaultWorldCategories.forEach(c=>labels[canonicalWorldCategory(c)]=c);
  [...(data.world||[]).map(w=>w.category).filter(Boolean),...(data.worldCategories||[])].forEach(c=>{
    const key=canonicalWorldCategory(c);
    if(!labels[key])labels[key]=c;
  });
  const ordered=defaultWorldCategories.map(c=>labels[canonicalWorldCategory(c)]).filter(Boolean);
  const extras=Object.entries(labels).filter(([key])=>!defaultWorldCategories.some(c=>canonicalWorldCategory(c)===key)).map(([,label])=>label);
  return [...new Set([...ordered,...extras])];
}

function worldCategorySlug(category="Other"){
  return canonicalWorldCategory(category);
}
function worldCategoryIcon(category="Other"){
  const key=canonicalWorldCategory(category);
  const map={"locations":"📍","organizations":"⚜️","religions":"⛪","races-species":"🧬","magic-systems":"✨","governments":"🏛️","historical-events":"⏳","cultures":"🎭","items-artifacts":"🗝️","languages":"🗣️","flora-fauna":"🌿","other":"🌍"};
  return map[key]||"🌍";
}
function worldCategoryLabel(category="Other"){
  const key=canonicalWorldCategory(category);
  const found=worldCategories().find(c=>canonicalWorldCategory(c)===key);
  return found||String(category||"Other").replace(/-/g," /").replace(/\b\w/g,m=>m.toUpperCase());
}
function worldCategorySectionTemplates(category="Other"){
  const key=canonicalWorldCategory(category);
  const map={
    "religions":["Basic Information","Core Beliefs","Deities / Sacred Figures","Rituals / Practices","Holy Sites","Followers","History","Plot Relevance"],
    "races-species":["Basic Information","Physical Appearance","Biology","Culture","Strengths","Weaknesses","History","Plot Relevance"],
    "governments":["Basic Information","Structure","Leaders","Laws","Territory","Allies / Enemies","History","Plot Relevance"],
    "historical-events":["Event Information","Summary","Causes","Major Figures","Timeline","Consequences","Modern Impact","Plot Relevance"],
    "cultures":["Overview","Values","Traditions","Clothing","Food","Holidays","Social Structure","Plot Relevance"],
    "items-artifacts":["Basic Information","Appearance","Powers / Purpose","Owners","History","Current Location","Rules / Limits","Plot Relevance"],
    "languages":["Overview","Writing System","Common Phrases","Dialects","Regions","History","Cultural Notes","Plot Relevance"],
    "flora-fauna":["Basic Information","Habitat","Appearance","Behavior","Uses","Threat Level","History","Plot Relevance"],
    "other":["Basic Information","Description","History","Culture / Society","Rules / Notes","Plot Relevance"]
  };
  return map[key]||map.other;
}

function worldCategoryFormConfig(category="Other"){
  const label=worldCategoryLabel(category);
  const key=canonicalWorldCategory(label);
  const configs={
    "religions":{singular:"Religion",intro:"Build faith systems, gods, rituals, holy places, and belief conflicts.",name:"Religion name",fields:[['basicInfo','Basic Information','Name, type of religion, founder, symbol, sacred text, leadership'],['description','Core Beliefs','What followers believe, moral rules, afterlife, creation myth'],['history','Deities / Sacred Figures','Gods, saints, prophets, spirits, divine beings, sacred figures'],['culture','Rituals / Practices','Worship, prayers, ceremonies, holidays, taboos, offerings'],['rules','Holy Sites / Followers','Temples, pilgrimage sites, major regions, who follows it'],['plotRelevance','Plot Relevance','How this religion affects characters, conflict, society, or story events']]},
    "races-species":{singular:"Race / Species",intro:"Create peoples, creatures, ancestries, biology, culture, strengths, and weaknesses.",name:"Race or species name",fields:[['basicInfo','Basic Information','Classification, origin, lifespan, homeland, rarity'],['description','Physical Appearance','Body traits, coloring, size, anatomy, distinctive features'],['history','Biology','Reproduction, aging, senses, needs, instincts, abilities'],['culture','Culture','Values, traditions, language, social norms, settlements'],['rules','Strengths / Weaknesses','Powers, limits, vulnerabilities, advantages, disadvantages'],['plotRelevance','Plot Relevance','How this race/species matters to the story']]},
    "governments":{singular:"Government",intro:"Track political systems, rulers, laws, territories, and power conflicts.",name:"Government name",fields:[['basicInfo','Basic Information','Name, type of rule, capital, current ruler, founding date'],['description','Structure','Branches, hierarchy, councils, noble houses, agencies'],['history','Leaders / Important Figures','Rulers, heirs, advisors, generals, political rivals'],['culture','Laws / Policies','Major laws, punishments, rights, restrictions, social expectations'],['rules','Territory / Allies / Enemies','Controlled lands, allies, enemies, rebellions, treaties'],['plotRelevance','Plot Relevance','How this government affects the story or characters']]},
    "historical-events":{singular:"Historical Event",intro:"Record past events, causes, participants, timelines, and consequences.",name:"Event name",fields:[['basicInfo','Event Information','Date, era, duration, location, type of event'],['description','Summary','What happened in clear story terms'],['history','Causes','What led to the event, tensions, mistakes, betrayals'],['culture','Major Figures / Participants','People, groups, nations, species, or organizations involved'],['rules','Consequences / Modern Impact','Immediate aftermath, long-term effects, myths, scars, current relevance'],['plotRelevance','Plot Relevance','How this event connects to the current plot']]},
    "cultures":{singular:"Culture",intro:"Define values, traditions, customs, holidays, food, clothing, and social rules.",name:"Culture name",fields:[['basicInfo','Overview','Region, people, origin, related race/species or nation'],['description','Values','What this culture honors, fears, rewards, or condemns'],['history','Traditions / Holidays','Rituals, celebrations, ceremonies, seasonal events'],['culture','Daily Life','Food, clothing, homes, work, family structure, etiquette'],['rules','Taboos / Social Structure','Class systems, forbidden acts, gender roles, expectations, laws'],['plotRelevance','Plot Relevance','How this culture shapes conflict, characters, or themes']]},
    "items-artifacts":{singular:"Item / Artifact",intro:"Track important objects, relics, weapons, heirlooms, and magical items.",name:"Item or artifact name",fields:[['basicInfo','Basic Information','Type, creator, age, rarity, material, current owner'],['description','Appearance','Shape, size, colors, markings, condition, visual details'],['history','History','Creation, past owners, legends, major events tied to it'],['culture','Owners / Current Location','Who had it, who wants it, where it is now'],['rules','Powers / Rules / Limits','Abilities, costs, limitations, activation, dangers'],['plotRelevance','Plot Relevance','Why this item matters to the story']]},
    "languages":{singular:"Language",intro:"Build languages, dialects, scripts, common phrases, and cultural meaning.",name:"Language name",fields:[['basicInfo','Overview','Speakers, regions, origin, language family, status'],['description','Writing System','Alphabet, symbols, direction, appearance, literacy'],['history','Common Phrases','Greetings, curses, titles, sayings, important words'],['culture','Dialects / Regions','Regional variations, accents, formal vs informal speech'],['rules','Grammar / Cultural Notes','Rules, naming conventions, taboos, sacred words'],['plotRelevance','Plot Relevance','How this language appears or matters in the story']]},
    "flora-fauna":{singular:"Flora / Fauna",intro:"Create plants, animals, monsters, ecosystems, uses, and dangers.",name:"Plant, animal, or creature name",fields:[['basicInfo','Basic Information','Type, classification, rarity, lifespan, diet'],['description','Appearance','Size, color, body shape, markings, sounds, movement'],['history','Habitat','Where it lives, climate, nesting, migration, ecosystem role'],['culture','Behavior / Temperament','How it acts, social behavior, intelligence, danger level'],['rules','Uses / Threat Level','Medicine, food, magic use, symbolism, risks, weaknesses'],['plotRelevance','Plot Relevance','How it appears or matters in the story']]},
    "other":{singular:"Worldbuilding Entry",intro:"Create any world detail that does not fit another category.",name:"Entry name",fields:[['basicInfo','Basic Information','Type, category, origin, important labels'],['description','Description','What this is and what the author needs to remember'],['history','History / Background','Where it came from, how it changed, past importance'],['culture','Connections','Related characters, places, groups, events, or objects'],['rules','Rules / Important Notes','Limits, details, rules, warnings, canon notes'],['plotRelevance','Plot Relevance','How this entry matters to the story']]}
  };
  return configs[key]||configs.other;
}
function worldFieldByKey(category,key){
  const cfg=worldCategoryFormConfig(category);
  return (cfg.fields||[]).find(f=>f[0]===key)||[key,key,""];
}
function worldDetailBlocks(w){
  const cfg=worldCategoryFormConfig(w.category||"Other");
  return (cfg.fields||[]).map(([key,label])=>detailBlock(label,w[key])).join("");
}

function worldCategoryItems(category){
  const key=canonicalWorldCategory(category);
  return (data.world||[]).filter(w=>seriesScope(w)&&canonicalWorldCategory(w.category||"Other")===key);
}
function showWorldCategory(category){
  const key=canonicalWorldCategory(category);
  if(key==="locations")return setView('locations');
  if(key==="organizations")return setView('organizations');
  if(key==="magic-systems")return setView('magic');
  return setView('worldCategory', key);
}
function worldSidebarEntries(category){
  const key=canonicalWorldCategory(category);
  const entries=[];
  if(key==="locations")entries.push(...(data.locations||[]).filter(seriesScope).map(item=>({id:item.id,name:item.name||"Location",view:"locationDetail",kind:"location"})));
  if(key==="organizations")entries.push(...(data.organizations||[]).filter(seriesScope).map(item=>({id:item.id,name:item.name||"Organization",view:"organizationDetail",kind:"organization"})));
  if(key==="magic-systems")entries.push(...(data.magicSystems||[]).filter(seriesScope).map(item=>({id:item.id,name:item.name||"Magic System",view:"magicDetail",kind:"magic"})));
  entries.push(...worldCategoryItems(category).map(item=>({id:item.id,name:item.name||category,view:"worldDetail",kind:"world"})));
  return entries;
}
function renderWorldBuildingSidebarCategories(){
  return worldCategories().map(cat=>{
    const entries=worldSidebarEntries(cat);
    return `<button class="story-nav nav-parent" onclick="showWorldCategory('${escapeAttr(cat)}')"><span>${worldCategoryIcon(cat)} ${escapeHTML(cat)}</span><span class="nav-count">${entries.length}</span></button>${entries.map(entry=>`<button class="story-nav nav-grandchild" onclick="setView('${entry.view}','${entry.id}')">${escapeHTML(entry.name)}</button>`).join("")}`;
  }).join("");
}
function worldTrackingKeyForCategory(category){
  const c=String(category||"").toLowerCase();
  if(c.includes("item")||c.includes("artifact"))return "itemArtifactIds";
  if(c.includes("flora")||c.includes("fauna"))return "floraFaunaIds";
  return null;
}

function renderWorldCategorySelect(){const el=document.getElementById("worldCategory"); if(!el)return; const current=el.value; el.innerHTML=worldCategories().map(c=>`<option>${escapeHTML(c)}</option>`).join(""); if(current)el.value=current;}
function addWorldCustomSectionDraft(){const title=val("worldCustomTitle").trim(), text=val("worldCustomText").trim(); if(!title&&!text)return; worldCustomSectionDrafts.push({id:uid(),title:title||"Untitled Section",text}); clearFields(["worldCustomTitle","worldCustomText"]); renderWorldCustomDraftList();}
function renderWorldCustomDraftList(){const el=document.getElementById("worldCustomDraftList"); if(!el)return; el.innerHTML=worldCustomSectionDrafts.map(sec=>`<div class="custom-section-chip"><strong>${escapeHTML(sec.title)}</strong><button type="button" onclick="removeWorldCustomSectionDraft('${sec.id}')">Remove</button></div>`).join("");}
function removeWorldCustomSectionDraft(id){worldCustomSectionDrafts=worldCustomSectionDrafts.filter(s=>s.id!==id); renderWorldCustomDraftList();}
function addWorldFromCurrentCategory(){
  const key=data.selectedWorldCategory||"other";
  const label=worldCategoryLabel(key);
  const categorySelect=document.getElementById("worldCategory");
  const customCategory=document.getElementById("worldCustomCategory");
  if(categorySelect)categorySelect.innerHTML=`<option>${escapeHTML(label)}</option>`;
  if(categorySelect)categorySelect.value=label;
  if(customCategory)customCategory.value=canonicalWorldCategory(label)==="other"?"Other":"";
  addWorld();
}

function updateWorldImage(worldId,input){const w=data.world.find(x=>x.id===worldId); if(!w)return; readImageUpload(input,(src)=>{w.image=src; saveData(true)})}
function triggerWorldImageUpload(worldId,event){clickHiddenFileInput(`worldImageUpload_${worldId}`,event)}
function addCustomSectionToWorld(worldId){const title=prompt("Section title?"); if(!title)return; const text=prompt("Section text? You can edit it later.")||""; const w=data.world.find(x=>x.id===worldId); if(!w)return; if(!Array.isArray(w.customSections))w.customSections=[]; w.customSections.push({id:uid(),title,text}); worldDetailEditMode=true; saveData(true)}
function deleteCustomSectionFromWorld(worldId,sectionId){const w=data.world.find(x=>x.id===worldId); if(!w||!Array.isArray(w.customSections))return; w.customSections=w.customSections.filter(s=>s.id!==sectionId); saveData(true)}
function startWorldDetailEdit(){worldDetailEditMode=true; renderWorldDetail();}
function cancelWorldDetailEdit(){worldDetailEditMode=false; renderWorldDetail();}
function saveWorldDetailEdit(worldId){const w=data.world.find(x=>x.id===worldId); if(!w)return; w.name=val("editWorldName"); w.scope=val("editWorldScope"); w.seriesId=w.scope==="series"?data.activeSeriesId:null; w.bookId=w.scope==="book"?data.activeBookId:null; w.category=val("editWorldCategory")||"Other"; w.basicInfo=val("editWorldBasicInfo"); w.description=val("editWorldDescription"); w.history=val("editWorldHistory"); w.culture=val("editWorldCulture"); w.rules=val("editWorldRules"); w.plotRelevance=val("editWorldPlotRelevance"); (w.customSections||[]).forEach(sec=>{sec.title=val(`editWorldCustomTitle_${sec.id}`); sec.text=val(`editWorldCustomText_${sec.id}`)}); if(!data.worldCategories)data.worldCategories=[]; if(w.category&&!data.worldCategories.includes(w.category))data.worldCategories.push(w.category); worldDetailEditMode=false; saveData(true);}
function renderWorldEditForm(w){
  const custom=Array.isArray(w.customSections)?w.customSections:[];
  const cfg=worldCategoryFormConfig(w.category||"Other");
  const fields=cfg.fields||[];
  const fieldInputs=fields.map(([key,labelText,help])=>`<label class="field-stack"><span>${escapeHTML(labelText)}</span><textarea id="editWorld${key.charAt(0).toUpperCase()+key.slice(1)}" placeholder="${escapeAttr(help||labelText)}">${escapeHTML(w[key]||"")}</textarea></label>`).join("");
  return `<div class="panel character-detail-grid"><div>${w.image?`<img class="character-photo" src="${w.image}" alt="${escapeHTML(w.name)}"><input id="worldImageUpload_${w.id}" type="file" accept="image/*" class="hidden" onchange="updateWorldImage('${w.id}',this)"><button type="button" class="wide" onclick="triggerWorldImageUpload('${w.id}',event)">Change Image</button>`:`<div class="character-photo panel photo-placeholder"><p>No Image</p><input id="worldImageUpload_${w.id}" type="file" accept="image/*" class="hidden" onchange="updateWorldImage('${w.id}',this)"><button type="button" class="wide" onclick="triggerWorldImageUpload('${w.id}',event)">+ Add Image</button></div>`}</div><div><h3>Edit ${escapeHTML(cfg.singular||"Worldbuilding Entry")}</h3><div class="form-grid"><input id="editWorldName" placeholder="${escapeAttr(cfg.name||"Entry name")}" value="${escapeAttr(w.name||"")}"><select id="editWorldScope"><option value="book">Attach to this book</option><option value="series">Attach to whole project</option></select><select id="editWorldCategory">${worldCategories().map(c=>`<option>${escapeHTML(c)}</option>`).join("")}</select>${fieldInputs}</div><h3>Custom Sections</h3>${custom.map(sec=>`<div class="custom-section-builder"><input id="editWorldCustomTitle_${sec.id}" placeholder="Section title" value="${escapeAttr(sec.title||"")}"><textarea id="editWorldCustomText_${sec.id}" placeholder="Section notes">${escapeHTML(sec.text||"")}</textarea><button type="button" class="delete-btn" onclick="deleteCustomSectionFromWorld('${w.id}','${sec.id}'); worldDetailEditMode=true">Delete Section</button></div>`).join("")||"<p class='muted'>No custom sections yet.</p>"}<button type="button" onclick="addCustomSectionToWorld('${w.id}')">+ Add Custom Section</button><hr><button onclick="saveWorldDetailEdit('${w.id}')">Save Changes</button><button class="ghost-btn" onclick="cancelWorldDetailEdit()">Cancel</button></div></div>`;
}
function renderWorldDetail(){
  const el=document.getElementById("worldDetailContent"); if(!el)return;
  const w=data.world.find(x=>x.id===data.selectedWorldId);
  if(!w){el.innerHTML=`<div class="panel"><p>Select a worldbuilding entry from the sidebar.</p></div>`;return}
  if(worldDetailEditMode){el.innerHTML=renderWorldEditForm(w); setVal("editWorldScope",w.scope||"book"); setVal("editWorldCategory",w.category||"Other"); addBulletButtons(el); return}
  const cfg=worldCategoryFormConfig(w.category||"Other");
  const custom=Array.isArray(w.customSections)?w.customSections:[];
  el.innerHTML=`<div class="panel character-detail-grid"><div>${w.image?`<img class="character-photo" src="${w.image}" alt="${escapeHTML(w.name)}"><input id="worldImageUpload_${w.id}" type="file" accept="image/*" class="hidden" onchange="updateWorldImage('${w.id}',this)"><button type="button" class="wide" onclick="triggerWorldImageUpload('${w.id}',event)">Change Image</button>`:`<div class="character-photo panel photo-placeholder"><p>No Image</p><input id="worldImageUpload_${w.id}" type="file" accept="image/*" class="hidden" onchange="updateWorldImage('${w.id}',this)"><button type="button" class="wide" onclick="triggerWorldImageUpload('${w.id}',event)">+ Add Image</button></div>`}<button class="wide" onclick="startWorldDetailEdit()">Edit ${escapeHTML(cfg.singular||"Worldbuilding Entry")}</button><button class="wide" onclick="addCustomSectionToWorld('${w.id}')">+ Add Custom Section</button></div><div><h3>${escapeHTML(w.name||"Untitled Entry")}</h3><span class="tag">${escapeHTML(w.category||"Other")}</span><span class="tag">${escapeHTML(w.scope||"book")}</span>${worldDetailBlocks(w)}${custom.map(sec=>`<section class="character-section custom-character-section"><h4>${escapeHTML(sec.title||"Untitled Section")}</h4><p>${formatMultiline(sec.text||"")}</p><button class="delete-btn" onclick="deleteCustomSectionFromWorld('${w.id}','${sec.id}')">Delete Section</button></section>`).join("")}${renderSharedAppearanceLog("world",w.id)}</div></div>`;
}
function renderWorldByCategory(){renderWorldCategorySelect(); renderWorldCustomDraftList(); const el=document.getElementById("worldCategoryGroups"); if(!el)return; const cats=worldCategories(); el.innerHTML=cats.map(cat=>{const group=worldCategoryItems(cat); return `<div class="role-group" id="worldcat_${worldCategorySlug(cat)}"><h3>${worldCategoryIcon(cat)} ${escapeHTML(cat)}</h3><div class="card-grid">${group.length?group.map(w=>`<article class="item-card"><div class="card-header"><h3>${escapeHTML(w.name||"Untitled Entry")}</h3><button class="delete-btn" onclick="deleteItem('world','${w.id}')">Delete</button></div>${w.image?`<img class="character-photo" src="${w.image}" alt="${escapeHTML(w.name||"")}">`:""}<div class="card-body"><span class="tag">${escapeHTML(w.category||"Other")}</span>${detail("Description",w.description)}${detail("Plot Relevance",w.plotRelevance)}<button onclick="setView('worldDetail','${w.id}')">Open Entry</button></div></article>`).join(""):`<p class="muted">No ${escapeHTML(cat)} entries yet.</p>`}</div></div>`}).join("");}
function worldCategorySortValue(key){return val(`worldCategorySort_${canonicalWorldCategory(key)}`)||"az"}
function worldCategorySearchValue(key){return (val(`worldCategorySearch_${canonicalWorldCategory(key)}`)||"").trim().toLowerCase()}
function sortWorldCategoryItems(category,items){
  const sort=worldCategorySortValue(category);
  const byName=(a,b)=>(a.name||"").localeCompare(b.name||"");
  const byDate=(a,b)=>(a.created||"").localeCompare(b.created||"");
  if(sort==="za")return items.sort((a,b)=>byName(b,a));
  if(sort==="newest")return items.sort((a,b)=>byDate(b,a));
  if(sort==="oldest")return items.sort(byDate);
  return items.sort(byName);
}
function renderWorldCategoryPage(){
  const el=document.getElementById("worldCategoryContent"); if(!el)return;
  const key=data.selectedWorldCategory||"other";
  const label=worldCategoryLabel(key);
  const categoryKey=canonicalWorldCategory(label);
  const cfg=worldCategoryFormConfig(label);
  const allItems=worldCategoryItems(label);
  const search=worldCategorySearchValue(label);
  let items=[...allItems];
  if(search){items=items.filter(item=>JSON.stringify(item).toLowerCase().includes(search));}
  sortWorldCategoryItems(label,items);
  const singular=cfg.singular||label.replace(/s$/,'');
  const fields=cfg.fields||[];
  const textareaHTML=fields.map(([field,labelText,help])=>`<label class="field-stack"><span>${escapeHTML(labelText)}</span><textarea id="world${field.charAt(0).toUpperCase()+field.slice(1)}" placeholder="${escapeAttr(help||labelText)}"></textarea></label>`).join("");
  const formId=`worldCategoryAddForm_${categoryKey}`;
  const formOpen=!!addFormVisibility[formId];
  const primaryField=(fields.find(([key])=>key==="description")||fields[1]||fields[0]||[])[1]||"Description";
  el.innerHTML=`
    <div class="category-page-header panel">
      <div>
        <h2>${worldCategoryIcon(label)} ${escapeHTML(label)} <span class="muted">(${allItems.length})</span></h2>
        <p class="muted">${escapeHTML(cfg.intro||`Create and open dedicated ${label} detail pages.`)}</p>
      </div>
      <div class="category-tools">
        <input id="worldCategorySearch_${categoryKey}" placeholder="Search ${escapeAttr(label)}..." value="${escapeAttr(val(`worldCategorySearch_${categoryKey}`)||"")}" oninput="renderWorldCategoryPage()" />
        <select id="worldCategorySort_${categoryKey}" onchange="renderWorldCategoryPage()">
          <option value="az">A–Z</option>
          <option value="za">Z–A</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </div>
    </div>
    <button type="button" class="wide" onclick="toggleAddForm('${formId}')">+ Add ${escapeHTML(singular)}</button>
    <div id="${formId}" class="form-panel ${formOpen?'':'hidden'}">
      <h3>Add ${escapeHTML(singular)}</h3>
      <div class="form-grid">
        <input id="worldName" placeholder="${escapeAttr(cfg.name||`${singular} name`)}" />
        <select id="worldScope"><option value="book">Attach to this book</option><option value="series">Attach to whole project</option></select>
        <input id="worldCustomCategory" class="hidden" value="${categoryKey==='other'?'Other':''}" />
        <select id="worldCategory" class="hidden"><option>${escapeHTML(label)}</option></select>
        <div class="upload-control"><button type="button" class="file-label inline-file" onclick="triggerOverviewImageUpload('worldImage', event)">Upload ${escapeHTML(singular)} Image</button><input id="worldImage" type="file" accept="image/*" class="hidden" onchange="previewOverviewImage('worldImage','worldImagePreview')" /><div id="worldImagePreview" class="upload-preview muted">No image selected.</div></div>
        ${textareaHTML}
        <div class="custom-section-builder"><input id="worldCustomTitle" placeholder="Additional section title" /><textarea id="worldCustomText" placeholder="Additional section notes"></textarea><button type="button" onclick="addWorldCustomSectionDraft()">Add Section to Entry</button><div id="worldCustomDraftList" class="custom-section-list"></div></div>
      </div>
      <button onclick="addWorldFromCurrentCategory()">Save ${escapeHTML(singular)}</button>
    </div>
    <div class="card-grid">${items.length?items.map(w=>`<article class="item-card"><div class="card-header"><h3>${escapeHTML(w.name||"Untitled Entry")}</h3><button class="delete-btn" onclick="deleteItem('world','${w.id}')">Delete</button></div>${w.image?`<img class="character-photo" src="${w.image}" alt="${escapeHTML(w.name||"")}">`:`<div class="photo-placeholder small-placeholder">No Image</div>`}<div class="card-body"><span class="tag">${escapeHTML(w.category||label)}</span>${detail(primaryField,w.description||w.basicInfo||w.history||w.culture||w.rules)}${detail("Plot Relevance",w.plotRelevance)}<button onclick="setView('worldDetail','${w.id}')">Open Detail Page</button></div></article>`).join(""):search?`<p class="muted">No ${escapeHTML(label)} entries match your search.</p>`:`<p class="muted">No ${escapeHTML(label)} entries yet.</p>`}</div>`;
  setVal(`worldCategorySort_${categoryKey}`, worldCategorySortValue(label));
  renderWorldCustomDraftList(); addBulletButtons(el);
}

function addCharacter(){const input=document.getElementById("charPhoto"); const file=input?.files?.[0]; const finish=photo=>{data.characters.push({id:uid(),...scopedItem(val("charScope")),name:val("charName"),role:val("charRole"),species:val("charSpecies"),photo,basicInfo:val("charBasicInfo"),description:val("charDescription"),personality:val("charPersonality"),backstory:val("charBackstory"),wound:val("charWound"),arc:val("charArc"),voice:val("charVoice"),secrets:val("charSecrets"),quotes:val("charQuotes"),customSections:[...characterCustomSectionDrafts],created:new Date().toISOString()}); clearFields(["charName","charSpecies","charBasicInfo","charDescription","charPersonality","charBackstory","charWound","charArc","charVoice","charSecrets","charQuotes","charCustomTitle","charCustomText"]); characterCustomSectionDrafts=[]; renderCharacterCustomDraftList(); if(input)input.value=""; clearOverviewImagePreview("worldImagePreview"); hideAddForm("characterAddForm"); saveData()}; if(!file)return finish(""); readImageUpload(input,finish)}
function relationshipViewLabel(characterId,fallback){const name=characterName(characterId); return name&&name!=="Unknown"?`${name}'s View`:fallback;}
function updateRelationshipViewLabels(){
  const a=val("relA"), b=val("relB");
  setText("relAViewLabel",relationshipViewLabel(a,"Character 1's View"));
  setText("relBViewLabel",relationshipViewLabel(b,"Character 2's View"));
  const aView=document.getElementById("relAView"), bView=document.getElementById("relBView");
  if(aView)aView.placeholder=`How ${characterName(a)==="Unknown"?"Character 1":characterName(a)} sees this relationship`;
  if(bView)bView.placeholder=`How ${characterName(b)==="Unknown"?"Character 2":characterName(b)} sees this relationship`;
}
function addRelationship(){data.relationships.push({id:uid(),...scopedItem(val("relScope")),a:val("relA"),b:val("relB"),type:val("relType"),status:val("relStatus"),history:val("relHistory"),moments:val("relMoments"),arc:val("relArc"),aView:val("relAView"),bView:val("relBView"),created:new Date().toISOString()}); clearFields(["relType","relStatus","relHistory","relMoments","relArc","relAView","relBView"]); updateRelationshipViewLabels(); hideAddForm("relationshipAddForm"); saveData()}
function addTimeline(){data.timeline.push({id:uid(),...scopedItem(val("timeScope")),when:val("timeWhen"),event:val("timeEvent"),impact:val("timeImpact"),created:new Date().toISOString()}); clearFields(["timeWhen","timeEvent","timeImpact"]); saveData()}
function addWorld(){const customCategory=val("worldCustomCategory").trim(); const category=customCategory||val("worldCategory")||worldCategoryLabel(data.selectedWorldCategory||"Other"); if(customCategory){if(!data.worldCategories)data.worldCategories=[]; if(!data.worldCategories.includes(customCategory))data.worldCategories.push(customCategory)} const input=document.getElementById("worldImage"); const file=input?.files?.[0]; const finish=image=>{const item={id:uid(),...scopedItem(val("worldScope")||"series"),name:val("worldName"),category,image,basicInfo:val("worldBasicInfo"),description:val("worldDescription"),history:val("worldHistory"),culture:val("worldCulture"),rules:val("worldRules"),plotRelevance:val("worldPlotRelevance"),customSections:[...worldCustomSectionDrafts],created:new Date().toISOString()}; data.world.push(item); data.selectedWorldId=item.id; data.selectedWorldCategory=canonicalWorldCategory(category); clearFields(["worldName","worldCustomCategory","worldBasicInfo","worldDescription","worldHistory","worldCulture","worldRules","worldPlotRelevance","worldCustomTitle","worldCustomText"]); worldCustomSectionDrafts=[]; renderWorldCustomDraftList(); if(input)input.value=""; clearOverviewImagePreview("worldImagePreview"); hideAddForm(`worldCategoryAddForm_${canonicalWorldCategory(category)}`); hideAddForm("worldAddForm"); saveData(true); setView("worldDetail",item.id)}; if(!file)return finish(""); readImageUpload(input,finish)}
function addLocation(){const input=document.getElementById("locationImage"); const file=input?.files?.[0]; const finish=image=>{data.locations.push({id:uid(),...scopedItem(val("locationScope")),name:val("locationName"),population:val("locationPopulation"),culture:val("locationCulture"),image,description:val("locationDescription"),history:val("locationHistory"),notes:val("locationNotes"),created:new Date().toISOString()}); clearFields(["locationName","locationPopulation","locationCulture","locationDescription","locationHistory","locationNotes"]); if(input)input.value=""; clearOverviewImagePreview("locationImagePreview"); hideAddForm("locationAddForm"); saveData()}; if(!file)return finish(""); readImageUpload(input,finish)}
function addMagic(){const input=document.getElementById("magicImage"); const file=input?.files?.[0]; const item={id:uid(),...scopedItem("series"),name:val("magicName"),source:val("magicSource"),rules:val("magicRules"),limits:val("magicLimits"),costs:val("magicCosts"),examples:val("magicExamples"),customSections:[],created:new Date().toISOString()}; const finish=()=>{data.magicSystems.push(item); data.selectedMagicId=item.id; clearFields(["magicName","magicSource","magicRules","magicLimits","magicCosts","magicExamples"]); if(input)input.value=""; clearOverviewImagePreview("magicImagePreview"); hideAddForm("magicAddForm"); saveData(true); setView("magicDetail",item.id)}; if(file){readImageUpload(input,(src)=>{item.image=src; finish()})}else finish()}
function addOrganization(){const input=document.getElementById("orgImage"); const file=input?.files?.[0]; const item={id:uid(),...scopedItem("series"),name:val("orgName"),type:val("orgType"),description:val("orgDescription"),members:val("orgMembers"),history:val("orgHistory"),customSections:[],created:new Date().toISOString()}; const finish=()=>{data.organizations.push(item); data.selectedOrganizationId=item.id; clearFields(["orgName","orgType","orgDescription","orgMembers","orgHistory"]); if(input)input.value=""; clearOverviewImagePreview("orgImagePreview"); hideAddForm("organizationAddForm"); saveData(true); setView("organizationDetail",item.id)}; if(file){readImageUpload(input,(src)=>{item.image=src; finish()})}else finish()}


const entityConfigs={
  location:{collection:"locations",listId:"locationList",detailId:"locationDetailContent",selectedKey:"selectedLocationId",editFlag:"locationDetailEditMode",detailView:"locationDetail",listView:"locations",label:"Location",fields:[['population','Population'],['culture','Culture'],['description','Description'],['history','History'],['notes','Notes']]},
  magic:{collection:"magicSystems",listId:"magicList",detailId:"magicDetailContent",selectedKey:"selectedMagicId",editFlag:"magicDetailEditMode",detailView:"magicDetail",listView:"magic",label:"Magic/System",fields:[['source','Source'],['rules','Rules'],['limits','Limitations'],['costs','Costs'],['examples','Examples / Users']]},
  organization:{collection:"organizations",listId:"organizationList",detailId:"organizationDetailContent",selectedKey:"selectedOrganizationId",editFlag:"organizationDetailEditMode",detailView:"organizationDetail",listView:"organizations",label:"Organization",fields:[['type','Type'],['description','Description'],['members','Members'],['history','History']]}
};
function getEntityConfig(kind){return entityConfigs[kind]}
function getEntity(kind,id){const cfg=getEntityConfig(kind); return cfg?(data[cfg.collection]||[]).find(x=>x.id===id):null}
function getEntityEditMode(kind){return kind==="location"?locationDetailEditMode:kind==="magic"?magicDetailEditMode:organizationDetailEditMode}
function setEntityEditMode(kind,on){if(kind==="location")locationDetailEditMode=on; else if(kind==="magic")magicDetailEditMode=on; else organizationDetailEditMode=on}
function entitySortValue(kind){return val(`${kind}Sort`)||"az"}
function entitySearchValue(kind){return (val(`${kind}Search`)||"").trim().toLowerCase()}
function updateEntityCategoryCount(kind,count){const el=document.getElementById(`${kind}CategoryCount`); if(el)el.textContent=`(${count})`}
function sortEntityItems(kind,items){const sort=entitySortValue(kind); const byName=(a,b)=>(a.name||"").localeCompare(b.name||""); const byDate=(a,b)=>(a.created||"").localeCompare(b.created||""); if(sort==="za")return items.sort((a,b)=>byName(b,a)); if(sort==="newest")return items.sort((a,b)=>byDate(b,a)); if(sort==="oldest")return items.sort(byDate); return items.sort(byName)}
function renderEntityList(kind){const cfg=getEntityConfig(kind), el=document.getElementById(cfg.listId); if(!el)return; const search=entitySearchValue(kind); let items=(data[cfg.collection]||[]).filter(seriesScope); const total=items.length; if(search){items=items.filter(item=>JSON.stringify(item).toLowerCase().includes(search));} sortEntityItems(kind,items); updateEntityCategoryCount(kind,total); el.innerHTML=items.length?items.map(item=>`<article class="item-card"><div class="card-header"><h3>${escapeHTML(item.name||cfg.label)}</h3></div><div class="card-body">${item.image?`<img class="location-photo" src="${item.image}">`:`<div class="photo-placeholder small-placeholder">No Image</div>`}${cfg.fields.slice(0,3).map(([key,label])=>detail(label,item[key])).join("")}</div><button type="button" onclick="setView('${cfg.detailView}','${item.id}')">Open Detail Page</button><button class="delete-btn" onclick="deleteItem('${cfg.collection}','${item.id}')">Delete</button></article>`).join(""):search?`<p class='muted'>No ${escapeHTML(cfg.label.toLowerCase())} entries match your search.</p>`:"<p class='muted'>No entries yet.</p>"}
function updateEntityImage(kind,id,input){const item=getEntity(kind,id); if(!item)return; readImageUpload(input,(src)=>{item.image=src; saveData(true)})}
function triggerEntityImageUpload(kind,id,event){clickHiddenFileInput(`${kind}ImageUpload_${id}`,event)}
function startEntityDetailEdit(kind){setEntityEditMode(kind,true); renderEntityDetail(kind)}
function cancelEntityDetailEdit(kind){setEntityEditMode(kind,false); renderEntityDetail(kind)}
function addCustomSectionToEntity(kind,id){const title=prompt("Section title?"); if(!title)return; const text=prompt("Section text? You can edit it later.")||""; const item=getEntity(kind,id); if(!item)return; if(!Array.isArray(item.customSections))item.customSections=[]; item.customSections.push({id:uid(),title,text}); setEntityEditMode(kind,true); saveData(true)}
function deleteCustomSectionFromEntity(kind,id,sectionId){const item=getEntity(kind,id); if(!item||!Array.isArray(item.customSections))return; item.customSections=item.customSections.filter(s=>s.id!==sectionId); saveData(true)}
function saveEntityDetailEdit(kind,id){const cfg=getEntityConfig(kind), item=getEntity(kind,id); if(!cfg||!item)return; item.name=val(`${kind}EditName`); if(kind==="location"){item.scope=val(`${kind}EditScope`); item.seriesId=item.scope==="series"?data.activeSeriesId:null; item.bookId=item.scope==="book"?data.activeBookId:null;} cfg.fields.forEach(([key])=>{item[key]=val(`${kind}Edit_${key}`)}); (item.customSections||[]).forEach(sec=>{sec.title=val(`${kind}EditCustomTitle_${sec.id}`); sec.text=val(`${kind}EditCustomText_${sec.id}`)}); setEntityEditMode(kind,false); saveData(true)}
function renderEntityEditForm(kind,item){const cfg=getEntityConfig(kind), custom=Array.isArray(item.customSections)?item.customSections:[]; return `<div class="panel character-detail-grid"><div>${item.image?`<img class="character-photo" src="${item.image}" alt="${escapeHTML(item.name||cfg.label)}"><input id="${kind}ImageUpload_${item.id}" type="file" accept="image/*" class="hidden" onchange="updateEntityImage('${kind}','${item.id}',this)"><button type="button" class="wide" onclick="triggerEntityImageUpload('${kind}','${item.id}',event)">Change Image</button>`:`<div class="character-photo panel photo-placeholder"><p>No Image</p><input id="${kind}ImageUpload_${item.id}" type="file" accept="image/*" class="hidden" onchange="updateEntityImage('${kind}','${item.id}',this)"><button type="button" class="wide" onclick="triggerEntityImageUpload('${kind}','${item.id}',event)">+ Add Image</button></div>`}</div><div><h3>Edit ${escapeHTML(cfg.label)} Detail</h3><div class="form-grid"><input id="${kind}EditName" placeholder="Name" value="${escapeAttr(item.name||"")}">${kind==="location"?`<select id="${kind}EditScope"><option value="book">Attach to this book</option><option value="series">Attach to whole project</option></select>`:""}${cfg.fields.map(([key,label])=>`<textarea id="${kind}Edit_${key}" placeholder="${escapeAttr(label)}">${escapeHTML(item[key]||"")}</textarea>`).join("")}</div><h3>Custom Sections</h3>${custom.map(sec=>`<div class="custom-section-builder"><input id="${kind}EditCustomTitle_${sec.id}" placeholder="Section title" value="${escapeAttr(sec.title||"")}"><textarea id="${kind}EditCustomText_${sec.id}" placeholder="Section notes">${escapeHTML(sec.text||"")}</textarea><button type="button" class="delete-btn" onclick="deleteCustomSectionFromEntity('${kind}','${item.id}','${sec.id}'); setEntityEditMode('${kind}',true)">Delete Section</button></div>`).join("")||"<p class='muted'>No custom sections yet.</p>"}<button type="button" onclick="addCustomSectionToEntity('${kind}','${item.id}')">+ Add Custom Section</button><hr><button onclick="saveEntityDetailEdit('${kind}','${item.id}')">Save Changes</button><button class="ghost-btn" onclick="cancelEntityDetailEdit('${kind}')">Cancel</button></div></div>`}
function renderEntityDetail(kind){const cfg=getEntityConfig(kind), el=document.getElementById(cfg.detailId); if(!el)return; const item=getEntity(kind,data[cfg.selectedKey]); if(!item){el.innerHTML=`<div class="panel"><p>Select a ${escapeHTML(cfg.label.toLowerCase())} from the sidebar or list.</p></div>`; return} if(getEntityEditMode(kind)){el.innerHTML=renderEntityEditForm(kind,item); if(kind==="location")setVal(`${kind}EditScope`,item.scope||"book"); return} const custom=Array.isArray(item.customSections)?item.customSections:[]; el.innerHTML=`<div class="panel character-detail-grid"><div>${item.image?`<img class="character-photo" src="${item.image}" alt="${escapeHTML(item.name||cfg.label)}"><input id="${kind}ImageUpload_${item.id}" type="file" accept="image/*" class="hidden" onchange="updateEntityImage('${kind}','${item.id}',this)"><button type="button" class="wide" onclick="triggerEntityImageUpload('${kind}','${item.id}',event)">Change Image</button>`:`<div class="character-photo panel photo-placeholder"><p>No Image</p><input id="${kind}ImageUpload_${item.id}" type="file" accept="image/*" class="hidden" onchange="updateEntityImage('${kind}','${item.id}',this)"><button type="button" class="wide" onclick="triggerEntityImageUpload('${kind}','${item.id}',event)">+ Add Image</button></div>`}</div><div><div class="detail-header-row"><div><h2>${escapeHTML(item.name||cfg.label)}</h2><p class="muted">${escapeHTML(cfg.label)} Detail Page</p></div><button onclick="startEntityDetailEdit('${kind}')">Edit ${escapeHTML(cfg.label)}</button></div>${cfg.fields.map(([key,label])=>detailBlock(label,item[key])).join("")}${custom.map(sec=>detailBlock(sec.title||"Custom Section",sec.text)).join("")}<button type="button" onclick="addCustomSectionToEntity('${kind}','${item.id}')">+ Add Custom Section</button>${renderSharedAppearanceLog(kind,item.id)}</div></div>`}

function applyStructureTemplate(){const template=val("structureTemplate"); const maps={"Three Act Structure":["Act 1 — Setup","Act 2A — Rising Action","Midpoint","Act 2B — Fall / Pressure","Act 3 — Resolution"],"Save The Cat":["Opening Image","Theme Stated","Set-Up","Catalyst","Debate","Break Into Two","B Story","Fun and Games","Midpoint","Bad Guys Close In","All Is Lost","Dark Night of the Soul","Break Into Three","Finale","Final Image"],"Hero's Journey":["Ordinary World","Call to Adventure","Refusal","Mentor","Crossing Threshold","Tests / Allies / Enemies","Approach","Ordeal","Reward","Road Back","Resurrection","Return"],"Romance Beat Sheet":["Meet Cute","No Way","Adhesion","Why Them","Midpoint Bond","Retreat","Dark Moment","Grand Gesture","HEA / HFN"],"Custom":[]}; data.structureBeats=data.structureBeats.filter(b=>b.seriesId!==data.activeSeriesId||b.bookId!==data.activeBookId); (maps[template]||[]).forEach((name,i)=>data.structureBeats.push({id:uid(),...scopedItem("book"),name,notes:"",order:i,created:new Date().toISOString()})); saveData()}
function addStructureBeat(){data.structureBeats.push({id:uid(),...scopedItem("book"),name:val("structureBeatName")||"Untitled Beat",notes:val("structureBeatNotes"),order:data.structureBeats.filter(visibleByScope).length,created:new Date().toISOString()}); clearFields(["structureBeatName","structureBeatNotes"]); saveData()}

function makeCard(title,body,onDelete){const template=document.getElementById("cardTemplate"); const node=template.content.cloneNode(true); node.querySelector("h3").textContent=title||"Untitled"; node.querySelector(".card-body").innerHTML=body; node.querySelector(".delete-btn").onclick=onDelete; return node}
function deleteItem(collection,id){data[collection]=data[collection].filter(item=>item.id!==id); saveData()}


function activeProjectBooks(){
  return (data.books||[]).filter(b=>b.seriesId===data.activeSeriesId).sort((a,b)=>(a.created||"").localeCompare(b.created||""));
}
function bookScenes(book){return (book?.manuscript||[]).flatMap((ch,ci)=>(ch.scenes||[]).map((sc,si)=>({book,chapter:ch,scene:sc,chapterIndex:ci,sceneIndex:si})))}
function projectScenesAll(){return activeProjectBooks().flatMap(bookScenes)}
function bookWordCount(book){return bookScenes(book).reduce((sum,x)=>sum+countWords(stripHTML(x.scene.content||"")),0)}
function quickAddBookToActiveProject(){
  const s=activeSeries(); if(!s)return alert("Open a project first.");
  const title=prompt("Book title:",`Book ${activeProjectBooks().length+1}`); if(!title)return;
  const book=makeStarterBook(s.id,title); data.books.push(book); data.activeBookId=book.id;
  const first=book.manuscript?.[0]; data.activeChapterId=first?.id||null; data.activeSceneId=first?.scenes?.[0]?.id||null;
  saveData(true);
  setView("projectDashboard");
}
function switchActiveBookFromDashboard(bookId){
  const b=(data.books||[]).find(x=>x.id===bookId&&x.seriesId===data.activeSeriesId); if(!b)return;
  saveCurrentScene(false,false); data.activeBookId=bookId;
  const first=b.manuscript?.[0]; data.activeChapterId=first?.id||null; data.activeSceneId=first?.scenes?.[0]?.id||null;
  saveData(true); setView("projectDashboard");
}
function openBookFromDashboard(bookId){
  switchActiveBookFromDashboard(bookId);
  setView("overview");
}
function triggerBookCoverUpload(bookId,event){clickHiddenFileInput(`bookCoverUpload_${bookId}`,event)}
function updateBookCover(bookId,input){
  const b=(data.books||[]).find(x=>x.id===bookId); if(!b)return;
  readImageUpload(input,(src)=>{b.cover=src; saveData(true)});
}
function plotPointUsageForBook(bookId=null){
  const scenes=(bookId?bookScenes((data.books||[]).find(b=>b.id===bookId)):projectScenesAll()).filter(x=>x.scene.plotCardId);
  const usage={};
  scenes.forEach((x,i)=>{const id=x.scene.plotCardId; if(!usage[id])usage[id]={first:i,last:i,count:0,items:[]}; usage[id].last=i; usage[id].count++; usage[id].items.push(x);});
  return {scenes,usage};
}
function computedPlotStatus(card,bookId=null){
  const {scenes,usage}=plotPointUsageForBook(bookId||card.bookId||null);
  const u=usage[card.id];
  if(!u)return "Not Started";
  const laterDifferent=scenes.some((x,i)=>i>u.last && x.scene.plotCardId && x.scene.plotCardId!==card.id);
  return laterDifferent?"Completed":"Active";
}
function syncPlotCompletionStatuses(){
  (data.plotCards||[]).forEach(card=>{card.autoStatus=computedPlotStatus(card,card.bookId||null);});
}
function renderProjectWritingChart(books){
  const chart=document.getElementById("projectWritingChart"); if(!chart)return;
  const values=(books||[]).slice(-7).map(b=>bookWordCount(b));
  const padded=values.length?values:[0,0,0,0,0,0,0];
  const max=Math.max(...padded,1);
  chart.innerHTML=padded.map(v=>`<span title="${v.toLocaleString()} words" style="height:${Math.max(12,Math.round((v/max)*88))}%"></span>`).join("");
}

function renderProjectDashboard(){
  const el=document.getElementById("projectDashboard"); if(!el)return;
  const s=activeSeries(); if(!s)return;
  syncPlotCompletionStatuses();
  const books=activeProjectBooks();
  const allScenes=projectScenesAll();
  const totalWords=books.reduce((sum,b)=>sum+bookWordCount(b),0);
  const projectDashboardName=`${s.title||"Project"} Dashboard`;
  setText("projectDashboardTitle",projectDashboardName);
  setText("viewTitle",projectDashboardName);
  setText("projectDashboardSubtitle",`${books.length} book${books.length===1?"":"s"} tracked across this project.`);
  setText("projectDashBooks",books.length);
  setText("projectDashWords",totalWords.toLocaleString());
  setText("projectDashChapters",books.reduce((n,b)=>n+(b.manuscript||[]).length,0));
  setText("projectDashScenes",allScenes.length);
  setText("projectDashCharacters",(data.characters||[]).filter(seriesScope).length);
  renderProjectWritingChart(books);
  const lastBook=activeBook()||books[0]; const lastChapter=activeChapter()||lastBook?.manuscript?.[0]; const lastScene=activeScene()||lastChapter?.scenes?.[0];
  setHTML("projectContinueWriting", lastBook&&lastChapter&&lastScene ? `<p><strong>${escapeHTML(lastBook.title||"Untitled Book")}</strong></p><p>${escapeHTML(lastChapter.title||"Chapter")} → ${escapeHTML(lastScene.title||"Scene")}</p><button onclick="setView('write','${lastChapter.id}','${lastScene.id}')">Open Scene</button>` : `<p>No scene yet.</p><button onclick="quickAddBookToActiveProject()">+ Add Book</button>`);
  setHTML("projectDashboardBooks", books.length?books.map(b=>{const wc=bookWordCount(b); const sc=bookScenes(b).length; const cover=b.cover?`<img class="book-cover-thumb" src="${b.cover}" alt="${escapeHTML(b.title||"Book cover")}">`:`<div class="book-cover-thumb book-cover-placeholder"><span>No Cover</span><button type="button" onclick="triggerBookCoverUpload('${b.id}',event)">+ Add Cover</button></div>`; return `<article class="item-card book-shelf-card ${b.id===data.activeBookId?"active-card":""}" onclick="openBookFromDashboard('${b.id}')"><div class="book-cover-wrap">${cover}<input id="bookCoverUpload_${b.id}" type="file" accept="image/*" class="hidden" onchange="updateBookCover('${b.id}',this)"></div><div class="book-card-content"><div class="card-header"><h3>${escapeHTML(b.title||"Untitled Book")}</h3><span class="tag">${escapeHTML(b.status||"Planning")}</span></div><div class="card-body"><p>${wc} words • ${(b.manuscript||[]).length} chapters • ${sc} scenes</p>${detail("Summary",b.summary)}<div class="book-card-actions"><button onclick="event.stopPropagation(); switchActiveBookFromDashboard('${b.id}')">${b.id===data.activeBookId?"Current Book":"Switch to Book"}</button>${b.cover?`<button class="ghost-btn" onclick="triggerBookCoverUpload('${b.id}',event)">Change Cover</button>`:""}</div></div></div></article>`}).join(""):`<p>No books yet.</p>`);
  const chars=(data.characters||[]).filter(seriesScope); const locs=(data.locations||[]).filter(seriesScope); const orgs=(data.organizations||[]).filter(seriesScope); const magic=(data.magicSystems||[]).filter(seriesScope); const points=(data.plotCards||[]).filter(seriesScope);
  setHTML("projectStoryHealth",`<div class="mini-stats"><div><strong>${chars.length}</strong><span>Characters</span></div><div><strong>${points.length}</strong><span>Plot Points</span></div><div><strong>${locs.length}</strong><span>Locations</span></div><div><strong>${orgs.length+magic.length}</strong><span>Orgs/Magic</span></div></div>`);
  const filter=document.getElementById("plotProgressBookFilter"); if(filter){const current=filter.value||"all"; filter.innerHTML=`<option value="all">All Books</option>`+books.map(b=>`<option value="${b.id}">${escapeHTML(b.title||"Untitled Book")}</option>`).join(""); filter.value=books.some(b=>b.id===current)?current:"all";}
  const selectedBook=filter?.value&&filter.value!=="all"?filter.value:null;
  const arcs=(data.plotArcs||[]).filter(a=>a.seriesId===data.activeSeriesId && (!selectedBook || a.bookId===selectedBook || !a.bookId));
  const cards=(data.plotCards||[]).filter(c=>c.seriesId===data.activeSeriesId && (!selectedBook || c.bookId===selectedBook || !c.bookId));
  setHTML("projectPlotArcProgress", arcs.length?arcs.map(arc=>{const arcCards=cards.filter(c=>c.arcId===arc.id); const done=arcCards.filter(c=>computedPlotStatus(c,selectedBook||c.bookId)==="Completed").length; const active=arcCards.filter(c=>computedPlotStatus(c,selectedBook||c.bookId)==="Active").length; const pct=arcCards.length?Math.round(done/arcCards.length*100):0; return `<div class="progress-row"><div class="card-header"><strong>${escapeHTML(arc.title||"Plot Arc")}</strong><span class="tag">${pct}%</span></div><div class="progress-bar"><span style="width:${pct}%"></span></div><small>${done} completed • ${active} active • ${arcCards.length-done-active} not started</small></div>`}).join(""):`<p>No plot arcs yet.</p>`);
  const appearedChars=chars.filter(c=>appearanceLogEntries("character",c.id).length); const unusedChars=chars.filter(c=>!appearanceLogEntries("character",c.id).length);
  setHTML("projectAppearanceSummary",`<p><strong>${appearedChars.length}</strong> characters have appeared. <strong>${unusedChars.length}</strong> have not appeared yet.</p>${unusedChars.slice(0,5).map(c=>`<span class="tag">${escapeHTML(c.name||"Unnamed")}</span>`).join(" ")||"<p>No unused characters.</p>"}`);
  const unusedPoints=cards.filter(c=>!plotPointUsageForBook(selectedBook||c.bookId).usage[c.id]);
  const warnings=[]; if(unusedPoints.length)warnings.push(`${unusedPoints.length} plot point${unusedPoints.length===1?"":"s"} never used in scenes.`); if(unusedChars.length)warnings.push(`${unusedChars.length} character${unusedChars.length===1?"":"s"} never marked in scenes.`); if(!books.length)warnings.push("This project has no books yet.");
  setHTML("projectContinuityWarnings", warnings.length?warnings.map(w=>`<p>⚠ ${escapeHTML(w)}</p>`).join(""):`<p>No major warnings right now.</p>`);
}
function renderOverview(){const s=activeSeries(), b=activeBook(); setVal("seriesTitleEdit",s?.title); setVal("seriesTypeEdit",s?.type||"series"); setVal("seriesGenreEdit",s?.genre); setVal("seriesSynopsisEdit",s?.synopsis); setVal("seriesThemeEdit",s?.theme); setVal("seriesMysteriesEdit",s?.mysteries); setVal("seriesForeshadowingEdit",s?.foreshadowing); setVal("bookTitleEdit",b?.title); setVal("bookStatusEdit",b?.status); setVal("bookSummaryEdit",b?.summary); setVal("bookThemeEdit",b?.theme); setVal("bookNotesEdit",b?.notes); const scenes=(b?.manuscript||[]).flatMap(c=>c.scenes||[]); const words=scenes.reduce((sum,s)=>sum+countWords(stripHTML(s.content||"")),0); setText("statWords",words); setText("statChapters",(b?.manuscript||[]).length); setText("statScenes",scenes.length); setText("statCharacters",data.characters.filter(seriesScope).length); setText("projectPath",`${s?.title||"No project"} → ${b?.title||"No book selected"}`); setText("sidebarProjectName",b?.title||"Project")}
function saveOverviewFields(render=false){const s=activeSeries(), b=activeBook(); if(s){s.title=val("seriesTitleEdit"); s.type=val("seriesTypeEdit")||"series"; s.genre=val("seriesGenreEdit"); s.synopsis=val("seriesSynopsisEdit"); s.theme=val("seriesThemeEdit"); s.mysteries=val("seriesMysteriesEdit"); s.foreshadowing=val("seriesForeshadowingEdit")} if(b){b.title=val("bookTitleEdit"); b.status=val("bookStatusEdit"); b.summary=val("bookSummaryEdit"); b.theme=val("bookThemeEdit"); b.notes=val("bookNotesEdit")} saveData(render)}
function renderManuscript(){
  const book=activeBook();
  const list=document.getElementById("manuscriptChapterList");
  const layout=document.querySelector(".editor-layout");
  if(layout)layout.classList.toggle("manuscript-sidebar-collapsed",!!data.manuscriptSidebarCollapsed);
  if(!list)return;
  list.innerHTML="";
  (book?.manuscript||[]).forEach((ch,i)=>{
    const words=(ch.scenes||[]).reduce((sum,s)=>sum+countWords(stripHTML(s.content||"")),0);
    const collapsed=!!data.editorCollapsedChapters?.[ch.id];
    const wrap=document.createElement("div");
    wrap.className="manuscript-chapter-group";
    wrap.innerHTML=`<div class="chapter-row"><button class="chapter-button ${ch.id===data.activeChapterId?"active":""}" onclick="setView('write','${ch.id}')"><span>${i+1}. ${escapeHTML(ch.title||"Untitled")}</span><small>${words} words · ${(ch.scenes||[]).length} scene${(ch.scenes||[]).length===1?"":"s"}</small></button><button class="collapse-chapter-btn" onclick="toggleEditorChapter('${ch.id}')">${collapsed?"▸":"▾"}</button></div>
      <div class="scene-tree ${collapsed?"hidden":""}">${(ch.scenes||[]).map((s,j)=>`<div class="scene-row"><button class="scene-button ${s.id===data.activeSceneId?"active":""}" onclick="selectScene('${ch.id}','${s.id}')"><span>${j+1}. ${escapeHTML(s.title||"Scene")}</span><small>${countWords(stripHTML(s.content||""))} words · ${sceneCharacterIds(s).length} char · ${sceneTrackedIds(s,"organizationIds").length} org · ${sceneTrackedIds(s,"magicSystemIds").length} magic · ${sceneTrackedIds(s,"itemArtifactIds").length} items · ${sceneTrackedIds(s,"floraFaunaIds").length} flora/fauna</small></button><button class="delete-btn" onclick="deleteScene('${ch.id}','${s.id}')">Delete</button></div>`).join("")}</div>
      <button class="delete-btn" onclick="deleteManuscriptChapter('${ch.id}')">Delete Chapter</button>`;
    list.appendChild(wrap)
  });
  const ch=activeChapter(), scene=activeScene();
  setVal("currentChapterTitle",ch?.title||"");
  setVal("currentSceneTitle",scene?.title||"");
  setVal("scenePOV",scene?.pov||"");
  setVal("sceneLocation",scene?.locationId||"");
  setVal("scenePlotPoint",scene?.plotCardId||"");
  setVal("sceneDate",scene?.date||"");
  setVal("sceneMood",scene?.mood||"");
  setVal("scenePurpose",scene?.purpose||"");
  const editor=document.getElementById("richEditor");
  if(editor){isRendering=true; editor.innerHTML=scene?.content||""; isRendering=false}
  renderSceneCharacterTracker();
  updateEditorStats();
}
function renderSelects(){const chars=data.characters.filter(seriesScope); const charOptions=`<option value="">Select character</option>`+chars.map(c=>`<option value="${c.id}">${escapeHTML(c.name)}</option>`).join(""); ["scenePOV","relA","relB"].forEach(id=>setHTML(id,charOptions)); updateRelationshipViewLabels(); const locs=data.locations.filter(seriesScope); setHTML("sceneLocation",`<option value="">Select location</option>`+locs.map(l=>`<option value="${l.id}">${escapeHTML(l.name)}</option>`).join("")); const plotOptions=`<option value="">Plot Board Point</option>`+plotBoardItems().map(p=>`<option value="${p.id}">${escapeHTML((plotArcItems().find(a=>a.id===p.arcId)?.title||"Plot")+" — "+(p.title||"Untitled Point"))}</option>`).join(""); setHTML("scenePlotPoint",plotOptions); const beats=data.structureBeats.filter(visibleByScope); setHTML("chapterStructureBeat",`<option value="">Structure beat</option>`+beats.map(b=>`<option value="${b.id}">${escapeHTML(b.name)}</option>`).join(""))}
function renderCardList(collection,elId,titleKey,bodyFn,filter=visibleByScope){const el=document.getElementById(elId); if(!el)return; el.innerHTML=""; (data[collection]||[]).filter(filter).forEach(item=>el.appendChild(makeCard(item[titleKey],bodyFn(item),()=>deleteItem(collection,item.id))))}
function renderAllLists(){renderStoryBoard(); renderPlotBoard(); renderCharactersByRole(); renderCharacterDetail(); renderWorldByCategory(); renderWorldCategoryPage(); renderWorldDetail(); renderEntityDetail("location"); renderEntityDetail("magic"); renderEntityDetail("organization"); renderRelationships(); renderSeriesTools(); renderWritingStats();
renderCardList("chapterPlans","chapterPlanList","number",item=>`<span class="tag">Book</span>${detail("POV",item.pov)}${detail("Structure Beat",data.structureBeats.find(b=>b.id===item.structureBeat)?.name||"")}${detail("Target Words",item.wordTarget)}${detail("Goal",item.goal)}${detail("Conflict",item.conflict)}${detail("Outcome",item.outcome)}${detail("Emotional Beat",item.emotion)}${detail("Foreshadowing",item.foreshadowing)}`);
renderCardList("threads","threadList","title",item=>`<span class="tag">${escapeHTML(item.scope)}</span><span class="tag">${escapeHTML(item.status)}</span>${detail("Setup",item.setup)}${detail("Payoff",item.payoff)}`);
renderCardList("mysteries","mysteryList","question",item=>`<span class="tag">${escapeHTML(item.status)}</span>${detail("Introduced",item.introduced)}${detail("Hints / False Leads",item.hints)}${detail("Answer",item.answer)}${detail("Payoff",item.payoff)}`,seriesScope);
renderCardList("foreshadowing","foreshadowingList","hint",item=>`<span class="tag">${escapeHTML(item.status)}</span>${detail("Appears",item.appears)}${detail("Payoff",item.payoff)}${detail("Notes",item.notes)}`,seriesScope);
renderEntityList("location");
renderEntityList("magic");
renderEntityList("organization");
renderSceneDatabase(); renderTimeline();}
function renderStoryBoard(){const el=document.getElementById("storyBoardList"); if(!el)return; const beats=data.structureBeats.filter(visibleByScope).sort((a,b)=>(a.order||0)-(b.order||0)); const plans=data.chapterPlans.filter(visibleByScope); el.innerHTML=beats.length?beats.map(beat=>`<div class="board-column"><h3>${escapeHTML(beat.name)}</h3><p>${escapeHTML(beat.notes||"")}</p>${plans.filter(p=>p.structureBeat===beat.id).map(p=>`<div class="board-card">${escapeHTML(p.number||"Chapter")}<br><small>${escapeHTML(p.goal||"")}</small></div>`).join("")}<button class="delete-btn" onclick="deleteItem('structureBeats','${beat.id}')">Delete Beat</button></div>`).join(""):`<p class="muted">Apply a template or add a custom beat.</p>`}
function plotCardAppearanceLog(cardId){return appearanceLogEntries("plotCard",cardId)}
function renderPlotCardAppearanceLog(cardId){
  return renderAppearanceLogToggle("Appearance Log",plotCardAppearanceLog(cardId),"Not connected to any scenes yet.");
}
function renderPlotBoard(){
  const el=document.getElementById("plotBoardList"); if(!el)return;
  normalizePlotBoard();
  syncPlotCompletionStatuses();
  const arcs=plotArcItems();
  setHTML("plotCardArc",arcs.map(a=>`<option value="${a.id}">${escapeHTML(a.title)}</option>`).join(""));
  el.innerHTML=arcs.map(arc=>{
    const cards=plotBoardItems().filter(c=>c.arcId===arc.id);
    return `<div class="board-column plot-arc-column" ondragover="onPlotCardDragOver(event)" ondrop="onPlotCardDrop(event,'${arc.id}')">
      <div class="board-column-header"><h3>${escapeHTML(arc.title)}</h3><div><button onclick="renamePlotArc('${arc.id}')">Rename</button><button class="delete-btn" onclick="deletePlotArc('${arc.id}')">Delete Arc</button></div></div>
      ${cards.length?cards.map(c=>`<div class="board-card plot-card" draggable="true" ondragstart="onPlotCardDragStart(event,'${c.id}')" ondragover="onPlotCardDragOver(event)" ondrop="onPlotCardDrop(event,'${arc.id}','${c.id}')"><strong>${escapeHTML(c.title)}</strong><span class="tag">${escapeHTML(computedPlotStatus(c,c.bookId||null))}</span><p>${escapeHTML(c.notes||"")}</p>${renderPlotCardAppearanceLog(c.id)}<button class="delete-btn" onclick="deleteItem('plotCards','${c.id}')">Delete Point</button></div>`).join(""):`<p class="muted drop-hint">Drop plot points here.</p>`}
    </div>`;
  }).join("");
}
function characterMiniBasicInfo(c){
  const basic=(c.basicInfo||c.bio||"").trim();
  const facts=[];
  if(c.role)facts.push(["Role",c.role]);
  if(c.species)facts.push(["Species",c.species]);
  if(c.age)facts.push(["Age",c.age]);
  if(c.occupation)facts.push(["Occupation",c.occupation]);
  if(c.status)facts.push(["Status",c.status]);
  return `${facts.length?`<div class="mini-basic-list stacked-basic-list">${facts.map(([label,val])=>`<p><strong>${escapeHTML(label)}</strong><span>${escapeHTML(val)}</span></p>`).join("")}</div>`:""}${basic?detail("Basic Information",basic):"<p class='muted'>No basic information added yet.</p>"}`;
}
function renderCharacterPhotoMini(c){
  if(c.photo){
    return `<div class="mini-profile-photo-wrap"><img class="character-photo mini-profile-photo" src="${c.photo}" alt="${escapeHTML(c.name)}"></div>`;
  }
  return `<div class="mini-profile-photo-wrap mini-profile-placeholder"><div class="character-photo photo-placeholder"><p>No Photo</p></div></div>`;
}
function renderCharactersByRole(){
  const el=document.getElementById("characterRoleGroups"); if(!el)return;
  const roles=["Main","Side","Love Interest","Antagonist","Mentor","Other"];
  el.innerHTML=roles.map(role=>{
    const chars=data.characters.filter(c=>seriesScope(c)&&(c.role||"Other")===role);
    return `<div class="role-group character-role-group"><div class="role-group-header"><h3>${role}</h3><span class="tag">${chars.length}</span></div><div class="character-directory-grid">${chars.length?chars.map(c=>`<article class="item-card character-mini-card character-directory-card clickable-card" onclick="setView('characterDetail','${c.id}')" title="Open ${escapeAttr(c.name||'Character')}"><div class="card-header compact-card-header"><h3>${escapeHTML(c.name||'Unnamed Character')}</h3><button class="delete-btn compact-delete-btn" onclick="event.stopPropagation(); deleteItem('characters','${c.id}')">Delete</button></div>${renderCharacterPhotoMini(c)}<div class="card-body character-mini-basic">${characterMiniBasicInfo(c)}</div></article>`).join(""):`<p class="muted">No ${role} characters yet.</p>`}</div></div>`
  }).join("")
}
function startCharacterDetailEdit(){characterDetailEditMode=true; renderCharacterDetail()}
function cancelCharacterDetailEdit(){characterDetailEditMode=false; renderCharacterDetail()}
function saveCharacterDetailEdit(characterId){
  const c=data.characters.find(x=>x.id===characterId); if(!c)return;
  c.name=val("editCharName"); c.role=val("editCharRole"); c.species=val("editCharSpecies");
  c.basicInfo=val("editCharBasicInfo"); c.description=val("editCharDescription"); c.personality=val("editCharPersonality");
  c.backstory=val("editCharBackstory"); c.wound=val("editCharWound"); c.arc=val("editCharArc"); c.voice=val("editCharVoice");
  c.secrets=val("editCharSecrets"); c.quotes=val("editCharQuotes");
  c.customSections=(Array.isArray(c.customSections)?c.customSections:[]).map(sec=>({
    id:sec.id,
    title:val(`editCustomTitle_${sec.id}`)||"Untitled Section",
    text:val(`editCustomText_${sec.id}`)
  }));
  characterDetailEditMode=false; saveData(true);
}
function addCharacterCustomSectionFromDetail(characterId){
  const c=data.characters.find(x=>x.id===characterId); if(!c)return;
  if(!Array.isArray(c.customSections))c.customSections=[];
  c.customSections.push({id:uid(),title:"New Section",text:""});
  characterDetailEditMode=true; saveData(true);
}
function renderCharacterEditForm(c){
  const custom=Array.isArray(c.customSections)?c.customSections:[];
  return `<div class="panel character-detail-grid"><div>${c.photo?`<img class="character-photo" src="${c.photo}" alt="${escapeHTML(c.name)}"><input id="characterPhotoUpload_${c.id}" type="file" accept="image/*" class="hidden" onchange="updateCharacterPhoto('${c.id}',this)"><button type="button" class="wide" onclick="triggerCharacterPhotoUpload('${c.id}',event)">Change Photo</button>`:`<div class="character-photo panel photo-placeholder"><p>No Photo</p><input id="characterPhotoUpload_${c.id}" type="file" accept="image/*" class="hidden" onchange="updateCharacterPhoto('${c.id}',this)"><button type="button" class="wide" onclick="triggerCharacterPhotoUpload('${c.id}',event)">+ Add Character Photo</button></div>`}</div><div><h3>Edit Character Detail</h3><div class="form-grid"><input id="editCharName" placeholder="Character name" value="${escapeAttr(c.name||"")}"><select id="editCharRole"><option>Main</option><option>Side</option><option>Love Interest</option><option>Antagonist</option><option>Mentor</option><option>Other</option></select><input id="editCharSpecies" placeholder="Species / identity" value="${escapeAttr(c.species||"")}"><textarea id="editCharBasicInfo" placeholder="Basic Information">${escapeHTML(c.basicInfo||c.bio||"")}</textarea><textarea id="editCharDescription" placeholder="Physical Appearance">${escapeHTML(c.description||"")}</textarea><textarea id="editCharPersonality" placeholder="Personality">${escapeHTML(c.personality||"")}</textarea><textarea id="editCharBackstory" placeholder="Backstory">${escapeHTML(c.backstory||"")}</textarea><textarea id="editCharWound" placeholder="Psychology: Core Wound, Core Fear, Core Desire, Fatal Flaw">${escapeHTML(c.wound||"")}</textarea><textarea id="editCharArc" placeholder="Character Arc">${escapeHTML(c.arc||"")}</textarea><textarea id="editCharVoice" placeholder="Voice / speech patterns">${escapeHTML(c.voice||"")}</textarea><textarea id="editCharSecrets" placeholder="Secrets">${escapeHTML(c.secrets||"")}</textarea><textarea id="editCharQuotes" placeholder="Quotes">${escapeHTML(c.quotes||"")}</textarea></div><h3>Custom Sections</h3>${custom.map(sec=>`<div class="custom-section-builder"><input id="editCustomTitle_${sec.id}" placeholder="Section title" value="${escapeAttr(sec.title||"")}"><textarea id="editCustomText_${sec.id}" placeholder="Section notes">${escapeHTML(sec.text||"")}</textarea><button type="button" class="delete-btn" onclick="deleteCustomSectionFromCharacter('${c.id}','${sec.id}'); characterDetailEditMode=true">Delete Section</button></div>`).join("")||"<p class='muted'>No custom sections yet.</p>"}<button type="button" onclick="addCharacterCustomSectionFromDetail('${c.id}')">+ Add Custom Section</button><hr><button onclick="saveCharacterDetailEdit('${c.id}')">Save Changes</button><button class="ghost-btn" onclick="cancelCharacterDetailEdit()">Cancel</button></div></div>`
}
function renderCharacterDetail(){const el=document.getElementById("characterDetailContent"); if(!el)return; const c=data.characters.find(x=>x.id===data.selectedCharacterId); if(!c){el.innerHTML=`<div class="panel"><p>Select a character from the sidebar.</p></div>`;return} if(characterDetailEditMode){el.innerHTML=renderCharacterEditForm(c); setVal("editCharRole",c.role||"Other"); return} const rels=characterRelationships(c.id), apps=characterAppearances(c.id), custom=Array.isArray(c.customSections)?c.customSections:[]; el.innerHTML=`<div class="panel character-detail-grid"><div>${c.photo?`<img class="character-photo" src="${c.photo}" alt="${escapeHTML(c.name)}"><input id="characterPhotoUpload_${c.id}" type="file" accept="image/*" class="hidden" onchange="updateCharacterPhoto('${c.id}',this)"><button type="button" class="wide" onclick="triggerCharacterPhotoUpload('${c.id}',event)">Change Photo</button>`:`<div class="character-photo panel photo-placeholder"><p>No Photo</p><input id="characterPhotoUpload_${c.id}" type="file" accept="image/*" class="hidden" onchange="updateCharacterPhoto('${c.id}',this)"><button type="button" class="wide" onclick="triggerCharacterPhotoUpload('${c.id}',event)">+ Add Character Photo</button></div>`}<button class="wide" onclick="startCharacterDetailEdit()">Edit Character Detail</button><button class="wide" onclick="addCharacterCustomSectionFromDetail('${c.id}')">+ Add Custom Section</button></div><div><h3>${escapeHTML(c.name)}</h3><span class="tag">${escapeHTML(c.role||"")}</span><span class="tag">${escapeHTML(c.species||"")}</span>${detailBlock("Basic Information",c.basicInfo||c.bio)}${detailBlock("Physical Appearance",c.description)}${detailBlock("Personality",c.personality)}${detailBlock("Backstory",c.backstory)}${detailBlock("Psychology: Core Wound, Core Fear, Core Desire, Fatal Flaw",c.wound)}${detailBlock("Character Arc",c.arc)}${detailBlock("Voice / Speech Patterns",c.voice)}${detailBlock("Secrets",c.secrets)}${detailBlock("Quotes",c.quotes)}${custom.map(sec=>`<section class="character-section custom-character-section"><h4>${escapeHTML(sec.title||"Untitled Section")}</h4><p>${formatMultiline(sec.text||"")}</p><button class="delete-btn" onclick="deleteCustomSectionFromCharacter('${c.id}','${sec.id}')">Delete Section</button></section>`).join("")}<h3>Linked Relationships</h3>${rels.length?rels.map(r=>{const other=r.a===c.id?r.b:r.a; const ownView=r.a===c.id?r.aView:r.bView; const otherView=r.a===c.id?r.bView:r.aView; return `<p><strong>${escapeHTML(characterName(r.a))} + ${escapeHTML(characterName(r.b))}:</strong> ${escapeHTML(r.type||"")} — ${escapeHTML(r.status||"")}<br>${escapeHTML(r.history||r.arc||"")}${ownView?`<br><strong>${escapeHTML(c.name)}'s View:</strong> ${escapeHTML(ownView)}`:""}${otherView?`<br><strong>${escapeHTML(characterName(other))}'s View:</strong> ${escapeHTML(otherView)}`:""}</p>`}).join(""):"<p>No linked relationships yet.</p>"}${renderSharedAppearanceLog("character",c.id)}</div></div>`}
function renderRelationships(){const map=document.getElementById("relationshipMap"), list=document.getElementById("relationshipList"); if(!map||!list)return; map.innerHTML=""; list.innerHTML=""; const rels=data.relationships.filter(seriesScope); if(!rels.length)map.innerHTML="<p>No relationships yet.</p>"; rels.forEach(item=>{const nameA=characterName(item.a), nameB=characterName(item.b); const node=document.createElement("div"); node.className="rel-node"; node.textContent=`${nameA} ↔ ${nameB} (${item.type||"connection"})`; map.appendChild(node); list.appendChild(makeCard(`${nameA} + ${nameB}`,`<span class="tag">${escapeHTML(item.status||"")}</span>${detail("Type",item.type)}${detail("History",item.history)}${detail("Important Moments",item.moments)}${detail("Arc / Future Changes",item.arc)}${detail(`${nameA}'s View`,item.aView)}${detail(`${nameB}'s View`,item.bView)}`,()=>deleteItem("relationships",item.id)))})}
function renderSceneDatabase(){const el=document.getElementById("sceneList"); if(!el)return; const scenes=(activeBook()?.manuscript||[]).flatMap(ch=>(ch.scenes||[]).map(sc=>({...sc,chapterId:ch.id,chapterTitle:ch.title}))); el.innerHTML=scenes.length?scenes.map(sc=>`<article class="item-card clickable-card" onclick="setView('write','${sc.chapterId}','${sc.id}')"><div class="card-header"><h3>${escapeHTML(sc.title)}</h3><button type="button" onclick="event.stopPropagation(); setView('write','${sc.chapterId}','${sc.id}')">Open Scene</button></div><div class="card-body"><span class="tag">${escapeHTML(sc.chapterTitle)}</span>${detail("POV",characterName(sc.pov))}${detail("Location",locationName(sc.locationId))}${detail("Date",sc.date)}${detail("Mood",sc.mood)}${detail("Purpose",sc.purpose)}<p><strong>Words:</strong> ${countWords(stripHTML(sc.content||""))}</p>${sceneAppearancesHTML(sc)}</div></article>`).join(""):"<p>No scenes yet.</p>"}
function renderTimeline(){const tl=document.getElementById("timelineList"); if(!tl)return; tl.innerHTML=""; data.timeline.filter(seriesScope).forEach(item=>{const div=document.createElement("article"); div.className="item-card timeline-item"; div.innerHTML=`<div class="card-header"><h3>${escapeHTML(item.when||"Unplaced Event")}</h3><button class="delete-btn">Delete</button></div><div class="card-body"><span class="tag">${escapeHTML(item.scope)}</span>${detail("Event",item.event)}${detail("Impact",item.impact)}</div>`; div.querySelector("button").onclick=()=>deleteItem("timeline",item.id); tl.appendChild(div)})}
function renderWritingStats(){const book=activeBook(); const chapters=book?.manuscript||[]; const counts=chapters.map(c=>(c.scenes||[]).reduce((sum,s)=>sum+countWords(stripHTML(s.content||"")),0)); const total=counts.reduce((a,b)=>a+b,0); const avg=counts.length?Math.round(total/counts.length):0; const longest=counts.length?Math.max(...counts):0; const bibleItems=["characters","threads","timeline","world","relationships","locations","magicSystems","organizations","mysteries","foreshadowing","plotArcs","plotCards"].reduce((sum,k)=>sum+(data[k]||[]).filter(k==="magicSystems"||k==="organizations"||k==="mysteries"||k==="foreshadowing"?seriesScope:visibleByScope).length,0); setText("statsTotalWords",total); setText("statsAvgWords",avg); setText("statsLongestChapter",longest); setText("statsBibleItems",bibleItems); setHTML("chapterStatsList",chapters.map((c,i)=>`<div class="chapter-stat-row"><span>${i+1}. ${escapeHTML(c.title||"Untitled")}</span><strong>${counts[i]} words</strong></div>`).join("")||"<p>No chapters yet.</p>"); const povCounts={}; chapters.flatMap(c=>c.scenes||[]).forEach(s=>{if(s.pov)povCounts[characterName(s.pov)]=(povCounts[characterName(s.pov)]||0)+countWords(stripHTML(s.content||""))}); setHTML("povStatsList",Object.entries(povCounts).map(([name,count])=>`<div class="chapter-stat-row"><span>${escapeHTML(name)}</span><strong>${count} words</strong></div>`).join("")||"<p>No POV data yet. Choose POV characters on scenes.</p>")}
function renderSeriesTools(){const warn=document.getElementById("seriesOnlyWarning"), content=document.getElementById("seriesToolsContent"); if(!warn||!content)return; if(!isSeriesProject()){warn.innerHTML="Series-level tools only appear for projects marked as Series."; content.classList.add("hidden"); return} warn.innerHTML=""; content.classList.remove("hidden"); const books=data.books.filter(b=>b.seriesId===data.activeSeriesId); const seriesWords=books.reduce((sum,b)=>sum+(b.manuscript||[]).flatMap(c=>c.scenes||[]).reduce((s,sc)=>s+countWords(stripHTML(sc.content||"")),0),0); setText("seriesBookCount",books.length); setText("seriesTotalWords",seriesWords); setText("seriesTimelineCount",data.timeline.filter(seriesScope).length); setText("seriesThreadCount",data.threads.filter(seriesScope).length); setHTML("crossBookArcs",data.characters.filter(seriesScope).map(c=>`<p><strong>${escapeHTML(c.name)}</strong><br>${escapeHTML(c.arc||"No arc notes yet.")}</p>`).join("")||"<p>No characters yet.</p>"); setHTML("seriesContinuity",`<p><strong>Characters:</strong> ${data.characters.filter(seriesScope).length}</p><p><strong>Relationships:</strong> ${data.relationships.filter(seriesScope).length}</p><p><strong>Locations:</strong> ${data.locations.filter(seriesScope).length}</p><p><strong>Artifacts / World Notes:</strong> ${data.world.filter(seriesScope).length}</p><p><strong>Major Events:</strong> ${data.timeline.filter(seriesScope).length}</p>`)}
function renderRawData(){const raw=document.getElementById("rawData"); if(raw)raw.value=JSON.stringify(data,null,2)}
function renderAll(){if(!data.user?.id){updateAuthGate();return} ensureProject(); if(!data.activeSeriesId||!data.activeBookId){updateAuthGate();return} applyTheme(); renderProjectDashboard(); renderOverview(); renderSelects(); renderManuscript(); renderAllLists(); renderMusic(); renderRawData(); renderAccount(); renderNestedNav(); addBulletButtons(); runSearch()}

function searchableItems(){const b=activeBook(); const manuscript=(b?.manuscript||[]).flatMap(ch=>(ch.scenes||[]).map(sc=>({type:"Scene",title:`${ch.title} — ${sc.title}`,text:(ch.title+" "+sc.title+" "+stripHTML(sc.content||"")).toLowerCase()}))); const collections=[["Character",data.characters,"name"],["Relationship",data.relationships,"type"],["Timeline",data.timeline,"when"],["Chapter Plan",data.chapterPlans,"number"],["Plot Thread",data.threads,"title"],["Worldbuilding",data.world,"name"],["Location",data.locations,"name"],["Magic",data.magicSystems,"name"],["Organization",data.organizations,"name"],["Mystery",data.mysteries,"question"],["Foreshadowing",data.foreshadowing,"hint"]]; return[{type:"Project",title:activeSeries()?.title,text:JSON.stringify(activeSeries()||{}).toLowerCase()},{type:"Book",title:b?.title,text:JSON.stringify(b||{}).toLowerCase()},...manuscript,...collections.flatMap(([type,arr,key])=>(arr||[]).filter(seriesScope).map(item=>({type,title:item[key]||"Untitled",text:JSON.stringify(item).toLowerCase()})))]}
function runSearch(){const search=document.getElementById("globalSearch"), box=document.getElementById("searchResults"); if(!search||!box)return; const q=search.value.trim().toLowerCase(); if(!q){box.classList.add("hidden"); box.innerHTML=""; return} const matches=searchableItems().filter(item=>item.text.includes(q)); box.classList.remove("hidden"); box.innerHTML=`<h3>Search Results</h3>`+(matches.length?matches.map(m=>`<p><strong>${escapeHTML(m.type)}:</strong> ${escapeHTML(m.title||"Untitled")}</p>`).join(""):"<p>No matches found.</p>")}

function manuscriptHTML(){return (activeBook()?.manuscript||[]).map(ch=>`<h2>${escapeHTML(ch.title||"Untitled")}</h2>${(ch.scenes||[]).map(sc=>`<h3>${escapeHTML(sc.title||"Scene")}</h3>${sc.content||""}`).join("")}`).join("<div style='page-break-after: always;'></div>")}
function seriesBibleHTML(){return `<h1>${escapeHTML(activeSeries()?.title||"Project Bible")}</h1><h2>Project</h2><p>${escapeHTML(activeSeries()?.synopsis||"")}</p><h2>Characters</h2>${data.characters.filter(seriesScope).map(c=>`<h3>${escapeHTML(c.name)}</h3><p>${escapeHTML(c.bio||c.description||"")}</p>`).join("")}<h2>Locations</h2>${data.locations.filter(seriesScope).map(l=>`<h3>${escapeHTML(l.name)}</h3><p>${escapeHTML(l.description||"")}</p>`).join("")}<h2>Magic</h2>${data.magicSystems.filter(seriesScope).map(m=>`<h3>${escapeHTML(m.name)}</h3><p>${escapeHTML(m.rules||"")}</p>`).join("")}<h2>Organizations</h2>${data.organizations.filter(seriesScope).map(o=>`<h3>${escapeHTML(o.name)}</h3><p>${escapeHTML(o.description||"")}</p>`).join("")}<h2>Timeline</h2>${data.timeline.filter(seriesScope).map(t=>`<p><strong>${escapeHTML(t.when||"")}</strong>: ${escapeHTML(t.event||"")}</p>`).join("")}<h2>Project Playlist</h2><p>${escapeHTML((normalizeMusicRecord(data.music?.[data.activeSeriesId]||{}).tracks||[]).length)} uploaded track(s)</p><p>${escapeHTML((data.music?.[data.activeSeriesId]?.notes)||"")}</p>`}
function buildHTMLDoc(title,bodyHTML){return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(title)}</title><style>body{font-family:Georgia,serif;line-height:1.6;font-size:12pt}h1{text-align:center}h2{margin-top:32px}</style></head><body><h1>${escapeHTML(title)}</h1>${bodyHTML}</body></html>`}
function exportFullManuscriptTxt(){const book=activeBook(); if(!book)return alert("No book selected."); const text=(book.manuscript||[]).map(ch=>`${ch.title}\n\n${(ch.scenes||[]).map(sc=>`${sc.title}\n${stripHTML(sc.content||"")}`).join("\n\n")}`).join("\n\n\n"); downloadFile(`${safeFile(book.title)}-full-manuscript.txt`,text,"text/plain")}
function exportFullManuscriptDocx(){const book=activeBook(); if(!book)return alert("No book selected."); downloadFile(`${safeFile(book.title)}-full-manuscript.docx`,buildHTMLDoc(book.title||"Manuscript",manuscriptHTML()),"application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
function exportSeriesBibleDocx(){const s=activeSeries(); if(!s)return alert("No project selected."); downloadFile(`${safeFile(s.title)}-project-bible.docx`,buildHTMLDoc(`${s.title} Project Bible`,seriesBibleHTML()),"application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
function exportFullManuscriptPDF(){const book=activeBook(); if(!book)return alert("No book selected."); printHTML(buildHTMLDoc(book.title||"Manuscript",manuscriptHTML()))}
function exportSeriesBiblePDF(){const s=activeSeries(); if(!s)return alert("No project selected."); printHTML(buildHTMLDoc(`${s.title} Project Bible`,seriesBibleHTML()))}
function printHTML(html){document.getElementById("printArea").innerHTML=html; window.print()}
function exportData(){downloadFile("plotpals-backup.json",JSON.stringify(data,null,2),"application/json")}
function downloadFile(filename,content,type){const blob=new Blob([content],{type}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href)}
function safeFile(name){return(name||"manuscript").replace(/[^\w\d-]+/g,"-")}
function importData(event){const file=event.target.files[0]; if(!file)return; const reader=new FileReader(); reader.onload=()=>{try{const currentUser=data.user; data={...structuredClone(defaultData),...JSON.parse(reader.result),user:currentUser}; saveData(); alert("Backup imported.")}catch{alert("Could not import this file.")}}; reader.readAsText(file)}
function resetAll(){if(!confirm("Delete all local writing data from this browser? This does not delete cloud data."))return; const currentUser=data.user; data={...structuredClone(defaultData),user:currentUser}; saveData(true,false)}

["seriesTitleEdit","seriesTypeEdit","seriesGenreEdit","seriesSynopsisEdit","seriesThemeEdit","seriesMysteriesEdit","seriesForeshadowingEdit","bookTitleEdit","bookStatusEdit","bookSummaryEdit","bookThemeEdit","bookNotesEdit"].forEach(id=>{document.getElementById(id).addEventListener("input",()=>saveOverviewFields(true))});
["currentChapterTitle","currentSceneTitle","scenePOV","sceneLocation","sceneDate","sceneMood","scenePurpose"].forEach(id=>{document.getElementById(id).addEventListener("input",()=>saveCurrentScene(true))});
document.getElementById("richEditor").addEventListener("input",()=>saveCurrentScene(false));
document.getElementById("scenePlotPoint")?.addEventListener("change",saveScenePlotPoint);
document.getElementById("richEditor").addEventListener("blur",()=>syncToCloud(false));
document.getElementById("globalSearch").addEventListener("input",runSearch);
document.getElementById("clearSearch").addEventListener("click",()=>{setVal("globalSearch","");runSearch()});

if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",startBulletButtonObserver)}else{startBulletButtonObserver()}
initSupabase();
refreshSession().then(()=>{if(data.user?.id){loadFromCloud(false).then(()=>{data.activeSeriesId=null;data.activeBookId=null;updateAuthGate()})}else updateAuthGate()});
