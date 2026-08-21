// @ts-self-types="./resolve.d.ts"

import {parseSidecar, readFrontmatter, sidecarProblems} from './parse.js';

// Sidecar discovery (moonshot §6.6). Takes a reader over one package directory
// rather than importing node:fs, so this module stays as runtime-agnostic as
// the rest of src/ — the caller supplies the three lines that touch a disk.

const parts = version => {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(version ?? '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

const gte = (a, b) => {
  for (let i = 0; i < 3; ++i) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
};

// Enough semver for the range forms `binds` actually uses. Anything else
// returns null — unknown, not false: guessing at a range this module does not
// implement would silently downgrade a live sidecar to stale.
export const satisfies = (version, range) => {
  const v = parts(version);
  const raw = String(range ?? '').trim();
  if (!v || !raw) return null;
  if (raw === '*' || raw === 'x') return true;
  const m = /^([\^~]?)(\d+)\.(\d+)\.(\d+)$/.exec(raw);
  if (!m) return null;
  const base = [Number(m[2]), Number(m[3]), Number(m[4])];
  if (!m[1]) return v[0] === base[0] && v[1] === base[1] && v[2] === base[2];
  if (!gte(v, base)) return false;
  if (m[1] === '~') return v[0] === base[0] && v[1] === base[1];
  // ^ pins the leftmost non-zero: ^0.2.3 allows 0.2.x, ^0.0.3 only 0.0.3
  if (base[0] !== 0) return v[0] === base[0];
  if (base[1] !== 0) return v[0] === 0 && v[1] === base[1];
  return v[0] === 0 && v[1] === 0 && v[2] === base[2];
};

// Resolves an installed package's sidecar from a reader over its directory:
// `read(relativePath)` returns the file's text, or null / throws when absent.
// Order per §6.6 — the manifest's `invariants` key first (declarative: the
// author states the file is a sidecar), then a root INVARIANTS.md (provisional
// until the frontmatter validates). Returns null when the package has none,
// and `{path, skipped}` when a candidate existed and was refused, so a
// consumer can tell "no sidecar" from "a sidecar it declined to trust".
export const resolveSidecar = read => {
  const readOr = path => {
    try {
      return read(path) ?? null;
    } catch {
      return null;
    }
  };

  const manifest = readOr('package.json');
  if (!manifest) return null;
  let pkg;
  try {
    pkg = JSON.parse(manifest);
  } catch {
    return null;
  }

  const declared = typeof pkg.invariants === 'string' ? pkg.invariants : null;
  const path = (declared ?? 'INVARIANTS.md').replace(/^\.\//, '');
  const text = readOr(path);
  if (!text) return declared ? {path, skipped: 'declared `invariants` file is missing'} : null;

  const frontmatter = readFrontmatter(text);
  const problems = sidecarProblems(frontmatter);
  if (problems.length) return {path, skipped: problems.join('; ')};
  if (pkg.name && frontmatter.package !== pkg.name)
    return {
      path,
      skipped: `\`package\` is \`${frontmatter.package}\`, not \`${pkg.name}\` — a vendored copy`
    };

  return {
    path,
    via: declared ? 'manifest' : 'filename',
    sidecar: parseSidecar(text),
    version: pkg.version ?? null,
    binds: frontmatter.binds,
    // null = binds uses a range form satisfies() does not implement
    stale: pkg.version ? satisfies(pkg.version, frontmatter.binds) === false : null,
    verified: frontmatter.verified === 'ci'
  };
};
