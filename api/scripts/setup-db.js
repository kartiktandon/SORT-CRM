import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { connectionOptions } from '../src/db.js';
const name=process.env.MYSQL_DATABASE || 'novera_crm';
if(!/^[a-zA-Z0-9_-]{1,64}$/.test(name))throw Error('MYSQL_DATABASE must contain 1–64 letters, digits, underscores, or hyphens.');
const connection=await mysql.createConnection({...connectionOptions,database:undefined});
try {
 await connection.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
 await connection.changeUser({database:name});
 const schema=await readFile(new URL('../db/schema.sql',import.meta.url),'utf8');
 for(const sql of schema.split(';').map(s=>s.trim()).filter(Boolean)){
  if(sql.startsWith('CREATE DATABASE')||sql.startsWith('USE '))continue;
  await connection.query(sql.replace('CREATE TABLE ','CREATE TABLE IF NOT EXISTS '));
 }
 const additions={users:{password_hash:'VARCHAR(200) NULL',phone:'VARCHAR(190) NULL'},leads:{platform:"VARCHAR(20) DEFAULT 'Website'",city:'VARCHAR(190)',budget:'VARCHAR(190)',service:'VARCHAR(190)',timeline:'VARCHAR(190)',owner:'VARCHAR(190)',follow_up:"VARCHAR(30) DEFAULT 'No follow-up'",follow_up_date:'DATE NULL',temperature:'VARCHAR(30)'},tasks:{client_name:'VARCHAR(190)',assignee_name:'VARCHAR(190)'}};
 for(const [table,columns]of Object.entries(additions))for(const [column,definition]of Object.entries(columns)){
  const [rows]=await connection.execute('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?',[name,table,column]);
  if(!rows.length)await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
 }
 await connection.query("ALTER TABLE leads MODIFY status ENUM('New leads','Contacted','Interested','Proposal','Closed','Lost','Ringing') DEFAULT 'New leads'");
 await connection.query('CREATE TABLE IF NOT EXISTS sessions (token_hash CHAR(64) PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL,expires_at DATETIME NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,INDEX(expires_at))');
 await connection.query("CREATE TABLE IF NOT EXISTS lead_notes (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,lead_id BIGINT UNSIGNED NOT NULL,user_id BIGINT UNSIGNED NULL,user_name VARCHAR(120) NOT NULL,note TEXT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,INDEX(lead_id,created_at))");
 await connection.query('CREATE TABLE IF NOT EXISTS workspace_documents (document_key VARCHAR(120) PRIMARY KEY,payload JSON NOT NULL,version INT NOT NULL DEFAULT 1,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)');
 await connection.query("CREATE TABLE IF NOT EXISTS reports (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,client_id BIGINT UNSIGNED NOT NULL,weekly_reports VARCHAR(190) DEFAULT '0/4',monthly_status ENUM('Pending','Submitted') DEFAULT 'Pending',health ENUM('On Track','Delayed') DEFAULT 'On Track',submitted_at DATE,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE)");
 await connection.query(`UPDATE leads
  SET budget = CONCAT(
    UPPER(LEFT(REPLACE(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(notes, 'what_is_your_estimated_project_budget?: ', -1), ' | ', 1)), '_', ' '), 1)),
    SUBSTRING(REPLACE(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(notes, 'what_is_your_estimated_project_budget?: ', -1), ' | ', 1)), '_', ' '), 2)
  )
  WHERE (budget IS NULL OR budget = '')
    AND notes LIKE '%what_is_your_estimated_project_budget?: %'`);
 await connection.query(`UPDATE leads
  SET service = CONCAT(
    UPPER(LEFT(REPLACE(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(notes, 'what_do_you_want_to_build?: ', -1), ' | ', 1)), '_', ' '), 1)),
    SUBSTRING(REPLACE(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(notes, 'what_do_you_want_to_build?: ', -1), ' | ', 1)), '_', ' '), 2)
  )
  WHERE (service IS NULL OR service = '')
    AND notes LIKE '%what_do_you_want_to_build?: %'`);
 await connection.query(`INSERT INTO lead_notes (lead_id, user_name, note, created_at, updated_at)
  SELECT leads.id,
    CASE WHEN leads.notes LIKE 'Form ID:%' THEN 'Meta Lead Ads' ELSE 'Arvind Chugh' END,
    leads.notes, leads.created_at, leads.updated_at
  FROM leads
  WHERE leads.notes IS NOT NULL AND TRIM(leads.notes) <> ''
    AND NOT EXISTS (SELECT 1 FROM lead_notes WHERE lead_notes.lead_id = leads.id)`);
 await connection.query("UPDATE lead_notes SET user_name = 'Arvind Chugh' WHERE user_id IS NULL AND user_name IN ('Legacy import', 'Meta Lead Ads') AND note NOT LIKE 'Form ID:%'");
 console.log('CRM database and migrations are ready. Existing records were preserved.');
}finally{await connection.end();}
