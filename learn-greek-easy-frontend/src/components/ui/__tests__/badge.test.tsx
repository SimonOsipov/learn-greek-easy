import React from 'react';

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { Badge } from '../badge';

describe('Badge', () => {
  it('renders with default variant when no tone is set', () => {
    const { container } = render(<Badge>default</Badge>);
    // shadcn variant path uses rounded-full + bg-primary classes
    expect(container.firstChild).toHaveClass('bg-primary');
  });

  it.each([
    ['blue', 'b-blue'],
    ['violet', 'b-violet'],
    ['amber', 'b-amber'],
    ['green', 'b-green'],
    ['red', 'b-red'],
    ['cyan', 'b-cyan'],
    ['gray', 'b-gray'],
  ] as const)('renders tone=%s with class %s', (tone, cls) => {
    const { container } = render(<Badge tone={tone}>x</Badge>);
    expect(container.firstChild).toHaveClass('badge');
    expect(container.firstChild).toHaveClass(cls);
    // variant-driven shadcn classes should NOT be applied when tone is set
    expect(container.firstChild).not.toHaveClass('bg-primary');
  });

  it('composes tone with onPhoto', () => {
    const { container } = render(
      <Badge tone="blue" onPhoto>
        x
      </Badge>
    );
    expect(container.firstChild).toHaveClass('b-blue');
    expect(container.firstChild).toHaveClass('on-photo');
  });

  it('ignores variant when tone is set', () => {
    const { container } = render(
      <Badge variant="destructive" tone="green">
        x
      </Badge>
    );
    expect(container.firstChild).toHaveClass('b-green');
    expect(container.firstChild).not.toHaveClass('bg-destructive');
  });
});
