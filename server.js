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

// 初始化數據庫
async function initDatabase() {
  try {
    // 創建商品表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        image_url VARCHAR(500),
        category VARCHAR(100),
        stock INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 創建訂單表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_no VARCHAR(50) UNIQUE NOT NULL,
        user_address VARCHAR(100) NOT NULL,
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER DEFAULT 1,
        total_price DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 創建商家表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS merchants (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        rating DECIMAL(3, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 插入示例商品
    const productCheck = await pool.query('SELECT COUNT(*) FROM products');
    if (parseInt(productCheck.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO products (name, description, price, image_url, category, stock) VALUES
        ('ARK 遊戲代幣', '用於 ARK 生態系統的遊戲代幣', 0.5, '/images/ark-token.png', '代幣', 1000000),
        ('ARK 限量周邊', 'ARK 官方限量版 T 恤', 25.0, '/images/ark-tshirt.png', '周邊', 100),
        ('ARK 遊戲禮包', '包含稀有道具和代幣的禮包', 10.0, '/images/ark礼包.png', '遊戲', 500)
      `);
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// 啟動時初始化數據庫
initDatabase();

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