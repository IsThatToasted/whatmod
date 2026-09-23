import { ArrowLeft, CalendarDays, CheckCircle2, Copy, ExternalLink, FolderKanban, Link2, ListPlus, LoaderCircle, Plus, ShieldCheck, ShoppingBasket, Sparkles, StickyNote, UserCog, UserPlus, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppData } from '../contexts/AppDataContext'
import { useAuth } from '../contexts/AuthContext'
import { ItemCard } from '../components/ItemCard'
import { lifeIntentParser } from '../lib/parser'
import { DEFAULT_SPACE_PERMISSIONS, normalizeSpacePermissions, SPACE_PERMISSION_GROUPS } from '../lib/spacePermissions'
import { extractFirstUrl, fetchProductPreview, formatMoney, suggestShoppingList, type ProductPreview } from '../lib/productLinks'
import { Modal } from '../components/Modal'
import type { SpaceMember, SpacePermissions } from '../types'

export default function SpacePage(){
  const {id}=useParams(); const nav=useNavigate(); const {userId,user,demo}=useAuth()
  const {spaces,members,items,createItem,activity,createInvite,shoppingLists,createShoppingList,updateMemberAccess,collaborationAvailable}=useAppData()
  const space=spaces.find(s=>s.id===id)
  const [text,setText]=useState('')
  const [inviteOpen,setInviteOpen]=useState(false); const [email,setEmail]=useState(''); const [inviteRole,setInviteRole]=useState<'member'|'admin'>('member'); const [invitePermissions,setInvitePermissions]=useState<SpacePermissions>({...DEFAULT_SPACE_PERMISSIONS}); const [inviteLink,setInviteLink]=useState(''); const [inviteExpiry,setInviteExpiry]=useState(''); const [inviteError,setInviteError]=useState(''); const [inviteSaving,setInviteSaving]=useState(false)
  const [listOpen,setListOpen]=useState(false); const [listName,setListName]=useState(''); const [listError,setListError]=useState(''); const [selectedList,setSelectedList]=useState('')
  const [manageMember,setManageMember]=useState<SpaceMember|null>(null); const [memberPermissions,setMemberPermissions]=useState<SpacePermissions>({...DEFAULT_SPACE_PERMISSIONS}); const [memberRole,setMemberRole]=useState<'member'|'admin'>('member'); const [memberError,setMemberError]=useState(''); const [memberSaving,setMemberSaving]=useState(false)
  const [shoppingInput,setShoppingInput]=useState(''); const [shoppingPreview,setShoppingPreview]=useState<ProductPreview|null>(null); const [shoppingBusy,setShoppingBusy]=useState(false); const [shoppingError,setShoppingError]=useState(''); const [shoppingDestination,setShoppingDestination]=useState('')

  const spaceMembers=members.filter(m=>m.space_id===id)
  const me=spaceMembers.find(m=>m.user_id===userId)
  const canManage=space?.role==='owner'||space?.role==='admin'||me?.role==='owner'||me?.role==='admin'
  const myPermissions=canManage?normalizeSpacePermissions(DEFAULT_SPACE_PERMISSIONS):normalizeSpacePermissions(me?.permissions)
  const canInvite=!space?.is_personal&&(canManage||myPermissions.invite_members)
  const relevant=useMemo(()=>items.filter(i=>i.space_id===id&&i.status==='open'),[items,id])
  const allShopping=relevant.filter(i=>i.type==='shopping')
  const other=relevant.filter(i=>i.type!=='shopping')
  const lists=useMemo(()=>shoppingLists.filter(list=>list.space_id===id&&!list.archived_at),[shoppingLists,id])
  const activeList=selectedList || lists[0]?.id || 'general'
  const shop=activeList==='general' ? allShopping.filter(item=>!item.shopping?.list_id) : allShopping.filter(item=>item.shopping?.list_id===activeList)
  const proposed=useMemo(()=>text.trim()?lifeIntentParser.parse(text):null,[text])
  const canAdd=proposed?.type==='shopping'?myPermissions.edit_shopping:myPermissions.edit_tasks
  const productUrl=useMemo(()=>extractFirstUrl(shoppingInput),[shoppingInput])
  const destinationList=shoppingDestination||activeList
  const suggestion=useMemo(()=>shoppingPreview?suggestShoppingList(shoppingPreview,lists):null,[shoppingPreview,lists])

  useEffect(()=>{if(!selectedList&&lists[0])setSelectedList(lists[0].id)},[selectedList,lists])
  useEffect(()=>{if(!shoppingInput.trim())setShoppingDestination(activeList)},[activeList,shoppingInput])

  useEffect(()=>{
    if(!productUrl){setShoppingPreview(null);setShoppingBusy(false);setShoppingError('');return}
    let cancelled=false
    setShoppingBusy(true);setShoppingError('')
    const timer=setTimeout(()=>{
      void fetchProductPreview(productUrl).then(preview=>{
        if(cancelled)return
        setShoppingPreview(preview)
        const suggested=suggestShoppingList(preview,lists)
        if(suggested.list&&suggested.confidence>=.3)setShoppingDestination(suggested.list.id)
        else setShoppingDestination(activeList)
      }).catch(()=>{if(!cancelled)setShoppingError('Could not inspect that product link. You can still save it manually.')}).finally(()=>{if(!cancelled)setShoppingBusy(false)})
    },350)
    return()=>{cancelled=true;clearTimeout(timer)}
  },[productUrl,lists,activeList])

  async function add(){
    if(!text.trim()||!id||!proposed)return
    const shopping = proposed.type==='shopping' ? { preferred_store: proposed.context || null, ...(collaborationAvailable&&activeList!=='general'?{list_id:activeList}:{}) } : undefined
    await createItem(proposed,text,{space_id:id,shopping})
    setText('')
  }

  async function addShopping(){
    if(!shoppingInput.trim()||!id||!myPermissions.edit_shopping)return
    setShoppingError('')
    try{
      const url=extractFirstUrl(shoppingInput)
      let preview=shoppingPreview
      if(url&&!preview){setShoppingBusy(true);preview=await fetchProductPreview(url);setShoppingPreview(preview)}
      const title=preview?.title||shoppingInput.replace(url||'','').trim()||shoppingInput.trim()
      const base=lifeIntentParser.parse(`buy ${title}`)
      const parsed={...base,type:'shopping' as const,title,context:preview?.store||base.context,tags:[...new Set([...(base.tags||[]),'shopping',...(url?['product-link']:[])])]}
      const target=destinationList==='general'?null:destinationList
      await createItem(parsed,shoppingInput,{
        space_id:id,
        description:preview?.description||null,
        shopping:{
          quantity:1,
          preferred_store:preview?.store||base.context||null,
          estimated_price:preview?.price??null,
          aisle_category:preview?.category||null,
          list_id:target,
          source_url:preview?.canonical_url||preview?.url||url||null,
          image_url:preview?.image_url||null,
          currency:preview?.currency||null,
          product_id:preview?.product_id||null,
          product_metadata:preview?{brand:preview.brand||null,description:preview.description||null,source:preview.source,...(preview.metadata||{})}:{},
        }
      })
      if(target)setSelectedList(target)
      else setSelectedList('general')
      setShoppingInput('');setShoppingPreview(null);setShoppingDestination('');setShoppingError('')
    }catch(e){setShoppingError(e instanceof Error?e.message:'Could not add that shopping item.')}
    finally{setShoppingBusy(false)}
  }

  async function makeInvite(){
    if(!id)return
    setInviteError(''); setInviteSaving(true)
    try{
      const result=await createInvite(id,email.trim()||undefined,inviteRole,invitePermissions)
      setInviteLink(`${location.origin}/life/#/invite/${encodeURIComponent(result.token)}`)
      setInviteExpiry(result.expires_at)
    }catch(e){setInviteError(e instanceof Error?e.message:'Could not create invite.')}
    finally{setInviteSaving(false)}
  }

  async function makeList(){
    if(!id||!listName.trim())return
    setListError('')
    try{const created=await createShoppingList(id,listName.trim());setSelectedList(created.id);setListName('');setListOpen(false)}
    catch(e){setListError(e instanceof Error?e.message:'Could not create list.')}
  }

  function startManage(member: SpaceMember){setManageMember(member);setMemberPermissions(normalizeSpacePermissions(member.permissions));setMemberRole(member.role==='admin'?'admin':'member');setMemberError('')}
  async function saveMember(){
    if(!id||!manageMember)return
    setMemberSaving(true);setMemberError('')
    try{await updateMemberAccess(id,manageMember.user_id,memberPermissions,memberRole);setManageMember(null)}
    catch(e){setMemberError(e instanceof Error?e.message:'Could not update access.')}
    finally{setMemberSaving(false)}
  }

  function togglePermission(target:'invite'|'member',key:keyof SpacePermissions,value:boolean){
    const set=target==='invite'?setInvitePermissions:setMemberPermissions
    set(current=>{
      const next={...current,[key]:value}
      if(String(key).startsWith('view_')&&!value){const edit=`edit_${String(key).slice(5)}` as keyof SpacePermissions; if(edit in next)(next as any)[edit]=false}
      if(String(key).startsWith('edit_')&&value){const view=`view_${String(key).slice(5)}` as keyof SpacePermissions;if(view in next)(next as any)[view]=true}
      return next
    })
  }

  if(!space)return <div className="page"><div className="large-empty"><h2>That space isn’t available.</h2><button className="secondary-button" onClick={()=>nav('/spaces')}>Back to spaces</button></div></div>

  return <div className="page">
    <button className="text-button" onClick={()=>nav('/spaces')}><ArrowLeft size={16}/>Spaces</button>
    <header className="page-header compact"><div><span className="eyebrow">SHARED SPACE</span><h1>{space.name}</h1><p><Users size={16}/> {space.role||me?.role||'member'} access · updates sync in realtime</p></div>{canInvite&&<button className="secondary-button" onClick={()=>{setInvitePermissions({...myPermissions});setInviteOpen(true)}}><UserPlus size={17}/>Invite</button>}</header>

    {demo&&<div className="migration-banner"><strong>You are viewing demo data.</strong><span>Demo mode cannot create invite links for other people. Sign in to the Supabase-backed app to use real shared spaces.</span></div>}
    {!collaborationAvailable&&<div className="migration-banner"><strong>Shared-space upgrade is not active yet.</strong><span>Run <code>003_shared_spaces_smart_intake.sql</code> in Supabase. Existing data stays intact.</span></div>}

    <div className="space-access-strip"><span><ShieldCheck size={15}/>{demo?'Demo mode':user?.email||'Signed in'}</span><span>{space.role||me?.role||'member'}</span>{SPACE_PERMISSION_GROUPS.filter(group=>myPermissions[group.view]).map(group=><span key={group.key}>{group.label}</span>)}{canInvite&&<span>Invites</span>}</div>

    <div className="space-detail-grid"><section>
      <div className="quick-add"><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&canAdd)void add()}} placeholder="Add a task, reminder, chore…"/><button className="primary-button square" onClick={add} disabled={!text.trim()||!canAdd}><Plus/></button></div>
      {proposed&&!canAdd&&<div className="permission-note">Your access allows you to view this category, but not add or edit it.</div>}

      {myPermissions.view_shopping&&<>
        <div className="section-heading inline"><h2><ShoppingBasket size={18}/> Shopping lists</h2>{myPermissions.edit_shopping&&<button className="mini-action" onClick={()=>setListOpen(true)}><ListPlus size={15}/>New list</button>}</div>
        <div className="shopping-list-tabs">{lists.map(list=><button key={list.id} className={activeList===list.id?'active':''} onClick={()=>setSelectedList(list.id)}>{list.name}<span>{allShopping.filter(item=>item.shopping?.list_id===list.id).length}</span></button>)}<button className={activeList==='general'?'active':''} onClick={()=>setSelectedList('general')}>General<span>{allShopping.filter(item=>!item.shopping?.list_id).length}</span></button></div>

        {myPermissions.edit_shopping&&<div className="smart-shopping-box">
          <div className="smart-shopping-input"><Sparkles size={17}/><input value={shoppingInput} onChange={e=>setShoppingInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!shoppingBusy)void addShopping()}} placeholder={`Add to ${lists.find(list=>list.id===activeList)?.name||'General'} or paste a product link…`}/><button className="primary-button" onClick={addShopping} disabled={!shoppingInput.trim()||shoppingBusy}>{shoppingBusy?<LoaderCircle className="spin" size={17}/>:<Plus size={17}/>}Add</button></div>
          {productUrl&&<div className="product-link-preview">
            {shoppingPreview?.image_url?<img src={shoppingPreview.image_url} alt="" referrerPolicy="no-referrer"/>:<div className="product-image-placeholder"><ShoppingBasket size={22}/></div>}
            <div className="product-preview-main">
              <span className="eyebrow">PRODUCT LINK</span>
              <strong>{shoppingPreview?.title||(shoppingBusy?'Reading product…':'Product link')}</strong>
              <div className="product-preview-meta"><span>{shoppingPreview?.store||new URL(productUrl).hostname.replace(/^www\./,'')}</span>{formatMoney(shoppingPreview?.price,shoppingPreview?.currency)&&<span>{formatMoney(shoppingPreview?.price,shoppingPreview?.currency)}</span>}{shoppingPreview?.brand&&<span>{shoppingPreview.brand}</span>}</div>
              {shoppingPreview?.source==='url-fallback'&&!shoppingBusy&&<small>Basic link preview only. Deploy the included product-preview Edge Function for server-side title/image/price extraction; the Chrome extension captures page metadata directly.</small>}
              {suggestion?.list&&suggestion.confidence>=.3&&<small><Sparkles size={12}/>Looks like <b>{suggestion.list.name}</b>{suggestion.reason?` · matched ${suggestion.reason}`:''}</small>}
            </div>
            <div className="product-preview-actions"><label>Save to<select value={destinationList} onChange={e=>setShoppingDestination(e.target.value)}>{lists.map(list=><option key={list.id} value={list.id}>{list.name}</option>)}<option value="general">General</option></select></label><a className="icon-button" href={productUrl} target="_blank" rel="noreferrer" aria-label="Open product"><ExternalLink size={17}/></a></div>
          </div>}
          {shoppingError&&<div className="form-message">{shoppingError}</div>}
        </div>}

        {shop.length?shop.map(i=><ItemCard key={i.id} item={i}/>):<div className="empty-row"><CheckCircle2 size={16}/>This shopping list is clear.</div>}
      </>}

      {myPermissions.view_tasks&&<><div className="section-heading inline top-gap"><h2>Tasks & chores</h2><span>{other.length}</span></div>{other.length?other.map(i=><ItemCard key={i.id} item={i}/>):<div className="empty-row">No shared tasks waiting.</div>}</>}
    </section>

    <aside className="context-panel">
      <div className="context-card"><strong>Members</strong><div className="member-list">{spaceMembers.map(m=><div className="member-row member-row-manage" key={m.user_id}><span className="member-avatar">{(m.greeting_name||m.display_name||'M')[0].toUpperCase()}</span><span><b>{m.greeting_name||m.display_name}</b><small>{m.role}{m.user_id===userId?' · you':''}</small></span>{canManage&&m.role!=='owner'&&<button className="member-manage-button" onClick={()=>startManage(m)} aria-label={`Manage ${m.display_name}`}><UserCog size={15}/></button>}</div>)}</div></div>
      <div className="context-card"><strong>Recent activity</strong>{activity.filter(a=>a.space_id===id).slice(0,5).map(a=><p key={a.id}>{a.actor_name||'Someone'} {a.action} <b>{a.entity_title}</b></p>)}{activity.filter(a=>a.space_id===id).length===0&&<p>Activity will appear here as members make changes.</p>}</div>
      <div className="context-card"><strong>Category access</strong><div className="access-summary"><span><ShoppingBasket size={14}/>Shopping</span><span><CheckCircle2 size={14}/>Tasks</span><span><CalendarDays size={14}/>Calendar</span><span><StickyNote size={14}/>Thoughts/files</span><span><FolderKanban size={14}/>Projects</span></div><p>Owners and admins can decide which categories each member can view or change.</p></div>
      <div className="context-card"><strong>Smart shopping</strong><p>Paste a product URL into a shopping list. JustGlance will keep the link, preview data, price and image when available, and suggest the best named list.</p></div>
      {!canInvite&&<div className="context-card"><strong>Invites</strong><p>You’re signed in as a member of this space. An owner/admin must enable invite permission before this account can create links.</p></div>}
    </aside></div>

    <Modal open={inviteOpen} onClose={()=>{setInviteOpen(false);setInviteLink('');setInviteExpiry('');setInviteError('')}} title={`Invite to ${space.name}`}><div className="form-stack">{!inviteLink?<>
      <label>Email (optional)<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="person@example.com"/></label>
      {(space.role==='owner'||me?.role==='owner')&&<label>Role<select value={inviteRole} onChange={e=>setInviteRole(e.target.value as 'member'|'admin')}><option value="member">Member</option><option value="admin">Admin</option></select></label>}
      <div className="permission-editor"><div className="permission-head"><strong>Category permissions</strong><span>View / change</span></div>{SPACE_PERMISSION_GROUPS.map(group=><div className="permission-row" key={group.key}><span>{group.label}</span><label><input type="checkbox" checked={invitePermissions[group.view]} onChange={e=>togglePermission('invite',group.view,e.target.checked)}/>View</label><label><input type="checkbox" checked={invitePermissions[group.edit]} onChange={e=>togglePermission('invite',group.edit,e.target.checked)}/>Edit</label></div>)}<div className="permission-row single"><span>Can create invite links</span><label><input type="checkbox" checked={invitePermissions.invite_members} onChange={e=>togglePermission('invite','invite_members',e.target.checked)}/>Allow</label></div></div>
      <p className="muted">Leave email blank for a shareable link. Email-bound links only work for that signed-in email.</p>{inviteError&&<div className="form-message">{inviteError}</div>}<button className="primary-button" onClick={makeInvite} disabled={inviteSaving}><Link2 size={17}/>{inviteSaving?'Creating…':'Create invite link'}</button>
    </>:<><label>Secure invite link<input value={inviteLink} readOnly/></label><button className="primary-button" onClick={async()=>{await navigator.clipboard.writeText(inviteLink)}}><Copy size={17}/>Copy link</button><p className="muted">Expires {inviteExpiry?new Date(inviteExpiry).toLocaleString():'in seven days'}. The raw token is only shown here; Supabase stores its hash.</p></>}</div></Modal>

    <Modal open={listOpen} onClose={()=>{setListOpen(false);setListError('')}} title="New shopping list"><div className="form-stack"><label>List name<input autoFocus value={listName} onChange={e=>setListName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void makeList()}} placeholder="Groceries, Lingerie/Panties, Heels…"/></label>{listError&&<div className="form-message">{listError}</div>}<button className="primary-button" disabled={!listName.trim()} onClick={makeList}><ListPlus size={17}/>Create list</button></div></Modal>

    <Modal open={!!manageMember} onClose={()=>setManageMember(null)} title={manageMember?`Access for ${manageMember.greeting_name||manageMember.display_name}`:'Member access'}><div className="form-stack">{manageMember&&<>
      {(space.role==='owner'||me?.role==='owner')&&<label>Role<select value={memberRole} onChange={e=>setMemberRole(e.target.value as 'member'|'admin')}><option value="member">Member</option><option value="admin">Admin</option></select></label>}
      <div className="permission-editor"><div className="permission-head"><strong>Category permissions</strong><span>View / change</span></div>{SPACE_PERMISSION_GROUPS.map(group=><div className="permission-row" key={group.key}><span>{group.label}</span><label><input type="checkbox" checked={memberPermissions[group.view]} onChange={e=>togglePermission('member',group.view,e.target.checked)}/>View</label><label><input type="checkbox" checked={memberPermissions[group.edit]} onChange={e=>togglePermission('member',group.edit,e.target.checked)}/>Edit</label></div>)}<div className="permission-row single"><span>Can create invite links</span><label><input type="checkbox" checked={memberPermissions.invite_members} onChange={e=>togglePermission('member','invite_members',e.target.checked)}/>Allow</label></div></div>
      {memberError&&<div className="form-message">{memberError}</div>}<button className="primary-button" onClick={saveMember} disabled={memberSaving}>{memberSaving?'Saving…':'Save access'}</button>
    </>}</div></Modal>
  </div>
}
