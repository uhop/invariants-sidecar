// @ts-self-types="./parse.d.ts"

// Sidecar sections → claim kinds (moonshot §6.5 worked-artifact format).
const SECTIONS = {
  Preconditions: 'pre',
  Postconditions: 'post',
  Effects: 'effects',
  Complexity: 'complexity',
  Patterns: 'pattern',
  Hazards: 'hazard',
  Laws: 'law'
};

// greedy qualifier + `):`-anchored close so nested parens (`O(n)`) survive
const CLAIM_RE = /^- `([^`]+)`(?:\s*\((.+)\))?:\s*(.*)$/;
const IMPLEMENTS_RE = /^- implements:\s*(.+)$/;
const FENCE_RE = /^(\s*)```(.*)$/;
const PATTERN_FIELDS = [
  ['trigger', /^- Trigger:\s*(.*)$/],
  ['replacement', /^- Replacement:\s*(.*)$/],
  ['justification', /^- Justification:\s*(.*)$/],
  ['obligation', /^- Obligation[^:]*:\s*(.*)$/]
];

const fail = (message, line) => {
  throw new Error(`sidecar parse: ${message} (line ${line + 1})`);
};

export const parseSidecar = text => {
  const lines = text.split('\n');
  let i = 0;

  const frontmatter = {};
  if (lines[0] !== '---') fail('expected frontmatter opening ---', 0);
  for (i = 1; i < lines.length && lines[i] !== '---'; ++i) {
    const m = /^(\w+):\s*(.*)$/.exec(lines[i]);
    if (!m) fail(`bad frontmatter line: ${lines[i]}`, i);
    frontmatter[m[1]] = m[2].replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
  }
  if (i === lines.length) fail('unterminated frontmatter', 0);
  ++i;

  const sidecar = {frontmatter, name: '', description: '', claims: []};
  const byKey = new Map();
  let kind = null;
  let current = null;
  let pattern = null;
  let patternField = '';
  const descriptionLines = [];

  const addClaim = claim => {
    sidecar.claims.push(claim);
    const key = claim.kind + ':' + claim.name;
    if (byKey.has(key)) fail(`duplicate claim ${key}`, i);
    byKey.set(key, claim);
    return claim;
  };

  for (; i < lines.length; ++i) {
    const line = lines[i];

    const fence = FENCE_RE.exec(line);
    if (fence) {
      const indent = fence[1].length;
      const info = fence[2].trim();
      const body = [];
      const opened = i;
      for (++i; i < lines.length; ++i) {
        const close = FENCE_RE.exec(lines[i]);
        if (close && close[2].trim() === '') break;
        body.push(lines[i].slice(indent));
      }
      if (i === lines.length) fail('unterminated code fence', opened);
      const source = body.join('\n');
      const checkMatch = /^(\S+)\s+check\s+(\w+):(\S+)$/.exec(info);
      if (checkMatch) {
        const [, lang, checkKind, checkName] = checkMatch;
        const claim = byKey.get(checkKind + ':' + checkName);
        if (!claim) fail(`check block for unknown claim ${checkKind}:${checkName}`, opened);
        claim.check = {lang, source};
      } else if (pattern && patternField === 'replacement') {
        pattern.replacement = {lang: info || 'js', source};
      }
      continue;
    }

    const h2 = /^## (.+)$/.exec(line);
    if (h2) {
      kind = SECTIONS[h2[1]];
      if (kind === undefined) fail(`unknown section: ${h2[1]}`, i);
      current = null;
      pattern = null;
      patternField = '';
      continue;
    }
    const h1 = /^# (.+)$/.exec(line);
    if (h1) {
      sidecar.name = h1[1];
      continue;
    }

    if (kind === 'pattern') {
      const h3 = /^### (.+)$/.exec(line);
      if (h3) {
        pattern = addClaim({kind: 'pattern', name: h3[1], prose: ''});
        patternField = '';
        continue;
      }
      if (pattern) {
        let matched = false;
        for (const [field, re] of PATTERN_FIELDS) {
          const m = re.exec(line);
          if (m) {
            patternField = field;
            if (field !== 'replacement') pattern[field] = m[1];
            matched = true;
            break;
          }
        }
        if (matched) continue;
        if (/^\s+\S/.test(line) && patternField && patternField !== 'replacement')
          pattern[patternField] += ' ' + line.trim();
      }
      continue;
    }

    if (kind) {
      const impl = kind === 'law' && IMPLEMENTS_RE.exec(line);
      if (impl) {
        sidecar.implements = impl[1]
          .split(',')
          .map(s => s.trim().replace(/^`(.*)`$/, '$1'))
          .filter(Boolean);
        current = null;
        continue;
      }
      const claim = CLAIM_RE.exec(line);
      if (claim) {
        current = addClaim({kind, name: claim[1], prose: claim[3]});
        if (claim[2]) current.qualifiers = claim[2];
        continue;
      }
      if (current && /^\s+\S/.test(line)) {
        current.prose += ' ' + line.trim();
        continue;
      }
      if (line.trim() === '') continue;
      if (/^- /.test(line)) fail(`claim name must be backticked: ${line.trim()}`, i);
      continue;
    }

    if (!kind && sidecar.name) descriptionLines.push(line);
  }

  sidecar.description = descriptionLines.join('\n').trim();
  return sidecar;
};
