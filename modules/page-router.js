/* PlotPals page router
   Separates the app into four clear page-level destinations while keeping the existing SPA data model intact. */
(function(){
  const ROUTES = {
    main: { label: 'Main Page', title: 'Main Page', view: null, page: 'main-page' },
    'project-dashboard': { label: 'Project Dashboards', title: 'Project Dashboard', view: 'projectDashboard', page: 'project-dashboard-page' },
    'book-overview': { label: 'Book Overviews', title: 'Book Overview', view: 'overview', page: 'book-overview-page' },
    encyclopedia: { label: 'Encyclopedias', title: 'Encyclopedia', view: 'encyclopedia', page: 'encyclopedia-page' }
  };
  const VIEW_TO_ROUTE = {
    projectDashboard: 'project-dashboard',
    overview: 'book-overview',
    encyclopedia: 'encyclopedia'
  };
  let internalHashChange = false;

  function currentRoute(){
    return (location.hash || '#/main').replace(/^#\/?/, '') || 'main';
  }
  function setHash(route){
    if(currentRoute() === route) return;
    internalHashChange = true;
    location.hash = `/${route}`;
    setTimeout(()=>{ internalHashChange = false; }, 0);
  }
  function activeProjectReady(){
    return !!(window.data && data.user?.id && data.activeSeriesId && data.activeBookId);
  }
  function applyPageState(route){
    const cfg = ROUTES[route] || ROUTES.main;
    document.body.dataset.appPage = cfg.page;
    document.querySelectorAll('[data-page-link]').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.pageLink === route);
      btn.setAttribute('aria-current', btn.dataset.pageLink === route ? 'page' : 'false');
    });
    const crumb = document.getElementById('pageCrumb');
    if(crumb) crumb.textContent = cfg.label;
  }
  function navigatePage(route){
    const cfg = ROUTES[route] || ROUTES.main;
    applyPageState(route);
    setHash(route);
    if(route === 'main'){
      if(typeof window.backToProjects === 'function') window.backToProjects();
      return;
    }
    if(!activeProjectReady()) return;
    if(typeof window.setView === 'function' && cfg.view) window.setView(cfg.view);
  }
  function renderPageNav(){
    const html = `
      <nav class="page-nav" aria-label="Primary pages">
        <button type="button" data-page-link="main" onclick="navigatePage('main')">🏠 Main Page</button>
        <button type="button" data-page-link="project-dashboard" onclick="navigatePage('project-dashboard')">📊 Project Dashboards</button>
        <button type="button" data-page-link="book-overview" onclick="navigatePage('book-overview')">📘 Book Overviews</button>
        <button type="button" data-page-link="encyclopedia" onclick="navigatePage('encyclopedia')">📖 Encyclopedias</button>
      </nav>`;
    const workspaceSidebar = document.querySelector('#sidebar .brand');
    if(workspaceSidebar && !document.getElementById('workspacePageNav')){
      const wrap = document.createElement('div');
      wrap.id = 'workspacePageNav';
      wrap.innerHTML = html;
      workspaceSidebar.insertAdjacentElement('afterend', wrap);
    }
    const librarySidebar = document.querySelector('#projectScreen .story-sidebar .brand');
    if(librarySidebar && !document.getElementById('libraryPageNav')){
      const wrap = document.createElement('div');
      wrap.id = 'libraryPageNav';
      wrap.innerHTML = html;
      librarySidebar.insertAdjacentElement('afterend', wrap);
    }
    applyPageState(currentRoute());
  }

  const previousSetView = window.setView;
  window.setView = function(view,id=null,extra=null){
    const result = previousSetView ? previousSetView(view,id,extra) : undefined;
    const route = VIEW_TO_ROUTE[view];
    if(route){ applyPageState(route); setHash(route); }
    return result;
  };

  const previousBackToProjects = window.backToProjects;
  window.backToProjects = function(){
    applyPageState('main');
    setHash('main');
    return previousBackToProjects ? previousBackToProjects.apply(this, arguments) : undefined;
  };

  window.navigatePage = navigatePage;
  window.applyPageState = applyPageState;

  window.addEventListener('hashchange',()=>{
    if(internalHashChange) return;
    navigatePage(currentRoute());
  });
  document.addEventListener('DOMContentLoaded',()=>{
    renderPageNav();
    applyPageState(currentRoute());
  });
  const previousRenderAll = window.renderAll;
  if(previousRenderAll){
    window.renderAll = function(){
      const result = previousRenderAll.apply(this, arguments);
      renderPageNav();
      applyPageState(VIEW_TO_ROUTE[data?.currentView] || currentRoute());
      return result;
    };
  }
})();
