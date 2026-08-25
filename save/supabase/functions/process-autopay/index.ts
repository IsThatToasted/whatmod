import { createClient } from 'npm:@supabase/supabase-js@2';
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'Content-Type':'application/json'}});
const BASE='https://sandbox.lithic.com/v1';
Deno.serve(async(req)=>{
  if(req.method!=='POST') return json({error:'Method not allowed'},405);
  const expected=Deno.env.get('SAVE_AUTOPAY_CRON_SECRET');
  if(!expected||req.headers.get('x-save-cron-secret')!==expected) return json({error:'Unauthorized'},401);
  const url=Deno.env.get('SUPABASE_URL')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, key=Deno.env.get('LITHIC_API_KEY')!, financial=Deno.env.get('LITHIC_FINANCIAL_ACCOUNT_TOKEN');
  if(!key||!financial) return json({error:'Lithic funding secrets are incomplete'},503);
  const db=createClient(url,service);
  const now=new Date().toISOString();
  const {data:plans,error}=await db.from('contribution_plans').select('*, external_bank_accounts!inner(lithic_external_account_token,verification_state)').eq('status','active').lte('next_run_at',now).limit(100);
  if(error) return json({error:error.message},500);
  const results:any[]=[];
  for(const p of plans||[]){
    if(p.external_bank_accounts?.verification_state!=='ENABLED'){results.push({plan_id:p.id,status:'skipped',reason:'bank_not_verified'});continue;}
    const token=crypto.randomUUID();
    const {data:m,error:mErr}=await db.from('money_movements').insert({fund_id:p.fund_id,user_id:p.user_id,external_bank_account_id:p.external_bank_account_id,direction:'contribution',amount_cents:p.amount_cents,status:'initiated',idempotency_key:token,metadata:{autopay_plan_id:p.id}}).select('id').single();
    if(mErr){results.push({plan_id:p.id,status:'failed',reason:mErr.message});continue;}
    try{
      const r=await fetch(`${BASE}/payments`,{method:'POST',headers:{Authorization:key,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({token,type:'COLLECTION',method:'ACH_NEXT_DAY',method_attributes:{sec_code:'PPD'},financial_account_token:financial,external_bank_account_token:p.external_bank_accounts.lithic_external_account_token,amount:p.amount_cents,memo:'Save autopay',user_defined_id:m.id})});
      const raw=await r.text(); let remote:any={}; try{remote=raw?JSON.parse(raw):{}}catch{}
      if(!r.ok) throw new Error(remote.message||`Lithic ${r.status}`);
      await db.from('money_movements').update({status:'pending',provider_reference:remote.token||token,updated_at:now,metadata:{autopay_plan_id:p.id,provider_status:remote.status}}).eq('id',m.id);
      const {data:next}=await db.rpc('next_plan_run',{p_from:p.next_run_at||now,p_cadence:p.cadence});
      await db.from('contribution_plans').update({last_run_at:now,last_status:'pending',next_run_at:next,updated_at:now}).eq('id',p.id);
      results.push({plan_id:p.id,status:'pending',movement_id:m.id});
    }catch(err:any){
      await db.from('money_movements').update({status:'failed',failure_message:err.message,updated_at:now}).eq('id',m.id);
      await db.from('contribution_plans').update({last_run_at:now,last_status:'failed',failure_count:Number(p.failure_count||0)+1,updated_at:now}).eq('id',p.id);
      results.push({plan_id:p.id,status:'failed',reason:err.message});
    }
  }
  return json({processed:results.length,results});
});
