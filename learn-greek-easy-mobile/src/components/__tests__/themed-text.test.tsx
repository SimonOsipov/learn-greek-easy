/// <reference types="jest" />
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { ThemedText } from '@/components/themed-text';

describe('ThemedText', () => {
  it('renders children text', () => {
    render(<ThemedText>Hello</ThemedText>);
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('renders title variant without throwing', () => {
    render(<ThemedText type="title">Title</ThemedText>);
    expect(screen.getByText('Title')).toBeTruthy();
  });

  it('renders small variant without throwing', () => {
    render(<ThemedText type="small">Small text</ThemedText>);
    expect(screen.getByText('Small text')).toBeTruthy();
  });

  it('renders smallBold variant without throwing', () => {
    render(<ThemedText type="smallBold">Bold small</ThemedText>);
    expect(screen.getByText('Bold small')).toBeTruthy();
  });

  it('renders subtitle variant without throwing', () => {
    render(<ThemedText type="subtitle">Subtitle</ThemedText>);
    expect(screen.getByText('Subtitle')).toBeTruthy();
  });

  it('renders link variant without throwing', () => {
    render(<ThemedText type="link">A link</ThemedText>);
    expect(screen.getByText('A link')).toBeTruthy();
  });

  it('renders code variant without throwing', () => {
    render(<ThemedText type="code">code snippet</ThemedText>);
    expect(screen.getByText('code snippet')).toBeTruthy();
  });
});
