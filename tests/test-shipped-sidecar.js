import {readFileSync} from 'node:fs';
import test from 'tape-six';

import {parseSidecar, SIDECAR_VERSION} from '../src/parse.js';
import {compileChecks} from '../src/compile.js';
import {resolveSidecar} from '../src/resolve.js';

// nano-binary-search 1.2.0 is the first package on npm shipping a sidecar, so
// the copy under `sidecars/` is pinned against the real artifact here instead
// of being re-verified by hand each time somebody notices. The copy is kept
// rather than retired: test-guards.js contrasts its single `pre:sorted` guard
// against the fixture's `pre:partitioned`, and the shipped file carries both,
// so one shared source cannot express that contrast.

const dir = new URL('../node_modules/nano-binary-search/', import.meta.url);
const read = rel => readFileSync(new URL(rel, dir), 'utf8');

const resolved = resolveSidecar(read);
const family = parseSidecar(
  readFileSync(new URL('../sidecars/nano-binary-search-family.md', import.meta.url), 'utf8')
);

// Claims the copy states differently on purpose. Each entry is a scope
// decision; anything else that fails the pin below is drift.
const SCOPED = {
  'effects:pure-queries': 'the copy omits `binarySearch`, which is out of the family scope'
};

// `tests/fixtures/binary-search-sidecar.md` is deliberately NOT pinned: it is
// frozen at `binds: ^1.0.14` and an older claim-naming generation
// (`effects:pure`, `hazard:mutating-lessFn`), which keeps the parser tests
// independent of what the dependency currently ships.

test('the shipped sidecar resolves through the manifest key', t => {
  t.ok(resolved, 'nano-binary-search ships a sidecar');
  t.notOk(resolved.skipped, 'the resolver did not refuse it');
  t.equal(resolved.via, 'manifest', '`invariants` wins over the filename fallback');
  t.equal(resolved.path, 'INVARIANTS.md');
  t.equal(resolved.sidecar.version, SIDECAR_VERSION);
  t.equal(resolved.stale, false, '`binds` covers the installed version');
  t.ok(resolved.verified, '`verified: ci` clears the ingestion boundary');
});

test('the shipped claims compile', t => {
  const checks = compileChecks(resolved.sidecar);
  t.ok(Object.keys(checks).length > 0, 'the artifact carries executable checks');
  for (const [name, fn] of Object.entries(checks))
    t.equal(typeof fn, 'function', `${name} compiled to a callable`);
});

test('every claim in the family copy is the shipped claim', t => {
  const shipped = new Map(resolved.sidecar.claims.map(c => [`${c.kind}:${c.name}`, c]));
  for (const claim of family.claims) {
    const key = `${claim.kind}:${claim.name}`;
    const real = shipped.get(key);
    if (!real) {
      t.fail(`${key} is in the copy but not in the shipped artifact`);
      continue;
    }
    if (SCOPED[key]) {
      t.notDeepEqual(claim, real, `${key} differs by design: ${SCOPED[key]}`);
      continue;
    }
    t.deepEqual(claim, real, `${key} matches the shipped artifact`);
  }
});
