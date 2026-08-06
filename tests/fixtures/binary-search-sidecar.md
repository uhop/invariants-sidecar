---
package: nano-binary-search
binds: ^1.0.14
export: 'binarySearch(sortedArray, lessFn, l = 0, r = sortedArray.length): number'
---

# binarySearch

Finds the partition point of `sortedArray` over `lessFn`: the smallest index in
`[l, r]` such that every earlier element satisfies `lessFn` and no element from
it on does. With `x => x < pivot` this is the lower bound; with
`x => x <= pivot` the upper bound (`std::partition_point` semantics).

## Preconditions

- `partitioned` (assumed, never checked at runtime; O(n) to verify): over
  `[l, r)`, `lessFn` values form `true* false*` - no `true` after a `false`.
  A sorted array queried with a consistent `<`-style predicate satisfies this.

  ```js check pre:partitioned
  (sortedArray, lessFn, l, r) => {
    let seenFalse = false;
    for (let i = l; i < r; ++i) {
      if (lessFn(sortedArray[i], i, sortedArray)) {
        if (seenFalse) return false;
      } else seenFalse = true;
    }
    return true;
  };
  ```

- `range`: `l` and `r` are integers with `0 <= l <= r <= sortedArray.length`.

## Postconditions

- `result-range`: `l <= result && result <= r`. Note `result` may equal
  `sortedArray.length`: it is an insertion index, not a found index.
- `partition-point`:

  ```js check post:partition-point
  (result, sortedArray, lessFn, l, r) => {
    for (let i = l; i < result; ++i) if (!lessFn(sortedArray[i], i, sortedArray)) return false;
    for (let i = result; i < r; ++i) if (lessFn(sortedArray[i], i, sortedArray)) return false;
    return true;
  };
  ```

## Effects

- `pure`: does not mutate `sortedArray`; calls nothing but `lessFn`;
  deterministic while `lessFn` is. Safe to reorder, cache, or drop when the
  result is unused.

## Complexity

- `log-calls`: at most `Math.ceil(Math.log2(r - l)) + 1` invocations of
  `lessFn`; O(1) space. Verify by counting calls with an instrumented `lessFn`
  over generated inputs.

## Patterns

### sorted-insert

- Trigger: maintaining order via `push()` + `sort()` per insertion, or a
  linear scan for the insertion index into a known-sorted array.
- Replacement:

  ```js
  const i = binarySearch(arr, x => x < value);
  arr.splice(i, 0, value);
  ```

- Justification: `partition-point` implies the splice preserves sortedness.
- Obligation at the call site: `arr` is sorted by the same ordering that
  `x => x < value` assumes (the `partitioned` precondition).

### membership

- Trigger: `indexOf()` / `findIndex()` / `includes()` on a known-sorted array.
- Replacement:

  ```js
  const i = binarySearch(arr, x => x < value);
  const found = i < arr.length && !(value < arr[i]);
  ```

- Justification: `result-range` + `partition-point`; equality is recovered as
  "neither less" under the same ordering.

## Hazards

- `inconsistent-order`: a `lessFn` inconsistent with the array's actual order
  violates `partitioned`; the function still returns an index, silently
  meaningless. No error is thrown.
- `insertion-index-misread`: using the result directly as the position of a
  found element without the `membership` equality check.
- `mutating-lessFn`: a `lessFn` that mutates the array mid-search voids all
  postconditions.
