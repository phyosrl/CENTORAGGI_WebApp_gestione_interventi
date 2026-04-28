import React, { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer } from './motion';
import { Search, Inbox } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Select,
  SelectItem,
  Chip,
  Card,
  CardBody,
  CardHeader,
  Button,
  Divider,
  Tooltip,
} from '@heroui/react';
import { fetchCommesse } from '../services/api';
import { Commessa, CommessaRaw, mapCommessa, TipologiaCommessaMap } from '../types/commessa';
import ListSkeleton from './skeletons/ListSkeleton';

const tipologiaOptions = Object.entries(TipologiaCommessaMap).map(([value, label]) => ({
  value,
  label,
}));

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—';
  return value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

const tipologiaColorMap: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'default'> = {
  'Impianto FV (<20 kWp)': 'warning',
  'Impianto FV (>20 kWp)': 'warning',
  'Impianto FV+ACC': 'success',
  'Solare Termico': 'danger',
  'Climatizzatori': 'secondary',
  'PDC': 'primary',
  'Caldaia': 'default',
  'Altro': 'default',
};

export default function CommesseList() {
  const [search, setSearch] = useState('');
  const [tipologiaFilter, setTipologiaFilter] = useState<Set<string>>(new Set());
  const [statoFilter, setStatoFilter] = useState<string>('');

  const { data: rawData, isLoading, error, refetch } = useQuery<CommessaRaw[]>({
    queryKey: ['commesse'],
    queryFn: fetchCommesse,
    staleTime: 5 * 60 * 1000,
  });

  const commesse = useMemo(() => {
    if (!rawData) return [];
    return rawData.map(mapCommessa);
  }, [rawData]);

  const statiOptions = useMemo(() => {
    const set = new Set<string>();
    commesse.forEach((c) => {
      if (c.statoCommessa) set.add(c.statoCommessa);
    });
    return Array.from(set).sort();
  }, [commesse]);

  const filtered = useMemo(() => {
    let result = commesse;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.nome.toLowerCase().includes(q) ||
          c.nrCommessa.toLowerCase().includes(q) ||
          c.descrizione.toLowerCase().includes(q) ||
          c.clienteNome.toLowerCase().includes(q) ||
          c.commerciale.toLowerCase().includes(q)
      );
    }

    if (tipologiaFilter.size > 0) {
      result = result.filter(
        (c) => c.tipologiaValue != null && tipologiaFilter.has(c.tipologiaValue.toString())
      );
    }

    if (statoFilter) {
      result = result.filter((c) => c.statoCommessa === statoFilter);
    }

    return result;
  }, [commesse, search, tipologiaFilter, statoFilter]);

  const hasFilters = search || tipologiaFilter.size > 0 || statoFilter;

  const clearFilters = useCallback(() => {
    setSearch('');
    setTipologiaFilter(new Set());
    setStatoFilter('');
  }, []);

  if (isLoading) {
    return <ListSkeleton rows={8} statsCount={2} />;
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
    <motion.div
      className="flex flex-col gap-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Header + Stats */}
      <motion.div
        variants={fadeInUp}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Commesse</h1>
          <p className="text-default-400 text-sm mt-0.5">
            {commesse.length} commess{commesse.length === 1 ? 'a' : 'e'} totali
          </p>
        </div>
        <div className="flex gap-3">
          <Card shadow="sm" className="px-4 py-2">
            <div className="text-center">
              <p className="text-2xl font-bold text-success">{commesse.filter(c => c.attivo).length}</p>
              <p className="text-tiny text-default-400">Attive</p>
            </div>
          </Card>
          <Card shadow="sm" className="px-4 py-2">
            <div className="text-center">
              <p className="text-2xl font-bold text-default-400">{commesse.filter(c => !c.attivo).length}</p>
              <p className="text-tiny text-default-400">Chiuse</p>
            </div>
          </Card>
        </div>
      </motion.div>

      {/* Filters Card (sticky in mobile) */}
      <div className="sticky top-0 z-30 -mx-3 sm:-mx-0 px-3 sm:px-0 py-2 sm:py-0 bg-white/80 lg:bg-transparent backdrop-blur lg:backdrop-blur-0 border-b border-default-200/60 lg:border-0 lg:static">
      <Card shadow="sm" className="bg-white">
        <CardBody className="gap-4">
          <div className="flex flex-col lg:flex-row gap-3 items-end">
            <Input
              label="Cerca"
              placeholder="Nome, nr, cliente, descrizione, commerciale..."
              value={search}
              onValueChange={setSearch}
              isClearable
              onClear={() => setSearch('')}
              className="lg:flex-1"
              variant="bordered"
              size="sm"
              startContent={<Search className="w-4 h-4 text-default-400 flex-shrink-0" />}
            />
            <Select
              label="Tipologia"
              placeholder="Tutte"
              selectionMode="multiple"
              selectedKeys={tipologiaFilter}
              onSelectionChange={(keys) => setTipologiaFilter(new Set(Array.from(keys as Set<string>)))}
              className="lg:w-56"
              variant="bordered"
              size="sm"
              renderValue={(items) => {
                if (items.length === 0) return <span className="text-default-400">Tutte</span>;
                if (items.length === 1) return <span className="truncate">{items[0].textValue ?? items[0].key}</span>;
                return <span>{items.length} tipologie</span>;
              }}
            >
              {tipologiaOptions.map((opt) => (
                <SelectItem key={opt.value} textValue={opt.label}>{opt.label}</SelectItem>
              ))}
            </Select>
            <Select
              label="Stato"
              placeholder="Tutti"
              selectedKeys={statoFilter ? [statoFilter] : []}
              onSelectionChange={(keys) => {
                const val = Array.from(keys)[0] as string | undefined;
                setStatoFilter(val ?? '');
              }}
              className="lg:w-44"
              variant="bordered"
              size="sm"
            >
              {statiOptions.map((stato) => (
                <SelectItem key={stato}>{stato}</SelectItem>
              ))}
            </Select>
            {hasFilters && (
              <Button
                variant="flat"
                color="danger"
                size="sm"
                onPress={clearFilters}
                className="min-w-fit"
              >
                Resetta
              </Button>
            )}
          </div>
          {hasFilters && (
            <p className="text-tiny text-default-400">
              {filtered.length} risultat{filtered.length === 1 ? 'o' : 'i'} su {commesse.length}
            </p>
          )}
        </CardBody>
      </Card>
      </div>

      {/* Table */}
      <Card shadow="sm" className="bg-white overflow-hidden">
        <Table
          aria-label="Elenco commesse"
          isHeaderSticky
          selectionMode="none"
          classNames={{
            wrapper: 'max-h-[600px] shadow-none p-0',
            th: 'bg-default-100 text-default-600 text-xs uppercase tracking-wider',
            td: 'py-3',
          }}
        >
          <TableHeader>
            <TableColumn width={70}>NR</TableColumn>
            <TableColumn minWidth={120}>NOME</TableColumn>
            <TableColumn minWidth={120}>CLIENTE</TableColumn>
            <TableColumn minWidth={160}>TIPOLOGIA</TableColumn>
            <TableColumn width={100}>STATO</TableColumn>
            <TableColumn width={130}>DATA</TableColumn>
            <TableColumn width={130}>CONCLUSIONE</TableColumn>
            <TableColumn width={120} align="end">TOTALE</TableColumn>
          </TableHeader>
          <TableBody
            emptyContent={
              <div className="flex flex-col items-center py-10 gap-2">
                <Inbox className="w-12 h-12 text-default-200" strokeWidth={1.5} />
                <p className="text-default-400 text-sm">Nessuna commessa trovata</p>
                {hasFilters && (
                  <Button size="sm" variant="flat" onPress={clearFilters}>
                    Resetta filtri
                  </Button>
                )}
              </div>
            }
          >
            {filtered.map((c) => (
              <TableRow key={c.id} className="hover:bg-default-50 cursor-pointer transition-colors">
                <TableCell>
                  <span className="font-mono text-xs text-default-500 bg-default-100 px-2 py-0.5 rounded">
                    {c.nrCommessa}
                  </span>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{c.nome}</p>
                    {c.commerciale && (
                      <p className="text-tiny text-default-400">{c.commerciale}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <p className="text-sm">{c.clienteNome || '—'}</p>
                </TableCell>
                <TableCell>
                  {c.tipologia ? (
                    <Chip
                      size="sm"
                      variant="flat"
                      color={tipologiaColorMap[c.tipologia] ?? 'default'}
                    >
                      {c.tipologia}
                    </Chip>
                  ) : '—'}
                </TableCell>
                <TableCell>
                  <Chip
                    size="sm"
                    variant="dot"
                    color={c.attivo ? 'success' : 'default'}
                    classNames={{
                      dot: c.attivo ? 'bg-success' : 'bg-default-300',
                    }}
                  >
                    {c.statoCommessa || '—'}
                  </Chip>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-default-600">{formatDate(c.dataCommessa)}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-default-600">{formatDate(c.dataConclusione)}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-medium tabular-nums">
                    {formatCurrency(c.totaleIvaEsclusa)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </motion.div>
  );
}
