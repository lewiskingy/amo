/* Sidebar navigation structure and dynamic item placement. */
(function initNavigationLayout(){
  function arrangeNavigation(){
    const nav=document.querySelector('.sidebar nav');
    const anchor=document.getElementById('primaryNavAnchor');
    if(!nav||!anchor)return;

    // README is a primary, always-visible item rather than part of a collapsible group.
    if(typeof ensureReadmeTab==='function')ensureReadmeTab();
    const readmeBtn=nav.querySelector('[data-view="readme"]');
    if(readmeBtn)nav.insertBefore(readmeBtn,anchor.nextSibling);
  }

  arrangeNavigation();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arrangeNavigation,{once:true});
  // Other integration scripts may add optional navigation entries during startup.
  setTimeout(arrangeNavigation,0);
})();
