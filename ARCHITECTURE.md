# Architecture — invariants-sidecar

Library-declared invariants as verified data. Two halves share one pipeline:
a static-land core (dictionary completer + law/consistency property-test
generator) and a sidecar-artifact toolchain (parser, check compiler, guard
builder, oracle bridge) with three independent consumers of the same parsed
artifact. No build step, no runtime dependencies.

## Layout

```
index.js             # re-exports the public surface (all named exports)
index.d.ts           # re-exports types; .d.ts sidecars are the sole source of types + docs
src/
├── static-land.js   # DERIVATIONS lattice, complete() — derive to fixpoint + consistency obligations
├── laws.js          # LAWS records (Setoid…Monad), lawsFor() applicability filter
├── generate.js      # makeLawTests / makeConsistencyTests / runLaws — LawTest[] for t.prop
├── parse.js         # parseSidecar — moonshot §6.5 markdown → inert data, never evaluates
├── compile.js       # compileCheck / compileChecks — the explicit trust step; lawTestsFromSidecar
├── guards.js        # guardsFromSidecar — pre: claims as tape-six-invariant call-site guards (subpath-only)
└── oracle.js        # oracleInputsFromSidecar / instantiateAxioms / declareFromSidecar — apodictum wire shapes
sidecars/            # real artifacts (nano-binary-search family) — data, not shipped code
tests/               # tape-six suite; fixtures hold worked sidecar artifacts
```

## Data flow

```
sidecar markdown (moonshot §6.5)
  │  parseSidecar — loud, located errors; checks stay inert source
  ▼
Sidecar {frontmatter, name, description, claims[], implements?}
  ├─ compileChecks       — explicit trust step: compiles, still doesn't invoke
  │    └─ checks['kind:name'] used inside t.prop properties
  │    └─ lawTestsFromSidecar(sidecar, module, opts)
  │         └─ complete(module) + implements: → law + consistency LawTest[]
  ├─ guardsFromSidecar   — pre: claims → runtime guards (tape-six-invariant)
  └─ oracleInputsFromSidecar — law: axiom blocks + effects: flags blocks
       └─ instantiateAxioms / declareFromSidecar → apodictum query inputs
```

The static-land half stands alone: `complete()` derives every missing
derivable method to fixpoint from the `DERIVATIONS` lattice (never
overwriting a provided method) and reports provenance plus the consistency
obligations of hand-provided derivable methods; `makeLawTests` /
`makeConsistencyTests` turn applicable `LAWS` into `LawTest[]`; `runLaws`
drives them through tape-six-fast-check's `t.prop`.

## Key decisions

- **Parse is inert; compile is the explicit trust step.** GHC `{-# RULES #-}`
  is the prior art and the cautionary tale — libraries can ship claims, but
  trusting them unchecked is the failure mode. `parseSidecar` never
  evaluates; `compileCheck` compiles without invoking; every claim is meant
  to be _verified_ by the consumer's own CI, never trusted.
- **Zero runtime dependencies, integration by shape.** fast-check arbitraries
  are structural (`ArbitraryLike` — anything with `map`); tape-six-invariant
  is reached only through the `guards.js` subpath (importing it is the
  opt-in); the oracle is _not_ a dependency — `oracle.js` emits plain wire
  shapes, and only the integration test loads `apodictum` dynamically
  (installed package first, fleet sibling second, clean skip otherwise).
- **Consistency tests exercise every applicable derivation path.** A
  derivation routing through the corrupted method agrees with it by
  construction — refutation power lives in the paths from the untainted
  base, which is why each hand-provided method is checked against _all_ of
  its derivations, not one.
- **`of`-lifting is the default, not the ceiling.** Kleisli (`arbK`) and
  lifted-function (`arbUF`) arbitraries default to `of`-lifted `arbFn`,
  which cannot reach values like a `Nothing`-shaped `T<fn>` — suppliable
  precisely because the default is documented as incomplete.
- **Guards honor "assumed, never checked at runtime" by default.** Predicates
  run only when a tape-six host was present at load (`hasHost`);
  `{always: true}` opts into paying for checks in production, paired with
  `setAbsentBehavior(throwOnFail)`.
- **The oracle bridge carries provenance and demands totality.** Instantiated
  axioms keep `name`/`source`, so any rewrite they license lands in the law
  trail; the oracle refuses a law-licensed rewrite until the sidecar also
  vouches `total` for the erased read — the licensing discipline reaches
  across the bridge (measured in the tests).
