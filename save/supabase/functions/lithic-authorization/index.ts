import { createClient } from 'npm:@supabase/supabase-js@2';
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'Content-Type':'application/json'}});
const te=new TextEncoder();
async function validSignature(raw:string,h:Headers,secret:string){
  const id=h.get('webhook-id'),ts=h.get('webhook-timestamp'),header=h.get('webhook-signature'); if(!id||!ts||!header)return false;
  if(Math.abs(Date.now()/1000-Number(ts))>300)return false;
  let keyBytes:Uint8Array;try{keyBytes=Uint8Array.from(atob(secret.replace(/^whsec_/,'')),c=>c.charCodeAt(0))}catch{return false}
  const key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,te.encode(`${id}.${ts}.${raw}`)));
  for(const item of header.split(/\s+/)){const [v,val]=item.split(',');if(v!=='v1'||!val)continue;let got:Uint8Array;try{got=Uint8Array.from(atob(val),c=>c.charCodeAt(0))}catch{continue}if(got.length!==sig.length)continue;let diff=0;for(let i=0;i<sig.length;i++)diff|=sig[i]^got[i];if(diff===0)return true}return false;
}
Deno.serve(async req=>{
  if(req.method!=='POST')return json({result:'INSUFFICIENT_FUNDS'});
  const raw=await req.text();const secret=Deno.env.get('LITHIC_ASA_WEBHOOK_SECRET')||Deno.env.get('LITHIC_WEBHOOK_SECRET');
  if(!secret||!(await validSignature(raw,req.headers,secret)))return json({result:'INSUFFICIENT_FUNDS'});
  let body:any;try{body=JSON.parse(raw)}catch{return json({result:'INSUFFICIENT_FUNDS'})}
  const status=String(body.status||'');
  if(status.includes('CREDIT_AUTHORIZATION'))return json({result:'APPROVED'});
  const cardToken=body.card_token||body.card?.token;const transactionToken=body.token||body.transaction_token;
  const rawAmount=body.amounts?.hold?.amount??body.authorization_amount??body.amount??0;const amount=Math.abs(Number(rawAmount||0));
  if(status==='BALANCE_INQUIRY'){
    if(!cardToken)return json({result:'INSUFFICIENT_FUNDS'});
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const {data:card}=await db.from('cards').select('fund_id,user_id,spend_limit_cents').eq('lithic_card_token',cardToken).maybeSingle();if(!card)return json({result:'INSUFFICIENT_FUNDS'});
    const {data:f}=await db.from('funds').select('current_balance_cents').eq('id',card.fund_id).single();const available=Math.min(Number(f?.current_balance_cents||0),Number(card.spend_limit_cents||0));
    return json({result:'APPROVED',balance:{amount:Number(f?.current_balance_cents||0),available}});
  }
  if(!cardToken||!transactionToken||amount<=0)return json({result:'INSUFFICIENT_FUNDS'});
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const merchant=body.merchant?.descriptor||body.merchant?.acceptor_name||body.merchant?.name||'';
  const {data,error}=await db.rpc('reserve_card_authorization',{p_card_token:cardToken,p_transaction_token:transactionToken,p_amount_cents:amount,p_merchant:merchant});
  if(error||!data?.approved)return json({result:'INSUFFICIENT_FUNDS'});
  return json({result:'APPROVED'});
});
