import { createClient } from 'npm:@supabase/supabase-js@2';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if(req.method!=='POST') return json({error:'Method not allowed'},405);

  const auth=req.headers.get('Authorization');
  if(!auth) return json({error:'Missing authorization'},401);

  const url=Deno.env.get('SUPABASE_URL')!;
  const publishableMap=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}');
  const secretMap=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
  const publishable=publishableMap.default || Deno.env.get('SUPABASE_ANON_KEY');
  const secret=secretMap.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const lithicKey=Deno.env.get('LITHIC_API_KEY');
  if(!lithicKey) return json({error:'LITHIC_API_KEY is not configured'},500);

  const userClient=createClient(url,publishable,{global:{headers:{Authorization:auth}}});
  const admin=createClient(url,secret);
  const {data:{user},error:userErr}=await userClient.auth.getUser();
  if(userErr||!user) return json({error:'Unauthorized'},401);

  let body:any={}; try{body=await req.json()}catch{return json({error:'Invalid JSON'},400)}
  const {action,fund_id}=body;
  if(!fund_id) return json({error:'fund_id is required'},400);

  const {data:membership}=await admin.from('fund_members').select('id,share_cents,spend_limit_cents,status').eq('fund_id',fund_id).eq('user_id',user.id).eq('status','active').maybeSingle();
  if(!membership) return json({error:'Not a fund member'},403);

  if(action==='create'){
    const {data:existing}=await admin.from('cards').select('*').eq('fund_id',fund_id).eq('user_id',user.id).maybeSingle();
    if(existing) return json({card:{id:existing.id,last_four:existing.last_four,state:existing.state}});

    const resp=await fetch('https://sandbox.lithic.com/v1/cards',{
      method:'POST',headers:{'Accept':'application/json','Authorization':lithicKey,'Content-Type':'application/json'},
      body:JSON.stringify({type:'VIRTUAL'})
    });
    const card=await resp.json();
    if(!resp.ok) return json({error:card?.message||card?.error||'Lithic card creation failed',details:card},resp.status);

    // Deliberately persist only token + non-sensitive display metadata.
    const {data:saved,error:saveErr}=await admin.from('cards').insert({
      fund_id,user_id:user.id,lithic_card_token:card.token,last_four:card.last_four,state:card.state,
      spend_limit_cents:membership.spend_limit_cents ?? membership.share_cents ?? 0
    }).select('id,last_four,state,spend_limit_cents').single();
    if(saveErr) return json({error:saveErr.message},500);
    return json({card:saved});
  }

  return json({error:'Unknown action'},400);
});
