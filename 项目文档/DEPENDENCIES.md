# Trusted dependency boundary

Only external runtime dependency: Acorn 8.15.0, MIT, npm gitHead
`6dc537416ad628b3959b3ff963fbdcfdb380e0a3`. Registry tarball SHA-256:
`e46eae89bd9761f16d1d25563b837b55b4b78f3ece06ee0b9789cb2644f523b3`.
The exact npm SHA-512 integrity is pinned in package-lock.json and independently
verified against received archive bytes. Matching source gitHead, exact MIT
notice and partial read scope are recorded in `third_party/acorn/ORIGIN.json`.

The standard Acorn API yields an ESTree AST. Its pinned parser methods are
wrapped with own call/depth counters and onToken caps. Its regexp literal
construction path is disabled. No caller-provided parser subclass, plugin,
configuration, module loader or runtime code is used. Acorn's own trusted
parser internals are separate dependency code, not a new algorithm or a
complete reviewed dependency implementation.

Node.js 25.9.0 was measured locally. Node 22–26 is the declared supported
range, with remote version/CI results separately OPEN until measured. Node's
standard crypto, TextDecoder, Buffer, streams and process facilities support
byte hashing/input/output; no fs, vm, eval, network, child process or target
module import exists in the analyzer. Only this analyzer and pinned Acorn
are prepared/installed during developer engineering. Install lifecycle
scripts are disabled; no reviewed project's package dependencies are fetched.
