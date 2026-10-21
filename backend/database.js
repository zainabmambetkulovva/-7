const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// Включаем поддержку внешних ключей
db.pragma('foreign_keys = ON');

module.exports = db;
