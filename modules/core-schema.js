(function(g){
  'use strict';
  const COLLECTIONS = [
    'series','books','characters','relationships','timeline','chapterPlans','threads','scenes','world','locations','magicSystems','organizations','mysteries','foreshadowing','plotArcs','plotCards','structureBeats','seriesArcs','themeTracks','bookHandoffs','seriesMilestones','characterKnowledge','characterVoices','characterTies','storyQuestions','prophecies','plotThreads','objectOwnership','emotionalArcs','glossary','customEncyclopediaCategories','encyclopediaSources','encyclopediaRegions','encyclopediaRoutes'
  ];
  const WORLD_CATEGORIES = ['Locations','Organizations','Religions','Races/Species','Magic Systems','Governments','Historical Events','Cultures','Items/Artifacts','Flora & Fauna','Languages','Other'];
  const REL_TYPES = ['Marriage','Family','Friendship','Ally','Enemy','Rival','Mentor','Student','Love Interest','Former Lover','Coworker','Creator','Owner','Member','Other'];
  const DEFAULT_PROJECT_TIME_SETTINGS = {
    storyYear:'', storyMonth:'', storyDay:'', calendarType:'Real World', datePrecision:'year',
    fantasyMonths:'', fantasyDaysPerMonth:'', fantasyWeekdays:'', fantasyEras:'', customCalendarNotes:''
  };
  function arr(v){ return Array.isArray(v) ? v : []; }
  function str(v){ return v == null ? '' : String(v); }
  function id(prefix='id'){
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  }
  function normalizeTags(v){
    if(Array.isArray(v)) return v.map(str).map(x=>x.trim()).filter(Boolean);
    return str(v).split(',').map(x=>x.trim()).filter(Boolean);
  }
  function normalizeMeta(obj){
    if(!obj || typeof obj !== 'object') return obj;
    obj.id = obj.id || id('entry');
    obj.tags = normalizeTags(obj.tags || obj.tagsText || '');
    obj.tagsText = obj.tags.join(', ');
    obj.importance = obj.importance || obj.entryImportance || 'Minor';
    obj.loreImportance = obj.loreImportance || 'Minor Lore';
    obj.canonStatus = obj.canonStatus || 'Canon';
    obj.relatedCharacters = arr(obj.relatedCharacters || obj.relatedCharacterIds || obj.characterIds).filter(Boolean);
    obj.relatedLocations = arr(obj.relatedLocations || obj.relatedLocationIds || obj.locationIds).filter(Boolean);
    obj.relatedEvents = arr(obj.relatedEvents || obj.relatedEventIds || obj.eventIds).filter(Boolean);
    obj.relatedOrganizations = arr(obj.relatedOrganizations || obj.relatedOrganizationIds || obj.organizationIds).filter(Boolean);
    obj.relatedItems = arr(obj.relatedItems || obj.relatedItemIds || obj.itemIds || obj.itemArtifactIds).filter(Boolean);
    return obj;
  }
  function normalizeRelationship(rel){
    if(!rel || typeof rel !== 'object') return rel;
    rel.id = rel.id || id('rel');
    const a = rel.characterAId || rel.character1Id || rel.fromId || rel.char1 || rel.sourceId || rel.a || '';
    const b = rel.characterBId || rel.character2Id || rel.toId || rel.char2 || rel.targetId || rel.b || '';
    rel.characterAId = a;
    rel.characterBId = b;
    rel.type = rel.type || rel.relationshipType || rel.kind || 'Other';
    if(!REL_TYPES.includes(rel.type)) rel.type = rel.type || 'Other';
    let strength = parseInt(rel.strength ?? rel.weight ?? rel.closeness ?? 5, 10);
    if(!Number.isFinite(strength)) strength = 5;
    rel.strength = Math.max(1, Math.min(10, strength));
    return normalizeMeta(rel);
  }
  function migrateProjectData(data){
    if(!data || typeof data !== 'object') data = {};
    COLLECTIONS.forEach(k=>{ if(!Array.isArray(data[k])) data[k]=[]; });
    data.projectTimeSettings = {...DEFAULT_PROJECT_TIME_SETTINGS, ...(data.projectTimeSettings||{}), ...(data.timelineSettings||{})};
    delete data.timelineSettings;
    if(!data.encyclopediaMap || typeof data.encyclopediaMap !== 'object') data.encyclopediaMap = {};
    data.encyclopediaMap.image = data.encyclopediaMap.image || data.encyclopediaMap.imageUrl || '';
    data.encyclopediaMap.pins = arr(data.encyclopediaMap.pins).map(p=>normalizeMeta({...p, x:Number(p.x||0), y:Number(p.y||0)}));
    data.encyclopediaMap.regions = arr(data.encyclopediaMap.regions).map(r=>normalizeMeta(r));
    data.encyclopediaMap.routes = arr(data.encyclopediaMap.routes).map(r=>normalizeMeta(r));
    data.relationships = arr(data.relationships).map(normalizeRelationship).filter(r=>r && r.characterAId && r.characterBId);
    ['characters','world','locations','magicSystems','organizations','timeline','glossary','customEncyclopediaCategories','plotCards','plotArcs'].forEach(k=>{ data[k]=arr(data[k]).map(normalizeMeta); });
    arr(data.books).forEach(book=>{
      book.id = book.id || id('book');
      book.manuscript = arr(book.manuscript);
      book.manuscript.forEach(ch=>{
        ch.id = ch.id || id('chapter');
        ch.scenes = arr(ch.scenes);
        ch.scenes.forEach(sc=>{
          sc.id = sc.id || id('scene');
          ['characterIds','organizationIds','magicSystemIds','itemArtifactIds','floraFaunaIds','locationIds','eventIds'].forEach(k=>{ sc[k]=arr(sc[k]); });
          if(sc.locationId && !sc.locationIds.includes(sc.locationId)) sc.locationIds.unshift(sc.locationId);
        });
      });
    });
    data.schemaVersion = 3;
    return data;
  }
  function validateProjectData(data){
    const errors=[], warnings=[];
    if(!data || typeof data !== 'object') errors.push('Project data is not an object.');
    if(data){
      COLLECTIONS.forEach(k=>{ if(!Array.isArray(data[k])) errors.push(`${k} must be an array.`); });
      const ids = new Set();
      ['series','books','characters','world','locations','magicSystems','organizations','timeline','glossary'].forEach(k=>arr(data[k]).forEach(item=>{
        if(!item || typeof item !== 'object') return warnings.push(`${k} contains a non-object item.`);
        if(!item.id) warnings.push(`${k} item missing id.`);
        else if(ids.has(item.id)) warnings.push(`Duplicate id found: ${item.id}`);
        else ids.add(item.id);
      }));
      arr(data.relationships).forEach(rel=>{
        if(!rel.characterAId || !rel.characterBId) warnings.push(`Relationship ${rel.id||'(missing id)'} is missing a character endpoint.`);
        if(rel.characterAId === rel.characterBId) warnings.push(`Relationship ${rel.id||'(missing id)'} links a character to itself.`);
      });
    }
    return {valid: errors.length===0, errors, warnings};
  }
  g.PlotPalsSchema = { COLLECTIONS, WORLD_CATEGORIES, REL_TYPES, DEFAULT_PROJECT_TIME_SETTINGS, migrateProjectData, validateProjectData, normalizeMeta, normalizeRelationship, arr, id };
})(window);
