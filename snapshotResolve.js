const fs = require('fs');

module.exports = {
  resolveSnapshotPath: (testPath, snapshotExtension) => {
    let snapshotFilePath = '';
    if (testPath.endsWith('.ts')) {
      snapshotFilePath = testPath.slice(0, -3).concat('.js').concat(snapshotExtension);
    } else if (testPath.indexOf('/esm/') != -1) {
      snapshotFilePath = testPath.replace('/esm/', '/src/').concat(snapshotExtension);
    } else if (testPath.indexOf('/cjs/') != -1) {
      snapshotFilePath = testPath.replace('/cjs/', '/src/').concat(snapshotExtension);
    }
    snapshotFilePath = snapshotFilePath.replace('/src/', '/src/test/snapshots/');
    // console.log(`snapshotFilePath out = ${snapshotFilePath}`);
    return snapshotFilePath;
  },

  // resolves from snapshot to test path
  resolveTestPath: (snapshotFilePath, snapshotExtension) => {
    let testFilePath = snapshotFilePath.replace('/test/snapshots/', '/');
    testFilePath = testFilePath.substring(
      0,
      testFilePath.indexOf(snapshotExtension)
    );
    testFilePath = testFilePath.replace('.js', '.ts');
    if (!fs.existsSync(testFilePath)) {
      const defaultPath = testFilePath;
      testFilePath = testFilePath.replace('.ts', '.js');
      testFilePath = testFilePath.replace('/src/', '/cjs/');
      if (!fs.existsSync(testFilePath)) {
        testFilePath = testFilePath.replace('/cjs/', '/esm/');
        if (!fs.existsSync(testFilePath)) {
          testFilePath = defaultPath;
        }
      }
    }
    return testFilePath;
  },

  // Example test path, used for preflight consistency check of the implementation above
  testPathForConsistencyCheck:
    '/home/sandeepc/work/ForgeRock/sources/frodo-lib/src/ops/IdmOps.test.ts',
};
