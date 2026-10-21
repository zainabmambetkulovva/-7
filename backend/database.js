const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');

let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();
  
  try {
    // Пытаемся загрузить существующую базу данных
    if (fs.existsSync(dbPath)) {
      const filebuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(filebuffer);
    } else {
      // Создаём новую базу данных
      db = new SQL.Database();
    }
  } catch (err) {
    console.log('Создаём новую базу данных');
    db = new SQL.Database();
  }
  
  return db;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// Автосохранение каждые 5 секунд
setInterval(() => {
  saveDatabase();
}, 5000);

// Сохранение при завершении процесса
process.on('exit', saveDatabase);
process.on('SIGINT', () => {
  saveDatabase();
  process.exit(0);
});
process.on('SIGTERM', () => {
  saveDatabase();
  process.exit(0);
});

module.exports = {
  initDatabase,
  getDb: () => db,
  saveDatabase
};
