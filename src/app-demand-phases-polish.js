/* Final UI polish for lifecycle Phase extension. */
(function polishDemandPhases(){
  const priorRenderConfig=renderConfig;
  renderConfig=function(){
    const result=priorRenderConfig();
    const cards=[...document.querySelectorAll('#configContent .config-card')].filter(card=>card.querySelector('h2')?.textContent.trim()==='Lifecycle Phases');
    cards.slice(0,-1).forEach(card=>card.remove());
    return result
  };
})();