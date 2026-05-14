import React from 'react';

import { describe, it, expect } from 'vitest';

import { renderInlineMarkdown } from '../markdown-inline';

function flatten(nodes: React.ReactNode[]): string {
  return nodes
    .map((n) => {
      if (typeof n === 'string') return n;
      if (React.isValidElement(n)) {
        const type = typeof n.type === 'string' ? n.type : 'el';
        return `<${type}>${(n.props as { children?: React.ReactNode }).children}</${type}>`;
      }
      return '';
    })
    .join('');
}

describe('renderInlineMarkdown', () => {
  it('passes plain text through unchanged', () => {
    expect(flatten(renderInlineMarkdown('hello world'))).toBe('hello world');
  });

  it('renders **bold** as <b>', () => {
    expect(flatten(renderInlineMarkdown('a **b** c'))).toBe('a <b>b</b> c');
  });

  it('renders *italic* as <i>', () => {
    expect(flatten(renderInlineMarkdown('a *b* c'))).toBe('a <i>b</i> c');
  });

  it('renders mixed bold + italic', () => {
    expect(flatten(renderInlineMarkdown('**bold** then *italic*'))).toBe(
      '<b>bold</b> then <i>italic</i>'
    );
  });

  it('returns empty array for empty input', () => {
    expect(renderInlineMarkdown('')).toEqual([]);
  });

  it('does NOT parse headings, links, lists, or HTML', () => {
    const out = flatten(renderInlineMarkdown('# heading [link](url) - list <b>html</b>'));
    // Everything passes through literally; no transformations.
    expect(out).toBe('# heading [link](url) - list <b>html</b>');
  });
});
