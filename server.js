const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sadek_accounts_store_secret_key_2024';

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// نظام رفع الملفات المتوافق مع Render
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`), false);
    }
  }
});

// Data file path
const DATA_FILE = path.join(__dirname, 'data.json');

// إنشاء المجلدات المطلوبة
const ensureDirectories = async () => {
  const directories = [
    path.join(__dirname, 'public', 'uploads'),
    path.dirname(DATA_FILE)
  ];

  for (const dir of directories) {
    try {
      await fs.access(dir);
    } catch (error) {
      await fs.mkdir(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  }
};

// Initialize data file
const initializeDataFile = async () => {
  try {
    await fs.access(DATA_FILE);
    const data = await readData();
    
    if (!data || !data.user || !data.settings) {
      throw new Error('Invalid data structure');
    }
    
    console.log('✅ Data file is valid');
    return data;
  } catch (error) {
    console.log('🔄 Creating initial data file...');
    
    const hashedPassword = await bcrypt.hash('sadek2007sadek', 10);
    
    // Define initialData directly here
    const initialData = {
      settings: {
        storeName: "متجر صادق لبيع الحسابات",
        heroTitle: "مرحباً بكم في متجر صادق",
        heroDescription: "وسيط موثوق لبيع وشراء حسابات فيسبوك، انستجرام، فري فاير وغيرها بنسبة وساطة 15%",
        currency: "DA",
        language: "ar",
        storeStatus: true,
        contact: {
          phone: "0795367580",
          whatsapp: "213795367580",
          email: "sadek.store@email.com",
          address: "وسيط إلكتروني",
          workingHours: "24/7",
          workingDays: "كل أيام الأسبوع"
        },
        social: {
          facebook: "https://www.facebook.com/sadekbelkhir2007",
          telegram: "https://t.me/sadekdzz"
        },
        logo: "https://github.com/Yacine2007/sadek-Accounts-Store/blob/main/logo.jpg?raw=true",
        storeUrl: "https://yacine2007.github.io/sadek-Accounts-Store/index.html"
      },
      user: {
        name: "Sadek Blkhiri",
        role: "وسيط متجر الحسابات",
        avatar: "https://github.com/Yacine2007/sadek-Accounts-Store/blob/main/logo.jpg?raw=true",
        password: hashedPassword,
        lastPasswordChange: new Date().toISOString()
      },
      categories: [
        { id: 1, name: "حسابات فيسبوك", description: "حسابات فيسبوك متنوعة" },
        { id: 2, name: "حسابات انستجرام", description: "حسابات انستجرام متنوعة" },
        { id: 3, name: "حسابات فري فاير", description: "حسابات لعبة فري فاير" },
        { id: 4, name: "حسابات ألعاب أخرى", description: "حسابات لألعاب مختلفة" }
      ],
      products: [],
      orders: [],
      analytics: {
        visitors: 0,
        ordersCount: 0,
        revenue: 0
      }
    };
    
    await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
    console.log('✅ Initial data file created successfully');
    return initialData;
  }
};

// Read data from file
const readData = async () => {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error reading data file:', error.message);
    return null;
  }
};

// Write data to file
const writeData = async (data) => {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Error writing data file:', error.message);
    return false;
  }
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
      req.user = user;
      next();
    });
  } catch (error) {
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Server is running correctly',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Serve store frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// رفع الصور - إصدار متوافق مع Render
app.post('/api/upload', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    console.log('📤 Upload request received');
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No image file provided' 
      });
    }

    // حفظ الصورة محلياً للاختبار
    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    try {
      await fs.access(uploadsDir);
    } catch (error) {
      await fs.mkdir(uploadsDir, { recursive: true });
    }

    const fileName = `image-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
    const filePath = path.join(uploadsDir, fileName);
    
    await fs.writeFile(filePath, req.file.buffer);
    
    const imageUrl = `/uploads/${fileName}`;
    
    console.log('✅ Image uploaded successfully:', imageUrl);
    
    res.json({ 
      success: true, 
      imageUrl: imageUrl,
      message: 'Image uploaded successfully'
    });
    
  } catch (error) {
    console.error('❌ Upload error:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to upload image: ' + error.message 
    });
  }
});

