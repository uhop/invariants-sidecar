import type {Sidecar} from './parse.js';

export interface GuardOptions {
  /**
   * Compute and check every call, host or not — for callers that set a
   * production absent behavior (`setAbsentBehavior(throwOnFail)`). Default:
   * predicates run only when a tape-six host was present at load
   * (`hasHost`), honoring "assumed, never checked at runtime".
   */
  always?: boolean;
}

/**
 * One guard per check-bearing `pre:` claim, keyed by claim name. Each guard
 * takes the check's own parameters and routes through tape-six-invariant's
 * `check()` — a counted assertion under a test run, the configured absent
 * behavior otherwise. Subpath-only: importing this module requires
 * `tape-six-invariant`; the package core stays dependency-free.
 */
export function guardsFromSidecar(
  sidecar: Sidecar,
  opts?: GuardOptions
): Record<string, (...args: any[]) => void>;
