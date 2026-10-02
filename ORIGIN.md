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

Codex assisted new implementation, tests and source/provenance documentation.
No upstream endorsement, human-only authorship, verified ownership, CVP
admission or complete security equivalence is claimed. Original 2015–2017
Mozilla Corporation/Frederik Braun attribution remains in `NOTICE`; the
original license text is retained. New source is distributed under MPL-2.0.

Acorn 8.15.0 is a separate MIT parser dependency, not rewritten code. The npm
distribution's SHA-512/SHA-1 and SHA-256 were checked; its recorded gitHead
exists in the official source repository. This identifies the pinned trusted
distribution, not an attested reproducible upstream build. Only listed API/
runtime ranges were inspected. Node.js is a separate mature runtime required
by the user; no Node executable is distributed here.

The intended GitHub source namespace is `dhtfish-98/DOMSinkReview`. Publication,
remote CI, applicant identity/organization and human rights/review stay `OPEN`
until independently evidenced; local directories or tests do not establish them.
