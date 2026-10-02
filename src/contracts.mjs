// SPDX-License-Identifier: MPL-2.0
export const defaults = Object.freeze({ files: 32, fileBytes: 262144, totalBytes: 1048576, tokens: 32768, tokenBytes: 8192, parserCalls: 200000, parserDepth: 256, nodes: 50000, astDepth: 128, evaluationSteps: 50000, results: 512, reportBytes: 1048576, requestBytes: 2097152 });
export class Boundary extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function validate(options, limits) {
  if (!options || typeof options !== 'object' || Array.isArray(options) || !limits || typeof limits !== 'object' || Array.isArray(limits)) return null;
  if (Object.keys(options).some(k => !['host', 'sourceType', 'sanitizers'].includes(k))) return null;
  if (Object.keys(limits).some(k => !Object.hasOwn(defaults, k))) return null;
  const l = { ...defaults, ...limits };
  if (Object.entries(l).some(([k, v]) => !Number.isSafeInteger(v) || v < 1 || v > defaults[k]) || l.reportBytes < 2048) return null;
  const o = { host: Object.hasOwn(options, 'host') ? options.host : 'unknown', sourceType: Object.hasOwn(options, 'sourceType') ? options.sourceType : 'module', sanitizers: Object.hasOwn(options, 'sanitizers') ? options.sanitizers : [] };
  if (!['unknown', 'browser'].includes(o.host) || !['script', 'module'].includes(o.sourceType) || !Array.isArray(o.sanitizers) || o.sanitizers.length > 32) return null;
  const seen = new Set();
  for (const s of o.sanitizers) {
    if (!s || typeof s !== 'object' || Array.isArray(s) || Object.keys(s).sort().join(',') !== 'argument,arity,imported,member,module') return null;
    if (typeof s.module !== 'string' || !/^[A-Za-z0-9@._/-]{1,512}$/.test(s.module) || typeof s.imported !== 'string' || !/^(default|\*|[A-Za-z_$][A-Za-z0-9_$]{0,127})$/.test(s.imported)) return null;
    if (s.member !== null && (typeof s.member !== 'string' || !/^[A-Za-z_$][A-Za-z0-9_$]{0,127}$/.test(s.member))) return null;
    if (s.imported === '*' && s.member === null || s.arity !== 1 || s.argument !== 0) return null;
    const key = JSON.stringify([s.module, s.imported, s.member, s.arity, s.argument]); if (seen.has(key)) return null; seen.add(key);
  }
  return { o, l };
}
export function report(o = { host: 'unknown', sourceType: 'module', sanitizers: [] }, l = defaults) {
  return { schema: 'dom-sink-review/v1', status: 'PASS', results: [], result_count: 0, finding_count: 0, unknowns: [], inputs: [], limits: l, assertions: { host: o.host, source_type: o.sourceType, sanitizer_contract_count: o.sanitizers.length }, execution: 'OPEN', host_authenticity: 'OPEN', sanitizer_implementation: 'OPEN', source_authenticity: 'OPEN', cross_file_resolution: 'OPEN', cvp_eligibility: 'OPEN' };
}
export function unknown(r, code) { if (!r.unknowns.includes(code)) r.unknowns.push(code); if (r.status !== 'FAIL') r.status = 'OPEN'; }
export function emit(r, position, rule, status, reason, evidence = []) {
  r.result_count++;
  if (status === 'FAIL') { r.finding_count++; r.status = 'FAIL'; }
  if (status === 'OPEN') unknown(r, reason);
  if (r.results.length < r.limits.results) r.results.push({ position, rule, status, reason, evidence });
  else unknown(r, 'result_budget');
}
export function errorReport(code = 'invalid_request') { const r = report(); unknown(r, code); return r; }
export function encode(r) {
  for (;;) {
    r.unknowns.sort(); const b = Buffer.from(JSON.stringify(r) + '\n'); if (b.length <= r.limits.reportBytes) return b;
    unknown(r, 'report_budget');
    if (r.results.length) { r.results.length = Math.floor(r.results.length / 2); continue; }
    if (r.inputs.length) { r.inputs.length = Math.floor(r.inputs.length / 2); continue; }
    return Buffer.from(JSON.stringify({ schema: r.schema, status: r.status, result_count: r.result_count, finding_count: r.finding_count, unknowns: ['report_budget'], execution: 'OPEN', host_authenticity: 'OPEN', sanitizer_implementation: 'OPEN', source_authenticity: 'OPEN', cross_file_resolution: 'OPEN', cvp_eligibility: 'OPEN' }) + '\n');
  }
}
