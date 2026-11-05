# CHRMS centralized roles and permissions

CHRMS authenticates with `chrms-web` and accepts audience `chrms-api` in the `chirocity` realm. Keycloak client roles supply membership; the CHRMS `Role` table supplies the granted permission keys. Realm roles and other applications' client roles do not grant CHRMS access.

## Server setup

Local NestJS loads `backend/.env` through ConfigModule. Save these only in the private environment:

```env
AUTH_MODE=keycloak
KEYCLOAK_URL=https://auth.chirocity.gov.et
KEYCLOAK_REALM=chirocity
KEYCLOAK_CLIENT_ID=chrms-web
KEYCLOAK_AUDIENCE=chrms-api
KEYCLOAK_ADMIN_CLIENT_ID=chrms-provisioner
KEYCLOAK_ADMIN_CLIENT_SECRET=<server-only secret>
```

The VPS Compose file reads provisioner variables from the root `.env`. They must be saved there before deployment as well. Never use a VITE_ variable for the provisioner secret. The provisioner needs user-management and CHRMS client-role management rights. Standard realm-management `manage-users`, `view-clients`, `manage-clients` roles are broad; use fine-grained Keycloak administration to narrow these rights where available.

The public client must use Standard Flow, client authentication OFF and PKCE S256, with an access-token audience mapper for `chrms-api`. Include all assigned CHRMS client roles in token scope mappings. Production redirect/logout URI is `https://chrms.chirocity.gov.et/login`, origin `https://chrms.chirocity.gov.et`. Add `http://localhost:8080/login` and origin `http://localhost:8080` for the normal local Vite server.

## Local upgrade

From `backend`:

```powershell
npm run prisma:generate
npx prisma migrate deploy
npm run start:dev
```

From `frontend` in a second terminal:

```powershell
npm run dev
```

The additive migration creates the permission catalog defaults for ADMIN and HOUSING_OFFICER, backfills existing user memberships and retains local user IDs and housing records. It does not reseed business data or reset passwords. Settings now have separate `settings.read` / `settings.write` grants rather than borrowing dashboard or rental permissions. Review those grants deliberately for delegated users.

## Using the app

Open **Users, roles and permissions**:

- **Load Chiro Auth roles** imports roles from `chrms-api`. Missing roles start with zero permissions; existing grants are preserved.
- **Create role** creates the client role in Keycloak and stores the selected CHRMS permissions. Names match exactly, including case. Renaming/deleting synchronized roles is not exposed here; manage their identity lifecycle in Keycloak after removing assignments.
- **Edit permissions** updates the role's local grants. API authorization reads current grants for every request. Refresh the session to refresh menus. ADMIN retains core management permissions to avoid lockout.
- **Create user** requires name, email, an initial temporary password and one or more roles. Selected local roles are also ensured in Keycloak. The identity is created disabled, assigned CHRMS roles and linked to its local profile, then enabled. Administrator-created email is marked verified and the initial password must be changed at first sign-in. The local profile has no usable password in centralized mode.
- **Edit user** supports multiple roles and explicit removal. Only directly assigned CHRMS roles can be removed here. Inherited group/composite grants must be removed in Keycloak; CAS applicant-group special behavior does not apply to CHRMS. Assignment results are verified before showing success.
- Duplicate identities are not silently linked by email. An existing Keycloak user can receive CHRMS roles and sign in to create a profile. Existing local accounts require explicit subject/issuer linking through the existing linkage workflow before role editing.
- **Disable** blocks CHRMS locally and preserves records. It does not delete or disable the shared Keycloak identity in other city apps. The last local administrator and self-disable are protected.

Only permissions owned by the acting user can be delegated. A role named ADMIN does not bypass the API guard. Custom roles may combine independent read/write permissions for properties, tenants, rentals, sales, payments, reporting and administration. No owner/team record scoping is introduced: authorized housing resources retain their existing application-wide scope. This is staff housing administration; no public applicant signup is added.

Role assignment changes block stale tokens. The affected user must sign out and sign in again; the guard rejects old token claims rather than restoring removed roles. Passwords, email changes and shared account recovery remain in Keycloak.

## Validation

```powershell
# backend
npm run test:auth
npm run build
# frontend
npm run test:auth
npx tsc --noEmit
npm run build
```

Automated API tests use an isolated Prisma mock and exercise the real Nest controllers, validation and permission guards. The provisioner has also been checked against Keycloak using a temporary disabled identity and temporary role, both removed after verification. Local environment files and secrets remain ignored and are not included in source changes.

Lease attachments at `/uploads/agreements/:filename` require an authenticated bearer token and `rentals.read`. The frontend downloads through its authenticated API client; direct anonymous static file URLs are no longer served.
