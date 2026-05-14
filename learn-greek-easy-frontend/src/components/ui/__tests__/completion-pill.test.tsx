import * as React from 'react';
import { describe, it, expect } from 'vitest';

import { CompletionPill } from '@/components/ui/completion-pill';
import { render } from '@/lib/test-utils';

describe('CompletionPill', () => {
  it('done=true renders dk-pill is-done (not is-todo)', () => {
    const { container } = render(<CompletionPill label="EN" value="2/2" done />);
    const span = container.firstChild as HTMLElement;
    expect(span).toHaveClass('dk-pill');
    expect(span).toHaveClass('is-done');
    expect(span).not.toHaveClass('is-todo');
  });

  it('done=false renders dk-pill is-todo (not is-done)', () => {
    const { container } = render(<CompletionPill label="Pron" done={false} />);
    const span = container.firstChild as HTMLElement;
    expect(span).toHaveClass('dk-pill');
    expect(span).toHaveClass('is-todo');
    expect(span).not.toHaveClass('is-done');
  });

  it('value omitted renders only the label with no trailing space', () => {
    const { container } = render(<CompletionPill label="Audio" done={false} />);
    expect(container.firstChild).toHaveTextContent('Audio');
    expect((container.firstChild as HTMLElement).textContent).toBe('Audio');
  });

  it('value="2/2" renders label + space + value', () => {
    const { container } = render(<CompletionPill label="EN" value="2/2" done />);
    expect((container.firstChild as HTMLElement).textContent).toBe('EN 2/2');
  });

  it('forwardRef attaches ref to the span element', () => {
    const ref = React.createRef<HTMLSpanElement>();
    render(<CompletionPill label="Dialog" done={false} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  it('extra className merges with dk-pill base class', () => {
    const { container } = render(<CompletionPill label="EN" done={false} className="extra" />);
    const span = container.firstChild as HTMLElement;
    expect(span).toHaveClass('dk-pill');
    expect(span).toHaveClass('extra');
  });
});
