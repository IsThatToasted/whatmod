import { createClient } from 'npm:@supabase/supabase-js@2';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const LITHIC_BASE='https://sandbox.lithic.com/v1';

function clients(auth:string){
  const url=Deno.env.get('SUPABASE_URL')!;
  const publishableMap=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}');
  const secretMap=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
  const publishable=publishableMap.default || Deno.env.get('SUPABASE_ANON_KEY')!;
  const secret=secretMap.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return {
    user:createClient(url,publishable,{global:{headers:{Authorization:auth}}}),
    admin:createClient(url,secret)
  };
}
async function lithic(path:string,key:string,init:RequestInit={}){
  const r=await fetch(`${LITHIC_BASE}${path}`,{...init,headers:{'Accept':'application/json','Authorization':key,'Content-Type':'application/json',...(init.headers||{})}});
  const text=await r.text(); let body:any={}; try{body=text?JSON.parse(text):{}}catch{body={message:text}};
  if(!r.ok) throw Object.assign(new Error(body?.message||body?.error||`Lithic request failed (${r.status})`),{status:r.status,details:body});
  return body;
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if(req.method!=='POST') return json({error:'Method not allowed'},405);
  const auth=req.headers.get('Authorization'); if(!auth) return json({error:'Missing authorization'},401);
  const key=Deno.env.get('LITHIC_API_KEY'); if(!key) return json({error:'Lithic is not configured'},503);
  const financialAccountToken=Deno.env.get('LITHIC_FINANCIAL_ACCOUNT_TOKEN');
  const {user,admin}=clients(auth);
  const {data:{user:authUser},error:userErr}=await user.auth.getUser();
  if(userErr||!authUser) return json({error:'Unauthorized'},401);
  let body:any={}; try{body=await req.json()}catch{return json({error:'Invalid JSON'},400)}
  const action=String(body.action||'');

  try{
    if(action==='list_bank_accounts'){
      const {data,error}=await admin.from('external_bank_accounts').select('id,last_four,account_type,state,verification_state,is_default,created_at').eq('user_id',authUser.id).order('created_at',{ascending:false});
      if(error) throw error; return json({accounts:data||[]});
    }

    if(action==='create_bank_account'){
      const routing=String(body.routing_number||'').replace(/\D/g,'');
      const account=String(body.account_number||'').replace(/\D/g,'');
      const owner=String(body.owner_name||'').trim().slice(0,100);
      const type=String(body.account_type||'CHECKING').toUpperCase();
      if(routing.length!==9||account.length<4||!owner||!['CHECKING','SAVINGS'].includes(type)) return json({error:'Enter a valid owner name, routing number and account number.'},400);
      const remote=await lithic('/external_bank_accounts',key,{method:'POST',body:JSON.stringify({verification_method:'MICRO_DEPOSIT',owner_type:'INDIVIDUAL',owner,type,routing_number:routing,account_number:account,country:'USA',currency:'USD'})});
      const {data:saved,error}=await admin.from('external_bank_accounts').insert({user_id:authUser.id,lithic_external_account_token:remote.token,owner_name:owner,account_type:type,last_four:remote.last_four||account.slice(-4),state:remote.state,verification_state:remote.verification_state}).select('id,last_four,account_type,state,verification_state,is_default').single();
      if(error) throw error;
      return json({account:saved,sandbox_hint:'In Lithic sandbox, micro-deposit verification amounts are typically 19 and 89 cents when enabled for your program.'});
    }

    if(action==='verify_bank_account'){
      const {data:account}=await admin.from('external_bank_accounts').select('*').eq('id',body.bank_account_id).eq('user_id',authUser.id).maybeSingle();
      if(!account) return json({error:'Bank account not found'},404);
      const amounts=(body.micro_deposits||[]).map((v:any)=>String(v).replace(/\D/g,'')).filter(Boolean);
      if(amounts.length!==2) return json({error:'Enter both micro-deposit amounts.'},400);
      const remote=await lithic(`/external_bank_accounts/${account.lithic_external_account_token}/micro_deposits`,key,{method:'POST',body:JSON.stringify({micro_deposits:amounts})});
      await admin.from('external_bank_accounts').update({state:remote.state,verification_state:remote.verification_state,updated_at:new Date().toISOString()}).eq('id',account.id);
      return json({account:{id:account.id,last_four:account.last_four,state:remote.state,verification_state:remote.verification_state}});
    }

    if(action==='create_contribution' || action==='create_payout'){
      const direction=action==='create_contribution'?'contribution':'payout';
      const fundId=String(body.fund_id||'');
      const amount=Math.round(Number(body.amount_cents));
      if(!fundId||!Number.isInteger(amount)||amount<100) return json({error:'Minimum amount is $1.00.'},400);
      const {data:member}=await admin.from('fund_members').select('id,status').eq('fund_id',fundId).eq('user_id',authUser.id).eq('status','active').maybeSingle();
      if(!member) return json({error:'Not a fund member'},403);
      const {data:bank}=await admin.from('external_bank_accounts').select('*').eq('id',body.bank_account_id).eq('user_id',authUser.id).maybeSingle();
      if(!bank||bank.verification_state!=='ENABLED') return json({error:'A verified bank account is required.'},400);
      if(!financialAccountToken) return json({error:'LITHIC_FINANCIAL_ACCOUNT_TOKEN is not configured for this sandbox program.'},503);

      const idempotency=crypto.randomUUID();
      let movement:any;
      if(direction==='payout'){
        const {data:movementId,error:reserveErr}=await admin.rpc('reserve_payout_movement',{p_fund_id:fundId,p_user_id:authUser.id,p_bank_account_id:bank.id,p_amount_cents:amount,p_idempotency_key:idempotency});
        if(reserveErr) return json({error:reserveErr.message},409);
        const {data:reserved,error:readErr}=await admin.from('money_movements').select('*').eq('id',movementId).single();
        if(readErr) throw readErr; movement=reserved;
      }else{
        const {data:created,error:createErr}=await admin.from('money_movements').insert({fund_id:fundId,user_id:authUser.id,external_bank_account_id:bank.id,direction,amount_cents:amount,status:'initiated',idempotency_key:idempotency,metadata:{source:'save-web'}}).select('*').single();
        if(createErr) throw createErr; movement=created;
      }
      try{
        const remote=await lithic('/payments',key,{method:'POST',body:JSON.stringify({token:idempotency,type:direction==='contribution'?'COLLECTION':'PAYMENT',method:'ACH_NEXT_DAY',method_attributes:{sec_code:'PPD'},financial_account_token:financialAccountToken,external_bank_account_token:bank.lithic_external_account_token,amount,memo:direction==='contribution'?'Save contribution':'Save payout',user_defined_id:movement.id})});
        const status=String(remote.status||'pending').toLowerCase();
        await admin.from('money_movements').update({provider_reference:remote.token||idempotency,status:['settled','failed','reversed','refunded'].includes(status)?status:'pending',metadata:{source:'save-web',provider_status:remote.status,provider_result:remote.result},updated_at:new Date().toISOString()}).eq('id',movement.id);
        return json({movement:{id:movement.id,direction,amount_cents:amount,status:status==='settled'?'settled':'pending',provider_reference:remote.token}} ,202);
      }catch(err:any){
        await admin.from('money_movements').update({status:'failed',failure_message:err.message,metadata:{provider_error:err.details||null},updated_at:new Date().toISOString()}).eq('id',movement.id);
        throw err;
      }
    }

    return json({error:'Unknown action'},400);
  }catch(err:any){
    console.error('money-movement',action,err?.message);
    return json({error:err?.message||'Money movement failed',details:err?.details||undefined},Number(err?.status)||500);
  }
});
