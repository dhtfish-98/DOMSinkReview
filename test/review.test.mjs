// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { review, encode, defaults } from '../src/review.mjs';
import { parseSource } from '../src/parser.mjs';
const browser = { host: 'browser' };
const named = { module: 'safe-library', imported: 'sanitize', member: null, arity: 1, argument: 0 };
const object = { module: 'safe-library', imported: 'default', member: 'sanitize', arity: 1, argument: 0 };
const run = (source, options = browser, limits = {}) => review([Buffer.from(source)], options, limits);
const sink = value => 'document.body.innerHTML=' + value;
const check = (source, status, options = browser) => { const r = run(source, options); assert.equal(r.status, status, JSON.stringify(r)); assert(!r.unknowns.includes('internal_review_failure')); return r; };

test('real Acorn AST and exact supported language version', () => {
  const a = parseSource('const key="inner"+"HTML";document.body[key]=data', 'module', defaults);
  assert.equal(a.body[1].expression.type, 'AssignmentExpression'); assert.equal(a.body[1].expression.left.computed, true);
  for (const s of ['document.body.innerHTML = (data as string)', 'document.body!.innerHTML=data', 'const x: string="hello"', 'const x=<div/>', 'const n=/hello/']) check(s, 'OPEN');
});
test('all static primitive literal classes and escaped literal values', () => {
  for (const value of ['"Hello"', "'Hi'", '`Hello`', '1', '-1', 'true', 'false', 'null', '1n', '`Hi ${1}`', '"a"+"b"', '!(false)', '(true ? "Hi" : data)']) check(sink(value), 'PASS');
});
test('const chains and lexical shadowing carry actual declaration evidence', () => {
  const r = check('const a="Hello";const b=a;document.body.innerHTML=b', 'PASS'); assert(r.results[0].evidence.length >= 3);
  check('const data="Hello";function f(data){document.body.innerHTML=data}', 'FAIL');
  check('const data="Hello";{const data=external;document.body.innerHTML=data}', 'FAIL');
  check('const data="Hello";{let data="Hi";document.body.innerHTML=data}', 'OPEN');
});
test('direct unproven parameters, member data, concatenation and template are policy failures', () => {
  for (const v of ['data', 'input.value', '"Hi "+data', '`Hi ${data}`']) check(sink(v), 'FAIL');
  check('function f(value){document.body.innerHTML=value}', 'FAIL');
});
test('dynamic values, mutable bindings, cycles and TDZ stay unknown', () => {
  for (const s of [sink('getData()'), 'let a="Hi";'+sink('a'), 'var a="Hi";'+sink('a'), 'const a=b;const b=a;'+sink('a'), sink('a')+';const a="Hi"', 'const a="Hi";a=unknown;'+sink('a'), sink('data || "Hi"'), sink('cond ? "Hi" : "Hello"')]) check(s, 'OPEN');
});
test('sanitizer trust is explicit static import binding and argument contract', () => {
  const o = { host: 'browser', sanitizers: [named] };
  check('import {sanitize as clean} from "safe-library";'+sink('clean(data)'), 'PASS', o);
  check('import {sanitize as clean} from "safe-library";const c=clean;const html=c(data);'+sink('html'), 'PASS', o);
  check('import {sanitize as clean} from "different-library";'+sink('clean(data)'), 'OPEN', o);
  check('import {sanitize as clean} from "safe-library";'+sink('clean(data)'), 'OPEN');
});
test('same-name local sanitizer, parameter/block shadow, call arity and spread cannot pass', () => {
  const o = { host: 'browser', sanitizers: [named] };
  for (const s of ['function sanitize(x){return x};'+sink('sanitize(data)'), 'import {sanitize as clean} from "safe-library";function f(clean){'+sink('clean(data)')+'}', 'import {sanitize as clean} from "safe-library";{const clean=x=>x;'+sink('clean(data)')+'}', 'import {sanitize as clean} from "safe-library";'+sink('clean()'), 'import {sanitize as clean} from "safe-library";'+sink('clean(data,{})'), 'import {sanitize as clean} from "safe-library";'+sink('clean(...args)'), 'import {sanitize as clean} from "safe-library";'+sink('clean?.(data)')]) check(s, 'OPEN', o);
});
test('namespace/default sanitizer aliases and computed member names', () => {
  const o = { host: 'browser', sanitizers: [object] };
  check('import Safe from "safe-library";'+sink('Safe.sanitize(data)'), 'PASS', o);
  check('import Safe from "safe-library";const Other=Safe;const method="san"+"itize";'+sink('Other[method](data)'), 'PASS', o);
  const ns = { host: 'browser', sanitizers: [{ ...object, imported: '*' }] };
  check('import * as Safe from "safe-library";'+sink('Safe.sanitize(data)'), 'PASS', ns);
  check('import Safe from "safe-library";const clean=Safe.sanitize;'+sink('clean(data)'), 'OPEN', o);
});
test('member overrides and namespace escape invalidate trust through const aliases', () => {
  const o = { host: 'browser', sanitizers: [object] };
  for (const mutate of ['Safe.sanitize=x;', 'const Other=Safe;Other.sanitize=x;', 'consume(Safe);', 'const Other=Safe;consume(Other);']) check('import Safe from "safe-library";'+mutate+sink('Safe.sanitize(data)'), 'OPEN', o);
});
test('nested object and array captures invalidate imported providers before unknown escape', () => {
  const o = { host: 'browser', sanitizers: [object] };
  for (const capture of ['const wrapper={p:Safe};mutate(wrapper);', 'const wrapper=[Safe];mutate(wrapper);', 'escape({p:Safe});', 'escape([{nested:[Safe]}]);', 'const Other=Safe;const wrapper={p:Other};', 'const wrapper={};wrapper.p=Safe;mutate(wrapper);', 'let provider=Safe;mutate(provider);', 'const get=()=>Safe;escape(get);', 'function get(){return Safe;}escape(get);', 'const wrapper={p:cond?Safe:other};']) check('import Safe from "safe-library";'+capture+sink('Safe.sanitize(data)'), 'OPEN', o);
  check('import Safe from "safe-library";ordinary(data);const wrapper={p:"Hi"};'+sink('Safe.sanitize(data)'), 'PASS', o);
  const r = check('import Safe from "safe-library";'+sink('data')+';const wrapper={p:Safe};mutate(wrapper);'+sink('Safe.sanitize(data)'), 'FAIL', o); assert(r.unknowns.length); assert.equal(r.finding_count,1);
});
test('nested DOM captures remain OPEN while earlier known failures survive', () => {
  for (const capture of ['const wrapper={p:document.body};mutate(wrapper);', 'const wrapper=[document];mutate(wrapper);', 'escape({p:{d:document}});', 'const d=document;const wrapper={d};', 'const wrapper={};wrapper.d=document;', 'let d=document;escape(d);', 'const get=()=>document;escape(get);']) check(capture+sink('"Hi"'), 'OPEN');
  const r=check(sink('data')+';const wrapper={p:document.body};mutate(wrapper);'+sink('"Hi"'),'FAIL');assert(r.unknowns.includes('host_heap_capture_unresolved'));assert.equal(r.finding_count,1);
  check('const wrapper={p:["Hi",1]};ordinary(wrapper);'+sink('"Hi"'),'PASS');
});
test('sanitized fragments are not certified in concatenated/template contexts', () => {
  const o = { host: 'browser', sanitizers: [named] };
  for (const v of ['"Hi "+clean(data)', '`Hi ${clean(data)}`', 'clean(data)+"Hi"']) check('import {sanitize as clean} from "safe-library";'+sink(v), 'OPEN', o);
  check(sink('escapeHTML`Hi ${data}`'), 'OPEN');
});
test('write and writeln concatenate sanitized arguments into an unresolved HTML context', () => {
  const o = { host: 'browser', sanitizers: [named] };
  const imported = 'import {sanitize as clean} from "safe-library";';
  for (const method of ['write', 'writeln']) {
    for (const args of ['\'<a title="\',clean(data),\'">Hello</a>\'', 'clean(data),"tail"', '"prefix",clean(data)', 'clean(data),clean(other)', 'first,"tail"']) {
      const r = check(imported+'const first=clean(data);document.'+method+'('+args+')', 'OPEN', o);
      assert(r.unknowns.includes('sanitizer_composition_context')); assert.equal(r.finding_count, 0);
    }
  }
});
test('write and writeln keep single sanitizer and fully static multi-argument controls', () => {
  const o = { host: 'browser', sanitizers: [named] };
  for (const method of ['write', 'writeln']) {
    check('import {sanitize as clean} from "safe-library";document.'+method+'(clean(data))', 'PASS', o);
    check('const html="Hi";document.'+method+'(html,"there",1,true,null)', 'PASS', o);
    check('document.'+method+'()', 'PASS', o);
  }
});
test('every variadic argument failure survives sanitizer composition and omitted details', () => {
  const o = { host: 'browser', sanitizers: [named] };
  for (const method of ['write', 'writeln']) {
    for (const args of ['data,clean(other),other', 'clean(data),other,third']) {
      const r = run('import {sanitize as clean} from "safe-library";document.'+method+'('+args+')', o, {results:1,reportBytes:2048});
      assert.equal(r.status, 'FAIL'); assert.equal(r.finding_count, 2);
      assert(r.unknowns.includes('sanitizer_composition_context')); assert(r.unknowns.includes('result_budget'));
      const encoded = encode(r); assert(encoded.length <= 2048); assert.equal(JSON.parse(encoded).finding_count, 2);
    }
    const source = Buffer.from('import {sanitize as clean} from "safe-library";document.'+method+'(data,clean(other),other)');
    const r = review(Array.from({length:4}, () => source), o, {reportBytes:2048});
    const encoded = encode(r);
    assert.equal(r.status, 'FAIL'); assert.equal(r.finding_count, 8);
    assert(r.unknowns.includes('sanitizer_composition_context')); assert(r.unknowns.includes('report_budget'));
    assert(encoded.length <= 2048); assert.equal(JSON.parse(encoded).finding_count, 8);
  }
});
test('host is asserted and document/window/globalThis are lexical bindings', () => {
  check(sink('"Hello"'), 'OPEN', {});
  check('function f(document){document.body.innerHTML="Hi"}', 'OPEN');
  check('const document={body:{}};document.body.innerHTML=data', 'OPEN');
  check('const win=window;const d=win.document;d.body.innerHTML="Hi"', 'PASS');
  check('globalThis.document.body.innerHTML="Hi"', 'PASS');
});
test('DOM factories, aliases, range and shadow branches are distinct', () => {
  for (const s of ['const el=document.createElement("div");const other=el;other.innerHTML="Hi"', 'const el=document.querySelector("div");el.outerHTML="Hi"', 'const el=document.getElementById("message");el.setHTMLUnsafe("Hi")', 'const r=document.createRange();r.createContextualFragment("Hi")', 'const root=document.body.attachShadow({mode:"open"});root.innerHTML="Hi"']) check(s, 'PASS');
  for (const s of ['document.createRange().innerHTML=data', 'document.body.createContextualFragment(data)', 'document.createRange().insertAdjacentHTML("beforeend",data)', 'document.body.shadowRoot.outerHTML=data', 'document.body.shadowRoot.closest("x").innerHTML=data']) check(s, 'OPEN');
});
test('ordinary object write is distinct from document write', () => {
  check('const logger={write(x){}};logger.write(data);'+sink('"Hi"'), 'PASS');
  check('const d=document;d.write(data)', 'FAIL');
  check('someDocumentLogger.write(data)', 'OPEN');
  check('document.write("Hi", data)', 'FAIL');
  check('document.writeln("Hi")', 'PASS');
});
test('insertAdjacentHTML checks second argument and exact declared position', () => {
  check('document.body.insertAdjacentHTML("beforeend", data)', 'FAIL');
  check('const position="beforeend";document.body.insertAdjacentHTML(position, "Hi")', 'PASS');
  for (const s of ['document.body.insertAdjacentHTML(data,"Hi")', 'document.body.insertAdjacentHTML("unknown","Hi")', 'document.body.insertAdjacentHTML("beforeend")', 'document.body.insertAdjacentHTML(...args)']) check(s, 'OPEN');
});
test('all remaining methods enforce all required argument inventory', () => {
  for (const name of ['write', 'writeln']) { check(`document.${name}()`, 'PASS'); check(`document.${name}("Hi", data)`, 'FAIL'); check(`document.${name}(...args)`, 'OPEN'); }
  for (const s of ['document.body.setHTMLUnsafe()', 'document.body.setHTMLUnsafe("Hi", {})', 'document.createRange().createContextualFragment()']) check(s, 'OPEN');
});
test('computed property constants and unknown property never silently pass', () => {
  for (const left of ['document.body["innerHTML"]', 'document.body["inner"+"HTML"]', 'document.body[`${"inner"}HTML`]']) check(left+'=data', 'FAIL');
  check('const prop="outerHTML";document.body[prop]=data', 'FAIL');
  check('document.body[prop]="Hi";'+sink('"Hi"'), 'OPEN');
});
test('compound, logical compound, updates and previous HTML value remain unresolved', () => {
  for (const op of ['+=', '||=', '&&=', '??=', '-=', '*=', '**=']) check(`document.body.innerHTML${op}"Hi"`, 'OPEN');
  check('document.body.innerHTML++', 'OPEN');
});
test('method function values, call/apply, tagged and optional calls are open', () => {
  for (const s of ['const f=document.write;f(data)', 'document.write.call(null,data)', 'document.write`Hi ${data}`', 'document.body?.insertAdjacentHTML("beforeend","Hi")', 'document.body.insertAdjacentHTML?.("beforeend","Hi")']) check(s, 'OPEN');
});
test('loops, eval, Function and with do not certify source behavior', () => {
  for (const s of ['while(ok){'+sink('"Hi"')+'}', 'for(const x of data){'+sink('"Hi"')+'}', 'eval(source);'+sink('"Hi"'), 'new Function(source);'+sink('"Hi"')]) check(s, 'OPEN');
  check('with(object){document.body.innerHTML="Hi"}', 'OPEN', {host:'browser',sourceType:'script'});
});
test('global/host method mutation invalidates bindings through local aliases', () => {
  for (const s of ['document=other;'+sink('"Hi"'), 'window.document=other;'+sink('"Hi"'), 'document.querySelector=fn;document.querySelector("x").innerHTML="Hi"', 'const el=document.body;const other=el;other.insertAdjacentHTML=fn;el.insertAdjacentHTML("beforeend","Hi")', 'const d=document;d.body=other;d.body.innerHTML="Hi"']) check(s, 'OPEN');
  check('const el=document.body;el.textContent=data;el.innerHTML="Hi"', 'PASS');
});
test('ordinary object members do not inherit ordinary receiver proof for stored DOM nodes',()=>{
  check('const box={child:document.body};box.child.innerHTML=data;'+sink('"Hi"'),'OPEN');
  check('const box={child:document.body};const child=box.child;child.innerHTML=data;'+sink('"Hi"'),'OPEN');
  check('const box={d:document};box.d.body=other;'+sink('"Hi"'),'OPEN');
  check('consume(document.body);'+sink('"Hi"'),'OPEN');
  check('Object.assign(document,{body:other});'+sink('"Hi"'),'OPEN');
});
test('sourceType matrix and dynamic import are parsed without resolution', () => {
  check('await work();'+sink('"Hi"'), 'PASS');
  check('await work();'+sink('"Hi"'), 'OPEN', {host:'browser',sourceType:'script'});
  check('import(moduleName);'+sink('"Hi"'), 'OPEN');
  check('{function document(){}};'+sink('"Hi"'), 'OPEN', {host:'browser',sourceType:'script'});
});
test('source IDs, physical CRLF positions, Unicode byte offsets and privacy', () => {
  const src='// 你好\r\nconst PRIVATE_NAME="Hi";\r\n// sourceURL=/PRIVATE_PATH\r\ndocument.body.innerHTML=PRIVATE_NAME; // SECRET_TEXT'; const r=check(src,'PASS');
  assert.equal(r.results[0].position.line,4);assert.equal(r.results[0].position.utf16_column,1);assert.equal(r.results[0].position.byte_offset,Buffer.byteLength(src.slice(0,src.indexOf('document'))));
  for(const m of ['PRIVATE_NAME','PRIVATE_PATH','SECRET_TEXT']) assert(!encode(r).includes(Buffer.from(m)));
  const two=review([Buffer.from(sink('"a"')),Buffer.from(sink('"b"'))],browser);assert.deepEqual(two.results.map(x=>x.position.source_id),[1,2]);
});
test('oversize bytes are not hashed, invalid UTF8 and malformed syntax stay OPEN', () => {
  const r=review([Buffer.alloc(20)],browser,{fileBytes:10});assert.equal(r.status,'OPEN');assert.equal(r.inputs[0].sha256,undefined);
  assert.equal(review([Buffer.from([255])],browser).status,'OPEN');
  for(const s of ['document.body.innerHTML=', 'const a=1١;'+sink('"Hi"'),'const x="unclosed']) check(s,'OPEN');
});
test('token, parser recursion/calls, AST, evaluator and file budgets prevent clean PASS', () => {
  for(const limits of [{tokens:2},{tokenBytes:2},{parserDepth:3},{parserCalls:2},{nodes:3},{astDepth:2},{evaluationSteps:1}]) assert.equal(run(sink('"Hi"'),browser,limits).status,'OPEN');
  assert.equal(review([Buffer.from(sink('"Hi"')),Buffer.from(sink('"Hi"'))],browser,{files:1}).status,'OPEN');
  assert.equal(run(sink('!'.repeat(10000)+'false')).status,'OPEN');
});
test('FAIL plus OPEN survive source, result and report budget boundaries', () => {
  const r=review([Buffer.from(sink('data')+';'+sink('"Hi"')),Buffer.alloc(30)],browser,{results:1,reportBytes:2048,fileBytes:29});
  // First admitted source is allowed a separate byte cap in this fixture.
  const r2=review([Buffer.from(sink('data')+';'+sink('"Hi"')),Buffer.alloc(300)],browser,{results:1,reportBytes:2048,fileBytes:256});assert.equal(r2.status,'FAIL');assert(r2.unknowns.includes('result_budget'));assert(r2.unknowns.includes('input_budget'));const b=encode(r2);assert(b.length<=2048);assert.equal(JSON.parse(b).finding_count,1);assert.equal(r.status,'OPEN');
});
test('source buffers are unchanged and source code is never evaluated', () => {
  const src=Buffer.from('globalThis.PRIVATE_TARGET_RUN=true;throw new Error("SECRET");'+sink('"Hi"'));const before=Buffer.from(src);delete globalThis.PRIVATE_TARGET_RUN;review([src],browser);assert.deepEqual(src,before);assert.equal(globalThis.PRIVATE_TARGET_RUN,undefined);
});
test('invalid options/contracts/limits cannot echo caller values or pollute prototypes', () => {
  for(const o of [null,{host:'SECRET_PATH'},{host:'browser',sourceType:null},{host:'browser',sanitizers:null},{sanitizers:[{...named,arity:2}]},{sanitizers:[{...named,argument:1}]},{sanitizers:[{...named,member:'SECRET PATH'}]},{sanitizers:[named,{arity:1,argument:0,module:'safe-library',member:null,imported:'sanitize'}]}]) {const r=run(sink('"Hi"'),o);assert.equal(r.status,'OPEN');assert(!encode(r).includes(Buffer.from('SECRET')));}
  for(const l of [[],{fileBytes:0},{reportBytes:1},{tokens:defaults.tokens+1},JSON.parse('{"__proto__":1}')]) assert.equal(run(sink('"Hi"'),browser,l).status,'OPEN');
});
test('permanent authenticity/runtime/CVP boundaries survive a rule PASS', () => {
  const r=check(sink('"Hi"'),'PASS');for(const k of ['execution','host_authenticity','sanitizer_implementation','source_authenticity','cross_file_resolution','cvp_eligibility']) assert.equal(r[k],'OPEN');
});
