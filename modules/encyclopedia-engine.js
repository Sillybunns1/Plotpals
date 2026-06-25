(function(g){
  'use strict';
  const S = () => g.PlotPalsSchema;
  const arr = v => (S()?.arr ? S().arr(v) : (Array.isArray(v)?v:[]));
  function entryTitle(e){ return e?.name || e?.title || e?.term || 'Untitled'; }
  function entryType(e){ return e?.__type || e?.category || e?.type || 'Entry'; }
  function sourceCollections(data){
    return [
      ['character', data.characters], ['world', data.world], ['location', data.locations], ['magicSystem', data.magicSystems], ['organization', data.organizations], ['timeline', data.timeline], ['glossary', data.glossary], ['custom', data.customEncyclopediaCategories]
    ];
  }
  function buildEntries(data){
    data = S()?.migrateProjectData(data) || data;
    const entries=[];
    sourceCollections(data).forEach(([type, list])=>arr(list).forEach(item=> entries.push({...item, __type:type, title:entryTitle(item), source:item})));
    return entries;
  }
  function referencedBy(data, targetId){
    const out={characters:[], locations:[], organizations:[], events:[], items:[], scenes:[], relationships:[]};
    const has=(item, keys)=>keys.some(k=>arr(item?.[k]).includes(targetId) || item?.[k]===targetId);
    arr(data.characters).forEach(x=>{ if(has(x,['relatedCharacters','relatedLocations','relatedEvents','relatedOrganizations','relatedItems','raceId','birthplaceId','residenceId','organizationId','religionId','cultureId','magicSystemId'])) out.characters.push(x); });
    arr(data.locations).forEach(x=>{ if(has(x,['relatedCharacters','relatedLocations','relatedEvents','relatedOrganizations','relatedItems','governmentId','religionId','cultureId','controllingOrganizationId'])) out.locations.push(x); });
    arr(data.organizations).forEach(x=>{ if(has(x,['relatedCharacters','relatedLocations','relatedEvents','relatedOrganizations','relatedItems'])) out.organizations.push(x); });
    arr(data.timeline).forEach(x=>{ if(has(x,['relatedCharacters','relatedLocations','relatedEvents','relatedOrganizations','relatedItems','participantIds','locationIds','organizationIds'])) out.events.push(x); });
    arr(data.world).forEach(x=>{ if(has(x,['relatedCharacters','relatedLocations','relatedEvents','relatedOrganizations','relatedItems','currentOwnerId','previousOwnerId','createdById'])) out.items.push(x); });
    arr(data.books).forEach(book=>arr(book.manuscript).forEach(ch=>arr(ch.scenes).forEach(sc=>{ if(has(sc,['characterIds','locationIds','organizationIds','magicSystemIds','itemArtifactIds','floraFaunaIds','eventIds'])) out.scenes.push({book,chapter:ch,scene:sc}); })));
    arr(data.relationships).forEach(r=>{ if(r.characterAId===targetId || r.characterBId===targetId) out.relationships.push(r); });
    return out;
  }
  function findEntry(data,id){ return buildEntries(data).find(e=>e.id===id); }
  function openEntry(id){ if(typeof g.openEncyclopediaEntry==='function') g.openEncyclopediaEntry(id); }
  function installRenderController(){
    if(g.__plotPalsRenderControllerInstalled) return;
    g.__plotPalsRenderControllerInstalled = true;
    const legacyRender = g.renderEncyclopedia;
    g.renderEncyclopediaCore = legacyRender;
    g.renderEncyclopediaExtensions = function(){
      try{ g.renderRelationshipGraph?.(); }catch(e){ console.warn('Relationship graph extension failed', e); }
      try{ g.renderEncyclopediaRelationshipGraph?.(); }catch(e){ console.warn('Encyclopedia relationship extension failed', e); }
      try{ g.renderUnifiedEncyclopediaMap?.(); }catch(e){ console.warn('Map extension failed', e); }
      try{ g.renderUnifiedTimelineIntelligence?.(); }catch(e){ console.warn('Timeline extension failed', e); }
    };
    g.renderEncyclopedia = function(){
      const result = typeof legacyRender === 'function' ? legacyRender.apply(this, arguments) : undefined;
      setTimeout(()=>g.renderEncyclopediaExtensions(),0);
      return result;
    };
  }
  g.PlotPalsEncyclopediaEngine = { buildEntries, findEntry, referencedBy, openEntry, installRenderController };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installRenderController);
  else setTimeout(installRenderController,0);
})(window);
