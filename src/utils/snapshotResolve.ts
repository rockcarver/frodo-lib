module.exports = {
  resolveSnapshotPath: (testPath, snapshotExtension) => {
    // console.log(`testPath in = ${testPath}`);
    let snapshotFilePath = '';
    if (testPath.indexOf('cjs') !== -1) {
      snapshotFilePath = testPath
        .replace('cjs', 'src')
        .concat(snapshotExtension);
    } else {
      snapshotFilePath = testPath
        .replace('esm', 'src')
        .concat(snapshotExtension);
    }
    snapshotFilePath = snapshotFilePath.replace(
      /(.*\/src)\/(.*)\/(.*)\.snap/g,
      '$1/test/snapshots/$2/$3.snap'
    );
    // console.log(`snapshotFilePath out = ${snapshotFilePath}`);
    return snapshotFilePath;
  },

  // resolves from snapshot to test path
  resolveTestPath: (snapshotFilePath, snapshotExtension) => {
    // console.log(`snapshotFilePath in = ${snapshotFilePath}`);
    let testFilePath = snapshotFilePath.replace('/test/snapshots/', '/');
    if (snapshotFilePath.indexOf('mjs') !== -1) {
      testFilePath = testFilePath.replace('src', 'esm');
    } else {
      testFilePath = testFilePath.replace('src', 'cjs');
    }
    testFilePath = testFilePath.substring(
      0,
      testFilePath.indexOf(snapshotExtension)
    );
    // console.log(`testFilePath out = ${testFilePath}`);
    return testFilePath;
  },

  // Example test path, used for preflight consistency check of the implementation above
  testPathForConsistencyCheck:
    '/home/sandeepc/work/ForgeRock/sources/frodo-lib/cjs/ops/IdmOps.test.js',
};
