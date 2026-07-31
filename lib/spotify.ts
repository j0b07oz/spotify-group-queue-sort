import 'server-only';
import {database,unwrap} from './db';
import {decrypt,encrypt} from './crypto';
import {parseSpotifyResponse} from './spotify-response';

const BASE='https://api.spotify.com/v1';
const LOCAL_REDIRECT_URI='http://127.0.0.1:3000/api/auth/callback/spotify';

export function redirectUri(){
  const configured=process.env.SPOTIFY_REDIRECT_URI;
  if(!configured)return LOCAL_REDIRECT_URI;
  try{
    const uri=new URL(configured);
    if(uri.pathname.replace(/\/$/,'')==='/api/auth/spotify'){
      uri.pathname='/api/auth/callback/spotify';
      uri.search='';
      uri.hash='';
      return uri.toString();
    }
  }catch{
    // Let Spotify surface an invalid configured URI rather than masking it.
  }
  return configured;
}

async function token(body:URLSearchParams){
  const response=await fetch('https://accounts.spotify.com/api/token',{
    method:'POST',
    headers:{
      Authorization:`Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type':'application/x-www-form-urlencoded'
    },
    body
  });
  if(!response.ok)throw new Error(`Spotify authorization failed (${response.status})`);
  return response.json();
}

export async function exchange(code:string){
  return token(new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:redirectUri()}));
}

export async function roomToken(room:any){
  if(room.expires_at>Date.now()+60000)return decrypt(room.access_token);
  const fresh=await token(new URLSearchParams({
    grant_type:'refresh_token',
    refresh_token:await decrypt(room.refresh_token)
  }));
  unwrap(await database().from('rooms').update({
    access_token:await encrypt(fresh.access_token),
    refresh_token:fresh.refresh_token?await encrypt(fresh.refresh_token):room.refresh_token,
    expires_at:Date.now()+fresh.expires_in*1000
  }).eq('id',room.id));
  return fresh.access_token as string;
}

export async function spotify(path:string,access:string,init:RequestInit={},attempt=0):Promise<any>{
  const method=init.method||'GET';
  const response=await fetch(`${BASE}${path}`,{
    ...init,
    headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json',...init.headers},
    cache:'no-store'
  });
  if(response.status===429&&attempt<2){
    await new Promise(resolve=>setTimeout(resolve,Math.min(Number(response.headers.get('retry-after')||1),3)*1000));
    return spotify(path,access,init,attempt+1);
  }
  if(response.status===204)return null;
  if(!response.ok)throw new Error(`Spotify API ${method} ${path} ${response.status}: ${(await response.text()).slice(0,180)}`);
  return parseSpotifyResponse(response);
}

export const scopes=[
  'user-read-private',
  'playlist-read-private',
  'playlist-modify-private',
  'playlist-modify-public',
  'user-read-playback-state',
  'user-modify-playback-state'
];
