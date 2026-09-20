import { test } from 'node:test';import assert from 'node:assert/strict';import { generateKeyPair,SignJWT } from 'jose';import { authenticate } from '../worker/auth';
const env={ACCESS_TEAM_DOMAIN:'test.cloudflareaccess.com',ACCESS_AUD:'test-audience',OWNER_EMAIL:'owner@example.com'};
const pair=await generateKeyPair('RS256');
async function token(changes:Record<string,unknown>={}){return new SignJWT({email:env.OWNER_EMAIL,sub:'owner',iss:`https://${env.ACCESS_TEAM_DOMAIN}`,aud:env.ACCESS_AUD,exp:Math.floor(Date.now()/1000)+600,...changes}).setProtectedHeader({alg:'RS256'}).sign(pair.privateKey)}
const request=(jwt?:string)=>new Request('https://example.com',{headers:jwt?{'Cf-Access-Jwt-Assertion':jwt}:{}});
test('missing configuration fails closed',async()=>assert.rejects(authenticate(request(),{}),/尚未配置/));
test('missing token rejected',async()=>assert.rejects(authenticate(request(),env),/身份验证/));
test('valid owner verified cryptographically',async()=>{const result=await authenticate(request(await token()),env,async()=>pair.publicKey);assert.equal(result?.email,env.OWNER_EMAIL)});
for(const [name,claims] of Object.entries({issuer:{iss:'https://evil.example'},audience:{aud:'wrong'},email:{email:'other@example.com'},expired:{exp:1}}))test(`rejects wrong ${name}`,async()=>assert.rejects(authenticate(request(await token(claims)),env,async()=>pair.publicKey)));
test('forged signature rejected',async()=>{const other=await generateKeyPair('RS256');await assert.rejects(authenticate(request(await token()),env,async()=>other.publicKey))});
