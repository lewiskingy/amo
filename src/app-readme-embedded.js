/* Embedded README for file:// operation. Keep this Markdown snapshot aligned with the current AMO user guidance. */
(function initEmbeddedReadme(){
  const markdown = String.raw`# Architecture Management Office

AMO manages Defined Demand, Work Packages, People/capacity, Work Package Resource Plans, imported Oracle Actuals, roadmap planning and Status Reporting.

## Target architecture

This is the canonical target architecture for the AMO browser client. Existing global-state renderers, renderer wrappers, compatibility interception and DOM post-processing are legacy implementation to be migrated, not alternative target architectures.

AMO remains one product and one deployed client. The target is a modular route-based client with a reusable shared shell and bounded route-owned application slices such as /demand, /allocations, /people and /reports.

Shared application concerns have one canonical implementation: application shell, sidebar/navigation, page header, account/sign-on presentation, workspace status, organisational scope and reusable UI primitives such as filter bars, tables, badges, buttons and empty states.

Each route owns page composition only. Business semantics belong in reusable domain/query modules and persistence is accessed through stable repository contracts such as WorkspaceRepository. Route code must not depend directly on storage location, global renderer state or unrelated page implementations.

Target dependency direction:

Application shell → route-owned page → page components → domain/query services → repository contracts → Local or Remote persistence

The migration uses a strangler approach. /demand is the first proving slice: build it over the same workspace data, dark-launch it, prove parity with deterministic local Playwright E2E and deployed Test acceptance, then cut primary navigation over and remove the superseded legacy Demand implementation. Allocations, People and subsequent capabilities follow the same pattern.

Local browser E2E is intended to run in CI before deployment using a transient seeded writable workspace and a test-only repository/bootstrap mechanism. Deployed acceptance remains the second layer for deployment identity, authentication, Remote Workspace/API integration and selected critical journeys.

Implementation and migration are tracked in GitHub issue **#183 — Target client architecture: modular route-owned application slices**.

## Planning model

AMO keeps each planning measure distinct:

Initial ROM → Budget Forecast → Work Package Estimate → Work Package Resource Plan → Actual / Projected

**Budget Forecast** is the current effort forecast for budgetary and portfolio-planning purposes. It is not an approved financial budget or authorisation to spend.

**Work Package Estimate** is the delivery estimate for an individual package. Demand WP Estimate is the sum of populated child estimates, with estimate coverage retained.

**Resource Plan** is named-person capacity planned against Work Packages. New allocations are Person × Work Package × Month; Demand totals are derived roll-ups.

Existing records without Work Package identity remain explicit legacy / undecomposed allocations until a user assigns them to a valid child Work Package. AMO never guesses the relationship.

## Actuals and projected effort

Oracle Actuals reconcile through Staff Number and Demand Project Number. They remain Demand/Project-level facts and AMO does not invent Work-Package-level Actuals.

For imported periods, Actuals are reported; otherwise Allocation Forecast is reported. Across the horizon:

Actual to date + remaining Allocation Forecast = Projected effort / cost

Projected effort is compared with Budget Forecast using wording such as **above Budget Forecast**, not “over budget”.

## Defined Demand

Defined Demand is the parent portfolio boundary. It may hold Initial ROM, Budget Forecast, Project Number, ownership and portfolio context. Service, delivery dates and detailed delivery definition belong to child Work Packages.

## Work Packages

Work Packages hold title, Architecture Service, delivery Status, Estimated Effort, Target Start / End and backlog work-item reference. Detailed scope and acceptance criteria remain in the authoritative delivery backlog.

## Resource planning

The canonical path is:

Demand → Work Package → Person → Monthly allocation

Allocation percentage is a fraction of Person available FTE. Forecast days/cost use canonical ReportingModel calculations and Person Role rates with blended/default fallback.

## Reporting

Demand reporting shows ROM, Budget Forecast, WP Estimate, Resource Plan, Actual to date and Projected effort together without conflating them.

Resource Plan remains the capacity/resource-owner view and adds Demand planning position plus Work-Package-aware allocation detail. In Actual periods, Work Package detail retains the plan while stating that Actuals are held at parent Demand.

Dashboard adds material planning variance and undecomposed-allocation items to Attention Required.

Roadmap uses Work Package dates for delivery windows and the roll-up of Work Package Resource Plan allocations for the parent Demand resource line.

Status Reporting remains narrative/Health focused. Preview/Published snapshots persist report-time planning context so historical reports do not read live current values later.

## Management signals

AMO can surface missing Budget Forecast, incomplete WP estimate coverage, material WP/Resource/Projected variance against Budget Forecast and legacy undecomposed allocations. These are management prompts, not accounting assertions.

## System responsibilities

- **SharePoint Front Door** owns intake.
- **Azure DevOps / Jira** owns detailed delivery backlog content.
- **AMO** owns Defined Demand, Work Package portfolio metadata, Budget Forecast, Work Package Resource Plan, reporting and Actuals reconciliation.
- **Architecture repositories** own formal Architecture knowledge and approved artefacts.

## Operating sequence

1. Receive and triage Raw Demand.
2. Create or amend Defined Demand.
3. Establish ROM and maintain Budget Forecast as understanding matures.
4. Decompose delivery into Work Packages and estimate them.
5. Allocate named People to Work Packages by month.
6. Compare Budget Forecast → WP Estimate → Resource Plan.
7. Import Oracle Actuals and review Actual + remaining plan = Projected position.
8. Maintain and publish Status Reporting narrative/Health.
`;

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