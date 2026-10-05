# Current release validation — 0.1.5, 2026-10-05

This patch corrects the packaged NOTICE version label, which still said 0.1.3 in public v0.1.4. Runtime source and pinned Acorn 8.15.0 remain byte-identical to public commit 92a0a2e2c26af50a3aca7fa0135944e77a26b489. The new implementation author is dhtfish98; Acorn's original copyright and MIT terms remain intact. This is a distribution metadata correction, not a new security finding or a CVP qualification claim.

The current source inventory is SOURCE_REVIEW_MANIFEST.json. Fresh build, source tests, installed consumer, package content, remote CI, tag and Release require separate version-bound checks.

## Historical release validation

# Prior release validation — 0.1.4, 2026-10-05

This patch publishes the already public Build/项目文档 layout with a matching package version. Runtime source and the Acorn 8.15.0 dependency are unchanged from public main 3d2509377749591d0ea80ddf0efab6f395e63eaf. New implementation author and maintainer: dhtfish98. The retained Acorn MIT license and applicable MPL-2.0 terms remain in the package.

The current source inventory is SOURCE_REVIEW_MANIFEST.json. Exact build, source-test, installed-consumer, package-content, remote CI, tag and release results require separate checks bound to this version; neither this source document nor historical results establish CVP eligibility or approval.

## Historical delivery evidence

# Prior delivery validation — 0.1.3

New implementation author and maintainer: dhtfish98. This patch removes only source-reference or unbundled-dependency notice copies identified as unused. Licenses/notices associated with redistributed material and specific OPEN applicability questions are retained byte-for-byte. The new own runtime differs only in version metadata; parser and policy behavior are unchanged.

Current source inventory: `SOURCE_REVIEW_MANIFEST.json` (self-digest excluded). Current source, package-install and source-package rebuild checks are recorded in the separate 2026-10-03 license-cleanup delivery evidence. Package inventories, author/version metadata and runtime bytes are checked against this formal source. Installation uses frozen local dependencies; target inputs are never executed. New-commit hosted CI and publication remain pending until the owner publishes this patch.

Engineering results do not establish human contribution, identity, organization, safeguards impact or CVP admission.

## Historical previous delivery evidence

The remaining text describes earlier versions and their original material inventories. It does not describe or validate this patch.

# Current delivery validation — 0.1.2

New implementation author and maintainer: dhtfish98. Current source inventory: `SOURCE_REVIEW_MANIFEST.json` (this manifest excludes its own digest). The 2026-10-03 delivery preserves original upstream license and notice bytes; current own runtime differs only in attribution/comments and existing version metadata.

The existing suite has 41 passing test cases in the current source and in a fresh consumer of this version. Package verification checks version/author, artifact RECORD or archive inventories, runtime bytes against the formal source, and retained third-party licenses. Consumer installation uses local frozen dependencies and does not run target inputs. Detailed current artifact hashes and execution receipts are kept in the separate delivery evidence.

New-commit hosted CI and publication remain pending until the repository owner publishes this version.

These engineering checks do not establish upstream authorship, independent human review, actual safeguards impact or CVP eligibility.

## Historical delivery evidence

The following sections describe the earlier delivery and retain its original versions and checks. They do not validate a later artifact.

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
