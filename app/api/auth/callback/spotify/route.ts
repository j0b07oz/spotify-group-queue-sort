import {randomBytes} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {encrypt} from '@/lib/crypto';
import {database,unwrap} from '@/lib/db';
import {exchange,spotify} from '@/lib/spotify';

export async function GET(req:NextRequest){
  const url=req.nextUrl;
  const code=url.searchParams.get('code');
  const state=url.searchParams.get('state');
  const cookieState=req.cookies.get('spotify_oauth_state')?.value;
  const cookieMatches=Boolean(state&&cookieState===state);

  if(!code||!state||!cookieMatches){
    console.warn('[spotify-oauth] state rejected',{
      hasCode:Boolean(code),
      hasState:Boolean(state),
      hasCookie:Boolean(cookieState),
      cookieMatches
    });
    const response=NextResponse.json({error:'Invalid or expired authorization state'},{status:400});
    response.headers.set('Cache-Control','no-store');
    return response;
  }

  try{
    const tokens=await exchange(code);
    const me=await spotify('/me',tokens.access_token);
    const playlist=await spotify(
      `/users/${encodeURIComponent(me.id)}/playlists`,
      tokens.access_token,
      {method:'POST',body:JSON.stringify({name:'Mixroom Party Queue',description:'Collaborative queue ordered by Mixroom',public:false})}
    );
    const share=randomBytes(6).toString('base64url');
    const secret=randomBytes(24).toString('base64url');
    unwrap(await database().from('rooms').insert({
      share_code:share,
      host_secret:secret,
      name:`${me.display_name||'Host'}’s room`,
      host_spotify_id:me.id,
      playlist_id:playlist.id,
      access_token:await encrypt(tokens.access_token),
      refresh_token:await encrypt(tokens.refresh_token),
      expires_at:Date.now()+tokens.expires_in*1000
    }));
    const response=NextResponse.redirect(new URL(`/room/${share}`,url));
    response.cookies.set(`host_${share}`,secret,{
      httpOnly:true,
      sameSite:'lax',
      secure:process.env.NODE_ENV==='production',
      maxAge:60*60*24*30,
      path:'/'
    });
    response.cookies.delete('spotify_oauth_state');
    console.info('[spotify-oauth] room created',{shareCode:share});
    return response;
  }catch(error){
    console.error('[spotify-oauth] callback failed',{error:error instanceof Error?error.message:String(error)});
    const response=NextResponse.json({error:error instanceof Error?error.message:'Spotify setup failed'},{status:502});
    response.headers.set('Cache-Control','no-store');
    return response;
  }
}
