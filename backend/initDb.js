const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// Создание таблицы транзакций
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

console.log('✅ База данных успешно инициализирована');
console.log(`📁 Путь к базе данных: ${dbPath}`);

db.close();
