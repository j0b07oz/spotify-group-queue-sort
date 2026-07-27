import {cookies} from 'next/headers'; import {notFound} from 'next/navigation'; import {roomByCode} from '@/lib/rooms'; import Room from './room';
export default async function Page({params}:{params:Promise<{code:string}>}){const {code}=await params,r=roomByCode(code);if(!r)notFound();const host=(await cookies()).get(`host_${code}`)?.value===r.host_secret;return <Room code={code} isHost={host}/>}
