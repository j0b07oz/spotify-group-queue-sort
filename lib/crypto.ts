import 'server-only'; import {createHash} from 'node:crypto'; import {EncryptJWT,jwtDecrypt} from 'jose';
const key=()=>{const v=process.env.TOKEN_ENCRYPTION_KEY;if(!v||v.length<32)throw new Error('TOKEN_ENCRYPTION_KEY must be at least 32 characters');return createHash('sha256').update(v).digest()};
export async function encrypt(value:string){return new EncryptJWT({value}).setProtectedHeader({alg:'dir',enc:'A256GCM'}).encrypt(key())}
export async function decrypt(value:string){return String((await jwtDecrypt(value,key())).payload.value)}
