# Architecture Operations Hub

Architecture Operations Hub is a browser-based workspace for managing Architecture demand, team capacity, allocations, roadmap planning, status reporting and improvement ideas.

## Workspace

Open the root workspace folder using **Open Workspace Folder**. The application reads folder-backed JSON records and autosaves committed changes back to the same workspace.

The expected workspace structure includes:

- `workspace.json`
- `demand/`
- `team/`
- `allocations/`
- `ideas/`
- `status-reports/`
- `config/`
- `backups/`

## Demand

Demand represents accepted Architecture work. Business Area and Title are required. Initiative is optional and constrained to the selected Business Area. Cost Centre / Project Code is optional.

Demand can link to two external process records:

- **Demand Source** — normally the SharePoint Front Door list item that originated the demand.
- **Work Item** — normally the Azure DevOps Epic or Feature used to manage the delivery work.

In Demand View mode these appear as hyperlinks. In Edit mode, URL and optional display title are edited separately. The Demand title itself links to its Demand Source when a source URL exists.

The browser attempts to populate a blank Demand Source display title when the URL field loses focus. It looks for `og:title`, `twitter:title`, a page `h1`, and the HTML title. This only succeeds where the target website allows the browser to read the page cross-origin. Authenticated SharePoint commonly blocks this with CORS, so the display title remains manually editable.

## Allocations and Resource Plan

Allocations are maintained as Demand + Team Member records with percentage allocations across the configured Planning Months. The **Work** column links the Demand to its Azure DevOps Work Item.

Resource Plan is a read-only reporting dashboard over those allocations. It shows capacity, allocated demand, unmet demand and individual utilisation. Allocation detail also links to the associated Work Item.

## Roadmap

Roadmap shows:

- the planned Demand window as a thin line with a circular start marker and diamond end marker;
- the resourced period as a thicker line derived from committed resource allocations.

Roadmap Demand titles link to their Azure DevOps Work Item where one is configured. Roadmap Edit mode changes planned Demand dates only. Resource allocation remains managed through Allocations.

## Status Reporting

**Status Report** maintains the current reporting draft for unresolved Demand. Report fields include RAG, Status Update, Achievements and Issues / Escalations.

Preview displays the report in a narrative layout. Publish creates an immutable snapshot in `status-reports/` and starts a fresh draft.

**Status Report History** lists all retained published reports. Historical reports are snapshots and are not changed when Demand records are edited later.

## Ideas

Ideas is a simple improvement backlog for the application. Ideas are stored under `ideas/` and use the normal Create, View, Edit, Save, Cancel and Delete behaviour.

## Configuration

Config maintains controlled reference data including Business Areas, Initiatives, Services, Demand Statuses, Priorities, Health States, Idea Statuses and Planning Months.

Initiatives have an owning Business Area. Demand can only select an Initiative owned by its selected Business Area.

## Backups and Autosave

Opening a workspace creates a safety snapshot under `backups/<timestamp>/` before normal use continues.

Retention keeps:

- every backup taken today;
- the first backup from each day within the last seven days;
- the first retained backup from each older calendar month.

Committed changes autosave shortly after **Save Changes**, with a periodic safety flush while outstanding changes remain. **Save Now** remains available as a manual fallback.

The Workspace tab lists the retained backup folders so they can be located for manual recovery.

## README tab

The in-app README tab loads this file from `src/docs/README.md`. If the application is opened directly with a `file://` URL, some browsers may block JavaScript `fetch()` of adjacent local files. Serving the `src/` directory over HTTP avoids that browser restriction.
