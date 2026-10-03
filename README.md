# DOMSinkReview


New implementation author: **dhtfish98**. Current project version: **0.1.2**.

A new, offline, bounded JavaScript AST analyzer for declared HTML sinks and
local sanitizer bindings. It uses the mature Acorn 8.15.0 parser as a separate
MIT dependency. It does not invoke the original Mozilla ESLint plugin.

Only explicit source bytes and data assertions are analyzed. No target JavaScript,
browser, HTML payload, source module, ESLint configuration, parser plugin,
auto-fix, workflow or network request is executed or resolved.

## Use

Node.js 22–26 is the declared runtime range; local evidence uses Node 25.9.0.
From this source checkout, prepare the single trusted dependency with
`npm ci --ignore-scripts`, then run the analyzer with a fixed local request:

```sh
node src/cli.mjs < examples/request-pass.json
node src/cli.mjs < examples/request-fail.json
node src/cli.mjs < examples/request-open.json
node src/cli.mjs < examples/request-sanitizer.json
```

Installed packages provide `dom-sink-review < request.json`. This command
reads bounded stdin JSON, not filenames or directories. Files may be encoded
into the request by an authorized caller; the analyzer receives their exact
decoded bytes with numeric source IDs. It does not claim to check filesystem
symlinks, path ancestry, file permissions, concurrent file writers or the
origin of the caller's byte inventory. No target filesystem path is opened.

The request is data with this shape:

```json
{
  "sources": [{"base64": "ZG9jdW1lbnQuYm9keS5pbm5lckhUTUw9IkhlbGxvIg=="}],
  "options": {"host": "browser", "sourceType": "module", "sanitizers": []},
  "limits": {}
}
```

Use the delivered example files for a working request. Base64 must be
canonical. JSON rejects duplicate decoded keys, nonfinite numbers, excess
depth, unsupported fields and non-UTF-8 input. `--max-request-bytes N` may
lower the stdin cap. `--help` prints ordinary help; every other outcome
prints one bounded JSON report without echoing argument or source text.

Exit 0 means `PASS` for admitted checks in this frozen subset. Exit 1 means
at least one source-policy `FAIL`. Exit 2 means `OPEN` without a known policy
finding. Findings and `OPEN` can coexist; counts survive detail omission.
Actual execution, host/sanitizer/source authenticity, cross-file resolution
and CVP eligibility stay `OPEN`, including when individual rules pass.

The library exports `review(buffers, options, limits)` and `encode(report)`:

```js
import {review, encode} from 'dom-sink-review';
const result = review([Buffer.from('document.body.innerHTML="Hello"')],
                      {host: 'browser', sourceType: 'module'});
process.stdout.write(encode(result));
```

Buffers are snapshotted after budget admission and never modified. Other
source types are rejected. API options are trusted data objects; the CLI
obtains them through the strict JSON reader.

## Frozen source-policy contract

The syntax catalog is Acorn ECMAScript 2024, explicit `module` or `script`.
No auto-detection or Babel/TypeScript/Flow/JSX configuration is loaded.
Those unsupported wrappers return `OPEN`. Regexp literals also return `OPEN`:
the analyzer disables Acorn's regexp construction path. It never creates,
executes or tests a regexp supplied by target source.

| Sink | Receiver and admitted inputs |
| --- | --- |
| `innerHTML`, `outerHTML` | Declared element; shadow root supports `innerHTML` only. Simple `=` checks RHS. Every compound/logical compound assignment and update is `OPEN` because the previous value is unknown. |
| `insertAdjacentHTML` | Declared element, exactly two arguments; first is a constant standard position, second is the HTML value. |
| `createContextualFragment` | Declared range from `document.createRange()`, exactly one HTML argument. |
| `setHTMLUnsafe` | Declared element or shadow root, exactly one HTML argument; options/custom sanitizer overloads are `OPEN`. |
| `document.write`, `document.writeln` | Declared document, every argument checked; zero arguments has an empty-inventory observation. Multiple arguments containing a trusted sanitizer result also produce composition `OPEN`. |

Missing/excess/spread arguments, optional calls, detached sink methods,
`.call`/`.apply`, sink tagged templates, unresolved computed names and loop
flow stay `OPEN`. A matched member name alone does not prove a DOM receiver.

