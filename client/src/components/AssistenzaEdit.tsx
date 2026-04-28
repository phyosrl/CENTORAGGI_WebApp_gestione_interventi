import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowUp,
  MapPin,
  ExternalLink,
  Play,
  Pause,
  Square,
  Check,
  RotateCcw,
  Trash2,
  Save,
} from 'lucide-react';
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
import { updateAssistenza, UpdateAssistenzaPayload, createAssistenza, CreateAssistenzaPayload, fetchAccounts, fetchRifAssistenze, fetchImages, uploadImage, deleteImage, Annotation, geocodeAddress, GeocodeResult } from '../services/api';
import { getActiveTimer, removeActiveTimer, upsertActiveTimer } from '../services/timerStore';
import AssistenzaImagesSection from './assistenza/AssistenzaImagesSection';
import SignatureWidget, { SIGNATURE_SUBJECT } from './assistenza/SignatureWidget';

type NominatimResult = GeocodeResult;

function formatGeocode(r: GeocodeResult): { primary: string; secondary: string } {
  const a = r.address || {};
  const street = a.road || a.pedestrian || '';
  const number = a.house_number || '';
  const city = a.city || a.town || a.village || a.municipality || '';
  const postcode = a.postcode || '';
  const province = a.county || a.state || '';
  const primary = [street && number ? `${street}, ${number}` : street].filter(Boolean).join('') || r.display_name.split(',')[0];
  const secondary = [postcode, city, province].filter(Boolean).join(' ') || r.display_name.split(',').slice(1).join(',').trim();
  return { primary, secondary };
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
  const [note, setNote] = useState(assistenza?.note ?? '');
  const [costoOrario, setCostoOrario] = useState(
    assistenza?.costoOrario != null ? String(assistenza.costoOrario) : ''
  );
  const [totale, setTotale] = useState(assistenza?.totale != null ? String(assistenza.totale) : '');
  const [data, setData] = useState(assistenza?.data ? assistenza.data.split('T')[0] : new Date().toISOString().split('T')[0]);
  const [dataOraInizio, setDataOraInizio] = useState('');
  const [dataOraFine, setDataOraFine] = useState('');
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
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedPayloadRef = useRef<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(isCreate ? 'idle' : 'saved');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(isCreate ? null : new Date());
  const [saveClockTick, setSaveClockTick] = useState(0);

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
    // Conferma: ferma il timer locale e rimuove la voce dal banner "Attività in corso"
    setTimerBaseSeconds(timerSeconds);
    setTimerStatus('idle');
    setTimerStartedAt(null);
    removeActiveTimer(timerKey);
    addToast({ title: 'Tempo applicato', description: 'Ore intervento aggiornate con il timer', color: 'success' });
  }, [timerKey, timerSeconds]);

  // Calcolo automatico Ore Intervento da data/ora inizio e fine
  useEffect(() => {
    if (!dataOraInizio || !dataOraFine) return;
    const inizio = new Date(dataOraInizio).getTime();
    const fine = new Date(dataOraFine).getTime();
    if (isNaN(inizio) || isNaN(fine) || fine <= inizio) return;
    const totalSeconds = Math.floor((fine - inizio) / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    setOreIntervento(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
  }, [dataOraInizio, dataOraFine]);

  // Sincronizza la parte data di inizio/fine quando cambia il campo Data,
  // mantenendo l'ora inserita dall'utente. Se i campi sono vuoti, non li tocca.
  useEffect(() => {
    if (!data) return;
    setDataOraInizio((prev) => {
      if (!prev) return prev;
      const timePart = prev.includes('T') ? prev.split('T')[1] : prev;
      return `${data}T${timePart}`;
    });
    setDataOraFine((prev) => {
      if (!prev) return prev;
      const timePart = prev.includes('T') ? prev.split('T')[1] : prev;
      return `${data}T${timePart}`;
    });
  }, [data]);

  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounced address search via backend geocoding proxy (cache + rate limit server-side)
  const searchAddress = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await geocodeAddress(query);
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

  // Auto-popola cliente / tipologia / indirizzo dal Rif. Assistenza collegato
  // quando si apre una registrazione: se la registrazione ha un riferimento ma
  // i campi derivati sono vuoti (o l'indirizzo non è ancora stato caricato),
  // sincronizziamo i dati dal record linkato non appena la lista è disponibile.
  useEffect(() => {
    if (!rifAssistenzeList || !rifAssistenzaId) return;
    const rif = rifAssistenzeList.find((r) => r.phyo_assistenzeid === rifAssistenzaId);
    if (!rif) return;
    if (!clienteId && rif._phyo_cliente_value) {
      setClienteId(rif._phyo_cliente_value);
    }
    if (!tipologia) {
      const rifTip =
        rif['phyo_tipologia_assistenza@OData.Community.Display.V1.FormattedValue'] || '';
      if (rifTip) setTipologia(rifTip);
    }
    if (!indirizzo && rif.phyo_indirizzoassistenza) {
      setIndirizzo(rif.phyo_indirizzoassistenza);
    }
  }, [rifAssistenzeList, rifAssistenzaId, clienteId, tipologia, indirizzo]);

  // Images (only in edit mode)
  const { data: images, refetch: refetchImages } = useQuery({
    queryKey: ['images', assistenza?.id],
    queryFn: () => fetchImages(assistenza!.id),
    enabled: !isCreate && !!assistenza?.id,
    staleTime: 60 * 1000,
  });

  // Separa la firma cliente dalle immagini standard
  const signatureAnnotation = useMemo(
    () => images?.find((img) => img.subject === SIGNATURE_SUBJECT) ?? null,
    [images],
  );
  const filteredImages = useMemo(
    () => images?.filter((img) => img.subject !== SIGNATURE_SUBJECT),
    [images],
  );

  const [localPreviews, setLocalPreviews] = useState<{ file: File; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);

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

  useEffect(() => {
    if (!lastSavedAt) return;
    const id = setInterval(() => setSaveClockTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [lastSavedAt]);

  const formatSavedAgo = useMemo(() => {
    if (!lastSavedAt) return '';
    // Force recompute every second using saveClockTick.
    void saveClockTick;
    const diffSec = Math.max(0, Math.floor((Date.now() - lastSavedAt.getTime()) / 1000));
    if (diffSec < 2) return 'ora';
    if (diffSec < 60) return `${diffSec}s fa`;
    const mins = Math.floor(diffSec / 60);
    if (mins < 60) return `${mins} min fa`;
    const hours = Math.floor(mins / 60);
    return `${hours} h fa`;
  }, [lastSavedAt, saveClockTick]);

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
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateAssistenzaPayload) =>
      createAssistenza(payload),
  });

  const isPending = updateMutation.isPending || createMutation.isPending;

  const buildBasePayload = useCallback(() => {
    // Risolve la label tipologia nel valore numerico dell'option set,
    // cercando un Rif. Assistenza con la stessa FormattedValue.
    let tipologiaValue: number | null = null;
    if (tipologia && rifAssistenzeList) {
      const match = rifAssistenzeList.find(
        (r) => (r['phyo_tipologia_assistenza@OData.Community.Display.V1.FormattedValue'] || '') === tipologia
      );
      const raw = match?.phyo_tipologia_assistenza;
      if (typeof raw === 'number') tipologiaValue = raw;
      else if (typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw))) tipologiaValue = Number(raw);
    }
    return {
      phyo_attne: attne || null,
      phyo_oreintervento: oreIntervento ? (() => {
        const parts = oreIntervento.split(':').map(Number);
        return (parts[0] || 0) + (parts[1] || 0) / 60 + (parts[2] || 0) / 3600;
      })() : null,
      phyo_ore: ore ? parseFloat(ore.replace(',', '.')) : null,
      phyo_descrizioneintervento: descrizione || null,
      phyo_materialeutilizzato: materiale || null,
      phyo_note: note || null,
      phyo_costoorario: costoOrario ? parseFloat(costoOrario.replace(',', '.')) : null,
      phyo_totale: totale || null,
      _phyo_cliente_value: clienteId || null,
      _phyo_rifassistenza_value: rifAssistenzaId || null,
      phyo_tipologia_assistenza: tipologiaValue,
    };
  }, [attne, oreIntervento, ore, descrizione, materiale, note, costoOrario, totale, clienteId, rifAssistenzaId, tipologia, rifAssistenzeList]);

  const buildUpdatePayload = useCallback((): UpdateAssistenzaPayload => ({
    ...buildBasePayload(),
    phyo_data: data || null,
  }), [buildBasePayload, data]);

  const updatePayloadSignature = useMemo(() => JSON.stringify(buildUpdatePayload()), [buildUpdatePayload]);

  useEffect(() => {
    if (isCreate) return;
    if (!lastSavedPayloadRef.current) {
      lastSavedPayloadRef.current = updatePayloadSignature;
    }
  }, [isCreate, updatePayloadSignature]);

  useEffect(() => {
    if (isCreate) return;
    if (!lastSavedPayloadRef.current) return;
    if (updatePayloadSignature === lastSavedPayloadRef.current) return;

    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (updateMutation.isPending) return;
      setSaveStatus('saving');
      try {
        const payload = buildUpdatePayload();
        await updateMutation.mutateAsync(payload);
        lastSavedPayloadRef.current = JSON.stringify(payload);
        setLastSavedAt(new Date());
        setSaveStatus('saved');
        queryClient.invalidateQueries({ queryKey: ['assistenzeRegistrazioni'] });
      } catch {
        setSaveStatus('error');
      }
    }, 1500);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, [isCreate, updatePayloadSignature, buildUpdatePayload, updateMutation, queryClient]);

  const handleSave = async (opts?: { closeAfterSave?: boolean; manual?: boolean }) => {
    const closeAfterSave = opts?.closeAfterSave ?? false;
    const manual = opts?.manual ?? false;

    if (isCreate) {
      try {
        const result = await createMutation.mutateAsync({
          ...buildBasePayload(),
          phyo_data: data || null,
          _phyo_risorsa_value: props.risorsaId!,
        });
        if (localPreviews.length > 0 && result?.id) {
          await uploadAllImages(result.id);
        }
        if (pendingSignature && result?.id) {
          try {
            await uploadImage(result.id, 'firma_cliente.png', 'image/png', pendingSignature, SIGNATURE_SUBJECT);
            setPendingSignature(null);
          } catch {
            addToast({ title: 'Attenzione', description: 'Firma non caricata, riprovare dal dettaglio', color: 'warning' });
          }
        }
        queryClient.invalidateQueries({ queryKey: ['assistenzeRegistrazioni'] });
        addToast({
          title: 'Creata',
          description: 'Nuova registrazione creata con successo',
          color: 'success',
        });
        onBack();
      } catch (err: any) {
        addToast({
          title: 'Errore',
          description: err?.response?.data?.error || 'Creazione fallita',
          color: 'danger',
        });
      }
    } else {
      try {
        const payload = buildUpdatePayload();
        setSaveStatus('saving');
        await updateMutation.mutateAsync(payload);
        lastSavedPayloadRef.current = JSON.stringify(payload);
        setLastSavedAt(new Date());
        setSaveStatus('saved');
        queryClient.invalidateQueries({ queryKey: ['assistenzeRegistrazioni'] });

        if (manual) {
          addToast({
            title: 'Salvato',
            description: 'Registrazione aggiornata con successo',
            color: 'success',
          });
        }
        if (closeAfterSave) {
          onBack();
        }
      } catch (err: any) {
        setSaveStatus('error');
        addToast({
          title: 'Errore',
          description: err?.response?.data?.error || 'Salvataggio fallito',
          color: 'danger',
        });
      }
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-4 relative">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="flat"
          onPress={onBack}
          startContent={<ArrowLeft className="w-4 h-4" />}
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
        <Button
          size="sm"
          variant="flat"
          onPress={onBack}
          className="text-centoraggi-deep"
        >
          Annulla
        </Button>
        {isCreate ? (
          <Button
            size="sm"
            color="primary"
            onPress={() => handleSave({ closeAfterSave: true, manual: true })}
            isLoading={isPending}
            className="font-semibold bg-centoraggi-primary"
            startContent={!isPending ? <Save className="w-4 h-4" /> : undefined}
          >
            Crea
          </Button>
        ) : (
          <>
            <div className="hidden sm:flex items-center rounded-lg border border-default-200 bg-white/80 px-2.5 py-1.5 text-xs text-default-500">
              {saveStatus === 'saving' ? 'Salvataggio...' : saveStatus === 'error' ? 'Errore salvataggio' : `Salvato ${formatSavedAgo}`}
            </div>
            <Button
              size="sm"
              color="primary"
              variant="flat"
              onPress={() => handleSave({ manual: true })}
              isLoading={isPending}
              className="font-semibold"
              startContent={!isPending ? <Save className="w-4 h-4" /> : undefined}
            >
              Salva ora
            </Button>
          </>
        )}
      </div>

      {!isCreate && (
        <p className="sm:hidden -mt-1 text-xs text-default-500">
          {saveStatus === 'saving' ? 'Salvataggio...' : saveStatus === 'error' ? 'Errore salvataggio' : `Salvato ${formatSavedAgo}`}
        </p>
      )}

      {/* Info (read-only) — only for edit mode */}
      {!isCreate && (
        <Card shadow="sm" className="bg-centoraggi-surface border border-centoraggi-accent/20">
          <CardBody className="gap-2 p-4">
            <p className="text-xs font-semibold text-centoraggi-primary uppercase tracking-wider">Informazioni</p>
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
      <Card shadow="sm" className="bg-centoraggi-surface border border-centoraggi-accent/20 overflow-hidden">
        <CardBody className="gap-2.5 p-3">
          <p className="text-xs font-semibold text-centoraggi-primary uppercase tracking-wider">Assegnazione</p>

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
              classNames={{ trigger: 'bg-[#FAFBFC]' }}
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
              classNames={{ trigger: 'bg-[#FAFBFC]' }}
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
              classNames={{ trigger: 'bg-[#FAFBFC]' }}
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
      <Card shadow="sm" className="bg-[#E7ECEF]">
        <CardBody className="gap-2.5 p-3">
          <p className="text-xs font-semibold text-centoraggi-deep uppercase tracking-wider">Dettagli registrazione</p>

          <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-3 items-start">
            <div className="space-y-2.5">
              <Input
                label="Data"
                value={data}
                onValueChange={setData}
                variant="bordered"
                type="date"
                classNames={{ inputWrapper: 'bg-[#FAFBFC]' }}
              />
              <Input
                label="Ora inizio intervento"
                value={dataOraInizio.includes('T') ? dataOraInizio.split('T')[1].slice(0, 5) : ''}
                onValueChange={(time) => {
                  if (!time) { setDataOraInizio(''); return; }
                  const baseDate = data || new Date().toISOString().split('T')[0];
                  setDataOraInizio(`${baseDate}T${time}`);
                }}
                variant="bordered"
                type="time"
                classNames={{ inputWrapper: 'bg-[#FAFBFC]' }}
              />
              <Input
                label="Ora fine intervento"
                value={dataOraFine.includes('T') ? dataOraFine.split('T')[1].slice(0, 5) : ''}
                onValueChange={(time) => {
                  if (!time) { setDataOraFine(''); return; }
                  const baseDate = data || new Date().toISOString().split('T')[0];
                  setDataOraFine(`${baseDate}T${time}`);
                }}
                variant="bordered"
                type="time"
                classNames={{ inputWrapper: 'bg-[#FAFBFC]' }}
                isInvalid={!!dataOraInizio && !!dataOraFine && new Date(dataOraFine) <= new Date(dataOraInizio)}
                errorMessage={!!dataOraInizio && !!dataOraFine && new Date(dataOraFine) <= new Date(dataOraInizio) ? 'L\'ora fine deve essere successiva all\'ora inizio' : undefined}
              />
            </div>

            <div className="hidden md:block rounded-2xl border-2 border-centoraggi-accent/30 bg-centoraggi-surface p-2.5">
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    label="Ore Intervento"
                    placeholder="00:00:00"
                    value={oreIntervento}
                    onValueChange={setOreIntervento}
                    variant="bordered"
                    type="time"
                    classNames={{ inputWrapper: 'bg-[#FAFBFC]' }}
                    size="sm"
                    step={1}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => setOreIntervento('')}
                    className="self-center"
                  >
                    Azzera
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-xl border-2 border-centoraggi-accent/30 bg-[#FAFBFC] px-3 py-2">
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
                  <Button size="sm" color="success" variant="flat" onPress={handleStartTimer} aria-label="Avvia timer" className="justify-center flex-1 basis-0 min-w-0 h-9 whitespace-nowrap text-[10px] sm:text-xs font-medium px-1 sm:px-1.5" startContent={<Play className="w-3.5 h-3.5" />}>
                    Avvia
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={handlePauseTimer}
                    aria-label="Pausa timer"
                    className="justify-center flex-1 basis-0 min-w-0 h-9 whitespace-nowrap text-[10px] sm:text-xs font-medium px-1 sm:px-1.5 bg-orange-100 text-orange-700 border border-orange-200 transition-all duration-150 focus:scale-105 active:scale-95 focus:ring-2 focus:ring-orange-300"
                    isDisabled={!timerRunning}
                    startContent={<Pause className="w-3.5 h-3.5" />}
                  >
                    Pausa
                  </Button>
                  <Button size="sm" color="danger" variant="flat" onPress={handleStopTimer} aria-label="Ferma timer" className="justify-center flex-1 basis-0 min-w-0 h-9 whitespace-nowrap text-[10px] sm:text-xs font-medium px-1 sm:px-1.5 transition-all duration-150 focus:scale-105 active:scale-95 focus:ring-2 focus:ring-rose-300" isDisabled={timerSeconds === 0} startContent={<Square className="w-3.5 h-3.5" />}>
                    Stop
                  </Button>
                  <Button size="sm" color="primary" variant="flat" onPress={applyTimerToOre} aria-label="Conferma e compila ore intervento" className="justify-center flex-1 basis-0 min-w-0 h-9 whitespace-nowrap text-[10px] sm:text-xs font-medium px-1 sm:px-1.5 transition-all duration-150 focus:scale-105 active:scale-95 focus:ring-2 focus:ring-sky-300" isDisabled={timerSeconds === 0} startContent={<Check className="w-3.5 h-3.5" />}>
                    Conferma
                  </Button>
                  <Button size="sm" color="secondary" variant="flat" onPress={handleRestartTimer} aria-label="Riavvia timer" className="justify-center flex-1 basis-0 min-w-0 h-9 whitespace-nowrap text-[10px] sm:text-xs font-medium px-1 sm:px-1.5 transition-all duration-150 focus:scale-105 active:scale-95 focus:ring-2 focus:ring-cyan-300" isDisabled={timerSeconds === 0} startContent={<RotateCcw className="w-3.5 h-3.5" />}>
                    Riavvia
                  </Button>
                  <Button size="sm" variant="flat" onPress={handleClearTimer} aria-label="Elimina timer" className="justify-center flex-1 basis-0 min-w-0 h-9 whitespace-nowrap text-[10px] sm:text-xs font-medium px-1 sm:px-1.5 transition-all duration-150 focus:scale-105 active:scale-95 focus:ring-2 focus:ring-gray-300" isDisabled={timerSeconds === 0} startContent={<Trash2 className="w-3.5 h-3.5" />}>
                    Elimina
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="Ore viaggio"
              placeholder="0,00"
              value={ore}
              onValueChange={setOre}
              variant="bordered"
              type="text"
              inputMode="decimal"
              classNames={{ inputWrapper: 'bg-[#FAFBFC]' }}
            />
            <Input
              label="Costo orario"
              placeholder="0,00"
              value={costoOrario}
              onValueChange={setCostoOrario}
              variant="bordered"
              type="text"
              inputMode="decimal"
              classNames={{ inputWrapper: 'bg-[#FAFBFC]' }}
            />
          </div>

          <Input
            label="Att.ne"
            placeholder="Inserisci att.ne..."
            value={attne}
            onValueChange={setAttne}
            variant="bordered"
            classNames={{ inputWrapper: 'bg-[#FAFBFC]' }}
          />

          <Textarea
            label="Descrizione Intervento"
            placeholder="Descrivi l'intervento eseguito..."
            value={descrizione}
            onValueChange={setDescrizione}
            variant="bordered"
            minRows={2}
            classNames={{ inputWrapper: 'bg-[#FAFBFC]' }}
          />

          <Textarea
            label="Materiale Utilizzato"
            placeholder="Elenca il materiale utilizzato..."
            value={materiale}
            onValueChange={setMateriale}
            variant="bordered"
            minRows={2}
            classNames={{ inputWrapper: 'bg-[#FAFBFC]' }}
          />

          <Input
            label="Totale"
            placeholder="Inserisci totale..."
            value={totale}
            onValueChange={setTotale}
            variant="bordered"
            type="text"
            classNames={{ inputWrapper: 'bg-[#FAFBFC]' }}
          />

          <Textarea
            label="Note"
            placeholder="Note aggiuntive..."
            value={note}
            onValueChange={setNote}
            variant="bordered"
            minRows={2}
            classNames={{ inputWrapper: 'bg-[#FAFBFC]' }}
          />
        </CardBody>
      </Card>

      {/* Firma cliente */}
      <SignatureWidget
        registrazioneId={assistenza?.id}
        isCreate={isCreate}
        existingSignature={signatureAnnotation}
        pendingSignature={pendingSignature}
        onPendingChange={setPendingSignature}
        onSaved={() => refetchImages()}
      />

      {/* Foto / Allegati */}
      <AssistenzaImagesSection
        isCreate={isCreate}
        images={filteredImages}
        localPreviews={localPreviews}
        uploading={uploading}
        onFileSelect={handleFileSelect}
        onRemoveLocal={removeLocalPreview}
        onUploadAll={() => uploadAllImages()}
        onDeleteRemote={handleDeleteImage}
      />

      {/* Luogo assistenza */}
      <Card shadow="sm" className="bg-[#E7ECEF]">
        <CardBody className="gap-2.5 p-3">
          <p className="text-xs font-semibold text-centoraggi-deep uppercase tracking-wider">Luogo assistenza</p>
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
                className="w-full h-[56px] px-3 rounded-xl border-2 border-centoraggi-accent/30 bg-[#FAFBFC] text-sm outline-none focus:border-centoraggi-accent transition-colors"
              />
              {inputFocused && suggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-centoraggi-accent/20 max-h-[200px] overflow-y-auto">
                  {suggestions.map((s) => {
                    const { primary, secondary } = formatGeocode(s);
                    return (
                    <button
                      key={s.place_id}
                      type="button"
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-centoraggi-surface transition-colors cursor-pointer border-b border-default-100 last:border-b-0"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const finalAddress = secondary ? `${primary}, ${secondary}` : primary;
                        setIndirizzo(finalAddress || s.display_name);
                        setMapCenter({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) });
                        setInputFocused(false);
                        setSuggestions([]);
                        setShowMap(true);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5 text-centoraggi-teal flex-shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-default-800 font-medium truncate">{primary || s.display_name}</span>
                          {secondary && <span className="text-default-500 text-xs truncate">{secondary}</span>}
                        </div>
                      </div>
                    </button>
                    );
                  })}
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
                    const data = await geocodeAddress(indirizzo);
                    if (data[0]) {
                      setMapCenter({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
                    }
                  } catch {}
                }
              }}
              className="mt-auto h-[56px]"
              startContent={<MapPin className="w-5 h-5" />}
            >
              Mappa
            </Button>
            <Button
              color="secondary"
              variant="flat"
              isDisabled={!indirizzo.trim()}
              onPress={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(indirizzo)}`, '_blank')}
              className="mt-auto h-[56px]"
              startContent={<ExternalLink className="w-5 h-5" />}
            >
              Apri
            </Button>
          </div>
          <div className="w-full rounded-lg overflow-hidden border border-centoraggi-accent/20">
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

      {/* Floating back-to-top */}
      <Button
        isIconOnly
        size="lg"
        radius="full"
        color="primary"
        aria-label="Torna all'inizio"
        onPress={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-5 right-24 md:right-5 z-40 shadow-lg bg-centoraggi-primary"
      >
        <ArrowUp className="w-5 h-5" />
      </Button>

      {/* Floating timer FAB on mobile */}
      <div className="md:hidden fixed bottom-5 right-5 z-50">
        <div className="rounded-2xl border border-centoraggi-accent/25 bg-white/95 backdrop-blur shadow-xl px-2 py-2">
          <p className="text-[10px] uppercase tracking-wider text-default-400 px-1">Timer</p>
          <p className={`font-mono text-sm font-bold px-1 ${
            timerStatus === 'running'
              ? 'text-emerald-600'
              : timerStatus === 'paused'
                ? 'text-amber-600'
                : 'text-slate-600'
          }`}>
            {timerDisplay}
          </p>
          <div className="mt-1 flex items-center gap-1">
            {timerRunning ? (
              <Button size="sm" isIconOnly variant="flat" className="bg-orange-100 text-orange-700" onPress={handlePauseTimer} aria-label="Pausa timer">
                <Pause className="w-4 h-4" />
              </Button>
            ) : (
              <Button size="sm" isIconOnly color="success" variant="flat" onPress={handleStartTimer} aria-label="Avvia timer">
                <Play className="w-4 h-4" />
              </Button>
            )}
            <Button size="sm" isIconOnly color="danger" variant="flat" onPress={handleStopTimer} aria-label="Ferma timer" isDisabled={timerSeconds === 0}>
              <Square className="w-4 h-4" />
            </Button>
            <Button size="sm" isIconOnly color="primary" variant="flat" onPress={applyTimerToOre} aria-label="Applica ore" isDisabled={timerSeconds === 0}>
              <Check className="w-4 h-4" />
            </Button>
            <Button size="sm" isIconOnly variant="flat" onPress={handleClearTimer} aria-label="Elimina timer" isDisabled={timerSeconds === 0}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
