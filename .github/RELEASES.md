# AMO release environments

AMO uses trunk-based environment promotion:

`feature branch -> pull request -> main -> Test -> explicit Production promotion`

`main` is the only integration branch. There is no long-lived test branch.

## Environments

| Purpose | Test | Production |
| --- | --- | --- |
| Web | `https://amo-test.theflat.me.uk` | `https://amo.theflat.me.uk` |
| API | `https://api.amo-test.theflat.me.uk` | `https://api.amo.theflat.me.uk` |
| GitHub Environment | `test-amo` | `prod-amo` |
| Cloudflare Worker | `amo-test` | `amo` |
| Azure name prefix | `amo-test` | existing production prefix (`amo`) |
| Data | isolated test Cosmos/Storage | production Cosmos/Storage |

The Bicep resource names are derived from the Azure name prefix, so `amo-test` provisions a separate Container App Environment, Container App, ACR, Cosmos Mongo account and Storage account.

## Release behaviour

### Pull request

The release workflow validates Bicep, builds the API container and syntax-checks browser JavaScript. It does not deploy.

### Merge to `main`

A push to `main` automatically deploys the commit to the `test-amo` GitHub Environment:

- API infrastructure/image -> isolated Test Azure resources
- frontend -> Cloudflare Worker `amo-test`
- smoke tests -> Test API and Test web origin

The Cloudflare Worker injects the environment-specific default Remote Workspace URL. `amo-test.theflat.me.uk` defaults to `https://api.amo-test.theflat.me.uk`; Production defaults to `https://api.amo.theflat.me.uk`.

### Production promotion

Run the **Validate and release AMO** workflow manually and supply the commit SHA that was tested. `workflow_dispatch` uses the `prod-amo` GitHub Environment and checks out that revision for both the API and frontend deployments.

Production promotion therefore deploys source from the tested commit rather than whatever happens to be at the tip of a separate release branch.

> The API image is rebuilt from the same commit into the environment-specific ACR. This is exact-source promotion, not yet strict binary build-once promotion. A future enhancement can promote a signed OCI image between registries if that level of artifact immutability becomes useful.

## One-time setup

Do these before merging the release-pipeline PR.

### 1. Stop Cloudflare from deploying `main` directly to Production

The existing Cloudflare Git/Workers Builds integration currently deploys the Production `amo` Worker from `main`. Disable its automatic production deployment. GitHub Actions becomes the deployment authority for both Test and Production.

Do not delete the `amo` Worker or its `amo.theflat.me.uk` custom domain.

### 2. Create GitHub Environment `test-amo`

Configure these variables:

- `AZURE_RESOURCE_GROUP` — resource group for Test. A separate resource group is preferable but the same RG is technically safe because the `amo-test` prefix produces separate named resources.
- `AMO_AZURE_NAME_PREFIX` = `amo-test`
- `AMO_ALLOWED_ORIGIN` = `https://amo-test.theflat.me.uk`
- `AMO_API_HOSTNAME` = `api.amo-test.theflat.me.uk`
- `AMO_CLOUDFLARE_WORKER` = `amo-test`
- `AMO_WEB_ORIGIN` = `https://amo-test.theflat.me.uk`

Configure these secrets, normally with the same deployment identities used by Production where appropriate:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

If the Azure secrets are repository-level rather than Environment-level, they do not need to be duplicated.

The Cloudflare token needs permission to deploy Workers in the account containing `theflat.me.uk`.

### 3. Allow Azure OIDC from `test-amo`

If the Azure app registration's current GitHub federated credential is scoped to the `prod-amo` Environment, add another federated credential for:

`repo:lewiskingy/amo:environment:test-amo`

Use the same GitHub Actions issuer/audience convention as the existing Production credential.

### 4. Production GitHub Environment

Ensure `prod-amo` has the existing Azure values plus:

- `AMO_API_HOSTNAME` = `api.amo.theflat.me.uk`
- `AMO_CLOUDFLARE_WORKER` = `amo`
- `AMO_WEB_ORIGIN` = `https://amo.theflat.me.uk`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Keep:

- `AMO_AZURE_NAME_PREFIX` = the current Production prefix
- `AMO_ALLOWED_ORIGIN` = `https://amo.theflat.me.uk`

If available for the repository/plan, configure `prod-amo` with a required reviewer so a Production job also receives an explicit Environment approval. The manual workflow run is already an explicit promotion gate even without this additional protection.

### 5. Test Cloudflare custom domain

The first successful frontend deployment creates/updates Worker `amo-test`. In Cloudflare, attach custom domain:

`amo-test.theflat.me.uk`

Leave the existing `amo.theflat.me.uk` custom domain attached to Worker `amo`.

### 6. Test API custom domain

The first Test API infrastructure deployment creates the Test Container App and exposes its generated `*.azurecontainerapps.io` FQDN. Create the required Cloudflare DNS CNAME for:

`api.amo-test.theflat.me.uk`

pointing to that Test Container App FQDN, with the DNS mode required by Azure Container Apps hostname validation. The workflow then binds the managed certificate and smoke-tests the custom hostname.

Because the target FQDN does not exist until the Test infrastructure has been provisioned, the first pipeline run may stop at the custom-hostname binding step. That is an expected bootstrap state: create the CNAME from the FQDN shown by the workflow/Azure, then re-run the failed workflow.

### 7. Google Identity Services

Add this JavaScript origin to the existing Google OAuth client used by AMO:

`https://amo-test.theflat.me.uk`

Without it, the Test application can load but Google sign-in will reject the origin.

## First release sequence

1. Complete steps 1–4 above.
2. Merge the release-pipeline PR to `main`.
3. Allow the automatic Test deployment to provision `amo-test` Azure/Cloudflare resources.
4. Complete the Test custom-domain bootstrap in steps 5–7 and re-run the Test workflow if necessary.
5. Confirm `amo-test.theflat.me.uk` talks only to `api.amo-test.theflat.me.uk` and Test data.
6. Update/rebase feature PR #74 against the new `main` and merge it.
7. Test #74 in Test.
8. Copy the tested commit SHA from the Test workflow/`main` history.
9. Manually run **Validate and release AMO**, supplying that SHA, to promote it to Production.

## Rollback

Production rollback uses the same promotion mechanism: manually run the release workflow with a previously known-good commit SHA. The API image is tagged with that resolved SHA and the frontend is deployed from the same revision.
