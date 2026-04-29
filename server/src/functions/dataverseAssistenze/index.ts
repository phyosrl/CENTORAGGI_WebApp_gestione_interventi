import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { DataverseService } from '../../services/dataverseService.js';
import { SharePointService } from '../../services/sharepointService.js';
import { isGuid, requireAuth } from '../../services/auth.js';

const dataverseService = new DataverseService(
  process.env.DATAVERSE_URL || '',
  process.env.DATAVERSE_CLIENT_ID || '',
  process.env.DATAVERSE_CLIENT_SECRET || '',
  process.env.DATAVERSE_TENANT_ID || ''
);

const sharepointService = new SharePointService({
  tenantId: process.env.DATAVERSE_TENANT_ID || '',
  clientId: process.env.DATAVERSE_CLIENT_ID || '',
  clientSecret: process.env.DATAVERSE_CLIENT_SECRET || '',
  tenantHost: process.env.SHAREPOINT_TENANT_HOST || '',
  sitePath: process.env.SHAREPOINT_SITE_PATH || '',
  driveName: process.env.SHAREPOINT_DRIVE_NAME || '',
  siteId: process.env.SHAREPOINT_SITE_ID || undefined,
});

export async function dataverseAssistenze(request: HttpRequest): Promise<HttpResponseInit> {
  const auth = requireAuth(request);
  if (auth.response) return auth.response;

  try {
    const requestedRisorsaId = request.query.get('risorsaId') || auth.user.id;
    if (requestedRisorsaId !== auth.user.id) {
      return { status: 403, jsonBody: { error: 'Accesso negato alla risorsa richiesta' } };
    }

    const pageSizeParam = request.query.get('pageSize');
    const skipToken = request.query.get('skipToken') || undefined;
    const fromISO = request.query.get('from') || undefined;
    const toISO = request.query.get('to') || undefined;

    if (pageSizeParam) {
      const pageSize = parseInt(pageSizeParam, 10);
      if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
        return { status: 400, jsonBody: { error: 'pageSize deve essere tra 1 e 100' } };
      }

      const result = await dataverseService.getAssistenzePaged(auth.user.id, pageSize, skipToken);
      return {
        status: 200,
        jsonBody: {
          success: true,
          data: result.data,
          totalCount: result.totalCount,
          skipToken: result.skipToken,
          hasMore: result.skipToken !== null,
        },
      };
    }

    const assistenze = await dataverseService.getAssistenze(auth.user.id, fromISO, toISO);
    return {
      status: 200,
      jsonBody: {
        success: true,
        data: assistenze,
      },
    };
  } catch (error: any) {
    console.error('Dataverse error:', error?.message || error);
    return {
      status: 500,
      jsonBody: {
        error: 'Failed to fetch assistenze',
        message: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
    };
  }
}

const ALLOWED_FIELDS = new Set([
  'phyo_attne',
  'phyo_oreintervento',
  'phyo_ore',
  'phyo_descrizioneintervento',
  'phyo_materialeutilizzato',
  'phyo_totale',
  'phyo_note',
  'phyo_costoorario',
  '_phyo_rifassistenza_value',
  '_phyo_cliente_value',
  'phyo_statoreg',
  'phyo_data',
]);

export async function updateAssistenza(request: HttpRequest): Promise<HttpResponseInit> {
  const auth = requireAuth(request);
  if (auth.response) return auth.response;

  try {
    const id = request.params.id;
    if (!id || !isGuid(id)) {
      return { status: 400, jsonBody: { error: 'ID mancante o non valido' } };
    }

    const ownsRecord = await dataverseService.userOwnsAssistenza(id, auth.user.id);
    if (!ownsRecord) {
      return { status: 403, jsonBody: { error: 'Non puoi modificare questa registrazione' } };
    }

    const body = (await request.json()) as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.has(key)) {
        sanitized[key] = value;
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return { status: 400, jsonBody: { error: 'Nessun campo valido da aggiornare' } };
    }

    if ('_phyo_rifassistenza_value' in sanitized) {
      const rifId = sanitized._phyo_rifassistenza_value as string | null;
      delete sanitized._phyo_rifassistenza_value;
      // Dataverse non accetta @odata.bind=null su PATCH; per dissociare serve un DELETE
      // sulla navigation property. Omettiamo la binding se il valore è null.
      if (rifId) {
        sanitized['phyo_Rifassistenza@odata.bind'] = `/phyo_assistenzes(${rifId})`;
      }
    }

    if ('_phyo_cliente_value' in sanitized) {
      // Il lookup phyo_cliente non esiste sulla tabella phyo_assistenzeregistrazioni:
      // il cliente viene ereditato dalla phyo_assistenze collegata via phyo_rifassistenza.
      // Scartiamo il valore per evitare l'errore "undeclared property phyo_Cliente".
      delete sanitized._phyo_cliente_value;
    }

    await dataverseService.updateAssistenza(id, sanitized);
    return {
      status: 200,
      jsonBody: { success: true },
    };
  } catch (error: any) {
    console.error('Update error:', error?.message || error);
    return {
      status: 500,
      jsonBody: {
        error: 'Aggiornamento fallito',
        message: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
    };
  }
}

