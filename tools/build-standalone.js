#!/usr/bin/env node
/**
 * LifeFlow — standalone build.
 *
 * Browsers refuse to load ES modules from file://, so double-clicking
 * index.html would leave the app stuck on the splash screen. This script folds
 * every module under js/ into one classic script, js/app.bundle.js, which
 * index.html loads whenever the page is opened from disk. Firebase is still
 * pulled from the CDN at start-up (dynamic import() works from file://).
 *
 * No dependencies — plain Node:
 *
 *     node tools/build-standalone.js
 *
 * Re-run it after changing anything under js/. Served over http(s), index.html
 * keeps loading the original modules, so the bundle is only used from disk.
 *
 * Supported syntax (all the codebase uses, verified at build time):
 *   import { a, b as c } from '...';   import * as ns from '...';
 *   export const|function|async function|class name ...;   export { a, b as c };
 * The module graph must be acyclic and exports must not be reassigned
 * (no `export let`), because imports are bound once, in dependency order.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ENTRY = 'js/app.js';
const OUT = 'js/app.bundle.js';

const IMPORT_RE = /^import\s+([\s\S]*?)\s+from\s+(['"])([^'"]+)\2\s*;?[ \t]*$/gm;
const EXPORT_LIST_RE = /^export\s*\{([\s\S]*?)\}\s*;?[ \t]*$/gm;
const EXPORT_DECL_RE = /^export\s+((?:async\s+)?function\s*\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;

const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');
const isUrl = (spec) => /^https?:\/\//.test(spec);

function fail(msg) {
  console.error(`build-standalone: ${msg}`);
  process.exit(1);
}

/** `a, b as c` → [['a', 'a'], ['b', 'c']]  (imported/local name, exported/alias). */
function parseSpecifiers(list, where) {
  return list
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      if (!m) fail(`${where}: cannot parse specifier "${s}"`);
      return [m[1], m[2] || m[1]];
    });
}

const modules = new Map(); // rel path -> { id, file, deps, imports, body, exports }
const externals = []; // CDN urls, in first-seen order
const order = []; // dependency-first evaluation order

function load(file, stack = []) {
  const key = rel(file);
  if (stack.includes(key)) fail(`import cycle: ${[...stack, key].join(' -> ')}`);
  if (modules.has(key)) return modules.get(key);

  let src;
  try {
    src = fs.readFileSync(file, 'utf8');
  } catch {
    fail(`cannot read ${key}${stack.length ? ` (imported by ${stack[stack.length - 1]})` : ''}`);
  }

  const mod = { id: `__m${modules.size}`, key, imports: [], exports: [] };
  modules.set(key, mod);

  // Imports → bindings resolved from an already-evaluated module object.
  src = src.replace(IMPORT_RE, (_, clause, __, spec) => {
    clause = clause.trim();
    let source;
    if (isUrl(spec)) {
      if (!externals.includes(spec)) externals.push(spec);
      source = { external: externals.indexOf(spec) };
    } else if (spec.startsWith('.')) {
      source = { file: path.resolve(path.dirname(file), spec) };
    } else {
      fail(`${key}: bare import "${spec}" is not supported`);
    }

    const ns = clause.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/);
    const named = clause.match(/^\{([\s\S]*)\}$/);
    if (ns) mod.imports.push({ ...source, ns: ns[1] });
    else if (named) mod.imports.push({ ...source, names: parseSpecifiers(named[1], key) });
    else fail(`${key}: unsupported import clause "${clause}"`);
    return '';
  });

  // `export { a, b as c };`
  src = src.replace(EXPORT_LIST_RE, (_, list) => {
    for (const [local, exported] of parseSpecifiers(list, key)) mod.exports.push([exported, local]);
    return '';
  });

  // `export const x`, `export function f`, ...
  src = src.replace(EXPORT_DECL_RE, (_, kind, name) => {
    if (/^(let|var)$/.test(kind)) fail(`${key}: "export ${kind} ${name}" is not supported (live binding)`);
    mod.exports.push([name, name]);
    return `${kind} ${name}`;
  });

  const leftover = src.match(/^[ \t]*(?:import\s+[\w{*'"]|export\s)[^\n]*/m);
  if (leftover) fail(`${key}: unsupported statement "${leftover[0].trim()}"`);
  if (/\bimport\.meta\b/.test(src)) fail(`${key}: import.meta is not supported`);

  mod.body = src.trim();

  for (const imp of mod.imports) {
    if (imp.file) imp.mod = load(imp.file, [...stack, key]);
  }
  order.push(mod);
  return mod;
}

load(path.join(ROOT, ENTRY));

// Every imported name must actually be exported.
for (const mod of order) {
  for (const imp of mod.imports) {
    if (!imp.mod || !imp.names) continue;
    const exported = new Set(imp.mod.exports.map(([name]) => name));
    for (const [name] of imp.names) {
      if (!exported.has(name)) fail(`${mod.key} imports "${name}" but ${imp.mod.key} does not export it`);
    }
  }
}

function bindings(mod) {
  return mod.imports
    .map((imp) => {
      const from = imp.mod ? imp.mod.id : `__ext[${imp.external}]`;
      if (imp.ns) return `const ${imp.ns} = ${from};`;
      const parts = imp.names.map(([name, local]) => (name === local ? name : `${name}: ${local}`));
      return `const { ${parts.join(', ')} } = ${from};`;
    })
    .join('\n');
}

const banner = `/*
 * LifeFlow — GENERATED FILE, DO NOT EDIT.
 * Built by tools/build-standalone.js from ${ENTRY} so the app runs from file://.
 * Edit the sources under js/ and re-run: node tools/build-standalone.js
 */`;

const parts = [
  banner,
  '(async function () {',
  "  'use strict';",
  `  const __ext = await Promise.all(${JSON.stringify(externals, null, 2).replace(/\n/g, '\n  ')}.map((url) => import(url)));`
];

for (const mod of order) {
  const exportsObj = mod.exports.map(([name, local]) => (name === local ? name : `${name}: ${local}`)).join(', ');
  parts.push(
    '',
    `  /* ===== ${mod.key} ===== */`,
    `  const ${mod.id} = (function () {`,
    bindings(mod),
    mod.body,
    `return Object.freeze({ ${exportsObj} });`,
    '  })();'
  );
}

parts.push(
  '})().catch(function (err) {',
  "  console.error('[LifeFlow] could not start', err);",
  "  var word = document.querySelector('.splash__word');",
  "  if (word) word.textContent = 'LifeFlow could not start — check your internet connection and reload.';",
  '});',
  ''
);

const code = parts.join('\n');

try {
  new vm.Script(code, { filename: OUT });
} catch (err) {
  fail(`generated bundle does not parse: ${err.message}`);
}

fs.writeFileSync(path.join(ROOT, OUT), code, 'utf8');
console.log(`build-standalone: ${order.length} modules, ${externals.length} CDN imports -> ${OUT} (${Math.round(code.length / 1024)} KB)`);
