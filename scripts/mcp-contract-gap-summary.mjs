#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASELINE_FILE = path.join(
  ROOT,
  'src',
  'mcp',
  'contract-gap-baseline.json'
);

function inferOperationType(methodName) {
  if (/^create[A-Z]/.test(methodName)) return 'create';
  if (/^count[A-Z]/.test(methodName)) return 'count';
  if (/^read[A-Z].*s$/.test(methodName)) return 'list';
  if (/^read[A-Z]/.test(methodName)) return 'read';
  if (/^update[A-Z]/.test(methodName)) return 'update';
  if (/^delete[A-Z]/.test(methodName)) return 'delete';
  if (/^(search|query)[A-Z]/.test(methodName)) return 'search';
  if (/^(list|getListOf|getFull)[A-Z]/.test(methodName)) return 'list';
  if (/^export[A-Z]/.test(methodName)) return 'export';
  if (/^import[A-Z]/.test(methodName)) return 'import';
  return 'special';
}

function summarize(ids) {
  const domains = new Map();
  for (const id of ids) {
    const segments = id.split('.');
    const domain = segments[0] || 'unknown';
    const methodName = segments[segments.length - 1] || '';
    const op = inferOperationType(methodName);

    if (!domains.has(domain)) {
      domains.set(domain, {
        total: 0,
        byOperation: new Map(),
        ids: [],
      });
    }

    const bucket = domains.get(domain);
    bucket.total += 1;
    bucket.byOperation.set(op, (bucket.byOperation.get(op) || 0) + 1);
    bucket.ids.push(id);
  }

  for (const value of domains.values()) {
    value.ids.sort();
  }

  return domains;
}

function renderMarkdown(domains, ids) {
  const lines = [];
  lines.push('# MCP Contract Gap Summary');
  lines.push('');
  lines.push(`- Baseline entries: ${ids.length}`);
  lines.push('');
  lines.push('## By Domain');
  lines.push('');
  lines.push('| Domain | Total | Breakdown |');
  lines.push('| --- | ---: | --- |');

  const orderedDomains = [...domains.keys()].sort();
  for (const domain of orderedDomains) {
    const info = domains.get(domain);
    const breakdown = [...info.byOperation.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([op, count]) => `${op}: ${count}`)
      .join(', ');
    lines.push(`| ${domain} | ${info.total} | ${breakdown} |`);
  }

  lines.push('');
  lines.push('## Entries');
  lines.push('');
  for (const domain of orderedDomains) {
    const info = domains.get(domain);
    lines.push(`### ${domain}`);
    lines.push('');
    for (const id of info.ids) {
      lines.push(`- ${id}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function main() {
  const raw = fs.readFileSync(BASELINE_FILE, 'utf8');
  const ids = JSON.parse(raw);
  if (!Array.isArray(ids)) {
    throw new Error('contract-gap-baseline.json must be an array of descriptor IDs.');
  }

  const domains = summarize(ids);
  const markdown = renderMarkdown(domains, ids);
  process.stdout.write(`${markdown}\n`);
}

main();
