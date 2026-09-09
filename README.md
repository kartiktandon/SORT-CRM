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
