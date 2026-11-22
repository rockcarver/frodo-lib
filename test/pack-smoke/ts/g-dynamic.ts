// A dynamic import() from a TypeScript file.
export async function load() {
  const lib = await import('@rockcarver/frodo-lib');
  return lib.frodo.createInstance({
    host: 'https://openam-matrix.example.com/am',
  });
}
