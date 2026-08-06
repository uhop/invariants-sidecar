---
package: maybe-fixture
binds: ^0.0.1
export: 'Maybe: static-land module'
---

# Maybe

An option type over integers; the minimal Monad base plus equals, with map
provided by hand.

## Laws

- implements: `Setoid`, `Functor`, `Applicative`, `Chain`, `Monad`

- `nothing-absorbs-chain`: chaining anything through Nothing stays Nothing.

  ```js check law:nothing-absorbs-chain
  (T, u) =>
    T.equals(
      T.chain(x => u, T.nothing),
      T.nothing
    );
  ```

## Hazards

- `sentinel-identity`: Nothing is a shared sentinel; a structurally equal
  object is not Nothing.
