const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中間件
app.use(cors());
app.use(express.json());

// 數據庫連接（使用 SQLite）
const db = new Database(path.join(__dirname, 'arkmall.db'));

// 啟用 WAL 模式
db.pragma('journal_mode = WAL');

// 初始化數據庫
function initDatabase() {
  try {
    // 創建商品表
    db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        image_url TEXT,
        category TEXT,
        stock INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 創建訂單表
    db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT UNIQUE NOT NULL,
        user_address TEXT NOT NULL,
        product_id INTEGER,
        quantity INTEGER DEFAULT 1,
        total_price REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    // 創建商家表
    db.exec(`
      CREATE TABLE IF NOT EXISTS merchants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT UNIQUE NOT NULL,
        description TEXT,
        rating REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 插入示例商品
    const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get();
    if (productCount.count === 0) {
      const insert = db.prepare(`
        INSERT INTO products (name, description, price, image_url, category, stock)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      insert.run('ARK 遊戲代幣', '用於 ARK 生態系統的遊戲代幣', 0.5, '/images/ark-token.png', '代幣', 1000000);
      insert.run('ARK 限量周邊', 'ARK 官方限量版 T 恤', 25.0, '/images/ark-tshirt.png', '周邊', 100);
      insert.run('ARK 遊戲禮包', '包含稀有道具和代幣的禮包', 10.0, '/images/ark礼包.png', '遊戲', 500);
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
app.get('/api/products', (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 創建商品
app.post('/api/products', (req, res) => {
  try {
    const { name, description, price, image_url, category, stock } = req.body;
    const result = db.prepare(`
      INSERT INTO products (name, description, price, image_url, category, stock)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, description, price, image_url, category, stock);
    
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 獲取單個商品
app.get('/api/products/:id', (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 更新商品
app.put('/api/products/:id', (req, res) => {
  try {
    const { name, description, price, image_url, category, stock } = req.body;
    db.prepare(`
      UPDATE products SET name = ?, description = ?, price = ?, image_url = ?, category = ?, stock = ?
      WHERE id = ?
    `).run(name, description, price, image_url, category, stock, req.params.id);
    
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 刪除商品
app.delete('/api/products/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 創建訂單
app.post('/api/orders', (req, res) => {
  try {
    const { user_address, product_id, quantity } = req.body;
    const order_no = `ORD${Date.now()}`;
    
    // 獲取商品價格
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const total_price = product.price * quantity;
    
    const result = db.prepare(`
      INSERT INTO orders (order_no, user_address, product_id, quantity, total_price)
      VALUES (?, ?, ?, ?, ?)
    `).run(order_no, user_address, product_id, quantity, total_price);
    
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 獲取用戶訂單
app.get('/api/orders', (req, res) => {
  try {
    const { user_address } = req.query;
    let orders;
    if (user_address) {
      orders = db.prepare('SELECT * FROM orders WHERE user_address = ? ORDER BY created_at DESC').all(user_address);
    } else {
      orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    }
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 啟動服務器
app.listen(PORT, () => {
  console.log(`ARK Mall Backend running on port ${PORT}`);
});