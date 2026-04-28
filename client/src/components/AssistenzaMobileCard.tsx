import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardBody } from '@heroui/react';
import { MapPin } from 'lucide-react';
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

interface Props {
  a: AssistenzaRegistrazione;
  isRunning: boolean;
  statusChip: React.ReactNode;
  onOpen: (a: AssistenzaRegistrazione) => void;
}

const AssistenzaMobileCardImpl: React.FC<Props> = ({ a, isRunning, statusChip, onOpen }) => {
  const address = a.indirizzoAssistenza;
  const hasAddr = !!(address && address.trim());
  const mapHref = hasAddr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address!.trim())}` : undefined;
  return (
    <motion.div variants={fadeInUp}>
      <Card
        shadow="sm"
        isPressable
        onPress={() => onOpen(a)}
        className={`w-full ${isRunning ? 'bg-[#fff8e8] border border-warning/30' : 'bg-white'}`}
      >
        <CardBody className="p-2 gap-1">
          <div className="flex justify-between items-center gap-2">
            <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-[11px] text-white bg-centoraggi-teal px-1.5 py-0.5 rounded">
                {a.nr}
              </span>
              <span className="text-sm font-medium truncate">{a.rifAssistenzaNome || a.clienteNome || '—'}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <a
                href={mapHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Apri in Google Maps"
                title={hasAddr ? address! : 'Indirizzo non disponibile'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!hasAddr) e.preventDefault();
                }}
                className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                  hasAddr
                    ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                    : 'bg-default-100 text-default-300 cursor-not-allowed pointer-events-none'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
              </a>
              {statusChip}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-default-600">
            <span className="tabular-nums">{formatDate(a.data)}</span>
            {a.clienteNome && <span className="truncate max-w-[60%]">{a.clienteNome}</span>}
            {a.tipologiaAssistenza && <span className="truncate max-w-[60%] text-default-500">{a.tipologiaAssistenza}</span>}
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
