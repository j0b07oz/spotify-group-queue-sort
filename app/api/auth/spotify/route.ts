import {NextResponse} from 'next/server';
import {createOAuthState} from '@/lib/oauth-state';
import {redirectUri,scopes} from '@/lib/spotify';

export async function GET(){
  const state=createOAuthState();
  const q=new URLSearchParams({
    client_id:process.env.SPOTIFY_CLIENT_ID||'',
    response_type:'code',
    redirect_uri:redirectUri(),
    scope:scopes.join(' '),
    state,
    show_dialog:'true'
  });
  const response=NextResponse.redirect(`https://accounts.spotify.com/authorize?${q}`);
  response.cookies.set('spotify_oauth_state',state,{
    httpOnly:true,
    sameSite:'lax',
    secure:process.env.NODE_ENV==='production',
    maxAge:600,
    path:'/'
  });
  return response;
}
