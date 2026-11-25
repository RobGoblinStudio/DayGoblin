const LANGUAGE_KEY='daybuddy-language';
const translations={
  sv:{
    homeTitle:'DayGoblin — hitta en dag tillsammans',createTitle:'Skapa kalender — DayGoblin',
    homeAria:'DayGoblin startsida',createCalendar:'Skapa en kalender',availabilityCalendar:'Tillgänglighetskalender',calendarView:'Kalendervy',respondersAria:'Personer som har svarat',
    homeHeadline:'Hitta en dag',homeHeadlineAccent:'som passar alla.',
    stepsLabel:'Så fungerar DayGoblin',step1Title:'Ge kalendern ett namn',step1Copy:'Skriv vad ni vill planera, till exempel middag eller utflykt',step2Title:'Dela med gruppen',step2Copy:'Dela länken. Alla skriver sitt namn och markerar dagarna de kan',step3Title:'Välj datum',step3Copy:'Se vilka dagar alla kan, eller vilka dagar flest kan',
    createHeadline:'Skapa er',createHeadlineAccent:'egen kalender.',createIntro:'Namnge kalendern och ange hur många som ska vara med.',
    calendarName:'Namnge kalender',calendarPlaceholder:'Till exempel: Repa med bandet',participantCount:'Hur många ska vara med?',openCount:'Öppet antal',openCountHint:'För större grupper. Se vilka dagar flest kan.',decreaseParticipants:'Minska antal deltagare',increaseParticipants:'Öka antal deltagare',createButton:'Skapa kalender',creating:'Skapar kalender…',createNote:'Du får en egen länk att dela med gruppen.',createFailure:'Kalendern kunde inte skapas. Försök igen.',
    requiredTitle:'Namnge kalendern innan du fortsätter.',invalidCount:'Välj minst 2 och högst 10 personer.',databaseUnavailable:'DayGoblin kunde inte ansluta till sin databas just nu. Försök igen om en stund.',serverUnavailable:'Det gick inte att nå DayGoblin-servern. Starta servern och försök igen.',slugCollision:'Kalenderlänken krockade. Försök igen.',slugWordsUnavailable:'Kalendernamnet kunde inte skapas.',
    share:'Dela länken',shareAria:'Dela kalenderlänken',calendarTab:'Kalender',commonTab:'Gemensamma dagar',
    calendarLoading:'Laddar kalender…',roomType:'DELBAR KALENDER',openRoomType:'ÖPPEN DAGSRÖSTNING',
    instructions:'Skriv ditt namn och markera dagarna du kan.',openInstructions:'Markera dagarna du kan. Fler röster syns med starkare färg.',
    name:'Ditt namn',newParticipantName:'Ny deltagare',peoplePrefix:'Vi är',peopleSuffix:'personer',respondersHeading:'Har svarat',continueAs:'Fortsätt som',calendarFull:'Kalendern är full. Välj ett namn ovan för att fortsätta.',
    loadError:'Kalendern kunde inte laddas',loadErrorHint:'Kontrollera anslutningen och försök igen.',retry:'Försök igen',
    commonDaysHeading:'Alla kan ses',noCommon:'Inga gemensamma dagar ännu',noCommonHint:'När alla har markerat samma datum visas det här.',
    responded:'har svarat',noRespondents:'Ingen har svarat än. Markera minst en dag för att synas här.',
    can:'kan',votes:'röster',vote:'röst',youSelected:'du har markerat',dayCount:'{available} av {count} kan',dayLabel:'{day} {month}, {availability}{selected}',responseCount:'{answered} av {count}',
    everyoneAvailable:'Alla kan',respondedCount:'har röstat',preferDay:'Föredrar',preferredDay:'Föredragen',chooseParticipant:'Välj ditt namn i listan ovan först.',
    nameFirst:'Skriv ditt namn först.',saveError:'Ändringen kunde inte sparas. Kontrollera anslutningen och försök igen.',saveErrorShort:'Ändringen kunde inte sparas. Försök igen.',
    offlineSaved:'Sparad på den här enheten. Synkas när anslutningen är tillbaka.',copied:'Länken är kopierad.',copyLinkPrompt:'Kopiera länken till din kalender:',
    languageLabel:'Språk',
  },
  en:{
    homeTitle:'DayGoblin — find a day that works',createTitle:'Create a calendar — DayGoblin',
    homeAria:'DayGoblin home',createCalendar:'Create a calendar',availabilityCalendar:'Availability calendar',calendarView:'Calendar view',respondersAria:'People who have responded',
    homeHeadline:'Find a day',homeHeadlineAccent:'that works for everyone.',
    stepsLabel:'How DayGoblin works',step1Title:'Name your calendar',step1Copy:'Name what you’re planning, like dinner or a day trip',step2Title:'Share it with your group',step2Copy:'Share the link. Everyone adds their name and marks when they’re free',step3Title:'Pick a date',step3Copy:'See when everyone is free, or which days work for most people',
    createHeadline:'Create your',createHeadlineAccent:'own calendar.',createIntro:'Name your calendar and choose how many people are joining.',
    calendarName:'Name your calendar',calendarPlaceholder:'For example: Band rehearsal',participantCount:'How many people are joining?',openCount:'Any number',openCountHint:'For larger groups. See which days work for most people.',decreaseParticipants:'Decrease participant count',increaseParticipants:'Increase participant count',createButton:'Create calendar',creating:'Creating calendar…',createNote:'You’ll get a link to share with your group.',createFailure:'Couldn’t create the calendar. Please try again.',
    requiredTitle:'Please name your calendar to continue.',invalidCount:'Choose at least 2 and no more than 10 people.',databaseUnavailable:'DayGoblin couldn’t connect to its database. Please try again shortly.',serverUnavailable:'Couldn’t reach the DayGoblin server. Please start the server and try again.',slugCollision:'That calendar link was already taken. Please try again.',slugWordsUnavailable:'Couldn’t create a calendar link right now.',
    share:'Share link',shareAria:'Share calendar link',calendarTab:'Calendar',commonTab:'Everyone’s free',
    calendarLoading:'Loading calendar…',roomType:'SHARED CALENDAR',openRoomType:'OPEN AVAILABILITY',
    instructions:'Enter your name and mark the days you’re free.',openInstructions:'Mark the days you’re free. More votes appear in a stronger color.',
    name:'Your name',newParticipantName:'New participant',peoplePrefix:'Group:',peopleSuffix:'people',respondersHeading:'Responses',continueAs:'Continue as',calendarFull:'This calendar is full. Choose a name above to continue.',
    loadError:'Calendar couldn’t be loaded',loadErrorHint:'Check your connection and try again.',retry:'Try again',
    commonDaysHeading:'Everyone’s free',noCommon:'No shared days yet',noCommonHint:'Days everyone selects will show up here.',
    responded:'has responded',noRespondents:'No responses yet. Mark at least one day to appear here.',
    can:'available',votes:'votes',vote:'vote',youSelected:'selected by you',dayCount:'{available} of {count} available',dayLabel:'{month} {day}, {availability}{selected}',responseCount:'{answered} of {count}',
    everyoneAvailable:'Everyone’s free',respondedCount:'responded',preferDay:'Prefer',preferredDay:'Preferred',chooseParticipant:'Choose your name from the list above first.',
    nameFirst:'Enter your name first.',saveError:'Couldn’t save that change. Check your connection and try again.',saveErrorShort:'Couldn’t save that change. Please try again.',
    offlineSaved:'Saved on this device. It’ll sync when you’re back online.',copied:'Link copied.',copyLinkPrompt:'Copy your calendar link:',
    languageLabel:'Language',
  }
};

