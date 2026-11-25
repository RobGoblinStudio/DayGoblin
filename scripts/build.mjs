import { cp, mkdir, rm } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const output=new URL('../dist/',import.meta.url);
const files=['studio.html','index.html','create.html','calendar.html','home.js','calendar.js','i18n.js','data.js','firebase-backend.js','firebase-config.json','slug-words.json','style.css','robots.txt','sitemap.xml','_redirects','favicon.svg','share-card.svg'];
const config=JSON.parse(await readFile(new URL('../firebase-config.json',import.meta.url),'utf8'));
const configured=['apiKey','authDomain','databaseURL','projectId','appId'].every(key=>Boolean(config[key]));
if(!configured&&process.env.DAYGOBLIN_ALLOW_EMPTY_CONFIG!=='1'&&process.env.DAYBUDDY_ALLOW_EMPTY_CONFIG!=='1')throw new Error('Fyll i firebase-config.json innan du bygger för publicering.');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const file of files)await cp(new URL(file,root),new URL(file,output));
console.log(`Built DayGoblin static site (${files.length} files).`);
