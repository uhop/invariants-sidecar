import {readFileSync} from 'node:fs';
import test from 'tape-six';
import {setAbsentBehavior, throwOnFail, InvariantError} from 'tape-six-invariant';
import {binarySearch} from 'nano-binary-search';

import {parseSidecar} from '../src/parse.js';
import {guardsFromSidecar} from '../src/guards.js';

const KEY = Symbol.for('tape6.invariant.host.v1');

const family = parseSidecar(
  readFileSync(new URL('../sidecars/nano-binary-search-family.md', import.meta.url), 'utf8')
);
const binary = parseSidecar(
  readFileSync(new URL('./fixtures/binary-search-sidecar.md', import.meta.url), 'utf8')
);

test('guards are built for check-bearing pre claims only', t => {
  const guards = guardsFromSidecar(family);
  t.deepEqual(Object.keys(guards), ['sorted']);
  t.deepEqual(Object.keys(guardsFromSidecar(binary)), ['partitioned']);
});

test('under a host, a guard materializes as counted assertions', t => {
  const guards = guardsFromSidecar(family);
  const real = globalThis[KEY];
  const calls = [];
  globalThis[KEY] = {version: 1, report: a => calls.push(a)};
  try {
    guards.sorted([1, 2, 3], (a, b) => a < b, 0, 3);
    guards.sorted([3, 1, 2], (a, b) => a < b, 0, 3);
  } finally {
    globalThis[KEY] = real;
  }
  t.equal(calls.length, 2);
  t.ok(calls[0].ok);
  t.notOk(calls[1].ok);
  t.equal(calls[1].message, 'nano-binary-search pre:sorted violated');
});

test('without a host, always-guards defer to the absent behavior', t => {
  const guards = guardsFromSidecar(family, {always: true});
  const real = globalThis[KEY];
  delete globalThis[KEY];
  try {
    setAbsentBehavior(throwOnFail);
    guards.sorted([1, 2, 3], (a, b) => a < b, 0, 3);
    t.throws(() => guards.sorted([3, 1, 2], (a, b) => a < b, 0, 3), InvariantError);
    setAbsentBehavior(null);
    guards.sorted([3, 1, 2], (a, b) => a < b, 0, 3);
    t.pass('inert with no behavior set');
  } finally {
    setAbsentBehavior(null);
    globalThis[KEY] = real;
  }
});

// The §6.5 call-site story end-to-end: a consumer discharges the
// sorted-insert obligation with the sidecar's own guard.
test('a call site discharges a pattern obligation with a guard', t => {
  const guards = guardsFromSidecar(binary);
  const sortedInsert = (arr, value) => {
    const lessFn = x => x < value;
    guards.partitioned(arr, lessFn, 0, arr.length);
    const i = binarySearch(arr, lessFn);
    arr.splice(i, 0, value);
    return i;
  };
  const real = globalThis[KEY];
  const calls = [];
  globalThis[KEY] = {version: 1, report: a => calls.push(a)};
  try {
    const arr = [1, 3, 5];
    t.equal(sortedInsert(arr, 4), 2);
    t.deepEqual(arr, [1, 3, 4, 5]);
  } finally {
    globalThis[KEY] = real;
  }
  t.equal(calls.length, 1);
  t.ok(calls[0].ok);
});
