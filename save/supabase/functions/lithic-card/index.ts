import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json'}});
const BASE='https://sandbox.lithic.com/v1';
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if(req.method!=='POST') return json({error:'Method not allowed'},405);
  const auth=req.headers.get('Authorization'); if(!auth) return json({error:'Missing authorization'},401);
  const url=Deno.env.get('SUPABASE_URL')!;
  const anon=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||Deno.env.get('SUPABASE_ANON_KEY')!;
  const service=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const key=Deno.env.get('LITHIC_API_KEY'); if(!key) return json({error:'LITHIC_API_KEY is not configured'},503);
  const userDb=createClient(url,anon,{global:{headers:{Authorization:auth}}}), db=createClient(url,service);
  const {data:{user},error:ue}=await userDb.auth.getUser(); if(ue||!user) return json({error:'Unauthorized'},401);
  let body:any={};try{body=await req.json()}catch{return json({error:'Invalid JSON'},400)}
  const fundId=String(body.fund_id||''); if(!fundId) return json({error:'fund_id is required'},400);
  const {data:member}=await db.from('fund_members').select('share_cents,spend_limit_cents,status').eq('fund_id',fundId).eq('user_id',user.id).eq('status','active').maybeSingle();
  if(!member) return json({error:'Not a fund member'},403);
  const call=async(path:string,payload:any)=>{const r=await fetch(`${BASE}${path}`,{method:'POST',headers:{Authorization:key,Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(payload)});const t=await r.text();let j:any={};try{j=t?JSON.parse(t):{}}catch{j={message:t}};if(!r.ok)throw Object.assign(new Error(j.message||j.error||`Lithic ${r.status}`),{status:r.status,details:j});return j};
  try{
    if(body.action==='create'){
      const {data:existing}=await db.from('cards').select('id,last_four,state,spend_limit_cents').eq('fund_id',fundId).eq('user_id',user.id).maybeSingle();
      if(existing) return json({card:existing});
      const payload:any={type:'VIRTUAL'}; const accountToken=Deno.env.get('LITHIC_CARD_ACCOUNT_TOKEN'); if(accountToken) payload.account_token=accountToken;
      const card=await call('/cards',payload);
      const {data:saved,error}=await db.from('cards').insert({fund_id:fundId,user_id:user.id,lithic_card_token:card.token,last_four:card.last_four,state:card.state,spend_limit_cents:member.spend_limit_cents??member.share_cents??0}).select('id,last_four,state,spend_limit_cents').single();
      if(error) throw error; return json({card:saved});
    }
    if(body.action==='web_provision'){
      const wallet=String(body.wallet||''); if(!['APPLE_PAY','GOOGLE_PAY'].includes(wallet)) return json({error:'Unsupported wallet'},400);
      const {data:card}=await db.from('cards').select('*').eq('fund_id',fundId).eq('user_id',user.id).maybeSingle(); if(!card) return json({error:'Create your virtual card first.'},404);
      const {data:attempt}=await db.from('wallet_provision_attempts').insert({card_id:card.id,user_id:user.id,wallet,status:'initiated'}).select('id').single();
      try{
        const payload:any={digital_wallet:wallet};
        if(wallet==='GOOGLE_PAY'&&body.server_session_id&&body.client_device_id){payload.server_session_id=body.server_session_id;payload.client_device_id=body.client_device_id;}
        const remote=await call(`/cards/${card.lithic_card_token}/web_provision`,payload);
        await db.from('wallet_provision_attempts').update({status:'ready',provider_reference:remote.token||remote.session_id||null,updated_at:new Date().toISOString()}).eq('id',attempt?.id);
        return json({provisioning:remote});
      }catch(err:any){await db.from('wallet_provision_attempts').update({status:'failed',error_message:err.message,updated_at:new Date().toISOString()}).eq('id',attempt?.id);throw err;}
    }
    return json({error:'Unknown action'},400);
  }catch(err:any){console.error('lithic-card',body.action,err.message);return json({error:err.message||'Lithic card request failed',details:err.details},Number(err.status)||500)}
});
