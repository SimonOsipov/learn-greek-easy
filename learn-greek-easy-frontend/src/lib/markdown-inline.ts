import { createElement } from 'react';
import type { ReactNode, ReactElement } from 'react';

/**
 * Renders a string containing inline markdown (`**bold**` and `*italic*`) as
 * a React.ReactNode (an array of strings and <b>/<i> elements).
 *
 * Only `**bold**` and `*italic*` are supported. All other text — including
 * HTML tags — is returned as plain strings, which React escapes safely at
 * render time. This function never uses dangerouslySetInnerHTML.
 *
 * Faithfully ported from `renderMD` in the design handoff
 * (`design_handoff_admin_redesign/changelog.jsx` line 22).
 */
export function renderInlineMarkdown(text: string): ReactNode {
  if (!text) return null;

  const parts: (string | ReactElement)[] = [];
  let cursor = 0;
  let key = 0;
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    // Plain-text slice before this match
    if (m.index > cursor) {
      parts.push(text.slice(cursor, m.index));
    }

    if (m[2] !== undefined) {
      // **bold**
      parts.push(createElement('b', { key: ++key }, m[2]));
    } else if (m[3] !== undefined) {
      // *italic*
      parts.push(createElement('i', { key: ++key }, m[3]));
    }

    cursor = m.index + m[0].length;
  }

  // Remaining tail
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts as ReactNode;
}
