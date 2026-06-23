const STORAGE_KEY = "plotpals";
const CLOUD_TABLE = "writer_vaults";

const defaultData = {
  activeSeriesId: null, activeBookId: null, activeChapterId: null, activeSceneId: null, selectedCharacterId: null,
  user: null, series: [], books: [], characters: [], relationships: [], timeline: [], chapterPlans: [], threads: [],
  scenes: [], world: [], locations: [], magicSystems: [], organizations: [], mysteries: [], foreshadowing: [], plotCards: [],
  structureBeats: [], music: {}, theme: 'dark', pinnedNote: ''
};

let supabaseClient = null;
let data = loadData();
let cloudSaveTimer = null;
let authMode = "login";
let isRendering = false;

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
function ensureCollections(){["series","books","characters","relationships","timeline","chapterPlans","threads","scenes","world","locations","magicSystems","organizations","mysteries","foreshadowing","plotCards","structureBeats"].forEach(k=>{if(!data[k])data[k]=[]}); if(!data.music)data.music={}; if(!data.theme)data.theme="dark"; }
function ensureProject(){ensureCollections(); const b=activeBook(); if(b){if(!b.manuscript)b.manuscript=[]; if(!b.manuscript.length){const scene={id:uid(),title:"Scene 1",content:"",pov:"",locationId:"",date:"",mood:"",purpose:"",created:new Date().toISOString()}; const ch={id:uid(),title:"Chapter One",scenes:[scene],created:new Date().toISOString()}; b.manuscript.push(ch); data.activeChapterId=ch.id; data.activeSceneId=scene.id} b.manuscript.forEach(ch=>{if(!ch.scenes){ch.scenes=[{id:uid(),title:ch.title||"Scene 1",content:ch.content||"",pov:"",locationId:"",date:"",mood:"",purpose:"",created:ch.created||new Date().toISOString()}]; delete ch.content}}); if(!data.activeChapterId)data.activeChapterId=b.manuscript[0]?.id||null; if(!data.activeSceneId)data.activeSceneId=activeChapter()?.scenes?.[0]?.id||null}}

