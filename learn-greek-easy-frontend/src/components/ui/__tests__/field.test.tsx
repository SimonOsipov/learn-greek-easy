import { describe, it, expect } from 'vitest';

import { Field, type FieldProps } from '@/components/ui/field';
import { render, screen } from '@/lib/test-utils';

// Satisfy TypeScript — verify the exported type is usable
const _typeCheck: FieldProps = {
  label: 'Test',
  children: <input />,
};
void _typeCheck;

describe('Field — without hint', () => {
  it('renders dr-field root, dr-field-l label, no dr-field-h, and child', () => {
    const { container } = render(
      <Field label="Name">
        <input data-testid="i" />
      </Field>
    );

    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('dr-field');

    const labelEl = root.querySelector('.dr-field-l');
    expect(labelEl).not.toBeNull();
    expect(labelEl!.textContent).toBe('Name');

    expect(root.querySelector('.dr-field-h')).toBeNull();

    expect(screen.getByTestId('i')).toBeInTheDocument();
  });
});

describe('Field — with hint', () => {
  it('renders dr-field-h between label and children in DOM order', () => {
    const { container } = render(
      <Field label="Email" hint="we never share this">
        <input data-testid="i" />
      </Field>
    );

    const root = container.firstChild as HTMLElement;
    const hintEl = root.querySelector('.dr-field-h');
    expect(hintEl).not.toBeNull();
    expect(hintEl!.textContent).toBe('we never share this');

    // DOM order: dr-field-l → dr-field-h → input
    const children = Array.from(root.children);
    const labelIdx = children.findIndex((el) => el.classList.contains('dr-field-l'));
    const hintIdx = children.findIndex((el) => el.classList.contains('dr-field-h'));
    const inputIdx = children.findIndex((el) => el.tagName === 'INPUT');
    expect(labelIdx).toBeLessThan(hintIdx);
    expect(hintIdx).toBeLessThan(inputIdx);
  });
});

describe('Field — child passthrough', () => {
  it('renders consumer select element verbatim inside dr-field', () => {
    const { container } = render(
      <Field label="Role">
        <select data-testid="s">
          <option>a</option>
        </select>
      </Field>
    );

    const root = container.firstChild as HTMLElement;
    const selectEl = root.querySelector('select');
    expect(selectEl).not.toBeNull();
    expect(selectEl!.tagName).toBe('SELECT');
    expect(selectEl!.querySelector('option')).not.toBeNull();
  });
});

describe('Field — ReactNode label', () => {
  it('renders JSX element inside dr-field-l', () => {
    render(
      <Field label={<span data-testid="lbl">Bold</span>}>
        <input />
      </Field>
    );

    const labelNode = screen.getByTestId('lbl');
    expect(labelNode).toBeInTheDocument();
    expect(labelNode.closest('.dr-field-l')).not.toBeNull();
  });
});

describe('Field — htmlFor prop', () => {
  it('renders a <label> element with matching for attribute when htmlFor is provided', () => {
    render(
      <Field label="Password" htmlFor="pw-input">
        <input id="pw-input" />
      </Field>
    );

    const labelEl = document.querySelector('label.dr-field-l');
    expect(labelEl).not.toBeNull();
    expect(labelEl!.getAttribute('for')).toBe('pw-input');
  });

  it('getByLabelText resolves the child input when htmlFor matches input id', () => {
    render(
      <Field label="Username" htmlFor="user-input">
        <input id="user-input" />
      </Field>
    );

    expect(screen.getByLabelText('Username')).toBeInTheDocument();
  });

  it('renders a <div> (not a <label>) when htmlFor is omitted', () => {
    const { container } = render(
      <Field label="No link">
        <input />
      </Field>
    );

    expect(container.querySelector('label')).toBeNull();
    expect(container.querySelector('div.dr-field-l')).not.toBeNull();
  });
});
