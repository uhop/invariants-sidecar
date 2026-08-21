import type {Sidecar} from './parse.js';

/** An extracted axiom template: placeholder atoms + §3 formulas, with
 *  sidecar provenance. */
export interface AxiomTemplate {
  claim: string;
  name: string;
  source: string;
  atoms: Record<string, string>;
  formulas: unknown[];
}

export interface DeclareTemplate {
  claim: string;
  source: string;
  exports: Record<string, string[]>;
}

export interface OracleInputs {
  axioms: AxiomTemplate[];
  declares: DeclareTemplate[];
  /** Set when the sidecar lacks `verified: ci`: nothing was extracted, because
   *  an unverified sidecar is a proposal rather than provenance. */
  unverified?: boolean;
}

/** Extract `law:` axiom blocks and `effects:` flags blocks as oracle wire
 *  shapes. Depends on nothing — apodictum included. Yields nothing unless the
 *  sidecar carries `verified: ci`; `allowUnverified` reads it as a proposal. */
export function oracleInputsFromSidecar(
  sidecar: Sidecar,
  opts?: {allowUnverified?: boolean}
): OracleInputs;

/** Rename placeholder atoms to the consumer's query atom names; throws on
 *  an unbound placeholder. Returns apodictum assume-entry objects
 *  (`{formula, name, source}`) whose provenance lands in the law trail. */
export function instantiateAxioms(
  axioms: AxiomTemplate[],
  binding: Record<string, string>
): {formula: unknown; name: string; source: string}[];

/** Build an apodictum `declare` object: each query symbol gets the flags the
 *  sidecar claims for the export it abstracts. */
export function declareFromSidecar(
  declares: DeclareTemplate[],
  symbolExports: Record<string, string>
): Record<string, string[]>;
