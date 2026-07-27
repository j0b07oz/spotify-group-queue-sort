import 'server-only';
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

const STATE_TTL_SECONDS=10*60;

function stateSecret(){
  const secret=process.env.TOKEN_ENCRYPTION_KEY||process.env.SPOTIFY_CLIENT_SECRET;
  if(!secret)throw new Error('OAuth state secret is not configured');
  return secret;
}

function signature(payload:string){
  return createHmac('sha256',stateSecret()).update(payload).digest();
}

export function createOAuthState(now=Date.now()){
  const issuedAt=Math.floor(now/1000).toString(36);
  const nonce=randomBytes(24).toString('base64url');
  const payload=`${issuedAt}.${nonce}`;
  return `${payload}.${signature(payload).toString('base64url')}`;
}

export function verifyOAuthState(state:string,now=Date.now()){
  const [issuedAt,nonce,encodedSignature,...extra]=state.split('.');
  if(!issuedAt||!nonce||!encodedSignature||extra.length)return false;
  const issuedSeconds=Number.parseInt(issuedAt,36);
  const nowSeconds=Math.floor(now/1000);
  if(!Number.isFinite(issuedSeconds)||issuedSeconds>nowSeconds+60||nowSeconds-issuedSeconds>STATE_TTL_SECONDS)return false;
  const expected=signature(`${issuedAt}.${nonce}`);
  const actual=Buffer.from(encodedSignature,'base64url');
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
