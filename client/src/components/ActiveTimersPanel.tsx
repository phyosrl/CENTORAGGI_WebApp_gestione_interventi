import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardBody, Chip, addToast } from '@heroui/react';
import { formatTimerDuration, getActiveTimers, upsertActiveTimer, removeActiveTimer, type ActiveTimerItem } from '../services/timerStore';

export default function ActiveTimersPanel() {
  const [timers, setTimers] = useState<ActiveTimerItem[]>(() => getActiveTimers());
  const [, setNow] = useState(Date.now());

  useEffect(() => {
    const refresh = () => setTimers(getActiveTimers());
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    window.addEventListener('timers:changed', refresh as EventListener);

    return () => {
      window.clearInterval(tick);
      window.removeEventListener('timers:changed', refresh as EventListener);
    };
  }, []);

  const ordered = useMemo(
    () => [...timers].sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0)),
    [timers]
  );

  const runningCount = ordered.filter((timer) => timer.status === 'running').length;

  if (ordered.length === 0) {
    return null;
  }

  return (
    <Card shadow="sm" className="bg-[#fff8e8] border border-warning/30 mb-4 sm:mb-6">
      <CardBody className="gap-3 p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-warning-700 uppercase tracking-wider">Attività in corso</p>
            <p className="text-sm text-default-600">Timer attivi: {runningCount} · totali: {ordered.length}</p>
          </div>
          <Chip color="warning" variant="flat">{ordered.length}</Chip>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {ordered.map((timer) => {
            const shownSeconds = timer.status === 'running' && timer.startedAt
              ? timer.elapsedSeconds + Math.floor((Date.now() - timer.startedAt) / 1000)
              : timer.elapsedSeconds;

            return (
              <div key={timer.key} className="rounded-xl border border-warning/20 bg-white p-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <p className="font-mono text-lg font-bold text-foreground truncate">{timer.nr || 'Registrazione'}</p>
                      {timer.status === 'paused' ? (
                        <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-sm font-bold tracking-wide border border-orange-200 whitespace-nowrap">
                          IN PAUSA
                        </span>
                      ) : (
                        <span
                          className={
                            `inline-block align-middle rounded-full px-4 py-2 text-base font-bold tracking-wide border whitespace-nowrap ` +
                            (timer.status === 'running'
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              : 'bg-default-100 text-default-700 border-default-200')
                          }
                        >
                          {timer.status === 'running' ? 'In corso' : 'Fermo'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-bold bg-warning-100 text-warning-800 rounded-lg px-4 py-2 shadow-sm min-w-[128px] text-center whitespace-nowrap">
                        {formatTimerDuration(shownSeconds)}
                      </span>
                      <Button
                        size="sm"
                        color="primary"
                        variant="solid"
                        className="ml-1 animate-pulse-once"
                        onPress={() => {
                          addToast({ title: 'Salvato', color: 'success' });
                        }}
                        aria-label="Salva registrazione"
                      >
                        💾 Salva
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 w-full overflow-hidden">
                    <Button
                      size="sm"
                      color="success"
                      variant="flat"
                      className="justify-center flex-1 basis-0 min-w-0 whitespace-nowrap text-[10px] sm:text-xs font-medium px-1 sm:px-1.5 transition-all duration-150 focus:scale-105 active:scale-95 hover:animate-pulse focus:ring-2 focus:ring-emerald-300"
                      onPress={() => {
                        upsertActiveTimer({
                          ...timer,
                          status: 'running',
                          startedAt: Date.now(),
                          elapsedSeconds: shownSeconds,
                        });
                        setTimers(getActiveTimers());
                        addToast({ title: 'Timer avviato', color: 'success' });
                      }}
                    >
                      ▶ Avvia
                    </Button>

                    <Button
                      size="sm"
                      variant="flat"
                      className="justify-center flex-1 basis-0 min-w-0 whitespace-nowrap text-[10px] sm:text-xs font-medium px-1 sm:px-1.5 bg-orange-100 text-orange-700 border border-orange-200 transition-all duration-150 focus:scale-105 active:scale-95 hover:animate-pulse focus:ring-2 focus:ring-orange-300"
                      isDisabled={timer.status !== 'running'}
                      onPress={() => {
                        upsertActiveTimer({
                          ...timer,
                          status: 'paused',
                          startedAt: null,
                          elapsedSeconds: shownSeconds,
                        });
                        setTimers(getActiveTimers());
                        addToast({ title: 'Timer in pausa', color: 'warning' });
                      }}
                    >
                      ⏸ Pausa
                    </Button>

                    <Button
                      size="sm"
                      color="danger"
                      variant="flat"
                      className="justify-center flex-1 basis-0 min-w-0 whitespace-nowrap text-[10px] sm:text-xs font-medium px-1 sm:px-1.5 transition-all duration-150 focus:scale-105 active:scale-95 hover:animate-pulse focus:ring-2 focus:ring-rose-300"
                      isDisabled={shownSeconds === 0}
                      onPress={() => {
                        upsertActiveTimer({
                          ...timer,
                          status: 'stopped',
                          startedAt: null,
                          elapsedSeconds: shownSeconds,
                        });
                        setTimers(getActiveTimers());
                        addToast({
                          title: 'Timer fermato',
                          description: `Attività ${timer.nr || ''} interrotta`,
                          color: 'success',
                        });
                      }}
                    >
                      ■ Stop
                    </Button>

                    <Button
                      size="sm"
                      color="primary"
                      variant="flat"
                      className="justify-center flex-1 basis-0 min-w-0 whitespace-nowrap text-[10px] sm:text-xs font-medium px-1 sm:px-1.5 transition-all duration-150 focus:scale-105 active:scale-95 hover:animate-pulse focus:ring-2 focus:ring-sky-300"
                      isDisabled={shownSeconds === 0}
                      onPress={() => {
                        removeActiveTimer(timer.key);
                        setTimers(getActiveTimers());
                        addToast({
                          title: 'Confermato',
                          description: `Attività ${timer.nr || ''} chiusa`,
                          color: 'success',
                        });
                      }}
                    >
                      ✓ Conferma e chiudi
                    </Button>

                    <Button
                      size="sm"
                      color="secondary"
                      variant="flat"
                      className="justify-center flex-1 basis-0 min-w-0 whitespace-nowrap text-[10px] sm:text-xs font-medium px-1 sm:px-1.5 transition-all duration-150 focus:scale-105 active:scale-95 hover:animate-pulse focus:ring-2 focus:ring-cyan-300"
                      isDisabled={shownSeconds === 0}
                      onPress={() => {
                        upsertActiveTimer({
                          ...timer,
                          status: 'running',
                          startedAt: Date.now(),
                          elapsedSeconds: 0,
                        });
                        setTimers(getActiveTimers());
                        addToast({ title: 'Timer riavviato', color: 'secondary' });
                      }}
                    >
                      ↻ Riavvia
                    </Button>

                    <Button
                      size="sm"
                      variant="flat"
                      className="justify-center flex-1 basis-0 min-w-0 whitespace-nowrap text-[10px] sm:text-xs font-medium px-1 sm:px-1.5 transition-all duration-150 focus:scale-105 active:scale-95 hover:animate-pulse focus:ring-2 focus:ring-gray-300"
                      isDisabled={shownSeconds === 0}
                      onPress={() => {
                        removeActiveTimer(timer.key);
                        setTimers(getActiveTimers());
                        addToast({ title: 'Timer eliminato', color: 'default' });
                      }}
                    >
                      🗑 Elimina
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
