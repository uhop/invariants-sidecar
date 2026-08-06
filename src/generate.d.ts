import type {StaticLandModule} from './static-land.js';

/** A fast-check arbitrary (structurally: anything with `map`). The package
 *  does not depend on fast-check — arbitraries pass through to `t.prop`. */
export interface ArbitraryLike {
  map(f: (value: any) => any): ArbitraryLike;
}

export interface GenerateOptions {
  /** Arbitrary of module values (`u`/`v`/`w`). */
  arb: ArbitraryLike;
  /** Arbitrary of plain values (`a`). */
  arbA: ArbitraryLike;
  /** Arbitrary of plain unary functions (`f`/`g`). */
  arbFn: ArbitraryLike;
  /** Arbitrary of Kleisli functions (`kf`/`kg`). Defaults to of-lifted
   *  `arbFn` — supply one to also exercise values `of` cannot reach. */
  arbK?: ArbitraryLike;
  /** Arbitrary of lifted functions (`T` of `a → b`) for ap-consistency;
   *  defaults to of-lifted `arbFn`. */
  arbUF?: ArbitraryLike;
  /** Equivalence used to compare law sides; defaults to `T.equals`. */
  equals?: (x: unknown, y: unknown) => boolean;
  /** Restrict generated law tests to these typeclasses. */
  typeclasses?: string[];
}

export interface LawTest {
  name: string;
  arbs: ArbitraryLike[];
  predicate: (...values: any[]) => boolean;
}

/** Property tests for every law applicable to `T`. */
export function makeLawTests(T: StaticLandModule, opts: GenerateOptions): LawTest[];

/** Property tests for the static-land consistency clause: each hand-provided
 *  derivable method vs each of its applicable derivations. A derivation path
 *  routing through the corrupted method agrees with it by construction —
 *  refutation power lives in the paths from the untainted base, which is why
 *  every applicable path is tested. */
export function makeConsistencyTests(T: StaticLandModule, opts: GenerateOptions): LawTest[];

/** Run law tests through tape-six-fast-check's `t.prop` (import it first). */
export function runLaws(t: {prop: Function}, tests: LawTest[]): Promise<void>;
