import axios, { AxiosInstance } from 'axios';

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

/**
 * Servizio per upload file su SharePoint Online via Microsoft Graph.
 * Usa client_credentials grant. Richiede sull'App Registration:
 * - Microsoft Graph -> Sites.ReadWrite.All (Application) con admin consent
 *   (oppure Sites.Selected con grant esplicito sul sito).
 */
export class SharePointService {
  private graph: AxiosInstance;
  private tenantId: string;
  private clientId: string;
  private clientSecret: string;
  private tenantHost: string;
  private sitePath: string;
  private driveName: string;

  private accessToken = '';
  private tokenExpiry = 0;

  private siteId: string | null = null;
  private driveId: string | null = null;

  constructor(opts: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    tenantHost: string; // es. centoraggi.sharepoint.com
    sitePath: string;   // es. /sites/all
    driveName: string;  // es. Assistenze (nome libreria documenti)
    siteId?: string;    // opzionale: bypass risoluzione via path
  }) {
    this.tenantId = opts.tenantId;
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.tenantHost = opts.tenantHost;
    this.sitePath = opts.sitePath.startsWith('/') ? opts.sitePath : `/${opts.sitePath}`;
    this.driveName = opts.driveName;
    if (opts.siteId) this.siteId = opts.siteId;

    this.graph = axios.create({
      baseURL: 'https://graph.microsoft.com/v1.0',
      timeout: 60_000,
    });
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiry) return this.accessToken;

    const url = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
    });
    const res = await axios.post<TokenResponse>(url, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    this.accessToken = res.data.access_token;
    this.tokenExpiry = now + res.data.expires_in * 1000 - 60_000;
    return this.accessToken;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return { Authorization: `Bearer ${token}` };
  }

  /** Risolve siteId e driveId dalla configurazione e li memorizza. */
  private async resolveSiteAndDrive(): Promise<{ siteId: string; driveId: string }> {
    if (this.siteId && this.driveId) {
      return { siteId: this.siteId, driveId: this.driveId };
    }
    const headers = await this.authHeaders();

    // siteId: se non già configurato, prova varie strategie
    if (!this.siteId) {
      this.siteId = await this.resolveSiteId(headers);
    }

    // driveId (cerca per nome di libreria documenti)
    const drivesUrl = `/sites/${this.siteId}/drives?$select=id,name`;
    console.log('[SP] resolve drives:', drivesUrl);
    const drivesRes = await this.graphCall('GET', drivesUrl, undefined, headers);
    const drives: Array<{ id: string; name: string }> = drivesRes.data.value || [];
    console.log('[SP] available drives:', drives.map((d) => d.name).join(', '));
    const target =
      drives.find((d) => d.name?.toLowerCase() === this.driveName.toLowerCase()) ||
      drives[0];
    if (!target) throw new Error(`Drive '${this.driveName}' non trovato nel sito`);
    this.driveId = target.id;

    return { siteId: this.siteId, driveId: this.driveId };
  }

  /**
   * Strategia di risoluzione siteId con fallback:
   *  1) GET /sites/{host}:{path}     (forma più comune)
   *  2) GET /sites/{host}:{path}:    (alcuni tenant la richiedono)
   *  3) GET /sites/{host}/sites/{lastSegment}  (relative search)
   *  4) GET /sites?search={lastSegment}        (full-text search)
   */
  private async resolveSiteId(headers: Record<string, string>): Promise<string> {
    const host = this.tenantHost;
    const path = this.sitePath; // es. /sites/all
    const lastSeg = path.split('/').filter(Boolean).pop() || '';

    const tryUrls: string[] = [
      `/sites/${host}:${path}`,
      `/sites/${host}:${path}:`,
    ];
    // forma alternativa: /sites/{host}/sites/{name}
    if (lastSeg) {
      tryUrls.push(`/sites/${host}/sites/${encodeURIComponent(lastSeg)}`);
    }
    // root site (utile per debug e per scoprire siteCollection)
    tryUrls.push(`/sites/${host}`);

    let lastErr: any = null;
    for (const url of tryUrls) {
      try {
        console.log('[SP] resolve site (try):', url);
        const res = await this.graphCall('GET', url, undefined, headers);
        const id = res.data?.id as string | undefined;
        const webUrl = res.data?.webUrl as string | undefined;
        const expected = `https://${host}${path}`.toLowerCase();
        // Se l'URL non corrisponde (es. abbiamo preso il root), continua
        if (id && webUrl && webUrl.toLowerCase() !== expected) {
          console.log('[SP] resolved different site:', webUrl, '— expected:', expected);
          // non interrompere: tienilo solo come fallback se nulla matcha
          if (!lastErr) lastErr = new Error(`Sito risolto diverso da ${expected}: ${webUrl}`);
          continue;
        }
        if (id) return id;
      } catch (err: any) {
        lastErr = err;
        const status = err?.graphStatus ?? err?.response?.status;
        const code = err?.graphCode || err?.response?.data?.error?.code;
        console.warn('[SP] resolve site failed:', url, status, code);
      }
    }

    // Search fallback
    if (lastSeg) {
      try {
        const searchUrl = `/sites?search=${encodeURIComponent(lastSeg)}&$select=id,name,webUrl,siteCollection`;
        console.log('[SP] resolve site (search):', searchUrl);
        const res = await this.graphCall('GET', searchUrl, undefined, headers);
        const sites: Array<{ id: string; webUrl: string; name?: string }> = res.data?.value || [];
        console.log(
          '[SP] search results:',
          sites.map((s) => `${s.name || ''} -> ${s.webUrl}`).join(' | '),
        );
        const expected = `https://${host}${path}`.toLowerCase();
        const exact = sites.find((s) => (s.webUrl || '').toLowerCase() === expected);
        if (exact?.id) return exact.id;
        const sameHost = sites.find((s) =>
          (s.webUrl || '').toLowerCase().startsWith(`https://${host.toLowerCase()}`),
        );
        if (sameHost?.id) return sameHost.id;
      } catch (err: any) {
        console.warn('[SP] search fallback failed:', err?.graphCode, err?.message);
      }
    }

    throw lastErr ||
      new Error(`Impossibile risolvere il sito SharePoint ${host}${path}`);
  }

  /** Wrapper Graph con log dettagliato in caso di errore. */
  private async graphCall(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    body: any,
    headers: Record<string, string>,
    extraOpts?: { contentType?: string },
  ): Promise<any> {
    try {
      switch (method) {
        case 'GET':
          return await this.graph.get(url, { headers });
        case 'DELETE':
          return await this.graph.delete(url, { headers });
        case 'POST':
          return await this.graph.post(url, body, {
            headers: { ...headers, 'Content-Type': extraOpts?.contentType || 'application/json' },
          });
        case 'PUT':
          return await this.graph.put(url, body, {
            headers: { ...headers, 'Content-Type': extraOpts?.contentType || 'application/octet-stream' },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
          });
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const code = data?.error?.code;
      const message = data?.error?.message;
      console.error(`[SP] ${method} ${url} -> ${status} ${code || ''}: ${message || err?.message}`);
      // Re-throw arricchendo con info utili per il client
      const enriched = new Error(message || err?.message || 'Graph error');
      (enriched as any).response = err?.response;
      (enriched as any).graphCode = code;
      (enriched as any).graphStatus = status;
      (enriched as any).graphUrl = url;
      throw enriched;
    }
  }

  /**
   * Sostituisce i caratteri non validi nei nomi di file/cartella SharePoint.
   * Vietati: " * : < > ? / \ |
   */
  private sanitizeName(name: string): string {
    return name
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Crea (idempotente) la catena di cartelle, segmento per segmento. */
  private async ensureFolderPath(driveId: string, segments: string[]): Promise<string> {
    const headers = await this.authHeaders();
    let parentPath = ''; // path relativo alla root del drive
    for (const raw of segments) {
      const seg = this.sanitizeName(raw);
      if (!seg) continue;
      const childPath = parentPath ? `${parentPath}/${seg}` : seg;
      const checkUrl = `/drives/${driveId}/root:/${encodeURI(childPath)}`;
      try {
        // verifica se la cartella esiste
        console.log('[SP] check folder:', checkUrl);
        await this.graphCall('GET', checkUrl, undefined, headers);
      } catch (err: any) {
        const status = err?.graphStatus ?? err?.response?.status;
        if (status !== 404) throw err;
        // creazione
        const parentRef = parentPath
          ? `/drives/${driveId}/root:/${encodeURI(parentPath)}:/children`
          : `/drives/${driveId}/root/children`;
        console.log('[SP] create folder:', parentRef, 'name=', seg);
        await this.graphCall(
          'POST',
          parentRef,
          {
            name: seg,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'fail',
          },
          headers,
        );
      }
      parentPath = childPath;
    }
    return parentPath;
  }

  /**
   * Carica un file (max ~4 MB) in una cartella creata sotto:
   *   <driveName>/<tipologia>/<nrAssistenza> - <cliente>/
   * Restituisce webUrl e parentFolderUrl.
   */
  async uploadAssistenzaFile(opts: {
    tipologiaLabel: string;
    nrAssistenza: string;
    clienteName: string;
    filename: string;
    contentBase64: string;
    mimetype: string;
  }): Promise<{ fileId: string; webUrl: string; folderWebUrl: string; folderPath: string }> {
    const { driveId } = await this.resolveSiteAndDrive();
    const folderName = this.sanitizeName(`${opts.nrAssistenza} - ${opts.clienteName}`);
    const folderPath = await this.ensureFolderPath(driveId, [
      opts.tipologiaLabel,
      folderName,
    ]);

    const headers = await this.authHeaders();
    const safeFilename = this.sanitizeName(opts.filename);
    const buffer = Buffer.from(opts.contentBase64, 'base64');

    let fileItem: { id: string; webUrl: string };
    if (buffer.length <= 4 * 1024 * 1024) {
      const uploadUrl = `/drives/${driveId}/root:/${encodeURI(folderPath)}/${encodeURIComponent(safeFilename)}:/content`;
      console.log('[SP] upload (simple):', uploadUrl, 'bytes=', buffer.length);
      const res = await this.graphCall(
        'PUT',
        uploadUrl,
        buffer,
        headers,
        { contentType: opts.mimetype || 'application/octet-stream' },
      );
      fileItem = { id: res.data.id, webUrl: res.data.webUrl };
    } else {
      console.log('[SP] upload (session):', folderPath, '/', safeFilename, 'bytes=', buffer.length);
      fileItem = await this.uploadLargeFile(driveId, folderPath, safeFilename, buffer, headers);
    }

    // Recupero webUrl della cartella per salvarlo su Dataverse
    const folderInfoUrl = `/drives/${driveId}/root:/${encodeURI(folderPath)}?$select=webUrl`;
    const folderInfoRes = await this.graphCall('GET', folderInfoUrl, undefined, headers);

    return {
      fileId: fileItem.id,
      webUrl: fileItem.webUrl,
      folderWebUrl: folderInfoRes.data.webUrl,
      folderPath,
    };
  }

  /**
   * Upload di file >4MB tramite createUploadSession + chunk PUT.
   * I chunk devono essere multipli di 320 KiB (eccetto l'ultimo).
   */
  private async uploadLargeFile(
    driveId: string,
    folderPath: string,
    safeFilename: string,
    buffer: Buffer,
    headers: Record<string, string>,
  ): Promise<{ id: string; webUrl: string }> {
    const sessionUrl =
      `/drives/${driveId}/root:/${encodeURI(folderPath)}/${encodeURIComponent(safeFilename)}:/createUploadSession`;
    console.log('[SP] createUploadSession:', sessionUrl);
    const sessionRes = await this.graphCall(
      'POST',
      sessionUrl,
      {
        item: {
          '@microsoft.graph.conflictBehavior': 'replace',
          name: safeFilename,
        },
      },
      headers,
    );
    const uploadUrl: string = sessionRes.data.uploadUrl;
    if (!uploadUrl) throw new Error('Upload session senza uploadUrl');

    const CHUNK = 5 * 320 * 1024; // 1.6 MB, multiplo di 320 KiB
    const total = buffer.length;
    let offset = 0;
    let lastResponse: any = null;
    while (offset < total) {
      const end = Math.min(offset + CHUNK, total);
      const slice = buffer.subarray(offset, end);
      const range = `bytes ${offset}-${end - 1}/${total}`;
      // L'uploadUrl è preautenticato: non serve Authorization
      const res = await axios.put(uploadUrl, slice, {
        headers: {
          'Content-Length': String(slice.length),
          'Content-Range': range,
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        // 200/201 = file completato; 202 = chunk accettato
        validateStatus: (s) => s === 200 || s === 201 || s === 202,
      });
      lastResponse = res;
      offset = end;
    }
    const data = lastResponse?.data;
    if (!data?.id || !data?.webUrl) {
      throw new Error('Upload session terminata senza driveItem');
    }
    return { id: data.id, webUrl: data.webUrl };
  }

  /**
   * Elenca i file presenti nella cartella della registrazione.
   * Se la cartella non esiste ancora, ritorna [].
   */
  async listAssistenzaFiles(opts: {
    tipologiaLabel: string;
    nrAssistenza: string;
    clienteName: string;
  }): Promise<Array<{
    id: string;
    name: string;
    size: number;
    mimetype: string | null;
    webUrl: string;
    downloadUrl: string | null;
    createdDateTime: string;
  }>> {
    const { driveId } = await this.resolveSiteAndDrive();
    const folderName = this.sanitizeName(`${opts.nrAssistenza} - ${opts.clienteName}`);
    const tipologiaSeg = this.sanitizeName(opts.tipologiaLabel);
    const folderPath = `${tipologiaSeg}/${folderName}`;

    const headers = await this.authHeaders();
    try {
      const listUrl = `/drives/${driveId}/root:/${encodeURI(folderPath)}:/children?$select=id,name,size,file,webUrl,createdDateTime,@microsoft.graph.downloadUrl`;
      const res = await this.graphCall('GET', listUrl, undefined, headers);
      const items: any[] = res.data.value || [];
      // filtra solo file (esclude eventuali sottocartelle)
      return items
        .filter((it) => !!it.file)
        .map((it) => ({
          id: it.id,
          name: it.name,
          size: it.size ?? 0,
          mimetype: it.file?.mimeType ?? null,
          webUrl: it.webUrl,
          downloadUrl: it['@microsoft.graph.downloadUrl'] ?? null,
          createdDateTime: it.createdDateTime,
        }));
    } catch (err: any) {
      const status = err?.graphStatus ?? err?.response?.status;
      if (status === 404) return [];
      throw err;
    }
  }

  /** Elimina un file SharePoint per item id (driveItem id). */
  async deleteFile(itemId: string): Promise<void> {
    const { driveId } = await this.resolveSiteAndDrive();
    const headers = await this.authHeaders();
    await this.graphCall(
      'DELETE',
      `/drives/${driveId}/items/${encodeURIComponent(itemId)}`,
      undefined,
      headers,
    );
  }

  /** Diagnostic: ritorna info di risoluzione site/drive senza eseguire upload. */
  async probe(): Promise<{
    siteId: string;
    siteWebUrl?: string;
    driveId: string;
    driveName: string;
    drives: string[];
  }> {
    const headers = await this.authHeaders();
    const siteId = this.siteId || (await this.resolveSiteId(headers));
    this.siteId = siteId;
    const siteRes = await this.graphCall('GET', `/sites/${siteId}?$select=id,webUrl`, undefined, headers);
    const drivesRes = await this.graphCall(
      'GET',
      `/sites/${siteId}/drives?$select=id,name`,
      undefined,
      headers,
    );
    const drives: Array<{ id: string; name: string }> = drivesRes.data.value || [];
    const target =
      drives.find((d) => d.name?.toLowerCase() === this.driveName.toLowerCase()) || drives[0];
    if (!target) throw new Error(`Drive '${this.driveName}' non trovato nel sito`);
    this.driveId = target.id;
    return {
      siteId,
      siteWebUrl: siteRes.data?.webUrl,
      driveId: target.id,
      driveName: target.name,
      drives: drives.map((d) => d.name),
    };
  }
}
