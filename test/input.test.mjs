// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { strictJSON, request } from '../src/input.mjs';
import { run } from '../src/cli-runner.mjs';
const source = s => ({base64:Buffer.from(s).toString('base64')});
async function cli(raw, args = []) { const out=[];const code=await run(args,Readable.from([Buffer.from(raw)]),{write(b){out.push(Buffer.from(b));}});return {code,bytes:Buffer.concat(out)}; }
test('strict JSON duplicate decoded names, nonfinite values, controls and Unicode spaces',()=>{
  for(const s of ['{"x":1,"x":2}','{"x":1,"\\u0078":2}','{"x":1e999}','{"x":NaN}','[1,]','{"x":01}','{"x":"\n"}','{\u00a0"x":1}','{"x":1} trailing']) assert.throws(()=>strictJSON(Buffer.from(s)));
  assert.equal(strictJSON(Buffer.from('{"x":-1.25e2,"ok":true,"none":null}')).x,-125);
});
test('request UTF8 and structure depth are bounded before source decoding',()=>{
  assert.throws(()=>strictJSON(Buffer.from([255])));assert.throws(()=>strictJSON(Buffer.from('['.repeat(34)+'0'+']'.repeat(34))));
});
test('request schema and canonical base64 are data, not paths or executable config',()=>{
  const r=request(Buffer.from(JSON.stringify({sources:[source('document.body.innerHTML="Hi"')],options:{host:'browser'}})));assert(Buffer.isBuffer(r.sources[0]));
  for(const x of [{sources:[{path:'/SECRET_PATH'}]},{sources:[{base64:'AB=='}]},{sources:[{base64:'AA='}]},{sources:[{base64:'AA==',path:'secret'}]},{sources:[],config:'secret'},null]) assert.throws(()=>request(Buffer.from(JSON.stringify(x))));
});
test('CLI executes statuses 0/1/2 with actual sourceType and sanitizer/host assertions',async()=>{
  for(const [s,status,code] of [['document.body.innerHTML="Hi"','PASS',0],['document.body.innerHTML=data','FAIL',1],['document.body.innerHTML=load()','OPEN',2]]) {const r=await cli(JSON.stringify({sources:[source(s)],options:{host:'browser',sourceType:'module'}}));assert.equal(r.code,code);assert.equal(JSON.parse(r.bytes).status,status);}
  const o={host:'browser',sourceType:'module',sanitizers:[{module:'safe-library',imported:'sanitize',member:null,argument:0,arity:1}]};const r=await cli(JSON.stringify({sources:[source('import {sanitize as clean} from "safe-library";document.body.innerHTML=clean(data)')],options:o}));assert.equal(r.code,0);assert.equal(JSON.parse(r.bytes).assertions.sanitizer_contract_count,1);
});
test('CLI invalid/null arguments and malformed JSON always fixed private JSON OPEN',async()=>{
  for(const [raw,args] of [['',[]],['SECRET_TEXT',[]],['{"sources":[],"sources":[]}',[]],['{"sources":[],"options":null}',[]],['{"sources":[],"limits":null}',[]],['{}',['--SECRET_PATH']],['{}',['--max-request-bytes','SECRET_PATH']],['{}',['--max-request-bytes','0']],['{}',['--max-request-bytes','3000000']]]) {const r=await cli(raw,args);assert.equal(r.code,2);assert.equal(JSON.parse(r.bytes).status,'OPEN');for(const m of ['SECRET_PATH','SECRET_TEXT'])assert(!r.bytes.includes(Buffer.from(m)));}
});
test('CLI request byte budget precedes decode and clean report',async()=>{
  const raw=JSON.stringify({sources:[source('document.body.innerHTML="Hi"')],options:{host:'browser'}});const r=await cli(raw,['--max-request-bytes','20']);assert.equal(r.code,2);assert(JSON.parse(r.bytes).unknowns.includes('request_byte_budget'));assert.equal(JSON.parse(r.bytes).inputs.length,0);
  const limit=await cli(JSON.stringify({sources:[source('document.body.innerHTML="Hi"')],options:{host:'browser'},limits:{requestBytes:1}}));assert.equal(limit.code,2);
});
test('CLI help is ordinary text without requiring stdin request',async()=>{const r=await cli('',['--help']);assert.equal(r.code,0);assert(r.bytes.toString().includes('request.json'));});
