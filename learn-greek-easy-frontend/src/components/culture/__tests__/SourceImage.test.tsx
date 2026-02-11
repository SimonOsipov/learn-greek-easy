import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SourceImage } from '../SourceImage';

describe('SourceImage', () => {
  const defaultProps = {
    imageUrl: 'https://example.com/image.jpg',
  };

  describe('Rendering', () => {
    it('renders image with correct src, height class, object-cover, and loading="lazy"', () => {
      render(<SourceImage {...defaultProps} />);

      const image = screen.getByTestId('source-image');
      expect(image).toHaveAttribute('src', 'https://example.com/image.jpg');
      expect(image).toHaveAttribute('loading', 'lazy');
      expect(image.className).toContain('h-[140px]');
      expect(image.className).toContain('object-cover');
      expect(image.className).toContain('w-full');
    });

    it('returns null when imageUrl is empty string', () => {
      const { container } = render(<SourceImage imageUrl="" />);

      expect(container.innerHTML).toBe('');
    });

    it('renders as <a> with correct attributes when sourceUrl provided', () => {
      render(<SourceImage {...defaultProps} sourceUrl="https://example.com/article" />);

      const container = screen.getByTestId('source-image-container');
      expect(container.tagName).toBe('A');
      expect(container).toHaveAttribute('href', 'https://example.com/article');
      expect(container).toHaveAttribute('target', '_blank');
      expect(container).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders as <div> when no sourceUrl', () => {
      render(<SourceImage {...defaultProps} />);

      const container = screen.getByTestId('source-image-container');
      expect(container.tagName).toBe('DIV');
    });

    it('has rounded-[14px], overflow-hidden, and border classes on container', () => {
      render(<SourceImage {...defaultProps} />);

      const container = screen.getByTestId('source-image-container');
      expect(container.className).toContain('rounded-[14px]');
      expect(container.className).toContain('overflow-hidden');
      expect(container).toHaveClass('border');
      expect(container).toHaveClass('border-slate-200');
    });

    it('applies custom className to container', () => {
      render(<SourceImage {...defaultProps} className="mt-4" />);

      const container = screen.getByTestId('source-image-container');
      expect(container.className).toContain('mt-4');
    });
  });

  describe('Badge logic', () => {
    it('shows badge with title text when both title and sourceUrl provided', () => {
      render(
        <SourceImage
          {...defaultProps}
          title="Greek History"
          sourceUrl="https://example.com/article"
        />
      );

      const badge = screen.getByTestId('source-image-badge');
      expect(badge).toHaveTextContent('Greek History');
    });

    it('shows badge with "Read source article" when only sourceUrl provided', () => {
      render(<SourceImage {...defaultProps} sourceUrl="https://example.com/article" />);

      const badge = screen.getByTestId('source-image-badge');
      expect(badge).toHaveTextContent('Read source article');
    });

    it('does not show badge when no sourceUrl', () => {
      render(<SourceImage {...defaultProps} title="Greek History" />);

      expect(screen.queryByTestId('source-image-badge')).not.toBeInTheDocument();
    });

    it('badge contains ExternalLink icon', () => {
      render(<SourceImage {...defaultProps} sourceUrl="https://example.com/article" />);

      const badge = screen.getByTestId('source-image-badge');
      const icon = badge.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('hides component on image error event', () => {
      render(<SourceImage {...defaultProps} />);

      const image = screen.getByTestId('source-image');
      fireEvent.error(image);

      expect(screen.queryByTestId('source-image-container')).not.toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onSourceClick when the link is clicked', () => {
      const handleClick = vi.fn();
      render(
        <SourceImage
          {...defaultProps}
          sourceUrl="https://example.com/article"
          onSourceClick={handleClick}
        />
      );

      const container = screen.getByTestId('source-image-container');
      fireEvent.click(container);

      expect(handleClick).toHaveBeenCalledOnce();
    });
  });

  describe('Styling', () => {
    it('container is full width', () => {
      render(<SourceImage {...defaultProps} />);

      const container = screen.getByTestId('source-image-container');
      expect(container).toHaveClass('w-full');
    });

    it('gradient overlay has correct inline style', () => {
      render(<SourceImage {...defaultProps} />);

      const gradient = screen.getByTestId('source-image-gradient');
      expect(gradient).toHaveStyle({
        background:
          'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)',
      });
    });
  });
});
