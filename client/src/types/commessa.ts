export const TipologiaCommessaMap: Record<number, string> = {
  0: 'Impianto FV (<20 kWp)',
  1: 'Sistema di accumulo',
  2: 'Impianto FV+ACC',
  3: 'Solare Termico',
  4: 'Caldaia',
  5: 'Climatizzatori',
  6: 'PDC',
  7: 'PDC Ibrida',
  8: 'Colonnina Elettrica',
  9: 'Impianto Elettrico',
  10: 'Impianto Idraulico',
  11: 'Altro',
  12: 'Impianto FV (>20 kWp)',
};

export interface CommessaRaw {
  phyo_projectid: string;
  phyo_idproject: string;
  phyo_nomecommessa: string;
  phyo_descrizione: string | null;
  phyo_datacommessa: string | null;
  phyo_dataconclusionelavori: string | null;
  phyo_tipologiacommessa: number | null;
  phyo_statocommessa: number | null;
  phyo_commercialediriferimenro: string | null;
  phyo_incentivo: string | null;
  phyo_totaleivaesclusa: number | null;
  _phyo_cliente_value: string | null;
  statecode: number;
  // Formatted values (OData annotations)
  [key: `${string}@OData.Community.Display.V1.FormattedValue`]: string;
}

export interface Commessa {
  id: string;
  nrCommessa: string;
  nome: string;
  descrizione: string;
  dataCommessa: string | null;
  dataConclusione: string | null;
  tipologia: string;
  tipologiaValue: number | null;
  statoCommessa: string;
  statoCommessaValue: number | null;
  commerciale: string;
  incentivo: string;
  totaleIvaEsclusa: number | null;
  clienteId: string | null;
  clienteNome: string;
  attivo: boolean;
}

export function mapCommessa(raw: CommessaRaw): Commessa {
  return {
    id: raw.phyo_projectid,
    nrCommessa: raw.phyo_idproject ?? '',
    nome: raw.phyo_nomecommessa ?? '',
    descrizione: raw.phyo_descrizione ?? '',
    dataCommessa: raw.phyo_datacommessa,
    dataConclusione: raw.phyo_dataconclusionelavori,
    tipologiaValue: raw.phyo_tipologiacommessa,
    tipologia:
      raw['phyo_tipologiacommessa@OData.Community.Display.V1.FormattedValue'] ??
      (raw.phyo_tipologiacommessa != null
        ? TipologiaCommessaMap[raw.phyo_tipologiacommessa] ?? ''
        : ''),
    statoCommessaValue: raw.phyo_statocommessa,
    statoCommessa:
      raw['phyo_statocommessa@OData.Community.Display.V1.FormattedValue'] ?? '',
    commerciale: raw.phyo_commercialediriferimenro ?? '',
    incentivo: raw.phyo_incentivo ?? '',
    totaleIvaEsclusa: raw.phyo_totaleivaesclusa,
    clienteId: raw._phyo_cliente_value,
    clienteNome:
      raw['_phyo_cliente_value@OData.Community.Display.V1.FormattedValue'] ?? '',
    attivo: raw.statecode === 0,
  };
}
