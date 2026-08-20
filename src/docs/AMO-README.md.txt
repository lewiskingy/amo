# Architecture Management Office (AMO)

Architecture Management Office is a browser-based workspace for managing Architecture demand, teams, capacity, allocations, roadmap planning, status reporting and improvement ideas. It is designed as a lightweight departmental operating tool: active data is stored as JSON records in a user-selected workspace folder and the application runs entirely in the browser.

This document is both the user guide and the technical overview for the current tactical implementation. Start with **Getting started** if you are using AMO for the first time. The later **Data model and storage** sections explain how the workspace works on disk.

## What AMO manages

AMO brings together the operational information needed to manage Architecture work without making every source system duplicate every field.

The main concepts are:

- **Department** — the Architecture department represented by the workspace.
- **Teams** — organisational teams within Architecture, such as Enterprise Architecture, Business Architecture or Domain teams.
- **People** — Architecture team members. Each person has a stable User ID and a Home Team.
- **Demand** — an Architecture engagement or work package. Demand has an Owning Team and can reference its originating SharePoint demand and its Azure DevOps work item.
- **Allocations** — the planned percentage of a person's capacity assigned to a Demand item for each configured planning month.
- **Configuration** — controlled reference data such as Business Areas, Initiatives, Teams, Services, workflows, priorities, Health and planning months.
- **Status Reports** — a working draft plus immutable published reporting snapshots.
- **Ideas** — an improvement backlog for AMO itself.

The important distinction in the team model is that **People have a Home Team while Demand has an Owning Team**. An architect can therefore contribute to Demand owned by another Team without moving either the person or the Demand between teams.

## User interface overview

The left navigation provides the main working views:

- **Dashboard** — department or team-level headline demand, capacity and attention information.
- **Demand** — the active Demand Register.
- **Allocations** — editable person-to-Demand monthly resource allocations.
- **Resource Plan** — reporting over capacity, allocation, utilisation and unmet demand.
- **Roadmap** — planned Demand dates compared with periods that have resource allocated.
- **Status Report** — the current reporting draft and latest published report.
- **Status Report History** — previous immutable published reports, loaded on demand when viewed.
- **People** — team members, Home Team and capacity metadata.
- **Ideas** — AMO improvement suggestions.
- **Config** — controlled reference data and planning configuration.
- **Workspace** — workspace, backup, autosave and edit-lock information.
- **README** — this guide rendered inside AMO.

A **Team View** selector at the top of the application changes the organisational scope. **Department View** shows the complete Architecture portfolio. Selecting a Team changes relevant operational views to that Team's portfolio.

The global command menu contains workspace and page-specific creation actions. Page-level workflow controls such as **Edit List**, **Edit Roadmap**, **Edit Draft**, **Clear Filters**, Save and Cancel remain close to the content they affect.

Double-clicking an existing editable record opens its single-record modal in **View** state. Use **Edit** to change it. New-record commands open the same modal directly in Edit state.

## Getting started

### 1. Open the application and workspace

Open AMO in a supported Chromium-based browser and choose **Open Workspace Folder**. Select the root data folder containing `workspace.json` and the entity folders described later in this guide.

AMO requests read/write access because it is a folder-backed application. Opening a valid workspace loads the active working data, creates a safety backup and performs archive maintenance. The selected directory handle can be remembered by the browser so the application can offer the previous workspace again on later use; browser permission may still need to be reconfirmed.

The workspace banner shows the current workspace, autosave state and edit-lock state.

### 2. Configure the department before entering Demand

For a new workspace, go to **Config** first. Configuration supplies the controlled values used by Demand, Allocations, Roadmap and reporting.

#### Planning Months

Planning Months define the planning horizon used consistently by Allocations, Resource Plan, Dashboard and Roadmap. Values use `YYYY-MM`, for example `2026-08`.

Keep the list focused on the period the department genuinely forecasts. Allocation percentage columns are generated from these values.

#### Teams

Teams represent the Architecture teams inside the Department. Each Team has a stable Team ID and a display name.

Team IDs are references used by People, Demand and reporting. Once records reference a Team, treat its ID as stable. Rename the Team display name if necessary rather than casually replacing its ID.

#### Business Areas

Business Areas represent the business departments or functions that originate Architecture demand. Business Area is mandatory on Demand.

Examples might be Finance, Operations or Customer Services, but use the organisational names appropriate to your department.

#### Initiatives

Initiatives represent major programmes or initiatives and are optional on Demand. Every Initiative must have one owning **Business Area**.

When creating an Initiative, first select its Business Area and then give it a name. When a user later creates or edits Demand, selecting a Business Area restricts the Initiative choices to Initiatives owned by that Business Area. AMO will not allow Demand to reference an Initiative belonging to another Business Area.

#### Services and Demand workflows

