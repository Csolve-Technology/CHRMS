# Chiro City Housing & Rental Management System (CHRMS)

Centralized **government property**, **tenant**, **rental**, **sale / installment**, and **payment** tracking for Chiro City Administration.

- **Frontend:** React (Vite), existing UI kit (unchanged theme)
- **Backend:** NestJS 10, Prisma 6, PostgreSQL
- **Auth:** JWT + role/permission guards (`ADMIN`, `HOUSING_OFFICER`)

---

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (local instance)
- npm

---

## 1. Database

Create a database and set the URL (see `backend/.env.example`):

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/chrms?schema=public"
```

---

## 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, CORS_ORIGIN (comma-separated if UI uses several ports, e.g. http://localhost:8080,http://localhost:8081). If omitted, 8080 and 8081 are allowed by default.
# Keep AUTH_MODE=local for npm run dev (email/password). Production/VPS uses AUTH_MODE=keycloak — leave that integration unchanged.

npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

API default: **http://localhost:3000**

### Demo users (from seed)

| Email                 | Password     | Role             |
|-----------------------|-------------|------------------|
| admin@chiro.gov.et    | password123 | ADMIN            |
| housing@chiro.gov.et  | password123 | HOUSING_OFFICER  |

### Main HTTP routes

- `POST /auth/login`
- `GET|POST /properties`, `GET|PUT /properties/:id`
- `GET|POST /tenants`, `GET /tenants/:id`
- `GET|POST /rentals`, `GET /rentals/:id`
- `GET|POST /rental-payments`
- `GET|POST /sales`, `GET /sales/:id`
- `GET|POST /sale-payments`
- `GET /dashboard/summary`, `GET /dashboard/trends`
- `GET /reports/summary`
- `GET /users/me`
- `GET /notifications`
- `GET /audit/logs` (ADMIN only)

---

## 3. Frontend

```bash
cd frontend
cp .env.example .env
# VITE_API_URL=http://localhost:3000

npm install
npm run dev
```

App default: **http://localhost:8080** (see `vite.config.ts`).

Sign in with a seeded user, then use **Dashboard**, **Properties**, **Tenants**, **Rentals**, **Sales**, and **Payments**.

---

## 4. Business rules (implemented)

- **Sale:** `total_paid = SUM(sale_payments.amount)`, `remaining = total_price - total_paid`, completion %; when `remaining === 0`, sale status → `completed`.
- **Rental overdue:** current month past `due_day` and payments in that month &lt; `monthly_rent`.
- **New rental:** property must be `available`; status set to `rented`.
- **New sale:** property must be `available` and have no active rental; status set to `sold`.

---

## 5. Seed data

- 10 properties, 5 tenants, 3 active rentals (with sample payments), 2 sales (with installment payments).

---

## Project layout

```
Chiro City Housing/
├── backend/          # NestJS + Prisma
├── frontend/         # React SPA
└── README.md
```

---

## Scripts reference

| Location  | Command              | Purpose              |
|-----------|----------------------|----------------------|
| backend   | `npm run start:dev`  | Dev API              |
| backend   | `npm run build`      | Compile              |
| backend   | `npx prisma migrate deploy` | Apply migrations |
| backend   | `npx prisma db seed` | Load seed data       |
| frontend  | `npm run dev`        | Dev UI               |
| frontend  | `npm run build`      | Production build     |
