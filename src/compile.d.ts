import type {Sidecar, Claim} from './parse.js';
import type {StaticLandModule} from './static-land.js';
import type {GenerateOptions, LawTest} from './generate.js';

/**
 * Compile one check to a callable — the explicit trust step the parser
 * refuses to take. Compilation does not invoke the function.
 */
export function compileCheck(check: NonNullable<Claim['check']>): (...args: any[]) => any;

/** Compile every check-bearing claim; keys are `kind:name`. */
export function compileChecks(sidecar: Sidecar): Record<string, (...args: any[]) => any>;

/**
 * The static-land bridge: `implements:` selects law sets, consistency
 * obligations ride along, and custom `law:` checks become extra properties
 * (called as `predicate(completedModule, ...values)`).
 */
export function lawTestsFromSidecar(
  sidecar: Sidecar,
  module: StaticLandModule,
  opts: GenerateOptions
): LawTest[];
