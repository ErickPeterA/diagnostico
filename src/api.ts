export async function api<T>(path:string,init?:RequestInit):Promise<T>{
  const response=await fetch(`/api${path}`,{...init,headers:{'Content-Type':'application/json',...(init?.headers??{})}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||'Não foi possível concluir a operação.');
  return body as T;
}
export const json=(method:string,body:unknown):RequestInit=>({method,body:JSON.stringify(body)});
