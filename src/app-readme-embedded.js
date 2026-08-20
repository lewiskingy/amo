/* Embedded README for file:// operation. Keep this Markdown snapshot aligned with docs/AMO-README.md.txt. */
(function initEmbeddedReadme(){
  const markdown = "# Architecture Management Office\n\nArchitecture Management Office is a browser-based workspace for managing Architecture demand, team capacity, allocations, roadmap planning, status reporting and improvement ideas.\n\n## Workspace\n\nOpen the root workspace folder using **Open Workspace Folder**. The application reads folder-backed JSON records and autosaves committed changes back to the same workspace.\n\nThe expected workspace structure includes `workspace.json`, `demand/`, `team/`, `allocations/`, `ideas/`, `status-reports/`, `config/`, `backups/` and, while somebody is editing, a temporary `.lock.json` file.\n\nThe workspace represents an Architecture Department containing configured Teams. The global Team View selector can show the Whole Department or one Team across Demand, People, Allocations, Resource Plan, Roadmap and reporting.\n\n## Multi-user editing and workspace lock\n\nMultiple users may open and read the same folder-backed workspace at the same time. Editing uses a cooperative workspace-level `.lock.json` file so only one browser session edits at once.\n\nOpening a workspace does not acquire a lock. The lock is requested only when the user enters an Edit/Create transaction or performs a write action such as Publish. The browser asks for a display name the first time editing is attempted and stores that identity locally in the browser; normal browser JavaScript cannot reliably discover the logged-in Windows/Active Directory user or NTFS file owner.\n\nThe lock records a random session ID, browser user identity, acquired time, heartbeat time and expiry time. It is refreshed every minute. A lock with no heartbeat for 15 minutes is considered stale and can be explicitly taken over. After writing a new lock, the client verifies the session ID twice before enabling editing to reduce simultaneous-acquisition races.\n\nSave/Save Changes flushes committed record changes to disk before releasing the lock. Cancel releases the lock without creating new changes. If a browser crashes or disappears, its lock naturally becomes stale and can later be taken over.\n\nThis is cooperative locking rather than a transactional database lock. It is appropriate for the tactical folder datastore and low concurrency, but a future hosted API/database should replace it with server-side concurrency controls.\n\n## Demand\n\nDemand represents accepted Architecture work. Business Area and Title are required. Initiative is optional and constrained to the selected Business Area. Cost Centre / Project Code is optional. Demand also belongs to an owning Architecture Team.\n\nDemand can link to two external process records: **Demand Source** for the SharePoint Front Door item and **Work Item** for the Azure DevOps Epic or Feature. In Demand View mode these appear as hyperlinks; in Edit mode URL and optional display title are edited separately. The Demand title links to its Demand Source when a source URL exists.\n\nThe browser attempts to populate a blank Demand Source display title when the URL loses focus. It checks Open Graph title, Twitter title, the first page heading and the HTML title. This only works when the remote site permits browser cross-origin reads. Authenticated SharePoint commonly blocks this with CORS, so the display title remains manually editable.\n\n## Service workflows\n\nDemand Status is constrained by the selected Architecture Service. New Demand begins under the holding **Triage** service. Config maintains ordered permitted lifecycle statuses for Triage, Consultancy, Assurance, Design and Strategy. These are guidance lists rather than rigid state-transition rules.\n\n## Allocations and Resource Plan\n\nAllocations are Demand + Team Member records with percentage allocations across configured Planning Months. The **Work** column links to the Demand's Azure DevOps Work Item. Resource Plan is a read-only dashboard over allocations and its allocation detail also links to Work Items.\n\n## Dashboard\n\nThe dashboard headline measures are **Active Demand**, **Unallocated**, **In Socialisation**, **In Governance** and **Capacity Conflicts**. In Governance includes Demand whose lifecycle state contains Approval or Governance. In Socialisation includes Socialisation states. Capacity Outlook and Attention Required complete the management summary.\n\n## Roadmap\n\nRoadmap shows the planned Demand window as a thin line with circle/diamond endpoints, and the resourced period as a thicker line derived from committed allocations. Roadmap Demand titles link to their Azure DevOps Work Item where configured. Roadmap Edit changes planned Demand dates only.\n\n## Status Reporting\n\n**Status Report** maintains the current reporting draft for unresolved Demand. Report fields include Health, Status Update, Achievements and Issues / Escalations. Health uses the controlled values **On Track**, **At Risk** and **Off Track**. Draft Health can propose a change; Demand Health is updated only when the report is published, and the immutable published report snapshots the resulting Demand Health.\n\nThe Status Report page also displays the same headline portfolio information as Dashboard above the working draft: Active Demand, Unallocated, In Socialisation, In Governance, Capacity Conflicts, Capacity Outlook and Attention Required. Preview captures that management summary, and Publish stores it inside the historical report so later portfolio changes do not alter the published snapshot. Department reports also retain Team ownership so historical reports can be viewed by Department or Team scope.\n\n**Status Report History** lists retained published snapshots.\n\n## Ideas\n\nIdeas is an improvement backlog stored under `ideas/` using the normal Create, View, Edit, Save, Cancel and Delete behaviour.\n\n## Configuration\n\nConfig maintains controlled reference data including Teams, Business Areas, Initiatives, Services, service-specific Demand workflows, Priorities, Health States, Idea Statuses and Planning Months. Initiatives have an owning Business Area. The application name **Architecture Management Office** is fixed product identity and is not workspace-configurable.\n\n## Backups and Autosave\n\nOpening a workspace creates a safety snapshot under `backups/<timestamp>/`. Retention keeps every backup today, the first backup per day within the last seven days, and the first retained backup from each older calendar month. The Workspace tab lists retained backup folders for manual recovery.\n\nCommitted changes are dirty-tracked at record/document level. Autosave rewrites only changed Demand, Person, Allocation and Idea JSON files, plus configuration or status-report documents when those are dirty. `workspace.json` is also refreshed to update its modified timestamp. Autosave runs after committed changes with a periodic safety flush, and the workspace banner displays the last successful autosave time.\n\nThe quick Light/Dark toggle is browser-local in multi-user mode so a display preference does not create a shared workspace write or lock requirement.\n\n## README tab\n\nThe canonical documentation source is `src/docs/AMO-README.md.txt`. It deliberately retains Markdown formatting while using a `.txt` extension so it can be indexed by tools that accept text files but not `.md` files. The in-app README is generated as an embedded Markdown snapshot in `src/app-readme-embedded.js` so it works when AMO is opened directly with `file://`, where browser security prevents `fetch()` from reading a sibling documentation file.\n";

  window.AMO_README_MARKDOWN = markdown;

  const escapeHtml = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const inline = text => escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/`([^`]+)`/g,'<code>$1</code>');

  function markdownHtml(source){
    const lines=String(source||'').replace(/\r/g,'').split('\n');
    let html='', paragraph=[], list=[];
    const flushParagraph=()=>{if(paragraph.length){html+=`<p>${inline(paragraph.join(' '))}</p>`;paragraph=[]}};
    const flushList=()=>{if(list.length){html+=`<ul>${list.map(x=>`<li>${inline(x)}</li>`).join('')}</ul>`;list=[]}};
    for(const line of lines){
      if(!line.trim()){flushParagraph();flushList();continue}
      const heading=line.match(/^(#{1,3})\s+(.+)$/);
      if(heading){flushParagraph();flushList();const level=heading[1].length;html+=`<h${level}>${inline(heading[2])}</h${level}>`;continue}
      const bullet=line.match(/^[-*]\s+(.+)$/);
      if(bullet){flushParagraph();list.push(bullet[1]);continue}
      flushList();paragraph.push(line.trim());
    }
    flushParagraph();flushList();return html;
  }

  function ensureReadmePresentation(){
    ensureReadmeTab?.();
    const section=document.getElementById('readme');
    const old=document.getElementById('readmeContent');
    if(!section||!old)return null;
    let host=old;
    if(old.tagName==='PRE'){
      host=document.createElement('article');host.id='readmeContent';host.className='readme-markdown';old.replaceWith(host);
    }
    const intro=section.querySelector('.hero p');
    if(intro)intro.innerHTML='Application usage and operating notes bundled with AMO as Markdown.';
    return host;
  }

  loadReadme=function(){
    const host=ensureReadmePresentation();if(!host)return;
    host.innerHTML=markdownHtml(window.AMO_README_MARKDOWN);readmeLoaded=true;
  };

  const style=document.createElement('style');style.id='embedded-readme-styles';style.textContent=`
    .readme-markdown{max-width:980px;line-height:1.62;color:var(--ink)}
    .readme-markdown h1{font-size:1.8rem;margin:.1rem 0 1rem}.readme-markdown h2{font-size:1.25rem;margin:1.8rem 0 .55rem;padding-top:.15rem;border-top:1px solid var(--line)}
    .readme-markdown h3{font-size:1.05rem;margin:1.25rem 0 .45rem}.readme-markdown p{margin:.55rem 0 1rem}.readme-markdown ul{margin:.5rem 0 1rem;padding-left:1.35rem}
    .readme-markdown code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.88em;padding:.12rem .34rem;border-radius:5px;background:var(--soft);color:var(--accent2)}
    html[data-theme="dark"] .readme-markdown code{background:#172447;color:#c9d6ff}
  `;document.head.appendChild(style);
})();