import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Possibili percorsi del template:
 * - dev (TS): server/src/services -> ../../templates
 * - build (JS): server/dist/services -> ../../templates
 * - bundle Azure: variabile env REPORT_TEMPLATE_PATH può sovrascrivere
 */
function resolveTemplatePath(): string {
  const envPath = process.env.REPORT_TEMPLATE_PATH;
  const candidates = [
    envPath,
    path.resolve(__dirname, '../../templates/MODELLO_Report_assistenza.docx'),
    path.resolve(__dirname, '../../../templates/MODELLO_Report_assistenza.docx'),
    path.resolve(process.cwd(), 'templates/MODELLO_Report_assistenza.docx'),
    path.resolve(process.cwd(), 'server/templates/MODELLO_Report_assistenza.docx'),
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  throw new Error(
    'Template MODELLO_Report_assistenza.docx non trovato. Cercato in: ' + candidates.join(', ')
  );
}

let templateBuffer: Buffer | null = null;
function loadTemplate(): Buffer {
  if (templateBuffer) return templateBuffer;
  const p = resolveTemplatePath();
  templateBuffer = fs.readFileSync(p);
  return templateBuffer;
}

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

function fillSdtTags(xml: string, values: Record<string, string>): string {
  return xml.replace(/<w:sdt\b[^>]*>([\s\S]*?)<\/w:sdt>/g, (full) => {
    const tagMatch = full.match(/<w:tag\s+w:val="([^"]*)"\s*\/>/);
    if (!tagMatch) return full;
    const tag = tagMatch[1];
    if (!(tag in values)) return full;

    const sdtPrMatch = full.match(/<w:sdtPr>([\s\S]*?)<\/w:sdtPr>/);
    let rPr = '';
    if (sdtPrMatch) {
      const rPrMatch = sdtPrMatch[1].match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
      if (rPrMatch) rPr = rPrMatch[0];
    }
    const newSdtPr = sdtPrMatch
      ? `<w:sdtPr>${sdtPrMatch[1].replace(/<w:showingPlcHdr\s*\/>/g, '')}</w:sdtPr>`
      : '';

    const newContent = `<w:sdtContent>${buildRunContent(values[tag], rPr)}</w:sdtContent>`;
    return `<w:sdt>${newSdtPr}${newContent}</w:sdt>`;
  });
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatHoursDecimalToHHMM(hoursDecimal: number | null | undefined): string {
  if (hoursDecimal == null || isNaN(hoursDecimal)) return '';
  const totalMinutes = Math.round(hoursDecimal * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function formatNumberIt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '';
  return n.toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateIt(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export interface AssistenzaInput {
  phyo_nr?: string | null;
  phyo_data?: string | null;
  phyo_attne?: string | null;
  phyo_oreintervento?: number | null;
  phyo_ore?: number | null;
  phyo_descrizioneintervento?: string | null;
  phyo_oggetto?: string | null;
  phyo_note?: string | null;
  phyo_costoorario?: number | null;
  phyo_totale?: number | null;
  phyo_materialeutilizzato?: string | null;
  ['_phyo_risorsa_value@OData.Community.Display.V1.FormattedValue']?: string;
}

export interface AccountInput {
  name?: string | null;
  address1_line1?: string | null;
  address1_line2?: string | null;
  address1_city?: string | null;
  address1_postalcode?: string | null;
  address1_stateorprovince?: string | null;
  telephone1?: string | null;
  telephone2?: string | null;
  emailaddress1?: string | null;
  primarycontactid?: {
    fullname?: string | null;
    firstname?: string | null;
    lastname?: string | null;
    emailaddress1?: string | null;
    telephone1?: string | null;
    mobilephone?: string | null;
  } | null;
}

export function buildReportFieldValues(
  a: AssistenzaInput,
  account: AccountInput | null,
  opts: { commessaNr?: string } = {}
): ReportFieldValues {
  const contact = account?.primarycontactid || null;
  const attneFromContact =
    contact?.fullname || [contact?.firstname, contact?.lastname].filter(Boolean).join(' ');
  const tel =
    account?.telephone1 ||
    account?.telephone2 ||
    contact?.telephone1 ||
    contact?.mobilephone ||
    '';
  const mail = account?.emailaddress1 || contact?.emailaddress1 || '';

  return {
    assistenza: a.phyo_nr || '',
    commessa: opts.commessaNr || '',
    cliente: account?.name || '',
    via: [account?.address1_line1, account?.address1_line2].filter(Boolean).join(' ') || '',
    città: account?.address1_city || '',
    cap: account?.address1_postalcode || '',
    prov: account?.address1_stateorprovince || '',
    'att.ne': a.phyo_attne || attneFromContact || '',
    tel: tel || '',
    mail: mail || '',
    oggetto: a.phyo_oggetto || '',
    descrizione: a.phyo_descrizioneintervento || '',
    'data interv': formatDateIt(a.phyo_data),
    tecnico: a['_phyo_risorsa_value@OData.Community.Display.V1.FormattedValue'] || '',
    'descrizione intervento': a.phyo_descrizioneintervento || '',
    'ore viaggio': a.phyo_ore != null ? formatNumberIt(a.phyo_ore) : '',
    'ore intervento': formatHoursDecimalToHHMM(a.phyo_oreintervento ?? null),
    'costo orario': a.phyo_costoorario != null ? formatNumberIt(a.phyo_costoorario) : '',
    materiale: a.phyo_materialeutilizzato || '',
    Totale: a.phyo_totale != null ? formatNumberIt(a.phyo_totale) : '',
    note: a.phyo_note || '',
  };
}

/**
 * Costruisce il docx riempito a partire dal template e dai valori.
 */
export async function buildAssistenzaDocx(values: ReportFieldValues): Promise<Buffer> {
  const buf = loadTemplate();
  const zip = await JSZip.loadAsync(buf);
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('document.xml mancante nel template');
  const xml = await docFile.async('string');
  const newXml = fillSdtTags(xml, values as unknown as Record<string, string>);
  zip.file('word/document.xml', newXml);
  return zip.generateAsync({ type: 'nodebuffer' });
}
