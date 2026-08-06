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
  frontmatter: Record<string, string>;
  name: string;
  description: string;
  claims: Claim[];
  /** From a Laws section's `- implements:` line. */
  implements?: string[];
}

/**
 * Parse a sidecar markdown artifact (moonshot §6.5 format) to inert data.
 * Loud, located errors on malformed input; never evaluates check code.
 */
export function parseSidecar(text: string): Sidecar;
