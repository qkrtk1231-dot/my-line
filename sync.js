
/* MY LINE 4.0 - Improved Cloud Sync */
(()=>{
 const cfg=window.MYLINE_CONFIG||{};
 let client=null,session=null,revision=null,base=null;
 let timer=null,busy=false,blocked=false;
 let initialized=false,activeUser=null;
 let pending=false;

 const ready=()=>!!(
  cfg.supabaseUrl&&
  cfg.supabaseAnonKey&&
  window.supabase?.createClient
 );

 const current=()=>JSON.stringify(st);

 const clean=s=>{
  const o=JSON.parse(s);
  delete o.tab;
  delete o.search;
  delete o.filter;
  delete o.date;
  return JSON.stringify(o);
 };

 const snapshot=()=>JSON.parse(current());

 const status=msg=>{
  const el=document.getElementById('cloudStatus');
  if(el)el.textContent=msg;
 };

 const err=e=>{
  console.error('MY LINE sync',e);
  status('동기화 실패 · 로컬 기록 유지');
 };

 const isDirty=()=>base!==null&&clean(current())!==base;

 function reset(){
  clearTimeout(timer);
  revision=null;
  base=null;
  initialized=false;
  blocked=false;
  pending=false;
 }

 function handleSession(s){
  const uid=s?.user?.id||null;
  if(uid!==activeUser){
   reset();
   activeUser=uid;
  }
  session=s;

  if(!s){
   status('로그인 필요');
   return;
  }

  if(!initialized&&!blocked){
   setTimeout(()=>initial(),0);
  }
 }

 function setup(){
  if(!ready()){
   status('클라우드 설정 필요');
   return false;
  }

  if(!client){
   client=window.supabase.createClient(
    cfg.supabaseUrl,
    cfg.supabaseAnonKey,
    {
     auth:{
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:true
     }
    }
   );

   client.auth.onAuthStateChange((event,s)=>{
    handleSession(s);
   });
  }
  return true;
 }

 async function getRemote(){
  const {data,error}=await client
   .from('myline_snapshots')
   .select('payload,revision')
   .eq('user_id',session.user.id)
   .maybeSingle();

  if(error)throw error;
  return data;
 }

 function applyRemote(row){
  if(!row?.payload?.foods||
     !row.payload.logs||
     !row.payload.settings){
   throw Error('클라우드 데이터 형식 오류');
  }

  st=row.payload;
  localStorage.setItem(KEY,JSON.stringify(st));

  revision=row.revision;
  base=clean(current());
  blocked=false;
  initialized=true;
  pending=false;

  render();
  status('동기화 완료');
 }

 async function initial(){
  if(!session||busy||initialized||blocked)return;

  busy=true;
  const uid=session.user.id;

  try{
   const row=await getRemote();
   if(session?.user?.id!==uid)return;

   if(!row){
    revision=0;
    status('클라우드 기록 없음');

    if(confirm('이 기기의 MY LINE 기록을 클라우드에 처음 저장할까요?')){
     await insertFirst();
    }else{
     blocked=true;
    }
    return;
   }

   revision=row.revision;

   const localHasData=
    Object.values(st.logs||{}).some(x=>x.length)||
    (st.weights||[]).length>0;

   const localClean=clean(current());
   const remoteClean=clean(JSON.stringify(row.payload));

   if(localClean===remoteClean){
    base=remoteClean;
    initialized=true;
    blocked=false;
    status('동기화 완료');
    return;
   }

   if(localHasData){
    status('기기 기록 선택 필요');

    const choose=confirm(
     '클라우드 기록과 이 기기의 기록이 달라요.\n\n'+
     '[확인] 클라우드 기록으로 교체\n'+
     '[취소] 기기 기록 유지 및 동기화 중지\n\n'+
     '교체 전 JSON 백업을 권장합니다.'
    );

    if(!choose){
     blocked=true;
     return;
    }
    backup();
   }

   applyRemote(row);

  }catch(e){
   err(e);
  }finally{
   busy=false;
   if(initialized&&!blocked&&(pending||isDirty())){
    schedule();
   }
  }
 }

 async function insertFirst(){
  if(!session)return;

  const uid=session.user.id;
  const payload=snapshot();
  const before=clean(JSON.stringify(payload));

  const {data,error}=await client
   .from('myline_snapshots')
   .insert({
    user_id:uid,
    payload:payload
   })
   .select('revision')
   .single();

  if(error)throw error;
  if(session?.user?.id!==uid)return;

  revision=data.revision;
  base=before;
  initialized=true;
  blocked=false;

  status('첫 클라우드 저장 완료');
 }

 async function push(){
  if(!setup()||!session||blocked)return;

  if(busy){
   pending=true;
   schedule();
   return;
  }

  if(!initialized){
   await initial();
   return;
  }

  if(!isDirty()){
   pending=false;
   status('동기화 완료');
   return;
  }

  busy=true;
  pending=false;

  const uid=session.user.id;

  try{
   status('클라우드 저장 중...');

   const remote=await getRemote();
   if(session?.user?.id!==uid)return;

   if(!remote){
    blocked=true;
    status('클라우드 기록 없음 · 확인 필요');
    return;
   }

   if(remote.revision!==revision){
    blocked=true;
    status('다른 기기 변경 감지 · 동기화 중지');

    alert(
     '다른 기기에서 기록이 변경됐어요.\n'+
     '현재 기기 기록은 유지됩니다.\n'+
     'JSON 백업 후 충돌을 해결해 주세요.'
    );
    return;
   }

   const payload=snapshot();
   const before=clean(JSON.stringify(payload));

   if(before===base){
    status('동기화 완료');
    return;
   }

   const {data,error}=await client.rpc(
    'myline_cas_save',
    {
     expected_revision:revision,
     new_payload:payload
    }
   );

   if(error)throw error;
   if(session?.user?.id!==uid)return;

   if(data===null){
    blocked=true;
    status('동기화 충돌 · 확인 필요');

    alert(
     '다른 기기에서 먼저 저장했어요.\n'+
     '현재 기기 기록은 유지됩니다.'
    );
    return;
   }

   revision=data;
   base=before;
   status('동기화 완료');

  }catch(e){
   err(e);
  }finally{
   busy=false;

   if(!blocked&&(pending||isDirty())){
    schedule();
   }
  }
 }

 async function pull(){
  if(!setup())return alert('클라우드 설정이 필요해요.');
  if(!session)return alert('로그인이 필요해요.');

  if(busy){
   return alert('저장 중이에요. 잠시 후 다시 시도해 주세요.');
  }

  if(!confirm(
   '클라우드 기록을 이 기기에 불러올까요?\n'+
   '현재 기록은 JSON으로 먼저 백업됩니다.'
  ))return;

  clearTimeout(timer);
  busy=true;

  const uid=session.user.id;

  try{
   backup();

   const row=await getRemote();
   if(session?.user?.id!==uid)return;
   if(!row)return alert('클라우드에 기록이 없어요.');

   applyRemote(row);

  }catch(e){
   err(e);
  }finally{
   busy=false;
   if(!blocked&&isDirty())schedule();
  }
 }

 function schedule(){
  clearTimeout(timer);

  if(!session){
   status('기기에 자동 저장됨');
   return;
  }

  if(blocked){
   status('동기화 중지 · 로컬 기록 유지');
   return;
  }

  if(initialized&&!isDirty()&&!busy){
   pending=false;
   status('동기화 완료');
   return;
  }

  pending=true;
  status('저장 대기 중');

  timer=setTimeout(()=>{
   if(busy){
    schedule();
   }else{
    push();
   }
  },2000);
 }

 async function signIn(){
  if(!setup()){
   return alert('Supabase 설정을 확인해 주세요.');
  }

  const {error}=await client.auth.signInWithOAuth({
   provider:'google',
   options:{
    redirectTo:location.origin+location.pathname
   }
  });

  if(error)err(error);
 }

 async function signOut(){
  if(!setup())return;

  if(busy){
   return alert('동기화 완료 후 로그아웃해 주세요.');
  }

  if(isDirty()&&!blocked){
   await push();
  }

  if(isDirty()&&!confirm(
   '클라우드에 저장되지 않은 기록이 있어요.\n'+
   '로컬 기록을 유지하고 로그아웃할까요?'
  ))return;

  await client.auth.signOut();

  reset();
  session=null;
  activeUser=null;

  status('로그아웃됨 · 로컬 기록 유지');
 }

 window.mylineSync={
  configured:()=>!!(
   cfg.supabaseUrl&&cfg.supabaseAnonKey
  ),
  schedule,
  signIn,
  signOut,
  pull,
  push
 };

 window.addEventListener('online',()=>{
  if(session&&!blocked)schedule();
 });

 document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'&&
     session&&!blocked&&initialized&&isDirty()){
   clearTimeout(timer);
   push();
  }
 });

 if(setup()){
  client.auth.getSession()
   .then(({data,error})=>{
    if(error)throw error;
    handleSession(data.session);
   })
   .catch(err);
 }
})();
