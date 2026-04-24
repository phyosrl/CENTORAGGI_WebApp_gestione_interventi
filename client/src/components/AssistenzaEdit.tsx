import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardBody,
  Input,
  Textarea,
  Button,
  Chip,
  Select,
  SelectItem,
  addToast,
} from '@heroui/react';
import { AssistenzaRegistrazione } from '../types/assistenzaRegistrazione';
import { updateAssistenza, UpdateAssistenzaPayload, createAssistenza, CreateAssistenzaPayload, fetchAccounts, fetchRifAssistenze, fetchImages, uploadImage, deleteImage, Annotation } from '../services/api';
import { getActiveTimer, removeActiveTimer, upsertActiveTimer } from '../services/timerStore';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

type AssistenzaEditProps =
  | { assistenza: AssistenzaRegistrazione; risorsaId?: undefined; onBack: () => void }
  | { assistenza?: undefined; risorsaId: string; onBack: () => void };

export default function AssistenzaEdit(props: AssistenzaEditProps) {
  const { onBack } = props;
  const isCreate = !props.assistenza;
  const assistenza = props.assistenza as AssistenzaRegistrazione | undefined;
  const a = assistenza!; // safe: used only when !isCreate
  const queryClient = useQueryClient();
  const risorsaTimerId = assistenza?.risorsaId ?? ('risorsaId' in props ? props.risorsaId : null);
  const timerKey = assistenza?.id ? `assistenza:${assistenza.id}` : `draft:${risorsaTimerId}`;
  const existingTimer = getActiveTimer(timerKey);

  const [attne, setAttne] = useState(assistenza?.attne ?? '');
  const [oreIntervento, setOreIntervento] = useState(() => {
    if (assistenza?.oreIntervento == null) return '';
    const total = assistenza.oreIntervento;
    const h = Math.floor(total);
    const m = Math.floor((total - h) * 60);
    const s = Math.round(((total - h) * 60 - m) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  });
  const [ore, setOre] = useState(
    assistenza?.ore != null ? String(assistenza.ore) : ''
  );
  const [descrizione, setDescrizione] = useState(assistenza?.descrizioneIntervento ?? '');
  const [materiale, setMateriale] = useState(assistenza?.materialeUtilizzato ?? '');
  const [totale, setTotale] = useState(assistenza?.totale != null ? String(assistenza.totale) : '');
  const [data, setData] = useState(assistenza?.data ? assistenza.data.split('T')[0] : new Date().toISOString().split('T')[0]);
  const [clienteId, setClienteId] = useState(assistenza?.clienteId ?? '');
  const [rifAssistenzaId, setRifAssistenzaId] = useState(assistenza?.rifAssistenzaId ?? '');
  const [tipologia, setTipologia] = useState(assistenza?.tipologiaAssistenza ?? '');
  const [indirizzo, setIndirizzo] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timer state
  const [timerStatus, setTimerStatus] = useState<'idle' | 'running' | 'paused' | 'stopped'>(existingTimer?.status ?? 'idle');
  const [timerBaseSeconds, setTimerBaseSeconds] = useState<number>(existingTimer?.elapsedSeconds ?? 0);
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(
    existingTimer?.status === 'running' && existingTimer.startedAt != null ? existingTimer.startedAt : null
  );
  const [timerSeconds, setTimerSeconds] = useState<number>(() => {
    if (existingTimer?.status === 'running' && existingTimer.startedAt != null) {
      return existingTimer.elapsedSeconds + Math.max(0, Math.floor((Date.now() - existingTimer.startedAt) / 1000));
    }
    return existingTimer?.elapsedSeconds ?? 0;
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRunning = timerStatus === 'running';

  useEffect(() => {
    if (timerStatus === 'running' && timerStartedAt != null) {
      const updateSeconds = () => {
        setTimerSeconds(timerBaseSeconds + Math.max(0, Math.floor((Date.now() - timerStartedAt) / 1000)));
      };
      updateSeconds();
      timerRef.current = setInterval(updateSeconds, 1000);
    } else {
      setTimerSeconds(timerBaseSeconds);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerBaseSeconds, timerStartedAt, timerStatus]);

  const persistTimer = useCallback((status: 'running' | 'paused' | 'stopped', elapsedSeconds: number, startedAt: number | null) => {
    upsertActiveTimer({
      key: timerKey,
      assistenzaId: assistenza?.id,
      risorsaId: risorsaTimerId,
      nr: assistenza?.nr || 'Nuova registrazione',
      rifAssistenzaNome: assistenza?.rifAssistenzaNome || '',
      tipologiaAssistenza: assistenza?.tipologiaAssistenza || tipologia || '',
      startedAt,
      elapsedSeconds,
      status,
    });
  }, [assistenza?.id, assistenza?.nr, assistenza?.rifAssistenzaNome, assistenza?.tipologiaAssistenza, risorsaTimerId, timerKey, tipologia]);

  const timerDisplay = useMemo(() => {
    const h = Math.floor(timerSeconds / 3600);
    const m = Math.floor((timerSeconds % 3600) / 60);
    const s = timerSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [timerSeconds]);

  const handleStartTimer = useCallback(() => {
    const startedAt = Date.now();
    setTimerStatus('running');
    setTimerStartedAt(startedAt);
    persistTimer('running', timerBaseSeconds, startedAt);
  }, [persistTimer, timerBaseSeconds]);

  const handlePauseTimer = useCallback(() => {
    const elapsed = timerStatus === 'running' && timerStartedAt != null
      ? timerBaseSeconds + Math.max(0, Math.floor((Date.now() - timerStartedAt) / 1000))
      : timerSeconds;

    setTimerBaseSeconds(elapsed);
    setTimerSeconds(elapsed);
    setTimerStatus('paused');
    setTimerStartedAt(null);
    persistTimer('paused', elapsed, null);
  }, [persistTimer, timerBaseSeconds, timerSeconds, timerStartedAt, timerStatus]);

  const handleStopTimer = useCallback(() => {
    const elapsed = timerStatus === 'running' && timerStartedAt != null
      ? timerBaseSeconds + Math.max(0, Math.floor((Date.now() - timerStartedAt) / 1000))
      : timerSeconds;

    setTimerBaseSeconds(elapsed);
    setTimerSeconds(elapsed);
    setTimerStatus('stopped');
    setTimerStartedAt(null);
    persistTimer('stopped', elapsed, null);
  }, [persistTimer, timerBaseSeconds, timerSeconds, timerStartedAt, timerStatus]);

  const handleRestartTimer = useCallback(() => {
    if (!window.confirm('Sei sicuro di voler riavviare il timer?')) return;
    const startedAt = Date.now();
    setTimerBaseSeconds(0);
    setTimerSeconds(0);
    setTimerStatus('running');
    setTimerStartedAt(startedAt);
    persistTimer('running', 0, startedAt);
  }, [persistTimer]);

  const handleClearTimer = useCallback(() => {
    if (!window.confirm('Sei sicuro di voler eliminare i dati del timer?')) return;
    setTimerBaseSeconds(0);
    setTimerSeconds(0);
    setTimerStatus('idle');
    setTimerStartedAt(null);
    setOreIntervento('');
    removeActiveTimer(timerKey);
    addToast({ title: 'Timer svuotato', color: 'success' });
  }, [timerKey]);

  const applyTimerToOre = useCallback(() => {
    const h = Math.floor(timerSeconds / 3600);
    const m = Math.floor((timerSeconds % 3600) / 60);
    const s = timerSeconds % 60;
    setOreIntervento(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    handleStopTimer();
    addToast({ title: 'Tempo applicato', description: 'Ore intervento aggiornate con il timer', color: 'success' });
  }, [handleStopTimer, timerSeconds]);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounced Nominatim search
  const searchAddress = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&countrycodes=it&limit=5&q=${encodeURIComponent(query)}`,
          { headers: { 'Accept-Language': 'it' } }
        );
        const data: NominatimResult[] = await res.json();
        setSuggestions(data);
      } catch { setSuggestions([]); }
    }, 350);
  }, []);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setInputFocused(false);
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const { data: accountsList } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
    staleTime: 10 * 60 * 1000,
  });

  const { data: rifAssistenzeList } = useQuery({
    queryKey: ['rifAssistenze'],
    queryFn: fetchRifAssistenze,
    staleTime: 10 * 60 * 1000,
  });

  // Images (only in edit mode)
  const { data: images, refetch: refetchImages } = useQuery({
    queryKey: ['images', assistenza?.id],
    queryFn: () => fetchImages(assistenza!.id),
    enabled: !isCreate && !!assistenza?.id,
    staleTime: 60 * 1000,
  });

  const [localPreviews, setLocalPreviews] = useState<{ file: File; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    const newPreviews: { file: File; preview: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        newPreviews.push({ file, preview: URL.createObjectURL(file) });
      }
    }
    setLocalPreviews((prev) => [...prev, ...newPreviews]);
  }, []);

  const removeLocalPreview = useCallback((index: number) => {
    setLocalPreviews((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const uploadAllImages = useCallback(async (targetId?: string) => {
    const recordId = targetId || assistenza?.id;
    if (!recordId || localPreviews.length === 0) return;
    setUploading(true);
    try {
      for (const { file } of localPreviews) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // strip data:...;base64,
          };
          reader.readAsDataURL(file);
        });
        await uploadImage(recordId, file.name, file.type, base64);
      }
      setLocalPreviews([]);
      if (!targetId) refetchImages();
      addToast({ title: 'Caricamento completato', description: 'Immagini caricate con successo', color: 'success' });
    } catch {
      addToast({ title: 'Errore', description: 'Caricamento immagini fallito', color: 'danger' });
    } finally {
      setUploading(false);
    }
  }, [assistenza?.id, localPreviews, refetchImages]);

  const handleDeleteImage = useCallback(async (annotationId: string) => {
    try {
      await deleteImage(annotationId);
      refetchImages();
      addToast({ title: 'Eliminata', description: 'Immagine eliminata', color: 'success' });
    } catch {
      addToast({ title: 'Errore', description: 'Eliminazione fallita', color: 'danger' });
    }
  }, [refetchImages]);

  // Tipologie filtered by selected cliente / rif
  const tipologie = useMemo(() => {
    if (!rifAssistenzeList) return [];
    const set = new Set<string>();
    for (const rif of rifAssistenzeList) {
      if (clienteId && rif._phyo_cliente_value !== clienteId) continue;
      if (rifAssistenzaId && rif.phyo_assistenzeid !== rifAssistenzaId) continue;
      const t = rif['phyo_tipologia_assistenza@OData.Community.Display.V1.FormattedValue'] || '';
      if (t) set.add(t);
    }
    // always include currently selected tipologia
    if (tipologia) set.add(tipologia);
    return Array.from(set).sort();
  }, [rifAssistenzeList, clienteId, rifAssistenzaId, tipologia]);

  // Clienti filtered by selected tipologia / rif
  const filteredAccounts = useMemo(() => {
    if (!accountsList) return [];
    if (!rifAssistenzeList || (!tipologia && !rifAssistenzaId)) return accountsList;
    const allowed = new Set<string>();
    for (const rif of rifAssistenzeList) {
      if (tipologia && (rif['phyo_tipologia_assistenza@OData.Community.Display.V1.FormattedValue'] || '') !== tipologia) continue;
      if (rifAssistenzaId && rif.phyo_assistenzeid !== rifAssistenzaId) continue;
      if (rif._phyo_cliente_value) allowed.add(rif._phyo_cliente_value);
    }
    // always include currently selected cliente
    if (clienteId) allowed.add(clienteId);
    return accountsList.filter((a) => allowed.has(a.accountid));
  }, [accountsList, rifAssistenzeList, tipologia, rifAssistenzaId, clienteId]);

  // Filter rif assistenze by selected cliente and tipologia
  const filteredRifAssistenze = useMemo(() => {
    if (!rifAssistenzeList) return [];
    let list = rifAssistenzeList;
    if (clienteId) {
      list = list.filter((rif) => rif._phyo_cliente_value === clienteId);
    }
    if (tipologia) {
      list = list.filter(
        (rif) => (rif['phyo_tipologia_assistenza@OData.Community.Display.V1.FormattedValue'] || '') === tipologia
      );
    }
    return list;
  }, [rifAssistenzeList, clienteId, tipologia]);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateAssistenzaPayload) =>
      updateAssistenza(assistenza!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assistenzeRegistrazioni'] });
      addToast({
        title: 'Salvato',
        description: 'Registrazione aggiornata con successo',
        color: 'success',
      });
      onBack();
    },
    onError: (err: any) => {
      addToast({
        title: 'Errore',
        description: err?.response?.data?.error || 'Salvataggio fallito',
        color: 'danger',
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateAssistenzaPayload) =>
      createAssistenza(payload),
    onSuccess: async (result) => {
      if (localPreviews.length > 0 && result?.id) {
        await uploadAllImages(result.id);
      }
      queryClient.invalidateQueries({ queryKey: ['assistenzeRegistrazioni'] });
      addToast({
        title: 'Creata',
        description: 'Nuova registrazione creata con successo',
        color: 'success',
      });
      onBack();
    },
    onError: (err: any) => {
      addToast({
        title: 'Errore',
        description: err?.response?.data?.error || 'Creazione fallita',
        color: 'danger',
      });
    },
  });

  const isPending = updateMutation.isPending || createMutation.isPending;

  const handleSave = () => {
    const basePayload = {
      phyo_attne: attne || null,
      phyo_oreintervento: oreIntervento ? (() => {
        const parts = oreIntervento.split(':').map(Number);
        return (parts[0] || 0) + (parts[1] || 0) / 60 + (parts[2] || 0) / 3600;
      })() : null,
      phyo_ore: ore ? parseFloat(ore.replace(',', '.')) : null,
      phyo_descrizioneintervento: descrizione || null,
      phyo_materialeutilizzato: materiale || null,
      phyo_totale: totale || null,
      _phyo_cliente_value: clienteId || null,
      _phyo_rifassistenza_value: rifAssistenzaId || null,
    };

    if (isCreate) {
      createMutation.mutate({
        ...basePayload,
        phyo_data: data || null,
        _phyo_risorsa_value: props.risorsaId!,
      });
    } else {
      updateMutation.mutate({
        ...basePayload,
        phyo_data: data || null,
      });
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="flat"
          onPress={onBack}
          startContent={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          }
        >
          Indietro
        </Button>
        <div className="flex-1">
          {isCreate ? (
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Nuova registrazione</h1>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">{a.nr}</h1>
                <Chip size="sm" variant="flat" color="primary">{a.statoReg}</Chip>
                <Chip size="sm" variant="dot" color={a.statoRegistrazione === 'Aperta' ? 'primary' : 'default'}>
                  {a.statoRegistrazione}
                </Chip>
              </div>
              {a.rifAssistenzaNome && (
                <p className="text-sm text-default-400 mt-0.5">Rif. {a.rifAssistenzaNome}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Info (read-only) — only for edit mode */}
      {!isCreate && (
        <Card shadow="sm" className="bg-[#e8f4f8] border border-[#168AAD]/20">
          <CardBody className="gap-2 p-4">
            <p className="text-xs font-semibold text-[#1A759F] uppercase tracking-wider">Informazioni</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-default-400 text-xs">NR</span>
                <p className="font-medium">{a.nr}</p>
              </div>
              <div>
                <span className="text-default-400 text-xs">Data</span>
                <p>{a.data ? new Date(a.data).toLocaleDateString('it-IT') : '—'}</p>
              </div>
              <div>
                <span className="text-default-400 text-xs">Rif. Assistenza</span>
                <p>{a.rifAssistenzaNome || '—'}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Editable form */}
      {/* Cliente & Rif. Assistenza */}
      <Card shadow="sm" className="bg-[#e8f4f8] border border-[#168AAD]/20 overflow-hidden">
        <CardBody className="gap-2.5 p-3">
          <p className="text-xs font-semibold text-[#1A759F] uppercase tracking-wider">Assegnazione</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Select
              label="Cliente"
              placeholder="Seleziona cliente..."
              variant="bordered"
              selectedKeys={clienteId ? [clienteId] : []}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string | undefined;
                setClienteId(selected ?? '');
                // if current rif no longer matches cliente, clear it
                if (selected && rifAssistenzaId && rifAssistenzeList) {
                  const rif = rifAssistenzeList.find((r) => r.phyo_assistenzeid === rifAssistenzaId);
                  if (rif && rif._phyo_cliente_value !== selected) {
                    setRifAssistenzaId('');
                  }
                }
              }}
              className="sm:col-span-2"
              classNames={{ trigger: 'bg-white' }}
            >
              {filteredAccounts.map((acc) => (
                <SelectItem key={acc.accountid}>
                  {acc.name}
                </SelectItem>
              ))}
            </Select>
            <Select
              label="Tipologia"
              placeholder="Seleziona tipologia..."
              variant="bordered"
              selectedKeys={tipologia ? [tipologia] : []}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string | undefined;
                setTipologia(selected ?? '');
                // if current rif no longer matches tipologia, clear it
                if (selected && rifAssistenzaId && rifAssistenzeList) {
                  const rif = rifAssistenzeList.find((r) => r.phyo_assistenzeid === rifAssistenzaId);
                  const rifTip = rif?.['phyo_tipologia_assistenza@OData.Community.Display.V1.FormattedValue'] || '';
                  if (rif && rifTip !== selected) {
                    setRifAssistenzaId('');
                  }
                }
              }}
              className="sm:col-span-2"
              classNames={{ trigger: 'bg-white' }}
            >
              {tipologie.map((t) => (
                <SelectItem key={t}>
                  {t}
                </SelectItem>
              ))}
            </Select>
            <Select
              label="Rif. Assistenza"
              placeholder="Seleziona assistenza..."
              variant="bordered"
              selectedKeys={rifAssistenzaId ? [rifAssistenzaId] : []}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string | undefined;
                setRifAssistenzaId(selected ?? '');
                if (selected && rifAssistenzeList) {
                  const rif = rifAssistenzeList.find((r) => r.phyo_assistenzeid === selected);
                  if (rif) {
                    // auto-populate cliente and tipologia from the selected rif
                    if (rif._phyo_cliente_value) {
                      setClienteId(rif._phyo_cliente_value);
                    }
                    const rifTip = rif['phyo_tipologia_assistenza@OData.Community.Display.V1.FormattedValue'] || '';
                    if (rifTip) {
                      setTipologia(rifTip);
                    }
                    if (rif.phyo_indirizzoassistenza) {
                      setIndirizzo(rif.phyo_indirizzoassistenza);
                      setShowMap(false);
                      setMapCenter(null);
                    }
                  }
                }
              }}
              className="sm:col-span-2"
              classNames={{ trigger: 'bg-white' }}
            >
              {filteredRifAssistenze.map((rif) => (
                <SelectItem key={rif.phyo_assistenzeid} textValue={rif.phyo_nrassistenze}>
                  <div className="flex flex-col">
                    <span>{rif.phyo_nrassistenze}</span>
                    <span className="text-tiny text-default-400">
                      {rif['_phyo_cliente_value@OData.Community.Display.V1.FormattedValue'] || ''}
                      {rif['phyo_tipologia_assistenza@OData.Community.Display.V1.FormattedValue']
                        ? ` • ${rif['phyo_tipologia_assistenza@OData.Community.Display.V1.FormattedValue']}`
                        : ''}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      {/* Dettagli registrazione */}
      <Card shadow="sm" className="bg-white">
        <CardBody className="gap-2.5 p-3">
          <p className="text-xs font-semibold text-[#184E77] uppercase tracking-wider">Dettagli registrazione</p>

          <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-3 items-start">
            <div className="space-y-2.5">
              <Input
                label="Data"
                value={data}
                onValueChange={setData}
                variant="bordered"
                type="date"
              />
              <Input
                label="Ore"
                placeholder="0,00"
                value={ore}
                onValueChange={setOre}
                variant="bordered"
                type="text"
                inputMode="decimal"
              />
              <Input
                label="Totale"
                placeholder="Inserisci totale..."
                value={totale}
                onValueChange={setTotale}
                variant="bordered"
                type="text"
              />
            </div>

            <div className="rounded-2xl border border-[#168AAD]/20 bg-[#e8f4f8] p-2.5">
              <div className="grid grid-cols-1 gap-2">
                <Input
                  label="Ore Intervento"
                  placeholder="00:00:00"
                  value={oreIntervento}
                  onValueChange={setOreIntervento}
                  variant="bordered"
                  type="time"
                  classNames={{ inputWrapper: 'bg-white' }}
                  size="sm"
                  step={1}
                />

                <div className="flex items-center justify-between gap-2 rounded-xl border border-default-200 bg-white px-3 py-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-default-400">Timer</p>
                    <p className={`font-mono text-lg font-bold ${
                      timerStatus === 'running'
                        ? 'text-emerald-600'
                        : timerStatus === 'paused'
                          ? 'text-amber-600'
                          : 'text-slate-600'
                    }`}>
                      {timerDisplay}
                    </p>
                  </div>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={timerStatus === 'running' ? 'success' : timerStatus === 'paused' ? 'warning' : 'default'}
                  >
                    {timerStatus === 'running' ? 'In corso' : timerStatus === 'paused' ? 'In pausa' : 'Fermo'}
                  </Chip>
                </div>

                <div className="flex items-center gap-1 w-full overflow-hidden">
                  <Button size="sm" color="success" variant="flat" onPress={handleStartTimer} aria-label="Avvia timer" className="justify-center flex-1 basis-0 min-w-0 h-9 whitespace-nowrap text-[10px] sm:text-xs font-medium px-1 sm:px-1.5">
                    ▶ Avvia
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={handlePauseTimer}
                    aria-label="Pausa timer"
                    className="justify-center flex-1 basis-0 min-w-0 h-9 whitespace-nowrap text-[10px] sm:text-xs font-medium px-1 sm:px-1.5 bg-orange-100 text-orange-700 border border-orange-200 transition-all duration-150 focus:scale-105 active:scale-95 hover:animate-pulse focus:ring-2 focus:ring-orange-300"
                    isDisabled={!timerRunning}
                  >
                    ⏸ Pausa
                  </Button>
                  <Button size="sm" color="danger" variant="flat" onPress={handleStopTimer} aria-label="Ferma timer" className="justify-center flex-1 basis-0 min-w-0 h-9 whitespace-nowrap text-[10px] sm:text-xs font-medium px-1 sm:px-1.5 transition-all duration-150 focus:scale-105 active:scale-95 hover:animate-pulse focus:ring-2 focus:ring-rose-300" isDisabled={timerSeconds === 0}>
                    ■ Stop
                  </Button>
                  <Button size="sm" color="primary" variant="flat" onPress={applyTimerToOre} aria-label="Conferma e compila ore intervento" className="justify-center flex-1 basis-0 min-w-0 h-9 whitespace-nowrap text-[10px] sm:text-xs font-medium px-1 sm:px-1.5 transition-all duration-150 focus:scale-105 active:scale-95 hover:animate-pulse focus:ring-2 focus:ring-sky-300" isDisabled={timerSeconds === 0}>
                    ✓ Conferma
                  </Button>
                  <Button size="sm" color="secondary" variant="flat" onPress={handleRestartTimer} aria-label="Riavvia timer" className="justify-center flex-1 basis-0 min-w-0 h-9 whitespace-nowrap text-[10px] sm:text-xs font-medium px-1 sm:px-1.5 transition-all duration-150 focus:scale-105 active:scale-95 hover:animate-pulse focus:ring-2 focus:ring-cyan-300" isDisabled={timerSeconds === 0}>
                    ↻ Riavvia
                  </Button>
                  <Button size="sm" variant="flat" onPress={handleClearTimer} aria-label="Elimina timer" className="justify-center flex-1 basis-0 min-w-0 h-9 whitespace-nowrap text-[10px] sm:text-xs font-medium px-1 sm:px-1.5 transition-all duration-150 focus:scale-105 active:scale-95 hover:animate-pulse focus:ring-2 focus:ring-gray-300" isDisabled={timerSeconds === 0}>
                    🗑 Elimina
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Input
            label="Att.ne"
            placeholder="Inserisci att.ne..."
            value={attne}
            onValueChange={setAttne}
            variant="bordered"
          />

          <Textarea
            label="Descrizione Intervento"
            placeholder="Descrivi l'intervento eseguito..."
            value={descrizione}
            onValueChange={setDescrizione}
            variant="bordered"
            minRows={2}
          />

          <Textarea
            label="Materiale Utilizzato"
            placeholder="Elenca il materiale utilizzato..."
            value={materiale}
            onValueChange={setMateriale}
            variant="bordered"
            minRows={2}
          />

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="flat" className="text-[#184E77]" onPress={onBack}>
              Annulla
            </Button>
            <Button
              color="primary"
              onPress={handleSave}
              isLoading={isPending}
              className="font-semibold bg-[#1A759F]"
            >
              {isCreate ? 'Crea' : 'Salva'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Luogo assistenza */}
      <Card shadow="sm" className="bg-white">
        <CardBody className="gap-2.5 p-3">
          <p className="text-xs font-semibold text-[#184E77] uppercase tracking-wider">Luogo assistenza</p>
          <div className="flex gap-2">
            <div className="flex-1 relative" ref={suggestionsRef}>
              <input
                type="text"
                placeholder="Cerca indirizzo..."
                value={indirizzo}
                onChange={(e) => {
                  const val = e.target.value;
                  setIndirizzo(val);
                  setShowMap(false);
                  setMapCenter(null);
                  searchAddress(val);
                }}
                onFocus={() => { setInputFocused(true); }}
                onBlur={() => {
                  // Delay to allow click on suggestion
                  setTimeout(() => setInputFocused(false), 200);
                }}
                className="w-full h-[56px] px-3 rounded-xl border-2 border-[#168AAD]/30 bg-white text-sm outline-none focus:border-[#168AAD] transition-colors"
              />
              {inputFocused && suggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-[#168AAD]/20 max-h-[200px] overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.place_id}
                      type="button"
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-[#e8f4f8] transition-colors cursor-pointer border-b border-default-100 last:border-b-0"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setIndirizzo(s.display_name);
                        setMapCenter({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) });
                        setInputFocused(false);
                        setSuggestions([]);
                        setShowMap(true);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 mt-0.5 text-[#34A0A4] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-default-700">{s.display_name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              color="primary"
              variant="flat"
              isDisabled={!indirizzo.trim()}
              onPress={async () => {
                setShowMap(true);
                if (!mapCenter) {
                  try {
                    const res = await fetch(
                      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(indirizzo)}`,
                      { headers: { 'Accept-Language': 'it' } }
                    );
                    const data: NominatimResult[] = await res.json();
                    if (data[0]) {
                      setMapCenter({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
                    }
                  } catch {}
                }
              }}
              className="mt-auto h-[56px]"
              startContent={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            >
              Mappa
            </Button>
            <Button
              color="secondary"
              variant="flat"
              isDisabled={!indirizzo.trim()}
              onPress={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(indirizzo)}`, '_blank')}
              className="mt-auto h-[56px]"
              startContent={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              }
            >
              Apri
            </Button>
          </div>
          <div className="w-full rounded-lg overflow-hidden border border-[#168AAD]/20">
            <iframe
              key={mapCenter ? `${mapCenter.lat},${mapCenter.lng}` : 'world'}
              title="Mappa luogo assistenza"
              width="100%"
              height="300"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={mapCenter
                ? `https://www.google.com/maps?q=${mapCenter.lat},${mapCenter.lng}&z=15&output=embed`
                : `https://www.google.com/maps?ll=45.5877,10.1580&z=3&output=embed`
              }
            />
          </div>
        </CardBody>
      </Card>

      {/* Foto / Allegati */}
        <Card shadow="sm" className="bg-white">
          <CardBody className="gap-2.5 p-3">

            {/* Upload buttons */}
            <div className="flex gap-2 flex-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
              />
              <Button
                color="primary"
                variant="flat"
                onPress={() => fileInputRef.current?.click()}
                startContent={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
              >
                Scegli immagini
              </Button>
              <input
                ref={(el) => { if (el) el.setAttribute('capture', 'environment'); }}
                type="file"
                accept="image/*"
                capture="environment"
                id="cameraInput"
                className="hidden"
                onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
              />
              <Button
                color="secondary"
                variant="flat"
                onPress={() => document.getElementById('cameraInput')?.click()}
                startContent={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
              >
                Scatta foto
              </Button>
              {localPreviews.length > 0 && !isCreate && (
                <Button
                  color="primary"
                  isLoading={uploading}
                  onPress={() => uploadAllImages()}
                  startContent={!uploading ?
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg> : undefined
                  }
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
                    <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-[#168AAD]/20">
                      <img src={p.preview} alt={p.file.name} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeLocalPreview(i)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        ✕
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
                    <div key={img.annotationid} className="relative group aspect-square rounded-lg overflow-hidden border border-[#168AAD]/20">
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
                        onClick={() => handleDeleteImage(img.annotationid)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        ✕
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
    </div>
  );
}
