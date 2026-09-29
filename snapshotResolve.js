const fs = require('fs');

// All the matching/replacing below is hardcoded to forward slashes. Jest
// passes Windows paths with backslashes (e.g. D:\a\frodo-lib\...), which
// silently fails every '/src/'-style match, so resolveSnapshotPath forgets
// to insert 'test/snapshots/' and resolveTestPath can never map a real
// .snap file back to its test -- Jest then treats every snapshot file as
// obsolete and fails the run even when every test passed. Normalizing to
// forward slashes up front fixes the matching; Node's fs APIs (existsSync
// below) and Jest itself both accept forward-slash paths fine on Windows,
// so nothing needs converting back.
const toPosix = (p) => p.replace(/\\/g, '/');

module.exports = {
  resolveSnapshotPath: (testPath, snapshotExtension) => {
    testPath = toPosix(testPath);
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
    snapshotFilePath = toPosix(snapshotFilePath);
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
