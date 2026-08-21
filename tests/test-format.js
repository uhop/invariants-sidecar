import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import test from 'tape-six';

import {
  isSidecar,
  parseSidecar,
  sidecarProblems,
  readFrontmatter,
  SIDECAR_VERSION
} from '../src/parse.js';
import {resolveSidecar, satisfies} from '../src/resolve.js';
import {oracleInputsFromSidecar} from '../src/oracle.js';

const SIDECAR = `---
sidecar: 1
package: demo
binds: ^1.0.0
verified: ci
---

# demo

## Effects

- \`f\`: pure, total.

\`\`\`json flags effects:f
{"f": ["pure", "total"]}
\`\`\`
`;

// the shapes a real INVARIANTS.md takes in the wild (moonshot §6.6 survey)
const PROSE = {
  'no frontmatter (adobe/S3Mock shape)':
    '# Invariants for S3Mock\n\nNon-negotiable constraints.\n\n## API Contract\n\n- XML names must match.\n',
  'a static-site doc with unrelated frontmatter':
    '---\ntitle: Invariants\nlayout: page\n---\n\n# Invariants\n\n## API Contract\n\n- something\n',
  'agent guardrails (.claude/INVARIANTS.md shape)':
    '---\nversion: 3\n---\n\n# Project invariants\n\n## Rules\n\n- never edit main directly\n',
  'sidecar-shaped but with no identity keys':
    '---\nexport: something\n---\n\n# thing\n\n## Effects\n\n- `f`: pure.\n'
};

