// @ts-self-types="./oracle.d.ts"

// The rewrite-tier bridge (moonshot §6.2 consumer three): blessed law:/
// effects: claims become oracle inputs — assume entries with provenance
// that liftAxioms turns into cited rewrite rules, and per-export purity
// flags for the consumer's declare. Emits wire shapes only; this module
// depends on nothing, apodictum included.
export const oracleInputsFromSidecar = sidecar => {
  const pkg = sidecar.frontmatter.package || sidecar.name;
  const binds = sidecar.frontmatter.binds || '';
  const provenance = binds ? `${pkg}@${binds} sidecar` : `${pkg} sidecar`;
  const axioms = [];
  const declares = [];
  for (const claim of sidecar.claims) {
    if (claim.kind === 'law' && claim.axiom) {
      axioms.push({
        claim: `law:${claim.name}`,
        name: `${pkg} law:${claim.name}`,
        source: provenance,
        atoms: claim.axiom.atoms || {},
        formulas: claim.axiom.formulas || []
      });
    }
    if (claim.kind === 'effects' && claim.flags) {
      declares.push({
        claim: `effects:${claim.name}`,
        source: provenance,
        exports: claim.flags
      });
    }
  }
  return {axioms, declares};
};

const rename = (formula, binding, axiom) => {
  if (typeof formula === 'string') {
    const mapped = binding[formula];
    if (mapped === undefined)
      throw new Error(`unbound axiom atom '${formula}' in ${axiom.name} — bind every placeholder`);
    return mapped;
  }
  if (!Array.isArray(formula)) return formula;
  return [formula[0], ...formula.slice(1).map(part => rename(part, binding, axiom))];
};

// Placeholder atoms → the consumer's query atom names; returns assume-ready
// entries ({formula, name, source} — apodictum's axiom-entry shape, so the
// provenance lands in the law trail of any rewrite the axiom licenses).
export const instantiateAxioms = (axioms, binding) =>
  axioms.flatMap(axiom =>
    axiom.formulas.map((formula, index) => ({
      formula: rename(formula, binding, axiom),
      name: axiom.formulas.length > 1 ? `${axiom.name} #${index + 1}` : axiom.name,
      source: axiom.source
    }))
  );

// Merge per-export flags into a declare object for the consumer's atom
// symbols: {symbol: exportName} picks each symbol's flags from the sidecar.
export const declareFromSidecar = (declares, symbolExports) => {
  const byExport = {};
  for (const d of declares)
    for (const [name, flags] of Object.entries(d.exports))
      byExport[name] = [...new Set([...(byExport[name] || []), ...flags])];
  const declare = {};
  for (const [symbol, exportName] of Object.entries(symbolExports)) {
    const flags = byExport[exportName];
    if (flags) declare[symbol] = flags;
  }
  return declare;
};
