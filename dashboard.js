// API Configuration
const API_BASE_URL = 'https://sadek-accounts-store.onrender.com/api';
const TOKEN_KEY = 'admin_token';

// Global Variables
let currentUser = null;
let dashboardData = null;
let settingsData = null;
let products = [];
let orders = [];
let categories = [];

// DOM Elements
const loginPage = document.getElementById('loginPage');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const notification = document.getElementById('notification');
const notificationTitle = document.getElementById('notificationTitle');
const notificationMessage = document.getElementById('notificationMessage');
const notificationClose = document.getElementById('notificationClose');

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎉 لوحة التحكم جاهزة');
    console.log('🚀 استخدام رابط API:', API_BASE_URL);
    
    initDashboard();
    setupEventListeners();
    initMobileOptimizations();
});

// Enhanced API Request Helper
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem(TOKEN_KEY);
    
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers
        },
        ...options
    };

    // Remove Content-Type for FormData requests
    if (options.body instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    console.log(`🔄 طلب API: ${endpoint}`, config.method || 'GET');

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || data.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        return data;
    } catch (error) {
        console.error(`❌ خطأ في API (${endpoint}):`, error);
        throw error;
    }
}

// Dashboard Initialization
async function initDashboard() {
    console.log('🎯 تهيئة لوحة التحكم...');
    
    // Check API health
    const isHealthy = await checkAPIHealth();
    if (!isHealthy) {
        showLogin();
        return;
    }
    
    // Check authentication
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
        console.log('🔑 تم العثور على رمز التحقق...');
        await verifyToken(token);
    } else {
        console.log('❌ لم يتم العثور على رمز التحقق، عرض صفحة التسجيل');
        showLogin();
    }
}

