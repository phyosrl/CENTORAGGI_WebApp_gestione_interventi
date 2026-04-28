import React from 'react';
import { Card, CardBody, Button } from '@heroui/react';
import { AlertTriangle, RotateCw, WifiOff } from 'lucide-react';

interface ErrorStateProps {
  error: unknown;
  onRetry: () => void;
  title?: string;
  isFetching?: boolean;
}

function describeError(error: unknown): { message: string; offline: boolean } {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  if (offline) return { message: 'Sei offline. Controlla la connessione e riprova.', offline: true };

  const e = error as { message?: string; response?: { status?: number; data?: { error?: string } } } | undefined;
  const status = e?.response?.status;
  const apiMsg = e?.response?.data?.error;

  if (status === 401) return { message: 'Sessione scaduta. Effettua nuovamente il login.', offline: false };
  if (status === 403) return { message: 'Non hai i permessi per questa risorsa.', offline: false };
  if (status === 429) return { message: 'Troppe richieste, riprova tra qualche secondo.', offline: false };
  if (status && status >= 500) return { message: apiMsg || 'Servizio temporaneamente non disponibile.', offline: false };

  return { message: apiMsg || e?.message || 'Errore sconosciuto durante il caricamento.', offline: false };
}

const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry, title = 'Errore di caricamento', isFetching }) => {
  const { message, offline } = describeError(error);
  const Icon = offline ? WifiOff : AlertTriangle;
  return (
    <Card className="shadow-md border-danger/20">
      <CardBody className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center text-danger">
          <Icon className="w-8 h-8" />
        </div>
        <div className="text-center max-w-md">
          <p className="text-danger font-semibold text-lg">{title}</p>
          <p className="text-default-500 text-sm mt-1">{message}</p>
        </div>
        <Button
          color="primary"
          variant="flat"
          startContent={<RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />}
          onPress={onRetry}
          isDisabled={isFetching}
        >
          {isFetching ? 'Caricamento...' : 'Riprova'}
        </Button>
      </CardBody>
    </Card>
  );
};

export default ErrorState;
