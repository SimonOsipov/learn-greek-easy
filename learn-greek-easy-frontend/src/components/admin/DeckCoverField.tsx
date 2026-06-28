// src/components/admin/DeckCoverField.tsx

import React, { useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB

interface DeckCoverFieldProps {
  file: File | null;
  onChange: (file: File | null) => void;
}

/**
 * Presentational cover-image field for create-deck modal.
 *
 * Validates file type + size, renders a blob preview URL, and calls
 * onChange(file) on selection or onChange(null) on remove.
 * Does NOT call any API — the parent (AdminPage.handleCreateDeck) uploads
 * the File after the deck is created (create-then-upload pattern).
 *
 * Blob URLs are revoked on replace / remove / unmount to prevent memory leaks.
 */
export const DeckCoverField: React.FC<DeckCoverFieldProps> = ({ file, onChange }) => {
  const { t } = useTranslation('admin');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Create / revoke blob URL whenever the file prop changes
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    // Reset input so the same file can be re-selected
    e.target.value = '';
    if (!selected) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(selected.type)) {
      setError(t('deckEdit.imageFormatError'));
      return;
    }
    if (selected.size > MAX_IMAGE_SIZE_BYTES) {
      setError(t('deckEdit.imageSizeError'));
      return;
    }

    setError(null);
    onChange(selected);
  };

  const handleRemove = () => {
    setError(null);
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className="cd-cover">
      {previewUrl && (
        <img
          src={previewUrl}
          alt=""
          className="cd-cover-preview"
          data-testid="deck-create-cover-preview"
        />
      )}

      <div className="cd-cover-actions">
        <button
          type="button"
          className="aw-btn aw-btn-outline"
          data-testid="deck-create-cover-upload"
          onClick={() => inputRef.current?.click()}
        >
          {file ? t('deckEdit.replaceImage') : t('deckEdit.uploadImage')}
        </button>

        {file && (
          <button
            type="button"
            className="aw-btn aw-btn-outline"
            data-testid="deck-create-cover-remove"
            onClick={handleRemove}
          >
            {t('deckEdit.removeImage')}
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        className="sr-only"
        data-testid="deck-create-cover-input"
        onChange={handleFileSelect}
      />

      {error && <p className="cd-cover-err">{error}</p>}
    </div>
  );
};
