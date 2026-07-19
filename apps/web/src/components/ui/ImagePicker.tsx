import { ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../app/providers/i18n';

export default function ImagePicker({
  label,
  currentUrl,
  maxSizeMb,
  onFile,
  onRemove,
}: {
  label: string;
  currentUrl?: string | null;
  maxSizeMb: number;
  onFile: (file: File | null) => void;
  onRemove?: () => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);

  useEffect(() => setPreview(currentUrl ?? null), [currentUrl]);

  const choose = (file?: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview((previous) => {
      if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
      return url;
    });
    onFile(file);
  };

  useEffect(
    () => () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  return (
    <div className="space-y-2">
      <span className="label">{label}</span>
      <div className="flex items-center gap-3 rounded-lg border border-border p-3">
        <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          {preview ? (
            <img className="h-full w-full object-cover" src={preview} alt="" />
          ) : (
            <ImagePlus size={22} className="text-slate-400" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500">
            {t('media.formats')} · max {maxSizeMb} MiB
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-soft h-8 text-xs"
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus size={13} />{' '}
              {preview ? t('media.replace') : t('media.choose')}
            </button>
            {preview && (
              <button
                type="button"
                className="btn btn-soft h-8 text-xs text-red-600"
                onClick={() => {
                  setPreview(null);
                  onFile(null);
                  onRemove?.();
                  if (inputRef.current) inputRef.current.value = '';
                }}
              >
                <Trash2 size={13} /> {t('media.remove')}
              </button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => choose(event.target.files?.[0])}
      />
    </div>
  );
}
