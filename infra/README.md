# AMO API - Azure deployment

This folder provisions the first remote AMO backend proof on Azure.

## Architecture

- Cloudflare Pages (or another static host) serves `src/`.
- Azure Container Apps hosts the API container from `server/`.
- Azure Container Registry stores versioned API images.
- Azure Files is mounted at `/data/workspace` and contains the existing AMO JSON workspace format.
- GitHub Actions authenticates to Azure with OpenID Connect (OIDC), builds a commit-SHA-tagged image, pushes it to ACR and updates the Container App.

This is intentionally the JSON repository implementation. It proves the client/repository/API boundary before introducing MongoDB or Entra authentication for application users.

> The current API is unauthenticated. Use sample/non-sensitive data only, or put the API behind private/access controls until application authentication is implemented.

## 1. One-time local Azure preparation

Sign in and choose the subscription:

```bash
az login
az account set --subscription '<subscription-id>'
```

Register the providers used by Container Apps:

```bash
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.ContainerRegistry
az provider register --namespace Microsoft.Storage
```

Create a resource group, for example:

```bash
az group create --name rg-amo-personal --location uksouth
```

The GitHub workflow deploys `infra/main.bicep` into this resource group. The Bicep template creates:

- Basic Azure Container Registry;
- StorageV2 account and `amo-workspace` Azure Files share;
- Container Apps managed environment;
- Container App with a system-managed identity;
- Azure Files environment storage and `/data/workspace` mount;
- AcrPull role for the Container App identity.

## 2. Configure GitHub-to-Azure OIDC

Create a Microsoft Entra application/service principal (or suitable user-assigned managed identity) for GitHub Actions and add a federated credential for this repository.

For deployment from the GitHub environment used by the workflow, the federated subject should correspond to:

```text
repo:lewiskingy/amo:environment:azure-personal
```

Grant that deployment principal sufficient rights on the AMO resource group to deploy resources and assign the Container App's AcrPull role. For a personal proof, `Contributor` plus `User Access Administrator` scoped to the resource group is simple. Tighten this for a production/corporate deployment.

Create a GitHub Environment named:

```text
azure-personal
```

Add these **environment secrets**:

```text
AZURE_CLIENT_ID
AZURE_TENANT_ID
AZURE_SUBSCRIPTION_ID
```

The workflow uses OIDC; there is no Azure client secret stored in GitHub.

## 3. GitHub environment variables

Add these variables to the `azure-personal` environment:

```text
AZURE_RESOURCE_GROUP=rg-amo-personal
AMO_AZURE_NAME_PREFIX=<globally-unique-lowercase-prefix>
AMO_ALLOWED_ORIGIN=https://amo.theflat.me.uk
```

`AMO_AZURE_NAME_PREFIX` is used to derive globally named resources such as the storage account and registry. Keep it short and use lowercase letters/numbers, for example `lkamo01`.

## 4. First infrastructure deployment

The workflow can provision the infrastructure automatically on a `main` deployment, but it is useful to validate Bicep once from Azure CLI first:

```bash
az deployment group what-if \
  --resource-group rg-amo-personal \
  --template-file infra/main.bicep \
  --parameters namePrefix=lkamo01 allowedOrigin=https://amo.theflat.me.uk
```

Then deploy if desired:

```bash
az deployment group create \
  --resource-group rg-amo-personal \
  --template-file infra/main.bicep \
  --parameters namePrefix=lkamo01 allowedOrigin=https://amo.theflat.me.uk
```

## 5. Seed the remote JSON workspace

The Azure Files share starts empty. Before opening Remote Workspace, copy a sample workspace into the share root so that `/data/workspace/workspace.json` exists in the API container.

Retrieve the generated storage account name from the deployment output or Azure portal. A simple proof can upload the repo's `data/sample` contents using Azure CLI/AzCopy or Storage Explorer.

The resulting share must look like:

```text
amo-workspace/
  workspace.json
  config/
  demand/
  team/
  allocations/
  ideas/
  status-reports/
```

Do not add an extra `sample/` directory level below the share root.

## 6. Continuous deployment

`.github/workflows/deploy-api.yml` behaves as follows:

- pull requests touching `server/**`, `infra/**` or the workflow: Docker build only;
- pushes to `main`: authenticate with Azure using OIDC, deploy/update Bicep, build the API image, push it to ACR as `amo-api:<git-sha>`, update the Container App and smoke-test `/api/info`;
- `workflow_dispatch`: allows a manual redeployment.

The image is always deployed by immutable commit SHA rather than relying on `latest`.

## 7. Client connection

After the Container App is healthy, its default endpoint is available from the Bicep output `containerAppFqdn`.

For the first proof, enter this URL directly in AMO's **Remote Workspace** dialog:

```text
https://<container-app-fqdn>
```

Once that works, map your preferred hostname such as `api.amo.theflat.me.uk` and use that as the remote URL.

## 8. Next security/data steps

This scaffold deliberately stops before production security. The intended next stages are:

1. prove Remote Workspace with sample JSON data;
2. add Entra authentication and API authorization;
3. remove the workspace-wide cooperative locking restriction in favour of server-side/record concurrency where appropriate;
4. implement `MongoWorkspaceRepository` (or another approved managed datastore) behind the unchanged REST/client repository contract;
5. retain JSON workspace import/export as a portable backup/interchange format.
