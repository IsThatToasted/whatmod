import { CheckCircle2, Link2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppData } from '../contexts/AppDataContext'

export default function InvitePage(){
  const {token}=useParams(); const {consumeInvite}=useAppData(); const nav=useNavigate()
  const [state,setState]=useState<'ready'|'joining'|'done'|'error'>('ready'); const [message,setMessage]=useState('')
  async function join(){ if(!token)return; setState('joining'); try{const spaceId=await consumeInvite(token);setState('done');setTimeout(()=>nav(spaceId?`/spaces/${spaceId}`:'/spaces'),400)}catch(e){setMessage(e instanceof Error?e.message:'Invite could not be accepted.');setState('error')} }
  return <div className="page"><div className="large-empty invite-state">{state==='error'?<XCircle/>:state==='done'?<CheckCircle2/>:<Link2/>}<h2>{state==='done'?'You joined the space.':state==='error'?'This invite can’t be used.':'You’ve been invited to a JustGlance space.'}</h2><p>{message||'Shared tasks, shopping, chores, and activity will appear only after you accept.'}</p>{state==='ready'&&<button className="primary-button" onClick={join}>Join space</button>}{state==='joining'&&<button className="primary-button" disabled>Joining…</button>}{state==='error'&&<button className="secondary-button" onClick={()=>nav('/spaces')}>Back to Spaces</button>}</div></div>
}
