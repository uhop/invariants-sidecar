// @ts-self-types="./compile.d.ts"

import {complete} from './static-land.js';
import {makeLawTests, makeConsistencyTests} from './generate.js';

// Compilation is the explicit trust step the parser refuses to take: the
// artifact stays inert data until a consumer compiles it. `new Function`
// compiles the expression without invoking it — nothing runs until the
// returned check is called by a test the author reviews.
export const compileCheck = check => {
  if (check.lang !== 'js') throw new Error(`cannot compile a ${check.lang} check`);
  const source = check.source.trim().replace(/;$/, '');
  const fn = new Function(`'use strict'; return (${source});`)();
  if (typeof fn !== 'function') throw new Error('a check must be a single function expression');
  return fn;
};

export const compileChecks = sidecar => {
  const out = {};
  for (const claim of sidecar.claims) {
    if (!claim.check) continue;
    out[claim.kind + ':' + claim.name] = compileCheck(claim.check);
  }
  return out;
};

// The static-land bridge: a sidecar's `implements:` declaration selects the
// law sets; custom `law:` claims with check blocks ride along as extra
// properties (their check is the predicate, quantified over `u`/`v`/`w`).
export const lawTestsFromSidecar = (sidecar, module, opts) => {
  const {module: completed} = complete(module);
  const tests = sidecar.implements
    ? makeLawTests(completed, {...opts, typeclasses: sidecar.implements})
    : [];
  const consistency = makeConsistencyTests(module, opts);
  const custom = sidecar.claims
    .filter(claim => claim.kind === 'law' && claim.check)
    .map(claim => {
      const predicate = compileCheck(claim.check);
      return {
        name: `law: ${claim.name}`,
        arbs: Array.from({length: predicate.length > 1 ? predicate.length - 1 : 1}, () => opts.arb),
        predicate: (...values) => predicate(completed, ...values)
      };
    });
  return [...tests, ...consistency, ...custom];
};
