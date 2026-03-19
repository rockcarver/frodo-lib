#!/usr/bin/env node
/**
 * generate-help.mjs
 *
 * Build-time code-generator.  Parses every  src/ops/**\/*.ts  file (source of
 * truth for JSDoc) and writes  src/lib/Help.ts  — a static TypeScript module
 * that exports all help metadata as a plain JS array.
 *
 * Because the metadata is bundled by tsup into dist/, frodo-cli (and the
 * single-binary build produced by pkg) can import it directly without any
 * file-system access at runtime.
 *
 * Run automatically as part of  npm run build.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_OPS_DIR = path.join(ROOT, 'src', 'ops');
const OUT_FILE = path.join(ROOT, 'src', 'lib', 'Help.ts');

// ---------------------------------------------------------------------------
// JSDoc parser  (mirrors the runtime parser in FrodoShellHelp.ts)
// ---------------------------------------------------------------------------

function parseJsDoc(raw) {
    if (!raw) return { description: '', params: [], returns: '' };

    const lines = raw
        .split('\n')
        .map((l) =>
            l
                .replace(/^\s*\/\*\*\s*$/, '')
                .replace(/^\s*\*\/\s*$/, '')
                .replace(/^\s*\*\s?/, '')
                .trim()
        )
        .filter((l) => l.length > 0);

    let description = '';
    const params = [];
    let returns = '';
    let inDesc = true;

    for (const line of lines) {
        if (line.startsWith('@param')) {
            inDesc = false;
            const m = line.match(/^@param\s+(?:\{([^}]*)\}\s+)?(\S+)\s*(.*)/);
            if (m) params.push({ type: m[1] || '', name: m[2], description: m[3] || '' });
        } else if (line.startsWith('@returns') || line.startsWith('@return')) {
            inDesc = false;
            const m = line.match(/^@returns?\s+(?:\{([^}]*)\}\s*)?(.*)/);
            if (m) returns = [m[1] ? `{${m[1]}}` : '', m[2]].filter(Boolean).join(' ');
        } else if (line.startsWith('@')) {
            inDesc = false;
        } else if (inDesc) {
            description = description ? `${description} ${line}` : line;
        }
    }

    return { description, params, returns };
}

// ---------------------------------------------------------------------------
// .ts file parser — same brace-depth state machine as the runtime version
// ---------------------------------------------------------------------------

function parseOpsFile(filePath) {
    let content;
    try {
        content = readFileSync(filePath, 'utf-8');
    } catch {
        return [];
    }

    const results = [];
    const lines = content.split('\n');

    let inTypeBlock = false;
    let typeName = '';
    let typeDepth = 0;
    let inJsdoc = false;
    let jsdocBuffer = [];
    let pendingJsdoc = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!inTypeBlock) {
            const m = trimmed.match(/^export\s+type\s+(\w+)\s*=\s*\{/);
            if (m) {
                inTypeBlock = true;
                typeName = m[1];
                const afterBrace = trimmed.slice(trimmed.indexOf('{') + 1);
                const extraOpens = (afterBrace.match(/\{/g) || []).length;
                const closes = (trimmed.match(/\}/g) || []).length;
                typeDepth = 1 + extraOpens - closes;
                if (typeDepth <= 0) {
                    inTypeBlock = false;
                    typeName = '';
                }
            }
            continue;
        }

        // Handle JSDoc blocks (don't count their braces)
        if (!inJsdoc && trimmed.startsWith('/**')) {
            inJsdoc = true;
            jsdocBuffer = [line];
            if (trimmed.includes('*/') && trimmed.length > 3) {
                inJsdoc = false;
                pendingJsdoc = jsdocBuffer.join('\n');
            }
            continue;
        }

        if (inJsdoc) {
            jsdocBuffer.push(line);
            if (trimmed.includes('*/')) {
                inJsdoc = false;
                pendingJsdoc = jsdocBuffer.join('\n');
            }
            continue;
        }

        // Count real braces
        const opens = (trimmed.match(/\{/g) || []).length;
        const closes = (trimmed.match(/\}/g) || []).length;
        typeDepth += opens - closes;

        if (typeDepth <= 0) {
            inTypeBlock = false;
            typeName = '';
            typeDepth = 0;
            pendingJsdoc = '';
            continue;
        }

        // At depth 1: method signature lines
        if (typeDepth === 1 && trimmed.match(/^\w[\w<>,\s]*\s*\(/)) {
            const methodMatch = trimmed.match(/^(\w+)/);
            if (methodMatch) {
                const methodName = methodMatch[1];

                let sigText = trimmed;
                let j = i;
                while (!sigText.trimEnd().endsWith(';') && j + 1 < lines.length) {
                    j++;
                    sigText += ' ' + lines[j].trim();
                }
                i = j;

                const signature = sigText.replace(/;\s*$/, '').trim();
                const { description, params, returns } = parseJsDoc(pendingJsdoc);
                results.push({ typeName, methodName, signature, description, params, returns });
                pendingJsdoc = '';
                continue;
            }
        }

        pendingJsdoc = '';
    }

    return results;
}

