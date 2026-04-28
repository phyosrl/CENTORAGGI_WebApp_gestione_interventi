import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, CardBody, Spinner } from '@heroui/react';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { fetchAssistenzeRegistrazioni, fetchRifAssistenze } from '../services/api';
import { AssistenzaRegistrazione, mapAssistenzaRegistrazione } from '../types/assistenzaRegistrazione';

interface CalendarPageProps {
  risorsaId: string;
  onOpen: (assistenza: AssistenzaRegistrazione) => void;
  onCreateNew: () => void;
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getWeekStart(date: Date) {
  const day = (date.getDay() + 6) % 7;
  return addDays(date, -day);
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}

function formatDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

function formatWeekRange(start: Date) {
  const end = addDays(start, 6);
  return `${start.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })} – ${end.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}`;
}

function buildMonthGrid(current: Date) {
  const firstOfMonth = new Date(current.getFullYear(), current.getMonth(), 1);
  const start = getWeekStart(firstOfMonth);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function buildWeekGrid(current: Date) {
  const start = getWeekStart(current);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export default function CalendarPage({ risorsaId, onOpen, onCreateNew }: CalendarPageProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['assistenze-calendar', risorsaId],
    queryFn: () => fetchAssistenzeRegistrazioni(risorsaId),
    staleTime: 1000 * 60 * 5,
  });

  const { data: rifAssistenzeList } = useQuery({
    queryKey: ['rifAssistenze'],
    queryFn: fetchRifAssistenze,
    staleTime: 1000 * 60 * 10,
  });

  const assistenze = useMemo(
    () => {
      const mapped = data?.data.map(mapAssistenzaRegistrazione) ?? [];
      if (!rifAssistenzeList || rifAssistenzeList.length === 0) return mapped;
      const rifIndex = new Map(rifAssistenzeList.map((r) => [r.phyo_assistenzeid, r]));
      return mapped.map((a) => {
        if (a.clienteNome || !a.rifAssistenzaId) return a;
        const rif = rifIndex.get(a.rifAssistenzaId);
        if (!rif) return a;
        const clienteNome = rif['_phyo_cliente_value@OData.Community.Display.V1.FormattedValue'] || '';
        if (!clienteNome) return a;
        return {
          ...a,
          clienteId: a.clienteId ?? rif._phyo_cliente_value ?? null,
          clienteNome,
        };
      });
    },
    [data, rifAssistenzeList],
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, AssistenzaRegistrazione[]>();
    for (const item of assistenze) {
      if (!item.data) continue;
      const key = formatDayKey(new Date(item.data));
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [assistenze]);

  const gridDates = viewMode === 'week' ? buildWeekGrid(selectedDate) : buildMonthGrid(selectedDate);
  const selectedEvents = eventsByDate.get(formatDayKey(selectedDate)) ?? [];

  const currentMonthLabel = formatMonthLabel(selectedDate);
  const currentWeekLabel = formatWeekRange(getWeekStart(selectedDate));

  const goPrev = () => {
    setSelectedDate((prev) => {
      if (viewMode === 'day') return addDays(prev, -1);
      if (viewMode === 'week') return addDays(prev, -7);
      return new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
    });
  };

  const goNext = () => {
    setSelectedDate((prev) => {
      if (viewMode === 'day') return addDays(prev, 1);
      if (viewMode === 'week') return addDays(prev, 7);
      return new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-default-400">Home / Calendario</p>
          <h1 className="text-3xl font-semibold text-slate-900">{currentMonthLabel}</h1>
          <p className="mt-2 text-sm text-default-500">
            Visualizza gli appuntamenti e apri una registrazione direttamente dal calendario.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="flat"
            size="sm"
            className="bg-white/95 border border-default-200"
            onPress={() => setSelectedDate(new Date())}
          >
            Oggi
          </Button>
          <Button
            variant={viewMode === 'month' ? 'solid' : 'flat'}
            size="sm"
            color={viewMode === 'month' ? 'primary' : undefined}
            onPress={() => setViewMode('month')}
          >
            Mese
          </Button>
          <Button
            variant={viewMode === 'week' ? 'solid' : 'flat'}
            size="sm"
            color={viewMode === 'week' ? 'primary' : undefined}
            onPress={() => setViewMode('week')}
          >
            Settimana
          </Button>
          <Button
            variant={viewMode === 'day' ? 'solid' : 'flat'}
            size="sm"
            color={viewMode === 'day' ? 'primary' : undefined}
            onPress={() => setViewMode('day')}
          >
            Giorno
          </Button>
          <Button
            variant="flat"
            size="sm"
            color="primary"
            onPress={onCreateNew}
          >
            Nuova registrazione
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card shadow="sm" className="bg-[#FAFBFC] border border-centoraggi-accent/20">
          <CardBody className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{viewMode === 'week' ? currentWeekLabel : currentMonthLabel}</p>
                <p className="text-xs text-default-400">{viewMode === 'day' ? formatShortDate(selectedDate) : 'Calendario mensile'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="flat"
                  size="sm"
                  className="border border-default-200 bg-white/90"
                  onPress={goPrev}
                  aria-label="Precedente"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="flat"
                  size="sm"
                  className="border border-default-200 bg-white/90"
                  onPress={goNext}
                  aria-label="Successivo"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner />
              </div>
            ) : isError ? (
              <div className="rounded-2xl bg-warning-100 p-4 text-sm text-warning-900">Impossibile caricare il calendario. Riprova più tardi.</div>
            ) : (
              <div className="space-y-3">
                {viewMode === 'day' ? (
                  <div className="space-y-3">
                    {selectedEvents.length === 0 ? (
                      <div className="rounded-2xl border border-default-200 bg-white p-5 text-sm text-default-500">Nessun appuntamento per questa giornata.</div>
                    ) : (
                      selectedEvents.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => onOpen(event)}
                          className="w-full text-left rounded-2xl border border-centoraggi-accent/20 bg-emerald-500/10 p-4 transition hover:border-centoraggi-accent/40"
                        >
                          <p className="text-sm font-semibold text-slate-900">{event.nr || event.rifAssistenzaNome || 'Registrazione'}</p>
                          <p className="mt-1 text-xs text-default-500">{event.clienteNome || event.tipologiaAssistenza || 'Nessun cliente'} • {event.oreIntervento != null ? `${event.oreIntervento}h` : 'Orario non definito'}</p>
                        </button>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <div className="grid grid-cols-7 gap-2 text-center text-[11px] uppercase tracking-[0.18em] text-default-400">
                      {DAYS.map((day) => (
                        <div key={day}>{day}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {gridDates.map((date) => {
                        const key = formatDayKey(date);
                        const events = eventsByDate.get(key) ?? [];
                        const isCurrentMonth = viewMode === 'week' ? true : date.getMonth() === selectedDate.getMonth();
                        const isSelected = formatDayKey(date) === formatDayKey(selectedDate);
                        const isToday = formatDayKey(date) === formatDayKey(new Date());
                        const cellHeight = viewMode === 'week' ? 'min-h-[280px]' : 'min-h-[120px]';
                        const maxEvents = viewMode === 'week' ? 6 : 2;
                        const cellBg = isToday ? 'bg-primary-100' : isCurrentMonth ? 'bg-white' : 'bg-slate-50';
                        const dayNumberColor = isToday ? 'text-primary-700' : isCurrentMonth ? 'text-slate-900' : 'text-default-400';
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedDate(date)}
                            className={`relative ${cellHeight} rounded-3xl border ${isSelected ? 'border-centoraggi-primary' : isToday ? 'border-primary-300' : 'border-default-200'} ${cellBg} p-3 ${viewMode === 'week' ? 'pt-8' : ''} text-left transition hover:border-centoraggi-accent/40 ${isSelected ? 'shadow-sm' : ''}`}
                          >
                            {viewMode === 'week' ? (
                              <>
                                <span className={`absolute top-2 left-3 text-sm font-semibold ${dayNumberColor}`}>{date.getDate()}</span>
                                {events.length > 0 && <span className="absolute top-2 right-3 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] text-white">{events.length}</span>}
                              </>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-sm font-semibold ${dayNumberColor}`}>{date.getDate()}</span>
                                {events.length > 0 && <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] text-white">{events.length}</span>}
                              </div>
                            )}
                            <div className="mt-3 space-y-2">
                              {events.slice(0, maxEvents).map((event) => (
                                <div
                                  key={event.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => { e.stopPropagation(); onOpen(event); }}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onOpen(event); } }}
                                  className="overflow-hidden rounded-2xl bg-emerald-500/15 p-2 text-[11px] text-emerald-900 cursor-pointer hover:bg-emerald-500/25"
                                >
                                  <p className="truncate font-semibold">{event.nr || event.rifAssistenzaNome || 'Assistenza'}</p>
                                  <p className="truncate text-default-500">{event.clienteNome || event.tipologiaAssistenza || 'Nessuna descrizione'}</p>
                                </div>
                              ))}
                              {events.length > maxEvents && (
                                <div className="text-[11px] text-default-500">+{events.length - maxEvents} altri</div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        <Card shadow="sm" className="bg-white border border-default-200">
          <CardBody className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">Prossimi appuntamenti</p>
                <p className="text-xs text-default-400">Eventi di oggi e dei giorni successivi.</p>
              </div>
            </div>
            <div className="space-y-3">
              {(() => {
                const startOfToday = new Date();
                startOfToday.setHours(0, 0, 0, 0);
                const upcoming = assistenze
                  .filter((event: AssistenzaRegistrazione) => {
                    if (!event.data) return false;
                    if ((event.statoReg || '').toLowerCase() === 'chiuso') return false;
                    const d = new Date(event.data);
                    if (isNaN(d.getTime())) return false;
                    return d.getTime() >= startOfToday.getTime();
                  })
                  .sort((a: AssistenzaRegistrazione, b: AssistenzaRegistrazione) =>
                    new Date(a.data!).getTime() - new Date(b.data!).getTime()
                  )
                  .slice(0, 5);
                if (upcoming.length === 0) {
                  return <p className="text-xs text-default-400">Nessun appuntamento in programma.</p>;
                }
                return upcoming.map((event: AssistenzaRegistrazione) => (
                  <div
                    key={event.id}
                    className="w-full rounded-2xl border border-default-200 bg-slate-50 p-3 transition hover:border-centoraggi-accent/30"
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => onOpen(event)}
                        className="flex-1 text-left min-w-0"
                      >
                        <p className="text-sm font-semibold text-slate-900">{event.nr || event.rifAssistenzaNome || 'Registrazione'}</p>
                        <p className="mt-1 text-xs text-default-500">{event.data ? new Date(event.data).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : 'Data non disponibile'}</p>
                        <p className="mt-1 text-sm text-default-500 truncate">{event.clienteNome || event.tipologiaAssistenza || 'Cliente non specificato'}</p>
                      </button>
                      <Button
                        size="sm"
                        variant="flat"
                        isIconOnly
                        as={'a' as any}
                        href={
                          event.indirizzoAssistenza
                            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.indirizzoAssistenza)}`
                            : undefined
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Apri in Google Maps"
                        isDisabled={!event.indirizzoAssistenza}
                        className={
                          event.indirizzoAssistenza
                            ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                            : ''
                        }
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          if (!event.indirizzoAssistenza) e.preventDefault();
                        }}
                        title={event.indirizzoAssistenza || 'Indirizzo non disponibile'}
                      >
                        <MapPin className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
