/* Keep the in-app README aligned with the canonical AMO-README.md.txt Assistant guidance. */
(function extendEmbeddedReadmeWithAssistant(){
  if(typeof window.AMO_README_MARKDOWN!=='string')return;
  if(window.AMO_README_MARKDOWN.includes('\n## AMO Assistant\n'))return;
  const section=`

## AMO Assistant

**AMO Assistant** is an optional agentic companion to the application. When its URL is configured in Config, AMO displays an **AMO Assistant** launch item at the top of the navigation. The Assistant opens in a separate window so users can work with it alongside the AMO application. If no URL is configured, the navigation item is hidden.

The Assistant is intended to provide conversational help around both **the tool** and **the Architecture work stack**. Depending on the knowledge and integrations made available to the configured assistant, useful interactions include:

- explaining how to use AMO views, fields, filters, Team View, Roadmap, Allocations and Status Reporting;
- helping a user understand the AMO operating model, terminology, service workflows and Health semantics;
- answering questions about how Demand, People, Teams, Initiatives, Allocations and reports relate to one another;
- helping interpret portfolio information such as unallocated Demand, capacity conflicts, Off Track items, upcoming work or the purpose of a particular status-report field;
- supporting triage and planning conversations by explaining what information should be captured and where it should be maintained;
- helping users find or understand information about the wider Architecture work stack when that information has been supplied to the Assistant, for example process guidance, Front Door material, Azure DevOps working practices or Architecture repository guidance;
- providing support and troubleshooting guidance for common AMO usage questions.

The Assistant should be treated as a **supporting interaction layer**, not as a replacement system of record. AMO remains the source for the portfolio records it manages; SharePoint, Azure DevOps and Architecture repositories remain authoritative for the external process records and deliverables that they own. Users should verify material changes in the appropriate system rather than treating an Assistant answer as a committed AMO transaction.

The current AMO client only stores and launches the configured Assistant URL. It does not automatically transmit the open workspace, selected Demand, Team View or other browser state to the Assistant. Any deeper agent integration — for example securely querying AMO through a future backend API, opening a specific Demand context, or performing authorised actions — would be a separate application-integration capability.
`;
  const marker='\n## Data model\n';
  window.AMO_README_MARKDOWN=window.AMO_README_MARKDOWN.includes(marker)
    ? window.AMO_README_MARKDOWN.replace(marker,section+marker)
    : window.AMO_README_MARKDOWN+section;
})();