const CREATE_ALLOWED_FIELDS = new Set([
  'phyo_attne',
  'phyo_oreintervento',
  'phyo_ore',
  'phyo_descrizioneintervento',
  'phyo_materialeutilizzato',
  'phyo_totale',
  'phyo_note',
  'phyo_costoorario',
  'phyo_data',
  '_phyo_rifassistenza_value',
  '_phyo_cliente_value',
]);

export async function createAssistenza(request: HttpRequest): Promise<HttpResponseInit> {
  const auth = requireAuth(request);
  if (auth.response) return auth.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body)) {
      if (CREATE_ALLOWED_FIELDS.has(key)) {
        sanitized[key] = value;
      }
    }

    sanitized['phyo_Risorsa@odata.bind'] = `/phyo_risorses(${auth.user.id})`;

    if (sanitized._phyo_rifassistenza_value) {
      const rifId = sanitized._phyo_rifassistenza_value as string;
      delete sanitized._phyo_rifassistenza_value;
      sanitized['phyo_Rifassistenza@odata.bind'] = `/phyo_assistenzes(${rifId})`;
      // Se è presente il riferimento all'assistenza, il cliente viene
      // ereditato dalla phyo_assistenze collegata: non lo inviamo per evitare
      // l'errore "undeclared property phyo_Cliente" (lookup non presente sulla
      // tabella phyo_assistenzeregistrazioni).
      delete sanitized._phyo_cliente_value;
    } else {
      delete sanitized._phyo_rifassistenza_value;
      // TODO: gestire il caso in cui non c'è phyo_rifassistenza
      // (decidere se creare il lookup phyo_cliente sulla registrazione
      // o se rendere il rif assistenza obbligatorio).
      delete sanitized._phyo_cliente_value;
    }

    // phyo_nr è una colonna di numerazione automatica (autonumber) lato Dataverse:
    // NON va valorizzata dal client, altrimenti il valore inviato sovrascrive
    // quello generato automaticamente (prefisso AR-XXXX).
    delete (sanitized as any).phyo_nr;

    const id = await dataverseService.createAssistenza(sanitized);
    return {
      status: 201,
      jsonBody: { success: true, id },
    };
  } catch (error: any) {
    console.error('Create error:', error?.response?.data || error?.message || error);
    return {
      status: 500,
      jsonBody: {
        error: 'Creazione fallita',
        message: process.env.NODE_ENV === 'development' ? (error?.response?.data || error?.message) : undefined,
      },
    };
  }
}

app.http('dataverseAssistenze', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'dataverse/assistenze',
  handler: dataverseAssistenze,
});

app.http('createAssistenza', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'dataverse/assistenze',
  handler: createAssistenza,
});

app.http('updateAssistenza', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'dataverse/assistenze/{id}',
  handler: updateAssistenza,
});

export async function getRifAssistenze(request: HttpRequest): Promise<HttpResponseInit> {
  const auth = requireAuth(request);
  if (auth.response) return auth.response;

  try {
    const items = await dataverseService.getRifAssistenze();
    return {
      status: 200,
      jsonBody: { success: true, data: items },
    };
  } catch (error: any) {
    console.error('getRifAssistenze error:', error?.message || error);
    return {
      status: 500,
      jsonBody: { error: 'Failed to fetch rif assistenze' },
    };
  }
}

app.http('getRifAssistenze', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'dataverse/rifassistenze',
  handler: getRifAssistenze,
});

export async function getTipologiaAssistenzaOptions(
  request: HttpRequest
): Promise<HttpResponseInit> {
  const auth = requireAuth(request);
  if (auth.response) return auth.response;

  try {
    const items = await dataverseService.getTipologiaAssistenzaOptions();
    return {
      status: 200,
      jsonBody: { success: true, data: items },
    };
  } catch (error: any) {
    console.error('getTipologiaAssistenzaOptions error:', error?.message || error);
    return {
      status: 500,
      jsonBody: { error: 'Failed to fetch tipologia assistenza options' },
    };
  }
}

