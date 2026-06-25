// PlotPals modular bootstrap shim.
// Main legacy-compatible app code is bundled into app.bundle.min.js.
// Feature engines live in /modules and attach to window.PlotPals* namespaces.
(function(g){
  'use strict';
  try{
    if(g.data && g.PlotPalsSchema) g.data = g.PlotPalsSchema.migrateProjectData(g.data);
    g.PlotPalsEncyclopediaEngine?.installRenderController?.();
    g.PlotPalsTimelineEngine?.installTimelineCompatibility?.();
  }catch(err){ console.warn('PlotPals modular bootstrap warning:', err); }
})(window);
