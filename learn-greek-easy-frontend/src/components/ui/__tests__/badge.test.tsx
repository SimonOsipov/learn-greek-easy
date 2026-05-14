/**
 * Badge Component Tests
 * Covers: tone prop (7 values), onPhoto composition, orthogonality, variant regression, className passthrough.
 */

import { describe, it, expect } from 'vitest';

import { Badge, type BadgeTone } from '@/components/ui/badge';
import { render, screen } from '@/lib/test-utils';

const ALL_TONES: BadgeTone[] = ['blue', 'violet', 'amber', 'green', 'red', 'cyan', 'gray'];

describe('Badge — tone prop', () => {
  it.each(ALL_TONES)('tone="%s" renders badge and b-%s classes', (tone) => {
    render(<Badge tone={tone}>Label</Badge>);
    const el = screen.getByText('Label');
    expect(el.className).toContain('badge');
    expect(el.className).toContain(`b-${tone}`);
  });

  it('tone="cyan" produces exact badge b-cyan combination', () => {
    render(<Badge tone="cyan">Cyan</Badge>);
    const el = screen.getByText('Cyan');
    expect(el.className).toContain('badge');
    expect(el.className).toContain('b-cyan');
  });

  it('when tone is set, no shadcn variant class is applied', () => {
    render(<Badge tone="blue">Blue</Badge>);
    const el = screen.getByText('Blue');
    expect(el.className).not.toContain('bg-primary');
    expect(el.className).not.toContain('bg-secondary');
    expect(el.className).not.toContain('bg-destructive');
  });
});

describe('Badge — onPhoto composition', () => {
  it('tone + onPhoto=true → class includes badge, b-{tone}, and on-photo', () => {
    render(
      <Badge tone="blue" onPhoto>
        With Photo
      </Badge>
    );
    const el = screen.getByText('With Photo');
    expect(el.className).toContain('badge');
    expect(el.className).toContain('b-blue');
    expect(el.className).toContain('on-photo');
  });

  it('tone + onPhoto=false → class does NOT include on-photo', () => {
    render(
      <Badge tone="blue" onPhoto={false}>
        No Photo
      </Badge>
    );
    const el = screen.getByText('No Photo');
    expect(el.className).not.toContain('on-photo');
  });

  it('tone omitted + onPhoto=true → on-photo is NOT added (orthogonality)', () => {
    render(<Badge onPhoto>Orthogonal</Badge>);
    const el = screen.getByText('Orthogonal');
    expect(el.className).not.toContain('on-photo');
    // falls through to shadcn variant branch — should have primary class
    expect(el.className).toContain('bg-primary');
  });
});

describe('Badge — variant regression (no tone)', () => {
  it.each([
    ['default', 'bg-primary'],
    ['secondary', 'bg-secondary'],
    ['destructive', 'bg-destructive'],
    ['outline', 'text-foreground'],
  ] as const)('variant="%s" still renders its shadcn signature class', (variant, expectedClass) => {
    render(<Badge variant={variant}>Variant</Badge>);
    const el = screen.getByText('Variant');
    expect(el.className).toContain(expectedClass);
  });

  it('no props → renders as default variant (bg-primary)', () => {
    render(<Badge>Default</Badge>);
    const el = screen.getByText('Default');
    expect(el.className).toContain('bg-primary');
  });
});

describe('Badge — className passthrough', () => {
  it('with tone + custom className → both b-{tone} and custom class appear', () => {
    render(
      <Badge tone="green" className="custom-class">
        Tone+Class
      </Badge>
    );
    const el = screen.getByText('Tone+Class');
    expect(el.className).toContain('b-green');
    expect(el.className).toContain('custom-class');
  });

  it('without tone + custom className → cva class and custom class both appear', () => {
    render(
      <Badge variant="secondary" className="custom-class">
        Var+Class
      </Badge>
    );
    const el = screen.getByText('Var+Class');
    expect(el.className).toContain('bg-secondary');
    expect(el.className).toContain('custom-class');
  });
});
