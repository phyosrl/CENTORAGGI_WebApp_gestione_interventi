import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { DataverseService } from '../../services/dataverseService.js';
import { isGuid, requireAuth } from '../../services/auth.js';

const dataverseService = new DataverseService(
  process.env.DATAVERSE_URL || '',
  process.env.DATAVERSE_CLIENT_ID || '',
  process.env.DATAVERSE_CLIENT_SECRET || '',
  process.env.DATAVERSE_TENANT_ID || ''
);

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

    const assistenze = await dataverseService.getAssistenze(auth.user.id);
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
        sanitized['phyo_RifAssistenza@odata.bind'] = `/phyo_assistenzes(${rifId})`;
      }
    }

    if ('_phyo_cliente_value' in sanitized) {
      const clienteId = sanitized._phyo_cliente_value as string | null;
      delete sanitized._phyo_cliente_value;
      if (clienteId) {
        sanitized['phyo_Cliente@odata.bind'] = `/accounts(${clienteId})`;
      }
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
      sanitized['phyo_RifAssistenza@odata.bind'] = `/phyo_assistenzes(${rifId})`;
    } else {
      delete sanitized._phyo_rifassistenza_value;
    }

    if (sanitized._phyo_cliente_value) {
      const clienteId = sanitized._phyo_cliente_value as string;
      delete sanitized._phyo_cliente_value;
      sanitized['phyo_Cliente@odata.bind'] = `/accounts(${clienteId})`;
    } else {
      delete sanitized._phyo_cliente_value;
    }

    const nextNr = await dataverseService.getNextAssistenzaNr();
    sanitized.phyo_nr = nextNr;

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