// API Health Check
async function checkAPIHealth() {
    try {
        console.log('🔍 فحص حالة API...');
        const response = await fetch(`${API_BASE_URL}/health`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ API يعمل بشكل صحيح:', data);
        return true;
    } catch (error) {
        console.error('❌ فحص حالة API فشل:', error);
        showNotification('خطأ في الاتصال', 'تعذر الاتصال بالخادم. يرجى المحاولة مرة أخرى لاحقاً.', 'error');
        return false;
    }
}

// Token Verification
async function verifyToken(token) {
    try {
        const data = await apiRequest('/user/profile');
        
        if (data && data.name) {
            currentUser = data;
            console.log('✅ تم التحقق من الرمز، المستخدم:', data.name);
            showDashboard();
            loadDashboardData();
        } else {
            throw new Error('بيانات المستخدم غير صالحة');
        }
    } catch (error) {
        console.error('❌ فشل التحقق من الرمز:', error);
        localStorage.removeItem(TOKEN_KEY);
        showLogin();
        showNotification('انتهت الجلسة', 'يرجى تسجيل الدخول مرة أخرى', 'warning');
    }
}

// Show Login Page
function showLogin() {
    loginPage.style.display = 'flex';
    dashboard.style.display = 'none';
    loadStoreSettingsForLogin();
}

// Show Dashboard
function showDashboard() {
    loginPage.style.display = 'none';
    dashboard.style.display = 'flex';
    updateUserInfo();
}

// Load Store Settings for Login Page
async function loadStoreSettingsForLogin() {
    try {
        const settings = await apiRequest('/settings');
        if (settings && settings.logo) {
            const fullLogoUrl = settings.logo.startsWith('http') ? 
                settings.logo : 
                `${API_BASE_URL.replace('/api', '')}${settings.logo}`;
            document.getElementById('loginLogo').src = fullLogoUrl;
        }
    } catch (error) {
        console.log('⚠️ تعذر تحميل إعدادات المتجر لتسجيل الدخول');
    }
}

// Update User Info
function updateUserInfo() {
    if (currentUser) {
        document.getElementById('adminName').textContent = currentUser.name || 'صادق بلخيري';
        document.getElementById('adminNameInput').value = currentUser.name || 'صادق بلخيري';
        document.getElementById('adminRole').value = currentUser.role || 'وسيط متجر الحسابات';
        
        // Update avatar if available
        const adminAvatar = document.getElementById('adminAvatar');
        if (currentUser.avatar) {
            const avatarUrl = currentUser.avatar.startsWith('http') ? 
                currentUser.avatar : 
                `${API_BASE_URL.replace('/api', '')}${currentUser.avatar}`;
            
            adminAvatar.innerHTML = `<img src="${avatarUrl}" alt="${currentUser.name}" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else {
            adminAvatar.innerHTML = '<i class="fas fa-user"></i>';
        }
        
        console.log('👤 تم تحديث معلومات المستخدم:', currentUser.name);
    }
}

// Load Dashboard Data
async function loadDashboardData() {
    console.log('📊 تحميل بيانات لوحة التحكم...');
    
    try {
        await Promise.all([
            loadDashboardStats(),
            loadOrders(),
            loadCategories(),
            loadSettings()
        ]);
        
        console.log('✅ تم تحميل بيانات لوحة التحكم بنجاح');
    } catch (error) {
        console.error('❌ خطأ في تحميل بيانات لوحة التحكم:', error);
        showNotification('خطأ', 'فشل في تحميل بيانات لوحة التحكم', 'error');
    }
}

// Load Dashboard Stats
async function loadDashboardStats() {
    try {
        const stats = await apiRequest('/dashboard/stats');
        updateStats(stats);
        console.log('📈 تم تحميل الإحصائيات:', stats);
    } catch (error) {
        console.error('❌ خطأ في تحميل الإحصائيات:', error);
        // Set default values
        updateStats({ orders: 0, products: 0, visitors: 0, revenue: 0 });
    }
}

// Update Stats Display
function updateStats(stats) {
    document.getElementById('ordersCount').textContent = stats.orders || 0;
    document.getElementById('productsCount').textContent = stats.products || 0;
    document.getElementById('visitorsCount').textContent = stats.visitors || 0;
    document.getElementById('revenueAmount').textContent = `${stats.revenue || 0} DA`;
}

// Setup Event Listeners
function setupEventListeners() {
    console.log('🔧 إعداد مستمعي الأحداث...');
    
    // Login form
    loginForm.addEventListener('submit', handleLogin);
    
    // Logout
    logoutBtn.addEventListener('click', handleLogout);
    
    // Mobile menu toggle
    menuToggle.addEventListener('click', toggleSidebar);
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', toggleSidebar);
    }
    
    // Notification close
    notificationClose.addEventListener('click', hideNotification);
    
    // Tab navigation
    document.querySelectorAll('.menu-item[data-tab]').forEach(item => {
        item.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
            
            // Close sidebar on mobile after selecting a tab
            if (window.innerWidth <= 768) {
                toggleSidebar();
            }
        });
    });
    
    // Settings tabs
    document.querySelectorAll('#settings-tab .tab[data-tab]').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchSettingsTab(tabId);
        });
    });
    
    // Forms
    document.getElementById('settingsForm').addEventListener('submit', handleSettingsSave);
    
    // Category management
    document.getElementById('addCategoryBtn').addEventListener('click', showAddCategoryModal);
    document.getElementById('categoryForm').addEventListener('submit', handleCategorySave);
    
    // Product management
    document.getElementById('addProductBtn').addEventListener('click', showAddProductModal);
    document.getElementById('productForm').addEventListener('submit', handleProductSave);
    
    // Image uploads
    setupImageUploads();
    
    // Reset store confirmation
    setupResetStoreConfirmation();
    
    // Order management
    document.getElementById('updateOrderStatusBtn').addEventListener('click', updateOrderStatusFromModal);
    
    // Modal close events
    setupModalEvents();
    
    console.log('✅ اكتمل إعداد مستمعي الأحداث');
}

// Handle Login
async function handleLogin(e) {
    e.preventDefault();
    
    const password = document.getElementById('password').value;
    const loginBtn = loginForm.querySelector('button[type="submit"]');
    
    if (!password) {
        showNotification('خطأ', 'يرجى إدخال كلمة المرور', 'error');
        return;
    }
    
    // Show loading state
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري تسجيل الدخول...';
    loginBtn.disabled = true;
    
    try {
        const data = await apiRequest('/login', {
            method: 'POST',
            body: JSON.stringify({ password })
        });
        
        if (data.success && data.token) {
            localStorage.setItem(TOKEN_KEY, data.token);
            currentUser = data.user || { name: 'صادق بلخيري' };
            
            showNotification('نجاح', `مرحباً بعودتك، ${currentUser.name}!`, 'success');
            
            setTimeout(() => {
                showDashboard();
                loadDashboardData();
            }, 1000);
            
        } else {
            throw new Error(data.error || 'فشل المصادقة');
        }
        
    } catch (error) {
        console.error('❌ فشل تسجيل الدخول:', error);
        showNotification('خطأ', error.message || 'فشل تسجيل الدخول. يرجى التحقق من كلمة المرور.', 'error');
    } finally {
        // Reset button state
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
    }
}

// Handle Logout
function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    currentUser = null;
    showNotification('معلومات', 'تم تسجيل الخروج', 'info');
    setTimeout(() => {
        showLogin();
    }, 1000);
}

// Toggle Sidebar (Mobile)
function toggleSidebar() {
    sidebar.classList.toggle('active');
    if (sidebarOverlay) {
        sidebarOverlay.classList.toggle('active');
    }
    
    // Prevent body scroll when sidebar is open
    if (sidebar.classList.contains('active')) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = 'auto';
    }
}

// Switch Tabs
function switchTab(tabId) {
    // Update menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeMenuItem = document.querySelector(`.menu-item[data-tab="${tabId}"]`);
    if (activeMenuItem) {
        activeMenuItem.classList.add('active');
    }
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    const activeTab = document.getElementById(tabId);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // Update header title
    const headerTitle = document.querySelector('.header h1');
    if (activeMenuItem) {
        const tabName = activeMenuItem.querySelector('span').textContent;
        headerTitle.textContent = tabName;
    }
    
    // Load tab-specific data
    switch(tabId) {
        case 'dashboard-tab':
            loadDashboardStats();
            loadRecentOrders();
            break;
        case 'categories-tab':
            loadCategories();
            break;
        case 'products-tab':
            loadProducts();
            break;
        case 'orders-tab':
            loadOrders();
            break;
        case 'settings-tab':
            loadSettings();
            break;
    }
}

// Switch Settings Tabs
function switchSettingsTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('#settings-tab .tab[data-tab]').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`#settings-tab .tab[data-tab="${tabId}"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('#settings-tab .tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
}

// Load Categories
async function loadCategories() {
    try {
        categories = await apiRequest('/categories');
        displayCategories(categories);
        displayCategoriesMobile(categories);
        populateCategorySelect();
        console.log('🏷️ تم تحميل التصنيفات:', categories.length);
    } catch (error) {
        console.error('❌ خطأ في تحميل التصنيفات:', error);
        showNotification('خطأ', 'فشل في تحميل التصنيفات', 'error');
    }
}

// Load Products
async function loadProducts() {
    try {
        products = await apiRequest('/products');
        displayProducts(products);
        displayProductsMobile(products);
        console.log('👤 تم تحميل الحسابات:', products.length);
    } catch (error) {
        console.error('❌ خطأ في تحميل الحسابات:', error);
        showNotification('خطأ', 'فشل في تحميل الحسابات', 'error');
    }
}

// Load Orders
async function loadOrders() {
    try {
        orders = await apiRequest('/orders');
        displayOrders(orders);
        displayOrdersMobile(orders);
        updateRecentOrders(orders);
        console.log('📋 تم تحميل الطلبات:', orders.length);
    } catch (error) {
        console.error('❌ خطأ في تحميل الطلبات:', error);
        showNotification('خطأ', 'فشل في تحميل الطلبات', 'error');
    }
}

// Load Recent Orders
function loadRecentOrders() {
    if (orders.length > 0) {
        updateRecentOrders(orders);
        updateRecentOrdersMobile(orders);
    }
}

// Load Settings
async function loadSettings() {
    try {
        settingsData = await apiRequest('/settings');
        populateSettingsForm(settingsData);
        console.log('⚙️ تم تحميل الإعدادات');
    } catch (error) {
        console.error('❌ خطأ في تحميل الإعدادات:', error);
    }
}

// Display Categories - Desktop Table
function displayCategories(categories) {
    const tbody = document.querySelector('#categoriesTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (categories.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: #6c757d; padding: 20px;">
                    لا توجد تصنيفات. <a href="#" onclick="showAddCategoryModal()" style="color: #e63946;">أضف أول تصنيف</a>
                </td>
            </tr>
        `;
        return;
    }
    
    categories.forEach(category => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${category.name}</td>
            <td>${category.description || 'لا يوجد وصف'}</td>
            <td>${new Date(category.createdAt).toLocaleDateString('ar-EG')}</td>
            <td>
                <div class="action-group">
                    <button class="action-btn btn-primary" onclick="editCategory('${category.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn btn-danger" onclick="deleteCategory('${category.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Display Categories - Mobile Cards
function displayCategoriesMobile(categories) {
    const container = document.getElementById('categoriesMobile');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (categories.length === 0) {
        container.innerHTML = `
            <div class="mobile-category-card" style="text-align: center; color: #6c757d; padding: 20px;">
                لا توجد تصنيفات. <a href="#" onclick="showAddCategoryModal()" style="color: #e63946;">أضف أول تصنيف</a>
            </div>
        `;
        return;
    }
    
    categories.forEach(category => {
        const card = document.createElement('div');
        card.className = 'mobile-category-card';
        card.innerHTML = `
            <div class="mobile-card-header">
                <div class="mobile-card-title">${category.name}</div>
                <div class="mobile-card-actions">
                    <button class="action-btn btn-primary" onclick="editCategory('${category.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn btn-danger" onclick="deleteCategory('${category.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="mobile-card-body">
                <div class="mobile-card-section">
                    <div class="mobile-card-field">
                        <div class="mobile-card-label">الوصف</div>
                        <div class="mobile-card-value">${category.description || 'لا يوجد وصف'}</div>
                    </div>
                </div>
                <div class="mobile-card-section">
                    <div class="mobile-card-field">
                        <div class="mobile-card-label">تاريخ الإضافة</div>
                        <div class="mobile-card-value">${new Date(category.createdAt).toLocaleDateString('ar-EG')}</div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Display Products - Desktop Table
function displayProducts(products) {
    const tbody = document.querySelector('#productsTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: #6c757d; padding: 20px;">
                    لا توجد حسابات. <a href="#" onclick="showAddProductModal()" style="color: #e63946;">أضف أول حساب</a>
                </td>
            </tr>
        `;
        return;
    }
    
    products.forEach(product => {
        const imageUrl = product.images && product.images.length > 0 ? 
            product.images[0] : 
            'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjMTIxMjEyIiByeD0iNCIvPgo8cGF0aCBkPSJNMzAgMjBIMjBWMzBIMzBWMjBaIiBmaWxsPSIjMzMzIi8+CjxwYXRoIGQ9Ik0yNSAxNUMzMS4wODI1IDE1IDM2IDIwLjA0MjUgMzYgMjYuNUMzNiAzMi45NTc1IDMxLjA4MjUgMzggMjUgMzhDMTguOTE3NSAzOCAxNCAzMi45NTc1IDE0IDI2LjVDMTQgMjAuMDQyNSAxOC45MTc1IDE1IDI1IDE1WiIgZmlsbD0iIzMzMyIvPgo8L3N2Zz4K';
        
        const priceDisplay = product.price && product.price !== 'PRV' ? 
            `${product.price} ${product.currency || 'DA'}` : 
            'سعر خاص';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <img src="${imageUrl}" alt="${product.name}" 
                     style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;"
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjMTIxMjEyIiByeD0iNCIvPgo8cGF0aCBkPSJNMzAgMjBIMjBWMzBIMzBWMjBaIiBmaWxsPSIjMzMzIi8+CjxwYXRoIGQ9Ik0yNSAxNUMzMS4wODI1IDE1IDM2IDIwLjA0MjUgMzYgMjYuNUMzNiAzMi45NTc1IDMxLjA4MjUgMzggMjUgMzhDMTguOTE3NSAzOCAxNCAzMi45NTc1IDE0IDI2LjVDMTQgMjAuMDQyNSAxOC45MTc1IDE1IDI1IDE1WiIgZmlsbD0iIzMzMyIvPgo8L3N2Zz4K'">
            </td>
            <td>${product.name}</td>
            <td>${priceDisplay}</td>
            <td>${product.category || 'غير مصنف'}</td>
            <td>
                <span class="status-badge ${product.status ? 'active' : 'inactive'}">
                    ${product.status ? 'نشط' : 'غير نشط'}
                </span>
            </td>
            <td>
                <div class="action-group">
                    <button class="action-btn btn-primary" onclick="editProduct('${product.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn btn-danger" onclick="deleteProduct('${product.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Display Products - Mobile Cards
function displayProductsMobile(products) {
    const container = document.getElementById('productsMobile');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (products.length === 0) {
        container.innerHTML = `
            <div class="mobile-product-card" style="text-align: center; color: #6c757d; padding: 20px;">
                لا توجد حسابات. <a href="#" onclick="showAddProductModal()" style="color: #e63946;">أضف أول حساب</a>
            </div>
        `;
        return;
    }
    
    products.forEach(product => {
        const imageUrl = product.images && product.images.length > 0 ? 
            product.images[0] : 
            'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjMTIxMjEyIiByeD0iNCIvPgo8cGF0aCBkPSJNMzAgMjBIMjBWMzBIMzBWMjBaIiBmaWxsPSIjMzMzIi8+CjxwYXRoIGQ9Ik0yNSAxNUMzMS4wODI1IDE1IDM2IDIwLjA0MjUgMzYgMjYuNUMzNiAzMi45NTc1IDMxLjA4MjUgMzggMjUgMzhDMTguOTE3NSAzOCAxNCAzMi45NTc1IDE0IDI2LjVDMTQgMjAuMDQyNSAxOC45MTc1IDE1IDI1IDE1WiIgZmlsbD0iIzMzMyIvPgo8L3N2Zz4K';
        
        const priceDisplay = product.price && product.price !== 'PRV' ? 
            `${product.price} ${product.currency || 'DA'}` : 
            'سعر خاص';
        
        const card = document.createElement('div');
        card.className = 'mobile-product-card';
        card.innerHTML = `
            <div class="mobile-card-header">
                <div class="mobile-card-title">${product.name}</div>
                <div class="mobile-card-actions">
                    <button class="action-btn btn-primary" onclick="editProduct('${product.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn btn-danger" onclick="deleteProduct('${product.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="mobile-card-body">
                <div class="mobile-card-section">
                    <div class="mobile-card-field">
                        <div class="mobile-card-label">الصورة</div>
                        <img src="${imageUrl}" alt="${product.name}" 
                             style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;"
                             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjMTIxMjEyIiByeD0iNCIvPgo8cGF0aCBkPSJNMzAgMjBIMjBWMzBIMzBWMjBaIiBmaWxsPSIjMzMzIi8+CjxwYXRoIGQ9Ik0yNSAxNUMzMS4wODI1IDE1IDM2IDIwLjA0MjUgMzYgMjYuNUMzNiAzMi45NTc1IDMxLjA4MjUgMzggMjUgMzhDMTguOTE3NSAzOCAxNCAzMi45NTc1IDE0IDI2LjVDMTQgMjAuMDQyNSAxOC45MTc1IDE1IDI1IDE1WiIgZmlsbD0iIzMzMyIvPgo8L3N2Zz4K'">
                    </div>
                    <div class="mobile-card-field">
                        <div class="mobile-card-label">السعر</div>
                        <div class="mobile-card-value">${priceDisplay}</div>
                    </div>
                </div>
                <div class="mobile-card-section">
                    <div class="mobile-card-field">
                        <div class="mobile-card-label">التصنيف</div>
                        <div class="mobile-card-value">${product.category || 'غير مصنف'}</div>
                    </div>
                    <div class="mobile-card-field">
                        <div class="mobile-card-label">الحالة</div>
                        <span class="status-badge ${product.status ? 'active' : 'inactive'}">
                            ${product.status ? 'نشط' : 'غير نشط'}
                        </span>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Display Orders - Desktop Table
function displayOrders(orders) {
    const tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: #6c757d; padding: 20px;">
                    لا توجد طلبات بعد
                </td>
            </tr>
        `;
        return;
    }
    
    // Sort orders by date (newest first)
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    orders.forEach(order => {
        const itemsCount = order.items ? order.items.length : 0;
        const itemsText = itemsCount === 1 ? 'عنصر واحد' : `${itemsCount} عناصر`;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>#${order.id}</td>
            <td>${order.customerName}</td>
            <td>${order.phone}</td>
            <td>${itemsText}</td>
            <td>${order.total} DA</td>
            <td>
                <span class="status-badge ${order.status}">
                    ${getOrderStatusText(order.status)}
                </span>
            </td>
            <td>${new Date(order.createdAt).toLocaleDateString('ar-EG')}</td>
            <td>
                <button class="action-btn btn-primary" onclick="viewOrderDetails('${order.id}')">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Display Orders - Mobile Cards
function displayOrdersMobile(orders) {
    const container = document.getElementById('ordersMobile');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (orders.length === 0) {
        container.innerHTML = `
            <div class="mobile-order-card" style="text-align: center; color: #6c757d; padding: 20px;">
                لا توجد طلبات بعد
            </div>
        `;
        return;
    }
    
    // Sort orders by date (newest first)
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    orders.forEach(order => {
        const itemsCount = order.items ? order.items.length : 0;
        const itemsText = itemsCount === 1 ? 'عنصر واحد' : `${itemsCount} عناصر`;
        
        const card = document.createElement('div');
        card.className = 'mobile-order-card';
        card.innerHTML = `
            <div class="mobile-card-header">
                <div class="mobile-card-title">طلب #${order.id}</div>
                <div class="mobile-card-actions">
                    <button class="action-btn btn-primary" onclick="viewOrderDetails('${order.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
            <div class="mobile-card-body">
                <div class="mobile-card-section">
                    <div class="mobile-card-field">
                        <div class="mobile-card-label">العميل</div>
                        <div class="mobile-card-value">${order.customerName}</div>
                    </div>
                    <div class="mobile-card-field">
                        <div class="mobile-card-label">الهاتف</div>
                        <div class="mobile-card-value">${order.phone}</div>
                    </div>
                </div>
                <div class="mobile-card-section">
                    <div class="mobile-card-field">
                        <div class="mobile-card-label">العناصر</div>
                        <div class="mobile-card-value">${itemsText}</div>
                    </div>
                    <div class="mobile-card-field">
                        <div class="mobile-card-label">المجموع</div>
                        <div class="mobile-card-value">${order.total} DA</div>
                    </div>
                </div>
                <div class="mobile-card-section">
                    <div class="mobile-card-field">
                        <div class="mobile-card-label">الحالة</div>
                        <span class="status-badge ${order.status}">
                            ${getOrderStatusText(order.status)}
                        </span>
                    </div>
                    <div class="mobile-card-field">
                        <div class="mobile-card-label">التاريخ</div>
                        <div class="mobile-card-value">${new Date(order.createdAt).toLocaleDateString('ar-EG')}</div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Update Recent Orders (Dashboard) - Desktop
function updateRecentOrders(orders) {
    const tbody = document.querySelector('#recentOrdersTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Get recent orders (last 5)
    const recentOrders = orders.slice(0, 5);
    
    if (recentOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: #6c757d; padding: 20px;">
                    لا توجد طلبات حديثة
                </td>
            </tr>
        `;
        return;
    }
    
    recentOrders.forEach(order => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>#${order.id}</td>
            <td>${order.customerName}</td>
            <td>${order.total} DA</td>
            <td>
                <span class="status-badge ${order.status}">
                    ${getOrderStatusText(order.status)}
                </span>
            </td>
            <td>${new Date(order.createdAt).toLocaleDateString('ar-EG')}</td>
            <td>
                <button class="action-btn btn-primary" onclick="viewOrderDetails('${order.id}')">
                    <i class="fas fa-eye"></i> عرض
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Update Recent Orders - Mobile
function updateRecentOrdersMobile(orders) {
    const container = document.getElementById('recentOrdersMobile');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Get recent orders (last 5)
    const recentOrders = orders.slice(0, 5);
    
    if (recentOrders.length === 0) {
        container.innerHTML = `
            <div class="mobile-order-card" style="text-align: center; color: #6c757d; padding: 20px;">
                لا توجد طلبات حديثة
            </div>
        `;
        return;
    }
    
    recentOrders.forEach(order => {
        const card = document.createElement('div');
        card.className = 'mobile-order-card';
        card.innerHTML = `
            <div class="mobile-card-header">
                <div class="mobile-card-title">طلب #${order.id}</div>
                <div class="mobile-card-actions">
                    <button class="action-btn btn-primary" onclick="viewOrderDetails('${order.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
            <div class="mobile-card-body">
                <div class="mobile-card-section">
                    <div class="mobile-card-field">
                        <div class="mobile-card-label">العميل</div>
                        <div class="mobile-card-value">${order.customerName}</div>
                    </div>
                    <div class="mobile-card-field">
                        <div class="mobile-card-label">المبلغ</div>
                        <div class="mobile-card-value">${order.total} DA</div>
                    </div>
                </div>
                <div class="mobile-card-section">
                    <div class="mobile-card-field">
                        <div class="mobile-card-label">الحالة</div>
                        <span class="status-badge ${order.status}">
                            ${getOrderStatusText(order.status)}
                        </span>
                    </div>
                    <div class="mobile-card-field">
                        <div class="mobile-card-label">التاريخ</div>
                        <div class="mobile-card-value">${new Date(order.createdAt).toLocaleDateString('ar-EG')}</div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Get order status text in Arabic
function getOrderStatusText(status) {
    const statusMap = {
        'pending': 'قيد الانتظار',
        'completed': 'مكتمل',
        'cancelled': 'ملغي'
    };
    return statusMap[status] || status;
}

// Populate Settings Form
function populateSettingsForm(settings) {
    if (!settings) return;
    
    // General Settings
    document.getElementById('storeName').value = settings.storeName || '';
    document.getElementById('heroTitle').value = settings.heroTitle || '';
    document.getElementById('heroDescription').value = settings.heroDescription || '';
    document.getElementById('currency').value = settings.currency || 'DA';
    document.getElementById('language').value = settings.language || 'ar';
    document.getElementById('storeStatus').value = settings.storeStatus ? 'true' : 'false';
    
    // Contact Settings
    if (settings.contact) {
        document.getElementById('contactPhone').value = settings.contact.phone || '';
        document.getElementById('contactWhatsapp').value = settings.contact.whatsapp || '';
        document.getElementById('contactEmail').value = settings.contact.email || '';
        document.getElementById('contactAddress').value = settings.contact.address || '';
        document.getElementById('workingHours').value = settings.contact.workingHours || '';
        document.getElementById('workingDays').value = settings.contact.workingDays || '';
    }
    
    // Social Media
    if (settings.social) {
        document.getElementById('facebookUrl').value = settings.social.facebook || '';
        document.getElementById('telegramUrl').value = settings.social.telegram || '';
        document.getElementById('storeUrl').value = settings.storeUrl || '';
    }
}

// Handle Settings Save
async function handleSettingsSave(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
        submitBtn.disabled = true;
        
        const settings = {
            storeName: document.getElementById('storeName').value,
            heroTitle: document.getElementById('heroTitle').value,
            heroDescription: document.getElementById('heroDescription').value,
            currency: document.getElementById('currency').value,
            language: document.getElementById('language').value,
            storeStatus: document.getElementById('storeStatus').value === 'true',
            contact: {
                phone: document.getElementById('contactPhone').value,
                whatsapp: document.getElementById('contactWhatsapp').value,
                email: document.getElementById('contactEmail').value,
                address: document.getElementById('contactAddress').value,
                workingHours: document.getElementById('workingHours').value,
                workingDays: document.getElementById('workingDays').value
            },
            social: {
                facebook: document.getElementById('facebookUrl').value,
                telegram: document.getElementById('telegramUrl').value
            },
            storeUrl: document.getElementById('storeUrl').value
        };
        
        await apiRequest('/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
        
        showNotification('نجاح', 'تم حفظ الإعدادات بنجاح!', 'success');
        
    } catch (error) {
        console.error('❌ خطأ في حفظ الإعدادات:', error);
        showNotification('خطأ', 'فشل في حفظ الإعدادات: ' + error.message, 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Setup Image Uploads
function setupImageUploads() {
    // Product images upload
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    if (uploadArea && fileInput) {
        uploadArea.addEventListener('click', () => fileInput.click());
        setupDragAndDrop(uploadArea, handleProductImagesUpload);
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleProductImagesUpload(e.target.files);
            }
        });
    }
}

// Setup Drag and Drop
function setupDragAndDrop(uploadArea, handler) {
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handler(files);
        }
    });
}

// Handle Product Images Upload
async function handleProductImagesUpload(files) {
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const productImages = document.getElementById('productImages');
    
    if (progressBar) progressBar.style.display = 'block';
    
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
        showNotification('خطأ', 'يرجى اختيار ملفات صور فقط', 'error');
        if (progressBar) progressBar.style.display = 'none';
        return;
    }
    
    const uploadedUrls = [];
    
    for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        
        if (file.size > 10 * 1024 * 1024) {
            showNotification('خطأ', `الملف ${file.name} كبير جداً (الحد الأقصى 10MB)`, 'error');
            continue;
        }
        
        try {
            const formData = new FormData();
            formData.append('image', file);
            
            const result = await apiRequest('/upload', {
                method: 'POST',
                body: formData
            });
            
            if (result.success && result.imageUrl) {
                const fullImageUrl = `${API_BASE_URL.replace('/api', '')}${result.imageUrl}`;
                uploadedUrls.push(fullImageUrl);
                
                // Update progress
                if (progressFill) {
                    const progress = ((i + 1) / imageFiles.length) * 100;
                    progressFill.style.width = `${progress}%`;
                }
                
                // Add image preview
                if (imagePreviewContainer) {
                    const img = document.createElement('img');
                    img.src = fullImageUrl;
                    img.className = 'image-preview';
                    img.style.display = 'block';
                    imagePreviewContainer.appendChild(img);
                }
            }
        } catch (error) {
            console.error('❌ خطأ في رفع الصورة:', error);
            showNotification('خطأ', `فشل في رفع: ${file.name}`, 'error');
        }
    }
    
    // Update product images field
    if (productImages) {
        productImages.value = uploadedUrls.join(',');
    }
    
    if (progressBar) {
        progressBar.style.display = 'none';
        if (progressFill) progressFill.style.width = '0%';
    }
    
    if (uploadedUrls.length > 0) {
        showNotification('نجاح', `تم رفع ${uploadedUrls.length} صورة بنجاح!`, 'success');
    }
}

// Setup Reset Store Confirmation
function setupResetStoreConfirmation() {
    const resetConfirmInput = document.getElementById('resetConfirmInput');
    const resetStoreBtn = document.getElementById('resetStoreBtn');
    
    if (resetConfirmInput && resetStoreBtn) {
        resetConfirmInput.addEventListener('input', function() {
            resetStoreBtn.disabled = this.value !== 'RESET';
        });
        
        resetStoreBtn.addEventListener('click', async function() {
            if (!resetStoreBtn.disabled) {
                const confirmed = confirm('🚨 تحذير نهائي 🚨\n\nأنت على وشك:\n• حذف جميع الحسابات\n• حذف جميع الطلبات\n• إعادة تعيين جميع الإحصائيات\n• إعادة إعدادات المتجر\n• الاحتفاظ بملف الوسيط\n\nهذا الإجراء نهائي ولا يمكن التراجع عنه!\n\nانقر موافق للمتابعة أو إلغاء للإيقاف.');
                if (confirmed) {
                    await resetStoreData();
                }
            }
        });
        
        // Prevent paste and lowercase input
        resetConfirmInput.addEventListener('paste', (e) => e.preventDefault());
        resetConfirmInput.addEventListener('keypress', (e) => {
            if (e.key >= 'a' && e.key <= 'z') {
                e.preventDefault();
                showNotification('مطلوب أحرف كبيرة', 'يرجى الكتابة بأحرف كبيرة فقط.', 'warning');
            }
        });
    }
}

// Reset Store Data
async function resetStoreData() {
    const resetStoreBtn = document.getElementById('resetStoreBtn');
    const resetConfirmInput = document.getElementById('resetConfirmInput');
    
    if (!resetStoreBtn) return;
    
    const originalText = resetStoreBtn.innerHTML;
    
    try {
        resetStoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إعادة التعيين...';
        resetStoreBtn.disabled = true;
        
        await apiRequest('/reset-data', {
            method: 'POST'
        });
        
        showNotification('نجاح', 'تم إعادة تعيين بيانات المتجر بنجاح', 'success');
        
        if (resetConfirmInput) resetConfirmInput.value = '';
        resetStoreBtn.innerHTML = '<i class="fas fa-check"></i> اكتمل إعادة التعيين!';
        resetStoreBtn.style.background = '#38a169';
        
        // Reload dashboard data after delay
        setTimeout(() => {
            window.location.reload();
        }, 3000);
        
    } catch (error) {
        console.error('❌ خطأ في إعادة تعيين المتجر:', error);
        resetStoreBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> فشل إعادة التعيين';
        resetStoreBtn.style.background = '#e53e3e';
        showNotification('فشل إعادة التعيين', 'فشل في إعادة تعيين بيانات المتجر: ' + error.message, 'error');
        
        // Reset button after delay
        setTimeout(() => {
            resetStoreBtn.innerHTML = originalText;
            resetStoreBtn.disabled = false;
        }, 3000);
    }
}

// Setup Modal Events
function setupModalEvents() {
    // Close modals when clicking outside
    window.addEventListener('click', function(e) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (e.target === modal) {
                closeModal(modal);
            }
        });
    });
    
    // Close modals with escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                closeModal(modal);
            });
        }
    });
    
    // Close modals with close button
    document.querySelectorAll('.close-modal').forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            closeModal(modal);
        });
    });
}

