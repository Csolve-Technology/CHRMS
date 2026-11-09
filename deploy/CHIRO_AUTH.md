# CHRMS centralized sign-in

Use realm `chirocity` at `https://auth.chirocity.gov.et`.

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
