export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api${path}`, { ...options, credentials: 'same-origin', headers: { ...(options.body ? {'Content-Type':'application/json'} : {}), ...options.headers } }); }
  catch { throw new ApiError('Cannot reach the CRM API. Start the backend and try again.', 503); }
  if(response.status===204)return undefined as T;
  const body=await response.json().catch(()=>({error:'The CRM API is unavailable.'}));
  if(!response.ok)throw new ApiError(body.error || 'Request failed.',response.status);
  return body as T;
}
