import fs from 'node:fs'; import path from 'node:path'; import Database from 'better-sqlite3';
const dbPath=process.env.DATABASE_PATH||'./data/mixroom.db'; fs.mkdirSync(path.dirname(dbPath),{recursive:true});
const db=new Database(dbPath); db.pragma('foreign_keys=ON');
db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at INTEGER NOT NULL DEFAULT (unixepoch()))');
const applied=db.prepare('SELECT 1 FROM schema_migrations WHERE filename=?');
const record=db.prepare('INSERT INTO schema_migrations(filename) VALUES(?)');
for(const file of fs.readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort()){
  if(applied.get(file))continue;
  db.transaction(()=>{db.exec(fs.readFileSync(path.join('migrations',file),'utf8'));record.run(file)})();
}
console.log(`Migrated ${dbPath}`); db.close();
