
/* ===== dropdown-filter-patch.js ===== */
(function(){
  if(window.__plotpalsCreatorDropdownFilterPatchV2) return;
  window.__plotpalsCreatorDropdownFilterPatchV2 = true;

  const REL_TYPES = ['Family','Friendship','Romantic','Rivalry','Enemy','Mentor / Student','Allies','Coworkers','Past Relationship','Complicated','Other'];
  const REL_STATUS = ['Healthy','Strained','Broken','Secret','Developing','Ended','Unknown'];
  const SPEECH_STYLES = ['Formal','Casual','Cryptic','Sarcastic','Gentle','Blunt','Poetic','Old-Fashioned','Reserved','Playful','Other'];
  const VOCAB_LEVELS = ['Simple','Everyday','Educated','Academic','Archaic','Streetwise','Technical','Poetic','Other'];
  const SENTENCE_LENGTHS = ['Short','Medium','Long','Varied','Fragmented','Rambling','Other'];
  const FORMALITY = ['Very Formal','Formal','Neutral','Casual','Very Casual','Other'];
  const HUMOR = ['Dry','Sarcastic','Playful','Dark','Gentle','None','Awkward','Other'];
  const DIALECTS = ['None / Neutral','Regional','Old-Fashioned','Royal / Noble','Street / Slang','Foreign Accent','Fantasy Dialect','Other'];
  const CHAR_STATUS = ['Alive','Deceased','Immortal','Missing','Unknown','Draft','Removed','Possible Future'];
  const LOCATION_TYPES = ['City','Town','Village','Kingdom','Forest','Castle','Circus','School','Temple','Hidden Place','Camp','Ship','Road / Route','Other'];
  const POPULATION = ['Unknown','Uninhabited','Tiny','Small','Medium','Large','Massive','Hidden / Secret'];
  const CULTURES = ['Unknown','Human','Vampire','Siren','Fae','Royal','Religious','Nomadic','Circus / Troupe','Mixed','Other'];
  const ORG_TYPES = ['Government','Guild','Religion','Military','Cult','Circus / Troupe','Royal House','Criminal Group','School','Business','Rebellion','Other'];
  const MAGIC_SOURCES = ['Inherited','Learned','Divine','Blood-based','Artifact-based','Environmental','Emotional','Contract-based','Species-based','Unknown','Other'];
  const COST_TYPES = ['None','Physical','Emotional','Memory','Blood','Time','Energy / Fatigue','Sacrifice','Corruption','Unknown','Other'];
  const LIMIT_TYPES = ['Rule-based','Range','Time limit','Cost-based','Emotional control','Training required','Bloodline required','Artifact required','Environmental','Unknown','Other'];
  const PLOT_TYPES = ['Setup','Inciting Incident','Reveal','Conflict','Romance Beat','Death','Betrayal','Climax','Resolution','Transition','Other'];
  const PLOT_STATUS = ['Not Started','Planned','Drafting','Written','Needs Revision','Complete'];
  const IMPORTANCE = ['Major','Secondary','Minor Background'];
  const LORE = ['Critical Lore','Important Lore','Minor Lore','Flavor Lore'];
  const CANON = ['Canon','Draft','Removed','Possible Future'];
  const ENTRY_TYPES = ['Character','Location','Organization','Religion','Race / Species','Magic System','Government','Historical Event','Culture','Item / Artifact','Language','Flora & Fauna','Other'];
  const EVENT_TYPES = ['Birth','Death','War','Discovery','Betrayal','Marriage','Transformation','Disappearance','Reunion','Founding','Collapse','Travel','Other'];

  function esc(v){return String(v ?? '').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function attr(v){return esc(v).replace(/`/g,'&#96;');}
  function arr(v){return Array.isArray(v)?v:[];}
  function selected(value, option){return String(value||'')===String(option||'')?' selected':'';}
  function options(list, current='', placeholder='Choose...'){
    return `<option value="">${esc(placeholder)}</option>` + list.map(v=>`<option value="${attr(v)}"${selected(current,v)}>${esc(v)}</option>`).join('');
  }
  function replaceInputWithSelect(id, list, placeholder){
    const old = document.getElementById(id);
    if(!old || old.tagName === 'SELECT') return;
    const sel = document.createElement('select');
    sel.id = old.id;
    sel.className = old.className || '';
    sel.setAttribute('data-dropdown-field','true');
    sel.innerHTML = options(list, old.value, placeholder || old.placeholder || 'Choose...');
    old.replaceWith(sel);
  }
  function insertAfter(target, html){
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    const id = (html.match(/id="([^"]+)"/)||[])[1];
    if(el && id && !document.getElementById(id)) el.insertAdjacentHTML('afterend', html);
  }
  function selectHtml(id, placeholder, list){
    return `<select id="${attr(id)}"><option value="">${esc(placeholder)}</option>${list.map(v=>`<option value="${attr(v)}">${esc(v)}</option>`).join('')}</select>`;
  }
  function upgradeDropdownFields(){
    replaceInputWithSelect('relType', REL_TYPES, 'Relationship type');
    replaceInputWithSelect('relStatus', REL_STATUS, 'Relationship status');
    replaceInputWithSelect('charVoiceSpeechStyle', SPEECH_STYLES, 'Speech style');
    replaceInputWithSelect('charVoiceVocabulary', VOCAB_LEVELS, 'Vocabulary level');
    replaceInputWithSelect('charVoiceSentenceLength', SENTENCE_LENGTHS, 'Sentence length');
    replaceInputWithSelect('charVoiceFormality', FORMALITY, 'Formality');
    replaceInputWithSelect('charVoiceHumor', HUMOR, 'Humor');
    replaceInputWithSelect('charVoiceDialect', DIALECTS, 'Accent / dialect');
    insertAfter('charVoiceDialect', selectHtml('charCurrentStatus','Current status',CHAR_STATUS));

    replaceInputWithSelect('locationPopulation', POPULATION, 'Population size');
    insertAfter('locationScope', selectHtml('locationType','Location type',LOCATION_TYPES));

    replaceInputWithSelect('orgType', ORG_TYPES, 'Organization type');

    replaceInputWithSelect('magicSource', MAGIC_SOURCES, 'Magic source');
    insertAfter('magicSource', selectHtml('magicCostType','Cost type',COST_TYPES) + selectHtml('magicLimitationType','Limitation type',LIMIT_TYPES));

    insertAfter('worldCategory', selectHtml('worldLoreImportance','Lore importance',LORE) + selectHtml('worldCanonStatus','Canon status',CANON) + selectHtml('worldEntryType','Entry type',ENTRY_TYPES));

    insertAfter('plotCardArc', selectHtml('plotCardType','Plot point type',PLOT_TYPES) + selectHtml('plotCardStatus','Plot status',PLOT_STATUS) + selectHtml('plotCardImportance','Importance',IMPORTANCE));
    insertAfter('timeDateType', selectHtml('timeEventType','Event type',EVENT_TYPES) + selectHtml('timeImportance','Importance',IMPORTANCE));
  }
  const val = id => document.getElementById(id)?.value?.trim?.() || '';

  function patchAddFunction(name, collectionName, assigner){
    const original = window[name];
    if(typeof original !== 'function' || original.__creatorDropdownPatch) return;
    const wrapped = function(){
      const before = arr(window.data?.[collectionName]).length;
      const captured = assigner.capture ? assigner.capture() : {};
      const ret = original.apply(this, arguments);
      setTimeout(()=>{
        const list = arr(window.data?.[collectionName]);
        const added = list.slice(before)[0] || list[list.length-1];
        if(added && assigner.apply){
          assigner.apply(added, captured);
          window.saveData?.(true);
        }
      }, 100);
      return ret;
    };
    wrapped.__creatorDropdownPatch = true;
    window[name] = wrapped;
  }

  function patchCreatorSaves(){
    patchAddFunction('addCharacter','characters',{
      capture:()=>({
        currentStatus:val('charCurrentStatus'),
        speechStyle:val('charVoiceSpeechStyle'), vocabulary:val('charVoiceVocabulary'), sentenceLength:val('charVoiceSentenceLength'),
        formality:val('charVoiceFormality'), humor:val('charVoiceHumor'), dialect:val('charVoiceDialect')
      }),
      apply:(c,x)=>{
        c.currentStatus = x.currentStatus || c.currentStatus || '';
        c.voiceProfile = Object.assign({}, c.voiceProfile||{}, {
          speechStyle:x.speechStyle||c.voiceProfile?.speechStyle||'', vocabulary:x.vocabulary||c.voiceProfile?.vocabulary||'',
          sentenceLength:x.sentenceLength||c.voiceProfile?.sentenceLength||'', formality:x.formality||c.voiceProfile?.formality||'',
          humor:x.humor||c.voiceProfile?.humor||'', dialect:x.dialect||c.voiceProfile?.dialect||''
        });
      }
    });
    patchAddFunction('addLocation','locations',{
      capture:()=>({type:val('locationType')}),
      apply:(l,x)=>{ l.type = x.type || l.type || ''; }
    });
    patchAddFunction('addWorld','world',{
      capture:()=>({loreImportance:val('worldLoreImportance'), canonStatus:val('worldCanonStatus'), entryType:val('worldEntryType')}),
      apply:(w,x)=>{ w.loreImportance=x.loreImportance||w.loreImportance||''; w.canonStatus=x.canonStatus||w.canonStatus||''; w.entryType=x.entryType||w.entryType||''; w.importance=w.importance||x.loreImportance||''; }
    });
    patchAddFunction('addMagic','magicSystems',{
      capture:()=>({costType:val('magicCostType'), limitationType:val('magicLimitationType')}),
      apply:(m,x)=>{ m.costType=x.costType||m.costType||''; m.limitationType=x.limitationType||m.limitationType||''; }
    });
    patchAddFunction('addPlotCard','plotCards',{
      capture:()=>({type:val('plotCardType'), status:val('plotCardStatus'), importance:val('plotCardImportance')}),
      apply:(p,x)=>{ p.type=x.type||p.type||''; p.status=x.status||p.status||''; p.importance=x.importance||p.importance||''; }
    });
    patchAddFunction('addTimeline','timeline',{
      capture:()=>({type:val('timeEventType'), importance:val('timeImportance')}),
      apply:(t,x)=>{ t.type=x.type||t.type||''; t.importance=x.importance||t.importance||''; }
    });
  }

  function activeSeriesId(){return window.data?.activeSeriesId || null;}
  function inSeries(item){return !activeSeriesId() || !item.seriesId || item.seriesId===activeSeriesId() || item.scope==='series';}
  function stripHtml(v){return String(v||'').replace(/<[^>]+>/g,' ');}
  function charName(id){return arr(window.data?.characters).find(c=>c.id===id)?.name || 'Unknown Character';}
  function mentionsFor(title){
    const term = String(title||'').trim().toLowerCase();
    if(!term) return 0;
    let count = 0;
    arr(window.data?.books).forEach(b=>arr(b.manuscript).forEach(ch=>arr(ch.scenes).forEach(sc=>{ if(stripHtml(sc.content).toLowerCase().includes(term)) count++; })));
    return count;
  }
  function entryMeta(entry){
    const o = entry.source || {}, vp = o.voiceProfile || {};
    const text = `${entry.title||''} ${entry.subtitle||''} ${entry.type||''} ${entry.kind||''} ${entry.category||''} ${o.role||''} ${o.species||''} ${o.type||''} ${o.category||''} ${o.importance||''} ${o.loreImportance||''} ${o.lore||''} ${o.status||''} ${o.currentStatus||''} ${o.canonStatus||''} ${o.entryType||''} ${o.population||''} ${o.culture||''} ${o.source||''} ${o.costType||''} ${o.limitationType||''} ${vp.speechStyle||''} ${vp.vocabulary||''} ${vp.sentenceLength||''} ${vp.formality||''} ${vp.humor||''} ${vp.dialect||''}`.toLowerCase();
    return {
      text,
      importance:o.importance||o.majorMinor||'', lore:o.loreImportance||o.lore||'', canon:o.canonStatus||o.status||'', entryType:o.entryType||entry.type||'',
      relType:o.type||'', relStatus:o.status||'', locationType:o.type||'', population:o.population||'', culture:o.culture||'', orgType:o.type||'',
      magicSource:o.source||'', costType:o.costType||'', limitationType:o.limitationType||'', plotType:o.type||'', plotStatus:o.status||'',
      eventType:o.type||'', currentStatus:o.currentStatus||'', speechStyle:vp.speechStyle||'', vocabulary:vp.vocabulary||'', sentenceLength:vp.sentenceLength||'', formality:vp.formality||'', humor:vp.humor||'', dialect:vp.dialect||''
    };
  }
  function buildEncyclopediaEntries(){
    const entries = [];
    arr(window.data?.characters).filter(inSeries).forEach(c=>entries.push({kind:'characters', type:'Character', title:c.name||'Untitled Character', subtitle:[c.role,c.species,c.currentStatus].filter(Boolean).join(' • '), source:c, created:c.created, action:`setView('characterDetail','${attr(c.id)}')`, mentions:mentionsFor(c.name)}));
    arr(window.data?.world).filter(inSeries).forEach(w=>entries.push({kind:'world', type:w.entryType||w.category||'Worldbuilding', category:w.category||'Worldbuilding', title:w.name||'Untitled Entry', subtitle:[w.category,w.entryType,w.loreImportance,w.canonStatus].filter(Boolean).join(' • '), source:w, created:w.created, action:`setView('worldDetail','${attr(w.id)}')`, mentions:mentionsFor(w.name)}));
    arr(window.data?.locations).filter(inSeries).forEach(l=>entries.push({kind:'world', type:'Location', category:'Locations', title:l.name||'Untitled Location', subtitle:[l.type,l.population,l.culture].filter(Boolean).join(' • '), source:l, created:l.created, action:`setView('locationDetail','${attr(l.id)}')`, mentions:mentionsFor(l.name)}));
    arr(window.data?.organizations).filter(inSeries).forEach(o=>entries.push({kind:'world', type:'Organization', category:'Organizations', title:o.name||'Untitled Organization', subtitle:[o.type].filter(Boolean).join(' • '), source:o, created:o.created, action:`setView('organizationDetail','${attr(o.id)}')`, mentions:mentionsFor(o.name)}));
    arr(window.data?.magicSystems).filter(inSeries).forEach(m=>entries.push({kind:'world', type:'Magic System', category:'Magic Systems', title:m.name||'Untitled Magic System', subtitle:[m.source,m.costType,m.limitationType].filter(Boolean).join(' • '), source:m, created:m.created, action:`setView('magicDetail','${attr(m.id)}')`, mentions:mentionsFor(m.name)}));
    arr(window.data?.timeline).filter(inSeries).forEach(t=>entries.push({kind:'timeline', type:t.type||'Timeline Event', category:'Timeline Events', title:t.event||t.title||'Untitled Event', subtitle:[t.when,t.type,t.importance].filter(Boolean).join(' • '), source:t, created:t.created, action:`setView('timeline')`, mentions:0}));
    arr(window.data?.plotCards).filter(inSeries).forEach(p=>entries.push({kind:'plot', type:p.type||'Plot Point', category:'Plot Board', title:p.title||'Untitled Plot Point', subtitle:[p.type,p.status,p.importance].filter(Boolean).join(' • '), source:p, created:p.created, action:`setView('plotBoard')`, mentions:0}));
    arr(window.data?.relationships).filter(inSeries).forEach(r=>entries.push({kind:'relationships', type:r.type||'Relationship', category:'Relationships', title:`${charName(r.a||r.characterAId)} + ${charName(r.b||r.characterBId)}`, subtitle:[r.type,r.status].filter(Boolean).join(' • '), source:r, created:r.created, action:`setView('relationships')`, mentions:0}));
    return entries;
  }
  function control(id,label,list){return `<select id="${attr(id)}" onchange="renderEncyclopedia()"><option value="all">${esc(label)}</option>${list.map(v=>`<option value="${attr(v)}">${esc(v)}</option>`).join('')}</select>`;}
  function ensureEncyclopediaControls(){
    const tools = document.querySelector('#encyclopedia .category-tools');
    if(!tools || document.getElementById('encyclopediaSort')) return;
    tools.insertAdjacentHTML('beforeend', `<select id="encyclopediaSort" onchange="renderEncyclopedia()"><option value="az">Sort A-Z</option><option value="za">Sort Z-A</option><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="mentions">Most Mentioned</option><option value="importance">Importance</option></select>${control('encyclopediaImportance','All Importance',IMPORTANCE)}${control('encyclopediaLore','All Lore',LORE)}${control('encyclopediaCanon','All Status',CANON)}${control('encyclopediaEntryType','All Entry Types',ENTRY_TYPES)}${control('encyclopediaCharacterStatus','All Character Statuses',CHAR_STATUS)}${control('encyclopediaSpeechStyle','All Speech Styles',SPEECH_STYLES)}${control('encyclopediaVocabulary','All Vocabulary',VOCAB_LEVELS)}${control('encyclopediaFormality','All Formality',FORMALITY)}${control('encyclopediaRelType','All Relationship Types',REL_TYPES)}${control('encyclopediaRelStatus','All Relationship Statuses',REL_STATUS)}${control('encyclopediaLocationType','All Location Types',LOCATION_TYPES)}${control('encyclopediaPopulation','All Population Sizes',POPULATION)}${control('encyclopediaCulture','All Cultures',CULTURES)}${control('encyclopediaOrgType','All Organization Types',ORG_TYPES)}${control('encyclopediaMagicSource','All Magic Sources',MAGIC_SOURCES)}${control('encyclopediaCostType','All Cost Types',COST_TYPES)}${control('encyclopediaLimitationType','All Limitation Types',LIMIT_TYPES)}${control('encyclopediaPlotType','All Plot Types',PLOT_TYPES)}${control('encyclopediaPlotStatus','All Plot Statuses',PLOT_STATUS)}${control('encyclopediaEventType','All Event Types',EVENT_TYPES)}`);
  }
  const originalRenderEncyclopedia = window.renderEncyclopedia;
  window.renderEncyclopedia = function(){
    upgradeDropdownFields(); patchCreatorSaves(); ensureEncyclopediaControls();
    if(window.data?.selectedEncyclopediaEntryId || window.selectedEncyclopediaEntryId){
      const ret = originalRenderEncyclopedia ? originalRenderEncyclopedia.apply(this, arguments) : undefined;
      setTimeout(()=>{ upgradeDropdownFields(); patchCreatorSaves(); ensureEncyclopediaControls(); }, 40);
      return ret;
    }
    const content = document.getElementById('encyclopediaContent');
    if(!content) return originalRenderEncyclopedia?.apply(this, arguments);
    const search = (document.getElementById('encyclopediaSearch')?.value || '').toLowerCase().trim();
    const filter = document.getElementById('encyclopediaFilter')?.value || 'all';
    const get = id => document.getElementById(id)?.value || 'all';
    const sort = get('encyclopediaSort');
    let entries = buildEncyclopediaEntries();
    const countEl = id => document.getElementById(id);
    countEl('encyCharCount') && (countEl('encyCharCount').textContent = arr(window.data?.characters).filter(inSeries).length);
    countEl('encyWorldCount') && (countEl('encyWorldCount').textContent = entries.filter(e=>e.kind==='world').length);
    countEl('encyEventCount') && (countEl('encyEventCount').textContent = arr(window.data?.timeline).filter(inSeries).length);
    countEl('encyMentionCount') && (countEl('encyMentionCount').textContent = entries.reduce((a,e)=>a+(e.mentions||0),0));
    entries = entries.filter(e=>{
      const m = entryMeta(e);
      const eq = (id,value)=>get(id)==='all' || String(value||'')===get(id);
      if(filter !== 'all' && e.kind !== filter) return false;
      if(search && !`${e.title} ${e.subtitle} ${m.text}`.toLowerCase().includes(search)) return false;
      if(!eq('encyclopediaImportance',m.importance)) return false;
      if(!eq('encyclopediaLore',m.lore)) return false;
      if(!eq('encyclopediaCanon',m.canon)) return false;
      if(!eq('encyclopediaEntryType',m.entryType)) return false;
      if(!eq('encyclopediaCharacterStatus',m.currentStatus)) return false;
      if(!eq('encyclopediaSpeechStyle',m.speechStyle)) return false;
      if(!eq('encyclopediaVocabulary',m.vocabulary)) return false;
      if(!eq('encyclopediaFormality',m.formality)) return false;
      if(!eq('encyclopediaRelType',m.relType)) return false;
      if(!eq('encyclopediaRelStatus',m.relStatus)) return false;
      if(!eq('encyclopediaLocationType',m.locationType)) return false;
      if(!eq('encyclopediaPopulation',m.population)) return false;
      if(!eq('encyclopediaCulture',m.culture)) return false;
      if(!eq('encyclopediaOrgType',m.orgType)) return false;
      if(!eq('encyclopediaMagicSource',m.magicSource)) return false;
      if(!eq('encyclopediaCostType',m.costType)) return false;
      if(!eq('encyclopediaLimitationType',m.limitationType)) return false;
      if(!eq('encyclopediaPlotType',m.plotType)) return false;
      if(!eq('encyclopediaPlotStatus',m.plotStatus)) return false;
      if(!eq('encyclopediaEventType',m.eventType)) return false;
      return true;
    });
    const importanceRank = {'Major':0,'Secondary':1,'Minor Background':2};
    entries.sort((a,b)=>{
      if(sort==='za') return String(b.title).localeCompare(String(a.title));
      if(sort==='newest') return String(b.created||'').localeCompare(String(a.created||''));
      if(sort==='oldest') return String(a.created||'').localeCompare(String(b.created||''));
      if(sort==='mentions') return (b.mentions||0)-(a.mentions||0) || String(a.title).localeCompare(String(b.title));
      if(sort==='importance') return (importanceRank[entryMeta(a).importance]??9)-(importanceRank[entryMeta(b).importance]??9) || String(a.title).localeCompare(String(b.title));
      return String(a.title).localeCompare(String(b.title));
    });
    content.innerHTML = `<div class="role-group"><h3>Wiki Entries</h3><p class="muted small-text">${entries.length} result${entries.length===1?'':'s'} shown. Use the dropdown filters above to sort by character voice, relationship, location, organization, magic, plot, timeline, lore, or canon fields.</p><div class="card-grid compact-world-grid">${entries.length?entries.map(e=>{
      const m = entryMeta(e);
      const chips = [e.type, e.category, m.importance, m.lore, m.canon, m.currentStatus, m.locationType, m.orgType, m.magicSource, e.mentions?`${e.mentions} mention${e.mentions===1?'':'s'}`:''].filter(Boolean).slice(0,8).map(x=>`<span class="tag">${esc(x)}</span>`).join('');
      return `<article class="item-card compact-entry-card"><div class="card-header"><h3>${esc(e.title||'Untitled')}</h3><span class="tag">${esc(e.type||'Entry')}</span></div><div class="card-body">${e.subtitle?`<p class="muted">${esc(e.subtitle).slice(0,220)}</p>`:''}<div class="wiki-meta-chip-row">${chips}</div><button type="button" onclick="${e.action}">Open Source Entry</button></div></article>`;
    }).join(''):'<p class="muted">No encyclopedia entries match these filters.</p>'}</div></div>`;
    window.plotpalsRenderEncyclopediaFinalExtensions?.(document);
  };
  const originalRenderAll = window.renderAll;
  if(typeof originalRenderAll === 'function' && !originalRenderAll.__creatorDropdownFilterPatch){
    window.renderAll = function(){ const ret = originalRenderAll.apply(this, arguments); setTimeout(()=>{upgradeDropdownFields(); patchCreatorSaves(); ensureEncyclopediaControls();},60); return ret; };
    window.renderAll.__creatorDropdownFilterPatch = true;
  }
  document.addEventListener('DOMContentLoaded', ()=>setTimeout(()=>{upgradeDropdownFields(); patchCreatorSaves(); ensureEncyclopediaControls();},300));
  setTimeout(()=>{upgradeDropdownFields(); patchCreatorSaves(); ensureEncyclopediaControls();},800);
  const style = document.createElement('style');
  style.textContent = `.category-tools{align-items:center}.category-tools select{min-width:150px}.encyclopedia-filter-note{font-size:.85rem}.wiki-meta-chip-row{display:flex;flex-wrap:wrap;gap:.35rem}.form-grid select[data-dropdown-field], .form-grid #locationType, .form-grid #plotCardType, .form-grid #plotCardStatus, .form-grid #plotCardImportance, .form-grid #timeEventType, .form-grid #timeImportance, .form-grid #charCurrentStatus, .form-grid #worldLoreImportance, .form-grid #worldCanonStatus, .form-grid #worldEntryType, .form-grid #magicCostType, .form-grid #magicLimitationType{min-width:0}@media(max-width:1100px){#encyclopedia .category-tools{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}#encyclopedia .category-tools input,#encyclopedia .category-tools select,#encyclopedia .category-tools button{width:100%;min-width:0}}@media(max-width:620px){#encyclopedia .category-tools{grid-template-columns:1fr}.card-grid.compact-world-grid{grid-template-columns:1fr!important}}`;
  document.head.appendChild(style);
})();


/* ===== timeline-intelligence-update.js ===== */
(function(){
  'use strict';
  const g = window;
  const arr = v => Array.isArray(v) ? v : [];
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const id = () => (Date.now().toString(36) + Math.random().toString(36).slice(2));
  const val = name => document.getElementById(name)?.value?.trim() || '';
  const activeSeriesId = () => g.data?.activeSeriesId || g.activeSeries?.()?.id || '';
  const activeBookId = () => g.data?.activeBookId || g.activeBook?.()?.id || '';
  let participantImpactsDraft = {};
  let lastSelectedParticipants = new Set();

  function timelineScopeMatch(item){
    if(!item) return false;
    const series = activeSeriesId();
    const book = activeBookId();
    if(item.seriesId && series && item.seriesId !== series) return false;
    if(item.scope === 'book' && item.bookId && book && item.bookId !== book) return false;
    return true;
  }

  function calculateRelativeLabel(relativeTo, baseId, amount, unit, direction){
    const n = parseInt(amount || '0', 10) || 0;
    const dir = direction === 'after' ? 'after' : 'before';
    const calendarYear = parseInt(g.data?.projectTimeSettings?.storyYear || '', 10);
    let baseLabel = 'Story Start';
    let baseYear = Number.isFinite(calendarYear) ? calendarYear : null;

    if(relativeTo === 'chapter'){
      const chapters = arr(g.data?.chapters || []);
      const ch = chapters.find(x => x.id === baseId);
      baseLabel = ch?.title || 'Chapter';
    }
    if(relativeTo === 'scene'){
      const sc = arr(g.data?.scenes || []).find(x => x.id === baseId);
      baseLabel = sc?.title || 'Scene';
    }
    if(relativeTo === 'event'){
      const ev = arr(g.data?.timeline).find(x => x.id === baseId);
      baseLabel = ev?.event || ev?.title || ev?.when || 'Event';
      const yearMatch = String(ev?.computedDate || ev?.computedDateLabel || ev?.when || '').match(/-?\d{1,5}/);
      if(yearMatch) baseYear = parseInt(yearMatch[0], 10);
    }

    if(unit === 'years' && baseYear !== null){
      return String(baseYear + (dir === 'after' ? n : -n));
    }
    return `${n} ${unit || 'years'} ${dir} ${baseLabel}`;
  }

  function chapterOptions(){
    return arr(g.data?.chapters || [])
      .filter(ch => !activeBookId() || !ch.bookId || ch.bookId === activeBookId())
      .map((ch, idx) => `<option value="${esc(ch.id)}">Chapter ${idx + 1} — ${esc(ch.title || 'Untitled')}</option>`)
      .join('');
  }

  function sceneOptions(){
    return arr(g.data?.scenes || [])
      .filter(sc => !activeBookId() || !sc.bookId || sc.bookId === activeBookId())
      .map((sc, idx) => `<option value="${esc(sc.id)}">Scene ${idx + 1} — ${esc(sc.title || sc.name || 'Untitled')}</option>`)
      .join('');
  }

  function eventOptions(){
    return arr(g.data?.timeline || [])
      .filter(timelineScopeMatch)
      .map(ev => `<option value="${esc(ev.id)}">${esc(ev.when || 'Event')} — ${esc(ev.event || ev.title || 'Untitled')}</option>`)
      .join('');
  }

  function participantOptions(){
    return arr(g.data?.characters || [])
      .filter(c => !activeSeriesId() || !c.seriesId || c.seriesId === activeSeriesId())
      .map(c => `<option value="${esc(c.id)}">${esc(c.name || 'Unnamed Character')}</option>`)
      .join('');
  }

  function buildTimelineIntelligenceForm(){
    return `<section class="panel timeline-intelligence-v2 timeline-intelligence-clean">
      <div class="card-header"><div><h3>➕ Add Relative Event</h3><p class="muted small-text">Create a relative timeline event with event type, wiki data, consequences, and participant impact notes.</p></div></div>
      <div class="inline-grid compact-fields timeline-calendar-row">
        <input id="storyYearSetting" placeholder="Main story year, e.g. 1970" value="${esc(g.data?.projectTimeSettings?.storyYear || '')}">
        <select id="calendarTypeSetting">
          <option ${g.data?.projectTimeSettings?.calendarType === 'Real World' ? 'selected' : ''}>Real World</option>
          <option ${g.data?.projectTimeSettings?.calendarType === 'Fantasy' ? 'selected' : ''}>Fantasy</option>
          <option ${g.data?.projectTimeSettings?.calendarType === 'Custom' ? 'selected' : ''}>Custom</option>
        </select>
        <input id="fantasyMonthsSetting" placeholder="Fantasy months / calendar notes" value="${esc(g.data?.projectTimeSettings?.fantasyMonths || '')}">
        <button type="button" onclick="saveTimelineCalendarSettings()">Save Calendar</button>
      </div>
      <h4>Event Placement</h4>
      <div class="timeline-intel-grid">
        <input id="timelineSmartEvent" placeholder="Event title">
        <select id="timelineRelativeToType" onchange="refreshTimelineRelativeBase()">
          <option value="story">Story Start</option>
          <option value="chapter">Chapter</option>
          <option value="scene">Scene</option>
          <option value="event">Another Event</option>
        </select>
        <select id="timelineRelativeBase"><option value="">Story Start</option></select>
        <input id="timelineRelativeOffset" type="number" value="1" min="0">
        <select id="timelineRelativeUnit"><option>years</option><option>months</option><option>weeks</option><option>days</option></select>
        <select id="timelineRelativeDirection"><option value="before">before</option><option value="after">after</option></select>
      </div>
      <h4>Wiki Data</h4>
      <div class="timeline-intel-grid timeline-wiki-data-grid">
        <select id="timelineEventType">
          <option value="">Event Type</option>
          <option>Birth</option><option>Death</option><option>War</option><option>Discovery</option><option>Betrayal</option><option>Marriage</option><option>Transformation</option><option>Disappearance</option><option>Reunion</option><option>Other</option>
        </select>
        <select id="timelineImportance">
          <option value="">Importance</option>
          <option>Major</option><option>Secondary</option><option>Minor Background</option><option>Flavor Lore</option>
        </select>
        <select id="timelineLoreImportance">
          <option value="">Lore Importance</option>
          <option>Critical Lore</option><option>Important Lore</option><option>Minor Lore</option><option>Flavor Lore</option>
        </select>
        <select id="timelineCanonStatus">
          <option value="">Canon Status</option>
          <option>Canon</option><option>Draft</option><option>Removed</option><option>Possible Future</option>
        </select>
        <select id="timelineEntryType">
          <option value="">Entry Type</option>
          <option>Timeline Event</option><option>Historical Event</option><option>Backstory Event</option><option>Plot Event</option><option>World Event</option>
        </select>
        <input id="timelineWikiTags" placeholder="Tags, comma separated">
      </div>
      <div class="timeline-two-note-grid">
        <label>What Happens<textarea id="timelineWhatHappens" placeholder="Describe the event itself."></textarea></label>
        <label>Why it Matters / Consequences<textarea id="timelineWhyMatters" placeholder="Explain why this event matters and what changes because of it."></textarea></label>
      </div>
      <label class="timeline-participant-label">Participants
        <select id="timelineParticipantSelect" multiple size="6" onchange="handleTimelineParticipantSelection(this)">${participantOptions()}</select>
      </label>
      <div id="timelineParticipantImpactSummary" class="timeline-impact-summary muted small-text">Select participants to add individual Participation Impact notes.</div>
      <button type="button" class="primary-wiki-btn" onclick="addIntelligentTimelineEvent()">+ Add Relative Event</button>
    </section>`;
  }

  function ensureParticipantImpactModal(){
    if(document.getElementById('timelineParticipantImpactModal')) return;
    document.body.insertAdjacentHTML('beforeend', `<div class="timeline-impact-modal hidden" id="timelineParticipantImpactModal" role="dialog" aria-modal="true">
      <div class="timeline-impact-modal-card">
        <div class="card-header"><h3>Participation Impact</h3><button type="button" class="ghost-btn" onclick="closeTimelineParticipantImpactModal()">Close</button></div>
        <p class="muted" id="timelineImpactCharacterName"></p>
        <textarea id="timelineImpactText" placeholder="How does this event affect this participant? What do they do, learn, lose, change, or cause?"></textarea>
        <div class="form-actions"><button type="button" class="glow" onclick="saveTimelineParticipantImpact()">Save Impact</button></div>
      </div>
    </div>`);
  }

  g.handleTimelineParticipantSelection = function(select){
    ensureParticipantImpactModal();
    const selected = new Set([...select.selectedOptions].map(o => o.value));
    const newlySelected = [...selected].find(x => !lastSelectedParticipants.has(x));
    lastSelectedParticipants = selected;
    Object.keys(participantImpactsDraft).forEach(key => { if(!selected.has(key)) delete participantImpactsDraft[key]; });
    renderParticipantImpactSummary();
    if(newlySelected) openTimelineParticipantImpactModal(newlySelected);
  };

  function openTimelineParticipantImpactModal(characterId){
    const character = arr(g.data?.characters).find(c => c.id === characterId);
    const modal = document.getElementById('timelineParticipantImpactModal');
    modal.dataset.characterId = characterId;
    document.getElementById('timelineImpactCharacterName').textContent = character?.name ? `Impact for ${character.name}` : 'Impact for selected participant';
    document.getElementById('timelineImpactText').value = participantImpactsDraft[characterId] || '';
    modal.classList.remove('hidden');
  }

  g.closeTimelineParticipantImpactModal = function(){
    document.getElementById('timelineParticipantImpactModal')?.classList.add('hidden');
  };

  g.saveTimelineParticipantImpact = function(){
    const modal = document.getElementById('timelineParticipantImpactModal');
    const characterId = modal?.dataset.characterId;
    if(characterId) participantImpactsDraft[characterId] = document.getElementById('timelineImpactText')?.value?.trim() || '';
    g.closeTimelineParticipantImpactModal();
    renderParticipantImpactSummary();
  };

  function renderParticipantImpactSummary(){
    const target = document.getElementById('timelineParticipantImpactSummary');
    if(!target) return;
    const selected = [...(document.getElementById('timelineParticipantSelect')?.selectedOptions || [])].map(o => o.value);
    if(!selected.length){ target.textContent = 'Select participants to add individual Participation Impact notes.'; return; }
    const names = selected.map(pid => {
      const c = arr(g.data?.characters).find(x => x.id === pid);
      return `${c?.name || 'Participant'}${participantImpactsDraft[pid] ? ' ✓' : ''}`;
    });
    target.innerHTML = `<strong>Participant impacts:</strong> ${names.map(esc).join(' • ')}`;
  }

  g.refreshTimelineRelativeBase = function(){
    const type = document.getElementById('timelineRelativeToType')?.value || 'story';
    const base = document.getElementById('timelineRelativeBase');
    if(!base) return;
    if(type === 'chapter') base.innerHTML = chapterOptions() || '<option value="">No chapters yet</option>';
    else if(type === 'scene') base.innerHTML = sceneOptions() || '<option value="">No scenes yet</option>';
    else if(type === 'event') base.innerHTML = eventOptions() || '<option value="">No events yet</option>';
    else base.innerHTML = '<option value="">Story Start</option>';
  };

  g.addIntelligentTimelineEvent = function(){
    const relativeTo = document.getElementById('timelineRelativeToType')?.value || 'story';
    const baseId = document.getElementById('timelineRelativeBase')?.value || '';
    const offset = document.getElementById('timelineRelativeOffset')?.value || '0';
    const unit = document.getElementById('timelineRelativeUnit')?.value || 'years';
    const direction = document.getElementById('timelineRelativeDirection')?.value || 'before';
    const title = val('timelineSmartEvent') || 'Untitled Event';
    const whatHappens = val('timelineWhatHappens');
    const whyMatters = val('timelineWhyMatters');
    const eventType = document.getElementById('timelineEventType')?.value || '';
    const importance = document.getElementById('timelineImportance')?.value || '';
    const loreImportance = document.getElementById('timelineLoreImportance')?.value || '';
    const canonStatus = document.getElementById('timelineCanonStatus')?.value || '';
    const entryType = document.getElementById('timelineEntryType')?.value || '';
    const wikiTags = val('timelineWikiTags');
    const participants = [...(document.getElementById('timelineParticipantSelect')?.selectedOptions || [])].map(o => o.value);
    const when = calculateRelativeLabel(relativeTo, baseId, offset, unit, direction);

    g.data.timeline = arr(g.data.timeline);
    g.data.timeline.push({
      id: id(),
      seriesId: activeSeriesId(),
      bookId: activeBookId(),
      scope: g.data?.navScope || 'series',
      when,
      computedDate: when,
      event: title,
      title,
      whatHappens,
      whyMatters,
      impact: whyMatters,
      eventType,
      type: eventType,
      importance,
      loreImportance,
      canonStatus,
      status: canonStatus,
      entryType,
      wikiTags,
      tags: wikiTags,
      participantIds: participants,
      participantImpacts: {...participantImpactsDraft},
      dateType: 'Relative',
      relativeToType: relativeTo,
      relativeBaseId: baseId,
      relativeOffset: offset,
      relativeUnit: unit,
      relativeDirection: direction,
      created: (new Date()).toISOString()
    });
    ['timelineSmartEvent','timelineWhatHappens','timelineWhyMatters','timelineWikiTags'].forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if(field) field.value = '';
    });
    ['timelineEventType','timelineImportance','timelineLoreImportance','timelineCanonStatus','timelineEntryType'].forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if(field) field.value = '';
    });
    const participantSelect = document.getElementById('timelineParticipantSelect');
    if(participantSelect) [...participantSelect.options].forEach(option => option.selected = false);
    participantImpactsDraft = {};
    lastSelectedParticipants = new Set();
    renderParticipantImpactSummary();
    g.saveData?.(true, false);
    g.renderTimeline?.();
    g.renderEncyclopedia?.();
  };

  function renderTimelineCards(){
    const list = document.getElementById('timelineList');
    if(!list) return;
    const events = arr(g.data?.timeline).filter(timelineScopeMatch);
    list.innerHTML = events.length ? events.map(ev => {
      const impacts = ev.participantImpacts || {};
      const participants = arr(ev.participantIds).map(pid => arr(g.data?.characters).find(c => c.id === pid)).filter(Boolean);
      return `<article class="item-card timeline-item timeline-event-card">
        <div class="card-header"><h3>${esc(ev.when || ev.computedDate || 'Unplaced Event')}</h3><button class="delete-btn" onclick="deleteItem('timeline','${esc(ev.id)}')">Delete</button></div>
        <div class="card-body">
          <span class="tag">${esc(ev.scope || 'series')}</span>
          ${ev.eventType || ev.type ? `<span class="tag">${esc(ev.eventType || ev.type)}</span>` : ''}
          ${ev.importance ? `<span class="tag">${esc(ev.importance)}</span>` : ''}
          ${ev.loreImportance ? `<span class="tag">${esc(ev.loreImportance)}</span>` : ''}
          ${ev.canonStatus || ev.status ? `<span class="tag">${esc(ev.canonStatus || ev.status)}</span>` : ''}
          <h4>${esc(ev.event || ev.title || 'Untitled Event')}</h4>
          ${ev.whatHappens ? `<section><strong>What Happens</strong><p>${esc(ev.whatHappens)}</p></section>` : ''}
          ${ev.whyMatters || ev.impact ? `<section><strong>Why it Matters / Consequences</strong><p>${esc(ev.whyMatters || ev.impact)}</p></section>` : ''}
          ${participants.length ? `<section><strong>Participants</strong><div class="timeline-participant-chips">${participants.map(c => `<span class="tag">${esc(c.name)}</span>`).join('')}</div></section>` : ''}
          ${participants.some(c => impacts[c.id]) ? `<section><strong>Participation Impact</strong>${participants.filter(c => impacts[c.id]).map(c => `<p><b>${esc(c.name)}:</b> ${esc(impacts[c.id])}</p>`).join('')}</section>` : ''}
        </div>
      </article>`;
    }).join('') : '<p class="muted">No timeline events yet.</p>';
  }

  const oldRenderTimeline = g.renderTimeline;
  g.renderTimeline = function(){
    if(typeof oldRenderTimeline === 'function') oldRenderTimeline.apply(this, arguments);
    const list = document.getElementById('timelineList');
    if(!list) return;
    document.querySelectorAll('#timeline .form-panel').forEach(el => el.remove());
    document.querySelectorAll('.timeline-intelligence-v2').forEach(el => el.remove());
    list.insertAdjacentHTML('beforebegin', buildTimelineIntelligenceForm());
    renderTimelineCards();
    ensureParticipantImpactModal();
  };

  document.addEventListener('DOMContentLoaded', () => setTimeout(() => g.renderTimeline?.(), 300));
})();


