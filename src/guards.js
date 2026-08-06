// @ts-self-types="./guards.d.ts"

import {check, hasHost} from 'tape-six-invariant';

import {compileCheck} from './compile.js';

// The runtime vehicle for pre: claims (moonshot §6.5): a call site discharges
// a pattern's obligation by invoking the claim's guard — a counted tape-six
// assertion under a test run, the configured absent behavior otherwise.
// Deliberately a subpath-only module: importing it requires tape-six-invariant
// (a peer concern), while the package core stays dependency-free.
export const guardsFromSidecar = (sidecar, opts = {}) => {
  const pkg = sidecar.frontmatter.package || sidecar.name;
  const guards = {};
  for (const claim of sidecar.claims) {
    if (claim.kind !== 'pre' || !claim.check) continue;
    const predicate = compileCheck(claim.check);
    const message = `${pkg} pre:${claim.name} violated`;
    // default: honor "assumed, never checked at runtime" — the predicate is
    // computed only when a tape-six host was present at load (hasHost is the
    // documented gate for expensive pre-check work); opts.always opts a
    // caller with a production absent-behavior into paying for it
    guards[claim.name] = opts.always
      ? (...args) => check(predicate(...args), message)
      : (...args) => {
          if (hasHost) check(predicate(...args), message);
        };
  }
  return guards;
};
