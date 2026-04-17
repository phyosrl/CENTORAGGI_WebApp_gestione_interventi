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
import { updateAssistenza, UpdateAssistenzaPayload, createAssistenza, CreateAssistenzaPayload, fetchAccounts, fetchRifAssistenze } from '../services/api';

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

  const [attne, setAttne] = useState(assistenza?.attne ?? '');
  const [oreIntervento, setOreIntervento] = useState(
    assistenza?.oreIntervento != null ? String(assistenza.oreIntervento) : ''
  );
  const [ore, setOre] = useState(
    assistenza?.ore != null ? String(assistenza.ore) : ''
  );
  const [descrizione, setDescrizione] = useState(assistenza?.descrizioneIntervento ?? '');
  const [materiale, setMateriale] = useState(assistenza?.materialeUtilizzato ?? '');
  const [totale, setTotale] = useState(assistenza?.totale != null ? String(assistenza.totale) : '');
  const [data, setData] = useState(assistenza?.data ? assistenza.data.split('T')[0] : new Date().toISOString().split('T')[0]);
  const [clienteId, setClienteId] = useState('');
  const [rifAssistenzaId, setRifAssistenzaId] = useState(assistenza?.rifAssistenzaId ?? '');
  const [tipologia, setTipologia] = useState('');
  const [indirizzo, setIndirizzo] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Extract unique tipologie from rifAssistenzeList
  const tipologie = useMemo(() => {
    if (!rifAssistenzeList) return [];
    const set = new Set<string>();
    for (const rif of rifAssistenzeList) {
      const t = rif['phyo_tipologia_assistenza@OData.Community.Display.V1.FormattedValue'] || '';
      if (t) set.add(t);
    }
    return Array.from(set).sort();
  }, [rifAssistenzeList]);

  // Filter rif assistenze by selected tipologia
  const filteredRifAssistenze = useMemo(() => {
    if (!rifAssistenzeList) return [];
    if (!tipologia) return rifAssistenzeList;
    return rifAssistenzeList.filter(
      (rif) => (rif['phyo_tipologia_assistenza@OData.Community.Display.V1.FormattedValue'] || '') === tipologia
    );
  }, [rifAssistenzeList, tipologia]);

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
    onSuccess: () => {
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
      phyo_oreintervento: oreIntervento ? parseFloat(oreIntervento.replace(',', '.')) : null,
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
      updateMutation.mutate(basePayload);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
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
        <CardBody className="gap-4 p-4">
          <p className="text-xs font-semibold text-[#1A759F] uppercase tracking-wider">Assegnazione</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Cliente"
              placeholder="Seleziona cliente..."
              variant="bordered"
              selectedKeys={clienteId ? [clienteId] : []}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string | undefined;
                setClienteId(selected ?? '');
              }}
              className="sm:col-span-2"
              classNames={{ trigger: 'bg-white' }}
            >
              {(accountsList ?? []).map((acc) => (
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
                setRifAssistenzaId('');
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
              placeholder={tipologia ? 'Seleziona assistenza...' : 'Seleziona prima la tipologia...'}
              variant="bordered"
              selectedKeys={rifAssistenzaId ? [rifAssistenzaId] : []}
              isDisabled={!tipologia}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string | undefined;
                setRifAssistenzaId(selected ?? '');
                // Auto-populate indirizzo from selected assistenza
                if (selected && rifAssistenzeList) {
                  const rif = rifAssistenzeList.find((r) => r.phyo_assistenzeid === selected);
                  if (rif?.phyo_indirizzoassistenza) {
                    setIndirizzo(rif.phyo_indirizzoassistenza);
                    setShowMap(false);
                    setMapCenter(null);
                  }
                }
              }}
              className="sm:col-span-2"
              classNames={{ trigger: 'bg-white' }}
            >
              {filteredRifAssistenze.map((rif) => (
                <SelectItem key={rif.phyo_assistenzeid}>
                  {rif.phyo_nrassistenze}
                </SelectItem>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      {/* Dettagli registrazione */}
      <Card shadow="sm" className="bg-white">
        <CardBody className="gap-4 p-4">
          <p className="text-xs font-semibold text-[#184E77] uppercase tracking-wider">Dettagli registrazione</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isCreate && (
              <Input
                label="Data"
                value={data}
                onValueChange={setData}
                variant="bordered"
                type="date"
              />
            )}
            <Input
              label="Att.ne"
              placeholder="Inserisci att.ne..."
              value={attne}
              onValueChange={setAttne}
              variant="bordered"
            />
            <Input
              label="Ore Intervento"
              placeholder="0,00"
              value={oreIntervento}
              onValueChange={setOreIntervento}
              variant="bordered"
              type="text"
              inputMode="decimal"
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

          <Textarea
            label="Descrizione Intervento"
            placeholder="Descrivi l'intervento eseguito..."
            value={descrizione}
            onValueChange={setDescrizione}
            variant="bordered"
            minRows={3}
          />

          <Textarea
            label="Materiale Utilizzato"
            placeholder="Elenca il materiale utilizzato..."
            value={materiale}
            onValueChange={setMateriale}
            variant="bordered"
            minRows={2}
          />

          <div className="flex justify-end gap-3 pt-2">
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
        <CardBody className="gap-4 p-4">
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
    </div>
  );
}
