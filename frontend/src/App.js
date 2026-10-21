import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Предопределённые категории
const CATEGORIES = {
  income: ['Зарплата', 'Фриланс', 'Инвестиции', 'Подарки', 'Другое'],
  expense: ['Еда', 'Транспорт', 'Жильё', 'Развлечения', 'Здоровье', 'Одежда', 'Образование', 'Другое']
};

function App() {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [statistics, setStatistics] = useState({ income: 0, expense: 0, balance: 0 });
  const [categoryStats, setCategoryStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Форма
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    type: 'expense',
    category: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [editingId, setEditingId] = useState(null);
  const [formErrors, setFormErrors] = useState([]);

  // Фильтры
  const [filters, setFilters] = useState({
    type: '',
    category: '',
    startDate: '',
    endDate: ''
  });

  // Загрузка данных
  useEffect(() => {
    fetchTransactions();
    fetchStatistics();
  }, []);

  // Применение фильтров
  useEffect(() => {
    applyFilters();
  }, [transactions, filters]);

  // Загрузка статистики по категориям при изменении типа фильтра
  useEffect(() => {
    fetchCategoryStatistics();
  }, [filters.type, filters.startDate, filters.endDate]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/transactions`);
      if (!response.ok) throw new Error('Ошибка загрузки транзакций');
      const data = await response.json();
      setTransactions(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Ошибка:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await fetch(`${API_URL}/statistics?${params}`);
      if (!response.ok) throw new Error('Ошибка загрузки статистики');
      const data = await response.json();
      setStatistics(data);
    } catch (err) {
      console.error('Ошибка загрузки статистики:', err);
    }
  };

  const fetchCategoryStatistics = async () => {
    try {
      const params = new URLSearchParams();
      const type = filters.type || 'expense';
      params.append('type', type);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await fetch(`${API_URL}/statistics/categories?${params}`);
      if (!response.ok) throw new Error('Ошибка загрузки статистики по категориям');
      const data = await response.json();
      setCategoryStats(data);
    } catch (err) {
      console.error('Ошибка загрузки статистики по категориям:', err);
    }
  };

  const applyFilters = () => {
    let filtered = [...transactions];

    if (filters.type) {
      filtered = filtered.filter(t => t.type === filters.type);
    }

    if (filters.category) {
      filtered = filtered.filter(t => t.category === filters.category);
    }

    if (filters.startDate) {
      filtered = filtered.filter(t => t.date >= filters.startDate);
    }

    if (filters.endDate) {
      filtered = filtered.filter(t => t.date <= filters.endDate);
    }

    setFilteredTransactions(filtered);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrors([]);

    // Валидация на клиенте
    const errors = [];
    if (!formData.title.trim()) errors.push('Название обязательно');
    if (!formData.amount || parseFloat(formData.amount) <= 0) errors.push('Сумма должна быть больше 0');
    if (!formData.category) errors.push('Выберите категорию');

    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const url = editingId 
        ? `${API_URL}/transactions/${editingId}`
        : `${API_URL}/transactions`;
      
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.errors ? errorData.errors.join(', ') : 'Ошибка сохранения');
      }

      await fetchTransactions();
      await fetchStatistics();
      resetForm();
    } catch (err) {
      setFormErrors([err.message]);
      console.error('Ошибка:', err);
    }
  };

  const handleEdit = (transaction) => {
    setFormData({
      title: transaction.title,
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
      date: transaction.date
    });
    setEditingId(transaction.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту транзакцию?')) return;

    try {
      const response = await fetch(`${API_URL}/transactions/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Ошибка удаления');

      await fetchTransactions();
      await fetchStatistics();
    } catch (err) {
      alert('Ошибка при удалении: ' + err.message);
      console.error('Ошибка:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      amount: '',
      type: 'expense',
      category: '',
      date: new Date().toISOString().split('T')[0]
    });
    setEditingId(null);
    setFormErrors([]);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Получение уникальных категорий из транзакций
  const getUniqueCategories = () => {
    const categories = new Set(transactions.map(t => t.category));
    return Array.from(categories).sort();
  };

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  return (
    <div className="App">
      <header className="header">
        <h1>💰 Expense Tracker</h1>
        <p>Учёт личных расходов и доходов</p>
      </header>

      {error && (
        <div className="error-message">
          <strong>Ошибка:</strong> {error}
        </div>
      )}

      {/* Карточки баланса */}
      <div className="balance-cards">
        <div className="balance-card income">
          <h3>Доходы</h3>
          <div className="amount">{formatCurrency(statistics.income)}</div>
        </div>
        <div className="balance-card expense">
          <h3>Расходы</h3>
          <div className="amount">{formatCurrency(statistics.expense)}</div>
        </div>
        <div className="balance-card balance">
          <h3>Баланс</h3>
          <div className="amount">{formatCurrency(statistics.balance)}</div>
        </div>
      </div>

      {/* Форма добавления/редактирования */}
      <div className="transaction-form">
        <h2>{editingId ? 'Редактировать транзакцию' : 'Добавить транзакцию'}</h2>
        
        {formErrors.length > 0 && (
          <div className="error-message">
            <ul>
              {formErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Тип операции</label>
              <div className="type-selector">
                <button
                  type="button"
                  className={`type-btn ${formData.type === 'income' ? 'active income' : ''}`}
                  onClick={() => setFormData({ ...formData, type: 'income', category: '' })}
                >
                  Доход
                </button>
                <button
                  type="button"
                  className={`type-btn ${formData.type === 'expense' ? 'active expense' : ''}`}
                  onClick={() => setFormData({ ...formData, type: 'expense', category: '' })}
                >
                  Расход
                </button>
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Название*</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Например: Продукты"
                required
              />
            </div>
            <div className="form-group">
              <label>Сумма*</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Категория*</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              >
                <option value="">Выберите категорию</option>
                {CATEGORIES[formData.type].map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Дата*</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Сохранить изменения' : 'Добавить транзакцию'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Отмена
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Фильтры */}
      <div className="filters">
        <h3>Фильтры</h3>
        <div className="filters-row">
          <div className="form-group">
            <label>Тип</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            >
              <option value="">Все</option>
              <option value="income">Доходы</option>
              <option value="expense">Расходы</option>
            </select>
          </div>
          <div className="form-group">
            <label>Категория</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            >
              <option value="">Все категории</option>
              {getUniqueCategories().map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>С даты</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => {
                setFilters({ ...filters, startDate: e.target.value });
                fetchStatistics();
              }}
            />
          </div>
          <div className="form-group">
            <label>По дату</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => {
                setFilters({ ...filters, endDate: e.target.value });
                fetchStatistics();
              }}
            />
          </div>
        </div>
      </div>

      {/* График по категориям */}
      {categoryStats.length > 0 && (
        <div className="chart-section">
          <h2>📊 Статистика по категориям ({filters.type === 'income' ? 'Доходы' : 'Расходы'})</h2>
          <div className="chart-container">
            {categoryStats.map((stat) => {
              const maxAmount = Math.max(...categoryStats.map(s => s.total));
              const percentage = (stat.total / maxAmount) * 100;
              
              return (
                <div key={stat.category} className="chart-bar">
                  <div className="chart-label">{stat.category}</div>
                  <div className="chart-bar-bg">
                    <div 
                      className="chart-bar-fill" 
                      style={{ width: `${percentage}%` }}
                    >
                      <span className="chart-value">{formatCurrency(stat.total)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Список транзакций */}
      <div className="transactions-section">
        <h2>История операций ({filteredTransactions.length})</h2>
        
        {filteredTransactions.length === 0 ? (
          <div className="empty-state">
            <p>📭 Нет транзакций</p>
            <p style={{ fontSize: '0.9rem', marginTop: '5px' }}>
              {transactions.length === 0 
                ? 'Добавьте первую транзакцию' 
                : 'Попробуйте изменить фильтры'}
            </p>
          </div>
        ) : (
          <div className="transactions-list">
            {filteredTransactions.map((transaction) => (
              <div key={transaction.id} className="transaction-item">
                <div className="transaction-info">
                  <div className="transaction-header">
                    <div className="transaction-title">{transaction.title}</div>
                    <div className={`transaction-amount ${transaction.type}`}>
                      {transaction.type === 'income' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </div>
                  </div>
                  <div className="transaction-details">
                    <span className="transaction-category">{transaction.category}</span>
                    <span>{formatDate(transaction.date)}</span>
                  </div>
                </div>
                <div className="transaction-actions">
                  <button 
                    className="btn btn-edit" 
                    onClick={() => handleEdit(transaction)}
                  >
                    Изменить
                  </button>
                  <button 
                    className="btn btn-delete" 
                    onClick={() => handleDelete(transaction.id)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
