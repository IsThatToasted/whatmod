import { CheckCircle2, Home, Plus, ShoppingBasket, UserCog, UserPlus, UsersRound, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { useAppData } from '../contexts/AppDataContext'
import { useAuth } from '../contexts/AuthContext'
import { DEFAULT_SPACE_PERMISSIONS, normalizeSpacePermissions, SPACE_PERMISSION_GROUPS } from '../lib/spacePermissions'
import { supabase } from '../lib/supabase'
import type { SpaceMember, SpacePermissions } from '../types'

type PendingInvite = {
  id: string
  space_id: string
  invite_email?: string | null
  role: 'member' | 'admin'
  permissions?: Partial<SpacePermissions> | null
  expires_at: string
  created_at: string
}

type PersonGroup = {
  user_id: string
  display_name: string
  greeting_name?: string | null
  avatar_url?: string | null
  memberships: SpaceMember[]
}

type AccessDraft = { role: 'member' | 'admin'; permissions: SpacePermissions }

function memberAccessLabel(member: SpaceMember) {
  if (member.role === 'owner' || member.role === 'admin') return member.role === 'owner' ? 'Owner · full access' : 'Admin · full access'
  const permissions = normalizeSpacePermissions(member.permissions)
  const editable = SPACE_PERMISSION_GROUPS.filter(group => permissions[group.edit]).length
  const visible = SPACE_PERMISSION_GROUPS.filter(group => permissions[group.view]).length
  if (editable === SPACE_PERMISSION_GROUPS.length) return 'All categories · edit'
  if (editable) return `${editable} edit · ${visible} visible`
  if (visible) return `${visible} categories · view only`
  return 'No category access'
}

export default function SpacesPage(){
  const {spaces,members,items,createSpace,updateMemberAccess}=useAppData()
  const {user,userId,demo}=useAuth()
  const nav=useNavigate()
  const [open,setOpen]=useState(false),[name,setName]=useState(''),[error,setError]=useState('')
  const [pendingInvites,setPendingInvites]=useState<PendingInvite[]>([]),[pendingError,setPendingError]=useState('')
  const [managePersonId,setManagePersonId]=useState(''),[accessDrafts,setAccessDrafts]=useState<Record<string,AccessDraft>>({}),[accessBusy,setAccessBusy]=useState(false),[accessError,setAccessError]=useState('')

  const sharedSpaces=useMemo(()=>spaces.filter(space=>!space.is_personal&&space.name!=='Personal'),[spaces])
  const sharedIds=useMemo(()=>new Set(sharedSpaces.map(space=>space.id)),[sharedSpaces])
  const people=useMemo<PersonGroup[]>(()=>{
    const map=new Map<string,PersonGroup>()
    for(const member of members){
      if(member.user_id===userId||!sharedIds.has(member.space_id))continue
      const current=map.get(member.user_id)||{user_id:member.user_id,display_name:member.display_name,greeting_name:member.greeting_name,avatar_url:member.avatar_url,memberships:[]}
      current.memberships.push(member)
      map.set(member.user_id,current)
    }
    return [...map.values()].sort((a,b)=>(a.greeting_name||a.display_name).localeCompare(b.greeting_name||b.display_name))
  },[members,sharedIds,userId])
  const managePerson=people.find(person=>person.user_id===managePersonId)||null

  function myMembership(spaceId:string){return members.find(member=>member.space_id===spaceId&&member.user_id===userId)}
  function canManageSpace(spaceId:string){const space=spaces.find(candidate=>candidate.id===spaceId),mine=myMembership(spaceId);return !!(space?.role==='owner'||space?.role==='admin'||mine?.role==='owner'||mine?.role==='admin')}
  function amOwner(spaceId:string){const space=spaces.find(candidate=>candidate.id===spaceId),mine=myMembership(spaceId);return !!(space?.role==='owner'||mine?.role==='owner')}

  async function save(){if(!name.trim())return;setError('');try{await createSpace(name.trim());setName('');setOpen(false)}catch(e){setError(e instanceof Error?e.message:'Could not create that space.')}}

  async function loadPendingInvites(){
    if(demo||!supabase||!userId){setPendingInvites([]);return}
    const {data,error}=await supabase.from('invites').select('id,space_id,invite_email,role,permissions,expires_at,created_at').eq('created_by',userId).is('accepted_at',null).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false})
    if(error){setPendingError(error.message);return}
    setPendingError('');setPendingInvites((data||[]) as PendingInvite[])
  }
  useEffect(()=>{void loadPendingInvites()},[demo,userId,spaces.length])

  async function revokePendingInvite(id:string){
    if(!supabase)return
    const {error}=await supabase.from('invites').delete().eq('id',id)
    if(error){setPendingError(error.message);return}
    setPendingInvites(current=>current.filter(invite=>invite.id!==id))
  }

  function openPersonAccess(person:PersonGroup){
    const drafts:Record<string,AccessDraft>={}
    for(const membership of person.memberships)drafts[membership.space_id]={role:membership.role==='admin'?'admin':'member',permissions:normalizeSpacePermissions(membership.permissions)}
    setAccessDrafts(drafts);setManagePersonId(person.user_id);setAccessError('')
  }
  function setDraftRole(spaceId:string,role:'member'|'admin'){setAccessDrafts(current=>({...current,[spaceId]:{...(current[spaceId]||{permissions:{...DEFAULT_SPACE_PERMISSIONS}}),role}}))}
  function toggleDraftPermission(spaceId:string,key:keyof SpacePermissions,checked:boolean){
    setAccessDrafts(current=>{const original=current[spaceId]||{role:'member' as const,permissions:{...DEFAULT_SPACE_PERMISSIONS}};const permissions={...original.permissions,[key]:checked};for(const group of SPACE_PERMISSION_GROUPS){if(key===group.view&&!checked)permissions[group.edit]=false;if(key===group.edit&&checked)permissions[group.view]=true}return {...current,[spaceId]:{...original,permissions}}})
  }
  async function savePersonAccess(){
    if(!managePerson)return
    setAccessBusy(true);setAccessError('')
    try{
      for(const membership of managePerson.memberships){
        if(!canManageSpace(membership.space_id)||membership.role==='owner')continue
        const draft=accessDrafts[membership.space_id]
        if(!draft)continue
        await updateMemberAccess(membership.space_id,managePerson.user_id,draft.permissions,amOwner(membership.space_id)?draft.role:undefined)
      }
      setManagePersonId('')
    }catch(e){setAccessError(e instanceof Error?e.message:'Could not update that person’s access.')}
    finally{setAccessBusy(false)}
  }

  return <div className="page organizer-page spaces-directory-page">
    <header className="page-header"><div><span className="eyebrow">SHARING</span><h1>People first. Spaces second.</h1><p>A person can belong to more than one Space. See everyone you share with here, then adjust what they can view or edit in each Space.</p></div><button className="primary-button" onClick={()=>setOpen(true)}><Plus size={18}/>New space</button></header>
    <div className="account-status-card"><strong>{demo?'Demo mode':'Signed in'}</strong><span>{demo?'Shared links are disabled in demo mode.':user?.email||'Supabase account'}</span></div>

    <section className="people-access-section">
      <div className="section-heading inline"><div><span className="eyebrow">PEOPLE & ACCESS</span><h2>{people.length?`${people.length} ${people.length===1?'person':'people'} connected`:'Nobody else has joined yet'}</h2><p>Manage one person across every shared Space you can administer.</p></div></div>
      {people.length?<div className="people-access-grid">{people.map(person=>{
        const name=person.greeting_name||person.display_name||'Member';const manageable=person.memberships.some(m=>canManageSpace(m.space_id)&&m.role!=='owner')
        return <article className="person-access-card" key={person.user_id}><div className="person-access-top"><span className="member-avatar large">{person.avatar_url?<img src={person.avatar_url} alt=""/>:name[0].toUpperCase()}</span><div><strong>{name}</strong><span>{person.memberships.length} shared {person.memberships.length===1?'space':'spaces'}</span></div>{manageable&&<button className="mini-action" onClick={()=>openPersonAccess(person)}><UserCog size={15}/>Manage</button>}</div><div className="person-space-list">{person.memberships.map(membership=>{const space=spaces.find(candidate=>candidate.id===membership.space_id);return <button type="button" key={membership.space_id} onClick={()=>nav(`/spaces/${membership.space_id}`)}><Home size={14}/><span><b>{space?.name||'Shared space'}</b><small>{memberAccessLabel(membership)}</small></span></button>})}</div></article>
      })}</div>:<div className="sharing-empty"><UsersRound/><div><strong>Invite someone from a Space.</strong><span>Once they join, they appear here even if you later share additional Spaces with them.</span></div></div>}
    </section>

    {pendingInvites.length>0&&<section className="pending-invites-section"><div className="section-heading inline"><div><span className="eyebrow">PENDING</span><h2>Invite links waiting to be used</h2></div></div><div className="pending-invite-list">{pendingInvites.map(invite=>{const space=spaces.find(candidate=>candidate.id===invite.space_id);return <div className="pending-invite-row" key={invite.id}><span className="pending-icon"><UserPlus size={16}/></span><div><strong>{invite.invite_email||'Shareable invite link'}</strong><small>{space?.name||'Shared space'} · {invite.role} · expires {new Date(invite.expires_at).toLocaleDateString()}</small></div><button className="text-button danger-text" onClick={()=>void revokePendingInvite(invite.id)}>Revoke</button></div>})}</div>{pendingError&&<div className="form-message">{pendingError}</div>}</section>}

    <section className="spaces-list-section"><div className="section-heading inline"><div><span className="eyebrow">YOUR SPACES</span><h2>Shared areas of your life</h2><p>Open a Space to invite people, view its activity, or jump into one of its categories.</p></div></div><div className="space-grid">{sharedSpaces.map(space=>{const count=items.filter(i=>i.space_id===space.id&&i.status==='open').length;const shop=items.filter(i=>i.space_id===space.id&&i.type==='shopping'&&i.status==='open').length;const memberCount=members.filter(member=>member.space_id===space.id).length;return <button className="space-card" key={space.id} onClick={()=>nav(`/spaces/${space.id}`)}><div className="space-icon"><Home/></div><div><h2>{space.name}</h2><p><UsersRound size={15}/> {memberCount} {memberCount===1?'person':'people'} · {space.role||'member'}</p><div className="space-card-meta"><span>{count} open</span>{shop>0&&<span className="space-shopping"><ShoppingBasket size={14}/>{shop} shopping</span>}</div></div></button>})}{sharedSpaces.length===0&&<div className="large-empty"><UsersRound/><h2>No shared spaces yet.</h2><p>Create one for a household, relationship, trip, team, or anything you want to share.</p></div>}</div></section>

    <Modal open={open} onClose={()=>setOpen(false)} title="Create a shared space"><div className="form-stack"><label>Space name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Home" autoFocus/></label>{error&&<div className="form-message">{error}</div>}<button className="primary-button" onClick={save} disabled={!name.trim()}>Create space</button></div></Modal>

    <Modal open={!!managePerson} onClose={()=>setManagePersonId('')} title={managePerson?`Access for ${managePerson.greeting_name||managePerson.display_name}`:'Person access'}>
      <div className="form-stack global-access-editor">{managePerson&&<><p className="modal-intro">This is the same person across every Space below. Change category access here instead of opening each Space individually.</p>{managePerson.memberships.map(membership=>{const space=spaces.find(candidate=>candidate.id===membership.space_id);const draft=accessDrafts[membership.space_id]||{role:membership.role==='admin'?'admin':'member',permissions:normalizeSpacePermissions(membership.permissions)};const manageable=canManageSpace(membership.space_id)&&membership.role!=='owner';const owner=amOwner(membership.space_id);return <section className={`global-space-access ${manageable?'':'read-only'}`} key={membership.space_id}><div className="global-space-access-head"><div><strong>{space?.name||'Shared space'}</strong><span>{manageable?'You can manage access here.':'Read only from your account.'}</span></div><button className="icon-button subtle" onClick={()=>nav(`/spaces/${membership.space_id}`)} aria-label={`Open ${space?.name||'space'}`}><Home size={15}/></button></div>{manageable?<><label>Role<select value={draft.role} onChange={e=>setDraftRole(membership.space_id,e.target.value as 'member'|'admin')} disabled={!owner}><option value="member">Member</option><option value="admin">Admin</option></select>{!owner&&<small>Only the Space owner can change admin status.</small>}</label><div className="permission-editor compact"><div className="permission-head"><strong>Categories</strong><span>View / edit</span></div>{SPACE_PERMISSION_GROUPS.map(group=><div className="permission-row" key={group.key}><span>{group.label}</span><label><input type="checkbox" checked={draft.permissions[group.view]} onChange={e=>toggleDraftPermission(membership.space_id,group.view,e.target.checked)}/>View</label><label><input type="checkbox" checked={draft.permissions[group.edit]} onChange={e=>toggleDraftPermission(membership.space_id,group.edit,e.target.checked)}/>Edit</label></div>)}<div className="permission-row single"><span>Can invite others</span><label><input type="checkbox" checked={draft.permissions.invite_members} onChange={e=>toggleDraftPermission(membership.space_id,'invite_members',e.target.checked)}/>Allow</label></div></div></>:<div className="access-readonly-summary"><CheckCircle2 size={15}/>{memberAccessLabel(membership)}</div>}</section>})}{accessError&&<div className="form-message">{accessError}</div>}<div className="row-actions sticky-modal-actions"><button className="secondary-button" onClick={()=>setManagePersonId('')}><X size={16}/>Cancel</button><button className="primary-button" onClick={savePersonAccess} disabled={accessBusy}>{accessBusy?'Saving…':'Save access across spaces'}</button></div></>}</div>
    </Modal>
  </div>
}
