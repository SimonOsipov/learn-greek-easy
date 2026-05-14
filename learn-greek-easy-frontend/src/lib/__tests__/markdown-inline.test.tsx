import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { renderInlineMarkdown } from '../markdown-inline';

const renderInDiv = (input: string) =>
  render(<div data-testid="root">{renderInlineMarkdown(input)}</div>);

describe('renderInlineMarkdown', () => {
  it('passes plain text through unchanged', () => {
    const { getByTestId } = renderInDiv('hello world');
    const root = getByTestId('root');
    expect(root.textContent).toBe('hello world');
    expect(root.querySelector('b, i')).toBeNull();
  });

  it('renders **bold** as a <b> element', () => {
    const { getByTestId } = renderInDiv('a **bold** b');
    const root = getByTestId('root');
    expect(root.textContent).toBe('a bold b');
    const b = root.querySelector('b');
    expect(b).not.toBeNull();
    expect(b?.textContent).toBe('bold');
    expect(root.querySelector('i')).toBeNull();
  });

  it('renders *italic* as an <i> element', () => {
    const { getByTestId } = renderInDiv('a *it* b');
    const root = getByTestId('root');
    expect(root.textContent).toBe('a it b');
    const i = root.querySelector('i');
    expect(i).not.toBeNull();
    expect(i?.textContent).toBe('it');
    expect(root.querySelector('b')).toBeNull();
  });

  it('renders mixed bold and italic correctly', () => {
    const { getByTestId } = renderInDiv('**B** and *i*');
    const root = getByTestId('root');
    expect(root.textContent).toBe('B and i');
    const b = root.querySelector('b');
    const i = root.querySelector('i');
    expect(b).not.toBeNull();
    expect(b?.textContent).toBe('B');
    expect(i).not.toBeNull();
    expect(i?.textContent).toBe('i');
  });

  it('escapes HTML — <script> tag becomes text, no DOM element created', () => {
    const { getByTestId, container } = renderInDiv('<script>alert(1)</script>');
    const root = getByTestId('root');
    // The literal characters must appear in text content
    expect(root.textContent).toBe('<script>alert(1)</script>');
    // No actual <script> element should be in the DOM
    expect(container.querySelector('script')).toBeNull();
  });
});
