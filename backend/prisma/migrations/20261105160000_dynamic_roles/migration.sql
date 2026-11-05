CREATE TABLE "Role" (
 "name" TEXT NOT NULL PRIMARY KEY,
 "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "User" ADD COLUMN "roleNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "rolesValidAfter" BIGINT NOT NULL DEFAULT 0;
UPDATE "User" SET "roleNames" = ARRAY["role"::TEXT];
INSERT INTO "Role" ("name","permissions") VALUES ('ADMIN',ARRAY['roles.read','roles.write','settings.read','settings.write','profile.read','dashboard.read','properties.read','properties.write','tenants.read','tenants.write','rentals.read','rentals.write','rental_payments.read','rental_payments.write','sales.read','sales.write','sale_payments.read','sale_payments.write','reports.read','users.read','users.write','audit.read']::TEXT[]),('HOUSING_OFFICER',ARRAY['profile.read','dashboard.read','properties.read','properties.write','tenants.read','tenants.write','rentals.read','rentals.write','rental_payments.read','rental_payments.write','sales.read','sales.write','sale_payments.read','sale_payments.write','reports.read']::TEXT[]);
