const response=await fetch('/firebase-config.json',{cache:'no-store'});
const firebaseConfig=await response.json();
const configured=Boolean(firebaseConfig.apiKey&&firebaseConfig.authDomain&&firebaseConfig.databaseURL&&firebaseConfig.projectId&&firebaseConfig.appId);

function localParticipantId(){
  const slug=decodeURIComponent(location.pathname.split('/').filter(Boolean)[0]||'');
  const key=`daybuddy:${slug}:participant`;
  let id=localStorage.getItem(key);
  if(!id){id=globalThis.crypto?.randomUUID?.()||`p_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;localStorage.setItem(key,id)}
  return id;
}
async function localJson(url,options={}){
  const result=await fetch(url,options).then(res=>res.json());
  if(!result||result.error)throw new Error(result?.error||'Något gick fel.');
  return result;
}
const localApi={
  async createCalendar(purpose,participantCount){return localJson('/api/calendars',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({purpose,participantCount})})},
  async getCalendar(slug){return localJson(`/api/calendar/${encodeURIComponent(slug)}`)},
  async saveParticipant(slug,id,name){return localJson(`/api/calendar/${encodeURIComponent(slug)}/participants/${encodeURIComponent(id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})})},
  async saveVote(slug,id,name,date,available){return localJson(`/api/calendar/${encodeURIComponent(slug)}/participants/${encodeURIComponent(id)}/days/${date}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,available})})},
  async savePreference(slug,id,name,date,preferred){return localJson(`/api/calendar/${encodeURIComponent(slug)}/participants/${encodeURIComponent(id)}/preferences/${date}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,preferred})})},
  subscribe(slug,onUpdate,onError){const source=new EventSource(`/api/calendar/${encodeURIComponent(slug)}/events`);source.addEventListener('update',event=>onUpdate(JSON.parse(event.data)));source.onerror=onError;return ()=>source.close()}
};

let backend=null;
export let ready=Promise.resolve();
export let participantId=localParticipantId();
export let api=localApi;
export let startupError=null;
const useFirebase=configured&&!['localhost','127.0.0.1'].includes(location.hostname);
if(useFirebase){
  try{
    backend=await import('./firebase-backend.js');
    ready=backend.initialize(firebaseConfig);
    await ready;
    participantId=backend.participantId;
    api=backend.api;
  }catch(error){startupError=error}
}
export const storageMode=useFirebase?'firebase':'local';
