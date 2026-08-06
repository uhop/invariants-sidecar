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

## Release notes

- 0.0.1 — the static-land core: derivation-lattice completer,
  law/consistency test generator, Maybe fixture end-to-end.
