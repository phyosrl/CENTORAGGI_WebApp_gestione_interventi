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
    <div className="min-h-screen bg-gradient-to-br from-[#e8f4f8] to-[#c5e4ed]">
      {!isOnline && (
        <div className="bg-warning-100 text-warning-800 text-center text-sm px-4 py-2 border-b border-warning-300">
          Modalità offline attiva: vedi i dati salvati localmente e potrai riprendere appena torna la connessione.
        </div>
      )}

      <Navbar maxWidth="full" isBordered className="bg-[#184E77]/90 backdrop-blur-md shadow-sm">
        <NavbarBrand className="gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#52B69A] text-white font-bold text-lg">C</div>
          <div className="hidden sm:block">
            <p className="font-bold text-lg text-white tracking-tight">Centoraggi</p>
            <p className="text-tiny text-[#B5E48C] -mt-1">Gestione Commesse</p>
          </div>
        </NavbarBrand>
        <NavbarContent justify="end" className="gap-2">
          <div className="text-right">
            <p className="text-sm font-medium text-white">Ciao, {user.nome}!</p>
            <p className="text-tiny text-[#99D98C] hidden sm:block">Bentornato</p>
          </div>
          <Button size="sm" variant="flat" className="bg-white/15 text-white hover:bg-white/25" onPress={logout}>
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
