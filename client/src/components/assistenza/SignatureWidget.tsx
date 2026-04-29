import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardBody, Button, addToast } from '@heroui/react';
import { Eraser, Pencil, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import {
  uploadSharepointFile,
  deleteSharepointFile,
  type SharepointFile,
} from '../../services/api';

export const SIGNATURE_FILENAME = 'firma_cliente.png';

interface SignatureWidgetProps {
  registrazioneId?: string; // undefined in create mode
  isCreate: boolean;
  existingSignature?: SharepointFile | null;
  pendingSignature: string | null; // base64 (no prefix) staged for create mode
  onPendingChange: (base64: string | null) => void;
  onSaved?: () => void; // called after successful upload/delete to refresh
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 200;

export default function SignatureWidget({
  registrazioneId,
  isCreate,
  existingSignature,
  pendingSignature,
  onPendingChange,
  onSaved,
}: SignatureWidgetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const existingSignatureRef = useRef<SharepointFile | null | undefined>(existingSignature);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [editing, setEditing] = useState(isCreate || !existingSignature);
  const [busy, setBusy] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');

  // Keep ref in sync with prop so the debounced callback uses the latest value
  useEffect(() => {
    existingSignatureRef.current = existingSignature;
  }, [existingSignature]);

  // Setup canvas size and style
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setHasStrokes(false);
  }, []);

  useEffect(() => {
    if (!editing) return;
    initCanvas();
  }, [editing, initCanvas]);

  // Restore pending signature into canvas when (re)entering edit mode
  useEffect(() => {
    if (!editing || !pendingSignature) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
      setHasStrokes(true);
    };
    img.src = `data:image/png;base64,${pendingSignature}`;
  }, [editing, pendingSignature]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = getPoint(e);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !lastPointRef.current) return;
    const p = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
    if (!hasStrokes) setHasStrokes(true);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (hasStrokes) scheduleAutoSave();
  };

  const handleClear = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    initCanvas();
    setAutoSaveStatus('idle');
    if (isCreate) onPendingChange(null);
  };

  const exportBase64 = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.split(',')[1] || null;
  };

  // Debounced auto-save invoked after each pointer release while drawing.
  // - Create mode: stages the base64 in the parent (onPendingChange) so it is
  //   uploaded together with the new record on form submit.
  // - Edit mode: uploads to SharePoint immediately (replacing any existing
  //   signature file).
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setAutoSaveStatus('pending');
    autoSaveTimerRef.current = setTimeout(async () => {
      const base64 = exportBase64();
      if (!base64) {
        setAutoSaveStatus('idle');
        return;
      }
      if (isCreate) {
        onPendingChange(base64);
        setAutoSaveStatus('saved');
        return;
      }
      if (!registrazioneId) {
        setAutoSaveStatus('idle');
        return;
      }
      setAutoSaveStatus('saving');
      setBusy(true);
      try {
        const current = existingSignatureRef.current;
        if (current) {
          await deleteSharepointFile(registrazioneId, current.id);
        }
        await uploadSharepointFile(
          registrazioneId,
          SIGNATURE_FILENAME,
          'image/png',
          base64,
        );
        setAutoSaveStatus('saved');
        onSaved?.();
      } catch (err: any) {
        const msg = err?.response?.data?.error || err?.message || 'Salvataggio firma fallito';
        addToast({ title: 'Errore firma', description: msg, color: 'danger' });
        setAutoSaveStatus('error');
      } finally {
        setBusy(false);
      }
    }, 900);
  }, [isCreate, registrazioneId, onPendingChange, onSaved]);

  // Cancel pending auto-save on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  const handleDelete = async () => {
    if (!existingSignature || !registrazioneId) return;
    setBusy(true);
    try {
      await deleteSharepointFile(registrazioneId, existingSignature.id);
      addToast({ title: 'Firma rimossa', color: 'success' });
      setEditing(true);
      onSaved?.();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Eliminazione fallita';
      addToast({ title: 'Errore', description: msg, color: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  // Display existing or pending signature (read-only) when not editing
  if (!editing && existingSignature) {
    return (
      <Card shadow="sm" className="bg-[#E7ECEF]">
        <CardBody className="gap-2.5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-centoraggi-deep uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-success-500" />
              Firma cliente
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="flat"
                color="primary"
                startContent={<Pencil className="w-4 h-4" />}
                onPress={() => setEditing(true)}
              >
                Modifica
              </Button>
              <Button
                size="sm"
                variant="flat"
                color="danger"
                isLoading={busy}
                startContent={!busy ? <Trash2 className="w-4 h-4" /> : undefined}
                onPress={handleDelete}
              >
                Elimina
              </Button>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-centoraggi-accent/20 p-2 flex items-center justify-center">
            <img
              src={existingSignature.downloadUrl ?? existingSignature.webUrl}
              alt="Firma cliente"
              className="max-h-[200px] object-contain"
            />
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card shadow="sm" className="bg-[#E7ECEF]">
      <CardBody className="gap-2.5 p-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-semibold text-centoraggi-deep uppercase tracking-wider">
            Firma cliente
          </p>
          <div className="flex items-center gap-2">
            {autoSaveStatus === 'saving' && (
              <span className="inline-flex items-center gap-1 text-[11px] text-default-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvataggio…
              </span>
            )}
            {autoSaveStatus === 'pending' && (
              <span className="inline-flex items-center gap-1 text-[11px] text-default-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> In attesa…
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="inline-flex items-center gap-1 text-[11px] text-success-600">
                <CheckCircle2 className="w-3.5 h-3.5" /> {isCreate ? 'Pronta' : 'Salvata'}
              </span>
            )}
            {autoSaveStatus === 'error' && (
              <span className="text-[11px] text-danger-600">Errore salvataggio</span>
            )}
            <Button
              size="sm"
              variant="flat"
              startContent={<Eraser className="w-4 h-4" />}
              onPress={handleClear}
              isDisabled={busy}
            >
              Cancella
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg border-2 border-dashed border-centoraggi-accent/30 overflow-hidden touch-none">
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: `${CANVAS_HEIGHT}px`, display: 'block', cursor: 'crosshair' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>

        <p className="text-[11px] text-default-500">
          Far firmare il cliente nel riquadro sopra. {isCreate ? 'La firma sarà acquisita al salvataggio della registrazione.' : 'La firma viene salvata automaticamente.'}
          {pendingSignature && isCreate && (
            <span className="ml-1 text-success-600 font-medium">Firma in attesa di salvataggio.</span>
          )}
        </p>

        {/* Hidden ref to canvas dimensions for export */}
        <div className="hidden" data-canvas-w={CANVAS_WIDTH} data-canvas-h={CANVAS_HEIGHT} />
      </CardBody>
    </Card>
  );
}
