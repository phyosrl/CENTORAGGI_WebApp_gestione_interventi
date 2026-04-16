import React, { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
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
} from '@heroui/react';
import { fetchAssistenzeRegistrazioni } from '../services/api';
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

export default function AssistenzeList({ risorsaId, onOpen, onCreateNew }: AssistenzeListProps) {
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'global' | 'grouped'>('grouped');

  const { data: rawData, isLoading, error, refetch } = useQuery<AssistenzaRegistrazioneRaw[]>({
    queryKey: ['assistenzeRegistrazioni', risorsaId],
    queryFn: () => fetchAssistenzeRegistrazioni(risorsaId),
    staleTime: 5 * 60 * 1000,
  });

  const assistenze = useMemo(() => {
    if (!rawData) return [];
    return rawData.map(mapAssistenzaRegistrazione);
  }, [rawData]);

  const filtered = useMemo(() => {
    if (!search) return assistenze;
    const q = search.toLowerCase();
    return assistenze.filter(
      (a) =>
        a.nr.toLowerCase().includes(q) ||
        a.rifAssistenzaNome.toLowerCase().includes(q) ||
        a.attne.toLowerCase().includes(q) ||
        a.descrizioneIntervento.toLowerCase().includes(q) ||
        a.materialeUtilizzato.toLowerCase().includes(q)
    );
  }, [assistenze, search]);

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
              {assistenze.length}
            </Chip>
            <span className="text-default-400 text-sm">registrazion{assistenze.length === 1 ? 'e' : 'i'} totali</span>
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
        {viewMode === 'grouped' && (
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
        {grouped.map((g) => (
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
                          <Chip size="sm" variant="flat" color={statoRegColor[a.statoReg] || 'default'}>
                            {a.statoReg || '—'}
                          </Chip>
                        </div>
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
                    <TableColumn width={90}>NR</TableColumn>
                    <TableColumn minWidth={100}>RIF. ASSISTENZA</TableColumn>
                    <TableColumn width={110}>DATA</TableColumn>
                    <TableColumn width={110}>STATO REG</TableColumn>
                    <TableColumn minWidth={90}>ATT.NE</TableColumn>
                    <TableColumn width={75} align="end">ORE INT.</TableColumn>
                    <TableColumn width={65} align="end">ORE</TableColumn>
                    <TableColumn minWidth={130}>DESCRIZIONE</TableColumn>
                    <TableColumn minWidth={90}>MATERIALE</TableColumn>
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
                          <span className="font-mono text-xs text-white bg-[#34A0A4] px-2 py-0.5 rounded">
                            {a.nr}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{a.rifAssistenzaNome || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-default-600">{formatDate(a.data)}</span>
                        </TableCell>
                        <TableCell>
                          <Chip size="sm" variant="flat" color={statoRegColor[a.statoReg] || 'default'}>
                            {a.statoReg || '—'}
                          </Chip>
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
                          <p className="text-sm text-default-600 truncate max-w-[150px]" title={a.materialeUtilizzato}>
                            {a.materialeUtilizzato || '—'}
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
                        <TableColumn width={90}>NR</TableColumn>
                        <TableColumn minWidth={100}>RIF. ASSISTENZA</TableColumn>
                        <TableColumn width={110}>DATA</TableColumn>
                        <TableColumn minWidth={90}>ATT.NE</TableColumn>
                        <TableColumn width={75} align="end">ORE INT.</TableColumn>
                        <TableColumn width={65} align="end">ORE</TableColumn>
                        <TableColumn minWidth={130}>DESCRIZIONE</TableColumn>
                        <TableColumn minWidth={90}>MATERIALE</TableColumn>
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
                              <span className="font-mono text-xs text-white bg-[#34A0A4] px-2 py-0.5 rounded">
                                {a.nr}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium">{a.rifAssistenzaNome || '—'}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-default-600">{formatDate(a.data)}</span>
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
                              <p className="text-sm text-default-600 truncate max-w-[150px]" title={a.materialeUtilizzato}>
                                {a.materialeUtilizzato || '—'}
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
    </div>
  );
}
