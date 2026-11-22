import type {Metadata} from 'next';
import {ClerkProvider} from '@clerk/nextjs';
import {AuthProvider} from '@/lib/auth';
import {getSessionUser,clerkConfigured} from '@/lib/session';
import AppShell from '@/components/AppShell';
import './globals.css';
export const metadata:Metadata={title:'PocketDash | Your maker business, in order',description:'Invoices, payment follow-ups and a clear view of your next 90 days of cash.'};
export const dynamic='force-dynamic';
export default async function RootLayout({children}:{children:React.ReactNode}) {
 const user=await getSessionUser().catch(()=>null);
 const app=<AuthProvider initialUser={user?{id:user.id,email:user.email,name:user.name??'Seller',role:'Seller',isDemo:user.isDemo}:null}><AppShell>{children}</AppShell></AuthProvider>;
 return <html lang="en"><body>{clerkConfigured()?<ClerkProvider signInUrl="/login" signUpUrl="/signup" signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/">{app}</ClerkProvider>:app}</body></html>;
}
