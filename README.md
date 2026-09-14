# Short CRM

Responsive agency CRM with a React frontend, Node.js/Express API, authenticated sessions, and MySQL storage.

## Frontend

```bash
npm install
npm run dev
```

## API and database

```bash
cd api
cp .env.example .env
npm install
npm run db:setup
npm run admin:create
npm run dev
```

Configure the MySQL connection in `api/.env` before running setup. For Aiven, set
`MYSQL_SSL_CA_PATH=./ca.pem` and save its CA certificate in `api/ca.pem`, or supply
the certificate contents in `MYSQL_SSL_CA`. Certificate paths resolve relative to
`api/`. Keep credentials and certificates out of version control.

The frontend runs on port 3000 and proxies `/api` to port 4000. Sign in at
`http://localhost:3000/login` with the administrator created by `admin:create`.
This command prompts for a name, email, and hidden password of at least 12 characters.
There are no default accounts or sample records. Existing configured `.env` files
should be preserved rather than replaced with the example.

Screens read authenticated bootstrap data; record editors save to the API.
Dashboard statistics use actual records. Paid-invoice charts group by invoice issue
month, not payment date. Project files store external links, not uploaded file bytes.
Expenses, notification delivery, call logs, and time tracking are not implemented.
Team profiles alone do not create sign-in credentials.

For an opt-in integration check with both servers running, run
`node scripts/check-integration.js` from `api/`. It creates uniquely named fixtures
in the configured database, tests authentication and persistence through the frontend
proxy, and removes those exact fixtures afterward.

## Frontend build on Vercel

Keep React and Vinext. `npm run build:vercel` enables Vinext static export,
skips the Cloudflare runtime plugin, and writes the frontend to `dist/client`.
The normal `npm run dev` and `npm run build` commands retain their existing setup.

Import this repository as `sort-crm-frontend` with root directory `./`.
Use the Other preset; `vercel.json` sets build command `npm run build:vercel`,
install command `npm ci`, output directory `dist/client`, and clean URLs.
Remove conflicting dashboard overrides. Do not add MySQL credentials to the frontend.

The current deployment configuration builds static frontend assets only. Before
deploying, deploy the Express backend separately and configure a same-origin `/api`
rewrite to it. Set its `FRONTEND_ORIGIN` to the exact frontend origin and configure
MySQL credentials and the TLS certificate on the backend. The frontend requires a
working API for sign-in and data; it no longer provides a standalone demo.
