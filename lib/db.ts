import 'server-only'; import fs from 'node:fs'; import path from 'node:path'; import Database from 'better-sqlite3';
const file=process.env.DATABASE_PATH||'./data/mixroom.db'; fs.mkdirSync(path.dirname(file),{recursive:true});
const globalDb=globalThis as typeof globalThis&{mixroomDb?:Database.Database};
export const db=globalDb.mixroomDb||new Database(file); if(process.env.NODE_ENV!=='production')globalDb.mixroomDb=db;
db.pragma('foreign_keys=ON');
db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at INTEGER NOT NULL DEFAULT (unixepoch()))');
const migrationsDir=path.join(process.cwd(),'migrations');
const applied=db.prepare('SELECT 1 FROM schema_migrations WHERE filename=?');
const record=db.prepare('INSERT INTO schema_migrations(filename) VALUES(?)');
for(const filename of fs.readdirSync(migrationsDir).filter(x=>x.endsWith('.sql')).sort()){
  if(applied.get(filename))continue;
  db.transaction(()=>{db.exec(fs.readFileSync(path.join(migrationsDir,filename),'utf8'));record.run(filename)})();
}