Architecture Service identifies the type of engagement. The operating model includes **Triage**, **Consultancy**, **Assurance**, **Design** and **Strategy**. Triage is the holding service before the engagement type is agreed.

Demand Status is constrained by the workflow for the selected Service. Triage can remain unassigned while work is being assessed. Once an official Architecture service is selected, Demand should have an Owning Team and progress through the lifecycle appropriate to that service.

#### Priorities and Health

Priorities provide the controlled priority choices used on Demand.

Health has three fixed business meanings:

- **On Track** — the target is expected to be met with the current plan.
- **At Risk** — the target is at risk without action, but recovery is expected to remain possible.
- **Off Track** — without action the target will not be met and recovery may be difficult or no longer possible.

These meanings should be applied consistently in Demand, Dashboard and Status Reporting.

### 3. Add People

Use **People** to create the Architecture team members who can own or be allocated to work.

Each person has a stable User ID, a **Home Team**, name, role, FTE and Active state. Home Team represents where the person organisationally belongs; it does not limit that person to work owned by the same Team.

FTE is used by Resource Plan to calculate available capacity. Keep it aligned with the person's effective capacity for the planning model.

### 4. Enter Demand manually

Go to **Demand** and choose **New Demand** from the command menu.

At minimum, capture the Business Area, Title and the other fields required by the current workflow. Initiative is optional and is filtered by Business Area. Cost Centre / Project Code is optional.

Demand has an **Owning Team**. This determines which Team portfolio the Demand belongs to when Team View is selected. Demand Owner is a person responsible for the engagement; changing the owner's Home Team does not automatically move the Demand to another Owning Team.

Demand can link to two external process records:

- **Demand Source** — normally the SharePoint Front Door/list item that originated the engagement.
- **Work Item** — normally the corresponding Azure DevOps Epic or Feature used to manage delivery work.

Both links allow a URL and display title. AMO may attempt to obtain a title from URL metadata, but authenticated SharePoint commonly prevents browser cross-origin metadata reads, so the display title remains manually editable.

The model deliberately permits more than one AMO Demand item to refer to the same source Demand. For example, an initial Consultancy engagement can later lead to a separate Design engagement while retaining the common source reference.

### 5. Plan dates on the Roadmap

The **Roadmap** shows two different planning concepts:

- a thin line from the Demand planned start date to planned end date, with a circle at the start and diamond at the end;
- a thicker line showing the period for which resource is actually allocated.

Choose **Edit Roadmap** to adjust planned Demand dates directly by dragging the start or end point. Roadmap editing changes Demand dates only. Resource allocation cannot be edited from Roadmap because allocation belongs to individual people and is maintained in the Allocations view.

Roadmap has a compact set of filters for Demand search, Initiative, Service and Health. Team filtering is intentionally not duplicated there because Team View already supplies the organisational scope. Roadmap rows are grouped by **Owning Team** and then **Initiative**.

### 6. Enter resource allocations

Use **Allocations** to plan which people will work on each unresolved Demand item.

An allocation is the combination of a Demand item and a Person, with a percentage for each configured Planning Month. The month columns therefore change when `planningMonths` changes in Config.

If Demand has an assigned owner but no committed allocation, AMO presents an owner row with zero allocation ready to edit. Additional resource rows remain inactive until a person is selected. Selecting a person activates the monthly values, initially at zero, so percentages can be entered quickly.

Additional people can be allocated to Demand owned by another Team. Allocation views follow the **Owning Team of the Demand**, while the person's Home Team remains their organisational home.

Use **Resource Plan** to inspect the result rather than editing the same information twice. Resource Plan derives capacity and utilisation from People and Allocations. It highlights total capacity, allocated resource, unmet Demand, individual utilisation and over-capacity periods.

### 7. Switch between Department and Team views

Use **Team View** at the top of AMO to switch between **Whole Department** and a specific Architecture Team.

The scope has deliberate semantics:

- Demand is filtered by **Demand Owning Team**.
- People are filtered by **Person Home Team**.
- Allocations and delivery reporting follow the Owning Team of the related Demand.
- Resource Plan compares home-team capacity with work owned by the selected Team and can therefore expose borrowed resources.
- Roadmap, Dashboard and Status Reporting use Team-owned Demand.

This means changing a person's Home Team does not move Demand they happen to own or contribute to. Change the Demand's Owning Team when portfolio accountability genuinely moves.

### 8. Maintain status reporting

The **Status Report** page is the working draft for unresolved Demand. Capture narrative only where there is something useful to report: Status Update, Achievements and Issues / Escalations, plus Health where appropriate.

Draft Health starts from the current Demand Health. A user can propose a different Health in the draft, but **Save Draft does not change Demand Health**. The proposed change is indicated in the UI. When the report is **Published**, the Health override is applied to the corresponding Demand and the immutable published report snapshots the resulting Demand Health. Latest published report Health and underlying Demand Health therefore agree at publication time.

