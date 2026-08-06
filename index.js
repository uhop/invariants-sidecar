// @ts-self-types="./index.d.ts"

export {DERIVATIONS, complete} from './src/static-land.js';
export {LAWS, lawsFor} from './src/laws.js';
export {makeLawTests, makeConsistencyTests, runLaws} from './src/generate.js';
export {parseSidecar} from './src/parse.js';
export {compileCheck, compileChecks, lawTestsFromSidecar} from './src/compile.js';
export {oracleInputsFromSidecar, instantiateAxioms, declareFromSidecar} from './src/oracle.js';
