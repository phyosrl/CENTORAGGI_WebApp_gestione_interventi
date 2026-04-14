import React from 'react';
import { HeroUIProvider } from '@heroui/react';
import {
  Card,
  CardHeader,
  Navbar,
  NavbarBrand,
} from '@heroui/react';
import CommesseList from './components/CommesseList';

function AppContent() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar className="bg-blue-600 dark:bg-blue-800">
        <NavbarBrand>
          <p className="font-bold text-white text-xl">📋 Gestione Commesse</p>
        </NavbarBrand>
      </Navbar>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader className="flex gap-3">
            <div className="flex flex-col">
              <p className="text-lg font-semibold">Gestione Commesse Centoraggi</p>
              <p className="text-sm text-default-500">Integrazione Dataverse CRM</p>
            </div>
          </CardHeader>
        </Card>

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
