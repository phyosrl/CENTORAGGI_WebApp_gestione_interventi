import React, { memo, useRef } from 'react';
import { Card, CardBody, Button } from '@heroui/react';
import { Image as ImageIcon, Camera, Upload, X } from 'lucide-react';
import type { Annotation } from '../../services/api';

export interface LocalPreview {
  file: File;
  preview: string;
}

export interface ImagesSectionProps {
  isCreate: boolean;
  images: Annotation[] | undefined;
  localPreviews: LocalPreview[];
  uploading: boolean;
  onFileSelect: (files: FileList | null) => void;
  onRemoveLocal: (index: number) => void;
  onUploadAll: () => void;
  onDeleteRemote: (annotationId: string) => void;
}

function openImageInNewWindow(mimetype: string, body: string, filename: string) {
  const w = window.open();
  if (!w) return;
  w.document.write(
    `<img src="data:${mimetype};base64,${body}" style="max-width:100%;max-height:100vh;margin:auto;display:block" />`
  );
  w.document.title = filename;
}

const AssistenzaImagesSectionImpl: React.FC<ImagesSectionProps> = ({
  isCreate,
  images,
  localPreviews,
  uploading,
  onFileSelect,
  onRemoveLocal,
  onUploadAll,
  onDeleteRemote,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isEmpty = (!images || images.length === 0) && localPreviews.length === 0;

  return (
    <Card shadow="sm" className="bg-[#E7ECEF]">
      <CardBody className="gap-2.5 p-3">
        {/* Upload buttons */}
        <div className="flex gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { onFileSelect(e.target.files); e.target.value = ''; }}
          />
          <Button
            color="primary"
            variant="flat"
            onPress={() => fileInputRef.current?.click()}
            startContent={<ImageIcon className="w-5 h-5" />}
          >
            Scegli immagini
          </Button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => { onFileSelect(e.target.files); e.target.value = ''; }}
          />
          <Button
            color="secondary"
            variant="flat"
            onPress={() => cameraInputRef.current?.click()}
            startContent={<Camera className="w-5 h-5" />}
          >
            Scatta foto
          </Button>
          {localPreviews.length > 0 && !isCreate && (
            <Button
              color="primary"
              isLoading={uploading}
              onPress={onUploadAll}
              startContent={!uploading ? <Upload className="w-5 h-5" /> : undefined}
            >
              Carica {localPreviews.length} immagin{localPreviews.length === 1 ? 'e' : 'i'}
            </Button>
          )}
        </div>

        {/* Local previews (not yet uploaded) */}
        {localPreviews.length > 0 && (
          <div>
            <p className="text-xs text-default-400 mb-2">
              Da caricare{isCreate ? ' (verranno caricate al salvataggio)' : ''}
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {localPreviews.map((p, i) => (
                <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-centoraggi-accent/20">
                  <img src={p.preview} alt={p.file.name} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => onRemoveLocal(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    aria-label="Rimuovi immagine"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Uploaded images from Dataverse (only in edit mode) */}
        {!isCreate && images && images.length > 0 && (
          <div>
            <p className="text-xs text-default-400 mb-2">Caricate ({images.length})</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {images.map((img) => (
                <div key={img.annotationid} className="relative group aspect-square rounded-lg overflow-hidden border border-centoraggi-accent/20">
                  <img
                    src={`data:${img.mimetype};base64,${img.documentbody}`}
                    alt={img.filename}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => openImageInNewWindow(img.mimetype, img.documentbody, img.filename)}
                  />
                  <button
                    type="button"
                    onClick={() => onDeleteRemote(img.annotationid)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    aria-label="Elimina immagine"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 py-0.5 truncate">
                    {img.filename}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isEmpty && (
          <p className="text-sm text-default-400 text-center py-4">Nessuna foto allegata</p>
        )}
      </CardBody>
    </Card>
  );
};

const AssistenzaImagesSection = memo(AssistenzaImagesSectionImpl);
export default AssistenzaImagesSection;
