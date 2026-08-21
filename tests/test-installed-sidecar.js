import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

import test from 'tape-six';

import {parseSidecar, SIDECAR_VERSION} from '../src/parse.js';
import {compileChecks} from '../src/compile.js';
import {resolveSidecar} from '../src/resolve.js';
import {oracleInputsFromSidecar} from '../src/oracle.js';

// The integration this package existed to enable, against the real thing: a
// dependency that ships a sidecar, read out of node_modules by the published
// discovery path. nano-binary-search is the first package on npm to ship one
// (1.2.0, 2026-08-20), and it is a devDependency here, so the artifact is on
// disk. These assertions are structural on purpose — a nano release that adds
// a claim must not fail this suite; one that drops, breaks, or unverifies the
// sidecar must.
const DEP = fileURLToPath(new URL('../node_modules/nano-binary-search/', import.meta.url));
const read = rel => readFileSync(join(DEP, rel), 'utf8');

test('the installed dependency resolves through the manifest key, verified and current', t => {
  const found = resolveSidecar(read);
  t.ok(found, 'a sidecar is found at all');
  t.notOk(found.skipped, `not refused${found.skipped ? ': ' + found.skipped : ''}`);
  t.equal(found.via, 'manifest', 'the "invariants" key wins over the root filename');
  t.equal(found.verified, true, 'verified: ci — its claims are ingestible, not merely readable');
  t.equal(found.stale, false, 'binds still covers the installed version');
  t.equal(found.sidecar.version, SIDECAR_VERSION, 'a format version this parser implements');
  t.ok(found.sidecar.claims.length > 0);
});

test('its claims compile and reach the oracle bridge', t => {
  const sidecar = parseSidecar(read('INVARIANTS.md'));
  const checks = compileChecks(sidecar);
  t.ok(Object.keys(checks).length > 0, 'executable checks compile');
  const inputs = oracleInputsFromSidecar(sidecar);
  t.notOk(inputs.unverified, 'the verified gate is open');
  t.ok(inputs.axioms.length > 0, 'at least one law: axiom block');
  t.ok(inputs.declares.length > 0, 'at least one effects: flags block');
  for (const axiom of inputs.axioms)
    t.ok(
      /@\^?\d+\.\d+\.\d+ sidecar$/.test(axiom.source),
      `${axiom.name} carries version provenance`
    );
});

// The local fixture is a narrower, frozen worked example — the sibling exports
// only — kept so the parser tests own their input instead of tracking a
// dependency's release cadence. That freedom is exactly what lets it drift, so
// this is the check that it has not: every claim the two share must still say
// the same thing.
test('the frozen family fixture has not drifted from the shipped artifact', t => {
  const fixture = parseSidecar(
    readFileSync(new URL('../sidecars/nano-binary-search-family.md', import.meta.url), 'utf8')
  );
  const shipped = parseSidecar(read('INVARIANTS.md'));
  const key = c => `${c.kind}:${c.name}`;
  const byKey = s => Object.fromEntries(s.claims.map(c => [key(c), c]));
  const A = byKey(fixture);
  const B = byKey(shipped);

  const shared = Object.keys(A).filter(k => B[k]);
  t.ok(shared.length > 0, 'the two overlap at all');
  t.equal(fixture.frontmatter.binds, shipped.frontmatter.binds, 'both bind the same range');

  // effects:pure-queries differs by design: the shipped file covers binarySearch
  // as well as the family, so it names one more export than the family-only fixture
  const SCOPED = new Set(['effects:pure-queries']);
  for (const k of shared) {
    if (SCOPED.has(k)) continue;
    t.equal(A[k].prose, B[k].prose, `${k}: prose matches`);
    t.deepEqual(A[k].check ?? null, B[k].check ?? null, `${k}: check matches`);
  }

  const onlyFixture = Object.keys(A).filter(k => !B[k]);
  t.deepEqual(onlyFixture, [], 'the fixture claims nothing the shipped artifact dropped');
});
