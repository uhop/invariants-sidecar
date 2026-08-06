import type {StaticLandModule} from './static-land.js';

/** Value kinds a law quantifies over: `u`/`v`/`w` — module values, `a` — a
 *  plain value, `f`/`g` — plain unary functions, `kf`/`kg` — Kleisli
 *  functions (`a → T b`). */
export type ArgKind = 'u' | 'v' | 'w' | 'a' | 'f' | 'g' | 'kf' | 'kg';

export interface Law {
  typeclass: string;
  name: string;
  /** Module methods the law reads; the law applies only when all exist. */
  needs: string[];
  args: ArgKind[];
  check: (
    T: StaticLandModule,
    eq: (x: unknown, y: unknown) => boolean
  ) => (...values: any[]) => boolean;
}

/** Law records per the static-land spec: Setoid, Semigroup, Monoid, Functor,
 *  Applicative, Chain, Monad. */
export const LAWS: Law[];

/** Laws applicable to `T` (every needed method present), optionally filtered
 *  to the named typeclasses. */
export function lawsFor(T: StaticLandModule, typeclasses?: string[]): Law[];
