import JSZip from 'jszip';
import { AssistenzaRegistrazione } from '../types/assistenzaRegistrazione';
import { fetchAccountById, AccountDetail } from './api';

const TEMPLATE_URL = '/templates/MODELLO_Report_assistenza.docx';

export interface ReportFieldValues {
  assistenza: string;
  commessa: string;
  cliente: string;
  via: string;
  città: string;
  cap: string;
  prov: string;
  'att.ne': string;
  tel: string;
  mail: string;
  oggetto: string;
  descrizione: string;
  'data interv': string;
  tecnico: string;
  'descrizione intervento': string;
  'ore viaggio': string;
  'ore intervento': string;
  'costo orario': string;
  materiale: string;
  Totale: string;
  note: string;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Converte una stringa con eventuali a-capo nel markup `<w:t>` Word
 * (più runs separate da `<w:br/>`).
 */
function buildRunContent(text: string, rPr: string): string {
  const safe = text == null ? '' : String(text);
  if (safe === '') {
    return `<w:r>${rPr}<w:t xml:space="preserve"></w:t></w:r>`;
  }
  const lines = safe.split(/\r?\n/);
  return lines
    .map((line, i) => {
      const br = i > 0 ? '<w:br/>' : '';
      return `<w:r>${rPr}${br}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`;
    })
    .join('');
}

/**
 * Sostituisce il contenuto di tutti i Content Control (`w:sdt`) presenti in
 * `xml` il cui `w:tag` corrisponde a una chiave di `values`.
 * Mantiene il `rPr` esistente (font, dimensioni, ecc.) prendendolo dal primo
 * `w:rPr` interno all'`sdtPr` o dal primo `w:r` interno al contenuto.
 */
function fillSdtTags(xml: string, values: Record<string, string>): string {
  // Match each <w:sdt>...</w:sdt> non-greedy ma corretto: i Content Control
  // del template non sono annidati, quindi un match non-greedy basta.
  return xml.replace(/<w:sdt\b[^>]*>([\s\S]*?)<\/w:sdt>/g, (full) => {
    const tagMatch = full.match(/<w:tag\s+w:val="([^"]*)"\s*\/>/);
    if (!tagMatch) return full;
    const tag = tagMatch[1];
    if (!(tag in values)) return full;

    // Estrai rPr dal sdtPr (font dell'sdt) come default
    const sdtPrMatch = full.match(/<w:sdtPr>([\s\S]*?)<\/w:sdtPr>/);
    let rPr = '';
    if (sdtPrMatch) {
      const inner = sdtPrMatch[1];
      const rPrMatch = inner.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
      if (rPrMatch) rPr = rPrMatch[0];
    }
    // Se nel contenuto esiste già una run con rPr, usa la sua (preserva
    // grassetto/corsivo del placeholder originale)
    const contentMatch = full.match(/<w:sdtContent>([\s\S]*?)<\/w:sdtContent>/);
    if (contentMatch) {
      const firstRunRpr = contentMatch[1].match(/<w:r\b[^>]*>\s*<w:rPr>[\s\S]*?<\/w:rPr>/);
      if (firstRunRpr) {
        const onlyRpr = firstRunRpr[0].match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
        if (onlyRpr) rPr = onlyRpr[0];
      }
    }

    // Rimuovi <w:showingPlcHdr/> dal sdtPr (altrimenti Word continua a
    // mostrare il placeholder)
    const newSdtPr = sdtPrMatch
      ? `<w:sdtPr>${sdtPrMatch[1].replace(/<w:showingPlcHdr\s*\/>/g, '')}</w:sdtPr>`
      : '';

    const newContent = `<w:sdtContent>${buildRunContent(values[tag], rPr)}</w:sdtContent>`;

    // Mantieni gli attributi/qualunque cosa appaia prima di <w:sdtPr>
    const sdtOpenMatch = full.match(/^<w:sdt\b[^>]*>/);
    const sdtOpen = sdtOpenMatch ? sdtOpenMatch[0] : '<w:sdt>';
    return `${sdtOpen}${newSdtPr}${newContent}</w:sdt>`;
  });
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatHoursDecimalToHHMM(hoursDecimal: number | null): string {
  if (hoursDecimal == null || isNaN(hoursDecimal)) return '';
  const totalMinutes = Math.round(hoursDecimal * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function formatNumberIt(n: number | null): string {
  if (n == null || isNaN(n)) return '';
  return n.toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateIt(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export interface BuildReportOptions {
  /** Numero commessa (opzionale) */
  commessaNr?: string;
}

export function buildReportFieldValues(
  a: AssistenzaRegistrazione,
  account: AccountDetail | null,
  opts: BuildReportOptions = {}
): ReportFieldValues {
  const contact = account?.primarycontactid || null;
  const attneFromContact = contact?.fullname || [contact?.firstname, contact?.lastname].filter(Boolean).join(' ');
  const tel = account?.telephone1 || account?.telephone2 || contact?.telephone1 || contact?.mobilephone || '';
  const mail = account?.emailaddress1 || contact?.emailaddress1 || '';

  return {
    assistenza: a.nr || '',
    commessa: opts.commessaNr || '',
    cliente: account?.name || a.clienteNome || '',
    via: [account?.address1_line1, account?.address1_line2].filter(Boolean).join(' ') || '',
    città: account?.address1_city || '',
    cap: account?.address1_postalcode || '',
    prov: account?.address1_stateorprovince || '',
    'att.ne': a.attne || attneFromContact || '',
    tel: tel || '',
    mail: mail || '',
    oggetto: a.oggetto || '',
    descrizione: a.descrizioneIntervento || '',
    'data interv': formatDateIt(a.data),
    tecnico: a.risorsaNome || '',
    'descrizione intervento': a.descrizioneIntervento || '',
    'ore viaggio': a.ore != null ? formatNumberIt(a.ore) : '',
    'ore intervento': formatHoursDecimalToHHMM(a.oreIntervento),
    'costo orario': a.costoOrario != null ? formatNumberIt(a.costoOrario) : '',
    materiale: a.materialeUtilizzato || '',
    Totale: a.totale != null ? formatNumberIt(a.totale) : '',
    note: a.note || '',
  };
}

/**
 * Genera il report compilato come Blob (.docx).
 */
export async function generateAssistenzaReport(
  a: AssistenzaRegistrazione,
  opts: BuildReportOptions = {}
): Promise<Blob> {
  // 1. Carica il template
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) {
    throw new Error(`Impossibile caricare il template: ${res.status}`);
  }
  const templateBuffer = await res.arrayBuffer();

  // 2. Recupera dettagli account (testata cliente) se disponibile
  let account: AccountDetail | null = null;
  if (a.clienteId) {
    try {
      account = await fetchAccountById(a.clienteId);
    } catch (e) {
      console.warn('fetchAccountById fallito, procedo senza dati account:', e);
    }
  }

  // 3. Costruisci i valori per i Content Control
  const values = buildReportFieldValues(a, account, opts);

  // 4. Apri il docx come zip e sostituisci document.xml
  const zip = await JSZip.loadAsync(templateBuffer);
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('document.xml non trovato nel template');
  const docXml = await docFile.async('string');

  const newXml = fillSdtTags(docXml, values as unknown as Record<string, string>);
  zip.file('word/document.xml', newXml);

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/**
 * Innesca il download del report compilato.
 *
 * Per impostazione predefinita viene scaricato il PDF generato dal server
 * (conversione tramite SharePoint/Graph). Se il backend non è raggiungibile
 * o restituisce errore si effettua un fallback alla generazione locale del
 * `.docx`.
 */
export async function downloadAssistenzaReport(
  a: AssistenzaRegistrazione,
  opts: BuildReportOptions & { format?: 'pdf' | 'docx' } = {}
): Promise<void> {
  const format = opts.format || 'docx';
  const safeNr = (a.nr || 'assistenza').replace(/[^a-zA-Z0-9_-]+/g, '_');

  // 1. Prova a scaricare dal server (PDF di default)
  if (a.id) {
    try {
      const token = (() => {
        try {
          const raw = sessionStorage.getItem('centoraggi_user');
          if (!raw) return null;
          const u = JSON.parse(raw);
          return u?.token || null;
        } catch {
          return null;
        }
      })();
      const res = await fetch(
        `/api/dataverse/assistenze/${encodeURIComponent(a.id)}/report?format=${format}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (res.ok) {
        const blob = await res.blob();
        // Se il server ha fatto fallback a docx (PDF non disponibile),
        // adatta nome ed estensione del file in download.
        const fallbackHeader = res.headers.get('X-Report-Format');
        const isDocxFallback = fallbackHeader === 'docx-fallback';
        const ext = isDocxFallback ? 'docx' : format;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Report_assistenza_${safeNr}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        return;
      }
      // Se il server fallisce e l'utente ha richiesto PDF, propaga errore
      // (per evitare di scaricare silenziosamente un docx al posto del PDF).
      let msg = `Errore server (${res.status})`;
      try {
        const j = await res.json();
        if (j?.error) msg = j.error;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    } catch (err) {
      // Se richiesto esplicitamente docx, fai fallback locale.
      if (format === 'docx') {
        console.warn('Download server fallito, fallback generazione locale docx:', err);
      } else {
        throw err;
      }
    }
  }

  // 2. Fallback: generazione locale .docx (usata anche per record offline
  //    senza id o se l'utente forza format=docx).
  const blob = await generateAssistenzaReport(a, opts);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Report_assistenza_${safeNr}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
