import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { cloudConfigured, supabase } from '../lib/supabase';

const NATIVE_AUTH_QUERY = 'af_native_auth';
const PENDING_KEY = 'af.nativeAuth.pending.v1';
const WEB_RETURN_URL = 'https://whatmod.com/app/';
const IOS_CALLBACK = 'aureliumfield://auth-callback';

function sleep(ms:number){ return new Promise(resolve=>window.setTimeout(resolve,ms)); }

function launchedFromNative(){
  try { return new URLSearchParams(window.location.search).get(NATIVE_AUTH_QUERY) === '1'; }
  catch { return false; }
}

function pendingNativeAuth(){
  try { return window.sessionStorage.getItem(PENDING_KEY) === '1'; }
  catch { return false; }
}

function markPending(value:boolean){
  try {
    if(value) window.sessionStorage.setItem(PENDING_KEY,'1');
    else window.sessionStorage.removeItem(PENDING_KEY);
  } catch { /* storage unavailable: bridge still has URL-mode fallback */ }
}

function callbackToIOS(session:Session){
  const params = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  markPending(false);
  window.location.replace(`${IOS_CALLBACK}#${params.toString()}`);
}

function callbackError(code:string){
  markPending(false);
  const params = new URLSearchParams({ error_code: code });
  window.location.replace(`${IOS_CALLBACK}?${params.toString()}`);
}

/**
 * WeTrack-style native auth broker.
 *
 * Native iOS opens the normal Aurelium web app in ASWebAuthenticationSession.
 * The web client owns the hosted Google OAuth flow, returns to the SAME production
 * web URL already used by browser login, and then hands only the finished session
 * to iOS through Aurelium's private callback scheme.
 *
 * This keeps the backend auth redirect surface web-only. The custom iOS scheme is
 * never supplied as the hosted auth redirectTo value.
 */
export function NativeAuthBridge({children}:{children:ReactNode}){
  const nativeLaunch = useMemo(()=>launchedFromNative(),[]);
  const [bridgeActive] = useState(()=>nativeLaunch || pendingNativeAuth());
  const [status,setStatus] = useState(nativeLaunch ? 'Opening secure sign in…' : 'Finishing sign in…');

  useEffect(()=>{
    if(!bridgeActive) return;
    let cancelled = false;

    const run = async()=>{
      if(!cloudConfigured || !supabase){ callbackError('AF-AUTH-103'); return; }

      // OAuth errors may be returned to the ordinary web URL. Convert them into a
      // private reference code rather than exposing provider/backend details.
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/,''));
      if(query.get('error') || query.get('error_code') || hash.get('error') || hash.get('error_code')){
        callbackError('AF-AUTH-104');
        return;
      }

      if(nativeLaunch){
        markPending(true);
        setStatus('Choose your Google account…');
        const { error } = await supabase.auth.signInWithOAuth({
          provider:'google',
          options:{
            // Important: this is the existing production WEB callback. iOS is not
            // added as a hosted-auth redirect target.
            redirectTo: WEB_RETURN_URL,
            queryParams:{ prompt:'select_account' }
          }
        });
        if(error && !cancelled) callbackError('AF-AUTH-103');
        return;
      }

      // We are back on the normal web app after hosted OAuth. detectSessionInUrl
      // may still be exchanging a PKCE code, so give it a short bounded window.
      setStatus('Finishing sign in…');
      for(let attempt=0; attempt<48 && !cancelled; attempt++){
        const { data, error } = await supabase.auth.getSession();
        if(error){ callbackError('AF-AUTH-104'); return; }
        if(data.session){ callbackToIOS(data.session); return; }
        await sleep(250);
      }
      if(!cancelled) callbackError('AF-AUTH-105');
    };

    void run();
    return()=>{ cancelled=true; };
  },[bridgeActive,nativeLaunch]);

  if(!bridgeActive) return children;
  return <div className="auth-screen"><div className="auth-card"><p className="eyebrow">Aurelium Field</p><h1>{status}</h1><p>Keep this window open. It will close automatically when sign in is complete.</p></div></div>;
}
