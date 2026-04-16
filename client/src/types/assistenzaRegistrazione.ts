export interface AssistenzaRegistrazioneRaw {
  phyo_assistenzeregistrazioniid: string;
  phyo_nr: string;
  phyo_data: string | null;
  phyo_attne: string | null;
  phyo_oreintervento: number | null;
  phyo_ore: number | null;
  phyo_descrizioneintervento: string | null;
  phyo_oggetto: string | null;
  phyo_note: string | null;
  phyo_statoreg: number | null;
  phyo_statoregistrazione: number | null;
  phyo_costoorario: number | null;
  phyo_totale: number | null;
  phyo_materialeutilizzato: string | null;
  _phyo_rifassistenza_value: string | null;
  _phyo_risorsa_value: string | null;
  statecode: number;
  [key: `${string}@OData.Community.Display.V1.FormattedValue`]: string;
}

export interface AssistenzaRegistrazione {
  id: string;
  nr: string;
  data: string | null;
  attne: string;
  oreIntervento: number | null;
  ore: number | null;
  descrizioneIntervento: string;
  oggetto: string;
  note: string;
  statoReg: string;
  statoRegistrazione: string;
  costoOrario: number | null;
  totale: number | null;
  materialeUtilizzato: string;
  rifAssistenzaId: string | null;
  rifAssistenzaNome: string;
  risorsaId: string | null;
  risorsaNome: string;
  attivo: boolean;
}

export function mapAssistenzaRegistrazione(raw: AssistenzaRegistrazioneRaw): AssistenzaRegistrazione {
  return {
    id: raw.phyo_assistenzeregistrazioniid,
    nr: raw.phyo_nr ?? '',
    data: raw.phyo_data,
    attne: raw.phyo_attne ?? '',
    oreIntervento: raw.phyo_oreintervento,
    ore: raw.phyo_ore,
    descrizioneIntervento: raw.phyo_descrizioneintervento ?? '',
    oggetto: raw.phyo_oggetto ?? '',
    note: raw.phyo_note ?? '',
    statoReg:
      raw['phyo_statoreg@OData.Community.Display.V1.FormattedValue'] ?? '',
    statoRegistrazione:
      raw['phyo_statoregistrazione@OData.Community.Display.V1.FormattedValue'] ?? '',
    costoOrario: raw.phyo_costoorario,
    totale: raw.phyo_totale,
    materialeUtilizzato: raw.phyo_materialeutilizzato ?? '',
    rifAssistenzaId: raw._phyo_rifassistenza_value,
    rifAssistenzaNome:
      raw['_phyo_rifassistenza_value@OData.Community.Display.V1.FormattedValue'] ?? '',
    risorsaId: raw._phyo_risorsa_value,
    risorsaNome:
      raw['_phyo_risorsa_value@OData.Community.Display.V1.FormattedValue'] ?? '',
    attivo: raw.statecode === 0,
  };
}
