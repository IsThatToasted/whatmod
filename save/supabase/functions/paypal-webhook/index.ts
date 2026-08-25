import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, paypal-auth-algo, paypal-cert-url, paypal-transmission-id, paypal-transmission-sig, paypal-transmission-time','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json'}});
const base=()=>((Deno.env.get('PAYPAL_ENV')||'sandbox').toLowerCase()==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com');
async function token(){const id=Deno.env.get('PAYPAL_CLIENT_ID')!,sec=Deno.env.get('PAYPAL_CLIENT_SECRET')!;const r=await fetch(`${base()}/v1/oauth2/token`,{method:'POST',headers:{Authorization:`Basic ${btoa(`${id}:${sec}`)}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});const b=await r.json();if(!r.ok)throw new Error('PayPal auth failed');return b.access_token}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors}); if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const raw=await req.text(); let event:any; try{event=JSON.parse(raw)}catch{return json({error:'Invalid JSON'},400)};
 try{
  const webhookId=Deno.env.get('PAYPAL_WEBHOOK_ID'); if(!webhookId)return json({error:'PAYPAL_WEBHOOK_ID is not configured'},503);
  const t=await token(); const verify=await fetch(`${base()}/v1/notifications/verify-webhook-signature`,{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({auth_algo:req.headers.get('paypal-auth-algo'),cert_url:req.headers.get('paypal-cert-url'),transmission_id:req.headers.get('paypal-transmission-id'),transmission_sig:req.headers.get('paypal-transmission-sig'),transmission_time:req.headers.get('paypal-transmission-time'),webhook_id:webhookId,webhook_event:event})}); const vb=await verify.json(); if(!verify.ok||vb.verification_status!=='SUCCESS')return json({error:'Invalid webhook signature'},401);
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const eventId=String(event.id||''); if(!eventId)return json({ok:true}); const {data:existing}=await admin.from('provider_webhook_events').select('id').eq('provider','paypal').eq('provider_event_id',eventId).maybeSingle(); if(existing)return json({ok:true,deduplicated:true});
  await admin.from('provider_webhook_events').insert({provider:'paypal',provider_event_id:eventId,event_type:event.event_type,payload:event,processing_status:'received'});
  const type=String(event.event_type||''),resource=event.resource||{};
  if(type==='PAYMENT.CAPTURE.COMPLETED'){
    const captureId=String(resource.id||''); const {data:c}=await admin.from('card_contributions').select('*').eq('provider_capture_id',captureId).maybeSingle();
    if(c){await admin.from('card_contributions').update({status:'settled',settled_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',c.id);await admin.from('ledger_entries').upsert({fund_id:c.fund_id,user_id:c.user_id,entry_type:'contribution',amount_cents:c.amount_cents,description:'Card contribution',provider:'paypal',provider_reference:captureId,settled_at:new Date().toISOString(),metadata:{source_type:c.source_type,source_brand:c.source_brand,source_last_four:c.source_last_four}},{onConflict:'provider,provider_reference'});await admin.rpc('recalculate_fund_balance',{p_fund_id:c.fund_id});}
  }
  if(type==='PAYMENT.CAPTURE.DENIED'||type==='PAYMENT.CAPTURE.REVERSED'){
    const captureId=String(resource.id||''); await admin.from('card_contributions').update({status:type.endsWith('REVERSED')?'reversed':'failed',updated_at:new Date().toISOString()}).eq('provider_capture_id',captureId);
  }
  if(type==='PAYMENT.CAPTURE.REFUNDED'){
    const refundId=String(resource.id||''); const {data:r}=await admin.from('source_refunds').select('*').eq('provider_refund_id',refundId).maybeSingle(); if(r){await admin.from('source_refunds').update({status:'settled',settled_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',r.id);await admin.from('ledger_entries').upsert({fund_id:r.fund_id,user_id:r.user_id,entry_type:'refund',amount_cents:-Number(r.amount_cents),description:'Returned to original payment method',provider:'paypal',provider_reference:refundId,settled_at:new Date().toISOString(),metadata:{card_contribution_id:r.card_contribution_id}},{onConflict:'provider,provider_reference'});await admin.rpc('recalculate_fund_balance',{p_fund_id:r.fund_id});}
  }
  await admin.from('provider_webhook_events').update({processing_status:'processed',processed_at:new Date().toISOString()}).eq('provider','paypal').eq('provider_event_id',eventId); return json({ok:true});
 }catch(e:any){console.error('paypal-webhook',e?.message);return json({error:e?.message||'Webhook failed'},500)}
});
