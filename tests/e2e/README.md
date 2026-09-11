# AMO deployed acceptance tests

These tests run against the deployed **Test** application rather than a local build. They use Cucumber/Gherkin for readable scenarios and Playwright/Chromium for browser automation.

## Where they run

On a push to `main`, `AMO · Validate & Deploy` compares the candidate revision with the durable `test-current` marker and deploys only the components that changed:

- `src/**`, `worker.js` or `wrangler.jsonc` → deploy the Cloudflare frontend
- `server/**` → build/push and deploy the API image using the existing Azure resources
- `infra/**` → reconcile Azure infrastructure with Bicep, then redeploy the API image because the Bicep Container App template declares a bootstrap image
- test-only/package changes → validate without redeploying unchanged application or infrastructure components

The full Azure infrastructure deployment, resource-provider checks and infrastructure configuration therefore run only when `infra/**` has changed (or when no prior release marker exists and a safe first full deployment is required).

After the Test deployment workflow succeeds, `AMO · Post-Deploy Acceptance · Test` runs on GitHub-hosted Ubuntu runners in two browser profiles:

- `desktop` — Chromium at 1440×1000
- `mobile` — Chromium at 390×844 with touch/mobile emulation

The durable `test-current` release marker moves only after both acceptance profiles pass. Manual Production promotion therefore defaults to the last Test release that passed deployed acceptance tests.

Production promotion uses the same change-aware model, comparing the selected Test release with `prod-current`. After a successful Production promotion, `prod-current` moves to the promoted revision. This allows frontend-only Production promotions to avoid Azure completely and API-only promotions to avoid Bicep while still preserving a safe full deployment when infrastructure changed.

The deployed acceptance workflow checks out the exact `head_sha` of the completed `AMO · Validate & Deploy` workflow that triggered it. When several merges are validating or deploying close together, check the acceptance job's checkout SHA before attributing a failure to the newest merge.

## Reliability and bounded retry

Deployed acceptance runs against real Cloudflare/Azure services and can encounter short-lived propagation, container warm-up or browser-startup delays immediately after deployment. The workflow therefore uses bounded defensive controls rather than requiring a manual job retry:

1. **Release readiness poll** — before browser scenarios begin, `tests/e2e/bin/wait-for-deployment.cjs` confirms the frontend is reachable, the deployed `app-target-stage.js` reports the expected client version, and `/api/info` reports the expected backend and API versions. The poll is bounded and fails if the candidate never becomes ready.
2. **UI readiness waits** — dynamic browser surfaces use a configurable default wait (`E2E_UI_TIMEOUT`, 10 seconds in deployed acceptance) and a slightly longer application-shell readiness wait (`E2E_APP_READY_TIMEOUT`, 12 seconds).
3. **Step timeout** — deployed acceptance gives Cucumber steps a 30-second ceiling so the explicit readiness waits can report the useful failure rather than being pre-empted by a shorter framework default.
4. **One scenario retry** — deployed acceptance sets `E2E_RETRY=1`. Only the failed scenario is retried; the entire desktop/mobile job is not repeated. Local/deterministic E2E should leave retries disabled so flaky local tests remain visible.

Retries are a defence against transient deployed-environment timing only. They must not be used to weaken assertions or hide repeatable product failures. A scenario that fails again on its retry remains a release failure and should be investigated from its report/screenshot evidence.

## Acceptance tests are part of the change

The acceptance suite is part of AMO's product contract and must be reviewed whenever observable application behaviour changes. Functional, UX, navigation, API, authentication, workspace, deployment and release changes should not be considered complete until their impact on `tests/e2e/` has been assessed.

When a change deliberately alters behaviour already covered by a scenario, update that scenario and its step definitions in the **same pull request**. Add a scenario when new behaviour is important enough to protect against regression. Do not leave the suite describing the old product and wait for the post-deployment run to discover the mismatch.

When a test fails, first determine whether it has exposed a genuine product regression, an intentional change in expected behaviour, or a test reliability problem. Preserve the behavioural intent of the test: do not weaken assertions or increase timeouts merely to obtain a green build.

Because the deployed suite runs desktop and mobile profiles, changes to shared shell, navigation and responsive behaviour must be considered in both contexts.

## Environment supplied by GitHub Actions

The runner uses the existing `test-amo` environment variables:

- `AMO_WEB_ORIGIN` → `E2E_BASE_URL`
- `AMO_API_HOSTNAME` → `E2E_API_BASE_URL`

Expected client and backend versions are derived from the checked-out release source. No test-specific secrets are required by the initial unauthenticated scenarios.

## Run locally

Install dependencies and Chromium once:

```bash
npm install
npx playwright install chromium
```

Then provide the Test endpoints and expected versions:

```bash
E2E_BASE_URL=https://amo-test.example.com \
E2E_API_BASE_URL=https://api.amo-test.example.com \
E2E_EXPECTED_CLIENT_VERSION=1.1.0 \
E2E_EXPECTED_BACKEND_VERSION=0.3.0 \
E2E_EXPECTED_API_VERSION=2 \
E2E_PROFILE=desktop \
npm run test:e2e
```

Set `E2E_PROFILE=mobile` for the mobile shell run. `E2E_RETRY` defaults to `0` outside the deployed workflow; this is intentional for local/deterministic test runs.

## Adding and maintaining scenarios

Add business-readable scenarios under `tests/e2e/features/` and reusable step definitions under `tests/e2e/steps/`. Keep scenarios focused on observable product behaviour. Prefer read-only tests unless a scenario has a deliberately isolated test-data lifecycle.

During every relevant product change, review existing scenarios for terminology, selectors, navigation assumptions, API contracts and expected behaviour that the change affects. Update them alongside the implementation rather than as a follow-up after deployment.

The suite currently proves deployment identity, client/backend/API version alignment, responsive navigation, account rendering, Users & Access integration and other release-critical behaviour. Continue extending it around stable, valuable user journeys as AMO evolves.

Failures generate a Cucumber HTML report and a screenshot under `artifacts/`; GitHub Actions uploads these as workflow artifacts.
