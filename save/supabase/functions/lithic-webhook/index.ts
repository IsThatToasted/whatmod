import { createClient } from 'npm:@supabase/supabase-js@2';
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'Content-Type':'application/json'}});
const enc=new TextEncoder();
function b64(bytes:ArrayBuffer){return btoa(String.fromCharCode(...new Uint8Array(bytes)))}
async function verify(raw:string,headers:Headers,secret:string){
  const id=headers.get('webhook-id'), ts=headers.get('webhook-timestamp'), sig=headers.get('webhook-signature');
  if(!id||!ts||!sig) return false;
  const age=Math.abs(Date.now()/1000-Number(ts)); if(!Number.isFinite(age)||age>300) return false;
  const rawSecret=secret.startsWith('whsec_')?secret.slice(6):secret;
  let keyBytes:Uint8Array; try{keyBytes=Uint8Array.from(atob(rawSecret),c=>c.charCodeAt(0))}catch{return false}
  const key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const expected=b64(await crypto.subtle.sign('HMAC',key,enc.encode(`${id}.${ts}.${raw}`)));
  return sig.split(/\s+/).some(v=>{const [version,value]=v.split(',');return version==='v1'&&value===expected});
}
function normalizedStatus(content:any){
  const s=String(content?.status||content?.state||content?.result||'').toLowerCase();
  if(['settled','completed'].includes(s)) return 'settled';
  if(['failed','declined','rejected'].includes(s)) return 'failed';
  if(['reversed','returned'].includes(s)) return 'reversed';
  if(['refunded'].includes(s)) return 'refunded';
  if(['pending','processing','authorized','approved'].includes(s)) return s==='pending'?'pending':'processing';
  return 'pending';
}
Deno.serve(async(req)=>{
  if(req.method!=='POST') return json({error:'Method not allowed'},405);
  const raw=await req.text(); const secret=Deno.env.get('LITHIC_WEBHOOK_SECRET');
  if(!secret||!(await verify(raw,req.headers,secret))) return json({error:'Invalid webhook signature'},401);
  let event:any; try{event=JSON.parse(raw)}catch{return json({error:'Invalid JSON'},400)}
  const eventId=req.headers.get('webhook-id')||event.token||crypto.randomUUID();
  const type=event.event_type||event.type||'unknown'; const content=event.content||event.data||event;
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {data:inserted,error:insertErr}=await db.from('provider_webhook_events').insert({provider:'lithic',provider_event_id:eventId,event_type:type,payload:event}).select('id').maybeSingle();
  if(insertErr?.code==='23505') return json({ok:true,duplicate:true});
  if(insertErr) return json({error:insertErr.message},500);
  try{
    const providerRef=content?.token||content?.payment_token||content?.transaction_token||content?.payment?.token;
    if(providerRef && (String(type).includes('payment')||String(type).includes('financial'))){
      const status=normalizedStatus(content);
      const {data:m}=await db.from('money_movements').select('*').eq('provider_reference',providerRef).maybeSingle();
      if(m){
        await db.from('money_movements').update({status,updated_at:new Date().toISOString(),settled_at:status==='settled'?new Date().toISOString():m.settled_at,metadata:{...(m.metadata||{}),last_webhook_type:type,last_provider_payload:content}}).eq('id',m.id);
        if(status==='settled'){
          const signed=m.direction==='contribution'?Number(m.amount_cents):-Number(m.amount_cents);
          const {data:existingLedger}=await db.from('ledger_entries').select('id').eq('provider','lithic').eq('provider_reference',providerRef).maybeSingle();
          if(!existingLedger){
            const {error:ledgerErr}=await db.from('ledger_entries').insert({fund_id:m.fund_id,user_id:m.user_id,entry_type:m.direction==='contribution'?'contribution':'payout',amount_cents:signed,description:m.direction==='contribution'?'Bank contribution':'Payout to linked bank',provider:'lithic',provider_reference:providerRef,idempotency_key:m.idempotency_key,settled_at:new Date().toISOString(),metadata:{money_movement_id:m.id}});
            if(ledgerErr && ledgerErr.code!=='23505') throw ledgerErr;
          }
          await db.rpc('recalculate_fund_balance',{p_fund_id:m.fund_id});
        }
      }
    }
    if(String(type).includes('card_transaction')){
      const cardToken=content?.card_token||content?.card?.token;
      const txToken=content?.token||content?.transaction_token;
      if(cardToken&&txToken){
        const {data:card}=await db.from('cards').select('id,fund_id,user_id').eq('lithic_card_token',cardToken).maybeSingle();
        if(card){
          const status=String(content?.status||content?.result||'').toUpperCase();
          const pendingRaw=content?.amounts?.hold?.amount??content?.authorization_amount??0;
          const settledRaw=content?.amounts?.settlement?.amount??content?.settled_amount??0;
          const pending=Math.abs(Number(pendingRaw||0));
          const settledSigned=Number(settledRaw||0);
          const settledAbs=Math.abs(settledSigned);
          await db.from('card_transactions').upsert({fund_id:card.fund_id,user_id:card.user_id,card_id:card.id,lithic_transaction_token:txToken,merchant:content?.merchant?.descriptor||content?.merchant?.name||content?.merchant?.acceptor_name||content?.descriptor,amount_cents:settledAbs||pending,status,pending_amount_cents:pending,settled_amount_cents:settledAbs,raw:content,updated_at:new Date().toISOString()},{onConflict:'lithic_transaction_token'});
          const reservationState=status==='SETTLED'?'settled':(['VOIDED','EXPIRED'].includes(status)?status.toLowerCase():(status==='DECLINED'?'declined':'pending'));
          await db.from('card_authorization_reservations').update({status:reservationState,updated_at:new Date().toISOString()}).eq('transaction_token',txToken);
          if(status==='SETTLED'&&settledAbs>0){
            const signed=settledSigned>0?-settledAbs:settledSigned;
            const {data:existing}=await db.from('ledger_entries').select('id').eq('provider','lithic-card').eq('provider_reference',txToken).maybeSingle();
            let ledgerId=existing?.id;
            if(!ledgerId){
              const {data:entry,error:entryErr}=await db.from('ledger_entries').insert({fund_id:card.fund_id,user_id:card.user_id,entry_type:signed<0?'purchase':'refund',amount_cents:signed,description:content?.merchant?.descriptor||content?.merchant?.name||content?.descriptor||'Card transaction',provider:'lithic-card',provider_reference:txToken,settled_at:new Date().toISOString(),metadata:{card_id:card.id}}).select('id').single();
              if(entryErr&&entryErr.code!=='23505')throw entryErr; ledgerId=entry?.id;
            }
            if(ledgerId&&signed<0){
              const {data:hasAlloc}=await db.from('expense_allocations').select('id').eq('ledger_entry_id',ledgerId).limit(1);
              if(!hasAlloc?.length){
                const {data:members}=await db.from('fund_members').select('user_id,share_cents').eq('fund_id',card.fund_id).eq('status','active').order('joined_at');
                const rows=members||[]; const totalWeight=rows.reduce((a:any,m:any)=>a+Math.max(0,Number(m.share_cents||0)),0); let used=0;
                const allocations=rows.map((m:any,i:number)=>{let amt;i===rows.length-1?amt=settledAbs-used:amt=Math.floor(settledAbs*((totalWeight?Math.max(0,Number(m.share_cents||0))/totalWeight:1/Math.max(1,rows.length))));used+=amt;return{ledger_entry_id:ledgerId,fund_id:card.fund_id,user_id:m.user_id,amount_cents:amt}});
                if(allocations.length)await db.from('expense_allocations').insert(allocations);
              }
            }
            await db.rpc('recalculate_fund_balance',{p_fund_id:card.fund_id});
          }
          const {data:pendingRows}=await db.from('card_authorization_reservations').select('amount_cents').eq('fund_id',card.fund_id).eq('status','pending');
          const reserved=(pendingRows||[]).reduce((sum:any,r:any)=>sum+Number(r.amount_cents||0),0);
          await db.from('funds').update({reserved_balance_cents:reserved,available_balance_cents:Math.max(0,Number((await db.from('funds').select('current_balance_cents').eq('id',card.fund_id).single()).data?.current_balance_cents||0)-reserved),updated_at:new Date().toISOString()}).eq('id',card.fund_id);
        }
      }
    }
    await db.from('provider_webhook_events').update({processing_status:'processed',processed_at:new Date().toISOString()}).eq('id',inserted?.id);
    return json({ok:true});
  }catch(err:any){
    await db.from('provider_webhook_events').update({processing_status:'failed',processing_error:err.message,processed_at:new Date().toISOString()}).eq('id',inserted?.id);
    return json({error:'Webhook processing failed'},500);
  }
});
