import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp, staggerContainer, collapsibleSection } from './motion';
import {
  Search,
  ClipboardList,
  Wrench,
  PauseCircle,
  CheckCircle2,
  MapPin,
  Filter,
  Clock,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Chip,
  Spinner,
  Card,
  CardBody,
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Select,
  SelectItem,
  Checkbox,
  CheckboxGroup,
  addToast,
} from '@heroui/react';
import { fetchAssistenzeRegistrazioni, fetchRifAssistenze, updateAssistenza } from '../services/api';
import type { AssistenzeFilterParams } from '../services/api';
import { getActiveTimers } from '../services/timerStore';
import {
  AssistenzaRegistrazione,
  mapAssistenzaRegistrazione,
} from '../types/assistenzaRegistrazione';
import ListSkeleton from './skeletons/ListSkeleton';
import ErrorState from './ErrorState';
import AssistenzaMobileCard from './AssistenzaMobileCard';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatNumber(value: number | null): string {
  if (value == null) return '—';
  return value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—';
  return value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

function formatOre(value: number | null): string | null {
  if (value == null || isNaN(value)) return null;
  const total = Math.max(0, value);
  const h = Math.floor(total);
  const m = Math.round((total - h) * 60);
  if (m === 60) return `${h + 1}:00`;
  return `${h}:${String(m).padStart(2, '0')}`;
}

const STATO_REG_ORDER = ['Programmato', 'In lavorazione', 'Sospeso', 'Chiuso'];

const STATO_VALUES: Record<string, number> = {
  'Programmato': 1,
  'In lavorazione': 2,
  'Chiuso': 3,
  'Sospeso': 4,
};

const STATO_TRANSITIONS: Record<string, string[]> = {
  'Programmato': ['In lavorazione'],
  'In lavorazione': ['Sospeso', 'Chiuso'],
  'Sospeso': ['In lavorazione'],
  'Chiuso': [],
};

const statoRegColor: Record<string, 'warning' | 'primary' | 'secondary' | 'danger' | 'success' | 'default'> = {
  'Programmato': 'secondary',
  'In lavorazione': 'primary',
  'Sospeso': 'warning',
  'Chiuso': 'default',
};

const statoRegIcon: Record<string, LucideIcon> = {
  'Programmato': ClipboardList,
  'In lavorazione': Wrench,
  'Sospeso': PauseCircle,
  'Chiuso': CheckCircle2,
};

interface AssistenzeListProps {
  risorsaId: string;
  onOpen: (a: AssistenzaRegistrazione) => void;
  onCreateNew: () => void;
  title?: string;
  defaultStatoFilter?: string[];
}

const PAGE_SIZE = 20;

function ChoicesFilterPanel({
  label,
  choices,
  selected,
  onChange,
  searchable,
}: {
  label: string;
  choices: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  searchable?: boolean;
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    if (!searchable || !q.trim()) return choices;
    const v = q.toLowerCase();
    return choices.filter((c) => c.toLowerCase().includes(v));
  }, [choices, q, searchable]);
  return (
    <div className="p-2 w-64 max-h-80 overflow-auto">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-default-600">{label}</span>
        {selected.size > 0 && (
          <button
            type="button"
            className="text-[11px] text-primary hover:underline"
            onClick={() => onChange(new Set())}
          >
            Pulisci
          </button>
        )}
      </div>
      {searchable && (
        <Input
          size="sm"
          placeholder="Cerca..."
          value={q}
          onValueChange={setQ}
          isClearable
          onClear={() => setQ('')}
          variant="bordered"
          className="mb-2"
        />
      )}
      {filtered.length === 0 ? (
        <p className="text-xs text-default-400 px-1 py-2">Nessun risultato</p>
      ) : (
        <CheckboxGroup
          size="sm"
          value={Array.from(selected)}
          onValueChange={(vals) => onChange(new Set(vals))}
        >
          {filtered.map((c) => (
            <Checkbox key={c} value={c}>
              {c}
            </Checkbox>
          ))}
        </CheckboxGroup>
      )}
    </div>
  );
}

function MapButton({ address }: { address?: string | null }) {
  const has = !!(address && address.trim());
  const href = has ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address!.trim())}` : undefined;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Apri in Google Maps"
      title={has ? address! : 'Indirizzo non disponibile'}
      onClick={(e) => {
        e.stopPropagation();
        if (!has) e.preventDefault();
      }}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
        has
          ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
          : 'bg-default-100 text-default-300 cursor-not-allowed pointer-events-none'
      }`}
    >
      <MapPin className="w-4 h-4" />
    </a>
  );
}

