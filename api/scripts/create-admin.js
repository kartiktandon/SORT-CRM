import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { db } from '../src/db.js';
import { hashPassword } from '../src/security.js';
let muted=false;
const output=new Writable({write(chunk,_encoding,callback){if(!muted)process.stdout.write(chunk);callback();}});
const prompt=createInterface({input:process.stdin,output,terminal:true});
try {
 const name=(await prompt.question('Administrator name: ')).trim();
 const email=(await prompt.question('Email: ')).trim().toLowerCase();
 process.stdout.write('Password (minimum 12 characters, hidden): ');muted=true;
 const password=await prompt.question('');muted=false;process.stdout.write('\n');
 if(!name||name.length>120||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12||password.length>1024)throw Error('Use a valid name, email, and password of 12–1024 characters.');
 await db.execute("INSERT INTO users(name,email,role,status,password_hash) VALUES(?,?,'admin','active',?)",[name,email,await hashPassword(password)]);
 console.log('Administrator created. Sign in at http://localhost:3000/login');
}catch(error){console.error(error.code==='ER_DUP_ENTRY'?'That email already exists. No account was changed.':error.code||error.message);process.exitCode=1;}finally{prompt.close();await db.end();}
