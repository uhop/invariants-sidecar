import {readFileSync} from 'node:fs';
import test from 'tape-six';

import {parseSidecar} from '../src/parse.js';
import {oracleInputsFromSidecar, instantiateAxioms, declareFromSidecar} from '../src/oracle.js';

// The oracle is a private sibling, not a dependency: load it dynamically —
// the published package (`apodictum`) first, the fleet-layout sibling
// (still `apodict` on disk) second — and skip the integration tests cleanly
// when neither resolves (CI-safe). NO_APODICT=1 forces the skip path.
const loadApodict = async () => {
  if (process.env.NO_APODICT) return null;
  const candidates = [
    ['apodictum', () => new URL('./rules/', import.meta.resolve('apodictum'))],
    [
      new URL('../../apodict/index.js', import.meta.url).href,
      () => new URL('../../apodict/rules/', import.meta.url)
    ]
  ];
  for (const [spec, rulesBase] of candidates) {
    try {
      return {oracle: await import(spec), rulesBase: rulesBase()};
    } catch {}
  }
  return null;
};

const apodict = await loadApodict();
const integration = apodict ? test : test.skip;

const sidecar = parseSidecar(
  readFileSync(new URL('../sidecars/nano-binary-search-family.md', import.meta.url), 'utf8')
);
const inputs = oracleInputsFromSidecar(sidecar);

const apodictRules = name =>
  apodict.oracle.parseBank(readFileSync(new URL(name, apodict.rulesBase), 'utf8'));

test('the bridge extracts axioms and declares with provenance', t => {
  t.equal(inputs.axioms.length, 1);
  const [axiom] = inputs.axioms;
  t.equal(axiom.name, 'nano-binary-search law:membership-trichotomy');
  t.equal(axiom.source, 'nano-binary-search@^1.1.0 sidecar');
  t.deepEqual(Object.keys(axiom.atoms), ['incl', 'idxFound', 'cntPos']);
  t.equal(axiom.formulas.length, 2);
  t.equal(inputs.declares.length, 1);
  t.deepEqual(inputs.declares[0].exports.count, ['pure', 'total']);
});

test('instantiation renames placeholders and rejects unbound ones', t => {
  const entries = instantiateAxioms(inputs.axioms, {
    incl: 'hasIt',
    idxFound: 'foundIdx',
    cntPos: 'cntPos'
  });
  t.equal(entries.length, 2);
  t.deepEqual(entries[0].formula, ['iff', 'hasIt', 'foundIdx']);
  t.equal(entries[0].name, 'nano-binary-search law:membership-trichotomy #1');
  t.equal(entries[0].source, 'nano-binary-search@^1.1.0 sidecar');
  t.throws(() => instantiateAxioms(inputs.axioms, {incl: 'hasIt'}), /unbound axiom atom/);
});

test('declareFromSidecar maps query symbols to sidecar flags', t => {
  const declare = declareFromSidecar(inputs.declares, {
    hasIt: 'includes',
    foundIdx: 'indexOf',
    other: 'insert'
  });
  t.deepEqual(declare, {hasIt: ['pure', 'total'], foundIdx: ['pure', 'total']});
});

// The §6.2 rewrite-tier consumption, end-to-end against the real oracle:
// a redundant double-spelled membership check collapses because the
// library's own blessed law licenses it, with the sidecar cited in the
// law trail.
integration('a sidecar law does real oracle work with provenance in the trail', t => {
  const {equivalent, simplify, liftAxioms, resolveBanks} = apodict.oracle;
  const assume = instantiateAxioms(inputs.axioms, {
    incl: 'hasIt',
    idxFound: 'foundIdx',
    cntPos: 'cntPos'
  });

  const bare = equivalent(['and', 'hasIt', 'foundIdx'], 'hasIt');
  t.notOk(bare.verdict);

  const under = equivalent(['and', 'hasIt', 'foundIdx'], 'hasIt', {assume});
  t.ok(under.verdict);

  const banks = [apodictRules('base-boolean.md'), apodictRules('house-tactics.md')];
  const {rules} = resolveBanks(banks, 'house-tactics');
  const declare = declareFromSidecar(inputs.declares, {
    hasIt: 'includes',
    foundIdx: 'indexOf',
    cntPos: 'count'
  });
  // provenance flows into lifted rules mechanically — every minted rule
  // cites the sidecar as its source (search-free check; the full collapse
  // runs but sits behind a ~5k-node equation plateau, measured 38-96s —
  // demonstrated once, recorded, not suite-pinned)
  const lifted = liftAxioms(
    assume,
    rules.filter(rule => rule.over !== 'statements')
  );
  t.ok(lifted.length >= 2);
  t.ok(lifted.every(rule => rule.source === 'nano-binary-search@^1.1.0 sidecar'));
  t.ok(lifted.some(rule => rule.name.includes('membership-trichotomy')));

  // the licensing round-trip: WITHOUT the sidecar's totality flags the
  // oracle refuses the very rewrites the law licenses, naming its demands —
  // the library must vouch totality before its law may erase a read
  const refused = simplify(['and', 'hasIt', 'foundIdx'], rules, {assume, limit: 60});
  const demandRejections = refused.rejected.filter(x => x.rule === 'derivation-licensing');
  t.ok(demandRejections.length >= 1);
  t.ok(demandRejections.some(x => Object.values(x.demands).some(flags => flags.includes('total'))));
});
