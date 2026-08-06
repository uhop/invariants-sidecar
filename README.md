# invariants-sidecar

Library-declared invariants as **verified data**, not prose. This package is
the experiment's static-land core: a **dictionary completer** (derive `map`,
`ap`, … from a minimal base per the
[static-land](https://github.com/fantasyland/static-land) derivation lattice)
and a **law/consistency property-test generator** targeting
[tape-six-fast-check](https://github.com/uhop/tape-six-fast-check)'s
`t.prop()`.

The design lineage: GHC `{-# RULES #-}` proved libraries can ship rewrite
rules — and that trusting them unchecked is the failure mode. Here every
claim compiles to a property test the author runs in CI: **claims are
verified, never trusted.** The wider sidecar vocabulary (`pre:`, `post:`,
`effects:`, `complexity:`, `pattern:`, `hazard:`) is specified in apodict's
`dev-docs/moonshot-transformation-assistant.md` §6; this package builds the
`law:`/`derivation:` slice first because both halves have ecosystem prior
art and one fixture exercises the whole pipeline.

Status: **experiment** (unpublished).

## Install

```bash
npm install --save-dev invariants-sidecar tape-six tape-six-fast-check fast-check
```

## Usage

```js
import test from 'tape-six';
import fc from 'fast-check';
import 'tape-six-fast-check';
import {complete, makeLawTests, makeConsistencyTests, runLaws} from 'invariants-sidecar';

// a static-land module: minimal Monad base + equals, map by hand
const Maybe = {of, chain, map, equals};

const {module: M, derived, consistency} = complete(Maybe);
// M.ap derived from {chain, map}; consistency lists map's obligations

const opts = {
  arb: fc.oneof(fc.constant(NOTHING), fc.integer().map(Maybe.of)),
  arbA: fc.integer(),
  arbFn: fc.func(fc.integer())
};

test('Maybe laws', async t => {
  await runLaws(t, makeLawTests(M, opts));
  await runLaws(t, makeConsistencyTests(Maybe, opts));
});
```

Law sets: Setoid, Semigroup, Monoid, Functor, Applicative, Chain, Monad.
The consistency tests implement static-land's consistency clause — a
hand-provided derivable method must agree with **every** applicable
derivation; paths that avoid a corrupted method are what refute it.

Caveat: lifted values default to `of`-lifting, which cannot reach values
like a `Nothing`-shaped `T<fn>`; supply `arbK`/`arbUF` to cover them.

## The sidecar format

`parseSidecar(text)` reads the moonshot §6.5 artifact format — frontmatter
(`package`/`binds`/`export`), claim sections (Preconditions,
Postconditions, Effects, Complexity, Patterns, Hazards, Laws) with
backtick-named list items, and ` ```js check kind:name ` fenced blocks
binding executable checks to claims by name — into **inert data**: the
parser never evaluates anything. `compileChecks(sidecar)` is the explicit
trust step (compiles, still doesn't invoke); `lawTestsFromSidecar` bridges
a Laws section (`- implements:` + custom `law:` checks) to the static-land
law suite.

```js
import {parseSidecar, compileChecks} from 'invariants-sidecar';

const sidecar = parseSidecar(readFileSync('binary-search.sidecar.md', 'utf8'));
const checks = compileChecks(sidecar);

test('sidecar claims hold', async t => {
  await t.prop([arbCase], ({sorted, lessFn}) => {
    if (!checks['pre:partitioned'](sorted, lessFn, 0, sorted.length)) return false;
    const i = binarySearch(sorted, lessFn);
    return checks['post:partition-point'](i, sorted, lessFn, 0, sorted.length);
  });
});
```

The test suite runs the design doc's worked artifact verbatim against the
real published `nano-binary-search` — pre → post, the complexity bound via
an instrumented comparator, and a deterministic hazard witness.

## Call-site guards (`pre:` claims at runtime)

`invariants-sidecar/guards.js` turns check-bearing `pre:` claims into
[tape-six-invariant](https://github.com/uhop/tape-six-invariant) guards — a
counted assertion when a tape-six run exercises the call site, the
configured absent behavior otherwise. Subpath-only: importing it requires
`tape-six-invariant`; the package core stays dependency-free.

```js
import {guardsFromSidecar} from 'invariants-sidecar/guards.js';

const guards = guardsFromSidecar(sidecar); // {partitioned: (args…) => void}

const sortedInsert = (arr, value) => {
  const lessFn = x => x < value;
  guards.partitioned(arr, lessFn, 0, arr.length); // the pattern's obligation, discharged
  const i = binarySearch(arr, lessFn);
  arr.splice(i, 0, value);
  return i;
};
```

By default a guard honors "assumed, never checked at runtime": the predicate
runs only when a tape-six host was present at load (`hasHost`). Pass
`{always: true}` to pay for it in production too — pair with
`setAbsentBehavior(throwOnFail)`.

## The oracle bridge (`law:`/`effects:` claims as rewrite licenses)

`src/oracle.js` is the third consumer: blessed claims become
[apodict](../apodict) oracle inputs. A `law:` claim may carry a
` ```json axiom ` block (placeholder atoms + §3 formulas);
`oracleInputsFromSidecar` extracts them and `instantiateAxioms` renames
placeholders to the consumer's query atoms, yielding assume-ready entries
whose `name`/`source` flow into the law trail of any rewrite the axiom
licenses. An `effects:` claim may carry a ` ```json flags ` block
(per-export `pure`/`total`); `declareFromSidecar` maps query symbols to
those flags. The bridge emits wire shapes only — it depends on nothing.

Measured behaviors worth knowing (both in the tests): the oracle **refuses**
a law-licensed rewrite until the sidecar also vouches totality — erasing a
read of an atom that might throw demands `total`, so the licensing
discipline reaches across the bridge; and definitional equations lift into
an equal-cost substitution plateau (~5k nodes for a two-atom conjunction,
38–96 s) that best-first must drain before the repeat-penalized collapse —
the full collapse was demonstrated once and recorded rather than
suite-pinned.

## Release notes

- 0.0.1 — the static-land core (derivation-lattice completer,
  law/consistency test generator), the sidecar parser/compiler with the
  worked binary-search artifact verified end-to-end against the real
  library, a drafted family sidecar for the ten sibling exports (all claims
  surviving refutation), and call-site guards wiring `pre:` claims through
  tape-six-invariant.
