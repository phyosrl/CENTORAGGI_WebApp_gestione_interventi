// Probe Dataverse to find ManyToOne nav property names on phyo_assistenzeregistrazioni
const axios = require('axios');

try {
  const ls = require('./local.settings.json');
  if (ls && ls.Values) for (const [k, v] of Object.entries(ls.Values)) if (process.env[k] == null) process.env[k] = v;
} catch (e) {}

const u = process.env.DATAVERSE_URL;
const cid = process.env.DATAVERSE_CLIENT_ID;
const sec = process.env.DATAVERSE_CLIENT_SECRET;
const tid = process.env.DATAVERSE_TENANT_ID;

(async () => {
  const tokenRes = await axios.post(
    `https://login.microsoftonline.com/${tid}/oauth2/v2.0/token`,
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: cid,
      client_secret: sec,
      scope: `${u}/.default`,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  const token = tokenRes.data.access_token;
  // Trova tutte le entity definitions phyo_*
  const uList = `${u}/api/data/v9.2/EntityDefinitions?$select=LogicalName,LogicalCollectionName,SchemaName`;
  const rList = await axios.get(uList, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
  console.log('=== Entity definitions phyo_assist* ===');
  for (const e of rList.data.value) {
    if (e.LogicalName && e.LogicalName.startsWith('phyo_assist')) {
      console.log(e.LogicalName, '| collection:', e.LogicalCollectionName, '| schema:', e.SchemaName);
    }
  }

  // Tutti gli attributi della tabella phyo_assistenzeregistrazioni
  const uAttr = `${u}/api/data/v9.2/EntityDefinitions(LogicalName='phyo_assistenzeregistrazioni')/Attributes?$select=LogicalName,AttributeType`;
  const rAttr = await axios.get(uAttr, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
  console.log('=== phyo_assistenzeregistrazioni attributi (logical name) ===');
  for (const a of rAttr.data.value) console.log(a.LogicalName, '(', a.AttributeType, ')');
})().catch(e => { console.error('ERR', e?.response?.data || e?.message || e); process.exit(1); });
