import {readFileSync} from 'node:fs';
import test from 'tape-six';
import fc from 'fast-check';
import 'tape-six-fast-check';
import {binarySearch} from 'nano-binary-search';

import {parseSidecar} from '../src/parse.js';
import {compileChecks} from '../src/compile.js';

// The §6.5 pipeline end-to-end: the sidecar's own executable claims,
// compiled and run as properties against the real published library.
const sidecar = parseSidecar(
  readFileSync(new URL('./fixtures/binary-search-sidecar.md', import.meta.url), 'utf8')
);
const checks = compileChecks(sidecar);

const arbCase = fc
  .record({
    sorted: fc.array(fc.integer({min: -100, max: 100})).map(a => [...a].sort((x, y) => x - y)),
    pivot: fc.integer({min: -100, max: 100})
  })
  .map(({sorted, pivot}) => ({sorted, lessFn: x => x < pivot}));

test('sidecar checks hold against the real binarySearch', async t => {
  await t.prop(
    [arbCase],
    ({sorted, lessFn}) => {
      const l = 0,
        r = sorted.length;
      if (!checks['pre:partitioned'](sorted, lessFn, l, r)) return false;
      const result = binarySearch(sorted, lessFn, l, r);
      if (!(l <= result && result <= r)) return false;
      return checks['post:partition-point'](result, sorted, lessFn, l, r);
    },
    'pre:partitioned → result-range ∧ post:partition-point'
  );
});

test('the complexity claim holds: at most ceil(log2(r - l)) + 1 lessFn calls', async t => {
  await t.prop(
    [arbCase],
    ({sorted, lessFn}) => {
      let calls = 0;
      const counted = x => (++calls, lessFn(x));
      binarySearch(sorted, counted, 0, sorted.length);
      const bound = sorted.length ? Math.ceil(Math.log2(sorted.length)) + 1 : 1;
      return calls <= bound;
    },
    'complexity:log-calls'
  );
});

test('a violated precondition really is the caller’s problem (hazard witness)', t => {
  const unsorted = [3, 1, 2];
  const lessFn = x => x < 2;
  t.notOk(checks['pre:partitioned'](unsorted, lessFn, 0, 3));
  const result = binarySearch(unsorted, lessFn, 0, 3);
  t.ok(result >= 0 && result <= 3);
  t.notOk(checks['post:partition-point'](result, unsorted, lessFn, 0, 3));
});
