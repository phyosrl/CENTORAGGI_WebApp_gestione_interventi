import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, CardBody, addToast } from '@heroui/react';
import { MapPin } from 'lucide-react';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface MapWidgetProps {
  indirizzo: string;
  onChange: (value: string) => void;
}

export default function MapWidget({ indirizzo, onChange }: MapWidgetProps) {
  const [showMap, setShowMap] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [inputFocused, setInputFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<Map<string, NominatimResult[]>>(new Map());

  const searchAddress = useCallback((query: string) => {
    const trimmed = query.trim();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }

    const key = trimmed.toLowerCase();
    const cached = cacheRef.current.get(key);
    if (cached) {
      setSuggestions(cached);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&countrycodes=it&limit=5&q=${encodeURIComponent(trimmed)}`,
          { headers: { 'Accept-Language': 'it' } }
        );

        const data = (await res.json()) as NominatimResult[];
        cacheRef.current.set(key, data);
        setSuggestions(data);
      } catch {
        setSuggestions([]);
      }
    }, 900);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setInputFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const mapSrc = useMemo(() => {
    if (mapCenter) {
      return `https://www.google.com/maps?q=${mapCenter.lat},${mapCenter.lng}&z=15&output=embed`;
    }

    return 'https://www.google.com/maps?ll=45.5877,10.1580&z=3&output=embed';
  }, [mapCenter]);

  const openMap = useCallback(async () => {
    if (!indirizzo.trim()) return;

    setShowMap(true);
    if (mapCenter) return;

    const key = indirizzo.trim().toLowerCase();
    const cached = cacheRef.current.get(key);

    try {
      const first = cached?.[0];
      if (first) {
        setMapCenter({ lat: parseFloat(first.lat), lng: parseFloat(first.lon) });
        return;
      }

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&countrycodes=it&limit=1&q=${encodeURIComponent(indirizzo)}`,
        { headers: { 'Accept-Language': 'it' } }
      );
      const data = (await res.json()) as NominatimResult[];
      if (data[0]) {
        cacheRef.current.set(key, data);
        setMapCenter({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      }
    } catch {
      addToast({ title: 'Mappa non disponibile', description: 'Impossibile geolocalizzare l’indirizzo', color: 'warning' });
    }
  }, [indirizzo, mapCenter]);

  return (
    <Card shadow="sm" className="bg-white">
      <CardBody className="gap-2.5 p-3">
        <p className="text-xs font-semibold text-centoraggi-deep uppercase tracking-wider">Luogo assistenza</p>

        <div className="flex gap-2">
          <div className="flex-1 relative" ref={suggestionsRef}>
            <input
              type="text"
              placeholder="Cerca indirizzo..."
              value={indirizzo}
              onChange={(e) => {
                const val = e.target.value;
                onChange(val);
                setShowMap(false);
                setMapCenter(null);
                searchAddress(val);
              }}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setTimeout(() => setInputFocused(false), 200)}
              className="w-full h-[56px] px-3 rounded-xl border-2 border-centoraggi-accent/30 bg-white text-sm outline-none focus:border-centoraggi-accent transition-colors"
            />

            {inputFocused && suggestions.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-centoraggi-accent/20 max-h-[200px] overflow-y-auto">
                {suggestions.map((s) => (
                  <button
                    key={s.place_id}
                    type="button"
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-centoraggi-surface transition-colors cursor-pointer border-b border-default-100 last:border-b-0"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(s.display_name);
                      setMapCenter({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) });
                      setInputFocused(false);
                      setSuggestions([]);
                      setShowMap(true);
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 text-centoraggi-teal flex-shrink-0" />
                      <span className="text-default-700">{s.display_name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button color="primary" variant="flat" isDisabled={!indirizzo.trim()} onPress={openMap} className="mt-auto h-[56px]">
            Mappa
          </Button>
          <Button
            color="secondary"
            variant="flat"
            isDisabled={!indirizzo.trim()}
            onPress={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(indirizzo)}`, '_blank')}
            className="mt-auto h-[56px]"
          >
            Apri
          </Button>
        </div>

        {(showMap || mapCenter) && (
          <div className="w-full rounded-lg overflow-hidden border border-centoraggi-accent/20">
            <iframe
              key={mapCenter ? `${mapCenter.lat},${mapCenter.lng}` : 'world'}
              title="Mappa luogo assistenza"
              width="100%"
              height="300"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={mapSrc}
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
