// SPDX-License-Identifier: MPL-2.0
import { Boundary } from './contracts.mjs';

// JSON is data only. This reader rejects duplicate decoded keys, nonfinite
// numbers and excess depth/nodes rather than relying on last-key-wins parsing.
export function strictJSON(bytes) {
  let s; try { s = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { throw new Boundary('invalid_request_utf8'); }
  let at = 0, nodes = 0;
  const bad = () => { throw new Boundary('invalid_request_json'); };
  const ws = () => { while (at < s.length && [' ', '\t', '\r', '\n'].includes(s[at])) at++; };
  function string() {
    const start = at++; if (s[start] !== '"') bad();
    for (; at < s.length; at++) {
      if (s.charCodeAt(at) < 32) bad();
      if (s[at] === '\\') { at++; if (at >= s.length) bad(); }
      else if (s[at] === '"') { at++; try { return JSON.parse(s.slice(start, at)); } catch { bad(); } }
    }
    bad();
  }
  function value(depth) {
    if (depth > 32 || ++nodes > 100000) throw new Boundary('request_structure_budget'); ws();
    if (s[at] === '"') return string();
    if (s[at] === '[') {
      at++; const out = []; ws(); if (s[at] === ']') { at++; return out; }
      for (;;) { out.push(value(depth + 1)); ws(); if (s[at] === ']') { at++; return out; } if (s[at++] !== ',') bad(); }
    }
    if (s[at] === '{') {
      at++; const out = Object.create(null), keys = new Set(); ws(); if (s[at] === '}') { at++; return out; }
      for (;;) { ws(); if (s[at] !== '"') bad(); const key = string(); if (keys.has(key)) bad(); keys.add(key); ws(); if (s[at++] !== ':') bad(); out[key] = value(depth + 1); ws(); if (s[at] === '}') { at++; return out; } if (s[at++] !== ',') bad(); }
    }
    for (const [word, v] of [['true', true], ['false', false], ['null', null]]) if (s.startsWith(word, at)) { at += word.length; return v; }
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(s.slice(at));
    if (!match) bad(); at += match[0].length; const n = Number(match[0]); if (!Number.isFinite(n)) bad(); return n;
  }
  const out = value(0); ws(); if (at !== s.length) bad(); return out;
}
export function request(bytes) {
  const r = strictJSON(bytes);
  if (!r || typeof r !== 'object' || Array.isArray(r) || Object.keys(r).some(k => !['sources', 'options', 'limits'].includes(k)) || !Array.isArray(r.sources) || r.sources.length > 32) throw new Boundary('invalid_request_schema');
  const sources = r.sources.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).join(',') !== 'base64' || typeof item.base64 !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(item.base64)) throw new Boundary('invalid_source_encoding');
    const b = Buffer.from(item.base64, 'base64'); if (b.toString('base64') !== item.base64) throw new Boundary('invalid_source_encoding'); return b;
  });
  return { sources, options: Object.hasOwn(r, 'options') ? r.options : {}, limits: Object.hasOwn(r, 'limits') ? r.limits : {} };
}
