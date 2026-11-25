import { api, startupError } from './data.js';
import { currentLanguage, t } from './i18n.js?v=6';

const form=document.getElementById('createForm');
const countInput=document.getElementById('participantCountInput');
const countStepButtons=[...document.querySelectorAll('[data-count-step]')];
const openInput=document.getElementById('openAudience');
const purposeInput=document.getElementById('purposeInput');
const purposeExample=document.getElementById('purposeExample');
const submitButton=document.getElementById('createButton');
const formError=document.getElementById('formError');
const toast=document.getElementById('toast');
const titleExamples={
  sv:['Repa med bandet','Nästa dag för bokklubb','Den där vinkvällen','Middag hos oss','Utflykt med familjen','Spelkväll'],
  en:['Band rehearsal','Book club','Wine night','Sunday dinner','A family day out','Friday game night']
};
const titlePrefixes={sv:'Till exempel:',en:'For example:'};
let exampleIndex=0;
let placeholderTimer;
function cycleTitlePlaceholder(){
  if(!purposeInput||purposeInput.value||document.activeElement===purposeInput)return;
  const examples=titleExamples[currentLanguage()==='en'?'en':'sv'];
  purposeExample.classList.add('fading');
  setTimeout(()=>{
    purposeExample.classList.remove('fading');
    if(purposeInput.value)return;
    exampleIndex=(exampleIndex+1)%examples.length;
    purposeExample.textContent=examples[exampleIndex];
  },300);
}
if(purposeInput){
  const language=currentLanguage()==='en'?'en':'sv';
  const purposeWrap=purposeInput.closest('.purpose-input-wrap');
  purposeWrap.dataset.prefix=titlePrefixes[language];
  purposeWrap.classList.toggle('has-value',Boolean(purposeInput.value));
  purposeExample.textContent=titleExamples[language][0];
  exampleIndex=0;
  placeholderTimer=setInterval(cycleTitlePlaceholder,4200);
  purposeInput.addEventListener('focus',()=>purposeInput.classList.remove('placeholder-fading'));
  document.addEventListener('daybuddy-language-change',()=>{
    const language=currentLanguage()==='en'?'en':'sv';
    exampleIndex=0;
    purposeInput.closest('.purpose-input-wrap').dataset.prefix=titlePrefixes[language];
    purposeExample.textContent=titleExamples[language][0];
  });
}
function showError(key){formError.dataset.translationKey=key;formError.textContent=t(key)}
function syncToastPosition(){
  if(!toast||!window.visualViewport)return;
  let baseTop=Number(toast.dataset.baseTop);
  if(!Number.isFinite(baseTop)||baseTop<=0){baseTop=parseFloat(getComputedStyle(toast).top)||12;toast.dataset.baseTop=String(baseTop)}
  toast.style.top=`${window.visualViewport.offsetTop+baseTop}px`;
}
if(window.visualViewport){
  window.visualViewport.addEventListener('resize',syncToastPosition);
  window.visualViewport.addEventListener('scroll',syncToastPosition);
  window.addEventListener('scroll',syncToastPosition,{passive:true});
}
function focusField(input){
  try{input.focus({preventScroll:true})}catch{input.focus()}
  setTimeout(()=>input.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'}),250);
}
function showToast(message){
  toast.textContent=message;
  syncToastPosition();
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer=setTimeout(()=>toast.classList.remove('show'),2600);
}
document.addEventListener('daybuddy-language-change',()=>{
  if(formError.dataset.translationKey)formError.textContent=t(formError.dataset.translationKey);
  if(submitButton.disabled)submitButton.querySelector('[data-i18n]').textContent=t('creating');
});

purposeInput.addEventListener('input',()=>{
  purposeInput.closest('.purpose-input-wrap').classList.toggle('has-value',Boolean(purposeInput.value));
  formError.textContent='';delete formError.dataset.translationKey;
  purposeInput.removeAttribute('aria-invalid');
});

function updateCountSteppers(){
  const value=Number(countInput.value);
  countStepButtons.forEach(button=>{
    const step=Number(button.dataset.countStep);
    button.disabled=openInput.checked||!Number.isFinite(value)||(step<0?value<=2:value>=10);
  });
}
countInput.addEventListener('input',()=>{countInput.removeAttribute('aria-invalid');updateCountSteppers()});
countInput.addEventListener('change',()=>{
  const value=Number(countInput.value);
  countInput.value=String(!Number.isFinite(value)||countInput.value===''?2:Math.max(2,Math.min(10,value)));
  updateCountSteppers();
});
countStepButtons.forEach(button=>button.addEventListener('click',()=>{
  const current=Number(countInput.value);
  const step=Number(button.dataset.countStep);
  countInput.value=String(Math.max(2,Math.min(10,(Number.isFinite(current)?current:2)+step)));
  countInput.dispatchEvent(new Event('input',{bubbles:true}));
}));
updateCountSteppers();

openInput.addEventListener('change',()=>{
  countInput.disabled=openInput.checked;
  countInput.setAttribute('aria-disabled',String(openInput.checked));
  updateCountSteppers();
});

form.addEventListener('submit',async event=>{
  event.preventDefault();formError.textContent='';delete formError.dataset.translationKey;
  const purpose=purposeInput.value.trim();
  const participantCount=openInput.checked?null:Number(countInput.value);
  if(!purpose){purposeInput.setAttribute('aria-invalid','true');focusField(purposeInput);showToast(t('requiredTitle'));return}
  if(participantCount!==null&&(!Number.isInteger(participantCount)||participantCount<2||participantCount>10)){
    countInput.setAttribute('aria-invalid','true');focusField(countInput);showToast(t('invalidCount'));return;
  }
  if(startupError){showError('databaseUnavailable');return}
  submitButton.disabled=true;submitButton.querySelector('[data-i18n]').textContent=t('creating');
  try{
    const result=await api.createCalendar(purpose,participantCount);
    location.href=`/${encodeURIComponent(result.slug)}?lang=${currentLanguage()}`;
  }catch(error){
    if(error.message==='Failed to fetch')showError('serverUnavailable');
    else if(error.message==='Kalenderlänken krockade. Försök igen.')showError('slugCollision');
    else if(error.message==='Kalendernamnet kunde inte skapas.')showError('slugWordsUnavailable');
    else showError('createFailure');
    submitButton.disabled=false;submitButton.querySelector('[data-i18n]').textContent=t('createButton');
  }
});

