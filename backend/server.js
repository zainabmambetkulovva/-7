require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase, getDb, saveDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Инициализация базы данных
let dbReady = false;

initDatabase().then(() => {
  const db = getDb();
  
  // Создание таблицы если не существует
  db.run(`
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
  
  saveDatabase();
  dbReady = true;
  console.log('✅ База данных готова к работе');
}).catch(err => {
  console.error('❌ Ошибка инициализации базы данных:', err);
  process.exit(1);
});

// Middleware для проверки готовности БД
app.use((req, res, next) => {
  if (!dbReady) {
    return res.status(503).json({ error: 'База данных инициализируется, попробуйте позже' });
  }
  next();
});

// Валидация данных
const validateTransaction = (data) => {
  const errors = [];
  
  if (!data.title || data.title.trim() === '') {
    errors.push('Название обязательно для заполнения');
  }
  
  if (!data.amount || isNaN(data.amount) || data.amount <= 0) {
    errors.push('Сумма должна быть положительным числом');
  }
  
  if (!data.type || !['income', 'expense'].includes(data.type)) {
    errors.push('Тип должен быть "income" или "expense"');
  }
  
  if (!data.category || data.category.trim() === '') {
    errors.push('Категория обязательна для заполнения');
  }
  
  if (!data.date) {
    errors.push('Дата обязательна для заполнения');
  }
  
  return errors;
};

// API Routes

// Получить все транзакции с фильтрацией
app.get('/api/transactions', (req, res) => {
  try {
    const db = getDb();
    const { type, category, startDate, endDate } = req.query;
    
    let query = 'SELECT * FROM transactions WHERE 1=1';
    const params = {};
    
    if (type) {
      query += ' AND type = $type';
      params.$type = type;
    }
    
    if (category) {
      query += ' AND category = $category';
      params.$category = category;
    }
    
    if (startDate) {
      query += ' AND date >= $startDate';
      params.$startDate = startDate;
    }
    
    if (endDate) {
      query += ' AND date <= $endDate';
      params.$endDate = endDate;
    }
    
    query += ' ORDER BY date DESC, created_at DESC';
    
    const stmt = db.prepare(query);
    stmt.bind(params);
    
    const transactions = [];
    while (stmt.step()) {
      transactions.push(stmt.getAsObject());
    }
    stmt.free();
    
    res.json(transactions);
  } catch (error) {
    console.error('Ошибка при получении транзакций:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении транзакций' });
  }
});

// Получить одну транзакцию
app.get('/api/transactions/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const stmt = db.prepare('SELECT * FROM transactions WHERE id = $id');
    stmt.bind({ $id: id });
    
    if (stmt.step()) {
      const transaction = stmt.getAsObject();
      stmt.free();
      res.json(transaction);
    } else {
      stmt.free();
      res.status(404).json({ error: 'Транзакция не найдена' });
    }
  } catch (error) {
    console.error('Ошибка при получении транзакции:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создать транзакцию
app.post('/api/transactions', (req, res) => {
  try {
    const errors = validateTransaction(req.body);
    
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }
    
    const { title, amount, type, category, date } = req.body;
    const db = getDb();
    
    db.run(`
      INSERT INTO transactions (title, amount, type, category, date)
      VALUES ($title, $amount, $type, $category, $date)
    `, {
      $title: title,
      $amount: amount,
      $type: type,
      $category: category,
      $date: date
    });
    
    saveDatabase();
    
    // Получаем последнюю вставленную запись
    const stmt = db.prepare('SELECT * FROM transactions ORDER BY id DESC LIMIT 1');
    stmt.step();
    const newTransaction = stmt.getAsObject();
    stmt.free();
    
    res.status(201).json(newTransaction);
  } catch (error) {
    console.error('Ошибка при создании транзакции:', error);
    res.status(500).json({ error: 'Ошибка сервера при создании транзакции' });
  }
});

// Обновить транзакцию
app.put('/api/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const errors = validateTransaction(req.body);
    
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }
    
    const { title, amount, type, category, date } = req.body;
    const db = getDb();
    
    db.run(`
      UPDATE transactions 
      SET title = $title, amount = $amount, type = $type, category = $category, date = $date, updated_at = CURRENT_TIMESTAMP
      WHERE id = $id
    `, {
      $title: title,
      $amount: amount,
      $type: type,
      $category: category,
      $date: date,
      $id: id
    });
    
    saveDatabase();
    
    const stmt = db.prepare('SELECT * FROM transactions WHERE id = $id');
    stmt.bind({ $id: id });
    
    if (stmt.step()) {
      const updatedTransaction = stmt.getAsObject();
      stmt.free();
      res.json(updatedTransaction);
    } else {
      stmt.free();
      res.status(404).json({ error: 'Транзакция не найдена' });
    }
  } catch (error) {
    console.error('Ошибка при обновлении транзакции:', error);
    res.status(500).json({ error: 'Ошибка сервера при обновлении транзакции' });
  }
});

// Удалить транзакцию
app.delete('/api/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    // Проверяем существование
    const checkStmt = db.prepare('SELECT id FROM transactions WHERE id = $id');
    checkStmt.bind({ $id: id });
    const exists = checkStmt.step();
    checkStmt.free();
    
    if (!exists) {
      return res.status(404).json({ error: 'Транзакция не найдена' });
    }
    
    db.run('DELETE FROM transactions WHERE id = $id', { $id: id });
    saveDatabase();
    
    res.json({ message: 'Транзакция успешно удалена' });
  } catch (error) {
    console.error('Ошибка при удалении транзакции:', error);
    res.status(500).json({ error: 'Ошибка сервера при удалении транзакции' });
  }
});

// Получить статистику
app.get('/api/statistics', (req, res) => {
  try {
    const db = getDb();
    const { startDate, endDate } = req.query;
    
    let query = 'SELECT type, SUM(amount) as total FROM transactions WHERE 1=1';
    const params = {};
    
    if (startDate) {
      query += ' AND date >= $startDate';
      params.$startDate = startDate;
    }
    
    if (endDate) {
      query += ' AND date <= $endDate';
      params.$endDate = endDate;
    }
    
    query += ' GROUP BY type';
    
    const stmt = db.prepare(query);
    stmt.bind(params);
    
    const stats = {
      income: 0,
      expense: 0,
      balance: 0
    };
    
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row.type === 'income') {
        stats.income = row.total;
      } else if (row.type === 'expense') {
        stats.expense = row.total;
      }
    }
    stmt.free();
    
    stats.balance = stats.income - stats.expense;
    
    res.json(stats);
  } catch (error) {
    console.error('Ошибка при получении статистики:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении статистики' });
  }
});

// Получить статистику по категориям
app.get('/api/statistics/categories', (req, res) => {
  try {
    const db = getDb();
    const { type, startDate, endDate } = req.query;
    
    let query = 'SELECT category, SUM(amount) as total FROM transactions WHERE 1=1';
    const params = {};
    
    if (type) {
      query += ' AND type = $type';
      params.$type = type;
    }
    
    if (startDate) {
      query += ' AND date >= $startDate';
      params.$startDate = startDate;
    }
    
    if (endDate) {
      query += ' AND date <= $endDate';
      params.$endDate = endDate;
    }
    
    query += ' GROUP BY category ORDER BY total DESC';
    
    const stmt = db.prepare(query);
    stmt.bind(params);
    
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    
    res.json(results);
  } catch (error) {
    console.error('Ошибка при получении статистики по категориям:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить список категорий
app.get('/api/categories', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT DISTINCT category FROM transactions ORDER BY category');
    
    const categories = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      categories.push(row.category);
    }
    stmt.free();
    
    res.json(categories);
  } catch (error) {
    console.error('Ошибка при получении категорий:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Expense Tracker API работает' });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📡 API доступен на http://localhost:${PORT}/api`);
});
