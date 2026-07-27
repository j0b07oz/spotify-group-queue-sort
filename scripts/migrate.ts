import fs from 'node:fs'; import path from 'node:path'; import Database from 'better-sqlite3';
const dbPath=process.env.DATABASE_PATH||'./data/mixroom.db'; fs.mkdirSync(path.dirname(dbPath),{recursive:true});
const db=new Database(dbPath); db.pragma('foreign_keys=ON');
for(const file of fs.readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort()) db.exec(fs.readFileSync(path.join('migrations',file),'utf8'));
console.log(`Migrated ${dbPath}`); db.close();
