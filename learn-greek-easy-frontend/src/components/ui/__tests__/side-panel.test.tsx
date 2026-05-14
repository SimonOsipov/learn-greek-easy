import React from 'react';

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { SidePanel } from '../side-panel';

describe('SidePanel', () => {
  it('renders children when open=true', () => {
    render(
      <SidePanel open={true} onOpenChange={() => {}}>
        <SidePanel.Header>head</SidePanel.Header>
        <SidePanel.Body>body content</SidePanel.Body>
      </SidePanel>
    );
    expect(screen.getByText('head')).toBeInTheDocument();
    expect(screen.getByText('body content')).toBeInTheDocument();
  });

  it('does not render children when open=false', () => {
    render(
      <SidePanel open={false} onOpenChange={() => {}}>
        <SidePanel.Body>hidden content</SidePanel.Body>
      </SidePanel>
    );
    expect(screen.queryByText('hidden content')).not.toBeInTheDocument();
  });

  it('fires onOpenChange(false) on Escape', () => {
    const onOpenChange = vi.fn();
    render(
      <SidePanel open={true} onOpenChange={onOpenChange}>
        <SidePanel.Body>x</SidePanel.Body>
      </SidePanel>
    );
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('subcomponents render with their drawer-* classes', () => {
    render(
      <SidePanel open={true} onOpenChange={() => {}}>
        <SidePanel.Header>h</SidePanel.Header>
        <SidePanel.Tabs>t</SidePanel.Tabs>
        <SidePanel.Body>b</SidePanel.Body>
        <SidePanel.Footer>f</SidePanel.Footer>
      </SidePanel>
    );
    // Radix renders in a Portal, so query document.body not container.
    expect(document.body.querySelector('.drawer-head')).not.toBeNull();
    expect(document.body.querySelector('.drawer-tabs')).not.toBeNull();
    expect(document.body.querySelector('.drawer-body')).not.toBeNull();
    expect(document.body.querySelector('.drawer-foot')).not.toBeNull();
  });
});
