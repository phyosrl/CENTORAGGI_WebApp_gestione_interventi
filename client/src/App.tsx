import React from 'react';
import { HeroUIProvider } from '@heroui/react';
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
} from '@heroui/react';
import CommesseList from './components/CommesseList';

function AppContent() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navbar
        maxWidth="full"
        isBordered
        className="bg-white/80 backdrop-blur-md shadow-sm"
      >
        <NavbarBrand className="gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-white font-bold text-lg">
            C
          </div>
          <div>
            <p className="font-bold text-lg text-foreground tracking-tight">Centoraggi</p>
            <p className="text-tiny text-default-400 -mt-1">Gestione Commesse</p>
          </div>
        </NavbarBrand>
        <NavbarContent justify="end">
          <div className="flex items-center gap-2 text-xs text-default-400">
            <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" />
            Dataverse CRM
          </div>
        </NavbarContent>
      </Navbar>

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <CommesseList />
      </main>
    </div>
  );
}

function App() {
  return (
    <HeroUIProvider>
      <AppContent />
    </HeroUIProvider>
  );
}

export default App;
