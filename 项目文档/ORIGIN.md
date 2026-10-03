# Source origin

Reference: mozilla/eslint-plugin-no-unsanitized, fixed commit
`7eb1c8ae4179da3bc3916ece1818cc493f026764`, MPL-2.0. Full selected runtime:
`index.js`, `lib/rules/property.js`, `lib/rules/method.js`, `lib/ruleHelper.js`.
Their entry and recursive expression/variable/source-name/receiver paths
were read completely. Exact tree/blob, SHA-256, fixed remote bytes, full
selected docs/config/license and limited test/lock ranges are separately
recorded in `SOURCE_REVIEW.json`. This is not a full upstream test suite,
package-lock dependency audit or whole upstream repository audit.

The new implementation parses JavaScript itself, builds its own lexical
bindings, evaluates a finite source subset, matches host shapes and checks
specific sink arguments. It does not wrap ESLint or the original rules.
Name-only escaper matching, regexp receiver matching, target-readable errors,
arbitrary rule configuration, parser/config execution, browser tests, dynamic
import evaluation and automatic source changes are omitted.

New implementation author: dhtfish98. Source/provenance documentation records the fixed references and review methods.
No upstream endorsement, human-only authorship, verified ownership, CVP
admission or complete security equivalence is claimed. The Mozilla source is a design reference only; no original plugin source, fixture or document excerpt is distributed. Its redundant reference-only notice copy is omitted. New source independently uses MPL-2.0.

Acorn 8.15.0 is a separate MIT parser dependency, not rewritten code. The npm
distribution's SHA-512/SHA-1 and SHA-256 were checked; its recorded gitHead
exists in the official source repository. This identifies the pinned trusted
distribution, not an attested reproducible upstream build. Only listed API/
runtime ranges were inspected. Node.js is a separate mature runtime required
by the user; no Node executable is distributed here.

The intended GitHub source namespace is `dhtfish-98/DOMSinkReview`. Publication,
remote CI, applicant identity/organization and human rights/review stay `OPEN`
until independently evidenced; local directories or tests do not establish them.

New implementation author: dhtfish98. This attribution applies to the new project implementation; original sources, licenses and third-party notices retain their authors. Automated checks do not establish independent human review or CVP eligibility.

## Current distribution and reference boundary

New analyzer source is distributed under MPL-2.0. The offline bundle redistributes actual Acorn parser source with its original MIT notice. The Mozilla plugin is reference-only; no original plugin source or fixture is bundled. New implementation author and maintainer: dhtfish98. Source identities and bounded research facts above remain provenance, not an assertion that those authors wrote or endorsed the new runtime.
