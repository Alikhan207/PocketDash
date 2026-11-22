"use client";
import {SignIn,SignUp,UserProfile} from '@clerk/nextjs';
import {useState} from 'react';
import Link from 'next/link';
export default function AccountAccess({mode='login',configured=false,demo=false}:{mode?:'login'|'signup'|'profile';configured?:boolean;demo?:boolean}){
 const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 async function openDemo(){setBusy(true);setError('');try{const r=await fetch('/api/demo',{method:'POST'});const b=await r.json();if(!r.ok)throw new Error(b.error);window.location.assign('/');}catch(e){setError(e instanceof Error?e.message:'Could not start demo.');setBusy(false);}}
 return <main className="mx-auto max-w-3xl px-5 py-12 space-y-6"><div><p className="text-primary font-semibold">POCKETDASH</p><h1 className="text-3xl font-bold mt-3">{mode==='profile'?'Your account':'More making. Less chasing.'}</h1><p className="text-muted-foreground mt-3">Your customers, invoices and next 90 days of cash, together.</p></div>
 {configured?(mode==='profile'?<UserProfile routing="hash"/>:mode==='signup'?<SignUp routing="hash"/>:<SignIn routing="hash"/>):<p className="rounded-xl border border-border p-5">Private sign-in is not configured on this installation. Set the Clerk keys listed in the README to enable seller accounts.</p>}
 {demo&&mode!=='profile'&&<section className="rounded-2xl border border-border p-6 space-y-3"><h2 className="text-xl font-semibold">Explore a fictional maker business</h2><p>Try invoices, reminders and cash scenarios in your own isolated demo workspace. Use fictional details only.</p><button className="rounded-full bg-primary text-primary-foreground px-6 py-3 font-semibold" onClick={openDemo} disabled={busy}>{busy?'Preparing your workspace…':'Try the demo'}</button></section>}
 {error&&<p role="alert" className="text-destructive">{error}</p>}
 {mode!=='profile'&&<Link href={mode==='signup'?'/login':'/signup'} className="underline">{mode==='signup'?'Already registered? Sign in':'Create a private account'}</Link>}
 </main>;
}
