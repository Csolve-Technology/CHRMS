// Run only after independently verifying the Keycloak user ID in its admin console.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const email = process.env.LINK_EMAIL;
  const subject = process.env.KEYCLOAK_SUB;
  const issuer = `${(process.env.KEYCLOAK_URL || 'https://auth.chirocity.gov.et').replace(/\/$/, '')}/realms/${process.env.KEYCLOAK_REALM || 'chrms'}`;
  if (!email || !subject) throw new Error('Provide LINK_EMAIL and KEYCLOAK_SUB from the Keycloak user details.');
  if (subject.startsWith('REPLACE_')) throw new Error('Replace the placeholder with the verified Keycloak user ID.');
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    console.log('No existing CHRMS account has that email. A new profile will be provisioned on the first authorized Chiro Auth login.');
    return;
  }
  const previousSub = process.env.PREVIOUS_KEYCLOAK_SUB;
  const previousIssuer = process.env.PREVIOUS_KEYCLOAK_ISSUER;
  if (!!previousSub !== !!previousIssuer) throw new Error('Provide both previous subject and issuer for an explicit migration.');
  if (user.keycloakSub) {
    if (user.keycloakSub === subject && user.keycloakIssuer === issuer) {
      console.log('This CHRMS user is already linked.'); return;
    }
    if (user.keycloakSub !== previousSub || user.keycloakIssuer !== previousIssuer) throw new Error('This CHRMS user is already linked to another identity. Migration requires matching PREVIOUS_KEYCLOAK_SUB and PREVIOUS_KEYCLOAK_ISSUER.');
  }
  if (await prisma.user.findUnique({ where: { keycloakSub: subject } })) throw new Error('This Keycloak identity is already linked to another CHRMS user.');
  const result = await prisma.user.updateMany({
    where: { id: user.id, keycloakSub: user.keycloakSub, keycloakIssuer: user.keycloakIssuer },
    data: { keycloakSub: subject, keycloakIssuer: issuer },
  });
  if (result.count !== 1) throw new Error('The account changed during linking. Retry after reviewing its current identity.');
  console.log('CHRMS account linked. Existing user ID and records preserved. Roles are enforced from Keycloak tokens.');
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
