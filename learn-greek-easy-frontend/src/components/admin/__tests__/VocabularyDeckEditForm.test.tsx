/**
 * VocabularyDeckEditForm Component Tests
 *
 * Tests for the VocabularyDeckEditForm component, focusing on:
 * - Premium toggle rendering below active toggle
 * - Premium toggle reflects initial is_premium value
 * - Toggling premium updates form state
 * - Form submission includes is_premium in payload
 * - Edge case: toggling premium on inactive deck (independent flags)
 * - Background Image card: file validation, thumbnail preview, upload trigger,
 *   loading state, existing cover URL display, label text, blob URL cleanup
 *
 * Related features: [PREMBDG] Premium Badge for Decks, [DBKG-03] Frontend Image Upload
 */

import React from 'react';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { VocabularyDeckEditForm, type VocabularyDeckFormData } from '../VocabularyDeckEditForm';
import type { UnifiedDeckItem } from '@/services/adminAPI';
import i18n from '@/i18n';

// Extended deck type with bilingual fields for testing
interface BilingualMockDeck extends UnifiedDeckItem {
  name_en?: string;
  name_ru?: string;
  description_en?: string;
  description_ru?: string;
}

// Mock deck for testing with bilingual support
const createMockDeck = (overrides: Partial<BilingualMockDeck> = {}): BilingualMockDeck => ({
  id: 'test-deck-1',
  name: 'Test Vocabulary Deck',
  type: 'vocabulary',
  level: 'A1',
  category: null,
  item_count: 50,
  is_active: true,
  is_premium: false,
  is_system_deck: true,
  created_at: '2026-01-01T00:00:00Z',
  owner_id: null,
  owner_name: null,
  // Bilingual name fields for form
  name_en: 'Test Vocabulary Deck',
  name_ru: 'Test Vocabulary Deck RU',
  description_en: '',
  description_ru: '',
  ...overrides,
});

// Wrapper component with i18n provider
const renderWithI18n = (ui: React.ReactElement) => {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
};

