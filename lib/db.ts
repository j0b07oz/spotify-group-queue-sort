import 'server-only'; import fs from 'node:fs'; import path from 'node:path'; import Database from 'better-sqlite3';
const file=process.env.DATABASE_PATH||'./data/mixroom.db'; fs.mkdirSync(path.dirname(file),{recursive:true});
const globalDb=globalThis as typeof globalThis&{mixroomDb?:Database.Database};
export const db=globalDb.mixroomDb||new Database(file); if(process.env.NODE_ENV!=='production')globalDb.mixroomDb=db;
db.pragma('foreign_keys=ON');
for(const sql of fs.readdirSync(path.join(process.cwd(),'migrations')).filter(x=>x.endsWith('.sql')).sort()) db.exec(fs.readFileSync(path.join(process.cwd(),'migrations',sql),'utf8'));