app.http('getTipologiaAssistenzaOptions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'dataverse/tipologie-assistenza',
  handler: getTipologiaAssistenzaOptions,
});

export async function getAccounts(request: HttpRequest): Promise<HttpResponseInit> {
  const auth = requireAuth(request);
  if (auth.response) return auth.response;

  try {
    const items = await dataverseService.getAccounts();
    return {
      status: 200,
      jsonBody: { success: true, data: items },
    };
  } catch (error: any) {
    console.error('getAccounts error:', error?.message || error);
    return {
      status: 500,
      jsonBody: { error: 'Failed to fetch accounts' },
    };
  }
}

app.http('getAccounts', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'dataverse/accounts',
  handler: getAccounts,
});

export async function getAnnotations(request: HttpRequest): Promise<HttpResponseInit> {
  const auth = requireAuth(request);
  if (auth.response) return auth.response;

  try {
    const registrazioneId = request.params.registrazioneId;
    if (!registrazioneId || !isGuid(registrazioneId)) {
      return { status: 400, jsonBody: { error: 'registrazioneId non valido' } };
    }

    const ownsRecord = await dataverseService.userOwnsAssistenza(registrazioneId, auth.user.id);
    if (!ownsRecord) {
      return { status: 403, jsonBody: { error: 'Accesso negato agli allegati' } };
    }

    const items = await dataverseService.getAnnotations(registrazioneId);
    return {
      status: 200,
      jsonBody: { success: true, data: items },
    };
  } catch (error: any) {
    console.error('getAnnotations error:', error?.message || error);
    return {
      status: 500,
      jsonBody: { error: 'Failed to fetch annotations' },
    };
  }
}

app.http('getAnnotations', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'dataverse/assistenze/{registrazioneId}/images',
  handler: getAnnotations,
});

export async function uploadAnnotation(request: HttpRequest): Promise<HttpResponseInit> {
  const auth = requireAuth(request);
  if (auth.response) return auth.response;

  try {
    const registrazioneId = request.params.registrazioneId;
    if (!registrazioneId || !isGuid(registrazioneId)) {
      return { status: 400, jsonBody: { error: 'registrazioneId non valido' } };
    }

    const ownsRecord = await dataverseService.userOwnsAssistenza(registrazioneId, auth.user.id);
    if (!ownsRecord) {
      return { status: 403, jsonBody: { error: 'Accesso negato agli allegati' } };
    }

    const body = (await request.json()) as {
      filename?: string;
      mimetype?: string;
      documentbody?: string;
      subject?: string;
    };

    if (!body.filename || !body.mimetype || !body.documentbody) {
      return { status: 400, jsonBody: { error: 'filename, mimetype e documentbody sono obbligatori' } };
    }

    if (!body.mimetype.startsWith('image/')) {
      return { status: 400, jsonBody: { error: 'Sono consentiti solo file immagine' } };
    }

    if (body.documentbody.length > 8_000_000) {
      return { status: 400, jsonBody: { error: 'Immagine troppo grande' } };
    }

    const id = await dataverseService.createAnnotation(
      registrazioneId,
      body.filename,
      body.mimetype,
      body.documentbody,
      body.subject
    );

    return {
      status: 201,
      jsonBody: { success: true, id },
    };
  } catch (error: any) {
    console.error('uploadAnnotation error:', error?.response?.data || error?.message || error);
    return {
      status: 500,
      jsonBody: { error: 'Failed to upload image' },
    };
  }
}

app.http('uploadAnnotation', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'dataverse/assistenze/{registrazioneId}/images',
  handler: uploadAnnotation,
});

export async function deleteAnnotation(request: HttpRequest): Promise<HttpResponseInit> {
  const auth = requireAuth(request);
  if (auth.response) return auth.response;

  try {
    const annotationId = request.params.annotationId;
    if (!annotationId || !isGuid(annotationId)) {
      return { status: 400, jsonBody: { error: 'annotationId non valido' } };
    }

    const parentRecordId = await dataverseService.getAnnotationParentRecordId(annotationId);
    if (!parentRecordId) {
      return { status: 404, jsonBody: { error: 'Allegato non trovato' } };
    }

    const ownsRecord = await dataverseService.userOwnsAssistenza(parentRecordId, auth.user.id);
    if (!ownsRecord) {
      return { status: 403, jsonBody: { error: 'Non puoi eliminare questo allegato' } };
    }

    await dataverseService.deleteAnnotation(annotationId);
    return {
      status: 200,
      jsonBody: { success: true },
    };
  } catch (error: any) {
    console.error('deleteAnnotation error:', error?.message || error);
    return {
      status: 500,
      jsonBody: { error: 'Failed to delete annotation' },
    };
  }
}

