import {readFileSync} from 'node:fs';
import test from 'tape-six';
import fc from 'fast-check';
import 'tape-six-fast-check';
import {
  lowerBound,
  upperBound,
  indexOf,
  lastIndexOf,
  includes,
  equalRange,
  count,
  insert,
  remove,
  removeAll
} from 'nano-binary-search';

import {parseSidecar} from '../src/parse.js';
import {compileChecks} from '../src/compile.js';

const sidecar = parseSidecar(
  readFileSync(new URL('../sidecars/nano-binary-search-family.md', import.meta.url), 'utf8')
);
const checks = compileChecks(sidecar);
const less = (a, b) => a < b;

// small value range → dense duplicates, the family's interesting regime
const arbCase = fc
  .record({
    values: fc.array(fc.integer({min: -8, max: 8}), {maxLength: 30}),
    value: fc.integer({min: -9, max: 9})
  })
  .map(({values, value}) => ({sorted: [...values].sort((x, y) => x - y), value}));

test('the family sidecar parses with all claim kinds', t => {
  t.equal(sidecar.name, 'sorted-array family');
  const kinds = sidecar.claims.reduce(
    (acc, c) => ((acc[c.kind] = (acc[c.kind] || 0) + 1), acc),
    {}
  );
  t.deepEqual(kinds, {pre: 2, post: 4, law: 4, effects: 4, pattern: 1, hazard: 3});
  t.deepEqual(Object.keys(checks), [
    'pre:sorted',
    'post:lowerBound-first-not-less',
    'post:upperBound-first-greater',
    'law:bounds-ordered',
    'law:window-is-equivalence'
  ]);
});

test('bound postconditions hold against the real library', async t => {
  await t.prop(
    [arbCase],
    ({sorted, value}) => {
      const l = 0,
        r = sorted.length;
      if (!checks['pre:sorted'](sorted, less, l, r)) return false;
      const lo = lowerBound(sorted, value);
      const hi = upperBound(sorted, value);
      return (
        checks['post:lowerBound-first-not-less'](lo, sorted, value, less, l, r) &&
        checks['post:upperBound-first-greater'](hi, sorted, value, less, l, r) &&
        checks['law:bounds-ordered'](lo, hi, l, r)
      );
    },
    'lowerBound/upperBound definitions + bounds-ordered'
  );
});

test('the counting and membership laws hold', async t => {
  await t.prop(
    [arbCase],
    ({sorted, value}) => {
      const l = 0,
        r = sorted.length;
      const lo = lowerBound(sorted, value);
      const hi = upperBound(sorted, value);
      const range = equalRange(sorted, value);
      if (count(sorted, value) !== hi - lo) return false;
      if (range[0] !== lo || range[1] !== hi) return false;
      const inc = includes(sorted, value);
      const idx = indexOf(sorted, value);
      const last = lastIndexOf(sorted, value);
      if (inc !== idx >= 0 || inc !== count(sorted, value) > 0) return false;
      if (idx >= 0 && (idx !== lo || last !== hi - 1)) return false;
      if (idx < 0 && last !== -1) return false;
      return checks['law:window-is-equivalence'](range, sorted, value, less, l, r);
    },
    'count/equalRange/membership trichotomy + window equivalence'
  );
});

test('mutator effects: insert is one stable splice', async t => {
  await t.prop(
    [arbCase],
    ({sorted, value}) => {
      const copy = [...sorted];
      const hiBefore = upperBound(copy, value);
      const i = insert(copy, value);
      return (
        i === hiBefore &&
        copy.length === sorted.length + 1 &&
        copy[i] === value &&
        checks['pre:sorted'](copy, less, 0, copy.length)
      );
    },
    'effects:insert-one-splice'
  );
});

test('mutator effects: remove and removeAll', async t => {
  await t.prop(
    [arbCase],
    ({sorted, value}) => {
      const one = [...sorted];
      const had = includes(one, value);
      const removed = remove(one, value);
      if (removed !== had) return false;
      if (one.length !== sorted.length - (had ? 1 : 0)) return false;
      const all = [...sorted];
      const n = count(all, value);
      if (removeAll(all, value) !== n) return false;
      return all.length === sorted.length - n && !includes(all, value);
    },
    'effects:remove-first-occurrence + removeAll-window'
  );
});

test('hazard witnesses are real: derived equality and stable insert', t => {
  const byKey = (a, b) => a.k < b.k;
  const arr = [{k: 1, tag: 'x'}];
  const probe = {k: 1, tag: 'y'};
  t.ok(includes(arr, probe, byKey));
  t.equal(indexOf(arr, probe, byKey), 0);
  t.notOk(arr[0] === probe);

  const dupes = [
    {k: 1, tag: 'a'},
    {k: 1, tag: 'b'}
  ];
  const added = {k: 1, tag: 'c'};
  const at = insert(dupes, added, byKey);
  t.equal(at, 2);
  t.equal(dupes[2].tag, 'c');

  const held = dupes[1];
  remove(dupes, held, byKey);
  t.equal(dupes[0].tag, 'b');
});
