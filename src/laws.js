// @ts-self-types="./laws.d.ts"

// Law records per the static-land spec. `args` name the value kinds the
// property quantifies over: 'u'/'v'/'w' — T values, 'a' — a plain value,
// 'f'/'g' — plain unary functions. Lifted functions are built with `of`,
// which every law set that needs them has by definition.
export const LAWS = [
  {
    typeclass: 'Setoid',
    name: 'Setoid: reflexivity',
    needs: ['equals'],
    args: ['u'],
    check: T => u => T.equals(u, u)
  },
  {
    typeclass: 'Setoid',
    name: 'Setoid: symmetry',
    needs: ['equals'],
    args: ['u', 'v'],
    check: T => (u, v) => T.equals(u, v) === T.equals(v, u)
  },
  {
    typeclass: 'Setoid',
    name: 'Setoid: transitivity',
    needs: ['equals'],
    args: ['u', 'v', 'w'],
    check: T => (u, v, w) => !(T.equals(u, v) && T.equals(v, w)) || T.equals(u, w)
  },
  {
    typeclass: 'Semigroup',
    name: 'Semigroup: associativity',
    needs: ['concat'],
    args: ['u', 'v', 'w'],
    check: (T, eq) => (u, v, w) => eq(T.concat(T.concat(u, v), w), T.concat(u, T.concat(v, w)))
  },
  {
    typeclass: 'Monoid',
    name: 'Monoid: right identity',
    needs: ['concat', 'empty'],
    args: ['u'],
    check: (T, eq) => u => eq(T.concat(u, T.empty()), u)
  },
  {
    typeclass: 'Monoid',
    name: 'Monoid: left identity',
    needs: ['concat', 'empty'],
    args: ['u'],
    check: (T, eq) => u => eq(T.concat(T.empty(), u), u)
  },
  {
    typeclass: 'Functor',
    name: 'Functor: identity',
    needs: ['map'],
    args: ['u'],
    check: (T, eq) => u =>
      eq(
        T.map(x => x, u),
        u
      )
  },
  {
    typeclass: 'Functor',
    name: 'Functor: composition',
    needs: ['map'],
    args: ['u', 'f', 'g'],
    check: (T, eq) => (u, f, g) =>
      eq(
        T.map(x => f(g(x)), u),
        T.map(f, T.map(g, u))
      )
  },
  {
    typeclass: 'Applicative',
    name: 'Applicative: identity',
    needs: ['ap', 'of'],
    args: ['u'],
    check: (T, eq) => u =>
      eq(
        T.ap(
          T.of(x => x),
          u
        ),
        u
      )
  },
  {
    typeclass: 'Applicative',
    name: 'Applicative: homomorphism',
    needs: ['ap', 'of'],
    args: ['a', 'f'],
    check: (T, eq) => (a, f) => eq(T.ap(T.of(f), T.of(a)), T.of(f(a)))
  },
  {
    typeclass: 'Applicative',
    name: 'Applicative: interchange',
    needs: ['ap', 'of'],
    args: ['a', 'f'],
    check: (T, eq) => (a, f) =>
      eq(
        T.ap(T.of(f), T.of(a)),
        T.ap(
          T.of(h => h(a)),
          T.of(f)
        )
      )
  },
  {
    typeclass: 'Chain',
    name: 'Chain: associativity',
    needs: ['chain'],
    args: ['u', 'kf', 'kg'],
    check: (T, eq) => (u, kf, kg) =>
      eq(
        T.chain(kg, T.chain(kf, u)),
        T.chain(x => T.chain(kg, kf(x)), u)
      )
  },
  {
    typeclass: 'Monad',
    name: 'Monad: left identity',
    needs: ['chain', 'of'],
    args: ['a', 'kf'],
    check: (T, eq) => (a, kf) => eq(T.chain(kf, T.of(a)), kf(a))
  },
  {
    typeclass: 'Monad',
    name: 'Monad: right identity',
    needs: ['chain', 'of'],
    args: ['u'],
    check: (T, eq) => u => eq(T.chain(T.of, u), u)
  }
];

export const lawsFor = (T, typeclasses) => {
  const wanted = typeclasses ? new Set(typeclasses) : null;
  return LAWS.filter(
    law =>
      (!wanted || wanted.has(law.typeclass)) && law.needs.every(m => typeof T[m] === 'function')
  );
};
