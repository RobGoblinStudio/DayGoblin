import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import { getAuth,signInAnonymously } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { getDatabase,ref,get,update,runTransaction,onValue } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-database.js';
let auth,db;
let connected=false;
const connectionListeners=new Set();
const latestRooms=new Map();
const flushedSlugs=new Set();
export let participantId;
export let api;
// How long a write may wait for the server before we tell the user it is only saved on this device.
const SLOW_WRITE_MS=4000;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const withTimeout=(promise,ms=6000)=>Promise.race([promise,wait(ms).then(()=>{throw new Error('Anslutningen dröjde.')})]);
function cacheKey(slug){return `daybuddy:${slug}:room-cache`}
function queueKey(slug){return `daybuddy:${slug}:pending-writes`}
function readCache(slug){try{return JSON.parse(localStorage.getItem(cacheKey(slug))||'null')}catch{return null}}
function readQueue(slug){try{return JSON.parse(localStorage.getItem(queueKey(slug))||'[]')}catch{return []}}
function writeQueue(slug,queue){try{if(queue.length)localStorage.setItem(queueKey(slug),JSON.stringify(queue));else localStorage.removeItem(queueKey(slug))}catch{}}
function removeQueued(slug,opId){writeQueue(slug,readQueue(slug).filter(item=>item.id!==opId))}
function cacheRoom(slug,room){latestRooms.set(slug,room);try{localStorage.setItem(cacheKey(slug),JSON.stringify(room))}catch{}return room}
// Only used for the offline fallback view: overlay this device's unsent changes on the cached room.
function applyQueue(slug,room){
  if(!room)return room;
  for(const op of readQueue(slug)){
    let person=room.participants.find(item=>item.id===op.participantId);
    if(!person){person={id:op.participantId,name:'',colorIndex:room.participants.length,dates:[],preferredDates:[],createdAt:new Date().toISOString()};room.participants.push(person)}
    person.name=op.name;
    if(op.date){const dates=new Set(person.dates);if(op.available)dates.add(op.date);else dates.delete(op.date);person.dates=[...dates].sort();if(!op.available)person.preferredDates=(person.preferredDates||[]).filter(date=>date!==op.date)}
    if(op.preferenceDate){const dates=new Set(person.preferredDates||[]);if(op.preferred)dates.add(op.preferenceDate);else dates.delete(op.preferenceDate);person.preferredDates=[...dates].sort()}
  }
  return room;
}
class OfflineQueuedError extends Error{constructor(){super('Sparad på den här enheten. Synkas när anslutningen är tillbaka.');this.name='OfflineQueuedError';this.offlineQueued=true}}
class CalendarFullError extends Error{constructor(){super('Kalendern är full. Välj ett befintligt namn.');this.name='CalendarFullError';this.calendarFull=true}}

export async function initialize(config){
  const app=initializeApp(config);
  auth=getAuth(app);db=getDatabase(app);
  await signInAnonymously(auth);
  participantId=auth.currentUser.uid;
  onValue(ref(db,'.info/connected'),snapshot=>{connected=snapshot.val()===true;for(const listener of connectionListeners)listener(connected)});
  api={
    async createCalendar(title,count){return createCalendar(title,count)},
    async getCalendar(slug){
      try{
        const result=await withTimeout(get(ref(db,`calendars/${slug}`)));
        if(!result.exists())throw new Error('Kalendern hittades inte.');
        const room=cacheRoom(slug,normalize(slug,result.val()));
        flushQueue(slug);
        return room;
      }catch(error){const cached=readCache(slug);if(cached)return applyQueue(slug,cached);throw error}
    },
    async saveParticipant(slug,id,name){return write(slug,{participantId:id,name:name.trim()})},
    async saveVote(slug,id,name,date,available){return write(slug,{participantId:id,name:name.trim(),date,available})},
    async savePreference(slug,id,name,date,preferred){return write(slug,{participantId:id,name:name.trim(),preferenceDate:date,preferred})},
    // Firebase applies this device's writes locally right away, so every snapshot already includes them.
    subscribe(slug,onUpdate,onError){return onValue(ref(db,`calendars/${slug}`),snapshot=>{if(snapshot.exists())onUpdate(cacheRoom(slug,normalize(slug,snapshot.val())));else onError()},onError)},
    onConnectionChange(listener){connectionListeners.add(listener);listener(connected);return ()=>connectionListeners.delete(listener)}
  };
}