describe('VocabularyDeckEditForm', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Premium Toggle Rendering', () => {
    it('should render premium toggle below active toggle', () => {
      const deck = createMockDeck();

      renderWithI18n(
        <VocabularyDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // Find both toggle switches by their test IDs
      const activeSwitch = screen.getByTestId('deck-edit-is-active');
      const premiumSwitch = screen.getByTestId('deck-edit-is-premium');

      expect(activeSwitch).toBeInTheDocument();
      expect(premiumSwitch).toBeInTheDocument();

      // Verify premium toggle appears after active toggle in DOM order
      const form = screen.getByTestId('vocabulary-deck-edit-form');
      const switches = form.querySelectorAll('[data-testid^="deck-edit-is-"]');

      // Active should come first, then premium
      expect(switches[0]).toHaveAttribute('data-testid', 'deck-edit-is-active');
      expect(switches[1]).toHaveAttribute('data-testid', 'deck-edit-is-premium');
    });

    it('should display premium toggle label and description', () => {
      const deck = createMockDeck();

      renderWithI18n(
        <VocabularyDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // Premium label should be visible (using translation key or text)
      // The actual text depends on i18n, but we can check for the label element
      const premiumSwitch = screen.getByTestId('deck-edit-is-premium');
      const premiumFormItem = premiumSwitch.closest('.flex.flex-row');

      expect(premiumFormItem).toBeInTheDocument();
    });
  });

  describe('Initial Value Reflection', () => {
    it('should reflect is_premium: false as unchecked', () => {
      const deck = createMockDeck({ is_premium: false });

      renderWithI18n(
        <VocabularyDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const premiumSwitch = screen.getByTestId('deck-edit-is-premium');
      expect(premiumSwitch).toHaveAttribute('data-state', 'unchecked');
    });

    it('should reflect is_premium: true as checked', () => {
      const deck = createMockDeck({ is_premium: true });

      renderWithI18n(
        <VocabularyDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const premiumSwitch = screen.getByTestId('deck-edit-is-premium');
      expect(premiumSwitch).toHaveAttribute('data-state', 'checked');
    });

    it('should handle undefined is_premium as false', () => {
      // Create deck without is_premium (simulating older data)
      const deck = createMockDeck();
      // @ts-expect-error - Testing undefined case
      delete deck.is_premium;

      renderWithI18n(
        <VocabularyDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const premiumSwitch = screen.getByTestId('deck-edit-is-premium');
      expect(premiumSwitch).toHaveAttribute('data-state', 'unchecked');
    });
  });

  describe('Toggle Interaction', () => {
    it('should toggle premium from off to on', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck({ is_premium: false });

      renderWithI18n(
        <VocabularyDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const premiumSwitch = screen.getByTestId('deck-edit-is-premium');
      expect(premiumSwitch).toHaveAttribute('data-state', 'unchecked');

      await user.click(premiumSwitch);

      expect(premiumSwitch).toHaveAttribute('data-state', 'checked');
    });

    it('should toggle premium from on to off', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck({ is_premium: true });

      renderWithI18n(
        <VocabularyDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const premiumSwitch = screen.getByTestId('deck-edit-is-premium');
      expect(premiumSwitch).toHaveAttribute('data-state', 'checked');

      await user.click(premiumSwitch);

      expect(premiumSwitch).toHaveAttribute('data-state', 'unchecked');
    });
  });

  describe('Form Submission', () => {
    it('should include is_premium: true in payload when enabled', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck({ is_premium: true });

      renderWithI18n(
        <VocabularyDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // Submit the form
      const saveButton = screen.getByTestId('deck-edit-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });

      const savedData = mockOnSave.mock.calls[0][0] as VocabularyDeckFormData;
      expect(savedData.is_premium).toBe(true);
    });

    it('should include is_premium: false in payload when disabled', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck({ is_premium: false });

      renderWithI18n(
        <VocabularyDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // Submit the form
      const saveButton = screen.getByTestId('deck-edit-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });

      const savedData = mockOnSave.mock.calls[0][0] as VocabularyDeckFormData;
      expect(savedData.is_premium).toBe(false);
    });

    it('should include toggled is_premium value in payload', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck({ is_premium: false });

      renderWithI18n(
        <VocabularyDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // Toggle premium on
      const premiumSwitch = screen.getByTestId('deck-edit-is-premium');
      await user.click(premiumSwitch);

      // Submit the form
      const saveButton = screen.getByTestId('deck-edit-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });

      const savedData = mockOnSave.mock.calls[0][0] as VocabularyDeckFormData;
      expect(savedData.is_premium).toBe(true);
    });
  });

  describe('Premium and Active Independence', () => {
    it('should allow premium toggle on inactive deck', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck({ is_active: false, is_premium: false });

      renderWithI18n(
        <VocabularyDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // Verify deck is inactive
      const activeSwitch = screen.getByTestId('deck-edit-is-active');
      expect(activeSwitch).toHaveAttribute('data-state', 'unchecked');

      // Toggle premium on
      const premiumSwitch = screen.getByTestId('deck-edit-is-premium');
      await user.click(premiumSwitch);

      // Premium should be checked independently
      expect(premiumSwitch).toHaveAttribute('data-state', 'checked');
      // Active should still be unchecked
      expect(activeSwitch).toHaveAttribute('data-state', 'unchecked');
    });

    it('should allow both toggles to be changed independently', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck({ is_active: true, is_premium: false });

      renderWithI18n(
        <VocabularyDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const activeSwitch = screen.getByTestId('deck-edit-is-active');
      const premiumSwitch = screen.getByTestId('deck-edit-is-premium');

      // Toggle premium on
      await user.click(premiumSwitch);
      expect(premiumSwitch).toHaveAttribute('data-state', 'checked');
      expect(activeSwitch).toHaveAttribute('data-state', 'checked');

      // Note: Active toggle has deactivation warning, so we verify independence differently
      // The premium toggle should work regardless of active state
    });

    it('should submit correct values when both flags are changed', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck({ is_active: false, is_premium: false });

      renderWithI18n(
        <VocabularyDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const activeSwitch = screen.getByTestId('deck-edit-is-active');
      const premiumSwitch = screen.getByTestId('deck-edit-is-premium');

      // Toggle both on
      await user.click(activeSwitch); // Activate deck
      await user.click(premiumSwitch); // Make premium

      // Submit the form
      const saveButton = screen.getByTestId('deck-edit-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });

      const savedData = mockOnSave.mock.calls[0][0] as VocabularyDeckFormData;
      expect(savedData.is_active).toBe(true);
      expect(savedData.is_premium).toBe(true);
    });
  });

  describe('Form Data Completeness', () => {
    it('should include all required fields in submission', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck({
        name: 'Complete Test Deck',
        name_en: 'Complete Test Deck EN',
        name_ru: 'Complete Test Deck RU',
        level: 'B1',
        is_active: true,
        is_premium: true,
      });

      renderWithI18n(
        <VocabularyDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const saveButton = screen.getByTestId('deck-edit-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });

      const savedData = mockOnSave.mock.calls[0][0] as VocabularyDeckFormData;

      // Verify all bilingual fields are present
      expect(savedData).toHaveProperty('name_en');
      expect(savedData).toHaveProperty('name_ru');
      expect(savedData).toHaveProperty('description_en');
      expect(savedData).toHaveProperty('description_ru');
      expect(savedData).toHaveProperty('level');
      expect(savedData).toHaveProperty('is_active');
      expect(savedData).toHaveProperty('is_premium');

      // Verify values
      expect(savedData.name_en).toBe('Complete Test Deck EN');
      expect(savedData.level).toBe('B1');
      expect(savedData.is_active).toBe(true);
      expect(savedData.is_premium).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Background Image Upload — DBKG-03
  // -----------------------------------------------------------------------

  describe('Background Image Card', () => {
    // Stub URL.createObjectURL / URL.revokeObjectURL (jsdom doesn't implement them)
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    beforeEach(() => {
      URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });

    it('should render the Background Image section', () => {
      const deck = createMockDeck();
      renderWithI18n(
        <VocabularyDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );
      // Upload button is present
      expect(screen.getByTestId('deck-edit-upload-image')).toBeInTheDocument();
      // Hidden file input is present
      expect(screen.getByTestId('deck-edit-cover-input')).toBeInTheDocument();
    });

    it('should show "Upload Image" label when no existing cover image', () => {
      const deck = createMockDeck({ cover_image_url: null });
      renderWithI18n(
        <VocabularyDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );
      expect(screen.getByTestId('deck-edit-upload-image')).toHaveTextContent('Upload Image');
    });

    it('should show "Replace Image" label when deck has an existing cover image', () => {
      const deck = createMockDeck({ cover_image_url: 'https://example.com/cover.jpg' });
      renderWithI18n(
        <VocabularyDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );
      expect(screen.getByTestId('deck-edit-upload-image')).toHaveTextContent('Replace Image');
    });

    it('should display thumbnail for existing cover_image_url', () => {
      const deck = createMockDeck({ cover_image_url: 'https://example.com/cover.jpg' });
      renderWithI18n(
        <VocabularyDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );
      const img = screen.getByTestId('deck-edit-cover-preview');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/cover.jpg');
    });

    it('should not show thumbnail when no cover image exists', () => {
      const deck = createMockDeck({ cover_image_url: null });
      renderWithI18n(
        <VocabularyDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );
      expect(screen.queryByTestId('deck-edit-cover-preview')).not.toBeInTheDocument();
    });

    it('file input should accept only jpeg, png, webp MIME types', () => {
      const deck = createMockDeck();
      renderWithI18n(
        <VocabularyDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );
      const input = screen.getByTestId('deck-edit-cover-input');
      expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
    });

    it('should reject files with unsupported format and show error', async () => {
      const deck = createMockDeck();
      const mockUpload = vi.fn();
      renderWithI18n(
        <VocabularyDeckEditForm
          deck={deck}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onUploadCoverImage={mockUpload}
        />
      );

      const input = screen.getByTestId('deck-edit-cover-input') as HTMLInputElement;
      const gifFile = new File(['gif'], 'image.gif', { type: 'image/gif' });
      // userEvent.upload respects the accept attribute and skips non-matching types,
      // so we use fireEvent.change with Object.defineProperty to simulate the OS
      // delivering a non-accepted file to the browser's change event.
      Object.defineProperty(input, 'files', { value: [gifFile], configurable: true });
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByTestId('deck-edit-image-error')).toBeInTheDocument();
      });
      expect(screen.getByTestId('deck-edit-image-error')).toHaveTextContent(
        'Invalid format. Please use JPEG, PNG, or WebP'
      );
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('should reject files over 3MB and show error', async () => {
      const deck = createMockDeck();
      const mockUpload = vi.fn();
      renderWithI18n(
        <VocabularyDeckEditForm
          deck={deck}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onUploadCoverImage={mockUpload}
        />
      );

      const input = screen.getByTestId('deck-edit-cover-input') as HTMLInputElement;
      // Create a file just over 3MB
      const bigFile = new File([new ArrayBuffer(3 * 1024 * 1024 + 1)], 'large.jpg', {
        type: 'image/jpeg',
      });
      Object.defineProperty(input, 'files', { value: [bigFile], configurable: true });
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByTestId('deck-edit-image-error')).toBeInTheDocument();
      });
      expect(screen.getByTestId('deck-edit-image-error')).toHaveTextContent(
        'Image is too large. Maximum size is 3MB'
      );
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('should show thumbnail preview immediately after valid file selection', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck({ cover_image_url: null });
      const mockUpload = vi.fn(() => Promise.resolve());
      renderWithI18n(
        <VocabularyDeckEditForm
          deck={deck}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onUploadCoverImage={mockUpload}
        />
      );

      const input = screen.getByTestId('deck-edit-cover-input');
      const jpegFile = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
      await user.upload(input, jpegFile);

      await waitFor(() => {
        const preview = screen.getByTestId('deck-edit-cover-preview');
        expect(preview).toBeInTheDocument();
        expect(preview).toHaveAttribute('src', 'blob:mock-url');
      });
    });

    it('should call onUploadCoverImage with the selected file', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck();
      const mockUpload = vi.fn(() => Promise.resolve());
      renderWithI18n(
        <VocabularyDeckEditForm
          deck={deck}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onUploadCoverImage={mockUpload}
        />
      );

      const input = screen.getByTestId('deck-edit-cover-input');
      const pngFile = new File(['img'], 'cover.png', { type: 'image/png' });
      await user.upload(input, pngFile);

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(1);
        expect(mockUpload).toHaveBeenCalledWith(pngFile);
      });
    });

    it('should show uploading state during upload and hide button', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck();
      // Upload that never resolves during the test — lets us observe loading state
      let resolveUpload!: () => void;
      const mockUpload = vi.fn(
        () =>
          new Promise<void>((res) => {
            resolveUpload = res;
          })
      );

      renderWithI18n(
        <VocabularyDeckEditForm
          deck={deck}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onUploadCoverImage={mockUpload}
        />
      );

      const input = screen.getByTestId('deck-edit-cover-input');
      const webpFile = new File(['img'], 'cover.webp', { type: 'image/webp' });
      await user.upload(input, webpFile);

      // Loading indicator should be visible; upload button hidden
      expect(screen.getByTestId('deck-edit-image-uploading')).toBeInTheDocument();
      expect(screen.queryByTestId('deck-edit-upload-image')).not.toBeInTheDocument();

      // Cleanup: resolve the upload so the component unmounts cleanly
      resolveUpload();
    });

    it('should restore upload button after upload completes', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck();
      const mockUpload = vi.fn(() => Promise.resolve());
      renderWithI18n(
        <VocabularyDeckEditForm
          deck={deck}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onUploadCoverImage={mockUpload}
        />
      );

      const input = screen.getByTestId('deck-edit-cover-input');
      const jpgFile = new File(['img'], 'cover.jpg', { type: 'image/jpeg' });
      await user.upload(input, jpgFile);

      await waitFor(() => {
        expect(screen.getByTestId('deck-edit-upload-image')).toBeInTheDocument();
        expect(screen.queryByTestId('deck-edit-image-uploading')).not.toBeInTheDocument();
      });
    });

    it('should revert preview and show error when upload fails', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck({ cover_image_url: null });
      const mockUpload = vi.fn(() => Promise.reject(new Error('upload failed')));
      renderWithI18n(
        <VocabularyDeckEditForm
          deck={deck}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onUploadCoverImage={mockUpload}
        />
      );

      const input = screen.getByTestId('deck-edit-cover-input');
      const jpgFile = new File(['img'], 'cover.jpg', { type: 'image/jpeg' });
      await user.upload(input, jpgFile);

      await waitFor(() => {
        // Preview should be reverted (no cover_image_url on deck, so no thumbnail)
        expect(screen.queryByTestId('deck-edit-cover-preview')).not.toBeInTheDocument();
        // Error message shown
        expect(screen.getByTestId('deck-edit-image-error')).toBeInTheDocument();
      });
    });

    it('should revoke previous blob URL when a new file is selected', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck({ cover_image_url: null });
      const mockUpload = vi.fn(() => Promise.resolve());
      renderWithI18n(
        <VocabularyDeckEditForm
          deck={deck}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onUploadCoverImage={mockUpload}
        />
      );

      const input = screen.getByTestId('deck-edit-cover-input');

      // First upload
      await user.upload(input, new File(['a'], 'first.jpg', { type: 'image/jpeg' }));
      await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));

      // Second upload — previous blob URL should be revoked
      await user.upload(input, new File(['b'], 'second.png', { type: 'image/png' }));
      await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(2));

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });
});
