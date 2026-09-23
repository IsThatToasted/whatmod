import { CheckCircle2, ExternalLink, ListPlus, LoaderCircle, Pencil, Plus, Settings2, ShoppingBasket, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ItemCard } from '../components/ItemCard'
import { Modal } from '../components/Modal'
import { useAppData } from '../contexts/AppDataContext'
import { useAuth } from '../contexts/AuthContext'
import { lifeIntentParser } from '../lib/parser'
import { extractFirstUrl, fetchProductPreview, formatMoney, suggestShoppingList, type ProductPreview } from '../lib/productLinks'
import { DEFAULT_SPACE_PERMISSIONS, normalizeSpacePermissions } from '../lib/spacePermissions'
import type { ShoppingList } from '../types'

export default function ShoppingPage(){
  const {userId}=useAuth()
  const {spaces,members,items,shoppingLists,createShoppingList,updateShoppingList,archiveShoppingList,createItem,collaborationAvailable}=useAppData()
  const nav=useNavigate(); const [params,setParams]=useSearchParams()
  const requested=params.get('space')||''
  const [selectedSpace,setSelectedSpace]=useState(requested)
  const [selectedList,setSelectedList]=useState('')
  const [listOpen,setListOpen]=useState(false),[listName,setListName]=useState(''),[listError,setListError]=useState('')
  const [editingList,setEditingList]=useState<ShoppingList|null>(null),[editingListName,setEditingListName]=useState('')
  const [shoppingInput,setShoppingInput]=useState(''),[shoppingPreview,setShoppingPreview]=useState<ProductPreview|null>(null),[shoppingBusy,setShoppingBusy]=useState(false),[shoppingError,setShoppingError]=useState(''),[shoppingDestination,setShoppingDestination]=useState('')

  const allowedSpaces=useMemo(()=>spaces.filter(space=>{
    const member=members.find(m=>m.space_id===space.id&&m.user_id===userId)
    const elevated=space.is_personal||space.name==='Personal'||space.role==='owner'||space.role==='admin'||member?.role==='owner'||member?.role==='admin'
    return elevated||normalizeSpacePermissions(member?.permissions).view_shopping
  }),[spaces,members,userId])

  useEffect(()=>{
    const next=(requested&&allowedSpaces.some(space=>space.id===requested)?requested:'')||selectedSpace||allowedSpaces[0]?.id||''
    if(next!==selectedSpace)setSelectedSpace(next)
  },[requested,allowedSpaces,selectedSpace])

  useEffect(()=>{
    if(selectedSpace&&params.get('space')!==selectedSpace){const next=new URLSearchParams(params);next.set('space',selectedSpace);setParams(next,{replace:true})}
    setSelectedList('')
  },[selectedSpace])

  const space=allowedSpaces.find(candidate=>candidate.id===selectedSpace)||allowedSpaces[0]
  const member=space?members.find(m=>m.space_id===space.id&&m.user_id===userId):undefined
  const elevated=!!space&&(space.is_personal||space.name==='Personal'||space.role==='owner'||space.role==='admin'||member?.role==='owner'||member?.role==='admin')
  const permissions=elevated?normalizeSpacePermissions(DEFAULT_SPACE_PERMISSIONS):normalizeSpacePermissions(member?.permissions)
  const canEdit=elevated||permissions.edit_shopping
  const lists=useMemo(()=>shoppingLists.filter(list=>list.space_id===space?.id&&!list.archived_at),[shoppingLists,space?.id])
  const activeList=selectedList||lists[0]?.id||'general'
  const allShopping=useMemo(()=>items.filter(item=>item.type==='shopping'&&item.status==='open'&&(
    space?.is_personal||space?.name==='Personal' ? (item.space_id===space.id||!item.space_id) : item.space_id===space?.id
  )),[items,space])
  const visible=activeList==='general'?allShopping.filter(item=>!item.shopping?.list_id):allShopping.filter(item=>item.shopping?.list_id===activeList)
  const productUrl=useMemo(()=>extractFirstUrl(shoppingInput),[shoppingInput])
  const destinationList=shoppingDestination||activeList
  const suggestion=useMemo(()=>shoppingPreview?suggestShoppingList(shoppingPreview,lists):null,[shoppingPreview,lists])

  useEffect(()=>{if(!selectedList&&lists[0])setSelectedList(lists[0].id)},[selectedList,lists])
  useEffect(()=>{if(!shoppingInput.trim())setShoppingDestination(activeList)},[activeList,shoppingInput])
  useEffect(()=>{
    if(!productUrl){setShoppingPreview(null);setShoppingBusy(false);setShoppingError('');return}
    let cancelled=false;setShoppingBusy(true);setShoppingError('')
    const timer=setTimeout(()=>{void fetchProductPreview(productUrl).then(preview=>{
      if(cancelled)return;setShoppingPreview(preview);const suggested=suggestShoppingList(preview,lists);setShoppingDestination(suggested.list&&suggested.confidence>=.3?suggested.list.id:activeList)
    }).catch(()=>{if(!cancelled)setShoppingError('Could not inspect that product link. You can still save it manually.')}).finally(()=>{if(!cancelled)setShoppingBusy(false)})},300)
    return()=>{cancelled=true;clearTimeout(timer)}
  },[productUrl,lists,activeList])

  async function addShopping(){
    if(!space||!shoppingInput.trim()||!canEdit)return
    setShoppingError('')
    try{
      const url=extractFirstUrl(shoppingInput);let preview=shoppingPreview
      if(url&&!preview){setShoppingBusy(true);preview=await fetchProductPreview(url);setShoppingPreview(preview)}
      const title=preview?.title||shoppingInput.replace(url||'','').trim()||shoppingInput.trim()
      const base=lifeIntentParser.parse(`buy ${title}`)
      const parsed={...base,type:'shopping' as const,title,context:preview?.store||base.context,tags:[...new Set([...(base.tags||[]),'shopping',...(url?['product-link']:[])])]}
      const target=destinationList==='general'?null:destinationList
      await createItem(parsed,shoppingInput,{space_id:space.id,description:preview?.description||null,shopping:{quantity:1,preferred_store:preview?.store||base.context||null,estimated_price:preview?.price??null,aisle_category:preview?.category||null,list_id:target,source_url:preview?.canonical_url||preview?.url||url||null,image_url:preview?.image_url||null,currency:preview?.currency||null,product_id:preview?.product_id||null,product_metadata:preview?{brand:preview.brand||null,description:preview.description||null,source:preview.source,...(preview.metadata||{})}:{}}})
      setSelectedList(target||'general');setShoppingInput('');setShoppingPreview(null);setShoppingDestination('')
    }catch(e){setShoppingError(e instanceof Error?e.message:'Could not add that shopping item.')}finally{setShoppingBusy(false)}
  }

  async function makeList(){if(!space||!listName.trim())return;setListError('');try{const created=await createShoppingList(space.id,listName.trim());setSelectedList(created.id);setListName('');setListOpen(false)}catch(e){setListError(e instanceof Error?e.message:'Could not create list.')}}
  function beginEditList(list:ShoppingList){setEditingList(list);setEditingListName(list.name)}
  async function saveList(){if(!editingList||!editingListName.trim())return;await updateShoppingList(editingList.id,{name:editingListName.trim()});setEditingList(null)}
  async function removeList(){if(!editingList)return;await archiveShoppingList(editingList.id);if(selectedList===editingList.id)setSelectedList('general');setEditingList(null)}

  return <div className="page organizer-page shopping-page">
    <header className="page-header"><div><span className="eyebrow">SHOPPING</span><h1>Every list, one place.</h1><p>Groceries, wish lists, product links and shared shopping stay here instead of being buried inside a Space.</p></div>{space&&!space.is_personal&&space.name!=='Personal'&&<button className="secondary-button" onClick={()=>nav(`/spaces/${space.id}`)}><Settings2 size={17}/>Manage {space.name}</button>}</header>
    {!collaborationAvailable&&<div className="migration-banner"><strong>Named shopping lists need the collaboration schema.</strong><span>Run the current master schema repair in Supabase.</span></div>}
    <div className="shopping-space-switcher">{allowedSpaces.map(candidate=><button key={candidate.id} className={candidate.id===space?.id?'active':''} onClick={()=>setSelectedSpace(candidate.id)}><span>{candidate.name}</span>{candidate.name!=='Personal'&&!candidate.is_personal&&<small>shared</small>}</button>)}</div>
    {!space?<div className="empty-state large"><ShoppingBasket/><strong>No shopping space yet.</strong><span>Create a Space first, then shopping lists can live inside it.</span></div>:<>
      <section className="panel-card shopping-workspace">
        <div className="section-heading inline"><div><span className="eyebrow">{space.name}</span><h2>Shopping lists</h2></div>{canEdit&&<button className="mini-action" onClick={()=>setListOpen(true)}><ListPlus size={15}/>New list</button>}</div>
        <div className="shopping-list-tabs managed-tabs">
          {lists.map(list=><div className="shopping-list-tab-wrap" key={list.id}><button className={activeList===list.id?'active':''} onClick={()=>setSelectedList(list.id)}>{list.name}<span>{allShopping.filter(item=>item.shopping?.list_id===list.id).length}</span></button>{canEdit&&<button className="shopping-list-edit" onClick={()=>beginEditList(list)} aria-label={`Edit ${list.name}`}><Pencil size={13}/></button>}</div>)}
          <button className={activeList==='general'?'active':''} onClick={()=>setSelectedList('general')}>General<span>{allShopping.filter(item=>!item.shopping?.list_id).length}</span></button>
        </div>
        {canEdit?<div className="smart-shopping-box"><div className="smart-shopping-input"><Sparkles size={17}/><input value={shoppingInput} onChange={e=>setShoppingInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!shoppingBusy)void addShopping()}} placeholder={`Add to ${lists.find(list=>list.id===activeList)?.name||'General'} or paste a product link…`}/><button className="primary-button" onClick={addShopping} disabled={!shoppingInput.trim()||shoppingBusy}>{shoppingBusy?<LoaderCircle className="spin" size={17}/>:<Plus size={17}/>}Add</button></div>
          {productUrl&&<div className="product-link-preview">{shoppingPreview?.image_url?<img src={shoppingPreview.image_url} alt="" referrerPolicy="no-referrer"/>:<div className="product-image-placeholder"><ShoppingBasket size={22}/></div>}<div className="product-preview-main"><span className="eyebrow">PRODUCT LINK</span><strong>{shoppingPreview?.title||(shoppingBusy?'Reading product…':'Product link')}</strong><div className="product-preview-meta"><span>{shoppingPreview?.store||new URL(productUrl).hostname.replace(/^www\./,'')}</span>{formatMoney(shoppingPreview?.price,shoppingPreview?.currency)&&<span>{formatMoney(shoppingPreview?.price,shoppingPreview?.currency)}</span>}{shoppingPreview?.brand&&<span>{shoppingPreview.brand}</span>}</div>{shoppingPreview?.source==='url-fallback'&&!shoppingBusy&&<small>Basic preview only. The product-preview Edge Function or Chrome extension can extract richer title, image and price data.</small>}{suggestion?.list&&suggestion.confidence>=.3&&<small><Sparkles size={12}/>Looks like <b>{suggestion.list.name}</b>{suggestion.reason?` · matched ${suggestion.reason}`:''}</small>}</div><div className="product-preview-actions"><label>Save to<select value={destinationList} onChange={e=>setShoppingDestination(e.target.value)}>{lists.map(list=><option key={list.id} value={list.id}>{list.name}</option>)}<option value="general">General</option></select></label><a className="icon-button" href={productUrl} target="_blank" rel="noreferrer" aria-label="Open product"><ExternalLink size={17}/></a></div></div>}
          {shoppingError&&<div className="form-message">{shoppingError}</div>}</div>:<div className="permission-note">You can view shopping in this Space, but your permissions do not allow changes.</div>}
        <div className="item-stack">{visible.map(item=><ItemCard key={item.id} item={item}/>)}</div>{!visible.length&&<div className="empty-row"><CheckCircle2 size={16}/>This list is clear.</div>}
      </section>
    </>}
    <Modal open={listOpen} onClose={()=>{setListOpen(false);setListError('')}} title="New shopping list"><div className="form-stack"><label>List name<input autoFocus value={listName} onChange={e=>setListName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void makeList()}} placeholder="Groceries, Lingerie/Panties, Heels…"/></label>{listError&&<div className="form-message">{listError}</div>}<button className="primary-button" disabled={!listName.trim()} onClick={makeList}><ListPlus size={17}/>Create list</button></div></Modal>
    <Modal open={!!editingList} onClose={()=>setEditingList(null)} title="Edit shopping list"><div className="form-stack"><label>List name<input autoFocus value={editingListName} onChange={e=>setEditingListName(e.target.value)}/></label><div className="row-actions"><button className="text-button danger-text" onClick={removeList}>Archive list</button><button className="primary-button" onClick={saveList} disabled={!editingListName.trim()}>Save changes</button></div></div></Modal>
  </div>
}
