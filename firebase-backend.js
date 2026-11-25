import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import { getAuth,signInAnonymously } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { getDatabase,ref,get,runTransaction,onValue } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-database.js';
let auth,db;
const flushingQueues=new Set();
export let participantId;
export let api;
const withTimeout=(promise,ms=6000)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Anslutningen dröjde.')),ms))]);
function cacheKey(slug){return `daybuddy:${slug}:room-cache`}
function queueKey(slug){return `daybuddy:${slug}:pending-writes`}
function readCache(slug){try{return JSON.parse(localStorage.getItem(cacheKey(slug))||'null')}catch{return null}}
function readQueue(slug){try{return JSON.parse(localStorage.getItem(queueKey(slug))||'[]')}catch{return []}}
function writeQueue(slug,queue){localStorage.setItem(queueKey(slug),JSON.stringify(queue))}
function applyQueue(slug,room){
  if(!room)return room;
  const queue=readQueue(slug);if(!queue.length)return room;
  for(const op of queue){
    let person=room.participants.find(item=>item.id===(op.participantId||participantId));
    if(!person){person={id:op.participantId||participantId,name:'',colorIndex:room.participants.length,dates:[],preferredDates:[],createdAt:new Date().toISOString()};room.participants.push(person)}
    person.name=op.name;if(op.date){const dates=new Set(person.dates);if(op.available)dates.add(op.date);else dates.delete(op.date);person.dates=[...dates].sort();if(!op.available)person.preferredDates=(person.preferredDates||[]).filter(date=>date!==op.date)}if(op.preferenceDate){const dates=new Set(person.preferredDates||[]);if(op.preferred)dates.add(op.preferenceDate);else dates.delete(op.preferenceDate);person.preferredDates=[...dates].sort()}
  }
  return room;
}
function cacheRoom(slug,room){const merged=applyQueue(slug,room);try{localStorage.setItem(cacheKey(slug),JSON.stringify(merged))}catch{}return merged}
function saveOfflineOperation(slug,operation){operation.id=crypto.randomUUID();const queue=readQueue(slug);queue.push(operation);writeQueue(slug,queue);const room=readCache(slug);if(room)cacheRoom(slug,room)}
class OfflineQueuedError extends Error{constructor(){super('Sparad på den här enheten. Synkas när anslutningen är tillbaka.');this.name='OfflineQueuedError';this.offlineQueued=true}}
export async function initialize(config){
  const app=initializeApp(config);
  auth=getAuth(app);db=getDatabase(app);
  await signInAnonymously(auth);
  participantId=auth.currentUser.uid;
  api={
    async createCalendar(title,count){return createCalendar(title,count)},
    async getCalendar(slug){try{const result=await withTimeout(get(ref(db,`calendars/${slug}`)));if(!result.exists())throw new Error('Kalendern hittades inte.');const room=cacheRoom(slug,normalize(slug,result.val()));if(readQueue(slug).length)window.setTimeout(()=>flushQueue(slug),0);return room}catch(error){const cached=readCache(slug);if(cached){window.setTimeout(()=>flushQueue(slug),0);return applyQueue(slug,cached)}throw error}},
    async saveParticipant(slug,id,name){return savePerson(slug,id,name,null,false)},
    async saveVote(slug,id,name,date,available){return savePerson(slug,id,name,date,available)},
    async savePreference(slug,id,name,date,preferred){return savePersonPreference(slug,id,name,date,preferred)},
    subscribe(slug,onUpdate,onError){return onValue(ref(db,`calendars/${slug}`),snapshot=>{if(snapshot.exists())onUpdate(cacheRoom(slug,normalize(slug,snapshot.val())));else onError()},onError)}
  };
  window.addEventListener('online',()=>{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith('daybuddy:')&&key.endsWith(':pending-writes'))flushQueue(key.slice(9,-15))}});
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
function participantRef(slug,id){return ref(db,`calendars/${slug}/participants/${id}`)}
async function savePerson(slug,id,name,date,available){
  const pRef=participantRef(slug,id);
  const op={participantId:id,name:name.trim(),date,available};saveOfflineOperation(slug,op);
  try{
    const cached=readCache(slug);const colorIndex=cached?.participants.find(person=>person.id===id)?.colorIndex??cached?.participants.length??0;
    const result=await withTimeout(runTransaction(pRef,current=>{const person=current||{id,colorIndex,createdAt:new Date().toISOString(),dates:{}};person.name=op.name;person.dates=person.dates||{};if(date){if(available)person.dates[date]=true;else{delete person.dates[date];if(person.preferredDates)delete person.preferredDates[date]}}return person}));
    if(!result.committed)throw new Error('Ändringen kunde inte sparas.');
    const queue=readQueue(slug);const index=queue.findIndex(item=>item.id===op.id);if(index>=0){queue.splice(index,1);writeQueue(slug,queue)}
    return {ok:true};
  }catch(error){
    if(error.code&&!/network|unavailable|disconnected/i.test(error.code)){
      const queue=readQueue(slug).filter(item=>item.id!==op.id);writeQueue(slug,queue);throw error;
    }
    throw new OfflineQueuedError();
  }
}
async function savePersonPreference(slug,id,name,date,preferred){
  const pRef=participantRef(slug,id);
  const op={participantId:id,name:name.trim(),preferenceDate:date,preferred};saveOfflineOperation(slug,op);
  try{
    const cached=readCache(slug);const colorIndex=cached?.participants.find(person=>person.id===id)?.colorIndex??cached?.participants.length??0;
    const result=await withTimeout(runTransaction(pRef,current=>{const person=current||{id,colorIndex,createdAt:new Date().toISOString(),dates:{},preferredDates:{}};person.name=op.name;person.preferredDates=person.preferredDates||{};if(preferred)person.preferredDates[date]=true;else delete person.preferredDates[date];return person}));
    if(!result.committed)throw new Error('Ändringen kunde inte sparas.');
    const queue=readQueue(slug);const index=queue.findIndex(item=>item.id===op.id);if(index>=0){queue.splice(index,1);writeQueue(slug,queue)}
    return {ok:true};
  }catch(error){
    if(error.code&&!/network|unavailable|disconnected/i.test(error.code)){const queue=readQueue(slug).filter(item=>item.id!==op.id);writeQueue(slug,queue);throw error}
    throw new OfflineQueuedError();
  }
}
async function flushQueue(slug){
  if(flushingQueues.has(slug))return;
  flushingQueues.add(slug);
  try{
    for(const op of readQueue(slug)){
      const id=op.participantId||participantId;
      const cached=readCache(slug);const colorIndex=cached?.participants.find(person=>person.id===id)?.colorIndex??cached?.participants.length??0;
      try{
        const result=await withTimeout(runTransaction(participantRef(slug,id),current=>{const person=current||{id,colorIndex,createdAt:new Date().toISOString(),dates:{},preferredDates:{}};person.name=op.name;person.dates=person.dates||{};person.preferredDates=person.preferredDates||{};if(op.date){if(op.available)person.dates[op.date]=true;else{delete person.dates[op.date];delete person.preferredDates[op.date]}}if(op.preferenceDate){if(op.preferred)person.preferredDates[op.preferenceDate]=true;else delete person.preferredDates[op.preferenceDate]}return person}));
        if(!result.committed)return;
        const queue=readQueue(slug);const index=queue.findIndex(item=>item.id===op.id);if(index>=0){queue.splice(index,1);writeQueue(slug,queue)}
      }catch{return}
    }
  }finally{flushingQueues.delete(slug)}
}
