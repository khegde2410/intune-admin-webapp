<!-- Copilot Instructions for Intune Admin Web App -->
# Repo Snapshot

This is a React single-page app that manages Microsoft Intune, Windows Autopilot and Azure AD devices.

- Entry point: `src/index.js` (creates `PublicClientApplication` with `msalConfig`)
- App shell & routes: `src/App.jsx` (wraps `MsalProvider` and `react-router` Routes)
- Layout: `src/components/Layout/PageLayout.jsx` uses `AuthenticatedTemplate`/`UnauthenticatedTemplate`
- Auth helpers: `src/utils/authConfig.js` (MSAL config, `graphScopes`), env vars in `public/.env.example`
- Graph endpoints: `src/utils/graphConfig.js` (logical endpoints used by services)
- API clients: `src/services/graphService.js` (axios wrapper + paging + batch helpers)
- Domain services: `src/services/*.js` (`deviceService.js`, `autopilotService.js`, `appService.js`)

# Big-picture architecture & patterns

- Single-page React app using `msal-react` for auth; `MsalProvider` is created in `src/index.js` and passed to `App`.
- UI components call MSAL to acquire tokens (usually via `instance.acquireTokenSilent`) then call domain services with `response.accessToken`.
- All raw Graph HTTP access is centralized in `src/services/graphService.js` which:
  - prefixes requests with `https://graph.microsoft.com`
  - exposes `callMsGraph(...)`, `callMsGraphWithPaging(...)`, and `batchDelete(...)`
  - components/services should pass the token and the relative endpoint from `src/utils/graphConfig.js`.
- Domain logic lives in `src/services/*` — these are thin wrappers around `graphService` and contain the Graph query strings and small transformations (e.g., mapping autopilot import payloads).
- Routing/pages live under `src/pages/*` and compose service-backed widgets found in `src/components/*`.

# Developer workflows (explicit commands)

- Install: `npm install`
- Start dev server (localhost:3000): `npm start`
- Build production bundle: `npm run build`
- Run tests (create-react-app): `npm test`

Environment:
- Node.js 16+ is expected (see `README.md`).
- Copy `public/.env.example` → `.env` and set `REACT_APP_CLIENT_ID`, `REACT_APP_TENANT_ID`, `REACT_APP_REDIRECT_URI` before starting.

# Project-specific conventions and examples for AI edits

- Auth token acquisition: components use the MSAL `instance` and `accounts` returned by `useMsal()`.
  Example pattern (from `OffboardingWizard.jsx`):
  ```js
  const request = { scopes: [...graphScopes.deviceManagement], account: accounts[0] };
  const response = await instance.acquireTokenSilent(request);
  const data = await deviceService.getManagedDevices(response.accessToken);
  ```

- Use `graphScopes` in `src/utils/authConfig.js` to assemble scopes for requests. Components often union scopes for multi-system ops (Intune + Autopilot + AzureAD).

- Use service functions (not direct axios calls) for Graph interactions. Examples:
  - `deviceService.getManagedDevices(accessToken)` — returns all pages via `callMsGraphWithPaging`.
  - `autopilotService.uploadAutopilotHash(accessToken, deviceData)` — maps CSV rows into Graph import objects.

- Error handling: services throw; components catch and set UI `error` state. When editing services prefer throwing the original error to keep component-level messages consistent.

- Paging: prefer `callMsGraphWithPaging(endpoint, token)` for list endpoints. It returns a flat array across `@odata.nextLink`.

# Integration points & external dependencies

- Authentication: `@azure/msal-browser` + `@azure/msal-react` (configured in `src/utils/authConfig.js`).
- HTTP client: `axios` centralized in `src/services/graphService.js`.
- CSV parsing for uploads: `papaparse` used in `src/components/AutopilotManagement/HashUpload.jsx`.
- UI: `react-bootstrap` and `bootstrap` CSS (global import in `src/index.js`).

# Safe change guidelines for AI edits

- Preserve MSAL patterns: keep `MsalProvider` in `App.jsx` and use `instance.acquireTokenSilent(...)` and `accounts[0]` unless explicitly changing auth UX.
- When adding Graph calls, put them in a service in `src/services/*` and reuse `endpoints` from `src/utils/graphConfig.js`.
- For list endpoints, use the `callMsGraphWithPaging` helper to avoid duplicating pagination logic.
- Keep UI behavior consistent with `AuthenticatedTemplate`/`UnauthenticatedTemplate` usage in `PageLayout.jsx`.
- Do not commit secrets. `.env` is used for runtime client id/tenant; do not hard-code them in source files.

# Where to look to learn more

- Auth flows and scopes: `src/utils/authConfig.js`
- Graph endpoint definitions: `src/utils/graphConfig.js`
- Central HTTP logic and paging: `src/services/graphService.js`
- Orchestration examples: `src/components/DeviceOffboarding/OffboardingWizard.jsx` and `src/components/AutopilotManagement/*`

---
If anything here is unclear or you'd like more examples (e.g., a canonical token-acquire helper or a suggested retry/backoff pattern for Graph calls), tell me which area to expand and I will iterate.
