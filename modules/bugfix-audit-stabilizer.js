(function(g){
  'use strict';
  const arr = v => Array.isArray(v) ? v : [];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function migrateNow(){
    if(g.data && g.PlotPalsSchema){
      g.data = g.PlotPalsSchema.migrateProjectData(g.data);
      delete g.data.timelineSettings;
      if(g.data.customCategories && !g.data.customEncyclopediaCategories?.length){
        g.data.customEncyclopediaCategories = g.data.customCategories;
      }
      delete g.data.customCategories;
      g.data.relationships = arr(g.data.relationships).map(g.PlotPalsSchema.normalizeRelationship).filter(r=>r && r.characterAId && r.characterBId);
    }
  }

  const STOP_TERMS = new Set(['a','an','and','the','of','in','on','at','to','for','from','with','by','as','is','are','was','were','be','been','being','fall','rise','light','dark','night','day','man','woman','girl','boy','king','queen','city','town','road','river','sea','war','love','death','life','blood','magic','time','home','house','hand','eye','eyes','hair']);
  g.plotpalsIsSafeSourceTerm = function(term, kind=''){
    const t = String(term||'').trim();
    if(!t) return false;
    const low = t.toLowerCase();
    if(STOP_TERMS.has(low)) return false;
    if(kind === 'glossary' && !/\s/.test(t) && t.length < 5) return false;
    if(!/\s/.test(t) && t.length < 4) return false;
    return t.length >= 3;
  };
  g.plotpalsSourceRegex = function(term, kind=''){
    if(!g.plotpalsIsSafeSourceTerm(term, kind)) return null;
    const q = String(term).trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return new RegExp(`(^|[^\\p{L}\\p{N}])(${q})(?=$|[^\\p{L}\\p{N}])`, 'giu');
  };

  // Keep old onclicks from breaking, but route them to the canonical encyclopedia opener.
  g.openWikiEntry = function(id){
    if(typeof g.openEncyclopediaEntry === 'function') return g.openEncyclopediaEntry(id);
    g.selectedEncyclopediaEntryId = id;
    g.setView?.('encyclopedia');
  };

  // One public relationship normalizer used by graph/search/encyclopedia.
  g.normalizeAllRelationships = function(){
    if(!g.data) return [];
    const normalizer = g.PlotPalsSchema?.normalizeRelationship || (r=>r);
    g.data.relationships = arr(g.data.relationships).map(normalizer).filter(r=>r && r.characterAId && r.characterBId && r.characterAId !== r.characterBId);
    return g.data.relationships;
  };

  // Safe, explicit restore only. No automatic IndexedDB restore from this point forward.
  const previousRestore = g.restoreIndexedDBProjectMirror;
  g.restoreIndexedDBProjectMirror = async function(){
    if(!confirm('Restore the browser backup mirror? This replaces the current loaded project.')) return;
    return previousRestore?.apply(this, arguments);
  };

  // Unified search facade: all newer search panels can call this regardless of which old function rendered the panel.
  g.runUnifiedEncyclopediaSearch = function(query){
    migrateNow();
    if(g.PlotPalsSearchEngine?.search) return g.PlotPalsSearchEngine.search(g.data, query);
    return {query, results:[], grouped:{exact:[], fuzzy:[]}};
  };

  // Final render pipeline: call the existing render once, then one extension pass.
  const previous = g.renderEncyclopedia;
  if(typeof previous === 'function' && !previous.__auditStabilized){
    const stable = function(){
      migrateNow();
      const result = previous.apply(this, arguments);
      setTimeout(()=>{
        try{ g.normalizeAllRelationships(); }catch(e){}
        try{ g.renderEncyclopediaExtensions?.(); }catch(e){ console.warn('Final encyclopedia extension pass failed', e); }
        try{ g.plotpalsRenderEncyclopediaFinalExtensions?.(document); }catch(e){ console.warn('Final encyclopedia UI pass failed', e); }
      }, 80);
      return result;
    };
    stable.__auditStabilized = true;
    g.renderEncyclopedia = stable;
  }

  // Validation-before-save wrapper: migrate once, validate a clone, block only hard errors.
  const previousSave = g.saveData;
  if(typeof previousSave === 'function' && !previousSave.__auditValidated){
    const save = function(render=true, scheduleCloud=true){
      migrateNow();
      const validation = g.PlotPalsStorageValidation?.validateBeforeSave?.(g.data);
      if(validation && !validation.valid){
        console.error('PlotPals save blocked by validation errors:', validation.errors);
        alert?.('Save blocked: project data needs repair. Check the console for details.');
        return false;
      }
      return previousSave.apply(this, arguments);
    };
    save.__auditValidated = true;
    g.saveData = save;
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', migrateNow);
  else setTimeout(migrateNow,0);
})(window);
