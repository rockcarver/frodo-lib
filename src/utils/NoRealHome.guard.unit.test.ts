/**
 * Run with:
 *
 *        npm run test:only NoRealHome.guard
 *
 * Tests never touch the real home directory (`test/jest-no-real-home.setup.js`).
 * Every check that could write looks first at where `os.homedir()` points and
 * writes nothing if it points at the real home, so that this file is not the
 * one that puts a file there when the guard is gone.
 */
import fs from 'fs';
import http from 'http';
import { AddressInfo } from 'net';
import os from 'os';
import path from 'path';
import { gzipSync } from 'zlib';
import { jest } from '@jest/globals';
import { APP_TEMPLATE_CATALOG_URLS } from '../api/ApplicationTemplateApi';
import { readCatalog } from '../ops/ApplicationTemplateOps';
import { getCatalogCacheDirectory } from '../ops/internal/ApplicationTemplateCatalogCache';
import StateImpl from '../shared/State';
import { getFrodoHome } from './FrodoUtils';

const realHome = process.env.FRODO_TEST_REAL_HOME as string;
const testHome = process.env.FRODO_TEST_HOME as string;

/** Fails the test, before anything is written, when the guard is not in place. */
function expectGuard(): void {
  expect(realHome).toBeTruthy();
  expect(path.isAbsolute(realHome)).toBe(true);
  expect(os.homedir()).not.toBe(realHome);
  expect(os.homedir()).toBe(testHome);
}

describe('tests never touch the real home', () => {
  test('1: os.homedir() is a temporary directory made for this test file, and so are HOME and USERPROFILE', () => {
    expectGuard();
    expect(path.basename(os.homedir())).toMatch(/^frodo-test-home-/);
    expect(path.dirname(os.homedir())).toBe(fs.realpathSync(os.tmpdir()));
    expect(fs.statSync(os.homedir()).isDirectory()).toBe(true);
    expect(process.env.HOME).toBe(os.homedir());
    expect(process.env.USERPROFILE).toBe(os.homedir());
  });

  test('2: a file written under the home lands in the temporary home and not in the real one', () => {
    expectGuard();
    const name = `NoRealHome-${process.pid}-${Date.now()}.txt`;
    const file = path.join(os.homedir(), '.frodo', name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'synthetic');
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.existsSync(path.join(realHome, '.frodo', name))).toBe(false);
  });

  test('3: the defaults of the library are inside the temporary home', () => {
    expectGuard();
    expect(getFrodoHome()).toBe(path.join(testHome, '.frodo'));
    expect(getCatalogCacheDirectory({ state: StateImpl({}) })).toBe(
      path.join(testHome, '.frodo', 'AppTemplates')
    );
  });

  test('4: a catalog read with the cache on and no directory writes under the temporary home', async () => {
    expectGuard();
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json', ETag: '"g1"' });
      res.end(
        gzipSync(
          Buffer.from(
            JSON.stringify({
              AppTemplates: {
                consumer: {
                  Web: { '1_0-web': { id: 'web', templateVersion: '1.0' } },
                },
                enterprise: {},
              },
            })
          )
        )
      );
    });
    await new Promise<void>((resolvePromise) =>
      server.listen(0, '127.0.0.1', () => resolvePromise())
    );
    const original = { ...APP_TEMPLATE_CATALOG_URLS };
    (APP_TEMPLATE_CATALOG_URLS as any).production =
      `http://127.0.0.1:${(server.address() as AddressInfo).port}/production.json.gz`;
    try {
      const state = StateImpl({});
      state.setUseTemplateCatalogCache(true);
      const result = await readCatalog({ state });
      expect(result.metadata.cachePath).toBe(
        path.join(testHome, '.frodo', 'AppTemplates', 'production.json')
      );
      expect(fs.existsSync(result.metadata.cachePath)).toBe(true);
    } finally {
      Object.assign(APP_TEMPLATE_CATALOG_URLS, original);
      await new Promise<void>((resolvePromise) =>
        server.close(() => resolvePromise())
      );
    }
  });

  test('5: jest.restoreAllMocks() does not undo the guard, and a spy on os.homedir() restores to it', () => {
    expectGuard();
    jest.restoreAllMocks();
    expectGuard();
    const spy = jest.spyOn(os, 'homedir').mockReturnValue('/somewhere/else');
    expect(os.homedir()).toBe('/somewhere/else');
    spy.mockRestore();
    expectGuard();
  });
});
