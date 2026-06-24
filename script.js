const STORAGE_KEY = "plotpals"; // Legacy local project-data key, used only for one-time migration.
const UI_STORAGE_KEY = "plotpals_ui_preferences";
const CLOUD_TABLE = "writer_vaults";

const defaultData = {
  activeSeriesId: null, activeBookId: null, activeChapterId: null, activeSceneId: null, selectedCharacterId: null,
  user: null, series: [], books: [], characters: [], relationships: [], timeline: [], chapterPlans: [], threads: [],
  scenes: [], world: [], locations: [], magicSystems: [], organizations: [], mysteries: [], foreshadowing: [], plotArcs: [], plotCards: [],
  structureBeats: [], seriesArcs: [], themeTracks: [], bookHandoffs: [], seriesMilestones: [], music: {}, theme: 'dark', pinnedNote: '', libraryView: 'stories', lastOpened: null, currentView: 'projectDashboard', trash: [], backups: [], searchFilter: 'all', sprint: {goalWords:500, minutes:25, running:false, startedAt:null, pausedRemaining:null, startWords:0}
};

let supabaseClient = null;
let data = loadData();
let cloudSaveTimer = null;
let cloudLoaded = false;
let isMigratingLegacyLocalData = false;
let authMode = "login";
let isRendering = false;
let sprintTimer = null;
let draggedScenePayload = null;

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
  if(!window.WRITERS_VAULT_SUPABASE_URL || !window.WRITERS_VAULT_SUPABASE_KEY){ setLoginMessage("Supabase credentials are missing. Cloud login is disabled until they are added."); return; }
  supabaseClient = window.supabase.createClient(window.WRITERS_VAULT_SUPABASE_URL, window.WRITERS_VAULT_SUPABASE_KEY);
}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2)}
function loadUiPrefs(){
  try{return JSON.parse(localStorage.getItem(UI_STORAGE_KEY)||"{}")}catch{return {}}
}
function saveUiPrefs(){
  try{
    const prefs={
      theme:data.theme||"dark",
      libraryView:data.libraryView||"stories",
      currentView:data.currentView||"projectDashboard",
      activeSeriesId:data.activeSeriesId||null,
      activeBookId:data.activeBookId||null,
      activeChapterId:data.activeChapterId||null,
      activeSceneId:data.activeSceneId||null,
      manuscriptSidebarCollapsed:!!data.manuscriptSidebarCollapsed,
      editorCollapsedChapters:data.editorCollapsedChapters||{},
      lastOpened:data.lastOpened||null,
      searchFilter:data.searchFilter||"all"
    };
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(prefs));
  }catch(err){ console.warn("Could not save UI preferences.", err); }
}
function loadData(){
  const prefs=loadUiPrefs();
  return {...structuredClone(defaultData),...prefs};
}
function saveData(render=true,scheduleCloud=true){
  ensureCollections();
  makeBackupSnapshot();
  saveUiPrefs();
  if(render) renderAll();
  if(scheduleCloud) scheduleCloudSave();
}
function val(id){return document.getElementById(id)?.value.trim()||""}
function setVal(id,value){const el=document.getElementById(id); if(el) el.value=value||""}
function setText(id,value){const el=document.getElementById(id); if(el) el.textContent=value}
function setHTML(id,html){const el=document.getElementById(id); if(el) el.innerHTML=html}
function safeFileName(name="file"){
  return String(name).replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/-+/g,"-").slice(0,90) || "file";
}
function supabaseMediaReady(){
  return !!(supabaseClient && data.user?.id && window.PLOTPALS_SUPABASE_MEDIA_BUCKET !== false);
}
function mediaBucketName(){ return window.PLOTPALS_SUPABASE_MEDIA_BUCKET || "plotpals-media"; }
async function uploadMediaToSupabase(file, folder="media"){
  if(!supabaseMediaReady()) throw new Error("Supabase media storage is not configured or user is not logged in.");
  const bucket = mediaBucketName();
  const seriesId = data.activeSeriesId || "library";
  const path = `${data.user.id}/${seriesId}/${folder}/${Date.now()}-${uid()}-${safeFileName(file.name || "upload")}`;
  const { error } = await supabaseClient.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined
  });
  if(error) throw error;
  const { data: publicData } = supabaseClient.storage.from(bucket).getPublicUrl(path);
  let url = publicData?.publicUrl || "";
  if(!url){
    const signed = await supabaseClient.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
    url = signed.data?.signedUrl || "";
  }
  return { storage:"supabase", bucket, path, url };
}
async function deleteSupabaseMedia(bucket, path){
  if(!supabaseClient || !bucket || !path) return false;
  try{
    const { error } = await supabaseClient.storage.from(bucket).remove([path]);
    return !error;
  }catch(err){ return false; }
}
function blobToDataURL(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=reject;
    reader.readAsDataURL(blob);
  });
}
function compressImageFile(file){
  return new Promise((resolve)=>{
    if(file.type.includes("gif") || file.type.includes("svg")) return resolve(file);
    const reader=new FileReader();
    reader.onload=()=>{
      const original=reader.result;
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
          canvas.toBlob(blob=>{
            if(!blob) return resolve(file);
            resolve(new File([blob], (file.name||"image").replace(/\.[^/.]+$/,"") + ".jpg", { type:"image/jpeg" }));
          }, "image/jpeg", 0.86);
        }catch(e){ resolve(file); }
      };
      img.onerror=()=>resolve(file);
      img.src=original;
    };
    reader.onerror=()=>resolve(file);
    reader.readAsDataURL(file);
  });
}
async function readImageUpload(input,onDone){
  const file=input?.files?.[0];
  if(!file) return;
  if(!file.type || !file.type.startsWith("image/")){ alert("Please choose an image file."); if(input) input.value=""; return; }
  try{
    const uploadFile = await compressImageFile(file);
    if(!supabaseMediaReady()){
      alert("Please log in and configure Supabase Storage before uploading images. Project media is no longer saved in browser storage.");
      return;
    }
    const uploaded = await uploadMediaToSupabase(uploadFile, "images");
    onDone(uploaded.url, uploaded);
    if(input) input.value="";
    return;
  }catch(err){
    alert("This image could not be uploaded. Please try a different file.");
  }
  if(input) input.value="";
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

function notDeleted(item){return !item?.deletedAt}
function activeItem(collection,id){return (data[collection]||[]).find(item=>item.id===id && notDeleted(item))||null}
function collectionLabel(collection){return ({characters:"Character",relationships:"Relationship",timeline:"Timeline Event",chapterPlans:"Chapter Plan",threads:"Plot Thread",world:"World Building Entry",locations:"Location",magicSystems:"Magic System",organizations:"Organization",mysteries:"Mystery",foreshadowing:"Foreshadowing",plotCards:"Plot Point",plotArcs:"Plot Arc",structureBeats:"Structure Beat",books:"Book",manuscriptChapters:"Chapter",manuscriptScenes:"Scene"}[collection]||collection)}
function makeBackupSnapshot(reason="Auto-save"){
  if(!data.backups)data.backups=[];
  const now=Date.now();
  const last=Number(data._lastBackupAt||0);
  if(reason==="Auto-save" && now-last<60000)return;
  const snapshot=JSON.stringify({...data,backups:[],_lastBackupAt:now});
  data.backups.unshift({id:uid(),reason,created:new Date().toISOString(),snapshot});
  data.backups=data.backups.slice(0,10);
  data._lastBackupAt=now;
}
function renderBackupSnapshots(){
  const el=document.getElementById("backupSnapshots"); if(!el)return;
  const backups=data.backups||[];
  el.innerHTML=backups.length?backups.map(b=>`<article class="item-card"><div class="card-header"><h3>${escapeHTML(b.reason||"Backup")}</h3><span class="tag">${escapeHTML(new Date(b.created).toLocaleString())}</span></div><button onclick="restoreBackupSnapshot('${b.id}')">Restore Backup</button><button class="delete-btn" onclick="deleteBackupSnapshot('${b.id}')">Delete Backup</button></article>`).join(""):`<p class="muted">No automatic backup snapshots yet. A snapshot is created during saves.</p>`;
}
function restoreBackupSnapshot(id){
  const b=(data.backups||[]).find(x=>x.id===id); if(!b)return;
  if(!confirm("Restore this backup? Current local changes will be replaced."))return;
  const user=data.user;
  try{ data={...structuredClone(defaultData),...JSON.parse(b.snapshot)}; data.user=user||data.user; saveData(true,false); alert("Backup restored."); }catch(e){ alert("This backup could not be restored."); }
}
function deleteBackupSnapshot(id){data.backups=(data.backups||[]).filter(b=>b.id!==id); saveData(true,false)}
function renderTrashManager(){
  const el=document.getElementById("trashManager"); if(!el)return;
  const trash=(data.trash||[]).filter(t=>t.seriesId===data.activeSeriesId || !t.seriesId);
  el.innerHTML=trash.length?trash.map(t=>`<article class="item-card"><div class="card-header"><h3>${escapeHTML(t.title||"Deleted Item")}</h3><span class="tag">${escapeHTML(collectionLabel(t.collection))}</span></div><p class="muted">Deleted ${escapeHTML(new Date(t.deletedAt).toLocaleString())}</p><button onclick="restoreDeletedItem('${t.id}')">Restore</button><button class="delete-btn" onclick="permanentlyDeleteItem('${t.id}')">Delete Forever</button></article>`).join(""):`<p class="muted">Trash is empty.</p>`;
}
function restoreDeletedItem(trashId){
  const t=(data.trash||[]).find(x=>x.id===trashId); if(!t)return;
  const item={...(t.item||{})}; delete item.deletedAt;
  if(t.collection==="manuscriptChapters"){
    const book=(data.books||[]).find(b=>b.id===t.bookId); if(book){ if(!book.manuscript)book.manuscript=[]; book.manuscript.push(item); }
  }else if(t.collection==="manuscriptScenes"){
    const book=(data.books||[]).find(b=>b.id===t.bookId); const chapter=(book?.manuscript||[]).find(ch=>ch.id===t.chapterId); if(ch){ if(!ch.scenes)ch.scenes=[]; ch.scenes.push(item); }
  }else{
    if(!data[t.collection])data[t.collection]=[];
    const existing=data[t.collection].find(x=>x.id===item.id);
    if(existing)Object.assign(existing,item); else data[t.collection].push(item);
  }
  data.trash=data.trash.filter(x=>x.id!==trashId);
  saveData(true);
}
function permanentlyDeleteItem(trashId){if(!confirm("Permanently delete this item?"))return; data.trash=(data.trash||[]).filter(x=>x.id!==trashId); saveData(true)}
function storageHealthMessage(){
  const hasLegacy = !!localStorage.getItem(STORAGE_KEY);
  return hasLegacy ? "Legacy browser data found. Use Import Legacy Local Data to move it into Supabase, then remove it from this browser." : "Project data is cloud-first. Only small UI preferences are stored in this browser.";
}
function activeSeries(){return data.series.find(s=>s.id===data.activeSeriesId)||null}
function activeBook(){return data.books.find(b=>b.id===data.activeBookId && notDeleted(b))||null}
function activeChapter(){const b=activeBook(); return (b?.manuscript||[]).find(c=>c.id===data.activeChapterId)||null}
function activeScene(){const ch=activeChapter(); return (ch?.scenes||[]).find(s=>s.id===data.activeSceneId)||null}
function isSeriesProject(){return (activeSeries()?.type||"series")==="series"}
function ensureCollections(){["series","books","characters","relationships","timeline","chapterPlans","threads","scenes","world","locations","magicSystems","organizations","mysteries","foreshadowing","plotArcs","plotCards","structureBeats","seriesArcs","themeTracks","bookHandoffs","seriesMilestones"].forEach(k=>{if(!data[k])data[k]=[]}); if(!data.music)data.music={}; if(!data.worldCategories)data.worldCategories=[]; if(!data.trash)data.trash=[]; if(!data.backups)data.backups=[]; if(!data.searchFilter)data.searchFilter='all'; if(!data.theme)data.theme="dark"; if(!data.libraryView)data.libraryView="stories"; if(!data.currentView)data.currentView="projectDashboard"; if(!data.editorCollapsedChapters)data.editorCollapsedChapters={}; if(typeof data.manuscriptSidebarCollapsed!=="boolean")data.manuscriptSidebarCollapsed=false; if(!data.sprint)data.sprint={goalWords:500,minutes:25,running:false,startedAt:null,pausedRemaining:null,startWords:0}; }
function ensureProject(){ensureCollections(); const b=activeBook(); if(b){if(!b.manuscript)b.manuscript=[]; if(!b.manuscript.length){const scene={id:uid(),title:"Scene 1",content:"",pov:"",locationId:"",date:"",mood:"",purpose:"",characterIds:[],organizationIds:[],magicSystemIds:[],itemArtifactIds:[],floraFaunaIds:[],locationIds:[],plotCardId:"",created:new Date().toISOString()}; const ch={id:uid(),title:"Chapter One",scenes:[scene],created:new Date().toISOString()}; b.manuscript.push(ch); data.activeChapterId=ch.id; data.activeSceneId=scene.id} b.manuscript.forEach(ch=>{if(!ch.scenes){ch.scenes=[{id:uid(),title:ch.title||"Scene 1",content:ch.content||"",pov:"",locationId:"",date:"",mood:"",purpose:"",characterIds:[],organizationIds:[],magicSystemIds:[],itemArtifactIds:[],floraFaunaIds:[],locationIds:[],plotCardId:"",created:ch.created||new Date().toISOString()}]; delete ch.content} (ch.scenes||[]).forEach(sc=>{if(!Array.isArray(sc.characterIds))sc.characterIds=[]; if(!Array.isArray(sc.organizationIds))sc.organizationIds=[]; if(!Array.isArray(sc.magicSystemIds))sc.magicSystemIds=[]; if(!Array.isArray(sc.itemArtifactIds))sc.itemArtifactIds=[]; if(!Array.isArray(sc.floraFaunaIds))sc.floraFaunaIds=[]; if(!Array.isArray(sc.locationIds))sc.locationIds=[]; if(sc.locationId && !sc.locationIds.includes(sc.locationId))sc.locationIds.unshift(sc.locationId); if(typeof sc.plotCardId!=="string")sc.plotCardId="";});}); if(!data.activeChapterId)data.activeChapterId=b.manuscript[0]?.id||null; if(!data.activeSceneId)data.activeSceneId=activeChapter()?.scenes?.[0]?.id||null}}

function switchAuthMode(mode){authMode=mode;document.getElementById("loginTab").classList.toggle("active",mode==="login");document.getElementById("signupTab").classList.toggle("active",mode==="signup");document.getElementById("authSubmitBtn").textContent=mode==="login"?"Login":"Create Account";setLoginMessage("")}
async function submitAuth(){return authMode==="login"?signIn():signUp()}
function setLoginMessage(message){const el=document.getElementById("loginMessage"); if(el)el.textContent=message||""}
function setProjectMessage(message){const el=document.getElementById("projectMessage"); if(el)el.textContent=message||""}
async function refreshSession(){if(!supabaseClient)return; const {data:sessionData}=await supabaseClient.auth.getSession(); const user=sessionData?.session?.user||null; data.user=user?{id:user.id,email:user.email}:null; saveUiPrefs(); updateAuthGate()}
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
  await loadFromCloud(false);
  await offerLegacyLocalMigration();
  data.activeSeriesId=null; data.activeBookId=null;
  saveUiPrefs();
  setLoginMessage("");
  updateAuthGate();
}
async function signOut(){if(supabaseClient)await supabaseClient.auth.signOut(); data={...structuredClone(defaultData),...loadUiPrefs(),user:null,activeSeriesId:null,activeBookId:null,activeChapterId:null,activeSceneId:null}; cloudLoaded=false; saveUiPrefs(); updateAuthGate()}
async function sendPasswordResetFromLogin(){if(!supabaseClient)return setLoginMessage("Supabase could not load."); const email=val("loginEmail"); if(!email)return setLoginMessage("Enter your email first."); const {error}=await supabaseClient.auth.resetPasswordForEmail(email); setLoginMessage(error?error.message:"Password reset email sent.")}
function renderAccount(){setText("accountStatus",data.user?.email||"Not signed in"); setText("syncStatus",data.user?.id?"Signed in. Cloud auto-save enabled. No project data is saved to browser storage.":"Login required.")}

function readLegacyLocalData(){
  const raw=localStorage.getItem(STORAGE_KEY);
  if(!raw) return null;
  try{return JSON.parse(raw)}catch{return null}
}
async function importLegacyLocalDataToSupabase(){
  if(!data.user?.id || !supabaseClient){ alert("Login to Supabase first."); return; }
  const legacy=readLegacyLocalData();
  if(!legacy){ alert("No legacy local project data was found in this browser."); return; }
  if(!confirm("Import legacy browser project data into Supabase? This will replace the currently loaded cloud workspace after it syncs.")) return;
  const user=data.user;
  data={...structuredClone(defaultData),...legacy,user};
  ensureCollections();
  setText("syncStatus","Migrating legacy media to Supabase...");
  await migrateEmbeddedMediaToSupabase();
  isMigratingLegacyLocalData=true;
  await syncToCloud(false);
  isMigratingLegacyLocalData=false;
  localStorage.removeItem(STORAGE_KEY);
  saveUiPrefs();
  renderAll();
  alert("Legacy local project data was imported into Supabase and removed from browser project storage.");
}
async function offerLegacyLocalMigration(){
  const legacy=readLegacyLocalData();
  if(!legacy || isMigratingLegacyLocalData) return;
  const hasLegacyContent=(legacy.series||[]).length || (legacy.books||[]).length || (legacy.characters||[]).length || (legacy.world||[]).length;
  if(!hasLegacyContent) return;
  if(confirm("Legacy PlotPals data was found in this browser. Import it into Supabase now and stop using local project storage?")){
    await importLegacyLocalDataToSupabase();
  }
}
function clearLegacyLocalProjectData(){
  if(!localStorage.getItem(STORAGE_KEY)){ alert("No legacy local project data found."); return; }
  if(!confirm("Remove legacy local project data from this browser? This does not delete Supabase cloud data.")) return;
  localStorage.removeItem(STORAGE_KEY);
  alert("Legacy local project data removed. PlotPals will keep using Supabase for project saves.");
  renderAll();
}

async function uploadDataUrlToSupabase(dataUrl, folder, name="upload"){
  if(!dataUrl || typeof dataUrl!=="string" || !dataUrl.startsWith("data:")) return null;
  if(!supabaseMediaReady()) return null;
  const blob=await (await fetch(dataUrl)).blob();
  const ext=(blob.type||"").split("/")[1] || "bin";
  const file=new File([blob], `${safeFileName(name)}.${ext}`, {type:blob.type});
  return uploadMediaToSupabase(file, folder);
}
async function migrateEmbeddedMediaToSupabase(){
  if(!supabaseMediaReady()) return;
  const migrateImageField=async(item, field="image", folder="images")=>{
    if(item && typeof item[field]==="string" && item[field].startsWith("data:")){
      try{ const uploaded=await uploadDataUrlToSupabase(item[field], folder, item.name||item.title||field); if(uploaded) item[field]=uploaded.url; }catch(err){ console.warn("Embedded image migration failed", err); }
    }
  };
  for(const book of data.books||[]) await migrateImageField(book,"cover","covers");
  for(const c of data.characters||[]){ await migrateImageField(c,"photo","characters"); await migrateImageField(c,"image","characters"); }
  for(const item of data.world||[]) await migrateImageField(item,"image","worldbuilding");
  for(const item of data.locations||[]) await migrateImageField(item,"image","locations");
  for(const item of data.organizations||[]) await migrateImageField(item,"image","organizations");
  for(const item of data.magicSystems||[]) await migrateImageField(item,"image","magic-systems");
  const musicGroups=Object.values(data.music||{});
  for(const music of musicGroups){
    for(const track of music.tracks||[]){
      try{
        let file=null;
        if(typeof track.src==="string" && track.src.startsWith("data:")){
          const blob=await (await fetch(track.src)).blob();
          file=new File([blob], safeFileName(track.fileName||track.title||"track"), {type:blob.type||track.type||"audio/mpeg"});
        }else if(track.storage==="indexeddb"){
          const blob=await getMusicBlob(track.id);
          if(blob) file=new File([blob], safeFileName(track.fileName||track.title||"track"), {type:blob.type||track.type||"audio/mpeg"});
        }
        if(file){
          const uploaded=await uploadMediaToSupabase(file,"audio");
          track.storage="supabase"; track.bucket=uploaded.bucket; track.path=uploaded.path; track.src=uploaded.url;
          if(track.storage==="indexeddb") await deleteMusicBlob(track.id);
        }
      }catch(err){ console.warn("Embedded audio migration failed", err); }
    }
  }
}


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
  ["characters","relationships","timeline","chapterPlans","threads","scenes","world","locations","magicSystems","organizations","mysteries","foreshadowing","plotArcs","plotCards","structureBeats","seriesArcs","themeTracks","bookHandoffs","seriesMilestones"].forEach(k=>{data[k]=(data[k]||[]).filter(item=>item.seriesId!==seriesId&&!bookIds.includes(item.bookId));});
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
  renderDashboardDailyWordChart();

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
  if(track.storage === "supabase"){
    if(track.src) return track.src;
    if(supabaseClient && track.bucket && track.path){
      const { data: publicData } = supabaseClient.storage.from(track.bucket).getPublicUrl(track.path);
      if(publicData?.publicUrl){ track.src = publicData.publicUrl; return track.src; }
      const signed = await supabaseClient.storage.from(track.bucket).createSignedUrl(track.path, 60 * 60 * 24 * 7);
      if(signed.data?.signedUrl){ track.src = signed.data.signedUrl; return track.src; }
    }
  }
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
  let supabaseCount = 0;
  setText("musicUploadStatus", "Uploading music into this project...");
  for(const file of files){
    if(!file.type.startsWith("audio/")) continue;
    const id = uid();
    const baseTrack = { id, title: file.name.replace(/\.[^/.]+$/, ""), fileName: file.name, type: file.type, size: file.size, uploadedAt:new Date().toISOString() };
    if(!supabaseMediaReady()){
      alert("Please log in and configure Supabase Storage before uploading music. Audio is no longer saved in browser storage.");
      continue;
    }
    try{
      const uploaded = await uploadMediaToSupabase(file, "audio");
      music.tracks.push({ ...baseTrack, storage:"supabase", bucket:uploaded.bucket, path:uploaded.path, src:uploaded.url });
      supabaseCount++;
      added++;
    }catch(err){
      console.warn("Supabase audio upload failed.", err);
      alert(`Could not upload ${file.name} to Supabase Storage. Check the plotpals-media bucket and storage policies.`);
    }
  }
  if(!music.playlists.length){
    const pl = { id: uid(), name: "Project Playlist", trackIds: music.tracks.map(t=>t.id) };
    music.playlists.push(pl);
    music.activePlaylistId = pl.id;
  }
  event.target.value = "";
  const detail = supabaseCount ? " to Supabase Storage" : "";
  setText("musicUploadStatus", added ? `${added} music file(s) uploaded${detail}.` : "No audio files were selected.");
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
      refreshGlobalMusicControls();
    });
    audio.addEventListener("pause", ()=>{ syncMusicPlayers(audio === page ? "page" : "global"); refreshGlobalMusicControls(); });
    audio.addEventListener("seeked", ()=>syncMusicPlayers(audio === page ? "page" : "global"));
    audio.addEventListener("timeupdate", ()=>{
      if(audio.paused) return;
      const other = audio === page ? global : page;
      if(other && other.paused) syncMusicPlayers(audio === page ? "page" : "global");
    });
    audio.addEventListener("volumechange", refreshGlobalMusicControls);
    audio.addEventListener("ended", ()=>{ refreshGlobalMusicControls(); playNextMusicTrack(); });
  });
  if(state.src){
    [page, global].filter(Boolean).forEach(audio=>{ if(audio.src !== state.src) audio.src = state.src; });
  }
  updateMusicNowPlaying(state.title);
  refreshGlobalMusicControls();
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
function refreshGlobalMusicControls(){
  const audio = document.getElementById("globalAudioMirror");
  const btn = document.getElementById("globalMusicPlayPause");
  const volume = document.getElementById("globalMusicVolume");
  if(btn) btn.textContent = audio && !audio.paused ? "⏸" : "▶";
  if(audio && volume && document.activeElement !== volume) volume.value = audio.volume;
}
function toggleGlobalMusicPlayback(){
  const audio = document.getElementById("globalAudioMirror") || document.getElementById("plotpalsAudioPlayer");
  if(!audio) return;
  if(audio.paused) audio.play().catch(()=>{});
  else audio.pause();
  setTimeout(refreshGlobalMusicControls, 80);
}
function setGlobalMusicVolume(value){
  const vol = Math.max(0, Math.min(1, Number(value)));
  [document.getElementById("globalAudioMirror"), document.getElementById("plotpalsAudioPlayer")].filter(Boolean).forEach(audio=>{ audio.volume = vol; });
}

