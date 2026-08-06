// @ts-self-types="./generate.d.ts"

import {complete} from './static-land.js';
import {lawsFor} from './laws.js';

// Arg kinds → arbitraries. Kleisli arbitraries (`kf`/`kg`) default to
// of-lifted plain functions — supply opts.arbK to also exercise values
// `of` cannot reach (a Nothing-returning Kleisli, an erroring Task).
const arbFor = (kind, T, opts) => {
  switch (kind) {
    case 'u':
    case 'v':
    case 'w':
      return opts.arb;
    case 'a':
      return opts.arbA;
    case 'f':
    case 'g':
      return opts.arbFn;
    case 'kf':
    case 'kg':
      return opts.arbK || opts.arbFn.map(f => x => T.of(f(x)));
  }
};

const eqOf = (T, opts) => opts.equals || ((x, y) => T.equals(x, y));

export const makeLawTests = (T, opts) => {
  const eq = eqOf(T, opts);
  return lawsFor(T, opts.typeclasses).map(law => ({
    name: law.name,
    arbs: law.args.map(kind => arbFor(kind, T, opts)),
    predicate: law.check(T, eq)
  }));
};

// The static-land consistency clause: a hand-provided derivable method must
// behave as its derivation. One test per obligation reported by complete().
export const makeConsistencyTests = (T, opts) => {
  const {module: completed, consistency} = complete(T);
  const eq = eqOf(completed, opts);
  return consistency.map(({method, needs, derivedFn}) => {
    if (method === 'map')
      return {
        name: `consistency: map ≡ derivation from {${needs.join(', ')}}`,
        arbs: [arbFor('f', completed, opts), arbFor('u', completed, opts)],
        predicate: (f, u) => eq(T.map(f, u), derivedFn(f, u))
      };
    return {
      name: `consistency: ${method} ≡ derivation from {${needs.join(', ')}}`,
      arbs: [opts.arbUF || opts.arbFn.map(f => completed.of(f)), arbFor('u', completed, opts)],
      predicate: (uf, ux) => eq(T[method](uf, ux), derivedFn(uf, ux))
    };
  });
};

export const runLaws = async (t, tests) => {
  for (const {name, arbs, predicate} of tests) await t.prop(arbs, predicate, name);
};
