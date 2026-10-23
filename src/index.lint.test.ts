import { ESLint } from 'eslint';

describe('package root wildcard export lint rule', () => {
  const eslint = new ESLint({
    overrideConfig: [
      {
        files: ['src/index.ts'],
        languageOptions: {
          parserOptions: { project: false },
        },
        rules: {
          '@typescript-eslint/no-deprecated': 'off',
        },
      },
    ],
  });

  async function lint(source: string) {
    const [result] = await eslint.lintText(source, {
      filePath: 'src/index.ts',
    });
    return result.messages
      .filter((message) => message.ruleId === 'no-restricted-syntax')
      .map((message) => message.message);
  }

  test('rejects wildcard value exports and allows type-only exports', async () => {
    const valueWildcard = await lint("export * from './mcp';");
    const namespaceWildcard = await lint("export * as mcpNs from './mcp';");
    const typeWildcard = await lint("export type * from './mcp';");
    const namedType = await lint(
      "export type { McpService as McpServiceAgain } from './mcp';"
    );

    expect(valueWildcard).toHaveLength(1);
    expect(namespaceWildcard).toHaveLength(1);
    expect(typeWildcard).toHaveLength(0);
    expect(namedType).toHaveLength(0);
  });
});
