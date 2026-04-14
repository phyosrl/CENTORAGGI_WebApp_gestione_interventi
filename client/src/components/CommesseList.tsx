import React, { useMemo, useState } from 'react';
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
  Spinner,
  Card,
  CardBody,
} from '@heroui/react';
import { fetchCommesse } from '../services/api';
import { Commessa, CommessaRaw, mapCommessa, TipologiaCommessaMap } from '../types/commessa';

const tipologiaOptions = Object.entries(TipologiaCommessaMap).map(([value, label]) => ({
  value,
  label,
}));

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('it-IT');
}

function formatCurrency(value: number | null): string {
  if (value == null) return '-';
  return value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

export default function CommesseList() {
  const [search, setSearch] = useState('');
  const [tipologiaFilter, setTipologiaFilter] = useState<string>('');
  const [statoFilter, setStatoFilter] = useState<string>('');

  const { data: rawData, isLoading, error } = useQuery<CommessaRaw[]>({
    queryKey: ['commesse'],
    queryFn: fetchCommesse,
    staleTime: 5 * 60 * 1000,
  });

  const commesse = useMemo(() => {
    if (!rawData) return [];
    return rawData.map(mapCommessa);
  }, [rawData]);

  // Extract unique stati for filter
  const statiOptions = useMemo(() => {
    const set = new Set<string>();
    commesse.forEach((c) => {
      if (c.statoCommessa) set.add(c.statoCommessa);
    });
    return Array.from(set).sort();
  }, [commesse]);

  // Apply filters
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

    if (tipologiaFilter) {
      result = result.filter(
        (c) => c.tipologiaValue != null && c.tipologiaValue.toString() === tipologiaFilter
      );
    }

    if (statoFilter) {
      result = result.filter((c) => c.statoCommessa === statoFilter);
    }

    return result;
  }, [commesse, search, tipologiaFilter, statoFilter]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Spinner label="Caricamento commesse..." size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="mx-4 mt-4">
        <CardBody>
          <p className="text-danger text-center">
            Errore nel caricamento delle commesse: {(error as Error).message}
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Cerca per nome, nr, cliente, descrizione..."
          value={search}
          onValueChange={setSearch}
          isClearable
          onClear={() => setSearch('')}
          className="sm:max-w-xs"
          startContent={<span className="text-default-400">🔍</span>}
        />
        <Select
          placeholder="Tipologia"
          selectedKeys={tipologiaFilter ? [tipologiaFilter] : []}
          onSelectionChange={(keys) => {
            const val = Array.from(keys)[0] as string | undefined;
            setTipologiaFilter(val ?? '');
          }}
          className="sm:max-w-xs"
        >
          {tipologiaOptions.map((opt) => (
            <SelectItem key={opt.value}>{opt.label}</SelectItem>
          ))}
        </Select>
        <Select
          placeholder="Stato Commessa"
          selectedKeys={statoFilter ? [statoFilter] : []}
          onSelectionChange={(keys) => {
            const val = Array.from(keys)[0] as string | undefined;
            setStatoFilter(val ?? '');
          }}
          className="sm:max-w-xs"
        >
          {statiOptions.map((stato) => (
            <SelectItem key={stato}>{stato}</SelectItem>
          ))}
        </Select>
      </div>

      {/* Results count */}
      <p className="text-sm text-default-500">
        {filtered.length} commess{filtered.length === 1 ? 'a' : 'e'} trovat{filtered.length === 1 ? 'a' : 'e'}
      </p>

      {/* Table */}
      <Table
        aria-label="Elenco commesse"
        isStriped
        selectionMode="none"
      >
        <TableHeader>
          <TableColumn>NR</TableColumn>
          <TableColumn>NOME</TableColumn>
          <TableColumn>CLIENTE</TableColumn>
          <TableColumn>TIPOLOGIA</TableColumn>
          <TableColumn>STATO</TableColumn>
          <TableColumn>DATA COMMESSA</TableColumn>
          <TableColumn>CONCLUSIONE</TableColumn>
          <TableColumn align="end">TOTALE</TableColumn>
        </TableHeader>
        <TableBody emptyContent="Nessuna commessa trovata">
          {filtered.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-mono text-sm">{c.nrCommessa}</TableCell>
              <TableCell className="font-semibold">{c.nome}</TableCell>
              <TableCell>{c.clienteNome || '-'}</TableCell>
              <TableCell>
                {c.tipologia ? (
                  <Chip size="sm" variant="flat">{c.tipologia}</Chip>
                ) : '-'}
              </TableCell>
              <TableCell>
                {c.statoCommessa ? (
                  <Chip size="sm" variant="flat" color={c.attivo ? 'success' : 'default'}>
                    {c.statoCommessa}
                  </Chip>
                ) : '-'}
              </TableCell>
              <TableCell>{formatDate(c.dataCommessa)}</TableCell>
              <TableCell>{formatDate(c.dataConclusione)}</TableCell>
              <TableCell className="text-right">{formatCurrency(c.totaleIvaEsclusa)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
