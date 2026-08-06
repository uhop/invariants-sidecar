import test from 'tape-six';
import fc from 'fast-check';
import 'tape-six-fast-check';

import {complete, makeLawTests, makeConsistencyTests, runLaws} from '../index.js';

// Maybe over integers: the minimal Monad base {of, chain} plus equals, with
// map also provided by hand — exactly the shape the consistency clause exists
// for. Nothing is a shared sentinel.
const NOTHING = {nothing: true};
const Maybe = {
  of: value => ({value}),
  chain: (kf, u) => (u === NOTHING ? NOTHING : kf(u.value)),
  map: (f, u) => (u === NOTHING ? NOTHING : {value: f(u.value)}),
  equals: (a, b) => (a === NOTHING || b === NOTHING ? a === b : a.value === b.value)
};

const arb = fc.oneof(
  fc.constant(NOTHING),
  fc.integer().map(n => Maybe.of(n))
);
const arbA = fc.integer();
const arbFn = fc.func(fc.integer());
const arbK = fc.oneof(
  fc.constant(() => NOTHING),
  fc.func(fc.integer()).map(f => x => Maybe.of(f(x)))
);
const opts = {arb, arbA, arbFn, arbK};

test('complete() derives ap and map-from-chain provenance on Maybe', t => {
  const {module: M, derived, consistency} = complete(Maybe);
  t.equal(typeof M.ap, 'function');
  t.deepEqual(derived.ap, ['chain', 'map']);
  t.notOk('map' in derived);
  // two applicable derivations of map post-completion (ap+of, chain+of) —
  // the hand version owes agreement with each
  t.deepEqual(
    consistency.map(c => [c.method, ...c.needs]),
    [
      ['map', 'ap', 'of'],
      ['map', 'chain', 'of']
    ]
  );
  const two = Maybe.of(2);
  t.ok(
    M.equals(
      M.ap(
        Maybe.of(x => x + 1),
        two
      ),
      Maybe.of(3)
    )
  );
  t.ok(M.equals(M.ap(NOTHING, two), NOTHING));
});

test('Maybe satisfies its law sets', async t => {
  const {module: M} = complete(Maybe);
  const tests = makeLawTests(M, opts);
  t.equal(tests.length, 11);
  await runLaws(t, tests);
});

test('the consistency clause holds for the hand-written map', async t => {
  await runLaws(t, makeConsistencyTests(Maybe, opts));
});

test('a wrong hand-written map is refuted by the consistency tests', t => {
  const Bad = {...Maybe, map: (f, u) => (u === NOTHING ? NOTHING : {value: f(f(u.value))})};
  const runs = makeConsistencyTests(Bad, opts).map(({arbs, predicate}) =>
    fc.check(fc.property(...arbs, predicate))
  );
  // the ap+of path routes through the bad map itself (derived ap uses T.map),
  // so it agrees with the bug; the chain+of path avoids it and refutes —
  // multi-path obligations are what make a corrupted method catchable
  t.ok(runs.some(run => run.failed));
});

test('a non-associative concat is refuted by the Semigroup law', t => {
  const Sub = {
    of: value => ({value}),
    concat: (a, b) => Sub.of(a.value - b.value),
    equals: (a, b) => a.value === b.value
  };
  const [assoc] = makeLawTests(Sub, {
    ...opts,
    arb: fc.integer().map(n => Sub.of(n)),
    typeclasses: ['Semigroup']
  });
  const run = fc.check(fc.property(...assoc.arbs, assoc.predicate));
  t.ok(run.failed);
});

test('laws are selected by available methods and requested typeclasses', t => {
  const functorOnly = {map: Maybe.map, equals: Maybe.equals};
  const names = makeLawTests(functorOnly, opts).map(x => x.name);
  t.deepEqual(names, [
    'Setoid: reflexivity',
    'Setoid: symmetry',
    'Setoid: transitivity',
    'Functor: identity',
    'Functor: composition'
  ]);
  const monadOnly = makeLawTests(complete(Maybe).module, {...opts, typeclasses: ['Monad']});
  t.equal(monadOnly.length, 2);
});

test('a sidecar drives the whole law suite through the bridge', async t => {
  const {readFileSync} = await import('node:fs');
  const {parseSidecar} = await import('../src/parse.js');
  const {lawTestsFromSidecar} = await import('../src/compile.js');
  const sidecar = parseSidecar(
    readFileSync(new URL('./fixtures/maybe-sidecar.md', import.meta.url), 'utf8')
  );
  t.deepEqual(sidecar.implements, ['Setoid', 'Functor', 'Applicative', 'Chain', 'Monad']);
  const tests = lawTestsFromSidecar(sidecar, {...Maybe, nothing: NOTHING}, opts);
  // 11 laws + 2 map-consistency obligations + 1 custom law
  t.equal(tests.length, 14);
  await runLaws(t, tests);
});
