const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// 中間件
app.use(cors());
app.use(express.json());

// 數據庫連接
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/arkmall',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 健康檢查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 獲取所有商品
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 創建商品
app.post('/api/products', async (req, res) => {
  try {
    const { name, description, price, image_url, category, stock } = req.body;
    const result = await pool.query(
      'INSERT INTO products (name, description, price, image_url, category, stock) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, description, price, image_url, category, stock]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 啟動服務器
app.listen(PORT, () => {
  console.log(`ARK Mall Backend running on port ${PORT}`);
});