/* ===== character-form-cleanup.js ===== */
(function(){
  if(window.__plotpalsCharacterFormCleanupV1) return;
  window.__plotpalsCharacterFormCleanupV1 = true;

  function removeContinuityFields(root=document){
    root.querySelectorAll('#charContinuityFacts,#editCharContinuityFacts,textarea[placeholder*="Continuity Facts"],textarea[placeholder*="Continuity facts"]').forEach(el=>el.remove());
    if(window.data && Array.isArray(window.data.characters)){
      window.data.characters.forEach(c=>{ if(c && Object.prototype.hasOwnProperty.call(c,'continuityFacts')) delete c.continuityFacts; });
    }
  }

  function hideOldVoiceSummary(root=document){
    root.querySelectorAll('#charVoice,#editCharVoice,textarea[placeholder*="Voice summary"],textarea[placeholder*="speech patterns"],textarea[placeholder*="Speech Patterns"]').forEach(el=>{
      el.value = '';
      el.classList.add('plotpals-hidden-legacy-voice');
      el.setAttribute('aria-hidden','true');
      el.setAttribute('tabindex','-1');
    });
  }

  function addHeadingsToEditForm(root=document){
    const name = root.getElementById ? root.getElementById('editCharName') : document.getElementById('editCharName');
    if(!name || document.getElementById('editCharacterIdentityHeading')) return;
    const insertBefore = (targetId, id, text, note='')=>{
      const target = document.getElementById(targetId);
      if(target && !document.getElementById(id)){
        target.insertAdjacentHTML('beforebegin', `<div class="form-section-heading edit-character-heading" id="${id}">${text}</div>${note?`<small class="muted form-section-note">${note}</small>`:''}`);
      }
    };
    insertBefore('editCharName','editCharacterIdentityHeading','Identity');
    insertBefore('editCharAge','editCharacterTimelineHeading','Timeline Dates','Birth and death dates feed the unified Story Timeline system and support character age/status tracking.');
    insertBefore('editCharBirthplace','editCharacterWorldHeading','World Links');
    insertBefore('editCharStoryPurpose','editCharacterStoryHeading','Story Role');
    insertBefore('editCharWound','editCharacterPsychologyHeading','Psychology');
    insertBefore('editCharArcBook','editCharacterArcHeading','Character Arcs');
    insertBefore('editCharVoiceSpeechStyle','editCharacterVoiceHeading','Voice Profile');
    insertBefore('editCharSecrets','editCharacterSecretsHeading','Secrets & Quotes');
  }

  function ensureTimelineDateLabels(root=document){
    const age = document.getElementById('charAge');
    if(age) age.placeholder = 'Actual age for timeline calculations, e.g. 345';
    const birth = document.getElementById('charBirthDate');
    if(birth) birth.placeholder = 'Birth year / date for timeline, e.g. 1625';
    const death = document.getElementById('charDeathDate');
    if(death) death.placeholder = 'Death year / date for timeline';
    const editAge = document.getElementById('editCharAge');
    if(editAge) editAge.placeholder = 'Actual age for timeline calculations';
    const editBirth = document.getElementById('editCharBirthDate');
    if(editBirth) editBirth.placeholder = 'Birth year / date for timeline';
    const editDeath = document.getElementById('editCharDeathDate');
    if(editDeath) editDeath.placeholder = 'Death year / date for timeline';
  }

  function cleanupCharacterForms(){
    removeContinuityFields();
    hideOldVoiceSummary();
    addHeadingsToEditForm();
    ensureTimelineDateLabels();
  }

  function scrubCharacterData(){
    if(window.data && Array.isArray(window.data.characters)){
      window.data.characters.forEach(c=>{ if(c) delete c.continuityFacts; });
    }
  }

  const wrapNames = ['addCharacter','saveCharacterDetailEdit','preserveCharacterDetailEditDraft','saveData'];
  wrapNames.forEach(name=>{
    const original = window[name];
    if(typeof original === 'function' && !original.__characterCleanupWrapped){
      const wrapped = function(){
        cleanupCharacterForms();
        const result = original.apply(this, arguments);
        setTimeout(()=>{ scrubCharacterData(); cleanupCharacterForms(); }, 50);
        return result;
      };
      wrapped.__characterCleanupWrapped = true;
      window[name] = wrapped;
    }
  });

  const originalRenderAll = window.renderAll;
  if(typeof originalRenderAll === 'function' && !originalRenderAll.__characterCleanupWrapped){
    window.renderAll = function(){
      const result = originalRenderAll.apply(this, arguments);
      setTimeout(cleanupCharacterForms, 60);
      return result;
    };
    window.renderAll.__characterCleanupWrapped = true;
  }
  const originalRenderCharacterDetail = window.renderCharacterDetail;
  if(typeof originalRenderCharacterDetail === 'function' && !originalRenderCharacterDetail.__characterCleanupWrapped){
    window.renderCharacterDetail = function(){
      const result = originalRenderCharacterDetail.apply(this, arguments);
      setTimeout(cleanupCharacterForms, 60);
      return result;
    };
    window.renderCharacterDetail.__characterCleanupWrapped = true;
  }

  document.addEventListener('DOMContentLoaded', ()=>setTimeout(cleanupCharacterForms, 150));
  document.addEventListener('input', e=>{ if(e.target && /charContinuityFacts|editCharContinuityFacts/.test(e.target.id||'')) e.target.value=''; });
  setInterval(cleanupCharacterForms, 1200);
  cleanupCharacterForms();
})();