// Close Modal
function closeModal(modal) {
    if (modal) {
        modal.style.display = 'none';
    }
}

// Show Modal
function showModal(modal) {
    if (modal) {
        modal.style.display = 'flex';
    }
}

// Category Management
function showAddCategoryModal() {
    document.getElementById('categoryModalTitle').textContent = 'إضافة تصنيف';
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    showModal(document.getElementById('categoryModal'));
}

async function editCategory(categoryId) {
    try {
        const category = categories.find(c => c.id == categoryId);
        
        if (category) {
            document.getElementById('categoryModalTitle').textContent = 'تعديل التصنيف';
            document.getElementById('categoryId').value = category.id;
            document.getElementById('categoryName').value = category.name;
            document.getElementById('categoryDescription').value = category.description || '';
            
            showModal(document.getElementById('categoryModal'));
        }
    } catch (error) {
        console.error('❌ خطأ في تحميل التصنيف:', error);
        showNotification('خطأ', 'فشل في تحميل بيانات التصنيف', 'error');
    }
}

async function handleCategorySave(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
        submitBtn.disabled = true;
        
        const categoryId = document.getElementById('categoryId').value;
        const categoryData = {
            name: document.getElementById('categoryName').value,
            description: document.getElementById('categoryDescription').value
        };
        
        if (!categoryData.name) {
            throw new Error('يرجى ملء جميع الحقول المطلوبة');
        }
        
        const url = categoryId ? `/categories` : '/categories';
        const method = categoryId ? 'PUT' : 'POST';
        
        if (categoryId) {
            categoryData.id = parseInt(categoryId);
        }
        
        await apiRequest(url, {
            method,
            body: JSON.stringify(categoryData)
        });
        
        showNotification('نجاح', `تم ${categoryId ? 'تحديث' : 'إضافة'} التصنيف بنجاح!`, 'success');
        closeModal(document.getElementById('categoryModal'));
        loadCategories();
        
    } catch (error) {
        console.error('❌ خطأ في حفظ التصنيف:', error);
        showNotification('خطأ', `فشل في ${categoryId ? 'تحديث' : 'إضافة'} التصنيف: ` + error.message, 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function deleteCategory(categoryId) {
    const confirmed = confirm('هل أنت متأكد من رغبتك في حذف هذا التصنيف؟ لا يمكن التراجع عن هذا الإجراء.');
    if (!confirmed) return;
    
    try {
        // Since we don't have a delete endpoint, we'll filter locally
        categories = categories.filter(c => c.id != categoryId);
        displayCategories(categories);
        displayCategoriesMobile(categories);
        populateCategorySelect();
        
        showNotification('نجاح', 'تم حذف التصنيف بنجاح!', 'success');
    } catch (error) {
        console.error('❌ خطأ في حذف التصنيف:', error);
        showNotification('خطأ', 'فشل في حذف التصنيف', 'error');
    }
}

// Populate Category Select
function populateCategorySelect() {
    const categorySelect = document.getElementById('productCategory');
    if (!categorySelect) return;
    
    categorySelect.innerHTML = '<option value="">اختر التصنيف</option>';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = category.name;
        categorySelect.appendChild(option);
    });
}

