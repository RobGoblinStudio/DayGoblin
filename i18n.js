const LANGUAGE_KEY='daybuddy-language';
const translations={
  sv:{
    homeTitle:'DayGoblin — hitta en dag tillsammans',createTitle:'Skapa kalender — DayGoblin',
    homeAria:'DayGoblin startsida',createCalendar:'Skapa en kalender',availabilityCalendar:'Tillgänglighetskalender',calendarView:'Kalendervy',respondersAria:'Personer som har svarat',
    homeHeadline:'Hitta en dag',homeHeadlineAccent:'som passar alla.',
    stepsLabel:'Så fungerar DayGoblin',step1Title:'Skapa en kalender',step1Copy:'Ge den ett namn, till exempel middag eller utflykt, och välj hur många ni är.',step2Title:'Dela länken',step2Copy:'Alla skriver sitt namn och markerar dagarna de kan. Ingen inloggning behövs.',step3Title:'Hitta dagen',step3Copy:'Se direkt vilka dagar alla kan, eller vilka flest kan om ni är många.',
    createHeadline:'Skapa er',createHeadlineAccent:'egen kalender.',createIntro:'Namnge kalendern och ange hur många som ska vara med.',
    calendarName:'Namnge kalender',calendarPlaceholder:'Till exempel: Repa med bandet',participantCount:'Hur många ska vara med?',openCount:'Öppen för alla',openCountHint:'För stora grupper. Visar dagarna flest kan.',openCountExplainer:'Hur många som helst kan svara. I stället för dagar då alla kan lyfter kalendern fram dagarna då flest kan. Perfekt för klassträffar, föreningar och stora kompisgäng.',createButton:'Skapa kalender',creating:'Skapar kalender…',createNote:'Du får en egen länk att dela med gruppen.',createFailure:'Kalendern kunde inte skapas. Försök igen.',
    requiredTitle:'Namnge kalendern innan du fortsätter.',databaseUnavailable:'DayGoblin kunde inte ansluta till sin databas just nu. Försök igen om en stund.',serverUnavailable:'Det gick inte att nå DayGoblin-servern. Starta servern och försök igen.',slugCollision:'Kalenderlänken krockade. Försök igen.',slugWordsUnavailable:'Kalendernamnet kunde inte skapas.',
    share:'Dela länken',shareAria:'Dela kalenderlänken',calendarTab:'Kalender',commonTab:'Gemensamma dagar',
    calendarLoading:'Laddar kalender…',roomType:'DELBAR KALENDER',openRoomType:'ÖPPEN KALENDER',
    instructions:'Skriv ditt namn och markera dagarna du kan.',openInstructions:'Skriv ditt namn och markera dagarna du kan. Siffran visar hur många som kan, och ju starkare färg desto fler.',
    name:'Ditt namn',newParticipantName:'Ny deltagare',peoplePrefix:'Vi är',peopleSuffix:'personer',respondersHeading:'Har svarat',continueAs:'Fortsätt som',orContinueAs:'Eller fortsätt som',calendarFull:'Alla {count} platser är tagna. Välj ditt namn ovan för att markera dagar.',calendarFullPicker:'Kalendern är full. Vem är du?',calendarFullToast:'Kalendern är full. Välj ditt namn i listan.',
    loadError:'Kalendern kunde inte laddas',loadErrorHint:'Kontrollera anslutningen och försök igen.',retry:'Försök igen',
    commonDaysHeading:'Alla kan ses',noCommon:'Inga gemensamma dagar ännu',noCommonHint:'När alla har markerat samma dag visas den här.',popularTab:'Flest kan',popularHeading:'Dagarna flest kan',noVotes:'Inga markerade dagar ännu',noVotesHint:'När någon markerar dagar visas de populäraste här.',peopleCan:'{count} kan',
    responded:'har svarat',noRespondents:'Ingen har svarat än. Markera minst en dag för att synas här.',
    can:'kan',votes:'röster',vote:'röst',youSelected:'du har markerat',dayCount:'{available} av {count} kan',dayLabel:'{day} {month}, {availability}{selected}',responseCount:'{answered} av {count}',
    everyoneAvailable:'Alla kan',respondedCount:'har röstat',preferDay:'Föredrar',preferredDay:'Föredragen',chooseParticipant:'Välj ditt namn i listan ovan först.',
    nameSheetTitle:'Vad heter du?',nameSheetBody:'Så ser de andra vem som kan vilken dag.',nameSheetDone:'Klar',nameSheetCancel:'Avbryt',nameRequired:'Skriv ditt namn för att fortsätta.',
    confirmIdentityTitle:'Är du {name}?',confirmIdentityBody:'{name} har redan markerat {count} dagar. Fortsätt bara om det är du.',confirmIdentityBodyOne:'{name} har redan markerat en dag. Fortsätt bara om det är du.',confirmIdentityBodyNone:'{name} har inte markerat några dagar än. Fortsätt bara om det är du.',confirmIdentityYes:'Ja, jag är {name}',confirmIdentityNo:'Nej, tillbaka',
    nearlyAllHeading:'Nästan alla kan',nearlyAllHint:'Dagar då bara en eller ett par saknas.',nearlyAllOnlyHint:'Ingen dag passar alla än, men de här är nära.',countOf:'{available} av {count}',
    addToCalendar:'Lägg till i min kalender',addToCalendarTitle:'Lägg till i kalendern',icsDescription:'Planerad med DayGoblin:',showMoreMonths:'Visa tre månader till',
    dragHint:'Dra över flera dagar för att markera alla på en gång. På mobilen håller du först in en dag.',
    nameFirst:'Skriv ditt namn först.',saveError:'Ändringen kunde inte sparas. Kontrollera anslutningen och försök igen.',saveErrorShort:'Ändringen kunde inte sparas. Försök igen.',
    offlineSaved:'Sparad på den här enheten. Synkas när anslutningen är tillbaka.',copied:'Länken är kopierad.',copyLinkPrompt:'Kopiera länken till din kalender:',
    languageLabel:'Språk',
  },
  en:{
    homeTitle:'DayGoblin — find a day that works',createTitle:'Create a calendar — DayGoblin',
    homeAria:'DayGoblin home',createCalendar:'Create a calendar',availabilityCalendar:'Availability calendar',calendarView:'Calendar view',respondersAria:'People who have responded',
    homeHeadline:'Find a day',homeHeadlineAccent:'that works for everyone.',
    stepsLabel:'How DayGoblin works',step1Title:'Create a calendar',step1Copy:'Name it, like dinner or a day trip, and choose how many of you there are.',step2Title:'Share the link',step2Copy:'Everyone adds their name and marks the days they’re free. No sign-up needed.',step3Title:'Find the day',step3Copy:'See at a glance which days everyone is free, or which suit the most people in a big group.',
    createHeadline:'Create your',createHeadlineAccent:'own calendar.',createIntro:'Name your calendar and choose how many people are joining.',
    calendarName:'Name your calendar',calendarPlaceholder:'For example: Band rehearsal',participantCount:'How many people are joining?',openCount:'Open to everyone',openCountHint:'For big groups. Shows the days most people can make.',openCountExplainer:'Any number of people can answer. Instead of days when everyone is free, the calendar highlights the days that suit the most people. Great for reunions, clubs and big groups of friends.',createButton:'Create calendar',creating:'Creating calendar…',createNote:'You’ll get a link to share with your group.',createFailure:'Couldn’t create the calendar. Please try again.',
    requiredTitle:'Please name your calendar to continue.',databaseUnavailable:'DayGoblin couldn’t connect to its database. Please try again shortly.',serverUnavailable:'Couldn’t reach the DayGoblin server. Please start the server and try again.',slugCollision:'That calendar link was already taken. Please try again.',slugWordsUnavailable:'Couldn’t create a calendar link right now.',
    share:'Share link',shareAria:'Share calendar link',calendarTab:'Calendar',commonTab:'Everyone’s free',
    calendarLoading:'Loading calendar…',roomType:'SHARED CALENDAR',openRoomType:'OPEN CALENDAR',
    instructions:'Enter your name and mark the days you’re free.',openInstructions:'Enter your name and mark the days you’re free. The number shows how many can make it, and a stronger color means more people.',
    name:'Your name',newParticipantName:'New participant',peoplePrefix:'Group:',peopleSuffix:'people',respondersHeading:'Responses',continueAs:'Continue as',orContinueAs:'Or continue as',calendarFull:'All {count} spots are taken. Choose your name above to mark days.',calendarFullPicker:'This calendar is full. Who are you?',calendarFullToast:'This calendar is full. Choose your name from the list.',
    loadError:'Calendar couldn’t be loaded',loadErrorHint:'Check your connection and try again.',retry:'Try again',
    commonDaysHeading:'Everyone’s free',noCommon:'No shared days yet',noCommonHint:'Days everyone selects will show up here.',popularTab:'Most free',popularHeading:'Days most people are free',noVotes:'No days marked yet',noVotesHint:'Once people mark days, the most popular ones show up here.',peopleCan:'{count} free',
    responded:'has responded',noRespondents:'No responses yet. Mark at least one day to appear here.',
    can:'available',votes:'votes',vote:'vote',youSelected:'selected by you',dayCount:'{available} of {count} available',dayLabel:'{month} {day}, {availability}{selected}',responseCount:'{answered} of {count}',
    everyoneAvailable:'Everyone’s free',respondedCount:'responded',preferDay:'Prefer',preferredDay:'Preferred',chooseParticipant:'Choose your name from the list above first.',
    nameSheetTitle:'What’s your name?',nameSheetBody:'So the others can see who’s free when.',nameSheetDone:'Done',nameSheetCancel:'Cancel',nameRequired:'Enter your name to continue.',
    confirmIdentityTitle:'Are you {name}?',confirmIdentityBody:'{name} has already marked {count} days. Only continue if this is you.',confirmIdentityBodyOne:'{name} has already marked one day. Only continue if this is you.',confirmIdentityBodyNone:'{name} hasn’t marked any days yet. Only continue if this is you.',confirmIdentityYes:'Yes, I’m {name}',confirmIdentityNo:'No, go back',
    nearlyAllHeading:'Almost everyone',nearlyAllHint:'Days when only one or two people are missing.',nearlyAllOnlyHint:'No day works for everyone yet, but these are close.',countOf:'{available} of {count}',
    addToCalendar:'Add to my calendar',addToCalendarTitle:'Add to your calendar',icsDescription:'Planned with DayGoblin:',showMoreMonths:'Show three more months',
    dragHint:'Drag across several days to mark them all at once. On a phone, press and hold a day first.',
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
