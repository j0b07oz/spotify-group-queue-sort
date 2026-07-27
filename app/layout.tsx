import './styles.css'; import type {Metadata} from 'next';
export const metadata:Metadata={title:'Mixroom — Spotify party queues',description:'Build a better party queue, together.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