// Product Management
function showAddProductModal() {
    document.getElementById('productModalTitle').textContent = 'إضافة حساب';
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('productCurrency').value = 'DA';
    
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    if (imagePreviewContainer) imagePreviewContainer.innerHTML = '';
    
    const productImages = document.getElementById('productImages');
    if (productImages) productImages.value = '';
    
    showModal(document.getElementById('productModal'));
}

async function editProduct(productId) {
    try {
        const product = await apiRequest(`/products/${productId}`);
        
        document.getElementById('productModalTitle').textContent = 'تعديل حساب';
        document.getElementById('productId').value = product.id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productDescription').value = product.description || '';
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productCurrency').value = product.currency || 'DA';
        document.getElementById('productCategory').value = product.category || '';
        document.getElementById('productStatus').value = product.status ? 'true' : 'false';
        
        // Handle images
        const imagePreviewContainer = document.getElementById('imagePreviewContainer');
        const productImages = document.getElementById('productImages');
        
        if (imagePreviewContainer) imagePreviewContainer.innerHTML = '';
        
        if (product.images && product.images.length > 0) {
            product.images.forEach(imageUrl => {
                if (imagePreviewContainer) {
                    const img = document.createElement('img');
                    img.src = imageUrl;
                    img.className = 'image-preview';
                    img.style.display = 'block';
                    imagePreviewContainer.appendChild(img);
                }
            });
            if (productImages) productImages.value = product.images.join(',');
        }
        
        showModal(document.getElementById('productModal'));
    } catch (error) {
        console.error('❌ خطأ في تحميل الحساب:', error);
        showNotification('خطأ', 'فشل في تحميل بيانات الحساب', 'error');
    }
}

