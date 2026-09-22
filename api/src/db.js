import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

// L-4: Fail loudly at startup if required DB env vars are missing
// Only enforce in non-development environments to allow local dev without full env setup
const REQUIRED_DB_ENV = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE'];
if (process.env.NODE_ENV === 'production') {
  for (const key of REQUIRED_DB_ENV) {
    if (!process.env[key]) {
      throw new Error(`[Startup] Missing required environment variable: ${key}`);
    }
  }
}

const DEFAULT_CA = `-----BEGIN CERTIFICATE-----
MIIERDCCAqygAwIBAgIUHq72QwQQsTVPzId+JcNC3JGSIu0wDQYJKoZIhvcNAQEM
BQAwOjE4MDYGA1UEAwwvYmIyODkwYTItNTg2YS00ZTIwLTg1NTAtZTFkOTJlMDk2
NGU5IFByb2plY3QgQ0EwHhcNMjYwOTE0MTMzMjU1WhcNMzYwOTExMTMzMjU1WjA6
MTgwNgYDVQQDDC9iYjI4OTBhMi01ODZhLTRlMjAtODU1MC1lMWQ5MmUwOTY0ZTkg
UHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCCAYoCggGBAM1NIx2b
rNRvg41TWdi778z2wZ5M4qRBX+klPCiWbKDAcrtoPjUYDMBT0Y9t6GqJsT+uSLV3
mRJVDEFMbVRwAfrnal30ODhNQp62mnB1nJNoKFqo63SANWI6DSNqsjn0BllRfZma
92kzSJSTA0eCshR5p0ZEXU0ppfBN4T/5jrcTi2EpPmzkE1U4ZTiJU8lKb1FFoau2
vU4aI4XF7SGRpbPo0J8M9tN3OLS5+itcJtikwoUs1XT84oyTzuZRzYTgCh0Les3c
FjqiLwq3AQ3Ly/ToBDU/WT43bUJbK/nPcwwr8Q1R5KLrwO2KP5L9BMjorA/mY62/
zkljLThvi5kM/Ya9PvvcuT3nosp+WC6aXgmZL/TS1GFXc/W12TXjoHe/99cQJ+KS
EOU6ZEb/cQ7LPK6hzPBbLd2lrDIS/Ptntm2FMYN8LNBJPLQ/URQOW5ZD0C/2DH/i
XrS9OpLxBoOY8da5qHUBrewyXSFTsh/Q6+iz14oSMh3qOZ2kPz0VKGNADQIDAQAB
o0IwQDAdBgNVHQ4EFgQU88hVhXGZ2K+/DxPF0DvXQpfDxcIwEgYDVR0TAQH/BAgw
BgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQADggGBAMPYMxDeJ5YV
OntIDoXQ7RAzte1pPEyqPK+aydDmeRZT0Pl2yCZu8j+ql4EAK2mgnvjxdcwXndqV
1n5JgT+RaHmmxnC3OgteSSWCjX4quW5x471dyPYc++kdGCB5iHpX2w4IYqvQjLgy
KRm8vLQ/uJ9kyCjLgRUhlYdXojY8ZD/L/L3enCKoZDwv1YgWpGwCsZe83Ve7baea
USH5hX3xm2S9g+Izc0OFglXOZdRyaLhM2yqvWorXyXG21ZyoaoPgkGn5ui6mCeHa
AFux24dzcfxkqi1NI5Z/AlJ6F+dOiBN7mWDQl82mUgiQXbqOE9pssw09WuJUaaHC
2hE+h1vvonuYa5nlpf1ZGyEDEt5BUbq6zUcDKnfqsT3XG4bXNbBJv+jgQrHs1GHt
vHOiVjVUtW2wGWhCu2xjxt0NCmmmQrW0FBZnltRxBRwe2kHMHskfo4YyK+mq5v1s
zrI4W3fMxrAaoDWLJbgC4zPIdNP1iEwUXjBvUItGF9lLJaSP0WQY2Q==
-----END CERTIFICATE-----`;

let ca = process.env.MYSQL_SSL_CA;
if (!ca && process.env.MYSQL_SSL_CA_PATH) {
  try {
    ca = readFileSync(resolve(fileURLToPath(new URL('../', import.meta.url)), process.env.MYSQL_SSL_CA_PATH), 'utf8');
  } catch {
    ca = undefined;
  }
}
if (!ca) {
  ca = DEFAULT_CA;
}

const rawPassword = process.env.MYSQL_PASSWORD || '';
const cleanPassword = rawPassword.replace(/^["']|["']$/g, '');

export const connectionOptions = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: cleanPassword,
  database: process.env.MYSQL_DATABASE || 'sort-crm-db',
  ssl: ca ? {
    ca,
    rejectUnauthorized: true, // H-6: Actually validate the DB server's TLS certificate
  } : undefined,
  connectTimeout: 10000,
};

export const db = mysql.createPool({
  ...connectionOptions,
  waitForConnections: true,
  connectionLimit: 5,
  dateStrings: true,
  decimalNumbers: true,
});
