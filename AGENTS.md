# AGENTS.md

Experiment: the invariants-sidecar static-land core. Design doc:
apodict's `dev-docs/moonshot-transformation-assistant.md` §6/§6.5; queue:
the vault's `projects/apodict/queue.md` invariants-sidecar item.

## Commands

- `npm test` — tape-six suite (`tape6 --flags FO`).
- `npm run lint` / `npm run lint:fix` — prettier.

## Code style

- ES modules, `.js` + hand-written `.d.ts` sidecars
  (`// @ts-self-types` directive); no build step; no runtime dependencies.
- No comments that narrate _what_ the code does — comments are short
  _why_-markers only (a non-trivial decision or constraint, an algorithm
  reference, or requested JSDoc).
- Claims are verified, never trusted: every derivation/law addition needs a
  positive fixture and a refutation fixture in the tests.
