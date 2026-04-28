import React, { useState, useCallback, useEffect } from 'react';
import { HeroUIProvider, ToastProvider } from '@heroui/react';
import { Navbar, NavbarBrand, NavbarContent, Button } from '@heroui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import AssistenzeList from './components/AssistenzeList';
import AssistenzaEdit from './components/AssistenzaEdit';
import CalendarPage from './components/CalendarPage';
import LoginPage from './components/LoginPage';
import ErrorBoundary from './components/ErrorBoundary';
import ActiveTimersPanel from './components/ActiveTimersPanel';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AssistenzaRegistrazione, AssistenzaRegistrazioneRaw, mapAssistenzaRegistrazione } from './types/assistenzaRegistrazione';
import { getActiveTimers } from './services/timerStore';

type View = { type: 'calendar' } | { type: 'list' } | { type: 'edit'; assistenza: AssistenzaRegistrazione } | { type: 'create' };

function AppContent() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>({ type: 'calendar' });
  const [previousView, setPreviousView] = useState<'calendar' | 'list'>('calendar');
  const [isOnline, setIsOnline] = useState(typeof window === 'undefined' ? true : window.navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (getActiveTimers().some((timer) => timer.status === 'running')) {
        event.preventDefault();
        event.returnValue = 'C\'è un\'attività in corso.';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleOpen = useCallback((a: AssistenzaRegistrazione) => {
    setPreviousView((prev) => (view.type === 'calendar' || view.type === 'list' ? view.type : prev));
    setView({ type: 'edit', assistenza: a });
  }, [view]);

  const handleOpenById = useCallback((assistenzaId: string) => {
    // Cerca il record nelle cache di react-query (lista assistenze / calendario)
    const queries = queryClient.getQueriesData<{ data: AssistenzaRegistrazioneRaw[] } | AssistenzaRegistrazioneRaw[]>({});
    for (const [, value] of queries) {
      if (!value) continue;
      const list = Array.isArray(value) ? value : (value as { data?: AssistenzaRegistrazioneRaw[] }).data;
      if (!Array.isArray(list)) continue;
      const raw = list.find((r) => r && r.phyo_assistenzeregistrazioniid === assistenzaId);
      if (raw) {
        const mapped = mapAssistenzaRegistrazione(raw);
        setPreviousView((prev) => (view.type === 'calendar' || view.type === 'list' ? view.type : prev));
        setView({ type: 'edit', assistenza: mapped });
        return;
      }
    }
  }, [queryClient, view]);

  const handleCreateNew = useCallback(() => {
    setPreviousView((prev) => (view.type === 'calendar' || view.type === 'list' ? view.type : prev));
    setView({ type: 'create' });
  }, [view]);

  const handleBack = useCallback(() => {
    setView({ type: previousView });
  }, [previousView]);

  const handleShowCalendar = useCallback(() => {
    setPreviousView('calendar');
    setView({ type: 'calendar' });
  }, []);

  const handleShowList = useCallback(() => {
    setPreviousView('list');
    setView({ type: 'list' });
  }, []);

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-[#E7ECEF]">
      {/* Watermark fisso: rosa dei venti Centoraggi */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center"
      >
        <img
          src="/ICONA%20CENTORAGGI%20SFONDO%20TRASPARENTE.png"
          alt=""
          className="w-[80vmin] h-[80vmin] max-w-[800px] max-h-[800px] opacity-[0.06] select-none"
        />
      </div>
      <div className="relative z-10">
      {!isOnline && (
        <div className="bg-warning-100 text-warning-800 text-center text-sm px-4 py-2 border-b border-warning-300">
          Modalità offline attiva: vedi i dati salvati localmente e potrai riprendere appena torna la connessione.
        </div>
      )}

      <Navbar
        maxWidth="full"
        isBordered
        height="4.5rem"
        className="sticky top-0 z-40 overflow-hidden bg-[#38373B] backdrop-blur-md shadow-sm"
        classNames={{ wrapper: 'px-0 pr-2 sm:pr-3 max-w-full h-full' }}
      >
        <NavbarBrand className="flex-grow-0 pl-0 h-full min-w-0">
          <div className="flex h-full items-stretch">
            <img
              src="/LOGO%20CENTORAGGI%202024%20-%20VETTORIALE.jpg"
              alt="Centoraggi - per l'uso intelligente dell'energia"
              className="h-[4.5rem] w-auto max-w-none object-contain block"
            />
            <div className="-ml-px h-full w-4 sm:w-10 bg-gradient-to-r from-[#3D3B42] to-[#38373B]" />
          </div>
        </NavbarBrand>
        <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 lg:block">
          <span className="text-base sm:text-lg font-semibold text-white">Gestione Assistenze</span>
        </div>
        <NavbarContent justify="end" className="gap-1 sm:gap-2">
          <Button
            size="sm"
            variant={view.type === 'calendar' ? 'solid' : 'flat'}
            color={view.type === 'calendar' ? 'primary' : undefined}
            className="min-w-[88px]"
            onPress={handleShowCalendar}
          >
            Calendario
          </Button>
          <Button
            size="sm"
            variant={view.type === 'list' ? 'solid' : 'flat'}
            color={view.type === 'list' ? 'primary' : undefined}
            className="min-w-[88px]"
            onPress={handleShowList}
          >
            Elenco
          </Button>
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium text-white">Ciao, {user.nome}!</p>
            <p className="text-tiny text-centoraggi-mint hidden sm:block">Bentornato</p>
          </div>
          <Button size="sm" variant="flat" className="bg-white/15 text-xs sm:text-sm text-white hover:bg-white/25 px-2 sm:px-3 min-w-0" onPress={logout}>
            Esci
          </Button>
        </NavbarContent>
      </Navbar>

      <main className="w-full max-w-none px-2 sm:px-4 lg:px-6 py-4 sm:py-8">
        <ActiveTimersPanel onOpenAssistenza={handleOpenById} />
        <AnimatePresence mode="wait" initial={false}>
          {view.type === 'edit' ? (
            <motion.div
              key={`edit-${view.assistenza.id ?? 'new'}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <AssistenzaEdit assistenza={view.assistenza} onBack={handleBack} />
            </motion.div>
          ) : view.type === 'create' ? (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <AssistenzaEdit risorsaId={user.id} onBack={handleBack} />
            </motion.div>
          ) : view.type === 'list' ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <AssistenzeList risorsaId={user.id} onOpen={handleOpen} onCreateNew={handleCreateNew} />
            </motion.div>
          ) : (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <CalendarPage risorsaId={user.id} onOpen={handleOpen} onCreateNew={handleCreateNew} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <HeroUIProvider>
      <ToastProvider placement="top-right" />
      <ErrorBoundary>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ErrorBoundary>
    </HeroUIProvider>
  );
}

export default App;
