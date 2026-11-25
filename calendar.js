import { api, participantId, ready, startupError } from './data.js';
import { currentLanguage, locale, t } from './i18n.js';

const roomSlug=decodeURIComponent(location.pathname.split('/').filter(Boolean)[0]||'');
const nameKey=`daybuddy:${roomSlug}:name`;
const participantKey=`daybuddy:${roomSlug}:participant`;
const today=new Date();today.setHours(0,0,0,0);
const firstMonth=new Date(today.getFullYear(),today.getMonth(),1);
const profileInput=document.getElementById('nameInput');
let room=null;
let activeParticipantId=(()=>{try{return localStorage.getItem(participantKey)||participantId}catch{return participantId}})();
let personColorIndexes=new Map();
let activeView='calendar';
let nameTimer=null;
let source=null;
const pendingVotes=new Set();
const pendingVoteStates=new Map();
let renderedAvatarKeys=new Set();
let renderedAvatarPeople=new Map();
let renderedAvatarStackOrders=new Map();
let renderedCompleteDayKeys=new Set();
let renderedDayStyles=new Map();
let latestServerRoom=null;
let hasRenderedOnce=false;
const pendingAvatarRemovals=new Map();

function animateAvatar(_key,wasRendered){return hasRenderedOnce&&!wasRendered}
function animateAvatarReflow(container,previousRects){
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  for(const avatar of container.querySelectorAll('.day .initials i[data-avatar-key]:not(.removal-ghost):not(.avatar-pop)')){
    const previous=previousRects.get(avatar.dataset.avatarKey);if(!previous)continue;
    const current=avatar.getBoundingClientRect(),dx=previous.left-current.left,dy=previous.top-current.top;
    if(Math.abs(dx)<1&&Math.abs(dy)<1)continue;
    avatar.animate([{transform:`translate3d(${dx}px,${dy}px,0)`},{transform:'translate3d(0,0,0)'}],{duration:370,easing:'cubic-bezier(.22,.72,.24,1)'});
  }
  for(const ghost of container.querySelectorAll('.removal-ghost[data-avatar-key]')){
    const previous=previousRects.get(ghost.dataset.avatarKey);if(!previous)continue;
    const parent=ghost.parentElement.getBoundingClientRect();
    ghost.style.left=`${previous.left-parent.left}px`;ghost.style.top=`${previous.top-parent.top}px`;
  }
}

function dateKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function fromKey(key){return new Date(`${key}T12:00:00`)}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
const personColors=['#e31c5f','#6546e8','#007e87','#db6a00','#3267d5','#a8328d','#d82f8b','#267a3d','#a044d6','#c73524'];
function updatePersonColors(){
  const ordered=[...participants()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
  personColorIndexes=new Map(ordered.map((person,index)=>[person.id,index]));
}
function personColor(person){return personColors[personColorIndexes.get(person.id)??(person.colorIndex||0)%personColors.length]}
function participants(){return room?.participants||[]}
function currentParticipant(){return participants().find(person=>person.id===activeParticipantId)}
function applyParticipantVote(target,key,state){
  if(!target)return;
  let person=target.participants.find(item=>item.id===activeParticipantId);
  if(!person){person={id:activeParticipantId,name:state.name,dates:[],colorIndex:target.participants.length,createdAt:new Date().toISOString()};target.participants.push(person)}
  person.name=state.name;
  person.dates=person.dates.filter(date=>date!==key);
  if(state.available)person.dates.push(key);
}
function serverHasVote(target,key,state){
  const person=target?.participants.find(item=>item.id===activeParticipantId);
  return Boolean(person)&&person.dates.includes(key)===state.available;
}
function applyPendingVotes(target){
  for(const [key,state] of pendingVoteStates){
    if(state.saved&&serverHasVote(target,key,state)){pendingVoteStates.delete(key);continue}
    applyParticipantVote(target,key,state);
  }
  return target;
}
const nameCookieKey=`daybuddy_name_${roomSlug}`;
function rememberedName(){
  try{const stored=localStorage.getItem(nameKey);if(stored)return stored}catch{}
  try{const entry=document.cookie.split('; ').find(item=>item.startsWith(`${nameCookieKey}=`));return entry?decodeURIComponent(entry.slice(nameCookieKey.length+1)):''}catch{return ''}
}
function rememberName(name){
  try{localStorage.setItem(nameKey,name)}catch{}
  try{document.cookie=`${nameCookieKey}=${encodeURIComponent(name)}; Max-Age=31536000; Path=/; SameSite=Lax; Secure`}catch{}
}
// Restore the local name immediately, even if the shared calendar is still loading.
profileInput.value=rememberedName();
function availabilityByDate(){
  const result=new Map();
  for(const person of participants())for(const date of person.dates){if(!result.has(date))result.set(date,[]);result.get(date).push(person)}
  return result;
}
function visibleDateEnd(){return new Date(firstMonth.getFullYear(),firstMonth.getMonth()+3,1)}
function commonDays(availability){
  if(room?.participantCount==null)return [];
  return [...availability.entries()].filter(([key,people])=>{const date=fromKey(key);return date>=today&&date<visibleDateEnd()&&people.length>=room.participantCount}).map(([key,people])=>({key,date:fromKey(key),people})).sort((a,b)=>a.key.localeCompare(b.key));
}
function render(){
  if(!room)return;
  updatePersonColors();
  const openAudience=room.participantCount==null;
  document.body.classList.toggle('open-audience',openAudience);
  const chosen=currentParticipant()?.name||rememberedName();
  if(document.activeElement!==profileInput)profileInput.value=chosen;
  const picker=document.getElementById('participantPicker');
  const options=document.getElementById('participantOptions');
  picker.hidden=!participants().length;
  profileInput.placeholder=t(participants().length?'newParticipantName':'name');
  profileInput.setAttribute('aria-label',t(participants().length?'newParticipantName':'name'));
  options.innerHTML=participants().map(person=>`<button class="participant-option${person.id===activeParticipantId?' selected':''}" type="button" data-participant-id="${escapeHtml(person.id)}" aria-pressed="${person.id===activeParticipantId}"><i class="person-avatar" style="--person-color:${personColor(person)}">${escapeHtml(person.name.trim().charAt(0).toUpperCase())}</i><span>${escapeHtml(person.name)}</span></button>`).join('');
  const atCapacity=!openAudience&&participants().length>=room.participantCount;
  document.getElementById('participantLimitMessage').hidden=!(atCapacity&&!currentParticipant());
  document.title=`${room.title} — DayGoblin`;
  updateShareMetadata(room.title);
  document.getElementById('calendarTitle').textContent=room.title;
  document.getElementById('roomType').textContent=t(openAudience?'openRoomType':'roomType');
  document.getElementById('fixedGroupControl').hidden=openAudience;
  document.getElementById('peopleCount').textContent=room.participantCount||'';
  document.getElementById('calendarInstructions').textContent=t(openAudience?'openInstructions':'instructions');

  const availability=availabilityByDate();
  const nextAvatarKeys=new Set();
  const nextAvatarPeople=new Map();
  const nextAvatarStackOrders=new Map();
  const nextCompleteDayKeys=new Set();
  const renderTime=Date.now();
  const previousDayStyles=renderedDayStyles;
  const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  for(const [avatarKey,person] of renderedAvatarPeople){
    const date=avatarKey.slice(0,10),stillPresent=(availability.get(date)||[]).some(item=>item.id===person.id);
    if(hasRenderedOnce&&!stillPresent&&!reduceMotion&&!pendingAvatarRemovals.has(avatarKey))pendingAvatarRemovals.set(avatarKey,{person,stackOrder:renderedAvatarStackOrders.get(avatarKey)??0,startedAt:renderTime,until:renderTime+290});
  }
  for(const [key,removal] of pendingAvatarRemovals)if(removal.until<=renderTime)pendingAvatarRemovals.delete(key);
  let maxVotes=0;for(const people of availability.values())maxVotes=Math.max(maxVotes,people.length);
  const days=commonDays(availability);
  const commonTab=document.getElementById('commonTab');
  commonTab.hidden=openAudience;
  commonTab.disabled=!openAudience&&days.length===0;
  commonTab.setAttribute('aria-disabled',String(commonTab.disabled));
  if(activeView==='common'&&(commonTab.hidden||commonTab.disabled))activeView='calendar';
  document.getElementById('commonCount').textContent=days.length;

  const monthContainer=document.getElementById('months');
  const previousAvatarRects=new Map([...monthContainer.querySelectorAll('.day .initials i[data-avatar-key]')].map(avatar=>[avatar.dataset.avatarKey,avatar.getBoundingClientRect()]));
  monthContainer.replaceChildren();
  for(let offset=0;offset<3;offset++){
    const visibleMonth=new Date(firstMonth.getFullYear(),firstMonth.getMonth()+offset,1);
    const section=document.createElement('section');section.className='month-section';
    const heading=document.createElement('h2');heading.className='month-title';heading.textContent=new Intl.DateTimeFormat(locale(),{month:'long',year:'numeric'}).format(visibleMonth);section.appendChild(heading);
    const weekdays=document.createElement('div');weekdays.className='weekdays';weekdays.setAttribute('aria-hidden','true');weekdays.innerHTML=currentLanguage()==='en'?'<span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>':'<span>M</span><span>T</span><span>O</span><span>T</span><span>F</span><span>L</span><span>S</span>';section.appendChild(weekdays);
    const grid=document.createElement('div');grid.className=`calendar${openAudience?' open-voting':''}`;
    const offsetFromMonday=(visibleMonth.getDay()+6)%7;
    const daysInMonth=new Date(visibleMonth.getFullYear(),visibleMonth.getMonth()+1,0).getDate();
    const slots=Math.ceil((offsetFromMonday+daysInMonth)/7)*7;
    for(let slot=0;slot<slots;slot++){
      const dayNumber=slot-offsetFromMonday+1;
      if(dayNumber<1||dayNumber>daysInMonth){const blank=document.createElement('div');blank.className='day empty';grid.appendChild(blank);continue}
      const date=new Date(visibleMonth.getFullYear(),visibleMonth.getMonth(),dayNumber);date.setHours(0,0,0,0);
      const key=dateKey(date),people=availability.get(key)||[],mine=people.some(person=>person.id===activeParticipantId);
      const button=document.createElement('button');button.type='button';button.className='day';
      button.dataset.date=key;
      const complete=room.participantCount!=null&&people.length>=room.participantCount;
      if(!people.length)button.classList.add('no-votes');
      if(mine)button.classList.add('mine');if(complete){button.classList.add('complete');nextCompleteDayKeys.add(key);if(hasRenderedOnce&&!renderedCompleteDayKeys.has(key))button.classList.add('complete-enter')}if(date.getTime()===today.getTime())button.classList.add('today');if(date<today)button.classList.add('past');
      if(openAudience&&people.length){const heat=maxVotes<5?people.length:Math.ceil(people.length/maxVotes*5);button.classList.add(`heat-${Math.max(1,Math.min(5,heat))}`)}
      const monthName=new Intl.DateTimeFormat(locale(),{month:'long'}).format(date);
      const availabilityLabel=openAudience?`${people.length} ${t(people.length===1?'vote':'votes')}`:t('dayCount',{available:people.length,count:room.participantCount});
      button.setAttribute('aria-label',t('dayLabel',{day:dayNumber,month:monthName,availability:availabilityLabel,selected:mine?`, ${t('youSelected')}`:''}));
      let markers='';
      if(openAudience){if(people.length)markers=`<span class="vote-count"><b>${people.length}</b><small>${t(people.length===1?'vote':'votes')}</small></span>`}
      else{
        const ghosts=[...pendingAvatarRemovals].filter(([removalKey,removal])=>removalKey.startsWith(`${key}:`)&&!people.some(person=>person.id===removal.person.id)).map(([removalKey,removal])=>({key:removalKey,...removal,elapsed:Math.max(0,renderTime-removal.startedAt)}));
        const visibleMarkers=people.slice(0,10).map((person,index)=>{
        const avatarKey=`${key}:${person.id}`;nextAvatarKeys.add(avatarKey);
        nextAvatarPeople.set(avatarKey,person);
        nextAvatarStackOrders.set(avatarKey,index);
        const entered=animateAvatar(`day:${avatarKey}`,renderedAvatarKeys.has(avatarKey));
        const classes=entered?'avatar-pop':'';
        return `<i${classes?` class="${classes}"`:''} data-avatar-key="${avatarKey}" title="${escapeHtml(person.name)}" style="--person-color:${personColor(person)};--stack-order:${index}">${escapeHtml(person.name.trim().charAt(0).toUpperCase())}</i>`;
        }).join('');
        const exitMarkers=ghosts.map(({key:avatarKey,person,stackOrder,elapsed})=>`<i class="avatar-pop-out removal-ghost" data-avatar-key="${avatarKey}" aria-hidden="true" style="--person-color:${personColor(person)};--stack-order:${stackOrder};--exit-delay:-${elapsed}ms">${escapeHtml(person.name.trim().charAt(0).toUpperCase())}</i>`).join('');
        markers=`<span class="initials count-${Math.min(people.length,10)}">${visibleMarkers}${exitMarkers}</span>`;
      }
      button.innerHTML=`<span class="number">${dayNumber}</span>${markers}`;
      const oldStyle=previousDayStyles.get(key);
      const state=[...button.classList].filter(name=>name==='mine'||name==='complete'||name==='no-votes'||name.startsWith('heat-')).sort().join(' ');
      if(oldStyle&&oldStyle.state!==state&&!reduceMotion){
        const wash=document.createElement('span');wash.className='day-change-wash';wash.setAttribute('aria-hidden','true');wash.style.backgroundColor=oldStyle.backgroundColor;wash.style.borderColor=oldStyle.borderColor;
        wash.addEventListener('animationend',()=>wash.remove(),{once:true});button.prepend(wash);
      }
      if(date>=today)button.addEventListener('click',()=>toggleDate(key));else button.disabled=true;
      if(pendingVotes.has(key))button.classList.add('pending');grid.appendChild(button);
    }
    section.appendChild(grid);monthContainer.appendChild(section);
  }
  const nextDayStyles=new Map();
  for(const button of monthContainer.querySelectorAll('.day[data-date]')){
    const style=getComputedStyle(button);
    const state=[...button.classList].filter(name=>name==='mine'||name==='complete'||name==='no-votes'||name.startsWith('heat-')).sort().join(' ');
    nextDayStyles.set(button.dataset.date,{state,backgroundColor:style.backgroundColor,borderColor:style.borderColor});
  }
  renderedDayStyles=nextDayStyles;
  animateAvatarReflow(monthContainer,previousAvatarRects);

  const commonContainer=document.getElementById('commonDays');
  const monthContainerForAnimation=document.getElementById('months');
  if(!monthContainerForAnimation.dataset.avatarAnimationListener){
    monthContainerForAnimation.addEventListener('animationend',event=>{
      const avatar=event.target;
      if(avatar instanceof HTMLElement){
        if(avatar.classList.contains('avatar-pop'))avatar.classList.remove('avatar-pop');
        if(avatar.classList.contains('avatar-pop-out')){
          pendingAvatarRemovals.delete(avatar.dataset.avatarKey);
          avatar.remove();
        }
      }
    });
    monthContainerForAnimation.dataset.avatarAnimationListener='true';
  }
  if(!days.length){
    commonContainer.innerHTML=`<div class="common-empty"><span class="empty-icon">✳</span><strong>${escapeHtml(t('noCommon'))}</strong><p>${escapeHtml(t('noCommonHint'))}</p></div>`;
  }else{
    const months=new Map();
    for(const day of days){
      const monthName=new Intl.DateTimeFormat(locale(),{month:'long',year:'numeric'}).format(day.date);
      if(!months.has(monthName))months.set(monthName,[]);
      months.get(monthName).push(day);
    }
    commonContainer.innerHTML=[...months].map(([monthName,monthDays])=>`
      <section class="common-month">
        <h3 class="common-month-title">${escapeHtml(monthName)}</h3>
        ${monthDays.map(({date,people})=>{
          const weekday=new Intl.DateTimeFormat(locale(),{weekday:'short'}).format(date).replace('.','');
          const avatars=people.map(person=>`<i class="common-avatar" title="${escapeHtml(person.name)}" aria-label="${escapeHtml(person.name)}" style="--person-color:${personColor(person)}">${escapeHtml(person.name.trim().charAt(0).toUpperCase())}</i>`).join('');
          return `<article class="common-day"><div class="common-date"><span>${escapeHtml(weekday)}</span><strong>${date.getDate()}</strong></div><span class="common-avatars" aria-hidden="true">${avatars}</span></article>`;
        }).join('')}
      </section>`).join('');
  }
  setActiveView(activeView);

  renderedAvatarKeys=nextAvatarKeys;
  renderedAvatarPeople=nextAvatarPeople;
  renderedAvatarStackOrders=nextAvatarStackOrders;
  renderedCompleteDayKeys=nextCompleteDayKeys;
  hasRenderedOnce=true;
}

function updateShareMetadata(title){
  const description=`${title} — planera tillsammans med DayGoblin.`;
  const set=(selector,value)=>{const element=document.querySelector(selector);if(element)element.setAttribute('content',value)};
  set('meta[name="description"]',description);
  set('meta[property="og:title"]',`${title} — DayGoblin`);
  set('meta[property="og:description"]',description);
  set('meta[property="og:url"]',`${location.origin}${location.pathname}`);
  set('meta[property="og:image"]',`${location.origin}/share-card.svg`);
  set('meta[name="twitter:title"]',`${title} — DayGoblin`);
  set('meta[name="twitter:description"]',description);
}
function setActiveView(view){
  activeView=view;
  const calendar=view==='calendar';
  document.getElementById('calendarTab').classList.toggle('active',calendar);
  document.getElementById('commonTab').classList.toggle('active',!calendar);
  document.getElementById('calendarTab').setAttribute('aria-selected',String(calendar));
  document.getElementById('commonTab').setAttribute('aria-selected',String(!calendar));
  document.getElementById('calendarPanel').hidden=!calendar;
  document.getElementById('commonPanel').hidden=calendar;
}
async function saveName(name){
  const clean=name.trim();if(!clean)return;
  rememberName(clean);
  await api.saveParticipant(roomSlug,activeParticipantId,clean);
}
async function toggleDate(key){
  if(pendingVotes.has(key))return;
  const name=profileInput.value.trim();if(!name){focusNameInput();toast(t('nameFirst'));return}
  clearTimeout(nameTimer);
  const existing=currentParticipant();
  if(!existing&&room.participantCount!=null&&participants().length>=room.participantCount){toast(t('calendarFull'));return}
  const previousState=existing?{name:existing.name,dates:[...existing.dates]}:null;
  const available=!(existing?.dates||[]).includes(key);
  const voteState={name,available,saved:false};
  pendingVoteStates.set(key,voteState);
  const avatarRemovalKey=`${key}:${activeParticipantId}`;
  const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(!available&&existing&&!reduceMotion){
    const startedAt=Date.now();pendingAvatarRemovals.set(avatarRemovalKey,{person:existing,startedAt,until:startedAt+290});
  }else pendingAvatarRemovals.delete(avatarRemovalKey);
  // Update the screen immediately; the name and vote are saved together in one request.
  applyParticipantVote(room,key,voteState);
  rememberName(name);
  try{localStorage.setItem(participantKey,activeParticipantId)}catch{}
  pendingVotes.add(key);
  render();
  try{
    await api.saveVote(roomSlug,activeParticipantId,name,key,available);
    applyParticipantVote(room,key,voteState);
    if(pendingVoteStates.get(key)===voteState){voteState.saved=true;if(serverHasVote(latestServerRoom,key,voteState))pendingVoteStates.delete(key)}
  }catch(error){
    if(error.offlineQueued){applyParticipantVote(room,key,voteState);if(pendingVoteStates.get(key)===voteState){voteState.saved=true;if(serverHasVote(latestServerRoom,key,voteState))pendingVoteStates.delete(key)}toast(t('offlineSaved'));return}
    const failureMessage=error instanceof TypeError||/fetch|network/i.test(error.message)
      ?t('saveError')
      :t('saveErrorShort');
    try{
      room=await api.getCalendar(roomSlug);
      const saved=room.participants.find(person=>person.id===activeParticipantId)?.dates.includes(key)===available;
      if(saved){applyParticipantVote(room,key,voteState);if(pendingVoteStates.get(key)===voteState){voteState.saved=true;if(serverHasVote(latestServerRoom,key,voteState))pendingVoteStates.delete(key)}}
      else{if(pendingVoteStates.get(key)===voteState)pendingVoteStates.delete(key);toast(failureMessage)}
    }catch{
      if(previousState){
        const participant=room.participants.find(person=>person.id===activeParticipantId);
        if(participant){participant.name=previousState.name;participant.dates=previousState.dates}
      }else room.participants=room.participants.filter(person=>person.id!==activeParticipantId);
      pendingAvatarRemovals.delete(avatarRemovalKey);
      if(pendingVoteStates.get(key)===voteState)pendingVoteStates.delete(key);
      toast(failureMessage);
    }
  }
  finally{pendingVotes.delete(key);render()}
}
async function refreshRoom(){room=await api.getCalendar(roomSlug);render()}
function roomSignature(value){
  if(!value)return '';
  return JSON.stringify([value.title,value.participantCount,(value.participants||[]).map(person=>[person.id,person.name,person.colorIndex,person.createdAt,[...person.dates].sort()])]);
}
function connectLive(){
  source=api.subscribe(roomSlug,updated=>{
    latestServerRoom=updated;
    const nextRoom=applyPendingVotes(updated);
    const changed=roomSignature(room)!==roomSignature(nextRoom);
    room=nextRoom;
    if(changed)render();
    document.body.classList.remove('connection-paused');
  },()=>document.body.classList.add('connection-paused'));
}
function focusNameInput(){
  try{profileInput.focus({preventScroll:true})}catch{profileInput.focus()}
  setTimeout(()=>profileInput.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'}),250);
}
function syncToastPosition(){
  const el=document.getElementById('toast'),viewport=window.visualViewport;
  if(!el||!viewport)return;
  let baseTop=Number(el.dataset.baseTop);
  if(!Number.isFinite(baseTop)||baseTop<=0){baseTop=parseFloat(getComputedStyle(el).top)||12;el.dataset.baseTop=String(baseTop)}
  el.style.top=`${viewport.offsetTop+baseTop}px`;
}
if(window.visualViewport){
  window.visualViewport.addEventListener('resize',syncToastPosition);
  window.visualViewport.addEventListener('scroll',syncToastPosition);
  window.addEventListener('scroll',syncToastPosition,{passive:true});
}
function toast(message){const el=document.getElementById('toast');el.textContent=message;syncToastPosition();el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2400)}

profileInput.addEventListener('input',()=>{
  const name=profileInput.value;rememberName(name);clearTimeout(nameTimer);
  if(name.trim()&&currentParticipant())nameTimer=setTimeout(()=>saveName(name).catch(error=>toast(error.message)),700);
});
document.getElementById('participantOptions').addEventListener('click',event=>{
  const option=event.target.closest('[data-participant-id]');if(!option)return;
  const person=participants().find(item=>item.id===option.dataset.participantId);if(!person)return;
  activeParticipantId=person.id;
  try{localStorage.setItem(participantKey,activeParticipantId)}catch{}
  profileInput.value=person.name;rememberName(person.name);clearTimeout(nameTimer);render();profileInput.blur();
});
document.getElementById('calendarTab').addEventListener('click',()=>setActiveView('calendar'));
document.getElementById('commonTab').addEventListener('click',()=>setActiveView('common'));
document.getElementById('shareButton').addEventListener('click',async()=>{
  const shareData={title:`${room?.title||'DayGoblin'} — DayGoblin`,url:location.href};
  try{if(navigator.share)await navigator.share(shareData);else{await navigator.clipboard.writeText(location.href);toast(t('copied'))}}
  catch(error){if(error.name!=='AbortError')try{await navigator.clipboard.writeText(location.href);toast(t('copied'))}catch{prompt(t('copyLinkPrompt'),location.href)}}
});

const retryLoadButton=document.getElementById('retryLoad');
retryLoadButton.addEventListener('click',()=>location.reload());
function finishLoading(){
  const showedSkeleton=document.body.classList.contains('show-skeleton');
  window.clearTimeout(Number(document.body.dataset.skeletonTimer));
  document.body.classList.remove('is-loading','show-skeleton');
  document.getElementById('loadingSkeleton').hidden=true;
  if(showedSkeleton)document.body.classList.add('calendar-ready');
}
async function loadCalendar(){
  let error;
  const attempts=startupError?1:2;
  for(let attempt=0;attempt<attempts;attempt++){
    try{
      await ready;
      if(startupError)throw startupError;
      let rememberedId='';try{rememberedId=localStorage.getItem(participantKey)||''}catch{}
      if(!rememberedId)activeParticipantId=participantId;
      room=await api.getCalendar(roomSlug);
      if(rememberedId&&!room.participants.some(person=>person.id===rememberedId))activeParticipantId=participantId;
      render();connectLive();finishLoading();return;
    }catch(caught){
      error=caught;
      if(attempt+1<attempts)await new Promise(resolve=>setTimeout(resolve,700));
    }
  }
  console.error('DayGoblin kunde inte läsa kalendern.',error);
  finishLoading();
  document.body.classList.add('calendar-load-error');
  document.getElementById('calendarTitle').textContent=t('loadError');
  document.querySelector('.calendar-intro .intro-copy').textContent=t('loadErrorHint');
  document.title=`${t('loadError')} — DayGoblin`;
  retryLoadButton.hidden=false;
  document.getElementById('shareButton').hidden=true;
}
loadCalendar();
document.addEventListener('daybuddy-language-change',()=>{
  if(room){render();return}
  if(document.body.classList.contains('calendar-load-error')){
    document.getElementById('calendarTitle').textContent=t('loadError');
    document.getElementById('calendarInstructions').textContent=t('loadErrorHint');
    document.title=`${t('loadError')} — DayGoblin`;
  }
});

