import type {Sidecar} from './parse.js';

/** A candidate the resolver refused, with the reason it was refused. */
export interface SkippedSidecar {
  path: string;
  skipped: string;
}

export interface ResolvedSidecar {
  path: string;
  /** Which discovery path found it (moonshot §6.6). */
  via: 'manifest' | 'filename';
  sidecar: Sidecar;
  /** The installed package's version, when its manifest names one. */
  version: string | null;
  binds: string;
  /** true when `binds` excludes the installed version; null when the range
   *  form is not one `satisfies` implements, or the version is unknown. */
  stale: boolean | null;
  /** `verified: ci` — the only value that clears the ingestion boundary. */
  verified: boolean;
}

/** Whether a version satisfies a `binds` range. Handles exact, `^`, `~` and
 *  `*`; returns null for any other form rather than guessing. */
export function satisfies(version: string, range: string): boolean | null;

/**
 * Resolve an installed package's sidecar from a reader over its directory:
 * the manifest's `invariants` key first, then a root `INVARIANTS.md`.
 * `read(relativePath)` returns the text, or null / throws when absent — this
 * module imports no node builtins, so the caller owns the filesystem.
 * null when the package has no sidecar at all.
 */
export function resolveSidecar(
  read: (path: string) => string | null | undefined
): ResolvedSidecar | SkippedSidecar | null;
