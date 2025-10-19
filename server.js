const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      const uploadsDir = path.join(__dirname, 'public', 'uploads');
      
      // إنشاء المجلد إذا لم يكن موجوداً (بدون existsSync)
      try {
        await fs.access(uploadsDir);
      } catch (error) {
        await fs.mkdir(uploadsDir, { recursive: true });
        console.log('📁 Created uploads directory');
      }
      
      cb(null, uploadsDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: function (req, file, cb) {
    const originalName = file.originalname;
    const fileExtension = path.extname(originalName);
    const baseName = path.basename(originalName, fileExtension);
    
    const cleanName = baseName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    
    const finalName = `${cleanName}-${timestamp}-${random}${fileExtension}`;
    cb(null, finalName);
  }
});

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

// إنشاء المجلدات المطلوبة (متوافق مع Render)
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
    
    const hashedPassword = await bcrypt.hash('user1234', 10);
    const initialData = {
      settings: {
        storeName: "My Store",
        heroTitle: "Welcome to Our Store",
        heroDescription: "Discover our amazing products with great offers and fast delivery.",
        currency: "DA",
        language: "en",
        storeStatus: true,
        theme: {
          primary: "#4361ee",
          secondary: "#3a0ca3",
          accent: "#f72585",
          background: "#ffffff",
          text: "#212529"
        },
        contact: {
          phone: "+213 123 456 789",
          whatsapp: "+213 123 456 789",
          email: "info@mystore.com",
          address: "Algiers, Algeria",
          workingHours: "8:00 AM - 5:00 PM",
          workingDays: "Saturday - Thursday"
        },
        social: {
          facebook: "",
          twitter: "",
          instagram: "",
          youtube: ""
        },
        logo: "",
        favicon: ""
      },
      user: {
        name: "Admin User",
        role: "System Administrator",
        avatar: "",
        password: hashedPassword,
        lastPasswordChange: new Date().toISOString()
      },
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

    console.log('📄 File details:', {
      originalname: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path
    });

    const imageUrl = `/uploads/${req.file.filename}`;
    
    console.log('✅ Image uploaded successfully:', imageUrl);
    
    res.json({ 
      success: true, 
      imageUrl: imageUrl,
      message: 'Image uploaded successfully',
      fileInfo: {
        name: req.file.filename,
        size: req.file.size,
        type: req.file.mimetype
      }
    });
    
  } catch (error) {
    console.error('❌ Upload error:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to upload image: ' + error.message 
    });
  }
});

// معالجة أخطاء multer
app.use('/api/upload', (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB.'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    error: error.message
  });
});

// رفع الصور بدون مصادقة
app.post('/api/upload-public', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No image file provided' 
      });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    
    console.log('✅ Public image uploaded:', imageUrl);
    
    res.json({ 
      success: true, 
      imageUrl: imageUrl,
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    console.error('❌ Public upload error:', error.message);
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
    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    
    let uploadsInfo = { exists: false, files: [] };
    try {
      await fs.access(uploadsDir);
      const files = await fs.readdir(uploadsDir);
      uploadsInfo = {
        exists: true,
        files: files.slice(0, 10)
      };
    } catch (error) {
      uploadsInfo.exists = false;
    }
    
    if (data) {
      res.json({
        success: true,
        hasData: true,
        userExists: !!data.user,
        settings: data.settings,
        productsCount: data.products ? data.products.length : 0,
        ordersCount: data.orders ? data.orders.length : 0,
        uploads: uploadsInfo,
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

// Update user profile
app.put('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const data = await readData();

    if (!data) {
      return res.status(500).json({ error: 'Server error - no data found' });
    }

    if (!data.user) {
      data.user = {};
    }

    data.user.name = name || data.user.name;
    data.user.avatar = avatar || data.user.avatar;

    const success = await writeData(data);

    if (success) {
      res.json({ 
        success: true, 
        message: 'Profile updated successfully',
        user: {
          name: data.user.name,
          role: data.user.role,
          avatar: data.user.avatar
        }
      });
    } else {
      res.status(500).json({ error: 'Failed to update profile' });
    }
  } catch (error) {
    console.error('❌ Update profile error:', error.message);
    res.status(500).json({ error: 'Server error during profile update' });
  }
});

// Get user profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const data = await readData();
    if (data && data.user) {
      res.json({
        name: data.user.name,
        role: data.user.role,
        avatar: data.user.avatar
      });
    } else {
      res.status(500).json({ error: 'Failed to load profile' });
    }
  } catch (error) {
    console.error('❌ Profile error:', error.message);
    res.status(500).json({ error: 'Server error' });
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

// Get single product
app.get('/api/products/:id', authenticateToken, async (req, res) => {
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
      price: parseFloat(productData.price),
      quantity: parseInt(productData.quantity),
      category: productData.category || '',
      status: productData.status !== undefined ? productData.status : true,
      deliveryAvailable: productData.deliveryAvailable !== undefined ? productData.deliveryAvailable : true,
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
      price: parseFloat(productData.price),
      quantity: parseInt(productData.quantity),
      category: productData.category || '',
      status: productData.status !== undefined ? productData.status : true,
      deliveryAvailable: productData.deliveryAvailable !== undefined ? productData.deliveryAvailable : true,
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

// Get single order
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

// Create order
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
      address: orderData.address || '',
      phone: orderData.phone,
      deliveryOption: orderData.deliveryOption || 'delivery',
      status: 'pending',
      total: orderData.total || (orderData.items ? orderData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0) : 0),
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
      res.json({ success: true, orderId: newOrder.id });
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

    const oldStatus = order.status;
    order.status = status;
    order.updatedAt = new Date().toISOString();

    if (!data.analytics) {
      data.analytics = { visitors: 0, ordersCount: 0, revenue: 0 };
    }

    if (status === 'completed' && oldStatus !== 'completed') {
      data.analytics.ordersCount += 1;
      data.analytics.revenue += order.total;
    }
    else if (oldStatus === 'completed' && status !== 'completed') {
      data.analytics.ordersCount = Math.max(0, data.analytics.ordersCount - 1);
      data.analytics.revenue = Math.max(0, data.analytics.revenue - order.total);
    }

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
    
    const hashedPassword = await bcrypt.hash('user1234', 10);
    const resetData = {
      settings: {
        storeName: "My Store",
        heroTitle: "Welcome to Our Store",
        heroDescription: "Discover our amazing products with great offers and fast delivery.",
        currency: "DA",
        language: "en",
        storeStatus: true,
        theme: {
          primary: "#4361ee",
          secondary: "#3a0ca3",
          accent: "#f72585",
          background: "#ffffff",
          text: "#212529"
        },
        contact: {
          phone: "+213 123 456 789",
          whatsapp: "+213 123 456 789",
          email: "info@mystore.com",
          address: "Algiers, Algeria",
          workingHours: "8:00 AM - 5:00 PM",
          workingDays: "Saturday - Thursday"
        },
        social: {
          facebook: "",
          twitter: "",
          instagram: "",
          youtube: ""
        },
        logo: "",
        favicon: ""
      },
      user: {
        name: "Admin User",
        role: "System Administrator",
        avatar: "",
        password: hashedPassword,
        lastPasswordChange: new Date().toISOString()
      },
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
      console.log(`🔑 Default password: user1234`);
      console.log(`📁 Uploads: http://localhost:${PORT}/uploads`);
      console.log(`📊 Data file: ${DATA_FILE}`);
      console.log(`✅ Server optimized for Render deployment`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
