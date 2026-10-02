// SPDX-License-Identifier: MPL-2.0
import { review } from './review.mjs';
import { request } from './input.mjs';
import { defaults, encode, errorReport, Boundary } from './contracts.mjs';

export async function run(args, input, output) {
  if (args.length === 1 && args[0] === '--help') { output.write('dom-sink-review [--max-request-bytes N] < request.json\nRequest: {"sources":[{"base64":"..."}],"options":{"host":"browser","sourceType":"module","sanitizers":[]},"limits":{}}\n'); return 0; }
  let max = defaults.requestBytes;
  if (args.length) {
    if (args.length !== 2 || args[0] !== '--max-request-bytes' || !/^[1-9][0-9]{0,7}$/.test(args[1]) || Number(args[1]) > max) { output.write(encode(errorReport('invalid_arguments'))); return 2; }
    max = Number(args[1]);
  }
  let r;
  try {
    let total = 0; const chunks = [];
    for await (const chunk of input) { const b = Buffer.from(chunk); total += b.length; if (total > max) { input.destroy?.(); throw new Boundary('request_byte_budget'); } chunks.push(b); }
    const raw = Buffer.concat(chunks, total), req = request(raw);
    if (req.limits && Number.isSafeInteger(req.limits.requestBytes) && raw.length > req.limits.requestBytes) throw new Boundary('request_byte_budget');
    r = review(req.sources, req.options, req.limits);
  } catch (e) { r = errorReport(e instanceof Boundary ? e.code : 'request_read_failed'); }
  output.write(encode(r)); return r.status === 'FAIL' ? 1 : r.status === 'OPEN' ? 2 : 0;
}
