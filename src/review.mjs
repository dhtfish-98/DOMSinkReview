// SPDX-License-Identifier: MPL-2.0
import { createHash } from 'node:crypto';
import { validate, report, unknown, defaults, errorReport, Boundary } from './contracts.mjs';
import { parseSource } from './parser.mjs';
import { bindTree } from './scope.mjs';
import { analyze } from './analysis.mjs';
export { defaults, encode } from './contracts.mjs';
function offsets(source) {
  const out = new Uint32Array(source.length + 1); let byte = 0;
  for (let i = 0; i < source.length; i++) {
    out[i] = byte; const cp = source.codePointAt(i); const width = cp > 65535 ? 4 : cp > 2047 ? 3 : cp > 127 ? 2 : 1;
    if (cp > 65535) { out[++i] = byte; } byte += width;
  }
  out[source.length] = byte; return out;
}
export function review(sources, options = {}, limits = {}) {
  const valid = validate(options, limits);
  if (!valid || !Array.isArray(sources)) return errorReport('invalid_options_or_inventory');
  const { o, l } = valid, r = report(o, l); let total = 0;
  if (!sources.length) unknown(r, 'empty_source_inventory');
  if (sources.length > l.files) unknown(r, 'source_inventory_budget');
  for (let i = 0; i < Math.min(sources.length, l.files); i++) {
    const source = sources[i], id = i + 1;
    if (!Buffer.isBuffer(source)) { r.inputs.push({ source_id: id, byte_origin: 'unadmitted_source', digest_status: 'OPEN' }); unknown(r, 'invalid_source_bytes'); continue; }
    if (source.length > l.fileBytes || source.length > l.totalBytes - total) { r.inputs.push({ source_id: id, byte_origin: 'caller_supplied_buffer', digest_status: 'OPEN' }); unknown(r, 'input_budget'); continue; }
    total += source.length; const copy = Buffer.from(source);
    r.inputs.push({ source_id: id, byte_origin: 'caller_supplied_buffer', digest_status: 'PASS', bytes: copy.length, sha256: createHash('sha256').update(copy).digest('hex') });
    let text; try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(copy); } catch { unknown(r, 'invalid_utf8'); continue; }
    try {
      const ast = parseSource(text, o.sourceType, l), ctx = bindTree(ast, l);
      Object.assign(ctx, { ast, options: o, report: r, id, byteOffsets: offsets(text) }); analyze(ctx);
    } catch (error) { unknown(r, error instanceof Boundary ? error.code : error instanceof SyntaxError ? 'invalid_or_unsupported_javascript' : 'internal_review_failure'); }
  }
  if (!r.result_count) unknown(r, 'no_selected_html_sinks');
  return r;
}
