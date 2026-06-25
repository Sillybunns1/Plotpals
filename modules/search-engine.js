(function(g){
  'use strict';
  const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
  const tokens=s=>norm(s).split(/[^a-z0-9]+/).filter(Boolean);
  function levenshtein(a,b){ a=norm(a); b=norm(b); const m=[]; for(let i=0;i<=b.length;i++)m[i]=[i]; for(let j=0;j<=a.length;j++)m[0][j]=j; for(let i=1;i<=b.length;i++)for(let j=1;j<=a.length;j++)m[i][j]=b.charAt(i-1)===a.charAt(j-1)?m[i-1][j-1]:Math.min(m[i-1][j-1]+1, Math.min(m[i][j-1]+1, m[i-1][j]+1)); return m[b.length][a.length]; }
  function fuzzyContains(text, query){
    const q=tokens(query); if(!q.length) return false;
    const t=tokens(text); return q.every(qt=> t.some(tt=> tt.includes(qt) || qt.includes(tt) || (qt.length>3 && levenshtein(tt,qt)<=1) || (qt.length>6 && levenshtein(tt,qt)<=2)));
  }
  function scoreEntry(entry, query, data){
    const q=norm(query); if(!q) return {score:1, reasons:['all entries']};
    let score=0; const reasons=[];
    const title=norm(entry.title||entry.name||entry.term);
    const aliases=[entry.aliases, entry.aliasesText, entry.nickname, entry.shortName].flat().join(' ');
    const tags=[entry.tags, entry.tagsText].flat().join(' ');
    const body=[entry.description,entry.basicInfo,entry.history,entry.notes,entry.personality,entry.physicalDescription,entry.definition].join(' ');
    if(title===q){score+=120; reasons.push('exact title');}
    else if(title.includes(q)){score+=100; reasons.push('title');}
    if(norm(aliases).includes(q)){score+=90; reasons.push('alias');}
    if(norm(tags).includes(q)){score+=80; reasons.push('tag');}
    if(norm(body).includes(q)){score+=50; reasons.push('body');}
    if(fuzzyContains(`${entry.title} ${aliases} ${tags}`, query) && score<70){score+=45; reasons.push('fuzzy');}
    const refs = g.PlotPalsEncyclopediaEngine?.referencedBy(data, entry.id);
    if(refs){ const count=Object.values(refs).reduce((n,v)=>n+(Array.isArray(v)?v.length:0),0); if(count && q && norm(JSON.stringify(refs)).includes(q)){score+=60; reasons.push('reference');} }
    return {score,reasons};
  }
  function search(data, query, opts={}){
    const entries = g.PlotPalsEncyclopediaEngine?.buildEntries(data) || [];
    const results = entries.map(e=>({...e, __search:scoreEntry(e, query, data)})).filter(e=>e.__search.score>0).sort((a,b)=>b.__search.score-a.__search.score || String(a.title).localeCompare(String(b.title)));
    const grouped={exact:[], fuzzy:[], characters:[], locations:[], events:[], items:[], glossary:[], other:[]};
    results.forEach(r=>{
      if(r.__search.reasons.includes('exact title') || r.__search.reasons.includes('title')) grouped.exact.push(r);
      else if(r.__search.reasons.includes('fuzzy')) grouped.fuzzy.push(r);
      const type=r.__type||'';
      if(type==='character') grouped.characters.push(r);
      else if(type==='location') grouped.locations.push(r);
      else if(type==='timeline') grouped.events.push(r);
      else if(type==='glossary') grouped.glossary.push(r);
      else if((r.category||'').toLowerCase().includes('item')) grouped.items.push(r);
      else grouped.other.push(r);
    });
    return {query, results, grouped};
  }
  g.PlotPalsSearchEngine={ search, scoreEntry, fuzzyContains };
})(window);
