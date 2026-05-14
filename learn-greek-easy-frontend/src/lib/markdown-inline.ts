import * as React from 'react';

/**
 * Inline markdown renderer for **bold** and *italic* only.
 * Ported from design_handoff_admin_redesign/changelog.jsx `renderMD` (line 22).
 *
 * NOT a real markdown parser — no headings, links, lists, code, or HTML.
 * Caller truncates if a preview is needed.
 */
export function renderInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];
  // Split on bold/italic markers, keep the delimiters as separate tokens.
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return tokens.map((tok, i) => {
    if (tok.startsWith('**') && tok.endsWith('**')) {
      return React.createElement('b', { key: i }, tok.slice(2, -2));
    }
    if (tok.startsWith('*') && tok.endsWith('*')) {
      return React.createElement('i', { key: i }, tok.slice(1, -1));
    }
    return tok;
  });
}
