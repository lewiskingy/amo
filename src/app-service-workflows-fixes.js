/* Load-order fixes for service workflow extension. */
renderConfig=function(){
  if(configState.editing&&configState.draft&&!configState.draft.serviceWorkflows)configState.draft.serviceWorkflows=clone(serviceWorkflows());
  baseRenderConfigWorkflow();
  if(!workspaceHandle)return;
  const content=$('configContent'),grid=content?.querySelector('.config-grid');
  if(grid)grid.insertAdjacentHTML('beforeend',renderWorkflowConfigCard());
  if(configState.editing)content.querySelectorAll('[data-workflow-service]').forEach(el=>el.addEventListener('input',e=>{
    configState.draft.serviceWorkflows=configState.draft.serviceWorkflows||{};
    configState.draft.serviceWorkflows[e.target.dataset.workflowService]=e.target.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  }));
};
/* app-5 bound the earlier openWorkspace function before this extension loaded. */
$('openWorkspaceBtn').onclick=openWorkspace;
