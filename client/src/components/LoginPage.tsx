import React, { useState } from 'react';
import { Card, CardBody, Input, Button } from '@heroui/react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login, isLoading, error } = useAuth();
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    try {
      await login(password.trim());
    } catch {
      // error is already in context
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-centoraggi-900 to-centoraggi-700 flex items-center justify-center p-4">
      <Card shadow="lg" className="w-full max-w-sm min-w-[280px]">
        <CardBody className="gap-6 p-8 w-full">
          <div className="text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-centoraggi-fresh text-white font-bold text-2xl mx-auto">
              C
            </div>
            <h1 className="text-xl font-bold text-foreground mt-4">Centoraggi</h1>
            <p className="text-sm text-default-400 mt-1">Inserisci il tuo codice per accedere</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Codice accesso"
              placeholder="Inserisci il codice..."
              type="password"
              value={password}
              onValueChange={setPassword}
              variant="bordered"
              size="lg"
              autoFocus
              isInvalid={!!error}
              errorMessage={error || undefined}
            />
            <Button
              type="submit"
              color="primary"
              size="lg"
              isLoading={isLoading}
              isDisabled={!password.trim()}
              className="font-semibold"
            >
              Accedi
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
