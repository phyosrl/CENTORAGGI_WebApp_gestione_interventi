import axios, { AxiosInstance } from 'axios';

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

export class DataverseService {
  private client: AxiosInstance;
  private dataverseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private tenantId: string;
  private accessToken: string = '';
  private tokenExpiry: number = 0;

  private sanitizeGuid(id: string): string {
    const trimmed = id.trim();
    if (!/^[0-9a-fA-F-]{36}$/.test(trimmed)) {
      throw new Error('Invalid GUID value');
    }
    return trimmed;
  }

  constructor(
    dataverseUrl: string,
    clientId: string,
    clientSecret: string,
    tenantId: string
  ) {
    this.dataverseUrl = dataverseUrl;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.tenantId = tenantId;

    this.client = axios.create({
      baseURL: dataverseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
      }
    });
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: `${this.dataverseUrl}/.default`
      });

      const response = await axios.post<TokenResponse>(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = now + (response.data.expires_in * 1000) - 60000;

      return this.accessToken;
    } catch (error) {
      console.error('Token acquisition failed:', error);
      throw new Error('Failed to acquire access token');
    }
  }

  async query(entityName: string, filter?: string, select?: string[], orderby?: string, expand?: string): Promise<any[]> {
    const token = await this.getAccessToken();
    
    let url = `/api/data/v9.2/${entityName}`;
    const params = new URLSearchParams();

    if (filter) {
      params.append('$filter', filter);
    }
    if (select && select.length > 0) {
      params.append('$select', select.join(','));
    }
    if (expand) {
      params.append('$expand', expand);
    }
    if (orderby) {
      params.append('$orderby', orderby);
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    try {
      const response = await this.client.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'odata.include-annotations="*"'
        }
      });

      return response.data.value || [];
    } catch (error: any) {
      console.error(`Query failed for ${entityName}:`, error?.response?.data || error?.message || error);
      throw error;
    }
  }

  async create(entityName: string, data: any): Promise<string> {
    const token = await this.getAccessToken();
    
    try {
      const response = await this.client.post(
        `/api/data/v9.2/${entityName}`,
        data,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Prefer: 'return=representation'
          }
        }
      );

      return response.data.id;
    } catch (error) {
      console.error(`Create failed for ${entityName}:`, error);
      throw error;
    }
  }

  async update(entityName: string, id: string, data: any): Promise<void> {
    const token = await this.getAccessToken();

    try {
      await this.client.patch(
        `/api/data/v9.2/${entityName}(${id})`,
        data,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
    } catch (error) {
      console.error(`Update failed for ${entityName}:`, error);
      throw error;
    }
  }

  async delete(entityName: string, id: string): Promise<void> {
    const token = await this.getAccessToken();

    try {
      await this.client.delete(`/api/data/v9.2/${entityName}(${id})`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error(`Delete failed for ${entityName}:`, error);
      throw error;
    }
  }

  async getCommesse(): Promise<any[]> {
    return this.query(
      'phyo_projects',
      undefined,
      [
        'phyo_projectid',
        'phyo_idproject',
        'phyo_nomecommessa',
        'phyo_descrizione',
        'phyo_datacommessa',
        'phyo_dataconclusionelavori',
        'phyo_tipologiacommessa',
        'phyo_statocommessa',
        'phyo_commercialediriferimento',
        'phyo_incentivo',
        'phyo_totaleivaesclusa',
        '_phyo_cliente_value',
        'statecode'
      ]
    );
  }

  private readonly assistenzeSelect = [
    'phyo_assistenzeregistrazioniid',
    'phyo_nr',
    'phyo_data',
    'phyo_attne',
    'phyo_oreintervento',
    'phyo_ore',
    'phyo_descrizioneintervento',
    'phyo_oggetto',
    'phyo_note',
    'phyo_statoreg',
    'phyo_statoregistrazione',
    'phyo_costoorario',
    'phyo_totale',
    'phyo_materialeutilizzato',
    'phyo_tipologia_assistenza',
    '_phyo_rifassistenza_value',
    '_phyo_risorsa_value',
    '_phyo_cliente_value',
    'statecode'
  ];

  async getAssistenze(risorsaId?: string): Promise<any[]> {
    const filter = risorsaId
      ? `_phyo_risorsa_value eq ${this.sanitizeGuid(risorsaId)}`
      : undefined;

    return this.query('phyo_assistenzeregistrazionis', filter, this.assistenzeSelect, undefined, 'phyo_rifassistenza($select=phyo_indirizzoassistenza)');
  }

  async getAssistenzePaged(risorsaId?: string, pageSize?: number, skipToken?: string): Promise<{ data: any[]; totalCount: number; skipToken: string | null }> {
    const filter = risorsaId
      ? `_phyo_risorsa_value eq ${this.sanitizeGuid(risorsaId)}`
      : undefined;

    return this.queryPaged('phyo_assistenzeregistrazionis', {
      filter,
      select: this.assistenzeSelect,
      orderby: 'phyo_nr desc',
      pageSize,
      skipToken,
      expand: 'phyo_rifassistenza($select=phyo_indirizzoassistenza)',
    });
  }

  async queryPaged(entityName: string, options: {
    filter?: string;
    select?: string[];
    orderby?: string;
    pageSize?: number;
    skipToken?: string;
    expand?: string;
  }): Promise<{ data: any[]; totalCount: number; skipToken: string | null }> {
    const token = await this.getAccessToken();

    let url = `/api/data/v9.2/${entityName}`;
    const params = new URLSearchParams();

    if (options.filter) params.append('$filter', options.filter);
    if (options.select?.length) params.append('$select', options.select.join(','));
    if (options.expand) params.append('$expand', options.expand);
    if (options.orderby) params.append('$orderby', options.orderby);
    params.append('$count', 'true');

    if (options.skipToken) {
      params.append('$skiptoken', options.skipToken);
    }

    url += `?${params.toString()}`;

    const preferParts = ['odata.include-annotations="*"'];
    if (options.pageSize) {
      preferParts.push(`odata.maxpagesize=${options.pageSize}`);
    }

    try {
      const response = await this.client.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: preferParts.join(',')
        }
      });

      let skipToken: string | null = null;
      const rawNextLink: string | undefined = response.data['@odata.nextLink'];
      if (rawNextLink) {
        try {
          const parsed = new URL(rawNextLink);
          skipToken = parsed.searchParams.get('$skiptoken');
        } catch {
          skipToken = null;
        }
      }

      return {
        data: response.data.value || [],
        totalCount: response.data['@odata.count'] ?? 0,
        skipToken,
      };
    } catch (error: any) {
      console.error(`QueryPaged failed for ${entityName}:`, error?.response?.data || error?.message || error);
      throw error;
    }
  }

  async loginRisorsa(password: string): Promise<any | null> {
    const results = await this.query(
      'phyo_risorses',
      `phyo_password eq '${password.replace(/'/g, "''")}'`,
      ['phyo_risorseid', 'phyo_name', 'phyo_password']
    );
    return results.length > 0 ? results[0] : null;
  }

  async updateAssistenza(id: string, data: Record<string, any>): Promise<void> {
    return this.update('phyo_assistenzeregistrazionis', id, data);
  }

  async createAssistenza(data: Record<string, any>): Promise<string> {
    return this.create('phyo_assistenzeregistrazionis', data);
  }

  async getRifAssistenze(): Promise<any[]> {
    return this.query(
      'phyo_assistenzes',
      'statecode eq 0',
      ['phyo_assistenzeid', 'phyo_nrassistenze', 'phyo_tipologia_assistenza', 'phyo_indirizzoassistenza', '_phyo_cliente_value']
    );
  }

  /**
   * Recupera le opzioni del campo phyo_tipologia_assistenza (Choice / Picklist)
   * della tabella phyo_assistenze. Restituisce un array di { value, label }.
   */
  async getTipologiaAssistenzaOptions(): Promise<Array<{ value: number; label: string }>> {
    const token = await this.getAccessToken();
    const url =
      `/api/data/v9.2/EntityDefinitions(LogicalName='phyo_assistenze')` +
      `/Attributes(LogicalName='phyo_tipologia_assistenza')` +
      `/Microsoft.Dynamics.CRM.PicklistAttributeMetadata` +
      `?$select=LogicalName&$expand=OptionSet($select=Options)`;
    try {
      const response = await this.client.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const options: any[] = response.data?.OptionSet?.Options ?? [];
      return options.map((o) => ({
        value: Number(o.Value),
        label:
          o?.Label?.UserLocalizedLabel?.Label ||
          o?.Label?.LocalizedLabels?.[0]?.Label ||
          String(o.Value),
      }));
    } catch (error: any) {
      console.error(
        'getTipologiaAssistenzaOptions failed:',
        error?.response?.data || error?.message || error
      );
      throw error;
    }
  }

  /**
   * Recupera l'elenco degli attributi obbligatori (RequiredLevel = ApplicationRequired
   * o SystemRequired) per una entità Dataverse, per pilotare la validazione lato client.
   * Esclude attributi tecnici / sistemici per essere utilizzabili direttamente nel form.
   */
  async getRequiredAttributes(
    entityLogicalName: string
  ): Promise<Array<{ logicalName: string; displayName: string; requiredLevel: string }>> {
    const token = await this.getAccessToken();
    const url =
      `/api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')` +
      `/Attributes` +
      `?$select=LogicalName,DisplayName,RequiredLevel,AttributeOf,IsCustomAttribute,IsValidForCreate` +
      `&$filter=RequiredLevel/Value eq 'ApplicationRequired' or RequiredLevel/Value eq 'SystemRequired'`;
    try {
      const response = await this.client.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const items: any[] = response.data?.value ?? [];
      // Filtra: solo attributi creabili dall'utente, escludi field tecnici (AttributeOf indica un campo derivato)
      return items
        .filter((a) => a.IsValidForCreate !== false && !a.AttributeOf)
        .map((a) => ({
          logicalName: a.LogicalName,
          displayName:
            a?.DisplayName?.UserLocalizedLabel?.Label ||
            a?.DisplayName?.LocalizedLabels?.[0]?.Label ||
            a.LogicalName,
          requiredLevel: a?.RequiredLevel?.Value || 'None',
        }));
    } catch (error: any) {
      console.error(
        'getRequiredAttributes failed:',
        error?.response?.data || error?.message || error
      );
      throw error;
    }
  }

  async getAccounts(): Promise<any[]> {
    return this.query(
      'accounts',
      'statecode eq 0',
      ['accountid', 'name'],
      'name asc'
    );
  }

  async getNextAssistenzaNr(): Promise<string> {
    const token = await this.getAccessToken();
    const url = `/api/data/v9.2/phyo_assistenzeregistrazionis?$select=phyo_nr&$orderby=phyo_nr desc&$top=1`;
    try {
      const response = await this.client.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'odata.include-annotations="*"'
        }
      });
      const records = response.data.value || [];
      if (records.length === 0) return '1';
      const lastNr = records[0].phyo_nr;
      const num = parseInt(lastNr, 10);
      return isNaN(num) ? '1' : String(num + 1);
    } catch (error: any) {
      console.error('getNextAssistenzaNr failed:', error?.response?.data || error?.message);
      throw error;
    }
  }

  async userOwnsAssistenza(registrazioneId: string, risorsaId: string): Promise<boolean> {
    const result = await this.query(
      'phyo_assistenzeregistrazionis',
      `phyo_assistenzeregistrazioniid eq ${this.sanitizeGuid(registrazioneId)} and _phyo_risorsa_value eq ${this.sanitizeGuid(risorsaId)}`,
      ['phyo_assistenzeregistrazioniid']
    );

    return result.length > 0;
  }

  async getAnnotationParentRecordId(annotationId: string): Promise<string | null> {
    const result = await this.query(
      'annotations',
      `annotationid eq ${this.sanitizeGuid(annotationId)}`,
      ['annotationid', '_objectid_value']
    );

    return result[0]?._objectid_value ?? null;
  }

  async getAnnotations(registrazioneId: string): Promise<any[]> {
    const token = await this.getAccessToken();
    const url = `/api/data/v9.2/annotations?$filter=_objectid_value eq '${registrazioneId}' and isdocument eq true&$select=annotationid,subject,filename,mimetype,documentbody,createdon&$orderby=createdon desc`;
    try {
      const response = await this.client.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'odata.include-annotations="*"'
        }
      });
      return response.data.value || [];
    } catch (error: any) {
      console.error('getAnnotations failed:', error?.response?.data || error?.message);
      throw error;
    }
  }

  async createAnnotation(registrazioneId: string, filename: string, mimetype: string, documentbody: string, subject?: string): Promise<string> {
    const token = await this.getAccessToken();
    const url = `/api/data/v9.2/annotations`;
    try {
      const response = await this.client.post(url, {
        'objectid_phyo_assistenzeregistrazionid@odata.bind': `/phyo_assistenzeregistrazionis(${registrazioneId})`,
        subject: subject || 'Foto assistenza',
        filename,
        mimetype,
        documentbody,
        isdocument: true,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });
      const id = response.headers['odata-entityid']?.match(/\(([^)]+)\)/)?.[1] || '';
      return id;
    } catch (error: any) {
      console.error('createAnnotation failed:', error?.response?.data || error?.message);
      throw error;
    }
  }

  async deleteAnnotation(annotationId: string): Promise<void> {
    const token = await this.getAccessToken();
    const url = `/api/data/v9.2/annotations(${annotationId})`;
    try {
      await this.client.delete(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error: any) {
      console.error('deleteAnnotation failed:', error?.response?.data || error?.message);
      throw error;
    }
  }
}
