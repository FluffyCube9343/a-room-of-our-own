import { useEffect, useState } from 'react';
import { ErrorNotice } from './ui';

export function ImagePicker({
  existing,
  onChange,
  label = 'Photo',
}: {
  existing?: string | null;
  onChange: (file: File | null) => void;
  label?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="image-picker">
      <label>
        {label}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const selected = event.target.files?.[0] || null;
            const invalid =
              selected &&
              (selected.size > 5 * 1024 * 1024 ||
                !['image/jpeg', 'image/png', 'image/webp'].includes(selected.type));
            const message = invalid ? 'Choose a JPEG, PNG, or WebP photo under 5 MB.' : '';
            event.target.setCustomValidity(message);
            setError(message ? new Error(message) : null);
            setFile(invalid ? null : selected);
            onChange(invalid ? null : selected);
          }}
        />
      </label>
      {(preview || existing) && (
        <img
          className="image-picker-preview"
          src={preview || existing!}
          alt="Selected photo preview"
        />
      )}
      <ErrorNotice error={error} />
    </div>
  );
}
