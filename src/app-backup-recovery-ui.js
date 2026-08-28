/* Keep the Workspace/Admin explanation aligned with the weekly snapshot + delta journal model. */
(function initBackupRecoveryUi(){
  const section=document.getElementById('data');if(!section)return;
  const policy=[...section.querySelectorAll('.card')].find(card=>/^Backup policy$/i.test(card.querySelector('h2')?.textContent?.trim()||''));
  if(policy){const h=policy.querySelector('h2');if(h)h.textContent='Backup & recovery policy';const p=policy.querySelector('p');if(p)p.innerHTML='The first writable AMO session of each week creates one full <strong>Start-of-Week</strong> snapshot named for that week\'s Monday. Normal Local commits write before/after document images to <strong>backups/deltas/YYYY-MM-DD/</strong>. Delta history is retained for the current and preceding week; weekly backup creation also runs retention cleanup. Use <strong>Admin → Restore</strong> for point-in-time recovery.'}
})();
