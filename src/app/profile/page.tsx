import AccountAccess from '@/components/AccountAccess';
import {getSessionUser,clerkConfigured} from '@/lib/session';
export default async function Page(){const u=await getSessionUser();return u?.isDemo?<main className="p-8 space-y-4"><h1 className="text-3xl font-bold">Fictional demo account</h1><p>This workspace belongs only to this demo session. Sign out to switch to a private seller account.</p></main>:<AccountAccess mode="profile" configured={clerkConfigured()}/>;}
