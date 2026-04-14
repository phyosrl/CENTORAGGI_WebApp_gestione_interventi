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

  async query(entityName: string, filter?: string, select?: string[], orderby?: string): Promise<any[]> {
    const token = await this.getAccessToken();
    
    let url = `/api/data/v9.2/${entityName}`;
    const params = new URLSearchParams();

    if (filter) {
      params.append('$filter', filter);
    }
    if (select && select.length > 0) {
      params.append('$select', select.join(','));
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
    } catch (error) {
      console.error(`Query failed for ${entityName}:`, error);
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
        'phyo_commercialediriferimenro',
        'phyo_incentivo',
        'phyo_totaleivaesclusa',
        '_phyo_cliente_value',
        'statecode'
      ]
    );
  }
}
