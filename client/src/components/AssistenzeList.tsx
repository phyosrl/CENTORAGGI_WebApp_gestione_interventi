import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp, staggerContainer, collapsibleSection } from './motion';
import {
  Search,
  ChevronDown,
  ClipboardList,
  Wrench,
  PauseCircle,
  CheckCircle2,
  FileText,
  MapPin,
  Filter,
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
  addToast,
} from '@heroui/react';
import { fetchAssistenzeRegistrazioni, fetchRifAssistenze, updateAssistenza } from '../services/api';
import { getActiveTimers } from '../services/timerStore';
import {
  AssistenzaRegistrazioneRaw,
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
}

const PAGE_SIZE = 20;

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

export default function AssistenzeList({ risorsaId, onOpen, onCreateNew }: AssistenzeListProps) {
  const [search, setSearch] = useState('');
  const [tipologiaFilter, setTipologiaFilter] = useState<Set<string>>(new Set());
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const setColFilter = useCallback((key: string, value: string) => {
    setColFilters((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  }, []);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'global' | 'grouped' | 'manutenzioni'>('grouped');
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
    return (
      <Dropdown>
        <DropdownTrigger>
          <button type="button" className="cursor-pointer">
            <Chip size="sm" variant="flat" color={statoRegColor[a.statoReg] || 'default'} className="cursor-pointer">
              {a.statoReg || '—'} ▾
            </Chip>
          </button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label="Cambia stato"
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
  }, [handleQuickStatus]);

  const renderHeader = useCallback((key: string, label: string) => {
    const value = colFilters[key] || '';
    return (
      <div className="flex items-center justify-between gap-1 w-full">
        <span>{label}</span>
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
              className={`inline-flex items-center justify-center w-5 h-5 rounded hover:bg-default-200 transition-colors cursor-pointer ${value ? 'text-primary' : 'text-default-400'}`}
            >
              <Filter className="w-3 h-3" />
            </span>
          </PopoverTrigger>
          <PopoverContent>
            <div className="p-2 w-56">
              <Input
                size="sm"
                autoFocus
                placeholder={`Filtra ${label.toLowerCase()}...`}
                value={value}
                onValueChange={(v) => setColFilter(key, v)}
                isClearable
                onClear={() => setColFilter(key, '')}
                variant="bordered"
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }, [colFilters, setColFilter]);

  const {
    data: pagedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['assistenzeRegistrazioni', risorsaId],
    queryFn: ({ pageParam }) => fetchAssistenzeRegistrazioni(risorsaId, {
      pageSize: PAGE_SIZE,
      skipToken: pageParam ?? undefined,
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
      const allData = await fetchAssistenzeRegistrazioni(risorsaId);
      queryClient.setQueryData(['assistenzeRegistrazioni', risorsaId], {
        pages: [allData],
        pageParams: [undefined],
      });
    } finally {
      setLoadingAll(false);
    }
  }, [risorsaId, queryClient]);

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

  const { data: rifAssistenzeList } = useQuery({
    queryKey: ['rifAssistenze'],
    queryFn: fetchRifAssistenze,
    staleTime: 10 * 60 * 1000,
  });

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
      if (clienteNome === a.clienteNome && tipologiaAssistenza === a.tipologiaAssistenza) {
        return a;
      }
      return {
        ...a,
        clienteId: a.clienteId ?? rif._phyo_cliente_value ?? null,
        clienteNome,
        tipologiaAssistenza,
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

  const filtered = useMemo(() => {
    let result = assistenze;
    if (tipologiaFilter.size > 0) {
      result = result.filter((a) => tipologiaFilter.has(a.tipologiaAssistenza));
    }
    // Filtri per-colonna (contains, case-insensitive)
    const entries = Object.entries(colFilters).filter(([, v]) => v && v.trim());
    if (entries.length > 0) {
      result = result.filter((a) => {
        for (const [key, raw] of entries) {
          const v = raw.toLowerCase();
          let cell = '';
          switch (key) {
            case 'data': cell = formatDate(a.data).toLowerCase(); break;
            case 'nr': cell = a.nr.toLowerCase(); break;
            case 'cliente': cell = a.clienteNome.toLowerCase(); break;
            case 'tipologia': cell = a.tipologiaAssistenza.toLowerCase(); break;
            case 'rif': cell = a.rifAssistenzaNome.toLowerCase(); break;
            case 'statoreg': cell = (a.statoReg || '').toLowerCase(); break;
            case 'attne': cell = a.attne.toLowerCase(); break;
            case 'descrizione': cell = a.descrizioneIntervento.toLowerCase(); break;
            default: cell = '';
          }
          if (!cell.includes(v)) return false;
        }
        return true;
      });
    }
    if (!search) return result;
    const q = search.toLowerCase();
    return result.filter(
      (a) =>
        a.nr.toLowerCase().includes(q) ||
        a.rifAssistenzaNome.toLowerCase().includes(q) ||
        a.clienteNome.toLowerCase().includes(q) ||
        a.tipologiaAssistenza.toLowerCase().includes(q) ||
        a.attne.toLowerCase().includes(q) ||
        a.descrizioneIntervento.toLowerCase().includes(q) ||
        a.materialeUtilizzato.toLowerCase().includes(q)
    );
  }, [assistenze, search, tipologiaFilter, colFilters]);

  const globalFiltered = useMemo(() => {
    return filtered
      .filter((a) => a.statoReg !== 'Chiuso')
      .sort((a, b) => {
        if (!a.data && !b.data) return 0;
        if (!a.data) return 1;
        if (!b.data) return -1;
        return new Date(b.data).getTime() - new Date(a.data).getTime();
      });
  }, [filtered]);

  // Riferimento stabile per HeroUI Table + bailout React: ricomputato solo
  // quando cambiano filtro o sortDescriptor.
  const globalSorted = useMemo(() => sortItems(globalFiltered), [sortItems, globalFiltered]);

  const MANUTENZIONI_STATI = ['Programmato', 'In lavorazione'];

  const manutenzioniGrouped = useMemo(() => {
    const map = new Map<string, AssistenzaRegistrazione[]>();
    for (const stato of MANUTENZIONI_STATI) {
      map.set(stato, []);
    }
    for (const a of filtered) {
      if (MANUTENZIONI_STATI.includes(a.statoReg)) {
        map.get(a.statoReg)!.push(a);
      }
    }
    for (const items of map.values()) {
      items.sort((a, b) => {
        if (!a.data && !b.data) return 0;
        if (!a.data) return 1;
        if (!b.data) return -1;
        return new Date(b.data).getTime() - new Date(a.data).getTime();
      });
    }
    return MANUTENZIONI_STATI.map(stato => ({ stato, items: map.get(stato) || [] }));
  }, [filtered]);

  const grouped = useMemo(() => {
    const map = new Map<string, AssistenzaRegistrazione[]>();
    for (const stato of STATO_REG_ORDER) {
      map.set(stato, []);
    }
    for (const a of filtered) {
      const key = a.statoReg || 'Altro';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    // Sort each group by data descending
    for (const items of map.values()) {
      items.sort((a, b) => {
        if (!a.data && !b.data) return 0;
        if (!a.data) return 1;
        if (!b.data) return -1;
        return new Date(b.data).getTime() - new Date(a.data).getTime();
      });
    }
    // Return all predefined groups (even if empty), in order
    const result: { stato: string; items: AssistenzaRegistrazione[] }[] = [];
    for (const stato of STATO_REG_ORDER) {
      result.push({ stato, items: map.get(stato) || [] });
    }
    // Add any extra stati not in the predefined order
    for (const [stato, items] of map) {
      if (!STATO_REG_ORDER.includes(stato) && items.length > 0) {
        result.push({ stato, items });
      }
    }
    return result;
  }, [filtered]);

  const toggleGroup = useCallback((stato: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(stato)) {
        next.delete(stato);
      } else {
        next.add(stato);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedGroups(new Set(grouped.map((g) => g.stato)));
  }, [grouped]);

  const collapseAll = useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  if (isLoading) {
    return <ListSkeleton rows={6} statsCount={4} />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  return (
    <motion.div
      className="flex flex-col gap-4 sm:gap-6"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header + Stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Le mie registrazioni</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Chip size="sm" variant="flat" color="success">
              {allLoaded ? assistenze.length : `${loadedCount} / ${totalCount}`}
            </Chip>
            <span className="text-default-400 text-sm">registrazion{assistenze.length === 1 ? 'e' : 'i'}{!allLoaded ? ' caricate' : ' totali'}</span>
          </div>
        </div>
        <Button color="primary" onPress={onCreateNew} size="sm">
          + Crea nuova registrazione
        </Button>
      </div>

      {/* View mode toggle + filtri (sticky in mobile) */}
      <div className="sticky top-0 z-30 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 sm:py-0 bg-white/80 sm:bg-transparent backdrop-blur sm:backdrop-blur-0 border-b border-default-200/60 sm:border-0 sm:static">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex gap-1 bg-default-100 rounded-lg p-1">
          <Button
            size="sm"
            variant={viewMode === 'global' ? 'solid' : 'light'}
            color={viewMode === 'global' ? 'primary' : 'default'}
            onPress={() => setViewMode('global')}
          >
            Globale
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'grouped' ? 'solid' : 'light'}
            color={viewMode === 'grouped' ? 'primary' : 'default'}
            onPress={() => setViewMode('grouped')}
          >
            Raggruppata
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'manutenzioni' ? 'solid' : 'light'}
            color={viewMode === 'manutenzioni' ? 'secondary' : 'default'}
            onPress={() => setViewMode('manutenzioni')}
          >
            Manutenzioni
          </Button>
        </div>
        <Input
          placeholder="Cerca NR, assistenza, descrizione..."
          value={search}
          onValueChange={setSearch}
          isClearable
          onClear={() => setSearch('')}
          className="sm:flex-1"
          variant="bordered"
          size="sm"
          classNames={{ inputWrapper: 'h-10 min-h-10' }}
          startContent={<Search className="w-4 h-4 text-default-400 flex-shrink-0" />}
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
        {tipologiaFilter.size > 0 && (
          <Button
            size="sm"
            variant="flat"
            color="danger"
            className="h-10"
            onPress={() => setTipologiaFilter(new Set())}
          >
            Reset tipologia
          </Button>
        )}
        {(viewMode === 'grouped' || viewMode === 'manutenzioni') && (
          <div className="flex gap-2">
            <Button size="sm" variant="flat" className="h-10" onPress={expandAll}>
              Espandi tutto
            </Button>
            <Button size="sm" variant="flat" className="h-10" onPress={collapseAll}>
              Comprimi tutto
            </Button>
          </div>
        )}
      </div>
      </div>

      {/* Stats cards */}
      <motion.div
        className="flex gap-2 flex-wrap"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {grouped
          .filter((g) => viewMode !== 'manutenzioni' || (g.stato !== 'Chiuso' && g.stato !== 'Sospeso'))
          .map((g) => (
          <motion.div key={g.stato} variants={fadeInUp}>
            <Card shadow="sm" className="px-3 py-1.5">
              <div className="text-center">
                <p className="text-lg sm:text-xl font-bold" style={{ color: `var(--heroui-${statoRegColor[g.stato] || 'default'})` }}>
                  {g.items.length}
                </p>
                <p className="text-tiny text-default-400">{g.stato}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Global view */}
      {viewMode === 'global' && (
        <>
          {globalFiltered.length === 0 ? (
            <Card shadow="sm" className="bg-white">
              <CardBody className="flex flex-col items-center py-10 gap-2">
                <p className="text-default-400 text-sm">Nessuna assistenza attiva trovata</p>
                {search && (
                  <Button size="sm" variant="flat" onPress={() => setSearch('')}>
                    Resetta ricerca
                  </Button>
                )}
              </CardBody>
            </Card>
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
                    th: 'bg-default-50 text-default-600 text-xs uppercase tracking-wider',
                    td: 'py-2.5',
                  }}
                >
                  <TableHeader>
                    <TableColumn width={70} align="center">{''}</TableColumn>
                    <TableColumn key="data" allowsSorting width={110}>{renderHeader('data', 'DATA')}</TableColumn>
                    <TableColumn key="nr" allowsSorting width={90}>{renderHeader('nr', 'NR')}</TableColumn>
                    <TableColumn key="cliente" allowsSorting minWidth={120}>{renderHeader('cliente', 'CLIENTE')}</TableColumn>
                    <TableColumn minWidth={120}>{renderHeader('tipologia', 'TIPOLOGIA')}</TableColumn>
                    <TableColumn key="rif" allowsSorting minWidth={100}>{renderHeader('rif', 'RIF. ASSISTENZA')}</TableColumn>
                    <TableColumn width={130}>{renderHeader('statoreg', 'STATO REG')}</TableColumn>
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
        </>
      )}

      {/* Grouped view */}
      {viewMode === 'grouped' && (
        grouped.length === 0 ? (
        <Card shadow="sm" className="bg-white">
          <CardBody className="flex flex-col items-center py-10 gap-2">
            <p className="text-default-400 text-sm">Nessuna registrazione trovata</p>
            {search && (
              <Button size="sm" variant="flat" onPress={() => setSearch('')}>
                Resetta ricerca
              </Button>
            )}
          </CardBody>
        </Card>
      ) : (
        grouped.map((group) => {
          const isExpanded = expandedGroups.has(group.stato);
          const color = statoRegColor[group.stato] || 'default';
          const Icon = statoRegIcon[group.stato] || FileText;

          return (
            <Card key={group.stato} shadow="sm" className="bg-white overflow-hidden">
              {/* Collapsible header */}
              <button
                type="button"
                onClick={() => toggleGroup(group.stato)}
                className="w-full flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 hover:bg-default-50 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-default-500" />
                  <div>
                    <span className="font-semibold text-foreground text-sm sm:text-base">{group.stato}</span>
                    <Chip size="sm" variant="flat" color={color} className="ml-2">
                      {group.items.length}
                    </Chip>
                  </div>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-default-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Expanded content */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key="content"
                    variants={collapsibleSection}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    className="overflow-hidden"
                  >
                  {group.items.length === 0 ? (
                    <div className="px-4 py-8 text-center text-default-400 text-sm">
                      Non ci sono assistenze in questo stato
                    </div>
                  ) : (
                  <>
                  {/* Mobile cards */}
                  <div className="flex flex-col gap-2 p-3 sm:hidden">
                    {group.items.map((a) => (
                      <div key={a.id} className={`rounded-lg p-3 border ${runningTimerIds.has(a.id) ? 'bg-[#fff8e8] border-warning/30' : 'border-default-200'}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono text-xs text-white bg-centoraggi-teal px-2 py-0.5 rounded">
                              {a.nr}
                            </span>
                            <span className="text-sm font-medium ml-2">{a.rifAssistenzaNome || '—'}</span>
                          </div>
                          {renderStatusChip(a)}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
                          <div>
                            <span className="text-default-400 text-xs">Data</span>
                            <p className="text-default-600">{formatDate(a.data)}</p>
                          </div>
                          <div>
                            <span className="text-default-400 text-xs">Att.ne</span>
                            <p className="text-default-600">{a.attne || '—'}</p>
                          </div>
                          <div>
                            <span className="text-default-400 text-xs">Ore Int.</span>
                            <p className="font-medium tabular-nums">{formatNumber(a.oreIntervento)}</p>
                          </div>
                          <div>
                            <span className="text-default-400 text-xs">Ore</span>
                            <p className="font-medium tabular-nums">{formatNumber(a.ore)}</p>
                          </div>
                        </div>
                        <div className="text-sm mt-1">
                          <span className="text-default-400 text-xs">Rif. Assistenza</span>
                          <p className="text-default-600">{a.rifAssistenzaNome || '—'}</p>
                        </div>
                        <div className="text-sm mt-1">
                          <span className="text-default-400 text-xs">Tipologia</span>
                          <p className="text-default-600">{a.tipologiaAssistenza || '—'}</p>
                        </div>
                        {a.descrizioneIntervento && (
                          <div className="text-sm mt-1">
                            <span className="text-default-400 text-xs">Descrizione</span>
                            <p className="text-default-600">{a.descrizioneIntervento}</p>
                          </div>
                        )}
                        {a.materialeUtilizzato && (
                          <div className="text-sm mt-1">
                            <span className="text-default-400 text-xs">Materiale</span>
                            <p className="text-default-600">{a.materialeUtilizzato}</p>
                          </div>
                        )}
                        <div className="flex justify-between items-center mt-2">
                          <div className="flex gap-1">
                            <Button size="sm" color="primary" variant="flat" onPress={() => onOpen(a)}>Apri</Button>
                            <MapButton address={a.indirizzoAssistenza} />
                          </div>
                          <span className="text-sm font-medium tabular-nums">{formatCurrency(a.totale)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden sm:block">
                    <Table
                      aria-label={`Registrazioni ${group.stato}`}
                      removeWrapper
                      selectionMode="none"
                      sortDescriptor={sortDescriptor as any}
                      onSortChange={(d) => setSortDescriptor(d as any)}
                      classNames={{
                        th: 'bg-default-50 text-default-600 text-xs uppercase tracking-wider',
                        td: 'py-2.5',
                      }}
                    >
                      <TableHeader>
                        <TableColumn width={70} align="center">{''}</TableColumn>
                        <TableColumn key="data" allowsSorting width={110}>{renderHeader('data', 'DATA')}</TableColumn>
                        <TableColumn key="nr" allowsSorting width={90}>{renderHeader('nr', 'NR')}</TableColumn>
                        <TableColumn key="cliente" allowsSorting minWidth={120}>{renderHeader('cliente', 'CLIENTE')}</TableColumn>
                        <TableColumn minWidth={120}>{renderHeader('tipologia', 'TIPOLOGIA')}</TableColumn>
                        <TableColumn key="rif" allowsSorting minWidth={100}>{renderHeader('rif', 'RIF. ASSISTENZA')}</TableColumn>
                        <TableColumn minWidth={90}>{renderHeader('attne', 'ATT.NE')}</TableColumn>
                        <TableColumn minWidth={150}>{renderHeader('descrizione', 'DESCRIZIONE')}</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {sortItems(group.items).map((a) => (
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
                              <span className="text-sm">{a.attne || '—'}</span>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm text-default-600 truncate max-w-[260px]" title={a.descrizioneIntervento}>{a.descrizioneIntervento || '—'}</p>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  </>
                  )}
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })
      ))}
      {/* Manutenzioni Programmate view */}
      {viewMode === 'manutenzioni' && (
        manutenzioniGrouped.every(g => g.items.length === 0) ? (
          <Card shadow="sm" className="bg-white">
            <CardBody className="flex flex-col items-center py-10 gap-2">
              <p className="text-default-400 text-sm">Nessuna manutenzione trovata</p>
              {search && (
                <Button size="sm" variant="flat" onPress={() => setSearch('')}>
                  Resetta ricerca
                </Button>
              )}
            </CardBody>
          </Card>
        ) : (
          manutenzioniGrouped.map((group) => {
            const isExpanded = expandedGroups.has(group.stato);
            const color = statoRegColor[group.stato] || 'default';
            const Icon = statoRegIcon[group.stato] || FileText;

            return (
              <Card key={group.stato} shadow="sm" className="bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.stato)}
                  className="w-full flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 hover:bg-default-50 transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-default-500" />
                    <div>
                      <span className="font-semibold text-foreground text-sm sm:text-base">{group.stato}</span>
                      <Chip size="sm" variant="flat" color={color} className="ml-2">
                        {group.items.length}
                      </Chip>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-default-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key="content"
                    variants={collapsibleSection}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    className="overflow-hidden"
                  >
                    {group.items.length === 0 ? (
                      <div className="px-4 py-8 text-center text-default-400 text-sm">
                        Non ci sono assistenze in questo stato
                      </div>
                    ) : (
                    <>
                    {/* Mobile cards */}
                    <div className="flex flex-col gap-2 p-3 sm:hidden">
                      {group.items.map((a) => (
                        <div key={a.id} className={`rounded-lg p-3 border ${runningTimerIds.has(a.id) ? 'bg-[#fff8e8] border-warning/30' : 'border-default-200'}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-mono text-xs text-white bg-centoraggi-teal px-2 py-0.5 rounded">
                                {a.nr}
                              </span>
                              <span className="text-sm font-medium ml-2">{a.rifAssistenzaNome || '—'}</span>
                            </div>
                            {renderStatusChip(a)}
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
                            <div>
                              <span className="text-default-400 text-xs">Data</span>
                              <p className="text-default-600">{formatDate(a.data)}</p>
                            </div>
                            <div>
                              <span className="text-default-400 text-xs">Att.ne</span>
                              <p className="text-default-600">{a.attne || '—'}</p>
                            </div>
                            <div>
                              <span className="text-default-400 text-xs">Ore Int.</span>
                              <p className="font-medium tabular-nums">{formatNumber(a.oreIntervento)}</p>
                            </div>
                            <div>
                              <span className="text-default-400 text-xs">Ore</span>
                              <p className="font-medium tabular-nums">{formatNumber(a.ore)}</p>
                            </div>
                          </div>
                          <div className="text-sm mt-1">
                            <span className="text-default-400 text-xs">Tipologia</span>
                            <p className="text-default-600">{a.tipologiaAssistenza || '—'}</p>
                          </div>
                          {a.descrizioneIntervento && (
                            <div className="text-sm mt-1">
                              <span className="text-default-400 text-xs">Descrizione</span>
                              <p className="text-default-600">{a.descrizioneIntervento}</p>
                            </div>
                          )}
                          {a.materialeUtilizzato && (
                            <div className="text-sm mt-1">
                              <span className="text-default-400 text-xs">Materiale</span>
                              <p className="text-default-600">{a.materialeUtilizzato}</p>
                            </div>
                          )}
                          <div className="flex justify-between items-center mt-2">
                            <div className="flex gap-1">
                              <Button size="sm" color="primary" variant="flat" onPress={() => onOpen(a)}>Apri</Button>
                              <MapButton address={a.indirizzoAssistenza} />
                            </div>
                            <span className="text-sm font-medium tabular-nums">{formatCurrency(a.totale)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block">
                      <Table
                        aria-label={`Manutenzioni ${group.stato}`}
                        removeWrapper
                        selectionMode="none"
                        sortDescriptor={sortDescriptor as any}
                        onSortChange={(d) => setSortDescriptor(d as any)}
                        classNames={{
                          th: 'bg-default-50 text-default-600 text-xs uppercase tracking-wider',
                          td: 'py-2.5',
                        }}
                      >
                        <TableHeader>
                          <TableColumn width={70} align="center">{''}</TableColumn>
                          <TableColumn key="data" allowsSorting width={110}>{renderHeader('data', 'DATA')}</TableColumn>
                          <TableColumn key="nr" allowsSorting width={90}>{renderHeader('nr', 'NR')}</TableColumn>
                          <TableColumn key="cliente" allowsSorting minWidth={120}>{renderHeader('cliente', 'CLIENTE')}</TableColumn>
                          <TableColumn minWidth={120}>{renderHeader('tipologia', 'TIPOLOGIA')}</TableColumn>
                          <TableColumn key="rif" allowsSorting minWidth={100}>{renderHeader('rif', 'RIF. ASSISTENZA')}</TableColumn>
                          <TableColumn minWidth={90}>{renderHeader('attne', 'ATT.NE')}</TableColumn>
                          <TableColumn minWidth={150}>{renderHeader('descrizione', 'DESCRIZIONE')}</TableColumn>
                        </TableHeader>
                        <TableBody>
                          {sortItems(group.items).map((a) => (
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
                                <span className="text-sm">{a.attne || '—'}</span>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm text-default-600 truncate max-w-[260px]" title={a.descrizioneIntervento}>{a.descrizioneIntervento || '—'}</p>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    </>
                    )}
                  </motion.div>
                )}
                </AnimatePresence>
              </Card>
            );
          })
        )
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
              onPress={() => fetchNextPage()}
            >
              Carica più dati
            </Button>
            <Button
              variant="flat"
              color="secondary"
              isLoading={loadingAll}
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
