/* Embedded README for file:// operation. Keep this Markdown snapshot aligned with the current AMO user guidance. */
(function initEmbeddedReadme(){
  const markdown = String.raw`# Architecture Management Office

Architecture Management Office manages Defined Demand, Work Packages, People, capacity, allocations, imported Oracle Actuals, roadmap planning and Status Reporting.

## System responsibilities

- **SharePoint Front Door** owns Raw Demand / intake.
- **Azure DevOps** owns triage/backlog execution, detailed Work Package scope, acceptance criteria and delivery tracking.
- **AMO** owns Defined Demand, Work Package portfolio metadata, People/capacity, Allocations, reporting and Actuals reconciliation.
- **Architecture repositories** own formal Architecture knowledge and approved artefacts.

## Defined Demand

A new Defined Demand requires only Title and Business Area. Initiative, Owning Team, Priority, Initial Size, Architecture Owner, Project Number, Health and Summary / Context can be added as the work matures.

Defined Demand does not own current Service, delivery dates, refined delivery estimate or Azure DevOps work item. Those delivery concerns belong to child Work Packages.

Project Number is optional and is the Oracle accounting/reconciliation reference. Legacy Cost Centre / Project Code is retired.

## Work Packages

Work Packages are nested beneath Defined Demand and store Title, Architecture Service, Status, Estimated Effort, Target Start / End and Azure DevOps Work Item Reference.

Detailed description/scope and acceptance criteria remain in the authoritative delivery backlog and are not duplicated in AMO.

## Reporting progression

AMO deliberately keeps four stages of knowledge distinct:

Initial Demand ROM → Work Package Estimate → Allocation Forecast → Actual Effort / Cost

Initial ROM preserves the early assessment expectation. Work Package Estimate is the current delivery decomposition and reports estimate coverage. Allocation Forecast is the named resource plan. Actuals are observed Oracle facts.

Across a reporting horizon, Projected effort/cost is Actual to date plus remaining Allocation Forecast. Projected resource effort is not the same as Work Package Estimate.

## Allocation FTE

Allocation percentages are fractions of the Person's available FTE. A 100% allocation for a 0.8 FTE Person therefore contributes 0.8 FTE, not 1.0 FTE.

Forecast days are Forecast FTE multiplied by working days in the month. Forecast cost uses the Person's configured Role day rate, falling back to the configured Default / blended day rate where necessary.

## Actuals and cost

Import Oracle Actuals through Admin → Actuals. Staff Number matches Oracle People # / Person # and Project Number reconciles Actuals to Defined Demand.

Imported Actual hours and Cost in GBP are authoritative. Actual days/FTE are derived from hours using Standard working hours per day. AMO never recalculates imported Actual cost from Role rates.

A loaded Actuals period uses Actuals as the reported value for that month; Allocation remains the planning baseline for variance and remains the reported source for future/non-imported months.

AMO does not invent Work-Package-level Actuals.

## Reporting assumptions

Config includes Standard working hours per day and Default / blended day rate. The blended rate values Initial ROM and Work Package estimates and is the fallback for missing Role rates. ROM/WP £ values are indicative; imported Oracle Actual £ remains authoritative.

## Resource Plan

Resource Plan is the primary capacity/resource-owner view. It shows FTE with days/£ context, Actual/Forecast effort, utilisation, Person variance, allocation percentage plus equivalent FTE, capacity value and recovery context.

## Dashboard

Dashboard remains concise. Capacity and attention measures use the same canonical Reporting Model as Resource Plan, including Person-FTE scaling.

## Roadmap

Roadmap is temporal. Delivery windows come from Work Package Target Start / End. Resource windows come from Demand-level Allocations. Retired Demand delivery dates are not operationalised.

## Status Reporting

The live Status Report is a narrative/Health authoring surface, not another Dashboard. New snapshots store Work Package-derived service context as a services list. Older immutable reports with a legacy singular service value remain readable.

Published/Preview output keeps concise portfolio/capacity context plus Demand effort signals and narrative; it does not recreate detailed Resource Plan financial tables.

## Workspace

AMO uses folder-backed JSON with Local and Remote workspace adapters, dirty tracking, autosave, safety backups and cooperative edit/concurrency controls. Multiple users may read a workspace; write operations use the appropriate locking/conflict controls.

## Operating sequence

1. Receive Raw Demand through the Front Door.
2. Triage fit, priority and whether the request belongs to existing Defined Demand.
3. Create/amend Defined Demand.
4. Define Work Packages and link Azure DevOps delivery work.
5. Plan People capacity using Demand-level Allocations.
6. Use Dashboard, Resource Plan and Roadmap to manage portfolio/capacity/schedule.
7. Import Oracle Actuals and reconcile through Staff Number + Project Number.
8. Review ROM, WP Estimate, Forecast and Actual/Projected position without conflating them.
9. Maintain and publish Status Reporting narrative/Health.
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