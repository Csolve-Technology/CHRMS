const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'bootstrap-admin.cjs'),'utf8');
async function bootstrap(existing){
 const calls={queries:[],created:[],hashes:[],errors:[],disconnected:false};
 const prisma={user:{findFirst:async query=>{calls.queries.push(query);return existing;},create:async query=>calls.created.push(query)},$disconnect:async()=>{calls.disconnected=true;}};
 const process={env:{ADMIN_EMAIL:'fixture@example.invalid',ADMIN_PASSWORD:'temporary-test-password-only'},exitCode:0};
 vm.runInNewContext(source,{require:name=>name==='@prisma/client'?{PrismaClient:function(){return prisma;}}:{hash:async(value,cost)=>{calls.hashes.push({value,cost});return 'hashed-fixture-password';}},process,console:{log:()=>{},error:message=>calls.errors.push(message)}});
 for(let attempt=0;attempt<20&&!calls.disconnected;attempt++)await new Promise(resolve=>setImmediate(resolve));
 return {calls,process};
}
test('existing administrator lookup uses a valid Prisma list filter and preserves credentials',async()=>{
 const {calls,process}=await bootstrap({id:'existing-admin'});
 assert.deepEqual(JSON.parse(JSON.stringify(calls.queries[0])),{where:{isActive:true,roleNames:{has:'ADMIN'}}});
 assert.equal(calls.created.length,0);assert.equal(calls.hashes.length,0);assert.equal(process.exitCode,0);assert.equal(calls.disconnected,true);
});
test('a new administrator is created with array membership and a hashed password',async()=>{
 const {calls,process}=await bootstrap(null);
 assert.deepEqual(Array.from(calls.created[0].data.roleNames),['ADMIN']);
 assert.equal(calls.created[0].data.passwordHash,'hashed-fixture-password');assert.equal(calls.created[0].data.role,'ADMIN');
 assert.equal(calls.created[0].data.email,'fixture@example.invalid');assert.equal(process.exitCode,0);
});
