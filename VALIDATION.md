# Local engineering validation

## Version 0.1.1, 2026-10-03

All 41 source tests pass on local Node.js 25.9.0 / Darwin arm64. New regressions
cover both write methods, sanitizer arguments in each position and through
immutable aliases, two sanitizer fragments, single-sanitizer and static-only
PASS controls, and two independent argument failures surviving composition
OPEN plus result/report omission. Independent source probes confirm the
previous composed PASS observations now become OPEN, while known argument
failures remain FAIL. No fixture, browser or sanitizer implementation runs.

The [HTML Standard document write steps](https://html.spec.whatwg.org/multipage/dynamic-markup-insertion.html#document-write-steps)
combine every argument into one string before HTML parsing; writeln adds a
newline. The finite contract for a complete sanitized HTML value does not
certify a new attribute/HTML context produced by joining separate arguments.
This correction is conservative source-policy uncertainty, not a demonstrated
runtime exploit or a claim about the provider's actual implementation.

`SOURCE_REVIEW_MANIFEST.json` binds current complete formal source bytes.
`SOURCE_AUDIT.json` remains the historical version 0.1.0 runtime snapshot;
`SOURCE_REVIEW.json` retains its fixed original-upstream read scope. Neither
historical record substitutes for current hashes. Fresh installed npm/source
consumers, licenses, source identities and exact new archive hashes are bound
in separate dated engineering evidence. Current-revision hosted CI, unobserved
Node/platform combinations, authenticity, ownership and CVP admission remain OPEN.

## Historical version 0.1.0

Measured Node.js 25.9.0, Darwin arm64. All new runtime, all tests, strict JSON
input/CLI, package pins, provenance, scope and CI are reviewed. 38 meaningful
local tests pass. Fixtures cover all sink families and argument positions,
literal/template/const data, real Acorn grammar, import contract bindings,
same-name/lexical shadows, mutation/escape, receiver types, compound/logical
assignment, optional/tagged/function-value calls, loops, script/module/TS/JSX
boundaries, UTF-8/CRLF/Unicode coordinates, duplicate/nonfinite JSON, privacy,
input preservation and every declared analysis/report budget family.

Independent cross-review found that nested provider/DOM references in objects
and arrays could escape an unknown call while keeping trusted sink results.
The final source conservatively invalidates these heap captures and additional
storage/return/spread boundaries; regressions preserve ordinary literal controls
and prior known policy failures. The first 36-test freeze is historical and is
not the final validated package.

A deterministic 10000-case source mutation run returned only valid bounded
JSON statuses with no internal failures or input changes. It does not prove
exhaustive correctness. Parser API assertions check real ESTree nodes; no
generated fixture is evaluated, compiled as a target module or imported.

Fresh extracted source and installed npm consumer results, exact frozen
source/npm/archive hashes, trusted dependency identity, actual stdin examples,
installed API/CLI 0/1/2, sanitizers/host/sourceType assertions, limits/privacy
and input hashes are recorded in the external engineering report. Those
measurements apply to its exact artifact hashes, not later changes.

The offline dependency archive contains the exact Acorn npm tarball and
license/origin data. A fresh source consumer may seed a new npm cache with
`npm cache add /absolute/path/acorn-8.15.0.tgz --offline --ignore-scripts`,
then use `npm ci --offline --ignore-scripts --no-audit --no-fund` with that cache.
A fresh installed npm consumer may install both delivered local npm tarballs
together with the same offline/script-disabled options. No target project
dependencies or lifecycle/config scripts are installed or executed.

Local package installation and declared rules are separate from actual DOM
execution, sanitizer efficacy, host/source authenticity and CVP eligibility.
No browser or target script is run. GitHub publication, remote Actions,
human review/rights and applicant identity/organization/CVP admission remain OPEN.
