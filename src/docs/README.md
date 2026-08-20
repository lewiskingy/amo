# Architecture Operations Hub

Architecture Operations Hub is a browser-based workspace for managing Architecture demand, team capacity, allocations, roadmap planning, status reporting and improvement ideas.

## Workspace

Open the root workspace folder using **Open Workspace Folder**. The application reads folder-backed JSON records and autosaves committed changes back to the same workspace.

The expected workspace structure includes `workspace.json`, `demand/`, `team/`, `allocations/`, `ideas/`, `status-reports/`, `config/` and `backups/`.

## Demand

Demand represents accepted Architecture work. Business Area and Title are required. Initiative is optional and constrained to the selected Business Area. Cost Centre / Project Code is optional.

Demand can link to two external process records: **Demand Source** for the SharePoint Front Door item and **Work Item** for the Azure DevOps Epic or Feature. In Demand View mode these appear as hyperlinks; in Edit mode URL and optional display title are edited separately. The Demand title links to its Demand Source when a source URL exists.

The browser attempts to populate a blank Demand Source display title when the URL loses focus. It checks Open Graph title, Twitter title, the first page heading and the HTML title. This only works when the remote site permits browser cross-origin reads. Authenticated SharePoint commonly blocks this with CORS, so the display title remains manually editable.

### Service workflows

Demand Status is constrained by the selected Architecture Service. New Demand starts as **Triage / Triage** and can then be classified into Consultancy, Assurance, Design or Strategy.

The default workflows are:

- **Triage:** Triage, Prioritisation, Accepted, Rejected, Closed.
- **Consultancy:** Assessment, Prioritisation, Mobilisation, In Progress, Review, Complete, On Hold, Cancelled.
- **Assurance:** Assessment, Prioritisation, Mobilisation, Assurance Review, Findings / Remediation, Governance / Approval, Complete, On Hold, Cancelled.
- **Design:** Assessment, Prioritisation, Mobilisation, Discovery, Analysis / Design, Socialisation / Review, Approval, Governance, Complete, On Hold, Cancelled.
- **Strategy:** Assessment, Prioritisation, Mobilisation, Discovery, Analysis, Strategy Development, Socialisation / Review, Approval, Governance, Complete, On Hold, Cancelled.

These are ordered permitted states, not a rigid transition engine. Users may move between any status configured for the selected Service. Changing Service resets an incompatible Status to the first configured stage for the new Service.

## Allocations and Resource Plan

Allocations are Demand + Team Member records with percentage allocations across configured Planning Months. The **Work** column links to the Demand's Azure DevOps Work Item. Resource Plan is a read-only dashboard over allocations and its allocation detail also links to Work Items.

## Roadmap

Roadmap shows the planned Demand window as a thin line with circle/diamond endpoints, and the resourced period as a thicker line derived from committed allocations. Roadmap Demand titles link to their Azure DevOps Work Item where configured. Roadmap Edit changes planned Demand dates only.

## Status Reporting

**Status Report** maintains the current reporting draft for unresolved Demand. Report fields include RAG, Status Update, Achievements and Issues / Escalations. Preview displays a narrative report; Publish creates an immutable snapshot under `status-reports/` and starts a fresh draft.

**Status Report History** lists retained published snapshots.

## Ideas

Ideas is an improvement backlog stored under `ideas/` using the normal Create, View, Edit, Save, Cancel and Delete behaviour.

## Configuration

Config maintains controlled reference data including Business Areas, Initiatives, Services, Service Workflows, Priorities, Health States, Idea Statuses and Planning Months. Initiatives have an owning Business Area.

Service Workflows are maintained alongside Service Offerings. The flat `statuses` value in `settings.json` is derived automatically as the union of configured workflow states for compatibility with existing filters and older workspace data.

## Backups and Autosave

Opening a workspace creates a safety snapshot under `backups/<timestamp>/`. Retention keeps every backup today, the first backup per day within the last seven days, and the first retained backup from each older calendar month. The Workspace tab lists retained backup folders for manual recovery.

Committed changes autosave after **Save Changes**, with a periodic safety flush. **Save Now** remains available as a manual fallback.

## README tab

The in-app README tab loads this file from `src/docs/README.md`. Some browsers block local `fetch()` when the application is opened directly with `file://`; serving `src/` over HTTP avoids that restriction.
