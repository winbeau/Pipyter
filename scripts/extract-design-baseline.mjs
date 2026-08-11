#!/usr/bin/env node
/**
 * Extract the frozen Pigent v0.1 design baseline from the three authoritative
 * HTML design files (design/Pipyter.dc (1).html, PipyterPigent.dc (1).html,
 * PipyterWorkspace.dc (1).html) into a machine-readable fixture consumed by
 * Python and TypeScript protocol tests.
 *
 * Usage:
 *   node scripts/extract-design-baseline.mjs            # write fixture
 *   node scripts/extract-design-baseline.mjs --check    # verify fixture matches HTML
 *
 * The x-dc files need the DesignComposer support.js runtime to render; this
 * repository does not vendor it, so the baseline is extracted statically from
 * the inline styles (the same values the designs render with). Full rendered
 * comparison fixtures happen in Phase 5 against the React implementation.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const designDir = resolve(root, 'design')
const fixturePath = resolve(root, 'packages/protocol/schemas/fixtures/design-baseline.json')

const files = {
  shell: 'Pipyter.dc (1).html',
  pigent: 'PipyterPigent.dc (1).html',
  workspace: 'PipyterWorkspace.dc (1).html',
}

function read(name) {
  return readFileSync(resolve(designDir, name), 'utf-8')
}

/** Collect `--name: value` CSS variable declarations from inline style attributes. */
function extractTokens(html) {
  const tokens = {}
  const re = /--([a-z0-9-]+):\s*([^;"}]+)/gi
  for (const match of html.matchAll(re)) {
    let value = match[2].trim().replace(/;$/, '')
    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) value = value.toLowerCase()
    // Prefer the first occurrence (design token blocks appear at the root containers).
    if (!(match[1].toLowerCase() in tokens)) tokens[match[1].toLowerCase()] = value
  }
  return tokens
}

/** Collect fixed pixel dimensions from inline style attributes. */
function extractDimensions(html) {
  const dims = new Map()
  const re = /(width|height|max-width|min-width|flex-basis|font-size):\s*(\d+(?:\.\d+)?)px/gi
  for (const match of html.matchAll(re)) {
    const key = `${match[1].toLowerCase()}:${match[2]}px`
    dims.set(key, (dims.get(key) ?? 0) + 1)
  }
  return Object.fromEntries([...dims.entries()].sort())
}

function extractBaseline() {
  const sources = {}
  for (const [key, file] of Object.entries(files)) {
    const html = read(file)
    sources[key] = { tokens: extractTokens(html), dimensions: extractDimensions(html) }
  }

  const tokens = { ...sources.workspace.tokens, ...sources.pigent.tokens }
  // Explicit declared constants (fall back to workspace values where absent).
  const layout = {
    rail_width: 84,
    session_list_width: 236,
    detail_panel_width: 300,
    workspace_pigent_panel_width: 360,
    shell_panel_height: 220,
    pigent_header_height: 52,
    content_max_width: 880,
    shell_header_height: 34,
    shell_footer_height: 24,
    pigent_panel_header_height: 40,
    file_browser_width: 228,
    workspace_status_bar_height: 24,
  }

  const modes = ['ask', 'plan', 'auto']

  return {
    name: 'design-baseline',
    description:
      'Frozen Pigent v0.1 visual baseline extracted from design/Pipyter.dc (1).html, design/PipyterPigent.dc (1).html and design/PipyterWorkspace.dc (1).html. These three files are the visual source of truth (docs/plans/pigent-v0.1/07-pigent-shell-ui-migration.md).',
    protocol_version: '0.1',
    layout,
    modes,
    mode_hints: {
      ask: '只分析回答，不修改或执行',
      plan: '分析并生成 Tasks，不执行修改',
      auto: '以当前 Runtime 用户身份自主执行',
    },
    tokens,
    sources,
  }
}

function assertLayout(baseline) {
  const dims = baseline.sources
  const expect = (sourceKey, pattern, count) => {
    const key = Object.keys(dims[sourceKey].dimensions).find((k) => k.startsWith(pattern))
    if (!key || dims[sourceKey].dimensions[key] < count) {
      throw new Error(`design baseline missing ${pattern} in ${sourceKey} (>=${count} occurrences)`)
    }
  }
  expect('shell', 'width:84', 1)
  expect('pigent', 'width:236', 1)
  expect('pigent', 'width:300', 1)
  expect('workspace', 'width:360', 1)
  expect('workspace', 'height:220', 1)
  expect('pigent', 'height:52', 1)
  expect('pigent', 'max-width:880', 1)
  expect('workspace', 'height:34', 1)
  expect('workspace', 'height:24', 1)
  expect('workspace', 'height:40', 1)

  const t = baseline.tokens
  const normalize = (v) =>
    /^#[0-9a-f]{3}$/i.test(v) ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase() : v.toLowerCase()
  const expectToken = (name, value) => {
    if (normalize(t[name] ?? '') !== normalize(value)) {
      throw new Error(`design token --${name} expected ${value}, got ${t[name]}`)
    }
  }
  expectToken('bg', '#f7f6f3')
  expectToken('surface', '#fff')
  expectToken('surface-2', '#f1f1ef')
  expectToken('surface-hover', '#f1f1ef')
  expectToken('border', '#edece9')
  expectToken('border-strong', '#dcdad4')
  expectToken('text', '#37352f')
  expectToken('text-2', '#787774')
  expectToken('text-3', '#9b9a97')
  expectToken('accent', '#2383e2')
  expectToken('accent-soft', '#e3f2fd')
  expectToken('accent-dark', '#0d47a1')
  expectToken('pigent', '#d9730d')
  expectToken('pigent-soft', '#fff0e5')
  expectToken('pigent-dark', '#a64b18')
  expectToken('success', '#0f7b6c')
  expectToken('success-soft', '#e4f0ee')
  expectToken('danger', '#c33f31')
  expectToken('danger-soft', '#f9e6e3')
  expectToken('mono', "menlo,consolas,'IBM Plex Mono',monospace")
}

const baseline = extractBaseline()
assertLayout(baseline)

if (process.argv.includes('--check')) {
  if (!existsSync(fixturePath)) throw new Error(`fixture missing: ${fixturePath}`)
  const existing = JSON.parse(readFileSync(fixturePath, 'utf-8'))
  if (JSON.stringify(existing) !== JSON.stringify(baseline)) {
    throw new Error('design-baseline.json is out of date; run node scripts/extract-design-baseline.mjs')
  }
  console.log('design baseline fixture is up to date')
} else {
  writeFileSync(fixturePath, JSON.stringify(baseline, null, 2) + '\n')
  console.log(`wrote ${fixturePath}`)
  console.log('layout:', JSON.stringify(baseline.layout))
  console.log('tokens:', Object.keys(baseline.tokens).length)
}
