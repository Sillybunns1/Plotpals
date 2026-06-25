(function(g){
  'use strict';
  function validateBeforeSave(data){
    const schema = g.PlotPalsSchema;
    if(!schema) return {valid:true, errors:[], warnings:[]};
    let candidate = data;
    try { candidate = JSON.parse(JSON.stringify(data)); } catch(_) { candidate = data; }
    candidate = schema.migrateProjectData(candidate);
    const result = schema.validateProjectData(candidate);
    g.__lastPlotPalsValidation = result;
    if(!result.valid){
      console.error('PlotPals save blocked by validation errors:', result.errors);
      return result;
    }
    if(result.warnings.length) console.warn('PlotPals validation warnings:', result.warnings);
    return result;
  }
  g.PlotPalsStorageValidation = { validateBeforeSave };
})(window);