Preview presents the report as a management narrative and includes the same portfolio headline snapshot as Dashboard: Active Demand, Unallocated, In Socialisation, In Governance, Capacity Conflicts, Capacity Outlook and Attention Required. Off Track active Demand is included in Attention Required.

Preview is clearly marked DRAFT. A report can be opened as a fully styled standalone window or sent to the browser Print dialog for printing / Save as PDF.

Published reports appear in **Status Report History**. Their report bodies are loaded from disk only when the user chooses View; AMO does not read every historical report JSON during normal workspace startup.

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

## Data model

AMO uses small JSON documents rather than one monolithic database file. Stable IDs are used to relate records.

Conceptually:

```text
Department
  ├─ Teams
  │    └─ People (Home Team)
  │
  └─ Demand (Owning Team)
        ├─ Business Area
        ├─ optional Initiative → owned by Business Area
        ├─ optional Demand Source URL
        ├─ optional Azure DevOps Work Item URL
        ├─ planned start/end dates
        ├─ Health / Service / Status / Priority
        └─ Allocations
              └─ Person + monthly percentage forecast

Status Report Draft
  └─ references active Demand

Published Status Reports
  └─ immutable snapshots of reporting content and portfolio state
```

### Department, Teams and People

The workspace represents one Architecture Department. Config defines multiple Teams within it. People reference a Team ID as their Home Team.

### Demand

Each Demand item is its own JSON record. It references controlled configuration values and an Owning Team. Demand is the central operational entity: Roadmap dates, external links, Health, workflow status and allocations all relate back to it.

### Business Areas and Initiatives

Business Areas are controlled reference values. Initiatives are structured configuration records containing an Initiative name and owning Business Area. Demand can omit Initiative, but if it has one, its Business Area must match the Initiative owner.

### Allocations

Each committed allocation is its own JSON record linking `demandId` and `teamMemberId`. Its forecast contains percentage values keyed by configured planning month. This separation lets one Demand have many allocated people and one person contribute to many Demand items.

### Status Reports

The current draft is working state in `status-reports/draft.json`. Published reports are separate immutable JSON snapshots. Historical report bodies are intentionally lazy-loaded to keep startup I/O independent of the number of reports accumulated over time.

## Workspace folder structure

A typical active workspace looks like:

```text
workspace-root/
  workspace.json
  .lock.json                 temporary; present only while editing
  config/
    settings.json
  demand/
    DEM-....json
  team/
    USR-....json
  allocations/
    ALLOC-....json
  ideas/
    IDEA-....json
  status-reports/
    draft.json
    SR-YYYYMMDD-HHMMSS.json  published history
  backups/
    YYYY-MM-DDTHH-MM-SS-mmm/
      ... safety snapshot ...
  archive/
    demand/
      DEM-....json
    allocations/
      ALLOC-....json
```

The active entity folders are the working database. `backups/` and `archive/` are maintenance areas and are not themselves part of the active record set.

## Saving and autosave

AMO dirty-tracks records/documents rather than rewriting the complete datastore after every change. Saving writes changed Demand, People, Allocation and Idea JSON records, configuration when changed, and status-report working documents when changed. Deleted records are removed from their active entity folder.

Committed changes request an autosave shortly afterwards, with a periodic safety flush if dirty data remains. The workspace banner shows the most recent successful autosave time. **Save Workspace** can also be used explicitly.

`workspace.json` is refreshed during a save to maintain the workspace modified timestamp.

## Safety backups

Opening a workspace creates a timestamped safety snapshot under `backups/` before normal work continues.

Backup retention is intentionally bounded:

- keep every backup taken today;
- for the preceding days within the seven-day window, keep the first backup from each day;
- for older history, keep the first retained backup from each calendar month.

Backups include `workspace.json`, active Demand, People, Allocations, Ideas, Config and **only the current Status Report draft**. Published Status Reports are excluded because they are already immutable historical snapshots and copying the complete report history into every backup would grow I/O and storage unnecessarily.

The `archive/` tree is also excluded from backup. Archived records are already retained outside the active database.

Backup folders are visible on the Workspace page for manual recovery. Recovery is intentionally a manual filesystem operation in this tactical implementation rather than an automatic restore wizard.

## Automatic archive

AMO keeps the active working set bounded by moving old terminal Demand out of the active folders.

During workspace load, Demand in a terminal state and last changed at least **28 days ago** is eligible for archive. Recognised terminal meanings include Completed/Complete, Closed, Cancelled/Canceled, Rejected/Reject, Declined, Withdrawn, Abandoned and Superseded. AMO requires a trustworthy `modifiedAt`, `updatedAt` or `createdAt` timestamp; it does not guess when no usable timestamp exists.