// Debug endpoint
app.get('/api/debug', async (req, res) => {
  try {
    const data = await readData();
    
    if (data) {
      res.json({
        success: true,
        hasData: true,
        userExists: !!data.user,
        settings: data.settings,
        productsCount: data.products ? data.products.length : 0,
        ordersCount: data.orders ? data.orders.length : 0,
        categoriesCount: data.categories ? data.categories.length : 0,
        filePath: DATA_FILE,
        environment: process.env.NODE_ENV || 'development'
      });
    } else {
      res.json({ 
        success: false,
        hasData: false 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ 
        success: false,
        error: 'Password is required' 
      });
    }

    const data = await readData();

    if (!data || !data.user) {
      return res.status(500).json({ 
        success: false,
        error: 'Server configuration error' 
      });
    }

    const isValid = await bcrypt.compare(password, data.user.password);
    
    if (isValid) {
      const token = jwt.sign({ 
        userId: 1,
        timestamp: Date.now()
      }, JWT_SECRET, { expiresIn: '24h' });
      
      res.json({ 
        success: true, 
        token,
        user: {
          name: data.user.name,
          role: data.user.role,
          avatar: data.user.avatar
        }
      });
    } else {
      await new Promise(resolve => setTimeout(resolve, 1000));
      res.status(401).json({ 
        success: false,
        error: 'Invalid password' 
      });
    }
  } catch (error) {
    console.error('❌ Login error:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Server error during login' 
    });
  }
});

// Change password
app.put('/api/user/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false,
        error: 'All password fields are required' 
      });
    }

    const data = await readData();

    if (!data) {
      return res.status(500).json({ 
        success: false,
        error: 'Server error' 
      });
    }

    const isValid = await bcrypt.compare(currentPassword, data.user.password);
    if (!isValid) {
      return res.status(401).json({ 
        success: false,
        error: 'Current password is incorrect' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false,
        error: 'New password must be at least 6 characters' 
      });
    }

    data.user.password = await bcrypt.hash(newPassword, 10);
    data.user.lastPasswordChange = new Date().toISOString();
    
    const success = await writeData(data);

    if (success) {
      res.json({ 
        success: true, 
        message: 'Password updated successfully'
      });
    } else {
      res.status(500).json({ 
        success: false,
        error: 'Failed to update password' 
      });
    }
  } catch (error) {
    console.error('❌ Password change error:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Server error during password change' 
    });
  }
});

