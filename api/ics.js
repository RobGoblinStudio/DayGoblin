// One all-day event as a calendar link (not a download): iPhone/iPad and Safari on Mac open it straight in Calendar.
// Used by Vercel as /api/ics and by the local server (server.js) at the same path.
const slugPattern=/^[a-z]+-[a-z]+-[a-z]+$/;
function icsText(value){return String(value).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n')}
function validDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T12:00:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}

module.exports=function handler(req,res){
  const url=new URL(req.url,'http://localhost');
  const date=String(url.searchParams.get('date')||'');
  const slug=String(url.searchParams.get('slug')||'');
  const title=String(url.searchParams.get('title')||'DayGoblin').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,100)||'DayGoblin';
  const english=url.searchParams.get('lang')==='en';
  if(!validDate(date)||!slugPattern.test(slug)){res.statusCode=400;res.setHeader('Content-Type','text/plain; charset=utf-8');res.end('Ogiltig dag.');return}
  const start=new Date(`${date}T12:00:00Z`),end=new Date(start);end.setUTCDate(end.getUTCDate()+1);
  const compact=value=>value.toISOString().slice(0,10).replaceAll('-','');
  const host=req.headers['x-forwarded-host']||req.headers.host||'daygoblin.robgoblin.studio';
  const protocol=req.headers['x-forwarded-proto']||(String(host).startsWith('localhost')||String(host).startsWith('127.')?'http':'https');
  const page=`${protocol}://${host}/${slug}`;
  const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//RobGoblin Studio//DayGoblin//SV','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
    `UID:${slug}-${compact(start)}@daygoblin.robgoblin.studio`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${compact(start)}`,`DTEND;VALUE=DATE:${compact(end)}`,
    `SUMMARY:${icsText(title)}`,`DESCRIPTION:${icsText(`${english?'Planned with DayGoblin:':'Planerad med DayGoblin:'} ${page}`)}`,`URL:${page}`,'END:VEVENT','END:VCALENDAR'];
  res.statusCode=200;
  res.setHeader('Content-Type','text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition',`inline; filename="daygoblin-${date}.ics"`);
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  res.end(lines.join('\r\n')+'\r\n');
};
