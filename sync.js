/* MY LINE 4.0: local-first, Google OAuth, revision-safe snapshot sync. */
(()=>{
 const cfg=window.MYLINE_CONFIG||{};
 let client=null,session=null,revision=null,base=null,timer=null,busy=false,blocked=false;
 const ready=()=>!!(cfg.supabaseUrl&&cfg.supabaseAnonKey&&window.supabase?.createClient);
 const current=()=>JSON.stringify(st);
 const clean=s=>{const o=JSON.parse(s);delete o.tab;delete o.search;delete o.filter;delete o.date;return JSON.stringify(o)};
 const snapshot=()=>JSON.parse(current());
 const status=msg=>{const el=document.getElementById('cloudStatus');if(el)el.textContent=msg;};
 const err=e=>{console.error('MY LINE sync',e);status('동기화 실패 · 로컬 저장됨')};
 const isDirty=()=>base!==null&&clean(current())!==base;
 function setup(){if(!ready()){status('클라우드 설정 필요');return false}if(!client){client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});client.auth.onAuthStateChange((_e,s)=>{session=s;if(s)setTimeout(()=>initial(),0);else{revision=null;base=null;status('로그인 필요')}})}return true}
 async function getRemote(){const {data,error}=await client.from('myline_snapshots').select('payload,revision').eq('user_id',session.user.id).maybeSingle();if(error)throw error;return data}
 function applyRemote(row){if(!row?.payload?.foods||!row.payload.logs||!row.payload.settings)throw Error('클라우드 데이터 형식 오류');st=row.payload;localStorage.setItem(KEY,JSON.stringify(st));revision=row.revision;base=clean(current());blocked=false;render();status('동기화 완료')}
 async function initial(){if(!session||busy)return;busy=true;try{const row=await getRemote();if(!row){revision=0;base=null;status('클라우드 기록 없음');if(confirm('이 기기의 MY LINE 기록을 클라우드에 처음 저장할까요? (3.0 JSON 복원은 먼저 진행하세요)'))await insertFirst();return}
 revision=row.revision;
 const localHasData=Object.values(st.logs||{}).some(x=>x.length)||(st.weights||[]).length>0;
 if(localHasData&&clean(current())!==clean(JSON.stringify(row.payload))){status('기기 기록 선택 필요');const choose=confirm('클라우드 기록과 이 기기의 기록이 달라요. [확인]은 클라우드 기록으로 교체, [취소]는 이 기기의 기록 유지(동기화 중지)입니다. 교체 전 로컬 JSON 백업을 권장합니다.');if(!choose){blocked=true;return}backup()}
 applyRemote(row);
 }catch(e){err(e)}finally{busy=false}}
 async function insertFirst(){if(!session)return;try{const {data,error}=await client.from('myline_snapshots').insert({user_id:session.user.id,payload:snapshot()}).select('revision').single();if(error)throw error;revision=data.revision;base=clean(current());blocked=false;status('첫 클라우드 저장 완료')}catch(e){err(e)}}
 async function push(){if(!setup())return alert('config.js와 Supabase 설정이 필요해요.');if(!session)return alert('Google 로그인이 필요해요.');if(blocked)return alert('기기 간 기록 충돌을 먼저 해결해 주세요. JSON 백업 후 클라우드에서 불러올 수 있어요.');if(busy)return;busy=true;try{
 if(revision===null){status('클라우드 상태 확인 중');return}
 if(revision===0){await insertFirst();return}
 const remote=await getRemote();if(!remote){blocked=true;status('클라우드 기록 없음 · 확인 필요');return}
 if(remote.revision!==revision){blocked=true;status('다른 기기 변경 감지 · 동기화 중지');alert('다른 기기에서 기록이 변경됐어요. 자동 덮어쓰기를 중단했습니다. 현재 기록을 JSON으로 백업한 후 클라우드에서 불러오기를 선택해 주세요.');return}
 const payload=snapshot();const before=clean(JSON.stringify(payload));
 if(before===base){status('동기화 완료');return}
 const {data,error}=await client.rpc('myline_cas_save',{expected_revision:revision,new_payload:payload});if(error)throw error;if(data===null){blocked=true;status('동기화 충돌 · 확인 필요');alert('다른 기기에서 먼저 저장했어요. 로컬 기록은 유지됩니다. JSON 백업 후 동기화 충돌을 해결해 주세요.');return}
 revision=data;base=before;status('동기화 완료');if(isDirty())schedule();
 }catch(e){err(e)}finally{busy=false}}
 async function pull(){if(!setup())return alert('클라우드 설정이 필요해요');if(!session)return alert('로그인이 필요해요');if(!confirm('클라우드 기록을 이 기기에 불러올까요? 현재 기록은 JSON으로 먼저 백업됩니다.'))return;backup();try{const row=await getRemote();if(!row)return alert('클라우드에 기록이 없어요');applyRemote(row)}catch(e){err(e)}}
 function schedule(){status(session?'저장 대기 중':'기기에 자동 저장됨');if(!session||blocked)return;clearTimeout(timer);timer=setTimeout(()=>{if(!busy)push();else schedule()},2000)}
 async function signIn(){if(!setup())return alert('먼저 README 안내대로 Supabase를 설정해 주세요');const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});if(error)err(error)}
 async function signOut(){if(!setup())return;await client.auth.signOut();session=null;revision=null;base=null;status('로그아웃됨 · 로컬 기록 유지')}
 window.mylineSync={configured:()=>!!(cfg.supabaseUrl&&cfg.supabaseAnonKey),schedule,signIn,signOut,pull,push};
 window.addEventListener('online',()=>{if(session&&!blocked)schedule()});
 if(setup())client.auth.getSession().then(({data})=>{session=data.session;if(session)initial();else status('로그인 필요')}).catch(err);
})();