/* ===== card-actions-edit-delete.js ===== */
(function(){
  if (window.__plotpalsCardEditDeletePatch) return;
  window.__plotpalsCardEditDeletePatch = true;

  const ROLES = ["Protagonist","Major Supporting Character","Love Interest","Mentor","Antagonist","Historical Character","Minor Character"];
  const esc = (v)=>String(v ?? "").replace(/[&<>'"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const valOf = (id)=>document.getElementById(id)?.value?.trim?.() || "";
  const setValSafe = (id,v)=>{ const el=document.getElementById(id); if(el) el.value = v || ""; };
  const showForm = (id)=>{ const el=document.getElementById(id); if(el){ el.classList.remove('hidden'); try{ el.scrollIntoView({behavior:'smooth',block:'start'}); }catch{} } };
  const clearFile = (id)=>{ const el=document.getElementById(id); if(el) el.value=""; };
  const updateButtonText = (formId, fnName, text)=>{
    const form = document.getElementById(formId); if(!form) return;
    const btn = form.querySelector(`button[onclick="${fnName}()"]`);
    if(btn) btn.textContent = text;
  };
  const restoreButtonText = (formId, fnName, text)=>updateButtonText(formId,fnName,text);
  const notify = (msg)=> (window.showStatus ? showStatus(msg) : console.log(msg));

  window.__plotpalsEditing = window.__plotpalsEditing || { character:null, location:null, organization:null, magic:null, world:null };

  function scopedCharacters(){
    try { return (typeof charactersForCurrentScope === 'function' ? charactersForCurrentScope() : (data.characters||[]).filter(c=>!c.deletedAt)); }
    catch { return (data.characters||[]).filter(c=>!c.deletedAt); }
  }
  function charPhotoMini(c){
    if(typeof renderCharacterPhotoMini === 'function') return renderCharacterPhotoMini(c);
    return c.photo ? `<img class="compact-card-photo" src="${esc(c.photo)}" alt="${esc(c.name||'Character')}">` : '<div class="compact-card-photo photo-placeholder">No Image</div>';
  }
  function charBasic(c){
    if(typeof characterMiniBasicInfo === 'function') return characterMiniBasicInfo(c);
    return `<p>${esc(c.pronouns||'')}</p><p>${esc(c.age||'')}</p><p>${esc(c.status||'')}</p>`;
  }
  function roleOf(c){
    return typeof normalizeCharacterRole === 'function' ? normalizeCharacterRole(c.role) : (c.role || 'Minor Character');
  }

  window.editCharacterCard = function(id){
    const c=(data.characters||[]).find(x=>x.id===id); if(!c) return;
    window.__plotpalsEditing.character = id;
    if(typeof setView === 'function') setView('characters');
    setTimeout(()=>{
      showForm('characterAddForm');
      setValSafe('charName', c.name);
      setValSafe('charScope', c.scope || (c.bookId ? 'book':'series'));
      setValSafe('charRole', c.role || 'Minor Character');
      setValSafe('charCurrentStatus', c.currentStatus || c.status || 'Alive');
      setValSafe('charSpecies', c.speciesId || c.species || '');
      setValSafe('charAge', c.age);
      setValSafe('charAppearanceAge', c.appearanceAge);
      setValSafe('charBirthDate', c.birthDate || c.birthYear);
      setValSafe('charDeathDate', c.deathDate || c.deathYear);
      const deceased = document.getElementById('charDeceased'); if(deceased) deceased.checked = !!(c.deceased || c.deathDate || c.deathYear);
      setValSafe('charBirthplace', c.birthplaceId || c.birthplace || '');
      setValSafe('charLanguages', Array.isArray(c.languageIds) ? c.languageIds[0] : (c.languages || ''));
      setValSafe('charStoryPurpose', c.storyPurpose);
      setValSafe('charBasicInfo', c.basicInfo);
      setValSafe('charDescription', c.description);
      setValSafe('charPersonality', c.personality);
      setValSafe('charBackstory', c.backstory);
      setValSafe('charWound', c.wound);
      const vp=c.voiceProfile||{};
      setValSafe('charVoiceSpeechStyle', vp.speechStyle || c.speechStyle);
      setValSafe('charVoicePhrases', vp.phrases || c.voicePhrases);
      setValSafe('charVoiceVocabulary', vp.vocabulary || c.vocabulary);
      setValSafe('charVoiceSentenceLength', vp.sentenceLength || c.sentenceLength);
      setValSafe('charVoiceFormality', vp.formality || c.formality);
      setValSafe('charVoiceHumor', vp.humor || c.humor);
      setValSafe('charVoiceDialect', vp.dialect || c.dialect);
      setValSafe('charVoiceMannerisms', vp.mannerisms || c.voiceMannerisms);
      setValSafe('charSecrets', c.secrets);
      setValSafe('charQuotes', c.quotes);
      clearFile('charPhoto');
      updateButtonText('characterAddForm','addCharacter','Save Character Changes');
    },80);
  };

  const originalAddCharacter = window.addCharacter;
  window.addCharacter = function(){
    const id = window.__plotpalsEditing?.character;
    if(!id) return originalAddCharacter ? originalAddCharacter.apply(this, arguments) : undefined;
    const c=(data.characters||[]).find(x=>x.id===id); if(!c) { window.__plotpalsEditing.character=null; return; }
    c.name=valOf('charName') || c.name || 'Unnamed Character';
    c.scope=valOf('charScope') || c.scope || 'book';
    c.seriesId = c.scope === 'series' ? data.activeSeriesId : (c.seriesId || data.activeSeriesId);
    c.bookId = c.scope === 'book' ? data.activeBookId : null;
    c.role=valOf('charRole') || c.role;
    c.currentStatus=valOf('charCurrentStatus') || c.currentStatus;
    c.status=c.currentStatus || c.status;
    c.speciesId=valOf('charSpecies') || c.speciesId;
    c.age=valOf('charAge');
    c.appearanceAge=valOf('charAppearanceAge');
    c.birthDate=valOf('charBirthDate');
    c.birthYear=c.birthDate;
    c.deceased=!!document.getElementById('charDeceased')?.checked;
    c.deathDate=valOf('charDeathDate');
    c.deathYear=c.deathDate;
    c.birthplaceId=valOf('charBirthplace') || c.birthplaceId;
    const lang=valOf('charLanguages'); c.languageIds = lang ? [lang] : (c.languageIds || []);
    c.storyPurpose=valOf('charStoryPurpose');
    c.basicInfo=valOf('charBasicInfo');
    c.description=valOf('charDescription');
    c.personality=valOf('charPersonality');
    c.backstory=valOf('charBackstory');
    c.wound=valOf('charWound');
    c.voiceProfile={
      speechStyle:valOf('charVoiceSpeechStyle'), phrases:valOf('charVoicePhrases'), vocabulary:valOf('charVoiceVocabulary'),
      sentenceLength:valOf('charVoiceSentenceLength'), formality:valOf('charVoiceFormality'), humor:valOf('charVoiceHumor'),
      dialect:valOf('charVoiceDialect'), mannerisms:valOf('charVoiceMannerisms')
    };
    c.secrets=valOf('charSecrets'); c.quotes=valOf('charQuotes'); c.updated=(new Date).toISOString();
    const fileInput=document.getElementById('charPhoto');
    const finish=()=>{ window.__plotpalsEditing.character=null; restoreButtonText('characterAddForm','addCharacter','Add Character'); if(typeof hideAddForm==='function') hideAddForm('characterAddForm'); notify('Character updated.'); saveData(true); };
    if(fileInput?.files?.[0] && typeof readImageUpload === 'function') readImageUpload(fileInput, url=>{ c.photo=url; finish(); }); else finish();
  };

  window.renderCharactersByRole = function(){
    const root=document.getElementById('characterRoleGroups'); if(!root) return;
    const active=data.characterRoleFilter||'all';
    const groups=active==='all'?ROLES:ROLES.filter(r=>r===roleOf({role:active}));
    const chars=scopedCharacters();
    const bar=`<div class="character-filter-bar"><button type="button" class="tag ${active==='all'?'active-filter':''}" onclick="clearCharacterRoleFilter()">All Characters</button>${ROLES.map(r=>`<button type="button" class="tag ${active===r?'active-filter':''}" onclick="setCharacterRoleFilter('${esc(r)}')">${esc(r)}</button>`).join('')}</div>`;
    root.innerHTML = bar + groups.map(role=>{
      const list=chars.filter(c=>roleOf(c)===role);
      return `<div class="role-group character-role-group"><div class="role-group-header"><h3>${esc(role)}</h3><span class="tag">${list.length}</span></div><div class="character-directory-grid">${list.length?list.map(c=>`<article class="item-card character-mini-card character-directory-card clickable-card" onclick="setView('characterDetail','${esc(c.id)}')" title="Open ${esc(c.name||'Character')}"><div class="card-header compact-card-header"><h3>${esc(c.name||'Unnamed Character')}</h3><div class="card-action-row"><button class="ghost-btn tiny-btn" onclick="event.stopPropagation(); editCharacterCard('${esc(c.id)}')">Edit</button><button class="delete-btn compact-delete-btn" onclick="event.stopPropagation(); deleteItem('characters','${esc(c.id)}')">Delete</button></div></div>${charPhotoMini(c)}<div class="card-body character-mini-basic">${charBasic(c)}</div></article>`).join(''):`<p class="muted">No ${esc(role)} characters yet.</p>`}</div></div>`;
    }).join('');
  };

  function collectionForWorldItem(item, category){
    const kind=item.__kind || '';
    if(kind==='location' || item.population !== undefined && category && String(category).toLowerCase().includes('location')) return 'locations';
    if(kind==='organization' || item.members !== undefined && category && String(category).toLowerCase().includes('organization')) return 'organizations';
    if(kind==='magic' || item.rules !== undefined && category && String(category).toLowerCase().includes('magic')) return 'magicSystems';
    return 'world';
  }
  function viewForCollection(coll){ return coll==='locations'?'locationDetail':coll==='organizations'?'organizationDetail':coll==='magicSystems'?'magicDetail':'worldDetail'; }
  function kindForCollection(coll){ return coll==='locations'?'location':coll==='organizations'?'organization':coll==='magicSystems'?'magic':'world'; }
  function formForKind(kind){ return {location:'locationAddForm',organization:'organizationAddForm',magic:'magicAddForm'}[kind]; }
  function addFnForKind(kind){ return {location:'addLocation',organization:'addOrganization',magic:'addMagic'}[kind]; }
  function addTextForKind(kind){ return {location:'Add Location',organization:'Add Organization',magic:'Add Magic System'}[kind]; }
  function saveTextForKind(kind){ return {location:'Save Location Changes',organization:'Save Organization Changes',magic:'Save Magic System Changes'}[kind]; }

  window.editEntityCard = function(kind,id){
    const coll={location:'locations',organization:'organizations',magic:'magicSystems'}[kind]; if(!coll) return;
    const item=(data[coll]||[]).find(x=>x.id===id); if(!item) return;
    window.__plotpalsEditing[kind]=id;
    if(typeof setView==='function') setView({location:'locations',organization:'organizations',magic:'magic'}[kind]);
    setTimeout(()=>{
      const form=formForKind(kind); showForm(form);
      if(kind==='location'){
        setValSafe('locationName', item.name); setValSafe('locationScope', item.scope || (item.bookId?'book':'series'));
        setValSafe('locationPopulation', item.population);
        setValSafe('locationDescription', item.description); setValSafe('locationHistory', item.history); setValSafe('locationNotes', item.notes); clearFile('locationImage');
      } else if(kind==='organization'){
        setValSafe('orgName', item.name); setValSafe('orgType', item.type); setValSafe('orgDescription', item.description); setValSafe('orgHistory', item.history); clearFile('orgImage');
      } else if(kind==='magic'){
        setValSafe('magicName', item.name); setValSafe('magicSource', item.source); setValSafe('magicRules', item.rules); setValSafe('magicLimits', item.limits); setValSafe('magicCosts', item.costs); setValSafe('magicExamples', item.examples); clearFile('magicImage');
      }
      updateButtonText(form, addFnForKind(kind), saveTextForKind(kind));
    },80);
  };

  function finishEntity(kind, form){
    window.__plotpalsEditing[kind]=null; restoreButtonText(form, addFnForKind(kind), addTextForKind(kind)); if(typeof hideAddForm==='function') hideAddForm(form); notify(`${kind[0].toUpperCase()+kind.slice(1)} updated.`); saveData(true);
  }
  const originalAddLocation=window.addLocation, originalAddOrganization=window.addOrganization, originalAddMagic=window.addMagic;
  window.addLocation=function(){
    const id=window.__plotpalsEditing?.location; if(!id) return originalAddLocation?originalAddLocation.apply(this,arguments):undefined;
    const item=(data.locations||[]).find(x=>x.id===id); if(!item) return;
    item.name=valOf('locationName')||item.name; item.scope=valOf('locationScope')||item.scope||'book'; item.seriesId=item.scope==='series'?data.activeSeriesId:item.seriesId||data.activeSeriesId; item.bookId=item.scope==='book'?data.activeBookId:null;
    item.population=valOf('locationPopulation'); item.description=valOf('locationDescription'); item.history=valOf('locationHistory'); item.notes=valOf('locationNotes'); item.updated=(new Date).toISOString();
    const input=document.getElementById('locationImage'); if(input?.files?.[0]&&typeof readImageUpload==='function') readImageUpload(input,url=>{item.image=url; finishEntity('location','locationAddForm')}); else finishEntity('location','locationAddForm');
  };
  window.addOrganization=function(){
    const id=window.__plotpalsEditing?.organization; if(!id) return originalAddOrganization?originalAddOrganization.apply(this,arguments):undefined;
    const item=(data.organizations||[]).find(x=>x.id===id); if(!item) return;
    item.name=valOf('orgName')||item.name; item.type=valOf('orgType'); item.description=valOf('orgDescription'); item.history=valOf('orgHistory'); if(Object.prototype.hasOwnProperty.call(item,'members')) delete item.members; item.updated=(new Date).toISOString();
    const input=document.getElementById('orgImage'); if(input?.files?.[0]&&typeof readImageUpload==='function') readImageUpload(input,url=>{item.image=url; finishEntity('organization','organizationAddForm')}); else finishEntity('organization','organizationAddForm');
  };
  window.addMagic=function(){
    const id=window.__plotpalsEditing?.magic; if(!id) return originalAddMagic?originalAddMagic.apply(this,arguments):undefined;
    const item=(data.magicSystems||[]).find(x=>x.id===id); if(!item) return;
    item.name=valOf('magicName')||item.name; item.source=valOf('magicSource'); item.rules=valOf('magicRules'); item.limits=valOf('magicLimits'); item.costs=valOf('magicCosts'); item.examples=valOf('magicExamples'); item.updated=(new Date).toISOString();
    const input=document.getElementById('magicImage'); if(input?.files?.[0]&&typeof readImageUpload==='function') readImageUpload(input,url=>{item.image=url; finishEntity('magic','magicAddForm')}); else finishEntity('magic','magicAddForm');
  };

  window.renderEntityList = function(kind){
    const config={
      location:{collection:'locations',listId:'locationList',label:'Location',fields:[['population','Population'],['description','Description'],['history','History'],['notes','Notes']],detailView:'locationDetail'},
      magic:{collection:'magicSystems',listId:'magicList',label:'Magic/System',fields:[['source','Source'],['rules','Rules'],['limits','Limitations'],['costs','Costs'],['examples','Examples / Uses']],detailView:'magicDetail'},
      organization:{collection:'organizations',listId:'organizationList',label:'Organization',fields:[['type','Type'],['description','Description'],['history','History']],detailView:'organizationDetail'}
    }[kind];
    if(!config) return;
    const root=document.getElementById(config.listId); if(!root) return;
    const search=(document.getElementById(`${kind}Search`)?.value||'').trim().toLowerCase();
    let items=(data[config.collection]||[]).filter(x=>!x.deletedAt);
    if(typeof projectWorldScope==='function') { try { items=items.filter(projectWorldScope); } catch{} }
    if(search) items=items.filter(x=>JSON.stringify(x).toLowerCase().includes(search));
    try { if(typeof sortEntityItems==='function') sortEntityItems(kind,items); } catch { items.sort((a,b)=>(a.name||'').localeCompare(b.name||'')); }
    root.innerHTML=items.length?items.map(item=>{
      const field=config.fields.find(([f])=>item[f])||config.fields[0]||[]; const summary=field[0]?item[field[0]]:'';
      return `<article class="item-card compact-entry-card world-entry-card" onclick="setView('${config.detailView}','${esc(item.id)}')">${item.image?`<img class="compact-card-photo" src="${esc(item.image)}" alt="${esc(item.name||config.label)}">`:'<div class="compact-card-photo photo-placeholder">No Image</div>'}<div class="compact-card-body"><div class="card-header compact-card-header"><h3>${esc(item.name||config.label)}</h3><div class="card-action-row"><button class="ghost-btn tiny-btn" onclick="event.stopPropagation(); editEntityCard('${kind}','${esc(item.id)}')">Edit</button><button class="delete-btn compact-delete-btn" onclick="event.stopPropagation(); deleteItem('${config.collection}','${esc(item.id)}')">Delete</button></div></div><span class="tag">${esc(config.label)}</span>${summary?`<div class="basic-info-stack"><strong>${esc(field[1]||'Summary')}</strong><span>${esc(summary).slice(0,180)}${summary.length>180?'…':''}</span></div>`:''}</div></article>`;
    }).join('') : (search?`<p class="muted">No ${esc(config.label.toLowerCase())} entries match your search.</p>`:`<p class="muted">No entries yet.</p>`);
  };

  window.editWorldCategoryCard = function(collection,id,category){
    const item=(data[collection]||[]).find(x=>x.id===id); if(!item) return;
    window.__plotpalsEditing.world={collection,id,category:category||item.category||'Other'};
    if(typeof setView==='function') setView('worldCategory', category || item.category || 'Other');
    setTimeout(()=>{
      const slug=(typeof canonicalWorldCategory==='function'?canonicalWorldCategory(category || item.category || 'Other'):'other');
      const formId=`worldCategoryAddForm_${slug}`; showForm(formId);
      setValSafe('worldName', item.name);
      setValSafe('worldScope', item.scope || (item.bookId?'book':'series'));
      const cfg=typeof worldCategoryFormConfig==='function'?worldCategoryFormConfig(category || item.category || 'Other'):null;
      (cfg?.fields||[]).forEach(([field])=>{ const id='world'+field.charAt(0).toUpperCase()+field.slice(1); setValSafe(id,item[field]); });
      clearFile('worldImage');
      updateButtonText(formId,'addWorldFromCurrentCategory','Save Entry Changes');
    },120);
  };
  const originalAddWorldFromCurrentCategory=window.addWorldFromCurrentCategory;
  window.addWorldFromCurrentCategory=function(){
    const edit=window.__plotpalsEditing?.world; if(!edit) return originalAddWorldFromCurrentCategory?originalAddWorldFromCurrentCategory.apply(this,arguments):undefined;
    const item=(data[edit.collection]||[]).find(x=>x.id===edit.id); if(!item) return;
    const category=edit.category || data.selectedWorldCategory || item.category || 'Other';
    const cfg=typeof worldCategoryFormConfig==='function'?worldCategoryFormConfig(category):null;
    item.name=valOf('worldName')||item.name; item.scope=valOf('worldScope')||item.scope||'series'; item.seriesId=data.activeSeriesId; item.bookId=item.scope==='book'?data.activeBookId:null;
    if(edit.collection==='world'){ item.category=category; if(typeof normalizeWorldEntryCategory==='function') normalizeWorldEntryCategory(item,category); }
    (cfg?.fields||[]).forEach(([field])=>{ const id='world'+field.charAt(0).toUpperCase()+field.slice(1); item[field]=valOf(id); });
    item.updated=(new Date).toISOString();
    const formId=`worldCategoryAddForm_${typeof canonicalWorldCategory==='function'?canonicalWorldCategory(category):'other'}`;
    const input=document.getElementById('worldImage');
    const finish=()=>{ window.__plotpalsEditing.world=null; restoreButtonText(formId,'addWorldFromCurrentCategory',`Save ${cfg?.singular||'Entry'}`); if(typeof hideAddForm==='function') hideAddForm(formId); notify('Entry updated.'); saveData(true); };
    if(input?.files?.[0]&&typeof readImageUpload==='function') readImageUpload(input,url=>{item.image=url; finish();}); else finish();
  };

  window.worldEntryCard = function(item,category,summaryLabel){
    const collection=collectionForWorldItem(item,category); const kind=kindForCollection(collection); const view=viewForCollection(collection);
    const summary=item.description||item.basicInfo||item.history||item.culture||item.rules||item.plotRelevance||item.source||item.type||'';
    return `<article class="item-card compact-entry-card world-entry-card" onclick="setView('${view}','${esc(item.id)}')">
      ${item.image?`<img class="compact-card-photo" src="${esc(item.image)}" alt="${esc(item.name||'Entry')}">`:'<div class="compact-card-photo photo-placeholder">No Image</div>'}
      <div class="compact-card-body">
        <div class="card-header compact-card-header"><h3>${esc(item.name||'Untitled Entry')}</h3><div class="card-action-row"><button class="ghost-btn tiny-btn" onclick="event.stopPropagation(); ${collection==='world'?`editWorldCategoryCard('world','${esc(item.id)}','${esc(category||item.category||'Other')}')`:`editEntityCard('${kind}','${esc(item.id)}')`}">Edit</button><button class="delete-btn compact-delete-btn" onclick="event.stopPropagation(); deleteItem('${collection}','${esc(item.id)}')">Delete</button></div></div>
        <span class="tag">${esc(item.category||category||'Other')}</span>
        ${summary?`<div class="basic-info-stack"><strong>${esc(summaryLabel||'Summary')}</strong><span>${esc(summary).slice(0,180)}${summary.length>180?'…':''}</span></div>`:''}
        ${item.plotRelevance?`<div class="basic-info-stack"><strong>Plot Relevance</strong><span>${esc(item.plotRelevance).slice(0,120)}${item.plotRelevance.length>120?'…':''}</span></div>`:''}
      </div>
    </article>`;
  };

  const style=document.createElement('style');
  style.textContent=`
    .card-action-row{display:flex;align-items:center;gap:.35rem;flex-wrap:wrap;justify-content:flex-end;}
    .tiny-btn{font-size:.78rem;padding:.35rem .55rem;border-radius:10px;}
    .compact-card-header{align-items:flex-start;gap:.5rem;}
    .compact-card-header h3{min-width:0;overflow-wrap:anywhere;}
    @media(max-width:760px){.card-action-row{width:100%;justify-content:flex-start}.compact-card-header{flex-direction:column;align-items:flex-start}.tiny-btn,.compact-delete-btn{min-height:36px;}}
  `;
  document.head.appendChild(style);

  const oldRenderAll=window.renderAll;
  if(typeof oldRenderAll==='function' && !oldRenderAll.__cardEditDeleteWrapped){
    const wrapped=function(){ const result=oldRenderAll.apply(this,arguments); setTimeout(()=>{ try{ if(data.currentView==='characters') renderCharactersByRole(); }catch{} },40); return result; };
    wrapped.__cardEditDeleteWrapped=true; window.renderAll=wrapped;
  }
})();


/* ===== two-sided-crossrefs.js ===== */
(function(){
  if(window.__plotpalsTwoSidedCrossrefsV1) return;
  window.__plotpalsTwoSidedCrossrefsV1 = true;

  const esc = (v)=>String(v ?? '').replace(/[&<>'"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const arr = (v)=>Array.isArray(v)?v:(v?[v]:[]);
  const uid = ()=> (Date.now().toString(36)+Math.random().toString(36).slice(2));
  const notify = (msg)=> window.showStatus ? window.showStatus(msg) : console.log(msg);

  const KIND_FIELD = {
    character:'relatedCharacters', characters:'relatedCharacters',
    location:'relatedLocations', locations:'relatedLocations',
    event:'relatedEvents', timeline:'relatedEvents', historicalEvent:'relatedEvents',
    organization:'relatedOrganizations', organizations:'relatedOrganizations',
    item:'relatedItems', artifact:'relatedItems', world:'relatedItems',
    magic:'relatedItems', magicSystem:'relatedItems', religion:'relatedItems', government:'relatedItems', culture:'relatedItems', language:'relatedItems', species:'relatedItems', flora:'relatedItems', other:'relatedItems'
  };

  const WORLD_KIND_BY_CATEGORY = {
    'Locations':'location','Location':'location','locations':'location',
    'Historical Events':'event','Historical Event':'event','historical-events':'event',
    'Organizations':'organization','Organization':'organization','organizations':'organization',
    'Religions':'religion','Religion':'religion','religions':'religion',
    'Races/Species':'species','Race/Species':'species','races-species':'species',
    'Magic Systems':'magic','Magic System':'magic','magic-systems':'magic',
    'Governments':'government','Government':'government','governments':'government',
    'Cultures':'culture','Culture':'culture','cultures':'culture',
    'Items/Artifacts':'item','Item/Artifact':'item','items-artifacts':'item',
    'Languages':'language','Language':'language','languages':'language',
    'Flora & Fauna':'flora','Flora/Fauna':'flora','flora-fauna':'flora',
    'Other':'other','other':'other'
  };

  function allEntrySources(){
    const d = window.data || {};
    return [
      {collection:'characters', kind:'character', label:'Character', items:arr(d.characters)},
      {collection:'locations', kind:'location', label:'Location', items:arr(d.locations)},
      {collection:'organizations', kind:'organization', label:'Organization', items:arr(d.organizations)},
      {collection:'magicSystems', kind:'magic', label:'Magic System', items:arr(d.magicSystems)},
      {collection:'timeline', kind:'event', label:'Timeline Event', items:arr(d.timeline)},
      {collection:'world', kind:'world', label:'Worldbuilding', items:arr(d.world)}
    ];
  }

  function inferWorldKind(item){
    const cat = item?.category || item?.categoryKey || item?.type || 'Other';
    return WORLD_KIND_BY_CATEGORY[cat] || WORLD_KIND_BY_CATEGORY[String(cat).toLowerCase()] || 'world';
  }

  function findEntry(id){
    if(!id) return null;
    for(const src of allEntrySources()){
      const item = src.items.find(x=>String(x?.id)===String(id));
      if(item){
        const kind = src.collection === 'world' ? inferWorldKind(item) : src.kind;
        return { item, id:item.id, collection:src.collection, kind, label:src.label, title:item.name || item.title || item.event || item.when || 'Untitled Entry' };
      }
    }
    return null;
  }

  function fieldForKind(kind){ return KIND_FIELD[kind] || KIND_FIELD[String(kind||'').toLowerCase()] || 'relatedItems'; }

  function addArrayValue(obj, field, id){
    if(!obj || !field || !id) return;
    obj[field] = arr(obj[field]).map(String);
    if(!obj[field].includes(String(id))) obj[field].push(String(id));
  }

  function ensureCrossReferenceArrays(sourceId, targetId){
    const source = findEntry(sourceId), target = findEntry(targetId);
    if(!source || !target) return;
    addArrayValue(source.item, fieldForKind(target.kind), target.id);
    addArrayValue(target.item, fieldForKind(source.kind), source.id);
  }

  function connectionExists(sourceId, targetId){
    const list = arr(window.data?.crossReferenceConnections);
    return list.some(c =>
      (String(c.sourceId)===String(sourceId) && String(c.targetId)===String(targetId)) ||
      (String(c.sourceId)===String(targetId) && String(c.targetId)===String(sourceId))
    );
  }

  function saveConnection(payload){
    if(!window.data) return null;
    window.data.crossReferenceConnections = arr(window.data.crossReferenceConnections);
    const source = findEntry(payload.sourceId), target = findEntry(payload.targetId);
    if(!source || !target) return null;
    ensureCrossReferenceArrays(source.id, target.id);
    let existing = window.data.crossReferenceConnections.find(c =>
      (String(c.sourceId)===String(source.id) && String(c.targetId)===String(target.id)) ||
      (String(c.sourceId)===String(target.id) && String(c.targetId)===String(source.id))
    );
    if(!existing){
      existing = { id:uid(), sourceId:source.id, sourceKind:source.kind, targetId:target.id, targetKind:target.kind, created:(new Date()).toISOString() };
      window.data.crossReferenceConnections.push(existing);
    }
    Object.assign(existing, {
      connectionType: payload.connectionType || existing.connectionType || 'Connected to',
      sourceNote: payload.sourceNote || existing.sourceNote || '',
      targetNote: payload.targetNote || existing.targetNote || '',
      importance: payload.importance || existing.importance || 'Secondary',
      canonStatus: payload.canonStatus || existing.canonStatus || 'Canon',
      updated:(new Date()).toISOString()
    });
    if(typeof window.saveData === 'function') window.saveData(true);
    return existing;
  }

  let modalQueue = [];
  let modalOpen = false;

  function root(){
    let el = document.getElementById('twoSidedCrossRefModalRoot');
    if(!el){ el = document.createElement('div'); el.id='twoSidedCrossRefModalRoot'; document.body.appendChild(el); }
    return el;
  }

  function queueConnectionModal(sourceId, targetId, opts={}){
    if(!sourceId || !targetId || String(sourceId)===String(targetId)) return;
    const source = findEntry(sourceId), target = findEntry(targetId);
    if(!source || !target) return;
    if(connectionExists(source.id, target.id) && !opts.forceEdit) return;
    modalQueue.push({sourceId:source.id, targetId:target.id, opts});
    if(!modalOpen) openNextConnectionModal();
  }

  function openNextConnectionModal(){
    const next = modalQueue.shift();
    if(!next){ modalOpen=false; root().innerHTML=''; return; }
    modalOpen = true;
    const source = findEntry(next.sourceId), target = findEntry(next.targetId);
    if(!source || !target){ openNextConnectionModal(); return; }
    const existing = arr(window.data?.crossReferenceConnections).find(c =>
      (String(c.sourceId)===String(source.id) && String(c.targetId)===String(target.id)) ||
      (String(c.sourceId)===String(target.id) && String(c.targetId)===String(source.id))
    );
    const sourceNote = existing && String(existing.sourceId)===String(source.id) ? existing.sourceNote : (existing?.targetNote || '');
    const targetNote = existing && String(existing.sourceId)===String(source.id) ? existing.targetNote : (existing?.sourceNote || '');
    const isCultureCharacter = (source.kind === 'culture' && target.kind === 'character') || (source.kind === 'character' && target.kind === 'culture');
    const modalTitle = isCultureCharacter ? 'Culture & Character Impact' : 'Link Interaction';
    const modalHelp = isCultureCharacter ? 'Describe how the culture shaped the character and how the character represents, challenges, or changes that culture. This saves to both Encyclopedia pages.' : 'Describe how this connection appears on both Encyclopedia pages.';
    const sourcePlaceholder = isCultureCharacter && source.kind === 'character' ? `How did ${source.title} get shaped by ${target.title}?` : `How does ${source.title} connect to ${target.title}?`;
    const targetPlaceholder = isCultureCharacter && target.kind === 'character' ? `How did ${target.title} get shaped by ${source.title}?` : `How does ${target.title} connect to ${source.title}?`;
    root().innerHTML = `<div class="textarea-modal-backdrop two-sided-ref-backdrop" onclick="if(event.target===this) plotpalsSkipTwoSidedConnection()">
      <div class="textarea-modal two-sided-ref-modal" style="height:auto;max-height:88vh;overflow:auto;">
        <h3>${esc(modalTitle)}</h3>
        <p class="muted">${esc(modalHelp)}</p>
        <div class="two-sided-ref-summary"><strong>${esc(source.title)}</strong><span>↔</span><strong>${esc(target.title)}</strong></div>
        <label>Connection Type
          <select id="twoSidedConnectionType">
            ${['Connected to','Member of','Leader of','Located in','Lives in','Born in','Uses','Created by','Allied with','Opposed to','Worships','Speaks','Part of','Influenced by','Other'].map(v=>`<option ${existing?.connectionType===v?'selected':''}>${esc(v)}</option>`).join('')}
          </select>
        </label>
        <label>${esc(source.title)} side
          <textarea id="twoSidedSourceNote" placeholder="${esc(sourcePlaceholder)}">${esc(sourceNote)}</textarea>
        </label>
        <label>${esc(target.title)} side
          <textarea id="twoSidedTargetNote" placeholder="${esc(targetPlaceholder)}">${esc(targetNote)}</textarea>
        </label>
        <div class="inline-grid compact-fields">
          <label>Importance
            <select id="twoSidedImportance"><option>Major</option><option selected>Secondary</option><option>Minor Background</option></select>
          </label>
          <label>Canon Status
            <select id="twoSidedCanon"><option selected>Canon</option><option>Draft</option><option>Removed</option><option>Possible Future</option></select>
          </label>
        </div>
        <div class="form-actions">
          <button type="button" class="ghost-btn" onclick="plotpalsSkipTwoSidedConnection()">Skip</button>
          <button type="button" class="glow" onclick="plotpalsSaveTwoSidedConnection('${esc(source.id)}','${esc(target.id)}')">Save Link Details</button>
        </div>
      </div>
    </div>`;
  }

  window.plotpalsSkipTwoSidedConnection = function(){ openNextConnectionModal(); };
  window.plotpalsSaveTwoSidedConnection = function(sourceId,targetId){
    saveConnection({
      sourceId, targetId,
      connectionType: document.getElementById('twoSidedConnectionType')?.value || 'Connected to',
      sourceNote: document.getElementById('twoSidedSourceNote')?.value?.trim() || '',
      targetNote: document.getElementById('twoSidedTargetNote')?.value?.trim() || '',
      importance: document.getElementById('twoSidedImportance')?.value || 'Secondary',
      canonStatus: document.getElementById('twoSidedCanon')?.value || 'Canon'
    });
    notify('Two-sided link saved.');
    openNextConnectionModal();
  };
  window.plotpalsOpenTwoSidedConnection = queueConnectionModal;
  window.plotpalsSaveTwoSidedConnectionData = saveConnection;

  function selectedIdsFromCrossRefEditor(){
    return [...document.querySelectorAll('select[id^="wikiCross_"]')].flatMap(sel=>[...sel.selectedOptions].map(o=>o.value).filter(Boolean));
  }

  const originalSaveWikiCrossReferences = window.saveWikiCrossReferences;
  if(typeof originalSaveWikiCrossReferences === 'function' && !originalSaveWikiCrossReferences.__twoSidedWrapped){
    window.saveWikiCrossReferences = function(entryId){
      const sourceId = entryId || window.selectedEncyclopediaEntryId || window.data?.selectedEncyclopediaEntryId;
      const selected = selectedIdsFromCrossRefEditor();
      const result = originalSaveWikiCrossReferences.apply(this, arguments);
      setTimeout(()=> selected.forEach(id=>queueConnectionModal(sourceId,id)), 80);
      return result;
    };
    window.saveWikiCrossReferences.__twoSidedWrapped = true;
  }

  function currentCharacterSourceId(){
    return window.__plotpalsEditing?.character || window.data?.selectedCharacterId || null;
  }

  function optionValues(el){
    if(!el) return [];
    if(el.multiple) return [...el.selectedOptions].map(o=>o.value).filter(Boolean);
    return el.value ? [el.value] : [];
  }

  function linkSelectSourceFromElement(el){
    const id = el?.id || '';
    if(/^editChar|^char/.test(id)) return currentCharacterSourceId();
    const edit = window.__plotpalsEditing || {};
    if(edit.location) return edit.location;
    if(edit.organization) return edit.organization;
    if(edit.magic) return edit.magic;
    if(edit.world?.id) return edit.world.id;
    return window.selectedEncyclopediaEntryId || window.data?.selectedEncyclopediaEntryId || null;
  }

  document.addEventListener('change', function(ev){
    const el = ev.target;
    if(!el || el.tagName !== 'SELECT') return;
    const id = el.id || '';
    const looksLikeLink = /Birthplace|Languages|Species|Characters|Locations|Organizations|Events|Items|Artifacts|Religion|Culture|Government|Magic/i.test(id) || el.multiple;
    if(!looksLikeLink) return;
    const sourceId = linkSelectSourceFromElement(el);
    if(!sourceId) return;
    optionValues(el).forEach(targetId=>queueConnectionModal(sourceId,targetId));
  }, true);

  function collectLinkSelectionsFromForm(prefixes){
    const selectors = prefixes.map(p=>`select[id^="${p}"]`).join(',');
    return [...document.querySelectorAll(selectors)].flatMap(optionValues).filter(Boolean);
  }

  function wrapCreateFunction(fnName, sourceCollection, prefixes){
    const original = window[fnName];
    if(typeof original !== 'function' || original.__twoSidedWrapped) return;
    window[fnName] = function(){
      const before = new Set(arr(window.data?.[sourceCollection]).map(x=>String(x.id)));
      const selectedTargets = collectLinkSelectionsFromForm(prefixes);
      const result = original.apply(this, arguments);
      setTimeout(()=>{
        const created = arr(window.data?.[sourceCollection]).find(x=>!before.has(String(x.id)));
        if(created) selectedTargets.forEach(id=>queueConnectionModal(created.id,id));
      }, 150);
      return result;
    };
    window[fnName].__twoSidedWrapped = true;
  }

  wrapCreateFunction('addCharacter','characters',['char']);
  wrapCreateFunction('addLocation','locations',['location']);
  wrapCreateFunction('addOrganization','organizations',['org']);
  wrapCreateFunction('addMagic','magicSystems',['magic']);

  function connectionRowsFor(entryId){
    return arr(window.data?.crossReferenceConnections).filter(c=>String(c.sourceId)===String(entryId)||String(c.targetId)===String(entryId));
  }

  function renderConnectionRows(entryId){
    const rows = connectionRowsFor(entryId);
    if(!rows.length) return '';
    return `<section class="character-section encyclopedia-section two-sided-connection-section"><h3>Connection Notes</h3>
      <div class="two-sided-connection-list">${rows.map(c=>{
        const isSource = String(c.sourceId)===String(entryId);
        const other = findEntry(isSource?c.targetId:c.sourceId);
        const note = isSource ? c.sourceNote : c.targetNote;
        const otherNote = isSource ? c.targetNote : c.sourceNote;
        return `<article class="source-hit-card two-sided-connection-card">
          <div class="card-header compact-card-header"><div><strong>${esc(other?.title || 'Linked Entry')}</strong><p class="muted small-text">${esc(c.connectionType || 'Connected to')} • ${esc(c.importance || 'Secondary')} • ${esc(c.canonStatus || 'Canon')}</p></div>${other?`<button type="button" class="ghost-btn tiny-btn" onclick="openEncyclopediaEntry('${esc(other.id)}')">Open</button>`:''}</div>
          ${note?`<p><b>This page:</b> ${esc(note)}</p>`:''}
          ${otherNote?`<p class="muted"><b>${esc(other?.title || 'Other side')}:</b> ${esc(otherNote)}</p>`:''}
          <button type="button" class="ghost-btn tiny-btn" onclick="plotpalsOpenTwoSidedConnection('${esc(entryId)}','${esc(other?.id || '')}',{forceEdit:true})">Edit Link Details</button>
        </article>`;
      }).join('')}</div></section>`;
  }

  function injectConnectionNotes(){
    const entryId = window.selectedEncyclopediaEntryId || window.data?.selectedEncyclopediaEntryId;
    const content = document.getElementById('encyclopediaContent');
    if(!entryId || !content) return;
    content.querySelectorAll('.two-sided-connection-section').forEach(el=>el.remove());
    const html = renderConnectionRows(entryId);
    if(!html) return;
    const main = content.querySelector('.wiki-article-main') || content.querySelector('[data-wiki-internal-id]') || content;
    const related = [...main.querySelectorAll('.encyclopedia-section h3')].find(h=>/Related Entries/i.test(h.textContent||''))?.closest('.encyclopedia-section');
    if(related) related.insertAdjacentHTML('afterend', html); else main.insertAdjacentHTML('beforeend', html);
  }

  const originalRenderEncyclopedia = window.renderEncyclopedia;
  if(typeof originalRenderEncyclopedia === 'function' && !originalRenderEncyclopedia.__twoSidedWrapped){
    window.renderEncyclopedia = function(){
      const result = originalRenderEncyclopedia.apply(this, arguments);
      setTimeout(injectConnectionNotes, 90);
      return result;
    };
    window.renderEncyclopedia.__twoSidedWrapped = true;
  }
  const originalRenderAll = window.renderAll;
  if(typeof originalRenderAll === 'function' && !originalRenderAll.__twoSidedWrapped){
    window.renderAll = function(){
      const result = originalRenderAll.apply(this, arguments);
      setTimeout(injectConnectionNotes, 120);
      return result;
    };
    window.renderAll.__twoSidedWrapped = true;
  }

  const style = document.createElement('style');
  style.textContent = `
    .two-sided-ref-summary{display:flex;align-items:center;gap:.75rem;justify-content:center;margin:.75rem 0 1rem;padding:.7rem;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.04);}
    .two-sided-ref-modal label{display:flex;flex-direction:column;gap:.35rem;margin:.7rem 0;font-weight:800;color:var(--muted,#cab8d6);}
    .two-sided-ref-modal textarea{min-height:120px;width:100%;}
    .two-sided-connection-list{display:grid;gap:.75rem;}
    .two-sided-connection-card p{white-space:pre-wrap;line-height:1.5;}
    @media(max-width:760px){.two-sided-ref-summary{flex-direction:column;}.two-sided-ref-modal textarea{min-height:150px;}}
  `;
  document.head.appendChild(style);

  setTimeout(injectConnectionNotes, 500);
})();


/* ===== linked-trackers-config.js ===== */
(function(){
  if(window.__plotpalsLinkedTrackerConfigV1) return;
  window.__plotpalsLinkedTrackerConfigV1 = true;

  const arr = (v)=>Array.isArray(v)?v:[];
  const esc = (v)=>String(v ?? '').replace(/[&<>'"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const notify = (msg)=> window.showStatus ? window.showStatus(msg) : console.log(msg);

  const CATEGORY_TRACKERS = {
    'Organizations': ['Characters','Locations','Magic Systems','Governments','Historical Events','Other'],
    'Religions': ['Characters','Locations','Governments','Other'],
    'Races/Species': ['Locations','Historical Events','Languages','Other'],
    'Races': ['Locations','Historical Events','Languages','Other'],
    'Race/Species': ['Locations','Historical Events','Languages','Other'],
    'Magic Systems': ['Characters','Organizations','Items/Artifacts','Other'],
    'Governments': ['Characters','Locations','Organizations','Religions','Governments','Historical Events','Cultures','Languages','Other'],
    'Historical Events': ['Characters','Locations','Organizations','Race/Species','Governments','Cultures','Other'],
    'Cultures': ['Characters','Locations','Race/Species','Governments','Historical Events','Other'],
    'Items/Artifacts': ['Characters','Locations','Magic Systems','Other'],
    'Items / Artifacts': ['Characters','Locations','Magic Systems','Other'],
    'Languages': ['Locations','Race/Species','Governments','Other'],
    'Flora & Fauna': ['Locations','Race/Species','Other'],
    'Other': ['Characters','Locations','Organizations','Other']
  };

  const STANDALONE_TRACKERS = {
    organizationAddForm: { prefix:'orgLink', title:'Organization Linked Trackers', trackers:CATEGORY_TRACKERS.Organizations },
    magicAddForm: { prefix:'magicLink', title:'Magic System Linked Trackers', trackers:CATEGORY_TRACKERS['Magic Systems'] }
  };

  function normCategory(v){
    const raw = String(v || '').trim();
    const lower = raw.toLowerCase().replace(/[_-]+/g,' ').replace(/\s*&\s*/g,' & ').replace(/\s*\/\s*/g,'/').replace(/\s+/g,' ');
    const aliases = {
      'organizations':'Organizations', 'organization':'Organizations',
      'religions':'Religions', 'religion':'Religions',
      'races/species':'Races/Species', 'race/species':'Races/Species', 'race species':'Races/Species', 'races species':'Races/Species', 'species':'Races/Species',
      'magic systems':'Magic Systems', 'magic system':'Magic Systems', 'magic':'Magic Systems',
      'governments':'Governments', 'government':'Governments',
      'historical events':'Historical Events', 'historical event':'Historical Events', 'events':'Historical Events',
      'cultures':'Cultures', 'culture':'Cultures',
      'items/artifacts':'Items/Artifacts', 'items / artifacts':'Items/Artifacts', 'items artifacts':'Items/Artifacts', 'artifacts':'Items/Artifacts', 'items':'Items/Artifacts',
      'languages':'Languages', 'language':'Languages',
      'flora & fauna':'Flora & Fauna', 'flora fauna':'Flora & Fauna', 'flora':'Flora & Fauna', 'fauna':'Flora & Fauna',
      'other':'Other'
    };
    return aliases[lower] || raw || 'Other';
  }

  function titleOf(item){ return item?.name || item?.title || item?.event || item?.when || 'Untitled'; }
  function sameProject(item){
    const d = window.data || {};
    return !item || !d.activeSeriesId || !item.seriesId || item.seriesId === d.activeSeriesId;
  }

  function worldItemsByCategory(label){
    const cat = normCategory(label);
    return arr(window.data?.world).filter(w=>sameProject(w) && normCategory(w.category || w.categoryKey || w.type) === cat);
  }

  function optionsForTracker(label){
    const d = window.data || {};
    let items = [];
    switch(normCategory(label)){
      case 'Characters': items = arr(d.characters).filter(sameProject); break;
      case 'Locations': items = arr(d.locations).filter(sameProject).concat(worldItemsByCategory('Locations')); break;
      case 'Organizations': items = arr(d.organizations).filter(sameProject).concat(worldItemsByCategory('Organizations')); break;
      case 'Magic Systems': items = arr(d.magicSystems).filter(sameProject).concat(worldItemsByCategory('Magic Systems')); break;
      case 'Religions': items = worldItemsByCategory('Religions'); break;
      case 'Governments': items = worldItemsByCategory('Governments'); break;
      case 'Historical Events': items = arr(d.timeline).filter(sameProject).concat(worldItemsByCategory('Historical Events')); break;
      case 'Cultures': items = worldItemsByCategory('Cultures'); break;
      case 'Races/Species': items = worldItemsByCategory('Races/Species'); break;
      case 'Items/Artifacts': items = worldItemsByCategory('Items/Artifacts'); break;
      case 'Languages': items = worldItemsByCategory('Languages'); break;
      case 'Flora & Fauna': items = worldItemsByCategory('Flora & Fauna'); break;
      case 'Other': items = worldItemsByCategory('Other'); break;
      default: items = worldItemsByCategory(label); break;
    }
    const seen = new Set();
    return items.filter(item=>item?.id && !seen.has(String(item.id)) && seen.add(String(item.id)));
  }

  function fieldHtml(prefix, label){
    const id = `${prefix}${normCategory(label).replace(/[^A-Za-z0-9]+/g,'')}`;
    const items = optionsForTracker(label);
    const pretty = label === 'Race/Species' ? 'Race/Species' : label;
    return `<label class="linked-tracker-field linked-tracker-${esc(normCategory(label).toLowerCase().replace(/[^a-z0-9]+/g,'-'))}">
      <span>${esc(pretty)}</span>
      <select id="${esc(id)}" class="linked-tracker-select" multiple size="${Math.min(5, Math.max(3, items.length || 3))}" data-linked-tracker="${esc(normCategory(label))}">
        ${items.length ? items.map(item=>`<option value="${esc(item.id)}">${esc(titleOf(item))}</option>`).join('') : `<option value="" disabled>No ${esc(pretty)} entries yet</option>`}
      </select>
    </label>`;
  }

  function panelHtml(title, prefix, trackers, note=''){
    const clean = arr(trackers).filter(Boolean);
    return `<div class="custom-section-builder linked-tracker-panel" data-linked-tracker-panel="${esc(prefix)}">
      <h4>${esc(title)}</h4>
      ${note ? `<p class="muted small-text">${esc(note)}</p>` : `<p class="muted small-text">Select linked entries to create two-sided Encyclopedia connection notes.</p>`}
      <div class="linked-tracker-grid">${clean.map(label=>fieldHtml(prefix, label)).join('')}</div>
    </div>`;
  }

  function injectStandaloneTrackers(){
    Object.entries(STANDALONE_TRACKERS).forEach(([formId,cfg])=>{
      const form = document.getElementById(formId);
      if(!form || form.querySelector(`[data-linked-tracker-panel="${cfg.prefix}"]`)) return;
      const grid = form.querySelector('.form-grid') || form;
      grid.insertAdjacentHTML('beforeend', panelHtml(cfg.title, cfg.prefix, cfg.trackers));
    });
  }

  function activeWorldCategory(){
    const custom = document.getElementById('worldCustomCategory')?.value?.trim();
    const select = document.getElementById('worldCategory');
    const selectedText = select?.selectedOptions?.[0]?.textContent || select?.value || '';
    return normCategory(custom || selectedText);
  }

  function renderWorldLinkedTrackers(){
    const form = document.getElementById('worldAddForm');
    if(!form) return;
    const grid = form.querySelector('.form-grid') || form;
    grid.querySelectorAll('[data-linked-tracker-panel="worldLink"]').forEach(el=>el.remove());
    const cat = activeWorldCategory();
    const trackers = CATEGORY_TRACKERS[cat] || CATEGORY_TRACKERS[normCategory(cat)] || CATEGORY_TRACKERS.Other;
    const isCulture = normCategory(cat) === 'Cultures';
    const note = isCulture
      ? 'For Characters, the link details form asks how this culture shaped the character and saves that note to both Encyclopedia pages.'
      : 'Select linked entries to create two-sided Encyclopedia connection notes.';
    grid.insertAdjacentHTML('beforeend', panelHtml(`${cat} Linked Trackers`, 'worldLink', trackers, note));
  }

  function selectedTrackerTargets(){
    return [...document.querySelectorAll('.linked-tracker-select')]
      .flatMap(sel=>[...sel.selectedOptions].map(o=>o.value).filter(Boolean));
  }

  function wrapAddWorld(){
    const original = window.addWorld;
    if(typeof original !== 'function' || original.__linkedTrackerWrapped) return;
    window.addWorld = function(){
      const before = new Set(arr(window.data?.world).map(x=>String(x.id)));
      const selected = selectedTrackerTargets();
      const result = original.apply(this, arguments);
      setTimeout(()=>{
        const created = arr(window.data?.world).find(x=>!before.has(String(x.id)));
        if(created && selected.length){
          selected.forEach(id=>{
            if(typeof window.plotpalsOpenTwoSidedConnection === 'function') window.plotpalsOpenTwoSidedConnection(created.id, id);
          });
        }
      }, 180);
      return result;
    };
    window.addWorld.__linkedTrackerWrapped = true;
  }


  function applyCreatorTrackerConfigOverrides(){
    const cfg = window.WORLD_CREATOR_TRACKER_CONFIG;
    if(!cfg || typeof cfg !== 'object') return;
    cfg.organizations = ['characterIds','locationIds','magicSystemIds','governmentIds','historicalEventIds','otherWorldIds'];
    cfg.religions = ['characterIds','locationIds','governmentIds','otherWorldIds'];
    cfg['races-species'] = ['locationIds','historicalEventIds','languageIds','otherWorldIds'];
    cfg['race-species'] = ['locationIds','historicalEventIds','languageIds','otherWorldIds'];
    cfg['magic-systems'] = ['characterIds','organizationIds','itemArtifactIds','otherWorldIds'];
    cfg.governments = ['characterIds','locationIds','organizationIds','religionIds','governmentIds','historicalEventIds','cultureIds','languageIds','otherWorldIds'];
    cfg['historical-events'] = ['characterIds','locationIds','organizationIds','raceSpeciesIds','governmentIds','cultureIds','otherWorldIds'];
    cfg.cultures = ['characterIds','locationIds','raceSpeciesIds','governmentIds','historicalEventIds','otherWorldIds'];
    cfg['items-artifacts'] = ['characterIds','locationIds','magicSystemIds','otherWorldIds'];
    cfg.languages = ['locationIds','raceSpeciesIds','governmentIds','otherWorldIds'];
  }

  function refreshLinkedTrackers(){
    applyCreatorTrackerConfigOverrides();
    injectStandaloneTrackers();
    renderWorldLinkedTrackers();
    wrapAddWorld();
  }

  document.addEventListener('change', function(ev){
    if(ev.target?.id === 'worldCategory') setTimeout(renderWorldLinkedTrackers, 30);
    if(ev.target?.id === 'worldCustomCategory') setTimeout(renderWorldLinkedTrackers, 30);
  }, true);
  document.addEventListener('input', function(ev){
    if(ev.target?.id === 'worldCustomCategory') setTimeout(renderWorldLinkedTrackers, 120);
  }, true);

  const oldRenderAll = window.renderAll;
  if(typeof oldRenderAll === 'function' && !oldRenderAll.__linkedTrackerWrapped){
    window.renderAll = function(){
      const result = oldRenderAll.apply(this, arguments);
      setTimeout(refreshLinkedTrackers, 120);
      return result;
    };
    window.renderAll.__linkedTrackerWrapped = true;
  }

  window.plotpalsRefreshLinkedTrackers = refreshLinkedTrackers;
  document.addEventListener('DOMContentLoaded', ()=>setTimeout(refreshLinkedTrackers, 300));
  setTimeout(refreshLinkedTrackers, 900);

  const style = document.createElement('style');
  style.textContent = `
    .linked-tracker-panel{grid-column:1/-1;margin-top:.5rem;border:1px solid rgba(250,204,21,.18);background:rgba(255,255,255,.035);}
    .linked-tracker-panel h4{margin:.1rem 0 .25rem;color:var(--gold,#facc15);}
    .linked-tracker-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem;margin-top:.75rem;}
    .linked-tracker-field{display:flex;flex-direction:column;gap:.35rem;font-weight:800;color:var(--muted,#cab8d6);}
    .linked-tracker-field select{width:100%;min-width:0;min-height:8.5rem;}
    @media(max-width:820px){.linked-tracker-grid{grid-template-columns:1fr}.linked-tracker-field select{min-height:9.5rem;}}
  `;
  document.head.appendChild(style);
})();


/* ===== historical-events-timeline-bridge.js ===== */
(function(){
  const g = window;
  if (g.__plotpalsHistoricalTimelineBridge) return;
  g.__plotpalsHistoricalTimelineBridge = true;

  const arr = v => Array.isArray(v) ? v : [];
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const id = () => (typeof g.uid === 'function' ? g.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const val = fieldId => (document.getElementById(fieldId)?.value || '').trim();
  const selected = fieldId => [...(document.getElementById(fieldId)?.selectedOptions || [])].map(o => o.value).filter(Boolean);
  const categoryOf = item => (typeof g.canonicalWorldCategory === 'function' ? g.canonicalWorldCategory(item?.category || '') : String(item?.category||'').toLowerCase());
  const isHistorical = item => categoryOf(item) === 'historical-events';

  const EVENT_TYPES = ['Birth','Death','War','Discovery','Betrayal','Marriage','Transformation','Disappearance','Reunion','Founding','Collapse','Travel','Political Event','Cultural Event','Battle','Treaty','Prophecy','Other'];
  const IMPORTANCE = ['Major','Secondary','Minor Background'];
  const LORE = ['Critical Lore','Important Lore','Minor Lore','Flavor Lore'];
  const CANON = ['Canon','Draft','Removed','Possible Future'];
  const ENTRY_TYPES = ['Historical Event','Timeline Event','Backstory Event','Plot Event','World Event'];
  const DATE_TYPES = ['Relative Date','Exact Date','Era / Approximate','Unknown'];
  const UNITS = ['years','months','weeks','days','hours'];
  const DIRECTIONS = ['before','after'];

  function optionList(values, current=''){
    return values.map(v => `<option value="${esc(v)}" ${String(v)===String(current)?'selected':''}>${esc(v)}</option>`).join('');
  }

  function entityOptions(list, labelKey='name'){
    return arr(list).map(item => `<option value="${esc(item.id)}">${esc(item[labelKey] || item.name || item.title || 'Untitled')}</option>`).join('');
  }

  function timelineEventOptions(){
    return arr(g.data?.timeline).map(ev => `<option value="${esc(ev.id)}">${esc(ev.title || ev.event || ev.name || 'Untitled Event')}</option>`).join('');
  }

  function itemArtifactOptions(){
    return arr(g.data?.world).filter(w => categoryOf(w)==='items-artifacts').map(item => `<option value="${esc(item.id)}">${esc(item.name || 'Untitled Item')}</option>`).join('');
  }

  function injectHistoricalTimelineFields(){
    const form = document.getElementById('worldCategoryAddForm_historical-events');
    if (!form || form.querySelector('#historicalTimelineBridgeFields')) return;
    const grid = form.querySelector('.form-grid') || form;
    const fields = document.createElement('div');
    fields.id = 'historicalTimelineBridgeFields';
    fields.className = 'historical-timeline-bridge full-span';
    fields.innerHTML = `
      <div class="timeline-bridge-heading">
        <h4>⏳ Timeline Intelligence</h4>
        <p class="muted">Uses the same synced timeline system as Encyclopedia and Story Timeline. Saving this Historical Event creates or updates the matching shared timeline event.</p>
      </div>
      <div class="timeline-bridge-grid">
        <label>Event Type
          <select id="histTimelineEventType">${optionList(EVENT_TYPES)}</select>
        </label>
        <label>Importance
          <select id="histTimelineImportance">${optionList(IMPORTANCE)}</select>
        </label>
        <label>Date Type
          <select id="histTimelineDateType" onchange="window.updateHistoricalTimelineDateMode?.()">${optionList(DATE_TYPES)}</select>
        </label>
        <label class="hist-exact-date-field">Exact Date / Year
          <input id="histTimelineExactDate" placeholder="Ex. 1892, Year 342, Oct 12" />
        </label>
        <label class="hist-relative-date-field">Reference Event
          <select id="histTimelineReferenceEvent"><option value="">Story Start / Project Start</option>${timelineEventOptions()}</select>
        </label>
        <label class="hist-relative-date-field">Offset Value
          <input id="histTimelineOffsetValue" type="number" placeholder="0" />
        </label>
        <label class="hist-relative-date-field">Offset Unit
          <select id="histTimelineOffsetUnit">${optionList(UNITS)}</select>
        </label>
        <label class="hist-relative-date-field">Before / After
          <select id="histTimelineDirection">${optionList(DIRECTIONS)}</select>
        </label>
      </div>
      <div class="timeline-bridge-heading subheading">
        <h4>📖 Wiki Data</h4>
      </div>
      <div class="timeline-bridge-grid">
        <label>Lore Importance
          <select id="histTimelineLoreImportance">${optionList(LORE)}</select>
        </label>
        <label>Canon Status
          <select id="histTimelineCanonStatus">${optionList(CANON)}</select>
        </label>
        <label>Entry Type
          <select id="histTimelineEntryType">${optionList(ENTRY_TYPES, 'Historical Event')}</select>
        </label>
        <label>Tags
          <input id="histTimelineWikiTags" placeholder="Tags, comma separated" />
        </label>
      </div>
      <div class="timeline-bridge-notes">
        <label>What Happens
          <textarea id="histTimelineWhatHappens" placeholder="Describe the event itself."></textarea>
        </label>
        <label>Why It Matters / Consequences
          <textarea id="histTimelineWhyMatters" placeholder="Explain the aftermath, changes, scars, or current relevance."></textarea>
        </label>
      </div>
      <details class="timeline-bridge-links">
        <summary>Timeline Participants & Linked Entries</summary>
        <div class="timeline-bridge-grid">
          <label>Participants
            <select id="histTimelineParticipants" multiple size="5">${entityOptions(g.data?.characters)}</select>
          </label>
          <label>Locations
            <select id="histTimelineLocations" multiple size="5">${entityOptions(g.data?.locations)}</select>
          </label>
          <label>Organizations
            <select id="histTimelineOrganizations" multiple size="5">${entityOptions(g.data?.organizations)}</select>
          </label>
          <label>Items / Artifacts
            <select id="histTimelineItems" multiple size="5">${itemArtifactOptions()}</select>
          </label>
        </div>
      </details>
    `;
    // Place Timeline Intelligence directly under the Historical Event image upload area.
    // The old event info/summary/participants/consequences fields are removed below
    // because Timeline Intelligence + Linked Trackers now own that data.
    const uploadAnchor = findHistoricalImageUploadAnchor(form);
    if (uploadAnchor && uploadAnchor.parentNode) {
      uploadAnchor.insertAdjacentElement('afterend', fields);
    } else {
      const custom = grid.querySelector('.custom-section-builder');
      if (custom) grid.insertBefore(fields, custom);
      else grid.appendChild(fields);
    }
    removeHistoricalDuplicateFields(form);
    updateHistoricalTimelineDateMode();
  }

  function textOf(el){ return String(el?.textContent || el?.getAttribute?.('placeholder') || el?.getAttribute?.('aria-label') || '').replace(/\s+/g,' ').trim(); }

  function findHistoricalImageUploadAnchor(form){
    const needles = [/upload historical event image/i, /historical event image/i, /change historical event image/i, /upload image/i];
    const nodes = [...form.querySelectorAll('button,label,input,div,section,article,fieldset')];
    const hit = nodes.find(el => needles.some(rx => rx.test(textOf(el)) || rx.test(el.placeholder || '') || rx.test(el.value || '')));
    if (!hit) return null;
    return hit.closest('.full-span,.form-section,.creator-section,.form-card,.field-card,fieldset,label,div') || hit;
  }

  function removeHistoricalDuplicateFields(form){
    if (!form) return;
    const duplicateHeadings = [
      /^(event information|event info)$/i,
      /^summary$/i,
      /^(major figures\/?participants|major figures|participants)$/i,
      /^(consequences\/?modern impact|consequences|modern impact)$/i
    ];
    const duplicatePlaceholders = [
      /event notes\s*\/?\s*participation impact/i,
      /event information/i,
      /event summary/i,
      /^summary$/i,
      /major figures/i,
      /participants/i,
      /consequences/i,
      /modern impact/i
    ];
    const protectedRx = /(Timeline Intelligence|Timeline Link|Linked Trackers|Link Tracker|Upload Historical Event Image|historicalTimelineBridgeFields)/i;
    const pickContainer = el => {
      const candidates = ['section','fieldset','details','.form-section','.creator-section','.form-card','.field-card','.full-span','.custom-section-block','label'];
      for (const sel of candidates){
        const c = el.closest(sel);
        if (c && c !== form && !protectedRx.test(textOf(c)) && !c.querySelector?.('#historicalTimelineBridgeFields')) return c;
      }
      return el !== form && !protectedRx.test(textOf(el)) ? el : null;
    };
    [...form.querySelectorAll('h2,h3,h4,h5,legend,summary,.section-title,.form-section-title,label')].forEach(el => {
      const own = textOf(el);
      if (protectedRx.test(own)) return;
      if (duplicateHeadings.some(rx => rx.test(own))) {
        const c = pickContainer(el);
        if (c) c.remove();
      }
    });
    [...form.querySelectorAll('textarea,input')].forEach(el => {
      const txt = String(el.placeholder || el.name || el.id || '').trim();
      if (!txt || protectedRx.test(txt)) return;
      if (duplicatePlaceholders.some(rx => rx.test(txt))) {
        const c = pickContainer(el);
        if (c) c.remove();
      }
    });
  }

  g.updateHistoricalTimelineDateMode = function(){
    const mode = val('histTimelineDateType') || 'Relative Date';
    const isRelative = mode === 'Relative Date';
    document.querySelectorAll('.hist-relative-date-field').forEach(el => el.style.display = isRelative ? '' : 'none');
    document.querySelectorAll('.hist-exact-date-field').forEach(el => el.style.display = mode === 'Unknown' ? 'none' : '');
  };

  function readHistoricalTimelineDraft(){
    return {
      eventType: val('histTimelineEventType'),
      importance: val('histTimelineImportance'),
      dateType: val('histTimelineDateType'),
      exactDate: val('histTimelineExactDate'),
      referenceEventId: val('histTimelineReferenceEvent'),
      offsetValue: val('histTimelineOffsetValue'),
      offsetUnit: val('histTimelineOffsetUnit'),
      offsetDirection: val('histTimelineDirection'),
      loreImportance: val('histTimelineLoreImportance'),
      canonStatus: val('histTimelineCanonStatus'),
      entryType: val('histTimelineEntryType'),
      wikiTags: val('histTimelineWikiTags'),
      whatHappens: val('histTimelineWhatHappens'),
      whyMatters: val('histTimelineWhyMatters'),
      participantIds: selected('histTimelineParticipants'),
      locationIds: selected('histTimelineLocations'),
      organizationIds: selected('histTimelineOrganizations'),
      itemIds: selected('histTimelineItems')
    };
  }

  let pendingHistoricalTimelineDraft = null;
  function applyDraftToHistoricalItem(item, draft){
    if (!item || !draft) return;
    Object.assign(item, {
      eventType: draft.eventType || item.eventType || '',
      importance: draft.importance || item.importance || '',
      dateType: draft.dateType || item.dateType || '',
      exactDate: draft.exactDate || item.exactDate || '',
      referenceEventId: draft.referenceEventId || item.referenceEventId || '',
      offsetValue: draft.offsetValue || item.offsetValue || '',
      offsetUnit: draft.offsetUnit || item.offsetUnit || '',
      offsetDirection: draft.offsetDirection || item.offsetDirection || '',
      loreImportance: draft.loreImportance || item.loreImportance || '',
      canonStatus: draft.canonStatus || item.canonStatus || '',
      entryType: draft.entryType || item.entryType || 'Historical Event',
      wikiTags: draft.wikiTags || item.wikiTags || '',
      whatHappens: draft.whatHappens || item.whatHappens || item.description || '',
      whyMatters: draft.whyMatters || item.whyMatters || item.rules || '',
      participantIds: draft.participantIds?.length ? draft.participantIds : arr(item.participantIds),
      locationIds: draft.locationIds?.length ? draft.locationIds : arr(item.locationIds),
      organizationIds: draft.organizationIds?.length ? draft.organizationIds : arr(item.organizationIds),
      itemIds: draft.itemIds?.length ? draft.itemIds : arr(item.itemIds)
    });
  }

  function timelinePayloadFromHistorical(item){
    const title = item.name || item.title || 'Untitled Historical Event';
    const when = item.exactDate || item.basicInfo || item.when || '';
    return {
      title,
      event: title,
      name: title,
      when,
      dateType: item.dateType || '',
      exactDate: item.exactDate || '',
      relativeEventId: item.referenceEventId || '',
      offsetValue: item.offsetValue || '',
      offsetUnit: item.offsetUnit || '',
      offsetDirection: item.offsetDirection || '',
      eventType: item.eventType || '',
      importance: item.importance || '',
      loreImportance: item.loreImportance || '',
      canonStatus: item.canonStatus || '',
      entryType: item.entryType || 'Historical Event',
      wikiTags: item.wikiTags || '',
      tags: item.wikiTags || item.tags || '',
      whatHappens: item.whatHappens || item.description || '',
      whyMatters: item.whyMatters || item.rules || item.plotRelevance || '',
      impact: item.whyMatters || item.rules || item.plotRelevance || '',
      participantIds: arr(item.participantIds),
      locationIds: arr(item.locationIds),
      organizationIds: arr(item.organizationIds),
      itemIds: arr(item.itemIds),
      relatedCharacters: arr(item.participantIds),
      relatedLocations: arr(item.locationIds),
      relatedOrganizations: arr(item.organizationIds),
      relatedItems: arr(item.itemIds),
      sourceType: 'historical-event',
      historicalEventId: item.id,
      worldEntryId: item.id,
      category: 'Historical Events'
    };
  }

  function syncHistoricalEventsToTimeline(renderAfter=false){
    if (!g.data) return false;
    g.data.world = arr(g.data.world);
    g.data.timeline = arr(g.data.timeline);
    let changed = false;
    const historical = g.data.world.filter(isHistorical);
    historical.forEach(item => {
      if (pendingHistoricalTimelineDraft && !item.__timelineDraftApplied && (!item.timelineEventId || Date.now() - Date.parse(item.created || 0) < 10000)) {
        applyDraftToHistoricalItem(item, pendingHistoricalTimelineDraft);
        item.__timelineDraftApplied = true;
        changed = true;
      }
      const payload = timelinePayloadFromHistorical(item);
      let ev = item.timelineEventId ? g.data.timeline.find(e => e.id === item.timelineEventId) : null;
      if (!ev) ev = g.data.timeline.find(e => e.historicalEventId === item.id || e.worldEntryId === item.id);
      if (ev) {
        Object.assign(ev, payload, { id: ev.id, updated: new Date().toISOString() });
        if (item.timelineEventId !== ev.id) { item.timelineEventId = ev.id; changed = true; }
      } else {
        ev = { id: id(), ...payload, created: new Date().toISOString() };
        g.data.timeline.push(ev);
        item.timelineEventId = ev.id;
        changed = true;
      }
    });
    if (changed && typeof g.saveData === 'function') g.saveData(!!renderAfter);
    return changed;
  }
  g.syncHistoricalEventsToTimeline = syncHistoricalEventsToTimeline;

  const originalRenderWorldCategoryPage = g.renderWorldCategoryPage;
  if (typeof originalRenderWorldCategoryPage === 'function' && !originalRenderWorldCategoryPage.__historicalTimelineBridge) {
    const wrapped = function(){
      const result = originalRenderWorldCategoryPage.apply(this, arguments);
      setTimeout(() => { injectHistoricalTimelineFields(); removeHistoricalDuplicateFields(document.getElementById('worldCategoryAddForm_historical-events')); }, 0);
      return result;
    };
    wrapped.__historicalTimelineBridge = true;
    g.renderWorldCategoryPage = wrapped;
  }

  const originalAddWorldFromCurrentCategory = g.addWorldFromCurrentCategory;
  if (typeof originalAddWorldFromCurrentCategory === 'function' && !originalAddWorldFromCurrentCategory.__historicalTimelineBridge) {
    const wrapped = function(){
      const category = typeof g.canonicalWorldCategory === 'function' ? g.canonicalWorldCategory(g.data?.selectedWorldCategory || 'other') : '';
      if (category === 'historical-events') pendingHistoricalTimelineDraft = readHistoricalTimelineDraft();
      const result = originalAddWorldFromCurrentCategory.apply(this, arguments);
      if (category === 'historical-events') {
        [80, 600, 1600, 3200].forEach(delay => setTimeout(() => syncHistoricalEventsToTimeline(true), delay));
      }
      return result;
    };
    wrapped.__historicalTimelineBridge = true;
    g.addWorldFromCurrentCategory = wrapped;
  }

  const originalSaveData = g.saveData;
  if (typeof originalSaveData === 'function' && !originalSaveData.__historicalTimelineBridge) {
    const wrappedSave = function(render=true, cloud=true){
      if (!g.__historicalTimelineSyncing) {
        try { g.__historicalTimelineSyncing = true; syncHistoricalEventsToTimeline(false); }
        finally { g.__historicalTimelineSyncing = false; }
      }
      return originalSaveData.apply(this, arguments);
    };
    wrappedSave.__historicalTimelineBridge = true;
    g.saveData = wrappedSave;
  }

  const style = document.createElement('style');
  style.textContent = `
    .historical-timeline-bridge{grid-column:1/-1;border:1px solid rgba(250,204,21,.2);border-radius:18px;padding:1rem;background:rgba(250,204,21,.045);margin:.75rem 0 1rem;}
    .timeline-bridge-heading h4{margin:0 0 .25rem;font-size:1rem;}
    .timeline-bridge-heading p{margin:.15rem 0 .8rem;}
    .timeline-bridge-heading.subheading{margin-top:1rem;}
    .timeline-bridge-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.7rem;margin:.75rem 0;}
    .timeline-bridge-grid label,.timeline-bridge-notes label{display:flex;flex-direction:column;gap:.35rem;font-weight:800;color:var(--muted,#c9b5cc);}
    .timeline-bridge-grid input,.timeline-bridge-grid select,.timeline-bridge-notes textarea{min-width:0;width:100%;}
    .timeline-bridge-notes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem;margin:.75rem 0;}
    .timeline-bridge-notes textarea{min-height:140px;}
    .timeline-bridge-links{margin-top:.8rem;}
    @media(max-width:900px){.timeline-bridge-grid{grid-template-columns:repeat(2,minmax(0,1fr));}.timeline-bridge-notes{grid-template-columns:1fr;}}
    @media(max-width:560px){.timeline-bridge-grid{grid-template-columns:1fr;}}
  `;
  document.head.appendChild(style);

  setTimeout(() => { injectHistoricalTimelineFields(); syncHistoricalEventsToTimeline(false); }, 600);
})();


  /* Location creator cleanup: population is only size/count; culture/residents are handled by Link Trackers. */
  (function(){
    const originalLocationAdd = window.addLocation;
    if(typeof originalLocationAdd === 'function' && !originalLocationAdd.__locationCreatorCleaned){
      const cleaned = function(){
        const hiddenCulture=document.getElementById('locationCulture');
        if(hiddenCulture) hiddenCulture.value='';
        return originalLocationAdd.apply(this, arguments);
      };
      cleaned.__locationCreatorCleaned=true;
      window.addLocation = cleaned;
    }
  })();


/* ===== organization-creator-cleanup.js ===== */
(function(){
  if(window.__plotpalsOrganizationCreatorCleanup) return;
  window.__plotpalsOrganizationCreatorCleanup = true;
  const ORG_TYPES = ['Government','Guild','Religion','Military','Cult','Circus / Troupe','Royal House','Criminal Group','School','Business','Rebellion','Other'];
  function esc(v){return String(v ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function options(current=''){
    return '<option value="">Organization type</option>' + ORG_TYPES.map(v=>`<option value="${esc(v)}"${String(current||'')===v?' selected':''}>${esc(v)}</option>`).join('');
  }
  function cleanOrganizationForm(){
    const memberBox = document.getElementById('orgMembers');
    if(memberBox) memberBox.remove();
    const typeField = document.getElementById('orgType');
    if(typeField && typeField.tagName !== 'SELECT'){
      const select = document.createElement('select');
      select.id = 'orgType';
      select.className = typeField.className || '';
      select.innerHTML = options(typeField.value);
      typeField.replaceWith(select);
    } else if(typeField && typeField.tagName === 'SELECT' && !typeField.dataset.orgTypeReady){
      const current = typeField.value;
      typeField.innerHTML = options(current);
      typeField.dataset.orgTypeReady = 'true';
    }
  }
  const originalToggle = window.toggleAddForm;
  if(typeof originalToggle === 'function' && !originalToggle.__orgCreatorCleanup){
    window.toggleAddForm = function(id){
      const result = originalToggle.apply(this, arguments);
      if(id === 'organizationAddForm') setTimeout(cleanOrganizationForm, 20);
      return result;
    };
    window.toggleAddForm.__orgCreatorCleanup = true;
  }
  const originalRenderAll = window.renderAll;
  if(typeof originalRenderAll === 'function' && !originalRenderAll.__orgCreatorCleanup){
    window.renderAll = function(){
      const result = originalRenderAll.apply(this, arguments);
      setTimeout(cleanOrganizationForm, 30);
      return result;
    };
    window.renderAll.__orgCreatorCleanup = true;
  }
  const originalAdd = window.addOrganization;
  if(typeof originalAdd === 'function' && !originalAdd.__orgCreatorCleanup){
    window.addOrganization = function(){
      cleanOrganizationForm();
      const before = Array.isArray(window.data?.organizations) ? window.data.organizations.length : 0;
      const result = originalAdd.apply(this, arguments);
      setTimeout(()=>{
        const list = Array.isArray(window.data?.organizations) ? window.data.organizations : [];
        list.slice(Math.max(0,before-1)).forEach(org=>{ if(org && Object.prototype.hasOwnProperty.call(org,'members')) delete org.members; });
        if(window.saveData) window.saveData(true);
      }, 80);
      return result;
    };
    window.addOrganization.__orgCreatorCleanup = true;
  }
  document.addEventListener('DOMContentLoaded', cleanOrganizationForm);
  setTimeout(cleanOrganizationForm, 300);
})();

/* ===== creator-form-cleanup-final-verification.js ===== */
(function(){
  if(window.__plotpalsCreatorFormCleanupFinalVerification) return;
  window.__plotpalsCreatorFormCleanupFinalVerification = true;

  const ORG_TYPES = ['Government','Guild','Religion','Military','Cult','Circus / Troupe','Royal House','Criminal Group','School','Business','Rebellion','Other'];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const canon = v => {
    try { return typeof window.canonicalWorldCategory === 'function' ? window.canonicalWorldCategory(v) : String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
    catch { return String(v||'').toLowerCase(); }
  };

  function cloneConfig(cfg){
    return cfg ? { ...cfg, fields: Array.isArray(cfg.fields) ? cfg.fields.map(f => [...f]) : [] } : cfg;
  }

  function cleanedWorldConfig(category, cfg){
    const slug = canon(category);
    const out = cloneConfig(cfg);
    if(!out || !Array.isArray(out.fields)) return out;

    if(slug === 'locations'){
      out.fields = out.fields
        .filter(([key,label]) => key !== 'culture' && !/culture/i.test(label||''))
        .map(field => field[0] === 'population' ? ['population','Population','Population size'] : field);
    }

    if(slug === 'organizations'){
      out.fields = out.fields
        .filter(([key,label]) => key !== 'members' && !/members/i.test(label||''))
        .map(field => field[0] === 'type' ? ['type','Type','Choose an organization type'] : field);
    }

    if(slug === 'religions'){
      out.fields = out.fields
        .filter(([key,label,placeholder]) => !/followers?|who follows/i.test(`${label||''} ${placeholder||''}`))
        .map(field => /holy sites\s*\/\s*followers/i.test(field[1]||'') ? [field[0],'Holy Sites','Temples, pilgrimage sites, sacred locations, major regions'] : field);
    }

    if(slug === 'races-species' || slug === 'race-species'){
      out.fields = out.fields
        .filter(([key,label]) => key !== 'culture' && !/^culture$/i.test(label||''))
        .map(field => field[0] === 'basicInfo' ? ['basicInfo','Basic Information','Classification, origin, lifespan, rarity'] : field);
    }

    if(slug === 'historical-events'){
      out.fields = out.fields.filter(([key,label]) => {
        const text = String(label||'').toLowerCase();
        return key !== 'basicInfo' && key !== 'description' && key !== 'culture' && key !== 'rules'
          && !/event information|summary|major figures|participants|consequences|modern impact/.test(text);
      });
    }

    return out;
  }

  const originalConfig = window.worldCategoryFormConfig;
  if(typeof originalConfig === 'function' && !originalConfig.__creatorCleanupFinal){
    const wrapped = function(category){
      return cleanedWorldConfig(category, originalConfig.apply(this, arguments));
    };
    wrapped.__creatorCleanupFinal = true;
    window.worldCategoryFormConfig = wrapped;
  }

  function replaceWithSelect(el, options, placeholder){
    if(!el || el.tagName === 'SELECT') return;
    const current = el.value || '';
    const select = document.createElement('select');
    select.id = el.id;
    select.className = el.className || '';
    select.innerHTML = `<option value="">${esc(placeholder)}</option>` + options.map(v => `<option value="${esc(v)}"${String(current)===v?' selected':''}>${esc(v)}</option>`).join('');
    el.replaceWith(select);
  }

  function removeFieldContainer(field){
    if(!field) return;
    const container = field.closest('label,.form-row,.form-field,.field-card,.creator-section,.form-section,fieldset,.full-span') || field;
    if(container && container.parentElement) container.remove();
  }

  function removeByText(form, patterns){
    if(!form) return;
    const rx = patterns.map(p => p instanceof RegExp ? p : new RegExp(String(p),'i'));
    [...form.querySelectorAll('label,textarea,input,section,fieldset,details,h3,h4,legend')].forEach(el => {
      const txt = `${el.textContent||''} ${el.placeholder||''} ${el.id||''}`.replace(/\s+/g,' ').trim();
      if(!txt) return;
      if(/Link Tracker|Linked Trackers|Timeline Intelligence|Timeline Link|Upload/i.test(txt)) return;
      if(rx.some(r => r.test(txt))) removeFieldContainer(el);
    });
  }

  function cleanupStaticForms(){
    // Static Location creator: Link Tracker owns residents/who-lives-here and culture links.
    const locationPopulation = document.getElementById('locationPopulation');
    if(locationPopulation) locationPopulation.placeholder = 'Population size';
    const locationCulture = document.getElementById('locationCulture');
    if(locationCulture) removeFieldContainer(locationCulture);

    // Static Organization creator: Link Tracker owns members.
    replaceWithSelect(document.getElementById('orgType'), ORG_TYPES, 'Organization type');
    const orgMembers = document.getElementById('orgMembers');
    if(orgMembers) removeFieldContainer(orgMembers);
  }

  function cleanupRenderedWorldCategoryForm(){
    const selected = window.data?.selectedWorldCategory || document.getElementById('worldCategory')?.value || '';
    const slug = canon(selected);
    const form = document.getElementById(`worldCategoryAddForm_${slug}`) || document.querySelector('[id^="worldCategoryAddForm_"]:not(.hidden)');
    if(!form) { cleanupStaticForms(); return; }

    if(slug === 'locations'){
      const pop = form.querySelector('#worldPopulation');
      if(pop) pop.placeholder = 'Population size';
      removeByText(form, [/culture, customs/i, /culture\s*\/\s*society/i, /^culture$/i, /who lives here/i, /residents/i]);
    }

    if(slug === 'organizations'){
      replaceWithSelect(form.querySelector('#worldType'), ORG_TYPES, 'Organization type');
      removeByText(form, [/members/i, /leaders, members/i]);
    }

    if(slug === 'religions'){
      removeByText(form, [/followers/i, /who follows/i]);
      [...form.querySelectorAll('label,h3,h4,legend')].forEach(el => {
        if(/holy sites\s*\/\s*followers/i.test(el.textContent||'')) el.textContent = (el.textContent||'').replace(/\s*\/\s*Followers/ig,'');
      });
    }

    if(slug === 'races-species' || slug === 'race-species'){
      const basic = form.querySelector('#worldBasicInfo');
      if(basic) basic.placeholder = 'Classification, origin, lifespan, rarity';
      removeByText(form, [/homeland/i, /^culture$/i, /culture section/i, /customs/i]);
    }

    if(slug === 'historical-events'){
      removeByText(form, [/event information/i, /^summary$/i, /major figures/i, /participants/i, /consequences/i, /modern impact/i, /event notes\s*\/\s*participation impact/i]);
      if(typeof window.updateHistoricalTimelineDateMode === 'function') window.updateHistoricalTimelineDateMode();
    }

    cleanupStaticForms();
  }

  const originalRenderWorldCategoryPage = window.renderWorldCategoryPage;
  if(typeof originalRenderWorldCategoryPage === 'function' && !originalRenderWorldCategoryPage.__creatorCleanupFinal){
    window.renderWorldCategoryPage = function(){
      const result = originalRenderWorldCategoryPage.apply(this, arguments);
      setTimeout(cleanupRenderedWorldCategoryForm, 40);
      return result;
    };
    window.renderWorldCategoryPage.__creatorCleanupFinal = true;
  }

  const originalToggleAddForm = window.toggleAddForm;
  if(typeof originalToggleAddForm === 'function' && !originalToggleAddForm.__creatorCleanupFinal){
    window.toggleAddForm = function(){
      const result = originalToggleAddForm.apply(this, arguments);
      setTimeout(cleanupRenderedWorldCategoryForm, 30);
      return result;
    };
    window.toggleAddForm.__creatorCleanupFinal = true;
  }

  const originalRenderAll = window.renderAll;
  if(typeof originalRenderAll === 'function' && !originalRenderAll.__creatorCleanupFinal){
    window.renderAll = function(){
      const result = originalRenderAll.apply(this, arguments);
      setTimeout(cleanupRenderedWorldCategoryForm, 80);
      return result;
    };
    window.renderAll.__creatorCleanupFinal = true;
  }

  document.addEventListener('change', ev => {
    if(ev.target?.id === 'worldCategory' || ev.target?.id === 'worldCustomCategory') setTimeout(cleanupRenderedWorldCategoryForm, 40);
  }, true);
  document.addEventListener('DOMContentLoaded', () => setTimeout(cleanupRenderedWorldCategoryForm, 300));
  setTimeout(cleanupRenderedWorldCategoryForm, 700);
})();


/* ===== magic-system-creator-cleanup.js ===== */
(function(){
  const g = window;
  if (g.__plotpalsMagicSystemCreatorCleanup) return;
  g.__plotpalsMagicSystemCreatorCleanup = true;

  const SOURCE_OPTIONS = ['Inherited','Learned','Divine','Blood-based','Artifact-based','Environmental','Unknown','Other'];
  const textOf = el => String(el?.textContent || el?.placeholder || el?.getAttribute?.('aria-label') || '').replace(/\s+/g,' ').trim();
  const val = id => document.getElementById(id)?.value || '';

  function optionList(current=''){
    return '<option value="">Select source type...</option>' + SOURCE_OPTIONS.map(v => `<option value="${v.replace(/"/g,'&quot;')}" ${String(current)===v?'selected':''}>${v}</option>`).join('');
  }

  function replaceSourceWithDropdown(form){
    const old = document.getElementById('magicSource');
    if (!old || old.tagName === 'SELECT') return;
    const current = old.value || '';
    const label = document.createElement('label');
    label.className = 'form-field-heading magic-source-field';
    label.innerHTML = `Source<select id="magicSource">${optionList(current)}</select>`;
    old.replaceWith(label);
    if (current && !SOURCE_OPTIONS.includes(current)) {
      const sel = document.getElementById('magicSource');
      const opt = document.createElement('option');
      opt.value = current;
      opt.textContent = current;
      opt.selected = true;
      sel.appendChild(opt);
    }
  }

  function cleanMagicText(form){
    const rules = document.getElementById('magicRules');
    if (rules) rules.placeholder = 'Core rules, limits, costs, weaknesses, and exceptions';
    const examples = document.getElementById('magicExamples');
    if (examples) examples.placeholder = 'Example spells, techniques, abilities, and uses';
    form.querySelectorAll('*').forEach(el => {
      [...el.childNodes].forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          node.textContent = node.textContent
            .replace(/Examples\s*\/\s*Users/gi, 'Examples / Uses')
            .replace(/Known Users/gi, 'Examples')
            .replace(/Users/gi, 'Uses')
            .replace(/who can access it/gi, '')
            .replace(/who can access this magic/gi, '')
            .replace(/schools\s*\/\s*types/gi, '')
            .replace(/schools and types/gi, '')
            .replace(/schools\/types/gi, '');
        }
      });
      ['placeholder','aria-label','title'].forEach(attr => {
        const v = el.getAttribute?.(attr);
        if (!v) return;
        el.setAttribute(attr, v
          .replace(/Examples\s*\/\s*Users/gi, 'Examples / Uses')
          .replace(/Known Users/gi, 'Examples')
          .replace(/Users/gi, 'Uses')
          .replace(/who can access it/gi, '')
          .replace(/who can access this magic/gi, '')
          .replace(/schools\s*\/\s*types/gi, '')
          .replace(/schools and types/gi, '')
          .replace(/schools\/types/gi, '')
        );
      });
    });
  }

  function removeLinkTrackerDuplicateFields(form){
    const removePatterns = [
      /who can access/i,
      /eligible users/i,
      /known users/i,
      /^users$/i,
      /organizations that use/i,
      /linked organizations/i,
      /artifacts that use/i,
      /items\s*\/\s*artifacts/i,
      /schools\s*\/\s*types/i,
      /schools and types/i,
      /^schools$/i
    ];
    const protectedIds = new Set(['magicSource','magicRules','magicLimits','magicCosts','magicExamples','magicName','magicImage']);
    const pickContainer = el => {
      if (protectedIds.has(el.id)) return null;
      const selectors = ['label','fieldset','section','.form-section','.creator-section','.field-card','.full-span','.custom-section-block','details','div'];
      for (const sel of selectors) {
        const c = el.closest?.(sel);
        if (c && c !== form && !c.querySelector?.('#magicExamples,#magicSource,#magicRules,#magicLimits,#magicCosts,#magicName,#magicImage')) return c;
      }
      return null;
    };
    form.querySelectorAll('label,h3,h4,h5,legend,summary,textarea,input,select').forEach(el => {
      const txt = [textOf(el), el.id, el.name, el.placeholder].filter(Boolean).join(' ');
      if (removePatterns.some(rx => rx.test(txt))) {
        const c = pickContainer(el);
        if (c) c.remove();
      }
    });
  }

  function cleanMagicCreator(){
    const form = document.getElementById('magicAddForm');
    if (!form) return;
    replaceSourceWithDropdown(form);
    cleanMagicText(form);
    removeLinkTrackerDuplicateFields(form);
  }

  const originalRenderAll = g.renderAll;
  if (typeof originalRenderAll === 'function' && !originalRenderAll.__magicCreatorCleanup) {
    const wrapped = function(){
      const result = originalRenderAll.apply(this, arguments);
      setTimeout(cleanMagicCreator, 0);
      return result;
    };
    wrapped.__magicCreatorCleanup = true;
    g.renderAll = wrapped;
  }

  const originalSetView = g.setView;
  if (typeof originalSetView === 'function' && !originalSetView.__magicCreatorCleanup) {
    const wrappedSetView = function(){
      const result = originalSetView.apply(this, arguments);
      setTimeout(cleanMagicCreator, 0);
      return result;
    };
    wrappedSetView.__magicCreatorCleanup = true;
    g.setView = wrappedSetView;
  }

  const originalEditEntityCard = g.editEntityCard;
  if (typeof originalEditEntityCard === 'function' && !originalEditEntityCard.__magicCreatorCleanup) {
    const wrappedEdit = function(kind,id){
      const result = originalEditEntityCard.apply(this, arguments);
      if (kind === 'magic') setTimeout(cleanMagicCreator, 120);
      return result;
    };
    wrappedEdit.__magicCreatorCleanup = true;
    g.editEntityCard = wrappedEdit;
  }

  const originalAddMagic = g.addMagic;
  if (typeof originalAddMagic === 'function' && !originalAddMagic.__magicCreatorCleanup) {
    const wrappedAddMagic = function(){
      cleanMagicCreator();
      const result = originalAddMagic.apply(this, arguments);
      try {
        (g.data?.magicSystems || []).forEach(item => {
          if (!item || typeof item !== 'object') return;
          delete item.knownUsers;
          delete item.users;
          delete item.organizations;
          delete item.artifacts;
          delete item.schools;
          delete item.types;
        });
      } catch(e) {}
      return result;
    };
    wrappedAddMagic.__magicCreatorCleanup = true;
    g.addMagic = wrappedAddMagic;
  }

  const style = document.createElement('style');
  style.textContent = `.magic-source-field{display:flex;flex-direction:column;gap:.35rem}.magic-source-field select{width:100%}`;
  document.head.appendChild(style);
  setTimeout(cleanMagicCreator, 100);
  setTimeout(cleanMagicCreator, 800);
})();

/* ===== government-creator-cleanup-and-link-details.js ===== */
(function(){
  const g = window;
  if (g.__plotpalsGovernmentCreatorCleanupV2) return;
  g.__plotpalsGovernmentCreatorCleanupV2 = true;

  const arr = v => Array.isArray(v) ? v : (v ? [v] : []);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const canon = v => {
    try { return typeof g.canonicalWorldCategory === 'function' ? g.canonicalWorldCategory(v) : String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
    catch { return String(v||'').toLowerCase(); }
  };

  const POLITICAL_ROLES = [
    'Citizen','Ruler / Monarch','Elected Leader','Council Member','Noble / Aristocrat','Military Leader','Soldier / Guard','Advisor','Diplomat','Spy / Informant','Rebel','Prisoner','Outlaw','Foreign National','Refugee','Subject','Ally Agent','Enemy Agent','Other'
  ];
  const STANDINGS = [
    'Good Standing','Trusted','Favored','Neutral','Watched','Suspicious','Wanted','Exiled','Imprisoned','Protected','Enemy of the State','Unknown','Other'
  ];

  function removeContainer(el){
    if(!el) return;
    const protectedRx = /Link Tracker|Linked Trackers|Timeline Intelligence|Timeline Link|Upload/i;
    let node = el.closest?.('section,fieldset,details,.creator-section,.form-section,.custom-section-builder,.field-card,.full-span,label,.form-row,div') || el;
    if(node && protectedRx.test(node.textContent||'')) return;
    if(node && node.parentElement) node.remove();
  }

  function removeByText(form, patterns){
    if(!form) return;
    const rx = patterns.map(p => p instanceof RegExp ? p : new RegExp(String(p),'i'));
    [...form.querySelectorAll('h3,h4,h5,legend,summary,label,textarea,input,select')].forEach(el=>{
      const txt = `${el.textContent||''} ${el.placeholder||''} ${el.id||''} ${el.name||''}`.replace(/\s+/g,' ').trim();
      if(!txt || /Link Tracker|Linked Trackers|Timeline Intelligence|Timeline Link|Upload/i.test(txt)) return;
      if(rx.some(r=>r.test(txt))) removeContainer(el);
    });
  }

  function cleanGovernmentForm(){
    const selected = g.data?.selectedWorldCategory || document.getElementById('worldCategory')?.value || '';
    const slug = canon(selected);
    const forms = [
      document.getElementById('worldCategoryAddForm_governments'),
      document.getElementById('worldCategoryAddForm_government'),
      ...(slug === 'governments' || slug === 'government' ? [...document.querySelectorAll('[id^="worldCategoryAddForm_"]:not(.hidden)')] : [])
    ].filter(Boolean);
    forms.forEach(form=>{
      removeByText(form, [
        /leaders\s*\/\s*important figures/i,
        /leaders\s*and\s*important figures/i,
        /important figures/i,
        /territory\s*\/\s*allies\s*\/\s*enemies/i,
        /territory\s*allies\s*enemies/i,
        /allies\s*\/\s*enemies/i,
        /^allies$/i,
        /^enemies$/i
      ]);
    });
  }

  const priorWorldConfig = g.worldCategoryFormConfig;
  if(typeof priorWorldConfig === 'function' && !priorWorldConfig.__governmentCleanupV2){
    const wrapped = function(category){
      const cfg = priorWorldConfig.apply(this, arguments);
      const slug = canon(category);
      if(cfg && Array.isArray(cfg.fields) && (slug === 'governments' || slug === 'government')){
        cfg.fields = cfg.fields.filter(field => {
          const key = String(field?.[0] || '').toLowerCase();
          const text = String(field?.join(' ') || '').toLowerCase();
          return !/leaders|important figures|territory|allies|enemies/.test(`${key} ${text}`);
        });
      }
      return cfg;
    };
    wrapped.__governmentCleanupV2 = true;
    g.worldCategoryFormConfig = wrapped;
  }

  function findEntry(id){
    const d = g.data || {};
    const pools = [
      {collection:'characters', kind:'character', items:arr(d.characters)},
      {collection:'locations', kind:'location', items:arr(d.locations)},
      {collection:'organizations', kind:'organization', items:arr(d.organizations)},
      {collection:'magicSystems', kind:'magic', items:arr(d.magicSystems)},
      {collection:'timeline', kind:'event', items:arr(d.timeline)},
      {collection:'world', kind:'world', items:arr(d.world)}
    ];
    for(const pool of pools){
      const item = pool.items.find(x => String(x?.id) === String(id));
      if(!item) continue;
      let kind = pool.kind;
      if(pool.collection === 'world'){
        const cat = String(item.category || item.categoryKey || item.type || '').toLowerCase();
        if(/government/.test(cat)) kind = 'government';
        else if(/culture/.test(cat)) kind = 'culture';
        else if(/religion/.test(cat)) kind = 'religion';
        else if(/race|species/.test(cat)) kind = 'species';
        else if(/historical|event/.test(cat)) kind = 'event';
        else if(/location/.test(cat)) kind = 'location';
        else if(/organization/.test(cat)) kind = 'organization';
        else if(/language/.test(cat)) kind = 'language';
        else if(/item|artifact/.test(cat)) kind = 'item';
        else if(/magic/.test(cat)) kind = 'magic';
      }
      return { item, id:item.id, kind, title:item.name || item.title || item.event || item.when || 'Untitled Entry' };
    }
    return null;
  }

  function optionHtml(values, selected=''){
    return values.map(v=>`<option value="${esc(v)}" ${String(selected)===v?'selected':''}>${esc(v)}</option>`).join('');
  }

  function parseModalIds(){
    const btn = document.querySelector('#twoSidedCrossRefModalRoot button[onclick*="plotpalsSaveTwoSidedConnection"]');
    const s = btn?.getAttribute('onclick') || '';
    const m = s.match(/plotpalsSaveTwoSidedConnection\('([^']*)','([^']*)'/);
    return m ? [m[1], m[2]] : [null,null];
  }

  function enhanceGovernmentLinkModal(){
    const root = document.getElementById('twoSidedCrossRefModalRoot');
    const modal = root?.querySelector('.two-sided-ref-modal');
    if(!modal || modal.dataset.governmentEnhanced === 'true') return;
    const [sourceId, targetId] = parseModalIds();
    const source = findEntry(sourceId), target = findEntry(targetId);
    if(!source || !target) return;
    const kinds = [source.kind, target.kind];
    const connectionSelect = modal.querySelector('#twoSidedConnectionType');

    if(kinds.includes('government') && kinds.includes('character')){
      modal.dataset.governmentEnhanced = 'true';
      const title = modal.querySelector('h3');
      if(title) title.textContent = 'Government & Character Link';
      const help = modal.querySelector('.muted');
      if(help) help.textContent = 'Describe the character’s political role, citizenship, and current standing. This saves to both Encyclopedia pages.';
      if(connectionSelect) {
        connectionSelect.innerHTML = optionHtml(['Citizen of','Leader of','Serves','Protects','Opposes','Exiled from','Wanted by','Imprisoned by','Diplomat to','Spy for','Other'], connectionSelect.value || 'Citizen of');
      }
      const insertAfter = connectionSelect?.closest('label') || modal.querySelector('.two-sided-ref-summary');
      insertAfter?.insertAdjacentHTML('afterend', `
        <div class="inline-grid compact-fields government-character-link-fields">
          <label>Political Role / Citizenship
            <select id="twoSidedPoliticalRole">${optionHtml(POLITICAL_ROLES)}</select>
          </label>
          <label>Current Standing
            <select id="twoSidedCurrentStanding">${optionHtml(STANDINGS)}</select>
          </label>
        </div>`);
    }

    if(source.kind === 'government' && target.kind === 'government'){
      modal.dataset.governmentEnhanced = 'true';
      const title = modal.querySelector('h3');
      if(title) title.textContent = 'Government Relationship';
      const help = modal.querySelector('.muted');
      if(help) help.textContent = 'Choose whether these governments are allies or enemies, then describe the relationship from both sides.';
      if(connectionSelect) {
        connectionSelect.innerHTML = optionHtml(['Ally','Enemy','Uneasy Ally','Cold War','Trade Partner','Neutral','Vassal / Overlord','Former Ally','Former Enemy','Other'], connectionSelect.value || 'Ally');
        const label = connectionSelect.closest('label');
        if(label && label.firstChild) label.firstChild.textContent = 'Alliance Status ';
      }
    }
  }

  const priorSaveTwoSided = g.plotpalsSaveTwoSidedConnection;
  if(typeof priorSaveTwoSided === 'function' && !priorSaveTwoSided.__governmentCleanupV2){
    const wrappedSave = function(sourceId, targetId){
      const politicalRole = document.getElementById('twoSidedPoliticalRole')?.value || '';
      const currentStanding = document.getElementById('twoSidedCurrentStanding')?.value || '';
      const allianceStatus = document.getElementById('twoSidedConnectionType')?.value || '';
      const result = priorSaveTwoSided.apply(this, arguments);
      setTimeout(()=>{
        try{
          const list = arr(g.data?.crossReferenceConnections);
          const c = list.find(row =>
            (String(row.sourceId)===String(sourceId) && String(row.targetId)===String(targetId)) ||
            (String(row.sourceId)===String(targetId) && String(row.targetId)===String(sourceId))
          );
          if(c){
            if(politicalRole) c.politicalRole = politicalRole;
            if(currentStanding) c.currentStanding = currentStanding;
            const a = findEntry(sourceId), b = findEntry(targetId);
            if(a?.kind === 'government' && b?.kind === 'government' && allianceStatus) c.governmentRelationship = allianceStatus;
            if((politicalRole || currentStanding) && !String(c.sourceNote||'').includes('Political Role / Citizenship:')){
              const details = [politicalRole ? `Political Role / Citizenship: ${politicalRole}` : '', currentStanding ? `Current Standing: ${currentStanding}` : ''].filter(Boolean).join('\n');
              c.sourceNote = [c.sourceNote, details].filter(Boolean).join('\n\n');
              c.targetNote = [c.targetNote, details].filter(Boolean).join('\n\n');
            }
            if(typeof g.saveData === 'function') g.saveData(true);
          }
        }catch(e){ console.warn('Government link detail save failed', e); }
      }, 60);
      return result;
    };
    wrappedSave.__governmentCleanupV2 = true;
    g.plotpalsSaveTwoSidedConnection = wrappedSave;
  }

  const observer = new MutationObserver(()=>enhanceGovernmentLinkModal());
  observer.observe(document.body, {childList:true, subtree:true});

  ['renderAll','renderWorldCategoryPage','setView'].forEach(fn=>{
    const prior = g[fn];
    if(typeof prior === 'function' && !prior[`__governmentCleanupV2_${fn}`]){
      const wrapped = function(){
        const result = prior.apply(this, arguments);
        setTimeout(cleanGovernmentForm, 60);
        setTimeout(enhanceGovernmentLinkModal, 60);
        return result;
      };
      wrapped[`__governmentCleanupV2_${fn}`] = true;
      g[fn] = wrapped;
    }
  });

  document.addEventListener('change', ev=>{
    if(ev.target?.id === 'worldCategory' || ev.target?.id === 'worldCustomCategory') setTimeout(cleanGovernmentForm, 60);
  }, true);

  const style = document.createElement('style');
  style.textContent = `.government-character-link-fields{margin:.75rem 0}.government-character-link-fields label{min-width:0}`;
  document.head.appendChild(style);
  setTimeout(cleanGovernmentForm, 200);
  setTimeout(enhanceGovernmentLinkModal, 200);
})();

/* ===== culture-creator-calendar-cleanup.js ===== */
(function(){
  const g = window;
  if (g.__plotpalsCultureCreatorCalendarCleanup) return;
  g.__plotpalsCultureCreatorCalendarCleanup = true;

  const arr = v => Array.isArray(v) ? v : [];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const id = () => (Date.now().toString(36) + Math.random().toString(36).slice(2));
  const canon = v => {
    try { return typeof g.canonicalWorldCategory === 'function' ? g.canonicalWorldCategory(v) : String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
    catch { return String(v||'').toLowerCase(); }
  };

  function fieldValue(root, selector){
    return (root.querySelector(selector)?.value || '').trim();
  }

  function cultureForm(){
    return document.getElementById('worldCategoryAddForm_cultures') || document.getElementById('worldCategoryAddForm_culture');
  }

  function isCultureSelected(){
    const selected = g.data?.selectedWorldCategory || document.getElementById('worldCategory')?.value || '';
    const slug = canon(selected);
    return slug === 'cultures' || slug === 'culture';
  }

  function calendarPanelHtml(){
    return `<section class="culture-calendar-panel" id="cultureCalendarPanel">
      <div class="card-header compact-header"><div><h4>Traditions / Holidays Calendar</h4><p class="muted small-text">Add a tradition or holiday here so it appears in the shared Encyclopedia / Story Timeline calendar.</p></div></div>
      <div class="inline-grid compact-fields culture-calendar-grid">
        <label>Tradition / Holiday Name<input id="cultureHolidayTitle" placeholder="Festival of Lanterns"></label>
        <label>Calendar Type<select id="cultureHolidayDateType"><option value="seasonal">Seasonal / Recurring</option><option value="exact">Exact Date</option><option value="relative">Relative / Lore Date</option></select></label>
        <label>Calendar Date<input id="cultureHolidayDate" placeholder="Spring Equinox, 5th Moon, Oct 31, etc."></label>
        <label>Frequency<select id="cultureHolidayFrequency"><option>Annual</option><option>Monthly</option><option>Seasonal</option><option>One-Time</option><option>Irregular</option></select></label>
      </div>
      <div class="timeline-two-note-grid culture-calendar-notes">
        <label>What Happens<textarea id="cultureHolidayWhatHappens" placeholder="What happens during this tradition or holiday?"></textarea></label>
        <label>Why it Matters / Consequences<textarea id="cultureHolidayWhyMatters" placeholder="Why does this matter to the culture, characters, politics, or timeline?"></textarea></label>
      </div>
    </section>`;
  }

  function removeContainer(el){
    if (!el) return;
    const protectedRx = /Link Tracker|Linked Trackers|Timeline Intelligence|Timeline Link|Upload|Traditions\s*\/\s*Holidays Calendar/i;
    const node = el.closest?.('label,fieldset,section,.creator-section,.form-section,.field-card,.full-span,.custom-section-builder,div') || el;
    if (node && protectedRx.test(node.textContent || '')) return;
    if (node && node.parentElement) node.remove();
  }

  function removeOverviewFromCultureForm(form){
    if (!form) return;
    // Remove the generated Overview/basicInfo field only. Link Tracker owns region/people/race/nation links.
    const overview = form.querySelector('#worldBasicInfo');
    if (overview) removeContainer(overview);
    [...form.querySelectorAll('label,h3,h4,legend,textarea,input')].forEach(el => {
      const text = `${el.textContent || ''} ${el.placeholder || ''} ${el.id || ''}`.replace(/\s+/g,' ').trim();
      if (!text) return;
      if (/Link Tracker|Linked Trackers|Upload|Calendar/i.test(text)) return;
      if (/^Overview\b/i.test(text) || /Region, people, origin, related race/i.test(text)) removeContainer(el);
    });
  }

  function injectCultureCalendarPanel(){
    const form = cultureForm();
    if (!form || !isCultureSelected()) return;
    removeOverviewFromCultureForm(form);
    if (form.querySelector('#cultureCalendarPanel')) return;
    const image = form.querySelector('.upload-control');
    if (image) image.insertAdjacentHTML('afterend', calendarPanelHtml());
    else form.querySelector('.form-grid')?.insertAdjacentHTML('afterbegin', calendarPanelHtml());
  }

  function readCultureHolidayDraft(form){
    const title = fieldValue(form, '#cultureHolidayTitle');
    const date = fieldValue(form, '#cultureHolidayDate');
    const whatHappens = fieldValue(form, '#cultureHolidayWhatHappens');
    const whyMatters = fieldValue(form, '#cultureHolidayWhyMatters');
    if (!title && !date && !whatHappens && !whyMatters) return null;
    return {
      id: id(),
      title: title || 'Unnamed Tradition / Holiday',
      dateType: fieldValue(form, '#cultureHolidayDateType') || 'seasonal',
      date: date,
      frequency: fieldValue(form, '#cultureHolidayFrequency') || 'Annual',
      whatHappens,
      whyMatters,
      created: new Date().toISOString()
    };
  }

  function syncCultureHolidayToTimeline(culture, holiday){
    if (!culture || !holiday || !g.data) return;
    g.data.timeline = arr(g.data.timeline);
    const timelineId = holiday.timelineEventId || id();
    holiday.timelineEventId = timelineId;
    const payload = {
      id: timelineId,
      scope: 'series',
      seriesId: culture.seriesId || g.data.activeSeriesId || '',
      bookId: culture.bookId || '',
      event: holiday.title,
      title: holiday.title,
      when: holiday.date || holiday.frequency || 'Culture Calendar',
      computedDateLabel: holiday.date || holiday.frequency || 'Culture Calendar',
      type: 'Tradition / Holiday',
      eventType: 'Other',
      importance: 'Secondary',
      loreImportance: 'Important Lore',
      canonStatus: 'Canon',
      entryType: 'Culture Holiday',
      tags: ['culture','tradition','holiday', culture.name || ''].filter(Boolean).join(', '),
      whatHappens: holiday.whatHappens || '',
      whyMatters: holiday.whyMatters || '',
      impact: [holiday.whatHappens, holiday.whyMatters].filter(Boolean).join('\n\n'),
      cultureId: culture.id,
      worldEntryId: culture.id,
      sourceType: 'cultureHoliday',
      sourceHolidayId: holiday.id,
      updated: new Date().toISOString()
    };
    const existing = g.data.timeline.find(ev => String(ev.id) === String(timelineId) || (String(ev.cultureId) === String(culture.id) && String(ev.sourceHolidayId) === String(holiday.id)));
    if (existing) Object.assign(existing, payload, { id: existing.id });
    else g.data.timeline.push({ ...payload, created: new Date().toISOString() });
  }

  // Remove Overview from the generated Culture config before the form renders.
  const priorConfig = g.worldCategoryFormConfig;
  if (typeof priorConfig === 'function' && !priorConfig.__cultureCalendarCleanup) {
    const wrappedConfig = function(category){
      const cfg = priorConfig.apply(this, arguments);
      const slug = canon(category);
      if (cfg && Array.isArray(cfg.fields) && (slug === 'cultures' || slug === 'culture')) {
        cfg.fields = cfg.fields.filter(field => {
          const key = String(field?.[0] || '').toLowerCase();
          const text = String(field?.join(' ') || '').toLowerCase();
          return key !== 'basicinfo' && !/overview|region, people|related race|related species|nation/.test(text);
        });
      }
      return cfg;
    };
    wrappedConfig.__cultureCalendarCleanup = true;
    g.worldCategoryFormConfig = wrappedConfig;
  }

  // Capture the culture holiday before the generic save clears the form, then attach it to the new Culture and Timeline.
  const priorAddWorld = g.addWorldFromCurrentCategory;
  if (typeof priorAddWorld === 'function' && !priorAddWorld.__cultureCalendarCleanup) {
    const wrappedAddWorld = function(){
      const selected = g.data?.selectedWorldCategory || document.getElementById('worldCategory')?.value || '';
      const slug = canon(selected);
      const form = cultureForm();
      const draft = (slug === 'cultures' || slug === 'culture') && form ? readCultureHolidayDraft(form) : null;
      const beforeIds = new Set(arr(g.data?.world).map(item => item.id));
      const result = priorAddWorld.apply(this, arguments);
      if (draft && g.data) {
        setTimeout(() => {
          const culture = arr(g.data.world).find(item => !beforeIds.has(item.id) && /culture/i.test(String(item.category || item.categoryKey || item.type || '')))
            || arr(g.data.world).find(item => String(item.id) === String(g.data.selectedWorldId));
          if (culture) {
            culture.calendarEvents = arr(culture.calendarEvents);
            culture.calendarEvents.push(draft);
            // Keep a readable summary in the existing Traditions / Holidays field if the form uses it.
            culture.history = [culture.history, `${draft.title}${draft.date ? ` — ${draft.date}` : ''}${draft.whatHappens ? `\n${draft.whatHappens}` : ''}${draft.whyMatters ? `\nWhy it matters: ${draft.whyMatters}` : ''}`].filter(Boolean).join('\n\n');
            syncCultureHolidayToTimeline(culture, draft);
            if (typeof g.saveData === 'function') g.saveData(true);
          }
        }, 100);
      }
      return result;
    };
    wrappedAddWorld.__cultureCalendarCleanup = true;
    g.addWorldFromCurrentCategory = wrappedAddWorld;
  }

  ['renderAll','renderWorldCategoryPage','setView'].forEach(fn => {
    const prior = g[fn];
    if (typeof prior === 'function' && !prior[`__cultureCalendarCleanup_${fn}`]) {
      const wrapped = function(){
        const result = prior.apply(this, arguments);
        setTimeout(injectCultureCalendarPanel, 60);
        return result;
      };
      wrapped[`__cultureCalendarCleanup_${fn}`] = true;
      g[fn] = wrapped;
    }
  });

  document.addEventListener('change', ev => {
    if (ev.target?.id === 'worldCategory' || ev.target?.id === 'worldCustomCategory') setTimeout(injectCultureCalendarPanel, 60);
  }, true);

  const style = document.createElement('style');
  style.textContent = `.culture-calendar-panel{grid-column:1/-1;border:1px solid rgba(250,204,21,.22);border-radius:18px;padding:1rem;background:rgba(250,204,21,.045);margin:.75rem 0 1rem}.culture-calendar-panel h4{margin:0 0 .2rem}.culture-calendar-grid{margin-top:.75rem}.culture-calendar-notes textarea{min-height:120px}@media(max-width:760px){.culture-calendar-panel .inline-grid,.culture-calendar-notes{grid-template-columns:1fr!important}}`;
  document.head.appendChild(style);
  document.addEventListener('DOMContentLoaded', () => setTimeout(injectCultureCalendarPanel, 300));
  setTimeout(injectCultureCalendarPanel, 800);
})();

/* ===== final-creator-cleanup-hardening.js ===== */
(function(){
  const g = window;
  if (g.__plotpalsFinalCreatorCleanupHardeningV3) return;
  g.__plotpalsFinalCreatorCleanupHardeningV3 = true;

  const arr = v => Array.isArray(v) ? v : [];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const slugify = v => {
    try { return typeof g.canonicalWorldCategory === 'function' ? g.canonicalWorldCategory(v) : String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
    catch { return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
  };
  const activeSlug = () => slugify(g.data?.selectedWorldCategory || document.getElementById('worldCategory')?.value || document.getElementById('worldCustomCategory')?.value || '');
  const formFor = slug => document.getElementById(`worldCategoryAddForm_${slug}`) || document.querySelector(`[id^="worldCategoryAddForm_"]:not(.hidden)`);
  const text = el => `${el?.textContent||''} ${el?.placeholder||''} ${el?.id||''} ${el?.name||''} ${el?.getAttribute?.('aria-label')||''}`.replace(/\s+/g,' ').trim();

  function safeContainer(el){
    if(!el) return null;
    const protectedRx = /Link Tracker|Linked Trackers|Timeline Intelligence|Timeline Link|Upload/i;
    const selectors = ['label','.form-row','.form-field','.field-card','.creator-field','.creator-section','.form-section','fieldset','details','.full-span'];
    for(const sel of selectors){
      const node = el.closest?.(sel);
      if(node && !protectedRx.test(node.textContent||'')) return node;
    }
    return null;
  }
  function removeNode(el){ const node = safeContainer(el); if(node?.parentElement) node.remove(); }
  function removeMatching(form, patterns){
    if(!form) return;
    const rx = patterns.map(p => p instanceof RegExp ? p : new RegExp(String(p),'i'));
    [...form.querySelectorAll('label,h3,h4,h5,legend,summary,textarea,input,select')].forEach(el => {
      const t = text(el);
      if(!t || /Link Tracker|Linked Trackers|Timeline Intelligence|Timeline Link|Upload/i.test(t)) return;
      if(rx.some(r => r.test(t))) removeNode(el);
    });
  }
  function rewriteText(root, replacements){
    if(!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      let v = node.nodeValue;
      replacements.forEach(([rx,to]) => { v = v.replace(rx,to); });
      node.nodeValue = v.replace(/\s{2,}/g,' ');
    });
    root.querySelectorAll('input,textarea,select').forEach(el => {
      ['placeholder','aria-label','title'].forEach(attr => {
        let v = el.getAttribute(attr); if(!v) return;
        replacements.forEach(([rx,to]) => { v = v.replace(rx,to); });
        el.setAttribute(attr, v.replace(/\s{2,}/g,' ').trim());
      });
    });
  }
  function makeSelectFromInput(el, options, placeholder){
    if(!el) return;
    if(el.tagName === 'SELECT'){
      const current = el.value;
      el.innerHTML = `<option value="">${esc(placeholder)}</option>` + options.map(o=>`<option${String(current)===o?' selected':''}>${esc(o)}</option>`).join('');
      return;
    }
    const current = el.value || '';
    const sel = document.createElement('select');
    sel.id = el.id; sel.name = el.name || el.id; sel.className = el.className || '';
    sel.innerHTML = `<option value="">${esc(placeholder)}</option>` + options.map(o=>`<option${String(current)===o?' selected':''}>${esc(o)}</option>`).join('');
    if(current && !options.includes(current)) sel.insertAdjacentHTML('beforeend', `<option selected>${esc(current)}</option>`);
    el.replaceWith(sel);
  }

  const ORG_TYPES = ['Government','Guild','Religion','Military','Cult','Circus / Troupe','Royal House','Criminal Group','School','Business','Rebellion','Other'];
  const MAGIC_SOURCES = ['Inherited','Learned','Divine','Blood-based','Artifact-based','Environmental','Unknown','Other'];
  const POLITICAL_ROLES = ['Citizen','Ruler / Monarch','Elected Leader','Council Member','Noble / Aristocrat','Military Leader','Soldier / Guard','Advisor','Diplomat','Spy / Informant','Rebel','Prisoner','Outlaw','Foreign National','Refugee','Subject','Ally Agent','Enemy Agent','Other'];
  const STANDINGS = ['Good Standing','Trusted','Favored','Neutral','Watched','Suspicious','Wanted','Exiled','Imprisoned','Protected','Enemy of the State','Unknown','Other'];
  const GOV_REL = ['Ally','Enemy','Uneasy Ally','Cold War','Trade Partner','Neutral','Vassal / Overlord','Former Ally','Former Enemy','Other'];

  function cleanStaticCreators(){
    const orgType = document.getElementById('orgType');
    if(orgType) makeSelectFromInput(orgType, ORG_TYPES, 'Organization type');
    const orgMembers = document.getElementById('orgMembers'); if(orgMembers) removeNode(orgMembers);
    const magicSource = document.getElementById('magicSource');
    if(magicSource) makeSelectFromInput(magicSource, MAGIC_SOURCES, 'Magic source');
  }

  function cleanMagic(form){
    const root = form || document.getElementById('magicAddForm'); if(!root) return;
    makeSelectFromInput(root.querySelector('#magicSource'), MAGIC_SOURCES, 'Magic source');
    rewriteText(root, [
      [/Examples\s*\/\s*Users/gi,'Examples / Uses'],[/Known Users/gi,'Examples'],[/\bUsers\b/gi,'Uses'],
      [/who can access it/gi,''],[/who can access this magic/gi,''],[/schools\s*\/\s*types/gi,''],[/schools and types/gi,''],[/schools\/types/gi,'']
    ]);
    const rules = root.querySelector('#magicRules'); if(rules) rules.placeholder = 'Core rules, limits, costs, weaknesses, and exceptions';
    const examples = root.querySelector('#magicExamples'); if(examples) examples.placeholder = 'Example spells, techniques, abilities, and uses';
    removeMatching(root, [/who can access/i,/eligible users/i,/known users/i,/^users$/i,/organizations that use/i,/linked organizations/i,/artifacts that use/i,/items\s*\/\s*artifacts/i,/schools\s*\/\s*types/i,/schools and types/i,/^schools$/i]);
  }

  function timelineIntelHtml(){
    return `<section class="historical-timeline-bridge final-timeline-intel full-span" id="historicalTimelineBridgeFields">
      <div class="timeline-bridge-heading"><h4>⏳ Timeline Intelligence</h4><p class="muted">Synced with the shared Encyclopedia / Story Timeline system.</p></div>
      <div class="inline-grid compact-fields timeline-intel-grid">
        <label>Event Type<select id="historicalTimelineEventType"><option>Other</option><option>Birth</option><option>Death</option><option>War</option><option>Discovery</option><option>Betrayal</option><option>Marriage</option><option>Transformation</option><option>Disappearance</option><option>Reunion</option><option>Founding</option><option>Collapse</option><option>Travel</option></select></label>
        <label>Importance<select id="historicalTimelineImportance"><option>Major</option><option>Secondary</option><option>Minor Background</option></select></label>
        <label>Date Type<select id="historicalTimelineDateType"><option value="relative">Relative Date</option><option value="exact">Exact Date</option></select></label>
        <label>Exact / Relative Date<input id="historicalTimelineDate" placeholder="Year, date, or relative marker"></label>
      </div>
      <div class="timeline-two-note-grid"><label>What Happens<textarea id="historicalTimelineWhatHappens" placeholder="What happens in this event?"></textarea></label><label>Why it Matters / Consequences<textarea id="historicalTimelineWhyMatters" placeholder="Why does this matter later?"></textarea></label></div>
    </section>`;
  }
  function ensureHistoricalTimeline(form){
    const root = form || formFor('historical-events'); if(!root) return;
    removeMatching(root, [/event information/i,/^summary$/i,/major figures/i,/participants/i,/consequences/i,/modern impact/i,/event notes\s*\/\s*participation impact/i]);
    if(root.querySelector('#historicalTimelineBridgeFields')) return;
    const image = [...root.querySelectorAll('label,input,div,section')].find(el => /Upload Historical Event Image|historical event image|event image/i.test(text(el)))?.closest('label,.upload-control,.form-row,.field-card,.full-span') || root.querySelector('.upload-control');
    if(image) image.insertAdjacentHTML('afterend', timelineIntelHtml());
    else (root.querySelector('.form-grid') || root).insertAdjacentHTML('afterbegin', timelineIntelHtml());
  }
  function syncHistoricalEvents(){
    try{
      const list = arr(g.data?.world).filter(x => /historical|event/i.test(String(x.category||x.categoryKey||x.type||'')));
      g.data.timeline = arr(g.data?.timeline);
      list.forEach(item => {
        if(!item.timelineEventId) item.timelineEventId = item.id || (Date.now().toString(36)+Math.random().toString(36).slice(2));
        const payload = { id:item.timelineEventId, event:item.name||item.title||'Historical Event', title:item.name||item.title||'Historical Event', type:item.eventType||item.type||'Historical Event', eventType:item.eventType||'Other', importance:item.importance||'Secondary', when:item.when||item.date||item.computedDateLabel||'', whatHappens:item.whatHappens||item.description||'', whyMatters:item.whyMatters||item.impact||'', sourceType:'historicalEvent', worldEntryId:item.id, updated:new Date().toISOString() };
        const found = g.data.timeline.find(ev => String(ev.id)===String(payload.id) || String(ev.worldEntryId)===String(item.id));
        if(found) Object.assign(found, payload, {id:found.id}); else g.data.timeline.push({...payload, created:new Date().toISOString()});
      });
    }catch(e){ console.warn('Historical event timeline sync skipped', e); }
  }

  function cultureCalendarHtml(){
    return `<section class="culture-calendar-panel full-span" id="cultureCalendarPanel"><div class="card-header compact-header"><div><h4>Traditions / Holidays Calendar</h4><p class="muted small-text">Adds this tradition or holiday to the shared Encyclopedia calendar.</p></div></div><div class="inline-grid compact-fields culture-calendar-grid"><label>Tradition / Holiday Name<input id="cultureHolidayTitle" placeholder="Festival of Lanterns"></label><label>Calendar Type<select id="cultureHolidayDateType"><option value="seasonal">Seasonal / Recurring</option><option value="exact">Exact Date</option><option value="relative">Relative / Lore Date</option></select></label><label>Calendar Date<input id="cultureHolidayDate" placeholder="Spring Equinox, 5th Moon, Oct 31, etc."></label><label>Frequency<select id="cultureHolidayFrequency"><option>Annual</option><option>Monthly</option><option>Seasonal</option><option>One-Time</option><option>Irregular</option></select></label></div><div class="timeline-two-note-grid culture-calendar-notes"><label>What Happens<textarea id="cultureHolidayWhatHappens" placeholder="What happens during this tradition or holiday?"></textarea></label><label>Why it Matters / Consequences<textarea id="cultureHolidayWhyMatters" placeholder="Why does this matter?"></textarea></label></div></section>`;
  }
  function cleanCulture(form){
    const root = form || formFor('cultures'); if(!root) return;
    removeMatching(root, [/^overview\b/i,/region, people/i,/related race/i,/related species/i,/nation/i]);
    const basic = root.querySelector('#worldBasicInfo'); if(basic) removeNode(basic);
    if(!root.querySelector('#cultureCalendarPanel')){
      const image = root.querySelector('.upload-control') || [...root.querySelectorAll('label,input')].find(el=>/image|upload/i.test(text(el)))?.closest('label,.field-card,.full-span');
      if(image) image.insertAdjacentHTML('afterend', cultureCalendarHtml());
      else (root.querySelector('.form-grid') || root).insertAdjacentHTML('afterbegin', cultureCalendarHtml());
    }
  }

  function cleanGovernment(form){
    const root = form || formFor('governments'); if(!root) return;
    removeMatching(root, [/leaders\s*\/\s*important figures/i,/leaders\s*and\s*important figures/i,/important figures/i,/territory\s*\/\s*allies\s*\/\s*enemies/i,/territory/i,/allies\s*\/\s*enemies/i,/^allies$/i,/^enemies$/i]);
  }
  function enhanceGovModal(){
    const modal = document.querySelector('#twoSidedCrossRefModalRoot .two-sided-ref-modal'); if(!modal) return;
    const titleText = text(modal);
    const sel = modal.querySelector('#twoSidedConnectionType');
    if(!sel) return;
    if(/government/i.test(titleText) && /character/i.test(titleText) && !modal.querySelector('#twoSidedPoliticalRole')){
      sel.innerHTML = GOV_REL.concat(['Citizen of','Leader of','Serves','Protects','Opposes','Exiled from','Wanted by','Diplomat to','Spy for']).map(v=>`<option>${esc(v)}</option>`).join('');
      sel.closest('label')?.insertAdjacentHTML('afterend', `<div class="inline-grid compact-fields government-character-link-fields"><label>Political Role / Citizenship<select id="twoSidedPoliticalRole">${POLITICAL_ROLES.map(v=>`<option>${esc(v)}</option>`).join('')}</select></label><label>Current Standing<select id="twoSidedCurrentStanding">${STANDINGS.map(v=>`<option>${esc(v)}</option>`).join('')}</select></label></div>`);
    }
    if(/government relationship|government.*government|allies|enemies/i.test(titleText)){
      sel.innerHTML = GOV_REL.map(v=>`<option>${esc(v)}</option>`).join('');
    }
  }

  function cleanRaces(form){
    const root = form || formFor('races-species') || formFor('race-species'); if(!root) return;
    rewriteText(root, [[/homeland/gi,'origin'],[/Homeland/gi,'Origin']]);
    const basic = root.querySelector('#worldBasicInfo'); if(basic) basic.placeholder = 'Classification, origin, lifespan, rarity';
    removeMatching(root, [/^culture$/i,/culture section/i,/customs/i,/homeland/i]);
  }
  function cleanReligion(form){
    const root = form || formFor('religions'); if(!root) return;
    removeMatching(root, [/followers/i,/who follows/i]);
    rewriteText(root, [[/Holy Sites\s*\/\s*Followers/gi,'Holy Sites'],[/\/\s*Followers/gi,'']]);
  }
  function cleanOrganization(form){
    const root = form || formFor('organizations'); if(root) { makeSelectFromInput(root.querySelector('#worldType'), ORG_TYPES, 'Organization type'); removeMatching(root, [/members/i]); }
    cleanStaticCreators();
  }

  function cleanActiveForms(){
    cleanStaticCreators(); cleanMagic(); enhanceGovModal();
    const slug = activeSlug();
    if(slug === 'magic-systems' || slug === 'magic-system') cleanMagic(formFor(slug));
    if(slug === 'governments' || slug === 'government') cleanGovernment(formFor(slug));
    if(slug === 'historical-events' || slug === 'historical-event') ensureHistoricalTimeline(formFor(slug));
    if(slug === 'cultures' || slug === 'culture') cleanCulture(formFor(slug));
    if(slug === 'races-species' || slug === 'race-species' || slug === 'races') cleanRaces(formFor(slug));
    if(slug === 'religions' || slug === 'religion') cleanReligion(formFor(slug));
    if(slug === 'organizations' || slug === 'organization') cleanOrganization(formFor(slug));
  }

  // Final config hardening before future forms render.
  const priorConfig = g.worldCategoryFormConfig;
  if(typeof priorConfig === 'function' && !priorConfig.__finalHardeningV3){
    const wrapped = function(category){
      const cfg = priorConfig.apply(this, arguments);
      const slug = slugify(category);
      if(cfg && Array.isArray(cfg.fields)){
        cfg.fields = cfg.fields.filter(f => {
          const joined = String((f||[]).join(' ')).toLowerCase();
          if(slug.includes('magic')) return !/who can access|eligible users|known users|organizations|artifacts|schools\s*\/\s*types|schools and types/.test(joined);
          if(slug.includes('government')) return !/leaders|important figures|territory|allies|enemies/.test(joined);
          if(slug.includes('historical')) return !/event information|summary|major figures|participants|consequences|modern impact|event notes/.test(joined);
          if(slug.includes('culture')) return !/overview|region, people|related race|related species|nation/.test(joined);
          if(slug.includes('race') || slug.includes('species')) return !/^culture$| culture |customs|homeland/.test(joined);
          if(slug.includes('religion')) return !/followers|who follows/.test(joined);
          if(slug.includes('organization')) return !/members/.test(joined);
          return true;
        });
      }
      return cfg;
    };
    wrapped.__finalHardeningV3 = true; g.worldCategoryFormConfig = wrapped;
  }

  const priorAddWorld = g.addWorldFromCurrentCategory;
  if(typeof priorAddWorld === 'function' && !priorAddWorld.__finalHardeningV3){
    const wrappedAdd = function(){
      cleanActiveForms();
      const slug = activeSlug();
      const result = priorAddWorld.apply(this, arguments);
      setTimeout(()=>{
        if(slug.includes('historical')) syncHistoricalEvents();
        if(typeof g.saveData === 'function') g.saveData(false);
      }, 120);
      return result;
    };
    wrappedAdd.__finalHardeningV3 = true; g.addWorldFromCurrentCategory = wrappedAdd;
  }

  ['renderAll','renderWorldCategoryPage','setView','toggleAddForm'].forEach(fn => {
    const prior = g[fn];
    if(typeof prior === 'function' && !prior[`__finalHardeningV3_${fn}`]){
      const wrapped = function(){ const res = prior.apply(this, arguments); setTimeout(cleanActiveForms, 40); setTimeout(cleanActiveForms, 160); return res; };
      wrapped[`__finalHardeningV3_${fn}`] = true; g[fn] = wrapped;
    }
  });
  document.addEventListener('change', ev => { if(/worldCategory|worldCustomCategory/.test(ev.target?.id||'')) setTimeout(cleanActiveForms, 50); }, true);
  new MutationObserver(()=>{ clearTimeout(g.__plotpalsFinalFormCleanupTimer); g.__plotpalsFinalFormCleanupTimer=setTimeout(cleanActiveForms, 80); }).observe(document.body,{childList:true,subtree:true});
  const style=document.createElement('style');
  style.textContent='.final-timeline-intel,.culture-calendar-panel{grid-column:1/-1;border:1px solid rgba(250,204,21,.22);border-radius:18px;padding:1rem;background:rgba(250,204,21,.045);margin:.75rem 0 1rem}.final-timeline-intel h4,.culture-calendar-panel h4{margin:0 0 .25rem}.government-character-link-fields{margin:.75rem 0}.government-character-link-fields label{min-width:0}@media(max-width:760px){.timeline-intel-grid,.timeline-two-note-grid,.culture-calendar-grid,.culture-calendar-notes{grid-template-columns:1fr!important}}';
  document.head.appendChild(style);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(cleanActiveForms,300));
  setTimeout(cleanActiveForms,500);
})();


/* ===== final-item-language-flora-creator-cleanup.js ===== */
(function(){
  const g = window;
  if (g.__plotpalsItemLanguageFloraCreatorCleanupFinal) return;
  g.__plotpalsItemLanguageFloraCreatorCleanupFinal = true;

  const arr = v => Array.isArray(v) ? v : [];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slugify = v => String(v || '').trim().toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  function canon(v){
    const raw = String(v || '').trim();
    const lower = raw.toLowerCase().replace(/[_-]+/g,' ').replace(/\s*&\s*/g,' & ').replace(/\s*\/\s*/g,'/').replace(/\s+/g,' ');
    const aliases = {
      'items/artifacts':'Items/Artifacts','items / artifacts':'Items/Artifacts','items artifacts':'Items/Artifacts','artifacts':'Items/Artifacts','items':'Items/Artifacts','item artifact':'Items/Artifacts','item/artifact':'Items/Artifacts',
      'languages':'Languages','language':'Languages',
      'flora & fauna':'Flora & Fauna','flora fauna':'Flora & Fauna','flora':'Flora & Fauna','fauna':'Flora & Fauna','flora/fauna':'Flora & Fauna',
      'locations':'Locations','location':'Locations'
    };
    return aliases[lower] || raw;
  }
  function activeCategory(){
    const custom = document.getElementById('worldCustomCategory')?.value?.trim();
    const sel = document.getElementById('worldCategory');
    return canon(custom || sel?.selectedOptions?.[0]?.textContent || sel?.value || g.data?.selectedWorldCategory || '');
  }

  function cleanConfig(category, cfg){
    if (!cfg || !Array.isArray(cfg.fields)) return cfg;
    const out = { ...cfg, fields: cfg.fields.map(f => Array.isArray(f) ? [...f] : f) };
    const slug = slugify(canon(category));

    if (slug.includes('items-artifacts')) {
      out.fields = out.fields
        .filter(f => {
          const key = String(f?.[0] || '').toLowerCase();
          const text = String((f || []).join(' ')).toLowerCase();
          return key !== 'culture' && !/owners?\s*\/\s*current location|current location|current owner/.test(text);
        })
        .map(f => {
          const key = String(f?.[0] || '').toLowerCase();
          if (key === 'basicinfo' || key === 'basic-info' || key === 'basic') return [f[0], f[1] || 'Basic Information', 'Type, creator, age, rarity, material'];
          return f;
        });
    }

    if (slug.includes('languages')) {
      out.fields = out.fields.map(f => {
        const key = String(f?.[0] || '').toLowerCase();
        const label = String(f?.[1] || '').toLowerCase();
        if (key === 'basicinfo' || label === 'overview') return [f[0], f[1] || 'Overview', 'Language family, status, usage notes'];
        return f;
      });
    }

    if (slug.includes('flora-fauna')) {
      out.fields = out.fields.map(f => {
        const key = String(f?.[0] || '').toLowerCase();
        const label = String(f?.[1] || '').toLowerCase();
        if (key === 'history' || label === 'habitat') return [f[0], f[1] || 'Habitat', 'Climate, nesting, migration, ecosystem role'];
        return f;
      });
    }
    return out;
  }

  function wrapConfig(){
    const prior = g.worldCategoryFormConfig;
    if (typeof prior !== 'function' || prior.__itemLanguageFloraCleanupFinal) return;
    const wrapped = function(category){
      return cleanConfig(category, prior.apply(this, arguments));
    };
    wrapped.__itemLanguageFloraCleanupFinal = true;
    g.worldCategoryFormConfig = wrapped;
  }

  function removeContainer(el){
    if (!el) return;
    const container = el.closest('.custom-section-builder,.form-section,.creator-section,fieldset,label,.form-row,.form-field,.full-span') || el;
    if (container && container.parentElement) container.remove();
  }
  function formRoot(){
    const candidates = [
      document.getElementById('worldAddForm'),
      document.querySelector('[id^="worldCategoryAddForm_"]:not(.hidden)'),
      document.querySelector('.view.active form'),
      document.querySelector('.view.active .form-grid')
    ];
    return candidates.find(Boolean);
  }
  function removeMatching(root, patterns){
    if (!root) return;
    const rx = patterns.map(p => p instanceof RegExp ? p : new RegExp(String(p),'i'));
    [...root.querySelectorAll('label,textarea,input,section,fieldset,details,h3,h4,legend,.custom-section-builder,.form-section')].forEach(el => {
      const text = `${el.textContent || ''} ${el.placeholder || ''} ${el.id || ''} ${el.name || ''}`.replace(/\s+/g,' ').trim();
      if (!text) return;
      if (/Link Tracker|Linked Trackers|Timeline Intelligence|Timeline Link|Upload/i.test(text)) return;
      if (rx.some(r => r.test(text))) removeContainer(el);
    });
  }
  function rewriteText(root, pairs){
    if (!root) return;
    [...root.querySelectorAll('input,textarea')].forEach(el => {
      if (el.placeholder) pairs.forEach(([rx, rep]) => el.placeholder = el.placeholder.replace(rx, rep));
    });
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => pairs.forEach(([rx, rep]) => node.nodeValue = node.nodeValue.replace(rx, rep)));
  }

  function locationOptions(){
    const d = g.data || {};
    const worldLocations = arr(d.world).filter(w => /locations?/i.test(String(w.category || w.categoryKey || w.type || '')));
    const locations = arr(d.locations).concat(worldLocations);
    const seen = new Set();
    return locations.filter(item => item?.id && !seen.has(String(item.id)) && seen.add(String(item.id)))
      .map(item => `<option value="${esc(item.id)}">${esc(item.name || item.title || 'Untitled Location')}</option>`).join('') || '<option value="" disabled>No Locations entries yet</option>';
  }
  function ensureItemLocationTracker(){
    const cat = activeCategory();
    if (cat !== 'Items/Artifacts') return;
    const panel = document.querySelector('[data-linked-tracker-panel="worldLink"], .linked-tracker-panel');
    if (!panel || panel.querySelector('[data-linked-tracker="Locations"]')) return;
    const grid = panel.querySelector('.linked-tracker-grid') || panel;
    const other = grid.querySelector('[data-linked-tracker="Other"]')?.closest('.linked-tracker-field');
    const html = `<label class="linked-tracker-field linked-tracker-locations">
      <span>Locations</span>
      <select id="worldLinkLocations" class="linked-tracker-select" multiple size="3" data-linked-tracker="Locations">${locationOptions()}</select>
    </label>`;
    if (other) other.insertAdjacentHTML('beforebegin', html); else grid.insertAdjacentHTML('beforeend', html);
  }

  function cleanActiveCreator(){
    wrapConfig();
    const root = formRoot();
    const cat = activeCategory();
    const slug = slugify(cat);
    if (slug.includes('items-artifacts')) {
      removeMatching(root, [/current owner/i, /owners?\s*\/\s*current location/i, /who had it/i, /who wants it/i, /where it is now/i]);
      rewriteText(root, [[/Type, creator, age, rarity, material, current owner/gi, 'Type, creator, age, rarity, material'], [/current owner/gi, '']]);
      ensureItemLocationTracker();
    }
    if (slug.includes('languages')) {
      rewriteText(root, [[/Speakers,\s*regions,\s*origin,\s*/gi, ''], [/Speakers/gi, ''], [/regions,\s*origin,\s*/gi, ''], [/origin,\s*/gi, '']]);
      const overview = [...(root?.querySelectorAll('label,textarea,input,.custom-section-builder,.form-section') || [])].find(el => /overview/i.test(el.textContent || '') || /overview/i.test(el.id || ''));
      if (overview) rewriteText(overview, [[/Speakers/gi, ''], [/Regions/gi, ''], [/Origins?/gi, '']]);
    }
    if (slug.includes('flora-fauna')) {
      rewriteText(root, [[/Where it lives,\s*/gi, ''], [/Where it lives/gi, '']]);
    }
  }

  wrapConfig();
  const fns = ['renderAll','renderWorldCategoryPage','setView','toggleAddForm','plotpalsRefreshLinkedTrackers'];
  fns.forEach(fn => {
    const prior = g[fn];
    if (typeof prior === 'function' && !prior[`__itemLanguageFloraCleanupFinal_${fn}`]) {
      const wrapped = function(){
        const result = prior.apply(this, arguments);
        setTimeout(cleanActiveCreator, 120);
        setTimeout(cleanActiveCreator, 350);
        return result;
      };
      wrapped[`__itemLanguageFloraCleanupFinal_${fn}`] = true;
      g[fn] = wrapped;
    }
  });
  document.addEventListener('change', ev => {
    if (ev.target?.id === 'worldCategory' || ev.target?.id === 'worldCustomCategory') setTimeout(cleanActiveCreator, 80);
  }, true);
  document.addEventListener('DOMContentLoaded', () => setTimeout(cleanActiveCreator, 500));
  setTimeout(cleanActiveCreator, 1000);
})();


/* ===== items-artifacts-creator-final-fix.js ===== */
(function(){
  const g = window;
  if (g.__plotpalsItemsArtifactsCreatorFinalFix) return;
  g.__plotpalsItemsArtifactsCreatorFinalFix = true;
  const slug = v => String(v || '').trim().toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const isItems = v => /items?-?artifacts?|artifacts?/.test(slug(v));
  function selectedCategory(){
    const active = [...document.querySelectorAll('[id^="worldCategoryAddForm_"]')].find(el => !el.classList.contains('hidden'));
    if (active) return active.id.replace('worldCategoryAddForm_','');
    const custom = document.getElementById('worldCustomCategory')?.value || '';
    const sel = document.getElementById('worldCategory');
    return custom || sel?.selectedOptions?.[0]?.textContent || sel?.value || g.data?.selectedWorldCategory || '';
  }
  function removeNode(el){
    if (!el) return;
    const box = el.closest('.custom-section-builder,.form-section,.creator-section,fieldset,label,.form-row,.form-field,.full-span,.panel') || el;
    if (box && box.parentElement) box.remove();
  }
  function cleanItemsArtifactsForm(){
    if (!isItems(selectedCategory())) return;
    const form = [...document.querySelectorAll('[id^="worldCategoryAddForm_"], #worldAddForm')].find(el => !el.classList.contains('hidden')) || document.querySelector('.view.active');
    if (!form) return;
    // Remove old generated custom sections/cards that duplicate Link Tracker responsibilities.
    [...form.querySelectorAll('label,textarea,input,section,fieldset,details,h3,h4,legend,.custom-section-builder,.form-section,.creator-section')].forEach(el => {
      const text = `${el.textContent || ''} ${el.placeholder || ''} ${el.id || ''} ${el.name || ''}`.replace(/\s+/g,' ').trim();
      if (!text) return;
      if (/Link Tracker|Linked Trackers|Upload|Powers|Rules|Limits|History|Appearance|Plot Relevance/i.test(text)) return;
      if (/\bCurrent Owner\b|Owner’s\s*\/\s*Current Location|Owner's\s*\/\s*Current Location|\bOwners\b|\bCurrent Location\b/i.test(text)) removeNode(el);
    });
    // Clean the Basic Information helper text.
    [...form.querySelectorAll('input,textarea')].forEach(el => {
      if (el.placeholder) el.placeholder = el.placeholder
        .replace(/,?\s*current owner/ig,'')
        .replace(/owners?\s*\/\s*current location/ig,'')
        .replace(/current location/ig,'');
    });
    const walker = document.createTreeWalker(form, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      n.nodeValue = n.nodeValue
        .replace(/,?\s*current owner/ig,'')
        .replace(/Owner’s\s*\/\s*Current Location/ig,'')
        .replace(/Owner's\s*\/\s*Current Location/ig,'')
        .replace(/\bOwners\b/ig,'')
        .replace(/\bCurrent Location\b/ig,'');
    });
  }
  // Ensure base section templates no longer generate Owners / Current Location.
  const prevTemplates = g.worldCategorySectionTemplates;
  if (typeof prevTemplates === 'function' && !prevTemplates.__itemsArtifactsFinalFix) {
    const wrapped = function(category){
      const result = prevTemplates.apply(this, arguments);
      return isItems(category) && Array.isArray(result) ? result.filter(x => !/^owners?$/i.test(String(x)) && !/^current location$/i.test(String(x))) : result;
    };
    wrapped.__itemsArtifactsFinalFix = true;
    g.worldCategorySectionTemplates = wrapped;
  }
  // Ensure base config text stays clean.
  const prevConfig = g.worldCategoryFormConfig;
  if (typeof prevConfig === 'function' && !prevConfig.__itemsArtifactsFinalFix) {
    const wrapped = function(category){
      const cfg = prevConfig.apply(this, arguments);
      if (isItems(category) && cfg && Array.isArray(cfg.fields)) {
        cfg.fields = cfg.fields
          .filter(f => !/current owner|owners?\s*\/\s*current location|current location/i.test(String((f || []).join(' '))))
          .map(f => String(f?.[0]).toLowerCase() === 'basicinfo' ? [f[0], f[1] || 'Basic Information', 'Type, creator, age, rarity, material'] : f);
      }
      return cfg;
    };
    wrapped.__itemsArtifactsFinalFix = true;
    g.worldCategoryFormConfig = wrapped;
  }
  // Add Location tracking to Items/Artifacts creator configs.
  function ensureLocationTrackerConfig(){
    if (g.WORLD_CREATOR_TRACKER_CONFIG) {
      g.WORLD_CREATOR_TRACKER_CONFIG['items-artifacts'] = ['characterIds','locationIds','magicSystemIds','otherWorldIds'];
    }
  }
  function run(){ ensureLocationTrackerConfig(); cleanItemsArtifactsForm(); }
  ['renderAll','renderWorldCategoryPage','setView','toggleAddForm','renderWorldCreatorLinkedTrackers'].forEach(fn => {
    const prior = g[fn];
    if (typeof prior === 'function' && !prior[`__itemsArtifactsFinalFix_${fn}`]) {
      const wrapped = function(){ const result = prior.apply(this, arguments); setTimeout(run, 60); setTimeout(run, 250); return result; };
      wrapped[`__itemsArtifactsFinalFix_${fn}`] = true;
      g[fn] = wrapped;
    }
  });
  document.addEventListener('change', ev => {
    if (/worldCategory|worldCustomCategory/.test(ev.target?.id || '')) setTimeout(run, 80);
  }, true);
  document.addEventListener('DOMContentLoaded', () => setTimeout(run, 500));
  setTimeout(run, 1000);
})();
