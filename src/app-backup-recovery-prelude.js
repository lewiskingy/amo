/* Small compatibility helpers required before app-backup-recovery.js initialises. */
window.escapeHtml=window.escapeHtml||function(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
