// Adapted from JupyterLab's CodeMirror 6 theme (BSD-3-Clause).
// Pipyter keeps the editor behavior/theme contract while exposing CSS variables
// so the application can swap light rendering palettes without rebuilding views.

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

const editorTheme = EditorView.theme({
  '&': {
    background: 'transparent',
    color: 'var(--jp-content-font-color1)',
    fontSize: 'var(--jp-code-font-size)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--jp-code-font-family)',
    lineHeight: 'var(--jp-code-line-height)',
    overflow: 'visible',
  },
  '.cm-content': {
    minHeight: '46px',
    padding: '8px 10px',
    caretColor: 'var(--jp-editor-cursor-color)',
  },
  '.cm-line': { padding: '0' },
  '.cm-cursor, .cm-dropCursor': {
    borderLeft: 'var(--jp-code-cursor-width0) solid var(--jp-editor-cursor-color)',
  },
  '.cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--jp-editor-selected-background)',
  },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    backgroundColor: 'var(--jp-editor-selected-focused-background)',
  },
  '.cm-gutters': { display: 'none' },
  '.cm-activeLine': { backgroundColor: 'var(--jp-editor-active-line-background)' },
  '.cm-searchMatch': {
    backgroundColor: 'var(--jp-search-unselected-match-background-color)',
    color: 'var(--jp-search-unselected-match-color)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'var(--jp-search-selected-match-background-color) !important',
    color: 'var(--jp-search-selected-match-color) !important',
  },
  '.cm-tooltip, .cm-panels': {
    backgroundColor: 'var(--jp-layout-color1)',
    color: 'var(--jp-content-font-color1)',
  },
})

const highlightStyle = HighlightStyle.define([
  { tag: t.meta, color: 'var(--jp-mirror-editor-meta-color)' },
  { tag: t.heading, color: 'var(--jp-mirror-editor-header-color)' },
  { tag: [t.heading1, t.heading2, t.heading3, t.heading4], color: 'var(--jp-mirror-editor-header-color)', fontWeight: 'bold' },
  { tag: t.keyword, color: 'var(--jp-mirror-editor-keyword-color)', fontWeight: 'bold' },
  { tag: t.atom, color: 'var(--jp-mirror-editor-atom-color)' },
  { tag: t.number, color: 'var(--jp-mirror-editor-number-color)' },
  { tag: t.definition(t.name), color: 'var(--jp-mirror-editor-def-color)' },
  { tag: [t.standard(t.variableName), t.typeName], color: 'var(--jp-mirror-editor-builtin-color)' },
  { tag: t.definition(t.typeName), color: 'var(--jp-mirror-editor-def-color)', fontWeight: 'bold' },
  { tag: [t.special(t.variableName), t.self, t.macroName], color: 'var(--jp-mirror-editor-variable-2-color)' },
  { tag: t.punctuation, color: 'var(--jp-mirror-editor-punctuation-color)' },
  { tag: t.propertyName, color: 'var(--jp-mirror-editor-property-color)' },
  { tag: t.operator, color: 'var(--jp-mirror-editor-operator-color)', fontWeight: 'bold' },
  { tag: t.comment, color: 'var(--jp-mirror-editor-comment-color)', fontStyle: 'italic' },
  { tag: t.string, color: 'var(--jp-mirror-editor-string-color)' },
  { tag: [t.labelName, t.monospace, t.special(t.string)], color: 'var(--jp-mirror-editor-string-2-color)' },
  { tag: t.bracket, color: 'var(--jp-mirror-editor-bracket-color)' },
  { tag: t.tagName, color: 'var(--jp-mirror-editor-tag-color)' },
  { tag: t.attributeName, color: 'var(--jp-mirror-editor-attribute-color)' },
  { tag: t.quote, color: 'var(--jp-mirror-editor-quote-color)' },
  { tag: t.link, color: 'var(--jp-mirror-editor-link-color)', textDecoration: 'underline' },
  { tag: [t.separator, t.derefOperator, t.paren], color: '' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.bool, color: 'var(--jp-mirror-editor-keyword-color)', fontWeight: 'bold' },
])

export const jupyterCodeTheme: Extension = [editorTheme, syntaxHighlighting(highlightStyle)]

export const jupyterFileEditorTheme: Extension = EditorView.theme({
  '&': { height: '100%', background: 'var(--jp-layout-color0)' },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-content': { minHeight: '100%', padding: '10px 12px' },
  '.cm-gutters': {
    display: 'flex',
    borderRight: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text-3)',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '42px',
    padding: '0 9px 0 8px',
    textAlign: 'right',
  },
  '.cm-activeLineGutter': { background: 'var(--accent-soft)', color: 'var(--accent-dark)' },
})
