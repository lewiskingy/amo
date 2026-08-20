/* Application identity is fixed product branding, not workspace configuration. */
(function initAmoBranding(){
  const APP_NAME='Architecture Management Office';
  document.title=`${APP_NAME} — MVP v14`;
  const brand=document.querySelector('.sidebar .brand');
  if(brand)brand.textContent=APP_NAME;
  document.querySelectorAll('*').forEach(el=>{
    if(el.children.length===0&&el.textContent?.includes('Architecture Operations Hub')){
      el.textContent=el.textContent.replaceAll('Architecture Operations Hub',APP_NAME)
    }
  });
})();