export default function AssistenzeList({ risorsaId, onOpen, onCreateNew, title = 'Le mie registrazioni', defaultStatoFilter = ['Programmato', 'In lavorazione'] }: AssistenzeListProps) {
  // Valore digitato nei campi testo (NON applicato finché l'utente non preme Invio)
  const [search, setSearch] = useState('');
  const [colFilters, setColFilters] = useState<Record<string, string>>({});

  // Valore effettivamente applicato (inviato a Dataverse)
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedColFilters, setAppliedColFilters] = useState<Record<string, string>>({});

  const [tipologiaFilter, setTipologiaFilter] = useState<Set<string>>(new Set());
  const [clienteFilter, setClienteFilter] = useState<Set<string>>(new Set());
  const [statoRegFilter, setStatoRegFilter] = useState<Set<string>>(
    () => new Set(defaultStatoFilter),
  );

  const setColFilter = useCallback((key: string, value: string) => {
    setColFilters((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  }, []);

  // Applica un singolo filtro colonna (Enter o tipo date)
  const applyColFilter = useCallback((key: string, value: string) => {
    setAppliedColFilters((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  }, []);

  // Applica/azzera un filtro colonna (Pulisci o clear button)
  const clearColFilter = useCallback((key: string) => {
    setColFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setAppliedColFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);
  const [loadingAll, setLoadingAll] = useState(false);
  const [sortDescriptor, setSortDescriptor] = useState<{ column: React.Key; direction: 'ascending' | 'descending' }>({
    column: 'data',
    direction: 'descending',
  });
  const sortItems = useCallback((items: AssistenzaRegistrazione[]): AssistenzaRegistrazione[] => {
    const dir = sortDescriptor.direction === 'ascending' ? 1 : -1;
    const col = sortDescriptor.column as string;
    const getKey = (a: AssistenzaRegistrazione): string | number => {
      switch (col) {
        case 'data': return a.data ? new Date(a.data).getTime() : 0;
        case 'cliente': return (a.clienteNome || '').toLowerCase();
        case 'nr': return (a.nr || '').toLowerCase();
        case 'rif': return (a.rifAssistenzaNome || '').toLowerCase();
        default: return 0;
      }
    };
    return [...items].sort((a, b) => {
      const ka = getKey(a);
      const kb = getKey(b);
      if (ka < kb) return -1 * dir;
      if (ka > kb) return 1 * dir;
      return 0;
    });
  }, [sortDescriptor]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Track which assistenze have a running timer in order to highlight their row
  const [runningTimerIds, setRunningTimerIds] = useState<Set<string>>(() => {
    return new Set(
      getActiveTimers()
        .filter((t) => t.status === 'running' && t.assistenzaId)
        .map((t) => t.assistenzaId as string),
    );
  });
  useEffect(() => {
    const refresh = () => {
      setRunningTimerIds(
        new Set(
          getActiveTimers()
            .filter((t) => t.status === 'running' && t.assistenzaId)
            .map((t) => t.assistenzaId as string),
        ),
      );
    };
    window.addEventListener('timers:changed', refresh);
    return () => window.removeEventListener('timers:changed', refresh);
  }, []);

  const statoMutation = useMutation({
    mutationFn: ({ id, stato }: { id: string; stato: number }) =>
      updateAssistenza(id, { phyo_statoreg: stato }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assistenzeRegistrazioni'] });
      addToast({ title: 'Stato aggiornato', color: 'success' });
    },
    onError: () => {
      addToast({ title: 'Errore aggiornamento stato', color: 'danger' });
    },
  });

  const handleQuickStatus = useCallback((id: string, newStato: string) => {
    if (statoMutation.isPending) return;
    const val = STATO_VALUES[newStato];
    if (val != null) statoMutation.mutate({ id, stato: val });
  }, [statoMutation]);

  const renderStatusChip = useCallback((a: AssistenzaRegistrazione) => {
    const transitions = STATO_TRANSITIONS[a.statoReg] || [];
    if (transitions.length === 0) {
      return (
        <Chip size="sm" variant="flat" color={statoRegColor[a.statoReg] || 'default'}>
          {a.statoReg || '—'}
        </Chip>
      );
    }
    const isUpdating =
      statoMutation.isPending && statoMutation.variables?.id === a.id;
    return (
      <Dropdown isDisabled={statoMutation.isPending}>
        <DropdownTrigger>
          <button
            type="button"
            className={`cursor-pointer ${statoMutation.isPending ? 'opacity-60 pointer-events-none' : ''}`}
            disabled={statoMutation.isPending}
            aria-busy={isUpdating}
          >
            <Chip size="sm" variant="flat" color={statoRegColor[a.statoReg] || 'default'} className="cursor-pointer">
              {isUpdating ? (
                <span className="inline-flex items-center gap-1">
                  <Spinner size="sm" color="current" />
                  {a.statoReg || '—'}
                </span>
              ) : (
                <>{a.statoReg || '—'} ▾</>
              )}
            </Chip>
          </button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label="Cambia stato"
          disabledKeys={statoMutation.isPending ? transitions : []}
          onAction={(key) => handleQuickStatus(a.id, key as string)}
        >
          {transitions.map((s) => {
            const Icon = statoRegIcon[s];
            return (
              <DropdownItem key={s} startContent={Icon ? <Icon className="w-4 h-4" /> : null}>
                {s}
              </DropdownItem>
            );
          })}
        </DropdownMenu>
      </Dropdown>
    );
  }, [handleQuickStatus, statoMutation.isPending, statoMutation.variables]);

  const renderHeader = useCallback((key: string, label: string, options?: { choices?: string[]; selected?: Set<string>; onChange?: (next: Set<string>) => void; searchable?: boolean; inputType?: 'text' | 'date' }) => {
    const value = colFilters[key] || '';
    const appliedValue = appliedColFilters[key] || '';
    const hasChoices = !!options?.choices;
    const choiceCount = options?.selected?.size ?? 0;
    const isActive = hasChoices ? choiceCount > 0 : !!appliedValue;
    const isDirty = !hasChoices && value !== appliedValue;
    const inputType = options?.inputType || 'text';
    return (
      <div className="flex items-center justify-between gap-1 w-full text-left">
        <span className="truncate">{label}</span>
        <Popover placement="bottom-end">
          <PopoverTrigger>
            <span
              role="button"
              tabIndex={0}
              aria-label={`Filtra ${label}`}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
              className={`inline-flex items-center justify-center w-5 h-5 rounded hover:bg-default-200 transition-colors cursor-pointer ${isActive ? 'text-primary' : 'text-default-400'}`}
            >
              <Filter className="w-3 h-3" />
            </span>
          </PopoverTrigger>
          <PopoverContent>
            {hasChoices ? (
              <ChoicesFilterPanel
                label={label}
                choices={options!.choices!}
                selected={options!.selected ?? new Set()}
                onChange={options!.onChange!}
                searchable={options?.searchable}
              />
            ) : (
              <div className="p-2 w-56">
                <Input
                  size="sm"
                  autoFocus
                  type={inputType}
                  placeholder={inputType === 'date' ? '' : `Filtra ${label.toLowerCase()} e premi Invio`}
                  value={value}
                  onValueChange={(v) => {
                    setColFilter(key, v);
                    if (inputType === 'date') applyColFilter(key, v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && inputType !== 'date') {
                      e.preventDefault();
                      applyColFilter(key, value);
                    }
                  }}
                  isClearable={inputType !== 'date'}
                  onClear={() => clearColFilter(key)}
                  variant="bordered"
                />
                {inputType !== 'date' && (
                  <div className="flex items-center justify-between mt-1.5 gap-2">
                    <span className="text-[11px] text-default-400">Premi Invio per applicare</span>
                    {isDirty && (
                      <button
                        type="button"
                        className="text-[11px] text-primary hover:underline"
                        onClick={() => applyColFilter(key, value)}
                      >
                        Applica
                      </button>
                    )}
                  </div>
                )}
                {inputType === 'date' && value && (
                  <button
                    type="button"
                    className="mt-1 text-[11px] text-primary hover:underline"
                    onClick={() => clearColFilter(key)}
                  >
                    Pulisci
                  </button>
                )}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    );
  }, [colFilters, appliedColFilters, setColFilter, applyColFilter, clearColFilter]);

  const { data: rifAssistenzeList } = useQuery({
    queryKey: ['rifAssistenze'],
    queryFn: fetchRifAssistenze,
    staleTime: 10 * 60 * 1000,
  });

  // Mappe etichetta -> valori server per filtri choice (cliente / tipologia)
  const clienteNameToIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!rifAssistenzeList) return map;
    for (const r of rifAssistenzeList) {
      const name =
        r['_phyo_cliente_value@OData.Community.Display.V1.FormattedValue'] ?? '';
      const id = r._phyo_cliente_value;
      if (!name || !id) continue;
      if (!map.has(name)) map.set(name, new Set());
      map.get(name)!.add(id);
    }
    return map;
  }, [rifAssistenzeList]);

  const tipologiaLabelToValues = useMemo(() => {
    const map = new Map<string, Set<number>>();
    if (!rifAssistenzeList) return map;
    for (const r of rifAssistenzeList) {
      const label =
        r['phyo_tipologia_assistenza@OData.Community.Display.V1.FormattedValue'] ?? '';
      const value = r.phyo_tipologia_assistenza;
      if (!label || value == null) continue;
      const num = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(num)) continue;
      if (!map.has(label)) map.set(label, new Set());
      map.get(label)!.add(num);
    }
    return map;
  }, [rifAssistenzeList]);

  // Costruisce i filtri da inviare a Dataverse a partire dai valori APPLICATI
  // (search e filtri colonna testo si aggiornano solo quando l'utente preme
  // Invio; multi-select e date si applicano immediatamente).
  const serverFilters = useMemo<AssistenzeFilterParams>(() => {
    const f: AssistenzeFilterParams = {};
    if (appliedSearch.trim()) f.search = appliedSearch.trim();

    if (statoRegFilter.size > 0) {
      const vals: number[] = [];
      for (const s of statoRegFilter) {
        const v = STATO_VALUES[s];
        if (v != null) vals.push(v);
      }
      if (vals.length > 0) f.statoReg = vals;
    }

    if (clienteFilter.size > 0 && clienteNameToIds.size > 0) {
      const ids = new Set<string>();
      for (const name of clienteFilter) {
        const set = clienteNameToIds.get(name);
        if (set) for (const id of set) ids.add(id);
      }
      if (ids.size > 0) f.clientiIds = Array.from(ids);
    }

    if (tipologiaFilter.size > 0 && tipologiaLabelToValues.size > 0) {
      const vals = new Set<number>();
      for (const label of tipologiaFilter) {
        const set = tipologiaLabelToValues.get(label);
        if (set) for (const v of set) vals.add(v);
      }
      if (vals.size > 0) f.tipologie = Array.from(vals);
    }

    if (appliedColFilters.data) f.dataExact = appliedColFilters.data;
    if (appliedColFilters.nr?.trim()) f.nr = appliedColFilters.nr.trim();
    if (appliedColFilters.attne?.trim()) f.attne = appliedColFilters.attne.trim();
    if (appliedColFilters.descrizione?.trim()) f.descrizione = appliedColFilters.descrizione.trim();
    if (appliedColFilters.rif?.trim()) f.rif = appliedColFilters.rif.trim();

    return f;
  }, [
    appliedSearch,
    appliedColFilters,
    statoRegFilter,
    clienteFilter,
    tipologiaFilter,
    clienteNameToIds,
    tipologiaLabelToValues,
  ]);

  const {
    data: pagedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['assistenzeRegistrazioni', risorsaId, serverFilters],
    queryFn: ({ pageParam }) => fetchAssistenzeRegistrazioni(risorsaId, {
      pageSize: PAGE_SIZE,
      skipToken: pageParam ?? undefined,
      filters: serverFilters,
    }),
    getNextPageParam: (lastPage) => lastPage.skipToken ?? undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 5 * 60 * 1000,
  });

  const rawData = useMemo(() => {
    if (!pagedData) return [];
    return pagedData.pages.flatMap(p => p.data);
  }, [pagedData]);

  const totalCount = pagedData?.pages[0]?.totalCount ?? 0;
  const loadedCount = rawData.length;
  const allLoaded = !hasNextPage;

  const loadAll = useCallback(async () => {
    setLoadingAll(true);
    try {
      const allData = await fetchAssistenzeRegistrazioni(risorsaId, { filters: serverFilters });
      queryClient.setQueryData(['assistenzeRegistrazioni', risorsaId, serverFilters], {
        pages: [allData],
        pageParams: [undefined],
      });
    } finally {
      setLoadingAll(false);
    }
  }, [risorsaId, queryClient, serverFilters]);

  // Mobile infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || allLoaded) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage && !loadingAll) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, allLoaded, loadingAll]);


  const assistenze = useMemo(() => {
    const mapped = rawData.map(mapAssistenzaRegistrazione);
    if (!rifAssistenzeList || rifAssistenzeList.length === 0) return mapped;
    const rifIndex = new Map(rifAssistenzeList.map((r) => [r.phyo_assistenzeid, r]));
    return mapped.map((a) => {
      if (!a.rifAssistenzaId) return a;
      const rif = rifIndex.get(a.rifAssistenzaId);
      if (!rif) return a;
      const clienteNome =
        a.clienteNome ||
        rif['_phyo_cliente_value@OData.Community.Display.V1.FormattedValue'] ||
        '';
      const tipologiaAssistenza =
        a.tipologiaAssistenza ||
        rif['phyo_tipologia_assistenza@OData.Community.Display.V1.FormattedValue'] ||
        '';
      const indirizzoAssistenza =
        a.indirizzoAssistenza ||
        rif.phyo_indirizzoassistenza ||
        '';
      if (
        clienteNome === a.clienteNome &&
        tipologiaAssistenza === a.tipologiaAssistenza &&
        indirizzoAssistenza === a.indirizzoAssistenza
      ) {
        return a;
      }
      return {
        ...a,
        clienteId: a.clienteId ?? rif._phyo_cliente_value ?? null,
        clienteNome,
        tipologiaAssistenza,
        indirizzoAssistenza,
      };
    });
  }, [rawData, rifAssistenzeList]);

  const tipologiaOptions = useMemo(() => {
    const set = new Set<string>();
    assistenze.forEach((a) => {
      if (a.tipologiaAssistenza) set.add(a.tipologiaAssistenza);
    });
    return Array.from(set).sort();
  }, [assistenze]);

  const clienteOptions = useMemo(() => {
    const set = new Set<string>();
    assistenze.forEach((a) => {
      if (a.clienteNome) set.add(a.clienteNome);
    });
    return Array.from(set).sort((x, y) => x.localeCompare(y, 'it'));
  }, [assistenze]);

  const filtered = useMemo(() => {
    // I filtri sono ora applicati esclusivamente lato server (Dataverse) via
    // serverFilters/queryKey: qui restituiamo i record così come sono.
    return assistenze;
  }, [assistenze]);

  const globalFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (!a.data && !b.data) return 0;
      if (!a.data) return 1;
      if (!b.data) return -1;
      return new Date(b.data).getTime() - new Date(a.data).getTime();
    });
  }, [filtered]);

  // Riferimento stabile per HeroUI Table + bailout React: ricomputato solo
  // quando cambiano filtro o sortDescriptor.
  const globalSorted = useMemo(() => sortItems(globalFiltered), [sortItems, globalFiltered]);

  // Conteggi per stato (calcolati prima del filtro per stato), per le stats card
  const statoCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const stato of STATO_REG_ORDER) map.set(stato, 0);
    for (const a of assistenze) {
      const k = a.statoReg || 'Altro';
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return STATO_REG_ORDER.map((stato) => ({ stato, count: map.get(stato) ?? 0 }));
  }, [assistenze]);

  const hasActiveFilters =
    !!appliedSearch ||
    !!search ||
    tipologiaFilter.size > 0 ||
    clienteFilter.size > 0 ||
    Object.keys(colFilters).length > 0 ||
    Object.keys(appliedColFilters).length > 0 ||
    statoRegFilter.size > 0;

  const resetFilters = useCallback(() => {
    setSearch('');
    setAppliedSearch('');
    setTipologiaFilter(new Set());
    setClienteFilter(new Set());
    setColFilters({});
    setAppliedColFilters({});
    setStatoRegFilter(new Set());
  }, []);

  // Auto-load tutti i record quando ci sono filtri attivi: ora i filtri sono
  // applicati server-side (Dataverse) tramite la queryKey, quindi non serve
  // più caricare l'intero dataset client-side. Manteniamo loadAll disponibile
  // solo per usi espliciti (es. esportazioni).

  if (isLoading) {
    return <ListSkeleton rows={6} statsCount={4} />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  return (
    <motion.div
      className="flex flex-col gap-3 sm:gap-6"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header + Stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3">
        <div className="min-w-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-wrap">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-foreground">{title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Chip size="sm" variant="flat" color="success">
                {allLoaded ? assistenze.length : `${loadedCount} / ${totalCount}`}
              </Chip>
              <span className="text-default-400 text-xs sm:text-sm">registrazion{assistenze.length === 1 ? 'e' : 'i'}{!allLoaded ? ' caricate' : ' totali'}</span>
            </div>
          </div>
          <motion.div
            className="flex gap-1.5 sm:gap-2 flex-wrap"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {statoCounts.map((g) => (
              <motion.div key={g.stato} variants={fadeInUp}>
                <Card shadow="sm" className="px-2 py-1 sm:px-3 sm:py-1.5">
                  <div className="text-center">
                    <p className="text-base sm:text-xl font-bold leading-tight" style={{ color: `var(--heroui-${statoRegColor[g.stato] || 'default'})` }}>
                      {g.count}
                    </p>
                    <p className="text-[10px] sm:text-tiny text-default-400 leading-tight">{g.stato}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
        <Button color="primary" onPress={onCreateNew} size="sm" className="w-full sm:w-auto">
          + Nuova registrazione
        </Button>
      </div>

      {/* Filtri (sticky in mobile) */}
      <div className="sticky top-[calc(4.5rem+44px)] sm:top-0 z-30 -mx-2 sm:-mx-4 px-2 sm:px-4 py-1.5 sm:py-0 bg-white/90 sm:bg-transparent backdrop-blur sm:backdrop-blur-0 border-b border-default-200/60 sm:border-0 sm:static">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center">
        <Input
          placeholder="Cerca NR, assistenza, descrizione... (Invio per applicare)"
          value={search}
          onValueChange={setSearch}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setAppliedSearch(search);
            }
          }}
          isClearable
          onClear={() => {
            setSearch('');
            setAppliedSearch('');
          }}
          className="sm:flex-1"
          variant="bordered"
          size="sm"
          classNames={{ inputWrapper: 'h-10 min-h-10' }}
          startContent={<Search className="w-4 h-4 text-default-400 flex-shrink-0" />}
          endContent={
            search !== appliedSearch ? (
              <button
                type="button"
                onClick={() => setAppliedSearch(search)}
                className="text-[11px] text-primary hover:underline pr-1"
              >
                Applica
              </button>
            ) : null
          }
        />
        <Select
          aria-label="Filtra per tipologia"
          placeholder="Tipologia"
          selectionMode="multiple"
          selectedKeys={tipologiaFilter}
          onSelectionChange={(keys) => setTipologiaFilter(new Set(Array.from(keys as Set<string>)))}
          className="sm:w-56"
          variant="bordered"
          size="sm"
          classNames={{ trigger: 'h-10 min-h-10' }}
          renderValue={(items) => {
            if (items.length === 0) return <span className="text-default-400">Tipologia</span>;
            if (items.length === 1) return <span className="truncate">{String(items[0].textValue ?? items[0].key ?? '')}</span>;
            return <span>{items.length} tipologie</span>;
          }}
        >
          {tipologiaOptions.map((t) => (
            <SelectItem key={t} textValue={t}>{t}</SelectItem>
          ))}
        </Select>
        <Select
          aria-label="Filtra per stato registrazione"
          placeholder="Stato reg."
          selectionMode="multiple"
          selectedKeys={statoRegFilter}
          onSelectionChange={(keys) => setStatoRegFilter(new Set(Array.from(keys as Set<string>)))}
          className="sm:w-52"
          variant="bordered"
          size="sm"
          classNames={{ trigger: 'h-10 min-h-10' }}
          renderValue={(items) => {
            if (items.length === 0) return <span className="text-default-400">Stato reg.</span>;
            if (items.length === 1) return <span className="truncate">{String(items[0].textValue ?? items[0].key ?? '')}</span>;
            return <span>{items.length} stati</span>;
          }}
        >
          {STATO_REG_ORDER.map((s) => (
            <SelectItem key={s} textValue={s}>{s}</SelectItem>
          ))}
        </Select>
        <Button
          size="sm"
          variant="flat"
          color={hasActiveFilters ? 'danger' : 'default'}
          isDisabled={!hasActiveFilters}
          className="h-10"
          startContent={<X className="w-4 h-4" />}
          onPress={resetFilters}
        >
          Reset filtri
        </Button>
      </div>
      {/* Mobile sort selector */}
      <div className="flex sm:hidden gap-2 mt-2">
        <Select
          aria-label="Ordina per"
          size="sm"
          variant="bordered"
          className="flex-1"
          classNames={{ trigger: 'h-9 min-h-9' }}
          selectedKeys={[sortDescriptor.column as string]}
          onSelectionChange={(keys) => {
            const col = Array.from(keys as Set<string>)[0];
            if (col) setSortDescriptor((prev) => ({ ...prev, column: col }));
          }}
          renderValue={(items) => {
            const labels: Record<string, string> = { data: 'Data', nr: 'NR', cliente: 'Cliente', rif: 'Rif. Assistenza' };
            const k = String(items[0]?.key ?? '');
            return <span>Ordina: {labels[k] || k}</span>;
          }}
        >
          <SelectItem key="data" textValue="Data">Data</SelectItem>
          <SelectItem key="nr" textValue="NR">NR</SelectItem>
          <SelectItem key="cliente" textValue="Cliente">Cliente</SelectItem>
          <SelectItem key="rif" textValue="Rif. Assistenza">Rif. Assistenza</SelectItem>
        </Select>
        <Button
          size="sm"
          variant="flat"
          className="h-9"
          onPress={() =>
            setSortDescriptor((prev) => ({
              ...prev,
              direction: prev.direction === 'ascending' ? 'descending' : 'ascending',
            }))
          }
          aria-label="Inverti ordine"
        >
          {sortDescriptor.direction === 'ascending' ? '↑ Asc' : '↓ Desc'}
        </Button>
      </div>
      </div>

      {/* Lista globale */}
      {globalFiltered.length === 0 ? (
        <>
          {/* Mobile empty state */}
          <Card shadow="sm" className="bg-white sm:hidden">
            <CardBody className="flex flex-col items-center py-10 gap-2">
              <p className="text-default-400 text-sm">Nessuna assistenza trovata</p>
              {hasActiveFilters && (
                <Button size="sm" variant="flat" onPress={resetFilters}>
                  Reset filtri
                </Button>
              )}
            </CardBody>
          </Card>

          {/* Desktop: mantieni intestazione tabella */}
          <Card shadow="sm" className="bg-white hidden sm:block overflow-hidden">
            <Table
              aria-label="Assistenze globali (vuota)"
              removeWrapper
              selectionMode="none"
              sortDescriptor={sortDescriptor as any}
              onSortChange={(d) => setSortDescriptor(d as any)}
              classNames={{
                th: 'bg-default-50 text-default-600 text-xs uppercase tracking-wider text-left align-top py-2',
                td: 'py-2.5',
              }}
            >
              <TableHeader>
                <TableColumn width={70}>{''}</TableColumn>
                <TableColumn key="data" allowsSorting width={110}>{renderHeader('data', 'DATA', { inputType: 'date' })}</TableColumn>
                <TableColumn key="nr" allowsSorting width={90}>{renderHeader('nr', 'NR')}</TableColumn>
                <TableColumn key="cliente" allowsSorting minWidth={120}>{renderHeader('cliente', 'CLIENTE', { choices: clienteOptions, selected: clienteFilter, onChange: setClienteFilter, searchable: true })}</TableColumn>
                <TableColumn minWidth={120}>{renderHeader('tipologia', 'TIPOLOGIA', { choices: tipologiaOptions, selected: tipologiaFilter, onChange: setTipologiaFilter })}</TableColumn>
                <TableColumn key="rif" allowsSorting minWidth={100}>{renderHeader('rif', 'RIF. ASSISTENZA')}</TableColumn>
                <TableColumn width={130}>{renderHeader('statoreg', 'STATO REG', { choices: STATO_REG_ORDER, selected: statoRegFilter, onChange: setStatoRegFilter })}</TableColumn>
                <TableColumn minWidth={90}>{renderHeader('attne', 'ATT.NE')}</TableColumn>
                <TableColumn minWidth={150}>{renderHeader('descrizione', 'DESCRIZIONE')}</TableColumn>
              </TableHeader>
              <TableBody emptyContent={
                <div className="flex flex-col items-center gap-2 py-10">
                  <p className="text-default-400 text-sm">Nessuna assistenza trovata</p>
                  {hasActiveFilters && (
                    <Button size="sm" variant="flat" onPress={resetFilters} startContent={<X className="w-4 h-4" />}>
                      Reset filtri
                    </Button>
                  )}
                </div>
              }>
                {[]}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : (
        <>
          {/* Mobile cards */}
          <motion.div
            className="flex flex-col gap-2 sm:hidden"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {globalSorted.map((a) => (
              <AssistenzaMobileCard
                key={a.id}
                a={a}
                isRunning={runningTimerIds.has(a.id)}
                statusChip={renderStatusChip(a)}
                onOpen={onOpen}
              />
            ))}
          </motion.div>

          {/* Desktop table */}
          <Card shadow="sm" className="bg-white hidden sm:block overflow-hidden">
            <Table
              aria-label="Assistenze globali"
              removeWrapper
              selectionMode="none"
              sortDescriptor={sortDescriptor as any}
              onSortChange={(d) => setSortDescriptor(d as any)}
              classNames={{
                th: 'bg-default-50 text-default-600 text-xs uppercase tracking-wider text-left align-top py-2',
                td: 'py-2.5',
              }}
            >
              <TableHeader>
                <TableColumn width={70}>{''}</TableColumn>
                <TableColumn key="data" allowsSorting width={110}>{renderHeader('data', 'DATA', { inputType: 'date' })}</TableColumn>
                <TableColumn key="nr" allowsSorting width={90}>{renderHeader('nr', 'NR')}</TableColumn>
                <TableColumn key="cliente" allowsSorting minWidth={120}>{renderHeader('cliente', 'CLIENTE', { choices: clienteOptions, selected: clienteFilter, onChange: setClienteFilter, searchable: true })}</TableColumn>
                <TableColumn minWidth={120}>{renderHeader('tipologia', 'TIPOLOGIA', { choices: tipologiaOptions, selected: tipologiaFilter, onChange: setTipologiaFilter })}</TableColumn>
                <TableColumn key="rif" allowsSorting minWidth={100}>{renderHeader('rif', 'RIF. ASSISTENZA')}</TableColumn>
                <TableColumn width={130}>{renderHeader('statoreg', 'STATO REG', { choices: STATO_REG_ORDER, selected: statoRegFilter, onChange: setStatoRegFilter })}</TableColumn>
                <TableColumn minWidth={90}>{renderHeader('attne', 'ATT.NE')}</TableColumn>
                <TableColumn minWidth={150}>{renderHeader('descrizione', 'DESCRIZIONE')}</TableColumn>
              </TableHeader>
              <TableBody>
                {globalSorted.map((a) => (
                  <TableRow key={a.id} className={`transition-colors ${runningTimerIds.has(a.id) ? '!bg-[#fff8e8] hover:!bg-[#fdedc7]' : 'hover:bg-default-50'}`}>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" color="primary" variant="flat" onPress={() => onOpen(a)}>Apri</Button>
                        <MapButton address={a.indirizzoAssistenza} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-default-600">{formatDate(a.data)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-white bg-centoraggi-teal px-2 py-0.5 rounded">
                        {a.nr}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{a.clienteNome || '—'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-default-600">{a.tipologiaAssistenza || '—'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{a.rifAssistenzaNome || '—'}</span>
                    </TableCell>
                    <TableCell>
                      {renderStatusChip(a)}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{a.attne || '—'}</span>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-default-600 truncate max-w-[260px]" title={a.descrizioneIntervento}>{a.descrizioneIntervento || '—'}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {/* Pagination controls */}
      {!allLoaded && (
        <>
          {/* Mobile: sentinel for infinite scroll + Carica tutto */}
          <div className="sm:hidden flex flex-col items-center gap-3">
            <div ref={sentinelRef} className="h-4" />
            {isFetchingNextPage && <Spinner size="sm" color="primary" />}
            <Button
              size="sm"
              variant="flat"
              color="secondary"
              isLoading={loadingAll}
              isDisabled={loadingAll || isFetchingNextPage}
              onPress={loadAll}
            >
              Carica tutto ({totalCount - loadedCount} rimanenti)
            </Button>
          </div>

          {/* Desktop: Carica più dati + Carica tutto */}
          <div className="hidden sm:flex justify-center gap-3">
            <Button
              color="primary"
              variant="flat"
              isLoading={isFetchingNextPage}
              isDisabled={isFetchingNextPage || loadingAll}
              onPress={() => fetchNextPage()}
            >
              Carica più dati
            </Button>
            <Button
              variant="flat"
              color="secondary"
              isLoading={loadingAll}
              isDisabled={loadingAll || isFetchingNextPage}
              onPress={loadAll}
            >
              Carica tutto ({totalCount - loadedCount} rimanenti)
            </Button>
          </div>
        </>
      )}
      {(isFetchingNextPage || loadingAll) && allLoaded === false && (
        <div className="hidden sm:flex justify-center">
          <Spinner size="sm" color="primary" />
        </div>
      )}
    </motion.div>
  );
}