let activeLanguage;
function readLanguage(){
  const fromUrl=new URLSearchParams(location.search).get('lang');
  if(fromUrl==='en'||fromUrl==='sv')return fromUrl;
  try{const saved=localStorage.getItem(LANGUAGE_KEY);if(saved==='en'||saved==='sv')return saved}catch{}
  return 'sv';
}
export function currentLanguage(){return activeLanguage||readLanguage()}
export function t(key,values={}){
  let value=translations[currentLanguage()][key]??translations.sv[key]??key;
  for(const [name,replacement] of Object.entries(values))value=value.replaceAll(`{${name}}`,String(replacement));
  return value;
}
export function locale(){return currentLanguage()==='en'?'en-GB':'sv-SE'}
function applyStaticTranslations(){
  const lang=currentLanguage();
  document.documentElement.lang=lang;
  document.title=t(document.body.classList.contains('create-page')?'createTitle':document.body.classList.contains('calendar-page')?'calendarLoading':'homeTitle');
  document.querySelectorAll('[data-i18n]').forEach(element=>{element.textContent=t(element.dataset.i18n)});
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element=>{element.setAttribute('placeholder',t(element.dataset.i18nPlaceholder))});
  document.querySelectorAll('[data-i18n-aria]').forEach(element=>{element.setAttribute('aria-label',t(element.dataset.i18nAria))});
  document.querySelectorAll('[data-language]').forEach(button=>{
    const selected=button.dataset.language===lang;
    button.classList.toggle('active',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
  document.querySelectorAll('[data-language-link]').forEach(link=>{
    const url=new URL(link.href,location.href);url.searchParams.set('lang',lang);link.href=url.pathname+url.search+url.hash;
  });
}
export function setLanguage(lang){
  if(!translations[lang])return;
  activeLanguage=lang;
  try{localStorage.setItem(LANGUAGE_KEY,lang)}catch{}
  const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(history.state,'',url.pathname+url.search+url.hash);
  applyStaticTranslations();
  document.dispatchEvent(new CustomEvent('daybuddy-language-change',{detail:{language:lang}}));
}
export function initI18n(){
  activeLanguage=readLanguage();applyStaticTranslations();
  document.querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',()=>setLanguage(button.dataset.language)));
}

initI18n();
