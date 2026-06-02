import { existsSync, mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dataDir = process.env.DATA_DIR || join(root, "data");
const backupDir = process.env.BACKUP_DIR || join(dataDir, "backups");
const dbPath = join(dataDir, "english-study.sqlite");

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sqlQuote(value) {
  return String(value).replaceAll("'", "''");
}

if (!existsSync(dbPath)) {
  console.error(`No SQLite database found at ${dbPath}`);
  process.exit(1);
}

mkdirSync(backupDir, { recursive: true });

const backupPath = join(backupDir, `english-study-${timestamp()}.sqlite`);
mkdirSync(dirname(backupPath), { recursive: true });

const db = new DatabaseSync(dbPath);
try {
  db.exec(`VACUUM INTO '${sqlQuote(backupPath)}'`);
  console.log(`Backup created: ${backupPath}`);
} finally {
  db.close();
}
