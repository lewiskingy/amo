/* Workspace startup UI deliberately relies on the canonical top-bar Open Workspace button.
   Automatic remembered-workspace reconnect is handled by app-workspace-memory.js. */
(function initWorkspaceStartupAction(){
  document.getElementById('workspaceStartupAction')?.remove();
})();
