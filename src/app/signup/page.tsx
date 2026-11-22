import AccountAccess from '@/components/AccountAccess';
import {clerkConfigured} from '@/lib/session';
export default function Page(){return <AccountAccess mode="signup" configured={clerkConfigured()} demo={process.env.ENABLE_DEMO==='true'}/>;}
