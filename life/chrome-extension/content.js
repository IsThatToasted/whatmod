(() => {
  if (window.top !== window || document.getElementById('__justglance_extension_host')) return;

  const HINTS = {
    heels: ['heel','heels','stiletto','stilettos','pump','pumps','platform','platforms','sandal','sandals','shoe','shoes','boot','boots','wedge','wedges'],
    lingerie: ['lingerie','panty','panties','thong','thongs','bra','bras','bralette','bodysuit','teddy','garter','lace','underwear','intimates'],
    groceries: ['food','grocery','groceries','snack','drink','beverage','produce','meat','dairy','pantry'],
    beauty: ['beauty','makeup','cosmetic','cosmetics','skincare','skin','hair','fragrance','perfume'],
    home: ['home','house','decor','kitchen','bath','bedroom','furniture','household'],
    tech: ['tech','electronics','computer','phone','tablet','gaming','cable','charger']
  };

  const state = { open: false, lists: [], paired: false, error: '', product: null, selectedKey: '', saving: false, message: '' };
  const host = document.createElement('div');
  host.id = '__justglance_extension_host';
  const shadow = host.attachShadow({ mode: 'open' });
  document.documentElement.appendChild(host);

  const style = document.createElement('style');
  style.textContent = `
    :host{all:initial}*{box-sizing:border-box}button,input,select,textarea{font:inherit}
    .jg-button{position:fixed;left:16px;bottom:16px;z-index:2147483646;border:1px solid rgba(255,255,255,.14);border-radius:16px;background:#91d3b4;color:#10251d;box-shadow:0 14px 36px rgba(0,0,0,.28);min-height:48px;padding:0 16px;display:flex;gap:9px;align-items:center;font:800 14px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease}.jg-button:hover{transform:translateY(-2px);box-shadow:0 18px 42px rgba(0,0,0,.34)}.jg-button svg{width:19px;height:19px}
    .jg-panel{position:fixed;left:16px;bottom:76px;z-index:2147483647;width:min(390px,calc(100vw - 32px));max-height:min(720px,calc(100vh - 96px));overflow:auto;border:1px solid #304039;border-radius:24px;background:#111714;color:#f2f5f2;box-shadow:0 24px 70px rgba(0,0,0,.46);font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.jg-panel[hidden]{display:none}.head{display:flex;align-items:center;justify-content:space-between;padding:17px 18px 12px;position:sticky;top:0;background:#111714;z-index:2}.brand{display:flex;align-items:center;gap:10px}.orb{width:32px;height:32px;border-radius:11px;background:#91d3b4;color:#10251d;display:grid;place-items:center;font-weight:900}.brand b{font-size:16px}.brand small{display:block;color:#9eaaa4;font-size:11px;margin-top:1px}.close{border:0;background:#202824;color:#cad3ce;width:34px;height:34px;border-radius:11px;cursor:pointer}.body{padding:0 18px 18px}.preview{display:grid;grid-template-columns:78px minmax(0,1fr);gap:13px;padding:12px;border:1px solid #2d3933;border-radius:18px;background:#18201c}.img{width:78px;height:92px;border-radius:13px;background:#242e29;object-fit:cover}.img.blank{display:grid;place-items:center;color:#8ea096}.preview strong{display:block;font-size:14px;line-height:1.3;max-height:54px;overflow:hidden}.meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.pill{padding:4px 7px;border-radius:999px;background:#27312d;color:#bfc9c4;font-size:11px}.form{display:grid;gap:11px;margin-top:14px}.form label{display:grid;gap:5px;color:#b8c3bd;font-size:12px;font-weight:700}.form input,.form select,.form textarea{width:100%;border:1px solid #34423b;border-radius:12px;background:#171e1b;color:#f4f6f4;padding:10px 11px;outline:none}.form input:focus,.form select:focus,.form textarea:focus{border-color:#91d3b4}.two{display:grid;grid-template-columns:1fr 1fr;gap:9px}.primary,.secondary{border:0;border-radius:13px;min-height:44px;padding:0 14px;font-weight:850;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px}.primary{background:#91d3b4;color:#10251d}.primary:disabled{opacity:.5;cursor:default}.secondary{background:#242e29;color:#e8eeea;border:1px solid #35433c}.hint{margin:11px 0 0;color:#9eaaa4;font-size:12px}.suggestion{margin-top:10px;padding:9px 10px;border-radius:12px;background:#1d2a24;color:#bfe9d5;font-size:12px}.error{margin-top:10px;padding:10px;border-radius:12px;background:#3a1e20;color:#ffd7d9;font-size:12px}.success{margin-top:10px;padding:10px;border-radius:12px;background:#183326;color:#c5f3dc;font-size:12px}.pair{display:grid;gap:10px}.pair h3{margin:0;font-size:17px}.pair p{margin:0;color:#aab5af}.pair code{font-size:11px;color:#bfe9d5}.foot{display:flex;justify-content:space-between;gap:8px;margin-top:12px}.foot button{font-size:11px;border:0;background:none;color:#9eaaa4;cursor:pointer;padding:4px}.loading{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
    @media(max-width:520px){.jg-button{left:10px;bottom:10px}.jg-panel{left:10px;bottom:68px;width:calc(100vw - 20px);max-height:calc(100vh - 80px)}}
  `;
  shadow.appendChild(style);
  const root = document.createElement('div'); shadow.appendChild(root);

  const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>`;

  function send(message) { return new Promise(resolve => chrome.runtime.sendMessage(message, resolve)); }
  function esc(value='') { return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function money(price,currency='USD'){ if(price==null||price==='')return ''; try{return new Intl.NumberFormat(undefined,{style:'currency',currency:currency||'USD'}).format(Number(price))}catch{return `${currency||'$'} ${Number(price).toFixed(2)}`}}
  function attr(sel, name='content') { return document.querySelector(sel)?.getAttribute(name)?.trim() || ''; }
  function firstText(sel) { return document.querySelector(sel)?.textContent?.trim() || ''; }
  function numberPrice(raw){ if(raw==null)return null; const n=Number(String(raw).replace(/[^0-9.\-]/g,'')); return Number.isFinite(n)?n:null; }
  function absUrl(value){ if(!value)return ''; try{return new URL(value,location.href).href}catch{return value} }

  function walkProduct(node){
    if(!node)return null;
    if(Array.isArray(node)){for(const x of node){const y=walkProduct(x);if(y)return y}return null}
    if(typeof node!=='object')return null;
    const t=node['@type']; if(t==='Product'||(Array.isArray(t)&&t.includes('Product')))return node;
    for(const key of ['@graph','mainEntity','itemListElement','item']){const y=walkProduct(node[key]);if(y)return y}
    return null;
  }
  function firstString(value){if(typeof value==='string'&&value.trim())return value.trim();if(Array.isArray(value)){for(const v of value){const x=firstString(v);if(x)return x}}if(value&&typeof value==='object')return firstString(value.url)||firstString(value.contentUrl)||firstString(value.name)||firstString(value.value);return ''}
  function jsonLdProduct(){for(const node of document.querySelectorAll('script[type="application/ld+json"]')){try{const p=walkProduct(JSON.parse(node.textContent||''));if(p)return p}catch{}}return null}
  function scrapeProduct(){
    const p=jsonLdProduct(); const offers=Array.isArray(p?.offers)?p.offers[0]:p?.offers;
    const canonical=attr('link[rel="canonical"]','href')||location.href;
    const title=firstString(p?.name)||attr('meta[property="og:title"]')||attr('meta[name="twitter:title"]')||firstText('h1')||document.title||location.hostname;
    const image=firstString(p?.image)||attr('meta[property="og:image"]')||attr('meta[name="twitter:image"]')||attr('meta[itemprop="image"]')||document.querySelector('img[src]')?.src||'';
    const rawPrice=(offers?.price ?? offers?.lowPrice ?? attr('meta[property="product:price:amount"]')) || attr('meta[itemprop="price"]') || firstText('[itemprop="price"]');
    const price=numberPrice(rawPrice);
    const currency=firstString(offers?.priceCurrency)||attr('meta[property="product:price:currency"]')||attr('meta[itemprop="priceCurrency"]')||'USD';
    const brand=firstString(p?.brand)||attr('meta[name="brand"]');
    const category=firstString(p?.category)||attr('meta[property="product:category"]')||attr('meta[name="category"]')||'';
    const productId=firstString(p?.sku)||firstString(p?.productID)||firstString(p?.mpn)||attr('meta[property="product:retailer_item_id"]');
    const description=firstString(p?.description)||attr('meta[property="og:description"]')||attr('meta[name="description"]');
    return { title, url:absUrl(canonical), imageUrl:absUrl(image), price, currency:String(currency||'USD').toUpperCase(), store:location.hostname.replace(/^www\./,''), category, brand, productId, description };
  }
  function words(value){return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(x=>x.length>2)}
  function suggestList(product,lists){
    const hay=[product.title,product.category,product.brand,product.store,product.description,product.url].filter(Boolean).join(' ').toLowerCase();
    let best=null,bestScore=0,reasons=[];
    for(const list of lists){let score=0,r=[];for(const word of words(list.list_name)){if(hay.includes(word)){score+=5;r.push(word)}for(const hint of (HINTS[word]||[])){if(new RegExp(`\\b${hint}\\b`,'i').test(hay)){score+=3;r.push(hint)}}}for(const [family,hints] of Object.entries(HINTS)){if(!String(list.list_name).toLowerCase().includes(family))continue;for(const hint of hints){if(new RegExp(`\\b${hint}\\b`,'i').test(hay)){score+=3;r.push(hint)}}}if(score>bestScore){best=list;bestScore=score;reasons=[...new Set(r)].slice(0,3)}}
    return { list:best, confidence:Math.min(.99,bestScore/10), reason:reasons.join(', ') };
  }
  function keyFor(list){return `${list.space_id}|${list.list_id||''}`}
  function listByKey(key){return state.lists.find(x=>keyFor(x)===key)||null}

  async function loadStatus(){
    const result=await send({type:'JG_STATUS'});
    if(!result?.ok){state.error=result?.error||'Could not connect to JustGlance.';return}
    state.paired=result.paired; state.lists=result.lists||[]; state.error=result.error||'';
    if(state.paired&&state.lists.length&&state.product){const suggested=suggestList(state.product,state.lists);state.selectedKey=suggested.list?keyFor(suggested.list):keyFor(state.lists[0])}
  }
  function render(){
    const suggested=state.product?suggestList(state.product,state.lists):{list:null,confidence:0,reason:''};
    root.innerHTML=`
      <button class="jg-button" id="jg-toggle">${icon}<span>Add to JustGlance</span></button>
      <section class="jg-panel" id="jg-panel" ${state.open?'':'hidden'}>
        <div class="head"><div class="brand"><span class="orb">J</span><span><b>Add to JustGlance</b><small>Smart shopping capture</small></span></div><button class="close" id="jg-close">✕</button></div>
        <div class="body">${state.paired?renderProduct(suggested):renderPair()}</div>
      </section>`;
    root.querySelector('#jg-toggle')?.addEventListener('click',toggle);
    root.querySelector('#jg-close')?.addEventListener('click',()=>{state.open=false;render()});
    bindPanel();
  }
  function renderPair(){return `<div class="pair"><h3>Connect this browser</h3><p>In JustGlance open <b>Settings → Add to JustGlance</b>, create a pairing code, then paste it here.</p><label>Pairing code<input id="jg-token" placeholder="jgext_…" autocomplete="off"></label><button class="primary" id="jg-pair">Connect JustGlance</button>${state.error?`<div class="error">${esc(state.error)}</div>`:''}<p class="hint">The code is shopping-only and revocable. Your Supabase password/session is never stored in the extension.</p></div>`}
  function renderProduct(suggested){
    const p=state.product||scrapeProduct(); const listOptions=state.lists.map(l=>`<option value="${esc(keyFor(l))}" ${keyFor(l)===state.selectedKey?'selected':''}>${esc(l.space_name)} · ${esc(l.list_name)}</option>`).join('');
    return `<div class="preview">${p.imageUrl?`<img class="img" src="${esc(p.imageUrl)}" referrerpolicy="no-referrer">`:`<div class="img blank">🛍</div>`}<div><strong>${esc(p.title)}</strong><div class="meta"><span class="pill">${esc(p.store)}</span>${p.price!=null?`<span class="pill">${esc(money(p.price,p.currency))}</span>`:''}${p.brand?`<span class="pill">${esc(p.brand)}</span>`:''}</div></div></div>
      ${suggested.list&&suggested.confidence>=.3?`<div class="suggestion">✨ Suggested: <b>${esc(suggested.list.list_name)}</b>${suggested.reason?` · ${esc(suggested.reason)}`:''}</div>`:''}
      <div class="form"><label>Item title<input id="jg-title" value="${esc(p.title)}"></label><div class="two"><label>Price<input id="jg-price" type="number" min="0" step="0.01" value="${p.price??''}"></label><label>Currency<input id="jg-currency" maxlength="3" value="${esc(p.currency||'USD')}"></label></div><label>Save to<select id="jg-list">${listOptions}</select></label><label>Notes / size / color<textarea id="jg-notes" rows="2" placeholder="Optional details…"></textarea></label><button class="primary" id="jg-save" ${state.saving||!state.lists.length?'disabled':''}>${state.saving?'Saving…':'Add to shopping list'}</button>${state.message?`<div class="success">${esc(state.message)}</div>`:''}${state.error?`<div class="error">${esc(state.error)}</div>`:''}</div><div class="foot"><button id="jg-refresh">Refresh lists</button><button id="jg-unpair">Disconnect browser</button></div>`;
  }
  function bindPanel(){
    root.querySelector('#jg-pair')?.addEventListener('click',async()=>{state.error='';const token=root.querySelector('#jg-token')?.value?.trim();const result=await send({type:'JG_PAIR',token});if(!result?.ok){state.error=result?.error||'Pairing failed.'}else{state.paired=true;state.lists=result.lists||[];const sug=suggestList(state.product||scrapeProduct(),state.lists);state.selectedKey=sug.list?keyFor(sug.list):state.lists[0]?keyFor(state.lists[0]):''}render()});
    root.querySelector('#jg-list')?.addEventListener('change',e=>{state.selectedKey=e.target.value});
    root.querySelector('#jg-save')?.addEventListener('click',saveProduct);
    root.querySelector('#jg-refresh')?.addEventListener('click',async()=>{const result=await send({type:'JG_LISTS'});if(result?.ok){state.lists=result.lists||[];if(!listByKey(state.selectedKey)&&state.lists[0])state.selectedKey=keyFor(state.lists[0]);state.error=''}else state.error=result?.error||'Could not refresh lists.';render()});
    root.querySelector('#jg-unpair')?.addEventListener('click',async()=>{await send({type:'JG_UNPAIR'});state.paired=false;state.lists=[];state.selectedKey='';state.message='';render()});
  }
  async function saveProduct(){
    const selected=listByKey(root.querySelector('#jg-list')?.value||state.selectedKey); if(!selected){state.error='Choose a shopping list first.';render();return}
    const product={...state.product,title:root.querySelector('#jg-title')?.value?.trim()||state.product.title,price:numberPrice(root.querySelector('#jg-price')?.value),currency:(root.querySelector('#jg-currency')?.value||'USD').trim().toUpperCase()};
    state.saving=true;state.error='';state.message='';render();
    const result=await send({type:'JG_ADD_PRODUCT',spaceId:selected.space_id,listId:selected.list_id||null,product,notes:root.querySelector('#jg-notes')?.value?.trim()||''});
    state.saving=false;if(!result?.ok)state.error=result?.error||'Could not save product.';else state.message=`Added to ${selected.list_name}.`;render();
  }
  async function toggle(){state.open=!state.open;if(state.open){state.product=scrapeProduct();state.message='';state.error='';await loadStatus();if(state.paired&&state.lists.length){const sug=suggestList(state.product,state.lists);state.selectedKey=sug.list?keyFor(sug.list):state.selectedKey||keyFor(state.lists[0])}}render()}

  chrome.runtime.onMessage.addListener(message=>{if(message?.type==='JG_TOGGLE_PANEL'){void toggle()}});
  state.product=scrapeProduct(); render();
})();
