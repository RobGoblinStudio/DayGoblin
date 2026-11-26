// Creates a test calendar on the LOCAL server (npm start) with made-up people who have already answered.
// You are the last person missing, so marking the same days makes them "common days".
//   npm run demo                 2 people: Anna has answered, you are the second
//   npm run demo -- 4            4 people: Anna, Bo and Cia have answered
//   npm run demo -- open         calendar with no limit and votes spread over several days
const base=process.env.DAYGOBLIN_URL||'http://localhost:4173';
if(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))throw new Error('Demo data is only for the local server.');
const arg=process.argv[2]||'2';
const open=arg==='open';
const count=open?null:Math.max(2,Math.min(10,Number(arg)||2));
const names=['Anna','Bo','Cia','Dan','Eva','Filip','Greta','Hugo','Ida'];

async function call(path,method,body){
  const response=await fetch(`${base}${path}`,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).catch(()=>{throw new Error(`Could not reach ${base}. Start the local server first with: npm start`)});
  const result=await response.json();if(!response.ok)throw new Error(result.error||response.statusText);return result;
}
function day(offset){const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()+offset);return date.toISOString().slice(0,10)}

const {slug}=await call('/api/calendars','POST',{purpose:open?'Testkalender utan gräns':`Testkalender för ${count}`,participantCount:count});
const others=open?names.slice(0,7):names.slice(0,count-1);
for(const [index,name] of others.entries()){
  const id=`demo-${slug}-${index}`;
  // Everyone shares a few days (so they can become common), plus a couple of their own.
  const shared=open?[3,4,10].filter((_,i)=>index%(i+2)!==1):[3,4,10,11];
  const own=[6+index*2,15+index];
  await call(`/api/calendar/${slug}/participants/${id}/days`,'PUT',{name,dates:[...shared,...own].map(day),available:true});
}
console.log(`\nTestkalender: ${base}/${slug}\n`);
console.log(open?`${others.length} personer har redan svarat. Fliken "Flest kan" visar de populäraste dagarna.`:`${others.join(', ')} har redan svarat. Skriv ditt namn och markera ${[3,4,10,11].map(day).join(', ')} så blir de gemensamma dagar.`);