function renderGlobalMusicPlayer(){
  const el = document.getElementById("globalMusicPlayer");
  if(!el) return;
  const music = musicForProject();
  const hasTracks = music.tracks && music.tracks.length;
  if(!hasTracks){ el.innerHTML = ""; return; }
  if(!document.getElementById("globalAudioMirror")){
    el.innerHTML = `<div class="global-music-inner">
      <div class="global-music-label"><small class="global-music-kicker">Now Playing</small><span id="globalMusicNowPlaying">Project Music Player</span></div>
      <div class="global-music-controls" aria-label="Project music controls">
        <button id="globalMusicPlayPause" class="global-music-btn" type="button" onclick="toggleGlobalMusicPlayback()" title="Play/Pause">▶</button>
        <button class="global-music-btn" type="button" onclick="playNextMusicTrack()" title="Next Track">⏭</button>
        <input id="globalMusicVolume" class="global-music-volume" type="range" min="0" max="1" step="0.01" value="0.75" title="Volume" oninput="setGlobalMusicVolume(this.value)" />
      </div>
      <audio id="globalAudioMirror" preload="metadata"></audio>
    </div>`;
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
function isPovBook(book){return book?.isPov !== false}
function makeStarterBook(seriesId,name,isPov=true){const scene={id:uid(),title:"Scene 1",content:"",pov:"",locationId:"",date:"",mood:"",purpose:"",characterIds:[],organizationIds:[],magicSystemIds:[],itemArtifactIds:[],floraFaunaIds:[],locationIds:[],plotCardId:"",created:new Date().toISOString()}; return {id:uid(),seriesId,title:name,status:"Planning",summary:"",theme:"",notes:"",cover:"",isPov:isPov!==false,manuscript:[{id:uid(),title:"Chapter One",scenes:[scene],created:new Date().toISOString()}],created:new Date().toISOString()}}
function createStandaloneBook(name,isPov=true){const series={id:uid(),title:name,type:"standalone",genre:"",synopsis:"",theme:"",mysteries:"",foreshadowing:"",created:new Date().toISOString()}; data.series.push(series); data.books.push(makeStarterBook(series.id,name,isPov)); return series;}
function createSeriesFromProject(){const type=val("newProjectType")||"series"; const bookTitle=val("newBookTitle"); const seriesTitle=val("newSeriesTitle"); const isPov=document.getElementById("newBookIsPov")?.checked!==false; if(type==="standalone"){const name=bookTitle||seriesTitle||"Untitled Book"; createStandaloneBook(name,isPov); clearFields(["newSeriesTitle","newBookTitle"]); saveData(false); renderProjectScreen(); return setProjectMessage("Standalone book created. No Series/Project Title required.");} const name=seriesTitle||"Untitled Series"; const series={id:uid(),title:name,type,genre:"",synopsis:"",theme:"",mysteries:"",foreshadowing:"",created:new Date().toISOString()}; data.series.push(series); setVal("newSeriesTitle",""); saveData(false); renderProjectScreen(); setProjectMessage("Series created. Now create/select a book.")}
function createBookFromProject(){let seriesId=val("newBookSeriesSelect"); const name=val("newBookTitle")||"Untitled Book"; const isPov=document.getElementById("newBookIsPov")?.checked!==false; if(!seriesId){const series=createStandaloneBook(name,isPov); seriesId=series.id;} else {data.books.push(makeStarterBook(seriesId,name,isPov));} setVal("newBookTitle",""); const povBox=document.getElementById("newBookIsPov"); if(povBox)povBox.checked=true; saveData(false); renderProjectScreen(); setProjectMessage(seriesId?"Book created.":"Standalone book created.")}
function openWorkspace(){const seriesId=val("projectSeriesSelect"), bookId=val("projectBookSelect"); if(!seriesId||!bookId)return setProjectMessage("Select both a project and a book."); data.activeSeriesId=seriesId; data.activeBookId=bookId; const book=activeBook(); data.activeChapterId=book?.manuscript?.[0]?.id||null; data.activeSceneId=book?.manuscript?.[0]?.scenes?.[0]?.id||null; saveData(); updateAuthGate()}
function backToProjects(){saveCurrentScene(false,false); data.activeSeriesId=null; data.activeBookId=null; saveData(false,false); updateAuthGate()}

function scheduleCloudSave(){if(!data.user?.id||!supabaseClient)return; clearTimeout(cloudSaveTimer); cloudSaveTimer=setTimeout(()=>syncToCloud(false),1600)}
async function syncToCloud(showAlert=true){if(!supabaseClient){if(showAlert)alert("Supabase is not loaded.");return} const currentProject={seriesId:data.activeSeriesId,bookId:data.activeBookId,chapterId:data.activeChapterId,sceneId:data.activeSceneId}; await refreshSession(); data.activeSeriesId=currentProject.seriesId; data.activeBookId=currentProject.bookId; data.activeChapterId=currentProject.chapterId; data.activeSceneId=currentProject.sceneId; if(!data.user?.id){if(showAlert)alert("Login first.");return} const payload={user_id:data.user.id,user_email:data.user.email,vault_data:data,updated_at:new Date().toISOString()}; const {error}=await supabaseClient.from(CLOUD_TABLE).upsert(payload,{onConflict:"user_id"}); if(error){setText("syncStatus","Sync failed."); if(showAlert)alert("Cloud sync failed. Check Supabase table/RLS. "+error.message); return} setText("syncStatus","Synced "+new Date().toLocaleTimeString()); setText("autosaveStatus","Saved"); if(showAlert)alert("Synced to Supabase.")}
async function loadFromCloud(showAlert=true){
  if(!supabaseClient){if(showAlert)alert("Supabase is not loaded.");return}
  const session=await supabaseClient.auth.getSession();
  const user=session.data?.session?.user;
  if(!user){if(showAlert)alert("Login first.");return}
  const prefs=loadUiPrefs();
  const {data:rows,error}=await supabaseClient.from(CLOUD_TABLE).select("vault_data, updated_at").eq("user_id",user.id).limit(1);
  if(error){if(showAlert)alert("Could not load cloud data. "+error.message);return}
  if(!rows||!rows.length||!rows[0].vault_data){
    data={...structuredClone(defaultData),...prefs,user:{id:user.id,email:user.email}};
    ensureCollections();
    cloudLoaded=true;
    saveUiPrefs();
    if(showAlert)alert("No cloud vault found yet. Create or import a project to begin.");
    return;
  }
  data={...structuredClone(defaultData),...rows[0].vault_data,...prefs,user:{id:user.id,email:user.email}};
  ensureCollections();
  cloudLoaded=true;
  saveUiPrefs();
  if(showAlert){renderAll(); alert("Loaded from Supabase.")}
}

function toggleSidebar(){document.getElementById("appShell").classList.toggle("collapsed")}
function setView(view,id=null,extra=null){saveCurrentScene(false,false); data.currentView=view; if(view==="write"){if(id)data.activeChapterId=id; if(extra)data.activeSceneId=extra; if(!data.activeSceneId)data.activeSceneId=activeChapter()?.scenes?.[0]?.id||null} if(view==="characterDetail"&&id){ if(data.selectedCharacterId!==id) characterDetailEditMode=false; data.selectedCharacterId=id; } if(view==="worldDetail"&&id){ if(data.selectedWorldId!==id) worldDetailEditMode=false; data.selectedWorldId=id; } if(view==="worldCategory"&&id){ data.selectedWorldCategory=id; } if(view==="locationDetail"&&id){ if(data.selectedLocationId!==id) locationDetailEditMode=false; data.selectedLocationId=id; } if(view==="magicDetail"&&id){ if(data.selectedMagicId!==id) magicDetailEditMode=false; data.selectedMagicId=id; } if(view==="organizationDetail"&&id){ if(data.selectedOrganizationId!==id) organizationDetailEditMode=false; data.selectedOrganizationId=id; } document.querySelectorAll(".view").forEach(v=>v.classList.remove("active")); const viewEl=(view==="worldCategory"?document.getElementById("worldCategoryView"):(view==="relationshipGraph"?document.getElementById("relationshipGraphView"):document.getElementById(view)))||document.getElementById("projectDashboard"); viewEl?.classList.add("active"); const titles={projectDashboard:"Project Dashboard",overview:"Overview",write:"Scene-Based Writing",storyBoard:"Story Structure Board",chapters:"Chapter Planner",threads:"Plot Threads",mysteries:"Mystery Tracker",foreshadowing:"Foreshadowing Tracker",plotBoard:"Plot Board",sceneBoard:"Scene Cards / Board",characters:"Characters",characterDetail:"Character Detail",relationships:"Relationship System",relationshipGraph:"Relationship Graph",locations:"Locations",locationDetail:"Location Detail",magic:"Magic System",magicDetail:"Magic/System Detail",organizations:"Organizations",organizationDetail:"Organization Detail",scenes:"Scene Database",timeline:"Timeline",world:"Worldbuilding",worldCategory:worldCategoryLabel(data.selectedWorldCategory||"Other"),worldDetail:"Worldbuilding Detail",seriesTools:"Series Dashboard",storyBible:"Story Bible",seriesArcs:"Series Arc Tracker",themeTracker:"Theme Tracker",continuityCenter:"Continuity Center",bookHandoffs:"Book Handoffs",seriesMilestones:"Series Milestones",music:"Project Playlist",stats:"Writing Analytics",exports:"Export",backup:"Backup"}; setText("viewTitle",view==="projectDashboard"?`${activeSeries()?.title||"Project"} Dashboard`:(titles[view]||"Workspace")); renderAll()}
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
  const locs=(data.locations||[]).filter(seriesScope);
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
        <button class="story-nav nav-parent" onclick="setView('sceneBoard')">🎬 Scene Cards / Board</button>
        <button class="story-nav nav-parent" onclick="setView('timeline')">
          <span>⏳ Story Timeline</span><span class="nav-count">${timeline.length}</span>
        </button>
        ${timeline.map(t=>`
          <button class="story-nav nav-grandchild" onclick="setView('timeline')">${escapeHTML(t.when||"Timeline Event")}</button>
        `).join("")}

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
        <button class="story-nav nav-parent" onclick="setView('relationshipGraph')">🕸️ Relationship Graph</button>
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
        <button class="story-nav nav-parent" onclick="setView('seriesTools')">🏛️ Series Dashboard</button>
        <button class="story-nav nav-parent" onclick="setView('storyBible')">📚 Story Bible</button>
        <button class="story-nav nav-parent" onclick="setView('seriesArcs')">
          <span>🧭 Series Arc Tracker</span><span class="nav-count">${(data.seriesArcs||[]).filter(seriesScope).length}</span>
        </button>
        <button class="story-nav nav-parent" onclick="setView('themeTracker')">
          <span>🎭 Theme Tracker</span><span class="nav-count">${(data.themeTracks||[]).filter(seriesScope).length}</span>
        </button>
        <button class="story-nav nav-parent" onclick="setView('foreshadowing')">
          <span>🕯️ Foreshadowing</span><span class="nav-count">${foreshadowing.length}</span>
        </button>
        <button class="story-nav nav-parent" onclick="setView('mysteries')">
          <span>❓ Unresolved Questions</span><span class="nav-count">${mysteries.length}</span>
        </button>
        <button class="story-nav nav-parent" onclick="setView('continuityCenter')">⚠️ Continuity Center</button>
        <button class="story-nav nav-parent" onclick="setView('bookHandoffs')">🔁 Book Handoffs</button>
        <button class="story-nav nav-parent" onclick="setView('seriesMilestones')">✅ Series Milestones</button>
        ${hasBookContext ? `<button class="story-nav nav-parent" onclick="setView('scenes')">
          <span>🎬 Scene Database</span><span class="nav-count">${(activeBook()?.manuscript||[]).flatMap(ch=>ch.scenes||[]).length}</span>
        </button>` : ""}
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
  const locs=(data.locations||[]).filter(seriesScope);
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
  setHTML("sceneTrackingTop","");
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

function addManuscriptChapter(){const book=activeBook(); if(!book)return alert("Open a book first."); saveCurrentScene(false,false); const scene={id:uid(),title:"Scene 1",content:"",pov:"",locationId:"",date:"",mood:"",purpose:"",characterIds:[],organizationIds:[],magicSystemIds:[],itemArtifactIds:[],floraFaunaIds:[],locationIds:[],plotCardId:"",created:new Date().toISOString()}; const ch={id:uid(),title:`Chapter ${(book.manuscript||[]).length+1}`,scenes:[scene],created:new Date().toISOString()}; book.manuscript.push(ch); data.activeChapterId=ch.id; data.activeSceneId=scene.id; saveData()}
function addSceneToActiveChapter(){const ch=activeChapter(); if(!ch)return alert("Select a chapter first."); saveCurrentScene(false,false); if(!ch.scenes)ch.scenes=[]; const scene={id:uid(),title:`Scene ${ch.scenes.length+1}`,content:"",pov:"",locationId:"",date:"",mood:"",purpose:"",characterIds:[],organizationIds:[],magicSystemIds:[],itemArtifactIds:[],floraFaunaIds:[],locationIds:[],plotCardId:"",created:new Date().toISOString()}; ch.scenes.push(scene); data.activeSceneId=scene.id; saveData()}
function selectScene(chapterId,sceneId){setView("write",chapterId,sceneId)}
function saveCurrentScene(render=false,scheduleCloud=true){if(isRendering)return; const scene=activeScene(); const ch=activeChapter(); const book=activeBook(); const editor=document.getElementById("richEditor"); if(!scene||!ch||!editor)return; const oldWords=(scene._lastWordCount ?? countWords(stripHTML(scene.content||""))); const newContent=editor.innerHTML; const newWords=countWords(stripHTML(newContent||"")); ch.title=val("currentChapterTitle")||ch.title; scene.title=val("currentSceneTitle")||scene.title; scene.pov=isPovBook(book)?val("scenePOV"):""; scene.locationId=val("sceneLocation"); if(!Array.isArray(scene.locationIds))scene.locationIds=[]; if(scene.locationId && !scene.locationIds.includes(scene.locationId))scene.locationIds.unshift(scene.locationId); scene.plotCardId=val("scenePlotPoint"); scene.date=val("sceneDate"); scene.mood=val("sceneMood"); scene.purpose=val("scenePurpose"); scene.content=newContent; scene._lastWordCount=newWords; if(newWords>oldWords)trackWordsWritten(data.activeSeriesId,book?.id,newWords-oldWords); setText("autosaveStatus","Saving..."); saveData(render,scheduleCloud); updateEditorStats(); renderDashboardDailyWordChart(); renderProjectDailyWordChart()}
function deleteManuscriptChapter(id){const book=activeBook(); if(!book)return; const ch=(book.manuscript||[]).find(c=>c.id===id); if(!ch)return; if(!confirm("Move this chapter and all scenes to Trash?"))return; data.trash=data.trash||[]; data.trash.unshift({id:uid(),collection:"manuscriptChapters",title:ch.title||"Chapter",seriesId:data.activeSeriesId,bookId:book.id,item:{...ch,deletedAt:new Date().toISOString()},deletedAt:new Date().toISOString()}); book.manuscript=book.manuscript.filter(c=>c.id!==id); data.activeChapterId=book.manuscript[0]?.id||null; data.activeSceneId=book.manuscript[0]?.scenes?.[0]?.id||null; saveData()}
function deleteScene(chId,sceneId){const book=activeBook(); const ch=(book?.manuscript||[]).find(c=>c.id===chId); if(!ch)return; const sc=(ch.scenes||[]).find(s=>s.id===sceneId); if(!sc)return; if(!confirm("Move this scene to Trash?"))return; data.trash=data.trash||[]; data.trash.unshift({id:uid(),collection:"manuscriptScenes",title:`${ch.title||"Chapter"} — ${sc.title||"Scene"}`,seriesId:data.activeSeriesId,bookId:book.id,chapterId:ch.id,item:{...sc,deletedAt:new Date().toISOString()},deletedAt:new Date().toISOString()}); ch.scenes=(ch.scenes||[]).filter(s=>s.id!==sceneId); data.activeSceneId=ch.scenes[0]?.id||null; saveData()}
function moveScene(direction){const ch=activeChapter(); if(!ch?.scenes)return; const index=ch.scenes.findIndex(s=>s.id===data.activeSceneId); const ni=index+direction; if(index<0||ni<0||ni>=ch.scenes.length)return; const [scene]=ch.scenes.splice(index,1); ch.scenes.splice(ni,0,scene); saveData()}
function formatDoc(command){document.execCommand(command,false,null);document.getElementById("richEditor").focus();saveCurrentScene(false)}
function formatBlock(tag){document.execCommand("formatBlock",false,tag);document.getElementById("richEditor").focus();saveCurrentScene(false)}
function insertSceneBreak(){document.execCommand("insertHTML",false,"<p style='text-align:center;'>✦ ✦ ✦</p>");saveCurrentScene(false)}
function toggleFullscreen(){document.getElementById("manuscriptPanel").classList.toggle("fullscreen")}
function updateEditorStats(){const scene=activeScene(); const text=stripHTML(scene?.content||""); const book=activeBook(); const bookWords=(book?.manuscript||[]).flatMap(c=>c.scenes||[]).reduce((sum,s)=>sum+countWords(stripHTML(s.content||"")),0); setText("sceneWordCount",countWords(text)); setText("bookWordCountInline",bookWords); setText("sceneCharCount",text.length); setText("sceneParagraphCount",((scene?.content||"").match(/<p|<div|<h[1-6]/gi)||[]).length||(text.trim()?1:0))}

function scopedItem(scope){return scope==="series"?{scope,seriesId:data.activeSeriesId,bookId:null}:{scope,seriesId:data.activeSeriesId,bookId:data.activeBookId}}
function visibleByScope(item){return notDeleted(item)&&item.seriesId===data.activeSeriesId&&(item.scope==="series"||item.bookId===data.activeBookId)}
function seriesScope(item){return notDeleted(item)&&item.seriesId===data.activeSeriesId}
function characterName(id){return data.characters.find(c=>c.id===id)?.name||"Unknown"}
function locationName(id){return data.locations.find(l=>l.id===id)?.name||""}
function characterRelationships(characterId){return data.relationships.filter(r=>seriesScope(r)&&(r.a===characterId||r.b===characterId))}
function getAppearanceConfig(kind){
  const configs={
    character:{collection:"characters",label:"Character",nameKey:"name",trackedKey:"characterIds"},
    organization:{collection:"organizations",label:"Organization",nameKey:"name",trackedKey:"organizationIds"},
    magic:{collection:"magicSystems",label:"Magic / System",nameKey:"name",trackedKey:"magicSystemIds"},
    location:{collection:"locations",label:"Location",nameKey:"name",trackedKey:"locationIds"},
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
        if(kind==="location" && scene.locationId===itemId && !reasons.includes("scene location"))reasons.push("scene location");
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
  const locationNames=itemNamesFromIds(data.locations,scene.locationIds||[]); const location=scene.locationId?locationName(scene.locationId):""; if(location && !locationNames.includes(location))locationNames.unshift(location);
  const artifacts=itemNamesFromIds(data.world,scene.itemArtifactIds);
  const floraFauna=itemNamesFromIds(data.world,scene.floraFaunaIds);
  const plot=scene.plotCardId?((data.plotCards||[]).find(p=>p.id===scene.plotCardId)?.title||""):"";
  const rows=[
    ["Plot Point",plot?[plot]:[]],
    ["Characters",characters],
    ["Locations",locationNames],
    ["Organizations",organizations],
    ["Magic / Systems",magic],
    ["Items / Artifacts",artifacts],
    ["Flora & Fauna",floraFauna]
  ].filter(([,vals])=>vals.length);
  if(!rows.length)return `<section class="character-section"><h3>Appearances</h3><p class="muted">Nothing has been marked for this scene yet.</p></section>`;
  return `<section class="character-section"><h3>Appearances</h3><div class="appearance-log">${rows.map(([label,vals])=>`<p><strong>${escapeHTML(label)}:</strong> ${vals.map(escapeHTML).join(", ")}</p>`).join("")}</div></section>`;
}

function addChapterPlan(){data.chapterPlans.push({id:uid(),...scopedItem("book"),number:val("chapterNumber"),pov:val("chapterPOV"),wordTarget:val("chapterWordTarget"),structureBeat:val("chapterStructureBeat"),goal:val("chapterGoal"),conflict:val("chapterConflict"),outcome:val("chapterOutcome"),emotion:val("chapterEmotion"),foreshadowing:val("chapterForeshadowing"),created:new Date().toISOString()}); clearFields(["chapterNumber","chapterPOV","chapterWordTarget","chapterGoal","chapterConflict","chapterOutcome","chapterEmotion","chapterForeshadowing"]); saveData()}
function addThread(){data.threads.push({id:uid(),...scopedItem(val("threadScope")),title:val("threadTitle"),type:val("threadType"),status:val("threadStatus"),setup:val("threadSetup"),payoff:val("threadPayoff"),created:new Date().toISOString()}); clearFields(["threadTitle","threadSetup","threadPayoff"]); saveData()}
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
function preserveWorldDetailEditDraft(worldId){
  const w=data.world.find(x=>x.id===worldId); if(!w)return null;
  const nameEl=document.getElementById("editWorldName");
  if(nameEl){
    w.name=val("editWorldName"); w.scope=val("editWorldScope")||w.scope; w.seriesId=w.scope==="series"?data.activeSeriesId:null; w.bookId=w.scope==="book"?data.activeBookId:null;
    w.category=val("editWorldCategory")||w.category||"Other";
    w.basicInfo=val("editWorldBasicInfo"); w.description=val("editWorldDescription"); w.history=val("editWorldHistory");
    w.culture=val("editWorldCulture"); w.rules=val("editWorldRules"); w.plotRelevance=val("editWorldPlotRelevance");
    (w.customSections||[]).forEach(sec=>{
      const t=document.getElementById(`editWorldCustomTitle_${sec.id}`);
      const x=document.getElementById(`editWorldCustomText_${sec.id}`);
      if(t)sec.title=t.value; if(x)sec.text=x.value;
    });
  }
  return w;
}
function addCustomSectionToWorld(worldId){
  const w=preserveWorldDetailEditDraft(worldId); if(!w)return;
  if(!Array.isArray(w.customSections))w.customSections=[];
  w.customSections.push({id:uid(),title:"New Section",text:""});
  worldDetailEditMode=true; saveData(true); renderWorldDetail();
}
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
function preserveEntityDetailEditDraft(kind,id){
  const cfg=getEntityConfig(kind), item=getEntity(kind,id); if(!cfg||!item)return null;
  const nameEl=document.getElementById(`${kind}EditName`);
  if(nameEl){
    item.name=val(`${kind}EditName`);
    if(kind==="location"){item.scope=val(`${kind}EditScope`)||item.scope; item.seriesId=item.scope==="series"?data.activeSeriesId:null; item.bookId=item.scope==="book"?data.activeBookId:null;}
    cfg.fields.forEach(([key])=>{item[key]=val(`${kind}Edit_${key}`)});
    (item.customSections||[]).forEach(sec=>{
      const t=document.getElementById(`${kind}EditCustomTitle_${sec.id}`);
      const x=document.getElementById(`${kind}EditCustomText_${sec.id}`);
      if(t)sec.title=t.value; if(x)sec.text=x.value;
    });
  }
  return item;
}
function addCustomSectionToEntity(kind,id){
  const item=preserveEntityDetailEditDraft(kind,id); if(!item)return;
  if(!Array.isArray(item.customSections))item.customSections=[];
  item.customSections.push({id:uid(),title:"New Section",text:""});
  setEntityEditMode(kind,true); saveData(true); renderEntityDetail(kind);
}
function deleteCustomSectionFromEntity(kind,id,sectionId){const item=getEntity(kind,id); if(!item||!Array.isArray(item.customSections))return; item.customSections=item.customSections.filter(s=>s.id!==sectionId); saveData(true)}
function saveEntityDetailEdit(kind,id){const cfg=getEntityConfig(kind), item=getEntity(kind,id); if(!cfg||!item)return; item.name=val(`${kind}EditName`); if(kind==="location"){item.scope=val(`${kind}EditScope`); item.seriesId=item.scope==="series"?data.activeSeriesId:null; item.bookId=item.scope==="book"?data.activeBookId:null;} cfg.fields.forEach(([key])=>{item[key]=val(`${kind}Edit_${key}`)}); (item.customSections||[]).forEach(sec=>{sec.title=val(`${kind}EditCustomTitle_${sec.id}`); sec.text=val(`${kind}EditCustomText_${sec.id}`)}); setEntityEditMode(kind,false); saveData(true)}
function renderEntityEditForm(kind,item){const cfg=getEntityConfig(kind), custom=Array.isArray(item.customSections)?item.customSections:[]; return `<div class="panel character-detail-grid"><div>${item.image?`<img class="character-photo" src="${item.image}" alt="${escapeHTML(item.name||cfg.label)}"><input id="${kind}ImageUpload_${item.id}" type="file" accept="image/*" class="hidden" onchange="updateEntityImage('${kind}','${item.id}',this)"><button type="button" class="wide" onclick="triggerEntityImageUpload('${kind}','${item.id}',event)">Change Image</button>`:`<div class="character-photo panel photo-placeholder"><p>No Image</p><input id="${kind}ImageUpload_${item.id}" type="file" accept="image/*" class="hidden" onchange="updateEntityImage('${kind}','${item.id}',this)"><button type="button" class="wide" onclick="triggerEntityImageUpload('${kind}','${item.id}',event)">+ Add Image</button></div>`}</div><div><h3>Edit ${escapeHTML(cfg.label)} Detail</h3><div class="form-grid"><input id="${kind}EditName" placeholder="Name" value="${escapeAttr(item.name||"")}">${kind==="location"?`<select id="${kind}EditScope"><option value="book">Attach to this book</option><option value="series">Attach to whole project</option></select>`:""}${cfg.fields.map(([key,label])=>`<textarea id="${kind}Edit_${key}" placeholder="${escapeAttr(label)}">${escapeHTML(item[key]||"")}</textarea>`).join("")}</div><h3>Custom Sections</h3>${custom.map(sec=>`<div class="custom-section-builder"><input id="${kind}EditCustomTitle_${sec.id}" placeholder="Section title" value="${escapeAttr(sec.title||"")}"><textarea id="${kind}EditCustomText_${sec.id}" placeholder="Section notes">${escapeHTML(sec.text||"")}</textarea><button type="button" class="delete-btn" onclick="deleteCustomSectionFromEntity('${kind}','${item.id}','${sec.id}'); setEntityEditMode('${kind}',true)">Delete Section</button></div>`).join("")||"<p class='muted'>No custom sections yet.</p>"}<button type="button" onclick="addCustomSectionToEntity('${kind}','${item.id}')">+ Add Custom Section</button><hr><button onclick="saveEntityDetailEdit('${kind}','${item.id}')">Save Changes</button><button class="ghost-btn" onclick="cancelEntityDetailEdit('${kind}')">Cancel</button></div></div>`}
function renderEntityDetail(kind){const cfg=getEntityConfig(kind), el=document.getElementById(cfg.detailId); if(!el)return; const item=getEntity(kind,data[cfg.selectedKey]); if(!item){el.innerHTML=`<div class="panel"><p>Select a ${escapeHTML(cfg.label.toLowerCase())} from the sidebar or list.</p></div>`; return} if(getEntityEditMode(kind)){el.innerHTML=renderEntityEditForm(kind,item); if(kind==="location")setVal(`${kind}EditScope`,item.scope||"book"); return} const custom=Array.isArray(item.customSections)?item.customSections:[]; el.innerHTML=`<div class="panel character-detail-grid"><div>${item.image?`<img class="character-photo" src="${item.image}" alt="${escapeHTML(item.name||cfg.label)}"><input id="${kind}ImageUpload_${item.id}" type="file" accept="image/*" class="hidden" onchange="updateEntityImage('${kind}','${item.id}',this)"><button type="button" class="wide" onclick="triggerEntityImageUpload('${kind}','${item.id}',event)">Change Image</button>`:`<div class="character-photo panel photo-placeholder"><p>No Image</p><input id="${kind}ImageUpload_${item.id}" type="file" accept="image/*" class="hidden" onchange="updateEntityImage('${kind}','${item.id}',this)"><button type="button" class="wide" onclick="triggerEntityImageUpload('${kind}','${item.id}',event)">+ Add Image</button></div>`}</div><div><div class="detail-header-row"><div><h2>${escapeHTML(item.name||cfg.label)}</h2><p class="muted">${escapeHTML(cfg.label)} Detail Page</p></div><button onclick="startEntityDetailEdit('${kind}')">Edit ${escapeHTML(cfg.label)}</button></div>${cfg.fields.map(([key,label])=>detailBlock(label,item[key])).join("")}${custom.map(sec=>detailBlock(sec.title||"Custom Section",sec.text)).join("")}<button type="button" onclick="addCustomSectionToEntity('${kind}','${item.id}')">+ Add Custom Section</button>${renderSharedAppearanceLog(kind,item.id)}</div></div>`}

function applyStructureTemplate(){const template=val("structureTemplate"); const maps={"Three Act Structure":["Act 1 — Setup","Act 2A — Rising Action","Midpoint","Act 2B — Fall / Pressure","Act 3 — Resolution"],"Save The Cat":["Opening Image","Theme Stated","Set-Up","Catalyst","Debate","Break Into Two","B Story","Fun and Games","Midpoint","Bad Guys Close In","All Is Lost","Dark Night of the Soul","Break Into Three","Finale","Final Image"],"Hero's Journey":["Ordinary World","Call to Adventure","Refusal","Mentor","Crossing Threshold","Tests / Allies / Enemies","Approach","Ordeal","Reward","Road Back","Resurrection","Return"],"Romance Beat Sheet":["Meet Cute","No Way","Adhesion","Why Them","Midpoint Bond","Retreat","Dark Moment","Grand Gesture","HEA / HFN"],"Custom":[]}; data.structureBeats=data.structureBeats.filter(b=>b.seriesId!==data.activeSeriesId||b.bookId!==data.activeBookId); (maps[template]||[]).forEach((name,i)=>data.structureBeats.push({id:uid(),...scopedItem("book"),name,notes:"",order:i,created:new Date().toISOString()})); saveData()}
function addStructureBeat(){data.structureBeats.push({id:uid(),...scopedItem("book"),name:val("structureBeatName")||"Untitled Beat",notes:val("structureBeatNotes"),order:data.structureBeats.filter(visibleByScope).length,created:new Date().toISOString()}); clearFields(["structureBeatName","structureBeatNotes"]); saveData()}

function makeCard(title,body,onDelete){const template=document.getElementById("cardTemplate"); const node=template.content.cloneNode(true); node.querySelector("h3").textContent=title||"Untitled"; node.querySelector(".card-body").innerHTML=body; node.querySelector(".delete-btn").onclick=onDelete; return node}
function deleteItem(collection,id){const item=(data[collection]||[]).find(x=>x.id===id); if(!item)return; if(!confirm(`Move this ${collectionLabel(collection)} to Trash?`))return; const deleted={...item,deletedAt:new Date().toISOString()}; data.trash=data.trash||[]; data.trash.unshift({id:uid(),collection,title:item.name||item.title||item.question||item.when||collectionLabel(collection),seriesId:item.seriesId||data.activeSeriesId,bookId:item.bookId||null,item:deleted,deletedAt:deleted.deletedAt}); data[collection]=data[collection].filter(x=>x.id!==id); saveData()}



function dateKey(offset=0){
  const d=new Date();
  d.setDate(d.getDate()+offset);
  return d.toISOString().slice(0,10);
}
function ensureWritingStats(){
  data.writingStats=data.writingStats||{daily:{},projectDaily:{}};
  data.writingStats.daily=data.writingStats.daily||{};
  data.writingStats.projectDaily=data.writingStats.projectDaily||{};
  return data.writingStats;
}
function trackWordsWritten(seriesId,bookId,delta){
  delta=Math.max(0,Number(delta)||0);
  if(!delta)return;
  const stats=ensureWritingStats();
  const day=dateKey();
  stats.daily[day]=(stats.daily[day]||0)+delta;
  if(seriesId){
    stats.projectDaily[seriesId]=stats.projectDaily[seriesId]||{};
    stats.projectDaily[seriesId][day]=(stats.projectDaily[seriesId][day]||0)+delta;
  }
}
function lastNDays(n=7){
  const days=[];
  for(let i=n-1;i>=0;i--)days.push(dateKey(-i));
  return days;
}
function renderDailyWordChart(elId,records){
  const el=document.getElementById(elId); if(!el)return;
  const days=lastNDays(7);
  const values=days.map(day=>Number(records?.[day]||0));
  const max=Math.max(...values,1000,1);
  el.innerHTML=days.map((day,i)=>{
    const v=values[i];
    const prev=i>0?values[i-1]:0;
    const cls=v>prev&&v>0?'bar-better-day':(v>=1000?'bar-goal-met':'bar-under-goal');
    const label=new Date(day+'T00:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
    return `<span class="${cls}" title="${label}: ${v.toLocaleString()} words" style="height:${Math.max(10,Math.round((v/max)*92))}%"><small>${v?Math.min(v,9999).toLocaleString():''}</small></span>`;
  }).join('')+`<div class="chart-legend"><span class="legend-under">Under 1,000</span><span class="legend-goal">1,000+</span><span class="legend-better">Beat previous day</span></div>`;
}
function renderDashboardDailyWordChart(){
  const stats=ensureWritingStats();
  renderDailyWordChart('dashboardDailyWordChart',stats.daily);
}
function renderProjectDailyWordChart(){
  const stats=ensureWritingStats();
  renderDailyWordChart('projectWritingChart',stats.projectDaily?.[data.activeSeriesId]||{});
}

function activeProjectBooks(){
  return (data.books||[]).filter(b=>b.seriesId===data.activeSeriesId && notDeleted(b)).sort((a,b)=>(a.created||"").localeCompare(b.created||""));
}
function bookScenes(book){return (book?.manuscript||[]).flatMap((ch,ci)=>(ch.scenes||[]).map((sc,si)=>({book,chapter:ch,scene:sc,chapterIndex:ci,sceneIndex:si})))}
function projectScenesAll(){return activeProjectBooks().flatMap(bookScenes)}
function bookWordCount(book){return bookScenes(book).reduce((sum,x)=>sum+countWords(stripHTML(x.scene.content||"")),0)}
function quickAddBookToActiveProject(){
  const s=activeSeries(); if(!s)return alert("Open a project first.");
  const title=prompt("Book title:",`Book ${activeProjectBooks().length+1}`); if(!title)return;
  const isPov=confirm("Is this a POV book? Click OK for yes, Cancel for no.");
  const book=makeStarterBook(s.id,title,isPov); data.books.push(book); data.activeBookId=book.id;
  const first=book.manuscript?.[0]; data.activeChapterId=first?.id||null; data.activeSceneId=first?.scenes?.[0]?.id||null;
  saveData(true);
  setView("projectDashboard");
}
function toggleProjectAddBookPanel(force){
  const panel=document.getElementById("projectAddBookPanel");
  if(!panel)return quickAddBookToActiveProject();
  const shouldShow=typeof force==="boolean"?force:panel.classList.contains("hidden");
  panel.classList.toggle("hidden",!shouldShow);
  if(shouldShow){
    toggleProjectEditBookPanel(null,false);
    const input=document.getElementById("projectNewBookTitle");
    if(input&&!input.value) input.value=`Book ${activeProjectBooks().length+1}`;
    setTimeout(()=>input?.focus(),30);
  }
}
function previewProjectNewBookCover(input){
  const preview=document.getElementById("projectNewBookCoverPreview");
  const file=input?.files?.[0];
  if(!preview)return;
  if(!file){preview.classList.add("hidden"); preview.innerHTML=""; return;}
  const reader=new FileReader();
  reader.onload=()=>{preview.classList.remove("hidden"); preview.innerHTML=`<img src="${reader.result}" alt="Book cover preview"><span>Cover selected</span>`};
  reader.readAsDataURL(file);
}
function resetProjectAddBookPanel(){
  setVal("projectNewBookTitle","");
  const pov=document.getElementById("projectNewBookIsPov"); if(pov)pov.checked=true;
  const cover=document.getElementById("projectNewBookCover"); if(cover)cover.value="";
  const preview=document.getElementById("projectNewBookCoverPreview"); if(preview){preview.classList.add("hidden"); preview.innerHTML="";}
  toggleProjectAddBookPanel(false);
}
function createBookFromProjectDashboard(){
  const s=activeSeries(); if(!s)return alert("Open a project first.");
  const title=(val("projectNewBookTitle")||"").trim()||`Book ${activeProjectBooks().length+1}`;
  const isPov=document.getElementById("projectNewBookIsPov")?.checked!==false;
  const input=document.getElementById("projectNewBookCover");
  const book=makeStarterBook(s.id,title,isPov);
  const finish=cover=>{
    if(cover)book.cover=cover;
    data.books.push(book);
    data.activeBookId=book.id;
    const first=book.manuscript?.[0]; data.activeChapterId=first?.id||null; data.activeSceneId=first?.scenes?.[0]?.id||null;
    resetProjectAddBookPanel();
    saveData(true);
    setView("projectDashboard");
  };
  if(input?.files?.[0]) readImageUpload(input,finish); else finish("");
}

function refreshProjectEditBookSelect(selectedId=""){
  const select=document.getElementById("projectEditBookSelect"); if(!select)return;
  const books=activeProjectBooks();
  select.innerHTML=books.length?books.map(b=>`<option value="${b.id}">${escapeHTML(b.title||"Untitled Book")}</option>`).join(""):`<option value="">No books yet</option>`;
  if(selectedId && books.some(b=>b.id===selectedId)) select.value=selectedId;
  else if(books[0]) select.value=books[0].id;
}
function toggleProjectEditBookPanel(bookId=null,force){
  const panel=document.getElementById("projectEditBookPanel");
  if(!panel)return;
  const shouldShow=typeof force==="boolean"?force:panel.classList.contains("hidden");
  panel.classList.toggle("hidden",!shouldShow);
  if(shouldShow){
    toggleProjectAddBookPanel(false);
    refreshProjectEditBookSelect(bookId||data.activeBookId||activeProjectBooks()[0]?.id||"");
    loadProjectEditBookFields(document.getElementById("projectEditBookSelect")?.value||bookId||"");
  }
}
function loadProjectEditBookFields(bookId){
  const book=(data.books||[]).find(b=>b.id===bookId && b.seriesId===data.activeSeriesId);
  setVal("projectEditBookTitle",book?.title||"");
  const pov=document.getElementById("projectEditBookIsPov"); if(pov)pov.checked=book?isPovBook(book):true;
  const coverInput=document.getElementById("projectEditBookCover"); if(coverInput)coverInput.value="";
  const preview=document.getElementById("projectEditBookCoverPreview");
  if(preview){
    if(book?.cover){preview.classList.remove("hidden"); preview.innerHTML=`<img src="${book.cover}" alt="${escapeHTML(book.title||"Book cover")}"><span>Current cover</span>`;}
    else {preview.classList.add("hidden"); preview.innerHTML="";}
  }
}
function previewProjectEditBookCover(input){
  const preview=document.getElementById("projectEditBookCoverPreview");
  const file=input?.files?.[0]; if(!preview)return;
  if(!file){
    loadProjectEditBookFields(document.getElementById("projectEditBookSelect")?.value||"");
    return;
  }
  const reader=new FileReader();
  reader.onload=()=>{preview.classList.remove("hidden"); preview.innerHTML=`<img src="${reader.result}" alt="Book cover preview"><span>New cover selected</span>`};
  reader.readAsDataURL(file);
}
function resetProjectEditBookPanel(){
  setVal("projectEditBookTitle","");
  const cover=document.getElementById("projectEditBookCover"); if(cover)cover.value="";
  const preview=document.getElementById("projectEditBookCoverPreview"); if(preview){preview.classList.add("hidden"); preview.innerHTML="";}
  toggleProjectEditBookPanel(null,false);
}
function saveProjectBookEdits(){
  const bookId=document.getElementById("projectEditBookSelect")?.value;
  const book=(data.books||[]).find(b=>b.id===bookId && b.seriesId===data.activeSeriesId);
  if(!book)return alert("Choose a book to edit first.");
  const apply=cover=>{
    book.title=(val("projectEditBookTitle")||"").trim()||book.title||"Untitled Book";
    book.isPov=document.getElementById("projectEditBookIsPov")?.checked!==false;
    if(!book.isPov){(book.manuscript||[]).flatMap(ch=>ch.scenes||[]).forEach(sc=>sc.pov="");}
    if(cover)book.cover=cover;
    resetProjectEditBookPanel();
    saveData(true);
    setView("projectDashboard");
  };
  const input=document.getElementById("projectEditBookCover");
  if(input?.files?.[0]) readImageUpload(input,apply); else apply("");
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
  renderProjectDailyWordChart();
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
  refreshProjectEditBookSelect(document.getElementById("projectEditBookSelect")?.value||data.activeBookId||"");
  const lastBook=activeBook()||books[0]; const lastChapter=activeChapter()||lastBook?.manuscript?.[0]; const lastScene=activeScene()||lastChapter?.scenes?.[0];
  setHTML("projectContinueWriting", lastBook&&lastChapter&&lastScene ? `<p><strong>${escapeHTML(lastBook.title||"Untitled Book")}</strong></p><p>${escapeHTML(lastChapter.title||"Chapter")} → ${escapeHTML(lastScene.title||"Scene")}</p><button onclick="setView('write','${lastChapter.id}','${lastScene.id}')">Open Scene</button>` : `<p>No scene yet.</p><button onclick="toggleProjectAddBookPanel()">+ Add Book</button>`);
  setHTML("projectDashboardBooks", books.length?books.map(b=>{const wc=bookWordCount(b); const sc=bookScenes(b).length; const cover=b.cover?`<img class="book-cover-thumb" src="${b.cover}" alt="${escapeHTML(b.title||"Book cover")}">`:`<div class="book-cover-thumb book-cover-placeholder"><span>No Cover</span><button type="button" onclick="triggerBookCoverUpload('${b.id}',event)">+ Add Cover</button></div>`; return `<article class="item-card book-shelf-card ${b.id===data.activeBookId?"active-card":""}" onclick="openBookFromDashboard('${b.id}')"><div class="book-cover-wrap">${cover}<input id="bookCoverUpload_${b.id}" type="file" accept="image/*" class="hidden" onchange="updateBookCover('${b.id}',this)"></div><div class="book-card-content"><div class="card-header"><h3>${escapeHTML(b.title||"Untitled Book")}</h3><span class="tag">${escapeHTML(b.status||"Planning")}</span></div><div class="card-body"><p>${wc} words • ${(b.manuscript||[]).length} chapters • ${sc} scenes</p>${detail("Summary",b.summary)}<div class="book-card-actions"><button onclick="event.stopPropagation(); switchActiveBookFromDashboard('${b.id}')">${b.id===data.activeBookId?"Current Book":"Switch to Book"}</button><button class="ghost-btn" onclick="event.stopPropagation(); toggleProjectEditBookPanel('${b.id}',true)">Edit Book</button>${b.cover?`<button class="ghost-btn" onclick="triggerBookCoverUpload('${b.id}',event)">Change Cover</button>`:""}</div></div></div></article>`}).join(""):`<p>No books yet.</p>`);
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
  const warnings=[]; if(unusedPoints.length)warnings.push(`${unusedPoints.length} plot point${unusedPoints.length===1?"":"s"} never used in scenes.`); if(unusedChars.length)warnings.push(`${unusedChars.length} character${unusedChars.length===1?"":"s"} never marked in scenes.`); if(!books.length)warnings.push("This project has no books yet."); const scenesMissingPlot=allScenes.filter(x=>!x.scene.plotCardId).length; if(scenesMissingPlot)warnings.push(`${scenesMissingPlot} scene${scenesMissingPlot===1?"":"s"} do not have a plot point selected.`); const scenesMissingLocation=allScenes.filter(x=>!x.scene.locationId && !(x.scene.locationIds||[]).length).length; if(scenesMissingLocation)warnings.push(`${scenesMissingLocation} scene${scenesMissingLocation===1?"":"s"} do not have a location tracked.`); const emptyWorld=(data.world||[]).filter(w=>seriesScope(w)&&!(w.description||w.basicInfo||w.history||w.plotRelevance)).length; if(emptyWorld)warnings.push(`${emptyWorld} worldbuilding entr${emptyWorld===1?"y is":"ies are"} mostly empty.`); setHTML("projectContinuityWarnings", warnings.length?warnings.map(w=>`<p>⚠ ${escapeHTML(w)}</p>`).join(""):`<p>No major warnings right now.</p>`);
}
function renderOverview(){const s=activeSeries(), b=activeBook(); setVal("seriesTitleEdit",s?.title); setVal("seriesTypeEdit",s?.type||"series"); setVal("seriesGenreEdit",s?.genre); setVal("seriesSynopsisEdit",s?.synopsis); setVal("seriesThemeEdit",s?.theme); setVal("seriesMysteriesEdit",s?.mysteries); setVal("seriesForeshadowingEdit",s?.foreshadowing); setVal("bookTitleEdit",b?.title); setVal("bookStatusEdit",b?.status); const povEdit=document.getElementById("bookIsPovEdit"); if(povEdit)povEdit.checked=isPovBook(b); setVal("bookSummaryEdit",b?.summary); setVal("bookThemeEdit",b?.theme); setVal("bookNotesEdit",b?.notes); const scenes=(b?.manuscript||[]).flatMap(c=>c.scenes||[]); const words=scenes.reduce((sum,s)=>sum+countWords(stripHTML(s.content||"")),0); setText("statWords",words); setText("statChapters",(b?.manuscript||[]).length); setText("statScenes",scenes.length); setText("statCharacters",data.characters.filter(seriesScope).length); setText("projectPath",`${s?.title||"No project"} → ${b?.title||"No book selected"}`); setText("sidebarProjectName",b?.title||"Project")}
function saveOverviewFields(render=false){const s=activeSeries(), b=activeBook(); if(s){s.title=val("seriesTitleEdit"); s.type=val("seriesTypeEdit")||"series"; s.genre=val("seriesGenreEdit"); s.synopsis=val("seriesSynopsisEdit"); s.theme=val("seriesThemeEdit"); s.mysteries=val("seriesMysteriesEdit"); s.foreshadowing=val("seriesForeshadowingEdit")} if(b){b.title=val("bookTitleEdit"); b.status=val("bookStatusEdit"); b.isPov=document.getElementById("bookIsPovEdit")?.checked!==false; if(!b.isPov){(b.manuscript||[]).flatMap(ch=>ch.scenes||[]).forEach(sc=>sc.pov="")} b.summary=val("bookSummaryEdit"); b.theme=val("bookThemeEdit"); b.notes=val("bookNotesEdit")} saveData(render)}
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
  const povSelect=document.getElementById("scenePOV");
  if(povSelect){povSelect.classList.toggle("hidden",!isPovBook(book)); if(!isPovBook(book)&&scene)scene.pov="";}
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
  runManuscriptLookup();
}
function renderSelects(){const chars=data.characters.filter(seriesScope); const charOptions=`<option value="">Select character</option>`+chars.map(c=>`<option value="${c.id}">${escapeHTML(c.name)}</option>`).join(""); ["scenePOV","relA","relB"].forEach(id=>setHTML(id,charOptions)); updateRelationshipViewLabels(); const locs=data.locations.filter(seriesScope); setHTML("sceneLocation",`<option value="">Select location</option>`+locs.map(l=>`<option value="${l.id}">${escapeHTML(l.name)}</option>`).join("")); const plotOptions=`<option value="">Plot Board Point</option>`+plotBoardItems().map(p=>`<option value="${p.id}">${escapeHTML((plotArcItems().find(a=>a.id===p.arcId)?.title||"Plot")+" — "+(p.title||"Untitled Point"))}</option>`).join(""); setHTML("scenePlotPoint",plotOptions); const beats=data.structureBeats.filter(visibleByScope); setHTML("chapterStructureBeat",`<option value="">Structure beat</option>`+beats.map(b=>`<option value="${b.id}">${escapeHTML(b.name)}</option>`).join(""))}
function renderCardList(collection,elId,titleKey,bodyFn,filter=visibleByScope){const el=document.getElementById(elId); if(!el)return; el.innerHTML=""; (data[collection]||[]).filter(filter).forEach(item=>el.appendChild(makeCard(item[titleKey],bodyFn(item),()=>deleteItem(collection,item.id))))}
function renderAllLists(){renderStoryBoard(); renderSceneBoard(); renderPlotBoard(); renderStoryBible(); renderRelationshipGraph(); renderCharactersByRole(); renderCharacterDetail(); renderWorldByCategory(); renderWorldCategoryPage(); renderWorldDetail(); renderEntityDetail("location"); renderEntityDetail("magic"); renderEntityDetail("organization"); renderRelationships(); renderSeriesTools(); renderSeriesArcs(); renderThemeTracker(); renderContinuityCenter(); renderBookHandoffs(); renderSeriesMilestones(); renderWritingStats();
renderCardList("chapterPlans","chapterPlanList","number",item=>`<span class="tag">Book</span>${detail("POV",item.pov)}${detail("Structure Beat",data.structureBeats.find(b=>b.id===item.structureBeat)?.name||"")}${detail("Target Words",item.wordTarget)}${detail("Goal",item.goal)}${detail("Conflict",item.conflict)}${detail("Outcome",item.outcome)}${detail("Emotional Beat",item.emotion)}${detail("Foreshadowing",item.foreshadowing)}`);
renderPlotThreads();
renderCardList("mysteries","mysteryList","question",item=>`<span class="tag">${escapeHTML(item.status)}</span>${detail("Introduced",item.introduced)}${detail("Hints / False Leads",item.hints)}${detail("Answer",item.answer)}${detail("Payoff",item.payoff)}`,seriesScope);
renderCardList("foreshadowing","foreshadowingList","hint",item=>`<span class="tag">${escapeHTML(item.status)}</span>${detail("Appears",item.appears)}${detail("Payoff",item.payoff)}${detail("Notes",item.notes)}`,seriesScope);
renderEntityList("location");
renderEntityList("magic");
renderEntityList("organization");
renderSceneDatabase(); renderTimeline();}

function allScenesForBook(book){
  const out=[];
  (book?.manuscript||[]).forEach((chapter,chapterIndex)=>{
    (chapter.scenes||[]).forEach((scene,sceneIndex)=>out.push({book,chapter,scene,chapterIndex,sceneIndex}));
  });
  return out;
}
function sceneCardMeta(row){
  const sc=row.scene;
  const bits=[];
  if(sc.pov)bits.push(`POV: ${characterName(sc.pov)}`);
  if(sc.locationId)bits.push(`Location: ${entityName('location',sc.locationId)}`);
  if(sc.plotCardId)bits.push(`Plot: ${plotCardName(sc.plotCardId)}`);
  if(sc.mood)bits.push(`Mood: ${sc.mood}`);
  const words=countWords(stripHTML(sc.content||''));
  bits.push(`${words} words`);
  return bits.map(b=>`<span class="tag">${escapeHTML(b)}</span>`).join('');
}
function plotCardName(id){const p=(data.plotCards||[]).find(x=>x.id===id); return p?.title||'Untitled Plot Point'}
function renderSceneBoard(){
  const el=document.getElementById('sceneBoardList'); if(!el)return;
  const book=activeBook();
  if(!book){el.innerHTML='<div class="panel"><p class="muted">Open a book to use the Scene Board.</p></div>'; return;}
  el.innerHTML=(book.manuscript||[]).map((chapter,chapterIndex)=>`<div class="board-column scene-board-column" ondragover="event.preventDefault()" ondrop="dropSceneCard('${chapter.id}')"><h3>${escapeHTML(chapter.title||('Chapter '+(chapterIndex+1)))}</h3>${(chapter.scenes||[]).map((scene,sceneIndex)=>`<div class="board-card scene-card" draggable="true" ondragstart="dragSceneCard('${chapter.id}','${scene.id}')" onclick="setView('write','${chapter.id}','${scene.id}')"><strong>${escapeHTML(scene.title||('Scene '+(sceneIndex+1)))}</strong><div class="scene-card-tags">${sceneCardMeta({book,chapter,scene,chapterIndex,sceneIndex})}</div>${scene.purpose?`<p>${escapeHTML(scene.purpose)}</p>`:''}</div>`).join('')||'<p class="muted">No scenes yet.</p>'}<button type="button" onclick="data.activeChapterId='${chapter.id}'; addSceneToActiveChapter(); setView('sceneBoard')">+ Scene</button></div>`).join('')||'<div class="panel"><p>No chapters yet.</p></div>';
}
function dragSceneCard(chapterId,sceneId){draggedScenePayload={chapterId,sceneId};}
function dropSceneCard(targetChapterId){
  if(!draggedScenePayload)return;
  const book=activeBook(); if(!book)return;
  const source=(book.manuscript||[]).find(ch=>ch.id===draggedScenePayload.chapterId);
  const target=(book.manuscript||[]).find(ch=>ch.id===targetChapterId);
  if(!source||!target)return;
  const idx=(source.scenes||[]).findIndex(s=>s.id===draggedScenePayload.sceneId);
  if(idx<0)return;
  const [scene]=source.scenes.splice(idx,1);
  target.scenes=target.scenes||[];
  target.scenes.push(scene);
  data.activeChapterId=target.id; data.activeSceneId=scene.id; draggedScenePayload=null;
  saveData(true);
}
function threadSceneMatches(thread){
  const q=(thread.title||'').toLowerCase();
  if(!q)return [];
  return allScenesForBook(activeBook()).filter(row=>JSON.stringify(row.scene).toLowerCase().includes(q) || stripHTML(row.scene.content||'').toLowerCase().includes(q));
}
function renderPlotThreads(){
  const el=document.getElementById('threadList'); if(!el)return;
  const threads=(data.threads||[]).filter(visibleByScope);
  el.innerHTML=threads.length?threads.map(t=>{const matches=threadSceneMatches(t); return `<article class="item-card"><div class="card-header"><h3>${escapeHTML(t.title||'Untitled Thread')}</h3><button class="delete-btn" onclick="deleteItem('threads','${t.id}')">Delete</button></div><div class="card-body"><span class="tag">${escapeHTML(t.type||'Plot Thread')}</span><span class="tag">${escapeHTML(t.status||'Open')}</span><span class="tag">${matches.length} scene match${matches.length===1?'':'es'}</span>${detail('Setup',t.setup)}${detail('Payoff',t.payoff)}${matches.length?`<details><summary>Scene Matches</summary>${matches.slice(0,10).map(row=>`<button class="search-result-btn" onclick="setView('write','${row.chapter.id}','${row.scene.id}')">${escapeHTML(row.chapter.title||'Chapter')} — ${escapeHTML(row.scene.title||'Scene')}</button>`).join('')}</details>`:''}</div></article>`}).join(''):'<p class="muted">No plot threads yet.</p>';
}

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
function preserveCharacterDetailEditDraft(characterId){
  const c=data.characters.find(x=>x.id===characterId); if(!c)return null;
  const nameEl=document.getElementById("editCharName");
  if(nameEl){
    c.name=val("editCharName"); c.role=val("editCharRole"); c.species=val("editCharSpecies");
    c.basicInfo=val("editCharBasicInfo"); c.description=val("editCharDescription"); c.personality=val("editCharPersonality");
    c.backstory=val("editCharBackstory"); c.wound=val("editCharWound"); c.arc=val("editCharArc"); c.voice=val("editCharVoice");
    c.secrets=val("editCharSecrets"); c.quotes=val("editCharQuotes");
    (c.customSections||[]).forEach(sec=>{
      const t=document.getElementById(`editCustomTitle_${sec.id}`);
      const x=document.getElementById(`editCustomText_${sec.id}`);
      if(t)sec.title=t.value; if(x)sec.text=x.value;
    });
  }
  return c;
}
function addCharacterCustomSectionFromDetail(characterId){
  const c=preserveCharacterDetailEditDraft(characterId); if(!c)return;
  if(!Array.isArray(c.customSections))c.customSections=[];
  c.customSections.push({id:uid(),title:"New Section",text:""});
  characterDetailEditMode=true; saveData(true); renderCharacterDetail();
}
function renderCharacterEditForm(c){
  const custom=Array.isArray(c.customSections)?c.customSections:[];
  return `<div class="panel character-detail-grid"><div>${c.photo?`<img class="character-photo" src="${c.photo}" alt="${escapeHTML(c.name)}"><input id="characterPhotoUpload_${c.id}" type="file" accept="image/*" class="hidden" onchange="updateCharacterPhoto('${c.id}',this)"><button type="button" class="wide" onclick="triggerCharacterPhotoUpload('${c.id}',event)">Change Photo</button>`:`<div class="character-photo panel photo-placeholder"><p>No Photo</p><input id="characterPhotoUpload_${c.id}" type="file" accept="image/*" class="hidden" onchange="updateCharacterPhoto('${c.id}',this)"><button type="button" class="wide" onclick="triggerCharacterPhotoUpload('${c.id}',event)">+ Add Character Photo</button></div>`}</div><div><h3>Edit Character Detail</h3><div class="form-grid"><input id="editCharName" placeholder="Character name" value="${escapeAttr(c.name||"")}"><select id="editCharRole"><option>Main</option><option>Side</option><option>Love Interest</option><option>Antagonist</option><option>Mentor</option><option>Other</option></select><input id="editCharSpecies" placeholder="Species / identity" value="${escapeAttr(c.species||"")}"><textarea id="editCharBasicInfo" placeholder="Basic Information">${escapeHTML(c.basicInfo||c.bio||"")}</textarea><textarea id="editCharDescription" placeholder="Physical Appearance">${escapeHTML(c.description||"")}</textarea><textarea id="editCharPersonality" placeholder="Personality">${escapeHTML(c.personality||"")}</textarea><textarea id="editCharBackstory" placeholder="Backstory">${escapeHTML(c.backstory||"")}</textarea><textarea id="editCharWound" placeholder="Psychology: Core Wound, Core Fear, Core Desire, Fatal Flaw">${escapeHTML(c.wound||"")}</textarea><textarea id="editCharArc" placeholder="Character Arc">${escapeHTML(c.arc||"")}</textarea><textarea id="editCharVoice" placeholder="Voice / speech patterns">${escapeHTML(c.voice||"")}</textarea><textarea id="editCharSecrets" placeholder="Secrets">${escapeHTML(c.secrets||"")}</textarea><textarea id="editCharQuotes" placeholder="Quotes">${escapeHTML(c.quotes||"")}</textarea></div><h3>Custom Sections</h3>${custom.map(sec=>`<div class="custom-section-builder"><input id="editCustomTitle_${sec.id}" placeholder="Section title" value="${escapeAttr(sec.title||"")}"><textarea id="editCustomText_${sec.id}" placeholder="Section notes">${escapeHTML(sec.text||"")}</textarea><button type="button" class="delete-btn" onclick="deleteCustomSectionFromCharacter('${c.id}','${sec.id}'); characterDetailEditMode=true">Delete Section</button></div>`).join("")||"<p class='muted'>No custom sections yet.</p>"}<button type="button" onclick="addCharacterCustomSectionFromDetail('${c.id}')">+ Add Custom Section</button><hr><button onclick="saveCharacterDetailEdit('${c.id}')">Save Changes</button><button class="ghost-btn" onclick="cancelCharacterDetailEdit()">Cancel</button></div></div>`
}
function renderCharacterDetail(){const el=document.getElementById("characterDetailContent"); if(!el)return; const c=data.characters.find(x=>x.id===data.selectedCharacterId); if(!c){el.innerHTML=`<div class="panel"><p>Select a character from the sidebar.</p></div>`;return} if(characterDetailEditMode){el.innerHTML=renderCharacterEditForm(c); setVal("editCharRole",c.role||"Other"); return} const rels=characterRelationships(c.id), apps=characterAppearances(c.id), custom=Array.isArray(c.customSections)?c.customSections:[]; el.innerHTML=`<div class="panel character-detail-grid"><div>${c.photo?`<img class="character-photo" src="${c.photo}" alt="${escapeHTML(c.name)}"><input id="characterPhotoUpload_${c.id}" type="file" accept="image/*" class="hidden" onchange="updateCharacterPhoto('${c.id}',this)"><button type="button" class="wide" onclick="triggerCharacterPhotoUpload('${c.id}',event)">Change Photo</button>`:`<div class="character-photo panel photo-placeholder"><p>No Photo</p><input id="characterPhotoUpload_${c.id}" type="file" accept="image/*" class="hidden" onchange="updateCharacterPhoto('${c.id}',this)"><button type="button" class="wide" onclick="triggerCharacterPhotoUpload('${c.id}',event)">+ Add Character Photo</button></div>`}<button class="wide" onclick="startCharacterDetailEdit()">Edit Character Detail</button><button class="wide" onclick="addCharacterCustomSectionFromDetail('${c.id}')">+ Add Custom Section</button></div><div><h3>${escapeHTML(c.name)}</h3><span class="tag">${escapeHTML(c.role||"")}</span><span class="tag">${escapeHTML(c.species||"")}</span>${detailBlock("Basic Information",c.basicInfo||c.bio)}${detailBlock("Physical Appearance",c.description)}${detailBlock("Personality",c.personality)}${detailBlock("Backstory",c.backstory)}${detailBlock("Psychology: Core Wound, Core Fear, Core Desire, Fatal Flaw",c.wound)}${detailBlock("Character Arc",c.arc)}${detailBlock("Voice / Speech Patterns",c.voice)}${detailBlock("Secrets",c.secrets)}${detailBlock("Quotes",c.quotes)}${custom.map(sec=>`<section class="character-section custom-character-section"><h4>${escapeHTML(sec.title||"Untitled Section")}</h4><p>${formatMultiline(sec.text||"")}</p><button class="delete-btn" onclick="deleteCustomSectionFromCharacter('${c.id}','${sec.id}')">Delete Section</button></section>`).join("")}<h3>Linked Relationships</h3>${rels.length?rels.map(r=>{const other=r.a===c.id?r.b:r.a; const ownView=r.a===c.id?r.aView:r.bView; const otherView=r.a===c.id?r.bView:r.aView; return `<p><strong>${escapeHTML(characterName(r.a))} + ${escapeHTML(characterName(r.b))}:</strong> ${escapeHTML(r.type||"")} — ${escapeHTML(r.status||"")}<br>${escapeHTML(r.history||r.arc||"")}${ownView?`<br><strong>${escapeHTML(c.name)}'s View:</strong> ${escapeHTML(ownView)}`:""}${otherView?`<br><strong>${escapeHTML(characterName(other))}'s View:</strong> ${escapeHTML(otherView)}`:""}</p>`}).join(""):"<p>No linked relationships yet.</p>"}${renderSharedAppearanceLog("character",c.id)}</div></div>`}
function renderRelationships(){const map=document.getElementById("relationshipMap"), list=document.getElementById("relationshipList"); if(!map||!list)return; map.innerHTML=""; list.innerHTML=""; const rels=data.relationships.filter(seriesScope); if(!rels.length)map.innerHTML="<p>No relationships yet.</p>"; rels.forEach(item=>{const nameA=characterName(item.a), nameB=characterName(item.b); const node=document.createElement("div"); node.className="rel-node"; node.textContent=`${nameA} ↔ ${nameB} (${item.type||"connection"})`; map.appendChild(node); list.appendChild(makeCard(`${nameA} + ${nameB}`,`<span class="tag">${escapeHTML(item.status||"")}</span>${detail("Type",item.type)}${detail("History",item.history)}${detail("Important Moments",item.moments)}${detail("Arc / Future Changes",item.arc)}${detail(`${nameA}'s View`,item.aView)}${detail(`${nameB}'s View`,item.bView)}`,()=>deleteItem("relationships",item.id)))})}
function renderSceneDatabase(){const el=document.getElementById("sceneList"); if(!el)return; const scenes=(activeBook()?.manuscript||[]).flatMap(ch=>(ch.scenes||[]).map(sc=>({...sc,chapterId:ch.id,chapterTitle:ch.title}))); el.innerHTML=scenes.length?scenes.map(sc=>`<article class="item-card clickable-card" onclick="setView('write','${sc.chapterId}','${sc.id}')"><div class="card-header"><h3>${escapeHTML(sc.title)}</h3><button type="button" onclick="event.stopPropagation(); setView('write','${sc.chapterId}','${sc.id}')">Open Scene</button></div><div class="card-body"><span class="tag">${escapeHTML(sc.chapterTitle)}</span>${detail("POV",characterName(sc.pov))}${detail("Location",locationName(sc.locationId))}${detail("Date",sc.date)}${detail("Mood",sc.mood)}${detail("Purpose",sc.purpose)}<p><strong>Words:</strong> ${countWords(stripHTML(sc.content||""))}</p>${sceneAppearancesHTML(sc)}</div></article>`).join(""):"<p>No scenes yet.</p>"}
function renderTimeline(){const tl=document.getElementById("timelineList"); if(!tl)return; tl.innerHTML=""; data.timeline.filter(seriesScope).forEach(item=>{const div=document.createElement("article"); div.className="item-card timeline-item"; div.innerHTML=`<div class="card-header"><h3>${escapeHTML(item.when||"Unplaced Event")}</h3><button class="delete-btn">Delete</button></div><div class="card-body"><span class="tag">${escapeHTML(item.scope)}</span>${detail("Event",item.event)}${detail("Impact",item.impact)}</div>`; div.querySelector("button").onclick=()=>deleteItem("timeline",item.id); tl.appendChild(div)})}

function renderStoryBible(){
  const el=document.getElementById('storyBibleContent'); if(!el)return;
  const srs=activeSeries(); if(!srs){el.innerHTML='<div class="panel"><p>No project selected.</p></div>'; return;}
  const books=(data.books||[]).filter(b=>b.seriesId===srs.id && notDeleted(b));
  const section=(title,items,fn)=>`<div class="panel story-bible-section"><h3>${escapeHTML(title)} <span class="muted">(${items.length})</span></h3>${items.length?items.map(fn).join(''):'<p class="muted">None yet.</p>'}</div>`;
  el.innerHTML=`<div class="panel"><h2>${escapeHTML(srs.title||'Project')} Story Bible</h2><p>${escapeHTML(srs.synopsis||'')}</p><div class="grid stats-grid"><div class="stat-card"><span>${books.length}</span><p>Books</p></div><div class="stat-card"><span>${data.characters.filter(seriesScope).length}</span><p>Characters</p></div><div class="stat-card"><span>${data.world.filter(seriesScope).length+data.locations.filter(seriesScope).length+data.organizations.filter(seriesScope).length+data.magicSystems.filter(seriesScope).length}</span><p>World Items</p></div><div class="stat-card"><span>${data.relationships.filter(seriesScope).length}</span><p>Relationships</p></div></div></div>`+
  section('Books',books,b=>`<div class="bible-entry"><h4>${escapeHTML(b.title||'Untitled Book')}</h4><p>${escapeHTML(b.summary||'')}</p></div>`)+
  section('Characters',data.characters.filter(seriesScope),c=>`<div class="bible-entry"><h4>${escapeHTML(c.name||'Unnamed')}</h4><p><strong>${escapeHTML(c.role||'')}</strong> ${escapeHTML(c.species||'')}</p><p>${escapeHTML(c.basicInfo||c.description||'')}</p>${renderSharedAppearanceLog('character',c.id)}</div>`)+
  section('Relationships',data.relationships.filter(seriesScope),r=>`<div class="bible-entry"><h4>${escapeHTML(characterName(r.a))} + ${escapeHTML(characterName(r.b))}</h4><p>${escapeHTML(r.type||'')}</p>${detail('Status',r.status)}${detail('Arc',r.arc)}</div>`)+
  section('Locations',data.locations.filter(seriesScope),l=>`<div class="bible-entry"><h4>${escapeHTML(l.name||'Unnamed Location')}</h4><p>${escapeHTML(l.description||l.region||'')}</p>${renderSharedAppearanceLog('location',l.id)}</div>`)+
  section('Organizations',data.organizations.filter(seriesScope),o=>`<div class="bible-entry"><h4>${escapeHTML(o.name||'Unnamed Organization')}</h4><p>${escapeHTML(o.description||o.purpose||'')}</p>${renderSharedAppearanceLog('organization',o.id)}</div>`)+
  section('Magic / Systems',data.magicSystems.filter(seriesScope),m=>`<div class="bible-entry"><h4>${escapeHTML(m.name||'Unnamed System')}</h4><p>${escapeHTML(m.rules||m.description||'')}</p>${renderSharedAppearanceLog('magic',m.id)}</div>`)+
  section('World Building',data.world.filter(seriesScope),w=>`<div class="bible-entry"><h4>${escapeHTML(w.name||'Untitled Entry')}</h4><p><span class="tag">${escapeHTML(worldCategoryLabel(w.category)||'Other')}</span></p><p>${escapeHTML(w.description||w.basicInfo||'')}</p>${renderSharedAppearanceLog('world',w.id)}</div>`)+
  section('Timeline',data.timeline.filter(seriesScope),t=>`<div class="bible-entry"><h4>${escapeHTML(t.when||'Timeline Event')}</h4><p>${escapeHTML(t.event||t.notes||'')}</p></div>`);
}
function renderRelationshipGraph(){
  const el=document.getElementById('relationshipGraphContent'); if(!el)return;
  const chars=data.characters.filter(seriesScope);
  const rels=data.relationships.filter(seriesScope);
  if(!chars.length){el.innerHTML='<p class="muted">Add characters to build a relationship graph.</p>'; return;}
  const size=720, cx=size/2, cy=size/2, r=Math.min(260,120+chars.length*12);
  const pos={}; chars.forEach((c,i)=>{const a=(Math.PI*2*i/chars.length)-Math.PI/2; pos[c.id]={x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r};});
  const lines=rels.filter(rel=>pos[rel.a]&&pos[rel.b]).map(rel=>`<line x1="${pos[rel.a].x}" y1="${pos[rel.a].y}" x2="${pos[rel.b].x}" y2="${pos[rel.b].y}"/><text x="${(pos[rel.a].x+pos[rel.b].x)/2}" y="${(pos[rel.a].y+pos[rel.b].y)/2}" class="graph-label">${escapeHTML(rel.type||'')}</text>`).join('');
  const nodes=chars.map(c=>`<g class="graph-node" onclick="setView('characterDetail','${c.id}')"><circle cx="${pos[c.id].x}" cy="${pos[c.id].y}" r="34"></circle><text x="${pos[c.id].x}" y="${pos[c.id].y+52}" text-anchor="middle">${escapeHTML(c.name||'Unnamed')}</text></g>`).join('');
  el.innerHTML=`<svg class="relationship-graph-svg" viewBox="0 0 ${size} ${size}"><g class="graph-lines">${lines}</g><g>${nodes}</g></svg>`;
}
function currentSceneWordCount(){return countWords(stripHTML(activeScene()?.content||''));}
function updateSprintSettings(){
  ensureCollections();
  const goal=Math.max(1,Number(val('sprintGoalWords')||data.sprint.goalWords||500));
  const mins=Math.max(1,Number(val('sprintMinutes')||data.sprint.minutes||25));
  data.sprint.goalWords=goal; data.sprint.minutes=mins;
  if(!data.sprint.running && !data.sprint.startedAt)data.sprint.pausedRemaining=mins*60;
  saveData(true,false); renderSprintPanel();
}
function sprintRemainingSeconds(){
  const sp=data.sprint||{};
  if(sp.running && sp.startedAt){return Math.max(0,Math.round((sp.pausedRemaining??sp.minutes*60)-((Date.now()-new Date(sp.startedAt).getTime())/1000)));}
  return Math.max(0,sp.pausedRemaining??(sp.minutes||25)*60);
}
function renderSprintPanel(){
  const sp=data.sprint||{goalWords:500,minutes:25};
  const goalEl=document.getElementById('sprintGoalWords'), minEl=document.getElementById('sprintMinutes');
  if(goalEl && document.activeElement!==goalEl)goalEl.value=sp.goalWords||500;
  if(minEl && document.activeElement!==minEl)minEl.value=sp.minutes||25;
  const written=Math.max(0,currentSceneWordCount()-(sp.startWords||0));
  const rem=sprintRemainingSeconds();
  const mm=String(Math.floor(rem/60)).padStart(2,'0'), ss=String(rem%60).padStart(2,'0');
  setText('sprintWordsWritten',written); setText('sprintTimeLeft',`${mm}:${ss}`); setText('sprintStatusBadge',sp.running?'Running':(rem<=0?'Done':'Ready'));
  const pct=Math.min(100,Math.round((written/Math.max(1,sp.goalWords||500))*100));
  const bar=document.getElementById('sprintProgressBar'); if(bar)bar.style.width=pct+'%';
  if(sp.running && rem<=0){data.sprint.running=false; data.sprint.startedAt=null; saveData(true,false);}
}
function startWritingSprint(){ensureCollections(); const sp=data.sprint; if(!sp.pausedRemaining)sp.pausedRemaining=(sp.minutes||25)*60; sp.running=true; sp.startedAt=new Date().toISOString(); sp.startWords=currentSceneWordCount(); saveData(true,false); if(!sprintTimer)sprintTimer=setInterval(renderSprintPanel,1000); renderSprintPanel();}
function pauseWritingSprint(){const sp=data.sprint||{}; sp.pausedRemaining=sprintRemainingSeconds(); sp.running=false; sp.startedAt=null; saveData(true,false); renderSprintPanel();}
function resetWritingSprint(){data.sprint={goalWords:Number(val('sprintGoalWords')||500),minutes:Number(val('sprintMinutes')||25),running:false,startedAt:null,pausedRemaining:Number(val('sprintMinutes')||25)*60,startWords:currentSceneWordCount()}; saveData(true,false); renderSprintPanel();}

function renderWritingStats(){const book=activeBook(); const chapters=book?.manuscript||[]; const counts=chapters.map(c=>(c.scenes||[]).reduce((sum,s)=>sum+countWords(stripHTML(s.content||"")),0)); const total=counts.reduce((a,b)=>a+b,0); const avg=counts.length?Math.round(total/counts.length):0; const longest=counts.length?Math.max(...counts):0; const bibleItems=["characters","threads","timeline","world","relationships","locations","magicSystems","organizations","mysteries","foreshadowing","plotArcs","plotCards"].reduce((sum,k)=>sum+(data[k]||[]).filter(k==="magicSystems"||k==="organizations"||k==="mysteries"||k==="foreshadowing"?seriesScope:visibleByScope).length,0); setText("statsTotalWords",total); setText("statsAvgWords",avg); setText("statsLongestChapter",longest); setText("statsBibleItems",bibleItems); setHTML("chapterStatsList",chapters.map((c,i)=>`<div class="chapter-stat-row"><span>${i+1}. ${escapeHTML(c.title||"Untitled")}</span><strong>${counts[i]} words</strong></div>`).join("")||"<p>No chapters yet.</p>"); const povCounts={}; chapters.flatMap(c=>c.scenes||[]).forEach(s=>{if(s.pov)povCounts[characterName(s.pov)]=(povCounts[characterName(s.pov)]||0)+countWords(stripHTML(s.content||""))}); setHTML("povStatsList",Object.entries(povCounts).map(([name,count])=>`<div class="chapter-stat-row"><span>${escapeHTML(name)}</span><strong>${count} words</strong></div>`).join("")||"<p>No POV data yet. Choose POV characters on scenes.</p>")}
function bookWordCount(book){return (book?.manuscript||[]).flatMap(c=>c.scenes||[]).reduce((sum,sc)=>sum+countWords(stripHTML(sc.content||'')),0)}
function seriesBooks(){return (data.books||[]).filter(b=>b.seriesId===data.activeSeriesId && notDeleted(b));}
function sceneRowsAcrossSeries(){return seriesBooks().flatMap(book=>(book.manuscript||[]).flatMap((chapter,chapterIndex)=>(chapter.scenes||[]).map((scene,sceneIndex)=>({book,chapter,scene,chapterIndex,sceneIndex}))));}
function renderSeriesTools(){
  const warn=document.getElementById("seriesOnlyWarning"), content=document.getElementById("seriesToolsContent"); if(!warn||!content)return;
  warn.innerHTML=""; content.classList.remove("hidden");
  const books=seriesBooks(); const seriesWords=books.reduce((sum,b)=>sum+bookWordCount(b),0);
  const scenes=sceneRowsAcrossSeries();
  const unresolved=(data.mysteries||[]).filter(m=>seriesScope(m)&&(m.status||'Open')!=='Resolved').length;
  const openThreads=(data.threads||[]).filter(t=>seriesScope(t)&&(t.status||'Open')!=='Resolved').length;
  setText("seriesBookCount",books.length); setText("seriesTotalWords",seriesWords); setText("seriesTimelineCount",data.timeline.filter(seriesScope).length); setText("seriesThreadCount",openThreads);
  setHTML("seriesDashboardBooks", books.map(b=>`<article class="item-card"><div class="card-header"><h3>${escapeHTML(b.title||'Untitled Book')}</h3><span class="tag">${escapeHTML(b.status||'Drafting')}</span></div><div class="card-body"><p><strong>Words:</strong> ${bookWordCount(b)}</p><p><strong>Chapters:</strong> ${(b.manuscript||[]).length}</p><p><strong>Scenes:</strong> ${(b.manuscript||[]).flatMap(c=>c.scenes||[]).length}</p></div></article>`).join('')||'<p>No books yet.</p>');
  setHTML("seriesBigPicture", `<p><strong>Characters:</strong> ${data.characters.filter(seriesScope).length}</p><p><strong>World Entries:</strong> ${data.world.filter(seriesScope).length+data.locations.filter(seriesScope).length+data.organizations.filter(seriesScope).length+data.magicSystems.filter(seriesScope).length}</p><p><strong>Unresolved Questions:</strong> ${unresolved}</p><p><strong>Open Threads:</strong> ${openThreads}</p><p><strong>Total Scenes:</strong> ${scenes.length}</p>`);
}
function addSeriesArc(){data.seriesArcs.push({id:uid(),...scopedItem('series'),title:val('seriesArcTitle'),characterId:val('seriesArcCharacter'),book1:val('seriesArcBook1'),book2:val('seriesArcBook2'),book3:val('seriesArcBook3'),notes:val('seriesArcNotes'),created:new Date().toISOString()}); clearFields(['seriesArcTitle','seriesArcBook1','seriesArcBook2','seriesArcBook3','seriesArcNotes']); saveData(); hideAddForm('seriesArcAddForm')}
function renderSeriesArcs(){const el=document.getElementById('seriesArcList'); if(!el)return; setHTML('seriesArcCharacter',`<option value="">No specific character</option>`+data.characters.filter(seriesScope).map(c=>`<option value="${c.id}">${escapeHTML(c.name||'Unnamed')}</option>`).join('')); const items=(data.seriesArcs||[]).filter(seriesScope); el.innerHTML=items.length?items.map(a=>`<article class="item-card"><div class="card-header"><h3>${escapeHTML(a.title||'Untitled Arc')}</h3><button class="delete-btn" onclick="deleteItem('seriesArcs','${a.id}')">Delete</button></div><div class="card-body"><span class="tag">${escapeHTML(a.characterId?characterName(a.characterId):'Series Arc')}</span>${detail('Book 1',a.book1)}${detail('Book 2',a.book2)}${detail('Book 3',a.book3)}${detail('Notes',a.notes)}</div></article>`).join(''):'<p class="muted">No series arcs yet.</p>';}
function addThemeTrack(){data.themeTracks.push({id:uid(),...scopedItem('series'),theme:val('themeTrackName'),bookUse:val('themeTrackBooks'),scenes:val('themeTrackScenes'),notes:val('themeTrackNotes'),created:new Date().toISOString()}); clearFields(['themeTrackName','themeTrackBooks','themeTrackScenes','themeTrackNotes']); saveData(); hideAddForm('themeTrackAddForm')}
function renderThemeTracker(){const el=document.getElementById('themeTrackList'); if(!el)return; const items=(data.themeTracks||[]).filter(seriesScope); el.innerHTML=items.length?items.map(t=>`<article class="item-card"><div class="card-header"><h3>${escapeHTML(t.theme||'Untitled Theme')}</h3><button class="delete-btn" onclick="deleteItem('themeTracks','${t.id}')">Delete</button></div><div class="card-body">${detail('Book Usage',t.bookUse)}${detail('Scene Notes',t.scenes)}${detail('Notes',t.notes)}</div></article>`).join(''):'<p class="muted">No themes tracked yet.</p>';}
function seriesContinuityWarnings(){const warnings=[]; const scenes=sceneRowsAcrossSeries(); const usedChars=new Set(scenes.flatMap(r=>sceneCharacterIds(r.scene))); data.characters.filter(seriesScope).forEach(c=>{if(!usedChars.has(c.id))warnings.push(`Character never appears: ${c.name||'Unnamed Character'}`)}); const usedPlots=new Set(scenes.map(r=>r.scene.plotCardId).filter(Boolean)); data.plotCards.filter(seriesScope).forEach(p=>{if(!usedPlots.has(p.id))warnings.push(`Plot point never used: ${p.title||'Untitled Plot Point'}`)}); scenes.forEach(r=>{if(!r.scene.plotCardId)warnings.push(`${r.book.title||'Book'} / ${r.chapter.title||'Chapter'} / ${r.scene.title||'Scene'} has no plot point.`)}); (data.mysteries||[]).filter(m=>seriesScope(m)&&(m.status||'Open')!=='Resolved').forEach(m=>warnings.push(`Unresolved question: ${m.question||'Untitled Question'}`)); return warnings;}
function renderContinuityCenter(){const el=document.getElementById('continuityCenterList'); if(!el)return; const warnings=seriesContinuityWarnings(); el.innerHTML=warnings.length?warnings.map(w=>`<article class="item-card warning-card"><p>⚠️ ${escapeHTML(w)}</p></article>`).join(''):'<div class="panel"><p>No major continuity warnings found.</p></div>';}
function addBookHandoff(){data.bookHandoffs.push({id:uid(),...scopedItem('series'),fromBook:val('handoffFromBook'),toBook:val('handoffToBook'),status:val('handoffStatus'),notes:val('handoffNotes'),created:new Date().toISOString()}); clearFields(['handoffStatus','handoffNotes']); saveData(); hideAddForm('bookHandoffAddForm')}
function renderBookHandoffs(){const el=document.getElementById('bookHandoffList'); if(!el)return; const opts=seriesBooks().map(b=>`<option value="${b.id}">${escapeHTML(b.title||'Untitled Book')}</option>`).join(''); setHTML('handoffFromBook',opts); setHTML('handoffToBook',opts); const items=(data.bookHandoffs||[]).filter(seriesScope); el.innerHTML=items.length?items.map(h=>`<article class="item-card"><div class="card-header"><h3>${escapeHTML((seriesBooks().find(b=>b.id===h.fromBook)?.title||'Book')+' → '+(seriesBooks().find(b=>b.id===h.toBook)?.title||'Book'))}</h3><button class="delete-btn" onclick="deleteItem('bookHandoffs','${h.id}')">Delete</button></div><div class="card-body">${detail('Ending / Starting Status',h.status)}${detail('Notes',h.notes)}</div></article>`).join(''):'<p class="muted">No book handoffs yet.</p>';}
function addSeriesMilestone(){data.seriesMilestones.push({id:uid(),...scopedItem('series'),title:val('milestoneTitle'),status:val('milestoneStatus'),date:val('milestoneDate'),notes:val('milestoneNotes'),created:new Date().toISOString()}); clearFields(['milestoneTitle','milestoneDate','milestoneNotes']); saveData(); hideAddForm('seriesMilestoneAddForm')}
function renderSeriesMilestones(){const el=document.getElementById('seriesMilestoneList'); if(!el)return; const items=(data.seriesMilestones||[]).filter(seriesScope); el.innerHTML=items.length?items.map(m=>`<article class="item-card"><div class="card-header"><h3>${escapeHTML(m.title||'Untitled Milestone')}</h3><button class="delete-btn" onclick="deleteItem('seriesMilestones','${m.id}')">Delete</button></div><div class="card-body"><span class="tag">${escapeHTML(m.status||'Not Started')}</span>${detail('Target / Date',m.date)}${detail('Notes',m.notes)}</div></article>`).join(''):'<p class="muted">No milestones yet.</p>';}
function renderRawData(){const raw=document.getElementById("rawData"); if(raw)raw.value=JSON.stringify(data,null,2); setText("storageHealth",storageHealthMessage())}
function renderAll(){if(!data.user?.id){updateAuthGate();return} ensureProject(); if(!data.activeSeriesId||!data.activeBookId){updateAuthGate();return} applyTheme(); renderProjectDashboard(); renderOverview(); renderSelects(); renderManuscript(); renderAllLists(); renderMusic(); renderRawData(); renderAccount(); renderBackupSnapshots(); renderTrashManager(); renderNestedNav(); renderSprintPanel(); addBulletButtons(); runSearch()}

function searchableItems(){
  const b=activeBook();
  const manuscript=(b?.manuscript||[]).flatMap(ch=>(ch.scenes||[]).map(sc=>({type:"Scene",category:"manuscript",title:`${ch.title} — ${sc.title}`,text:(ch.title+" "+sc.title+" "+stripHTML(sc.content||"")).toLowerCase(),action:`setView('write','${ch.id}','${sc.id}')`})));
  const collections=[
    ["Character","characters","name","characters",item=>`setView('characterDetail','${item.id}')`],
    ["Relationship","relationships","type","characters",()=>`setView('relationships')`],
    ["Timeline","timeline","when","plot",()=>`setView('timeline')`],
    ["Chapter Plan","chapterPlans","number","plot",()=>`setView('chapters')`],
    ["Plot Thread","threads","title","plot",()=>`setView('threads')`],
    ["Series Arc","seriesArcs","title","series",()=>`setView('seriesArcs')`],
    ["Theme","themeTracks","theme","series",()=>`setView('themeTracker')`],
    ["Book Handoff","bookHandoffs","status","series",()=>`setView('bookHandoffs')`],
    ["Milestone","seriesMilestones","title","series",()=>`setView('seriesMilestones')`],
    ["Plot Point","plotCards","title","plot",()=>`setView('plotBoard')`],
    ["Worldbuilding","world","name","world",item=>`setView('worldDetail','${item.id}')`],
    ["Location","locations","name","world",item=>`setView('locationDetail','${item.id}')`],
    ["Magic","magicSystems","name","world",item=>`setView('magicDetail','${item.id}')`],
    ["Organization","organizations","name","world",item=>`setView('organizationDetail','${item.id}')`],
    ["Mystery","mysteries","question","plot",()=>`setView('mysteries')`],
    ["Foreshadowing","foreshadowing","hint","plot",()=>`setView('foreshadowing')`]
  ];
  return[
    {type:"Project",category:"project",title:activeSeries()?.title,text:JSON.stringify(activeSeries()||{}).toLowerCase(),action:"setView('projectDashboard')"},
    {type:"Book",category:"project",title:b?.title,text:JSON.stringify(b||{}).toLowerCase(),action:"setView('overview')"},
    ...manuscript,
    ...collections.flatMap(([type,collection,key,category,actionFn])=>(data[collection]||[]).filter(seriesScope).map(item=>({type,category,title:item[key]||"Untitled",text:JSON.stringify(item).toLowerCase(),action:actionFn(item)})))
  ];
}
function setSearchFilter(filter){data.searchFilter=filter||'all'; runSearch();}
function runSearch(){
  const search=document.getElementById("globalSearch"), box=document.getElementById("searchResults"); if(!search||!box)return;
  const q=search.value.trim().toLowerCase(); if(!q){box.classList.add("hidden"); box.innerHTML=""; return}
  const filter=data.searchFilter||'all';
  const matches=searchableItems().filter(item=>item.text.includes(q)&&(filter==='all'||item.category===filter));
  box.classList.remove("hidden");
  box.innerHTML=`<div class="search-filter-row"><strong>Search Results</strong><select onchange="setSearchFilter(this.value)"><option value="all" ${filter==='all'?'selected':''}>All</option><option value="characters" ${filter==='characters'?'selected':''}>Characters / Relationships</option><option value="world" ${filter==='world'?'selected':''}>World Building</option><option value="plot" ${filter==='plot'?'selected':''}>Plot</option><option value="manuscript" ${filter==='manuscript'?'selected':''}>Manuscript</option><option value="project" ${filter==='project'?'selected':''}>Project / Book</option></select></div>`+(matches.length?matches.slice(0,30).map(m=>`<button class="search-result-btn" onclick="${m.action||''}; setVal('globalSearch',''); runSearch();"><strong>${escapeHTML(m.type)}:</strong> ${escapeHTML(m.title||"Untitled")}</button>`).join(""):"<p>No matches found.</p>");
}


function toggleLookupSidebar(forceClosed){
  const sidebar=document.getElementById('manuscriptLookupSidebar');
  if(!sidebar)return;
  const shouldClose=forceClosed===true ? true : !sidebar.classList.contains('collapsed');
  sidebar.classList.toggle('collapsed', shouldClose);
  if(!shouldClose){
    setTimeout(()=>document.getElementById('manuscriptLookupSearch')?.focus(),80);
    runManuscriptLookup();
  }
}
function projectLookupItems(){
  const items=[];
  const add=(type,title,item,category)=>{items.push({type,title:title||"Untitled",item:item||{},category:category||type,text:JSON.stringify(item||{}).toLowerCase()});};
  (data.characters||[]).filter(seriesScope).forEach(c=>add("Character",c.name,c,"Characters"));
  (data.relationships||[]).filter(seriesScope).forEach(r=>add("Relationship",`${characterName(r.a)} + ${characterName(r.b)}`,r,"Relationships"));
  (data.locations||[]).filter(seriesScope).forEach(l=>add("Location",l.name,l,"World Building"));
  (data.organizations||[]).filter(seriesScope).forEach(o=>add("Organization",o.name,o,"World Building"));
  (data.magicSystems||[]).filter(seriesScope).forEach(m=>add("Magic / System",m.name,m,"World Building"));
  (data.world||[]).filter(seriesScope).forEach(w=>add(worldCategoryLabel(w.category)||"Worldbuilding",w.name,w,"World Building"));
  (data.plotCards||[]).filter(seriesScope).forEach(p=>add("Plot Point",p.title,p,"Plot Board"));
  (data.plotArcs||[]).filter(seriesScope).forEach(a=>add("Plot Arc",a.title,a,"Plot Board"));
  (data.timeline||[]).filter(seriesScope).forEach(t=>add("Timeline",t.when||t.event,t,"Series"));
  return items;
}
function labelFromKey(key){return String(key||'').replace(/([A-Z])/g,' $1').replace(/[_-]+/g,' ').replace(/^./,c=>c.toUpperCase()).trim();}
function lookupDisplayValue(value){
  if(value===undefined||value===null||value==="")return "";
  if(Array.isArray(value))return value.filter(Boolean).map(v=>typeof v==='object'?(v.title||v.name||v.label||JSON.stringify(v)):v).join(', ');
  if(typeof value==='object')return value.title||value.name||value.label||"";
  return String(value);
}
function lookupFieldRows(item){
  const skip=new Set(['id','seriesId','bookId','image','photo','cover','coverImage','imageUrl','audioUrl','fileData','content','text','html','customSections','appearances']);
  const preferred=['name','title','role','type','category','age','species','race','status','occupation','description','summary','purpose','leader','headquarters','region','location','rules','limits','cost','source','history','notes','chapter','wordCount','scenes','when','event'];
  const keys=[...preferred.filter(k=>Object.prototype.hasOwnProperty.call(item,k)), ...Object.keys(item||{}).filter(k=>!preferred.includes(k))];
  return keys.filter(k=>!skip.has(k)&&lookupDisplayValue(item[k])).slice(0,12).map(k=>`<div class="lookup-detail-row"><span>${escapeHTML(labelFromKey(k))}</span><p>${escapeHTML(lookupDisplayValue(item[k])).slice(0,700)}</p></div>`).join('');
}
function lookupImage(item){
  const src=item?.image||item?.photo||item?.cover||item?.coverImage||item?.imageUrl;
  return src?`<img class="lookup-preview-img" src="${escapeHTML(src)}" alt="" />`:"";
}
function lookupDetailsHTML(item){
  const rows=lookupFieldRows(item.item||{});
  const custom=(item.item?.customSections||[]).filter(sec=>sec.title||sec.text).slice(0,6).map(sec=>`<div class="lookup-detail-row"><span>${escapeHTML(sec.title||'Custom Section')}</span><p>${escapeHTML(sec.text||'')}</p></div>`).join('');
  const body=rows||custom?rows+custom:`<p class="muted">No preview details available for this entry yet.</p>`;
  return `<details class="lookup-detail-card"><summary><span><strong>${escapeHTML(item.type)}:</strong> ${escapeHTML(item.title)}</span><em>${escapeHTML(item.category||'')}</em></summary>${lookupImage(item.item)}<div class="lookup-detail-body">${body}</div></details>`;
}
function runManuscriptLookup(){
  const input=document.getElementById('manuscriptLookupSearch');
  const box=document.getElementById('manuscriptLookupResults');
  if(!input||!box)return;
  const q=input.value.trim().toLowerCase();
  const all=projectLookupItems();
  const matches=q?all.filter(item=>item.text.includes(q)||String(item.title||'').toLowerCase().includes(q)).slice(0,20):all.slice(0,12);
  box.classList.remove('hidden');
  box.innerHTML=matches.length?matches.map(lookupDetailsHTML).join(''):`<p class="muted">No project entries found.</p>`;
}

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
function resetAll(){if(!confirm("Clear the currently loaded workspace view? This does not delete Supabase cloud data. Use Trash/Delete inside the app for cloud data."))return; const currentUser=data.user; data={...structuredClone(defaultData),...loadUiPrefs(),user:currentUser}; cloudLoaded=false; saveUiPrefs(); renderAll()}

["seriesTitleEdit","seriesTypeEdit","seriesGenreEdit","seriesSynopsisEdit","seriesThemeEdit","seriesMysteriesEdit","seriesForeshadowingEdit","bookTitleEdit","bookStatusEdit","bookSummaryEdit","bookThemeEdit","bookNotesEdit"].forEach(id=>{document.getElementById(id).addEventListener("input",()=>saveOverviewFields(true))});
["currentChapterTitle","currentSceneTitle","scenePOV","sceneLocation","scenePlotPoint","sceneDate","sceneMood","scenePurpose"].forEach(id=>{const el=document.getElementById(id); if(el)el.addEventListener("input",()=>saveCurrentScene(true))});
["bookIsPovEdit"].forEach(id=>{const el=document.getElementById(id); if(el)el.addEventListener("change",()=>saveOverviewFields(true))});
document.getElementById("richEditor").addEventListener("input",()=>saveCurrentScene(false));
document.getElementById("scenePlotPoint")?.addEventListener("change",saveScenePlotPoint);
document.getElementById("richEditor").addEventListener("blur",()=>syncToCloud(false));
document.getElementById("globalSearch").addEventListener("input",runSearch);
document.getElementById("clearSearch").addEventListener("click",()=>{setVal("globalSearch","");runSearch()});

if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",startBulletButtonObserver)}else{startBulletButtonObserver()}
initSupabase();
refreshSession().then(()=>{if(data.user?.id){loadFromCloud(false).then(async()=>{await offerLegacyLocalMigration(); data.activeSeriesId=null;data.activeBookId=null;saveUiPrefs();updateAuthGate()})}else updateAuthGate()});

/* === Series Dashboard + Book-Specific Character Arcs Patch === */
let characterArcDrafts=[];
function seriesBookOptions(selected=''){
  const books=seriesBooks();
  return `<option value="">Select book</option>`+books.map(b=>`<option value="${b.id}" ${b.id===selected?'selected':''}>${escapeHTML(b.title||'Untitled Book')}</option>`).join('');
}
function renderCharacterArcDraftList(){
  const el=document.getElementById('charArcDraftList'); if(!el)return;
  el.innerHTML=characterArcDrafts.length?characterArcDrafts.map(a=>`<div class="custom-section-chip"><strong>${escapeHTML((seriesBooks().find(b=>b.id===a.bookId)?.title)||'Book')}</strong><button type="button" onclick="removeCharacterArcDraft('${a.id}')">Remove</button></div>`).join(''):`<p class="muted">No book arcs added yet.</p>`;
}
function populateCharacterArcCreator(){
  const sel=document.getElementById('charArcBook'); if(sel)sel.innerHTML=seriesBookOptions(sel.value||data.activeBookId||'');
  renderCharacterArcDraftList();
}
function addCharacterArcDraft(){
  const bookId=val('charArcBook')||data.activeBookId;
  const text=val('charArcText').trim();
  if(!bookId&&!text)return;
  characterArcDrafts.push({id:uid(),bookId,text});
  clearFields(['charArcText']);
  renderCharacterArcDraftList();
}
function removeCharacterArcDraft(id){characterArcDrafts=characterArcDrafts.filter(a=>a.id!==id); renderCharacterArcDraftList();}
function collectCharacterArcDrafts(){
  const arcs=[...characterArcDrafts];
  const bookId=val('charArcBook')||data.activeBookId;
  const text=val('charArcText').trim();
  if(text)arcs.push({id:uid(),bookId,text});
  return arcs.filter(a=>a.bookId||a.text);
}
function normalizeCharacterBookArcs(c){
  if(!Array.isArray(c.bookArcs)){
    c.bookArcs=[];
    if((c.arc||'').trim()) c.bookArcs.push({id:uid(),bookId:c.bookId||data.activeBookId||'',text:c.arc});
  }
  return c.bookArcs;
}
function renderCharacterBookArcs(c){
  const arcs=normalizeCharacterBookArcs(c).filter(a=>a.text);
  if(!arcs.length)return '';
  return `<section class="character-section"><h4>Character Arc by Book</h4><div class="arc-stage-list">${arcs.map(a=>`<div class="arc-stage-card"><h4>${escapeHTML(seriesBooks().find(b=>b.id===a.bookId)?.title||'Book')}</h4><p>${formatMultiline(a.text||'')}</p></div>`).join('')}</div></section>`;
}
function addEditBookArcRow(bookId='',text=''){
  const wrap=document.getElementById('editBookArcsList'); if(!wrap)return;
  const id=uid();
  const div=document.createElement('div');
  div.className='book-arc-row';
  div.dataset.arcRow='true';
  div.innerHTML=`<select class="editArcBook">${seriesBookOptions(bookId)}</select><textarea class="editArcText" placeholder="Character arc for this book">${escapeHTML(text||'')}</textarea><div class="arc-row-actions"><button type="button" class="delete-btn" onclick="this.closest('.book-arc-row').remove()">Remove Arc</button></div>`;
  wrap.appendChild(div);
}
function renderEditBookArcs(c){
  const arcs=normalizeCharacterBookArcs(c);
  return `<div class="full-span custom-section-builder"><h4>Book Specific Character Arcs</h4><div id="editBookArcsList">${arcs.map(a=>`<div class="book-arc-row" data-arc-row="true"><select class="editArcBook">${seriesBookOptions(a.bookId||'')}</select><textarea class="editArcText" placeholder="Character arc for this book">${escapeHTML(a.text||'')}</textarea><div class="arc-row-actions"><button type="button" class="delete-btn" onclick="this.closest('.book-arc-row').remove()">Remove Arc</button></div></div>`).join('')}</div><button type="button" onclick="addEditBookArcRow()">+ Add Another Character Arc</button></div>`;
}
function collectEditBookArcs(){
  return [...document.querySelectorAll('#editBookArcsList .book-arc-row')].map(row=>({id:uid(),bookId:row.querySelector('.editArcBook')?.value||'',text:row.querySelector('.editArcText')?.value||''})).filter(a=>a.bookId||a.text);
}
function renderSelects(){
  const chars=data.characters.filter(seriesScope); const charOptions=`<option value="">Select character</option>`+chars.map(c=>`<option value="${c.id}">${escapeHTML(c.name)}</option>`).join("");
  ["scenePOV","relA","relB"].forEach(id=>setHTML(id,charOptions)); updateRelationshipViewLabels();
  const locs=data.locations.filter(seriesScope); setHTML("sceneLocation",`<option value="">Select location</option>`+locs.map(l=>`<option value="${l.id}">${escapeHTML(l.name)}</option>`).join(""));
  const plotOptions=`<option value="">Plot Board Point</option>`+plotBoardItems().map(p=>`<option value="${p.id}">${escapeHTML((plotArcItems().find(a=>a.id===p.arcId)?.title||"Plot")+" — "+(p.title||"Untitled Point"))}</option>`).join(""); setHTML("scenePlotPoint",plotOptions);
  const beats=data.structureBeats.filter(visibleByScope); setHTML("chapterStructureBeat",`<option value="">Structure beat</option>`+beats.map(b=>`<option value="${b.id}">${escapeHTML(b.name)}</option>`).join(""));
  populateCharacterArcCreator();
}
function addCharacter(){
  const input=document.getElementById("charPhoto"); const file=input?.files?.[0];
  const finish=photo=>{data.characters.push({id:uid(),...scopedItem(val("charScope")),name:val("charName"),role:val("charRole"),species:val("charSpecies"),photo,basicInfo:val("charBasicInfo"),description:val("charDescription"),personality:val("charPersonality"),backstory:val("charBackstory"),wound:val("charWound"),bookArcs:collectCharacterArcDrafts(),voice:val("charVoice"),secrets:val("charSecrets"),quotes:val("charQuotes"),customSections:[...characterCustomSectionDrafts],created:new Date().toISOString()}); clearFields(["charName","charSpecies","charBasicInfo","charDescription","charPersonality","charBackstory","charWound","charArcText","charVoice","charSecrets","charQuotes","charCustomTitle","charCustomText"]); characterCustomSectionDrafts=[]; characterArcDrafts=[]; renderCharacterCustomDraftList(); renderCharacterArcDraftList(); if(input)input.value=""; clearOverviewImagePreview("worldImagePreview"); hideAddForm("characterAddForm"); saveData()};
  if(!file)return finish(""); readImageUpload(input,finish)
}
function renderCharacterEditForm(c){
  const custom=Array.isArray(c.customSections)?c.customSections:[];
  return `<div class="panel character-detail-grid"><div>${c.photo?`<img class="character-photo" src="${c.photo}" alt="${escapeHTML(c.name)}"><input id="characterPhotoUpload_${c.id}" type="file" accept="image/*" class="hidden" onchange="updateCharacterPhoto('${c.id}',this)"><button type="button" class="wide" onclick="triggerCharacterPhotoUpload('${c.id}',event)">Change Photo</button>`:`<div class="character-photo panel photo-placeholder"><p>No Photo</p><input id="characterPhotoUpload_${c.id}" type="file" accept="image/*" class="hidden" onchange="updateCharacterPhoto('${c.id}',this)"><button type="button" class="wide" onclick="triggerCharacterPhotoUpload('${c.id}',event)">+ Add Character Photo</button></div>`}</div><div><h3>Edit Character Detail</h3><div class="form-grid"><input id="editCharName" placeholder="Character name" value="${escapeAttr(c.name||"")}"><select id="editCharRole"><option>Main</option><option>Side</option><option>Love Interest</option><option>Antagonist</option><option>Mentor</option><option>Other</option></select><input id="editCharSpecies" placeholder="Species / identity" value="${escapeAttr(c.species||"")}"><textarea id="editCharBasicInfo" placeholder="Basic Information">${escapeHTML(c.basicInfo||c.bio||"")}</textarea><textarea id="editCharDescription" placeholder="Physical Appearance">${escapeHTML(c.description||"")}</textarea><textarea id="editCharPersonality" placeholder="Personality">${escapeHTML(c.personality||"")}</textarea><textarea id="editCharBackstory" placeholder="Backstory">${escapeHTML(c.backstory||"")}</textarea><textarea id="editCharWound" placeholder="Psychology: Core Wound, Core Fear, Core Desire, Fatal Flaw">${escapeHTML(c.wound||"")}</textarea>${renderEditBookArcs(c)}<textarea id="editCharVoice" placeholder="Voice / speech patterns">${escapeHTML(c.voice||"")}</textarea><textarea id="editCharSecrets" placeholder="Secrets">${escapeHTML(c.secrets||"")}</textarea><textarea id="editCharQuotes" placeholder="Quotes">${escapeHTML(c.quotes||"")}</textarea></div><h3>Custom Sections</h3>${custom.map(sec=>`<div class="custom-section-builder"><input id="editCustomTitle_${sec.id}" placeholder="Section title" value="${escapeAttr(sec.title||"")}"><textarea id="editCustomText_${sec.id}" placeholder="Section notes">${escapeHTML(sec.text||"")}</textarea><button type="button" class="delete-btn" onclick="deleteCustomSectionFromCharacter('${c.id}','${sec.id}'); characterDetailEditMode=true">Delete Section</button></div>`).join("")||"<p class='muted'>No custom sections yet.</p>"}<button type="button" onclick="addCharacterCustomSectionFromDetail('${c.id}')">+ Add Custom Section</button><hr><button onclick="saveCharacterDetailEdit('${c.id}')">Save Changes</button><button class="ghost-btn" onclick="cancelCharacterDetailEdit()">Cancel</button></div></div>`;
}
function saveCharacterDetailEdit(characterId){
  const c=data.characters.find(x=>x.id===characterId); if(!c)return;
  c.name=val("editCharName"); c.role=val("editCharRole"); c.species=val("editCharSpecies");
  c.basicInfo=val("editCharBasicInfo"); c.description=val("editCharDescription"); c.personality=val("editCharPersonality");
  c.backstory=val("editCharBackstory"); c.wound=val("editCharWound"); c.bookArcs=collectEditBookArcs(); c.arc=''; c.voice=val("editCharVoice");
  c.secrets=val("editCharSecrets"); c.quotes=val("editCharQuotes");
  c.customSections=(Array.isArray(c.customSections)?c.customSections:[]).map(sec=>({id:sec.id,title:val(`editCustomTitle_${sec.id}`)||"Untitled Section",text:val(`editCustomText_${sec.id}`)}));
  characterDetailEditMode=false; saveData(true);
}
function preserveCharacterDetailEditDraft(characterId){
  const c=data.characters.find(x=>x.id===characterId); if(!c)return null;
  const nameEl=document.getElementById("editCharName");
  if(nameEl){
    c.name=val("editCharName"); c.role=val("editCharRole"); c.species=val("editCharSpecies");
    c.basicInfo=val("editCharBasicInfo"); c.description=val("editCharDescription"); c.personality=val("editCharPersonality");
    c.backstory=val("editCharBackstory"); c.wound=val("editCharWound"); c.bookArcs=collectEditBookArcs(); c.arc=''; c.voice=val("editCharVoice");
    c.secrets=val("editCharSecrets"); c.quotes=val("editCharQuotes");
    (c.customSections||[]).forEach(sec=>{const t=document.getElementById(`editCustomTitle_${sec.id}`); const x=document.getElementById(`editCustomText_${sec.id}`); if(t)sec.title=t.value; if(x)sec.text=x.value;});
  }
  return c;
}
function renderCharacterDetail(){
  const el=document.getElementById("characterDetailContent"); if(!el)return; const c=data.characters.find(x=>x.id===data.selectedCharacterId); if(!c){el.innerHTML=`<div class="panel"><p>Select a character from the sidebar.</p></div>`;return} if(characterDetailEditMode){el.innerHTML=renderCharacterEditForm(c); setVal("editCharRole",c.role||"Other"); return} const rels=characterRelationships(c.id), custom=Array.isArray(c.customSections)?c.customSections:[]; el.innerHTML=`<div class="panel character-detail-grid"><div>${c.photo?`<img class="character-photo" src="${c.photo}" alt="${escapeHTML(c.name)}"><input id="characterPhotoUpload_${c.id}" type="file" accept="image/*" class="hidden" onchange="updateCharacterPhoto('${c.id}',this)"><button type="button" class="wide" onclick="triggerCharacterPhotoUpload('${c.id}',event)">Change Photo</button>`:`<div class="character-photo panel photo-placeholder"><p>No Photo</p><input id="characterPhotoUpload_${c.id}" type="file" accept="image/*" class="hidden" onchange="updateCharacterPhoto('${c.id}',this)"><button type="button" class="wide" onclick="triggerCharacterPhotoUpload('${c.id}',event)">+ Add Character Photo</button></div>`}<button class="wide" onclick="startCharacterDetailEdit()">Edit Character Detail</button><button class="wide" onclick="addCharacterCustomSectionFromDetail('${c.id}')">+ Add Custom Section</button></div><div><h3>${escapeHTML(c.name)}</h3><span class="tag">${escapeHTML(c.role||"")}</span><span class="tag">${escapeHTML(c.species||"")}</span>${detailBlock("Basic Information",c.basicInfo||c.bio)}${detailBlock("Physical Appearance",c.description)}${detailBlock("Personality",c.personality)}${detailBlock("Backstory",c.backstory)}${detailBlock("Psychology: Core Wound, Core Fear, Core Desire, Fatal Flaw",c.wound)}${renderCharacterBookArcs(c)}${detailBlock("Voice / Speech Patterns",c.voice)}${detailBlock("Secrets",c.secrets)}${detailBlock("Quotes",c.quotes)}${custom.map(sec=>`<section class="character-section custom-character-section"><h4>${escapeHTML(sec.title||"Untitled Section")}</h4><p>${formatMultiline(sec.text||"")}</p><button class="delete-btn" onclick="deleteCustomSectionFromCharacter('${c.id}','${sec.id}')">Delete Section</button></section>`).join("")}<h3>Linked Relationships</h3>${rels.length?rels.map(r=>{const other=r.a===c.id?r.b:r.a; const ownView=r.a===c.id?r.aView:r.bView; const otherView=r.a===c.id?r.bView:r.aView; return `<p><strong>${escapeHTML(characterName(r.a))} + ${escapeHTML(characterName(r.b))}:</strong> ${escapeHTML(r.type||"")} — ${escapeHTML(r.status||"")}<br>${escapeHTML(r.history||r.arc||"")}${ownView?`<br><strong>${escapeHTML(c.name)}'s View:</strong> ${escapeHTML(ownView)}`:""}${otherView?`<br><strong>${escapeHTML(characterName(other))}'s View:</strong> ${escapeHTML(otherView)}`:""}</p>`}).join(""):"<p>No linked relationships yet.</p>"}${renderSharedAppearanceLog("character",c.id)}</div></div>`;
}
function characterArcItemsFromCharacters(){
  return data.characters.filter(seriesScope).flatMap(c=>normalizeCharacterBookArcs(c).filter(a=>a.text).map(a=>({id:`${c.id}_${a.id}`,title:`${c.name||'Unnamed Character'} — ${seriesBooks().find(b=>b.id===a.bookId)?.title||'Book Arc'}`,characterId:c.id,bookId:a.bookId,text:a.text,source:'character'})));
}
function renderSeriesTools(){
  const warn=document.getElementById("seriesOnlyWarning"), content=document.getElementById("seriesToolsContent"); if(!warn||!content)return;
  warn.innerHTML=""; content.classList.remove("hidden");
  const books=seriesBooks(); const seriesWords=books.reduce((sum,b)=>sum+bookWordCount(b),0); const scenes=sceneRowsAcrossSeries(); const warnings=seriesContinuityWarnings(); const autoArcs=characterArcItemsFromCharacters();
  const unresolved=(data.mysteries||[]).filter(m=>seriesScope(m)&&(m.status||'Open')!=='Resolved').length;
  const openThreads=(data.threads||[]).filter(t=>seriesScope(t)&&(t.status||'Open')!=='Resolved').length;
  const worldCount=data.world.filter(seriesScope).length+data.locations.filter(seriesScope).length+data.organizations.filter(seriesScope).length+data.magicSystems.filter(seriesScope).length;
  setText("seriesBookCount",books.length); setText("seriesTotalWords",seriesWords); setText("seriesArcCount",autoArcs.length+(data.seriesArcs||[]).filter(seriesScope).length); setText("seriesWarningCount",warnings.length);
  setHTML("seriesDashboardBooks", books.map(b=>`<article class="item-card clickable-card" onclick="openBookFromDashboard('${b.id}')"><div class="card-header"><h3>${escapeHTML(b.title||'Untitled Book')}</h3><span class="tag">${escapeHTML(b.status||'Drafting')}</span></div><div class="card-body"><p><strong>Words:</strong> ${bookWordCount(b)}</p><p><strong>Chapters:</strong> ${(b.manuscript||[]).length}</p><p><strong>Scenes:</strong> ${(b.manuscript||[]).flatMap(c=>c.scenes||[]).length}</p></div></article>`).join('')||'<p>No books yet.</p>');
  setHTML("seriesBigPicture", `<p><strong>Characters:</strong> ${data.characters.filter(seriesScope).length}</p><p><strong>World Entries:</strong> ${worldCount}</p><p><strong>Unresolved Questions:</strong> ${unresolved}</p><p><strong>Open Threads:</strong> ${openThreads}</p><p><strong>Total Scenes:</strong> ${scenes.length}</p>`);
  setHTML("seriesArcPreview", autoArcs.slice(0,6).map(a=>`<div class="chapter-stat-row"><span>${escapeHTML(a.title)}</span><button class="ghost-btn" onclick="setView('characterDetail','${a.characterId}')">Open</button></div>`).join('')||'<p class="muted">Add book-specific character arcs on character pages to populate this preview.</p>');
  setHTML("seriesNeedsAttention", warnings.slice(0,8).map(w=>`<p>⚠️ ${escapeHTML(w)}</p>`).join('')||'<p>No major issues found.</p>');
}
function renderSeriesArcs(){
  const el=document.getElementById('seriesArcList'); if(!el)return; setHTML('seriesArcCharacter',`<option value="">No specific character</option>`+data.characters.filter(seriesScope).map(c=>`<option value="${c.id}">${escapeHTML(c.name||'Unnamed')}</option>`).join(''));
  const auto=characterArcItemsFromCharacters(); const manual=(data.seriesArcs||[]).filter(seriesScope);
  const autoHtml=auto.map(a=>`<article class="item-card"><div class="card-header"><h3>${escapeHTML(a.title)}</h3><span class="tag">From Character Page</span></div><div class="card-body"><span class="tag">${escapeHTML(characterName(a.characterId))}</span>${detail(seriesBooks().find(b=>b.id===a.bookId)?.title||'Book',a.text)}<button class="ghost-btn" onclick="setView('characterDetail','${a.characterId}')">Edit on Character Page</button></div></article>`).join('');
  const manualHtml=manual.map(a=>`<article class="item-card"><div class="card-header"><h3>${escapeHTML(a.title||'Untitled Arc')}</h3><button class="delete-btn" onclick="deleteItem('seriesArcs','${a.id}')">Delete</button></div><div class="card-body"><span class="tag">${escapeHTML(a.characterId?characterName(a.characterId):'Series Arc')}</span>${detail('Book 1',a.book1)}${detail('Book 2',a.book2)}${detail('Book 3',a.book3)}${detail('Notes',a.notes)}</div></article>`).join('');
  el.innerHTML=(autoHtml||manualHtml)?`<div class="panel"><h3>Synced Character Arcs</h3>${autoHtml||'<p class="muted">No character-page arcs yet.</p>'}</div><div class="panel"><h3>Manual Series Arcs</h3>${manualHtml||'<p class="muted">No manual series arcs yet.</p>'}</div>`:'<p class="muted">No series arcs yet.</p>';
}

/* === Book Placeholder Character Arc + Grouped Series Arc Tracker Patch === */
function arcPlaceholderId(n){return `__book_${Math.max(1,Number(n)||1)}`;}
function isPlaceholderBookId(bookId){return typeof bookId==='string' && bookId.startsWith('__book_');}
function placeholderNumberFromId(bookId){const m=String(bookId||'').match(/__book_(\d+)/); return m?Number(m[1]):1;}
function characterArcBookLabel(arc, fallbackIndex=0){
  const b=seriesBooks().find(x=>x.id===(arc||{}).bookId);
  if(b)return b.title||'Untitled Book';
  if(isPlaceholderBookId((arc||{}).bookId))return `Book #${placeholderNumberFromId(arc.bookId)}`;
  if((arc||{}).bookLabel)return arc.bookLabel;
  return `Book #${fallbackIndex+1}`;
}
function nextPlaceholderBookIdForArcs(arcs=[]){
  const nums=(arcs||[]).map(a=>isPlaceholderBookId(a.bookId)?placeholderNumberFromId(a.bookId):0).filter(Boolean);
  const next=Math.max((arcs||[]).length+1, nums.length?Math.max(...nums)+1:1);
  return arcPlaceholderId(next);
}
function realBookIdsUsedByArcs(arcs=[], ignoreArcId=''){
  return new Set((arcs||[]).filter(a=>a.id!==ignoreArcId && a.bookId && !isPlaceholderBookId(a.bookId)).map(a=>a.bookId));
}
function seriesBookOptions(selected='', characterId='', arcId='', draftMode=false){
  const books=seriesBooks();
  let used=new Set();
  if(characterId){
    const c=data.characters.find(x=>x.id===characterId);
    used=realBookIdsUsedByArcs(normalizeCharacterBookArcs(c||{}), arcId);
  }else if(draftMode){
    used=realBookIdsUsedByArcs(characterArcDrafts||[], arcId);
  }
  const available=books.filter(b=>b.id===selected || !used.has(b.id));
  const placeholderSelected=isPlaceholderBookId(selected);
  const placeholder=placeholderSelected?selected:arcPlaceholderId((draftMode?(characterArcDrafts||[]).length:0)+1);
  const options=available.map(b=>`<option value="${b.id}" ${b.id===selected?'selected':''}>${escapeHTML(b.title||'Untitled Book')}</option>`).join('');
  if(options && !placeholderSelected) return `<option value="">Select book</option>${options}<option value="${placeholder}">Book #${placeholderNumberFromId(placeholder)}</option>`;
  return `${options}<option value="${placeholder}" ${placeholderSelected||!selected?'selected':''}>Book #${placeholderNumberFromId(placeholder)}</option>`;
}
function renderCharacterArcDraftList(){
  const el=document.getElementById('charArcDraftList'); if(!el)return;
  el.innerHTML=characterArcDrafts.length?characterArcDrafts.map((a,i)=>`<div class="custom-section-chip"><strong>${escapeHTML(characterArcBookLabel(a,i))}</strong><button type="button" onclick="removeCharacterArcDraft('${a.id}')">Remove</button></div>`).join(''):`<p class="muted">No book arcs added yet.</p>`;
}
function populateCharacterArcCreator(){
  const sel=document.getElementById('charArcBook');
  if(sel){
    const selected=sel.value||data.activeBookId||'';
    sel.innerHTML=seriesBookOptions(selected,'','',true);
  }
  renderCharacterArcDraftList();
}
function addCharacterArcDraft(){
  let bookId=val('charArcBook')||data.activeBookId;
  const text=val('charArcText').trim();
  if(!bookId) bookId=nextPlaceholderBookIdForArcs(characterArcDrafts);
  if(!text && !bookId)return;
  characterArcDrafts.push({id:uid(),bookId,bookLabel:isPlaceholderBookId(bookId)?`Book #${placeholderNumberFromId(bookId)}`:'',text});
  clearFields(['charArcText']);
  populateCharacterArcCreator();
}
function collectCharacterArcDrafts(){
  const arcs=[...characterArcDrafts];
  let bookId=val('charArcBook')||data.activeBookId;
  const text=val('charArcText').trim();
  if(text){
    if(!bookId) bookId=nextPlaceholderBookIdForArcs(arcs);
    arcs.push({id:uid(),bookId,bookLabel:isPlaceholderBookId(bookId)?`Book #${placeholderNumberFromId(bookId)}`:'',text});
  }
  return arcs.filter(a=>a.bookId||a.text).map((a,i)=>({...a,id:a.id||uid(),bookId:a.bookId||arcPlaceholderId(i+1),bookLabel:a.bookLabel||(isPlaceholderBookId(a.bookId)?`Book #${placeholderNumberFromId(a.bookId)}`:'')}));
}
function normalizeCharacterBookArcs(c){
  if(!c)return [];
  if(!Array.isArray(c.bookArcs)){
    c.bookArcs=[];
    if((c.arc||'').trim()) c.bookArcs.push({id:uid(),bookId:c.bookId||data.activeBookId||arcPlaceholderId(1),text:c.arc});
  }
  c.bookArcs=c.bookArcs.map((a,i)=>({id:a.id||uid(),bookId:a.bookId||arcPlaceholderId(i+1),bookLabel:a.bookLabel||(isPlaceholderBookId(a.bookId)?`Book #${placeholderNumberFromId(a.bookId)}`:''),text:a.text||''}));
  return c.bookArcs;
}
function renderCharacterBookArcs(c){
  const arcs=normalizeCharacterBookArcs(c).filter(a=>a.text);
  if(!arcs.length)return '';
  return `<section class="character-section"><h4>Character Arc by Book</h4><div class="arc-stage-list">${arcs.map((a,i)=>`<div class="arc-stage-card"><h4>${escapeHTML(characterArcBookLabel(a,i))}</h4><p>${formatMultiline(a.text||'')}</p></div>`).join('')}</div></section>`;
}
function addEditBookArcRow(bookId='',text=''){
  const wrap=document.getElementById('editBookArcsList'); if(!wrap)return;
  const characterId=data.selectedCharacterId||'';
  const existing=collectEditBookArcs();
  if(!bookId){
    const used=realBookIdsUsedByArcs(existing);
    const avail=seriesBooks().find(b=>!used.has(b.id));
    bookId=avail?.id || nextPlaceholderBookIdForArcs(existing);
  }
  const id=uid();
  const div=document.createElement('div');
  div.className='book-arc-row';
  div.dataset.arcRow='true';
  div.dataset.arcId=id;
  div.innerHTML=`<select class="editArcBook">${seriesBookOptions(bookId,characterId,id)}</select><textarea class="editArcText" placeholder="Character arc for this book">${escapeHTML(text||'')}</textarea><div class="arc-row-actions"><button type="button" class="delete-btn" onclick="this.closest('.book-arc-row').remove()">Remove Arc</button></div>`;
  wrap.appendChild(div);
}
function renderEditBookArcs(c){
  const arcs=normalizeCharacterBookArcs(c);
  return `<div class="full-span custom-section-builder"><h4>Book Specific Character Arcs</h4><div id="editBookArcsList">${arcs.map((a,i)=>`<div class="book-arc-row" data-arc-row="true" data-arc-id="${a.id}"><select class="editArcBook">${seriesBookOptions(a.bookId||arcPlaceholderId(i+1),c.id,a.id)}</select><textarea class="editArcText" placeholder="Character arc for this book">${escapeHTML(a.text||'')}</textarea><div class="arc-row-actions"><button type="button" class="delete-btn" onclick="this.closest('.book-arc-row').remove()">Remove Arc</button></div></div>`).join('')}</div><button type="button" onclick="addEditBookArcRow()">+ Add Another Character Arc</button></div>`;
}
function collectEditBookArcs(){
  return [...document.querySelectorAll('#editBookArcsList .book-arc-row')].map((row,i)=>{
    let bookId=row.querySelector('.editArcBook')?.value||'';
    if(!bookId) bookId=arcPlaceholderId(i+1);
    return {id:row.dataset.arcId||uid(),bookId,bookLabel:isPlaceholderBookId(bookId)?`Book #${placeholderNumberFromId(bookId)}`:'',text:row.querySelector('.editArcText')?.value||''};
  }).filter(a=>a.bookId||a.text);
}
function characterArcItemsFromCharacters(){
  return data.characters.filter(seriesScope).flatMap(c=>normalizeCharacterBookArcs(c).filter(a=>a.text).map((a,i)=>({id:`${c.id}_${a.id}`,arcId:a.id,title:`${c.name||'Unnamed Character'} — ${characterArcBookLabel(a,i)}`,characterId:c.id,bookId:a.bookId,bookLabel:characterArcBookLabel(a,i),text:a.text,source:'character'})));
}
function updateCharacterArcBook(characterId, arcId, bookId){
  const c=data.characters.find(x=>x.id===characterId); if(!c)return;
  const arcs=normalizeCharacterBookArcs(c); const arc=arcs.find(a=>a.id===arcId); if(!arc)return;
  arc.bookId=bookId || arc.bookId;
  arc.bookLabel=isPlaceholderBookId(arc.bookId)?`Book #${placeholderNumberFromId(arc.bookId)}`:'';
  saveData(true); renderSeriesArcs(); renderCharacterDetail(); renderSeriesTools();
}
function seriesArcBookSelect(item){
  const books=seriesBooks();
  const opts=books.map(b=>`<option value="${b.id}" ${b.id===item.bookId?'selected':''}>${escapeHTML(b.title||'Untitled Book')}</option>`).join('');
  const placeholder=isPlaceholderBookId(item.bookId)?`<option value="${item.bookId}" selected>${escapeHTML(item.bookLabel||characterArcBookLabel(item))}</option>`:'';
  return `<select class="mini-select" onchange="updateCharacterArcBook('${item.characterId}','${item.arcId}',this.value)">${placeholder}<option value="">Tie to book...</option>${opts}</select>`;
}
function renderSeriesArcs(){
  const el=document.getElementById('seriesArcList'); if(!el)return;
  setHTML('seriesArcCharacter',`<option value="">No specific character</option>`+data.characters.filter(seriesScope).map(c=>`<option value="${c.id}">${escapeHTML(c.name||'Unnamed')}</option>`).join(''));
  const auto=characterArcItemsFromCharacters();
  const manual=(data.seriesArcs||[]).filter(seriesScope);
  const groups=[];
  seriesBooks().forEach(b=>groups.push({id:b.id,label:b.title||'Untitled Book',items:auto.filter(a=>a.bookId===b.id)}));
  const placeholderItems=auto.filter(a=>!seriesBooks().some(b=>b.id===a.bookId));
  const placeholderMap=new Map();
  placeholderItems.forEach(a=>{const key=a.bookId||a.bookLabel||'unassigned'; if(!placeholderMap.has(key))placeholderMap.set(key,{id:key,label:a.bookLabel||characterArcBookLabel(a),items:[]}); placeholderMap.get(key).items.push(a);});
  groups.push(...placeholderMap.values());
  const groupedHtml=groups.filter(g=>g.items.length).map(g=>`<section class="panel"><h3>${escapeHTML(g.label)}</h3><div class="card-grid compact-grid">${g.items.sort((a,b)=>characterName(a.characterId).localeCompare(characterName(b.characterId))).map(a=>`<article class="item-card"><div class="card-header"><h3>${escapeHTML(characterName(a.characterId))}</h3><span class="tag">From Character Page</span></div><div class="card-body">${seriesArcBookSelect(a)}${detail('Arc',a.text)}<button class="ghost-btn" onclick="setView('characterDetail','${a.characterId}')">Edit on Character Page</button></div></article>`).join('')}</div></section>`).join('');
  const manualHtml=manual.map(a=>`<article class="item-card"><div class="card-header"><h3>${escapeHTML(a.title||'Untitled Arc')}</h3><button class="delete-btn" onclick="deleteItem('seriesArcs','${a.id}')">Delete</button></div><div class="card-body"><span class="tag">${escapeHTML(a.characterId?characterName(a.characterId):'Series Arc')}</span>${detail('Book 1',a.book1)}${detail('Book 2',a.book2)}${detail('Book 3',a.book3)}${detail('Notes',a.notes)}</div></article>`).join('');
  el.innerHTML=(groupedHtml||manualHtml)?`${groupedHtml||'<div class="panel"><p class="muted">No character-page arcs yet.</p></div>'}<div class="panel"><h3>Manual Series Arcs</h3>${manualHtml||'<p class="muted">No manual series arcs yet.</p>'}</div>`:'<p class="muted">No series arcs yet.</p>';
}
function renderSeriesTools(){
  const warn=document.getElementById("seriesOnlyWarning"), content=document.getElementById("seriesToolsContent"); if(!warn||!content)return;
  warn.innerHTML=""; content.classList.remove("hidden");
  const books=seriesBooks(); const seriesWords=books.reduce((sum,b)=>sum+bookWordCount(b),0); const scenes=sceneRowsAcrossSeries(); const warnings=seriesContinuityWarnings(); const autoArcs=characterArcItemsFromCharacters();
  const unresolved=(data.mysteries||[]).filter(m=>seriesScope(m)&&(m.status||'Open')!=='Resolved').length;
  const openThreads=(data.threads||[]).filter(t=>seriesScope(t)&&(t.status||'Open')!=='Resolved').length;
  const worldCount=data.world.filter(seriesScope).length+data.locations.filter(seriesScope).length+data.organizations.filter(seriesScope).length+data.magicSystems.filter(seriesScope).length;
  setText("seriesBookCount",books.length); setText("seriesTotalWords",seriesWords); setText("seriesArcCount",autoArcs.length+(data.seriesArcs||[]).filter(seriesScope).length); setText("seriesWarningCount",warnings.length);
  setHTML("seriesDashboardBooks", books.map(b=>`<article class="item-card clickable-card" onclick="openBookFromDashboard('${b.id}')"><div class="card-header"><h3>${escapeHTML(b.title||'Untitled Book')}</h3><span class="tag">${escapeHTML(b.status||'Drafting')}</span></div><div class="card-body"><p><strong>Words:</strong> ${bookWordCount(b)}</p><p><strong>Chapters:</strong> ${(b.manuscript||[]).length}</p><p><strong>Scenes:</strong> ${(b.manuscript||[]).flatMap(c=>c.scenes||[]).length}</p></div></article>`).join('')||'<p>No books yet.</p>');
  setHTML("seriesBigPicture", `<p><strong>Characters:</strong> ${data.characters.filter(seriesScope).length}</p><p><strong>World Entries:</strong> ${worldCount}</p><p><strong>Unresolved Questions:</strong> ${unresolved}</p><p><strong>Open Threads:</strong> ${openThreads}</p><p><strong>Total Scenes:</strong> ${scenes.length}</p>`);
  setHTML("seriesArcPreview", autoArcs.slice(0,6).map(a=>`<div class="chapter-stat-row"><span>${escapeHTML(a.title)}</span>${isPlaceholderBookId(a.bookId)?'<span class="tag">Needs book link</span>':''}<button class="ghost-btn" onclick="setView('characterDetail','${a.characterId}')">Open</button></div>`).join('')||'<p class="muted">Add book-specific character arcs on character pages to populate this preview.</p>');
  setHTML("seriesNeedsAttention", warnings.slice(0,8).map(w=>`<p>⚠️ ${escapeHTML(w)}</p>`).join('')||'<p>No major issues found.</p>');
}

/* === Character Arc Effect/Impact Differentiation + Favicon Patch === */
function characterArcTypeLabel(a){return a?.isImpactArc?'Effect / Impact Arc':'Character Arc';}
function characterArcTypeTag(a){return `<span class="tag ${a?.isImpactArc?'warning-tag':''}">${escapeHTML(characterArcTypeLabel(a))}</span>`;}
function characterArcImpactChecked(){return !!document.getElementById('charArcImpact')?.checked;}
function clearCharacterArcCreatorFields(){clearFields(['charArcText']); const cb=document.getElementById('charArcImpact'); if(cb)cb.checked=false;}

function renderCharacterArcDraftList(){
  const el=document.getElementById('charArcDraftList'); if(!el)return;
  el.innerHTML=characterArcDrafts.length?characterArcDrafts.map((a,i)=>`<div class="custom-section-chip"><strong>${escapeHTML(characterArcBookLabel(a,i))}</strong> ${characterArcTypeTag(a)}<button type="button" onclick="removeCharacterArcDraft('${a.id}')">Remove</button></div>`).join(''):`<p class="muted">No book arcs added yet.</p>`;
}
function addCharacterArcDraft(){
  let bookId=val('charArcBook')||data.activeBookId;
  const text=val('charArcText').trim();
  if(!bookId) bookId=nextPlaceholderBookIdForArcs(characterArcDrafts);
  if(!text && !bookId)return;
  characterArcDrafts.push({id:uid(),bookId,bookLabel:isPlaceholderBookId(bookId)?`Book #${placeholderNumberFromId(bookId)}`:'',text,isImpactArc:characterArcImpactChecked()});
  clearCharacterArcCreatorFields();
  populateCharacterArcCreator();
}
function collectCharacterArcDrafts(){
  const arcs=[...characterArcDrafts];
  let bookId=val('charArcBook')||data.activeBookId;
  const text=val('charArcText').trim();
  if(text){
    if(!bookId) bookId=nextPlaceholderBookIdForArcs(arcs);
    arcs.push({id:uid(),bookId,bookLabel:isPlaceholderBookId(bookId)?`Book #${placeholderNumberFromId(bookId)}`:'',text,isImpactArc:characterArcImpactChecked()});
  }
  return arcs.filter(a=>a.bookId||a.text).map((a,i)=>({...a,id:a.id||uid(),bookId:a.bookId||arcPlaceholderId(i+1),bookLabel:a.bookLabel||(isPlaceholderBookId(a.bookId)?`Book #${placeholderNumberFromId(a.bookId)}`:''),isImpactArc:!!a.isImpactArc}));
}
function normalizeCharacterBookArcs(c){
  if(!c)return [];
  if(!Array.isArray(c.bookArcs)){
    c.bookArcs=[];
    if((c.arc||'').trim()) c.bookArcs.push({id:uid(),bookId:c.bookId||data.activeBookId||arcPlaceholderId(1),text:c.arc,isImpactArc:false});
  }
  c.bookArcs=c.bookArcs.map((a,i)=>({id:a.id||uid(),bookId:a.bookId||arcPlaceholderId(i+1),bookLabel:a.bookLabel||(isPlaceholderBookId(a.bookId)?`Book #${placeholderNumberFromId(a.bookId)}`:''),text:a.text||'',isImpactArc:!!a.isImpactArc}));
  return c.bookArcs;
}
function renderCharacterBookArcs(c){
  const arcs=normalizeCharacterBookArcs(c).filter(a=>a.text);
  if(!arcs.length)return '';
  return `<section class="character-section"><h4>Character Arc by Book</h4><div class="arc-stage-list">${arcs.map((a,i)=>`<div class="arc-stage-card"><h4>${escapeHTML(characterArcBookLabel(a,i))}</h4>${characterArcTypeTag(a)}<p>${formatMultiline(a.text||'')}</p></div>`).join('')}</div></section>`;
}
function addEditBookArcRow(bookId='',text='',isImpactArc=false){
  const wrap=document.getElementById('editBookArcsList'); if(!wrap)return;
  const characterId=data.selectedCharacterId||'';
  const existing=collectEditBookArcs();
  if(!bookId){
    const used=realBookIdsUsedByArcs(existing);
    const avail=seriesBooks().find(b=>!used.has(b.id));
    bookId=avail?.id || nextPlaceholderBookIdForArcs(existing);
  }
  const id=uid();
  const div=document.createElement('div');
  div.className='book-arc-row';
  div.dataset.arcRow='true';
  div.dataset.arcId=id;
  div.innerHTML=`<select class="editArcBook">${seriesBookOptions(bookId,characterId,id)}</select><label class="checkbox-line"><input class="editArcImpact" type="checkbox" ${isImpactArc?'checked':''}> Effect / impact arc</label><textarea class="editArcText" placeholder="Character arc or impact for this book">${escapeHTML(text||'')}</textarea><div class="arc-row-actions"><button type="button" class="delete-btn" onclick="this.closest('.book-arc-row').remove()">Remove Arc</button></div>`;
  wrap.appendChild(div);
}
function renderEditBookArcs(c){
  const arcs=normalizeCharacterBookArcs(c);
  return `<div class="full-span custom-section-builder"><h4>Book Specific Character Arcs</h4><p class="muted">Use “Effect / impact arc” when this character is not directly present in that book, but their choices, legacy, or interactions still shape another book.</p><div id="editBookArcsList">${arcs.map((a,i)=>`<div class="book-arc-row" data-arc-row="true" data-arc-id="${a.id}"><select class="editArcBook">${seriesBookOptions(a.bookId||arcPlaceholderId(i+1),c.id,a.id)}</select><label class="checkbox-line"><input class="editArcImpact" type="checkbox" ${a.isImpactArc?'checked':''}> Effect / impact arc</label><textarea class="editArcText" placeholder="Character arc or impact for this book">${escapeHTML(a.text||'')}</textarea><div class="arc-row-actions"><button type="button" class="delete-btn" onclick="this.closest('.book-arc-row').remove()">Remove Arc</button></div></div>`).join('')}</div><button type="button" onclick="addEditBookArcRow()">+ Add Another Character Arc</button></div>`;
}
function collectEditBookArcs(){
  return [...document.querySelectorAll('#editBookArcsList .book-arc-row')].map((row,i)=>{
    let bookId=row.querySelector('.editArcBook')?.value||'';
    if(!bookId) bookId=arcPlaceholderId(i+1);
    return {id:row.dataset.arcId||uid(),bookId,bookLabel:isPlaceholderBookId(bookId)?`Book #${placeholderNumberFromId(bookId)}`:'',text:row.querySelector('.editArcText')?.value||'',isImpactArc:!!row.querySelector('.editArcImpact')?.checked};
  }).filter(a=>a.bookId||a.text);
}
function characterArcItemsFromCharacters(){
  return data.characters.filter(seriesScope).flatMap(c=>normalizeCharacterBookArcs(c).filter(a=>a.text).map((a,i)=>({id:`${c.id}_${a.id}`,arcId:a.id,title:`${c.name||'Unnamed Character'} — ${characterArcBookLabel(a,i)}`,characterId:c.id,bookId:a.bookId,bookLabel:characterArcBookLabel(a,i),text:a.text,isImpactArc:!!a.isImpactArc,source:'character'})));
}
function renderSeriesArcs(){
  const el=document.getElementById('seriesArcList'); if(!el)return;
  setHTML('seriesArcCharacter',`<option value="">No specific character</option>`+data.characters.filter(seriesScope).map(c=>`<option value="${c.id}">${escapeHTML(c.name||'Unnamed')}</option>`).join(''));
  const auto=characterArcItemsFromCharacters();
  const manual=(data.seriesArcs||[]).filter(seriesScope);
  const groups=[];
  seriesBooks().forEach(b=>groups.push({id:b.id,label:b.title||'Untitled Book',items:auto.filter(a=>a.bookId===b.id)}));
  const placeholderItems=auto.filter(a=>!seriesBooks().some(b=>b.id===a.bookId));
  const placeholderMap=new Map();
  placeholderItems.forEach(a=>{const key=a.bookId||a.bookLabel||'unassigned'; if(!placeholderMap.has(key))placeholderMap.set(key,{id:key,label:a.bookLabel||characterArcBookLabel(a),items:[]}); placeholderMap.get(key).items.push(a);});
  groups.push(...placeholderMap.values());
  const groupedHtml=groups.filter(g=>g.items.length).map(g=>{
    const own=g.items.filter(a=>!a.isImpactArc).sort((a,b)=>characterName(a.characterId).localeCompare(characterName(b.characterId)));
    const impact=g.items.filter(a=>a.isImpactArc).sort((a,b)=>characterName(a.characterId).localeCompare(characterName(b.characterId)));
    const block=(items,title)=>items.length?`<h4>${title}</h4><div class="card-grid compact-grid">${items.map(a=>`<article class="item-card"><div class="card-header"><h3>${escapeHTML(characterName(a.characterId))}</h3>${characterArcTypeTag(a)}</div><div class="card-body">${seriesArcBookSelect(a)}${detail(a.isImpactArc?'Effect / Impact':'Arc',a.text)}<button class="ghost-btn" onclick="setView('characterDetail','${a.characterId}')">Edit on Character Page</button></div></article>`).join('')}</div>`:'';
    return `<section class="panel"><h3>${escapeHTML(g.label)}</h3>${block(own,'Character Arcs')}${block(impact,'Effect / Impact Arcs')}</section>`;
  }).join('');
  const manualHtml=manual.map(a=>`<article class="item-card"><div class="card-header"><h3>${escapeHTML(a.title||'Untitled Arc')}</h3><button class="delete-btn" onclick="deleteItem('seriesArcs','${a.id}')">Delete</button></div><div class="card-body"><span class="tag">${escapeHTML(a.characterId?characterName(a.characterId):'Series Arc')}</span>${detail('Book 1',a.book1)}${detail('Book 2',a.book2)}${detail('Book 3',a.book3)}${detail('Notes',a.notes)}</div></article>`).join('');
  el.innerHTML=(groupedHtml||manualHtml)?`${groupedHtml||'<div class="panel"><p class="muted">No character-page arcs yet.</p></div>'}<div class="panel"><h3>Manual Series Arcs</h3>${manualHtml||'<p class="muted">No manual series arcs yet.</p>'}</div>`:'<p class="muted">No series arcs yet.</p>';
}
function renderSeriesTools(){
  const warn=document.getElementById("seriesOnlyWarning"), content=document.getElementById("seriesToolsContent"); if(!warn||!content)return;
  warn.innerHTML=""; content.classList.remove("hidden");
  const books=seriesBooks(); const seriesWords=books.reduce((sum,b)=>sum+bookWordCount(b),0); const scenes=sceneRowsAcrossSeries(); const warnings=seriesContinuityWarnings(); const autoArcs=characterArcItemsFromCharacters();
  const unresolved=(data.mysteries||[]).filter(m=>seriesScope(m)&&(m.status||'Open')!=='Resolved').length;
  const openThreads=(data.threads||[]).filter(t=>seriesScope(t)&&(t.status||'Open')!=='Resolved').length;
  const worldCount=data.world.filter(seriesScope).length+data.locations.filter(seriesScope).length+data.organizations.filter(seriesScope).length+data.magicSystems.filter(seriesScope).length;
  setText("seriesBookCount",books.length); setText("seriesTotalWords",seriesWords); setText("seriesArcCount",autoArcs.length+(data.seriesArcs||[]).filter(seriesScope).length); setText("seriesWarningCount",warnings.length);
  setHTML("seriesDashboardBooks", books.map(b=>`<article class="item-card clickable-card" onclick="openBookFromDashboard('${b.id}')"><div class="card-header"><h3>${escapeHTML(b.title||'Untitled Book')}</h3><span class="tag">${escapeHTML(b.status||'Drafting')}</span></div><div class="card-body"><p><strong>Words:</strong> ${bookWordCount(b)}</p><p><strong>Chapters:</strong> ${(b.manuscript||[]).length}</p><p><strong>Scenes:</strong> ${(b.manuscript||[]).flatMap(c=>c.scenes||[]).length}</p></div></article>`).join('')||'<p>No books yet.</p>');
  setHTML("seriesBigPicture", `<p><strong>Characters:</strong> ${data.characters.filter(seriesScope).length}</p><p><strong>World Entries:</strong> ${worldCount}</p><p><strong>Unresolved Questions:</strong> ${unresolved}</p><p><strong>Open Threads:</strong> ${openThreads}</p><p><strong>Total Scenes:</strong> ${scenes.length}</p>`);
  setHTML("seriesArcPreview", autoArcs.slice(0,6).map(a=>`<div class="chapter-stat-row"><span>${escapeHTML(a.title)}</span>${characterArcTypeTag(a)}${isPlaceholderBookId(a.bookId)?'<span class="tag">Needs book link</span>':''}<button class="ghost-btn" onclick="setView('characterDetail','${a.characterId}')">Open</button></div>`).join('')||'<p class="muted">Add book-specific character arcs on character pages to populate this preview.</p>');
  setHTML("seriesNeedsAttention", warnings.slice(0,8).map(w=>`<p>⚠️ ${escapeHTML(w)}</p>`).join('')||'<p>No major issues found.</p>');
}

/* === Series automation, completed-book Story Bible, scene-level trackers, and handoff patch === */
function seriesTrackerCollectionsReady(){
  data.themeTracks=data.themeTracks||[];
  data.foreshadowing=data.foreshadowing||[];
  data.mysteries=data.mysteries||[];
  data.seriesMilestones=data.seriesMilestones||[];
  data.bookHandoffs=data.bookHandoffs||[];
  data.seriesArcs=data.seriesArcs||[];
}
function bookStatusLabel(b){return b?.status||'Drafting'}
function markBookStatus(bookId,status){
  const b=(data.books||[]).find(x=>x.id===bookId); if(!b)return;
  const old=b.status||''; b.status=status;
  if(status==='Finished' && old!=='Finished') autoGenerateBookHandoff(bookId);
  saveData(true);
}
function nextBookAfter(bookId){const books=seriesBooks(); const i=books.findIndex(b=>b.id===bookId); return i>=0?books[i+1]:null;}
function lastSceneOfBook(book){
  const chapters=book?.manuscript||[];
  for(let i=chapters.length-1;i>=0;i--){const scenes=chapters[i].scenes||[]; if(scenes.length)return {chapter:chapters[i],scene:scenes[scenes.length-1],chapterIndex:i,sceneIndex:scenes.length-1};}
  return null;
}
function autoGenerateBookHandoff(bookId){
  seriesTrackerCollectionsReady();
  const from=(data.books||[]).find(b=>b.id===bookId); if(!from)return;
  const to=nextBookAfter(bookId);
  const last=lastSceneOfBook(from);
  const existing=(data.bookHandoffs||[]).find(h=>h.autoGenerated&&h.fromBook===bookId);
  const chars=itemNamesFromIds(data.characters,last?.scene?.characterIds||[]);
  if(last?.scene?.pov){const pov=characterName(last.scene.pov); if(pov&&pov!=='Unknown'&&!chars.includes(pov))chars.unshift(`${pov} (POV)`);}
  const unresolved=(data.mysteries||[]).filter(m=>seriesScope(m)&&(m.status||'Open')!=='Resolved');
  const openForeshadow=(data.foreshadowing||[]).filter(f=>seriesScope(f)&&(f.status||'Planted')!=='Paid Off'&&(f.status||'')!=='Resolved');
  const openThreads=(data.threads||[]).filter(t=>seriesScope(t)&&(t.status||'Open')!=='Resolved');
  const status=[
    `Finished book: ${from.title||'Untitled Book'}`,
    last?`Final scene: ${(last.chapter.title||'Chapter')} → ${(last.scene.title||'Scene')}`:'No final scene found.',
    chars.length?`Characters present in final scene: ${chars.join(', ')}`:'No characters marked in final scene.',
    last?.scene?.locationId?`Final location: ${locationName(last.scene.locationId)}`:'',
    last?.scene?.plotCardId?`Final plot point: ${plotCardName(last.scene.plotCardId)}`:'',
    unresolved.length?`Open questions carrying forward: ${unresolved.map(q=>q.question||'Untitled Question').join('; ')}`:'No open questions marked.',
    openThreads.length?`Open plot threads: ${openThreads.map(t=>t.title||'Untitled Thread').join('; ')}`:'',
    openForeshadow.length?`Foreshadowing not paid off: ${openForeshadow.map(f=>f.hint||'Untitled Hint').join('; ')}`:''
  ].filter(Boolean).join('\n');
  const payload={id:existing?.id||uid(),...scopedItem('series'),fromBook:bookId,toBook:to?.id||'',status,notes:'Auto-generated when book was marked Finished. Edit this handoff as needed.',autoGenerated:true,updated:new Date().toISOString(),created:existing?.created||new Date().toISOString()};
  if(existing) Object.assign(existing,payload); else data.bookHandoffs.unshift(payload);
}
function trackerRowTitle(row){return `${row.book?.title?row.book.title+' → ':''}${row.chapter?.title||'Chapter'} → ${row.scene?.title||'Scene'}`;}
function sceneRowsWithTracker(key,id){return sceneRowsAcrossSeries().filter(r=>Array.isArray(r.scene?.[key])&&r.scene[key].includes(id));}
function renderSceneSeriesTrackerCard(title,emptyText,key,items,extra=''){
  const scene=activeScene(); const selected=sceneTrackedIds(scene,key);
  return `<div class="tracker-card series-scene-tracker"><div class="tracker-heading"><strong>${escapeHTML(title)}</strong><span>Series-level tracker. These feed the Series tools automatically.</span></div>${extra}${items.length?`<div class="character-checkbox-grid">${items.map(item=>`<label class="character-check"><input type="checkbox" ${selected.includes(item.id)?'checked':''} onchange="toggleSceneTrackedItem('${key}','${item.id}',this.checked)"> <span>${escapeHTML(item.name||item.theme||item.hint||item.question||item.title||'Untitled')}</span></label>`).join('')}</div>`:`<p class="muted">${escapeHTML(emptyText)}</p>`}</div>`;
}
function renderSceneTracking(){
  seriesTrackerCollectionsReady();
  const chars=(data.characters||[]).filter(seriesScope);
  const orgs=(data.organizations||[]).filter(seriesScope);
  const magic=(data.magicSystems||[]).filter(seriesScope);
  const artifacts=(data.world||[]).filter(w=>seriesScope(w)&&worldTrackingKeyForCategory(w.category)==='itemArtifactIds');
  const floraFauna=(data.world||[]).filter(w=>seriesScope(w)&&worldTrackingKeyForCategory(w.category)==='floraFaunaIds');
  const themes=(data.themeTracks||[]).filter(seriesScope).map(t=>({...t,name:t.theme||'Untitled Theme'}));
  const foreshadows=(data.foreshadowing||[]).filter(seriesScope).map(f=>({...f,name:f.hint||'Untitled Foreshadowing'}));
  const questions=(data.mysteries||[]).filter(seriesScope).map(q=>({...q,name:q.question||'Untitled Question'}));
  const arcs=characterArcItemsFromCharacters().map(a=>({...a,id:a.id,name:a.title||'Untitled Arc'}));
  const quickAdd=`<div class="tracker-quick-add"><button type="button" class="ghost-btn" onclick="quickAddThemeFromScene()">+ Theme</button><button type="button" class="ghost-btn" onclick="quickAddForeshadowFromScene()">+ Foreshadowing</button><button type="button" class="ghost-btn" onclick="quickAddQuestionFromScene()">+ Question</button></div>`;
  const html=`
    <div class="scene-tracker-group-title"><h3>Scene Appearance Tracking</h3><p class="muted">Mark what appears or matters after writing the scene.</p></div>
    ${sceneTrackingCard('Characters in this scene','Create characters first, then they will appear here.','characterIds',chars)}
    ${sceneTrackingCard('Organizations in this scene','Create organizations first, then they will appear here.','organizationIds',orgs)}
    ${sceneTrackingCard('Magic / Systems in this scene','Create magic systems first, then they will appear here.','magicSystemIds',magic)}
    ${sceneTrackingCard('Items / Artifacts in this scene','Create Items / Artifacts in World Building first, then they will appear here.','itemArtifactIds',artifacts)}
    ${sceneTrackingCard('Flora & Fauna in this scene','Create Flora & Fauna entries in World Building first, then they will appear here.','floraFaunaIds',floraFauna)}
    <div class="scene-tracker-group-title"><h3>Series-Level Scene Tracking</h3><p class="muted">These selections populate Series Dashboard, Story Bible, Theme Tracker, Foreshadowing, Questions, and Series Arc Tracker.</p></div>
    ${quickAdd}
    ${renderSceneSeriesTrackerCard('Themes in this scene','Create themes in Series → Theme Tracker, then they will appear here.','themeIds',themes)}
    ${renderSceneSeriesTrackerCard('Foreshadowing in this scene','Create foreshadowing in Plot → Foreshadowing, then it will appear here.','foreshadowingIds',foreshadows)}
    ${renderSceneSeriesTrackerCard('Questions in this scene','Create questions in Plot → Unresolved Questions, then they will appear here.','questionIds',questions)}
    ${renderSceneSeriesTrackerCard('Series Arcs affected in this scene','Add book-specific character arcs on Character pages first.','seriesArcIds',arcs)}
  `;
  setHTML('sceneTrackingTop','');
  setHTML('sceneTrackingBottom',html);
}
function quickAddThemeFromScene(){const name=prompt('Theme name:'); if(!name)return; data.themeTracks.push({id:uid(),...scopedItem('series'),theme:name,bookUse:'',scenes:'',notes:'Created from manuscript scene tracker.',created:new Date().toISOString()}); saveData(true);}
function quickAddForeshadowFromScene(){const hint=prompt('Foreshadowing hint/name:'); if(!hint)return; data.foreshadowing.push({id:uid(),...scopedItem('series'),hint,appears:'',payoff:'',status:'Planted',notes:'Created from manuscript scene tracker.',created:new Date().toISOString()}); saveData(true);}
function quickAddQuestionFromScene(){const question=prompt('Unresolved question:'); if(!question)return; data.mysteries.push({id:uid(),...scopedItem('series'),question,introduced:'',payoff:'',status:'Open',hints:'',answer:'',created:new Date().toISOString()}); saveData(true);}
function sceneSeriesAppearancesHTML(scene){
  const pairs=[
    ['Themes',itemNamesFromIds((data.themeTracks||[]).map(t=>({...t,name:t.theme||'Untitled Theme'})),scene.themeIds)],
    ['Foreshadowing',itemNamesFromIds((data.foreshadowing||[]).map(f=>({...f,name:f.hint||'Untitled Foreshadowing'})),scene.foreshadowingIds)],
    ['Questions',itemNamesFromIds((data.mysteries||[]).map(q=>({...q,name:q.question||'Untitled Question'})),scene.questionIds)],
    ['Series Arcs',itemNamesFromIds(characterArcItemsFromCharacters().map(a=>({...a,name:a.title})),scene.seriesArcIds)]
  ].filter(([,vals])=>Array.isArray(vals)&&vals.length);
  return pairs.length?`<section class="character-section"><h3>Series Trackers</h3>${pairs.map(([label,vals])=>`<p><strong>${escapeHTML(label)}:</strong> ${vals.map(escapeHTML).join(', ')}</p>`).join('')}</section>`:'';
}
const _oldSceneAppearancesHTML=sceneAppearancesHTML;
sceneAppearancesHTML=function(scene){return _oldSceneAppearancesHTML(scene)+sceneSeriesAppearancesHTML(scene)};

function compactSceneDatabaseCard(row){
  const sc=row.scene, words=countWords(stripHTML(sc.content||''));
  const meta=[sc.pov?`POV: ${characterName(sc.pov)}`:'',sc.locationId?`Location: ${locationName(sc.locationId)}`:'',sc.plotCardId?`Plot: ${plotCardName(sc.plotCardId)}`:'',sc.mood?`Mood: ${sc.mood}`:'',`${words} words`].filter(Boolean);
  return `<article class="item-card scene-database-card"><div class="card-header"><h3>${escapeHTML(sc.title||`Scene ${row.sceneIndex+1}`)}</h3><button class="ghost-btn" onclick="setView('write','${row.chapter.id}','${sc.id}')">Open Scene</button></div><div class="card-body"><p class="muted">${escapeHTML(row.book.title||'Book')} → ${escapeHTML(row.chapter.title||`Chapter ${row.chapterIndex+1}`)}</p><div class="tag-row">${meta.map(m=>`<span class="tag">${escapeHTML(m)}</span>`).join('')}</div>${sc.purpose?detail('Purpose',sc.purpose):''}<details class="appearance-log-toggle"><summary><span class="appearance-log-title">Appearances</span></summary>${sceneAppearancesHTML(sc)}</details></div></article>`;
}
function renderSceneDatabase(){
  const el=document.getElementById('sceneList'); if(!el)return;
  const book=activeBook(); if(!book){el.innerHTML='<p class="muted">Open a book to view its Scene Database.</p>';return;}
  const rows=allScenesForBook(book);
  el.classList.add('scene-database-clean');
  el.innerHTML=rows.length?`<div class="category-page-header panel"><div><h2>🎬 Scene Database</h2><p class="muted">A clean reference list for this book. Click Open Scene to edit in Manuscript.</p></div><div class="category-tools"><span class="tag">${rows.length} scenes</span></div></div>`+rows.map(compactSceneDatabaseCard).join(''):'<p class="muted">No scenes yet.</p>';
}

function trackerSceneLinks(key,id){
  const rows=sceneRowsWithTracker(key,id);
  return renderAppearanceLogToggle('Scene Tracker Log',rows.map(r=>({...r,reasons:['selected in scene tracker']})),'Not selected in any scene yet.');
}
function renderThemeTracker(){
  const el=document.getElementById('themeTrackList'); if(!el)return; seriesTrackerCollectionsReady();
  const items=(data.themeTracks||[]).filter(seriesScope);
  el.innerHTML=items.length?items.map(t=>{const rows=sceneRowsWithTracker('themeIds',t.id); return `<article class="item-card"><div class="card-header"><h3>${escapeHTML(t.theme||'Untitled Theme')}</h3><button class="delete-btn" onclick="deleteItem('themeTracks','${t.id}')">Delete</button></div><div class="card-body"><span class="tag">${rows.length} scene${rows.length===1?'':'s'}</span>${detail('Book Usage',t.bookUse)}${detail('Notes',t.notes)}${trackerSceneLinks('themeIds',t.id)}</div></article>`}).join(''):'<p class="muted">No themes tracked yet. Add one here or from the scene tracker.</p>';
}
function renderForeshadowingTracker(){
  const el=document.getElementById('foreshadowingList'); if(!el)return;
  const items=(data.foreshadowing||[]).filter(seriesScope);
  el.innerHTML=items.length?items.map(f=>{const rows=sceneRowsWithTracker('foreshadowingIds',f.id); return `<article class="item-card"><div class="card-header"><h3>${escapeHTML(f.hint||'Untitled Foreshadowing')}</h3><button class="delete-btn" onclick="deleteItem('foreshadowing','${f.id}')">Delete</button></div><div class="card-body"><span class="tag">${escapeHTML(f.status||'Planted')}</span><span class="tag">${rows.length} scene${rows.length===1?'':'s'}</span>${detail('Appears',f.appears)}${detail('Payoff',f.payoff)}${detail('Notes',f.notes)}${trackerSceneLinks('foreshadowingIds',f.id)}</div></article>`}).join(''):'<p class="muted">No foreshadowing tracked yet.</p>';
}
function renderQuestionTracker(){
  const el=document.getElementById('mysteryList'); if(!el)return;
  const items=(data.mysteries||[]).filter(seriesScope);
  el.innerHTML=items.length?items.map(q=>{const rows=sceneRowsWithTracker('questionIds',q.id); return `<article class="item-card"><div class="card-header"><h3>${escapeHTML(q.question||'Untitled Question')}</h3><button class="delete-btn" onclick="deleteItem('mysteries','${q.id}')">Delete</button></div><div class="card-body"><span class="tag">${escapeHTML(q.status||'Open')}</span><span class="tag">${rows.length} scene${rows.length===1?'':'s'}</span>${detail('Introduced',q.introduced)}${detail('Hints / False Leads',q.hints)}${detail('Answer',q.answer)}${detail('Payoff',q.payoff)}${trackerSceneLinks('questionIds',q.id)}</div></article>`}).join(''):'<p class="muted">No unresolved questions yet.</p>';
}
const _oldRenderAllListsSeries=renderAllLists;
renderAllLists=function(){
  _oldRenderAllListsSeries();
  renderThemeTracker(); renderForeshadowingTracker(); renderQuestionTracker(); renderSeriesArcs(); renderStoryBible(); renderSeriesTools(); renderBookHandoffs(); renderSeriesMilestones(); renderSceneDatabase();
};

function completedBooks(){return seriesBooks().filter(b=>(b.status||'Drafting')==='Finished');}
function storyBibleSection(title,html){return `<section class="panel story-bible-section"><h3>${escapeHTML(title)}</h3>${html||'<p class="muted">Nothing here yet.</p>'}</section>`;}
function renderStoryBible(){
  const el=document.getElementById('storyBibleContent'); if(!el)return; seriesTrackerCollectionsReady();
  const srs=activeSeries()||{}; const books=seriesBooks(); const done=completedBooks(); const scenes=sceneRowsAcrossSeries();
  const chars=data.characters.filter(seriesScope);
  const characterHtml=chars.map(c=>{const rows=appearanceLogEntries('character',c.id); const arcs=normalizeCharacterBookArcs(c).filter(a=>a.text); return `<article class="item-card"><h4>${escapeHTML(c.name||'Unnamed Character')}</h4>${detail('Basic Information',c.basicInfo||c.bio)}${arcs.length?`<p><strong>Book Arcs:</strong></p>${arcs.map(a=>`<p><span class="tag">${escapeHTML(characterArcBookLabel(a))}</span> ${characterArcTypeTag(a)} ${escapeHTML(a.text||'')}</p>`).join('')}`:''}<p class="muted">Appears in ${rows.length} scene${rows.length===1?'':'s'}.</p></article>`}).join('');
  const completedHtml=done.map(b=>{const rows=allScenesForBook(b); const last=lastSceneOfBook(b); return `<article class="item-card"><h4>${escapeHTML(b.title||'Untitled Book')}</h4><span class="tag">Finished</span><p><strong>Words:</strong> ${bookWordCount(b)} · <strong>Scenes:</strong> ${rows.length}</p>${last?`<p><strong>Final Scene:</strong> ${escapeHTML(last.chapter.title||'Chapter')} → ${escapeHTML(last.scene.title||'Scene')}</p>${sceneAppearancesHTML(last.scene)}`:''}</article>`}).join('');
  const themeHtml=(data.themeTracks||[]).filter(seriesScope).map(t=>`<p><strong>${escapeHTML(t.theme||'Theme')}:</strong> ${sceneRowsWithTracker('themeIds',t.id).length} tracked scenes</p>`).join('');
  const foreshadowHtml=(data.foreshadowing||[]).filter(seriesScope).map(f=>`<p><strong>${escapeHTML(f.hint||'Foreshadowing')}:</strong> ${escapeHTML(f.status||'Planted')} · ${sceneRowsWithTracker('foreshadowingIds',f.id).length} scenes</p>`).join('');
  const questionHtml=(data.mysteries||[]).filter(seriesScope).map(q=>`<p><strong>${escapeHTML(q.question||'Question')}:</strong> ${escapeHTML(q.status||'Open')} · ${sceneRowsWithTracker('questionIds',q.id).length} scenes</p>`).join('');
  el.innerHTML=`<div class="panel"><h2>${escapeHTML(srs.title||'Project')} Story Bible</h2><p class="muted">Living reference plus completed-book history. Mark books as Finished to lock them into the historical view.</p><div class="grid stats-grid"><div class="stat-card"><span>${books.length}</span><p>Books</p></div><div class="stat-card"><span>${done.length}</span><p>Finished</p></div><div class="stat-card"><span>${chars.length}</span><p>Characters</p></div><div class="stat-card"><span>${scenes.length}</span><p>Scenes</p></div></div></div>`+
  storyBibleSection('Completed Book History',completedHtml)+storyBibleSection('Character Bible',characterHtml)+storyBibleSection('Themes',themeHtml)+storyBibleSection('Foreshadowing',foreshadowHtml)+storyBibleSection('Unresolved Questions',questionHtml);
}

function renderSeriesTools(){
  const warn=document.getElementById('seriesOnlyWarning'), content=document.getElementById('seriesToolsContent'); if(!warn||!content)return;
  seriesTrackerCollectionsReady(); warn.innerHTML=''; content.classList.remove('hidden');
  const books=seriesBooks(), done=completedBooks(), scenes=sceneRowsAcrossSeries(), warnings=seriesContinuityWarnings();
  const themeHits=(data.themeTracks||[]).filter(seriesScope).reduce((n,t)=>n+sceneRowsWithTracker('themeIds',t.id).length,0);
  const foreshadowOpen=(data.foreshadowing||[]).filter(f=>seriesScope(f)&&(f.status||'Planted')!=='Paid Off'&&(f.status||'')!=='Resolved').length;
  const unresolved=(data.mysteries||[]).filter(m=>seriesScope(m)&&(m.status||'Open')!=='Resolved').length;
  const autoArcs=characterArcItemsFromCharacters();
  setText('seriesBookCount',books.length); setText('seriesTotalWords',books.reduce((sum,b)=>sum+bookWordCount(b),0)); setText('seriesArcCount',autoArcs.length+(data.seriesArcs||[]).filter(seriesScope).length); setText('seriesWarningCount',warnings.length);
  setHTML('seriesDashboardBooks',books.map(b=>`<article class="item-card clickable-card"><div class="card-header"><h3>${escapeHTML(b.title||'Untitled Book')}</h3><span class="tag">${escapeHTML(bookStatusLabel(b))}</span></div><div class="card-body"><p><strong>Words:</strong> ${bookWordCount(b)}</p><p><strong>Chapters:</strong> ${(b.manuscript||[]).length}</p><p><strong>Scenes:</strong> ${(b.manuscript||[]).flatMap(c=>c.scenes||[]).length}</p><div class="button-row"><button class="ghost-btn" onclick="openBookFromDashboard('${b.id}')">Open</button><button class="ghost-btn" onclick="markBookStatus('${b.id}','Planning')">Planning</button><button class="ghost-btn" onclick="markBookStatus('${b.id}','Drafting')">Drafting</button><button onclick="markBookStatus('${b.id}','Finished')">Mark Finished</button></div></div></article>`).join('')||'<p>No books yet.</p>');
  setHTML('seriesBigPicture',`<p><strong>Finished Books:</strong> ${done.length} / ${books.length}</p><p><strong>Total Scenes:</strong> ${scenes.length}</p><p><strong>Theme Scene Hits:</strong> ${themeHits}</p><p><strong>Open Foreshadowing:</strong> ${foreshadowOpen}</p><p><strong>Unresolved Questions:</strong> ${unresolved}</p><p><strong>Auto Handoffs:</strong> ${(data.bookHandoffs||[]).filter(h=>seriesScope(h)&&h.autoGenerated).length}</p>`);
  setHTML('seriesArcPreview',autoArcs.slice(0,8).map(a=>`<div class="chapter-stat-row"><span>${escapeHTML(a.title)}</span>${characterArcTypeTag(a)}${isPlaceholderBookId(a.bookId)?'<span class="tag">Needs book link</span>':''}<button class="ghost-btn" onclick="setView('characterDetail','${a.characterId}')">Open</button></div>`).join('')||'<p class="muted">Add book-specific character arcs on character pages to populate this preview.</p>');
  setHTML('seriesNeedsAttention',warnings.slice(0,8).map(w=>`<p>⚠️ ${escapeHTML(w)}</p>`).join('')||'<p>No major issues found.</p>');
}
function renderBookHandoffs(){
  const el=document.getElementById('bookHandoffList'); if(!el)return; const opts=seriesBooks().map(b=>`<option value="${b.id}">${escapeHTML(b.title||'Untitled Book')}</option>`).join(''); setHTML('handoffFromBook',opts); setHTML('handoffToBook',opts);
  const items=(data.bookHandoffs||[]).filter(seriesScope);
  const helper=`<div class="panel"><h3>Auto-generate Handoffs</h3><p class="muted">Mark a book as Finished on the Series Dashboard. PlotPals will create a handoff from that book’s final scene, open questions, open threads, and unpaid foreshadowing.</p></div>`;
  el.innerHTML=helper+(items.length?items.map(h=>`<article class="item-card"><div class="card-header"><h3>${escapeHTML((seriesBooks().find(b=>b.id===h.fromBook)?.title||'Book')+' → '+(seriesBooks().find(b=>b.id===h.toBook)?.title||'Next Book'))}</h3><button class="delete-btn" onclick="deleteItem('bookHandoffs','${h.id}')">Delete</button></div><div class="card-body">${h.autoGenerated?'<span class="tag">Auto-generated</span>':''}${detail('Ending / Starting Status',h.status)}${detail('Notes',h.notes)}</div></article>`).join(''):'<p class="muted">No book handoffs yet.</p>');
}
function renderSeriesMilestones(){
  const el=document.getElementById('seriesMilestoneList'); if(!el)return; const items=(data.seriesMilestones||[]).filter(seriesScope);
  const bookStatusMilestones=seriesBooks().map(b=>({title:`${b.title||'Untitled Book'} status`,status:b.status||'Drafting',date:'',notes:'Generated from Book Status.'}));
  const all=[...bookStatusMilestones,...items];
  el.innerHTML=all.length?all.map(m=>`<article class="item-card"><div class="card-header"><h3>${escapeHTML(m.title||'Untitled Milestone')}</h3>${m.id?`<button class="delete-btn" onclick="deleteItem('seriesMilestones','${m.id}')">Delete</button>`:''}</div><div class="card-body"><span class="tag">${escapeHTML(m.status||'Not Started')}</span>${detail('Target / Date',m.date)}${detail('Notes',m.notes)}</div></article>`).join(''):'<p class="muted">No milestones yet.</p>';
}

/* End series automation patch */
