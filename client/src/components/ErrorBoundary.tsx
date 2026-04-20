import React from 'react';
import { Button, Card, CardBody } from '@heroui/react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Errore imprevisto',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('UI crash intercepted by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-[#e8f4f8] to-[#c5e4ed] flex items-center justify-center p-4">
          <Card className="max-w-lg w-full border-danger/20">
            <CardBody className="gap-4 p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-danger/10 text-danger text-2xl mx-auto flex items-center justify-center">
                !
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Si è verificato un errore</h1>
                <p className="text-sm text-default-500 mt-2">
                  L'app ha bloccato un crash imprevisto. Puoi ricaricare la pagina in sicurezza.
                </p>
                {this.state.message && (
                  <p className="text-xs text-danger mt-2">{this.state.message}</p>
                )}
              </div>
              <Button color="primary" onPress={this.handleReload}>
                Ricarica applicazione
              </Button>
            </CardBody>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
