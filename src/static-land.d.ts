/** A static-land module: static functions keyed by method name. */
export type StaticLandModule = Record<string, (...args: any[]) => any>;

/** One derivation row: how to build `method` from the `needs` methods. */
export interface Derivation {
  method: string;
  needs: string[];
  derive: (T: StaticLandModule) => (...args: any[]) => any;
}

/** A consistency obligation: a hand-provided derivable method owes agreement
 *  with this derivation (the static-land consistency clause). */
export interface ConsistencyObligation {
  method: string;
  needs: string[];
  derivedFn: (...args: any[]) => any;
}

export interface Completion {
  /** The input module plus every derivable method, to fixpoint. */
  module: StaticLandModule;
  /** Provenance: derived method → the base methods it came from. */
  derived: Record<string, string[]>;
  /** One obligation per hand-provided method per applicable derivation. */
  consistency: ConsistencyObligation[];
}

/** The derivation lattice per the static-land spec. */
export const DERIVATIONS: Derivation[];

/**
 * Derive every missing derivable method (to fixpoint), report provenance,
 * and list the consistency obligations for hand-provided derivable methods.
 * Never overwrites a provided method.
 */
export function complete(module: StaticLandModule): Completion;
