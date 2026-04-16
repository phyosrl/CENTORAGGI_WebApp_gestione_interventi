import React, { useState, useCallback } from 'react';
import { HeroUIProvider, ToastProvider } from '@heroui/react';
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  Button,
} from '@heroui/react';
import AssistenzeList from './components/AssistenzeList';
import AssistenzaEdit from './components/AssistenzaEdit';
import LoginPage from './components/LoginPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AssistenzaRegistrazione } from './types/assistenzaRegistrazione';

type View = { type: 'list' } | { type: 'edit'; assistenza: AssistenzaRegistrazione } | { type: 'create' };

function AppContent() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>({ type: 'list' });

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
      <Navbar
        maxWidth="full"
        isBordered
        className="bg-[#184E77]/90 backdrop-blur-md shadow-sm"
      >
        <NavbarBrand className="gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#52B69A] text-white font-bold text-lg">
            C
          </div>
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
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </HeroUIProvider>
  );
}

export default App;