app.http('deleteAnnotation', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'dataverse/annotations/{annotationId}',
  handler: deleteAnnotation,
});

/**
 * Upload di un file su SharePoint legato ad una registrazione di assistenza.
 * La cartella viene creata (se non esiste) seguendo lo schema:
 *   <driveAssistenze>/<TipologiaAssistenza>/<NrAssistenza> - <Cliente>/
 * Richiede che la registrazione abbia un phyo_rifassistenza valorizzato.
 */
export async function uploadSharepointFile(request: HttpRequest): Promise<HttpResponseInit> {
  const auth = requireAuth(request);
  if (auth.response) return auth.response;

  try {
    const registrazioneId = request.params.registrazioneId;
    if (!registrazioneId || !isGuid(registrazioneId)) {
      return { status: 400, jsonBody: { error: 'registrazioneId non valido' } };
    }

    const ownsRecord = await dataverseService.userOwnsAssistenza(registrazioneId, auth.user.id);
    if (!ownsRecord) {
      return { status: 403, jsonBody: { error: 'Accesso negato a questa registrazione' } };
    }

    const body = (await request.json()) as {
      filename?: string;
      mimetype?: string;
      documentbody?: string;
    };

    if (!body.filename || !body.mimetype || !body.documentbody) {
      return {
        status: 400,
        jsonBody: { error: 'filename, mimetype e documentbody sono obbligatori' },
      };
    }

    // 25 MB base64 ≈ 18 MB binario: limite ragionevole per foto da smartphone.
    if (body.documentbody.length > 25_000_000) {
      return { status: 400, jsonBody: { error: 'File troppo grande (max ~18 MB)' } };
    }

    const folderInfo = await dataverseService.getSharePointFolderInfo(registrazioneId);
    if (!folderInfo) {
      return {
        status: 400,
        jsonBody: {
          error:
            'Impossibile determinare la cartella SharePoint: la registrazione deve avere un riferimento assistenza con tipologia, numero e cliente valorizzati.',
        },
      };
    }

    const result = await sharepointService.uploadAssistenzaFile({
      tipologiaLabel: folderInfo.tipologiaLabel,
      nrAssistenza: folderInfo.nrAssistenza,
      clienteName: folderInfo.clienteName,
      filename: body.filename,
      mimetype: body.mimetype,
      contentBase64: body.documentbody,
    });

    // Salva su Dataverse l'URL della cartella (se non già impostato)
    try {
      await dataverseService.setCartellaSharepoint(registrazioneId, result.folderWebUrl);
    } catch (e: any) {
      console.warn('setCartellaSharepoint failed (non blocking):', e?.message || e);
    }

    return {
      status: 201,
      jsonBody: {
        success: true,
        fileId: result.fileId,
        webUrl: result.webUrl,
        folderWebUrl: result.folderWebUrl,
        folderPath: result.folderPath,
      },
    };
  } catch (error: any) {
    const detail = error?.response?.data || error?.message || String(error);
    console.error('uploadSharepointFile error:', detail);
    const graphErrorMessage =
      error?.response?.data?.error?.message ||
      error?.message ||
      (typeof detail === 'string' ? detail : undefined);
    const graphCode = error?.graphCode || error?.response?.data?.error?.code;
    const graphUrl = error?.graphUrl;
    const composed = [
      'Upload SharePoint fallito',
      graphCode ? `[${graphCode}]` : '',
      graphErrorMessage,
      graphUrl ? `(${graphUrl})` : '',
    ]
      .filter(Boolean)
      .join(' ');
    return {
      status: 500,
      jsonBody: {
        error: composed,
        message:
          process.env.NODE_ENV === 'development'
            ? error?.response?.data || error?.message
            : undefined,
      },
    };
  }
}

app.http('uploadSharepointFile', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'dataverse/assistenze/{registrazioneId}/sharepoint-files',
  handler: uploadSharepointFile,
});

