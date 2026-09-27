// Supabase Edge Function: push. Requires VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
const cors={'Access-Control-Allow-Origin':'https://tema666sgl-alt.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(data:unknown,code=200)=>new Response(JSON.stringify(data),{status:code,headers:{...cors,'Content-Type':'application/json'}});
const url=Deno.env.get('SUPABASE_URL')!;
const anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const adminDb=createClient(url,service,{auth:{persistSession:false}});
const publicKey=Deno.env.get('VAPID_PUBLIC_KEY')||'';
const privateKey=Deno.env.get('VAPID_PRIVATE_KEY')||'';
if(publicKey&&privateKey)webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')||'mailto:admin@example.com',publicKey,privateKey);
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
  if(!token)return json({error:'Unauthorized'},401);
  const {data:{user},error}=await adminDb.auth.getUser(token);
  if(error||!user)return json({error:'Unauthorized'},401);
  const body=await req.json();const action=String(body.action||'');
  if(action==='config')return json({publicKey});
  if(!publicKey||!privateKey)return json({error:'VAPID keys are not configured'},503);
  if(action==='subscribe'){
   const s=body.subscription;
   if(typeof s?.endpoint!=='string'||!s.endpoint.startsWith('https://')||typeof s?.keys?.p256dh!=='string'||typeof s?.keys?.auth!=='string')return json({error:'Invalid subscription'},400);
   // Prevent one account from stealing a subscription endpoint belonging to another account.
   const {data:existing}=await adminDb.from('push_subscriptions').select('user_id').eq('endpoint',s.endpoint).maybeSingle();
   if(existing&&existing.user_id!==user.id)return json({error:'Subscription already belongs to another account'},409);
   const {error:e}=await adminDb.from('push_subscriptions').upsert({user_id:user.id,endpoint:s.endpoint,subscription:s,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
   return e?json({error:'Subscription failed'},500):json({ok:true});
  }
  if(action==='unsubscribe'){
   const {error:e}=await adminDb.from('push_subscriptions').delete().eq('user_id',user.id).eq('endpoint',String(body.endpoint||''));
   return e?json({error:'Unsubscribe failed'},500):json({ok:true});
  }
  let rows:any[]=[];
  if(action==='test'){
   const {data,error:e}=await adminDb.from('push_subscriptions').select('endpoint,subscription').eq('user_id',user.id).limit(20);
   if(e)return json({error:'Query failed'},500);rows=data||[];
  }else if(action==='broadcast'){
   // Server-side admin check: never trust a UI flag.
   const caller=createClient(url,anon,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false}});
   const {data:allowed,error:e}=await caller.rpc('is_admin');
   if(e||allowed!==true)return json({error:'Forbidden'},403);
   if(typeof body.message!=='string'||!body.message.trim()||body.message.length>400)return json({error:'Invalid message'},400);
   const {data,error:queryError}=await adminDb.from('push_subscriptions').select('endpoint,subscription').limit(5000);
   if(queryError)return json({error:'Query failed'},500);rows=data||[];
  }else return json({error:'Unknown action'},400);
  const payload=JSON.stringify({title:action==='test'?'YOU TIM — тест':'YOU TIM',message:action==='test'?'Уведомления работают! / Notifications are working!':body.message});
  let sent=0,failed=0;
  // Batch to avoid unbounded simultaneous requests.
  for(let i=0;i<rows.length;i+=20){
   const results=await Promise.allSettled(rows.slice(i,i+20).map(async r=>{
    try{await webpush.sendNotification(r.subscription,payload,{TTL:3600});sent++}
    catch(e:any){failed++;if(e.statusCode===404||e.statusCode===410)await adminDb.from('push_subscriptions').delete().eq('endpoint',r.endpoint)}
   }));void results;
  }
  return json({sent,failed});
 }catch(e){console.error('Push function error',e);return json({error:'Push service error'},500)}
});
