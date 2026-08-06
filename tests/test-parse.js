import {readFileSync} from 'node:fs';
import test from 'tape-six';

import {parseSidecar} from '../src/parse.js';
import {compileChecks} from '../src/compile.js';

const text = readFileSync(new URL('./fixtures/binary-search-sidecar.md', import.meta.url), 'utf8');

test('the worked artifact parses: frontmatter, name, description', t => {
  const s = parseSidecar(text);
  t.equal(s.frontmatter.package, 'nano-binary-search');
  t.equal(s.frontmatter.binds, '^1.0.14');
  t.equal(
    s.frontmatter.export,
    'binarySearch(sortedArray, lessFn, l = 0, r = sortedArray.length): number'
  );
  t.equal(s.name, 'binarySearch');
  t.ok(s.description.startsWith('Finds the partition point'));
});

test('the worked artifact parses: every claim, by kind and name', t => {
  const s = parseSidecar(text);
  t.deepEqual(
    s.claims.map(c => c.kind + ':' + c.name),
    [
      'pre:partitioned',
      'pre:range',
      'post:result-range',
      'post:partition-point',
      'effects:pure',
      'complexity:log-calls',
      'pattern:sorted-insert',
      'pattern:membership',
      'hazard:inconsistent-order',
      'hazard:insertion-index-misread',
      'hazard:mutating-lessFn'
    ]
  );
  const partitioned = s.claims[0];
  t.equal(partitioned.qualifiers, 'assumed, never checked at runtime; O(n) to verify');
  t.ok(partitioned.check);
  t.equal(partitioned.check.lang, 'js');
  t.ok(partitioned.check.source.includes('seenFalse'));
  t.notOk(s.claims[1].check);
});

test('the worked artifact parses: pattern structure', t => {
  const s = parseSidecar(text);
  const insert = s.claims.find(c => c.name === 'sorted-insert');
  t.ok(insert.trigger.includes('push()'));
  t.ok(insert.replacement.source.includes('splice'));
  t.ok(insert.justification.includes('partition-point'));
  t.ok(insert.obligation.includes('sorted by the same ordering'));
  const membership = s.claims.find(c => c.name === 'membership');
  t.ok(membership.replacement.source.includes('!(value < arr[i])'));
});

test('checks compile without running', t => {
  const s = parseSidecar(text);
  const checks = compileChecks(s);
  t.deepEqual(Object.keys(checks), ['pre:partitioned', 'post:partition-point']);
  t.equal(typeof checks['pre:partitioned'], 'function');
  t.ok(checks['pre:partitioned']([1, 2, 3], x => x < 2, 0, 3));
  t.notOk(checks['pre:partitioned']([3, 1, 2], x => x < 2, 0, 3));
});

test('parse errors are loud and located', t => {
  t.throws(() => parseSidecar('no frontmatter'), /expected frontmatter/);
  t.throws(
    () => parseSidecar('---\npackage: x\n---\n# f\n\n## Preconditions\n\n- unnamed claim: text'),
    /backticked/
  );
  t.throws(
    () =>
      parseSidecar(
        '---\npackage: x\n---\n# f\n\n## Preconditions\n\n```js check pre:ghost\n() => true\n```'
      ),
    /unknown claim pre:ghost/
  );
  t.throws(() => parseSidecar('---\npackage: x\n---\n# f\n\n## Nonsense\n'), /unknown section/);
});
