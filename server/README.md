# AMO Remote Workspace API

This is the first remote implementation of the AMO `WorkspaceRepository` contract. It deliberately uses the existing JSON workspace format on the server so that remote transport can be proven before introducing MongoDB or Entra ID.

## Run locally

From the repository root:

```bash
docker build -f server/Dockerfile -t amo-api .
docker run --rm -p 8080:8080 \
  -e AMO_ALLOWED_ORIGINS=http://localhost:8000,https://amo.theflat.me.uk \
  -v "$PWD/data/sample:/data/workspace" \
  amo-api
```

Then `GET http://localhost:8080/api/info` should return the AMO API capability document.

The mounted workspace must use the same structure as a Local Workspace (`workspace.json`, `config/`, `demand/`, `team/`, `allocations/`, `ideas/`, `status-reports/`). Writes are atomic at the individual JSON-file level using a temporary file and rename.

## Client

AMO now exposes **Local Workspace** and **Remote Workspace**. Remote Workspace asks for an API base URL, for example:

`https://api.amo.theflat.me.uk`

The last successful remote URL is remembered in browser local storage. A deployment can also set `window.AMO_CONFIG.defaultRemoteUrl` before the remote module loads.

## API surface

- `GET /api/info`
- `GET /api/workspace`
- `POST /api/workspace/save`
- `GET /api/records/:type`
- `GET|PUT|DELETE /api/records/:type/:id`
- `GET|PUT /api/settings`
- `GET /api/status-reports`
- `GET|PUT /api/status-reports/:id`
- `GET|PUT|DELETE /api/lock`
- `POST /api/archive`

The bulk save endpoint preserves AMO's dirty-record behaviour: only IDs included in the dirty/deleted sets are written or removed, while `workspace.json` receives its modified timestamp.

## Security

This prototype API has **no authentication**. Only expose it with non-sensitive sample data or behind a private access control. The intended production progression is Entra-authenticated API access before real departmental data is hosted remotely.

`AMO_ALLOWED_ORIGINS` should be set to an explicit comma-separated list for hosted use. Example:

`AMO_ALLOWED_ORIGINS=https://amo.theflat.me.uk`

## Why JSON first instead of MongoDB

The first remote version intentionally retains the JSON datastore. It validates the browser repository contract, REST transport, locking, lazy report loading and dirty-record writes independently of a database migration. A later `MongoWorkspaceRepository` can replace the server JSON repository behind the same HTTP API without changing AMO's UI/domain code.