Archived Demand is written to `archive/demand/`. Any Allocation records related to that Demand are written to `archive/allocations/` so active allocations do not become orphaned.

The archive operation writes/overwrites the archive copy **before** deleting the active JSON. This makes the operation idempotent and safer if interrupted. If an old backup is manually restored and reintroduces a terminal record that was previously archived, the next workspace load archives it again and overwrites the existing archive copy for that ID.

Draft status-report entries referencing Demand that leaves the active set are removed from the working draft.

Archived records are not currently included in normal Dashboard, Demand, Roadmap or Resource Plan views.

## Published report lazy loading

Status Report History can grow for years without making normal workspace startup proportionally expensive.

At startup AMO reads `status-reports/draft.json` but, for published reports, initially enumerates only the JSON filenames. The filename provides enough information to list the report ID/date in history. The complete published report JSON is read only when the user clicks **View**. Once read, it is cached in memory for that browser session.

This is deliberately different from Demand, People, Allocations and Config, which are loaded eagerly because Dashboard, Resource Plan, Roadmap, filtering and validation need those records immediately.

## Multi-user editing and `.lock.json`

AMO permits multiple users to open and read the same folder-backed workspace. Editing uses a cooperative workspace-level `.lock.json` file so that only one browser session should edit at a time.

Simply opening the workspace does **not** acquire the lock. AMO requests it when the user begins an Edit/Create transaction or performs a one-shot write such as Publish.

On first edit, the browser asks for a display name and stores that identity locally in that browser. Browser JavaScript cannot reliably discover the logged-in Windows / Active Directory identity or filesystem owner, so the lock uses this explicit AMO identity.

The lock contains a random browser-session ID, user ID/display name, acquisition timestamp, heartbeat timestamp and expiry timestamp. The owning session refreshes it every minute. A lock with no heartbeat for **15 minutes** is considered stale and can be explicitly taken over.

After creating a lock, AMO reads it back twice before enabling editing to reduce simultaneous acquisition races. Save/Save Changes flushes committed changes before releasing the lock. Cancel releases it without creating new changes. If the browser crashes, the heartbeat stops and the lock eventually becomes stale.

This is **cooperative locking, not a transactional database lock**. It is appropriate to the tactical folder datastore and low-concurrency usage. A future hosted datastore should use server-side concurrency controls such as record versions / ETags or database transactions.

## External process links

AMO intentionally links rather than duplicates external process systems where possible.

**Demand Source** can link an AMO Demand item back to its SharePoint Front Door demand. **Work Item** can link it to the Azure DevOps Epic or Feature where detailed delivery work is managed. Architecture deliverables themselves remain governed and published in the organisation's Architecture libraries rather than being copied into the AMO datastore.

If configured, **AMO Assistant** appears at the top of navigation and launches the configured assistant URL in a new window. If the setting is blank, the navigation item is hidden. See **AMO Assistant** above for its intended support role and integration boundary.

## Browser and local-file considerations

AMO currently runs as a static browser application and can be opened directly using `file://`. The File System Access API is used for the selected workspace folder, so a compatible Chromium-based browser is required.

Browser security prevents a `file://` page from using `fetch()` to read arbitrary sibling files. This is why the README displayed inside AMO is not fetched directly from this text file.

The canonical documentation source is `src/docs/AMO-README.md.txt`. It deliberately retains Markdown formatting while using a `.txt` extension so systems such as document-search / Copilot tooling that accept text files can index it.

For runtime display, the same Markdown content is embedded in `src/app-readme-embedded.js`. The application renders that embedded snapshot on the README tab. When documentation changes, the embedded copy should be regenerated or updated from `AMO-README.md.txt` so the searchable documentation and in-app guide remain aligned.

## Operating guidance

A useful day-to-day sequence is:

1. Triage incoming work outside or at the front door and create accepted AMO Demand when it enters the managed Architecture portfolio.
2. Confirm Business Area, Service, Owning Team, scope and priority.
3. Link the source SharePoint demand and Azure DevOps work item where available.
4. Set or refine planned dates, including visually through Roadmap.
5. Allocate Architecture people across the configured planning months.
6. Use Dashboard and Resource Plan to identify unallocated work, capacity conflicts and Off Track Demand requiring attention.
7. Maintain the Status Report draft during the reporting period.
8. Publish the report when agreed; publication synchronises any approved Health changes back to Demand and creates the immutable reporting snapshot.
9. Allow completed/terminal work to leave the active working set automatically after the archive threshold rather than keeping operational views indefinitely cluttered.

This keeps AMO focused on departmental demand, ownership, capacity, planning and reporting while SharePoint, Azure DevOps and Architecture repositories continue to own the process information and deliverables for which they are the appropriate systems of record.
