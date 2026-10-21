require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

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
    const { type, category, startDate, endDate } = req.query;
    
    let query = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];
    
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    
    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }
    
    query += ' ORDER BY date DESC, created_at DESC';
    
    const stmt = db.prepare(query);
    const transactions = stmt.all(...params);
    
    res.json(transactions);
  } catch (error) {
    console.error('Ошибка при получении транзакций:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении транзакций' });
  }
});

// Получить одну транзакцию
app.get('/api/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('SELECT * FROM transactions WHERE id = ?');
    const transaction = stmt.get(id);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Транзакция не найдена' });
    }
    
    res.json(transaction);
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
    
    const stmt = db.prepare(`
      INSERT INTO transactions (title, amount, type, category, date)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(title, amount, type, category, date);
    
    const newTransaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
    
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
    
    const stmt = db.prepare(`
      UPDATE transactions 
      SET title = ?, amount = ?, type = ?, category = ?, date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    const result = stmt.run(title, amount, type, category, date, id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Транзакция не найдена' });
    }
    
    const updatedTransaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    
    res.json(updatedTransaction);
  } catch (error) {
    console.error('Ошибка при обновлении транзакции:', error);
    res.status(500).json({ error: 'Ошибка сервера при обновлении транзакции' });
  }
});

// Удалить транзакцию
app.delete('/api/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const stmt = db.prepare('DELETE FROM transactions WHERE id = ?');
    const result = stmt.run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Транзакция не найдена' });
    }
    
    res.json({ message: 'Транзакция успешно удалена' });
  } catch (error) {
    console.error('Ошибка при удалении транзакции:', error);
    res.status(500).json({ error: 'Ошибка сервера при удалении транзакции' });
  }
});

// Получить статистику
app.get('/api/statistics', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = 'SELECT type, SUM(amount) as total FROM transactions WHERE 1=1';
    const params = [];
    
    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }
    
    query += ' GROUP BY type';
    
    const stmt = db.prepare(query);
    const results = stmt.all(...params);
    
    const stats = {
      income: 0,
      expense: 0,
      balance: 0
    };
    
    results.forEach(row => {
      if (row.type === 'income') {
        stats.income = row.total;
      } else if (row.type === 'expense') {
        stats.expense = row.total;
      }
    });
    
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
    const { type, startDate, endDate } = req.query;
    
    let query = 'SELECT category, SUM(amount) as total FROM transactions WHERE 1=1';
    const params = [];
    
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }
    
    query += ' GROUP BY category ORDER BY total DESC';
    
    const stmt = db.prepare(query);
    const results = stmt.all(...params);
    
    res.json(results);
  } catch (error) {
    console.error('Ошибка при получении статистики по категориям:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить список категорий
app.get('/api/categories', (req, res) => {
  try {
    const stmt = db.prepare('SELECT DISTINCT category FROM transactions ORDER BY category');
    const categories = stmt.all().map(row => row.category);
    
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
