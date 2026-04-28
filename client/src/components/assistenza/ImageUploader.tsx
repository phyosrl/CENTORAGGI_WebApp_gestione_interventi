import { Button, Card, CardBody } from '@heroui/react';
import { X } from 'lucide-react';
import { Annotation } from '../../services/api';

interface LocalPreview {
  file: File;
  preview: string;
}

interface ImageUploaderProps {
  isCreate: boolean;
  images?: Annotation[];
  localPreviews: LocalPreview[];
  uploading: boolean;
  uploadProgress: number;
  onSelectFiles: (files: FileList | null) => void;
  onRemoveLocalPreview: (index: number) => void;
  onUploadAll: () => void;
  onDeleteImage: (annotationId: string) => void;
}

export default function ImageUploader({
  isCreate,
  images,
  localPreviews,
  uploading,
  uploadProgress,
  onSelectFiles,
  onRemoveLocalPreview,
  onUploadAll,
  onDeleteImage,
}: ImageUploaderProps) {
  return (
    <Card shadow="sm" className="bg-white">
      <CardBody className="gap-2.5 p-3">
        <div className="flex gap-2 flex-wrap">
          <input
            id="galleryInput"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              onSelectFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <Button color="primary" variant="flat" onPress={() => document.getElementById('galleryInput')?.click()}>
            Scegli immagini
          </Button>

          <input
            type="file"
            accept="image/*"
            capture="environment"
            id="cameraInput"
            className="hidden"
            onChange={(e) => {
              onSelectFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <Button color="secondary" variant="flat" onPress={() => document.getElementById('cameraInput')?.click()}>
            Scatta foto
          </Button>

          {localPreviews.length > 0 && !isCreate && (
            <Button color="primary" isLoading={uploading} onPress={onUploadAll}>
              Carica {localPreviews.length} immagin{localPreviews.length === 1 ? 'e' : 'i'}
            </Button>
          )}
        </div>

        {uploading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-default-500">
              <span>Compressione e caricamento</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-2 rounded-full bg-default-100 overflow-hidden">
              <div className="h-full bg-centoraggi-primary transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {localPreviews.length > 0 && (
          <div>
            <p className="text-xs text-default-400 mb-2">
              Da caricare{isCreate ? ' (verranno caricate al salvataggio)' : ''}
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {localPreviews.map((p, i) => (
                <div key={`${p.file.name}-${i}`} className="relative group aspect-square rounded-lg overflow-hidden border border-centoraggi-accent/20">
                  <img src={p.preview} alt={p.file.name} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => onRemoveLocalPreview(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    aria-label="Rimuovi immagine"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
                    onClick={() => {
                      const w = window.open();
                      if (w) {
                        w.document.write(`<img src="data:${img.mimetype};base64,${img.documentbody}" style="max-width:100%;max-height:100vh;margin:auto;display:block" />`);
                        w.document.title = img.filename;
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => onDeleteImage(img.annotationid)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
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

        {(!images || images.length === 0) && localPreviews.length === 0 && (
          <p className="text-sm text-default-400 text-center py-4">Nessuna foto allegata</p>
        )}
      </CardBody>
    </Card>
  );
}
