# Short CRM

Responsive agency CRM with a React frontend, Node.js/Express API, and MySQL schema. Login is intentionally omitted.

## Frontend

```bash
npm install
npm run dev
```

## API and database

```bash
mysql -u root -p < api/db/schema.sql
cd api
cp .env.example .env
npm install
npm run dev
```

The frontend runs on port 3000 and the API defaults to port 4000. The current interface uses representative local data so it remains immediately previewable; the REST endpoints are ready for leads, clients, projects, tasks, and invoices.

## Frontend demo on Vercel

Keep React and Vinext. `npm run build:vercel` enables Vinext static export,
skips the Cloudflare runtime plugin, and writes the frontend to `dist/client`.
The normal `npm run dev` and `npm run build` commands retain their existing setup.

Import this repository as `sort-crm-frontend` with root directory `./`.
Use the Other preset; `vercel.json` sets build command `npm run build:vercel`,
install command `npm ci`, output directory `dist/client`, and clean URLs.
Remove conflicting dashboard overrides. No environment variables are required
for the hardcoded demo. Do not add MySQL credentials.

The deployment contains static frontend assets only. The Express API and MySQL
remain local; login is a demo and records are not persisted by this deployment.
Direct visits to `/` and `/login` are supported.
