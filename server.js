const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const ROOT=__dirname;
const DATA_DIR=path.join(ROOT,'data');
const DB_FILE=path.join(DATA_DIR,'calendars.json');
let FIREBASE_CONFIGURED=false;
try{const config=JSON.parse(fs.readFileSync(path.join(ROOT,'firebase-config.json'),'utf8'));FIREBASE_CONFIGURED=Boolean(config.apiKey&&config.authDomain&&config.databaseURL&&config.projectId&&config.appId)}catch{}
const PORT=Number(process.env.PORT)||4173;
const HOST=process.env.HOST||'127.0.0.1';
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const {adjectives,nouns,endings}=JSON.parse(fs.readFileSync(path.join(ROOT,'slug-words.json'),'utf8'));

let database={calendars:{}};
try{database=JSON.parse(fs.readFileSync(DB_FILE,'utf8'))}catch{}
let writeQueue=Promise.resolve();
const streams=new Map();

function json(res,status,body){res.writeHead(status,{'Content-Type':MIME['.json'],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))}
function readBody(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>20000){reject(new Error('Förfrågan är för stor.'));req.destroy()}});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{})}catch{reject(new Error('Ogiltig JSON.'))}});req.on('error',reject)})}
function persist(){
  const snapshot=JSON.stringify(database,null,2);
  const operation=writeQueue.then(async()=>{await fs.promises.mkdir(DATA_DIR,{recursive:true});const tmp=`${DB_FILE}.${process.pid}.tmp`;await fs.promises.writeFile(tmp,snapshot);await fs.promises.rename(tmp,DB_FILE)});
  writeQueue=operation.catch(error=>console.error('Could not save DayGoblin data:',error));
  return operation;
}
function publicCalendar(calendar){
  const participants=Object.values(calendar.participants).map((p,index)=>({id:p.id,name:p.name,colorIndex:Number.isInteger(p.colorIndex)?p.colorIndex:index,dates:[...p.dates].sort(),preferredDates:[...(p.preferredDates||[])].sort(),createdAt:p.createdAt})).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  return {slug:calendar.slug,title:calendar.title,participantCount:calendar.participantCount,createdAt:calendar.createdAt,participants};
}
function sendCalendar(slug){
  const calendar=database.calendars[slug];if(!calendar)return;
  const packet=`event: update\ndata: ${JSON.stringify(publicCalendar(calendar))}\n\n`;
  for(const response of streams.get(slug)||[])response.write(packet);
}
function slug(){
  const pick=words=>words[crypto.randomInt(words.length)];
  return `${pick(adjectives)}-${pick(nouns)}-${pick(endings)}`;
}
function validDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T12:00:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
function sendStatic(res,file){
  const extension=path.extname(file);
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Hittades inte.');return}
    res.writeHead(200,{'Content-Type':MIME[extension]||'application/octet-stream','Cache-Control':extension==='.html'?'no-store':'public, max-age=300','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'});res.end(data);
  });
}
function notFoundPage(res){
  const page='<!doctype html><html lang="sv"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>DayGoblin — länken hittades inte</title><body style="font:16px system-ui;padding:3rem;background:#fbfaf5;color:#263528"><h1>Den kalendern hittades inte</h1><p>Kontrollera att du fått hela DayGoblin-länken.</p><a href="/">Skapa en egen kalender</a></body></html>';
  res.writeHead(404,{'Content-Type':'text/html; charset=utf-8','X-Robots-Tag':'noindex, nofollow'});res.end(page);
}

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  try{
    if(req.method==='POST'&&url.pathname==='/api/calendars'){
      const body=await readBody(req);const title=String(body.purpose||'').trim();
      const count=body.participantCount===null?null:Number(body.participantCount);
      if(!title||title.length>100)return json(res,400,{error:'Skriv ett ändamål på högst 100 tecken.'});
      if(count!==null&&(!Number.isInteger(count)||count<2||count>10))return json(res,400,{error:'Antalet ska vara mellan 2 och 10 personer, eller öppet.'});
      let id=slug();while(database.calendars[id])id=slug();
      database.calendars[id]={slug:id,title,participantCount:count,createdAt:new Date().toISOString(),participants:{}};
      await persist();return json(res,201,{slug:id});
    }

    if(req.method==='GET'&&url.pathname==='/api/ics')return require('./api/ics.js')(req,res);

    const eventMatch=url.pathname.match(/^\/api\/calendar\/([a-z]+-[a-z]+-[a-z]+)\/events$/);
    if(req.method==='GET'&&eventMatch){
      const calendar=database.calendars[eventMatch[1]];if(!calendar)return json(res,404,{error:'Kalendern hittades inte.'});
      res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write('retry: 2000\n\n');
      if(!streams.has(calendar.slug))streams.set(calendar.slug,new Set());streams.get(calendar.slug).add(res);
      res.write(`event: update\ndata: ${JSON.stringify(publicCalendar(calendar))}\n\n`);
      const heartbeat=setInterval(()=>{if(!res.destroyed)res.write(': ping\n\n')},25000);
      req.on('close',()=>{clearInterval(heartbeat);streams.get(calendar.slug)?.delete(res)});return;
    }

    const calendarMatch=url.pathname.match(/^\/api\/calendar\/([a-z]+-[a-z]+-[a-z]+)$/);
    if(req.method==='GET'&&calendarMatch){const calendar=database.calendars[calendarMatch[1]];return calendar?json(res,200,publicCalendar(calendar)):json(res,404,{error:'Kalendern hittades inte.'})}

    const participantMatch=url.pathname.match(/^\/api\/calendar\/([a-z]+-[a-z]+-[a-z]+)\/participants\/([a-zA-Z0-9_-]{8,80})$/);
    if(req.method==='PUT'&&participantMatch){
      const [,room,participantId]=participantMatch;const calendar=database.calendars[room];if(!calendar)return json(res,404,{error:'Kalendern hittades inte.'});
      const body=await readBody(req);const name=String(body.name||'').trim();if(!name||name.length>32)return json(res,400,{error:'Skriv ett namn på högst 32 tecken.'});
      if(!calendar.participants[participantId]&&calendar.participantCount!=null&&Object.keys(calendar.participants).length>=calendar.participantCount)return json(res,409,{error:'Kalendern är full. Välj ett befintligt namn.'});
      const participant=calendar.participants[participantId]||{id:participantId,name,dates:[],preferredDates:[],colorIndex:Object.keys(calendar.participants).length,createdAt:new Date().toISOString()};
      participant.name=name;calendar.participants[participantId]=participant;
      await persist();sendCalendar(room);return json(res,200,{ok:true});
    }

    const voteMatch=url.pathname.match(/^\/api\/calendar\/([a-z]+-[a-z]+-[a-z]+)\/participants\/([a-zA-Z0-9_-]{8,80})\/days\/(\d{4}-\d{2}-\d{2})$/);
    if(req.method==='PUT'&&voteMatch){
      const [,room,participantId,date]=voteMatch;const calendar=database.calendars[room];if(!calendar)return json(res,404,{error:'Kalendern hittades inte.'});
      if(!validDate(date))return json(res,400,{error:'Ogiltigt datum.'});
      const body=await readBody(req);const name=String(body.name||'').trim();if(!name||name.length>32)return json(res,400,{error:'Skriv ett namn på högst 32 tecken.'});
      if(!calendar.participants[participantId]&&calendar.participantCount!=null&&Object.keys(calendar.participants).length>=calendar.participantCount)return json(res,409,{error:'Kalendern är full. Välj ett befintligt namn.'});
      const participant=calendar.participants[participantId]||{id:participantId,name,dates:[],preferredDates:[],colorIndex:Object.keys(calendar.participants).length,createdAt:new Date().toISOString()};
      participant.name=name;calendar.participants[participantId]=participant;
      const dates=new Set(participant.dates);
      if(body.available===true)dates.add(date);else if(body.available===false){dates.delete(date);const preferredDates=new Set(participant.preferredDates||[]);preferredDates.delete(date);participant.preferredDates=[...preferredDates].sort()}else return json(res,400,{error:'Ange om du kan eller inte kan den dagen.'});
      participant.dates=[...dates].sort();await persist();sendCalendar(room);return json(res,200,{ok:true});
    }

    const batchMatch=url.pathname.match(/^\/api\/calendar\/([a-z]+-[a-z]+-[a-z]+)\/participants\/([a-zA-Z0-9_-]{8,80})\/days$/);
    if(req.method==='PUT'&&batchMatch){
      const [,room,participantId]=batchMatch;const calendar=database.calendars[room];if(!calendar)return json(res,404,{error:'Kalendern hittades inte.'});
      const body=await readBody(req);const name=String(body.name||'').trim();if(!name||name.length>32)return json(res,400,{error:'Skriv ett namn på högst 32 tecken.'});
      if(!Array.isArray(body.dates)||!body.dates.length||body.dates.length>120||!body.dates.every(validDate))return json(res,400,{error:'Ogiltiga datum.'});
      if(typeof body.available!=='boolean')return json(res,400,{error:'Ange om du kan eller inte kan dagarna.'});
      if(!calendar.participants[participantId]&&calendar.participantCount!=null&&Object.keys(calendar.participants).length>=calendar.participantCount)return json(res,409,{error:'Kalendern är full. Välj ett befintligt namn.'});
      const participant=calendar.participants[participantId]||{id:participantId,name,dates:[],preferredDates:[],colorIndex:Object.keys(calendar.participants).length,createdAt:new Date().toISOString()};
      participant.name=name;calendar.participants[participantId]=participant;
      const dates=new Set(participant.dates),preferredDates=new Set(participant.preferredDates||[]);
      for(const date of body.dates){if(body.available)dates.add(date);else{dates.delete(date);preferredDates.delete(date)}}
      participant.dates=[...dates].sort();participant.preferredDates=[...preferredDates].sort();
      await persist();sendCalendar(room);return json(res,200,{ok:true});
    }

    const preferenceMatch=url.pathname.match(/^\/api\/calendar\/([a-z]+-[a-z]+-[a-z]+)\/participants\/([a-zA-Z0-9_-]{8,80})\/preferences\/(\d{4}-\d{2}-\d{2})$/);
    if(req.method==='PUT'&&preferenceMatch){
      const [,room,participantId,date]=preferenceMatch;const calendar=database.calendars[room];if(!calendar)return json(res,404,{error:'Kalendern hittades inte.'});
      if(!validDate(date))return json(res,400,{error:'Ogiltigt datum.'});
      const body=await readBody(req);const name=String(body.name||'').trim();if(!name||name.length>32)return json(res,400,{error:'Skriv ett namn på högst 32 tecken.'});
      if(typeof body.preferred!=='boolean')return json(res,400,{error:'Ange om du föredrar dagen.'});
      if(!calendar.participants[participantId]&&calendar.participantCount!=null&&Object.keys(calendar.participants).length>=calendar.participantCount)return json(res,409,{error:'Kalendern är full. Välj ett befintligt namn.'});
      const participant=calendar.participants[participantId]||{id:participantId,name,dates:[],preferredDates:[],colorIndex:Object.keys(calendar.participants).length,createdAt:new Date().toISOString()};
      participant.name=name;const preferredDates=new Set(participant.preferredDates||[]);if(body.preferred)preferredDates.add(date);else preferredDates.delete(date);participant.preferredDates=[...preferredDates].sort();calendar.participants[participantId]=participant;
      await persist();sendCalendar(room);return json(res,200,{ok:true});
    }

    const hostname=String(req.headers.host||'').split(':')[0].toLowerCase();
    if(req.method==='GET'&&url.pathname==='/'&&hostname==='robgoblin.studio')return sendStatic(res,path.join(ROOT,'studio.html'));
    if(req.method==='GET'&&url.pathname==='/')return sendStatic(res,path.join(ROOT,'index.html'));
    if(req.method==='GET'&&url.pathname==='/skapa')return sendStatic(res,path.join(ROOT,'create.html'));
    if(req.method==='GET'&&url.pathname==='/create.html')return sendStatic(res,path.join(ROOT,'create.html'));
    if(req.method==='GET'&&url.pathname==='/calendar.html')return sendStatic(res,path.join(ROOT,'calendar.html'));
    if(req.method==='GET'&&url.pathname==='/favicon.ico'){res.writeHead(204);return res.end()}
    const roomPath=url.pathname.match(/^\/([a-z]+-[a-z]+-[a-z]+)\/?$/);
    if(req.method==='GET'&&roomPath){if(!database.calendars[roomPath[1]]&&!FIREBASE_CONFIGURED)return notFoundPage(res);return sendStatic(res,path.join(ROOT,'calendar.html'))}
    if(req.method==='GET'&&/^\/(style\.css|home\.js|calendar\.js|i18n\.js|data\.js|firebase-backend\.js|slug-words\.json|firebase-config\.json|favicon\.svg|share-card\.svg|share-card\.png)$/.test(url.pathname))return sendStatic(res,path.join(ROOT,url.pathname.slice(1)));
    if(req.method==='GET'&&url.pathname==='/robots.txt'){res.writeHead(200,{'Content-Type':'text/plain'});return res.end('User-agent: *\nDisallow: /\n')}
    res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Hittades inte.');
  }catch(error){
    console.error(error);if(!res.headersSent)json(res,500,{error:'Något gick fel. Försök igen.'});else res.end();
  }
});

server.listen(PORT,HOST,()=>console.log(`DayGoblin kör på http://localhost:${PORT}`));