// ---------------------------------------------------------------------------
// Walk src/ops recursively, skip test and template files
// ---------------------------------------------------------------------------

function walkDir(dir, collector) {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'templates') continue; // skip template stubs
            walkDir(full, collector);
        } else if (
            entry.isFile() &&
            entry.name.endsWith('.ts') &&
            !entry.name.endsWith('.test.ts') &&
            !entry.name.endsWith('.d.ts')
        ) {
            collector.push(full);
        }
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const sourceFiles = [];
walkDir(SRC_OPS_DIR, sourceFiles);
sourceFiles.sort(); // stable output

const allDocs = [];
for (const file of sourceFiles) {
    const docs = parseOpsFile(file);
    allDocs.push(...docs);
}

console.log(
    `generate-help: parsed ${sourceFiles.length} source files, extracted ${allDocs.length} method docs`
);

// ---------------------------------------------------------------------------
// Render each entry using JSON.stringify for safe string escaping
// ---------------------------------------------------------------------------

function renderEntry(doc) {
    const paramsLiteral =
        doc.params.length === 0
            ? '[]'
            : `[\n      ${doc.params
                .map(
                    (p) =>
                        `{ name: ${JSON.stringify(p.name)}, type: ${JSON.stringify(p.type)}, description: ${JSON.stringify(p.description)} }`
                )
                .join(',\n      ')},\n    ]`;

    return (
        `  {\n` +
        `    typeName: ${JSON.stringify(doc.typeName)},\n` +
        `    methodName: ${JSON.stringify(doc.methodName)},\n` +
        `    signature: ${JSON.stringify(doc.signature)},\n` +
        `    description: ${JSON.stringify(doc.description)},\n` +
        `    params: ${paramsLiteral},\n` +
        `    returns: ${JSON.stringify(doc.returns)},\n` +
        `  }`
    );
}

const entries = allDocs.map(renderEntry).join(',\n');

const output = `/* eslint-disable */
// ============================================================
// Auto-generated by scripts/generate-help.mjs — do not edit.
// Run \`npm run build\` or \`npm run generate-help\` to regenerate.
// ============================================================

export interface MethodParam {
  name: string;
  type: string;
  description: string;
}

export interface MethodHelpDoc {
  typeName: string;
  methodName: string;
  /** Full TypeScript signature without the trailing semicolon */
  signature: string;
  description: string;
  params: MethodParam[];
  returns: string;
}

export const helpMetadata: MethodHelpDoc[] = [
${entries},
];
`;

const libDir = path.dirname(OUT_FILE);
if (!existsSync(libDir)) mkdirSync(libDir, { recursive: true });
writeFileSync(OUT_FILE, output, 'utf-8');
console.log(`generate-help: wrote ${OUT_FILE}`);
