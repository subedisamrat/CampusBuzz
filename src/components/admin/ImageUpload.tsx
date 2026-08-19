'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, Link, X, Image as ImageIcon } from 'lucide-react';
import { IMAGE_CONFIG } from '@/lib/constants';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
}

export default function ImageUpload({ value, onChange }: ImageUploadProps) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState(value.startsWith('data:') ? '' : value);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setError('');

    if (!IMAGE_CONFIG.ACCEPTED_TYPES.includes(file.type as any)) {
      setError('Only JPG, PNG, WebP, and GIF are accepted');
      return;
    }

    if (file.size > IMAGE_CONFIG.MAX_SIZE_MB * 1024 * 1024) {
      setError(`Image must be smaller than ${IMAGE_CONFIG.MAX_SIZE_MB}MB`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      onChange(result);
    };
    reader.readAsDataURL(file);
  }, [onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setError('');
    }
  };

  const clearImage = () => {
    onChange('');
    setUrlInput('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                      font-medium transition-colors ${
            mode === 'upload'
              ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
              : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
          }`}
        >
          <Upload size={12} />
          Upload from device
        </button>
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                      font-medium transition-colors ${
            mode === 'url'
              ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
              : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
          }`}
        >
          <Link size={12} />
          Paste URL
        </button>
      </div>

      {value && (
        <div className="relative w-full h-40 rounded-xl overflow-hidden
                        border border-white/10 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Event"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = IMAGE_CONFIG.PLACEHOLDER;
            }}
          />
          <button
            type="button"
            onClick={clearImage}
            className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full
                       flex items-center justify-center opacity-0 group-hover:opacity-100
                       transition-opacity hover:bg-red-500/80"
          >
            <X size={14} className="text-white" />
          </button>
        </div>
      )}

      {mode === 'upload' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`w-full h-32 rounded-xl border-2 border-dashed
                      flex flex-col items-center justify-center gap-2
                      cursor-pointer transition-colors ${
            dragOver
              ? 'border-teal-400 bg-teal-500/10'
              : 'border-white/20 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]'
          }`}
        >
          <ImageIcon size={24} className="text-gray-500" />
          <div className="text-center">
            <p className="text-sm text-gray-400">
              {dragOver ? 'Drop image here' : 'Drag & drop or click to upload'}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              JPG, PNG, WebP, GIF up to {IMAGE_CONFIG.MAX_SIZE_MB}MB
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={IMAGE_CONFIG.ACCEPTED_TYPES.join(',')}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}

      {mode === 'url' && (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl
                       text-white text-sm placeholder-gray-600 focus:outline-none
                       focus:border-teal-500/50 transition-colors"
          />
          <button
            type="button"
            onClick={handleUrlSubmit}
            className="px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-white
                       text-sm font-medium rounded-xl transition-colors"
          >
            Set
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
