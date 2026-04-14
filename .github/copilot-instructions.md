# Progetto Gestione Commesse Centoraggi

Applicazione React con backend Node.js per gestire commesse e integrare Dataverse CRM.

## Stack Tecnologico
- **Frontend**: React + Vite + TypeScript
- **Backend**: Node.js + Express
- **Database**: Dataverse (Microsoft Dynamics 365)
- **Deploy**: Azure (App Service + SQL Database)

## Istruzioni Sviluppo
1. Installare dipendenze: `npm run install:all`
2. Avviare dev server: `npm run dev`
3. Frontend: http://localhost:5173
4. Backend API: http://localhost:3000

## Variabili Ambiente
Configurare `.env` nella root e in `server/.env`:

```
# server/.env
DATAVERSE_URL=https://your-org.crm.dynamics.com
DATAVERSE_CLIENT_ID=your-client-id
DATAVERSE_CLIENT_SECRET=your-client-secret
DATAVERSE_TENANT_ID=your-tenant-id
DATABASE_URL=your-sql-connection-string
NODE_ENV=development
```