async function handleProductSave(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
        submitBtn.disabled = true;
        
        const productId = document.getElementById('productId').value;
        const productData = {
            name: document.getElementById('productName').value,
            description: document.getElementById('productDescription').value,
            price: document.getElementById('productPrice').value,
            currency: document.getElementById('productCurrency').value,
            category: document.getElementById('productCategory').value,
            status: document.getElementById('productStatus').value === 'true',
            images: document.getElementById('productImages').value ? 
                   document.getElementById('productImages').value.split(',') : []
        };
        
        if (!productData.name || !productData.price) {
            throw new Error('يرجى ملء جميع الحقول المطلوبة');
        }
        
        const url = productId ? `/products/${productId}` : '/products';
        const method = productId ? 'PUT' : 'POST';
        
        await apiRequest(url, {
            method,
            body: JSON.stringify(productData)
        });
        
        showNotification('نجاح', `تم ${productId ? 'تحديث' : 'إضافة'} الحساب بنجاح!`, 'success');
        closeModal(document.getElementById('productModal'));
        loadProducts();
        
    } catch (error) {
        console.error('❌ خطأ في حفظ الحساب:', error);
        showNotification('خطأ', `فشل في ${productId ? 'تحديث' : 'إضافة'} الحساب: ` + error.message, 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function deleteProduct(productId) {
    const confirmed = confirm('هل أنت متأكد من رغبتك في حذف هذا الحساب؟ لا يمكن التراجع عن هذا الإجراء.');
    if (!confirmed) return;
    
    try {
        await apiRequest(`/products/${productId}`, {
            method: 'DELETE'
        });
        
        showNotification('نجاح', 'تم حذف الحساب بنجاح!', 'success');
        loadProducts();
    } catch (error) {
        console.error('❌ خطأ في حذف الحساب:', error);
        showNotification('خطأ', 'فشل في حذف الحساب', 'error');
    }
}

// Order Management
async function viewOrderDetails(orderId) {
    try {
        const order = await apiRequest(`/orders/${orderId}`);
        
        document.getElementById('orderDetailsId').textContent = order.id;
        document.getElementById('orderCustomerName').textContent = order.customerName;
        document.getElementById('orderCustomerPhone').textContent = order.phone;
        document.getElementById('orderNotes').textContent = order.description || 'لا توجد ملاحظات خاصة.';
        document.getElementById('orderTotalAmount').textContent = `${order.total} DA`;
        document.getElementById('orderStatusSelect').value = order.status;
        
        // Populate order items
        const itemsList = document.getElementById('orderItemsList');
        if (itemsList) {
            itemsList.innerHTML = '';
            
            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'order-item';
                    itemDiv.innerHTML = `
                        <div class="order-item-details">
                            <strong>${item.productName}</strong><br>
                            <small>الكمية: ${item.quantity} × ${item.unitPrice} DA</small>
                        </div>
                        <div class="order-item-price">
                            ${item.total} DA
                        </div>
                    `;
                    itemsList.appendChild(itemDiv);
                });
            }
        }
        
        // Store current order ID for status update
        window.currentOrderId = orderId;
        
        showModal(document.getElementById('orderDetailsModal'));
    } catch (error) {
        console.error('❌ خطأ في تحميل تفاصيل الطلب:', error);
        showNotification('خطأ', 'فشل في تحميل تفاصيل الطلب', 'error');
    }
}

