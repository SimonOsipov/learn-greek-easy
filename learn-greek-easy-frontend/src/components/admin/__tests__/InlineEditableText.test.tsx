/**
 * InlineEditableText Component Tests
 *
 * Tests for the InlineEditableText component covering:
 * - Default display mode (span with text)
 * - Pencil icon hover behavior
 * - Click to activate edit mode (input)
 * - Enter key commits value
 * - Escape key reverts value
 * - Blur commits value
 */

import React from 'react';

import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InlineEditableText } from '../InlineEditableText';

const renderComponent = (props: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  'data-testid'?: string;
}) => {
  const onChange = props.onChange ?? vi.fn();
  return {
    ...render(
      <InlineEditableText
        value={props.value}
        onChange={onChange}
        placeholder={props.placeholder}
        data-testid={props['data-testid']}
      />
    ),
    onChange,
  };
};

describe('InlineEditableText', () => {
  // 1. Renders text value when not editing
  it('renders text value in a span when not editing', () => {
    renderComponent({ value: 'Hello world', 'data-testid': 'test-inline' });

    const el = screen.getByTestId('test-inline');
    expect(el.tagName).not.toBe('INPUT');
    expect(el).toHaveTextContent('Hello world');
  });

  // 2. Shows placeholder when value is empty
  it('shows placeholder text when value is empty', () => {
    renderComponent({ value: '', placeholder: 'Enter text', 'data-testid': 'test-inline' });

    expect(screen.getByText('Enter text')).toBeInTheDocument();
  });

  // 3. Pencil icon present in the DOM (hidden via opacity class)
  it('renders pencil icon with opacity-0 class for hover reveal', () => {
    renderComponent({ value: 'Some text', 'data-testid': 'test-inline' });

    // The SVG for Pencil icon should be present
    const container = screen.getByTestId('test-inline');
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.className).toContain('opacity-0');
  });

  // 4. Clicking text activates input mode with current value
  it('activates input mode with current value on click', async () => {
    const user = userEvent.setup();
    renderComponent({ value: 'Η γάτα κοιμάται.', 'data-testid': 'test-inline' });

    await user.click(screen.getByTestId('test-inline'));

    await waitFor(() => {
      const input = screen.getByTestId('test-inline');
      expect(input.tagName).toBe('INPUT');
      expect(input).toHaveValue('Η γάτα κοιμάται.');
    });
  });

  // 5. Pressing Enter commits value and exits edit mode
  it('commits value and exits edit mode on Enter', async () => {
    const user = userEvent.setup();
    const { onChange } = renderComponent({ value: 'original', 'data-testid': 'test-inline' });

    await user.click(screen.getByTestId('test-inline'));

    await waitFor(() => {
      expect(screen.getByTestId('test-inline').tagName).toBe('INPUT');
    });

    await user.clear(screen.getByTestId('test-inline'));
    await user.type(screen.getByTestId('test-inline'), 'updated');
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith('updated');
    await waitFor(() => {
      expect(screen.getByTestId('test-inline').tagName).not.toBe('INPUT');
    });
  });

  // 6. Pressing Escape reverts value and exits edit mode
  it('reverts to original value and exits edit mode on Escape', async () => {
    const user = userEvent.setup();
    const { onChange } = renderComponent({ value: 'original', 'data-testid': 'test-inline' });

    await user.click(screen.getByTestId('test-inline'));

    await waitFor(() => {
      expect(screen.getByTestId('test-inline').tagName).toBe('INPUT');
    });

    await user.clear(screen.getByTestId('test-inline'));
    await user.type(screen.getByTestId('test-inline'), 'changed');
    await user.keyboard('{Escape}');

    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId('test-inline').tagName).not.toBe('INPUT');
    });
  });

  // 7. Blur commits value and exits edit mode
  it('commits value and exits edit mode on blur', async () => {
    const user = userEvent.setup();
    const { onChange } = renderComponent({ value: 'original', 'data-testid': 'test-inline' });

    await user.click(screen.getByTestId('test-inline'));

    await waitFor(() => {
      expect(screen.getByTestId('test-inline').tagName).toBe('INPUT');
    });

    await user.clear(screen.getByTestId('test-inline'));
    await user.type(screen.getByTestId('test-inline'), 'blurred value');
    await user.tab(); // triggers blur

    expect(onChange).toHaveBeenCalledWith('blurred value');
    await waitFor(() => {
      expect(screen.getByTestId('test-inline').tagName).not.toBe('INPUT');
    });
  });
});
