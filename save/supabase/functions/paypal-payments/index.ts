import { createClient } from 'npm:@supabase/supabase-js@2';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});

function clients(auth:string){
  const url=Deno.env.get('SUPABASE_URL')!;
  const anon=Deno.env.get('SUPABASE_ANON_KEY')!;
  const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return {user:createClient(url,anon,{global:{headers:{Authorization:auth}}}),admin:createClient(url,service)};
}
function paypalBase(){return (Deno.env.get('PAYPAL_ENV')||'sandbox').toLowerCase()==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com'}
async function accessToken(){
  const id=Deno.env.get('PAYPAL_CLIENT_ID'),secret=Deno.env.get('PAYPAL_CLIENT_SECRET');
  if(!id||!secret) throw Object.assign(new Error('PayPal is not configured.'),{status:503});
  const r=await fetch(`${paypalBase()}/v1/oauth2/token`,{method:'POST',headers:{Authorization:`Basic ${btoa(`${id}:${secret}`)}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
  const b=await r.json(); if(!r.ok) throw Object.assign(new Error(b?.error_description||'PayPal authentication failed.'),{status:r.status,details:b}); return b.access_token as string;
}
async function paypal(path:string,init:RequestInit={}){
  const token=await accessToken();
  const r=await fetch(`${paypalBase()}${path}`,{...init,headers:{Accept:'application/json',Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(init.headers||{})}});
  const text=await r.text(); let body:any={}; try{body=text?JSON.parse(text):{}}catch{body={message:text}};
  if(!r.ok) throw Object.assign(new Error(body?.message||body?.details?.[0]?.description||`PayPal request failed (${r.status})`),{status:r.status,details:body});
  return body;
}
const dollars=(c:number)=>(c/100).toFixed(2);

Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if(req.method!=='POST') return json({error:'Method not allowed'},405);
  const auth=req.headers.get('Authorization'); if(!auth) return json({error:'Missing authorization'},401);
  const {user,admin}=clients(auth);
  const {data:{user:authUser},error:userErr}=await user.auth.getUser();
  if(userErr||!authUser) return json({error:'Unauthorized'},401);
  let body:any={}; try{body=await req.json()}catch{return json({error:'Invalid JSON'},400)}
  const action=String(body.action||'');
  try{
    if(action==='provider_status'){
      let configured=true,providerError:string|null=null;
      try{await accessToken()}catch(e:any){configured=false;providerError=e.message}
      const {data:setting}=await admin.from('personal_payment_settings').select('*').eq('owner_user_id',authUser.id).eq('provider','paypal').maybeSingle();
      return json({provider:'paypal',configured,environment:(Deno.env.get('PAYPAL_ENV')||'sandbox'),settlement:setting||null,error:providerError});
    }

    if(action==='save_settlement_label'){
      const label=String(body.settlement_label||'Save settlement bank').trim().slice(0,80);
      const last4=String(body.settlement_last_four||'').replace(/\D/g,'').slice(-4)||null;
      const {data,error}=await admin.from('personal_payment_settings').upsert({owner_user_id:authUser.id,provider:'paypal',settlement_label:label,settlement_last_four:last4,mode:(Deno.env.get('PAYPAL_ENV')||'sandbox').toLowerCase()==='live'?'live':'sandbox',configured:true,updated_at:new Date().toISOString()},{onConflict:'owner_user_id,provider'}).select().single();
      if(error) throw error; return json({settlement:data});
    }

    if(action==='create_order'){
      const fundId=String(body.fund_id||''),amount=Math.round(Number(body.amount_cents));
      if(!fundId||!Number.isInteger(amount)||amount<100) return json({error:'Minimum contribution is $1.00.'},400);
      const {data:member}=await admin.from('fund_members').select('id').eq('fund_id',fundId).eq('user_id',authUser.id).eq('status','active').maybeSingle();
      if(!member) return json({error:'Not a fund member'},403);
      const idempotency=crypto.randomUUID();
      const appUrl=(Deno.env.get('SAVE_APP_URL')||'https://whatmod.com/save/').replace(/\/$/,'/');
      const order=await paypal('/v2/checkout/orders',{method:'POST',headers:{'PayPal-Request-Id':idempotency},body:JSON.stringify({intent:'CAPTURE',purchase_units:[{reference_id:fundId,custom_id:`save:${fundId}:${authUser.id}`,description:'Save shared-fund contribution',amount:{currency_code:'USD',value:dollars(amount)}}],payment_source:{paypal:{experience_context:{user_action:'PAY_NOW',return_url:`${appUrl}?paypal=return&fund=${encodeURIComponent(fundId)}`,cancel_url:`${appUrl}?paypal=cancel&fund=${encodeURIComponent(fundId)}`}}}})});
      const {error}=await admin.from('card_contributions').insert({fund_id:fundId,user_id:authUser.id,provider:'paypal',provider_order_id:order.id,amount_cents:amount,status:'initiated',idempotency_key:idempotency,metadata:{source:'save-personal'}}); if(error) throw error;
      const approve=(order.links||[]).find((l:any)=>l.rel==='payer-action'||l.rel==='approve')?.href;
      if(!approve) return json({error:'PayPal did not return an approval URL.'},502);
      return json({order_id:order.id,approval_url:approve});
    }

    if(action==='capture_order'){
      const orderId=String(body.order_id||''); if(!orderId) return json({error:'Missing order id'},400);
      const {data:row}=await admin.from('card_contributions').select('*').eq('provider','paypal').eq('provider_order_id',orderId).eq('user_id',authUser.id).maybeSingle();
      if(!row) return json({error:'Contribution not found'},404);
      if(['settled','processing','partially_refunded','refunded'].includes(row.status)) return json({contribution:row,already_processed:true});
      const capture=await paypal(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,{method:'POST',headers:{'PayPal-Request-Id':row.idempotency_key},body:'{}'});
      const cap=capture?.purchase_units?.[0]?.payments?.captures?.[0]; if(!cap?.id) return json({error:'PayPal capture was not returned.'},502);
      const source=capture?.payment_source||{}; const card=source.card||{};
      const status=String(cap.status||capture.status||'PROCESSING').toUpperCase()==='COMPLETED'?'settled':'processing';
      const update={provider_capture_id:cap.id,status,source_type:source.card?'card':source.paypal?'paypal':'other',source_brand:card.brand||null,source_last_four:card.last_digits||null,payer_email:capture?.payer?.email_address||null,updated_at:new Date().toISOString(),settled_at:status==='settled'?new Date().toISOString():null,metadata:{...row.metadata,paypal_status:cap.status||capture.status}};
      const {data:saved,error}=await admin.from('card_contributions').update(update).eq('id',row.id).select().single(); if(error) throw error;
      if(status==='settled'){
        const {error:ledgerErr}=await admin.from('ledger_entries').upsert({fund_id:row.fund_id,user_id:row.user_id,entry_type:'contribution',amount_cents:row.amount_cents,description:'Card contribution',provider:'paypal',provider_reference:cap.id,settled_at:new Date().toISOString(),metadata:{order_id:orderId,source_type:update.source_type,source_brand:update.source_brand,source_last_four:update.source_last_four}},{onConflict:'provider,provider_reference'}); if(ledgerErr) throw ledgerErr;
        await admin.rpc('recalculate_fund_balance',{p_fund_id:row.fund_id});
      }
      return json({contribution:saved});
    }

    if(action==='refund_to_sources'){
      const fundId=String(body.fund_id||''),requested=Math.round(Number(body.amount_cents));
      if(!fundId||!Number.isInteger(requested)||requested<100) return json({error:'Minimum refund is $1.00.'},400);
      const {data:member}=await admin.from('fund_members').select('id').eq('fund_id',fundId).eq('user_id',authUser.id).eq('status','active').maybeSingle(); if(!member) return json({error:'Not a fund member'},403);
      const {data:refundable,error:rpcErr}=await user.rpc('user_source_refundable_cents',{p_fund_id:fundId,p_user_id:authUser.id}); if(rpcErr) throw rpcErr;
      if(requested>Number(refundable||0)) return json({error:'Requested amount exceeds the amount that can be returned to your original payment sources.'},409);
      const {data:captures,error:listErr}=await admin.from('card_contributions').select('*').eq('fund_id',fundId).eq('user_id',authUser.id).in('status',['settled','partially_refunded']).not('provider_capture_id','is',null).order('created_at',{ascending:false}); if(listErr) throw listErr;
      let remaining=requested; const results:any[]=[];
      for(const c of captures||[]){
        if(remaining<=0) break; const available=Number(c.amount_cents)-Number(c.refunded_cents||0)-Number(c.refund_reserved_cents||0); if(available<=0) continue;
        const take=Math.min(available,remaining),idem=crypto.randomUUID();
        const oldReserved=Number(c.refund_reserved_cents||0);
        const {data:reservation,error:reservationErr}=await admin.from('card_contributions').update({refund_reserved_cents:oldReserved+take,updated_at:new Date().toISOString()}).eq('id',c.id).eq('refunded_cents',Number(c.refunded_cents||0)).eq('refund_reserved_cents',oldReserved).select('id').maybeSingle();
        if(reservationErr) throw reservationErr; if(!reservation) throw Object.assign(new Error('Refund balance changed in another session. Refresh and try again.'),{status:409});
        let refund:any;
        try{refund=await paypal(`/v2/payments/captures/${encodeURIComponent(c.provider_capture_id)}/refund`,{method:'POST',headers:{'PayPal-Request-Id':idem},body:JSON.stringify({amount:{value:dollars(take),currency_code:'USD'},note_to_payer:'Returned from your Save fund'})});}
        catch(err){await admin.from('card_contributions').update({refund_reserved_cents:oldReserved,updated_at:new Date().toISOString()}).eq('id',c.id);throw err}
        const settled=String(refund.status||'PENDING').toUpperCase()==='COMPLETED';
        const {data:rr,error:refundErr}=await admin.from('source_refunds').insert({fund_id:fundId,user_id:authUser.id,card_contribution_id:c.id,provider:'paypal',provider_refund_id:refund.id,amount_cents:take,status:settled?'settled':'pending',idempotency_key:idem,metadata:{capture_id:c.provider_capture_id,paypal_status:refund.status},settled_at:settled?new Date().toISOString():null}).select().single(); if(refundErr) throw refundErr;
        const newRefunded=Number(c.refunded_cents||0)+take; const newStatus=newRefunded>=Number(c.amount_cents)?'refunded':'partially_refunded';
        await admin.from('card_contributions').update({refunded_cents:newRefunded,refund_reserved_cents:oldReserved,status:newStatus,updated_at:new Date().toISOString()}).eq('id',c.id);
        if(settled){
          const {error:ledgerErr}=await admin.from('ledger_entries').upsert({fund_id:fundId,user_id:authUser.id,entry_type:'refund',amount_cents:-take,description:'Returned to original payment method',provider:'paypal',provider_reference:refund.id,settled_at:new Date().toISOString(),metadata:{capture_id:c.provider_capture_id,card_last_four:c.source_last_four,card_brand:c.source_brand}},{onConflict:'provider,provider_reference'}); if(ledgerErr) throw ledgerErr;
        }
        results.push({id:rr.id,provider_refund_id:refund.id,amount_cents:take,status:settled?'settled':'pending',source_brand:c.source_brand,source_last_four:c.source_last_four}); remaining-=take;
      }
      if(remaining>0) return json({error:'Only part of the requested amount could be mapped to refundable source transactions.',refunded_cents:requested-remaining,refunds:results},409);
      await admin.rpc('recalculate_fund_balance',{p_fund_id:fundId}); return json({refunded_cents:requested,refunds:results});
    }

    return json({error:'Unknown action'},400);
  }catch(e:any){console.error('paypal-payments',action,e?.message); return json({error:e?.message||'PayPal operation failed',details:e?.details||undefined},Number(e?.status)||500)}
});
