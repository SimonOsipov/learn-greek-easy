import { describe, it, expect } from 'vitest';
import { createRef } from 'react';

import { AdminAvatar } from '@/components/ui/admin-avatar';
import { render } from '@/lib/test-utils';

describe('AdminAvatar', () => {
  it('renders with default tone when tone is omitted', () => {
    const { container } = render(<AdminAvatar initials="SO" />);
    const span = container.firstChild as HTMLElement;
    expect(span.className).toBe('avatar avatar-default');
    expect(span.textContent).toBe('SO');
  });

  it.each(['primary', 'blue', 'green'] as const)(
    'renders class "avatar avatar-%s" for tone="%s"',
    (tone) => {
      const { container } = render(<AdminAvatar initials="SO" tone={tone} />);
      const span = container.firstChild as HTMLElement;
      expect(span.className).toBe(`avatar avatar-${tone}`);
    }
  );

  it('renders class containing avatar-sm when size="sm"', () => {
    const { container } = render(<AdminAvatar initials="SO" size="sm" />);
    const span = container.firstChild as HTMLElement;
    expect(span).toHaveClass('avatar');
    expect(span).toHaveClass('avatar-default');
    expect(span).toHaveClass('avatar-sm');
  });

  it('renders initials verbatim without JS uppercase', () => {
    const { container } = render(<AdminAvatar initials="so" />);
    const span = container.firstChild as HTMLElement;
    expect(span.textContent).toBe('so');
  });

  it('forwards ref to the underlying span element', () => {
    const ref = createRef<HTMLSpanElement>();
    render(<AdminAvatar initials="SO" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  it('merges consumer className without clobbering design-system classes', () => {
    const { container } = render(<AdminAvatar initials="SO" className="ml-2" />);
    const span = container.firstChild as HTMLElement;
    expect(span).toHaveClass('avatar');
    expect(span).toHaveClass('avatar-default');
    expect(span).toHaveClass('ml-2');
  });
});
