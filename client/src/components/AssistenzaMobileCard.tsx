import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardBody, Button } from '@heroui/react';
import { fadeInUp } from './motion';
import { AssistenzaRegistrazione } from '../types/assistenzaRegistrazione';

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

interface Props {
  a: AssistenzaRegistrazione;
  isRunning: boolean;
  statusChip: React.ReactNode;
  onOpen: (a: AssistenzaRegistrazione) => void;
}

const AssistenzaMobileCardImpl: React.FC<Props> = ({ a, isRunning, statusChip, onOpen }) => {
  return (
    <motion.div variants={fadeInUp}>
      <Card shadow="sm" className={isRunning ? 'bg-[#fff8e8] border border-warning/30' : 'bg-white'}>
        <CardBody className="p-3">
          <div className="flex justify-between items-start">
            <div>
              <span className="font-mono text-xs text-white bg-centoraggi-teal px-2 py-0.5 rounded">
                {a.nr}
              </span>
              <span className="text-sm font-medium ml-2">{a.rifAssistenzaNome || '—'}</span>
            </div>
            <div className="flex gap-1">{statusChip}</div>
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
    </motion.div>
  );
};

// Memo: re-render solo se cambiano i dati visibili (campi semplici) o lo stato running.
// `statusChip` è un nodo React: confronto referenziale è ok perché viene memoizzato a monte.
const AssistenzaMobileCard = memo(AssistenzaMobileCardImpl, (prev, next) => {
  if (prev.isRunning !== next.isRunning) return false;
  if (prev.onOpen !== next.onOpen) return false;
  if (prev.statusChip !== next.statusChip) return false;
  const a = prev.a, b = next.a;
  return (
    a.id === b.id &&
    a.nr === b.nr &&
    a.data === b.data &&
    a.clienteNome === b.clienteNome &&
    a.tipologiaAssistenza === b.tipologiaAssistenza &&
    a.rifAssistenzaNome === b.rifAssistenzaNome &&
    a.attne === b.attne &&
    a.oreIntervento === b.oreIntervento &&
    a.ore === b.ore &&
    a.descrizioneIntervento === b.descrizioneIntervento &&
    a.totale === b.totale
  );
});

export default AssistenzaMobileCard;