const project = (files, manifest) => {
  const dir = mkdtempSync(join(tmpdir(), 'sidecar-resolve-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(dir, rel, '..'), {recursive: true});
    writeFileSync(join(dir, rel), body);
  }
  return dir;
};

// the three lines a node caller supplies, since src/ imports no node builtins
const reader = dir => rel => readFileSync(join(dir, rel), 'utf8');

test('prose is not a sidecar, and saying so never throws', t => {
  for (const [label, text] of Object.entries(PROSE)) {
    t.notOk(isSidecar(text), label);
    t.ok(sidecarProblems(readFrontmatter(text)).length > 0, `${label}: a reason is given`);
  }
  t.ok(isSidecar(SIDECAR), 'the real thing passes');
});

test('the identity keys are each required, and the version must be one we implement', t => {
  const missing = key => SIDECAR.replace(new RegExp(`^${key}:.*\n`, 'm'), '');
  for (const key of ['sidecar', 'package', 'binds']) {
    t.notOk(isSidecar(missing(key)), `missing ${key}`);
    t.throws(() => parseSidecar(missing(key)), new RegExp(`missing \`${key}\``));
  }
  t.notOk(isSidecar(SIDECAR.replace('sidecar: 1', 'sidecar: 99')), 'a future version');
  t.throws(() => parseSidecar(SIDECAR.replace('sidecar: 1', 'sidecar: 99')), /unsupported/);
  t.throws(() => parseSidecar(SIDECAR.replace('sidecar: 1', 'sidecar: one')), /must be an integer/);
});

test('satisfies covers the range forms binds uses, and admits when it cannot tell', t => {
  t.equal(satisfies('1.1.0', '^1.0.14'), true);
  t.equal(satisfies('2.0.0', '^1.0.14'), false);
  t.equal(satisfies('1.0.13', '^1.0.14'), false, 'below the floor');
  t.equal(satisfies('0.2.9', '^0.2.3'), true, 'caret pins the leftmost non-zero');
  t.equal(satisfies('0.3.0', '^0.2.3'), false);
  t.equal(satisfies('1.2.9', '~1.2.3'), true);
  t.equal(satisfies('1.3.0', '~1.2.3'), false);
  t.equal(satisfies('1.2.3', '1.2.3'), true);
  t.equal(satisfies('9.9.9', '*'), true);
  t.equal(satisfies('1.0.0', '>=1.0.0 <2.0.0'), null, 'an unimplemented form is unknown');
  t.equal(satisfies('nonsense', '^1.0.0'), null);
});

test('discovery prefers the manifest key over the filename', t => {
  const dir = project(
    {'contract/api.md': SIDECAR, 'INVARIANTS.md': SIDECAR},
    {name: 'demo', version: '1.0.0', invariants: './contract/api.md'}
  );
  const found = resolveSidecar(reader(dir));
  t.equal(found.via, 'manifest');
  t.equal(found.path, 'contract/api.md');
  t.equal(found.verified, true);
  t.equal(found.stale, false);
  rmSync(dir, {recursive: true, force: true});
});

test('the root filename is the fallback, and a package with neither yields null', t => {
  const withFile = project({'INVARIANTS.md': SIDECAR}, {name: 'demo', version: '1.0.0'});
  t.equal(resolveSidecar(reader(withFile)).via, 'filename');
  rmSync(withFile, {recursive: true, force: true});

  const without = project({}, {name: 'demo', version: '1.0.0'});
  t.equal(resolveSidecar(reader(without)), null, 'no sidecar is not an error');
  rmSync(without, {recursive: true, force: true});
});

test('a candidate the resolver refuses says why instead of vanishing', t => {
  const prose = project(
    {'INVARIANTS.md': PROSE['no frontmatter (adobe/S3Mock shape)']},
    {
      name: 'demo',
      version: '1.0.0'
    }
  );
  const skippedProse = resolveSidecar(reader(prose));
  t.ok(skippedProse.skipped, 'prose at the root is refused');
  t.notOk(skippedProse.sidecar);
  rmSync(prose, {recursive: true, force: true});

  const vendored = project({'INVARIANTS.md': SIDECAR}, {name: 'not-demo', version: '1.0.0'});
  t.ok(/vendored copy/.test(resolveSidecar(reader(vendored)).skipped), 'package name must match');
  rmSync(vendored, {recursive: true, force: true});

  const ghost = project({}, {name: 'demo', version: '1.0.0', invariants: './gone.md'});
  t.ok(/missing/.test(resolveSidecar(reader(ghost)).skipped), 'a declared file that is absent');
  rmSync(ghost, {recursive: true, force: true});
});

test('binds excluding the installed version marks the sidecar stale, not invalid', t => {
  const dir = project({'INVARIANTS.md': SIDECAR}, {name: 'demo', version: '2.5.0'});
  const found = resolveSidecar(reader(dir));
  t.equal(found.stale, true);
  t.ok(found.sidecar, 'still a real sidecar — its claims drop to context, they do not vanish');
  rmSync(dir, {recursive: true, force: true});
});

test('ingestion yields nothing without verified: ci, and says so', t => {
  const verified = parseSidecar(SIDECAR);
  t.equal(oracleInputsFromSidecar(verified).declares.length, 1);
  t.notOk(oracleInputsFromSidecar(verified).unverified);

  const unverified = parseSidecar(SIDECAR.replace('verified: ci\n', ''));
  const out = oracleInputsFromSidecar(unverified);
  t.deepEqual(out.axioms, []);
  t.deepEqual(out.declares, []);
  t.equal(out.unverified, true);

  const anyway = oracleInputsFromSidecar(unverified, {allowUnverified: true});
  t.equal(anyway.declares.length, 1, 'readable as a proposal on request');

  const selfClaimed = parseSidecar(SIDECAR.replace('verified: ci', 'verified: trust-me'));
  t.equal(oracleInputsFromSidecar(selfClaimed).unverified, true, 'only `ci` clears it');
});

test('the parsed version is a number and compares against SIDECAR_VERSION', t => {
  const sidecar = parseSidecar(SIDECAR);

  // The whole point: the natural comparison a consumer writes must work.
  t.equal(sidecar.version, SIDECAR_VERSION, 'version equals the constant');
  t.equal(typeof sidecar.version, 'number', 'version is a number');

  // And the raw frontmatter stays raw — readFrontmatter is a generic reader,
  // not a typed one, so every value it yields is still the file's string.
  t.equal(typeof sidecar.frontmatter.sidecar, 'string', 'frontmatter stays string-typed');
  t.equal(sidecar.frontmatter.sidecar, '1', 'frontmatter carries the literal text');
  t.equal(typeof readFrontmatter(SIDECAR).sidecar, 'string', 'so does readFrontmatter');
});
