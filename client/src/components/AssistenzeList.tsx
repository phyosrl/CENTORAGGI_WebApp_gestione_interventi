import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Select,
  SelectItem,
  addToast,
} from '@heroui/react';
import { fetchAssistenzeRegistrazioni, updateAssistenza } from '../services/api';
import {
  AssistenzaRegistrazioneRaw,
  AssistenzaRegistrazione,
  mapAssistenzaRegistrazione,
} from '../types/assistenzaRegistrazione';

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

const statoRegIcon: Record<string, string> = {
  'Programmato': '📋',
  'In lavorazione': '🔧',
  'Sospeso': '⏸️',
  'Chiuso': '✅',
};

interface AssistenzeListProps {
  risorsaId: string;
  onOpen: (a: AssistenzaRegistrazione) => void;
  onCreateNew: () => void;
}

const PAGE_SIZE = 20;

export default function AssistenzeList({ risorsaId, onOpen, onCreateNew }: AssistenzeListProps) {
  const [search, setSearch] = useState('');
  const [tipologiaFilter, setTipologiaFilter] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'global' | 'grouped' | 'manutenzioni'>('grouped');
  const [loadingAll, setLoadingAll] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

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
          {transitions.map((s) => (
            <DropdownItem key={s} startContent={<span>{statoRegIcon[s]}</span>}>
              {s}
            </DropdownItem>
          ))}
        </DropdownMenu>
      </Dropdown>
    );
  }, [handleQuickStatus]);

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

  const assistenze = useMemo(() => {
    return rawData.map(mapAssistenzaRegistrazione);
  }, [rawData]);

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
  }, [assistenze, search, tipologiaFilter]);

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
    return (
      <Card className="shadow-md">
        <CardBody className="flex flex-col items-center justify-center py-24 gap-4">
          <Spinner size="lg" color="primary" />
          <p className="text-default-400 text-sm">Caricamento registrazioni...</p>
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-md border-danger/20">
        <CardBody className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center text-3xl">
            !
          </div>
          <div className="text-center">
            <p className="text-danger font-semibold text-lg">Errore di caricamento</p>
            <p className="text-default-400 text-sm mt-1">{(error as Error).message}</p>
          </div>
          <Button color="primary" variant="flat" onPress={() => refetch()}>
            Riprova
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
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

      {/* View mode toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
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
          startContent={
            <svg className="w-4 h-4 text-default-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
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
          renderValue={(items) => {
            if (items.length === 0) return <span className="text-default-400">Tipologia</span>;
            if (items.length === 1) return <span className="truncate">{items[0].textValue ?? items[0].key}</span>;
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
            onPress={() => setTipologiaFilter(new Set())}
          >
            Reset tipologia
          </Button>
        )}
        {(viewMode === 'grouped' || viewMode === 'manutenzioni') && (
          <div className="flex gap-2">
            <Button size="sm" variant="flat" onPress={expandAll}>
              Espandi tutto
            </Button>
            <Button size="sm" variant="flat" onPress={collapseAll}>
              Comprimi tutto
            </Button>
          </div>
        )}
      </div>

      {/* Stats cards */}
      <div className="flex gap-2 flex-wrap">
        {grouped
          .filter((g) => viewMode !== 'manutenzioni' || (g.stato !== 'Chiuso' && g.stato !== 'Sospeso'))
          .map((g) => (
          <Card key={g.stato} shadow="sm" className="px-3 py-1.5">
            <div className="text-center">
              <p className="text-lg sm:text-xl font-bold" style={{ color: `var(--heroui-${statoRegColor[g.stato] || 'default'})` }}>
                {g.items.length}
              </p>
              <p className="text-tiny text-default-400">{g.stato}</p>
            </div>
          </Card>
        ))}
      </div>

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
              <div className="flex flex-col gap-2 sm:hidden">
                {globalFiltered.map((a) => (
                  <Card key={a.id} shadow="sm" className="bg-white">
                    <CardBody className="p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-mono text-xs text-white bg-[#34A0A4] px-2 py-0.5 rounded">
                            {a.nr}
                          </span>
                          <span className="text-sm font-medium ml-2">{a.rifAssistenzaNome || '—'}</span>
                        </div>
                        <div className="flex gap-1">
                          {renderStatusChip(a)}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
                        <div>
                          <span className="text-default-400 text-xs">Data</span>
                          <p className="text-default-600">{formatDate(a.data)}</p>
                        </div>
                        <div>
                          <span className="text-default-400 text-xs">Cliente</span>
                          <p className="text-default-600">{a.clienteNome || '—'}</p>
                        </div>
                        <div>
                          <span className="text-default-400 text-xs">Tipologia</span>
                          <p className="text-default-600">{a.tipologiaAssistenza || '—'}</p>
                        </div>
                        <div>
                          <span className="text-default-400 text-xs">Rif. Assistenza</span>
                          <p className="text-default-600">{a.rifAssistenzaNome || '—'}</p>
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
                      {a.descrizioneIntervento && (
                        <div className="text-sm mt-1">
                          <span className="text-default-400 text-xs">Descrizione</span>
                          <p className="text-default-600">{a.descrizioneIntervento}</p>
                        </div>
                      )}
                      <div className="flex justify-between items-center mt-2">
                        <Button size="sm" color="primary" variant="flat" onPress={() => onOpen(a)}>
                          Apri
                        </Button>
                        <span className="text-sm font-medium tabular-nums">{formatCurrency(a.totale)}</span>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>

              {/* Desktop table */}
              <Card shadow="sm" className="bg-white hidden sm:block overflow-hidden">
                <Table
                  aria-label="Assistenze globali"
                  removeWrapper
                  selectionMode="none"
                  classNames={{
                    th: 'bg-default-50 text-default-600 text-xs uppercase tracking-wider',
                    td: 'py-2.5',
                  }}
                >
                  <TableHeader>
                    <TableColumn width={70} align="center">{''}</TableColumn>
                    <TableColumn width={110}>DATA</TableColumn>
                    <TableColumn width={90}>NR</TableColumn>
                    <TableColumn minWidth={120}>CLIENTE</TableColumn>
                    <TableColumn minWidth={120}>TIPOLOGIA</TableColumn>
                    <TableColumn minWidth={100}>RIF. ASSISTENZA</TableColumn>
                    <TableColumn width={110}>STATO REG</TableColumn>
                    <TableColumn minWidth={90}>ATT.NE</TableColumn>
                    <TableColumn width={75} align="end">ORE INT.</TableColumn>
                    <TableColumn width={65} align="end">ORE</TableColumn>
                    <TableColumn minWidth={130}>DESCRIZIONE</TableColumn>
                    <TableColumn width={90} align="end">TOTALE</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {globalFiltered.map((a) => (
                      <TableRow key={a.id} className="hover:bg-default-50 transition-colors">
                        <TableCell>
                          <Button size="sm" color="primary" variant="flat" onPress={() => onOpen(a)}>
                            Apri
                          </Button>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-default-600">{formatDate(a.data)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs text-white bg-[#34A0A4] px-2 py-0.5 rounded">
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
                          <span className="text-sm font-medium tabular-nums">{formatNumber(a.oreIntervento)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium tabular-nums">{formatNumber(a.ore)}</span>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-default-600 truncate max-w-[200px]" title={a.descrizioneIntervento}>
                            {a.descrizioneIntervento || '—'}
                          </p>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium tabular-nums">
                            {formatCurrency(a.totale)}
                          </span>
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
          const icon = statoRegIcon[group.stato] || '📄';

          return (
            <Card key={group.stato} shadow="sm" className="bg-white overflow-hidden">
              {/* Collapsible header */}
              <button
                type="button"
                onClick={() => toggleGroup(group.stato)}
                className="w-full flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 hover:bg-default-50 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{icon}</span>
                  <div>
                    <span className="font-semibold text-foreground text-sm sm:text-base">{group.stato}</span>
                    <Chip size="sm" variant="flat" color={color} className="ml-2">
                      {group.items.length}
                    </Chip>
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 text-default-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <>
                  {group.items.length === 0 ? (
                    <div className="px-4 py-8 text-center text-default-400 text-sm">
                      Non ci sono assistenze in questo stato
                    </div>
                  ) : (
                  <>
                  {/* Mobile cards */}
                  <div className="flex flex-col gap-2 p-3 sm:hidden">
                    {group.items.map((a) => (
                      <div key={a.id} className="border border-default-200 rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono text-xs text-white bg-[#34A0A4] px-2 py-0.5 rounded">
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
                          <Button size="sm" color="primary" variant="flat" onPress={() => onOpen(a)}>
                            Apri
                          </Button>
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
                      classNames={{
                        th: 'bg-default-50 text-default-600 text-xs uppercase tracking-wider',
                        td: 'py-2.5',
                      }}
                    >
                      <TableHeader>
                        <TableColumn width={70} align="center">{''}</TableColumn>
                        <TableColumn width={110}>DATA</TableColumn>
                        <TableColumn width={90}>NR</TableColumn>
                        <TableColumn minWidth={120}>CLIENTE</TableColumn>
                        <TableColumn minWidth={120}>TIPOLOGIA</TableColumn>
                        <TableColumn minWidth={100}>RIF. ASSISTENZA</TableColumn>
                        <TableColumn minWidth={90}>ATT.NE</TableColumn>
                        <TableColumn width={75} align="end">ORE INT.</TableColumn>
                        <TableColumn width={65} align="end">ORE</TableColumn>
                        <TableColumn minWidth={130}>DESCRIZIONE</TableColumn>
                        <TableColumn width={90} align="end">TOTALE</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {group.items.map((a) => (
                          <TableRow key={a.id} className="hover:bg-default-50 transition-colors">
                            <TableCell>
                              <Button size="sm" color="primary" variant="flat" onPress={() => onOpen(a)}>
                                Apri
                              </Button>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-default-600">{formatDate(a.data)}</span>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-xs text-white bg-[#34A0A4] px-2 py-0.5 rounded">
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
                              <span className="text-sm font-medium tabular-nums">{formatNumber(a.oreIntervento)}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium tabular-nums">{formatNumber(a.ore)}</span>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm text-default-600 truncate max-w-[200px]" title={a.descrizioneIntervento}>
                                {a.descrizioneIntervento || '—'}
                              </p>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium tabular-nums">
                                {formatCurrency(a.totale)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  </>
                  )}
                </>
              )}
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
            const icon = statoRegIcon[group.stato] || '📄';

            return (
              <Card key={group.stato} shadow="sm" className="bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.stato)}
                  className="w-full flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 hover:bg-default-50 transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{icon}</span>
                    <div>
                      <span className="font-semibold text-foreground text-sm sm:text-base">{group.stato}</span>
                      <Chip size="sm" variant="flat" color={color} className="ml-2">
                        {group.items.length}
                      </Chip>
                    </div>
                  </div>
                  <svg
                    className={`w-5 h-5 text-default-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <>
                    {group.items.length === 0 ? (
                      <div className="px-4 py-8 text-center text-default-400 text-sm">
                        Non ci sono assistenze in questo stato
                      </div>
                    ) : (
                    <>
                    {/* Mobile cards */}
                    <div className="flex flex-col gap-2 p-3 sm:hidden">
                      {group.items.map((a) => (
                        <div key={a.id} className="border border-default-200 rounded-lg p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-mono text-xs text-white bg-[#34A0A4] px-2 py-0.5 rounded">
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
                            <Button size="sm" color="primary" variant="flat" onPress={() => onOpen(a)}>
                              Apri
                            </Button>
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
                        classNames={{
                          th: 'bg-default-50 text-default-600 text-xs uppercase tracking-wider',
                          td: 'py-2.5',
                        }}
                      >
                        <TableHeader>
                          <TableColumn width={70} align="center">{''}</TableColumn>
                          <TableColumn width={110}>DATA</TableColumn>
                          <TableColumn width={90}>NR</TableColumn>
                          <TableColumn minWidth={120}>CLIENTE</TableColumn>
                          <TableColumn minWidth={120}>TIPOLOGIA</TableColumn>
                          <TableColumn minWidth={100}>RIF. ASSISTENZA</TableColumn>
                          <TableColumn minWidth={90}>ATT.NE</TableColumn>
                          <TableColumn width={75} align="end">ORE INT.</TableColumn>
                          <TableColumn width={65} align="end">ORE</TableColumn>
                          <TableColumn minWidth={130}>DESCRIZIONE</TableColumn>
                          <TableColumn width={90} align="end">TOTALE</TableColumn>
                        </TableHeader>
                        <TableBody>
                          {group.items.map((a) => (
                            <TableRow key={a.id} className="hover:bg-default-50 transition-colors">
                              <TableCell>
                                <Button size="sm" color="primary" variant="flat" onPress={() => onOpen(a)}>
                                  Apri
                                </Button>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-default-600">{formatDate(a.data)}</span>
                              </TableCell>
                              <TableCell>
                                <span className="font-mono text-xs text-white bg-[#34A0A4] px-2 py-0.5 rounded">
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
                                <span className="text-sm font-medium tabular-nums">{formatNumber(a.oreIntervento)}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm font-medium tabular-nums">{formatNumber(a.ore)}</span>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm text-default-600 truncate max-w-[200px]" title={a.descrizioneIntervento}>
                                  {a.descrizioneIntervento || '—'}
                                </p>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm font-medium tabular-nums">
                                  {formatCurrency(a.totale)}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    </>
                    )}
                  </>
                )}
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
    </div>
  );
}