function normalize(slug,value){
  if(!value)return null;
  const participants=Object.entries(value.participants||{}).map(([id,person],index)=>({
    id,name:person.name,colorIndex:Number.isInteger(person.colorIndex)?person.colorIndex:index,
    dates:Object.keys(person.dates||{}).filter(date=>person.dates[date]===true).sort(),preferredDates:Object.keys(person.preferredDates||{}).filter(date=>person.preferredDates[date]===true).sort(),createdAt:person.createdAt||''
  })).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  return {slug,title:value.title,participantCount:value.participantCount||null,createdAt:value.createdAt||'',participants};
}
async function words(){const response=await fetch('/slug-words.json');if(!response.ok)throw new Error('Kalendernamnet kunde inte skapas.');return response.json()}
function pick(list){return list[Math.floor(Math.random()*list.length)]}
async function createCalendar(title,count){
  const lists=await words();
  const roomSlug=`${pick(lists.adjectives)}-${pick(lists.nouns)}-${pick(lists.endings)}`;
  const roomRef=ref(db,`calendars/${roomSlug}`);
  const result=await runTransaction(roomRef,current=>current||{slug:roomSlug,title:title.trim(),participantCount:count||0,createdAt:new Date().toISOString(),ownerUid:participantId,participants:{}});
  if(!result.committed)throw new Error('Kalenderlänken krockade. Försök igen.');
  if(result.snapshot.child('ownerUid').val()!==participantId)throw new Error('Kalenderlänken krockade. Försök igen.');
  return {slug:roomSlug};
}
// One small multi-path update per change: no transaction round trips, and Firebase shows it locally at once.
function payloadFor(slug,op){
  const room=latestRooms.get(slug)||readCache(slug);
  const existing=room?.participants.find(person=>person.id===op.participantId);
  const payload={id:op.participantId,name:op.name};
  if(!existing){
    if(room?.participantCount&&room.participants.length>=room.participantCount)throw new CalendarFullError();
    payload.colorIndex=room?.participants.length??0;
    payload.createdAt=new Date().toISOString();
  }
  if(op.date){payload[`dates/${op.date}`]=op.available?true:null;if(!op.available)payload[`preferredDates/${op.date}`]=null}
  if(op.preferenceDate)payload[`preferredDates/${op.preferenceDate}`]=op.preferred?true:null;
  return payload;
}
async function write(slug,op){
  const payload=payloadFor(slug,op);
  op.id=crypto.randomUUID();
  const queue=readQueue(slug);queue.push(op);writeQueue(slug,queue);
  const saved=update(ref(db,`calendars/${slug}/participants/${op.participantId}`),payload);
  saved.then(()=>removeQueued(slug,op.id),()=>removeQueued(slug,op.id));
  const savedOutcome=saved.then(()=>'saved');savedOutcome.catch(()=>{});
  const outcome=await Promise.race([savedOutcome,wait(SLOW_WRITE_MS).then(()=>'slow')]);
  // Still waiting: Firebase keeps the write and sends it as soon as it can.
  // Only say "offline" when Firebase itself reports that the connection is down.
  if(outcome==='slow'&&!connected)throw new OfflineQueuedError();
  return {ok:true};
}
// Resend changes a previous visit could not deliver (for example if the tab was closed while offline).
async function flushQueue(slug){
  if(flushedSlugs.has(slug))return;
  flushedSlugs.add(slug);
  for(const op of readQueue(slug)){
    try{await update(ref(db,`calendars/${slug}/participants/${op.participantId}`),payloadFor(slug,op))}catch{}
    removeQueued(slug,op.id);
  }
}