function switchAuthMode(mode){authMode=mode;document.getElementById("loginTab").classList.toggle("active",mode==="login");document.getElementById("signupTab").classList.toggle("active",mode==="signup");document.getElementById("authSubmitBtn").textContent=mode==="login"?"Login":"Create Account";setLoginMessage("")}
async function submitAuth(){return authMode==="login"?signIn():signUp()}
function setLoginMessage(message){const el=document.getElementById("loginMessage"); if(el)el.textContent=message||""}
function setProjectMessage(message){const el=document.getElementById("projectMessage"); if(el)el.textContent=message||""}
async function refreshSession(){if(!supabaseClient)return; const {data:sessionData}=await supabaseClient.auth.getSession(); const user=sessionData?.session?.user||null; data.user=user?{id:user.id,email:user.email}:null; localStorage.setItem(STORAGE_KEY,JSON.stringify(data,null,2)); updateAuthGate()}
function updateAuthGate(){applyTheme(); const loggedIn=!!data.user?.id; const hasProject=!!(data.activeSeriesId&&data.activeBookId); document.getElementById("loginScreen").classList.toggle("hidden",loggedIn); document.getElementById("projectScreen").classList.toggle("hidden",!loggedIn||hasProject); document.getElementById("appShell").classList.toggle("hidden",!loggedIn||!hasProject); renderAccount(); if(loggedIn&&!hasProject)renderProjectScreen()}
async function signUp(){if(!supabaseClient)return setLoginMessage("Supabase could not load."); const {error}=await supabaseClient.auth.signUp({email:val("loginEmail"),password:val("loginPassword")}); if(error)return setLoginMessage(error.message); setLoginMessage("Account created. Check email if confirmation is required, then login.")}
async function signIn(){if(!supabaseClient)return setLoginMessage("Supabase could not load."); const {data:result,error}=await supabaseClient.auth.signInWithPassword({email:val("loginEmail"),password:val("loginPassword")}); if(error)return setLoginMessage(error.message); data.user={id:result.user.id,email:result.user.email}; localStorage.setItem(STORAGE_KEY,JSON.stringify(data,null,2)); await loadFromCloud(false); data.activeSeriesId=null; data.activeBookId=null; updateAuthGate()}
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
function setView(view,id=null,extra=null){saveCurrentScene(false,false); if(view==="write"){if(id)data.activeChapterId=id; if(extra)data.activeSceneId=extra; if(!data.activeSceneId)data.activeSceneId=activeChapter()?.scenes?.[0]?.id||null} if(view==="characterDetail"&&id)data.selectedCharacterId=id; document.querySelectorAll(".view").forEach(v=>v.classList.remove("active")); document.getElementById(view).classList.add("active"); const titles={overview:"Overview",write:"Scene-Based Writing",storyBoard:"Story Structure Board",chapters:"Chapter Planner",threads:"Plot Threads",mysteries:"Mystery Tracker",foreshadowing:"Foreshadowing Tracker",plotBoard:"Plot Board",characters:"Characters",characterDetail:"Character Detail",relationships:"Relationship System",locations:"Locations",magic:"Magic System",organizations:"Organizations",scenes:"Scene Database",timeline:"Timeline",world:"Worldbuilding Notes",seriesTools:"Series-Level Tools",music:"Project Playlist",stats:"Writing Analytics",exports:"Export",backup:"Backup"}; setText("viewTitle",titles[view]||"Workspace"); renderAll()}
function renderNestedNav(){const nav=document.getElementById("nestedNav"); if(!nav)return; const book=activeBook(); const chapters=book?.manuscript||[]; const plans=data.chapterPlans.filter(visibleByScope); const threads=data.threads.filter(visibleByScope); const roles=["Main","Side","Love Interest","Antagonist","Mentor","Other"]; const charsByRole=role=>data.characters.filter(c=>visibleByScope(c)&&(c.role||"Other")===role); const seriesOnly=isSeriesProject(); nav.innerHTML=`
<div class="nav-section"><button class="nav-parent" onclick="setView('overview')"><span class="nav-label">Overview</span><span>⌂</span></button></div>
<div class="nav-section"><button class="nav-parent" onclick="setView('write')"><span class="nav-label">Manuscript</span><span class="nav-count">${chapters.length}</span></button><div class="nav-children">${chapters.map((c,i)=>`<button class="nav-child" onclick="setView('write','${c.id}')"><span>${i+1}. ${escapeHTML(c.title||"Untitled")}</span><span class="nav-count">${(c.scenes||[]).length}</span></button>${(c.scenes||[]).map((s,j)=>`<button class="nav-grandchild" onclick="setView('write','${c.id}','${s.id}')">${j+1}. ${escapeHTML(s.title||"Scene")}</button>`).join("")}`).join("")}</div></div>
<div class="nav-section"><button class="nav-parent"><span class="nav-label">Plot</span><span>▾</span></button><div class="nav-children"><button class="nav-child" onclick="setView('storyBoard')">Story Structure</button><button class="nav-child" onclick="setView('chapters')"><span>Chapter Planner</span><span class="nav-count">${plans.length}</span></button>${plans.map(p=>`<button class="nav-grandchild" onclick="setView('chapters')">${escapeHTML(p.number||"Untitled")}</button>`).join("")}<button class="nav-child" onclick="setView('threads')"><span>Plot Threads</span><span class="nav-count">${threads.length}</span></button>${threads.map(t=>`<button class="nav-grandchild" onclick="setView('threads')">${escapeHTML(t.title||"Untitled")}</button>`).join("")}<button class="nav-child" onclick="setView('mysteries')">Mystery Tracker</button><button class="nav-child" onclick="setView('foreshadowing')">Foreshadowing</button><button class="nav-child" onclick="setView('plotBoard')">Plot Board</button></div></div>
<div class="nav-section"><button class="nav-parent" onclick="setView('characters')"><span class="nav-label">Characters</span><span class="nav-count">${data.characters.filter(visibleByScope).length}</span></button><div class="nav-children">${roles.map(role=>`<button class="nav-child" onclick="setView('characters')"><span>${role}</span><span class="nav-count">${charsByRole(role).length}</span></button>${charsByRole(role).map(c=>`<button class="nav-grandchild" onclick="setView('characterDetail','${c.id}')">${escapeHTML(c.name||"Unnamed")}</button>`).join("")}`).join("")}</div></div>
<div class="nav-section"><button class="nav-parent"><span class="nav-label">Worldbuilding</span><span>▾</span></button><div class="nav-children"><button class="nav-child" onclick="setView('locations')">Locations</button><button class="nav-child" onclick="setView('magic')">Magic System</button><button class="nav-child" onclick="setView('organizations')">Organizations</button><button class="nav-child" onclick="setView('world')">Cultures / Species / Artifacts</button><button class="nav-child" onclick="setView('scenes')">Scene Database</button><button class="nav-child" onclick="setView('relationships')">Relationships</button><button class="nav-child" onclick="setView('timeline')">Timeline</button></div></div>
${seriesOnly?`<div class="nav-section"><button class="nav-parent" onclick="setView('seriesTools')"><span class="nav-label">Series Tools</span><span>★</span></button></div>`:""}
<div class="nav-section"><button class="nav-parent" onclick="setView('music')"><span class="nav-label">Project Playlist</span><span>♫</span></button><button class="nav-parent" onclick="setView('stats')"><span class="nav-label">Writing Analytics</span><span>↗</span></button><button class="nav-parent" onclick="setView('exports')"><span class="nav-label">Export</span><span>⇩</span></button><button class="nav-parent" onclick="setView('backup')"><span class="nav-label">Backup</span><span>☁</span></button></div>`}

