import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardBody, Button, addToast } from '@heroui/react';
import { Eraser, Save, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { uploadImage, deleteImage, type Annotation } from '../../services/api';

export const SIGNATURE_SUBJECT = 'firma_cliente';

interface SignatureWidgetProps {
  registrazioneId?: string; // undefined in create mode
  isCreate: boolean;
  existingSignature?: Annotation | null;
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
  const [hasStrokes, setHasStrokes] = useState(false);
  const [editing, setEditing] = useState(isCreate || !existingSignature);
  const [busy, setBusy] = useState(false);

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
  };

  const handleClear = () => {
    initCanvas();
    if (isCreate) onPendingChange(null);
  };

  const exportBase64 = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.split(',')[1] || null;
  };

  const handleSave = async () => {
    if (!hasStrokes) {
      addToast({ title: 'Firma vuota', description: 'Disegna la firma prima di salvare', color: 'warning' });
      return;
    }
    const base64 = exportBase64();
    if (!base64) return;

    if (isCreate) {
      onPendingChange(base64);
      addToast({ title: 'Firma pronta', description: 'Verrà salvata alla creazione', color: 'success' });
      return;
    }

    if (!registrazioneId) return;

    setBusy(true);
    try {
      // Replace any existing signature
      if (existingSignature) {
        await deleteImage(existingSignature.annotationid);
      }
      await uploadImage(
        registrazioneId,
        'firma_cliente.png',
        'image/png',
        base64,
        SIGNATURE_SUBJECT,
      );
      addToast({ title: 'Firma salvata', description: 'Firma cliente acquisita', color: 'success' });
      setEditing(false);
      onSaved?.();
    } catch {
      addToast({ title: 'Errore', description: 'Salvataggio firma fallito', color: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!existingSignature || !registrazioneId) return;
    setBusy(true);
    try {
      await deleteImage(existingSignature.annotationid);
      addToast({ title: 'Firma rimossa', color: 'success' });
      setEditing(true);
      onSaved?.();
    } catch {
      addToast({ title: 'Errore', description: 'Eliminazione fallita', color: 'danger' });
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
              src={`data:${existingSignature.mimetype};base64,${existingSignature.documentbody}`}
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
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="flat"
              startContent={<Eraser className="w-4 h-4" />}
              onPress={handleClear}
              isDisabled={busy}
            >
              Cancella
            </Button>
            <Button
              size="sm"
              color="primary"
              isLoading={busy}
              startContent={!busy ? <Save className="w-4 h-4" /> : undefined}
              onPress={handleSave}
              isDisabled={!hasStrokes}
            >
              {isCreate ? 'Conferma firma' : 'Salva firma'}
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
          Far firmare il cliente nel riquadro sopra. {isCreate ? 'La firma sarà acquisita al salvataggio della registrazione.' : 'La firma sostituirà quella esistente.'}
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
