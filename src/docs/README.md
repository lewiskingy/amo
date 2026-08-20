# Architecture Operations Hub

Architecture Operations Hub is a browser-based workspace for managing Architecture demand, team capacity, allocations, roadmap planning, status reporting and improvement ideas.

## Workspace

Open the root workspace folder using **Open Workspace Folder**. The application reads folder-backed JSON records and autosaves committed changes back to the same workspace.

The expected workspace structure includes `workspace.json`, `demand/`, `team/`, `allocations/`, `ideas/`, `status-reports/`, `config/`, `backups/` and, while somebody is editing, a temporary `.lock.json` file.

The workspace represents an Architecture Department containing configured Teams. The global Scope selector can show the Whole Department or one Team across Demand, People, Allocations, Resource Plan, Roadmap and reporting.

## Multi-user editing and workspace lock

Multiple users may open and read the same folder-backed workspace at the same time. Editing uses a cooperative workspace-level `.lock.json` file so only one browser session edits at once.

Opening a workspace does not acquire a lock. The lock is requested only when the user enters an Edit/Create transaction or performs a write action such as Publish. The browser asks for a display name the first time editing is attempted and stores that identity locally in the browser; normal browser JavaScript cannot reliably discover the logged-in Windows/Active Directory user or NTFS file owner.

The lock records a random session ID, browser user identity, acquired time, heartbeat time and expiry time. It is refreshed every minute. A lock with no heartbeat for 15 minutes is considered stale and can be explicitly taken over. After writing a new lock, the client verifies the session ID twice before enabling editing to reduce simultaneous-acquisition races.

Save/Save Changes flushes committed record changes to disk before releasing the lock. Cancel releases the lock without creating new changes. If a browser crashes or disappears, its lock naturally becomes stale and can later be taken over.

This is cooperative locking rather than a transactional database lock. It is appropriate for the tactical folder datastore and low concurrency, but a future hosted API/database should replace it with server-side concurrency controls.

## Demand

Demand represents accepted Architecture work. Business Area and Title are required. Initiative is optional and constrained to the selected Business Area. Cost Centre / Project Code is optional. Demand also belongs to an owning Architecture Team.

Demand can link to two external process records: **Demand Source** for the SharePoint Front Door item and **Work Item** for the Azure DevOps Epic or Feature. In Demand View mode these appear as hyperlinks; in Edit mode URL and optional display title are edited separately. The Demand title links to its Demand Source when a source URL exists.

The browser attempts to populate a blank Demand Source display title when the URL loses focus. It checks Open Graph title, Twitter title, the first page heading and the HTML title. This only works when the remote site permits browser cross-origin reads. Authenticated SharePoint commonly blocks this with CORS, so the display title remains manually editable.

## Service workflows

Demand Status is constrained by the selected Architecture Service. New Demand begins under the holding **Triage** service. Config maintains ordered permitted lifecycle statuses for Triage, Consultancy, Assurance, Design and Strategy. These are guidance lists rather than rigid state-transition rules.

## Allocations and Resource Plan

Allocations are Demand + Team Member records with percentage allocations across configured Planning Months. The **Work** column links to the Demand's Azure DevOps Work Item. Resource Plan is a read-only dashboard over allocations and its allocation detail also links to Work Items.

## Dashboard

The dashboard headline measures are **Active Demand**, **Unallocated**, **In Socialisation**, **In Governance** and **Capacity Conflicts**. In Governance includes Demand whose lifecycle state contains Approval or Governance. In Socialisation includes Socialisation states. Capacity Outlook and Attention Required complete the management summary.

## Roadmap

Roadmap shows the planned Demand window as a thin line with circle/diamond endpoints, and the resourced period as a thicker line derived from committed allocations. Roadmap Demand titles link to their Azure DevOps Work Item where configured. Roadmap Edit changes planned Demand dates only.

## Status Reporting

**Status Report** maintains the current reporting draft for unresolved Demand. Report fields include RAG, Status Update, Achievements and Issues / Escalations. Preview displays a narrative report; Publish creates an immutable snapshot under `status-reports/` and starts a fresh draft.

The Status Report page also displays the same headline portfolio information as Dashboard above the working draft: Active Demand, Unallocated, In Socialisation, In Governance, Capacity Conflicts, Capacity Outlook and Attention Required. Preview captures that management summary, and Publish stores it inside the historical report so later portfolio changes do not alter the published snapshot. Department reports also retain Team ownership so historical reports can be viewed by Department or Team scope.

**Status Report History** lists retained published snapshots.

## Ideas

Ideas is an improvement backlog stored under `ideas/` using the normal Create, View, Edit, Save, Cancel and Delete behaviour.

## Configuration

Config maintains controlled reference data including Teams, Business Areas, Initiatives, Services, service-specific Demand workflows, Priorities, Health States, Idea Statuses and Planning Months. Initiatives have an owning Business Area.

## Backups and Autosave

Opening a workspace creates a safety snapshot under `backups/<timestamp>/`. Retention keeps every backup today, the first backup per day within the last seven days, and the first retained backup from each older calendar month. The Workspace tab lists retained backup folders for manual recovery.

Committed changes are dirty-tracked at record/document level. Autosave rewrites only changed Demand, Person, Allocation and Idea JSON files, plus configuration or status-report documents when those are dirty. `workspace.json` is also refreshed to update its modified timestamp. Autosave runs after committed changes with a periodic safety flush, and the workspace banner displays the last successful autosave time.

The quick Light/Dark toggle is browser-local in multi-user mode so a display preference does not create a shared workspace write or lock requirement.

## README tab

The in-app README tab loads this file from `src/docs/README.md`. Some browsers block local `fetch()` when the application is opened directly with `file://`; serving `src/` over HTTP avoids that restriction.
