import React, { useState, useCallback, useEffect } from 'react';
import { HeroUIProvider, ToastProvider } from '@heroui/react';
import { Navbar, NavbarBrand, NavbarContent, Button } from '@heroui/react';
import AssistenzeList from './components/AssistenzeList';
import AssistenzaEdit from './components/AssistenzaEdit';
import LoginPage from './components/LoginPage';
import ErrorBoundary from './components/ErrorBoundary';
import ActiveTimersPanel from './components/ActiveTimersPanel';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AssistenzaRegistrazione } from './types/assistenzaRegistrazione';
import { getActiveTimers } from './services/timerStore';

type View = { type: 'list' } | { type: 'edit'; assistenza: AssistenzaRegistrazione } | { type: 'create' };

function AppContent() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>({ type: 'list' });
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
    setView({ type: 'edit', assistenza: a });
  }, []);

  const handleCreateNew = useCallback(() => {
    setView({ type: 'create' });
  }, []);

  const handleBack = useCallback(() => {
    setView({ type: 'list' });
  }, []);

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-centoraggi-bg-start to-centoraggi-bg-end">
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
        className="relative overflow-hidden bg-[#38373B] backdrop-blur-md shadow-sm"
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
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium text-white">Ciao, {user.nome}!</p>
            <p className="text-tiny text-centoraggi-mint hidden sm:block">Bentornato</p>
          </div>
          <Button size="sm" variant="flat" className="bg-white/15 text-xs sm:text-sm text-white hover:bg-white/25 px-2 sm:px-3 min-w-0" onPress={logout}>
            Esci
          </Button>
        </NavbarContent>
      </Navbar>

      <main className="max-w-[1400px] mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <ActiveTimersPanel />
        {view.type === 'edit' ? (
          <AssistenzaEdit assistenza={view.assistenza} onBack={handleBack} />
        ) : view.type === 'create' ? (
          <AssistenzaEdit risorsaId={user.id} onBack={handleBack} />
        ) : (
          <AssistenzeList risorsaId={user.id} onOpen={handleOpen} onCreateNew={handleCreateNew} />
        )}
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