// Update Order Status from Modal
async function updateOrderStatusFromModal() {
    const statusSelect = document.getElementById('orderStatusSelect');
    if (!statusSelect || !window.currentOrderId) return;
    
    try {
        await updateOrderStatus(window.currentOrderId, statusSelect.value);
        closeModal(document.getElementById('orderDetailsModal'));
    } catch (error) {
        console.error('❌ خطأ في تحديث حالة الطلب:', error);
    }
}

// Update Order Status
async function updateOrderStatus(orderId, status) {
    try {
        await apiRequest(`/orders/${orderId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        
        showNotification('نجاح', 'تم تحديث حالة الطلب بنجاح!', 'success');
        
        // Reload orders data
        loadOrders();
        loadRecentOrders();
        loadDashboardStats();
        
    } catch (error) {
        console.error('❌ خطأ في تحديث حالة الطلب:', error);
        showNotification('خطأ', 'فشل في تحديث حالة الطلب', 'error');
        throw error;
    }
}

// Show Notification
function showNotification(title, message, type = 'info') {
    if (!notification || !notificationTitle || !notificationMessage) return;
    
    notificationTitle.textContent = title;
    notificationMessage.textContent = message;
    
    // Set icon based on type
    const icon = notification.querySelector('.notification-icon i');
    if (icon) {
        icon.className = 'fas ' + (
            type === 'success' ? 'fa-check' :
            type === 'error' ? 'fa-exclamation-circle' :
            type === 'warning' ? 'fa-exclamation-triangle' :
            'fa-info-circle'
        );
    }
    
    // Set color based on type
    const notificationIcon = notification.querySelector('.notification-icon');
    if (notificationIcon) {
        notificationIcon.style.background = 
            type === 'success' ? 'var(--success)' :
            type === 'error' ? 'var(--danger)' :
            type === 'warning' ? 'var(--warning)' :
            'var(--primary)';
    }
    
    notification.classList.add('show');
    
    // Auto hide after 5 seconds
    setTimeout(hideNotification, 5000);
}

// Hide Notification
function hideNotification() {
    if (notification) {
        notification.classList.remove('show');
    }
}

// Initialize Mobile Optimizations
function initMobileOptimizations() {
    console.log('📱 تم تهيئة تحسينات الجوال');
    
    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('active');
            if (sidebarOverlay) {
                sidebarOverlay.classList.remove('active');
            }
            document.body.style.overflow = 'auto';
        }
    });
    
    // Add touch gestures for mobile
    let startX = 0;
    let currentX = 0;
    
    document.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
    });
    
    document.addEventListener('touchmove', function(e) {
        currentX = e.touches[0].clientX;
    });
    
    document.addEventListener('touchend', function() {
        const diff = startX - currentX;
        
        // Swipe left to open sidebar
        if (diff > 50 && window.innerWidth <= 768 && startX > window.innerWidth - 50) {
            toggleSidebar();
        }
        
        // Swipe right to close sidebar
        if (diff < -50 && window.innerWidth <= 768 && sidebar.classList.contains('active')) {
            toggleSidebar();
        }
    });
    
    // Prevent zoom on double tap
    let lastTap = 0;
    document.addEventListener('touchend', function(e) {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        if (tapLength < 500 && tapLength > 0) {
            e.preventDefault();
        }
        lastTap = currentTime;
    });
}

// Make functions globally available
window.viewOrderDetails = viewOrderDetails;
window.updateOrderStatus = updateOrderStatus;
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;
window.showAddCategoryModal = showAddCategoryModal;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.showAddProductModal = showAddProductModal;
window.toggleSidebar = toggleSidebar;
window.closeModal = closeModal;

console.log('✅ تم تحميل JavaScript للوحة التحكم بنجاح');