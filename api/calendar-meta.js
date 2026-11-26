// Vercel function: link previews (Messenger, WhatsApp, Slack …) for shared calendar links.
// vercel.json routes only link-preview crawlers here; people get the normal static calendar.html.
const config=require('../firebase-config.json');

const slugPattern=/^[a-z]+-[a-z]+-[a-z]+$/;
function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
async function roomTitle(slug){
  if(!config?.apiKey||!config?.databaseURL)return null;
  const signal=AbortSignal.timeout(4000);
  const auth=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(config.apiKey)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({returnSecureToken:true}),signal});
  if(!auth.ok)return null;
  const {idToken}=await auth.json();
  const response=await fetch(`${config.databaseURL}/calendars/${slug}/title.json?auth=${encodeURIComponent(idToken)}`,{signal});
  if(!response.ok)return null;
  const title=await response.json();
  return typeof title==='string'&&title.trim()?title.trim():null;
}

module.exports=async function handler(req,res){
  const url=new URL(req.url,`https://${req.headers.host||'daygoblin.robgoblin.studio'}`);
  const slug=String(url.searchParams.get('slug')||'');
  const english=url.searchParams.get('lang')==='en';
  let title=null;
  if(slugPattern.test(slug)){try{title=await roomTitle(slug)}catch{}}
  const origin=`https://${req.headers['x-forwarded-host']||req.headers.host}`;
  const pageTitle=title?`${title} — DayGoblin`:'DayGoblin — delad kalender';
  const description=english
    ?(title?`Help pick a day for “${title}”. Mark the days you’re free in DayGoblin.`:'Plan together with DayGoblin and find a day that works for your group.')
    :(title?`Hjälp till att hitta en dag för ”${title}”. Markera dagarna du kan i DayGoblin.`:'Planera tillsammans med DayGoblin och hitta en dag som passar gruppen.');
  const pageUrl=`${origin}/${slugPattern.test(slug)?slug:''}`;
  const image=`${origin}/share-card.png`;
  const html=`<!doctype html><html lang="${english?'en':'sv'}"><head><meta charset="utf-8"><title>${escapeHtml(pageTitle)}</title><meta name="robots" content="noindex,nofollow"><meta name="description" content="${escapeHtml(description)}"><meta property="og:type" content="website"><meta property="og:site_name" content="DayGoblin"><meta property="og:title" content="${escapeHtml(pageTitle)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(pageUrl)}"><meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(pageTitle)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}"></head><body><h1>${escapeHtml(pageTitle)}</h1><p>${escapeHtml(description)}</p><a href="${escapeHtml(pageUrl)}">${escapeHtml(pageUrl)}</a></body></html>`;
  res.statusCode=200;
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=300');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  res.end(html);
};