/** Elenca i file presenti nella cartella SharePoint della registrazione. */
export async function listSharepointFiles(request: HttpRequest): Promise<HttpResponseInit> {
  const auth = requireAuth(request);
  if (auth.response) return auth.response;

  try {
    const registrazioneId = request.params.registrazioneId;
    if (!registrazioneId || !isGuid(registrazioneId)) {
      return { status: 400, jsonBody: { error: 'registrazioneId non valido' } };
    }

    const ownsRecord = await dataverseService.userOwnsAssistenza(registrazioneId, auth.user.id);
    if (!ownsRecord) {
      return { status: 403, jsonBody: { error: 'Accesso negato a questa registrazione' } };
    }

    const folderInfo = await dataverseService.getSharePointFolderInfo(registrazioneId);
    if (!folderInfo) {
      return { status: 200, jsonBody: { success: true, data: [] } };
    }

    const items = await sharepointService.listAssistenzaFiles({
      tipologiaLabel: folderInfo.tipologiaLabel,
      nrAssistenza: folderInfo.nrAssistenza,
      clienteName: folderInfo.clienteName,
    });

    return { status: 200, jsonBody: { success: true, data: items } };
  } catch (error: any) {
    console.error('listSharepointFiles error:', error?.response?.data || error?.message || error);
    const graphMsg = error?.response?.data?.error?.message;
    return {
      status: 500,
      jsonBody: {
        error: graphMsg ? `Lettura cartella SharePoint fallita: ${graphMsg}` : 'Lettura cartella SharePoint fallita',
      },
    };
  }
}

app.http('listSharepointFiles', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'dataverse/assistenze/{registrazioneId}/sharepoint-files',
  handler: listSharepointFiles,
});

/** Elimina un file SharePoint legato ad una registrazione. */
export async function deleteSharepointFile(request: HttpRequest): Promise<HttpResponseInit> {
  const auth = requireAuth(request);
  if (auth.response) return auth.response;

  try {
    const registrazioneId = request.params.registrazioneId;
    const itemId = request.params.itemId;
    if (!registrazioneId || !isGuid(registrazioneId)) {
      return { status: 400, jsonBody: { error: 'registrazioneId non valido' } };
    }
    if (!itemId) {
      return { status: 400, jsonBody: { error: 'itemId mancante' } };
    }

    const ownsRecord = await dataverseService.userOwnsAssistenza(registrazioneId, auth.user.id);
    if (!ownsRecord) {
      return { status: 403, jsonBody: { error: 'Accesso negato a questa registrazione' } };
    }

    await sharepointService.deleteFile(itemId);
    return { status: 200, jsonBody: { success: true } };
  } catch (error: any) {
    console.error('deleteSharepointFile error:', error?.response?.data || error?.message || error);
    const graphMsg = error?.response?.data?.error?.message;
    return {
      status: 500,
      jsonBody: {
        error: graphMsg ? `Eliminazione file SharePoint fallita: ${graphMsg}` : 'Eliminazione file SharePoint fallita',
      },
    };
  }
}

app.http('deleteSharepointFile', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'dataverse/assistenze/{registrazioneId}/sharepoint-files/{itemId}',
  handler: deleteSharepointFile,
});

/** Endpoint diagnostico: verifica risoluzione site/drive SharePoint senza upload. */
export async function sharepointProbe(request: HttpRequest): Promise<HttpResponseInit> {
  const auth = requireAuth(request);
  if (auth.response) return auth.response;
  try {
    const info = await sharepointService.probe();
    return {
      status: 200,
      jsonBody: {
        success: true,
        config: {
          tenantHost: process.env.SHAREPOINT_TENANT_HOST,
          sitePath: process.env.SHAREPOINT_SITE_PATH,
          driveName: process.env.SHAREPOINT_DRIVE_NAME,
          siteIdEnv: process.env.SHAREPOINT_SITE_ID || null,
        },
        info,
      },
    };
  } catch (error: any) {
    const detail = error?.response?.data || error?.message || String(error);
    console.error('sharepointProbe error:', detail);
    return {
      status: 500,
      jsonBody: {
        error: 'Probe SharePoint fallito',
        graphCode: error?.graphCode || error?.response?.data?.error?.code,
        graphMessage: error?.response?.data?.error?.message || error?.message,
        graphUrl: error?.graphUrl,
        detail: process.env.NODE_ENV === 'development' ? detail : undefined,
      },
    };
  }
}

app.http('sharepointProbe', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'dataverse/sharepoint-probe',
  handler: sharepointProbe,
});
