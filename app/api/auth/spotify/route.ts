import {randomBytes} from 'node:crypto';
import {NextResponse} from 'next/server';
import {redirectUri,scopes} from '@/lib/spotify';

export async function GET(){
  const state=randomBytes(24).toString('base64url');
  const query=new URLSearchParams({
    client_id:process.env.SPOTIFY_CLIENT_ID||'',
    response_type:'code',
    redirect_uri:redirectUri(),
    scope:scopes.join(' '),
    state,
    show_dialog:'true'
  });
  const response=NextResponse.redirect(`https://accounts.spotify.com/authorize?${query}`);
  const production=process.env.NODE_ENV==='production';
  response.cookies.set('spotify_oauth_state',state,{
    httpOnly:true,
    sameSite:production?'none':'lax',
    secure:production,
    maxAge:600,
    path:'/',
    priority:'high'
  });
  response.headers.set('Cache-Control','no-store');
  return response;
}
