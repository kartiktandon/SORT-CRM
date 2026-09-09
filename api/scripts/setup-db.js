import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import '../src/db.js';
const name=process.env.MYSQL_DATABASE || 'short_crm';
if(!/^[a-zA-Z0-9_]+$/.test(name))throw Error('MYSQL_DATABASE must contain only letters, digits, or underscores.');
const connection=await mysql.createConnection({host:process.env.MYSQL_HOST||'127.0.0.1',port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER||'root',password:process.env.MYSQL_PASSWORD||'',connectTimeout:5000});
try {
 await connection.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
 await connection.changeUser({database:name});
 const schema=await readFile(new URL('../db/schema.sql',import.meta.url),'utf8');
 for(const sql of schema.split(';').map(s=>s.trim()).filter(Boolean)){
  if(sql.startsWith('CREATE DATABASE')||sql.startsWith('USE '))continue;
  await connection.query(sql.replace('CREATE TABLE ','CREATE TABLE IF NOT EXISTS '));
 }
 const additions={users:{password_hash:'VARCHAR(200) NULL',phone:'VARCHAR(190) NULL'},leads:{platform:"VARCHAR(20) DEFAULT 'Website'",city:'VARCHAR(190)',budget:'VARCHAR(190)',service:'VARCHAR(190)',timeline:'VARCHAR(190)',owner:'VARCHAR(190)',follow_up:"VARCHAR(30) DEFAULT 'No follow-up'",temperature:'VARCHAR(30)'},tasks:{client_name:'VARCHAR(190)',assignee_name:'VARCHAR(190)'}};
 for(const [table,columns]of Object.entries(additions))for(const [column,definition]of Object.entries(columns)){
  const [rows]=await connection.execute('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?',[name,table,column]);
  if(!rows.length)await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
 }
 await connection.query("ALTER TABLE leads MODIFY status ENUM('New leads','Contacted','Interested','Proposal','Closed','Lost','Ringing') DEFAULT 'New leads'");
 await connection.query('CREATE TABLE IF NOT EXISTS sessions (token_hash CHAR(64) PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL,expires_at DATETIME NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,INDEX(expires_at))');
 await connection.query('CREATE TABLE IF NOT EXISTS workspace_documents (document_key VARCHAR(120) PRIMARY KEY,payload JSON NOT NULL,version INT NOT NULL DEFAULT 1,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)');
 await connection.query("CREATE TABLE IF NOT EXISTS reports (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,client_id BIGINT UNSIGNED NOT NULL,weekly_reports VARCHAR(190) DEFAULT '0/4',monthly_status ENUM('Pending','Submitted') DEFAULT 'Pending',health ENUM('On Track','Delayed') DEFAULT 'On Track',submitted_at DATE,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE)");
 console.log('CRM database and migrations are ready. Existing records were preserved.');
}finally{await connection.end();}
