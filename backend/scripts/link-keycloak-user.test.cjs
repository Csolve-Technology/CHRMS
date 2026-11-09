const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
async function run(previous) {
  const updates = [];
  const user = { id: 'local-id', email: 'admin@example.invalid', keycloakSub: 'old-subject', keycloakIssuer: 'https://identity.example/realms/old' };
  const prisma = { user: { findUnique: async query => query.where.email ? user : null, updateMany: async data => { updates.push(data); return { count: 1 }; } }, $disconnect: async () => {} };
  const process = { env: { LINK_EMAIL: user.email, KEYCLOAK_SUB: 'new-subject', KEYCLOAK_URL: 'https://identity.example', KEYCLOAK_REALM: 'new', ...previous }, exitCode: 0 };
  await vm.runInNewContext(fs.readFileSync('scripts/link-keycloak-user.cjs', 'utf8'), { process, console: { log() {}, error() {} }, require: () => ({ PrismaClient: function() { return prisma; } }) });
  return { updates, code: process.exitCode };
}
test('realm migration requires an explicitly matching previous identity', async () => {
  for (const previous of [{}, { PREVIOUS_KEYCLOAK_SUB: 'wrong', PREVIOUS_KEYCLOAK_ISSUER: 'https://identity.example/realms/old' }]) {
    const result = await run(previous);
    assert.equal(result.code, 1);
    assert.equal(result.updates.length, 0);
  }
});
test('verified migration updates only identity fields with an atomic old-link condition', async () => {
  const result = await run({ PREVIOUS_KEYCLOAK_SUB: 'old-subject', PREVIOUS_KEYCLOAK_ISSUER: 'https://identity.example/realms/old' });
  assert.equal(result.code, 0);
  assert.equal(result.updates.length, 1);
  assert.equal(result.updates[0].where.id, 'local-id');
  assert.equal(result.updates[0].where.keycloakSub, 'old-subject');
  assert.equal(result.updates[0].data.keycloakSub, 'new-subject');
  assert.equal(result.updates[0].data.keycloakIssuer, 'https://identity.example/realms/new');
  assert.equal(Object.keys(result.updates[0].data).length, 2);
});
