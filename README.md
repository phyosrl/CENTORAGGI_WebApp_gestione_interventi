# Gestione Commesse Centoraggi

Applicazione web per la gestione commesse con integrazione con Microsoft Dataverse (Dynamics 365 CRM).

## 📋 Descrizione del Progetto

Questo progetto è un'applicazione full-stack per la gestione delle commesse con le seguenti caratteristiche:

- **Frontend**: Interfaccia React moderna con Vite
- **Backend**: API RESTful con Node.js e Express
- **Database**: Integrazione con Microsoft Dataverse
- **Cloud**: Deployabile su Azure

## 🛠 Stack Tecnologico

### Frontend
- React 18
- TypeScript
- Vite
- TanStack Query (React Query)
- Axios

### Backend
- Node.js
- Express
- TypeScript
- MSAL Node (autenticazione Azure AD)
- Axios

### Infrastruttura
- Microsoft Dataverse
- Azure App Service
- Azure SQL Database
- GitHub Actions (CI/CD)

## 📦 Installazione

### Prerequisiti
- Node.js 18+
- npm o yarn
- Account Azure
- Tenant Azure AD con Dataverse

### Setup Locale

1. **Clone il repository**
```bash
git clone <repository-url>
cd GestioneCommesse
```

2. **Installa le dipendenze**
```bash
npm run install:all
```

3. **Configura le variabili di ambiente**
```bash
# Copia il file di esempio
cp .env.example .env
```

Modifica `.env` con le tue credenziali Dataverse:
```
DATAVERSE_URL=https://your-org.crm.dynamics.com
DATAVERSE_CLIENT_ID=your-client-id
DATAVERSE_CLIENT_SECRET=your-client-secret
DATAVERSE_TENANT_ID=your-tenant-id
DATABASE_URL=your-sql-connection-string
NODE_ENV=development
```

4. **Avvia il progetto**
```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000



## 📂 Struttura del Progetto

```
GestioneCommesse/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.css
│   │   └── App.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── server/                # Backend Node.js
│   ├── src/
│   │   ├── index.ts
│   │   ├── services/
│   │   │   └── dataverseService.ts
│   │   └── routes/
│   │       └── dataverseRoutes.ts
│   ├── package.json
│   └── tsconfig.json
├── .github/
│   ├── copilot-instructions.md
│   └── workflows/
│       └── azure-deploy.yml
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## 🔧 API Endpoints

### Dataverse

- `GET /api/dataverse/:entityName` - Recupera entità da Dataverse
- `POST /api/dataverse/:entityName` - Crea un'entità
- `PATCH /api/dataverse/:entityName/:id` - Aggiorna un'entità
- `DELETE /api/dataverse/:entityName/:id` - Elimina un'entità

### Health Check
- `GET /health` - Controlla lo stato dell'API

## 🔐 Autenticazione

L'applicazione usa OAuth 2.0 con Azure AD per l'autenticazione con Dataverse:

1. Il backend acquisisce un access token usando Client Credentials Flow
2. Il token è utilizzato per le richieste API a Dataverse
3. I token sono cached per migliorare le prestazioni

## 📝 Variabili di Ambiente

| Variabile | Descrizione | Obbligatorio |
|-----------|-----------|--------------|
| DATAVERSE_URL | URL dell'istanza Dataverse | ✅ |
| DATAVERSE_CLIENT_ID | Client ID dell'app Azure AD | ✅ |
| DATAVERSE_CLIENT_SECRET | Client Secret dell'app Azure AD | ✅ |
| DATAVERSE_TENANT_ID | Tenant ID di Azure AD | ✅ |
| DATABASE_URL | Connection string SQL Database | ✅ |
| NODE_ENV | Environment (development/production) | ✅ |
| PORT | Porta del server | ❌ (default: 3000) |
| CORS_ORIGIN | Origin CORS inizialmente autorizzato | ❌ |

## 🧪 Testing

Per eseguire i test:
```bash
npm run test
```



## 🤝 Contributi

Le pull request sono benvenute. Per cambiamenti importanti, apri prima un'issue per discutere delle modifiche proposte.

## 📄 License

Questo progetto è concesso in licenza sotto la MIT License.

## 📧 Supporto

Per problemi e domande, contatta il team di sviluppo.

## 🔄 Update Log

### v1.0.0 (2026-04-14)
- Inizializzazione progetto
- Setup React + Vite frontend
- Setup Express backend
- Integrazione Dataverse
- GitHub Actions CI/CD
- Documentazione Azure Deployment
