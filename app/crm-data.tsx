'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
export type RecordData = {id:number;[key:string]:string|number|null};
export type User = {id:number;name:string;email:string;role:string};
type DocumentData = {value:unknown;version:number};
type Data = {documents:Record<string,DocumentData>} & Record<string,unknown>;
type Context = {data:Data;user:User;busy:boolean;error:string;refresh:()=>Promise<void>;save:(resource:string,record:Partial<RecordData>)=>Promise<RecordData>;saveDocument:(key:string,value:unknown)=>Promise<void>;logout:()=>Promise<void>};
const CrmContext=createContext<Context|null>(null);
export function useCrm(){const context=useContext(CrmContext);if(!context)throw Error('CRM data provider missing');return context;}
export function useRecords(resource:string){const {data}=useCrm();return (data[resource] || []) as RecordData[];}
export function CrmProvider({children}:{children:ReactNode}){
 const [state,setState]=useState<{data:Data;user:User}|null>(null);
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);const router=useRouter();
 const handleError=useCallback((error:unknown)=>{if(error instanceof ApiError&&error.status===401)router.replace('/login');setError(error instanceof Error?error.message:'Unable to connect.');},[router]);
 const refresh=useCallback(async()=>{try{const result=await api<{data:Data;user:User}>('/bootstrap');setState(result);setError('');}catch(error){handleError(error);}},[handleError]);
 useEffect(()=>{void refresh();},[refresh]);
 const save=async(resource:string,record:Partial<RecordData>)=>{
  setBusy(true);setError('');
  try{const {data}=await api<{data:RecordData}>(`/${resource}${record.id?`/${record.id}`:''}`,{method:record.id?'PATCH':'POST',body:JSON.stringify(record)});setState(previous=>{if(!previous)return previous;const rows=(previous.data[resource]||[])as RecordData[];return {...previous,data:{...previous.data,[resource]:record.id?rows.map(row=>row.id===data.id?data:row):[...rows,data]}};});return data;}
  catch(error){handleError(error);throw error;}finally{setBusy(false);}
 };
 const saveDocument=async(key:string,value:unknown)=>{setBusy(true);setError('');try{const document=state?.data.documents[key];const result=await api<DocumentData>(`/documents/${key}`,{method:'PUT',body:JSON.stringify({value,version:document?.version||0})});setState(previous=>previous?{...previous,data:{...previous.data,documents:{...previous.data.documents,[key]:result}}}:previous);}catch(error){handleError(error);throw error;}finally{setBusy(false);}};
 const logout=async()=>{await api('/auth/logout',{method:'POST'});router.replace('/login');};
 if(!state)return <div className="ws-empty" style={{padding:60}}>{error?<><p>{error}</p><button onClick={()=>void refresh()}>Retry connection</button> · <a href="/login">Sign in</a></>:'Connecting to your workspace…'}</div>;
 return <CrmContext.Provider value={{...state,busy,error,refresh,save,saveDocument,logout}}>{error&&<div role="alert" style={{background:'#fff0f1',color:'#a42b46',padding:14,position:'sticky',top:0,zIndex:80}}>{error} <button onClick={()=>void refresh()}>Reload data</button></div>}{busy&&<output style={{position:'fixed',bottom:15,right:20,zIndex:90,background:'#19213d',color:'white',padding:'8px 16px',borderRadius:8}}>Saving…</output>}{children}</CrmContext.Provider>;
}
export function text(row:RecordData,key:string){return String(row[key]??'');}
export function money(value:unknown){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(value)||0);}
export function amount(value:string){const cleaned=value.replace(/[₹,\s]/g,'');const parsed=Number(cleaned);if(!Number.isFinite(parsed)||parsed<0)throw Error('Enter a valid amount, e.g. 50000.');return parsed;}
export function dateLabel(value:unknown){if(!value)return '—';return new Date(`${String(value).slice(0,10)}T12:00:00`).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}
export function isoDate(value:string){if(!value||value==='—')return null;if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;const normalized=/\d{4}/.test(value)?value:`${value} ${new Date().getFullYear()}`;const date=new Date(normalized);if(!Number.isFinite(date.getTime()))throw Error('Enter a valid date, e.g. 2026-09-30.');return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
