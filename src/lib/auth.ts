"use client";
import {createContext,createElement,useContext,useState,useEffect,useCallback,type ReactNode} from 'react';
import {usePathname,useRouter} from 'next/navigation';
export interface AuthUser {id:string; email:string; name:string; role:string; isDemo?:boolean;}
interface AuthState {user:AuthUser|null; token:null; isAuthenticated:boolean; loading:boolean; login:(token:string,user?:AuthUser|null)=>void; logout:()=>Promise<void>; refresh:()=>Promise<void>;}
const Context=createContext<AuthState|null>(null);
export function AuthProvider({children,initialUser}:{children:ReactNode;initialUser?:AuthUser|null}) {
 const [user,setUser]=useState<AuthUser|null>(initialUser??null);
 const [loading,setLoading]=useState(false); const path=usePathname(); const router=useRouter();
 const refresh=useCallback(async()=>{setLoading(true);try{const r=await fetch('/api/auth/me',{cache:'no-store'});if(r.ok){const b=await r.json();setUser({...b.user,role:'Seller'});}else if(r.status===401)setUser(null);}finally{setLoading(false);}},[]);
 useEffect(()=>{if(!user&&!/^\/(login|signup|forgot-password|reset-password)/.test(path))router.replace('/login');},[path,user,router]);
 const logout=async()=>{const r=await fetch('/api/auth/logout',{method:'POST'});if(!r.ok)throw new Error('Sign-out failed. Retry.');setUser(null);window.location.assign('/login');};
 return createElement(Context.Provider,{value:{user,token:null,isAuthenticated:!!user,loading,refresh,logout,login:(_t:string,u?:AuthUser|null)=>{if(u)setUser({...u,role:'Seller'});else void refresh();}}},children);
}
export function useAuth(){const c=useContext(Context);if(!c)throw new Error('Missing AuthProvider');return c;}
export default AuthProvider;
