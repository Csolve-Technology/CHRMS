# CHRMS centralized sign-in

Use realm `chrms` at `https://auth.chirocity.gov.et`.

- Public OIDC client: `chrms-web`; standard flow enabled, PKCE S256, client authentication disabled.
- Login and logout redirect: `https://chrms.chirocity.gov.et/login`.
- Web origin: `https://chrms.chirocity.gov.et`.
- API audience/client: `chrms-api`.
- API client roles: `ADMIN`, `HOUSING_OFFICER` (case-sensitive). ADMIN takes precedence when both are present.
- Assign the roles scope as Default to chrms-web. Restrict its role scope mappings to the required chrms-api roles; include the API audience in access tokens.
- Users need verified email addresses. Roles must appear under `resource_access["chrms-api"].roles`.

The deploy workflow builds and tests images on GitHub, migrates the database, and deploys the verified images. Existing environment values remain unchanged.

After deployment, run **Configure CHRMS Chiro Auth** with the independently verified existing account email and Keycloak user ID. The workflow links an existing account without changing its local ID; it never silently links by email during sign-in. If the email is new, a profile is created on the first authorized login. The workflow backs up the environment, enables AUTH_MODE=keycloak, checks health and rejects local password sign-in. It preserves the edge network override.

Passwords, accounts and role grants are managed in Chiro Auth once enabled. Users must sign out and sign in again after changes. Existing CHRMS operational and audit data are retained. No business-data seed is run.

Run **Verify live CHRMS browser login** after activation to verify the page renders and reaches the central login form. This does not authenticate as a real user.


## Automatic Chiro Auth login

In Keycloak mode, unauthenticated entries open Keycloak automatically without the middle app sign-in screen. Existing SSO sessions enter directly. Access/configuration errors show recovery controls and do not loop. Logout blocks automatic sign-in until central logout completes. Keep the existing /login redirect/logout URI and web origins; no realm or role changes are required. Explicit local authentication mode retains its local form.


## Dedicated realm migration

Use `KEYCLOAK_REALM=chrms` with the `chrms` realm's `chrms-provisioner` secret in `backend/.env` locally and root `.env` on the VPS. The browser reads the realm from the API; its client ID remains `chrms-web` and the audience remains `chrms-api`. Keep automatic login and existing callback/web-origin URLs. Users and service-account permissions must be configured inside the new realm; roles in chirocity grant no access here.

After deploying this version, recreate the API to load the private environment settings:

```sh
docker compose --env-file .env -f docker-compose.yml -f docker-compose.domains.yml up -d --no-deps --force-recreate chrms-api
```

The existing administrator can be migrated once using independently verified old/new identities:

```sh
export LINK_EMAIL='EXISTING_APP_EMAIL'
export KEYCLOAK_SUB='VERIFIED_NEW_REALM_USER_ID'
export PREVIOUS_KEYCLOAK_SUB='EXISTING_OLD_REALM_USER_ID'
export PREVIOUS_KEYCLOAK_ISSUER='https://auth.chirocity.gov.et/realms/chirocity'
docker compose --env-file .env -f docker-compose.yml -f docker-compose.domains.yml exec -T -e LINK_EMAIL -e KEYCLOAK_SUB -e PREVIOUS_KEYCLOAK_SUB -e PREVIOUS_KEYCLOAK_ISSUER chrms-api node scripts/link-keycloak-user.cjs
unset LINK_EMAIL KEYCLOAK_SUB PREVIOUS_KEYCLOAK_SUB PREVIOUS_KEYCLOAK_ISSUER
```

The linking helper checks the expected existing identity before replacing it, retaining the app user ID and related records. Repeat with each existing user's verified new identity as needed; users are never automatically merged by email. Refresh the shared edge proxy after replacing containers (`docker exec hrms-proxy-1 nginx -t` then `docker exec hrms-proxy-1 nginx -s reload`). Check the public auth/config endpoint reports `chrms` and sign in again. Separate realms now have independent login/logout sessions; no global logout workaround is needed.
