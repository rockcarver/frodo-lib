// A plain require() call in a TypeScript file (types come from @types/node: `any`).
const { frodo, state } = require('@rockcarver/frodo-lib');

export const instance = frodo.createInstance({
  host: 'https://openam-matrix.example.com/am',
});
state.setHost('https://openam-matrix.example.com/am');