function addManuscriptChapter(){const book=activeBook(); if(!book)return alert("Open a book first."); saveCurrentScene(false,false); const scene={id:uid(),title:"Scene 1",content:"",pov:"",locationId:"",date:"",mood:"",purpose:"",created:new Date().toISOString()}; const ch={id:uid(),title:`Chapter ${(book.manuscript||[]).length+1}`,scenes:[scene],created:new Date().toISOString()}; book.manuscript.push(ch); data.activeChapterId=ch.id; data.activeSceneId=scene.id; saveData()}
function addSceneToActiveChapter(){const ch=activeChapter(); if(!ch)return alert("Select a chapter first."); saveCurrentScene(false,false); if(!ch.scenes)ch.scenes=[]; const scene={id:uid(),title:`Scene ${ch.scenes.length+1}`,content:"",pov:"",locationId:"",date:"",mood:"",purpose:"",created:new Date().toISOString()}; ch.scenes.push(scene); data.activeSceneId=scene.id; saveData()}
function selectScene(chapterId,sceneId){setView("write",chapterId,sceneId)}
function saveCurrentScene(render=false,scheduleCloud=true){if(isRendering)return; const scene=activeScene(); const ch=activeChapter(); const editor=document.getElementById("richEditor"); if(!scene||!ch||!editor)return; ch.title=val("currentChapterTitle")||ch.title; scene.title=val("currentSceneTitle")||scene.title; scene.pov=val("scenePOV"); scene.locationId=val("sceneLocation"); scene.date=val("sceneDate"); scene.mood=val("sceneMood"); scene.purpose=val("scenePurpose"); scene.content=editor.innerHTML; setText("autosaveStatus","Saving..."); saveData(render,scheduleCloud); updateEditorStats()}
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
function renderAll(){if(!data.user?.id){updateAuthGate();return} ensureProject(); if(!data.activeSeriesId||!data.activeBookId){updateAuthGate();return} applyTheme(); renderOverview(); renderSelects(); renderManuscript(); renderAllLists(); renderMusic(); renderRawData(); renderAccount(); renderNestedNav(); runSearch()}

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
document.getElementById("clearSearch").addEventListener("click",()=>{setVal("globalSearch","");runSearch()});

initSupabase();
refreshSession().then(()=>{if(data.user?.id){loadFromCloud(false).then(()=>{data.activeSeriesId=null;data.activeBookId=null;updateAuthGate()})}else updateAuthGate()});
