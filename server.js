const express = require('express');
const cors = require('cors');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中間件
app.use(cors());
app.use(express.json());

// 數據庫路徑
const DB_PATH = path.join(__dirname, 'arkmall.db');

// 數據庫實例
let db;

// 初始化數據庫
async function initDatabase() {
  try {
    const SQL = await initSqlJs();
    
    // 如果數據庫文件存在，讀取它
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    // 創建商品表
    db.run(`
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
    db.run(`
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
    db.run(`
      CREATE TABLE IF NOT EXISTS merchants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT UNIQUE NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        rating REAL DEFAULT 0,
        deposit_paid INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 確保 merchants 表有 status 列（兼容舊數據庫）
    try {
      db.exec('ALTER TABLE merchants ADD COLUMN status TEXT DEFAULT "pending"');
    } catch (e) {
      // 列已存在，忽略錯誤
    }
    try {
      db.exec('ALTER TABLE merchants ADD COLUMN deposit_paid INTEGER DEFAULT 0');
    } catch (e) {
      // 列已存在，忽略錯誤
    }

    // 插入示例商品
    const productCount = db.exec('SELECT COUNT(*) as count FROM products');
    if (productCount[0].values[0][0] === 0) {
      db.run(`
        INSERT INTO products (name, description, price, image_url, category, stock)
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['ARK 遊戲代幣', '用於 ARK 生態系統的遊戲代幣', 0.5, '/images/ark-token.png', '代幣', 1000000]);
      
      db.run(`
        INSERT INTO products (name, description, price, image_url, category, stock)
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['ARK 限量周邊', 'ARK 官方限量版 T 恤', 25.0, '/images/ark-tshirt.png', '周邊', 100]);
      
      db.run(`
        INSERT INTO products (name, description, price, image_url, category, stock)
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['ARK 遊戲禮包', '包含稀有道具和代幣的禮包', 10.0, '/images/ark礼包.png', '遊戲', 500]);
    }

    // 保存數據庫
    saveDatabase();
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// 保存數據庫
function saveDatabase() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (error) {
    console.error('Error saving database:', error);
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
    const result = db.exec('SELECT * FROM products ORDER BY created_at DESC');
    const products = result[0] ? result[0].values.map(row => ({
      id: row[0],
      name: row[1],
      description: row[2],
      price: row[3],
      image_url: row[4],
      category: row[5],
      stock: row[6],
      created_at: row[7]
    })) : [];
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
    db.run(`
      INSERT INTO products (name, description, price, image_url, category, stock)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [name, description, price, image_url, category, stock]);
    
    const result = db.exec('SELECT * FROM products WHERE id = last_insert_rowid()');
    const product = result[0] ? {
      id: result[0].values[0][0],
      name: result[0].values[0][1],
      description: result[0].values[0][2],
      price: result[0].values[0][3],
      image_url: result[0].values[0][4],
      category: result[0].values[0][5],
      stock: result[0].values[0][6],
      created_at: result[0].values[0][7]
    } : null;
    
    saveDatabase();
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 獲取單個商品
app.get('/api/products/:id', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!result[0] || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const product = {
      id: result[0].values[0][0],
      name: result[0].values[0][1],
      description: result[0].values[0][2],
      price: result[0].values[0][3],
      image_url: result[0].values[0][4],
      category: result[0].values[0][5],
      stock: result[0].values[0][6],
      created_at: result[0].values[0][7]
    };
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
    db.run(`
      UPDATE products SET name = ?, description = ?, price = ?, image_url = ?, category = ?, stock = ?
      WHERE id = ?
    `, [name, description, price, image_url, category, stock, req.params.id]);
    
    const result = db.exec('SELECT * FROM products WHERE id = ?', [req.params.id]);
    const product = result[0] ? {
      id: result[0].values[0][0],
      name: result[0].values[0][1],
      description: result[0].values[0][2],
      price: result[0].values[0][3],
      image_url: result[0].values[0][4],
      category: result[0].values[0][5],
      stock: result[0].values[0][6],
      created_at: result[0].values[0][7]
    } : null;
    
    saveDatabase();
    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 刪除商品
app.delete('/api/products/:id', (req, res) => {
  try {
    db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
    saveDatabase();
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
    const productResult = db.exec('SELECT * FROM products WHERE id = ?', [product_id]);
    if (!productResult[0] || productResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const productPrice = productResult[0].values[0][3];
    const total_price = productPrice * quantity;
    
    db.run(`
      INSERT INTO orders (order_no, user_address, product_id, quantity, total_price)
      VALUES (?, ?, ?, ?, ?)
    `, [order_no, user_address, product_id, quantity, total_price]);
    
    const result = db.exec('SELECT * FROM orders WHERE id = last_insert_rowid()');
    const order = result[0] ? {
      id: result[0].values[0][0],
      order_no: result[0].values[0][1],
      user_address: result[0].values[0][2],
      product_id: result[0].values[0][3],
      quantity: result[0].values[0][4],
      total_price: result[0].values[0][5],
      status: result[0].values[0][6],
      created_at: result[0].values[0][7]
    } : null;
    
    saveDatabase();
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
    let result;
    if (user_address) {
      result = db.exec('SELECT * FROM orders WHERE user_address = ? ORDER BY created_at DESC', [user_address]);
    } else {
      result = db.exec('SELECT * FROM orders ORDER BY created_at DESC');
    }
    
    const orders = result[0] ? result[0].values.map(row => ({
      id: row[0],
      order_no: row[1],
      user_address: row[2],
      product_id: row[3],
      quantity: row[4],
      total_price: row[5],
      status: row[6],
      created_at: row[7]
    })) : [];
    
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============ 商家 API ============

// 獲取所有已批准的商家
app.get('/api/merchants', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM merchants WHERE status = ? ORDER BY created_at DESC', ['approved']);
    const merchants = result[0] ? result[0].values.map(row => ({
      id: row[0],
      name: row[1],
      address: row[2],
      description: row[3],
      status: row[4],
      rating: row[5],
      deposit_paid: row[6],
      created_at: row[7]
    })) : [];
    res.json({ success: true, data: merchants });
  } catch (error) {
    console.error('Error fetching merchants:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 獲取待審核商家
app.get('/api/merchants/pending', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM merchants WHERE status = ? ORDER BY created_at DESC', ['pending']);
    const merchants = result[0] ? result[0].values.map(row => ({
      id: row[0],
      name: row[1],
      address: row[2],
      description: row[3],
      status: row[4],
      rating: row[5],
      deposit_paid: row[6],
      created_at: row[7]
    })) : [];
    res.json({ success: true, data: merchants });
  } catch (error) {
    console.error('Error fetching pending merchants:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 商家入駐申請
app.post('/api/merchants', (req, res) => {
  try {
    const { name, address, description } = req.body;
    
    if (!name || !address) {
      return res.status(400).json({ error: '商家名稱和地址必填' });
    }
    
    const stmt = db.prepare('INSERT INTO merchants (name, address, description, status, deposit_paid) VALUES (?, ?, ?, ?, ?)');
    stmt.run(name, address, description || '', 'pending', 0);
    
    res.json({ success: true, message: '商家入駐申請已提交，等待審核' });
  } catch (error) {
    console.error('Error creating merchant:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 商家審核通過
app.put('/api/merchants/:id/approve', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('UPDATE merchants SET status = ? WHERE id = ?');
    stmt.run('approved', id);
    res.json({ success: true, message: '商家審核通過' });
  } catch (error) {
    console.error('Error approving merchant:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 獲取搜索結果
app.get('/api/search', (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) {
      return res.status(400).json({ error: '請輸入搜索關鍵詞' });
    }
    
    const products = db.exec("SELECT * FROM products WHERE name LIKE ? OR description LIKE ?", [`%${keyword}%`, `%${keyword}%`]);
    const merchants = db.exec("SELECT * FROM merchants WHERE name LIKE ? AND status = 'approved'", [`%${keyword}%`]);
    
    res.json({
      products: products[0] ? products[0].values.map(row => ({
        id: row[0], merchant_id: row[1], name: row[2], description: row[3],
        price: row[4], image_url: row[5], category: row[6], stock: row[7], created_at: row[8]
      })) : [],
      merchants: merchants[0] ? merchants[0].values.map(row => ({
        id: row[0], name: row[1], address: row[2], description: row[3],
        status: row[4], rating: row[5], deposit_paid: row[6], created_at: row[7]
      })) : []
    });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 啟動服務器
app.listen(PORT, () => {
  console.log(`ARK Mall Backend running on port ${PORT}`);
});