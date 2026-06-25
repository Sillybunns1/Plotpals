(function(g){
  'use strict';
  const arr=v=>Array.isArray(v)?v:[];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const attr=esc;
  const uid=()=> (typeof g.uid==='function'?g.uid():('id_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)));
  const scope=()=>({seriesId:g.data?.activeSeriesId||g.data?.currentSeriesId||'', bookId:g.data?.activeBookId||''});
  const titleOf=o=>o?.name||o?.title||o?.term||o?.event||'Untitled';
  const textOfScene=sc=>String(sc?.content||sc?.text||sc?.body||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const allScenes=()=>arr(g.data?.books).flatMap(book=>arr(book.manuscript).flatMap((ch,ci)=>arr(ch.scenes).map((sc,si)=>({book,ch,sc,ci,si,text:textOfScene(sc)}))));
  const entries=()=> g.PlotPalsEncyclopediaEngine?.buildEntries ? g.PlotPalsEncyclopediaEngine.buildEntries(g.data||{}) : [];
  function ensureUiRoot(){
    let root=document.getElementById('plotpalsUxLayer');
    if(!root){ root=document.createElement('div'); root.id='plotpalsUxLayer'; document.body.appendChild(root); }
    return root;
  }
  function injectStyles(){
    if(document.getElementById('plotpalsUxRefinementStyles')) return;
    const css=`
      .ux-workspace-map{display:grid;grid-template-columns:repeat(3,1fr);gap:.35rem;margin:.5rem 0 1rem;padding:.5rem;border:1px solid var(--border,#2b2b35);border-radius:14px;background:rgba(255,255,255,.03)}
      .ux-workspace-map button{font-size:.78rem;padding:.5rem .35rem;border-radius:10px;white-space:normal}.ux-workspace-map small{display:block;opacity:.7;font-size:.68rem;margin-top:.15rem}
      .ux-section-subtitle{display:block;font-size:.8rem;color:var(--muted,#9ca3af);margin-top:.25rem}.ux-fab{position:fixed;right:22px;bottom:22px;z-index:9999;border-radius:999px;padding:.9rem 1.1rem;box-shadow:0 14px 34px rgba(0,0,0,.28);font-weight:800}.ux-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem}.ux-modal{max-width:720px;width:min(720px,100%);max-height:88vh;overflow:auto;background:var(--panel,#111827);border:1px solid var(--border,#374151);border-radius:18px;padding:1rem;box-shadow:0 22px 60px rgba(0,0,0,.45)}
      .ux-modal-head{display:flex;justify-content:space-between;gap:1rem;align-items:center;margin-bottom:1rem}.ux-create-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:.6rem}.ux-create-grid button{text-align:left;padding:.85rem;border-radius:14px}.ux-create-grid small{display:block;opacity:.7;margin-top:.2rem}.ux-hidden{display:none!important}
      .ux-universal-search{margin:.5rem 0 1rem;padding:.65rem;border:1px solid var(--border,#2b2b35);border-radius:14px;background:rgba(255,255,255,.035)}.ux-universal-search input{width:100%;margin-bottom:.5rem}.ux-search-results{display:grid;gap:.45rem}.ux-search-group{border-top:1px solid rgba(255,255,255,.08);padding-top:.45rem}.ux-search-group h4{margin:.2rem 0}.ux-search-hit{display:flex;justify-content:space-between;gap:.5rem;width:100%;text-align:left;padding:.5rem;border-radius:10px}.ux-score-details{opacity:.72;font-size:.75rem}
      .ux-quick-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.55rem;margin:.75rem 0 1rem}.ux-fact{padding:.7rem;border:1px solid var(--border,#374151);border-radius:12px;background:rgba(255,255,255,.035)}.ux-fact strong{display:block;font-size:.72rem;letter-spacing:.04em;text-transform:uppercase;color:var(--muted,#9ca3af)}.ux-wiki-collapse{border:1px solid var(--border,#374151);border-radius:14px;margin:.65rem 0;background:rgba(255,255,255,.025);overflow:hidden}.ux-wiki-collapse>summary{cursor:pointer;padding:.75rem .9rem;font-weight:800}.ux-wiki-collapse .ux-collapse-body{padding:0 .9rem .9rem}.ux-related-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.5rem}.ux-related-card-grid button,.ux-ref-card{padding:.7rem;border-radius:12px;text-align:left;background:rgba(255,255,255,.04);border:1px solid var(--border,#374151)}
      .ux-plot-toolbar{display:flex;flex-wrap:wrap;gap:.5rem;margin:.8rem 0}.ux-story-flow{display:grid;gap:.8rem}.ux-story-act{border:1px solid var(--border,#374151);border-radius:16px;padding:.8rem;background:rgba(255,255,255,.025)}.ux-story-card{border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:.7rem;margin:.5rem 0;background:rgba(255,255,255,.035)}.ux-scene-health{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.5rem}.ux-scene-health span{font-size:.73rem;padding:.2rem .45rem;border-radius:999px;background:rgba(255,255,255,.08)}.ux-unassigned-scenes{margin-top:1rem;border:1px dashed var(--border,#374151);border-radius:14px;padding:.8rem}.ux-thread-overview{margin:1rem 0;padding:1rem;border:1px solid var(--border,#374151);border-radius:16px;background:rgba(255,255,255,.025)}
      .ux-mobile-list{display:grid;gap:.55rem}.ux-mobile-rel-row{padding:.7rem;border:1px solid var(--border,#374151);border-radius:12px;background:rgba(255,255,255,.035)}
      @media(max-width:760px){.ux-fab{right:14px;bottom:14px;padding:.75rem .9rem}.ux-workspace-map{grid-template-columns:1fr}.encyclopedia-with-sidebar{display:block!important}.encyclopedia-sidebar{margin-bottom:1rem}.board-grid,.scene-board-grid{display:block!important}.board-column,.scene-board-column{margin-bottom:1rem}.ux-quick-facts{grid-template-columns:1fr}.ux-modal{max-height:92vh}}
    `;
    const st=document.createElement('style'); st.id='plotpalsUxRefinementStyles'; st.textContent=css; document.head.appendChild(st);
  }
  function openUxCreate(){
    ensureUiRoot().innerHTML=`<div class="ux-modal-backdrop" onclick="if(event.target===this)closeUxModal()"><div class="ux-modal"><div class="ux-modal-head"><div><h2>+ Create</h2><p class="muted">Create lore from one place. PlotPals files it into the right section automatically.</p></div><button type="button" class="ghost-btn" onclick="closeUxModal()">Close</button></div><div class="form-grid"><input id="uxCreateName" placeholder="Name / title"><textarea id="uxCreateNotes" placeholder="Quick notes"></textarea></div><div class="ux-create-grid">${[
      ['character','👤 Character','Person, cast member, POV, side character'],['location','🌍 Location','City, room, kingdom, landmark'],['organization','🏛 Organization','Guild, circus, court, group'],['event','📜 Event','Historical or story timeline event'],['item','🗡 Item / Artifact','Object, relic, weapon, token'],['species','🧬 Species / Race','Vampire, human, siren, fae'],['religion','🙏 Religion','Faith, church, cult, belief'],['culture','🎭 Culture','Traditions, society, customs'],['glossary','📚 Glossary Term','Term, phrase, definition'],['custom','📄 Custom Category','Anything else']
    ].map(([k,l,h])=>`<button type="button" onclick="createUxEntry('${k}')"><strong>${l}</strong><small>${h}</small></button>`).join('')}</div></div></div>`;
  }
  function closeUxModal(){ ensureUiRoot().innerHTML=''; }
  function createUxEntry(kind){
    const name=(document.getElementById('uxCreateName')?.value||'').trim();
    const notes=(document.getElementById('uxCreateNotes')?.value||'').trim();
    if(!name){ alert('Add a name first.'); return; }
    g.data=g.data||{}; const s=scope(); const now=new Date().toISOString();
    const base={id:uid(),...s,name,title:name,notes,created:now,canonStatus:'Canon',importance:'Major',loreImportance:'Important Lore',tags:[]};
    if(kind==='character'){ g.data.characters=arr(g.data.characters); g.data.characters.push({...base,role:'Supporting',basicInfo:notes}); }
    else if(kind==='location'){ g.data.locations=arr(g.data.locations); g.data.locations.push({...base,description:notes}); }
    else if(kind==='organization'){ g.data.organizations=arr(g.data.organizations); g.data.organizations.push({...base,description:notes}); }
    else if(kind==='event'){ g.data.timeline=arr(g.data.timeline); g.data.timeline.push({...base,event:name,summary:notes,when:''}); }
    else if(kind==='glossary'){ g.data.glossary=arr(g.data.glossary); g.data.glossary.push({...base,term:name,definition:notes,category:'General'}); }
    else if(kind==='custom'){ g.data.customEncyclopediaCategories=arr(g.data.customEncyclopediaCategories); g.data.customEncyclopediaCategories.push({...base,category:'Custom',description:notes}); }
    else { g.data.world=arr(g.data.world); const category=kind==='item'?'Items / Artifacts':kind==='species'?'Species & Races':kind==='religion'?'Religions':kind==='culture'?'Cultures':'Other'; g.data.world.push({...base,category,basicInfo:notes,description:notes}); }
    g.saveData?.(true,false); closeUxModal(); g.setView?.(kind==='character'?'characters':kind==='event'?'timeline':'encyclopedia');
  }
  function installFab(){
    if(document.getElementById('uxUniversalFab')) return;
    const btn=document.createElement('button'); btn.id='uxUniversalFab'; btn.className='ux-fab'; btn.type='button'; btn.textContent='+ Create'; btn.onclick=openUxCreate; document.body.appendChild(btn);
  }
  function addWorkspaceMap(){
    const nav=document.getElementById('nestedNav'); if(!nav||document.getElementById('uxWorkspaceMap')) return;
    const map=document.createElement('div'); map.id='uxWorkspaceMap'; map.className='ux-workspace-map';
    map.innerHTML=`<button type="button" onclick="setView('storyBible')">📚 Story Bible<small>Create lore</small></button><button type="button" onclick="setView('encyclopedia')">📖 Encyclopedia<small>Browse reference</small></button><button type="button" onclick="setView('write')">✍️ Manuscript<small>Use lore</small></button>`;
    nav.prepend(map);
  }
  function addUniversalSearch(){
    const nav=document.getElementById('nestedNav'); if(!nav||document.getElementById('uxUniversalSearch')) return;
    const panel=document.createElement('div'); panel.id='uxUniversalSearch'; panel.className='ux-universal-search';
    panel.innerHTML=`<input id="uxGlobalSearchInput" placeholder="Search everything: lore, scenes, timeline, relationships..." oninput="runUxUniversalSearch()"><div id="uxGlobalSearchResults" class="ux-search-results"></div>`;
    const anchor=document.getElementById('uxWorkspaceMap'); (anchor?anchor:nav).insertAdjacentElement(anchor?'afterend':'afterbegin',panel);
  }
  function runUxUniversalSearch(){
    const q=(document.getElementById('uxGlobalSearchInput')?.value||'').trim().toLowerCase();
    const box=document.getElementById('uxGlobalSearchResults'); if(!box) return;
    if(q.length<2){ box.innerHTML=''; return; }
    const groups={Lore:[],Scenes:[],Timeline:[],Relationships:[],Threads:[]};
    const lore=entries(); lore.forEach(e=>{ const hay=[titleOf(e),e.__type,e.category,arr(e.tags).join(' '),e.notes,e.description,e.basicInfo].join(' ').toLowerCase(); if(hay.includes(q)) groups.Lore.push({label:titleOf(e),sub:e.__type||e.type||'Entry',open:`openEncyclopediaEntry('${attr(e.id)}')`}); });
    allScenes().forEach(r=>{ if((r.text+' '+(r.sc.title||'')+' '+(r.ch.title||'')).toLowerCase().includes(q)) groups.Scenes.push({label:`${r.ch.title||'Chapter'} — ${r.sc.title||'Scene'}`,sub:r.book.title||'Book',open:`setView('write','${attr(r.ch.id)}','${attr(r.sc.id)}')`}); });
    arr(g.data?.timeline).forEach(t=>{ if([t.event,t.title,t.summary,t.impact,t.when].join(' ').toLowerCase().includes(q)) groups.Timeline.push({label:t.event||t.title||'Timeline Event',sub:t.when||'Unplaced',open:`setView('timeline')`}); });
    arr(g.data?.relationships).forEach(r=>{ const a=arr(g.data?.characters).find(c=>c.id===r.characterAId)?.name||''; const b=arr(g.data?.characters).find(c=>c.id===r.characterBId)?.name||''; if([a,b,r.type,r.notes].join(' ').toLowerCase().includes(q)) groups.Relationships.push({label:`${a||'Character'} ↔ ${b||'Character'}`,sub:r.type||'Relationship',open:`setView('relationships')`}); });
    arr(g.data?.threads).forEach(t=>{ if([t.title,t.setup,t.payoff,t.notes,t.status].join(' ').toLowerCase().includes(q)) groups.Threads.push({label:t.title||'Plot Thread',sub:t.status||'',open:`setView('threads')`}); });
    box.innerHTML=Object.entries(groups).filter(([,v])=>v.length).map(([k,v])=>`<div class="ux-search-group"><h4>${esc(k)}</h4>${v.slice(0,8).map(x=>`<button type="button" class="ux-search-hit" onclick="${x.open}"><span>${esc(x.label)}<small class="ux-section-subtitle">${esc(x.sub||'')}</small></span><span>Open</span></button>`).join('')}</div>`).join('')||'<p class="muted">No matches yet.</p>';
  }
  function quickFactsFor(e){
    if(!e) return '';
    const facts=[]; const src=e.source||e;
    [['Type',e.__type||e.type||src.category],['Role',src.role],['Status',src.status||src.canonStatus],['Importance',src.importance],['Lore',src.loreImportance],['Category',src.category],['When',src.when]].forEach(([k,v])=>{ if(v) facts.push([k,v]); });
    return facts.length?`<div class="ux-quick-facts">${facts.slice(0,8).map(([k,v])=>`<div class="ux-fact"><strong>${esc(k)}</strong>${esc(v)}</div>`).join('')}</div>`:'';
  }
  function enhanceWikiPage(){
    const box=document.getElementById('encyclopediaContent'); if(!box||!g.selectedEncyclopediaEntryId) return;
    const page=box.querySelector('.encyclopedia-page')||box;
    const e=entries().find(x=>x.id===g.selectedEncyclopediaEntryId);
    if(e && !page.querySelector('.ux-quick-facts')){
      const title=page.querySelector('h2,h1,.wiki-page-title,.ency-entry-title')||page.firstElementChild;
      if(title) title.insertAdjacentHTML('afterend',quickFactsFor(e));
    }
    // Move Referenced By near the top if present.
    const ref=[...page.querySelectorAll('section,.character-section,.encyclopedia-section')].find(s=>/Referenced By/i.test(s.textContent||'') && !s.classList.contains('ux-ref-moved'));
    const facts=page.querySelector('.ux-quick-facts');
    if(ref&&facts){ ref.classList.add('ux-ref-moved'); facts.insertAdjacentElement('afterend',ref); }
    // Collapse long wiki sections except high-priority sections.
    [...page.querySelectorAll('section.encyclopedia-section, section.character-section')].forEach((sec,i)=>{
      if(sec.closest('details')||sec.classList.contains('ux-ref-moved')||sec.classList.contains('source-refinement-final')||sec.classList.contains('source-refinement-v2')) return;
      const h=sec.querySelector('h3,h4'); if(!h) return;
      const label=h.textContent.trim(); if(/Overview|Referenced By|Quick Facts/i.test(label)) return;
      const det=document.createElement('details'); det.className='ux-wiki-collapse'; if(i<2) det.open=true;
      const sum=document.createElement('summary'); sum.textContent=label; det.appendChild(sum);
      const body=document.createElement('div'); body.className='ux-collapse-body';
      h.remove(); while(sec.firstChild) body.appendChild(sec.firstChild); det.appendChild(body); sec.replaceWith(det);
    });
    // Make related links look like cards.
    page.querySelectorAll('.search-result-btn').forEach(btn=>{ if(/openEncyclopediaEntry/.test(btn.getAttribute('onclick')||'')) btn.classList.add('ux-ref-card'); });
  }
  function addPageSubtitles(){
    const sb=document.querySelector('#storyBible .category-page-header p, #storyBible h2');
    const enc=document.querySelector('#encyclopedia .category-page-header p');
    if(enc&&!enc.dataset.ux){ enc.dataset.ux='1'; enc.textContent='Reference: browse, search, and connect the lore created in your Story Bible, manuscript, timeline, and worldbuilding.'; }
  }
  function installPlotBoardToolbar(){
    const form=document.querySelector('#plotBoard .form-panel'); if(!form||document.getElementById('uxPlotToolbar')) return;
    form.insertAdjacentHTML('afterend',`<div id="uxPlotToolbar" class="ux-plot-toolbar"><button type="button" onclick="setUxPlotMode('kanban')">Kanban View</button><button type="button" onclick="setUxPlotMode('story')">Story Flow</button><button type="button" onclick="setView('threads')">Plot Threads</button></div><div id="uxUnassignedScenes" class="ux-unassigned-scenes"></div>`);
  }
  function setUxPlotMode(mode){ g.data.uxPlotBoardMode=mode; g.saveData?.(true,false); g.renderPlotBoard?.(); }
  function sceneHealth(sc){
    const counts=[['Chars',arr(sc.characterIds||sc.characters).length],['Locs',arr(sc.locationIds||sc.locations).length],['Events',arr(sc.eventIds).length],['Words',String(textOfScene(sc)).split(/\s+/).filter(Boolean).length]];
    return `<div class="ux-scene-health">${counts.map(([k,v])=>`<span>${k}: ${v}</span>`).join('')}</div>`;
  }
  function renderUnassignedScenes(){
    const box=document.getElementById('uxUnassignedScenes'); if(!box) return;
    const un=allScenes().filter(r=>!r.sc.plotCardId&&!r.sc.plotPointId&&!arr(r.sc.plotCardIds).length);
    box.innerHTML=`<h3>Unassigned Scenes</h3><p class="muted">Scenes not attached to a plot point yet.</p>${un.length?un.slice(0,20).map(r=>`<button type="button" class="search-result-btn" onclick="setView('write','${attr(r.ch.id)}','${attr(r.sc.id)}')"><strong>${esc(r.ch.title||'Chapter')}</strong> — ${esc(r.sc.title||'Scene')}${sceneHealth(r.sc)}</button>`).join(''):'<p class="muted">All scenes are assigned or no scenes exist yet.</p>'}`;
  }
  function renderStoryFlow(){
    const el=document.getElementById('plotBoardList'); if(!el||g.data?.uxPlotBoardMode!=='story') return;
    const arcs=arr(g.data?.plotArcs); const cards=arr(g.data?.plotCards);
    el.classList.remove('board-grid'); el.classList.add('ux-story-flow');
    el.innerHTML=arcs.length?arcs.map(arc=>{ const cc=cards.filter(c=>c.arcId===arc.id); return `<section class="ux-story-act"><h3>${esc(arc.title||'Story Section')}</h3>${cc.length?cc.map(c=>`<article class="ux-story-card"><strong>${esc(c.title||'Plot Point')}</strong><p>${esc(c.notes||'')}</p><button type="button" class="ghost-btn" onclick="setUxPlotMode('kanban')">Move in Kanban</button></article>`).join(''):'<p class="muted">No plot points in this section.</p>'}</section>`; }).join(''):'<p class="muted">Create plot arcs to build your story flow.</p>';
  }
  function enhancePlotBoard(){ installPlotBoardToolbar(); renderStoryFlow(); renderUnassignedScenes(); }
  function enhanceThreads(){
    const view=document.getElementById('threads'); if(!view||document.getElementById('uxThreadOverview')) return;
    const threads=arr(g.data?.threads); const scenes=allScenes();
    const html=`<div id="uxThreadOverview" class="ux-thread-overview"><h3>Plot Thread Overview</h3><p class="muted">Track where each thread is introduced, mentioned, and resolved.</p>${threads.length?threads.map(t=>{ const q=String(t.title||'').toLowerCase(); const hits=q?scenes.filter(r=>r.text.toLowerCase().includes(q)).slice(0,5):[]; return `<article class="ux-story-card"><strong>${esc(t.title||'Untitled Thread')}</strong><div class="ux-scene-health"><span>Status: ${esc(t.status||'Open')}</span><span>Mentions: ${hits.length}</span><span>Payoff: ${esc(t.payoff||'Not set')}</span></div>${hits.map(r=>`<button type="button" class="search-result-btn" onclick="setView('write','${attr(r.ch.id)}','${attr(r.sc.id)}')">${esc(r.ch.title||'Chapter')} — ${esc(r.sc.title||'Scene')}</button>`).join('')}</article>`; }).join(''):'<p class="muted">No plot threads yet.</p>'}</div>`;
    const list=document.getElementById('threadList'); (list||view).insertAdjacentHTML(list?'beforebegin':'beforeend',html);
  }
  function mobileRelationshipFallback(){
    if(innerWidth>760) return;
    const view=document.getElementById('relationshipGraphView'); if(!view||document.getElementById('uxMobileRelationshipList')) return;
    const chars=arr(g.data?.characters); const name=id=>chars.find(c=>c.id===id)?.name||'Character';
    const html=`<div id="uxMobileRelationshipList" class="panel ux-mobile-list"><h3>Relationship List</h3><p class="muted">Mobile-friendly fallback for the graph.</p>${arr(g.data?.relationships).map(r=>`<button type="button" class="ux-mobile-rel-row" onclick="openEncyclopediaEntry('${attr(r.characterAId||r.characterBId||'')}')"><strong>${esc(name(r.characterAId))} ↔ ${esc(name(r.characterBId))}</strong><br><span class="muted">${esc(r.type||'Relationship')} · Strength ${esc(r.strength||'')}</span></button>`).join('')||'<p class="muted">No relationships yet.</p>'}</div>`;
    view.insertAdjacentHTML('afterbegin',html);
  }
  function applyUx(){
    injectStyles(); installFab(); addWorkspaceMap(); addUniversalSearch(); addPageSubtitles(); enhanceWikiPage(); enhancePlotBoard(); enhanceThreads(); mobileRelationshipFallback();
  }
  function install(){
    injectStyles(); installFab();
    const oldRenderAll=g.renderAll; if(typeof oldRenderAll==='function'&&!oldRenderAll.__uxWrapped){ const wrapped=function(){ const res=oldRenderAll.apply(this,arguments); setTimeout(applyUx,0); return res; }; wrapped.__uxWrapped=true; g.renderAll=wrapped; }
    const oldEncy=g.renderEncyclopedia; if(typeof oldEncy==='function'&&!oldEncy.__uxWrapped){ const wrapped=function(){ const res=oldEncy.apply(this,arguments); setTimeout(enhanceWikiPage,30); return res; }; wrapped.__uxWrapped=true; g.renderEncyclopedia=wrapped; }
    const oldPlot=g.renderPlotBoard; if(typeof oldPlot==='function'&&!oldPlot.__uxWrapped){ const wrapped=function(){ const res=oldPlot.apply(this,arguments); setTimeout(enhancePlotBoard,0); return res; }; wrapped.__uxWrapped=true; g.renderPlotBoard=wrapped; }
    applyUx();
  }
  g.openUxCreate=openUxCreate; g.closeUxModal=closeUxModal; g.createUxEntry=createUxEntry; g.runUxUniversalSearch=runUxUniversalSearch; g.setUxPlotMode=setUxPlotMode;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0)); else setTimeout(install,0);
})(window);
