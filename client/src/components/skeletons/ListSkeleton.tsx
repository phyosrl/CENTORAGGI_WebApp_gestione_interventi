import React from 'react';
import { Card, CardBody, Skeleton } from '@heroui/react';

interface ListSkeletonProps {
  /** Numero di righe scheletro da mostrare */
  rows?: number;
  /** Mostra la barra dei filtri/toolbar */
  showToolbar?: boolean;
  /** Mostra le card statistiche */
  showStats?: boolean;
  /** Numero di card statistiche */
  statsCount?: number;
}

/**
 * Skeleton di caricamento per liste (Assistenze, Commesse).
 * Mantiene la stessa struttura visiva della pagina caricata
 * per evitare layout shift e migliorare la percezione di velocità.
 */
export default function ListSkeleton({
  rows = 6,
  showToolbar = true,
  showStats = true,
  statsCount = 4,
}: ListSkeletonProps) {
  return (
    <div className="flex flex-col gap-4 sm:gap-6" aria-busy="true" aria-live="polite">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56 rounded-lg" />
          <Skeleton className="h-4 w-32 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>

      {/* Toolbar */}
      {showToolbar && (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <Skeleton className="h-10 w-full sm:w-48 rounded-lg" />
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-full sm:w-56 rounded-lg" />
        </div>
      )}

      {/* Stats cards */}
      {showStats && (
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: statsCount }).map((_, i) => (
            <Card key={i} shadow="sm" className="px-3 py-1.5">
              <div className="text-center space-y-1">
                <Skeleton className="h-6 w-8 mx-auto rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Rows */}
      <Card shadow="sm" className="bg-white overflow-hidden">
        <CardBody className="p-0">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 border-b border-default-100 last:border-b-0"
            >
              <Skeleton className="h-8 w-16 rounded-lg flex-shrink-0" />
              <Skeleton className="h-4 w-20 rounded flex-shrink-0 hidden sm:block" />
              <Skeleton className="h-5 w-14 rounded flex-shrink-0" />
              <Skeleton className="h-4 flex-1 rounded" />
              <Skeleton className="h-4 w-24 rounded hidden md:block" />
              <Skeleton className="h-6 w-20 rounded-full flex-shrink-0" />
              <Skeleton className="h-4 w-16 rounded flex-shrink-0 hidden sm:block" />
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
