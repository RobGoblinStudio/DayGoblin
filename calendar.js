import { api, participantId, ready, startupError } from './data.js?v=27';
import { currentLanguage, locale, t } from './i18n.js?v=15';

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
const pendingPreferences=new Set();
const pendingPreferenceStates=new Map();
let commonListSignature='';
let renderedAvatarKeys=new Set();
let renderedAvatarPeople=new Map();
let renderedAvatarStackOrders=new Map();
let renderedCompleteDayKeys=new Set();
let renderedDayStyles=new Map();
let latestServerRoom=null;
let hasRenderedOnce=false;
const pendingAvatarRemovals=new Map();

// New avatars rise straight up. A re-render mid-animation continues the same animation instead of restarting it.
const AVATAR_POP_MS=420;
const avatarPopStarts=new Map();
function avatarPopElapsed(key,wasRendered,now){
  if(hasRenderedOnce&&!wasRendered){avatarPopStarts.set(key,now);return 0}
  const started=avatarPopStarts.get(key);if(started==null)return null;
  const elapsed=now-started;if(elapsed>=AVATAR_POP_MS){avatarPopStarts.delete(key);return null}
  return elapsed;
}
// Layout position inside the day cell, unaffected by running transforms (getBoundingClientRect is not).
function avatarLayoutPosition(avatar){return {left:avatar.offsetLeft,top:avatar.offsetTop}}
function animateAvatarReflow(container,previousRects){
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  for(const avatar of container.querySelectorAll('.day .initials i[data-avatar-key]:not(.removal-ghost):not(.avatar-pop)')){
    const previous=previousRects.get(avatar.dataset.avatarKey);if(!previous)continue;
    const current=avatarLayoutPosition(avatar),dx=previous.left-current.left,dy=previous.top-current.top;
    if(Math.abs(dx)<1&&Math.abs(dy)<1)continue;
    avatar.animate([{transform:`translate3d(${dx}px,${dy}px,0)`},{transform:'translate3d(0,0,0)'}],{duration:370,easing:'cubic-bezier(.22,.72,.24,1)'});
  }
  for(const ghost of container.querySelectorAll('.removal-ghost[data-avatar-key]')){
    const previous=previousRects.get(ghost.dataset.avatarKey);if(!previous)continue;
    ghost.style.left=`${previous.left}px`;ghost.style.top=`${previous.top}px`;
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
  if(!person){person={id:activeParticipantId,name:state.name,dates:[],preferredDates:[],colorIndex:target.participants.length,createdAt:new Date().toISOString()};target.participants.push(person)}
  person.name=state.name;
  person.dates=person.dates.filter(date=>date!==key);
  if(state.available)person.dates.push(key);else person.preferredDates=(person.preferredDates||[]).filter(date=>date!==key);
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
function applyParticipantPreference(target,key,state){
  const person=target?.participants.find(item=>item.id===state.participantId);if(!person)return;
  const preferredDates=new Set(person.preferredDates||[]);if(state.preferred)preferredDates.add(key);else preferredDates.delete(key);person.preferredDates=[...preferredDates].sort();
}
function serverHasPreference(target,key,state){
  const person=target?.participants.find(item=>item.id===state.participantId);return Boolean(person)&&((person.preferredDates||[]).includes(key)===state.preferred);
}
function applyPendingPreferences(target){
  for(const [key,state] of pendingPreferenceStates){if(state.saved&&serverHasPreference(target,key,state)){pendingPreferenceStates.delete(key);continue}applyParticipantPreference(target,key,state)}
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
const MONTH_STEP=3,MAX_MONTHS=12;
let monthsShown=MONTH_STEP,newMonthsFrom=null;
function visibleDateEnd(){return new Date(firstMonth.getFullYear(),firstMonth.getMonth()+monthsShown,1)}
// Open far enough ahead that every marked day is visible (in steps of three months).
function ensureMonthsCoverMarkedDays(){
  let latest=null;for(const person of participants())for(const date of person.dates)if(!latest||date>latest)latest=date;
  if(!latest)return;
  const date=fromKey(latest),needed=(date.getFullYear()-firstMonth.getFullYear())*12+date.getMonth()-firstMonth.getMonth()+1;
  while(monthsShown<needed&&monthsShown<MAX_MONTHS)monthsShown+=MONTH_STEP;
}
function commonDays(availability){
  if(room?.participantCount==null)return [];
  return [...availability.entries()].filter(([key,people])=>{const date=fromKey(key);return date>=today&&people.length>=room.participantCount}).map(([key,people])=>({key,date:fromKey(key),people})).sort((a,b)=>a.key.localeCompare(b.key));
}
// Open calendars: the days most people can make, best first.
function popularDays(availability){
  return [...availability.entries()].filter(([key,people])=>{const date=fromKey(key);return people.length&&date>=today}).map(([key,people])=>({key,date:fromKey(key),people})).sort((a,b)=>b.people.length-a.people.length||a.key.localeCompare(b.key)).slice(0,10);
}
// Fixed groups of 3+: days when all but one (or two, in groups of 10) can make it.
function nearlyCount(){const count=room?.participantCount;return count!=null&&count>=3?count-Math.max(1,Math.floor(count/5)):null}
function nearDays(availability){
  const threshold=nearlyCount();if(threshold==null)return [];
  return [...availability.entries()].filter(([key,people])=>fromKey(key)>=today&&people.length>=threshold&&people.length<room.participantCount).map(([key,people])=>({key,date:fromKey(key),people})).sort((a,b)=>b.people.length-a.people.length||a.key.localeCompare(b.key)).slice(0,10);
}
function isLockedOut(){return room?.participantCount!=null&&participants().length>=room.participantCount&&!currentParticipant()}
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
  const locked=isLockedOut();
  document.body.classList.toggle('calendar-full',locked);
  profileInput.closest('.name-field').hidden=locked;
  document.querySelector('.participant-picker-label').textContent=t(locked?'calendarFullPicker':currentParticipant()?'continueAs':'orContinueAs');
  options.innerHTML=participants().map(person=>`<button class="participant-option${person.id===activeParticipantId?' selected':''}" type="button" data-participant-id="${escapeHtml(person.id)}" aria-pressed="${person.id===activeParticipantId}"><i class="person-avatar" style="--person-color:${personColor(person)}">${escapeHtml(person.name.trim().charAt(0).toUpperCase())}</i><span>${escapeHtml(person.name)}</span></button>`).join('');
  const limitMessage=document.getElementById('participantLimitMessage');
  limitMessage.hidden=!locked;limitMessage.textContent=t('calendarFull',{count:room.participantCount});
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
  const days=openAudience?popularDays(availability):commonDays(availability);
  document.getElementById('commonTabLabel').textContent=t(openAudience?'popularTab':'commonTab');
  document.getElementById('commonDaysHeading').textContent=t(openAudience?'popularHeading':'commonDaysHeading');
  const commonCount=document.getElementById('commonCount');
  const previousCount=Number(commonCount.textContent)||0;
  commonCount.textContent=days.length;commonCount.hidden=openAudience;
  commonCount.classList.toggle('has-days',days.length>0);
  // A small bump when a new common day appears, so it is noticed from the calendar view too.
  if(hasRenderedOnce&&days.length>previousCount){commonCount.classList.remove('bump');void commonCount.offsetWidth;commonCount.classList.add('bump')}

  const monthContainer=document.getElementById('months');
  const previousAvatarRects=new Map([...monthContainer.querySelectorAll('.day .initials i[data-avatar-key]')].map(avatar=>[avatar.dataset.avatarKey,avatarLayoutPosition(avatar)]));
  monthContainer.replaceChildren();
  for(let offset=0;offset<monthsShown;offset++){
    const visibleMonth=new Date(firstMonth.getFullYear(),firstMonth.getMonth()+offset,1);
    const section=document.createElement('section');section.className=`month-section${newMonthsFrom!=null&&offset>=newMonthsFrom?' month-enter':''}`;
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
        const popElapsed=reduceMotion?null:avatarPopElapsed(avatarKey,renderedAvatarKeys.has(avatarKey),renderTime);
        const popping=popElapsed!=null;
        return `<i${popping?' class="avatar-pop"':''} data-avatar-key="${avatarKey}" title="${escapeHtml(person.name)}" style="--person-color:${personColor(person)};--stack-order:${index}${popping?`;--pop-delay:-${popElapsed}ms`:''}">${escapeHtml(person.name.trim().charAt(0).toUpperCase())}</i>`;
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
      if(pendingVotes.has(key))button.classList.add('pending');if(awaitingName?.keys.includes(key))button.classList.add('awaiting-name');grid.appendChild(button);
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
  newMonthsFrom=null;
  document.getElementById('moreMonths').hidden=monthsShown>=MAX_MONTHS;
  animateAvatarReflow(monthContainer,previousAvatarRects);
  if(drag.active)paintDragRange();

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
  renderCommonDays(commonContainer,days,openAudience,openAudience?[]:nearDays(availability));
  setActiveView(activeView);

  renderedAvatarKeys=nextAvatarKeys;
  renderedAvatarPeople=nextAvatarPeople;
  renderedAvatarStackOrders=nextAvatarStackOrders;
  renderedCompleteDayKeys=nextCompleteDayKeys;
  hasRenderedOnce=true;
}

function preferenceLabel(person,key){return (person.preferredDates||[]).includes(key)?`${person.name} — ${t('preferredDay')}`:person.name}
function renderCommonDays(container,days,openAudience,near=[]){
  const signature=JSON.stringify([currentLanguage(),openAudience,activeParticipantId,[...days,{key:'near'},...near].map(({key,people=[]})=>[key,people.map(person=>[person.id,person.name,personColor(person)])])]);
  // Same days and people as last time: only patch preference state, so the dot animation is never interrupted.
  if(signature===commonListSignature){
    for(const {key,people} of [...days,...near]){
      const article=container.querySelector(`[data-common-date="${key}"]`);if(!article)continue;
      for(const person of people){
        const wrap=article.querySelector(`[data-person-id="${CSS.escape(person.id)}"]`);if(!wrap)continue;
        wrap.classList.toggle('preferred',(person.preferredDates||[]).includes(key));
        wrap.title=preferenceLabel(person,key);
      }
      const mine=people.some(person=>person.id===activeParticipantId&&(person.preferredDates||[]).includes(key));
      const button=article.querySelector('[data-prefer-date]');
      button.classList.toggle('active',mine);button.setAttribute('aria-pressed',String(mine));button.disabled=pendingPreferences.has(key);
      button.querySelector('.material-symbols-rounded').textContent=mine?'check':'';
      button.querySelector('span:last-child').textContent=t(mine?'preferredDay':'preferDay');
    }
    return;
  }
  commonListSignature=signature;
  if(!days.length&&!near.length){
    container.innerHTML=`<div class="common-empty"><span class="empty-icon material-symbols-rounded" aria-hidden="true">${openAudience?'how_to_vote':'event_available'}</span><strong>${escapeHtml(t(openAudience?'noVotes':'noCommon'))}</strong><p>${escapeHtml(t(openAudience?'noVotesHint':'noCommonHint'))}</p></div>`;
    return;
  }
  const dayRow=({key,date,people},nearly=false)=>{
    const weekday=new Intl.DateTimeFormat(locale(),{weekday:'short'}).format(date).replace('.','');
    const month=new Intl.DateTimeFormat(locale(),{month:'short'}).format(date).replace('.','');
    const shown=people.slice(0,openAudience?6:10);
    const avatars=shown.map(person=>`<span class="common-avatar-wrap${(person.preferredDates||[]).includes(key)?' preferred':''}" data-person-id="${escapeHtml(person.id)}" title="${escapeHtml(preferenceLabel(person,key))}"><i class="common-avatar" style="--person-color:${personColor(person)}">${escapeHtml(person.name.trim().charAt(0).toUpperCase())}</i></span>`).join('')+(people.length>shown.length?`<span class="common-more">+${people.length-shown.length}</span>`:'');
    const mine=people.some(person=>person.id===activeParticipantId&&(person.preferredDates||[]).includes(key));
    const countText=openAudience?t('peopleCan',{count:people.length}):nearly?t('countOf',{available:people.length,count:room.participantCount}):'';
    const count=countText?`<span class="common-count">${escapeHtml(countText)}</span>`:'';
    const withMonth=openAudience||nearly;
    const addLabel=t('addToCalendar');
    return `<article class="common-day${withMonth?' ranked':''}${nearly?' nearly':''}" data-common-date="${key}"><div class="common-date"><span>${escapeHtml(weekday)}</span><strong>${date.getDate()}</strong>${withMonth?`<small>${escapeHtml(month)}</small>`:''}</div><span class="common-people">${count}<span class="common-avatars" aria-hidden="true">${avatars}</span></span><button class="preference-button${mine?' active':''}" type="button" data-prefer-date="${key}" aria-pressed="${mine}"${pendingPreferences.has(key)?' disabled':''}><span class="material-symbols-rounded" aria-hidden="true">${mine?'check':''}</span><span>${escapeHtml(t(mine?'preferredDay':'preferDay'))}</span></button><button class="calendar-add-button" type="button" data-ics-date="${key}" title="${escapeHtml(addLabel)}" aria-label="${escapeHtml(addLabel)}"><span class="material-symbols-rounded" aria-hidden="true">calendar_add_on</span></button></article>`;
  };
  const nearSection=near.length?`<section class="common-month common-near"><h3 class="common-near-title">${escapeHtml(t('nearlyAllHeading'))}</h3><p class="common-near-hint">${escapeHtml(t(days.length?'nearlyAllHint':'nearlyAllOnlyHint'))}</p>${near.map(day=>dayRow(day,true)).join('')}</section>`:'';
  if(openAudience){container.innerHTML=`<section class="common-month">${days.map(day=>dayRow(day)).join('')}</section>`;return}
  const fullEmpty=!days.length?`<div class="common-empty compact"><strong>${escapeHtml(t('noCommon'))}</strong></div>`:'';
  const months=new Map();
  for(const day of days){const monthName=new Intl.DateTimeFormat(locale(),{month:'long',year:'numeric'}).format(day.date);if(!months.has(monthName))months.set(monthName,[]);months.get(monthName).push(day)}
  container.innerHTML=fullEmpty+[...months].map(([monthName,monthDays])=>`<section class="common-month"><h3 class="common-month-title">${escapeHtml(monthName)}</h3>${monthDays.map(day=>dayRow(day)).join('')}</section>`).join('')+nearSection;
}
function updateShareMetadata(title){
  const description=`${title} — planera tillsammans med DayGoblin.`;
  const set=(selector,value)=>{const element=document.querySelector(selector);if(element)element.setAttribute('content',value)};
  set('meta[name="description"]',description);
  set('meta[property="og:title"]',`${title} — DayGoblin`);
  set('meta[property="og:description"]',description);
  set('meta[property="og:url"]',`${location.origin}${location.pathname}`);
  set('meta[property="og:image"]',`${location.origin}/share-card.png`);
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
  if(isLockedOut()){toast(t('calendarFullToast'));document.getElementById('participantPicker').scrollIntoView({behavior:'smooth',block:'center'});return}
  const name=profileInput.value.trim();if(!name){askName({keys:[key],available:true});return}
  clearTimeout(nameTimer);
  const existing=currentParticipant();
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
    if(error.calendarFull){pendingVoteStates.delete(key);pendingAvatarRemovals.delete(avatarRemovalKey);room.participants=room.participants.filter(person=>person.id!==activeParticipantId);toast(t('calendarFullToast'));return}
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
// Mark several days at once (drag selection). One request, optimistic like a single click.
async function setDays(keys,available){
  const name=profileInput.value.trim();
  const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const existing=currentParticipant();
  const states=new Map();
  clearTimeout(nameTimer);
  for(const key of keys){
    const state={name,available,saved:false};states.set(key,state);pendingVoteStates.set(key,state);pendingVotes.add(key);
    const removalKey=`${key}:${activeParticipantId}`;
    if(!available&&existing&&!reduceMotion){const startedAt=Date.now();pendingAvatarRemovals.set(removalKey,{person:existing,startedAt,until:startedAt+290})}else pendingAvatarRemovals.delete(removalKey);
    applyParticipantVote(room,key,state);
  }
  rememberName(name);
  try{localStorage.setItem(participantKey,activeParticipantId)}catch{}
  render();
  const markSaved=()=>{for(const [key,state] of states){applyParticipantVote(room,key,state);if(pendingVoteStates.get(key)===state){state.saved=true;if(serverHasVote(latestServerRoom,key,state))pendingVoteStates.delete(key)}}};
  try{await api.saveVotes(roomSlug,activeParticipantId,name,keys,available);markSaved()}
  catch(error){
    if(error.offlineQueued){markSaved();toast(t('offlineSaved'));return}
    for(const [key,state] of states){if(pendingVoteStates.get(key)===state)pendingVoteStates.delete(key);pendingAvatarRemovals.delete(`${key}:${activeParticipantId}`)}
    try{room=applyPendingPreferences(applyPendingVotes(await api.getCalendar(roomSlug)))}catch{}
    toast(t(error.calendarFull?'calendarFullToast':error instanceof TypeError||/fetch|network/i.test(error.message)?'saveError':'saveErrorShort'));
  }finally{for(const key of keys)pendingVotes.delete(key);render()}
}

// Drag across days to mark a whole range. Mouse: press and drag. Touch: hold briefly, then drag (a quick swipe still scrolls).
const LONG_PRESS_MS=320;
const drag={pointerId:null,pointerType:'',startKey:null,currentKey:null,startX:0,startY:0,timer:null,active:false,available:true,suppressClick:false};
function dayKeyAt(x,y){const day=document.elementFromPoint(x,y)?.closest?.('.day[data-date]');return day&&!day.disabled?day.dataset.date:null}
function dragRangeKeys(){
  if(!drag.startKey||!drag.currentKey)return [];
  const [from,to]=[drag.startKey,drag.currentKey].sort();
  const keys=[];for(let date=fromKey(from);dateKey(date)<=to;date.setDate(date.getDate()+1)){const key=dateKey(date);if(date>=today&&date<visibleDateEnd())keys.push(key)}
  return keys;
}
function paintDragRange(){
  const range=new Set(dragRangeKeys());
  document.body.classList.toggle('drag-selecting',drag.active);
  document.body.classList.toggle('drag-removing',drag.active&&!drag.available);
  for(const day of document.querySelectorAll('#months .day[data-date]'))day.classList.toggle('drag-range',drag.active&&range.has(day.dataset.date));
}
function resetDrag(){clearTimeout(drag.timer);Object.assign(drag,{pointerId:null,startKey:null,currentKey:null,timer:null,active:false});paintDragRange()}
function startDrag(){
  // Same checks as a single click, before anything lights up.
  if(isLockedOut()){toast(t('calendarFullToast'));resetDrag();return}
  drag.active=true;drag.currentKey=drag.startKey;
  drag.available=!(currentParticipant()?.dates||[]).includes(drag.startKey);
  if(drag.pointerType!=='mouse')navigator.vibrate?.(8);
  paintDragRange();
}
function finishDrag(){
  const keys=dragRangeKeys(),available=drag.available;
  const mine=new Set(currentParticipant()?.dates||[]);
  const changed=keys.filter(key=>mine.has(key)!==available&&!pendingVotes.has(key));
  drag.suppressClick=true;resetDrag();
  if(!changed.length)return;
  if(!profileInput.value.trim()){askName({keys:changed,available});return}
  setDays(changed,available);
}
const monthsElement=document.getElementById('months');
monthsElement.addEventListener('pointerdown',event=>{
  if(event.pointerType==='mouse'&&event.button!==0)return;
  const key=event.target.closest?.('.day[data-date]:not(:disabled)')?.dataset.date;if(!key||!room)return;
  resetDrag();drag.suppressClick=false;
  Object.assign(drag,{pointerId:event.pointerId,pointerType:event.pointerType,startKey:key,startX:event.clientX,startY:event.clientY});
  if(event.pointerType!=='mouse')drag.timer=setTimeout(startDrag,LONG_PRESS_MS);
});
window.addEventListener('pointermove',event=>{
  if(event.pointerId!==drag.pointerId)return;
  if(!drag.active){
    const moved=Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY);
    if(drag.pointerType!=='mouse'){if(moved>10)resetDrag();return}// finger moved before the hold: it's a scroll
    if(moved<6)return;
    const key=dayKeyAt(event.clientX,event.clientY);if(!key||key===drag.startKey)return;
    startDrag();if(!drag.active)return;
  }
  const key=dayKeyAt(event.clientX,event.clientY);
  if(key&&key!==drag.currentKey){drag.currentKey=key;paintDragRange();if(drag.pointerType!=='mouse')navigator.vibrate?.(4)}
});
window.addEventListener('pointerup',event=>{if(event.pointerId!==drag.pointerId)return;if(drag.active)finishDrag();else resetDrag()});
window.addEventListener('pointercancel',event=>{if(event.pointerId===drag.pointerId)resetDrag()});
// While dragging on a touch screen the page must not scroll.
monthsElement.addEventListener('touchmove',event=>{if(drag.active||drag.timer)event.cancelable&&drag.active&&event.preventDefault()},{passive:false});
monthsElement.addEventListener('contextmenu',event=>{if(drag.active||drag.timer)event.preventDefault()});
// The click that ends a drag must not also toggle the last day.
monthsElement.addEventListener('click',event=>{if(drag.suppressClick){drag.suppressClick=false;event.stopPropagation();event.preventDefault()}},true);
monthsElement.addEventListener('dragstart',event=>event.preventDefault());

async function togglePreferredDay(key){
  if(pendingPreferences.has(key))return;
  const person=currentParticipant();if(!person){toast(t('chooseParticipant'));return}
  const name=profileInput.value.trim();if(!name){focusNameInput();toast(t('nameFirst'));return}
  clearTimeout(nameTimer);
  const state={participantId:activeParticipantId,name,preferred:!(person.preferredDates||[]).includes(key),saved:false};
  pendingPreferences.add(key);pendingPreferenceStates.set(key,state);applyParticipantPreference(room,key,state);render();
  try{
    await api.savePreference(roomSlug,activeParticipantId,name,key,state.preferred);
    applyParticipantPreference(room,key,state);state.saved=true;
    if(serverHasPreference(latestServerRoom,key,state))pendingPreferenceStates.delete(key);
  }catch(error){
    if(error.offlineQueued){applyParticipantPreference(room,key,state);state.saved=true;toast(t('offlineSaved'));return}
    try{
      const fresh=await api.getCalendar(roomSlug);latestServerRoom=fresh;
      if(serverHasPreference(fresh,key,state)){room=fresh;applyParticipantPreference(room,key,state);state.saved=true;pendingPreferenceStates.delete(key)}
      else{pendingPreferenceStates.delete(key);toast(t(error instanceof TypeError||/fetch|network/i.test(error.message)?'saveError':'saveErrorShort'))}
    }catch{pendingPreferenceStates.delete(key);toast(t('saveError'))}
  }finally{pendingPreferences.delete(key);render()}
}

async function refreshRoom(){room=await api.getCalendar(roomSlug);render()}
function roomSignature(value){
  if(!value)return '';
  return JSON.stringify([value.title,value.participantCount,(value.participants||[]).map(person=>[person.id,person.name,person.colorIndex,person.createdAt,[...person.dates].sort(),[...(person.preferredDates||[])].sort()])]);
}
function connectLive(){
  source=api.subscribe(roomSlug,updated=>{
    latestServerRoom=updated;
    const nextRoom=applyPendingPreferences(applyPendingVotes(updated));
    const changed=roomSignature(room)!==roomSignature(nextRoom);
    room=nextRoom;
    if(changed)render();
  },()=>{});
  api.onConnectionChange?.(online=>document.body.classList.toggle('connection-paused',!online));
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
function chooseParticipant(person){
  activeParticipantId=person.id;
  try{localStorage.setItem(participantKey,activeParticipantId)}catch{}
  profileInput.value=person.name;rememberName(person.name);clearTimeout(nameTimer);render();profileInput.blur();
}
// Tap first, name after: the tapped days wait (shown pink) while a sheet asks for a name, then they are saved.
const nameDialog=document.getElementById('nameDialog');
const nameDialogInput=document.getElementById('nameDialogInput');
const nameDialogError=document.getElementById('nameDialogError');
let awaitingName=null;
function keepSheetAboveKeyboard(){
  const viewport=window.visualViewport;if(!viewport||!nameDialog.open)return;
  const hidden=Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop);
  nameDialog.style.marginBottom=window.matchMedia('(max-width:640px)').matches?`${hidden}px`:'';
}
window.visualViewport?.addEventListener('resize',keepSheetAboveKeyboard);
window.visualViewport?.addEventListener('scroll',keepSheetAboveKeyboard);
function askName(action){
  awaitingName=action;render();
  nameDialogInput.value='';nameDialogError.hidden=true;nameDialogInput.removeAttribute('aria-invalid');
  document.getElementById('nameDialogTitle').textContent=t('nameSheetTitle');
  document.getElementById('nameDialogBody').textContent=t('nameSheetBody');
  nameDialogInput.placeholder=t('name');
  document.getElementById('nameDialogDone').textContent=t('nameSheetDone');
  document.getElementById('nameDialogCancel').textContent=t('nameSheetCancel');
  const people=participants();
  document.getElementById('nameDialogPeople').hidden=!people.length;
  document.getElementById('nameDialogPeopleLabel').textContent=t('orContinueAs');
  document.getElementById('nameDialogOptions').innerHTML=people.map(person=>`<button class="participant-option" type="button" data-sheet-participant="${escapeHtml(person.id)}"><i class="person-avatar" style="--person-color:${personColor(person)}">${escapeHtml(person.name.trim().charAt(0).toUpperCase())}</i><span>${escapeHtml(person.name)}</span></button>`).join('');
  if(typeof nameDialog.showModal==='function')nameDialog.showModal();
  keepSheetAboveKeyboard();
  try{nameDialogInput.focus({preventScroll:true})}catch{nameDialogInput.focus()}
}
function closeNameSheet(){
  nameDialog.classList.add('closing');
  setTimeout(()=>{nameDialog.classList.remove('closing');nameDialog.style.marginBottom='';if(nameDialog.open)nameDialog.close()},180);
}
function runAwaitingAction(){
  const action=awaitingName;awaitingName=null;if(!action){render();return}
  const mine=new Set(currentParticipant()?.dates||[]);
  if(action.keys.length===1){toggleDate(action.keys[0]);return}
  const changed=action.keys.filter(key=>mine.has(key)!==action.available&&!pendingVotes.has(key));
  if(changed.length)setDays(changed,action.available);else render();
}
document.getElementById('nameDialogForm').addEventListener('submit',event=>{
  event.preventDefault();
  const name=nameDialogInput.value.trim();
  if(!name){nameDialogError.textContent=t('nameRequired');nameDialogError.hidden=false;nameDialogInput.setAttribute('aria-invalid','true');nameDialogInput.focus();return}
  profileInput.value=name;rememberName(name);
  closeNameSheet();runAwaitingAction();
});
nameDialogInput.addEventListener('input',()=>{nameDialogError.hidden=true;nameDialogInput.removeAttribute('aria-invalid')});
document.getElementById('nameDialogOptions').addEventListener('click',event=>{
  const option=event.target.closest('[data-sheet-participant]');if(!option)return;
  const person=participants().find(item=>item.id===option.dataset.sheetParticipant);if(!person)return;
  closeNameSheet();chooseParticipant(person);runAwaitingAction();
});
function cancelNameSheet(){awaitingName=null;closeNameSheet();render()}
document.getElementById('nameDialogCancel').addEventListener('click',cancelNameSheet);
nameDialog.addEventListener('click',event=>{if(event.target===nameDialog)cancelNameSheet()});
nameDialog.addEventListener('cancel',event=>{event.preventDefault();cancelNameSheet()});

// Full calendar and this browser doesn't know who you are: confirm before taking over someone's name.
const identityDialog=document.getElementById('identityDialog');
let identityCandidate=null;
function askIdentity(person){
  identityCandidate=person;
  const count=person.dates.filter(date=>fromKey(date)>=today).length;
  const avatar=document.getElementById('identityAvatar');avatar.textContent=person.name.trim().charAt(0).toUpperCase();avatar.style.setProperty('--person-color',personColor(person));
  document.getElementById('identityTitle').textContent=t('confirmIdentityTitle',{name:person.name});
  document.getElementById('identityBody').textContent=t(count?(count===1?'confirmIdentityBodyOne':'confirmIdentityBody'):'confirmIdentityBodyNone',{name:person.name,count});
  document.getElementById('identityYes').textContent=t('confirmIdentityYes',{name:person.name});
  document.getElementById('identityNo').textContent=t('confirmIdentityNo');
  if(typeof identityDialog.showModal==='function')identityDialog.showModal();else if(confirm(t('confirmIdentityTitle',{name:person.name})))chooseParticipant(person);
}
function closeIdentity(){identityDialog.classList.add('closing');setTimeout(()=>{identityDialog.classList.remove('closing');if(identityDialog.open)identityDialog.close()},180)}
document.getElementById('identityYes').addEventListener('click',()=>{const person=identityCandidate;closeIdentity();if(person)chooseParticipant(person)});
document.getElementById('identityNo').addEventListener('click',closeIdentity);
identityDialog.addEventListener('click',event=>{if(event.target===identityDialog)closeIdentity()});
identityDialog.addEventListener('cancel',event=>{event.preventDefault();closeIdentity()});
document.getElementById('participantOptions').addEventListener('click',event=>{
  const option=event.target.closest('[data-participant-id]');if(!option)return;
  const person=participants().find(item=>item.id===option.dataset.participantId);if(!person)return;
  if(isLockedOut())askIdentity(person);else chooseParticipant(person);
});
// Sticky tabs: a shadow while stuck, and switching view while stuck jumps to the top of the new view.
const viewTabs=document.getElementById('viewTabs');
const viewTabsSentinel=document.getElementById('viewTabsSentinel');
function tabsAreStuck(){return viewTabsSentinel.getBoundingClientRect().bottom<0}
if('IntersectionObserver' in window)new IntersectionObserver(([entry])=>viewTabs.classList.toggle('is-stuck',!entry.isIntersecting&&entry.boundingClientRect.top<0)).observe(viewTabsSentinel);
function switchView(view){
  const wasStuck=tabsAreStuck();
  setActiveView(view);
  if(wasStuck){const top=viewTabsSentinel.getBoundingClientRect().top+window.scrollY-8;window.scrollTo({top,behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}
}
document.getElementById('calendarTab').addEventListener('click',()=>switchView('calendar'));
document.getElementById('commonTab').addEventListener('click',()=>switchView('common'));
document.getElementById('commonDays').addEventListener('click',event=>{
  const prefer=event.target.closest('[data-prefer-date]');if(prefer){togglePreferredDay(prefer.dataset.preferDate);return}
  const add=event.target.closest('[data-ics-date]');if(add)addDayToCalendar(add.dataset.icsDate);
});
// Add one all-day event to the person's own calendar, without handing them a file.
// iPhone/iPad: a calendar link that iOS opens straight in Calendar. Android: the phone's default calendar app.
// Computers: a small menu (Google, Outlook, and Apple on Mac), since browsers can't open the default calendar directly.
const calendarDialog=document.getElementById('calendarDialog');
let calendarDay=null;
const isAppleMobile=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const isAndroid=/Android/i.test(navigator.userAgent);
const isMac=/Macintosh|Mac OS X/.test(navigator.userAgent)&&!isAppleMobile;
function eventDetails(key){
  const start=fromKey(key),end=new Date(start);end.setDate(end.getDate()+1);
  const url=`${location.origin}/${roomSlug}`;
  return {title:room?.title||'DayGoblin',description:`${t('icsDescription')} ${url}`,startKey:key,endKey:dateKey(end),compactStart:key.replaceAll('-',''),compactEnd:dateKey(end).replaceAll('-','')};
}
function appleCalendarUrl(key){const e=eventDetails(key);return `${location.origin}/api/ics?${new URLSearchParams({slug:roomSlug,date:key,title:e.title,lang:currentLanguage()})}`}
function googleCalendarUrl(key){const e=eventDetails(key);return `https://calendar.google.com/calendar/render?${new URLSearchParams({action:'TEMPLATE',text:e.title,dates:`${e.compactStart}/${e.compactEnd}`,details:e.description})}`}
function outlookCalendarUrl(key){const e=eventDetails(key);return `https://outlook.live.com/calendar/0/deeplink/compose?${new URLSearchParams({path:'/calendar/action/compose',rru:'addevent',subject:e.title,startdt:e.startKey,enddt:e.endKey,allday:'true',body:e.description})}`}
function androidCalendarUrl(key){
  const e=eventDetails(key);const [y,m,d]=key.split('-').map(Number);
  const begin=Date.UTC(y,m-1,d),finish=Date.UTC(y,m-1,d+1),enc=encodeURIComponent;
  return `intent:#Intent;action=android.intent.action.INSERT;type=vnd.android.cursor.item/event;S.title=${enc(e.title)};S.description=${enc(e.description)};l.beginTime=${begin};l.endTime=${finish};B.allDay=true;S.browser_fallback_url=${enc(googleCalendarUrl(key))};end`;
}
function addDayToCalendar(key){
  if(isAppleMobile){location.href=appleCalendarUrl(key);return}
  if(isAndroid){location.href=androidCalendarUrl(key);return}
  calendarDay=key;
  document.getElementById('calendarDialogTitle').textContent=t('addToCalendarTitle');
  document.getElementById('calendarDialogBody').textContent=new Intl.DateTimeFormat(locale(),{weekday:'long',day:'numeric',month:'long'}).format(fromKey(key));
  document.getElementById('calendarDialogApple').hidden=!isMac;
  document.getElementById('calendarDialogCancel').textContent=t('nameSheetCancel');
  if(typeof calendarDialog.showModal==='function')calendarDialog.showModal();else window.open(googleCalendarUrl(key),'_blank','noopener');
}
function closeCalendarDialog(){calendarDialog.classList.add('closing');setTimeout(()=>{calendarDialog.classList.remove('closing');if(calendarDialog.open)calendarDialog.close()},180)}
calendarDialog.addEventListener('click',event=>{
  const choice=event.target.closest('[data-calendar]');
  if(choice&&calendarDay){
    const key=calendarDay,kind=choice.dataset.calendar;closeCalendarDialog();
    if(kind==='apple')location.href=appleCalendarUrl(key);
    else window.open(kind==='google'?googleCalendarUrl(key):outlookCalendarUrl(key),'_blank','noopener');
    return;
  }
  if(event.target===calendarDialog||event.target.id==='calendarDialogCancel')closeCalendarDialog();
});
calendarDialog.addEventListener('cancel',event=>{event.preventDefault();closeCalendarDialog()});
document.getElementById('moreMonths').addEventListener('click',()=>{
  // The new months appear where the button was, so the page does not jump.
  newMonthsFrom=monthsShown;monthsShown=Math.min(MAX_MONTHS,monthsShown+MONTH_STEP);render();
});
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
      ensureMonthsCoverMarkedDays();
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

