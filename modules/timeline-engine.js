(function(g){
  'use strict';
  const arr=v=>g.PlotPalsSchema?.arr ? g.PlotPalsSchema.arr(v) : (Array.isArray(v)?v:[]);
  function settings(data){ return {...(g.PlotPalsSchema?.DEFAULT_PROJECT_TIME_SETTINGS||{}), ...(data?.projectTimeSettings||{})}; }
  function parseYear(v){ const n=parseInt(v,10); return Number.isFinite(n)?n:null; }
  function calculateRelativeDate(data, meta={}){
    const s=settings(data); let base=parseYear(s.storyYear);
    if(meta.relativeTo==='event' && meta.relativeEventId){ const ev=arr(data.timeline).find(x=>x.id===meta.relativeEventId); base=parseYear(ev?.computedYear||ev?.year||ev?.date)||base; }
    if(meta.relativeTo==='chapter' && meta.relativeChapterId){ base=parseYear(meta.baseYear)||base; }
    if(meta.relativeTo==='scene' && meta.relativeSceneId){ base=parseYear(meta.baseYear)||base; }
    if(base==null) return {label:'Relative date pending', year:null, precision:meta.precision||s.datePrecision||'year'};
    const amount=parseInt(meta.offsetAmount||0,10)||0;
    const unit=meta.offsetUnit||'years';
    const dir=meta.offsetDirection==='after'?1:-1;
    let year=base;
    if(unit.startsWith('year')) year=base+(amount*dir);
    else if(unit.startsWith('month')) year=base+((amount*dir)/12);
    else if(unit.startsWith('day')) year=base+((amount*dir)/365);
    const rounded = Number.isInteger(year) ? year : Math.round(year*100)/100;
    return {year:rounded, label:String(rounded), precision:meta.precision||s.datePrecision||'year', calendarType:s.calendarType};
  }
  function buildTimeline(data){
    data=g.PlotPalsSchema?.migrateProjectData(data)||data;
    return arr(data.timeline).map(ev=>{
      const calc=ev.dateType==='relative' || ev.relativeTo ? calculateRelativeDate(data, ev) : {year:parseYear(ev.year||ev.date), label:ev.date||ev.year||'Unknown', precision:ev.precision||settings(data).datePrecision};
      ev.computedYear=calc.year;
      ev.computedDateLabel=calc.label;
      return ev;
    }).sort((a,b)=>(a.computedYear??999999)-(b.computedYear??999999));
  }
  function installTimelineCompatibility(){
    if(!g.data) return;
    g.data = g.PlotPalsSchema?.migrateProjectData(g.data) || g.data;
  }
  g.PlotPalsTimelineEngine={ settings, calculateRelativeDate, buildTimeline, installTimelineCompatibility };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installTimelineCompatibility);
  else setTimeout(installTimelineCompatibility,0);
})(window);
