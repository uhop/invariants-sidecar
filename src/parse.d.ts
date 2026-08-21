/** A parsed claim. `check` is inert source — compile it explicitly. */
export interface Claim {
  kind: 'pre' | 'post' | 'effects' | 'complexity' | 'pattern' | 'hazard' | 'law';
  name: string;
  prose: string;
  qualifiers?: string;
  check?: {lang: string; source: string};
  /** Pattern claims only. */
  trigger?: string;
  replacement?: {lang: string; source: string};
  justification?: string;
  obligation?: string;
}

export interface Sidecar {
  /** Raw frontmatter: every value is a string, exactly as written in the file. */
  frontmatter: Record<string, string>;
  /** Format version as a number — compare against `SIDECAR_VERSION`. */
  version: number;
  name: string;
  description: string;
  claims: Claim[];
  /** From a Laws section's `- implements:` line. */
  implements?: string[];
}

/** The format version this parser implements (moonshot §6.6). */
export const SIDECAR_VERSION: number;

/** Read the frontmatter block alone. Never throws; null when there is none. */
export function readFrontmatter(text: string): Record<string, string> | null;

/** Every reason a frontmatter block fails to identify a sidecar, or [] when it
 *  is one. Required: `sidecar` (integer version), `package`, `binds`. */
export function sidecarProblems(frontmatter: Record<string, string> | null): string[];

/** Whether this text is a sidecar at all. Never throws — the common case is a
 *  prose `INVARIANTS.md`, which a consumer should skip in silence. */
export function isSidecar(text: string): boolean;

/**
 * Parse a sidecar markdown artifact (moonshot §6.5 vocabulary, §6.6 format) to
 * inert data. Loud, located errors on malformed input — including frontmatter
 * that does not identify a sidecar; gate with `isSidecar` when the input may be
 * prose. Never evaluates check code.
 */
export function parseSidecar(text: string): Sidecar;
