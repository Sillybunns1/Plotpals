const STORAGE_KEY = "plotpals";
const CLOUD_TABLE = "writer_vaults";

const defaultData = {
  activeSeriesId: null, activeBookId: null, activeChapterId: null, activeSceneId: null, selectedCharacterId: null,
  user: null, series: [], books: [], characters: [], relationships: [], timeline: [], chapterPlans: [], threads: [],
  scenes: [], world: [], locations: [], magicSystems: [], organizations: [], mysteries: [], foreshadowing: [], plotCards: [],
  structureBeats: [], plotArcs: [], mediaLibrary: [], music: {}, theme: 'dark', pinnedNote: '', libraryView: 'all', lastOpened: null, authorSettings: {}, sprint: {}, goals: {}, writingSessions: [], research: [], maps: [], snapshots: [], music: {}, theme: 'dark', pinnedNote: '', libraryView: 'all', lastOpened: null, authorSettings: {}, sprint: {}, goals: {}, writingSessions: [], research: [], maps: [], snapshots: []
};

let supabaseClient = null;
let data = loadData();
let cloudSaveTimer = null;
let authMode = "login";
let isRendering = false;

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
function applyTheme(){
  document.body.classList.toggle("light-mode", data.theme === "light");
}
function clearFields(ids){ids.forEach(id=>setVal(id,""))}
function escapeHTML(str=""){return String(str).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function stripHTML(html=""){const div=document.createElement("div"); div.innerHTML=html; return div.textContent||div.innerText||""}
function detail(label,value){if(!value)return""; return `<p><strong>${escapeHTML(label)}:</strong> ${escapeHTML(value).replaceAll("\n","<br>")}</p>`}
function countWords(text=""){return (text.trim().match(/\b[\w’'-]+\b/g)||[]).length}
function activeSeries(){return data.series.find(s=>s.id===data.activeSeriesId)||null}
function activeBook(){return data.books.find(b=>b.id===data.activeBookId)||null}
function activeChapter(){const b=activeBook(); return (b?.manuscript||[]).find(c=>c.id===data.activeChapterId)||null}
function activeScene(){const ch=activeChapter(); return (ch?.scenes||[]).find(s=>s.id===data.activeSceneId)||null}
function isSeriesProject(){return (activeSeries()?.type||"series")==="series"}
function ensureCollections(){["series","books","characters","relationships","timeline","chapterPlans","threads","scenes","world","locations","magicSystems","organizations","mysteries","foreshadowing","plotCards","structureBeats","writingSessions","research","maps","snapshots"].forEach(k=>{if(!data[k])data[k]=[]}); if(!data.music)data.music={}; if(!data.theme)data.theme="dark"; if(!data.goals)data.goals={}; if(!data.music)data.music={}; if(!data.authorSettings)data.authorSettings={}; if(!data.sprint)data.sprint={}; }
function ensureProject(){ensureCollections(); const b=activeBook(); if(b){if(!b.manuscript)b.manuscript=[]; if(!b.manuscript.length){const scene={id:uid(),title:"Scene 1",content:"",pov:"",locationId:"",date:"",mood:"",purpose:"",created:new Date().toISOString()}; const ch={id:uid(),title:"Chapter One",scenes:[scene],created:new Date().toISOString()}; b.manuscript.push(ch); data.activeChapterId=ch.id; data.activeSceneId=scene.id} b.manuscript.forEach(ch=>{if(!ch.scenes){ch.scenes=[{id:uid(),title:ch.title||"Scene 1",content:ch.content||"",pov:"",locationId:"",date:"",mood:"",purpose:"",created:ch.created||new Date().toISOString()}]; delete ch.content}}); if(!data.activeChapterId)data.activeChapterId=b.manuscript[0]?.id||null; if(!data.activeSceneId)data.activeSceneId=activeChapter()?.scenes?.[0]?.id||null}}

function switchAuthMode(mode){authMode=mode;document.getElementById("loginTab").classList.toggle("active",mode==="login");document.getElementById("signupTab").classList.toggle("active",mode==="signup");document.getElementById("authSubmitBtn").textContent=mode==="login"?"Login":"Create Account";setLoginMessage("")}
async function submitAuth(){return authMode==="login"?signIn():signUp()}
function setLoginMessage(message){const el=document.getElementById("loginMessage"); if(el)el.textContent=message||""}
function setProjectMessage(message){
  const el=document.getElementById("projectMessage");
  if(el)el.textContent=message||"";
  const el2=document.getElementById("createProjectMessage");
  if(el2)el2.textContent=message||"";
}
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
function firstProjectBook(){
  const firstSeries = data.series?.[0];
  if(!firstSeries) return null;
  const firstBook = data.books.find(b => b.seriesId === firstSeries.id);
  if(!firstBook) return null;
  return { series:firstSeries, book:firstBook };
}
function quickOpenFirstProject(){
  const item = firstProjectBook();
  if(!item) { showCreateProjectPanel(); return; }
  data.activeSeriesId = item.series.id;
  data.activeBookId = item.book.id;
  const firstChapter = item.book.manuscript?.[0];
  data.activeChapterId = firstChapter?.id || null;
  data.activeSceneId = firstChapter?.scenes?.[0]?.id || null;
  saveData();
  updateAuthGate();
}
function projectWordCount(book){
  return (book?.manuscript || []).flatMap(ch => ch.scenes || []).reduce((sum, sc) => sum + countWords(stripHTML(sc.content || "")), 0);
}
function projectSceneCount(book){
  return (book?.manuscript || []).flatMap(ch => ch.scenes || []).length;
}
function openProjectFromDashboard(seriesId, bookId){
  if(!bookId){ setProjectMessage("This project has no books yet. Create a book first."); showCreateProjectPanel(); return; }
  data.activeSeriesId = seriesId;
  data.activeBookId = bookId;
  const book = activeBook();
  const firstChapter = book?.manuscript?.[0];
  data.activeChapterId = firstChapter?.id || null;
  data.activeSceneId = firstChapter?.scenes?.[0]?.id || null;
  saveData();
  updateAuthGate();
}
function renderProjectScreen(){
  ensureCollections();
  applyTheme();

  const name = data.user?.email ? data.user.email.split("@")[0] : "Writer";
  setText("dashboardName", name.charAt(0).toUpperCase() + name.slice(1));

  const projectOptions = data.series.length
    ? data.series.map(s=>`<option value="${s.id}">${escapeHTML(s.title)} (${s.type==="standalone"?"Standalone":"Series"})</option>`).join("")
    : `<option value="">No projects yet</option>`;
  setHTML("projectSeriesSelect", projectOptions);
  setHTML("newBookSeriesSelect", projectOptions);
  projectSeriesChanged();

  const q = (val("projectSearch") || "").toLowerCase();
  const projects = data.series.filter(s => !q || JSON.stringify(s).toLowerCase().includes(q) || data.books.some(b => b.seriesId === s.id && b.title.toLowerCase().includes(q)));

  const cards = projects.map((s, index) => {
    const books = data.books.filter(b => b.seriesId === s.id);
    const primaryBook = books[0];
    const words = books.reduce((sum, b) => sum + projectWordCount(b), 0);
    const scenes = books.reduce((sum, b) => sum + projectSceneCount(b), 0);
    const progress = Math.min(100, Math.round(words / 50000 * 100));
    const status = primaryBook?.status || (s.type === "standalone" ? "Planning" : `${books.length} book${books.length === 1 ? "" : "s"}`);
    return `<article class="story-card" onclick="openProjectFromDashboard('${s.id}','${primaryBook?.id || ""}')">
      <div class="story-card-art"></div>
      <div class="story-card-body">
        <h3>${escapeHTML(s.title)}</h3>
        <span class="tag">${escapeHTML(s.type === "standalone" ? "Standalone" : "Series")}</span>
        <p>${escapeHTML(status)}</p>
        <p>${books.length} book${books.length === 1 ? "" : "s"} · ${scenes} scenes</p>
        <div class="progress-bar"><span style="width:${progress}%"></span></div>
        <p>${words.toLocaleString()} words</p>
      </div>
    </article>`;
  }).join("");

  setHTML("dashboardStoryCards", cards + `<div class="add-story-card" onclick="showCreateProjectPanel()"><div><div style="font-size:3rem;">✒</div><strong>+ New Book<br>or Series</strong></div></div>`);

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

  const allBooks = data.books || [];
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

  const firstMusic = item?.series ? (data.music?.[item.series.id] || {}) : {};
  const musicLinks = [
    firstMusic.spotify ? `<a class="playlist-link" target="_blank" href="${escapeHTML(firstMusic.spotify)}">Spotify</a>` : "",
    firstMusic.apple ? `<a class="playlist-link" target="_blank" href="${escapeHTML(firstMusic.apple)}">Apple Music</a>` : "",
    firstMusic.youtube ? `<a class="playlist-link" target="_blank" href="${escapeHTML(firstMusic.youtube)}">YouTube Music</a>` : ""
  ].filter(Boolean).join("");
  setHTML("dashboardPlaylistPreview", musicLinks || "<p>No playlist linked yet. Add one inside a project.</p>");
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
  const project = data.series.find(s => s.id === seriesId);
  const name = project?.title || "this project";
  if(!confirm(`Delete "${name}" and all attached books/bible items? This cannot be undone locally.`)) return;
  const bookIds = data.books.filter(b => b.seriesId === seriesId).map(b => b.id);
  data.books = data.books.filter(b => b.seriesId !== seriesId);
  ["characters","relationships","timeline","chapterPlans","threads","scenes","world","locations","magicSystems","organizations","mysteries","foreshadowing","plotCards","structureBeats"].forEach(k => {
    data[k] = (data[k] || []).filter(item => item.seriesId !== seriesId && !bookIds.includes(item.bookId));
  });
  delete data.music[seriesId];
  data.series = data.series.filter(s => s.id !== seriesId);
  data.activeSeriesId = null;
  data.activeBookId = null;
  data.activeChapterId = null;
  data.activeSceneId = null;
  saveData(false);
  renderProjectScreen();
  setProjectMessage(`Deleted "${name}".`);
}
function musicForProject(){
  const id = data.activeSeriesId;
  if(!data.music) data.music = {};
  if(!data.music[id]) data.music[id] = { spotify:"", apple:"", youtube:"", notes:"" };
  return data.music[id];
}
function saveMusicLinks(){
  const music = musicForProject();
  music.spotify = val("musicSpotify");
  music.apple = val("musicApple");
  music.youtube = val("musicYoutube");
  music.notes = val("musicNotes");
  saveData();
  renderMusicEmbeds();
}
function renderMusic(){
  const music = musicForProject();
  setVal("musicSpotify", music.spotify);
  setVal("musicApple", music.apple);
  setVal("musicYoutube", music.youtube);
  setVal("musicNotes", music.notes);
  const links = [];
  if(music.spotify) links.push(`<a class="playlist-link" target="_blank" href="${escapeHTML(music.spotify)}">Spotify Playlist</a>`);
  if(music.apple) links.push(`<a class="playlist-link" target="_blank" href="${escapeHTML(music.apple)}">Apple Music Playlist</a>`);
  if(music.youtube) links.push(`<a class="playlist-link" target="_blank" href="${escapeHTML(music.youtube)}">YouTube Music Playlist</a>`);
  setHTML("musicLinks", `<article class="item-card theme-card"><div class="card-header"><h3>Linked Playlists</h3></div><div class="card-body">${links.join("") || "<p>No playlist links yet.</p>"}${detail("Notes", music.notes)}</div></article>`);
}

function projectSeriesChanged(){const seriesId=val("projectSeriesSelect"); const books=data.books.filter(b=>b.seriesId===seriesId); setHTML("projectBookSelect",books.length?books.map(b=>`<option value="${b.id}">${escapeHTML(b.title)}</option>`).join(""):`<option value="">No books in this project</option>`)}
function createSeriesFromProject(){const type=val("newProjectType")||"series"; const name=val("newSeriesTitle")|| (type==="series"?"Untitled Series":"Untitled Book Project"); const series={id:uid(),title:name,type,genre:"",synopsis:"",theme:"",mysteries:"",foreshadowing:"",created:new Date().toISOString()}; data.series.push(series); if(type==="standalone"){const scene={id:uid(),title:"Scene 1",content:"",pov:"",locationId:"",date:"",mood:"",purpose:"",created:new Date().toISOString()}; const book={id:uid(),seriesId:series.id,title:name,status:"Planning",summary:"",theme:"",notes:"",manuscript:[{id:uid(),title:"Chapter One",scenes:[scene],created:new Date().toISOString()}],created:new Date().toISOString()}; data.books.push(book)} setVal("newSeriesTitle",""); saveData(false); renderProjectScreen(); setProjectMessage(type==="standalone"?"Standalone book project created.":"Series created. Now create/select a book.")}
function createBookFromProject(){const seriesId=val("newBookSeriesSelect"); if(!seriesId)return setProjectMessage("Create or select a project first."); const name=val("newBookTitle")||"Untitled Book"; const scene={id:uid(),title:"Scene 1",content:"",pov:"",locationId:"",date:"",mood:"",purpose:"",created:new Date().toISOString()}; const book={id:uid(),seriesId,title:name,status:"Planning",summary:"",theme:"",notes:"",manuscript:[{id:uid(),title:"Chapter One",scenes:[scene],created:new Date().toISOString()}],created:new Date().toISOString()}; data.books.push(book); setVal("newBookTitle",""); saveData(false); renderProjectScreen(); setProjectMessage("Book created. Select it and open workspace.")}
function openWorkspace(){const seriesId=val("projectSeriesSelect"), bookId=val("projectBookSelect"); if(!seriesId||!bookId)return setProjectMessage("Select both a project and a book."); data.activeSeriesId=seriesId; data.activeBookId=bookId; const book=activeBook(); data.activeChapterId=book?.manuscript?.[0]?.id||null; data.activeSceneId=book?.manuscript?.[0]?.scenes?.[0]?.id||null; saveData(); updateAuthGate()}
function backToProjects(){saveCurrentScene(false,false); data.activeSeriesId=null; data.activeBookId=null; saveData(false,false); updateAuthGate()}

function scheduleCloudSave(){if(!data.user?.id||!supabaseClient)return; clearTimeout(cloudSaveTimer); cloudSaveTimer=setTimeout(()=>syncToCloud(false),1600)}
async function syncToCloud(showAlert=true){if(!supabaseClient){if(showAlert)alert("Supabase is not loaded.");return} const currentProject={seriesId:data.activeSeriesId,bookId:data.activeBookId,chapterId:data.activeChapterId,sceneId:data.activeSceneId}; await refreshSession(); data.activeSeriesId=currentProject.seriesId; data.activeBookId=currentProject.bookId; data.activeChapterId=currentProject.chapterId; data.activeSceneId=currentProject.sceneId; if(!data.user?.id){if(showAlert)alert("Login first.");return} const payload={user_id:data.user.id,user_email:data.user.email,vault_data:data,updated_at:new Date().toISOString()}; const {error}=await supabaseClient.from(CLOUD_TABLE).upsert(payload,{onConflict:"user_id"}); if(error){setText("syncStatus","Sync failed."); if(showAlert)alert("Cloud sync failed. Check Supabase table/RLS. "+error.message); return} setText("syncStatus","Synced "+new Date().toLocaleTimeString()); setText("autosaveStatus","Saved"); if(showAlert)alert("Synced to Supabase.")}
async function loadFromCloud(showAlert=true){if(!supabaseClient){if(showAlert)alert("Supabase is not loaded.");return} const session=await supabaseClient.auth.getSession(); const user=session.data?.session?.user; if(!user){if(showAlert)alert("Login first.");return} const {data:rows,error}=await supabaseClient.from(CLOUD_TABLE).select("vault_data, updated_at").eq("user_id",user.id).limit(1); if(error){if(showAlert)alert("Could not load cloud data. "+error.message);return} if(!rows||!rows.length||!rows[0].vault_data){data.user={id:user.id,email:user.email}; localStorage.setItem(STORAGE_KEY,JSON.stringify(data,null,2)); if(showAlert)alert("No cloud vault found yet."); return} data={...structuredClone(defaultData),...rows[0].vault_data,user:{id:user.id,email:user.email}}; ensureCollections(); localStorage.setItem(STORAGE_KEY,JSON.stringify(data,null,2)); if(showAlert){renderAll(); alert("Loaded from Supabase.")}}

function toggleSidebar(){document.getElementById("appShell").classList.toggle("collapsed")}
function setView(view,id=null,extra=null){saveCurrentScene(false,false); if(view==="write"){if(id)data.activeChapterId=id; if(extra)data.activeSceneId=extra; if(!data.activeSceneId)data.activeSceneId=activeChapter()?.scenes?.[0]?.id||null} if(view==="characterDetail"&&id)data.selectedCharacterId=id; document.querySelectorAll(".view").forEach(v=>v.classList.remove("active")); document.getElementById(view).classList.add("active"); const titles={overview:"Overview",write:"Scene-Based Writing",storyBoard:"Story Structure Board",chapters:"Chapter Planner",threads:"Plot Threads",mysteries:"Mystery Tracker",foreshadowing:"Foreshadowing Tracker",plotBoard:"Plot Board",characters:"Characters",characterDetail:"Character Detail",relationships:"Relationship System",locations:"Locations",magic:"Magic System",organizations:"Organizations",scenes:"Scene Database",timeline:"Timeline",world:"Worldbuilding Notes",seriesTools:"Series-Level Tools",music:"Project Playlist",stats:"Writing Analytics",exports:"Export",backup:"Backup",characterDashboard:"Character Dashboard",sceneCards:"Scene Cards",goals:"Writing Goals",covers:"Covers & Artwork",encyclopedia:"Encyclopedia",visualTimeline:"Visual Timeline",research:"Research Vault",maps:"Maps",versionHistory:"Version History",connections:"Connected Story Web",relationshipVisualizer:"Relationship Visualizer",threadTracker:"Plot Thread Tracker",arcTracker:"Character Arc Tracker",locationLinks:"Location Linking",smartSearch:"Smart Search",seriesContinuity:"Series Continuity",sprintMode:"Writing Sprint Mode",authorSettings:"Author Settings"}; setText("viewTitle",titles[view]||"Workspace"); renderAll()}
function renderNestedNav(){
  const nav=document.getElementById("nestedNav");
  if(!nav)return;
  const book=activeBook();
  const chapters=book?.manuscript||[];
  const plans=data.chapterPlans.filter(visibleByScope);
  const threads=data.threads.filter(visibleByScope);
  const mysteries=(data.mysteries||[]).filter(seriesScope);
  const foreshadowing=(data.foreshadowing||[]).filter(seriesScope);
  const plotCards=(data.plotCards||[]).filter(visibleByScope);
  const locations=(data.locations||[]).filter(visibleByScope);
  const orgs=(data.organizations||[]).filter(seriesScope);
  const magic=(data.magicSystems||[]).filter(seriesScope);
  const worldNotes=(data.world||[]).filter(visibleByScope);
  const timeline=(data.timeline||[]).filter(visibleByScope);
  const rels=(data.relationships||[]).filter(visibleByScope);
  const roles=["Main","Side","Love Interest","Antagonist","Mentor","Other"];
  const charsByRole=role=>data.characters.filter(c=>visibleByScope(c)&&(c.role||"Other")===role);
  const seriesOnly=isSeriesProject();

  nav.innerHTML=`
    <div class="${sectionClass('library')}">
      <button class="menu-heading" onclick="toggleMenuSection('library')">
        <span>Library</span><span>${sectionArrow('library')}</span>
      </button>
      <div class="menu-content">
        <button class="story-nav" onclick="backToProjects()">📖 My Stories</button>
        <button class="story-nav" onclick="setView('overview')">🏠 Project Overview</button>
        <button class="story-nav" onclick="setView('stats')">📈 Writing Stats</button>
        <button class="story-nav" onclick="setView('music')">♫ Project Playlist</button>
      </div>
    </div>

    <div class="${sectionClass('manuscript')}">
      <button class="menu-heading" onclick="toggleMenuSection('manuscript')">
        <span>Manuscript</span><span>${sectionArrow('manuscript')}</span>
      </button>
      <div class="menu-content">
        <button class="story-nav nav-parent" onclick="setView('write')">
          <span>📘 Manuscript Editor</span><span class="nav-count">${chapters.length}</span>
        </button>
        ${chapters.map((c,i)=>`
          <button class="story-nav nav-child" onclick="setView('write','${c.id}')">
            <span>${i+1}. ${escapeHTML(c.title||"Untitled")}</span><span class="nav-count">${(c.scenes||[]).length}</span>
          </button>
          ${(c.scenes||[]).map((s,j)=>`
            <button class="story-nav nav-grandchild" onclick="setView('write','${c.id}','${s.id}')">
              ${j+1}. ${escapeHTML(s.title||"Scene")}
            </button>
          `).join("")}
        `).join("")}
      </div>
    </div>

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
          <span>👥 All Characters</span><span class="nav-count">${data.characters.filter(visibleByScope).length}</span>
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
        <button class="story-nav nav-parent" onclick="setView('locations')">
          <span>📍 Locations</span><span class="nav-count">${locations.length}</span>
        </button>
        ${locations.map(l=>`
          <button class="story-nav nav-grandchild" onclick="setView('locations')">${escapeHTML(l.name||"Location")}</button>
        `).join("")}

        <button class="story-nav nav-parent" onclick="setView('organizations')">
          <span>⚜️ Organizations</span><span class="nav-count">${orgs.length}</span>
        </button>
        ${orgs.map(o=>`
          <button class="story-nav nav-grandchild" onclick="setView('organizations')">${escapeHTML(o.name||"Organization")}</button>
        `).join("")}

        <button class="story-nav nav-parent" onclick="setView('magic')">
          <span>✨ Magic / Systems</span><span class="nav-count">${magic.length}</span>
        </button>
        ${magic.map(m=>`
          <button class="story-nav nav-grandchild" onclick="setView('magic')">${escapeHTML(m.name||"Magic System")}</button>
        `).join("")}

        <button class="story-nav nav-parent" onclick="setView('world')">
          <span>🏺 Items / Artifacts</span><span class="nav-count">${worldNotes.length}</span>
        </button>
        ${worldNotes.map(w=>`
          <button class="story-nav nav-grandchild" onclick="setView('world')">${escapeHTML(w.name||"World Note")}</button>
        `).join("")}

        <button class="story-nav nav-parent" onclick="setView('scenes')">🎬 Scene Database</button>

        <button class="story-nav nav-parent" onclick="setView('timeline')">
          <span>⏳ Timeline</span><span class="nav-count">${timeline.length}</span>
        </button>
        ${timeline.map(t=>`
          <button class="story-nav nav-grandchild" onclick="setView('timeline')">${escapeHTML(t.when||"Timeline Event")}</button>
        `).join("")}
      </div>
    </div>

    ${seriesOnly?`
      <div class="${sectionClass('series')}">
        <button class="menu-heading" onclick="toggleMenuSection('series')">
          <span>Series</span><span>${sectionArrow('series')}</span>
        </button>
        <div class="menu-content">
          <button class="story-nav nav-parent" onclick="setView('seriesTools')">★ Series-Level Tools</button>
        </div>
      </div>
    `:""}

    <div class="${sectionClass('storynotes')}">
      <button class="menu-heading" onclick="toggleMenuSection('storynotes')">
        <span>Story Notes</span><span>${sectionArrow('storynotes')}</span>
      </button>
      <div class="menu-content">
        <button class="story-nav nav-parent" onclick="setView('characterDashboard')">👤 Character Dashboard</button>
      <button class="story-nav nav-parent" onclick="setView('sceneCards')">🎴 Scene Cards</button>
      <button class="story-nav nav-parent" onclick="setView('goals')">🎯 Writing Goals</button>
      <button class="story-nav nav-parent" onclick="setView('covers')">🖼️ Covers & Artwork</button>
      <button class="story-nav nav-parent" onclick="setView('encyclopedia')">📚 Encyclopedia</button>
      <button class="story-nav nav-parent" onclick="setView('visualTimeline')">🧭 Visual Timeline</button>
      <button class="story-nav nav-parent" onclick="setView('research')">🔖 Research Vault</button>
      <button class="story-nav nav-parent" onclick="setView('maps')">🗺️ Maps</button>
      <button class="story-nav nav-parent" onclick="setView('versionHistory')">🕰️ Version History</button>
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

function addManuscriptChapter(){const book=activeBook(); if(!book)return alert("Open a book first."); saveCurrentScene(false,false); const scene={id:uid(),title:"Scene 1",content:"",pov:"",locationId:"",date:"",mood:"",purpose:"",created:new Date().toISOString()}; const ch={id:uid(),title:`Chapter ${(book.manuscript||[]).length+1}`,scenes:[scene],created:new Date().toISOString()}; book.manuscript.push(ch); data.activeChapterId=ch.id; data.activeSceneId=scene.id; saveData()}
function addSceneToActiveChapter(){const ch=activeChapter(); if(!ch)return alert("Select a chapter first."); saveCurrentScene(false,false); if(!ch.scenes)ch.scenes=[]; const scene={id:uid(),title:`Scene ${ch.scenes.length+1}`,content:"",pov:"",locationId:"",date:"",mood:"",purpose:"",created:new Date().toISOString()}; ch.scenes.push(scene); data.activeSceneId=scene.id; saveData()}
function selectScene(chapterId,sceneId){setView("write",chapterId,sceneId)}
function saveCurrentScene(render=false,scheduleCloud=true){if(isRendering)return; const scene=activeScene(); const ch=activeChapter(); const editor=document.getElementById("richEditor"); if(!scene||!ch||!editor)return; ch.title=val("currentChapterTitle")||ch.title; scene.title=val("currentSceneTitle")||scene.title; scene.pov=val("scenePOV"); scene.locationId=val("sceneLocation"); scene.date=val("sceneDate"); scene.mood=val("sceneMood"); scene.purpose=val("scenePurpose"); scene.content=editor.innerHTML; scene.charactersPresent = Array.from(document.querySelectorAll("#sceneCharactersPresent input:checked")).map(i=>i.value); scene.plotThreads = Array.from(document.querySelectorAll("#sceneThreadsPresent input:checked")).map(i=>i.value); setText("autosaveStatus","Saving..."); if(scheduleCloud) createAutoSnapshot("Auto save"); saveData(render,scheduleCloud); updateEditorStats(); renderSceneLinkControls()}
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
function characterRelationships(characterId){return data.relationships.filter(r=>visibleByScope(r)&&(r.a===characterId||r.b===characterId))}
function characterAppearances(characterId){const rows=[];(activeBook()?.manuscript||[]).forEach(ch=>(ch.scenes||[]).forEach(sc=>{const text=stripHTML(sc.content||"").toLowerCase(); const name=(data.characters.find(c=>c.id===characterId)?.name||"").toLowerCase(); if(sc.pov===characterId||text.includes(name))rows.push(`${ch.title} — ${sc.title}${sc.pov===characterId?" (POV)":""}`)})); return rows}

function addChapterPlan(){data.chapterPlans.push({id:uid(),...scopedItem("book"),number:val("chapterNumber"),pov:val("chapterPOV"),wordTarget:val("chapterWordTarget"),structureBeat:val("chapterStructureBeat"),goal:val("chapterGoal"),conflict:val("chapterConflict"),outcome:val("chapterOutcome"),emotion:val("chapterEmotion"),foreshadowing:val("chapterForeshadowing"),created:new Date().toISOString()}); clearFields(["chapterNumber","chapterPOV","chapterWordTarget","chapterGoal","chapterConflict","chapterOutcome","chapterEmotion","chapterForeshadowing"]); saveData()}
function addThread(){data.threads.push({id:uid(),...scopedItem(val("threadScope")),title:val("threadTitle"),status:val("threadStatus"),setup:val("threadSetup"),payoff:val("threadPayoff"),created:new Date().toISOString()}); clearFields(["threadTitle","threadSetup","threadPayoff"]); saveData()}
function addMystery(){data.mysteries.push({id:uid(),...scopedItem("series"),question:val("mysteryQuestion"),introduced:val("mysteryIntroduced"),payoff:val("mysteryPayoff"),status:val("mysteryStatus"),hints:val("mysteryHints"),answer:val("mysteryAnswer"),created:new Date().toISOString()}); clearFields(["mysteryQuestion","mysteryIntroduced","mysteryPayoff","mysteryHints","mysteryAnswer"]); saveData()}
function addForeshadowing(){data.foreshadowing.push({id:uid(),...scopedItem("series"),hint:val("foreshadowHint"),appears:val("foreshadowAppears"),payoff:val("foreshadowPayoff"),status:val("foreshadowStatus"),notes:val("foreshadowNotes"),created:new Date().toISOString()}); clearFields(["foreshadowHint","foreshadowAppears","foreshadowPayoff","foreshadowNotes"]); saveData()}
function addPlotCard(){data.plotCards.push({id:uid(),...scopedItem("book"),title:val("plotCardTitle"),status:val("plotCardStatus"),notes:val("plotCardNotes"),created:new Date().toISOString()}); clearFields(["plotCardTitle","plotCardNotes"]); saveData()}
function addCharacter(){const file=document.getElementById("charPhoto").files[0]; const finish=photo=>{data.characters.push({id:uid(),...scopedItem(val("charScope")),name:val("charName"),role:val("charRole"),species:val("charSpecies"),photo,description:val("charDescription"),personality:val("charPersonality"),wound:val("charWound"),arc:val("charArc"),voice:val("charVoice"),bio:val("charBio"),secrets:val("charSecrets"),quotes:val("charQuotes"),created:new Date().toISOString()}); clearFields(["charName","charSpecies","charDescription","charPersonality","charWound","charArc","charVoice","charBio","charSecrets","charQuotes"]); document.getElementById("charPhoto").value=""; saveData()}; if(!file)return finish(""); const reader=new FileReader(); reader.onload=()=>finish(reader.result); reader.readAsDataURL(file)}
function addRelationship(){data.relationships.push({id:uid(),...scopedItem(val("relScope")),a:val("relA"),b:val("relB"),type:val("relType"),status:val("relStatus"),history:val("relHistory"),moments:val("relMoments"),arc:val("relArc"),created:new Date().toISOString()}); clearFields(["relType","relStatus","relHistory","relMoments","relArc"]); saveData()}
function addTimeline(){data.timeline.push({id:uid(),...scopedItem(val("timeScope")),when:val("timeWhen"),event:val("timeEvent"),impact:val("timeImpact"),created:new Date().toISOString()}); clearFields(["timeWhen","timeEvent","timeImpact"]); saveData()}
function addWorld(){data.world.push({id:uid(),...scopedItem(val("worldScope")),name:val("worldName"),category:val("worldCategory"),description:val("worldDescription"),rules:val("worldRules"),created:new Date().toISOString()}); clearFields(["worldName","worldDescription","worldRules"]); saveData()}
function addLocation(){const file=document.getElementById("locationImage").files[0]; const finish=image=>{data.locations.push({id:uid(),...scopedItem(val("locationScope")),name:val("locationName"),population:val("locationPopulation"),culture:val("locationCulture"),image,description:val("locationDescription"),history:val("locationHistory"),notes:val("locationNotes"),created:new Date().toISOString()}); clearFields(["locationName","locationPopulation","locationCulture","locationDescription","locationHistory","locationNotes"]); document.getElementById("locationImage").value=""; saveData()}; if(!file)return finish(""); const reader=new FileReader(); reader.onload=()=>finish(reader.result); reader.readAsDataURL(file)}
function addMagic(){data.magicSystems.push({id:uid(),...scopedItem("series"),name:val("magicName"),source:val("magicSource"),rules:val("magicRules"),limits:val("magicLimits"),costs:val("magicCosts"),examples:val("magicExamples"),created:new Date().toISOString()}); clearFields(["magicName","magicSource","magicRules","magicLimits","magicCosts","magicExamples"]); saveData()}
function addOrganization(){data.organizations.push({id:uid(),...scopedItem("series"),name:val("orgName"),type:val("orgType"),description:val("orgDescription"),members:val("orgMembers"),history:val("orgHistory"),created:new Date().toISOString()}); clearFields(["orgName","orgType","orgDescription","orgMembers","orgHistory"]); saveData()}

function applyStructureTemplate(){const template=val("structureTemplate"); const maps={"Three Act Structure":["Act 1 — Setup","Act 2A — Rising Action","Midpoint","Act 2B — Fall / Pressure","Act 3 — Resolution"],"Save The Cat":["Opening Image","Theme Stated","Set-Up","Catalyst","Debate","Break Into Two","B Story","Fun and Games","Midpoint","Bad Guys Close In","All Is Lost","Dark Night of the Soul","Break Into Three","Finale","Final Image"],"Hero's Journey":["Ordinary World","Call to Adventure","Refusal","Mentor","Crossing Threshold","Tests / Allies / Enemies","Approach","Ordeal","Reward","Road Back","Resurrection","Return"],"Romance Beat Sheet":["Meet Cute","No Way","Adhesion","Why Them","Midpoint Bond","Retreat","Dark Moment","Grand Gesture","HEA / HFN"],"Custom":[]}; data.structureBeats=data.structureBeats.filter(b=>b.seriesId!==data.activeSeriesId||b.bookId!==data.activeBookId); (maps[template]||[]).forEach((name,i)=>data.structureBeats.push({id:uid(),...scopedItem("book"),name,notes:"",order:i,created:new Date().toISOString()})); saveData()}
function addStructureBeat(){data.structureBeats.push({id:uid(),...scopedItem("book"),name:val("structureBeatName")||"Untitled Beat",notes:val("structureBeatNotes"),order:data.structureBeats.filter(visibleByScope).length,created:new Date().toISOString()}); clearFields(["structureBeatName","structureBeatNotes"]); saveData()}

function makeCard(title,body,onDelete){const template=document.getElementById("cardTemplate"); const node=template.content.cloneNode(true); node.querySelector("h3").textContent=title||"Untitled"; node.querySelector(".card-body").innerHTML=body; node.querySelector(".delete-btn").onclick=onDelete; return node}
function deleteItem(collection,id){data[collection]=data[collection].filter(item=>item.id!==id); saveData()}

function renderOverview(){const s=activeSeries(), b=activeBook(); setVal("seriesTitleEdit",s?.title); setVal("seriesTypeEdit",s?.type||"series"); setVal("seriesGenreEdit",s?.genre); setVal("seriesSynopsisEdit",s?.synopsis); setVal("seriesThemeEdit",s?.theme); setVal("seriesMysteriesEdit",s?.mysteries); setVal("seriesForeshadowingEdit",s?.foreshadowing); setVal("bookTitleEdit",b?.title); setVal("bookStatusEdit",b?.status); setVal("bookSummaryEdit",b?.summary); setVal("bookThemeEdit",b?.theme); setVal("bookNotesEdit",b?.notes); const scenes=(b?.manuscript||[]).flatMap(c=>c.scenes||[]); const words=scenes.reduce((sum,s)=>sum+countWords(stripHTML(s.content||"")),0); setText("statWords",words); setText("statChapters",(b?.manuscript||[]).length); setText("statScenes",scenes.length); setText("statCharacters",data.characters.filter(visibleByScope).length); setText("projectPath",`${s?.title||"No project"} → ${b?.title||"No book selected"}`); setText("sidebarProjectName",b?.title||"Project")}
function saveOverviewFields(render=false){const s=activeSeries(), b=activeBook(); if(s){s.title=val("seriesTitleEdit"); s.type=val("seriesTypeEdit")||"series"; s.genre=val("seriesGenreEdit"); s.synopsis=val("seriesSynopsisEdit"); s.theme=val("seriesThemeEdit"); s.mysteries=val("seriesMysteriesEdit"); s.foreshadowing=val("seriesForeshadowingEdit")} if(b){b.title=val("bookTitleEdit"); b.status=val("bookStatusEdit"); b.summary=val("bookSummaryEdit"); b.theme=val("bookThemeEdit"); b.notes=val("bookNotesEdit")} saveData(render)}
function renderManuscript(){const book=activeBook(); const list=document.getElementById("manuscriptChapterList"); if(!list)return; list.innerHTML=""; (book?.manuscript||[]).forEach((ch,i)=>{const words=(ch.scenes||[]).reduce((sum,s)=>sum+countWords(stripHTML(s.content||"")),0); const wrap=document.createElement("div"); wrap.innerHTML=`<button class="chapter-button ${ch.id===data.activeChapterId?"active":""}" onclick="setView('write','${ch.id}')">${i+1}. ${escapeHTML(ch.title||"Untitled")}<br><small>${words} words</small></button>${(ch.scenes||[]).map((s,j)=>`<button class="scene-button ${s.id===data.activeSceneId?"active":""}" onclick="selectScene('${ch.id}','${s.id}')">${j+1}. ${escapeHTML(s.title||"Scene")}<br><small>${countWords(stripHTML(s.content||""))} words</small></button><button class="delete-btn" onclick="deleteScene('${ch.id}','${s.id}')">Delete Scene</button>`).join("")}<button class="delete-btn" onclick="deleteManuscriptChapter('${ch.id}')">Delete Chapter</button>`; list.appendChild(wrap)}); const ch=activeChapter(), scene=activeScene(); setVal("currentChapterTitle",ch?.title||""); setVal("currentSceneTitle",scene?.title||""); setVal("scenePOV",scene?.pov||""); setVal("sceneLocation",scene?.locationId||""); setVal("sceneDate",scene?.date||""); setVal("sceneMood",scene?.mood||""); setVal("scenePurpose",scene?.purpose||""); const editor=document.getElementById("richEditor"); if(editor){isRendering=true; editor.innerHTML=scene?.content||""; isRendering=false} updateEditorStats()}
function renderSelects(){const chars=data.characters.filter(visibleByScope); const charOptions=`<option value="">Select character</option>`+chars.map(c=>`<option value="${c.id}">${escapeHTML(c.name)}</option>`).join(""); ["scenePOV","relA","relB"].forEach(id=>setHTML(id,charOptions)); const locs=data.locations.filter(visibleByScope); setHTML("sceneLocation",`<option value="">Select location</option>`+locs.map(l=>`<option value="${l.id}">${escapeHTML(l.name)}</option>`).join("")); const beats=data.structureBeats.filter(visibleByScope); setHTML("chapterStructureBeat",`<option value="">Structure beat</option>`+beats.map(b=>`<option value="${b.id}">${escapeHTML(b.name)}</option>`).join(""))}
function renderCardList(collection,elId,titleKey,bodyFn,filter=visibleByScope){const el=document.getElementById(elId); if(!el)return; el.innerHTML=""; (data[collection]||[]).filter(filter).forEach(item=>el.appendChild(makeCard(item[titleKey],bodyFn(item),()=>deleteItem(collection,item.id))))}
function renderAllLists(){renderStoryBoard(); renderPlotBoard(); renderCharactersByRole(); renderCharacterDetail(); renderRelationships(); renderSeriesTools(); renderWritingStats();
renderCardList("chapterPlans","chapterPlanList","number",item=>`<span class="tag">Book</span>${detail("POV",item.pov)}${detail("Structure Beat",data.structureBeats.find(b=>b.id===item.structureBeat)?.name||"")}${detail("Target Words",item.wordTarget)}${detail("Goal",item.goal)}${detail("Conflict",item.conflict)}${detail("Outcome",item.outcome)}${detail("Emotional Beat",item.emotion)}${detail("Foreshadowing",item.foreshadowing)}`);
renderCardList("threads","threadList","title",item=>`<span class="tag">${escapeHTML(item.scope)}</span><span class="tag">${escapeHTML(item.status)}</span>${detail("Setup",item.setup)}${detail("Payoff",item.payoff)}`);
renderCardList("mysteries","mysteryList","question",item=>`<span class="tag">${escapeHTML(item.status)}</span>${detail("Introduced",item.introduced)}${detail("Hints / False Leads",item.hints)}${detail("Answer",item.answer)}${detail("Payoff",item.payoff)}`,seriesScope);
renderCardList("foreshadowing","foreshadowingList","hint",item=>`<span class="tag">${escapeHTML(item.status)}</span>${detail("Appears",item.appears)}${detail("Payoff",item.payoff)}${detail("Notes",item.notes)}`,seriesScope);
renderCardList("world","worldList","name",item=>`<span class="tag">${escapeHTML(item.category)}</span>${detail("Description",item.description)}${detail("Rules / Notes",item.rules)}`);
renderCardList("locations","locationList","name",item=>`${item.image?`<img class="location-photo" src="${item.image}">`:""}${detail("Population",item.population)}${detail("Culture",item.culture)}${detail("Description",item.description)}${detail("History",item.history)}${detail("Notes",item.notes)}`);
renderCardList("magicSystems","magicList","name",item=>`${detail("Source",item.source)}${detail("Rules",item.rules)}${detail("Limitations",item.limits)}${detail("Costs",item.costs)}${detail("Examples / Users",item.examples)}`,seriesScope);
renderCardList("organizations","organizationList","name",item=>`${detail("Type",item.type)}${detail("Description",item.description)}${detail("Members",item.members)}${detail("History",item.history)}`,seriesScope);
renderSceneDatabase(); renderTimeline();}
function renderStoryBoard(){const el=document.getElementById("storyBoardList"); if(!el)return; const beats=data.structureBeats.filter(visibleByScope).sort((a,b)=>(a.order||0)-(b.order||0)); const plans=data.chapterPlans.filter(visibleByScope); el.innerHTML=beats.length?beats.map(beat=>`<div class="board-column"><h3>${escapeHTML(beat.name)}</h3><p>${escapeHTML(beat.notes||"")}</p>${plans.filter(p=>p.structureBeat===beat.id).map(p=>`<div class="board-card">${escapeHTML(p.number||"Chapter")}<br><small>${escapeHTML(p.goal||"")}</small></div>`).join("")}<button class="delete-btn" onclick="deleteItem('structureBeats','${beat.id}')">Delete Beat</button></div>`).join(""):`<p class="muted">Apply a template or add a custom beat.</p>`}
function renderPlotBoard(){const el=document.getElementById("plotBoardList"); if(!el)return; const statuses=["Ideas","Planned","Drafting","Finished"]; el.innerHTML=statuses.map(status=>`<div class="board-column"><h3>${status}</h3>${data.plotCards.filter(visibleByScope).filter(c=>c.status===status).map(c=>`<div class="board-card"><strong>${escapeHTML(c.title)}</strong><p>${escapeHTML(c.notes||"")}</p><button class="delete-btn" onclick="deleteItem('plotCards','${c.id}')">Delete</button></div>`).join("")}</div>`).join("")}
function renderCharactersByRole(){const el=document.getElementById("characterRoleGroups"); if(!el)return; const roles=["Main","Side","Love Interest","Antagonist","Mentor","Other"]; el.innerHTML=roles.map(role=>{const chars=data.characters.filter(c=>visibleByScope(c)&&(c.role||"Other")===role); return `<div class="role-group"><h3>${role}</h3><div class="card-grid">${chars.length?chars.map(c=>`<article class="item-card"><div class="card-header"><h3>${escapeHTML(c.name)}</h3><button class="delete-btn" onclick="deleteItem('characters','${c.id}')">Delete</button></div>${c.photo?`<img class="character-photo" src="${c.photo}" alt="${escapeHTML(c.name)}">`:""}<div class="card-body"><span class="tag">${escapeHTML(c.species||"")}</span>${detail("Personality",c.personality)}${detail("Arc",c.arc)}<button onclick="setView('characterDetail','${c.id}')">Open Character</button></div></article>`).join(""):`<p class="muted">No ${role} characters yet.</p>`}</div></div>`}).join("")}
function renderCharacterDetail(){const el=document.getElementById("characterDetailContent"); if(!el)return; const c=data.characters.find(x=>x.id===data.selectedCharacterId); if(!c){el.innerHTML=`<div class="panel"><p>Select a character from the sidebar.</p></div>`;return} const rels=characterRelationships(c.id), apps=characterAppearances(c.id); el.innerHTML=`<div class="panel character-detail-grid"><div>${c.photo?`<img class="character-photo" src="${c.photo}" alt="${escapeHTML(c.name)}">`:`<div class="character-photo panel">No Photo</div>`}</div><div><h3>${escapeHTML(c.name)}</h3><span class="tag">${escapeHTML(c.role||"")}</span><span class="tag">${escapeHTML(c.species||"")}</span>${detail("Biography",c.bio)}${detail("Description",c.description)}${detail("Personality",c.personality)}${detail("Core Wound / Fear / Desire",c.wound)}${detail("Arc",c.arc)}${detail("Voice",c.voice)}${detail("Secrets",c.secrets)}${detail("Quotes",c.quotes)}<h3>Linked Relationships</h3>${rels.length?rels.map(r=>`<p><strong>${escapeHTML(characterName(r.a))} + ${escapeHTML(characterName(r.b))}:</strong> ${escapeHTML(r.type||"")} — ${escapeHTML(r.status||"")}<br>${escapeHTML(r.history||r.arc||"")}</p>`).join(""):"<p>No linked relationships yet.</p>"}<h3>Appearance Log</h3>${apps.length?apps.map(a=>`<p>${escapeHTML(a)}</p>`).join(""):"<p>No appearances detected yet.</p>"}</div></div>`}
function renderRelationships(){const map=document.getElementById("relationshipMap"), list=document.getElementById("relationshipList"); if(!map||!list)return; map.innerHTML=""; list.innerHTML=""; const rels=data.relationships.filter(visibleByScope); if(!rels.length)map.innerHTML="<p>No relationships yet.</p>"; rels.forEach(item=>{const node=document.createElement("div"); node.className="rel-node"; node.textContent=`${characterName(item.a)} ↔ ${characterName(item.b)} (${item.type||"connection"})`; map.appendChild(node); list.appendChild(makeCard(`${characterName(item.a)} + ${characterName(item.b)}`,`<span class="tag">${escapeHTML(item.status||"")}</span>${detail("Type",item.type)}${detail("History",item.history)}${detail("Important Moments",item.moments)}${detail("Arc / Future Changes",item.arc)}`,()=>deleteItem("relationships",item.id)))})}
function renderSceneDatabase(){const el=document.getElementById("sceneList"); if(!el)return; const scenes=(activeBook()?.manuscript||[]).flatMap(ch=>(ch.scenes||[]).map(sc=>({...sc,chapterTitle:ch.title}))); el.innerHTML=scenes.length?scenes.map(sc=>`<article class="item-card"><div class="card-header"><h3>${escapeHTML(sc.title)}</h3></div><div class="card-body"><span class="tag">${escapeHTML(sc.chapterTitle)}</span>${detail("POV",characterName(sc.pov))}${detail("Location",locationName(sc.locationId))}${detail("Date",sc.date)}${detail("Mood",sc.mood)}${detail("Purpose",sc.purpose)}<p><strong>Words:</strong> ${countWords(stripHTML(sc.content||""))}</p></div></article>`).join(""):"<p>No scenes yet.</p>"}
function renderTimeline(){const tl=document.getElementById("timelineList"); if(!tl)return; tl.innerHTML=""; data.timeline.filter(visibleByScope).forEach(item=>{const div=document.createElement("article"); div.className="item-card timeline-item"; div.innerHTML=`<div class="card-header"><h3>${escapeHTML(item.when||"Unplaced Event")}</h3><button class="delete-btn">Delete</button></div><div class="card-body"><span class="tag">${escapeHTML(item.scope)}</span>${detail("Event",item.event)}${detail("Impact",item.impact)}</div>`; div.querySelector("button").onclick=()=>deleteItem("timeline",item.id); tl.appendChild(div)})}
function renderWritingStats(){const book=activeBook(); const chapters=book?.manuscript||[]; const counts=chapters.map(c=>(c.scenes||[]).reduce((sum,s)=>sum+countWords(stripHTML(s.content||"")),0)); const total=counts.reduce((a,b)=>a+b,0); const avg=counts.length?Math.round(total/counts.length):0; const longest=counts.length?Math.max(...counts):0; const bibleItems=["characters","threads","timeline","world","relationships","locations","magicSystems","organizations","mysteries","foreshadowing","plotCards"].reduce((sum,k)=>sum+(data[k]||[]).filter(k==="magicSystems"||k==="organizations"||k==="mysteries"||k==="foreshadowing"?seriesScope:visibleByScope).length,0); setText("statsTotalWords",total); setText("statsAvgWords",avg); setText("statsLongestChapter",longest); setText("statsBibleItems",bibleItems); setHTML("chapterStatsList",chapters.map((c,i)=>`<div class="chapter-stat-row"><span>${i+1}. ${escapeHTML(c.title||"Untitled")}</span><strong>${counts[i]} words</strong></div>`).join("")||"<p>No chapters yet.</p>"); const povCounts={}; chapters.flatMap(c=>c.scenes||[]).forEach(s=>{if(s.pov)povCounts[characterName(s.pov)]=(povCounts[characterName(s.pov)]||0)+countWords(stripHTML(s.content||""))}); setHTML("povStatsList",Object.entries(povCounts).map(([name,count])=>`<div class="chapter-stat-row"><span>${escapeHTML(name)}</span><strong>${count} words</strong></div>`).join("")||"<p>No POV data yet. Choose POV characters on scenes.</p>")}
function renderSeriesTools(){const warn=document.getElementById("seriesOnlyWarning"), content=document.getElementById("seriesToolsContent"); if(!warn||!content)return; if(!isSeriesProject()){warn.innerHTML="Series-level tools only appear for projects marked as Series."; content.classList.add("hidden"); return} warn.innerHTML=""; content.classList.remove("hidden"); const books=data.books.filter(b=>b.seriesId===data.activeSeriesId); const seriesWords=books.reduce((sum,b)=>sum+(b.manuscript||[]).flatMap(c=>c.scenes||[]).reduce((s,sc)=>s+countWords(stripHTML(sc.content||"")),0),0); setText("seriesBookCount",books.length); setText("seriesTotalWords",seriesWords); setText("seriesTimelineCount",data.timeline.filter(seriesScope).length); setText("seriesThreadCount",data.threads.filter(seriesScope).length); setHTML("crossBookArcs",data.characters.filter(seriesScope).map(c=>`<p><strong>${escapeHTML(c.name)}</strong><br>${escapeHTML(c.arc||"No arc notes yet.")}</p>`).join("")||"<p>No characters yet.</p>"); setHTML("seriesContinuity",`<p><strong>Characters:</strong> ${data.characters.filter(seriesScope).length}</p><p><strong>Relationships:</strong> ${data.relationships.filter(seriesScope).length}</p><p><strong>Locations:</strong> ${data.locations.filter(seriesScope).length}</p><p><strong>Artifacts / World Notes:</strong> ${data.world.filter(seriesScope).length}</p><p><strong>Major Events:</strong> ${data.timeline.filter(seriesScope).length}</p>`)}
function renderRawData(){const raw=document.getElementById("rawData"); if(raw)raw.value=JSON.stringify(data,null,2)}
function renderAll(){if(!data.user?.id){updateAuthGate();return} ensureProject(); if(!data.activeSeriesId||!data.activeBookId){updateAuthGate();return} applyTheme(); renderOverview(); renderSelects(); renderManuscript(); renderAllLists(); renderMusic(); renderArtwork(); renderGoals(); renderSceneCards(); renderCharacterDashboard(); renderEncyclopedia(); renderVisualTimeline(); renderResearch(); renderMaps(); renderSnapshots(); renderConnectedStoryWeb(); renderRelationshipVisualizer(); renderThreadTracker(); renderArcTracker(); renderLocationLinks(); renderSmartSearch(); renderSeriesContinuityDashboard(); applyAuthorSettings(); renderMusicEmbeds(); renderRawData(); renderAccount(); renderNestedNavSafe(); runSearch(); ensureSidebarVisible(); initializeCollapsibleSidebar()}

function searchableItems(){const b=activeBook(); const manuscript=(b?.manuscript||[]).flatMap(ch=>(ch.scenes||[]).map(sc=>({type:"Scene",title:`${ch.title} — ${sc.title}`,text:(ch.title+" "+sc.title+" "+stripHTML(sc.content||"")).toLowerCase()}))); const collections=[["Character",data.characters,"name"],["Relationship",data.relationships,"type"],["Timeline",data.timeline,"when"],["Chapter Plan",data.chapterPlans,"number"],["Plot Thread",data.threads,"title"],["Worldbuilding",data.world,"name"],["Location",data.locations,"name"],["Magic",data.magicSystems,"name"],["Organization",data.organizations,"name"],["Mystery",data.mysteries,"question"],["Foreshadowing",data.foreshadowing,"hint"]]; return[{type:"Project",title:activeSeries()?.title,text:JSON.stringify(activeSeries()||{}).toLowerCase()},{type:"Book",title:b?.title,text:JSON.stringify(b||{}).toLowerCase()},...manuscript,...collections.flatMap(([type,arr,key])=>(arr||[]).filter(seriesScope).map(item=>({type,title:item[key]||"Untitled",text:JSON.stringify(item).toLowerCase()})))]}
function runSearch(){const search=document.getElementById("globalSearch"), box=document.getElementById("searchResults"); if(!search||!box)return; const q=search.value.trim().toLowerCase(); if(!q){box.classList.add("hidden"); box.innerHTML=""; return} const matches=searchableItems().filter(item=>item.text.includes(q)); box.classList.remove("hidden"); box.innerHTML=`<h3>Search Results</h3>`+(matches.length?matches.map(m=>`<p><strong>${escapeHTML(m.type)}:</strong> ${escapeHTML(m.title||"Untitled")}</p>`).join(""):"<p>No matches found.</p>")}

function manuscriptHTML(){return (activeBook()?.manuscript||[]).map(ch=>`<h2>${escapeHTML(ch.title||"Untitled")}</h2>${(ch.scenes||[]).map(sc=>`<h3>${escapeHTML(sc.title||"Scene")}</h3>${sc.content||""}`).join("")}`).join("<div style='page-break-after: always;'></div>")}
function seriesBibleHTML(){return `<h1>${escapeHTML(activeSeries()?.title||"Project Bible")}</h1><h2>Project</h2><p>${escapeHTML(activeSeries()?.synopsis||"")}</p><h2>Characters</h2>${data.characters.filter(seriesScope).map(c=>`<h3>${escapeHTML(c.name)}</h3><p>${escapeHTML(c.bio||c.description||"")}</p>`).join("")}<h2>Locations</h2>${data.locations.filter(seriesScope).map(l=>`<h3>${escapeHTML(l.name)}</h3><p>${escapeHTML(l.description||"")}</p>`).join("")}<h2>Magic</h2>${data.magicSystems.filter(seriesScope).map(m=>`<h3>${escapeHTML(m.name)}</h3><p>${escapeHTML(m.rules||"")}</p>`).join("")}<h2>Organizations</h2>${data.organizations.filter(seriesScope).map(o=>`<h3>${escapeHTML(o.name)}</h3><p>${escapeHTML(o.description||"")}</p>`).join("")}<h2>Timeline</h2>${data.timeline.filter(seriesScope).map(t=>`<p><strong>${escapeHTML(t.when||"")}</strong>: ${escapeHTML(t.event||"")}</p>`).join("")}<h2>Project Playlist</h2><p><strong>Spotify:</strong> ${escapeHTML((data.music?.[data.activeSeriesId]?.spotify)||"")}</p><p><strong>Apple Music:</strong> ${escapeHTML((data.music?.[data.activeSeriesId]?.apple)||"")}</p><p><strong>YouTube Music:</strong> ${escapeHTML((data.music?.[data.activeSeriesId]?.youtube)||"")}</p><p>${escapeHTML((data.music?.[data.activeSeriesId]?.notes)||"")}</p>`}
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
document.getElementById("richEditor").addEventListener("blur",()=>syncToCloud(false));
document.getElementById("globalSearch").addEventListener("input",runSearch);
document.getElementById("clearSearch").addEventListener("click",()=>{setVal("globalSearch","");runSearch(); ensureSidebarVisible(); initializeCollapsibleSidebar()});

initSupabase();
refreshSession().then(()=>{if(data.user?.id){loadFromCloud(false).then(()=>{data.activeSeriesId=null;data.activeBookId=null;updateAuthGate()})}else updateAuthGate()});


function createSeriesFromProject(){
  const type=val("newProjectType")||"series";
  const name=val("newSeriesTitle")|| (type==="series"?"Untitled Series":"Untitled Book Project");
  Promise.all([readFileAsDataURL("newProjectCover"), readFileAsDataURL("newProjectBanner")]).then(([cover,banner])=>{
    const series={id:uid(),title:name,type,genre:"",synopsis:"",theme:"",mysteries:"",foreshadowing:"",artwork:{cover,banner,color:val("newProjectColor")||"#9d4edd",notes:""},created:new Date().toISOString()};
    data.series.push(series);
    if(type==="standalone"){
      const scene={id:uid(),title:"Scene 1",content:"",pov:"",locationId:"",date:"",mood:"",purpose:"",created:new Date().toISOString()};
      const book={id:uid(),seriesId:series.id,title:name,status:"Planning",summary:"",theme:"",notes:"",manuscript:[{id:uid(),title:"Chapter One",scenes:[scene],created:new Date().toISOString()}],created:new Date().toISOString()};
      data.books.push(book);
    }
    setVal("newSeriesTitle","");
    const coverInput=document.getElementById("newProjectCover"); if(coverInput) coverInput.value="";
    const bannerInput=document.getElementById("newProjectBanner"); if(bannerInput) bannerInput.value="";
    saveData(false);
    renderProjectScreen();
    setProjectMessage(type==="standalone"?"Standalone book project created.":"Series created. Now create/select a book.");
  });
}


/* PlotPals V15.1 project-opening hotfix */
function normalizeBookForOpening(book){
  if(!book) return null;
  if(!book.manuscript) book.manuscript = [];
  if(!book.manuscript.length){
    const scene={id:uid(),title:"Scene 1",content:"",pov:"",locationId:"",date:"",mood:"",purpose:"",created:new Date().toISOString()};
    book.manuscript.push({id:uid(),title:"Chapter One",scenes:[scene],created:new Date().toISOString()});
  }
  book.manuscript.forEach(ch=>{
    if(!ch.scenes){
      ch.scenes=[{id:uid(),title:ch.title||"Scene 1",content:ch.content||"",pov:"",locationId:"",date:"",mood:"",purpose:"",created:ch.created||new Date().toISOString()}];
      delete ch.content;
    }
    if(!ch.scenes.length){
      ch.scenes.push({id:uid(),title:"Scene 1",content:"",pov:"",locationId:"",date:"",mood:"",purpose:"",created:new Date().toISOString()});
    }
  });
  return book;
}
function projectSeriesChanged(){
  const projectSelect = document.getElementById("projectSeriesSelect");
  const bookSelect = document.getElementById("projectBookSelect");
  if(!projectSelect || !bookSelect) return;
  const seriesId = projectSelect.value || data.series?.[0]?.id || "";
  const books = (data.books||[]).filter(b => b.seriesId === seriesId);
  bookSelect.innerHTML = books.length
    ? books.map(b => `<option value="${b.id}">${escapeHTML(b.title)}</option>`).join("")
    : `<option value="">No books in this project</option>`;
}
function openWorkspace(){
  const seriesId = val("projectSeriesSelect");
  const bookId = val("projectBookSelect");
  if(!seriesId || !bookId){
    setProjectMessage("Select both a project and a book first.");
    return;
  }
  const book = normalizeBookForOpening(data.books.find(b => b.id === bookId));
  if(!book){
    setProjectMessage("Could not find that book. Try reloading or choose another.");
    return;
  }
  data.activeSeriesId = seriesId;
  data.activeBookId = bookId;
  data.activeChapterId = book.manuscript[0]?.id || null;
  data.activeSceneId = book.manuscript[0]?.scenes?.[0]?.id || null;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data,null,2));
  document.getElementById("projectScreen")?.classList.add("hidden");
  document.getElementById("loginScreen")?.classList.add("hidden");
  document.getElementById("appShell")?.classList.remove("hidden");
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.getElementById("overview")?.classList.add("active");
  setText("viewTitle","Overview");
  renderAll();
  renderNestedNavSafe();
  syncToCloud(false);
}
function openProjectFromDashboard(seriesId, bookId){
  if(!bookId){
    setProjectMessage("This project has no books yet. Create a book first.");
    showCreateProjectPanel();
    return;
  }
  const book = normalizeBookForOpening(data.books.find(b => b.id === bookId));
  if(!book){
    setProjectMessage("Could not find that book. Try selecting it from Open Existing Story.");
    return;
  }
  data.activeSeriesId = seriesId;
  data.activeBookId = bookId;
  data.activeChapterId = book.manuscript[0]?.id || null;
  data.activeSceneId = book.manuscript[0]?.scenes?.[0]?.id || null;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data,null,2));
  document.getElementById("projectScreen")?.classList.add("hidden");
  document.getElementById("loginScreen")?.classList.add("hidden");
  document.getElementById("appShell")?.classList.remove("hidden");
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.getElementById("overview")?.classList.add("active");
  setText("viewTitle","Overview");
  renderAll();
  renderNestedNavSafe();
  syncToCloud(false);
}


/* PlotPals V15.3 Sidebar Recovery */
function renderNestedNavSafe(){
  ensureSidebarVisible();
  try {
    renderNestedNav();
    const nav = document.getElementById("nestedNav");
    if(nav && nav.innerHTML.trim()) return;
  } catch (error) {
    console.error("renderNestedNav failed:", error);
  }

  const nav = document.getElementById("nestedNav");
  if(!nav) return;

  const book = activeBook ? activeBook() : null;
  const chapters = book?.manuscript || [];
  const chars = (data.characters || []).filter(visibleByScope || (()=>true));
  const seriesOnly = typeof isSeriesProject === "function" ? isSeriesProject() : true;

  nav.innerHTML = `
    <div class="story-nav-group">
      <h4>Library</h4>
      <button class="story-nav" onclick="backToProjects()">📖 My Stories</button>
      <button class="story-nav" onclick="setView('overview')">🏠 Project Overview</button>
      <button class="story-nav" onclick="setView('stats')">📈 Writing Stats</button>
      <button class="story-nav" onclick="setView('music')">♫ Project Playlist</button>
    </div>

    <div class="story-nav-group">
      <h4>Manuscript</h4>
      <button class="story-nav nav-parent" onclick="setView('write')">📘 Manuscript Editor</button>
      ${chapters.map((c,i)=>`
        <button class="story-nav nav-child" onclick="setView('write','${c.id}')">${i+1}. ${escapeHTML(c.title||"Untitled")}</button>
        ${(c.scenes||[]).map((s,j)=>`<button class="story-nav nav-grandchild" onclick="setView('write','${c.id}','${s.id}')">${j+1}. ${escapeHTML(s.title||"Scene")}</button>`).join("")}
      `).join("")}
    </div>

    <div class="story-nav-group">
      <h4>Plot</h4>
      <button class="story-nav" onclick="setView('storyBoard')">🧭 Story Structure</button>
      <button class="story-nav" onclick="setView('chapters')">📄 Chapter Planner</button>
      <button class="story-nav" onclick="setView('threads')">🧵 Plot Threads</button>
      <button class="story-nav" onclick="setView('mysteries')">🔎 Mystery Tracker</button>
      <button class="story-nav" onclick="setView('foreshadowing')">🕯️ Foreshadowing</button>
      <button class="story-nav" onclick="setView('plotBoard')">🗂️ Plot Board</button>
    </div>

    <div class="story-nav-group">
      <h4>Characters</h4>
      <button class="story-nav" onclick="setView('characters')">👥 All Characters</button>
      ${chars.map(c=>`<button class="story-nav nav-grandchild" onclick="setView('characterDetail','${c.id}')">${escapeHTML(c.name||"Unnamed")}</button>`).join("")}
      <button class="story-nav" onclick="setView('relationships')">💞 Relationships</button>
    </div>

    <div class="story-nav-group">
      <h4>World Building</h4>
      <button class="story-nav" onclick="setView('locations')">📍 Locations</button>
      <button class="story-nav" onclick="setView('organizations')">⚜️ Organizations</button>
      <button class="story-nav" onclick="setView('magic')">✨ Magic / Systems</button>
      <button class="story-nav" onclick="setView('world')">🏺 Items / Artifacts</button>
      <button class="story-nav" onclick="setView('scenes')">🎬 Scene Database</button>
      <button class="story-nav" onclick="setView('timeline')">⏳ Timeline</button>
    </div>

    ${seriesOnly ? `<div class="story-nav-group"><h4>Series</h4><button class="story-nav" onclick="setView('seriesTools')">★ Series-Level Tools</button></div>` : ""}

    <div class="story-nav-group">
      <h4>Story Notes</h4>
      <button class="story-nav" onclick="setView('characterDashboard')">👤 Character Dashboard</button>
      <button class="story-nav" onclick="setView('sceneCards')">🎴 Scene Cards</button>
      <button class="story-nav" onclick="setView('goals')">🎯 Writing Goals</button>
      <button class="story-nav" onclick="setView('covers')">🖼️ Covers & Artwork</button>
      <button class="story-nav" onclick="setView('encyclopedia')">📚 Encyclopedia</button>
      <button class="story-nav" onclick="setView('visualTimeline')">🧭 Visual Timeline</button>
      <button class="story-nav" onclick="setView('research')">🔖 Research Vault</button>
      <button class="story-nav" onclick="setView('maps')">🗺️ Maps</button>
      <button class="story-nav" onclick="setView('versionHistory')">🕰️ Version History</button>
      <button class="story-nav" onclick="setView('exports')">⇩ Export</button>
      <button class="story-nav" onclick="setView('backup')">☁ Backup</button>
    </div>
  `;
}


/* PlotPals V15.4 hard static sidebar fallback */
const STATIC_SIDEBAR_HTML = `
        <div class="story-nav-group static-sidebar-fallback">
          <h4>Library</h4>
          <button class="story-nav" onclick="backToProjects()">📖 My Stories</button>
          <button class="story-nav" onclick="setView('overview')">🏠 Project Overview</button>
          <button class="story-nav" onclick="setView('stats')">📈 Writing Stats</button>
          <button class="story-nav" onclick="setView('music')">♫ Project Playlist</button>
        </div>

        <div class="story-nav-group static-sidebar-fallback">
          <h4>Manuscript</h4>
          <button class="story-nav nav-parent" onclick="setView('write')">📘 Manuscript Editor</button>
          <button class="story-nav nav-child" onclick="setView('write')">Chapters</button>
          <button class="story-nav nav-child" onclick="setView('sceneCards')">Scene Cards</button>
        </div>

        <div class="story-nav-group static-sidebar-fallback">
          <h4>Plot</h4>
          <button class="story-nav nav-parent" onclick="setView('storyBoard')">🧭 Story Structure</button>
          <button class="story-nav nav-parent" onclick="setView('chapters')">📄 Chapter Planner</button>
          <button class="story-nav nav-parent" onclick="setView('threads')">🧵 Plot Threads</button>
          <button class="story-nav nav-parent" onclick="setView('mysteries')">🔎 Mystery Tracker</button>
          <button class="story-nav nav-parent" onclick="setView('foreshadowing')">🕯️ Foreshadowing</button>
          <button class="story-nav nav-parent" onclick="setView('plotBoard')">🗂️ Plot Board</button>
        </div>

        <div class="story-nav-group static-sidebar-fallback">
          <h4>Characters</h4>
          <button class="story-nav nav-parent" onclick="setView('characters')">👥 All Characters</button>
          <button class="story-nav nav-parent" onclick="setView('characterDashboard')">👤 Character Dashboard</button>
          <button class="story-nav nav-parent" onclick="setView('relationships')">💞 Relationships</button>
        </div>

        <div class="story-nav-group static-sidebar-fallback">
          <h4>World Building</h4>
          <button class="story-nav nav-parent" onclick="setView('locations')">📍 Locations</button>
          <button class="story-nav nav-parent" onclick="setView('organizations')">⚜️ Organizations</button>
          <button class="story-nav nav-parent" onclick="setView('magic')">✨ Magic / Systems</button>
          <button class="story-nav nav-parent" onclick="setView('world')">🏺 Items / Artifacts</button>
          <button class="story-nav nav-parent" onclick="setView('scenes')">🎬 Scene Database</button>
          <button class="story-nav nav-parent" onclick="setView('timeline')">⏳ Timeline</button>
          <button class="story-nav nav-parent" onclick="setView('visualTimeline')">🧭 Visual Timeline</button>
          <button class="story-nav nav-parent" onclick="setView('maps')">🗺️ Maps</button>
        </div>

        <div class="story-nav-group static-sidebar-fallback">
          <h4>Series</h4>
          <button class="story-nav nav-parent" onclick="setView('seriesTools')">★ Series-Level Tools</button>
        </div>

        <div class="story-nav-group static-sidebar-fallback">
          <h4>Story Notes</h4>
          <button class="story-nav nav-parent" onclick="setView('goals')">🎯 Writing Goals</button>
          <button class="story-nav nav-parent" onclick="setView('covers')">🖼️ Covers & Artwork</button>
          <button class="story-nav nav-parent" onclick="setView('encyclopedia')">📚 Encyclopedia</button>
          <button class="story-nav nav-parent" onclick="setView('research')">🔖 Research Vault</button>
          <button class="story-nav nav-parent" onclick="setView('versionHistory')">🕰️ Version History</button>
          <button class="story-nav nav-parent" onclick="setView('exports')">⇩ Export</button>
          <button class="story-nav nav-parent" onclick="setView('backup')">☁ Backup</button>
        </div>

        <div class="story-nav-group static-sidebar-fallback">
          <h4>Cloud</h4>
          <button class="story-nav" onclick="syncToCloud()">☁️ Sync Now</button>
          <button class="story-nav" onclick="loadFromCloud()">⇩ Load Cloud</button>
          <button class="story-nav" onclick="signOut()">🚪 Sign Out</button>
        </div>
`;

function ensureSidebarVisible(){
  const nav = document.getElementById("nestedNav");
  if(!nav) return;
  if(!nav.innerHTML.trim()) nav.innerHTML = STATIC_SIDEBAR_HTML;
  nav.style.display = "block";
  const sidebar = document.getElementById("sidebar");
  if(sidebar) sidebar.style.display = "block";
}

document.addEventListener("DOMContentLoaded", ensureSidebarVisible);
setTimeout(ensureSidebarVisible, 300);
setTimeout(ensureSidebarVisible, 1200);


/* PlotPals V15.5 collapsible overview sidebar */
function initializeCollapsibleSidebar(){
  const nav = document.getElementById("nestedNav");
  if(!nav) return;

  const groups = Array.from(nav.querySelectorAll(".story-nav-group"));
  groups.forEach((group, index) => {
    if(group.classList.contains("collapsible-ready")) return;

    const heading = group.querySelector("h4");
    if(!heading) return;

    const label = heading.textContent.trim();
    const body = document.createElement("div");
    body.className = "collapsible-menu-content";

    Array.from(group.children).forEach(child => {
      if(child !== heading) body.appendChild(child);
    });

    const button = document.createElement("button");
    button.type = "button";
    button.className = "collapsible-menu-heading";
    button.innerHTML = `<span>${label}</span><span class="collapse-arrow">▾</span>`;
    button.onclick = () => {
      group.classList.toggle("collapsed-menu");
      const arrow = group.querySelector(".collapse-arrow");
      if(arrow) arrow.textContent = group.classList.contains("collapsed-menu") ? "›" : "▾";
    };

    heading.replaceWith(button);
    group.appendChild(body);
    group.classList.add("collapsible-ready");

    // Keep main writing sections open by default; collapse Cloud.
    if(label.toLowerCase() === "cloud"){
      group.classList.add("collapsed-menu");
      const arrow = group.querySelector(".collapse-arrow");
      if(arrow) arrow.textContent = "›";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  ensureSidebarVisible();
  initializeCollapsibleSidebar();
});
setTimeout(() => { ensureSidebarVisible(); initializeCollapsibleSidebar(); }, 400);
setTimeout(() => { ensureSidebarVisible(); initializeCollapsibleSidebar(); }, 1300);


/* PlotPals V15.6 Main Page Library Fixes */
function activeNavButton(view){
  ["navMyStories","navFavorites","navRecent","navTrash"].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.classList.remove("active");
  });
  const map={all:"navMyStories",favorites:"navFavorites",trash:"navTrash"};
  const el=document.getElementById(map[view]);
  if(el) el.classList.add("active");
}
function setLibraryView(view){
  data.libraryView = view || "all";
  activeNavButton(data.libraryView);
  renderProjectScreen();
}
function updateProjectCreateFields(){
  const type = val("newProjectType") || "series";
  const label = document.getElementById("projectTitleLabel");
  const seriesTitle = document.getElementById("newSeriesTitle");
  const hint = document.getElementById("standaloneHint");
  if(type === "standalone"){
    if(label) label.textContent = "Series / Project Title";
    if(seriesTitle){
      seriesTitle.placeholder = "Not required for standalone";
      seriesTitle.disabled = false;
    }
    if(hint) hint.textContent = "Standalone Book only needs the Book Title below. Project title will match the book title.";
  } else {
    if(label) label.textContent = "Series / Project Title";
    if(seriesTitle){
      seriesTitle.placeholder = "Series title";
      seriesTitle.disabled = false;
    }
    if(hint) hint.textContent = "Series projects can contain multiple books.";
  }
}
function favoriteProject(seriesId, event){
  if(event) event.stopPropagation();
  const s = data.series.find(x=>x.id===seriesId);
  if(!s) return;
  s.favorite = !s.favorite;
  saveData(false);
  renderProjectScreen();
}
function moveProjectToTrash(seriesId, event){
  if(event) event.stopPropagation();
  const s = data.series.find(x=>x.id===seriesId);
  if(!s) return;
  if(!confirm(`Move "${s.title}" to Trash?`)) return;
  s.deleted = true;
  s.deletedAt = new Date().toISOString();
  if(data.activeSeriesId === seriesId){
    data.activeSeriesId = null;
    data.activeBookId = null;
  }
  saveData(false);
  renderProjectScreen();
  syncToCloud(false);
}
function restoreProject(seriesId, event){
  if(event) event.stopPropagation();
  const s = data.series.find(x=>x.id===seriesId);
  if(!s) return;
  s.deleted = false;
  s.deletedAt = "";
  saveData(false);
  renderProjectScreen();
  syncToCloud(false);
}
function permanentlyDeleteProject(seriesId, event){
  if(event) event.stopPropagation();
  const s = data.series.find(x=>x.id===seriesId);
  if(!s) return;
  if(!confirm(`Permanently delete "${s.title}" and all attached books/data? This cannot be undone.`)) return;
  const bookIds = data.books.filter(b=>b.seriesId===seriesId).map(b=>b.id);
  data.books = data.books.filter(b=>b.seriesId!==seriesId);
  ["characters","relationships","timeline","chapterPlans","threads","scenes","world","locations","magicSystems","organizations","mysteries","foreshadowing","plotCards","structureBeats","research","maps","snapshots","writingSessions"].forEach(k=>{
    data[k] = (data[k]||[]).filter(item => item.seriesId !== seriesId && !bookIds.includes(item.bookId));
  });
  if(data.music) delete data.music[seriesId];
  if(data.goals) delete data.goals[seriesId];
  data.series = data.series.filter(x=>x.id!==seriesId);
  saveData(false);
  renderProjectScreen();
  syncToCloud(false);
}
function openRecentlyOpened(){
  const last = data.lastOpened;
  if(last && data.series.some(s=>s.id===last.seriesId && !s.deleted) && data.books.some(b=>b.id===last.bookId)){
    openProjectFromDashboard(last.seriesId,last.bookId);
    return;
  }
  setLibraryView("all");
  setProjectMessage("No recently opened story yet.");
}
function getPreviewMusicProject(){
  if(data.lastOpened?.seriesId && data.music?.[data.lastOpened.seriesId]) return data.lastOpened.seriesId;
  const firstWithMusic = (data.series||[]).find(s => !s.deleted && data.music?.[s.id] && (data.music[s.id].spotify || data.music[s.id].apple || data.music[s.id].youtube || data.music[s.id].notes));
  return firstWithMusic?.id || (data.series||[]).find(s=>!s.deleted)?.id || "";
}

/* Override create project so Standalone only needs Book Title */
function createSeriesFromProject(){
  const type = val("newProjectType") || "series";
  const bookTitle = val("newBookTitle");
  let projectTitle = val("newSeriesTitle");

  if(type === "standalone"){
    if(!bookTitle) return setProjectMessage("Enter a Book Title for the standalone book.");
    projectTitle = bookTitle;
  } else {
    if(!projectTitle) return setProjectMessage("Enter a Series / Project Title.");
  }

  Promise.all([readFileAsDataURL("newProjectCover"), readFileAsDataURL("newProjectBanner")]).then(([cover,banner])=>{
    const series={id:uid(),title:projectTitle,type,genre:"",synopsis:"",theme:"",mysteries:"",foreshadowing:"",favorite:false,deleted:false,artwork:{cover,banner,color:val("newProjectColor")||"#9d4edd",notes:""},created:new Date().toISOString()};
    data.series.push(series);

    if(type==="standalone"){
      const scene={id:uid(),title:"Scene 1",content:"",pov:"",locationId:"",date:"",mood:"",purpose:"",created:new Date().toISOString()};
      const book={id:uid(),seriesId:series.id,title:bookTitle,status:"Planning",summary:"",theme:"",notes:"",manuscript:[{id:uid(),title:"Chapter One",scenes:[scene],created:new Date().toISOString()}],created:new Date().toISOString()};
      data.books.push(book);
    }

    setVal("newSeriesTitle","");
    setVal("newBookTitle","");
    const coverInput=document.getElementById("newProjectCover"); if(coverInput) coverInput.value="";
    const bannerInput=document.getElementById("newProjectBanner"); if(bannerInput) bannerInput.value="";
    saveData(false);
    renderProjectScreen();
    setProjectMessage(type==="standalone"?"Standalone book created.":"Series created. Now create/select a book.");
  });
}

/* Override project dashboard renderer with Favorites/Trash/Delete/Playlist fixes */
function renderProjectScreen(){
  ensureCollections();
  applyTheme();
  updateProjectCreateFields();

  const name = data.user?.email ? data.user.email.split("@")[0] : "Writer";
  setText("dashboardName", name.charAt(0).toUpperCase() + name.slice(1));

  const visibleSeries = (data.series||[]).filter(s=>!s.deleted);
  const projectOptions = visibleSeries.length
    ? visibleSeries.map(s=>`<option value="${s.id}">${escapeHTML(s.title)} (${s.type==="standalone"?"Standalone":"Series"})</option>`).join("")
    : `<option value="">No projects yet</option>`;
  setHTML("projectSeriesSelect", projectOptions);
  setHTML("newBookSeriesSelect", projectOptions);
  projectSeriesChanged();

  const view = data.libraryView || "all";
  activeNavButton(view);
  const q = (val("projectSearch") || "").toLowerCase();

  let projects = data.series || [];
  if(view === "trash") projects = projects.filter(s=>s.deleted);
  else projects = projects.filter(s=>!s.deleted);

  if(view === "favorites") projects = projects.filter(s=>s.favorite);

  projects = projects.filter(s => !q || JSON.stringify(s).toLowerCase().includes(q) || data.books.some(b => b.seriesId === s.id && b.title.toLowerCase().includes(q)));

  const titleMap = {all:"My Stories", favorites:"Favorite Stories", trash:"Trash"};
  setText("libraryTitle", titleMap[view] || "My Stories");

  const cards = projects.map((s) => {
    const books = data.books.filter(b => b.seriesId === s.id);
    const primaryBook = books[0];
    const words = books.reduce((sum, b) => sum + projectWordCount(b), 0);
    const scenes = books.reduce((sum, b) => sum + projectSceneCount(b), 0);
    const progress = Math.min(100, Math.round(words / 50000 * 100));
    const status = primaryBook?.status || (s.type === "standalone" ? "Planning" : `${books.length} book${books.length === 1 ? "" : "s"}`);
    const art = s.artwork || {};
    const coverStyle = art.banner ? `style="background-image:linear-gradient(90deg,rgba(5,6,12,.45),rgba(12,8,25,.45)),url('${art.banner}');background-size:cover;background-position:center;"` : "";
    const openAction = s.deleted ? "" : `onclick="openProjectFromDashboard('${s.id}','${primaryBook?.id || ""}')"`;
    const trashButtons = s.deleted
      ? `<button onclick="restoreProject('${s.id}', event)">Restore</button><button class="danger" onclick="permanentlyDeleteProject('${s.id}', event)">Delete Forever</button>`
      : `<button onclick="favoriteProject('${s.id}', event)">${s.favorite ? "★ Favorited" : "☆ Favorite"}</button><button class="danger" onclick="moveProjectToTrash('${s.id}', event)">Delete</button>`;

    return `<article class="story-card" ${openAction}>
      <div class="story-card-art" ${coverStyle}>${art.cover ? `<img class="story-cover-thumb" src="${art.cover}" alt="">` : ""}</div>
      <div class="story-card-body">
        <h3>${escapeHTML(s.title)}</h3>
        <span class="tag">${escapeHTML(s.type === "standalone" ? "Standalone" : "Series")}</span>
        ${s.favorite ? `<span class="tag">Favorite</span>` : ""}
        ${s.deleted ? `<span class="tag">In Trash</span>` : ""}
        <p>${escapeHTML(status)}</p>
        <p>${books.length} book${books.length === 1 ? "" : "s"} · ${scenes} scenes</p>
        <div class="progress-bar"><span style="width:${progress}%"></span></div>
        <p>${words.toLocaleString()} words</p>
        <div class="story-card-actions">${trashButtons}</div>
      </div>
    </article>`;
  }).join("");

  const addCard = view === "trash" ? "" : `<div class="add-story-card" onclick="showCreateProjectPanel()"><div><div style="font-size:3rem;">✒</div><strong>+ New Book<br>or Series</strong></div></div>`;
  setHTML("dashboardStoryCards", cards + addCard);
  setText("trashActionsInfo", view === "trash" ? "Trash shows deleted projects. Restore them or permanently delete them here." : "");

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

  const allBooks = data.books.filter(b => data.series.some(s => s.id === b.seriesId && !s.deleted));
  const allWords = allBooks.reduce((sum, b) => sum + projectWordCount(b), 0);
  const allScenes = allBooks.reduce((sum, b) => sum + projectSceneCount(b), 0);
  const allChapters = allBooks.reduce((sum, b) => sum + (b.manuscript || []).length, 0);
  setText("dashWords", allWords.toLocaleString());
  setText("dashChapters", allChapters);
  setText("dashScenes", allScenes);
  setText("dashCharacters", (data.characters || []).filter(c => data.series.some(s=>s.id===c.seriesId && !s.deleted)).length);

  const recent = [
    ...allBooks.slice(-3).map(b => `Edited ${escapeHTML(b.title)}`),
    ...(data.characters || []).slice(-2).map(c => `Added character: ${escapeHTML(c.name)}`),
    ...(data.threads || []).slice(-2).map(t => `Created plot thread: ${escapeHTML(t.title)}`)
  ].slice(-5).reverse();

  setHTML("recentActivity", recent.length ? recent.map(r => `<p>${r}</p>`).join("") : "<p>No recent activity yet.</p>");
  setVal("dashboardPinnedNote", data.pinnedNote || "");

  const musicProjectId = getPreviewMusicProject();
  const musicProject = data.series.find(s=>s.id===musicProjectId);
  const music = musicProjectId ? (data.music?.[musicProjectId] || {}) : {};
  const musicLinks = [
    music.spotify ? `<a class="playlist-link" target="_blank" href="${escapeHTML(music.spotify)}">Spotify</a>` : "",
    music.apple ? `<a class="playlist-link" target="_blank" href="${escapeHTML(music.apple)}">Apple Music</a>` : "",
    music.youtube ? `<a class="playlist-link" target="_blank" href="${escapeHTML(music.youtube)}">YouTube Music</a>` : ""
  ].filter(Boolean).join("");
  setHTML("dashboardPlaylistPreview", musicLinks
    ? `<p><strong>${escapeHTML(musicProject?.title || "Project Playlist")}</strong></p>${musicLinks}${detail("Notes", music.notes)}`
    : "<p>No playlist linked yet. Add one inside a project.</p>");
}

/* Override opening functions to record Recently Opened */
function openWorkspace(){
  const seriesId = val("projectSeriesSelect");
  const bookId = val("projectBookSelect");
  if(!seriesId || !bookId){
    setProjectMessage("Select both a project and a book first.");
    return;
  }
  openProjectFromDashboard(seriesId, bookId);
}
function openProjectFromDashboard(seriesId, bookId){
  if(!bookId){
    setProjectMessage("This project has no books yet. Create a book first.");
    showCreateProjectPanel();
    return;
  }
  const book = normalizeBookForOpening(data.books.find(b => b.id === bookId));
  if(!book){
    setProjectMessage("Could not find that book. Try selecting it from Open Existing Story.");
    return;
  }
  data.activeSeriesId = seriesId;
  data.activeBookId = bookId;
  data.lastOpened = { seriesId, bookId, openedAt: new Date().toISOString() };
  data.activeChapterId = book.manuscript[0]?.id || null;
  data.activeSceneId = book.manuscript[0]?.scenes?.[0]?.id || null;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data,null,2));
  document.getElementById("projectScreen")?.classList.add("hidden");
  document.getElementById("loginScreen")?.classList.add("hidden");
  document.getElementById("appShell")?.classList.remove("hidden");
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.getElementById("overview")?.classList.add("active");
  setText("viewTitle","Overview");
  renderAll();
  ensureSidebarVisible();
  initializeCollapsibleSidebar();
  syncToCloud(false);
}


/* PlotPals V16 Connected Workspace */
let sprintInterval = null;
let sprintStartWords = 0;
let sprintRemaining = 0;

function sceneIdLabel(chapter, scene){
  return `${chapter?.title || "Chapter"} — ${scene?.title || "Scene"}`;
}
function allCurrentScenes(){
  return (activeBook()?.manuscript || []).flatMap(ch => (ch.scenes || []).map(sc => ({...sc, chapterId: ch.id, chapterTitle: ch.title})));
}
function allCurrentScenesRefs(){
  return (activeBook()?.manuscript || []).flatMap(ch => (ch.scenes || []).map(sc => ({chapter: ch, scene: sc})));
}
function getSceneById(sceneId){
  for(const ch of (activeBook()?.manuscript || [])){
    const sc = (ch.scenes || []).find(s => s.id === sceneId);
    if(sc) return {chapter: ch, scene: sc};
  }
  return null;
}
function renderSceneLinkControls(){
  const sc = activeScene();
  if(!sc) return;
  if(!Array.isArray(sc.charactersPresent)) sc.charactersPresent = [];
  if(!Array.isArray(sc.plotThreads)) sc.plotThreads = [];

  const chars = data.characters.filter(visibleByScope);
  setHTML("sceneCharactersPresent", chars.length ? chars.map(c => `
    <label class="check-pill"><input type="checkbox" value="${c.id}" ${sc.charactersPresent.includes(c.id) ? "checked" : ""} onchange="saveSceneLinks()"> ${escapeHTML(c.name)}</label>
  `).join("") : "<p class='muted'>Add characters first.</p>");

  const threads = data.threads.filter(visibleByScope);
  setHTML("sceneThreadsPresent", threads.length ? threads.map(t => `
    <label class="check-pill"><input type="checkbox" value="${t.id}" ${sc.plotThreads.includes(t.id) ? "checked" : ""} onchange="saveSceneLinks()"> ${escapeHTML(t.title)}</label>
  `).join("") : "<p class='muted'>Add plot threads first.</p>");
}
function saveSceneLinks(){
  const sc = activeScene();
  if(!sc) return;
  sc.charactersPresent = Array.from(document.querySelectorAll("#sceneCharactersPresent input:checked")).map(i => i.value);
  sc.plotThreads = Array.from(document.querySelectorAll("#sceneThreadsPresent input:checked")).map(i => i.value);
  saveData(false);
}
function renderConnectedStoryWeb(){
  const scenes = allCurrentScenes();
  const chars = data.characters.filter(visibleByScope);
  const threads = data.threads.filter(visibleByScope);
  const locations = data.locations.filter(visibleByScope);
  setText("connectCharacters", chars.length);
  setText("connectScenes", scenes.length);
  setText("connectThreads", threads.length);
  setText("connectLocations", locations.length);

  const pov = {};
  scenes.forEach(sc => {
    if(sc.pov){
      const name = characterName(sc.pov);
      if(!pov[name]) pov[name] = { scenes:0, words:0 };
      pov[name].scenes += 1;
      pov[name].words += countWords(stripHTML(sc.content || ""));
    }
  });
  const totalWords = Object.values(pov).reduce((s,x)=>s+x.words,0) || 1;
  setHTML("connectedPovStats", Object.entries(pov).map(([name, x]) => `
    <div class="connection-row"><strong>${escapeHTML(name)}</strong><span>${x.scenes} scenes · ${x.words} words · ${Math.round(x.words/totalWords*100)}%</span></div>
    <div class="progress-bar"><span style="width:${Math.round(x.words/totalWords*100)}%"></span></div>
  `).join("") || "<p>No POV data yet.</p>");

  setHTML("connectedAppearances", chars.map(c => {
    const appearances = scenes.filter(sc => (sc.charactersPresent || []).includes(c.id) || sc.pov === c.id);
    return `<div class="connection-row"><strong>${escapeHTML(c.name)}</strong><span>${appearances.length} scenes</span></div>`;
  }).join("") || "<p>No character data yet.</p>");
}
function renderRelationshipVisualizer(){
  const chars = data.characters.filter(visibleByScope);
  const rels = data.relationships.filter(visibleByScope);
  setHTML("relationshipVisualizerContent", chars.map(c => {
    const linked = rels.filter(r => r.a === c.id || r.b === c.id);
    return `<div class="relationship-node">
      <h3>${escapeHTML(c.name)}</h3>
      ${linked.length ? linked.map(r => {
        const other = r.a === c.id ? r.b : r.a;
        return `<div class="relationship-branch">↳ <strong>${escapeHTML(characterName(other))}</strong> <span>${escapeHTML(r.type || "Connection")}</span></div>`;
      }).join("") : "<p>No relationships yet.</p>"}
    </div>`;
  }).join("") || "<p>Add characters and relationships first.</p>");
}
function renderThreadTracker(){
  const threads = data.threads.filter(visibleByScope);
  const sceneRefs = allCurrentScenesRefs();
  setHTML("threadLinkThread", threads.length ? threads.map(t => `<option value="${t.id}">${escapeHTML(t.title)}</option>`).join("") : `<option value="">No plot threads</option>`);
  setHTML("threadLinkScene", sceneRefs.length ? sceneRefs.map(({chapter,scene}) => `<option value="${scene.id}">${escapeHTML(sceneIdLabel(chapter, scene))}</option>`).join("") : `<option value="">No scenes</option>`);

  setHTML("threadTrackerContent", threads.map(t => {
    const appearances = sceneRefs.filter(({scene}) => (scene.plotThreads || []).includes(t.id));
    return `<article class="item-card">
      <div class="card-header"><h3>${escapeHTML(t.title)}</h3><span class="tag">${escapeHTML(t.status || "Open")}</span></div>
      <div class="card-body">
        <p><strong>Appears In:</strong></p>
        ${appearances.length ? appearances.map(({chapter,scene}) => `<p>${escapeHTML(sceneIdLabel(chapter, scene))}</p>`).join("") : "<p>Not attached to any scenes yet.</p>"}
        <p><strong>Last Mentioned:</strong> ${appearances.length ? escapeHTML(sceneIdLabel(appearances[appearances.length-1].chapter, appearances[appearances.length-1].scene)) : "Never"}</p>
      </div>
    </article>`;
  }).join("") || "<p>No plot threads yet.</p>");
}
function linkThreadToScene(){
  const threadId = val("threadLinkThread");
  const sceneId = val("threadLinkScene");
  if(!threadId || !sceneId) return;
  const ref = getSceneById(sceneId);
  if(!ref) return;
  if(!Array.isArray(ref.scene.plotThreads)) ref.scene.plotThreads = [];
  if(!ref.scene.plotThreads.includes(threadId)) ref.scene.plotThreads.push(threadId);
  saveData();
}
function renderArcTracker(){
  const chars = data.characters.filter(visibleByScope);
  setHTML("arcCharacter", chars.length ? chars.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join("") : `<option value="">No characters</option>`);
  setHTML("arcTrackerContent", chars.map(c => {
    const arc = c.arcTracker || {};
    return `<article class="item-card">
      <div class="card-header"><h3>${escapeHTML(c.name)}</h3><button onclick="loadArcForCharacter('${c.id}')">Edit</button></div>
      <div class="card-body">
        ${detail("Beginning", arc.start)}
        ${detail("Middle / Turning Points", arc.middle)}
        ${detail("Ending", arc.end)}
      </div>
    </article>`;
  }).join("") || "<p>No characters yet.</p>");
}
function loadArcForCharacter(id){
  setVal("arcCharacter", id);
  const c = data.characters.find(x => x.id === id);
  const arc = c?.arcTracker || {};
  setVal("arcStart", arc.start || "");
  setVal("arcMiddle", arc.middle || "");
  setVal("arcEnd", arc.end || "");
}
function saveCharacterArcTracker(){
  const id = val("arcCharacter");
  const c = data.characters.find(x => x.id === id);
  if(!c) return;
  c.arcTracker = { start: val("arcStart"), middle: val("arcMiddle"), end: val("arcEnd") };
  saveData();
}
function renderLocationLinks(){
  const locs = data.locations.filter(visibleByScope);
  const sceneRefs = allCurrentScenesRefs();
  setHTML("locationLinksContent", locs.map(l => {
    const scenes = sceneRefs.filter(({scene}) => scene.locationId === l.id);
    const charIds = new Set();
    scenes.forEach(({scene}) => {
      if(scene.pov) charIds.add(scene.pov);
      (scene.charactersPresent || []).forEach(id => charIds.add(id));
    });
    return `<article class="item-card">
      <div class="card-header"><h3>${escapeHTML(l.name)}</h3></div>
      <div class="card-body">
        ${l.image ? `<img class="location-photo" src="${l.image}">` : ""}
        <p><strong>Scenes:</strong></p>
        ${scenes.length ? scenes.map(({chapter,scene}) => `<p>${escapeHTML(sceneIdLabel(chapter, scene))}</p>`).join("") : "<p>No scenes linked yet.</p>"}
        <p><strong>Characters Found Here:</strong></p>
        ${charIds.size ? Array.from(charIds).map(id => `<span class="tag">${escapeHTML(characterName(id))}</span>`).join("") : "<p>No character links yet.</p>"}
      </div>
    </article>`;
  }).join("") || "<p>No locations yet.</p>");
}
function smartSearchItems(){
  return encyclopediaItems().concat([
    ...allCurrentScenes().map(sc => ({type:"Connected Scene", title: sc.title || "Scene", text: JSON.stringify(sc)})),
    ...data.relationships.filter(visibleByScope).map(r => ({type:"Relationship", title:`${characterName(r.a)} + ${characterName(r.b)}`, text:JSON.stringify(r)}))
  ]);
}
function renderSmartSearch(){
  const q = (val("smartSearchInput") || "").toLowerCase();
  const items = smartSearchItems().filter(item => !q || `${item.type} ${item.title} ${item.text}`.toLowerCase().includes(q));
  setHTML("smartSearchResults", items.slice(0,100).map(item => `
    <article class="item-card"><div class="card-header"><h3>${escapeHTML(item.title)}</h3><span class="tag">${escapeHTML(item.type)}</span></div>
    <div class="card-body"><p>${escapeHTML(stripHTML(item.text || "").slice(0,300))}</p></div></article>
  `).join("") || "<p>No results.</p>");
}
function renderSeriesContinuityDashboard(){
  const gate = document.getElementById("seriesContinuityGate");
  const content = document.getElementById("seriesContinuityContent");
  if(!gate || !content) return;
  if(!isSeriesProject()){
    gate.innerHTML = `<div class="panel"><h3>Series Continuity</h3><p>This dashboard only appears for Series projects.</p></div>`;
    content.innerHTML = "";
    return;
  }
  gate.innerHTML = "";
  const books = data.books.filter(b => b.seriesId === data.activeSeriesId);
  const chars = data.characters.filter(seriesScope);
  const locations = data.locations.filter(seriesScope);
  const threads = data.threads.filter(seriesScope);
  content.innerHTML = `
    <div class="grid stats-grid">
      <div class="stat-card"><span>${books.length}</span><p>Books</p></div>
      <div class="stat-card"><span>${chars.length}</span><p>Shared Characters</p></div>
      <div class="stat-card"><span>${threads.length}</span><p>Shared Threads</p></div>
      <div class="stat-card"><span>${locations.length}</span><p>Shared Locations</p></div>
    </div>
    <div class="three-col">
      <div class="panel"><h3>Books</h3>${books.map(b => `<p>${escapeHTML(b.title)} — ${escapeHTML(b.status || "")}</p>`).join("")}</div>
      <div class="panel"><h3>Characters</h3>${chars.map(c => `<p>${escapeHTML(c.name)} — ${escapeHTML(c.role || "")}</p>`).join("")}</div>
      <div class="panel"><h3>Plot Threads</h3>${threads.map(t => `<p>${escapeHTML(t.title)} — ${escapeHTML(t.status || "")}</p>`).join("")}</div>
    </div>`;
}
function currentBookWords(){
  return (activeBook()?.manuscript || []).flatMap(ch => ch.scenes || []).reduce((sum, sc) => sum + countWords(stripHTML(sc.content || "")), 0);
}
function startSprint(){
  stopSprint();
  const mins = Number(val("sprintMinutes") || 25);
  sprintRemaining = mins * 60;
  sprintStartWords = currentBookWords();
  tickSprint();
  sprintInterval = setInterval(tickSprint, 1000);
}
function tickSprint(){
  const m = Math.floor(sprintRemaining / 60);
  const s = sprintRemaining % 60;
  setText("sprintTimer", `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
  setText("sprintWords", Math.max(0, currentBookWords() - sprintStartWords));
  if(sprintRemaining <= 0) stopSprint();
  sprintRemaining -= 1;
}
function stopSprint(){
  if(sprintInterval) clearInterval(sprintInterval);
  sprintInterval = null;
}
function finishSprint(){
  stopSprint();
  const words = Math.max(0, currentBookWords() - sprintStartWords);
  if(words){
    data.writingSessions.push({ id:uid(), seriesId:data.activeSeriesId, bookId:data.activeBookId, words, date:new Date().toISOString(), notes:"Writing sprint" });
    saveData();
  }
}
function saveAuthorSettings(){
  data.authorSettings = {
    theme: val("settingTheme") || data.theme || "dark",
    accent: val("settingAccent") || "#9d4edd",
    editorFont: val("settingEditorFont") || "Georgia, serif",
    editorWidth: val("settingEditorWidth") || "normal"
  };
  data.theme = data.authorSettings.theme;
  applyAuthorSettings();
  saveData();
}
function applyAuthorSettings(){
  const settings = data.authorSettings || {};
  if(settings.theme) data.theme = settings.theme;
  applyTheme();
  if(settings.accent) document.documentElement.style.setProperty("--accent-2", settings.accent);
  const editor = document.getElementById("richEditor");
  if(editor && settings.editorFont) editor.style.fontFamily = settings.editorFont;
  document.body.classList.toggle("editor-wide", settings.editorWidth === "wide");
  document.body.classList.toggle("editor-focused", settings.editorWidth === "focused");
  setVal("settingTheme", data.theme || "dark");
  setVal("settingAccent", settings.accent || "#9d4edd");
  setVal("settingEditorFont", settings.editorFont || "Georgia, serif");
  setVal("settingEditorWidth", settings.editorWidth || "normal");
}
function musicEmbedUrl(url){
  if(!url) return "";
  try{
    const u = new URL(url);
    if(u.hostname.includes("spotify.com")){
      const path = u.pathname.replace("/playlist/","/embed/playlist/");
      return `https://open.spotify.com${path}`;
    }
    if(u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")){
      const list = u.searchParams.get("list");
      if(list) return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(list)}`;
      if(u.hostname.includes("youtu.be")){
        const id = u.pathname.replace("/","");
        return `https://www.youtube.com/embed/${id}`;
      }
      const v = u.searchParams.get("v");
      if(v) return `https://www.youtube.com/embed/${v}`;
    }
    if(u.hostname.includes("music.apple.com")){
      return url.replace("https://music.apple.com", "https://embed.music.apple.com");
    }
  }catch(e){}
  return "";
}
function renderMusicEmbeds(){
  const music = musicForProject();
  const embeds = [
    {name:"Spotify", url:musicEmbedUrl(music.spotify)},
    {name:"Apple Music", url:musicEmbedUrl(music.apple)},
    {name:"YouTube Music", url:musicEmbedUrl(music.youtube)}
  ].filter(x => x.url);
  const html = embeds.map(e => `<article class="item-card"><h3>${e.name} Player</h3><iframe class="music-player" src="${escapeHTML(e.url)}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe></article>`).join("");
  const existing = document.getElementById("musicEmbeds");
  if(existing) existing.innerHTML = html || "<p>No embeddable playlist links yet.</p>";
}


/* PlotPals V16.1 Overview + Story System Refinement */

const uiState = { chapters:{}, roles:{}, sections:{}, arcs:{} };

function mediaIdToImage(id){
  return (data.mediaLibrary || []).find(m => m.id === id)?.data || "";
}
function mediaOptions(selected=""){
  const items = (data.mediaLibrary || []).filter(item => item.seriesId === data.activeSeriesId);
  return `<option value="">No media / keep uploaded image</option>` + items.map(item => `<option value="${item.id}" ${item.id===selected?"selected":""}>${escapeHTML(item.title || item.category || "Image")}</option>`).join("");
}
function readImageFile(inputId){
  return new Promise(resolve => {
    const file = document.getElementById(inputId)?.files?.[0];
    if(!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}
function addMediaItem(){
  readImageFile("mediaUpload").then(dataUrl => {
    if(!dataUrl) return alert("Choose an image first.");
    data.mediaLibrary.push({
      id: uid(),
      seriesId: data.activeSeriesId,
      bookId: data.activeBookId,
      title: val("mediaTitle") || "Untitled Image",
      category: val("mediaCategory") || "Other",
      notes: val("mediaNotes"),
      data: dataUrl,
      created: new Date().toISOString()
    });
    clearFields(["mediaTitle","mediaNotes"]);
    const input = document.getElementById("mediaUpload");
    if(input) input.value = "";
    saveData();
  });
}
function renderMediaLibrary(){
  const el = document.getElementById("mediaLibraryList");
  if(!el) return;
  const items = (data.mediaLibrary || []).filter(m => m.seriesId === data.activeSeriesId);
  el.innerHTML = items.length ? items.map(item => `
    <article class="item-card">
      <div class="card-header"><h3>${escapeHTML(item.title)}</h3><button class="delete-btn" onclick="deleteItem('mediaLibrary','${item.id}')">Delete</button></div>
      <img class="media-thumb" src="${item.data}" alt="${escapeHTML(item.title)}">
      <div class="card-body">
        <span class="tag">${escapeHTML(item.category)}</span>
        ${detail("Notes", item.notes)}
      </div>
    </article>
  `).join("") : "<p>No images in the media library yet.</p>";
}

function toggleSidebarGroup(key){
  uiState.sections[key] = !uiState.sections[key];
  renderNestedNav();
}
function toggleChapterNav(id, event){
  if(event) event.stopPropagation();
  uiState.chapters[id] = !uiState.chapters[id];
  renderNestedNav();
}
function toggleRoleNav(role, event){
  if(event) event.stopPropagation();
  uiState.roles[role] = !uiState.roles[role];
  renderNestedNav();
}
function toggleArcNav(id, event){
  if(event) event.stopPropagation();
  uiState.arcs[id] = !uiState.arcs[id];
  renderNestedNav();
}
function isOpen(map, key){ return map[key] !== false; }
function roleLabel(role){
  const map = {Main:"Main Character", Side:"Side Character", "Love Interest":"Love Interest", Antagonist:"Antagonist", Mentor:"Mentor", Other:"Other"};
  return map[role] || role || "Other";
}

/* Full V16.1 collapsible Overview sidebar */
function renderNestedNav(){
  const nav = document.getElementById("nestedNav");
  if(!nav) return;
  const book = activeBook();
  const chapters = book?.manuscript || [];
  const plans = data.chapterPlans.filter(visibleByScope);
  const threads = data.threads.filter(visibleByScope);
  const roles = ["Main","Side","Love Interest","Antagonist","Mentor","Other"];
  const charsByRole = role => data.characters.filter(c => visibleByScope(c) && (c.role || "Other") === role);
  const seriesOnly = isSeriesProject();
  const arcs = (data.plotArcs || []).filter(visibleByScope);
  const mediaCount = (data.mediaLibrary || []).filter(m => m.seriesId === data.activeSeriesId).length;

  nav.innerHTML = `
    <div class="nav-section">
      <button class="nav-parent" onclick="setView('overview')"><span class="nav-label">Overview</span><span>⌂</span></button>
    </div>

    <div class="nav-section">
      <button class="nav-parent" onclick="toggleSidebarGroup('manuscript')"><span class="nav-label">📘 Manuscript</span><span>${isOpen(uiState.sections,'manuscript')?'▾':'›'}</span></button>
      <div class="nav-children ${isOpen(uiState.sections,'manuscript')?'':'hidden'}">
        <button class="nav-child" onclick="setView('write')">Manuscript Editor</button>
        ${chapters.map((c,i)=>`
          <button class="nav-child chapter-nav-line" onclick="setView('write','${c.id}')">
            <span onclick="toggleChapterNav('${c.id}', event)">${isOpen(uiState.chapters,c.id)?'▾':'›'}</span>
            <span>${i+1}. ${escapeHTML(c.title || "Untitled Chapter")}</span>
            <span class="nav-count">${(c.scenes||[]).length}</span>
          </button>
          <div class="${isOpen(uiState.chapters,c.id)?'':'hidden'}">
            ${(c.scenes||[]).map((s,j)=>`
              <button class="nav-grandchild" onclick="setView('write','${c.id}','${s.id}')">${j+1}. ${escapeHTML(s.title || "Scene")}</button>
            `).join("")}
          </div>
        `).join("")}
      </div>
    </div>

    <div class="nav-section">
      <button class="nav-parent" onclick="toggleSidebarGroup('plot')"><span class="nav-label">🧭 Plot</span><span>${isOpen(uiState.sections,'plot')?'▾':'›'}</span></button>
      <div class="nav-children ${isOpen(uiState.sections,'plot')?'':'hidden'}">
        <button class="nav-child" onclick="setView('storyBoard')">Story Structure</button>
        <button class="nav-child" onclick="setView('chapters')"><span>Chapter Planner</span><span class="nav-count">${plans.length}</span></button>
        ${plans.map(p=>`<button class="nav-grandchild" onclick="setView('chapters')">${escapeHTML(p.number || "Untitled Chapter Plan")}</button>`).join("")}
        <button class="nav-child" onclick="setView('threads')"><span>Plot Threads</span><span class="nav-count">${threads.length}</span></button>
        ${threads.map(t=>`<button class="nav-grandchild" onclick="setView('threads')">${escapeHTML(t.title || "Untitled Thread")}</button>`).join("")}
        <button class="nav-child" onclick="setView('mysteries')">Mystery Tracker</button>
        <button class="nav-child" onclick="setView('foreshadowing')">Foreshadowing</button>
        <button class="nav-child" onclick="setView('plotBoard')"><span>Plot Board</span><span class="nav-count">${arcs.length}</span></button>
        ${arcs.map(arc=>`
          <button class="nav-grandchild" onclick="setView('plotBoard')">
            <span onclick="toggleArcNav('${arc.id}', event)">${isOpen(uiState.arcs,arc.id)?'▾':'›'}</span>
            ${escapeHTML(arc.name || "Untitled Arc")}
          </button>
          <div class="${isOpen(uiState.arcs,arc.id)?'':'hidden'}">
            ${data.plotCards.filter(visibleByScope).filter(card => card.arcId === arc.id).map(card => `<button class="nav-grandchild nav-deep" onclick="setView('plotBoard')">${escapeHTML(card.title || "Card")}</button>`).join("")}
          </div>
        `).join("")}
      </div>
    </div>

    <div class="nav-section">
      <button class="nav-parent" onclick="toggleSidebarGroup('characters')"><span class="nav-label">👥 Characters</span><span>${isOpen(uiState.sections,'characters')?'▾':'›'}</span></button>
      <div class="nav-children ${isOpen(uiState.sections,'characters')?'':'hidden'}">
        <button class="nav-child" onclick="setView('characters')">All Characters</button>
        ${roles.map(role=>`
          <button class="nav-child role-nav-line" onclick="setView('characters')">
            <span onclick="toggleRoleNav('${role}', event)">${isOpen(uiState.roles,role)?'▾':'›'}</span>
            <span>${roleLabel(role)}</span>
            <span class="nav-count">${charsByRole(role).length}</span>
          </button>
          <div class="${isOpen(uiState.roles,role)?'':'hidden'}">
            ${charsByRole(role).map(c=>`
              <button class="nav-grandchild character-nav-item" onclick="setView('characterWiki','${c.id}')">
                ${c.photo || mediaIdToImage(c.mediaId) ? `<img src="${c.photo || mediaIdToImage(c.mediaId)}" alt="">` : ""}
                <span>${escapeHTML(c.name || "Unnamed")}</span>
              </button>
            `).join("")}
          </div>
        `).join("")}
        <button class="nav-child" onclick="setView('relationships')">Relationships</button>
      </div>
    </div>

    <div class="nav-section">
      <button class="nav-parent" onclick="toggleSidebarGroup('world')"><span class="nav-label">🌍 Worldbuilding</span><span>${isOpen(uiState.sections,'world')?'▾':'›'}</span></button>
      <div class="nav-children ${isOpen(uiState.sections,'world')?'':'hidden'}">
        <button class="nav-child" onclick="setView('locations')">Locations</button>
        <button class="nav-child" onclick="setView('magic')">Magic System</button>
        <button class="nav-child" onclick="setView('organizations')">Organizations</button>
        <button class="nav-child" onclick="setView('world')">Cultures / Species / Artifacts</button>
        <button class="nav-child" onclick="setView('scenes')">Scene Database</button>
        <button class="nav-child" onclick="setView('timeline')">Timeline</button>
        <button class="nav-child" onclick="setView('mediaLibrary')"><span>Media Library</span><span class="nav-count">${mediaCount}</span></button>
      </div>
    </div>

    ${seriesOnly?`<div class="nav-section"><button class="nav-parent" onclick="setView('seriesTools')"><span class="nav-label">Series Tools</span><span>★</span></button></div>`:""}

    <div class="nav-section">
      <button class="nav-parent" onclick="toggleSidebarGroup('storyNotes')"><span class="nav-label">📝 Story Notes</span><span>${isOpen(uiState.sections,'storyNotes')?'▾':'›'}</span></button>
      <div class="nav-children ${isOpen(uiState.sections,'storyNotes')?'':'hidden'}">
        <button class="nav-child" onclick="setView('music')">Project Playlist</button>
        <button class="nav-child" onclick="setView('stats')">Writing Analytics</button>
        <button class="nav-child" onclick="setView('exports')">Export</button>
        <button class="nav-child" onclick="setView('backup')">Backup</button>
      </div>
    </div>
  `;
}

/* Better setView so character wiki has individual pages */
function setView(view,id=null,extra=null){
  saveCurrentScene(false,false);
  if(view==="write"){
    if(id) data.activeChapterId=id;
    if(extra) data.activeSceneId=extra;
    if(!data.activeSceneId) data.activeSceneId=activeChapter()?.scenes?.[0]?.id||null;
  }
  if((view==="characterDetail" || view==="characterWiki") && id) data.selectedCharacterId=id;
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  const target = document.getElementById(view);
  if(target) target.classList.add("active");
  const titles={overview:"Overview",write:"Scene-Based Writing",storyBoard:"Story Structure Board",chapters:"Chapter Planner",threads:"Plot Threads",mysteries:"Mystery Tracker",foreshadowing:"Foreshadowing Tracker",plotBoard:"Plot Board",characters:"Characters",characterDetail:"Character Detail",characterWiki:"Character Dashboard",relationships:"Relationship System",locations:"Locations",magic:"Magic System",organizations:"Organizations",scenes:"Scene Database",timeline:"Timeline",world:"Worldbuilding Notes",seriesTools:"Series-Level Tools",music:"Project Playlist",mediaLibrary:"Media Library",stats:"Writing Analytics",exports:"Export",backup:"Backup"};
  setText("viewTitle",titles[view]||"Workspace");
  renderAll();
}

/* Chapter planner POV dropdown */
function renderSelects(){
  const chars=data.characters.filter(visibleByScope);
  const charOptions=`<option value="">Select character</option>`+chars.map(c=>`<option value="${c.id}">${escapeHTML(c.name)}</option>`).join("");
  ["scenePOV","relA","relB","chapterPOV"].forEach(id=>setHTML(id,charOptions));
  const locs=data.locations.filter(visibleByScope);
  setHTML("sceneLocation",`<option value="">Select location</option>`+locs.map(l=>`<option value="${l.id}">${escapeHTML(l.name)}</option>`).join(""));
  const beats=data.structureBeats.filter(visibleByScope);
  setHTML("chapterStructureBeat",`<option value="">Structure beat</option>`+beats.map(b=>`<option value="${b.id}">${escapeHTML(b.name)}</option>`).join(""));
  const arcs = (data.plotArcs || []).filter(visibleByScope);
  setHTML("plotCardArc", `<option value="">Choose Arc</option>` + arcs.map(a=>`<option value="${a.id}">${escapeHTML(a.name)}</option>`).join(""));
}

/* Chapter planner now stores POV id */
function addChapterPlan(){
  data.chapterPlans.push({id:uid(),...scopedItem("book"),number:val("chapterNumber"),pov:val("chapterPOV"),wordTarget:val("chapterWordTarget"),structureBeat:val("chapterStructureBeat"),goal:val("chapterGoal"),conflict:val("chapterConflict"),outcome:val("chapterOutcome"),emotion:val("chapterEmotion"),foreshadowing:val("chapterForeshadowing"),created:new Date().toISOString()});
  clearFields(["chapterNumber","chapterPOV","chapterWordTarget","chapterGoal","chapterConflict","chapterOutcome","chapterEmotion","chapterForeshadowing"]);
  saveData();
}

/* Plot Board 2.0 */
function addPlotArc(){
  const name = val("plotArcName") || "Untitled Arc";
  data.plotArcs.push({id:uid(),...scopedItem("book"),name,color:val("plotArcColor")||"#9d4edd",description:val("plotArcDescription"),order:data.plotArcs.filter(visibleByScope).length,created:new Date().toISOString()});
  clearFields(["plotArcName","plotArcDescription"]);
  saveData();
}
function addPlotCard(){
  const arcId = val("plotCardArc");
  if(!arcId) return alert("Create or choose a plot arc first.");
  data.plotCards.push({id:uid(),...scopedItem("book"),arcId,title:val("plotCardTitle"),status:val("plotCardStatus"),notes:val("plotCardNotes"),order:data.plotCards.filter(c=>c.arcId===arcId).length,created:new Date().toISOString()});
  clearFields(["plotCardTitle","plotCardNotes"]);
  saveData();
}
function movePlotCard(cardId, direction){
  const cards = data.plotCards.filter(visibleByScope);
  const card = cards.find(c=>c.id===cardId);
  if(!card) return;
  const sameArc = data.plotCards.filter(c=>c.arcId===card.arcId).sort((a,b)=>(a.order||0)-(b.order||0));
  const idx = sameArc.findIndex(c=>c.id===cardId);
  const next = sameArc[idx+direction];
  if(!next) return;
  const temp = card.order||0;
  card.order = next.order||0;
  next.order = temp;
  saveData();
}
function moveCardToArc(cardId, arcId){
  const card = data.plotCards.find(c=>c.id===cardId);
  if(!card) return;
  card.arcId = arcId;
  card.order = data.plotCards.filter(c=>c.arcId===arcId).length;
  saveData();
}
function renderPlotBoard(){
  const el=document.getElementById("plotBoardList");
  if(!el)return;
  const arcs=(data.plotArcs||[]).filter(visibleByScope).sort((a,b)=>(a.order||0)-(b.order||0));
  const cards=data.plotCards.filter(visibleByScope);
  el.innerHTML=arcs.length?arcs.map(arc=>`
    <div class="arc-column" style="--arc-color:${escapeHTML(arc.color||"#9d4edd")}">
      <div class="arc-header">
        <h3>${escapeHTML(arc.name)}</h3>
        <button class="delete-btn" onclick="deleteItem('plotArcs','${arc.id}')">Delete Arc</button>
      </div>
      <p>${escapeHTML(arc.description||"")}</p>
      <div class="arc-drop-zone" ondragover="event.preventDefault()" ondrop="moveCardToArc(event.dataTransfer.getData('text/plain'),'${arc.id}')">
        ${cards.filter(c=>c.arcId===arc.id).sort((a,b)=>(a.order||0)-(b.order||0)).map(card=>`
          <div class="board-card draggable-card" draggable="true" ondragstart="event.dataTransfer.setData('text/plain','${card.id}')">
            <strong>${escapeHTML(card.title)}</strong>
            <span class="tag">${escapeHTML(card.status||"")}</span>
            <p>${escapeHTML(card.notes||"")}</p>
            <div class="mini-actions">
              <button onclick="movePlotCard('${card.id}',-1)">↑</button>
              <button onclick="movePlotCard('${card.id}',1)">↓</button>
              <button class="delete-btn" onclick="deleteItem('plotCards','${card.id}')">Delete</button>
            </div>
          </div>
        `).join("") || "<p class='muted'>Drop cards here.</p>"}
      </div>
    </div>
  `).join(""):`<p class="muted">Create your first plot arc to begin.</p>`;
}

/* Rich text mini editors for character wiki */
function richToolbar(targetId){
  return `<div class="mini-rich-toolbar">
    <button onclick="miniFormat('${targetId}','bold')"><b>B</b></button>
    <button onclick="miniFormat('${targetId}','italic')"><i>I</i></button>
    <button onclick="miniFormat('${targetId}','underline')"><u>U</u></button>
    <button onclick="miniFormat('${targetId}','insertUnorderedList')">• List</button>
    <button onclick="miniFormat('${targetId}','insertOrderedList')">1. List</button>
  </div>`;
}
function miniFormat(targetId, command){
  const el = document.getElementById(targetId);
  if(!el) return;
  el.focus();
  document.execCommand(command,false,null);
}
function richField(id, label, value=""){
  return `<label>${escapeHTML(label)}</label>${richToolbar(id)}<div id="${id}" class="mini-rich-editor" contenteditable="true">${value||""}</div>`;
}
function saveCharacterWiki(){
  const c = data.characters.find(x=>x.id===data.selectedCharacterId);
  if(!c) return;
  ["bio","description","personality","wound","arc","voice","secrets","quotes","notes","appearance","psychology"].forEach(field=>{
    const el=document.getElementById("wiki_"+field);
    if(el) c[field]=el.innerHTML;
  });
  c.mediaId = val("characterWikiMedia");
  const img = mediaIdToImage(c.mediaId);
  if(img) c.photo = img;
  saveData();
}
function renderCharacterWiki(){
  const el=document.getElementById("characterWikiContent");
  if(!el) return;
  const c=data.characters.find(x=>x.id===data.selectedCharacterId);
  if(!c){el.innerHTML=`<div class="panel"><p>Select a character from the sidebar.</p></div>`;return;}
  const rels=characterRelationships(c.id);
  const apps=characterAppearances(c.id);
  el.innerHTML=`
    <div class="character-wiki-layout">
      <aside class="panel wiki-profile-card">
        ${c.photo || mediaIdToImage(c.mediaId) ? `<img class="character-photo" src="${c.photo || mediaIdToImage(c.mediaId)}">` : `<div class="empty-photo">No Photo</div>`}
        <h3>${escapeHTML(c.name)}</h3>
        <span class="tag">${escapeHTML(roleLabel(c.role))}</span>
        <span class="tag">${escapeHTML(c.species||"")}</span>
        <label>Use Media Library Image</label>
        <select id="characterWikiMedia">${mediaOptions(c.mediaId||"")}</select>
        <button onclick="saveCharacterWiki()">Save Character Page</button>
      </aside>
      <div class="panel">
        <div class="wiki-tabs">
          <button onclick="showWikiTab('overview')">Overview</button>
          <button onclick="showWikiTab('bio')">Biography</button>
          <button onclick="showWikiTab('appearance')">Appearance</button>
          <button onclick="showWikiTab('psychology')">Psychology</button>
          <button onclick="showWikiTab('relationshipsTab')">Relationships</button>
          <button onclick="showWikiTab('timelineTab')">Timeline</button>
          <button onclick="showWikiTab('arcTab')">Arc</button>
          <button onclick="showWikiTab('notesTab')">Notes</button>
        </div>
        <div id="wiki_overview" class="wiki-tab active">${richField("wiki_description","Overview / Description",c.description||"")}${richField("wiki_personality","Personality",c.personality||"")}${richField("wiki_voice","Voice / Speech",c.voice||"")}</div>
        <div id="wiki_bio" class="wiki-tab">${richField("wiki_bio","Biography",c.bio||"")}</div>
        <div id="wiki_appearance" class="wiki-tab">${richField("wiki_appearance","Appearance",c.appearance||c.description||"")}</div>
        <div id="wiki_psychology" class="wiki-tab">${richField("wiki_psychology","Psychology",c.psychology||c.wound||"")}${richField("wiki_wound","Core Wound / Fear / Desire",c.wound||"")}</div>
        <div id="wiki_relationshipsTab" class="wiki-tab"><h3>Relationships</h3>${rels.length?rels.map(r=>`<p><strong>${escapeHTML(characterName(r.a))} + ${escapeHTML(characterName(r.b))}</strong><br>${escapeHTML(r.type||"")} — ${escapeHTML(r.status||"")}</p>`).join(""):"<p>No relationships yet.</p>"}</div>
        <div id="wiki_timelineTab" class="wiki-tab"><h3>Scenes Appeared In</h3>${apps.length?apps.map(a=>`<p>${escapeHTML(a)}</p>`).join(""):"<p>No appearances detected yet.</p>"}</div>
        <div id="wiki_arcTab" class="wiki-tab">${richField("wiki_arc","Character Arc",c.arc||"")}</div>
        <div id="wiki_notesTab" class="wiki-tab">${richField("wiki_notes","Notes",c.notes||"")}${richField("wiki_secrets","Secrets",c.secrets||"")}${richField("wiki_quotes","Quotes",c.quotes||"")}</div>
        <button onclick="saveCharacterWiki()">Save Character Page</button>
      </div>
    </div>
  `;
}
function showWikiTab(name){
  document.querySelectorAll(".wiki-tab").forEach(tab=>tab.classList.remove("active"));
  const el = document.getElementById("wiki_"+name);
  if(el) el.classList.add("active");
}

/* Character dashboard opens own pages */
function renderCharacterDetail(){ renderCharacterWiki(); }

/* Images are saved to records and reusable media library */
function addCharacter(){
  const file=document.getElementById("charPhoto").files[0];
  const finish=photo=>{
    const character = {id:uid(),...scopedItem(val("charScope")),name:val("charName"),role:val("charRole"),species:val("charSpecies"),photo,description:val("charDescription"),personality:val("charPersonality"),wound:val("charWound"),arc:val("charArc"),voice:val("charVoice"),bio:val("charBio"),secrets:val("charSecrets"),quotes:val("charQuotes"),created:new Date().toISOString()};
    data.characters.push(character);
    if(photo){
      const media={id:uid(),seriesId:data.activeSeriesId,bookId:data.activeBookId,title:`${character.name} Portrait`,category:"Character",notes:"Saved from character upload.",data:photo,created:new Date().toISOString()};
      data.mediaLibrary.push(media);
      character.mediaId=media.id;
    }
    clearFields(["charName","charSpecies","charDescription","charPersonality","charWound","charArc","charVoice","charBio","charSecrets","charQuotes"]);
    document.getElementById("charPhoto").value="";
    saveData();
  };
  if(!file)return finish("");
  const reader=new FileReader();
  reader.onload=()=>finish(reader.result);
  reader.readAsDataURL(file);
}
function addLocation(){
  const file=document.getElementById("locationImage").files[0];
  const finish=image=>{
    const loc={id:uid(),...scopedItem(val("locationScope")),name:val("locationName"),population:val("locationPopulation"),culture:val("locationCulture"),image,description:val("locationDescription"),history:val("locationHistory"),notes:val("locationNotes"),created:new Date().toISOString()};
    data.locations.push(loc);
    if(image){
      const media={id:uid(),seriesId:data.activeSeriesId,bookId:data.activeBookId,title:`${loc.name} Image`,category:"Location",notes:"Saved from location upload.",data:image,created:new Date().toISOString()};
      data.mediaLibrary.push(media);
      loc.mediaId=media.id;
    }
    clearFields(["locationName","locationPopulation","locationCulture","locationDescription","locationHistory","locationNotes"]);
    document.getElementById("locationImage").value="";
    saveData();
  };
  if(!file)return finish("");
  const reader=new FileReader();
  reader.onload=()=>finish(reader.result);
  reader.readAsDataURL(file);
}

/* Render chapter planner with readable POV name */
function renderAllLists(){
  renderStoryBoard(); renderPlotBoard(); renderCharactersByRole(); renderCharacterWiki(); renderRelationships(); renderSeriesTools(); renderWritingStats(); renderMediaLibrary();
  renderCardList("chapterPlans","chapterPlanList","number",item=>`<span class="tag">Book</span>${detail("POV",characterName(item.pov))}${detail("Structure Beat",data.structureBeats.find(b=>b.id===item.structureBeat)?.name||"")}${detail("Target Words",item.wordTarget)}${detail("Goal",item.goal)}${detail("Conflict",item.conflict)}${detail("Outcome",item.outcome)}${detail("Emotional Beat",item.emotion)}${detail("Foreshadowing",item.foreshadowing)}`);
  renderCardList("threads","threadList","title",item=>`<span class="tag">${escapeHTML(item.scope)}</span><span class="tag">${escapeHTML(item.status)}</span>${detail("Setup",item.setup)}${detail("Payoff",item.payoff)}`);
  renderCardList("mysteries","mysteryList","question",item=>`<span class="tag">${escapeHTML(item.status)}</span>${detail("Introduced",item.introduced)}${detail("Hints / False Leads",item.hints)}${detail("Answer",item.answer)}${detail("Payoff",item.payoff)}`,seriesScope);
  renderCardList("foreshadowing","foreshadowingList","hint",item=>`<span class="tag">${escapeHTML(item.status)}</span>${detail("Appears",item.appears)}${detail("Payoff",item.payoff)}${detail("Notes",item.notes)}`,seriesScope);
  renderCardList("world","worldList","name",item=>`<span class="tag">${escapeHTML(item.category)}</span>${detail("Description",item.description)}${detail("Rules / Notes",item.rules)}`);
  renderCardList("locations","locationList","name",item=>`${item.image?`<img class="location-photo" src="${item.image}">`:""}${detail("Population",item.population)}${detail("Culture",item.culture)}${detail("Description",item.description)}${detail("History",item.history)}${detail("Notes",item.notes)}`);
  renderCardList("magicSystems","magicList","name",item=>`${detail("Source",item.source)}${detail("Rules",item.rules)}${detail("Limitations",item.limits)}${detail("Costs",item.costs)}${detail("Examples / Users",item.examples)}`,seriesScope);
  renderCardList("organizations","organizationList","name",item=>`${detail("Type",item.type)}${detail("Description",item.description)}${detail("Members",item.members)}${detail("History",item.history)}`,seriesScope);
  renderSceneDatabase(); renderTimeline();
}


/* PlotPals V16.4 Character Dashboard + Wiki Flow */
function characterImage(character){
  if(!character) return "";
  if(character.photo) return character.photo;
  if(character.mediaId && data.mediaLibrary){
    return (data.mediaLibrary || []).find(m => m.id === character.mediaId)?.data || "";
  }
  return "";
}
function characterRoleLabel(role){
  const labels = {
    Main: "Main Character",
    Side: "Side Character",
    "Love Interest": "Love Interest",
    Antagonist: "Antagonist",
    Mentor: "Mentor",
    Other: "Other"
  };
  return labels[role] || role || "Other";
}
function openCharacterWiki(characterId){
  data.selectedCharacterId = characterId;
  setView("characterDetail", characterId);
}
function renderCharacterDashboard(){
  const el = document.getElementById("characterDashboardList");
  if(!el) return;
  const characters = (data.characters || []).filter(visibleByScope);
  const roles = ["Main","Side","Love Interest","Antagonist","Mentor","Other"];

  if(!characters.length){
    el.innerHTML = `<article class="item-card"><div class="card-body"><p>No characters yet. Add one from the Characters tab.</p><button onclick="setView('characters')">Add Character</button></div></article>`;
    return;
  }

  el.innerHTML = roles.map(role => {
    const roleCharacters = characters.filter(c => (c.role || "Other") === role);
    if(!roleCharacters.length) return "";
    return `
      <div class="character-dashboard-role">
        <h3>${characterRoleLabel(role)}</h3>
        <div class="card-grid">
          ${roleCharacters.map(character => {
            const img = characterImage(character);
            return `
              <article class="item-card character-dashboard-card" onclick="openCharacterWiki('${character.id}')">
                <div class="character-card-image-wrap">
                  ${img ? `<img class="character-dashboard-photo" src="${img}" alt="${escapeHTML(character.name || "Character")}">` : `<div class="character-dashboard-photo empty-photo">No Photo</div>`}
                </div>
                <div class="card-body">
                  <h3>${escapeHTML(character.name || "Unnamed Character")}</h3>
                  <span class="tag">${escapeHTML(characterRoleLabel(character.role))}</span>
                  ${character.species ? `<span class="tag">${escapeHTML(character.species)}</span>` : ""}
                  ${detail("Personality", stripHTML(character.personality || "").slice(0, 160))}
                  ${detail("Arc", stripHTML(character.arc || "").slice(0, 160))}
                  <button onclick="event.stopPropagation(); openCharacterWiki('${character.id}')">Open Wiki Page</button>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }).join("");
}

/* Replace/strengthen character detail into a wiki page */
function renderCharacterDetail(){
  const el = document.getElementById("characterDetailContent");
  if(!el) return;
  const c = (data.characters || []).find(x => x.id === data.selectedCharacterId);
  if(!c){
    el.innerHTML = `<div class="panel"><p>Select a character from the Character Dashboard.</p><button onclick="setView('characterDashboard')">Open Character Dashboard</button></div>`;
    return;
  }

  const img = characterImage(c);
  const rels = characterRelationships(c.id);
  const apps = characterAppearances(c.id);

  el.innerHTML = `
    <div class="character-wiki-page">
      <aside class="panel character-wiki-sidebar">
        ${img ? `<img class="character-wiki-photo" src="${img}" alt="${escapeHTML(c.name || "Character")}">` : `<div class="character-wiki-photo empty-photo">No Photo</div>`}
        <h2>${escapeHTML(c.name || "Unnamed Character")}</h2>
        <span class="tag">${escapeHTML(characterRoleLabel(c.role))}</span>
        ${c.species ? `<span class="tag">${escapeHTML(c.species)}</span>` : ""}
        <button onclick="setView('characterDashboard')">← Back to Dashboard</button>
      </aside>

      <main class="panel character-wiki-main">
        <div class="wiki-tabs">
          <button onclick="showCharacterWikiTab('overview')">Overview</button>
          <button onclick="showCharacterWikiTab('bio')">Biography</button>
          <button onclick="showCharacterWikiTab('appearance')">Appearance</button>
          <button onclick="showCharacterWikiTab('psychology')">Psychology</button>
          <button onclick="showCharacterWikiTab('relationships')">Relationships</button>
          <button onclick="showCharacterWikiTab('scenes')">Scenes</button>
          <button onclick="showCharacterWikiTab('notes')">Notes</button>
        </div>

        <section id="characterWiki_overview" class="character-wiki-tab active">
          <h3>Overview</h3>
          ${detail("Description", c.description)}
          ${detail("Personality", c.personality)}
          ${detail("Voice / Speech", c.voice)}
          ${detail("Character Arc", c.arc)}
        </section>

        <section id="characterWiki_bio" class="character-wiki-tab">
          <h3>Biography</h3>
          ${c.bio ? `<div class="wiki-text">${c.bio}</div>` : "<p>No biography yet.</p>"}
        </section>

        <section id="characterWiki_appearance" class="character-wiki-tab">
          <h3>Appearance</h3>
          ${detail("Species / Identity", c.species)}
          ${detail("Physical Description", c.description)}
        </section>

        <section id="characterWiki_psychology" class="character-wiki-tab">
          <h3>Psychology</h3>
          ${detail("Core Wound / Fear / Desire", c.wound)}
          ${detail("Personality", c.personality)}
          ${detail("Secrets", c.secrets)}
        </section>

        <section id="characterWiki_relationships" class="character-wiki-tab">
          <h3>Relationships</h3>
          ${rels.length ? rels.map(r => `
            <article class="wiki-mini-card">
              <strong>${escapeHTML(characterName(r.a))} + ${escapeHTML(characterName(r.b))}</strong>
              ${detail("Type", r.type)}
              ${detail("Status", r.status)}
              ${detail("History", r.history)}
              ${detail("Important Moments", r.moments)}
              ${detail("Arc", r.arc)}
            </article>
          `).join("") : "<p>No relationships yet.</p>"}
        </section>

        <section id="characterWiki_scenes" class="character-wiki-tab">
          <h3>Scenes Appeared In</h3>
          ${apps.length ? apps.map(a => `<p>${escapeHTML(a)}</p>`).join("") : "<p>No appearances detected yet.</p>"}
        </section>

        <section id="characterWiki_notes" class="character-wiki-tab">
          <h3>Notes</h3>
          ${detail("Quotes", c.quotes)}
          ${detail("Secrets", c.secrets)}
        </section>
      </main>
    </div>
  `;
}
function showCharacterWikiTab(tabName){
  document.querySelectorAll(".character-wiki-tab").forEach(tab => tab.classList.remove("active"));
  const tab = document.getElementById("characterWiki_" + tabName);
  if(tab) tab.classList.add("active");
}

/* Make setView recognize Character Dashboard and still open individual wiki pages */
const originalSetViewV164 = typeof setView === "function" ? setView : null;
function setView(view,id=null,extra=null){
  saveCurrentScene(false,false);
  if(view==="write"){
    if(id) data.activeChapterId=id;
    if(extra) data.activeSceneId=extra;
    if(!data.activeSceneId) data.activeSceneId=activeChapter()?.scenes?.[0]?.id||null;
  }
  if((view==="characterDetail" || view==="characterWiki") && id){
    data.selectedCharacterId=id;
    view="characterDetail";
  }
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  const target = document.getElementById(view);
  if(target) target.classList.add("active");
  const titles={overview:"Overview",write:"Scene-Based Writing",storyBoard:"Story Structure Board",chapters:"Chapter Planner",threads:"Plot Threads",mysteries:"Mystery Tracker",foreshadowing:"Foreshadowing Tracker",plotBoard:"Plot Board",characters:"Characters",characterDashboard:"Character Dashboard",characterDetail:"Character Wiki",relationships:"Relationship System",locations:"Locations",magic:"Magic System",organizations:"Organizations",scenes:"Scene Database",timeline:"Timeline",world:"Worldbuilding Notes",seriesTools:"Series-Level Tools",music:"Project Playlist",mediaLibrary:"Media Library",stats:"Writing Analytics",exports:"Export",backup:"Backup"};
  setText("viewTitle",titles[view]||"Workspace");
  renderAll();
}

/* Ensure character creation populates dashboard immediately */
const originalAddCharacterV164 = typeof addCharacter === "function" ? addCharacter : null;
function addCharacter(){
  const file=document.getElementById("charPhoto")?.files?.[0];
  const finish=photo=>{
    data.characters.push({
      id:uid(),
      ...scopedItem(val("charScope")),
      name:val("charName"),
      role:val("charRole"),
      species:val("charSpecies"),
      photo,
      description:val("charDescription"),
      personality:val("charPersonality"),
      wound:val("charWound"),
      arc:val("charArc"),
      voice:val("charVoice"),
      bio:val("charBio"),
      secrets:val("charSecrets"),
      quotes:val("charQuotes"),
      created:new Date().toISOString()
    });
    clearFields(["charName","charSpecies","charDescription","charPersonality","charWound","charArc","charVoice","charBio","charSecrets","charQuotes"]);
    const input=document.getElementById("charPhoto");
    if(input) input.value="";
    saveData();
    setView("characterDashboard");
  };
  if(!file) return finish("");
  const reader=new FileReader();
  reader.onload=()=>finish(reader.result);
  reader.readAsDataURL(file);
}

/* Render hook */
const originalRenderAllListsV164 = typeof renderAllLists === "function" ? renderAllLists : null;
function renderAllLists(){
  if(originalRenderAllListsV164) originalRenderAllListsV164();
  renderCharacterDashboard();
  renderCharacterDetail();
}


/* PlotPals V16.5 Simplified Character Dashboard Creator */
function toggleCharacterCreator(force){
  const panel = document.getElementById("characterCreatorPanel");
  if(!panel) return;
  if(force === true) panel.classList.remove("hidden");
  else if(force === false) panel.classList.add("hidden");
  else panel.classList.toggle("hidden");
}
function addCharacterFromDashboard(){
  const file=document.getElementById("dashCharPhoto")?.files?.[0];
  const finish=photo=>{
    const character = {
      id:uid(),
      ...scopedItem(val("dashCharScope")),
      name:val("dashCharName"),
      role:val("dashCharRole"),
      species:val("dashCharSpecies"),
      photo,
      description:val("dashCharDescription"),
      personality:val("dashCharPersonality"),
      wound:val("dashCharWound"),
      arc:val("dashCharArc"),
      voice:val("dashCharVoice"),
      bio:val("dashCharBio"),
      secrets:val("dashCharSecrets"),
      quotes:val("dashCharQuotes"),
      created:new Date().toISOString()
    };

    if(!character.name) return alert("Give the character a name first.");

    data.characters.push(character);

    if(photo && data.mediaLibrary){
      const media = {
        id:uid(),
        seriesId:data.activeSeriesId,
        bookId:data.activeBookId,
        title:`${character.name} Portrait`,
        category:"Character",
        notes:"Saved from Character Dashboard upload.",
        data:photo,
        created:new Date().toISOString()
      };
      data.mediaLibrary.push(media);
      character.mediaId = media.id;
    }

    ["dashCharName","dashCharSpecies","dashCharDescription","dashCharPersonality","dashCharWound","dashCharArc","dashCharVoice","dashCharBio","dashCharSecrets","dashCharQuotes"].forEach(id=>setVal(id,""));
    const input=document.getElementById("dashCharPhoto");
    if(input) input.value="";
    toggleCharacterCreator(false);
    saveData();
    setView("characterDashboard");
  };

  if(!file) return finish("");
  const reader=new FileReader();
  reader.onload=()=>finish(reader.result);
  reader.readAsDataURL(file);
}


/* PlotPals V16.6 Character Sidebar Hierarchy */
function sidebarCharacterImage(character){
  if(!character) return "";
  if(character.photo) return character.photo;
  if(character.mediaId && data.mediaLibrary){
    return (data.mediaLibrary || []).find(m => m.id === character.mediaId)?.data || "";
  }
  return "";
}
function sidebarCharacterRoleLabel(role){
  const labels = {
    Main: "Main Character",
    Side: "Side Character",
    "Love Interest": "Love Interest",
    Antagonist: "Antagonist",
    Mentor: "Mentor",
    Other: "Other"
  };
  return labels[role] || role || "Other";
}
function renderCharacterSidebarHierarchy(){
  const nav = document.getElementById("nestedNav");
  if(!nav) return;

  const roles = ["Main","Side","Love Interest","Antagonist","Mentor","Other"];
  const characters = (data.characters || []).filter(visibleByScope);
  const charsByRole = role => characters.filter(c => (c.role || "Other") === role);

  const characterSection = `
    <div class="nav-section character-sidebar-section">
      <button class="nav-parent" onclick="setView('characterDashboard')">
        <span class="nav-label">Characters</span>
        <span class="nav-count">${characters.length}</span>
      </button>
      <div class="nav-children">
        <button class="nav-child" onclick="setView('characterDashboard')">Character Dashboard</button>
        ${roles.map(role => `
          <div class="sidebar-role-group">
            <button class="nav-child sidebar-role-header" onclick="setView('characterDashboard')">
              <span>${sidebarCharacterRoleLabel(role)}</span>
              <span class="nav-count">${charsByRole(role).length}</span>
            </button>
            ${charsByRole(role).map(character => {
              const img = sidebarCharacterImage(character);
              return `
                <button class="nav-grandchild sidebar-character-link" onclick="openCharacterWiki('${character.id}')">
                  ${img ? `<img src="${img}" alt="">` : `<span class="sidebar-character-dot"></span>`}
                  <span>${escapeHTML(character.name || "Unnamed Character")}</span>
                </button>
              `;
            }).join("")}
          </div>
        `).join("")}
        <button class="nav-child" onclick="setView('relationships')">Relationships</button>
      </div>
    </div>
  `;

  const existing = nav.querySelector(".character-sidebar-section");
  if(existing){
    existing.outerHTML = characterSection;
    return;
  }

  // Try replacing old Characters nav section if it exists.
  const sections = Array.from(nav.querySelectorAll(".nav-section"));
  const oldCharacterSection = sections.find(section => section.textContent.trim().toLowerCase().includes("characters"));
  if(oldCharacterSection){
    oldCharacterSection.outerHTML = characterSection;
    return;
  }

  // Otherwise append it so it always appears.
  nav.insertAdjacentHTML("beforeend", characterSection);
}

/* Keep original sidebar renderer, then inject the Character hierarchy into it */
const originalRenderNestedNavV166 = typeof renderNestedNav === "function" ? renderNestedNav : null;
function renderNestedNav(){
  if(originalRenderNestedNavV166) originalRenderNestedNavV166();
  renderCharacterSidebarHierarchy();
}

/* Refresh sidebar immediately after adding a dashboard character */
const originalAddCharacterFromDashboardV166 = typeof addCharacterFromDashboard === "function" ? addCharacterFromDashboard : null;
function addCharacterFromDashboard(){
  if(originalAddCharacterFromDashboardV166){
    originalAddCharacterFromDashboardV166();
    setTimeout(renderCharacterSidebarHierarchy, 50);
    return;
  }
}

/* Refresh sidebar immediately after adding a character from old Characters tab */
const originalAddCharacterV166 = typeof addCharacter === "function" ? addCharacter : null;
function addCharacter(){
  if(originalAddCharacterV166){
    originalAddCharacterV166();
    setTimeout(renderCharacterSidebarHierarchy, 50);
    return;
  }
}


/* PlotPals V16.7 Character Save + Photo Upload Fix */
function setCharacterCreatorMessage(message){
  const el = document.getElementById("characterCreatorMessage");
  if(el) el.textContent = message || "";
}
function toggleCharacterCreator(force){
  const panel = document.getElementById("characterCreatorPanel");
  if(!panel) return;
  if(force === true) panel.classList.remove("hidden");
  else if(force === false) panel.classList.add("hidden");
  else panel.classList.toggle("hidden");
  setCharacterCreatorMessage("");
}
function getDashboardCharacterValue(id){
  return document.getElementById(id)?.value?.trim() || "";
}
function clearDashboardCharacterForm(){
  ["dashCharName","dashCharSpecies","dashCharDescription","dashCharPersonality","dashCharWound","dashCharArc","dashCharVoice","dashCharBio","dashCharSecrets","dashCharQuotes"].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = "";
  });
  const photo = document.getElementById("dashCharPhoto");
  if(photo) photo.value = "";
}
function readDashboardCharacterPhoto(){
  return new Promise(resolve => {
    const input = document.getElementById("dashCharPhoto");
    const file = input?.files?.[0];
    if(!file) return resolve("");
    if(!file.type.startsWith("image/")){
      setCharacterCreatorMessage("Please upload an image file.");
      return resolve(null);
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = () => {
      setCharacterCreatorMessage("The photo could not be read.");
      resolve(null);
    };
    reader.readAsDataURL(file);
  });
}
async function addCharacterFromDashboard(){
  ensureCollections();
  if(!data.activeSeriesId || !data.activeBookId){
    setCharacterCreatorMessage("Open a book/project before adding a character.");
    return;
  }

  const name = getDashboardCharacterValue("dashCharName");
  if(!name){
    setCharacterCreatorMessage("Give the character a name first.");
    return;
  }

  const photo = await readDashboardCharacterPhoto();
  if(photo === null) return;

  const scope = getDashboardCharacterValue("dashCharScope") || "book";
  const character = {
    id: uid(),
    ...scopedItem(scope),
    name,
    role: getDashboardCharacterValue("dashCharRole") || "Other",
    species: getDashboardCharacterValue("dashCharSpecies"),
    photo: photo || "",
    description: getDashboardCharacterValue("dashCharDescription"),
    personality: getDashboardCharacterValue("dashCharPersonality"),
    wound: getDashboardCharacterValue("dashCharWound"),
    arc: getDashboardCharacterValue("dashCharArc"),
    voice: getDashboardCharacterValue("dashCharVoice"),
    bio: getDashboardCharacterValue("dashCharBio"),
    secrets: getDashboardCharacterValue("dashCharSecrets"),
    quotes: getDashboardCharacterValue("dashCharQuotes"),
    created: new Date().toISOString()
  };

  if(!data.characters) data.characters = [];
  data.characters.push(character);

  if(photo){
    if(!data.mediaLibrary) data.mediaLibrary = [];
    const media = {
      id: uid(),
      seriesId: data.activeSeriesId,
      bookId: data.activeBookId,
      title: `${name} Portrait`,
      category: "Character",
      notes: "Saved from Character Dashboard upload.",
      data: photo,
      created: new Date().toISOString()
    };
    data.mediaLibrary.push(media);
    character.mediaId = media.id;
  }

  clearDashboardCharacterForm();
  toggleCharacterCreator(false);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data,null,2));
  renderAll();
  setView("characterDashboard");
  setCharacterCreatorMessage("Character saved.");
  scheduleCloudSave();
}
function characterDashboardImage(character){
  if(!character) return "";
  if(character.photo) return character.photo;
  if(character.mediaId && data.mediaLibrary){
    return (data.mediaLibrary || []).find(m => m.id === character.mediaId)?.data || "";
  }
  return "";
}
function characterDashboardRoleLabel(role){
  const labels = {Main:"Main Character",Side:"Side Character","Love Interest":"Love Interest",Antagonist:"Antagonist",Mentor:"Mentor",Other:"Other"};
  return labels[role] || role || "Other";
}
function renderCharacterDashboard(){
  const el = document.getElementById("characterDashboardList");
  if(!el) return;
  const characters = (data.characters || []).filter(visibleByScope);
  const roles = ["Main","Side","Love Interest","Antagonist","Mentor","Other"];

  if(!characters.length){
    el.innerHTML = `<article class="item-card"><div class="card-body"><p>No characters yet.</p><button onclick="toggleCharacterCreator(true)">+ Add Character</button></div></article>`;
    return;
  }

  el.innerHTML = roles.map(role => {
    const roleCharacters = characters.filter(c => (c.role || "Other") === role);
    if(!roleCharacters.length) return "";
    return `
      <div class="character-dashboard-role">
        <h3>${characterDashboardRoleLabel(role)}</h3>
        <div class="card-grid">
          ${roleCharacters.map(character => {
            const img = characterDashboardImage(character);
            return `
              <article class="item-card character-dashboard-card" onclick="openCharacterWiki('${character.id}')">
                <div class="character-card-image-wrap">
                  ${img ? `<img class="character-dashboard-photo" src="${img}" alt="${escapeHTML(character.name || "Character")}">` : `<div class="character-dashboard-photo empty-photo">No Photo</div>`}
                </div>
                <div class="card-body">
                  <h3>${escapeHTML(character.name || "Unnamed Character")}</h3>
                  <span class="tag">${escapeHTML(characterDashboardRoleLabel(character.role))}</span>
                  ${character.species ? `<span class="tag">${escapeHTML(character.species)}</span>` : ""}
                  ${detail("Personality", stripHTML(character.personality || "").slice(0, 160))}
                  ${detail("Arc", stripHTML(character.arc || "").slice(0, 160))}
                  <button onclick="event.stopPropagation(); openCharacterWiki('${character.id}')">Open Wiki Page</button>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }).join("");
}
function openCharacterWiki(characterId){
  data.selectedCharacterId = characterId;
  setView("characterDetail", characterId);
}

/* Keep the older Characters tab working too, but route saves through reliable logic when possible. */
function addCharacter(){
  const oldName = document.getElementById("charName")?.value?.trim() || "";
  if(!oldName){
    alert("Give the character a name first.");
    return;
  }

  // Copy old form values into dashboard form and reuse the fixed save path.
  const map = {
    charName:"dashCharName",
    charScope:"dashCharScope",
    charRole:"dashCharRole",
    charSpecies:"dashCharSpecies",
    charDescription:"dashCharDescription",
    charPersonality:"dashCharPersonality",
    charWound:"dashCharWound",
    charArc:"dashCharArc",
    charVoice:"dashCharVoice",
    charBio:"dashCharBio",
    charSecrets:"dashCharSecrets",
    charQuotes:"dashCharQuotes"
  };
  Object.entries(map).forEach(([from,to]) => {
    const fromEl = document.getElementById(from);
    const toEl = document.getElementById(to);
    if(fromEl && toEl) toEl.value = fromEl.value;
  });

  const oldPhoto = document.getElementById("charPhoto");
  const dashPhoto = document.getElementById("dashCharPhoto");
  if(oldPhoto?.files?.length && dashPhoto){
    try {
      const dt = new DataTransfer();
      dt.items.add(oldPhoto.files[0]);
      dashPhoto.files = dt.files;
    } catch(e) {}
  }

  addCharacterFromDashboard();
}

/* Make sure renderAllLists always populates dashboard after normal lists */
const renderAllListsBeforeV167 = typeof renderAllLists === "function" ? renderAllLists : null;
function renderAllLists(){
  if(renderAllListsBeforeV167) renderAllListsBeforeV167();
  renderCharacterDashboard();
}
