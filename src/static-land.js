// @ts-self-types="./static-land.d.ts"

// Derivations per the static-land spec: each row derives a method from a
// minimal base. `derive` closes over the *completed* module so chained
// derivations (ap from chain+map where map itself was derived) resolve.
export const DERIVATIONS = [
  {method: 'map', needs: ['bimap'], derive: T => (f, u) => T.bimap(x => x, f, u)},
  {method: 'map', needs: ['promap'], derive: T => (f, u) => T.promap(x => x, f, u)},
  {method: 'map', needs: ['ap', 'of'], derive: T => (f, u) => T.ap(T.of(f), u)},
  {method: 'map', needs: ['chain', 'of'], derive: T => (f, u) => T.chain(x => T.of(f(x)), u)},
  {method: 'ap', needs: ['chain', 'map'], derive: T => (uf, ux) => T.chain(f => T.map(f, ux), uf)}
];

const applicable = (T, row) => row.needs.every(m => typeof T[m] === 'function');

// Fixpoint completion: derive every missing derivable method; report
// provenance for derived methods and — per the static-land consistency
// clause — an obligation for every hand-provided method that is also
// derivable (the hand version must behave as the derivation).
export const complete = module => {
  const T = {...module};
  const derived = {};
  const consistency = [];
  for (let changed = true; changed;) {
    changed = false;
    for (const row of DERIVATIONS) {
      if (typeof T[row.method] === 'function' || !applicable(T, row)) continue;
      T[row.method] = row.derive(T);
      derived[row.method] = row.needs;
      changed = true;
    }
  }
  for (const row of DERIVATIONS) {
    if (!(row.method in derived) && typeof module[row.method] === 'function' && applicable(T, row))
      consistency.push({method: row.method, needs: row.needs, derivedFn: row.derive(T)});
  }
  return {module: T, derived, consistency};
};
