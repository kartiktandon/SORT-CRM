import express from 'express';
import cors from 'cors';
import { randomBytes } from 'node:crypto';
import { db } from './db.js';
import { hashPassword, verifyPassword, tokenHash, readSession } from './security.js';
import { resources, validate } from './resources.js';

const app=express();
app.disable('x-powered-by');
const origin=process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
app.use(cors({origin,credentials:true}));
app.use(express.json({limit:'1mb'}));
app.use((req,res,next)=>{
  res.set('Cache-Control','no-store');
  if(!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin!==origin)return res.status(403).json({error:'Origin not allowed.'});
  next();
});
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const cookieOptions={httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:8*60*60*1000};
app.get('/api/health',asyncRoute(async(_req,res)=>{await db.query('SELECT 1');res.json({ok:true,database:'connected'});}));
const attempts=new Map();
setInterval(()=>{for(const [key,value] of attempts)if(value.until<Date.now())attempts.delete(key);},60000).unref();
const dummyHash=await hashPassword(randomBytes(24).toString('hex'));
app.post('/api/auth/login',asyncRoute(async(req,res)=>{
  const {email,password}=req.body || {};
  if(typeof email!=='string'||typeof password!=='string'||email.length>190||password.length>1024)return res.status(400).json({error:'Enter an email and password.'});
  const key=req.ip;
  const entry=attempts.get(key);
  if(entry?.until>Date.now()&&entry.count>=10)return res.status(429).json({error:'Too many attempts. Try again in 15 minutes.'});
  attempts.set(key,{count:(entry?.until>Date.now()?entry.count:0)+1,until:entry?.until>Date.now()?entry.until:Date.now()+15*60000});
  const [rows]=await db.execute('SELECT id,name,email,role,password_hash FROM users WHERE email=? AND status=? LIMIT 1',[email.trim().toLowerCase(),'active']);
  const user=rows[0];
  const valid=await verifyPassword(password,user?.password_hash || dummyHash);
  if(!valid||!user)return res.status(401).json({error:'Email or password is incorrect.'});
  attempts.delete(key);
  const token=randomBytes(32).toString('hex');
  await db.execute('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 8 HOUR))',[tokenHash(token),user.id]);
  res.cookie('crm_session',token,cookieOptions);
  res.json({user:{id:user.id,name:user.name,email:user.email,role:user.role}});
}));
app.use('/api',asyncRoute(async(req,res,next)=>{
  const token=readSession(req);
  if(!/^[a-f0-9]{64}$/.test(token))return res.status(401).json({error:'Please sign in.'});
  const [rows]=await db.execute('SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>NOW() AND u.status=?',[tokenHash(token),'active']);
  if(!rows.length)return res.status(401).json({error:'Session expired. Please sign in again.'});
  req.user=rows[0];next();
}));
app.get('/api/auth/me',(req,res)=>res.json({user:req.user}));
app.post('/api/auth/logout',asyncRoute(async(req,res)=>{await db.execute('DELETE FROM sessions WHERE token_hash=?',[tokenHash(readSession(req))]);res.clearCookie('crm_session',{...cookieOptions,maxAge:undefined});res.sendStatus(204);}));
const publicUsers='id,name,email,role,job_title,status,phone,created_at,updated_at';
app.get('/api/bootstrap',asyncRoute(async(req,res)=>{
  const data={};
  for(const resource of Object.keys(resources)){const [rows]=await db.query(`SELECT ${resource==='users'?publicUsers:'*'} FROM \`${resource}\` ORDER BY id ASC LIMIT 5000`);data[resource]=rows;}
  const [documents]=await db.query('SELECT document_key,payload,version FROM workspace_documents');
  data.documents=Object.fromEntries(documents.map(row=>[row.document_key,{value:typeof row.payload==='string'?JSON.parse(row.payload):row.payload,version:row.version}]));
  res.json({data,user:req.user});
}));
app.put('/api/documents/:key',asyncRoute(async(req,res)=>{
  if(!/^(project-[1-9]\d*|agreement-draft|settings|assets)$/.test(req.params.key))return res.status(400).json({error:'Invalid document.'});
  const {value,version}=req.body || {};
  if(value===undefined||!Number.isSafeInteger(version)||version<0)return res.status(400).json({error:'A document and version are required.'});
  if(req.params.key==='settings'&&req.user.role!=='admin')return res.status(403).json({error:'Administrator access required.'});
  const payload=JSON.stringify(value);
  if(payload.length>500000)return res.status(413).json({error:'Document is too large.'});
  if(version===0){try{await db.execute('INSERT INTO workspace_documents(document_key,payload,version) VALUES(?,?,1)',[req.params.key,payload]);}catch(error){if(error.code==='ER_DUP_ENTRY')return res.status(409).json({error:'This record changed. Refresh before saving.'});throw error;}}
  else {const [result]=await db.execute('UPDATE workspace_documents SET payload=?,version=version+1 WHERE document_key=? AND version=?',[payload,req.params.key,version]);if(!result.affectedRows)return res.status(409).json({error:'This record changed. Refresh before saving.'});}
  res.json({value,version:version+1});
}));
for(const resource of Object.keys(resources)) {
  app.get(`/api/${resource}`,asyncRoute(async(req,res)=>{
    const term=String(req.query.q||'').slice(0,190);
    const column=resource==='tasks'?'title':resource==='invoices'?'invoice_number':resource==='agreements'?'title':resource==='reports'?'weekly_reports':'name';
    const [rows]=await db.execute(`SELECT ${resource==='users'?publicUsers:'*'} FROM \`${resource}\` WHERE \`${column}\` LIKE ? ORDER BY id DESC LIMIT 5000`,[`%${term}%`]);res.json({data:rows});
  }));
  app.post(`/api/${resource}`,asyncRoute(async(req,res)=>{
    if(resource==='users'&&req.user.role!=='admin')return res.status(403).json({error:'Administrator access required.'});
    const data=validate(resource,req.body,true);
    const [result]=await db.query(`INSERT INTO \`${resource}\` SET ?`,data);
    const [rows]=await db.execute(`SELECT ${resource==='users'?publicUsers:'*'} FROM \`${resource}\` WHERE id=?`,[result.insertId]);res.status(201).json({data:rows[0]});
  }));
  app.patch(`/api/${resource}/:id`,asyncRoute(async(req,res)=>{
    if(!/^[1-9]\d*$/.test(req.params.id))return res.status(400).json({error:'Invalid record ID.'});
    if(resource==='users'&&req.user.role!=='admin')return res.status(403).json({error:'Administrator access required.'});
    const data=validate(resource,req.body);
    const [result]=await db.query(`UPDATE \`${resource}\` SET ? WHERE id=?`,[data,req.params.id]);
    if(!result.affectedRows)return res.status(404).json({error:'Record not found.'});
    const [rows]=await db.execute(`SELECT ${resource==='users'?publicUsers:'*'} FROM \`${resource}\` WHERE id=?`,[req.params.id]);res.json({data:rows[0]});
  }));
  app.delete(`/api/${resource}/:id`,asyncRoute(async(req,res)=>{
    if(req.user.role!=='admin')return res.status(403).json({error:'Administrator access required.'});
    if(!/^[1-9]\d*$/.test(req.params.id))return res.status(400).json({error:'Invalid record ID.'});
    if(resource==='users'&&Number(req.params.id)===req.user.id)return res.status(400).json({error:'You cannot delete your own account.'});
    const [result]=await db.execute(`DELETE FROM \`${resource}\` WHERE id=?`,[req.params.id]);if(!result.affectedRows)return res.status(404).json({error:'Record not found.'});res.sendStatus(204);
  }));
}
app.use((error,_req,res,_next)=>{
  const code=error.code;
  if(code==='ER_DUP_ENTRY')return res.status(409).json({error:'A record with these details already exists.'});
  if(code==='ER_NO_REFERENCED_ROW_2'||code==='ER_ROW_IS_REFERENCED_2')return res.status(409).json({error:'Check the linked client, project, or team member.'});
  console.error('API error:',code||error.message);
  res.status(error.status||503).json({error:error.status?error.message:'Database unavailable. Check the API database configuration.'});
});
const server=app.listen(Number(process.env.PORT||4000),'127.0.0.1',()=>console.log(`CRM API: http://127.0.0.1:${process.env.PORT||4000}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{db.end().finally(()=>process.exit(0));}));
