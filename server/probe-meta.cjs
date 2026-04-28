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
  // Lookups on phyo_assistenze (rif)
  const u4 = `${u}/api/data/v9.2/EntityDefinitions(LogicalName='phyo_assistenze')/ManyToOneRelationships?$select=ReferencingEntityNavigationPropertyName,ReferencedEntity,ReferencingAttribute`;
  const r4 = await axios.get(u4, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
  console.log('=== phyo_assistenze ManyToOne ===');
  for (const rel of r4.data.value) console.log(rel.ReferencingAttribute, '->', rel.ReferencingEntityNavigationPropertyName, '(target:', rel.ReferencedEntity + ')');
})().catch(e => { console.error('ERR', e?.response?.data || e?.message || e); process.exit(1); });