// Get settings
app.get('/api/settings', async (req, res) => {
  try {
    const data = await readData();
    if (data && data.settings) {
      res.json(data.settings);
    } else {
      res.status(500).json({ error: 'Failed to load settings' });
    }
  } catch (error) {
    console.error('❌ Settings error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update settings
app.put('/api/settings', authenticateToken, async (req, res) => {
  try {
    const settings = req.body;
    const data = await readData();

    if (!data) {
      return res.status(500).json({ error: 'Server error - no data found' });
    }

    data.settings = { 
      ...data.settings, 
      ...settings 
    };

    const success = await writeData(data);

    if (success) {
      res.json({ 
        success: true, 
        message: 'Settings updated successfully', 
        settings: data.settings 
      });
    } else {
      res.status(500).json({ error: 'Failed to update settings' });
    }
  } catch (error) {
    console.error('❌ Update settings error:', error.message);
    res.status(500).json({ error: 'Server error during settings update' });
  }
});

// Get categories
app.get('/api/categories', async (req, res) => {
  try {
    const data = await readData();
    if (data && data.categories) {
      res.json(data.categories);
    } else {
      res.status(500).json({ error: 'Failed to load categories' });
    }
  } catch (error) {
    console.error('❌ Categories error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add category
app.post('/api/categories', authenticateToken, async (req, res) => {
  try {
    const categoryData = req.body;
    const data = await readData();

    if (!data) {
      return res.status(500).json({ error: 'Server error' });
    }

    const newCategory = {
      id: Date.now(),
      name: categoryData.name,
      description: categoryData.description || '',
      createdAt: new Date().toISOString()
    };

    if (!data.categories) {
      data.categories = [];
    }

    data.categories.push(newCategory);
    const success = await writeData(data);

    if (success) {
      res.json({ success: true, category: newCategory });
    } else {
      res.status(500).json({ error: 'Failed to add category' });
    }
  } catch (error) {
    console.error('❌ Add category error:', error.message);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Update category
app.put('/api/categories', authenticateToken, async (req, res) => {
  try {
    const categoryData = req.body;
    const data = await readData();

    if (!data) {
      return res.status(500).json({ error: 'Server error' });
    }

    if (!data.categories) {
      data.categories = [];
    }

    const categoryIndex = data.categories.findIndex(c => c.id === categoryData.id);
    if (categoryIndex === -1) {
      return res.status(404).json({ error: 'Category not found' });
    }

    data.categories[categoryIndex] = {
      ...data.categories[categoryIndex],
      name: categoryData.name,
      description: categoryData.description || '',
      updatedAt: new Date().toISOString()
    };

    const success = await writeData(data);

    if (success) {
      res.json({ success: true, category: data.categories[categoryIndex] });
    } else {
      res.status(500).json({ error: 'Failed to update category' });
    }
  } catch (error) {
    console.error('❌ Update category error:', error.message);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Get products
app.get('/api/products', async (req, res) => {
  try {
    const data = await readData();
    if (data && data.products) {
      res.json(data.products);
    } else {
      res.status(500).json({ error: 'Failed to load products' });
    }
  } catch (error) {
    console.error('❌ Products error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single product - FIXED: بدون مصادقة للعمل في المتجر
app.get('/api/products/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const data = await readData();

    if (!data || !data.products) {
      return res.status(500).json({ error: 'Server error' });
    }

    const product = data.products.find(p => p.id === productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('❌ Get product error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add product
app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const productData = req.body;
    const data = await readData();

    if (!data) {
      return res.status(500).json({ error: 'Server error' });
    }

    const newProduct = {
      id: Date.now(),
      name: productData.name,
      description: productData.description || '',
      price: productData.price,
      currency: productData.currency || 'DA',
      category: productData.category || '',
      status: productData.status !== undefined ? productData.status : true,
      images: productData.images || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!data.products) {
      data.products = [];
    }

    data.products.push(newProduct);
    const success = await writeData(data);

    if (success) {
      res.json({ success: true, product: newProduct });
    } else {
      res.status(500).json({ error: 'Failed to add product' });
    }
  } catch (error) {
    console.error('❌ Add product error:', error.message);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Update product
app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const productData = req.body;
    const data = await readData();

    if (!data) {
      return res.status(500).json({ error: 'Server error' });
    }

    const productIndex = data.products.findIndex(p => p.id === productId);
    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    data.products[productIndex] = {
      ...data.products[productIndex],
      name: productData.name,
      description: productData.description || '',
      price: productData.price,
      currency: productData.currency || 'DA',
      category: productData.category || '',
      status: productData.status !== undefined ? productData.status : true,
      images: productData.images || data.products[productIndex].images,
      updatedAt: new Date().toISOString()
    };

    const success = await writeData(data);

    if (success) {
      res.json({ success: true, product: data.products[productIndex] });
    } else {
      res.status(500).json({ error: 'Failed to update product' });
    }
  } catch (error) {
    console.error('❌ Update product error:', error.message);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Delete product
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const data = await readData();

    if (!data) {
      return res.status(500).json({ error: 'Server error' });
    }

    const productIndex = data.products.findIndex(p => p.id === productId);
    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    data.products.splice(productIndex, 1);
    const success = await writeData(data);

    if (success) {
      res.json({ success: true, message: 'Product deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete product' });
    }
  } catch (error) {
    console.error('❌ Delete product error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get orders
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const data = await readData();
    if (data && data.orders) {
      res.json(data.orders);
    } else {
      res.status(500).json({ error: 'Failed to load orders' });
    }
  } catch (error) {
    console.error('❌ Orders error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single order - FIXED: يعمل الآن بشكل صحيح
app.get('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const data = await readData();

    if (!data || !data.orders) {
      return res.status(500).json({ error: 'Server error' });
    }

    const order = data.orders.find(o => o.id === orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('❌ Get order error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create order - FIXED: لا يفتح واتساب مباشرة
app.post('/api/orders', async (req, res) => {
  try {
    const orderData = req.body;
    const data = await readData();

    if (!data) {
      return res.status(500).json({ error: 'Server error' });
    }

    const newOrder = {
      id: Date.now(),
      items: orderData.items || [],
      customerName: orderData.customerName,
      description: orderData.description || '',
      phone: orderData.phone,
      status: 'pending',
      total: orderData.total || (orderData.items ? orderData.items.reduce((sum, item) => sum + (parseFloat(item.price) * parseInt(item.quantity)), 0) : 0),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!data.orders) {
      data.orders = [];
    }

    data.orders.push(newOrder);
    
    if (!data.analytics) {
      data.analytics = { visitors: 0, ordersCount: 0, revenue: 0 };
    }
    data.analytics.ordersCount += 1;
    data.analytics.revenue += newOrder.total;

    const success = await writeData(data);

    if (success) {
      res.json({ 
        success: true, 
        orderId: newOrder.id,
        message: 'تم استلام طلبك بنجاح! سنتواصل معك قريباً عبر الواتساب أو الهاتف.'
      });
    } else {
      res.status(500).json({ error: 'Failed to create order' });
    }
  } catch (error) {
    console.error('❌ Create order error:', error.message);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Update order status
app.put('/api/orders/:id/status', authenticateToken, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { status } = req.body;
    const data = await readData();

    if (!data) {
      return res.status(500).json({ error: 'Server error' });
    }

    const order = data.orders.find(o => o.id === orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    order.status = status;
    order.updatedAt = new Date().toISOString();

    const success = await writeData(data);

    if (success) {
      res.json({ success: true, message: 'Order status updated successfully' });
    } else {
      res.status(500).json({ error: 'Failed to update order status' });
    }
  } catch (error) {
    console.error('❌ Update order status error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Track visitor
app.post('/api/analytics/visitor', async (req, res) => {
  try {
    const data = await readData();

    if (data) {
      if (!data.analytics) {
        data.analytics = { visitors: 0, ordersCount: 0, revenue: 0 };
      }
      data.analytics.visitors += 1;
      await writeData(data);
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  } catch (error) {
    console.error('❌ Visitor tracking error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get analytics
app.get('/api/analytics', authenticateToken, async (req, res) => {
  try {
    const data = await readData();
    if (data && data.analytics) {
      res.json(data.analytics);
    } else {
      res.status(500).json({ error: 'Failed to load analytics' });
    }
  } catch (error) {
    console.error('❌ Analytics error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get dashboard stats
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const data = await readData();
    if (data) {
      const completedOrders = data.orders ? data.orders.filter(order => order.status === 'completed') : [];
      const stats = {
        orders: completedOrders.length,
        products: data.products ? data.products.length : 0,
        visitors: data.analytics ? data.analytics.visitors : 0,
        revenue: data.analytics ? data.analytics.revenue : 0
      };
      res.json(stats);
    } else {
      res.status(500).json({ error: 'Failed to load dashboard stats' });
    }
  } catch (error) {
    console.error('❌ Dashboard stats error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset data endpoint
app.post('/api/reset-data', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Starting data reset...');
    
    const currentData = await readData();
    const productsCount = currentData?.products?.length || 0;
    const ordersCount = currentData?.orders?.length || 0;
    
    const hashedPassword = await bcrypt.hash('sadek2007sadek', 10);
    const resetData = {
      settings: {
        storeName: "متجر صادق لبيع الحسابات",
        heroTitle: "مرحباً بكم في متجر صادق",
        heroDescription: "وسيط موثوق لبيع وشراء حسابات فيسبوك، انستجرام، فري فاير وغيرها بنسبة وساطة 15%",
        currency: "DA",
        language: "ar",
        storeStatus: true,
        contact: {
          phone: "0795367580",
          whatsapp: "213795367580",
          email: "sadek.store@email.com",
          address: "وسيط إلكتروني",
          workingHours: "24/7",
          workingDays: "كل أيام الأسبوع"
        },
        social: {
          facebook: "https://www.facebook.com/sadekbelkhir2007",
          telegram: "https://t.me/sadekdzz"
        },
        logo: "https://github.com/Yacine2007/sadek-Accounts-Store/blob/main/logo.jpg?raw=true",
        storeUrl: "https://yacine2007.github.io/sadek-Accounts-Store/index.html"
      },
      user: {
        name: "Sadek Blkhiri",
        role: "وسيط متجر الحسابات",
        avatar: "https://github.com/Yacine2007/sadek-Accounts-Store/blob/main/logo.jpg?raw=true",
        password: hashedPassword,
        lastPasswordChange: new Date().toISOString()
      },
      categories: [
        { id: 1, name: "حسابات فيسبوك", description: "حسابات فيسبوك متنوعة" },
        { id: 2, name: "حسابات انستجرام", description: "حسابات انستجرام متنوعة" },
        { id: 3, name: "حسابات فري فاير", description: "حسابات لعبة فري فاير" },
        { id: 4, name: "حسابات ألعاب أخرى", description: "حسابات لألعاب مختلفة" }
      ],
      products: [],
      orders: [],
      analytics: {
        visitors: 0,
        ordersCount: 0,
        revenue: 0
      }
    };

    await fs.writeFile(DATA_FILE, JSON.stringify(resetData, null, 2));
    
    console.log('✅ Data reset completed');
    
    res.json({ 
      success: true, 
      message: 'Store data has been completely reset',
      resetSummary: {
        productsDeleted: productsCount,
        ordersDeleted: ordersCount,
        analyticsReset: true,
        settingsReset: true
      }
    });
    
  } catch (error) {
    console.error('❌ Reset data error:', error.message);
    res.status(500).json({ error: 'Failed to reset store data' });
  }
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Global error handler:', error.message);
  res.status(500).json({ 
    success: false,
    error: 'Internal server error: ' + error.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Endpoint not found' 
  });
});

// Initialize and start server
const startServer = async () => {
  try {
    await ensureDirectories();
    await initializeDataFile();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🏪 Store: http://localhost:${PORT}`);
      console.log(`👨‍💼 Admin: http://localhost:${PORT}/admin`);
      console.log(`🔑 Default password: sadek2007sadek`);
      console.log(`✅ Server optimized for Render deployment`);
      console.log(`🛠️ Fixed issues: Order details, Product details, WhatsApp redirection`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
