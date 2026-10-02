// SPDX-License-Identifier: MPL-2.0
import { Parser } from 'acorn';
import { Boundary } from './contracts.mjs';

// Trusted, pinned parser methods are wrapped; no caller parser/config/plugin is loaded.
class BoundedParser extends Parser {}
for (const name of Object.getOwnPropertyNames(Parser.prototype)) {
  if (!name.startsWith('parse') || typeof Parser.prototype[name] !== 'function') continue;
  const original = Parser.prototype[name];
  Object.defineProperty(BoundedParser.prototype, name, { value: function (...args) {
    const l = this.options.reviewLimits;
    this.reviewCalls = (this.reviewCalls ?? 0) + 1;
    this.reviewDepth = (this.reviewDepth ?? 0) + 1;
    if (this.reviewCalls > l.parserCalls || this.reviewDepth > l.parserDepth) throw new Boundary('parser_budget');
    try { return original.apply(this, args); } finally { this.reviewDepth--; }
  } });
}
BoundedParser.prototype.readRegexp = function () { throw new Boundary('unsupported_regexp_literal'); };
export function parseSource(source, sourceType, limits) {
  let tokens = 0;
  // Acorn's options normalizer discards unknown keys, so attach limits to its
  // normalized options before calling the instance parser.
  const p = new BoundedParser({ ecmaVersion: 2024, sourceType, locations: true, allowHashBang: false, onToken(token) {
    if (++tokens > limits.tokens) throw new Boundary('token_budget');
    if (Buffer.byteLength(source.slice(token.start, token.end)) > limits.tokenBytes) throw new Boundary('token_size_budget');
  } }, source);
  p.options.reviewLimits = limits;
  return p.parse();
}
export function children(node) {
  const out = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc') continue;
    if (value && typeof value === 'object' && typeof value.type === 'string') out.push([key, value]);
    else if (Array.isArray(value)) for (const v of value) if (v && typeof v.type === 'string') out.push([key, v]);
  }
  return out;
}
