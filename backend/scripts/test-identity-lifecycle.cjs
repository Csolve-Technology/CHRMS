const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const path=require('node:path');
const helper=['src/auth/identity-lifecycle.ts','src/modules/auth/identity-lifecycle.ts'].find(p=>fs.existsSync(p));
class AuthError extends Error {constructor(status,message){super(message);this.status=status;}getStatus(){return this.status;}}
const compiled=ts.transpileModule(fs.readFileSync(helper,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleExports={};
vm.runInNewContext(compiled,{exports:moduleExports,require:()=>({HttpException:class extends AuthError {constructor(message,status){super(status,message);}},AuthError}),process:{env:{KEYCLOAK_ADMIN_CLIENT_ID:'fixture-provisioner',KEYCLOAK_ADMIN_CLIENT_SECRET:'fixture-only'}},URLSearchParams,AbortSignal,fetch,console});
const {IdentityLifecycle}=moduleExports;
const cfg={url:'https://identity.invalid',realm:'app',issuer:'https://identity.invalid/realms/app'};
function setup(answer){const calls=[];const client=new IdentityLifecycle(cfg,async(url,options)=>{calls.push({url,options});if(url.endsWith('/token'))return Response.json({access_token:'fixture'});return answer(url,options);});return {client,calls};}
const fail=status=>e=>e.getStatus()===status;
test('live enabled user accepts an already signed token subject',async()=>{const {client}=setup(()=>Response.json({id:'subject',enabled:true}));await client.assertActive('subject');});
test('disabling central user blocks an unexpired JWT immediately',async()=>{let enabled=true;const {client}=setup(()=>Response.json({id:'subject',enabled}));await client.assertActive('subject');enabled=false;await assert.rejects(client.assertActive('subject'),fail(403));});
test('deleted user blocks an unexpired JWT immediately',async()=>{const {client}=setup(()=>new Response(null,{status:404}));await assert.rejects(client.assertActive('subject'),fail(401));});
test('permission errors are not mistaken for deleted accounts',async()=>{const {client}=setup(()=>new Response(null,{status:403}));await assert.rejects(client.assertActive('subject'),fail(503));});
test('transport outages fail closed',async()=>{const {client}=setup(()=>{throw Error('private details');});await assert.rejects(client.assertActive('subject'),e=>e.getStatus()===503&&!e.message.includes('private'));});
test('malformed account status fails closed',async()=>{const {client}=setup(()=>Response.json({id:'different',enabled:true}));await assert.rejects(client.assertActive('subject'),fail(503));});
test('directory reads all pages and filters before database pagination',async()=>{const {client,calls}=setup(url=>Response.json(url.includes('first=0&')?Array.from({length:100},(_,i)=>({id:String(i)})):[{id:'last'}]));const where=await client.visibleWhere('keycloak_sub','keycloak_issuer');assert.equal(where.OR[1].keycloak_sub.in.length,101);assert.equal(where.OR[1].keycloak_issuer,cfg.issuer);assert.equal(calls.filter(c=>c.url.includes('/users?')).length,2);});
test('deletion is idempotent and targets only the supplied subject',async()=>{const {client,calls}=setup(()=>new Response(null,{status:404}));await client.deleteUser('subject',cfg.issuer);assert.equal(calls.at(-1).options.method,'DELETE');assert.equal(calls.at(-1).url,'https://identity.invalid/admin/realms/app/users/subject');});
test('cross-realm deletion and status changes are rejected before network calls',async()=>{const {client,calls}=setup(()=>new Response(null,{status:204}));await assert.rejects(client.deleteUser('subject','https://other'),fail(409));await assert.rejects(client.setEnabled('subject','https://other',false),fail(409));assert.equal(calls.length,0);});
test('disable also ends central sessions',async()=>{const {client,calls}=setup(()=>new Response(null,{status:204}));await client.setEnabled('subject',cfg.issuer,false);assert.equal(calls[1].options.method,'PUT');assert.equal(JSON.parse(calls[1].options.body).enabled,false);assert.equal(calls[2].options.method,'POST');assert(calls[2].url.endsWith('/users/subject/logout'));});
test('failed remote deletion is not reported as success',async()=>{const {client}=setup(()=>new Response(null,{status:500}));await assert.rejects(client.deleteUser('subject',cfg.issuer),fail(503));});
test('unlinked local profiles never cause a central account deletion',async()=>{const {client,calls}=setup(()=>new Response(null,{status:204}));await client.deleteUser(null,null);assert.equal(calls.length,0);});
