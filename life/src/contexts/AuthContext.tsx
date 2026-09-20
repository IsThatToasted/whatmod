import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { DEMO_MODE, HAS_SUPABASE } from '../lib/config'
import { supabase } from '../lib/supabase'
import { DEMO_USER_ID } from '../lib/demo'

type AuthContextValue = {
  user: User | null
  userId: string | null
  loading: boolean
  demo: boolean
  recoveryMode: boolean
  signIn(email:string,password:string):Promise<string|null>
  signUp(email:string,password:string,name:string):Promise<string|null>
  sendMagicLink(email:string):Promise<string|null>
  resetPassword(email:string):Promise<string|null>
  updatePassword(password:string):Promise<string|null>
  signOut():Promise<void>
  signInWithGoogle():Promise<string|null>
  deleteAccount():Promise<string|null>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const initialReturnRoute = new URL(location.href).searchParams.get('return')
const pendingRoute = () => location.hash.startsWith('#/invite/') ? location.hash.slice(1) : null
const authRedirectUrl = () => { const route=pendingRoute(); if(route)sessionStorage.setItem('justglance:returnRoute',route); const suffix=route?`?return=${encodeURIComponent(route)}`:''; return navigator.userAgent.includes('JustGlance-iOS') ? `justglance://auth-callback${suffix}` : `${location.origin}/life/${suffix}` }
const restoreReturnRoute = () => { const route=initialReturnRoute||sessionStorage.getItem('justglance:returnRoute'); if(route?.startsWith('/')){sessionStorage.removeItem('justglance:returnRoute');location.hash=route} }
export function AuthProvider({children}:{children:ReactNode}) {
  const [user,setUser] = useState<User|null>(null); const [loading,setLoading] = useState(true)
  const [recoveryMode,setRecoveryMode] = useState(false)
  const demo = DEMO_MODE || !HAS_SUPABASE
  useEffect(()=>{
    let active = true
    if (demo || !supabase) { setLoading(false); return }
    const client = supabase
    const timeout = window.setTimeout(() => {
      if (active) {
        console.warn('[JustGlance] Session restore timed out; continuing signed out.')
        setLoading(false)
      }
    }, 5000)
    client.auth.getSession()
      .then(({data})=>{
        if (!active) return
        setUser(data.session?.user ?? null)
        if(data.session?.user) restoreReturnRoute()
      })
      .catch(error=>{
        console.error('[JustGlance] Session restore failed', error)
        if (active) setUser(null)
      })
      .finally(()=>{
        if (active) {
          window.clearTimeout(timeout)
          setLoading(false)
        }
      })
    const {data:{subscription}} = client.auth.onAuthStateChange((event,s)=>{
      if (!active) return
      setUser(s?.user ?? null)
      if(event==='PASSWORD_RECOVERY')setRecoveryMode(true)
      if(event==='SIGNED_OUT')setRecoveryMode(false)
      if(s?.user)restoreReturnRoute()
    })
    return ()=>{
      active = false
      window.clearTimeout(timeout)
      subscription.unsubscribe()
    }
  },[demo])
  const value = useMemo<AuthContextValue>(()=>({
    user, userId: demo ? DEMO_USER_ID : user?.id ?? null, loading, demo, recoveryMode,
    async signIn(email,password){ if(!supabase)return null; const {error}=await supabase.auth.signInWithPassword({email,password}); return error?.message ?? null },
    async signUp(email,password,name){ if(!supabase)return null; const {error}=await supabase.auth.signUp({email,password,options:{data:{display_name:name,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone},emailRedirectTo:authRedirectUrl()}}); return error?.message ?? null },
    async sendMagicLink(email){ if(!supabase)return null; const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:authRedirectUrl()}}); return error?.message ?? null },
    async resetPassword(email){ if(!supabase)return null; const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:authRedirectUrl()}); return error?.message ?? null },
    async updatePassword(password){ if(!supabase)return 'Supabase is not configured.'; const {error}=await supabase.auth.updateUser({password}); if(!error)setRecoveryMode(false); return error?.message ?? null },
    async signOut(){ if(supabase) await supabase.auth.signOut() },
    async signInWithGoogle(){ if(!supabase)return null; const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:authRedirectUrl()}}); return error?.message ?? null },
    async deleteAccount(){ if(!supabase)return 'Account deletion is unavailable in demo mode.'; const {error}=await supabase.rpc('delete_my_account'); if(!error) await supabase.auth.signOut({scope:'local'}); return error?.message ?? null },
  }),[user,loading,demo,recoveryMode])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth(){ const v=useContext(AuthContext); if(!v)throw new Error('useAuth must be used inside AuthProvider'); return v }