`host: "browser"` is an explicit assertion of standard browser globals.
Without it, receiver-dependent checks stay `OPEN`. The finite receiver model
supports unshadowed `document`, `window.document`, `globalThis.document`,
document body/root, immutable `const` aliases, selected element queries/
factories, ranges and shadow roots. Nullable returns do not prove that a path
runs. Parameters, arbitrary function returns, object-held aliases and other
host classes remain unresolved. A plain object's direct `write` is distinct
from document output; its child properties do not inherit an ordinary-object
proof. Capturing a DOM object in an object/array (including nested containers),
member storage, mutable/destructured binding or return/spread boundary adds
`OPEN` immediately; arbitrary heap resolution is not assumed. Earlier known
policy failures survive this uncertainty. Lexical shadows, critical host-member
overrides, direct DOM-object escapes, prototype writes, eval/Function, script Annex B function ambiguity
and `with` preserve `OPEN`. Arbitrary indirect heap aliasing, callbacks and
external host changes are outside this bounded model.

Static primitives, immutable local `const` chains, fully static templates/
`+` composition and selected constant conditionals pass the static-data
policy. This does not inspect whether an author's literal HTML is desirable.
Known data references/parameters or member values reaching a declared HTML
sink without safety evidence are source-policy `FAIL`: HTML safety is not
established. This is not a confirmed vulnerability or a reachability verdict.
Mutable bindings, TDZ/cycles, dynamic calls, unsupported expressions and
unresolved conditions stay `OPEN`. Const/object/import data are never merged
between source items, and no source module is imported.

## Sanitizer assertions

There are no trusted names by default. A caller may assert a static import
export's exact one-argument, parameter-zero contract that returns sanitized
HTML suitable as the complete HTML sink value:

```json
{"module":"safe-library","imported":"sanitize","member":null,"arity":1,"argument":0}
```

`imported` can be a named export, `default`, or `*` with a required member.
The analyzer ties a call to its actual lexical import binding, module,
export, optional member and argument shape. Immutable aliases of directly
imported functions and import objects are supported. Local same-name
functions, shadows, wrong exports/providers, mutation/namespace escapes,
optional/spread/multiple arguments and detached member aliases cannot pass.
An imported provider/function captured in object/array storage, member assignment,
mutable/destructured bindings or return/spread boundaries loses trust immediately,
even if a later escape is not demonstrated. Immutable direct aliases remain
supported. A same-name property key or a container of ordinary literals does
not establish such a capture.
Tagged escapers and options overloads have no trusted contract in this subset.

The assertion does not audit or attest the provider's implementation, module
resolution, runtime version, output type or efficacy. Sanitized results used
in concatenation or interpolation stay `OPEN`: this contract does not prove
safety in a newly composed HTML/attribute context. `document.write` and
`document.writeln` concatenate their arguments before parsing, as specified by
the [HTML Standard document write steps](https://html.spec.whatwg.org/multipage/dynamic-markup-insertion.html#document-write-steps).
Therefore multi-argument calls containing a sanitizer result preserve `OPEN`
for the combined context, while every argument is still checked for policy
failures. A single sanitizer argument and fully static multi-argument calls
retain their declared PASS behavior. Assertions are reflected
as a contract count; module/export/name/source text is not echoed.

## Positions, privacy and budgets

Reports contain numeric source IDs, physical 1-based line/UTF-16 columns,
0-based UTF-8 byte offsets, fixed rules/reasons, bounded evidence positions
and admitted input SHA-256/byte counts. Names, literals, imports, URLs, paths,
parser error messages and request text are omitted. Source comments do not
override coordinates. Digests identify observed supplied bytes, not authentic
files; rejected oversized buffers have no hash.

Defaults: 32 source items, 256 KiB/file, 1 MiB admitted bytes, 2 MiB stdin
request, 32768 tokens/file, 8192 token/constant bytes, 200000 parser method
calls/file, 256 parser depth, 50000 AST nodes/file, 128 AST depth, 50000
evaluation steps/file, 32 binding/value reference depth, 512 detailed results,
32 evidence positions/result and 1 MiB final JSON including its newline.
Positive limits may only lower defaults; JSON caps are at least 2048 bytes.
JSON structure is additionally limited to depth 32 and 100000 data nodes.
Budget exhaustion never produces a clean `PASS`; known findings remain.

## Origin and local evidence

Reference Mozilla `eslint-plugin-no-unsanitized` at
`7eb1c8ae4179da3bc3916ece1818cc493f026764`, MPL-2.0. `SOURCE_REVIEW.json`
records all four selected runtime entry/rule/helper files, complete selected
docs/config/license and precisely labeled partial test/lock ranges. Fixed
tree blobs and remote bytes match. This is a complete new implementation of
this finite subset, not the entire plugin's configurable rule surface,
TypeScript/Babel support or ESLint execution platform.

New implementation author: dhtfish98. Original Mozilla/
Frederik Braun attribution and MPL text are retained. Acorn is a pinned,
separate mature dependency with its exact MIT notice. Local tests, package
identity and fresh offline consumer evidence are in `VALIDATION.md` and the
engineering report. GitHub publication, remote CI, human review/ownership,
applicant identity/organization and CVP admission need separate evidence.
