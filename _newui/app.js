const { useState, useEffect } = React;
const { HashRouter, Routes, Route, useNavigate, useParams, useLocation, Navigate } = ReactRouterDOM;

// 全角→半角変換ユーティリティ
const toHankaku = (str) => {
  if (typeof str !== 'string') return str;

  return str
    // 全角英字 → 半角英字 (A-Z, a-z)
    .replace(/[Ａ-Ｚａ-ｚ]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    // 全角数字 → 半角数字 (0-9)
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
};

// オブジェクト内の全文字列を再帰的に変換
const convertObjectToHankaku = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return toHankaku(obj);
  if (Array.isArray(obj)) return obj.map(convertObjectToHankaku);
  if (typeof obj === 'object') {
    const converted = {};
    for (const key of Object.keys(obj)) {
      converted[key] = convertObjectToHankaku(obj[key]);
    }
    return converted;
  }
  return obj;
};

// API設定
const API_BASE = 'api/index.php';

// API呼び出し関数
const api = {
  async call(action, method = 'GET', data = null, params = {}) {
    // Get the base path from current location (handles subdirectories like /csmkanri/)
    const basePath = window.location.pathname.replace(/\/[^\/]*$/, '/');
    const url = new URL(basePath + API_BASE, window.location.origin);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    };
    
    if (data && method !== 'GET') {
      // 保存時に全角→半角変換を適用
      const convertedData = convertObjectToHankaku(data);
      options.body = JSON.stringify(convertedData);
    }
    
    const res = await fetch(url, options);
    let json;
    try {
      json = await res.json();
    } catch (e) {
      throw new Error('サーバーエラーが発生しました（レスポンスの解析に失敗）');
    }

    if (!res.ok) {
      throw new Error(json.error || 'API Error');
    }

    return json;
  },
  
  login: (username, password) => api.call('login', 'POST', { username, password }),
  logout: () => api.call('logout', 'POST'),
  checkAuth: async () => {
    // 401エラーをコンソールに出さないよう、200で返してチェック
    const basePath = window.location.pathname.replace(/\/[^\/]*$/, '/');
    const url = `${basePath}api/index.php?action=check-auth`;
    const res = await fetch(url, { credentials: 'include' });
    const data = await res.json();
    if (data.authenticated === false) return null;
    return data;
  },
  
  getCorps: () => api.call('corporations'),
  createCorp: (data) => api.call('corporations', 'POST', data),
  updateCorp: (id, data) => api.call('corporation', 'PUT', data, { id }),
  deleteCorp: (id) => api.call('corporation', 'DELETE', null, { id }),
  
  createSite: (data) => api.call('sites', 'POST', data),
  updateSite: (id, data) => api.call('site', 'PUT', data, { id }),
  deleteSite: (id) => api.call('site', 'DELETE', null, { id }),
  
  updateYearlyPlan: (siteId, yearlyPlan) => api.call('yearly-plan', 'PUT', { yearlyPlan }, { site_id: siteId }),
  
  createWorkLog: (data) => api.call('work-logs', 'POST', data),
  createPhoto: (data) => api.call('photos', 'POST', data),
  deletePhoto: (id) => api.call('photos', 'DELETE', null, { id }),
  createContactLog: (data) => api.call('contact-logs', 'POST', data),

  // 現場書類API
  createSiteDocument: (data) => api.call('site-documents', 'POST', data),
  deleteSiteDocument: (id) => api.call('site-document', 'DELETE', null, { id }),
  
  updateInvoice: (corpId, data) => api.call('invoice', 'PUT', data, { corp_id: corpId }),
  
  getUsers: () => api.call('users'),
  createUser: (data) => api.call('users', 'POST', data),
  updateUser: (id, data) => api.call('user', 'PUT', data, { id }),
  deleteUser: (id) => api.call('user', 'DELETE', null, { id }),
  
  getMasterData: () => api.call('master-data'),
  addMasterData: (type, name) => api.call('master-data', 'POST', { type, name }),
  deleteMasterData: (type, name) => api.call('master-data', 'DELETE', null, { type, name }),

  // 日報API
  getDailyReports: (params) => api.call('daily-reports', 'GET', null, params),
  createDailyReport: (data) => api.call('daily-reports', 'POST', data),
  getDailyReport: (id) => api.call('daily-report', 'GET', null, { id }),
  updateDailyReport: (id, data) => api.call('daily-report', 'PUT', data, { id }),
  deleteDailyReport: (id) => api.call('daily-report', 'DELETE', null, { id }),
  updateDailyReportHours: (id, data) => api.call('daily-report-hours', 'PUT', data, { id }),
  exportDailyReports: (params) => api.call('daily-reports-export', 'GET', null, params),

  // タイムカードAPI
  getTimecards: (params) => api.call('timecards', 'GET', null, params),
  getTodayTimecard: () => api.call('timecard', 'GET'),
  clockIn: (data) => api.call('timecard-clock-in', 'POST', data),
  clockOut: (data) => api.call('timecard-clock-out', 'POST', data),
  updateTimecard: (id, data) => api.call('timecard', 'PUT', data, { id }),
  deleteTimecard: (id) => api.call('timecard', 'DELETE', null, { id }),
  exportTimecards: (params) => api.call('timecards-export', 'GET', null, params),

  // タイムカード修正申請API
  submitTimecardRequest: (data) => api.call('timecard-request', 'POST', data),
  getTimecardRequests: (params) => api.call('timecard-requests', 'GET', null, params),
  getMyTimecardRequests: () => api.call('timecard-request', 'GET'),
  approveTimecardRequest: (id) => api.call('timecard-request-approve', 'POST', { id }),
  rejectTimecardRequest: (id, comment) => api.call('timecard-request-reject', 'POST', { id, comment }),
  getTimecardRequestsCount: () => api.call('timecard-requests-count', 'GET'),

  // 車両マスターAPI
  getVehicles: () => api.call('vehicles'),
  addVehicle: (name) => api.call('vehicles', 'POST', { name }),
  deleteVehicle: (id) => api.call('vehicle', 'DELETE', null, { id }),

  // 履歴API（管理者のみ）
  getLoginLogs: () => api.call('login-logs'),
  getKeyboxLogs: () => api.call('keybox-log'),
  getAuditLogs: (params) => api.call('audit-logs', 'GET', null, params),

  // 在庫管理API
  getInventoryBranches: () => api.call('inventory-branches'),
  getInventoryCategories: () => api.call('inventory-categories'),
  getInventoryProducts: (params) => api.call('inventory-products', 'GET', null, params),
  getInventoryStock: (params) => api.call('inventory-stock', 'GET', null, params),
  updateInventoryStock: (data) => api.call('inventory-stock-update', 'POST', data),
  transferInventory: (data) => api.call('inventory-transfer', 'POST', data),
  getInventoryTransactions: (params) => api.call('inventory-transactions', 'GET', null, params),
  getInventorySummary: () => api.call('inventory-summary'),
  updateInventoryProduct: (productId, data) => api.call('inventory-product-update', 'POST', { productId, ...data }),
  createInventoryProduct: (data) => api.call('inventory-product-create', 'POST', data),
  deleteInventoryProduct: (id) => api.call('inventory-product-delete', 'DELETE', null, { id }),
  reorderInventoryProducts: (productIds) => api.call('inventory-product-reorder', 'POST', { productIds })
};

// SVGアイコン
const Icons = {
  Building: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M8 10h.01"></path><path d="M16 10h.01"></path><path d="M8 14h.01"></path><path d="M16 14h.01"></path></svg>),
  Key: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>),
  Calendar: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>),
  Yen: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"></path><path d="M17 5H7l5 7"></path><path d="M17 5l-5 7"></path><path d="M8 12h8"></path><path d="M8 16h8"></path></svg>),
  Phone: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>),
  MapPin: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>),
  User: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>),
  AlertCircle: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>),
  Check: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>),
  ChevronRight: () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>),
  ChevronLeft: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>),
  Plus: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>),
  Edit: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>),
  Bell: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>),
  Store: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>),
  Bug: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="6" width="8" height="14" rx="4"></rect><path d="M19 9h-3"></path><path d="M8 9H5"></path><path d="M19 15h-3"></path><path d="M8 15H5"></path><path d="M12 6V2"></path></svg>),
  Tool: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>),
  Map: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>),
  Copy: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>),
  Trash: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>),
  Lock: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>),
  LogOut: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>),
  Settings: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>),
  Home: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>),
  Camera: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>),
  Download: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>),
  MessageCircle: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>),
  ClipboardList: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>),
  X: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>),
  FileContract: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>),
  Loader: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="0.75"></path></svg>),
  Upload: () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>),
  FileText: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>),
  Eye: ({ className }) => (<svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>),
  EyeOff: ({ className }) => (<svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>),
  Clock: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>),
  Menu: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>),
  Car: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.3 1 12.1 1 13v3c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><circle cx="17" cy="17" r="2"></circle></svg>),
  Calculator: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="8" y1="10" x2="8" y2="10.01"></line><line x1="12" y1="10" x2="12" y2="10.01"></line><line x1="16" y1="10" x2="16" y2="10.01"></line><line x1="8" y1="14" x2="8" y2="14.01"></line><line x1="12" y1="14" x2="12" y2="14.01"></line><line x1="16" y1="14" x2="16" y2="14.01"></line><line x1="8" y1="18" x2="8" y2="18.01"></line><line x1="12" y1="18" x2="12" y2="18.01"></line><line x1="16" y1="18" x2="16" y2="18.01"></line></svg>),
  ExternalLink: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>),
  Trash2: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>),
  Package: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>),
  CheckCircle: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>),
  DollarSign: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>)
};

// メインアプリ
function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // 開発用：ローカルテスト時はtrue、本番はfalseに戻す
  const DEV_MODE = false;

  const [isLoading, setIsLoading] = useState(!DEV_MODE);
  const [isLoggedIn, setIsLoggedIn] = useState(DEV_MODE);
  const [currentUser, setCurrentUser] = useState(DEV_MODE ? { name: 'テストユーザー', role: 'admin' } : null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  const [corporations, setCorporations] = useState([]);
  const [masterData, setMasterData] = useState({ pestTypes: [], workTypes: [], workAreas: [] });
  const [users, setUsers] = useState([]);

  // currentViewはlocation.pathnameから導出
  const getCurrentView = () => {
    const path = location.pathname;
    if (path === '/' || path === '') return 'dashboard';
    if (path === '/corporations') return 'corporations';
    if (path.startsWith('/corporations/')) return 'sites';
    if (path.startsWith('/sites/')) return 'site';
    if (path === '/calendar') return 'calendar';
    if (path === '/invoices') return 'invoices';
    if (path === '/settings') return 'settings';
    if (path === '/daily-reports') return 'dailyReports';
    if (path.startsWith('/daily-reports/')) return 'dailyReportForm';
    if (path === '/timecard') return 'timecard';
    if (path === '/menu') return 'menu';
    if (path === '/admin/daily-reports') return 'adminDailyReports';
    if (path === '/admin/timecards') return 'adminTimecards';
    if (path === '/admin/audit-logs') return 'adminAuditLogs';
    if (path === '/inventory') return 'inventory';
    return 'dashboard';
  };
  const currentView = getCurrentView();

  // URLパラメータからselectedCorp/selectedSiteを導出
  const getSelectedFromUrl = () => {
    const path = location.pathname;
    let corp = null;
    let site = null;

    if (path.startsWith('/corporations/')) {
      const corpId = path.split('/')[2];
      corp = corporations.find(c => c.id === corpId || c.id === parseInt(corpId));
    }
    if (path.startsWith('/sites/')) {
      const siteId = path.split('/')[2];
      for (const c of corporations) {
        const s = (c.sites || []).find(s => s.id === siteId || s.id === parseInt(siteId));
        if (s) {
          site = s;
          corp = c;
          break;
        }
      }
    }
    return { corp, site };
  };
  const { corp: selectedCorp, site: selectedSite } = getSelectedFromUrl();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  
  // 設定画面用の状態
  const [settingsTab, setSettingsTab] = useState('users');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ name: '', username: '', password: '', role: 'staff' });
  const [showKeybox, setShowKeybox] = useState(false); // キーボックス表示状態

  const userRole = currentUser?.role || 'staff';
  const totalSites = corporations.reduce((sum, c) => sum + (c.sites?.length || 0), 0);
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // 初期化：認証チェック
  useEffect(() => {
    if (!DEV_MODE) {
      checkAuthStatus();
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      const user = await api.checkAuth();
      if (user) {
        setCurrentUser(user);
        setIsLoggedIn(true);
        await loadData(user.role);
      } else {
        setIsLoggedIn(false);
      }
    } catch (e) {
      setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async (userRole = null) => {
    try {
      const promises = [
        api.getCorps(),
        api.getMasterData()
      ];
      // 管理者の場合はusersも読み込む
      if (userRole === 'admin') {
        promises.push(api.getUsers());
      }
      const results = await Promise.all(promises);
      setCorporations(results[0]);
      setMasterData(results[1]);
      if (userRole === 'admin' && results[2]) {
        setUsers(results[2]);
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  };

  const handleLogin = async () => {
    try {
      setLoginError('');

      // ログイン時にキャッシュをクリア
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      // LocalStorageのキャッシュデータをクリア（認証情報以外）
      const keysToKeep = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !key.startsWith('cache_')) {
          keysToKeep.push({ key, value: localStorage.getItem(key) });
        }
      }
      localStorage.clear();
      keysToKeep.forEach(item => localStorage.setItem(item.key, item.value));

      const user = await api.login(loginForm.username, loginForm.password);
      setCurrentUser(user);
      setIsLoggedIn(true);
      await loadData(user.role);
    } catch (e) {
      setLoginError('ユーザー名またはパスワードが間違っています');
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (e) {}

    // ブラウザキャッシュをクリア
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      } catch (e) {}
    }

    // ストレージをクリア
    localStorage.clear();
    sessionStorage.clear();

    setIsLoggedIn(false);
    setCurrentUser(null);
    setLoginForm({ username: '', password: '' });

    // 強制リロードでメモリキャッシュもクリア
    window.location.href = window.location.origin + window.location.pathname;
  };

  // ユーティリティ関数
  const getCurrentYearMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const getGoogleMapUrl = (address) => address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  const isThisMonthBilling = (corp) => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    if (corp.billingCycle === '毎月') return true;
    if (corp.billingCycle === '半年' || corp.billingCycle === '年間') {
      if (!corp.billingMonth) return false;
      const ms = corp.billingMonth.replace(/月/g, '').split('・').map(m => parseInt(m));
      return ms.includes(currentMonth);
    }
    return false;
  };

  const getThisMonthInvoiceStatus = (corp) => {
    const yearMonth = getCurrentYearMonth();
    const invoice = corp.invoiceHistory?.find(inv => inv.yearMonth === yearMonth);
    return invoice ? { isSent: invoice.isSent, isPaid: invoice.isPaid } : { isSent: false, isPaid: false };
  };

  const getBillingColor = (cycle) => {
    switch (cycle) {
      case '作業月': return { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' };
      case '毎月': return { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' };
      case '半年': return { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' };
      case '年間': return { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' };
      default: return { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };
    }
  };

  // 通知生成
  const generateNotifications = (() => {
    const notifs = [];
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    corporations.forEach(corp => {
      if (corp.contractEnd) {
        const endDate = new Date(corp.contractEnd);
        const daysUntilEnd = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        if (daysUntilEnd > 0 && daysUntilEnd <= 30) {
          notifs.push({ id: `contract-${corp.id}`, type: 'contract', title: '契約更新', message: `${corp.name}の契約が${daysUntilEnd}日後に終了`, corpId: corp.id, priority: daysUntilEnd <= 7 ? 'high' : 'medium' });
        }
      }
      if (isThisMonthBilling(corp)) {
        const status = getThisMonthInvoiceStatus(corp);
        if (!status.isSent) {
          notifs.push({ id: `invoice-${corp.id}`, type: 'invoice', title: '請求未送付', message: `${corp.name}の今月の請求書が未送付です`, corpId: corp.id, priority: 'high' });
        } else if (!status.isPaid) {
          notifs.push({ id: `payment-${corp.id}`, type: 'payment', title: '入金待ち', message: `${corp.name}の入金確認待ちです`, corpId: corp.id, priority: 'medium' });
        }
      }
      (corp.sites || []).forEach(site => {
        if (site.yearlyPlan) {
          const tomorrowMonth = tomorrow.getMonth() + 1;
          const tomorrowDate = tomorrow.getDate();
          const plan = site.yearlyPlan[tomorrowMonth];
          if (plan?.scheduled && parseInt(plan.date) === tomorrowDate) {
            notifs.push({ id: `work-${site.id}`, type: 'work', title: '明日施工予定', message: `${corp.name} - ${site.name}`, corpId: corp.id, siteId: site.id, priority: 'medium' });
          }
        }
      });
    });
    return notifs;
  })();

  // 今週の施工を取得
  const getThisWeekWorks = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const works = [];
    corporations.forEach(corp => {
      (corp.sites || []).forEach(site => {
        if (site.yearlyPlan) {
          for (let d = new Date(startOfWeek); d <= endOfWeek; d.setDate(d.getDate() + 1)) {
            const month = d.getMonth() + 1;
            const date = d.getDate();
            const plan = site.yearlyPlan[month];
            if (plan?.scheduled && parseInt(plan.date) === date) {
              works.push({ ...site, corpName: corp.name, corpId: corp.id, corpAddress: corp.address, scheduledDate: new Date(d), workType: plan.workType });
            }
          }
        }
      });
    });
    return works.sort((a, b) => a.scheduledDate - b.scheduledDate);
  };

  // 月間施工を取得
  const getMonthWorks = (year, month) => {
    const works = [];
    corporations.forEach(corp => {
      (corp.sites || []).forEach(site => {
        if (site.yearlyPlan) {
          const plan = site.yearlyPlan[month];
          if (plan?.scheduled) {
            works.push({ ...site, corpName: corp.name, corpId: corp.id, date: plan.date, workType: plan.workType });
          }
        }
      });
    });
    return works;
  };

  // ローディング画面
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="flex justify-center">
            <Icons.Loader />
          </div>
          <p className="text-gray-500 mt-2">読み込み中...</p>
        </div>
      </div>
    );
  }

  // ログイン画面
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col justify-center" style={{ background: 'linear-gradient(160deg, #00B894 0%, #00D2A0 40%, #E8F8F5 100%)', padding: '32px' }}>
        {/* ロゴエリア */}
        <div className="text-center mb-12">
          <div style={{ width: '80px', height: '80px', background: 'white', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', marginBottom: '20px' }}>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#00B894' }}>CS</span>
          </div>
          <h1 className="text-white text-2xl font-bold" style={{ margin: 0 }}>CSM業務管理</h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', marginTop: '6px' }}>害虫駆除・施設管理システム</p>
        </div>

        {/* ログインカード */}
        <div className="bg-white w-full max-w-sm mx-auto" style={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', padding: '32px 24px' }}>
          <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#636E72', display: 'block', marginBottom: '6px' }}>ユーザー名</label>
              <input type="text" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full" style={{ padding: '14px 16px', border: '1.5px solid #E9ECEF', borderRadius: '12px', fontSize: '16px', background: '#FAFBFC', outline: 'none' }}
                placeholder="ユーザー名を入力" autoComplete="username" />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#636E72', display: 'block', marginBottom: '6px' }}>パスワード</label>
              <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full" style={{ padding: '14px 16px', border: '1.5px solid #E9ECEF', borderRadius: '12px', fontSize: '16px', background: '#FAFBFC', outline: 'none' }}
                placeholder="パスワードを入力" autoComplete="current-password" />
            </div>
            {loginError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2"><span className="text-red-500"><Icons.AlertCircle /></span><p className="text-red-600 text-sm">{loginError}</p></div>}
            <button type="submit" className="w-full text-white font-bold" style={{ padding: '16px', background: 'linear-gradient(135deg, #00B894, #00D2A0)', border: 'none', borderRadius: '12px', fontSize: '16px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0, 184, 148, 0.3)' }}>
              ログイン
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ダッシュボード
  const Dashboard = () => {
    const [workTab, setWorkTab] = useState('today');
    const [pendingTimecardRequests, setPendingTimecardRequests] = useState([]);

    useEffect(() => {
      if (userRole === 'admin') {
        api.getTimecardRequests({ status: 'pending' }).then(data => {
          setPendingTimecardRequests(data || []);
        }).catch(() => {});
      }
    }, [userRole]);

    const thisWeekWorks = getThisWeekWorks();
    const today = new Date();
    const todayWorks = thisWeekWorks.filter(w => w.scheduledDate.toDateString() === today.toDateString());
    const thisMonthWorks = getMonthWorks(today.getFullYear(), today.getMonth() + 1);
    const thisMonthBillingCorps = corporations.filter(isThisMonthBilling);
    const unsentCount = thisMonthBillingCorps.filter(c => !getThisMonthInvoiceStatus(c).isSent).length;
    const unpaidCount = thisMonthBillingCorps.filter(c => { const s = getThisMonthInvoiceStatus(c); return s.isSent && !s.isPaid; }).length;
    const contractAlerts = generateNotifications.filter(n => n.type === 'contract');
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    const getDisplayWorks = () => {
      if (workTab === 'today') return todayWorks;
      if (workTab === 'week') return thisWeekWorks;
      if (workTab === 'month') return thisMonthWorks.map(w => ({ ...w, scheduledDate: new Date(today.getFullYear(), today.getMonth(), w.date) }));
      return [];
    };

    const displayWorks = getDisplayWorks();

    return (
      <div className="space-y-4">
        {/* グリーティングカード */}
        <div style={{ background: 'linear-gradient(135deg, #00B894, #00D2A0)', borderRadius: '16px', padding: '24px', color: 'white', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: '-20px', top: '-20px', width: '120px', height: '120px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}></div>
          <div style={{ position: 'absolute', right: '30px', bottom: '-30px', width: '80px', height: '80px', background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }}></div>
          <p style={{ fontSize: '14px', opacity: 0.9, margin: '0 0 4px' }}>おはようございます</p>
          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 8px' }}>{currentUser?.name}さん</h2>
          <p style={{ fontSize: '13px', opacity: 0.85, margin: 0 }}>
            {today.getMonth() + 1}月{today.getDate()}日（{dayNames[today.getDay()]}）・ 今日の予定 <strong style={{ fontSize: '20px', verticalAlign: 'middle' }}>{todayWorks.length}</strong> 件
          </p>
        </div>

        {/* サマリーカード 2x2 グリッド */}
        <div className="grid grid-cols-2 gap-3">
          {(userRole === 'admin' || userRole === 'master') && (
            <div className="bg-white cursor-pointer" style={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', padding: '16px' }} onClick={() => navigate('/invoices')}>
              <div className="flex items-center gap-2.5 mb-2">
                <div style={{ width: '36px', height: '36px', background: '#FFEEF0', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icons.Calculator />
                </div>
              </div>
              <p style={{ fontSize: '12px', color: '#B2BEC3', margin: 0 }}>未送信請求</p>
              <p style={{ fontSize: '28px', fontWeight: 800, color: '#E74C3C', margin: '2px 0 0' }}>{unsentCount}</p>
            </div>
          )}
          {(userRole === 'admin' || userRole === 'master') && (
            <div className="bg-white cursor-pointer" style={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', padding: '16px' }} onClick={() => navigate('/invoices')}>
              <div className="flex items-center gap-2.5 mb-2">
                <div style={{ width: '36px', height: '36px', background: '#FFF3E0', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icons.DollarSign />
                </div>
              </div>
              <p style={{ fontSize: '12px', color: '#B2BEC3', margin: 0 }}>未入金</p>
              <p style={{ fontSize: '28px', fontWeight: 800, color: '#E67E22', margin: '2px 0 0' }}>{unpaidCount}</p>
            </div>
          )}
          <div className="bg-white" style={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', padding: '16px' }}>
            <div className="flex items-center gap-2.5 mb-2">
              <div style={{ width: '36px', height: '36px', background: '#E8F8F5', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icons.CheckCircle />
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#B2BEC3', margin: 0 }}>今日の作業</p>
            <p style={{ fontSize: '28px', fontWeight: 800, color: '#00B894', margin: '2px 0 0' }}>{todayWorks.length}</p>
          </div>
          <div className="bg-white" style={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', padding: '16px' }}>
            <div className="flex items-center gap-2.5 mb-2">
              <div style={{ width: '36px', height: '36px', background: '#EBF5FB', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icons.Package />
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#B2BEC3', margin: 0 }}>在庫アラート</p>
            <p style={{ fontSize: '28px', fontWeight: 800, color: '#2980B9', margin: '2px 0 0' }}>{generateNotifications.filter(n => n.type === 'inventory').length}</p>
          </div>
        </div>

        {/* 通知 */}
        {(() => {
          const filteredNotifications = (userRole === 'admin' || userRole === 'master')
            ? generateNotifications
            : generateNotifications.filter(n => n.type !== 'invoice' && n.type !== 'payment');
          return filteredNotifications.length > 0 && (
            <div className="bg-amber-50 border border-amber-200" style={{ borderRadius: '16px', padding: '16px' }}>
              <h3 className="font-bold text-amber-700 flex items-center gap-2 mb-3"><Icons.Bell /> 通知 ({filteredNotifications.length})</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {filteredNotifications.slice(0, 5).map(n => (
                  <div key={n.id} className={`text-sm p-2 rounded-lg ${n.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    <span className="font-medium">{n.title}:</span> {n.message}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* タイムカード修正申請 */}
        {(userRole === 'admin' || userRole === 'master') && pendingTimecardRequests.length > 0 && (
          <div className="bg-orange-50 border-2 border-orange-300" style={{ borderRadius: '16px', padding: '16px', boxShadow: '0 0 8px rgba(249,115,22,0.2)' }}>
            <h3 className="font-bold text-orange-700 flex items-center gap-2 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              タイムカード修正申請 ({pendingTimecardRequests.length}件)
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {pendingTimecardRequests.map(req => (
                <div key={req.id} className="bg-orange-100 text-orange-800 text-sm p-3 rounded-lg border border-orange-200" onClick={() => setCurrentPage('admin-timecard')} style={{cursor: 'pointer'}}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold">{req.user_name}</span>
                    <span className="text-xs bg-orange-200 text-orange-700 px-2 py-0.5 rounded-full font-medium">未処理</span>
                  </div>
                  <div className="mt-1 text-orange-700">
                    <span>{req.work_date}</span>
                    <span className="mx-2">|</span>
                    <span>出勤: {req.clock_in?.slice(0, 5) || '--:--'}</span>
                    <span className="mx-1">〜</span>
                    <span>退勤: {req.clock_out?.slice(0, 5) || '--:--'}</span>
                  </div>
                  {req.reason && <p className="mt-1 text-xs text-orange-600">理由: {req.reason}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 作業予定セクション */}
        <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>作業予定</h3>
        </div>

        <div className="bg-white" style={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div className="flex" style={{ borderBottom: '2px solid #E9ECEF' }}>
            {[
              { key: 'today', label: `今日 (${todayWorks.length})` },
              { key: 'week', label: `今週 (${thisWeekWorks.length})` },
              { key: 'month', label: `今月 (${thisMonthWorks.length})` }
            ].map(tab => (
              <button key={tab.key} onClick={() => setWorkTab(tab.key)}
                className="flex-1 text-center" style={{
                  padding: '12px 8px', fontSize: '13px', fontWeight: 600,
                  color: workTab === tab.key ? '#00B894' : '#B2BEC3',
                  borderBottom: workTab === tab.key ? '2px solid #00B894' : '2px solid transparent',
                  marginBottom: '-2px', background: 'none', border: 'none',
                  borderBottomWidth: '2px', borderBottomStyle: 'solid',
                  borderBottomColor: workTab === tab.key ? '#00B894' : 'transparent'
                }}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="p-4 max-h-80 overflow-y-auto">
            {displayWorks.length === 0 ? (
              <p style={{ color: '#B2BEC3', textAlign: 'center', padding: '32px 0' }}>予定はありません</p>
            ) : (
              <div className="space-y-3">
                {displayWorks.map((work, i) => {
                  const isToday = work.scheduledDate.toDateString() === today.toDateString();
                  const dateStr = workTab === 'today' ? '' : `${work.scheduledDate.getMonth() + 1}/${work.scheduledDate.getDate()}(${dayNames[work.scheduledDate.getDay()]})`;
                  const workColors = ['#E8F8F5', '#FFF3E0', '#EBF5FB', '#F4ECF7'];
                  const workTextColors = ['#00B894', '#E67E22', '#2980B9', '#8E44AD'];
                  const colorIdx = i % workColors.length;
                  return (
                    <div key={i} onClick={() => { navigate(`/sites/${work.id}`); }}
                      style={{ padding: '16px', display: 'flex', gap: '14px', alignItems: 'flex-start', cursor: 'pointer', borderRadius: '12px' }}
                      className="hover:bg-gray-50">
                      <div style={{ width: '44px', height: '44px', background: workColors[colorIdx], borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icons.Home />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {workTab !== 'today' && (
                          <div className="flex items-center gap-2 mb-1">
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: isToday ? '#00B894' : '#E9ECEF', color: isToday ? 'white' : '#636E72' }}>
                              {dateStr}
                            </span>
                            {isToday && <span style={{ fontSize: '11px', fontWeight: 700, color: '#00B894' }}>本日</span>}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{ fontWeight: 700, fontSize: '14px', color: '#2D3436' }}>{work.name}</span>
                          <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, background: workColors[colorIdx], color: workTextColors[colorIdx] }}>
                            {work.workType}
                          </span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#636E72', margin: 0 }}>{work.corpName}</p>
                      </div>
                      <svg width="16" height="16" fill="none" stroke="#B2BEC3" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: '4px' }}><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 契約更新アラート */}
        {(userRole === 'admin' || userRole === 'master') && contractAlerts.length > 0 && (
          <div className="bg-orange-50 border border-orange-200" style={{ borderRadius: '16px', padding: '16px' }}>
            <h3 className="font-bold text-orange-700 flex items-center gap-2 mb-2"><Icons.FileContract /> 契約更新アラート</h3>
            {contractAlerts.map(a => (
              <div key={a.id} className="text-sm text-orange-600 py-1">{a.message}</div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // 法人一覧用のフィルタリング
  const filteredCorporations = corporations.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.sites || []).some(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // 法人一覧 (簡略版 - 実際にはもっと長い)
  const CorporationList = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          {filteredCorporations.map((corp) => {
            const billingColor = getBillingColor(corp.billingCycle);
            return (
              <div key={corp.id} onClick={() => navigate(`/corporations/${corp.id}`)}
                className="bg-white cursor-pointer hover:shadow-md transition-all" style={{ borderRadius: '16px', padding: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <div style={{ width: '40px', height: '40px', background: '#E8F8F5', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icons.Building />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#2D3436', margin: 0 }} className="truncate">{corp.name}</h3>
                        {corp.address && (
                          <p style={{ fontSize: '12px', color: '#636E72', margin: '2px 0 0' }} className="truncate">{corp.address}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#00B894' }}>{(corp.sites || []).length}現場</span>
                      {(userRole === 'admin' || userRole === 'master') && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: '#FFF3E0', color: '#E67E22' }}>{corp.billingCycle}</span>}
                    </div>
                  </div>
                  <svg width="16" height="16" fill="none" stroke="#B2BEC3" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: '12px' }}><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
              </div>
            );
          })}
        </div>
    );
  };

  // 現場一覧
  const SiteList = () => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showSiteDeleteConfirm, setShowSiteDeleteConfirm] = useState(false);
    const [deletingSite, setDeletingSite] = useState(null);

    const handleDeleteSite = async () => {
      if (!deletingSite) return;
      try {
        await api.deleteSite(deletingSite.id);
        await loadData();
        setShowSiteDeleteConfirm(false);
        setDeletingSite(null);
      } catch (e) {
        console.error(e);
        alert('削除に失敗しました: ' + e.message);
      }
    };

    const handleDeleteCorp = async () => {
      try {
        await api.deleteCorp(selectedCorp.id);
        await loadData();
        navigate('/corporations');
        setShowDeleteConfirm(false);
      } catch (e) {
        console.error(e);
        alert('削除に失敗しました: ' + e.message);
      }
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/corporations')} style={{ color: '#B2BEC3' }}><Icons.ChevronLeft /></button>
          <div className="flex-1">
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2D3436', margin: 0 }} className="break-words">{selectedCorp?.name}</h2>
            <p style={{ fontSize: '13px', color: '#636E72', margin: '2px 0 0' }}>{(selectedCorp?.sites || []).length}現場</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setModalType('corp'); setEditingItem(selectedCorp); setShowModal(true); }} style={{ color: '#636E72' }}>
              <Icons.Edit />
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} className="text-red-400 hover:text-red-600">
              <Icons.Trash />
            </button>
          </div>
        </div>

        <div className="bg-white" style={{ borderRadius: '16px', padding: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {selectedCorp?.address && (
              <div className="flex items-center gap-2">
                <Icons.MapPin style={{ color: '#B2BEC3' }} /><span className="flex-1" style={{ color: '#2D3436' }}>{selectedCorp.address}</span>
                <a href={getGoogleMapUrl(selectedCorp.address)} target="_blank" rel="noopener noreferrer" className="p-1" style={{ color: '#00B894' }}><Icons.Map /></a>
              </div>
            )}
            {selectedCorp?.contact && <div className="flex items-center gap-2"><Icons.Phone style={{ color: '#B2BEC3' }} /><span style={{ color: '#2D3436' }}>{selectedCorp.contact}</span></div>}
            {selectedCorp?.contactPerson && <div className="flex items-center gap-2"><Icons.User style={{ color: '#B2BEC3' }} /><span style={{ color: '#2D3436' }}>担当: {selectedCorp.contactPerson}</span></div>}
            {selectedCorp?.memo && <div className="col-span-full flex items-start gap-2"><Icons.FileText style={{ color: '#B2BEC3', marginTop: '2px' }} /><span style={{ color: '#636E72', whiteSpace: 'pre-wrap' }}>{selectedCorp.memo}</span></div>}
          </div>
          {(userRole === 'admin' || userRole === 'master') && (
            <div className="mt-3 pt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs" style={{ borderTop: '1px solid #E9ECEF', color: '#636E72' }}>
              <div>請求: {selectedCorp?.billingCycle} / {selectedCorp?.billingDay}日</div>
              {selectedCorp?.billingMonth && <div>請求月: {selectedCorp.billingMonth}</div>}
              {selectedCorp?.contractAmount > 0 && <div>契約金額: ¥{selectedCorp.contractAmount?.toLocaleString()}</div>}
              {selectedCorp?.contractType && <div>契約種別: {selectedCorp.contractType}</div>}
            </div>
          )}
        </div>

        {(userRole === 'admin' || userRole === 'master') && (
          <button onClick={() => { setModalType('contactLog'); setShowModal(true); }}
            className="w-full flex items-center justify-center gap-2 bg-white" style={{ border: '1.5px solid #E9ECEF', borderRadius: '12px', padding: '12px', color: '#636E72' }}>
            <Icons.MessageCircle /> 連絡履歴 ({(selectedCorp?.contactLogs || []).length})
          </button>
        )}

        <div className="flex justify-between items-center mb-2 mt-4">
          <h3 style={{ fontWeight: 600, color: '#2D3436', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Icons.Store /> 現場一覧</h3>
          <button onClick={() => { setModalType('site'); setEditingItem(null); setShowModal(true); }}
            className="flex items-center gap-1 text-white px-3 py-1.5 text-sm" style={{ background: 'linear-gradient(135deg, #00B894, #00D2A0)', borderRadius: '10px', border: 'none' }}>
            <Icons.Plus /> 現場追加
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(selectedCorp?.sites || []).map((site) => (
            <div key={site.id} onClick={() => navigate(`/sites/${site.id}`)}
              className="bg-white cursor-pointer" style={{ borderRadius: '16px', padding: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div style={{ width: '36px', height: '36px', background: '#E8F8F5', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icons.Store />
                  </div>
                  <h3 style={{ fontWeight: 600, color: '#2D3436', margin: 0 }} className="min-w-0 break-words">{site.name}</h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(userRole === 'admin' || userRole === 'master') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingSite(site); setShowSiteDeleteConfirm(true); }}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Icons.Trash />
                    </button>
                  )}
                  <svg width="16" height="16" fill="none" stroke="#B2BEC3" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
              </div>
            </div>
          ))}
        </div>

        {showSiteDeleteConfirm && deletingSite && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowSiteDeleteConfirm(false); setDeletingSite(null); } }}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg mb-2 text-red-600">現場を削除</h3>
              <p className="text-gray-600 mb-4">「{deletingSite.name}」を削除しますか？<br/>この操作は取り消せません。関連する全ての作業履歴・写真も削除されます。</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowSiteDeleteConfirm(false); setDeletingSite(null); }} className="flex-1 bg-gray-100 py-2 rounded-lg">キャンセル</button>
                <button type="button" onClick={handleDeleteSite} className="flex-1 bg-red-500 text-white py-2 rounded-lg">削除する</button>
              </div>
            </div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteConfirm(false); }}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg mb-2 text-red-600">法人を削除</h3>
              <p className="text-gray-600 mb-4">「{selectedCorp?.name}」を削除しますか？<br/>この操作は取り消せません。関連する全ての現場・作業履歴も削除されます。</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowDeleteConfirm(false)} className="flex-1 bg-gray-100 py-2 rounded-lg">キャンセル</button>
                <button type="button" onClick={handleDeleteCorp} className="flex-1 bg-red-500 text-white py-2 rounded-lg">削除する</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 現場詳細（簡略版）
  const SiteDetail = () => {
    const [activeTab, setActiveTab] = useState('info');

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => { setShowKeybox(false); navigate(`/corporations/${selectedCorp?.id}`); }} style={{ color: '#B2BEC3' }}><Icons.ChevronLeft /></button>
          <div className="flex-1">
            <p style={{ fontSize: '12px', color: '#636E72', margin: 0 }} className="truncate">{selectedCorp?.name}</p>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2D3436', margin: '2px 0 0' }} className="break-words">{selectedSite?.name}</h2>
          </div>
          <button onClick={() => { setModalType('site'); setEditingItem(selectedSite); setShowModal(true); }} style={{ color: '#636E72' }}><Icons.Edit /></button>
        </div>

        <div
          className="cursor-pointer transition-all"
          style={{
            borderRadius: '16px', padding: '20px',
            background: selectedSite?.keybox ? '#E8F8F5' : '#FAFBFC',
            border: selectedSite?.keybox ? '2px solid #00B894' : '2px solid #E9ECEF'
          }}
          onClick={async () => {
            if (selectedSite?.keybox && !showKeybox) {
              setShowKeybox(true);
              try {
                await api.call('keybox-log', 'POST', { siteId: selectedSite.id, siteName: selectedSite.name });
              } catch (e) {
                console.error('Failed to log keybox access:', e);
              }
            }
          }}>
          <div className="flex items-center gap-4">
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', background: selectedSite?.keybox ? '#00B894' : '#B2BEC3' }}><Icons.Key /></div>
            <div>
              <p style={{ fontSize: '13px', color: selectedSite?.keybox ? '#00B894' : '#B2BEC3', margin: 0 }}>キーボックス暗証番号</p>
              {selectedSite?.keybox ? (
                showKeybox ? (
                  <><p className={`font-black ${selectedSite.keybox.length > 4 ? 'text-3xl tracking-[0.15em]' : 'text-4xl tracking-[0.3em]'}`} style={{ color: '#00B894', margin: '4px 0 0' }}>{selectedSite.keybox}</p>
                  {selectedSite?.keyboxLocation && <p style={{ color: '#636E72', fontSize: '13px', margin: '4px 0 0' }}>{selectedSite.keyboxLocation}</p>}</>
                ) : (
                  <p style={{ fontWeight: 600, fontSize: '16px', color: '#00B894', margin: '4px 0 0' }}>タップして表示 <Icons.Eye className="inline w-5 h-5" /></p>
                )
              ) : <p style={{ color: '#B2BEC3', margin: '4px 0 0' }}>未登録</p>}
            </div>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto" style={{ borderBottom: '2px solid #E9ECEF' }}>
          {[{ key: 'info', label: '基本情報' }, { key: 'plan', label: '年間計画' }, { key: 'logs', label: '作業履歴' }, { key: 'photos', label: '写真' }, { key: 'docs', label: '書類' }].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 16px', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', background: 'none', border: 'none',
                color: activeTab === tab.key ? '#00B894' : '#B2BEC3',
                borderBottom: `2px solid ${activeTab === tab.key ? '#00B894' : 'transparent'}`,
                marginBottom: '-2px'
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'info' && (
          <div className="space-y-4">
            {selectedSite?.address && (
              <div className="flex items-center gap-2" style={{ color: '#2D3436' }}>
                <Icons.MapPin style={{ color: '#B2BEC3' }} /><span className="flex-1">{selectedSite.address}</span>
                <a href={getGoogleMapUrl(selectedSite.address)} target="_blank" className="p-1" style={{ color: '#00B894' }}><Icons.Map /></a>
              </div>
            )}
            <div>
              <p style={{ fontSize: '12px', color: '#B2BEC3', margin: '0 0 6px' }}>対象害虫</p>
              <div className="flex flex-wrap gap-1.5">
                {(selectedSite?.pests || []).map((p, i) => <span key={i} style={{ background: '#FFF0E0', color: '#D35400', fontSize: '13px', padding: '4px 12px', borderRadius: '20px', fontWeight: 500 }}>{p}</span>)}
              </div>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#B2BEC3', margin: '0 0 6px' }}>作業内容</p>
              <div className="flex flex-wrap gap-1.5">
                {(selectedSite?.workTypes || []).map((t, i) => <span key={i} style={{ background: '#E8F8F5', color: '#00B894', fontSize: '13px', padding: '4px 12px', borderRadius: '20px', fontWeight: 500 }}>{t}</span>)}
              </div>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#B2BEC3', margin: '0 0 6px' }}>作業箇所</p>
              <div className="flex flex-wrap gap-1.5">
                {(selectedSite?.workAreas || []).length > 0 ? (
                  selectedSite.workAreas.map((a, i) => <span key={i} style={{ background: '#E0F2FE', color: '#0891B2', fontSize: '13px', padding: '4px 12px', borderRadius: '20px', fontWeight: 500 }}>{a}</span>)
                ) : (
                  <span style={{ fontSize: '13px', color: '#B2BEC3' }}>未登録</span>
                )}
              </div>
            </div>
            {selectedSite?.memo && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', padding: '12px' }}>
                <p style={{ fontSize: '12px', color: '#B2BEC3', margin: '0 0 6px' }}>メモ</p>
                <p style={{ color: '#2D3436', whiteSpace: 'pre-wrap', margin: 0 }}>{selectedSite.memo}</p>
              </div>
            )}
            <div>
              <p style={{ fontSize: '12px', color: '#B2BEC3', margin: '0 0 6px' }}>請求月</p>
              <div className="flex flex-wrap gap-1.5">
                {(selectedSite?.billingMonths || []).length > 0 ? (
                  selectedSite.billingMonths.sort((a, b) => a - b).map((m, i) => <span key={i} style={{ background: '#FFFBEB', color: '#D97706', fontSize: '13px', padding: '4px 12px', borderRadius: '20px', fontWeight: 500 }}>{m}月</span>)
                ) : (
                  <span style={{ fontSize: '13px', color: '#B2BEC3' }}>法人設定に準拠</span>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'plan' && (
          <div className="space-y-3">
            {(userRole === 'admin' || userRole === 'master') && (
              <button onClick={() => { setModalType('yearlyPlan'); setShowModal(true); }}
                className="w-full flex items-center justify-center gap-2 text-white py-2" style={{ background: 'linear-gradient(135deg, #00B894, #00D2A0)', borderRadius: '12px', border: 'none', fontWeight: 600 }}>
                <Icons.Edit /> 年間計画を編集
              </button>
            )}
            <div className="bg-white overflow-x-auto" style={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <table className="w-full text-sm">
                <thead><tr style={{ background: '#FAFBFC' }}>{months.map(m => <th key={m} className="px-2 py-2 text-center min-w-[50px]" style={{ color: '#636E72', fontWeight: 600 }}>{m}月</th>)}</tr></thead>
                <tbody><tr>
                  {months.map(m => {
                    const plan = selectedSite?.yearlyPlan?.[m];
                    return (
                      <td key={m} className="px-1 py-2 text-center" style={{ borderTop: '1px solid #E9ECEF' }}>
                        {plan?.scheduled ? (
                          <div>
                            <div className="w-7 h-7 mx-auto rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: '#00B894' }}>{plan.date}</div>
                            <div className="text-xs mt-1 truncate" style={{ color: '#636E72' }}>{plan.workType}</div>
                          </div>
                        ) : (
                          <div className="w-7 h-7 mx-auto rounded-full" style={{ border: '2px dashed #E9ECEF' }} />
                        )}
                      </td>
                  );
                })}
              </tr></tbody>
            </table>
          </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-3">
            <button onClick={() => { setModalType('workLog'); setEditingItem(null); setShowModal(true); }}
              className="w-full flex items-center justify-center gap-2 bg-white" style={{ border: '2px dashed #E9ECEF', borderRadius: '12px', padding: '12px', color: '#636E72' }}>
              <Icons.Plus /> 作業報告を追加
            </button>
            {(selectedSite?.workLogs || []).length === 0 ? (
              <p className="text-center py-8" style={{ color: '#B2BEC3' }}>作業履歴がありません</p>
            ) : (
              <div className="space-y-3">
                {[...(selectedSite?.workLogs || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).map(log => (
                  <div key={log.id} className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-sm font-medium px-2 py-0.5 rounded" style={{ backgroundColor: '#00B894', color: 'white' }}>{formatDate(log.date)}</span>
                        <span className="ml-2 text-gray-600">{log.workType}</span>
                      </div>
                      <span className="text-gray-400 text-sm">{log.staff}</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-gray-400">状況:</span> <span className={log.condition === '良好' ? 'text-green-600' : log.condition === '要注意' ? 'text-amber-600' : 'text-red-600'}>{log.condition}</span></p>
                      {log.usedChemical && <p><span className="text-gray-400">使用薬剤:</span> {log.usedChemical}</p>}
                      {log.note && <p><span className="text-gray-400">備考:</span> {log.note}</p>}
                      {log.nextNote && <p className="bg-blue-50 p-2 rounded text-blue-700"><span className="font-medium">次回申送り:</span> {log.nextNote}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="space-y-3">
            <button onClick={() => { setModalType('photo'); setShowModal(true); }}
              className="w-full flex items-center justify-center gap-2 bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 text-gray-500 hover:border-green-400 hover:text-green-600">
              <Icons.Camera /> 写真を追加
            </button>
            {(selectedSite?.photos || []).length === 0 ? (
              <p className="text-center text-gray-400 py-8">写真がありません</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {selectedSite.photos.map((photo, i) => (
                  <div key={i} className="relative bg-gray-100 rounded-lg overflow-hidden aspect-square">
                    <img src={photo.url} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => { setLightboxPhoto(photo); setLightboxIndex(i); }} />
                    <button
                      onClick={async () => {
                        if (confirm('この写真を削除しますか？')) {
                          try {
                            await api.deletePhoto(photo.id);
                            await loadData();
                          } catch (e) {
                            alert('削除に失敗しました: ' + e.message);
                          }
                        }
                      }}
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow"
                    >×</button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-1 text-white text-xs">
                      {formatDate(photo.date)} - {photo.note || ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="space-y-3">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
              <input type="file" accept="image/*,.pdf" id="doc-upload" className="hidden" onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const processFile = async (file) => {
                  return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      // 画像の場合は圧縮
                      if (file.type.startsWith('image/')) {
                        const img = new Image();
                        img.onload = () => {
                          const canvas = document.createElement('canvas');
                          let width = img.width;
                          let height = img.height;
                          const maxWidth = 1200;
                          if (width > maxWidth) {
                            height = (height * maxWidth) / width;
                            width = maxWidth;
                          }
                          canvas.width = width;
                          canvas.height = height;
                          const ctx = canvas.getContext('2d');
                          ctx.drawImage(img, 0, 0, width, height);
                          resolve(canvas.toDataURL('image/jpeg', 0.7));
                        };
                        img.onerror = reject;
                        img.src = e.target.result;
                      } else {
                        // PDFの場合はそのまま
                        resolve(e.target.result);
                      }
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                  });
                };

                try {
                  const base64Data = await processFile(file);
                  const docType = prompt('書類の種類を選択:\n1. 見積書\n2. 請求書\n3. その他', '1');
                  const typeMap = { '1': '見積書', '2': '請求書', '3': 'その他' };
                  const selectedType = typeMap[docType] || 'その他';

                  await api.createSiteDocument({
                    siteId: selectedSite.id,
                    fileName: file.name,
                    fileData: base64Data,
                    fileType: file.type,
                    docType: selectedType,
                    date: new Date().toISOString().split('T')[0]
                  });
                  await loadData();
                  alert('書類をアップロードしました');
                } catch (err) {
                  alert('アップロードに失敗しました: ' + err.message);
                }
                e.target.value = '';
              }} />
              <label htmlFor="doc-upload" className="cursor-pointer block">
                <div className="flex justify-center mb-2"><Icons.FileText /></div>
                <p className="text-gray-600">タップして書類をアップロード</p>
                <p className="text-xs text-gray-400">画像（JPG, PNG）またはPDF対応</p>
              </label>
            </div>

            {(selectedSite?.documents || []).length === 0 ? (
              <p className="text-center text-gray-400 py-8">書類がありません</p>
            ) : (
              <div className="space-y-2">
                {[...(selectedSite?.documents || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).map((doc, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${doc.docType === '見積書' ? 'bg-blue-100 text-blue-600' : doc.docType === '請求書' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'}`}>
                      {doc.fileType?.includes('pdf') ? <Icons.FileText /> : <Icons.Camera />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{doc.fileName}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded ${doc.docType === '見積書' ? 'bg-blue-100 text-blue-600' : doc.docType === '請求書' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'}`}>{doc.docType}</span>
                        <span className="text-gray-400">{formatDate(doc.date)}</span>
                      </div>
                    </div>
                    <a href={doc.url} target="_blank" className="p-2 text-gray-400 hover:text-green-600"><Icons.ExternalLink /></a>
                    <button
                      onClick={async () => {
                        if (confirm('この書類を削除しますか？')) {
                          try {
                            await api.deleteSiteDocument(doc.id);
                            await loadData();
                          } catch (e) {
                            alert('削除に失敗しました: ' + e.message);
                          }
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-red-600"
                    ><Icons.Trash2 /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // 請求管理
  const InvoiceView = () => {
    const [filter, setFilter] = useState('thisMonth');
    const currentYearMonth = getCurrentYearMonth();
    const thisMonthBillingCorps = corporations.filter(isThisMonthBilling);

    // 一括チェック機能
    const bulkUpdateInvoiceStatus = async (field) => {
      const targets = thisMonthBillingCorps.filter(corp => {
        const status = getThisMonthInvoiceStatus(corp);
        if (field === 'isSent') return !status.isSent;
        if (field === 'isPaid') return status.isSent && !status.isPaid;
        return false;
      });

      if (targets.length === 0) {
        alert(field === 'isSent' ? '全て送付済みです' : '全て入金確認済みです');
        return;
      }

      if (!confirm(`${targets.length}件を一括で${field === 'isSent' ? '送付済み' : '入金確認済み'}にしますか？`)) return;

      try {
        for (const corp of targets) {
          const status = getThisMonthInvoiceStatus(corp);
          const newStatus = { ...status, [field]: true, yearMonth: currentYearMonth };
          if (field === 'isPaid') newStatus.paidDate = new Date().toISOString().split('T')[0];
          await api.updateInvoice(corp.id, newStatus);
        }
        await loadData();
      } catch (e) {
        console.error(e);
        alert('更新に失敗しました');
      }
    };

    const updateInvoiceStatus = async (corpId, field, value) => {
      const corp = corporations.find(c => c.id === corpId);
      const status = getThisMonthInvoiceStatus(corp);
      const newStatus = { ...status, [field]: value, yearMonth: currentYearMonth };
      if (field === 'isPaid' && value) newStatus.paidDate = new Date().toISOString().split('T')[0];
      
      try {
        await api.updateInvoice(corpId, newStatus);
        await loadData();
      } catch (e) {
        console.error(e);
      }
    };

    const filteredCorps = filter === 'thisMonth' ? thisMonthBillingCorps : filter === 'all' ? corporations : corporations.filter(c => c.billingCycle === filter);

    return (
      <div className="space-y-4">
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2D3436' }} className=" flex items-center gap-2"><Icons.Calculator /> 請求管理</h2>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {[{ key: 'thisMonth', label: `今月 (${thisMonthBillingCorps.length})` }, { key: 'all', label: `全て (${corporations.length})` }, { key: '毎月', label: '毎月' }, { key: '半年', label: '半年' }, { key: '年間', label: '年間' }].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${filter === f.key ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
              style={filter === f.key ? { backgroundColor: '#00B894' } : {}}>
              {f.label}
            </button>
          ))}
        </div>

        {filter === 'thisMonth' && thisMonthBillingCorps.length > 0 && (
          <div className="flex gap-2">
            <button onClick={() => bulkUpdateInvoiceStatus('isSent')}
              className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-600">
              一括送付済み
            </button>
            <button onClick={() => bulkUpdateInvoiceStatus('isPaid')}
              className="flex-1 bg-green-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-600">
              一括入金確認
            </button>
          </div>
        )}

        <div className="space-y-3">
          {filteredCorps.map(corp => {
            const billingColor = getBillingColor(corp.billingCycle);
            const status = getThisMonthInvoiceStatus(corp);
            const isThisMonth = isThisMonthBilling(corp);
            return (
              <div key={corp.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-gray-800">{corp.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded border ${billingColor.bg} ${billingColor.text} ${billingColor.border}`}>{corp.billingCycle}</span>
                </div>
                {isThisMonth && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div onClick={() => updateInvoiceStatus(corp.id, 'isSent', !status.isSent)}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center ${status.isSent ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300'}`}>
                        {status.isSent && <Icons.Check />}
                      </div>
                      <span className="text-sm">請求書送付済み</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div onClick={() => status.isSent && updateInvoiceStatus(corp.id, 'isPaid', !status.isPaid)}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center ${status.isPaid ? 'border-green-500 bg-green-500 text-white' : status.isSent ? 'border-gray-300' : 'border-gray-200 bg-gray-100'}`}>
                        {status.isPaid && <Icons.Check />}
                      </div>
                      <span className={`text-sm ${!status.isSent ? 'text-gray-400' : ''}`}>入金確認済み</span>
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 履歴タブ（管理者のみ）
  const LogsTab = () => {
    const [logsType, setLogsType] = useState('login');
    const [loginLogs, setLoginLogs] = useState([]);
    const [blockedIps, setBlockedIps] = useState([]);
    const [loginStats, setLoginStats] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [keyboxLogs, setKeyboxLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      const loadLogs = async () => {
        setLoading(true);
        try {
          if (logsType === 'login') {
            const data = await api.getLoginLogs();
            // 新API形式に対応（後方互換）
            if (data && data.logs) {
              setLoginLogs(data.logs);
              setBlockedIps(data.blocked_ips || []);
              setLoginStats(data.stats_24h || null);
            } else {
              setLoginLogs(Array.isArray(data) ? data : []);
            }
          } else {
            const data = await api.getKeyboxLogs();
            setKeyboxLogs(data);
          }
        } catch (e) {
          console.error('Failed to load logs:', e);
        }
        setLoading(false);
      };
      loadLogs();
    }, [logsType]);

    const handleUnblock = async (ip) => {
      if (!confirm(`IP: ${ip} のブロックを解除しますか？`)) return;
      try {
        await api.call('login-unblock', 'POST', { ip });
        const data = await api.getLoginLogs();
        if (data && data.logs) {
          setLoginLogs(data.logs);
          setBlockedIps(data.blocked_ips || []);
          setLoginStats(data.stats_24h || null);
        }
      } catch (e) {
        alert('エラー: ' + e.message);
      }
    };

    const formatDate = (dateStr) => {
      const d = new Date(dateStr);
      return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    };

    const filteredLogs = statusFilter
      ? loginLogs.filter(log => log.status === statusFilter)
      : loginLogs;

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <button onClick={() => setLogsType('login')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${logsType === 'login' ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
            style={logsType === 'login' ? { backgroundColor: '#00B894' } : {}}>
            ログイン履歴
          </button>
          <button onClick={() => setLogsType('keybox')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${logsType === 'keybox' ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
            style={logsType === 'keybox' ? { backgroundColor: '#00B894' } : {}}>
            キーボックス閲覧履歴
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : logsType === 'login' ? (
          <div className="space-y-4">
            {/* 24時間統計 */}
            {loginStats && (
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-white border rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-gray-800">{loginStats.total || 0}</div>
                  <div className="text-xs text-gray-500">24h合計</div>
                </div>
                <div className="bg-white border rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-green-600">{loginStats.success_count || 0}</div>
                  <div className="text-xs text-gray-500">成功</div>
                </div>
                <div className="bg-white border rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-red-600">{loginStats.fail_count || 0}</div>
                  <div className="text-xs text-gray-500">失敗</div>
                </div>
                <div className="bg-white border rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-blue-600">{loginStats.unique_ips || 0}</div>
                  <div className="text-xs text-gray-500">IP数</div>
                </div>
              </div>
            )}

            {/* ブロック中IP一覧 */}
            {blockedIps.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h4 className="font-bold text-red-700 text-sm mb-2">ブロック中のIP ({blockedIps.length}件)</h4>
                {blockedIps.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <div>
                      <span className="font-mono text-sm text-red-800">{item.ip_address}</span>
                      <span className="text-xs text-red-500 ml-2">{item.attempt_count}回失敗 / 解除: {formatDate(item.blocked_until)}</span>
                    </div>
                    <button onClick={() => handleUnblock(item.ip_address)}
                      className="text-xs bg-white border border-red-300 text-red-600 px-2 py-1 rounded">解除</button>
                  </div>
                ))}
              </div>
            )}

            {/* フィルター */}
            <div className="flex gap-2">
              <button onClick={() => setStatusFilter('')}
                className={`px-3 py-1 rounded text-xs font-medium ${!statusFilter ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>
                全て
              </button>
              <button onClick={() => setStatusFilter('success')}
                className={`px-3 py-1 rounded text-xs font-medium ${statusFilter === 'success' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                成功
              </button>
              <button onClick={() => setStatusFilter('failed')}
                className={`px-3 py-1 rounded text-xs font-medium ${statusFilter === 'failed' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                失敗
              </button>
            </div>

            {/* ログ一覧 */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {filteredLogs.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">ログイン履歴がありません</div>
                ) : filteredLogs.map(log => (
                  <div key={log.id} className={`p-3 ${log.status === 'failed' ? 'bg-red-50' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          log.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                        }`}>
                          {log.status === 'failed' ? '!' : (log.user_name?.charAt(0) || '?')}
                        </div>
                        <div>
                          <span className="font-medium text-sm">{log.user_name || log.username_attempted || '不明'}</span>
                          {log.status === 'failed' && (
                            <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                              {log.fail_reason === 'user_not_found' ? 'ユーザー不明' : log.fail_reason === 'wrong_password' ? 'パスワード誤り' : log.fail_reason === 'rate_limited' ? 'ブロック中' : '失敗'}
                            </span>
                          )}
                          {log.status === 'success' && (
                            <span className="ml-2 text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded">成功</span>
                          )}
                        </div>
                      </div>
                      <span className="text-gray-500 text-sm">{formatDate(log.login_at)}</span>
                    </div>
                    <div className="mt-1 ml-11 flex gap-3 text-xs text-gray-400">
                      {log.ip_address && <span className="font-mono">IP: {log.ip_address}</span>}
                      {log.user_agent && <span className="truncate max-w-xs" title={log.user_agent}>UA: {log.user_agent.substring(0, 50)}{log.user_agent.length > 50 ? '...' : ''}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-gray-100">
              {keyboxLogs.length === 0 ? (
                <div className="p-4 text-center text-gray-500">キーボックス閲覧履歴がありません</div>
              ) : keyboxLogs.map(log => (
                <div key={log.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                        <Icons.Key />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{log.site_name}</p>
                        <p className="text-gray-500 text-xs">{log.user_name}</p>
                      </div>
                    </div>
                    <span className="text-gray-500 text-sm">{formatDate(log.viewed_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 設定画面
  const SettingsView = () => {
    // マスタ追加用のローカルstate（親コンポーネントの再レンダリングの影響を受けない）
    const [localNewPest, setLocalNewPest] = useState('');
    const [localNewWork, setLocalNewWork] = useState('');
    const [localNewArea, setLocalNewArea] = useState('');
    const [localNewProduct, setLocalNewProduct] = useState('');
    const [inventoryProducts, setInventoryProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [editingProductId, setEditingProductId] = useState(null);
    const [editingProductName, setEditingProductName] = useState('');

    useEffect(() => {
      if (settingsTab === 'users' && users.length === 0) {
        api.getUsers().then(setUsers).catch(console.error);
      }
      if (settingsTab === 'master' && inventoryProducts.length === 0) {
        loadInventoryProducts();
      }
    }, [settingsTab, users.length, inventoryProducts.length]);

    const loadInventoryProducts = async () => {
      setLoadingProducts(true);
      try {
        const products = await api.getInventoryProducts();
        setInventoryProducts(products);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingProducts(false);
      }
    };

    const addProduct = async (e) => {
      e.preventDefault();
      if (!localNewProduct.trim()) return;
      try {
        await api.createInventoryProduct({ name: localNewProduct.trim(), unit: '個' });
        setLocalNewProduct('');
        await loadInventoryProducts();
      } catch (err) {
        console.error(err);
        alert('追加に失敗しました: ' + err.message);
      }
    };

    const deleteProduct = async (id) => {
      if (!confirm('この商品を削除しますか？')) return;
      try {
        await api.deleteInventoryProduct(id);
        await loadInventoryProducts();
      } catch (err) {
        console.error(err);
        alert('削除に失敗しました: ' + err.message);
      }
    };

    const startEditProduct = (product) => {
      setEditingProductId(product.id);
      setEditingProductName(product.name);
    };

    const cancelEditProduct = () => {
      setEditingProductId(null);
      setEditingProductName('');
    };

    const saveEditProduct = async (id) => {
      const trimmed = editingProductName.trim();
      if (!trimmed) {
        alert('商品名を入力してください');
        return;
      }
      try {
        await api.updateInventoryProduct(id, { name: trimmed });
        setEditingProductId(null);
        setEditingProductName('');
        await loadInventoryProducts();
      } catch (err) {
        console.error(err);
        alert('更新に失敗しました: ' + err.message);
      }
    };

    const handleSaveUser = async () => {
      if (!userForm.name || !userForm.username) {
        alert('名前とユーザー名は必須です');
        return;
      }
      try {
        if (editingUser) {
          await api.updateUser(editingUser.id, userForm);
        } else {
          if (!userForm.password) {
            alert('新規ユーザーにはパスワードが必須です');
            return;
          }
          await api.createUser(userForm);
        }
        const updatedUsers = await api.getUsers();
        setUsers(updatedUsers);
        setShowUserModal(false);
        setEditingUser(null);
        setUserForm({ name: '', username: '', password: '', role: 'staff' });
      } catch (e) {
        console.error('Save user error:', e);
        alert('保存に失敗しました: ' + e.message);
      }
    };

    const handleDeleteUser = async (id) => {
      if (!confirm('このユーザーを削除しますか？')) return;
      try {
        await api.deleteUser(id);
        const updatedUsers = await api.getUsers();
        setUsers(updatedUsers);
      } catch (e) {
        console.error(e);
        alert('削除に失敗しました: ' + e.message);
      }
    };

    const addMaster = async (type, value, setter) => {
      if (!value) return;
      try {
        await api.addMasterData(type, value);
        const updated = await api.getMasterData();
        setMasterData(updated);
        setter('');
      } catch (e) {
        console.error(e);
      }
    };

    const deleteMaster = async (type, name) => {
      try {
        await api.deleteMasterData(type, name);
        const updated = await api.getMasterData();
        setMasterData(updated);
      } catch (e) {
        console.error(e);
      }
    };

    const moveProduct = async (index, direction) => {
      const newProducts = [...inventoryProducts];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= newProducts.length) return;

      [newProducts[index], newProducts[newIndex]] = [newProducts[newIndex], newProducts[index]];
      setInventoryProducts(newProducts);

      try {
        await api.reorderInventoryProducts(newProducts.map(p => p.id));
      } catch (err) {
        console.error(err);
        await loadInventoryProducts();
      }
    };

    return (
      <div className="space-y-4">
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2D3436' }} className=" flex items-center gap-2"><Icons.Settings /> 設定</h2>

        <div className="flex gap-2 border-b border-gray-200 mb-4 overflow-x-auto">
          {[{ key: 'users', label: 'ユーザー' }, { key: 'master', label: 'マスタ' }, { key: 'import', label: 'インポート' }, { key: 'export', label: 'エクスポート' }, ...(currentUser?.role === 'admin' ? [{ key: 'logs', label: '履歴' }] : [])].map(tab => (
            <button key={tab.key} type="button" onClick={() => { setSettingsTab(tab.key); setShowUserModal(false); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${settingsTab === tab.key ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {settingsTab === 'users' && (
          <div className="space-y-3">
            <button type="button" onClick={() => { 
              setEditingUser(null); 
              setUserForm({ name: '', username: '', password: '', role: 'staff' }); 
              setShowUserModal(true); 
            }}
              className="w-full flex items-center justify-center gap-2 text-white py-2 rounded-lg" style={{ background: '#00B894' }}>
              <Icons.Plus /> ユーザー追加
            </button>
            {users.map(user => (
              <div key={user.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${user.role === 'master' ? 'bg-purple-600' : user.role === 'admin' ? 'bg-amber-500' : 'bg-gray-400'}`}>{user.name.charAt(0)}</div>
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-gray-400 text-sm">@{user.username} / {user.role === 'master' ? 'Master' : user.role === 'admin' ? '管理者' : 'スタッフ'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={(e) => { e.stopPropagation(); setEditingUser(user); setUserForm({ ...user, password: '' }); setShowUserModal(true); }} className="text-gray-400 hover:text-gray-600"><Icons.Edit /></button>
                  {user.id !== currentUser?.id && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteUser(user.id); }} className="text-red-400 hover:text-red-600"><Icons.Trash /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {settingsTab === 'master' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><Icons.Bug /> 対象害虫</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {(masterData.pestTypes || []).map((p, i) => (
                  <span key={`pest-${p}`} className="bg-red-50 text-red-600 text-sm px-2 py-1 rounded border border-red-200 flex items-center gap-1">
                    {p}
                    <button onClick={() => deleteMaster('pest', p)} className="text-red-400 hover:text-red-600"><Icons.X /></button>
                  </span>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); addMaster('pest', localNewPest, setLocalNewPest); }} className="flex gap-2">
                <input type="text" placeholder="新しい害虫を追加" value={localNewPest} onChange={e => setLocalNewPest(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <button type="submit" className="px-3 py-2 rounded-lg text-white text-sm" style={{ background: '#00B894' }}>追加</button>
              </form>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><Icons.Tool /> 作業内容</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {(masterData.workTypes || []).map((w, i) => (
                  <span key={`work-${w}`} className="bg-blue-50 text-blue-600 text-sm px-2 py-1 rounded border border-blue-200 flex items-center gap-1">
                    {w}
                    <button onClick={() => deleteMaster('workType', w)} className="text-blue-400 hover:text-blue-600"><Icons.X /></button>
                  </span>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); addMaster('workType', localNewWork, setLocalNewWork); }} className="flex gap-2">
                <input type="text" placeholder="新しい作業を追加" value={localNewWork} onChange={e => setLocalNewWork(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <button type="submit" className="px-3 py-2 rounded-lg text-white text-sm" style={{ background: '#00B894' }}>追加</button>
              </form>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><Icons.MapPin /> 作業箇所</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {(masterData.workAreas || []).map((a, i) => (
                  <span key={`area-${a}`} className="bg-purple-50 text-purple-600 text-sm px-2 py-1 rounded border border-purple-200 flex items-center gap-1">
                    {a}
                    <button onClick={() => deleteMaster('workArea', a)} className="text-purple-400 hover:text-purple-600"><Icons.X /></button>
                  </span>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); addMaster('workArea', localNewArea, setLocalNewArea); }} className="flex gap-2">
                <input type="text" placeholder="新しい作業箇所を追加" value={localNewArea} onChange={e => setLocalNewArea(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <button type="submit" className="px-3 py-2 rounded-lg text-white text-sm" style={{ background: '#00B894' }}>追加</button>
              </form>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 md:col-span-3">
              <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><Icons.Store /> 在庫商品 <span className="text-xs text-gray-400 font-normal">（上下で並び替え）</span></h3>
              {loadingProducts ? (
                <div className="text-center py-4 text-gray-500">読み込み中...</div>
              ) : (
                <>
                  <div className="space-y-1 mb-3 max-h-64 overflow-y-auto">
                    {inventoryProducts.map((p, index) => (
                      <div key={`product-${p.id}`} className="bg-amber-50 text-amber-700 text-sm px-3 py-2 rounded border border-amber-200 flex items-center justify-between">
                        {editingProductId === p.id ? (
                          <form className="flex items-center gap-2 flex-1 mr-2" onSubmit={(e) => { e.preventDefault(); saveEditProduct(p.id); }}>
                            <span className="text-amber-400 text-xs w-6">{index + 1}.</span>
                            <input type="text" value={editingProductName} onChange={e => setEditingProductName(e.target.value)}
                              className="flex-1 border border-amber-300 rounded px-2 py-1 text-sm bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-400"
                              autoFocus />
                            <button type="submit" className="text-green-600 hover:text-green-700 text-xs font-bold px-1">保存</button>
                            <button type="button" onClick={cancelEditProduct} className="text-gray-400 hover:text-gray-600 text-xs px-1">取消</button>
                          </form>
                        ) : (
                          <span className="flex items-center gap-2 cursor-pointer hover:underline" onClick={() => startEditProduct(p)}>
                            <span className="text-amber-400 text-xs w-6">{index + 1}.</span>
                            {p.name}
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          <button onClick={() => moveProduct(index, -1)} disabled={index === 0}
                            className={`px-2 py-1 rounded text-xs ${index === 0 ? 'text-gray-300' : 'text-amber-600 hover:bg-amber-100'}`}>▲</button>
                          <button onClick={() => moveProduct(index, 1)} disabled={index === inventoryProducts.length - 1}
                            className={`px-2 py-1 rounded text-xs ${index === inventoryProducts.length - 1 ? 'text-gray-300' : 'text-amber-600 hover:bg-amber-100'}`}>▼</button>
                          <button onClick={() => deleteProduct(p.id)} className="text-amber-400 hover:text-amber-600 ml-2"><Icons.X /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={addProduct} className="flex gap-2">
                    <input type="text" placeholder="新しい商品を追加" value={localNewProduct} onChange={e => setLocalNewProduct(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    <button type="submit" className="px-3 py-2 rounded-lg text-white text-sm" style={{ background: '#00B894' }}>追加</button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {settingsTab === 'import' && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><Icons.Upload /> CSVインポート</h3>
            <p className="text-sm text-gray-500 mb-4">法人・現場データをCSVファイルからインポートできます。</p>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center mb-4">
              <input type="file" accept=".csv" onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const text = await file.text();
                const lines = text.split('\n').filter(l => l.trim());
                if (lines.length < 2) { alert('データがありません'); return; }
                
                const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                const data = lines.slice(1).map(line => {
                  const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
                  const obj = {};
                  headers.forEach((h, i) => obj[h] = values[i] || '');
                  return obj;
                });
                
                if (confirm(`${data.length}件のデータをインポートしますか？`)) {
                  let success = 0;
                  for (const row of data) {
                    try {
                      await api.createCorp({
                        name: row['法人名'] || row['name'] || '',
                        address: row['住所'] || row['address'] || '',
                        contact: row['電話番号'] || row['contact'] || '',
                        contactPerson: row['担当者'] || row['contactPerson'] || '',
                        memo: row['メモ'] || row['memo'] || '',
                        billingCycle: row['請求サイクル'] || row['billingCycle'] || '毎月',
                        billingDay: row['請求日'] || row['billingDay'] || '25',
                        sites: []
                      });
                      success++;
                    } catch (err) {
                      console.error('Import error:', err);
                    }
                  }
                  alert(`${success}件のインポートが完了しました`);
                  await loadData();
                }
                e.target.value = '';
              }} className="hidden" id="csv-upload" />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Icons.Upload />
                <p className="mt-2 text-gray-600">クリックしてCSVファイルを選択</p>
                <p className="text-xs text-gray-400 mt-1">対応列: 法人名, 住所, 電話番号, 担当者, メモ, 請求サイクル, 請求日</p>
              </label>
            </div>
            <div className="text-sm text-gray-500">
              <p className="font-medium mb-2">CSVフォーマット例:</p>
              <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">法人名,住所,電話番号,担当者,メモ,請求サイクル,請求日
株式会社サンプル,東京都渋谷区1-1-1,03-1234-5678,山田太郎,備考テスト,毎月,25
有限会社テスト,大阪市北区2-2-2,06-9876-5432,田中花子,,半年,15</pre>
              <p className="text-xs text-gray-400 mt-2">※空欄の列は「,,」のように続けてください（2行目のメモ列参照）</p>
            </div>
            
            <div className="border-t border-gray-200 mt-6 pt-6">
              <h3 className="font-bold text-red-600 mb-3 flex items-center gap-2"><Icons.Trash /> データ一括削除</h3>
              <p className="text-sm text-gray-500 mb-4">全ての顧客データを削除します。この操作は取り消せません。</p>
              <button type="button" onClick={async () => {
                const confirmText = prompt('全ての顧客データを削除します。\n削除するには「削除」と入力してください:');
                if (confirmText !== '削除') {
                  if (confirmText !== null) alert('入力が正しくありません');
                  return;
                }
                if (!confirm('本当に全ての顧客データを削除しますか？\nこの操作は取り消せません！')) return;
                try {
                  for (const corp of corporations) {
                    await api.deleteCorp(corp.id);
                  }
                  await loadData();
                  alert('全ての顧客データを削除しました');
                } catch (err) {
                  alert('削除に失敗しました: ' + err.message);
                }
              }} className="w-full bg-red-500 text-white py-2 rounded-lg hover:bg-red-600">
                全顧客データを削除
              </button>
            </div>
          </div>
        )}

        {settingsTab === 'export' && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><Icons.Download /> CSVエクスポート</h3>
            <div className="space-y-2">
              {['corporations', 'sites', 'workLogs'].map(type => (
                <a key={type} href={`api/index.php?action=export&type=${type}`} target="_blank" className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                  <span>{type === 'corporations' ? '法人一覧' : type === 'sites' ? '現場一覧' : '作業履歴'}</span>
                  <Icons.Download />
                </a>
              ))}
            </div>
          </div>
        )}

        {settingsTab === 'logs' && currentUser?.role === 'admin' && <LogsTab />}

        {showUserModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowUserModal(false); }}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg mb-4">{editingUser ? 'ユーザー編集' : 'ユーザー追加'}</h3>
              <form onSubmit={(e) => { 
                e.preventDefault(); 
                const form = e.target;
                const data = {
                  name: form['user-name'].value,
                  username: form['user-username'].value,
                  password: form['user-password'].value,
                  role: form['user-role'].value
                };
                if (!data.name || !data.username) { alert('名前とユーザー名は必須です'); return; }
                if (!editingUser && !data.password) { alert('新規ユーザーにはパスワードが必須です'); return; }
                (async () => {
                  try {
                    if (editingUser) {
                      await api.updateUser(editingUser.id, data);
                    } else {
                      await api.createUser(data);
                    }
                    const updatedUsers = await api.getUsers();
                    setUsers(updatedUsers);
                    setShowUserModal(false);
                    setEditingUser(null);
                  } catch (err) {
                    alert('保存に失敗しました: ' + err.message);
                  }
                })();
              }} autoComplete="off">
                <div className="space-y-3">
                  <input type="text" id="user-name" name="user-name" placeholder="名前" defaultValue={editingUser?.name || ''} className="w-full border border-gray-300 rounded-lg px-3 py-2" autoComplete="off" />
                  <input type="text" id="user-username" name="user-username" placeholder="ユーザー名" defaultValue={editingUser?.username || ''} className="w-full border border-gray-300 rounded-lg px-3 py-2" autoComplete="off" />
                  <input type="password" id="user-password" name="user-password" placeholder={editingUser ? 'パスワード（変更時のみ）' : 'パスワード'} defaultValue="" className="w-full border border-gray-300 rounded-lg px-3 py-2" autoComplete="new-password" />
                  <select id="user-role" name="user-role" defaultValue={editingUser?.role || 'staff'} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                    {currentUser?.role === 'master' && <option value="master">Master</option>}
                    <option value="admin">管理者</option>
                    <option value="staff">スタッフ</option>
                  </select>
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setShowUserModal(false)} className="flex-1 bg-gray-100 py-2 rounded-lg">キャンセル</button>
                  <button type="submit" className="flex-1 text-white py-2 rounded-lg" style={{ background: '#00B894' }}>保存</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 月間カレンダー
  const MonthlyCalendar = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const monthWorks = getMonthWorks(year, month + 1);
    const today = new Date();
    
    const prevMonth = () => setCalendarMonth(new Date(year, month - 1, 1));
    const nextMonth = () => setCalendarMonth(new Date(year, month + 1, 1));

    const days = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg"><Icons.ChevronLeft /></button>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2D3436' }} className="">{year}年{month + 1}月</h2>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg"><Icons.ChevronRight /></button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 bg-gray-50">
            {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
              <div key={i} className={`p-2 text-center text-sm font-medium ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-600'}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const isToday = day && today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
              const dayWorks = day ? monthWorks.filter(w => w.date === day) : [];
              return (
                <div key={i} className={`min-h-[60px] p-1 border-t border-r border-gray-100 ${!day ? 'bg-gray-50' : ''}`}>
                  {day && (
                    <>
                      <span className={`text-sm ${isToday ? 'bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center' : i % 7 === 0 ? 'text-red-500' : i % 7 === 6 ? 'text-blue-500' : 'text-gray-700'}`}>{day}</span>
                      <div className="mt-1 space-y-0.5">
                        {dayWorks.slice(0, 2).map((w, j) => (
                          <div key={j} className="text-xs truncate px-1 rounded" style={{ backgroundColor: 'rgba(91, 189, 86, 0.2)', color: '#3d8a39' }}>{w.corpName}</div>
                        ))}
                        {dayWorks.length > 2 && <div className="text-xs text-gray-400">+{dayWorks.length - 2}</div>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-bold text-gray-700 mb-3">{month + 1}月の施工一覧 ({monthWorks.length}件)</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {monthWorks.sort((a, b) => a.date - b.date).map((work, i) => (
              <div key={i} onClick={() => {
                navigate(`/sites/${work.id}`);
              }} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                <div>
                  <span className="text-sm font-medium mr-2 px-2 py-0.5 rounded" style={{ backgroundColor: '#00B894', color: 'white' }}>{work.date}日</span>
                  <span className="text-gray-700">{work.corpName}</span>
                  <span className="text-gray-500 text-sm ml-2">{work.name}</span>
                </div>
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{work.workType}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ========== 日報一覧 ==========
  const DailyReportList = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [viewingReport, setViewingReport] = useState(null);

    useEffect(() => {
      loadReports();
    }, [selectedMonth]);

    const loadReports = async () => {
      setLoading(true);
      try {
        const data = await api.getDailyReports({ year_month: selectedMonth });
        setReports(data);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };

    const statusLabel = (status) => {
      switch (status) {
        case 'draft': return { label: '下書き', color: 'bg-gray-100 text-gray-600' };
        case 'submitted': return { label: '提出済', color: 'bg-blue-100 text-blue-600' };
        case 'approved': return { label: '承認済', color: 'bg-green-100 text-green-600' };
        default: return { label: status, color: 'bg-gray-100 text-gray-600' };
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2D3436' }} className="">日報</h2>
          <button onClick={() => navigate('/daily-reports/new')}
            className="flex items-center gap-1 text-white px-4 py-2 rounded-lg text-sm font-medium" style={{ background: '#00B894' }}>
            <Icons.Plus /> 新規作成
          </button>
        </div>

        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-3">
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2" />
        </div>

        {loading ? (
          <div className="text-center py-8"><Icons.Loader /></div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8 text-gray-400">この月の日報はありません</div>
        ) : (
          <div className="space-y-2">
            {reports.map(report => {
              const st = statusLabel(report.status);
              return (
                <div key={report.id} onClick={() => setViewingReport(report)}
                  className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-gray-800">{report.report_date}</p>
                      <p className="text-sm text-gray-500">{report.details?.length || 0}件の作業</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${st.color}`}>{st.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewingReport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewingReport(null)}>
            <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg">{viewingReport.report_date}</h3>
                  <span className={`text-xs px-2 py-1 rounded ${statusLabel(viewingReport.status).color}`}>
                    {statusLabel(viewingReport.status).label}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    setViewingReport(null);
                    navigate(`/daily-reports/${viewingReport.id}`);
                  }} className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded">編集</button>
                  <button onClick={async () => {
                    if (!confirm('この日報を削除しますか？')) return;
                    try {
                      await api.deleteDailyReport(viewingReport.id);
                      setViewingReport(null);
                      loadReports();
                    } catch (e) {
                      alert('削除に失敗しました: ' + e.message);
                    }
                  }} className="text-sm px-3 py-1 bg-red-100 text-red-600 rounded">削除</button>
                  <button onClick={() => setViewingReport(null)} className="text-gray-400 hover:text-gray-600">
                    <Icons.X />
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <h4 className="font-bold text-sm text-gray-500 mb-2">作業明細</h4>
                  {viewingReport.details?.length > 0 ? (
                    <div className="space-y-2">
                      {viewingReport.details.map((d, i) => (
                        <div key={i} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex justify-between">
                            <span className="font-medium">{d.site_name || '（現場名なし）'}</span>
                            <span className="text-sm text-gray-500">{d.worker_count}名</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {d.start_time?.slice(0, 5) || '--:--'} 〜 {d.end_time?.slice(0, 5) || '--:--'}
                          </div>
                          {d.companions && <div className="text-sm text-gray-500 mt-1">同行者: {d.companions}</div>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">作業明細なし</p>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-500">時間</p>
                    <p className="font-bold">{viewingReport.regular_hours || 0}h</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-500">夜勤</p>
                    <p className="font-bold">{viewingReport.night_hours || 0}h</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-500">その他</p>
                    <p className="font-bold">{viewingReport.other_hours || 0}h</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-2">
                    <p className="text-xs text-amber-600">工事P</p>
                    <p className="font-bold text-amber-600">{viewingReport.construction_points || 0}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">車両</p>
                    <p className="text-sm">{viewingReport.vehicle || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">使用経費</p>
                    <p className="text-sm">{viewingReport.expenses ? `${Number(viewingReport.expenses).toLocaleString()}円` : '-'}</p>
                  </div>
                </div>
                {viewingReport.contact_notes && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">連絡・報告事項</p>
                    <p className="text-sm bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{viewingReport.contact_notes}</p>
                  </div>
                )}
                {viewingReport.remarks && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">備考</p>
                    <p className="text-sm bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{viewingReport.remarks}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ========== 日報入力フォーム ==========
  const DailyReportForm = () => {
    const path = location.pathname;
    const reportId = path.split('/')[2];
    const isNew = reportId === 'new';

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [vehicles, setVehicles] = useState([]);
    const [formData, setFormData] = useState({
      reportDate: new Date().toISOString().slice(0, 10),
      vehicle: '',
      expenses: 0,
      contactNotes: '',
      remarks: '',
      status: 'draft',
      regularHours: 0,
      nightHours: 0,
      constructionPoints: 0,
      otherHours: 0,
      details: [{ startTime: '', endTime: '', siteId: null, siteName: '', workerCount: 1, companions: '' }]
    });
    const [siteSuggestions, setSiteSuggestions] = useState([]);
    const [activeDetailIndex, setActiveDetailIndex] = useState(null);

    useEffect(() => {
      loadVehicles();
      if (!isNew) {
        loadReport();
      }
    }, [reportId]);

    const loadVehicles = async () => {
      try {
        const data = await api.getVehicles();
        setVehicles(data);
      } catch (e) { console.error(e); }
    };

    const loadReport = async () => {
      try {
        const data = await api.getDailyReport(reportId);
        setFormData({
          reportDate: data.report_date,
          vehicle: data.vehicle || '',
          expenses: data.expenses || 0,
          contactNotes: data.contact_notes || '',
          remarks: data.remarks || '',
          status: data.status || 'draft',
          regularHours: data.regular_hours || 0,
          nightHours: data.night_hours || 0,
          constructionPoints: data.construction_points || 0,
          otherHours: data.other_hours || 0,
          details: data.details?.length > 0 ? data.details.map(d => ({
            startTime: d.start_time?.slice(0, 5) || '',
            endTime: d.end_time?.slice(0, 5) || '',
            siteId: d.site_id,
            siteName: d.site_name || '',
            workerCount: d.worker_count || 1,
            companions: d.companions || ''
          })) : [{ startTime: '', endTime: '', siteId: null, siteName: '', workerCount: 1, companions: '' }]
        });
      } catch (e) {
        alert('日報の読み込みに失敗しました: ' + e.message);
        navigate('/daily-reports');
      }
      setLoading(false);
    };

    const handleSiteNameChange = (index, value) => {
      const newDetails = [...formData.details];
      newDetails[index].siteName = value;
      newDetails[index].siteId = null;
      setFormData({ ...formData, details: newDetails });
      setActiveDetailIndex(index);

      // 現場候補を検索
      if (value.length >= 1) {
        const suggestions = [];
        corporations.forEach(corp => {
          (corp.sites || []).forEach(site => {
            if (site.name.includes(value) || corp.name.includes(value)) {
              suggestions.push({ id: site.id, name: site.name, corpName: corp.name });
            }
          });
        });
        setSiteSuggestions(suggestions.slice(0, 10));
      } else {
        setSiteSuggestions([]);
      }
    };

    const selectSite = (index, site) => {
      const newDetails = [...formData.details];
      newDetails[index].siteId = site.id;
      newDetails[index].siteName = site.name;
      setFormData({ ...formData, details: newDetails });
      setSiteSuggestions([]);
      setActiveDetailIndex(null);
    };

    const addDetail = () => {
      setFormData({
        ...formData,
        details: [...formData.details, { startTime: '', endTime: '', siteId: null, siteName: '', workerCount: 1, companions: '' }]
      });
    };

    const removeDetail = (index) => {
      if (formData.details.length === 1) return;
      const newDetails = formData.details.filter((_, i) => i !== index);
      setFormData({ ...formData, details: newDetails });
    };

    const updateDetail = (index, field, value) => {
      const newDetails = [...formData.details];
      newDetails[index][field] = value;
      setFormData({ ...formData, details: newDetails });
    };

    const handleSave = async (status = 'draft') => {
      setSaving(true);
      try {
        const data = { ...formData, status };
        if (isNew) {
          await api.createDailyReport(data);
        } else {
          await api.updateDailyReport(reportId, data);
        }
        navigate('/daily-reports');
      } catch (e) {
        alert('保存に失敗しました: ' + e.message);
      }
      setSaving(false);
    };

    if (loading) {
      return <div className="text-center py-8"><Icons.Loader /></div>;
    }

    return (
      <div className="space-y-4 pb-20">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/daily-reports')} className="text-gray-500"><Icons.ChevronLeft /></button>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2D3436' }} className="">{isNew ? '日報作成' : '日報編集'}</h2>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
            <input type="date" value={formData.reportDate} onChange={(e) => setFormData({ ...formData, reportDate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2" disabled={!isNew} />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">作業明細</label>
              <button onClick={addDetail} className="text-sm px-3 py-1 rounded" style={{ backgroundColor: '#00B894', color: 'white' }}>
                <Icons.Plus className="inline w-4 h-4" /> 追加
              </button>
            </div>
            {formData.details.map((detail, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 mb-2 relative">
                {formData.details.length > 1 && (
                  <button onClick={() => removeDetail(i)} className="absolute top-2 right-2 text-red-400 hover:text-red-600">
                    <Icons.X />
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-xs text-gray-500">開始</label>
                    <input type="time" value={detail.startTime} onChange={(e) => updateDetail(i, 'startTime', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">終了</label>
                    <input type="time" value={detail.endTime} onChange={(e) => updateDetail(i, 'endTime', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                  </div>
                </div>
                <div className="mb-2 relative">
                  <label className="text-xs text-gray-500">現場名</label>
                  <input type="text" value={detail.siteName} onChange={(e) => handleSiteNameChange(i, e.target.value)}
                    onFocus={() => setActiveDetailIndex(i)}
                    onBlur={() => setTimeout(() => { setActiveDetailIndex(null); setSiteSuggestions([]); }, 200)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="現場名を入力..." />
                  {activeDetailIndex === i && siteSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg mt-1 max-h-40 overflow-y-auto shadow-lg">
                      {siteSuggestions.map((s, j) => (
                        <div key={j} onClick={() => selectSite(i, s)}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm">
                          <span className="font-medium">{s.name}</span>
                          <span className="text-gray-400 ml-2">{s.corpName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">人数</label>
                    <input type="number" min="1" value={detail.workerCount || ''} onChange={(e) => updateDetail(i, 'workerCount', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">同行者</label>
                    <input type="text" value={detail.companions} onChange={(e) => updateDetail(i, 'companions', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="同行者名" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">車両</label>
            {(() => {
              const isCustomVehicle = formData.vehicle && !vehicles.some(v => v.name === formData.vehicle);
              const selectValue = isCustomVehicle ? '__other__' : formData.vehicle;
              return (
                <>
                  <select value={selectValue} onChange={(e) => {
                    if (e.target.value === '__other__') {
                      setFormData({ ...formData, vehicle: '' });
                    } else {
                      setFormData({ ...formData, vehicle: e.target.value });
                    }
                  }} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                    <option value="">選択してください</option>
                    {vehicles.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                    <option value="__other__">その他（手入力）</option>
                  </select>
                  {(selectValue === '__other__' || isCustomVehicle) && (
                    <input type="text" placeholder="車両名を入力" value={formData.vehicle}
                      onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-2" />
                  )}
                </>
              );
            })()}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">使用経費（円）</label>
            <input type="number" min="0" value={formData.expenses} onChange={(e) => setFormData({ ...formData, expenses: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">時間入力</label>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-xs text-gray-500">時間</label>
                <input type="number" min="0" step="0.5" value={formData.regularHours}
                  onChange={(e) => setFormData({ ...formData, regularHours: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="w-full border border-gray-300 rounded px-2 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">夜勤時間</label>
                <input type="number" min="0" step="0.5" value={formData.nightHours}
                  onChange={(e) => setFormData({ ...formData, nightHours: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="w-full border border-gray-300 rounded px-2 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">その他</label>
                <input type="number" min="0" step="0.5" value={formData.otherHours}
                  onChange={(e) => setFormData({ ...formData, otherHours: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="w-full border border-gray-300 rounded px-2 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-amber-600 font-bold">工事P</label>
                <input type="number" min="0" step="0.5" value={formData.constructionPoints}
                  onChange={(e) => setFormData({ ...formData, constructionPoints: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="w-full border border-amber-300 rounded px-2 py-2 text-sm bg-amber-50" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">連絡・報告事項</label>
            <textarea value={formData.contactNotes} onChange={(e) => setFormData({ ...formData, contactNotes: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 h-24" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
            <textarea value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 h-20" />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => handleSave('draft')} disabled={saving}
            className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-medium">
            {saving ? '保存中...' : '下書き保存'}
          </button>
          <button onClick={() => handleSave('submitted')} disabled={saving}
            className="flex-1 text-white py-3 rounded-lg font-medium" style={{ background: '#00B894' }}>
            {saving ? '保存中...' : '提出'}
          </button>
        </div>
      </div>
    );
  };

  // ========== タイムカード打刻画面 ==========
  const TimecardView = () => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [todayCard, setTodayCard] = useState(null);
    const [monthCards, setMonthCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingCard, setEditingCard] = useState(null);
    const [showCorrectionModal, setShowCorrectionModal] = useState(false);
    const [correctionData, setCorrectionData] = useState({ work_date: '', clock_in: '', clock_out: '', reason: '' });
    const [myRequests, setMyRequests] = useState([]);

    useEffect(() => {
      const timer = setInterval(() => setCurrentTime(new Date()), 1000);
      return () => clearInterval(timer);
    }, []);

    useEffect(() => {
      loadMyRequests();
    }, []);

    useEffect(() => {
      let cancelled = false;

      const load = async () => {
        try {
          const todayData = await api.getTodayTimecard();
          if (!cancelled) setTodayCard(todayData);
        } catch (e) { console.error(e); }

        setLoading(true);
        try {
          const monthData = await api.getTimecards({ year_month: selectedMonth });
          if (!cancelled) setMonthCards(monthData);
        } catch (e) { console.error(e); }
        if (!cancelled) setLoading(false);
      };

      load();
      return () => { cancelled = true; };
    }, [selectedMonth]);

    const loadTodayCard = async () => {
      try {
        const data = await api.getTodayTimecard();
        setTodayCard(data);
      } catch (e) { console.error(e); }
    };

    const loadMonthCards = async () => {
      setLoading(true);
      try {
        const data = await api.getTimecards({ year_month: selectedMonth });
        setMonthCards(data);
      } catch (e) { console.error(e); }
      setLoading(false);
    };

    const loadMyRequests = async () => {
      try {
        const data = await api.getMyTimecardRequests();
        setMyRequests(data);
      } catch (e) { console.error(e); }
    };

    const handleSubmitCorrection = async () => {
      if (!correctionData.work_date) {
        alert('日付を入力してください');
        return;
      }
      if (!correctionData.reason) {
        alert('理由を入力してください');
        return;
      }
      try {
        await api.submitTimecardRequest(correctionData);
        alert('修正申請を送信しました');
        setShowCorrectionModal(false);
        setCorrectionData({ work_date: '', clock_in: '', clock_out: '', reason: '' });
        loadMyRequests();
        loadMonthCards();
      } catch (e) {
        alert(e.message);
      }
    };

    const handleClockIn = async () => {
      try {
        await api.clockIn({ type: 'auto' });
        await loadTodayCard();
        await loadMonthCards();
      } catch (e) {
        alert(e.message);
      }
    };

    const handleClockOut = async () => {
      try {
        await api.clockOut({ type: 'auto' });
        await loadTodayCard();
        await loadMonthCards();
      } catch (e) {
        alert(e.message);
      }
    };

    const formatTime = (time) => time ? time.slice(0, 5) : '--:--';

    return (
      <div className="space-y-4">
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2D3436' }} className="">タイムカード</h2>

        <div className="bg-white text-center" style={{ borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '36px', fontWeight: 800, color: '#2D3436', marginBottom: '8px' }}>
            {currentTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
          <p style={{ color: '#636E72', marginBottom: '16px' }}>
            {currentTime.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>

          <div className="flex gap-3 justify-center mb-4">
            {!todayCard?.clock_in ? (
              <button onClick={handleClockIn}
                className="text-white text-lg font-bold" style={{ padding: '16px 32px', borderRadius: '16px', background: 'linear-gradient(135deg, #00B894, #00D2A0)', border: 'none', boxShadow: '0 4px 16px rgba(0, 184, 148, 0.3)' }}>
                出勤
              </button>
            ) : !todayCard?.clock_out ? (
              <button onClick={handleClockOut}
                className="text-white text-lg font-bold" style={{ padding: '16px 32px', borderRadius: '16px', background: 'linear-gradient(135deg, #E67E22, #F39C12)', border: 'none', boxShadow: '0 4px 16px rgba(230, 126, 34, 0.3)' }}>
                退勤
              </button>
            ) : (
              <p style={{ color: '#00B894', fontWeight: 600 }}>本日の打刻完了</p>
            )}
          </div>

          <div className="flex justify-center gap-8 text-sm">
            <div>
              <span className="text-gray-500">出勤</span>
              <p className="text-xl font-bold">{formatTime(todayCard?.clock_in)}</p>
            </div>
            <div>
              <span className="text-gray-500">退勤</span>
              <p className="text-xl font-bold">{formatTime(todayCard?.clock_out)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-700">履歴</h3>
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm" />
          </div>

          {loading ? (
            <div className="text-center py-4"><Icons.Loader /></div>
          ) : monthCards.length === 0 ? (
            <p className="text-gray-400 text-center py-4">この月の記録はありません</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {monthCards.map(card => (
                <div key={card.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-700 text-sm">{card.work_date}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{formatTime(card.clock_in)} - {formatTime(card.clock_out)}</span>
                    {(currentUser?.role === 'admin' || currentUser?.role === 'master') ? (
                      <button onClick={() => { setEditingCard(card); setShowEditModal(true); }}
                        className="text-gray-400 hover:text-gray-600"><Icons.Edit /></button>
                    ) : (
                      <button onClick={() => {
                        setCorrectionData({
                          work_date: card.work_date,
                          clock_in: card.clock_in || '',
                          clock_out: card.clock_out || '',
                          reason: ''
                        });
                        setShowCorrectionModal(true);
                      }}
                        className="text-xs text-blue-500 hover:text-blue-700 whitespace-nowrap">修正申請</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showEditModal && editingCard && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm">
              <h3 className="font-bold text-lg mb-4">タイムカード編集</h3>
              <p className="text-gray-500 mb-4">{editingCard.work_date}</p>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-500">出勤時刻</label>
                  <input type="time" defaultValue={editingCard.clock_in?.slice(0, 5)}
                    onChange={(e) => setEditingCard({ ...editingCard, clock_in: e.target.value + ':00' })}
                    className="w-full border border-gray-300 rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-gray-500">退勤時刻</label>
                  <input type="time" defaultValue={editingCard.clock_out?.slice(0, 5)}
                    onChange={(e) => setEditingCard({ ...editingCard, clock_out: e.target.value + ':00' })}
                    className="w-full border border-gray-300 rounded px-3 py-2" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setShowEditModal(false)} className="flex-1 bg-gray-200 py-2 rounded-lg">キャンセル</button>
                <button onClick={async () => {
                  try {
                    await api.updateTimecard(editingCard.id, {
                      clockIn: editingCard.clock_in,
                      clockOut: editingCard.clock_out
                    });
                    setShowEditModal(false);
                    loadTodayCard();
                    loadMonthCards();
                  } catch (e) { alert(e.message); }
                }} className="flex-1 text-white py-2 rounded-lg" style={{ background: '#00B894' }}>保存</button>
              </div>
              <button onClick={async () => {
                if (confirm('このタイムカードを削除しますか？')) {
                  try {
                    await api.deleteTimecard(editingCard.id);
                    setShowEditModal(false);
                    loadTodayCard();
                    loadMonthCards();
                  } catch (e) { alert(e.message); }
                }
              }} className="w-full mt-2 text-red-500 text-sm py-2 hover:bg-red-50 rounded-lg">削除する</button>
            </div>
          </div>
        )}

        {/* 修正申請ボタン */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <button onClick={() => {
            setCorrectionData({ work_date: '', clock_in: '', clock_out: '', reason: '' });
            setShowCorrectionModal(true);
          }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg">
            <Icons.Edit /> 打刻修正を申請
          </button>
        </div>

        {/* 申請履歴 */}
        {myRequests.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-bold text-gray-700 mb-3">修正申請履歴</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {myRequests.map(req => (
                <div key={req.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-sm text-gray-700">{req.work_date}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      req.status === 'approved' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {req.status === 'pending' ? '申請中' : req.status === 'approved' ? '承認済' : '却下'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {req.clock_in?.slice(0, 5) || '--:--'} 〜 {req.clock_out?.slice(0, 5) || '--:--'}
                  </div>
                  {req.reason && <p className="text-xs text-gray-500 mt-1">理由: {req.reason}</p>}
                  {req.reject_comment && <p className="text-xs text-red-500 mt-1">却下理由: {req.reject_comment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 修正申請モーダル */}
        {showCorrectionModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm">
              <h3 className="font-bold text-lg mb-4">打刻修正申請</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-500">日付</label>
                  <input type="date" value={correctionData.work_date}
                    onChange={(e) => setCorrectionData({ ...correctionData, work_date: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-gray-500">出勤時刻</label>
                  <input type="time" value={correctionData.clock_in ? correctionData.clock_in.slice(0, 5) : ''}
                    onChange={(e) => setCorrectionData({ ...correctionData, clock_in: e.target.value ? e.target.value + ':00' : '' })}
                    className="w-full border border-gray-300 rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-gray-500">退勤時刻</label>
                  <input type="time" value={correctionData.clock_out ? correctionData.clock_out.slice(0, 5) : ''}
                    onChange={(e) => setCorrectionData({ ...correctionData, clock_out: e.target.value ? e.target.value + ':00' : '' })}
                    className="w-full border border-gray-300 rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-gray-500">理由</label>
                  <textarea value={correctionData.reason}
                    onChange={(e) => setCorrectionData({ ...correctionData, reason: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2" rows="3"
                    placeholder="修正が必要な理由を入力してください" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setShowCorrectionModal(false)} className="flex-1 bg-gray-200 py-2 rounded-lg">キャンセル</button>
                <button onClick={handleSubmitCorrection} className="flex-1 bg-blue-500 text-white py-2 rounded-lg">申請する</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ========== 管理者メニュー ==========
  const AdminMenuView = () => {
    return (
      <div className="space-y-4">
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2D3436' }} className="">メニュー</h2>

        <div className="space-y-3">
          <button onClick={() => navigate('/settings')}
            className="w-full bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 text-left hover:bg-gray-50">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(91, 189, 86, 0.1)' }}>
              <Icons.Settings style={{ color: '#00B894' }} />
            </div>
            <div>
              <p className="font-bold text-gray-800">設定</p>
              <p className="text-sm text-gray-500">ユーザー・マスターデータ管理</p>
            </div>
            <Icons.ChevronRight className="ml-auto text-gray-400" />
          </button>

          <button onClick={() => navigate('/admin/daily-reports')}
            className="w-full bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 text-left hover:bg-gray-50">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(91, 189, 86, 0.1)' }}>
              <Icons.ClipboardList style={{ color: '#00B894' }} />
            </div>
            <div>
              <p className="font-bold text-gray-800">日報管理</p>
              <p className="text-sm text-gray-500">全スタッフの日報確認・工事P入力</p>
            </div>
            <Icons.ChevronRight className="ml-auto text-gray-400" />
          </button>

          <button onClick={() => navigate('/admin/timecards')}
            className="w-full bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 text-left hover:bg-gray-50">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(91, 189, 86, 0.1)' }}>
              <Icons.Clock style={{ color: '#00B894' }} />
            </div>
            <div>
              <p className="font-bold text-gray-800">タイムカード管理</p>
              <p className="text-sm text-gray-500">全スタッフの勤怠確認・集計</p>
            </div>
            <Icons.ChevronRight className="ml-auto text-gray-400" />
          </button>

          {(userRole === 'master' || userRole === 'admin') && (
            <button onClick={() => navigate('/admin/audit-logs')}
              className="w-full bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 text-left hover:bg-gray-50">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(91, 189, 86, 0.1)' }}>
                <Icons.FileText style={{ color: '#00B894' }} />
              </div>
              <div>
                <p className="font-bold text-gray-800">操作履歴</p>
                <p className="text-sm text-gray-500">システム操作ログの確認</p>
              </div>
              <Icons.ChevronRight className="ml-auto text-gray-400" />
            </button>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 mt-6">
          <p className="text-gray-500 text-sm">ログイン中: {currentUser?.name}</p>
          <button onClick={handleLogout} className="mt-2 text-red-500 text-sm flex items-center gap-1">
            <Icons.LogOut /> ログアウト
          </button>
        </div>
      </div>
    );
  };

  // ========== 管理者用日報管理 ==========
  const DailyReportAdminView = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [selectedUser, setSelectedUser] = useState('');
    const [editingHours, setEditingHours] = useState(null);
    const [viewingReport, setViewingReport] = useState(null);

    useEffect(() => {
      loadReports();
    }, [selectedMonth, selectedUser]);

    const loadReports = async () => {
      setLoading(true);
      try {
        const params = { year_month: selectedMonth };
        if (selectedUser) params.user_id = selectedUser;
        const data = await api.getDailyReports(params);
        setReports(data);
      } catch (e) { console.error(e); }
      setLoading(false);
    };

    const handleExport = () => {
      const params = new URLSearchParams({ year_month: selectedMonth });
      if (selectedUser) params.append('user_id', selectedUser);
      const basePath = window.location.pathname.replace(/\/[^\/]*$/, '/');
      window.open(`${basePath}api/index.php?action=daily-reports-export&${params.toString()}`, '_blank');
    };

    const handleSaveHours = async () => {
      try {
        await api.updateDailyReportHours(editingHours.id, {
          regularHours: editingHours.regular_hours || 0,
          nightHours: editingHours.night_hours || 0,
          constructionPoints: editingHours.construction_points || 0,
          otherHours: editingHours.other_hours || 0
        });
        setEditingHours(null);
        loadReports();
      } catch (e) { alert(e.message); }
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/menu')} className="text-gray-500"><Icons.ChevronLeft /></button>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2D3436' }} className="">日報管理</h2>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-center">
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2" />
          <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2">
            <option value="">全員</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <button onClick={handleExport} className="ml-auto flex items-center gap-1 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm">
            <Icons.Download /> CSV出力
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8"><Icons.Loader /></div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8 text-gray-400">日報がありません</div>
        ) : (
          <div className="space-y-3">
            {reports.map(report => (
              <div key={report.id} className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setViewingReport(report)}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-gray-800">{report.report_date}</p>
                    <p className="text-sm text-gray-500">{report.user_name}</p>
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => {
                      const basePath = window.location.pathname.replace(/\/[^\/]*$/, '/');
                      window.open(`${basePath}api/index.php?action=daily-report-pdf&id=${report.id}`, '_blank');
                    }} className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded">PDF</button>
                    <button onClick={() => setEditingHours(report)}
                      className="text-sm px-3 py-1 bg-amber-100 text-amber-700 rounded">工事P入力</button>
                  </div>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  {report.details?.slice(0, 3).map((d, i) => (
                    <p key={i}>{d.start_time?.slice(0, 5)}〜{d.end_time?.slice(0, 5)} {d.site_name} ({d.worker_count}名)</p>
                  ))}
                  {report.details?.length > 3 && <p className="text-gray-400">...他{report.details.length - 3}件</p>}
                </div>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span>時間: {report.regular_hours || 0}h</span>
                  <span>夜勤: {report.night_hours || 0}h</span>
                  <span className="font-bold text-amber-600">工事P: {report.construction_points || 0}</span>
                  <span>その他: {report.other_hours || 0}h</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {editingHours && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm">
              <h3 className="font-bold text-lg mb-4">時間・工事P入力</h3>
              <p className="text-gray-500 mb-4">{editingHours.report_date} - {editingHours.user_name}</p>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-500">時間</label>
                  <input type="number" step="0.5" value={editingHours.regular_hours || 0}
                    onChange={(e) => setEditingHours({ ...editingHours, regular_hours: parseFloat(e.target.value) })}
                    className="w-full border border-gray-300 rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-gray-500">夜勤時間</label>
                  <input type="number" step="0.5" value={editingHours.night_hours || 0}
                    onChange={(e) => setEditingHours({ ...editingHours, night_hours: parseFloat(e.target.value) })}
                    className="w-full border border-gray-300 rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-gray-500 font-bold text-amber-600">工事P（給与加算ポイント）</label>
                  <input type="number" step="0.5" value={editingHours.construction_points || 0}
                    onChange={(e) => setEditingHours({ ...editingHours, construction_points: parseFloat(e.target.value) })}
                    className="w-full border border-gray-300 rounded px-3 py-2 border-amber-300" />
                </div>
                <div>
                  <label className="text-sm text-gray-500">その他</label>
                  <input type="number" step="0.5" value={editingHours.other_hours || 0}
                    onChange={(e) => setEditingHours({ ...editingHours, other_hours: parseFloat(e.target.value) })}
                    className="w-full border border-gray-300 rounded px-3 py-2" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setEditingHours(null)} className="flex-1 bg-gray-200 py-2 rounded-lg">キャンセル</button>
                <button onClick={handleSaveHours} className="flex-1 text-white py-2 rounded-lg" style={{ background: '#00B894' }}>保存</button>
              </div>
            </div>
          </div>
        )}

        {viewingReport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewingReport(null)}>
            <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg">{viewingReport.report_date}</h3>
                  <p className="text-sm text-gray-500">{viewingReport.user_name}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    const basePath = window.location.pathname.replace(/\/[^\/]*$/, '/');
                    window.open(`${basePath}api/index.php?action=daily-report-pdf&id=${viewingReport.id}`, '_blank');
                  }} className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded">PDF</button>
                  <button onClick={async () => {
                    if (!confirm('この日報を削除しますか？')) return;
                    try {
                      await api.deleteDailyReport(viewingReport.id);
                      setViewingReport(null);
                      loadReports();
                    } catch (e) {
                      alert('削除に失敗しました: ' + e.message);
                    }
                  }} className="text-sm px-3 py-1 bg-red-100 text-red-600 rounded">削除</button>
                  <button onClick={() => setViewingReport(null)} className="text-gray-400 hover:text-gray-600">
                    <Icons.X />
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <h4 className="font-bold text-sm text-gray-500 mb-2">作業明細</h4>
                  {viewingReport.details?.length > 0 ? (
                    <div className="space-y-2">
                      {viewingReport.details.map((d, i) => (
                        <div key={i} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex justify-between">
                            <span className="font-medium">{d.site_name || '（現場名なし）'}</span>
                            <span className="text-sm text-gray-500">{d.worker_count}名</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {d.start_time?.slice(0, 5) || '--:--'} 〜 {d.end_time?.slice(0, 5) || '--:--'}
                          </div>
                          {d.companions && <div className="text-sm text-gray-500 mt-1">同行者: {d.companions}</div>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">作業明細なし</p>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-500">時間</p>
                    <p className="font-bold">{viewingReport.regular_hours || 0}h</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-500">夜勤</p>
                    <p className="font-bold">{viewingReport.night_hours || 0}h</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-500">その他</p>
                    <p className="font-bold">{viewingReport.other_hours || 0}h</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-2">
                    <p className="text-xs text-amber-600">工事P</p>
                    <p className="font-bold text-amber-600">{viewingReport.construction_points || 0}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">車両</p>
                    <p className="text-sm">{viewingReport.vehicle || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">使用経費</p>
                    <p className="text-sm">{viewingReport.expenses ? `${Number(viewingReport.expenses).toLocaleString()}円` : '-'}</p>
                  </div>
                </div>
                {viewingReport.contact_notes && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">連絡・報告事項</p>
                    <p className="text-sm bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{viewingReport.contact_notes}</p>
                  </div>
                )}
                {viewingReport.remarks && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">備考</p>
                    <p className="text-sm bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{viewingReport.remarks}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ========== 管理者用タイムカード管理 ==========
  const TimecardAdminView = () => {
    const [activeTab, setActiveTab] = useState('timecards');
    const [timecards, setTimecards] = useState([]);
    const [requests, setRequests] = useState([]);
    const [requestsCount, setRequestsCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [selectedUser, setSelectedUser] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingCard, setEditingCard] = useState(null);
    const [rejectingRequest, setRejectingRequest] = useState(null);
    const [rejectComment, setRejectComment] = useState('');

    useEffect(() => {
      loadTimecards();
      loadRequests();
      loadRequestsCount();
    }, [selectedMonth, selectedUser]);

    const loadTimecards = async () => {
      setLoading(true);
      try {
        const params = { year_month: selectedMonth };
        if (selectedUser) params.user_id = selectedUser;
        const data = await api.getTimecards(params);
        setTimecards(data);
      } catch (e) { console.error(e); }
      setLoading(false);
    };

    const loadRequests = async () => {
      try {
        const data = await api.getTimecardRequests({ status: 'pending' });
        setRequests(data);
      } catch (e) { console.error(e); }
    };

    const loadRequestsCount = async () => {
      try {
        const data = await api.getTimecardRequestsCount();
        setRequestsCount(data.count);
      } catch (e) { console.error(e); }
    };

    const handleApprove = async (id) => {
      if (!confirm('この申請を承認しますか？')) return;
      try {
        await api.approveTimecardRequest(id);
        alert('承認しました');
        loadRequests();
        loadRequestsCount();
        loadTimecards();
      } catch (e) {
        alert(e.message);
      }
    };

    const handleReject = async () => {
      if (!rejectingRequest) return;
      try {
        await api.rejectTimecardRequest(rejectingRequest.id, rejectComment);
        alert('却下しました');
        setRejectingRequest(null);
        setRejectComment('');
        loadRequests();
        loadRequestsCount();
      } catch (e) {
        alert(e.message);
      }
    };

    const handleExport = () => {
      const params = new URLSearchParams({ year_month: selectedMonth });
      if (selectedUser) params.append('user_id', selectedUser);
      const basePath = window.location.pathname.replace(/\/[^\/]*$/, '/');
      window.open(`${basePath}api/index.php?action=timecards-export&${params.toString()}`, '_blank');
    };

    // 集計計算（user_idでグループ化）
    const summary = (() => {
      const byUser = {};
      timecards.forEach(tc => {
        const key = tc.user_id;
        if (!byUser[key]) {
          byUser[key] = { name: tc.user_name, days: 0, totalHours: 0 };
        }
        byUser[key].days++;
        if (tc.clock_in && tc.clock_out) {
          const inTime = new Date(`2000-01-01T${tc.clock_in}`);
          let outTime = new Date(`2000-01-01T${tc.clock_out}`);
          // 日をまたぐ場合（退勤時刻が出勤時刻より前）は翌日として計算
          if (outTime < inTime) {
            outTime = new Date(`2000-01-02T${tc.clock_out}`);
          }
          byUser[key].totalHours += (outTime - inTime) / 3600000;
        }
      });
      return byUser;
    })();

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/menu')} className="text-gray-500"><Icons.ChevronLeft /></button>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2D3436' }} className="">タイムカード管理</h2>
        </div>

        {/* タブ */}
        <div className="flex border-b border-gray-200">
          <button onClick={() => setActiveTab('timecards')}
            className={`px-4 py-2 font-medium ${activeTab === 'timecards' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
            タイムカード
          </button>
          <button onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 font-medium relative ${activeTab === 'requests' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
            修正申請
            {requestsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{requestsCount}</span>
            )}
          </button>
        </div>

        {activeTab === 'timecards' ? (
          <>
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-center">
              <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2" />
              <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2">
                <option value="">全員</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <button onClick={handleExport} className="ml-auto flex items-center gap-1 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm">
                <Icons.Download /> CSV出力
              </button>
            </div>

            {/* 月間集計 */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="font-bold text-gray-700 mb-3">月間集計</h3>
              <div className="space-y-2">
                {Object.entries(summary).map(([userId, data]) => (
                  <div key={userId} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="font-medium">{data.name}</span>
                    <div className="text-sm text-gray-600">
                      <span className="mr-4">{data.days}日</span>
                      <span className="font-bold">{data.totalHours.toFixed(1)}時間</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8"><Icons.Loader /></div>
            ) : timecards.length === 0 ? (
              <div className="text-center py-8 text-gray-400">タイムカードがありません</div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="font-bold text-gray-700 mb-3">詳細</h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {timecards.map(tc => (
                    <div key={tc.id} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                      <span className="font-medium w-24">{tc.work_date}</span>
                      <span className="text-gray-600 w-20">{tc.user_name}</span>
                      <span>{tc.clock_in?.slice(0, 5) || '--:--'}</span>
                      <span>〜</span>
                      <span>{tc.clock_out?.slice(0, 5) || '--:--'}</span>
                      <button onClick={() => { setEditingCard(tc); setShowEditModal(true); }}
                        className="text-gray-400 hover:text-gray-600 ml-2"><Icons.Edit /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-bold text-gray-700 mb-3">修正申請一覧</h3>
            {requests.length === 0 ? (
              <p className="text-gray-400 text-center py-4">未処理の申請はありません</p>
            ) : (
              <div className="space-y-3">
                {requests.map(req => (
                  <div key={req.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-medium">{req.user_name}</span>
                        <span className="text-gray-500 ml-2">{req.work_date}</span>
                      </div>
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">申請中</span>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      <span>出勤: {req.clock_in?.slice(0, 5) || '--:--'}</span>
                      <span className="mx-2">〜</span>
                      <span>退勤: {req.clock_out?.slice(0, 5) || '--:--'}</span>
                    </div>
                    {req.reason && <p className="text-sm text-gray-500 mb-2">理由: {req.reason}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(req.id)}
                        className="flex-1 bg-green-500 text-white py-2 rounded text-sm">承認</button>
                      <button onClick={() => setRejectingRequest(req)}
                        className="flex-1 bg-red-500 text-white py-2 rounded text-sm">却下</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showEditModal && editingCard && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm">
              <h3 className="font-bold text-lg mb-2">タイムカード編集</h3>
              <p className="text-gray-500 mb-1">{editingCard.user_name}</p>
              <p className="text-gray-500 mb-4">{editingCard.work_date}</p>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-500">出勤時刻</label>
                  <input type="time" defaultValue={editingCard.clock_in?.slice(0, 5)}
                    onChange={(e) => setEditingCard({ ...editingCard, clock_in: e.target.value + ':00' })}
                    className="w-full border border-gray-300 rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-gray-500">退勤時刻</label>
                  <input type="time" defaultValue={editingCard.clock_out?.slice(0, 5)}
                    onChange={(e) => setEditingCard({ ...editingCard, clock_out: e.target.value + ':00' })}
                    className="w-full border border-gray-300 rounded px-3 py-2" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setShowEditModal(false)} className="flex-1 bg-gray-200 py-2 rounded-lg">キャンセル</button>
                <button onClick={async () => {
                  try {
                    await api.updateTimecard(editingCard.id, {
                      clockIn: editingCard.clock_in,
                      clockOut: editingCard.clock_out
                    });
                    setShowEditModal(false);
                    loadTimecards();
                  } catch (e) { alert('更新に失敗: ' + e.message); }
                }} className="flex-1 bg-blue-500 text-white py-2 rounded-lg">保存</button>
              </div>
              <button onClick={async () => {
                if (confirm('このタイムカードを削除しますか？')) {
                  try {
                    await api.deleteTimecard(editingCard.id);
                    setShowEditModal(false);
                    loadTimecards();
                  } catch (e) { alert('削除に失敗: ' + e.message); }
                }
              }} className="w-full mt-2 text-red-500 text-sm">削除する</button>
            </div>
          </div>
        )}

        {/* 却下理由モーダル */}
        {rejectingRequest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm">
              <h3 className="font-bold text-lg mb-4">却下理由</h3>
              <p className="text-gray-500 mb-2">{rejectingRequest.user_name} - {rejectingRequest.work_date}</p>
              <textarea value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 mb-4" rows="3"
                placeholder="却下理由を入力してください" />
              <div className="flex gap-2">
                <button onClick={() => { setRejectingRequest(null); setRejectComment(''); }}
                  className="flex-1 bg-gray-200 py-2 rounded-lg">キャンセル</button>
                <button onClick={handleReject}
                  className="flex-1 bg-red-500 text-white py-2 rounded-lg">却下する</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ========== 管理者用操作履歴 ==========
  const AuditLogView = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    useEffect(() => {
      loadLogs();
    }, [selectedUser, selectedType, dateFrom, dateTo]);

    const loadLogs = async () => {
      setLoading(true);
      try {
        const params = {};
        if (selectedUser) params.user_id = selectedUser;
        if (selectedType) params.target_type = selectedType;
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;
        const data = await api.getAuditLogs(params);
        setLogs(data);
      } catch (e) { console.error(e); }
      setLoading(false);
    };

    const getActionColor = (action) => {
      switch (action) {
        case 'create': return 'bg-green-100 text-green-700';
        case 'update': return 'bg-blue-100 text-blue-700';
        case 'delete': return 'bg-red-100 text-red-700';
        default: return 'bg-gray-100 text-gray-700';
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/menu')} className="text-gray-500"><Icons.ChevronLeft /></button>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2D3436' }} className="">操作履歴</h2>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-center">
          <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="">全ユーザー</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="">全種別</option>
            <option value="user">ユーザー</option>
            <option value="corporation">法人</option>
            <option value="site">現場</option>
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm" placeholder="開始日" />
          <span className="text-gray-400">〜</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm" placeholder="終了日" />
        </div>

        {loading ? (
          <div className="text-center py-8"><Icons.Loader /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">操作履歴がありません</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="p-3 hover:bg-gray-50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${getActionColor(log.action)}`}>
                      {log.actionLabel}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {log.targetTypeLabel}
                    </span>
                    <span className="text-sm font-medium text-gray-800">{log.target_name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{log.user_name}</span>
                    <span>{new Date(log.created_at).toLocaleString('ja-JP')}</span>
                    {log.ip_address && <span className="text-gray-400">{log.ip_address}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 在庫管理画面
  const InventoryView = () => {
    const [activeTab, setActiveTab] = useState('stock');
    const [branches, setBranches] = useState([]);
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [stock, setStock] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    // フィルター
    const [selectedBranch, setSelectedBranch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedProduct, setSelectedProduct] = useState('');

    // 並び替え
    const [sortKey, setSortKey] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');

    // 入出庫モーダル
    const [showStockModal, setShowStockModal] = useState(false);
    const [stockModalType, setStockModalType] = useState('in');
    const [stockForm, setStockForm] = useState({ branchId: '', productId: '', quantity: '', note: '', alertThreshold: '' });

    // 移動モーダル
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferForm, setTransferForm] = useState({ fromBranchId: '', toBranchId: '', productId: '', quantity: '', note: '' });

    useEffect(() => {
      loadInventoryData();
    }, []);

    useEffect(() => {
      if (branches.length > 0 || categories.length > 0) {
        loadStock();
      }
    }, [selectedBranch, selectedCategory]);

    const loadInventoryData = async () => {
      setLoading(true);
      try {
        const [branchesData, categoriesData, productsData] = await Promise.all([
          api.getInventoryBranches(),
          api.getInventoryCategories(),
          api.getInventoryProducts()
        ]);
        setBranches(branchesData);
        setCategories(categoriesData);
        setProducts(productsData);
        await loadStock();
      } catch (e) {
        console.error('Failed to load inventory data:', e);
        alert('在庫データの読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };

    const loadStock = async () => {
      try {
        const params = {};
        if (selectedBranch) params.branch_id = selectedBranch;
        if (selectedCategory) params.category_id = selectedCategory;
        const stockData = await api.getInventoryStock(params);
        setStock(stockData);
      } catch (e) {
        console.error('Failed to load stock:', e);
      }
    };

    const loadTransactions = async () => {
      try {
        const params = { limit: 100 };
        if (selectedBranch) params.branch_id = selectedBranch;
        const data = await api.getInventoryTransactions(params);
        setTransactions(data);
      } catch (e) {
        console.error('Failed to load transactions:', e);
      }
    };

    useEffect(() => {
      if (activeTab === 'history') {
        loadTransactions();
      }
    }, [activeTab, selectedBranch]);

    const handleStockUpdate = async () => {
      if (!stockForm.branchId || !stockForm.productId || !stockForm.quantity) {
        alert('全ての項目を入力してください');
        return;
      }
      try {
        await api.updateInventoryStock({
          branchId: parseInt(stockForm.branchId),
          productId: parseInt(stockForm.productId),
          type: stockModalType,
          quantity: parseInt(stockForm.quantity),
          note: stockForm.note
        });
        // アラート閾値も更新
        if (stockForm.alertThreshold !== '') {
          await api.updateInventoryProduct(parseInt(stockForm.productId), {
            alertThreshold: parseInt(stockForm.alertThreshold)
          });
        }
        setShowStockModal(false);
        setStockForm({ branchId: '', productId: '', quantity: '', note: '', alertThreshold: '' });
        await loadStock();
        if (activeTab === 'history') await loadTransactions();
      } catch (e) {
        alert('エラー: ' + e.message);
      }
    };

    const handleTransfer = async () => {
      if (!transferForm.fromBranchId || !transferForm.toBranchId || !transferForm.productId || !transferForm.quantity) {
        alert('全ての項目を入力してください');
        return;
      }
      try {
        await api.transferInventory({
          fromBranchId: parseInt(transferForm.fromBranchId),
          toBranchId: parseInt(transferForm.toBranchId),
          productId: parseInt(transferForm.productId),
          quantity: parseInt(transferForm.quantity),
          note: transferForm.note
        });
        setShowTransferModal(false);
        setTransferForm({ fromBranchId: '', toBranchId: '', productId: '', quantity: '', note: '' });
        await loadStock();
        if (activeTab === 'history') await loadTransactions();
      } catch (e) {
        alert('エラー: ' + e.message);
      }
    };

    // 在庫を製品でグループ化
    // 商品フィルター（グループ化前）
    const stockForGrouping = selectedProduct
      ? stock.filter(item => item.product_id.toString() === selectedProduct)
      : stock;

    const groupedStock = stockForGrouping.reduce((acc, item) => {
      if (!acc[item.product_name]) {
        acc[item.product_name] = {
          product_id: item.product_id,
          unit: item.unit,
          min_stock: item.min_stock,
          category_name: item.category_name,
          branches: {}
        };
      }
      acc[item.product_name].branches[item.branch_id] = {
        branch_name: item.branch_name,
        quantity: item.quantity
      };
      return acc;
    }, {});

    // 並び替え関数
    const toggleSort = (key) => {
      if (sortKey === key) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setSortKey(key);
        setSortOrder('asc');
      }
    };

    // 商品フィルター適用
    const filteredStock = selectedProduct
      ? stock.filter(item => item.product_id.toString() === selectedProduct)
      : stock;

    // 並び替え適用
    const sortedStock = [...filteredStock].sort((a, b) => {
      let compare = 0;
      if (sortKey === 'name') {
        compare = a.product_name.localeCompare(b.product_name, 'ja');
      } else if (sortKey === 'quantity') {
        compare = a.quantity - b.quantity;
      } else if (sortKey === 'alert') {
        compare = (a.min_stock || 0) - (b.min_stock || 0);
      } else if (sortKey === 'category') {
        compare = (a.category_name || '').localeCompare(b.category_name || '', 'ja');
      }
      return sortOrder === 'asc' ? compare : -compare;
    });

    // クロス表示用の並び替え
    const sortedGroupedEntries = Object.entries(groupedStock).sort((a, b) => {
      let compare = 0;
      if (sortKey === 'name') {
        compare = a[0].localeCompare(b[0], 'ja');
      } else if (sortKey === 'total') {
        const totalA = Object.values(a[1].branches).reduce((sum, br) => sum + (br.quantity || 0), 0);
        const totalB = Object.values(b[1].branches).reduce((sum, br) => sum + (br.quantity || 0), 0);
        compare = totalA - totalB;
      } else if (sortKey === 'alert') {
        compare = (a[1].min_stock || 0) - (b[1].min_stock || 0);
      } else if (sortKey === 'category') {
        compare = (a[1].category_name || '').localeCompare(b[1].category_name || '', 'ja');
      }
      return sortOrder === 'asc' ? compare : -compare;
    });

    const getTypeColor = (type) => {
      switch (type) {
        case 'in': return 'bg-green-100 text-green-700';
        case 'out': return 'bg-red-100 text-red-700';
        case 'adjust': return 'bg-blue-100 text-blue-700';
        case 'transfer_in': return 'bg-purple-100 text-purple-700';
        case 'transfer_out': return 'bg-orange-100 text-orange-700';
        default: return 'bg-gray-100 text-gray-700';
      }
    };

    if (loading) {
      return (
        <div className="flex justify-center items-center py-12">
          <Icons.Loader />
          <span className="ml-2 text-gray-500">読み込み中...</span>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2D3436', margin: 0 }}>在庫管理</h2>
            <p style={{ fontSize: '13px', color: '#636E72', margin: '2px 0 0' }}>{branches.length}営業所 / {products.length}製品</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setStockModalType('in'); setShowStockModal(true); }}
              className="flex items-center gap-1 text-white px-3 py-2 text-sm" style={{ background: '#00B894', borderRadius: '10px', border: 'none' }}>
              <Icons.Plus /> 入庫
            </button>
            <button onClick={() => { setStockModalType('out'); setShowStockModal(true); }}
              className="flex items-center gap-1 text-white px-3 py-2 text-sm" style={{ background: '#E74C3C', borderRadius: '10px', border: 'none' }}>
              <Icons.Download /> 出庫
            </button>
            <button onClick={() => setShowTransferModal(true)}
              className="flex items-center gap-1 text-white px-3 py-2 text-sm" style={{ background: '#8E44AD', borderRadius: '10px', border: 'none' }}>
              <Icons.ChevronRight /> 移動
            </button>
          </div>
        </div>

        {/* タブ */}
        <div className="flex gap-1" style={{ borderBottom: '2px solid #E9ECEF' }}>
          {[
            { key: 'stock', label: '在庫一覧' },
            { key: 'history', label: '入出庫履歴' }
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 16px', fontSize: '13px', fontWeight: 600, background: 'none', border: 'none',
                color: activeTab === tab.key ? '#00B894' : '#B2BEC3',
                borderBottom: `2px solid ${activeTab === tab.key ? '#00B894' : 'transparent'}`,
                marginBottom: '-2px'
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* フィルター */}
        <div className="flex gap-3 flex-wrap">
          <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">全営業所</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">全資材</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">全商品</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {activeTab === 'stock' && (
          <div className="bg-white border border-gray-200 rounded-xl">
            {selectedBranch ? (
              // 単一営業所表示
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('name')}>
                        製品名 {sortKey === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('quantity')}>
                        在庫数 {sortKey === 'quantity' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('alert')}>
                        アラート {sortKey === 'alert' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">単位</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStock.map(item => (
                      <tr key={`${item.branch_id}-${item.product_id}`}
                        onClick={() => {
                          setStockForm({ branchId: item.branch_id.toString(), productId: item.product_id.toString(), quantity: '', note: '', alertThreshold: (item.min_stock || 0).toString() });
                          setStockModalType('adjust');
                          setShowStockModal(true);
                        }}
                        className="border-b hover:bg-blue-50 cursor-pointer">
                        <td className="px-4 py-3 font-medium">{item.product_name}</td>
                        <td className={`px-4 py-3 text-center font-bold ${item.quantity <= item.min_stock && item.min_stock > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                          {item.quantity}
                          {item.quantity <= item.min_stock && item.min_stock > 0 && (
                            <span className="ml-1 text-xs bg-red-100 text-red-600 px-1 rounded">不足</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500">{item.min_stock || 0}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              // 全営業所クロス表示
              <div className="overflow-x-auto overflow-y-auto relative" style={{maxHeight: '70vh'}}>
                <table className="w-full text-sm table-fixed">
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-2 py-3 font-medium text-gray-600 w-24 cursor-pointer hover:bg-gray-100 sticky left-0 z-30 bg-gray-50" style={{boxShadow: '2px 0 4px rgba(0,0,0,0.06)'}} onClick={() => toggleSort('name')}>
                        製品名 {sortKey === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th className="text-center px-1 py-3 font-medium text-blue-600 bg-blue-50 w-12">倉庫</th>
                      {branches.filter(b => b.code !== 'WAREHOUSE' && b.name !== '倉庫').map(b => (
                        <th key={b.id} className="text-center px-1 py-3 font-medium text-gray-600 bg-gray-50 w-12">{b.name.replace('営業', '').replace('所', '')}</th>
                      ))}
                      <th className="text-center px-2 py-3 font-medium text-gray-600 bg-green-50 w-14 cursor-pointer hover:bg-green-100" onClick={() => toggleSort('total')}>
                        合計 {sortKey === 'total' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th className="text-center px-2 py-3 font-medium text-gray-600 bg-gray-50 w-14 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('alert')}>
                        閾値 {sortKey === 'alert' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedGroupedEntries.map(([productName, productData]) => {
                      const total = Object.values(productData.branches).reduce((sum, b) => sum + (b.quantity || 0), 0);
                      const isLow = total <= (productData.min_stock || 0) && (productData.min_stock || 0) > 0;
                      return (
                        <tr key={productData.product_id} className={`border-b hover:bg-gray-50 ${isLow ? 'bg-red-50' : ''}`}>
                          <td className={`px-2 py-1 font-medium text-xs sticky left-0 z-10 ${isLow ? 'bg-red-50' : 'bg-white'}`} style={{boxShadow: '2px 0 4px rgba(0,0,0,0.06)', maxWidth: '96px', wordBreak: 'break-all'}} title={productName}>
                            <div style={{display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>{productName}</div>
                          </td>
                          {/* 倉庫列 */}
                          {(() => {
                            const warehouseBranch = branches.find(b => b.code === 'WAREHOUSE' || b.name === '倉庫');
                            const warehouseQty = warehouseBranch ? (productData.branches[warehouseBranch.id]?.quantity || 0) : 0;
                            return (
                              <td
                                onClick={() => {
                                  if (warehouseBranch) {
                                    setStockForm({ branchId: warehouseBranch.id.toString(), productId: productData.product_id.toString(), quantity: '', note: '', alertThreshold: (productData.min_stock || 0).toString() });
                                    setStockModalType('adjust');
                                    setShowStockModal(true);
                                  }
                                }}
                                className={`px-1 py-2 text-center bg-blue-50 cursor-pointer hover:bg-blue-100 ${warehouseQty === 0 ? 'text-gray-300' : 'text-blue-700 font-medium'}`}>
                                {warehouseQty}
                              </td>
                            );
                          })()}
                          {branches.filter(b => b.code !== 'WAREHOUSE' && b.name !== '倉庫').map(b => {
                            const qty = productData.branches[b.id]?.quantity || 0;
                            return (
                              <td key={b.id}
                                onClick={() => {
                                  setStockForm({ branchId: b.id.toString(), productId: productData.product_id.toString(), quantity: '', note: '', alertThreshold: (productData.min_stock || 0).toString() });
                                  setStockModalType('adjust');
                                  setShowStockModal(true);
                                }}
                                className={`px-1 py-2 text-center cursor-pointer hover:bg-blue-50 ${qty === 0 ? 'text-gray-300' : 'text-gray-800'}`}>
                                {qty}
                              </td>
                            );
                          })}
                          <td className={`px-2 py-2 text-center font-bold bg-green-50 ${isLow ? 'text-red-600' : 'text-green-700'}`}>{total}</td>
                          <td className="px-2 py-2 text-center text-gray-500 text-xs">{productData.min_stock || 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">履歴がありません</div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {transactions.map(t => (
                  <div key={t.id} className="p-3 hover:bg-gray-50">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(t.transaction_type)}`}>
                        {t.typeLabel}
                      </span>
                      <span className="text-sm font-medium text-gray-800">{t.product_name}</span>
                      <span className="text-sm text-gray-500">x {t.quantity}{t.unit}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{t.branch_name}</span>
                      {t.related_branch_name && <span>→ {t.related_branch_name}</span>}
                      <span>{t.quantity_before} → {t.quantity_after}</span>
                      <span>{t.user_name}</span>
                      <span>{new Date(t.created_at).toLocaleString('ja-JP')}</span>
                    </div>
                    {t.note && <div className="text-xs text-gray-400 mt-1">{t.note}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 入出庫モーダル */}
        {showStockModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowStockModal(false)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg mb-4">
                {stockModalType === 'in' ? '入庫登録' : stockModalType === 'out' ? '出庫登録' : '在庫調整'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">営業所</label>
                  <select value={stockForm.branchId} onChange={(e) => setStockForm({ ...stockForm, branchId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2">
                    <option value="">選択してください</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">製品</label>
                  <select value={stockForm.productId} onChange={(e) => setStockForm({ ...stockForm, productId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2">
                    <option value="">選択してください</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {stockForm.branchId && stockForm.productId && (() => {
                  const currentItem = stock.find(s => s.branch_id.toString() === stockForm.branchId && s.product_id.toString() === stockForm.productId);
                  const currentQty = currentItem ? currentItem.quantity : 0;
                  const branchName = branches.find(b => b.id.toString() === stockForm.branchId)?.name || '';
                  const productName = products.find(p => p.id.toString() === stockForm.productId)?.name || '';
                  return (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="text-xs text-blue-600 font-medium mb-1">現在の在庫</div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-blue-700">{branchName} - {productName}</span>
                        <span className="text-lg font-bold text-blue-800">{currentQty}</span>
                      </div>
                    </div>
                  );
                })()}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">数量</label>
                  <input type="number" min="1" value={stockForm.quantity}
                    onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="数量を入力" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                  <input type="text" value={stockForm.note}
                    onChange={(e) => setStockForm({ ...stockForm, note: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="任意" />
                </div>
                <div className="border-t pt-4 mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">アラート閾値（この数以下で不足表示）</label>
                  <input type="number" min="0" value={stockForm.alertThreshold}
                    onChange={(e) => setStockForm({ ...stockForm, alertThreshold: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="0" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowStockModal(false)} className="flex-1 bg-gray-100 py-2 rounded-lg">キャンセル</button>
                <button onClick={handleStockUpdate}
                  className={`flex-1 text-white py-2 rounded-lg ${stockModalType === 'in' ? 'bg-green-500' : stockModalType === 'out' ? 'bg-red-500' : 'bg-blue-500'}`}>
                  {stockModalType === 'in' ? '入庫する' : stockModalType === 'out' ? '出庫する' : '調整する'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 移動モーダル */}
        {showTransferModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowTransferModal(false)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg mb-4">在庫移動</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">移動元</label>
                  <select value={transferForm.fromBranchId} onChange={(e) => setTransferForm({ ...transferForm, fromBranchId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2">
                    <option value="">選択してください</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">移動先</label>
                  <select value={transferForm.toBranchId} onChange={(e) => setTransferForm({ ...transferForm, toBranchId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2">
                    <option value="">選択してください</option>
                    {branches.filter(b => b.id !== parseInt(transferForm.fromBranchId)).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">製品</label>
                  <select value={transferForm.productId} onChange={(e) => setTransferForm({ ...transferForm, productId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2">
                    <option value="">選択してください</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {transferForm.productId && (transferForm.fromBranchId || transferForm.toBranchId) && (() => {
                  const fromItem = transferForm.fromBranchId ? stock.find(s => s.branch_id.toString() === transferForm.fromBranchId && s.product_id.toString() === transferForm.productId) : null;
                  const toItem = transferForm.toBranchId ? stock.find(s => s.branch_id.toString() === transferForm.toBranchId && s.product_id.toString() === transferForm.productId) : null;
                  const fromQty = fromItem ? fromItem.quantity : 0;
                  const toQty = toItem ? toItem.quantity : 0;
                  const fromName = branches.find(b => b.id.toString() === transferForm.fromBranchId)?.name || '';
                  const toName = branches.find(b => b.id.toString() === transferForm.toBranchId)?.name || '';
                  return (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <div className="text-xs text-purple-600 font-medium mb-2">現在の在庫</div>
                      <div className="flex items-center justify-between gap-2">
                        {transferForm.fromBranchId && (
                          <div className="flex-1 bg-white rounded px-3 py-2 text-center border border-purple-100">
                            <div className="text-xs text-gray-500">{fromName}</div>
                            <div className="text-lg font-bold text-purple-800">{fromQty}</div>
                          </div>
                        )}
                        <div className="text-purple-400 text-lg">→</div>
                        {transferForm.toBranchId && (
                          <div className="flex-1 bg-white rounded px-3 py-2 text-center border border-purple-100">
                            <div className="text-xs text-gray-500">{toName}</div>
                            <div className="text-lg font-bold text-purple-800">{toQty}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">数量</label>
                  <input type="number" min="1" value={transferForm.quantity}
                    onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="数量を入力" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                  <input type="text" value={transferForm.note}
                    onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="任意" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowTransferModal(false)} className="flex-1 bg-gray-100 py-2 rounded-lg">キャンセル</button>
                <button onClick={handleTransfer} className="flex-1 bg-purple-500 text-white py-2 rounded-lg">移動する</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // モーダル
  const Modal = () => {
    const [formData, setFormData] = useState(editingItem || {});
    const [newSites, setNewSites] = useState([{ name: '', address: '', keybox: '', keyboxLocation: '' }]);
    const [saving, setSaving] = useState(false);
    const [yearlyPlanData, setYearlyPlanData] = useState(selectedSite?.yearlyPlan || {});

    const handleSave = async () => {
      setSaving(true);
      try {
        if (modalType === 'corp') {
          if (editingItem) {
            await api.updateCorp(editingItem.id, formData);
          } else {
            await api.createCorp({ ...formData, sites: newSites.filter(s => s.name) });
          }
        } else if (modalType === 'site') {
          if (editingItem) {
            await api.updateSite(editingItem.id, formData);
          } else {
            await api.createSite({ ...formData, corporationId: selectedCorp.id });
          }
        } else if (modalType === 'workLog') {
          await api.createWorkLog({ ...formData, siteId: selectedSite.id });
        } else if (modalType === 'contactLog') {
          await api.createContactLog({ ...formData, corporationId: selectedCorp.id });
        } else if (modalType === 'photo') {
          await api.createPhoto({ ...formData, siteId: selectedSite.id });
        } else if (modalType === 'yearlyPlan') {
          await api.updateYearlyPlan(selectedSite.id, yearlyPlanData);
        }
        
        await loadData();
        setShowModal(false);
      } catch (e) {
        console.error(e);
        alert('保存に失敗しました: ' + e.message);
      } finally {
        setSaving(false);
      }
    };

    const toggleMonth = (month) => {
      const current = yearlyPlanData[month] || {};
      if (current.scheduled) {
        const newData = { ...yearlyPlanData };
        delete newData[month];
        setYearlyPlanData(newData);
      } else {
        setYearlyPlanData({
          ...yearlyPlanData,
          [month]: { scheduled: true, date: 15, workType: masterData.workTypes?.[0] || '薬剤散布' }
        });
      }
    };

    const updateMonthPlan = (month, field, value) => {
      setYearlyPlanData({
        ...yearlyPlanData,
        [month]: { ...yearlyPlanData[month], [field]: value }
      });
    };

    // 一括チェック：全選択
    const selectAllMonths = () => {
      const newData = {};
      months.forEach(m => {
        newData[m] = yearlyPlanData[m] || {
          scheduled: true,
          date: 15,
          workType: masterData.workTypes?.[0] || '薬剤散布'
        };
        newData[m].scheduled = true;
      });
      setYearlyPlanData(newData);
    };

    // 一括チェック：全解除
    const clearAllMonths = () => {
      setYearlyPlanData({});
    };

    // 一括日付設定
    const setAllDates = (date) => {
      const newData = { ...yearlyPlanData };
      Object.keys(newData).forEach(month => {
        if (newData[month]?.scheduled) {
          newData[month] = { ...newData[month], date: parseInt(date) };
        }
      });
      setYearlyPlanData(newData);
    };

    // 一括作業項目設定
    const setAllWorkTypes = (workType) => {
      const newData = { ...yearlyPlanData };
      Object.keys(newData).forEach(month => {
        if (newData[month]?.scheduled) {
          newData[month] = { ...newData[month], workType };
        }
      });
      setYearlyPlanData(newData);
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
        <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">
              {modalType === 'corp' && (editingItem ? '法人編集' : '法人追加')}
              {modalType === 'site' && (editingItem ? '現場編集' : '現場追加')}
              {modalType === 'workLog' && '作業報告'}
              {modalType === 'contactLog' && '連絡履歴'}
              {modalType === 'photo' && '写真追加'}
              {modalType === 'yearlyPlan' && '年間計画編集'}
            </h3>
            <button type="button" onClick={() => setShowModal(false)} className="text-gray-400"><Icons.X /></button>
          </div>

          {modalType === 'corp' && (
            <form id="corp-form" onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target;
              const selectedMonths = [];
              form.querySelectorAll('input[name="billing-month"]:checked').forEach(cb => selectedMonths.push(cb.value));
              const data = {
                name: form['corp-name'].value,
                address: form['corp-address'].value,
                contact: form['corp-contact'].value,
                contactPerson: form['corp-contactPerson'].value,
                memo: form['corp-memo'].value,
                billingCycle: form['corp-billingCycle'].value,
                billingDay: form['corp-billingDay'].value,
                billingMonth: selectedMonths.join('・')
              };
              if (!data.name) { alert('法人名は必須です'); return; }
              setSaving(true);
              try {
                if (editingItem) {
                  await api.updateCorp(editingItem.id, data);
                } else {
                  const newCorp = await api.createCorp(data);
                  for (const site of newSites.filter(s => s.name)) {
                    await api.createSite({ ...site, corporationId: newCorp.id });
                  }
                }
                await loadData();
                setShowModal(false);
              } catch (err) {
                alert('保存に失敗しました: ' + err.message);
              } finally {
                setSaving(false);
              }
            }} className="space-y-4">
              <input type="text" name="corp-name" placeholder="法人名 *" defaultValue={editingItem?.name || ''} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              <input type="text" name="corp-address" placeholder="住所" defaultValue={editingItem?.address || ''} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input type="text" name="corp-contact" placeholder="電話番号" defaultValue={editingItem?.contact || ''} className="border border-gray-300 rounded-lg px-3 py-2" />
                <input type="text" name="corp-contactPerson" placeholder="担当者名" defaultValue={editingItem?.contactPerson || ''} className="border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <textarea name="corp-memo" placeholder="メモ" defaultValue={editingItem?.memo || ''} className="w-full border border-gray-300 rounded-lg px-3 py-2 h-20" />
              <div className="border-t pt-4">
                <p className="font-medium text-gray-700 mb-2">請求情報</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                  <select name="corp-billingCycle" defaultValue={editingItem?.billingCycle || '毎月'} className="border border-gray-300 rounded-lg px-3 py-2">
                    <option value="作業月">作業月</option>
                    <option value="毎月">毎月</option>
                    <option value="半年">半年</option>
                    <option value="年間">年間</option>
                  </select>
                  <input type="text" name="corp-billingDay" placeholder="請求日（例: 25）" defaultValue={editingItem?.billingDay || ''} className="border border-gray-300 rounded-lg px-3 py-2" />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">請求月（複数選択可）</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { document.querySelectorAll('input[name="billing-month"]').forEach(cb => cb.checked = true); }} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">全選択</button>
                    <button type="button" onClick={() => { document.querySelectorAll('input[name="billing-month"]').forEach(cb => cb.checked = false); }} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">全解除</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
                    const isChecked = editingItem?.billingMonth?.includes(m + '月');
                    return (
                      <label key={m} className="flex items-center gap-1 px-2 py-1 border border-gray-300 rounded cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" name="billing-month" value={m + '月'} defaultChecked={isChecked} className="w-4 h-4" />
                        <span className="text-sm">{m}月</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              {!editingItem && (
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-medium text-gray-700">現場情報</p>
                    <button type="button" onClick={() => setNewSites([...newSites, { name: '', address: '', keybox: '', keyboxLocation: '' }])}
                      className="text-sm px-2 py-1 rounded text-white" style={{ background: '#00B894' }}><Icons.Plus /> 追加</button>
                  </div>
                  {newSites.map((site, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-3 mb-2">
                      <input type="text" placeholder="現場名" defaultValue={site.name} onChange={e => { const updated = [...newSites]; updated[i].name = e.target.value; setNewSites(updated); }} className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-2" />
                      <div className="flex gap-2">
                        <input type="text" placeholder="住所" defaultValue={site.address} onChange={e => { const updated = [...newSites]; updated[i].address = e.target.value; setNewSites(updated); }} className="flex-1 border border-gray-300 rounded-lg px-3 py-2" />
                        <button type="button" onClick={() => { const form = document.getElementById('corp-form'); const addr = form['corp-address'].value; const updated = [...newSites]; updated[i].address = addr; setNewSites(updated); }} className="text-xs px-2 border border-gray-300 rounded text-gray-500">コピー</button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <input type="text" placeholder="キーボックス" defaultValue={site.keybox} onChange={e => { const updated = [...newSites]; updated[i].keybox = e.target.value; setNewSites(updated); }} className="border border-gray-300 rounded-lg px-3 py-2" />
                        <input type="text" placeholder="場所" defaultValue={site.keyboxLocation} onChange={e => { const updated = [...newSites]; updated[i].keyboxLocation = e.target.value; setNewSites(updated); }} className="border border-gray-300 rounded-lg px-3 py-2" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 py-2 rounded-lg" disabled={saving}>キャンセル</button>
                <button type="submit" className="flex-1 text-white py-2 rounded-lg flex items-center justify-center" style={{ background: '#00B894' }} disabled={saving}>
                  {saving ? <Icons.Loader /> : '保存'}
                </button>
              </div>
            </form>
          )}

          {modalType === 'site' && (
            <form id="site-form" onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target;
              const selectedBillingMonths = [];
              if (userRole === 'admin') {
                form.querySelectorAll('input[name="site-billing-month"]:checked').forEach(cb => selectedBillingMonths.push(parseInt(cb.value)));
              }
              const data = {
                name: form['site-name'].value,
                address: form['site-address'].value,
                keybox: form['site-keybox'].value,
                keyboxLocation: form['site-keyboxLocation'].value,
                pests: formData.pests || [],
                workTypes: formData.workTypes || [],
                workAreas: formData.workAreas || [],
                memo: form['site-memo'].value,
                billingMonths: userRole === 'admin' ? selectedBillingMonths : (editingItem?.billingMonths || []),
                corporationId: selectedCorp?.id
              };
              if (!data.name) { alert('現場名は必須です'); return; }
              setSaving(true);
              try {
                if (editingItem) {
                  await api.updateSite(editingItem.id, data);
                } else {
                  await api.createSite(data);
                }
                await loadData();
                setShowModal(false);
              } catch (err) {
                alert('保存に失敗しました: ' + err.message);
              } finally {
                setSaving(false);
              }
            }} className="space-y-4">
              <input type="text" name="site-name" placeholder="現場名 *" defaultValue={editingItem?.name || ''} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              <div className="flex gap-2">
                <input type="text" name="site-address" placeholder="住所" defaultValue={editingItem?.address || ''} className="flex-1 border border-gray-300 rounded-lg px-3 py-2" />
                <button type="button" onClick={() => { document.querySelector('[name="site-address"]').value = selectedCorp?.address || ''; }} className="text-xs px-2 border border-gray-300 rounded text-gray-500">コピー</button>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(91, 189, 86, 0.1)' }}>
                <p className="text-sm font-medium mb-2" style={{ color: '#00B894' }}>キーボックス</p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" name="site-keybox" placeholder="暗証番号" defaultValue={editingItem?.keybox || ''} className="border border-gray-300 rounded-lg px-3 py-2" />
                  <input type="text" name="site-keyboxLocation" placeholder="場所" defaultValue={editingItem?.keyboxLocation || ''} className="border border-gray-300 rounded-lg px-3 py-2" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">対象害虫</p>
                <div className="flex flex-wrap gap-2">
                  {(masterData.pestTypes || []).map(p => (
                    <button type="button" key={p} onClick={() => setFormData({ ...formData, pests: (formData.pests || []).includes(p) ? formData.pests.filter(x => x !== p) : [...(formData.pests || []), p] })}
                      className={`text-sm px-2 py-1 rounded border ${(formData.pests || []).includes(p) ? 'bg-red-100 border-red-300 text-red-600' : 'border-gray-200 text-gray-500'}`}>{p}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">作業内容</p>
                <div className="flex flex-wrap gap-2">
                  {(masterData.workTypes || []).map(w => (
                    <button type="button" key={w} onClick={() => setFormData({ ...formData, workTypes: (formData.workTypes || []).includes(w) ? formData.workTypes.filter(x => x !== w) : [...(formData.workTypes || []), w] })}
                      className={`text-sm px-2 py-1 rounded border ${(formData.workTypes || []).includes(w) ? 'bg-blue-100 border-blue-300 text-blue-600' : 'border-gray-200 text-gray-500'}`}>{w}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">作業箇所</p>
                <div className="flex flex-wrap gap-2">
                  {(masterData.workAreas || []).map(a => (
                    <button type="button" key={a} onClick={() => setFormData({ ...formData, workAreas: (formData.workAreas || []).includes(a) ? formData.workAreas.filter(x => x !== a) : [...(formData.workAreas || []), a] })}
                      className={`text-sm px-2 py-1 rounded border ${(formData.workAreas || []).includes(a) ? 'bg-purple-100 border-purple-300 text-purple-600' : 'border-gray-200 text-gray-500'}`}>{a}</button>
                  ))}
                </div>
              </div>
              <textarea name="site-memo" placeholder="メモ・注意事項" defaultValue={editingItem?.memo || ''} className="w-full border border-gray-300 rounded-lg px-3 py-2 h-20" />
              {userRole === 'admin' && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-600">請求月（複数選択可）</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { document.querySelectorAll('input[name="site-billing-month"]').forEach(cb => cb.checked = true); }} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">全選択</button>
                      <button type="button" onClick={() => { document.querySelectorAll('input[name="site-billing-month"]').forEach(cb => cb.checked = false); }} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">全解除</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
                      const isChecked = editingItem?.billingMonths?.includes(m);
                      return (
                        <label key={m} className="flex items-center gap-1 px-2 py-1 border border-gray-300 rounded cursor-pointer hover:bg-gray-50">
                          <input type="checkbox" name="site-billing-month" value={m} defaultChecked={isChecked} className="w-4 h-4" />
                          <span className="text-sm">{m}月</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">※未選択の場合は法人の請求月が適用されます</p>
                </div>
              )}
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 py-2 rounded-lg" disabled={saving}>キャンセル</button>
                <button type="submit" className="flex-1 text-white py-2 rounded-lg flex items-center justify-center" style={{ background: '#00B894' }} disabled={saving}>
                  {saving ? <Icons.Loader /> : '保存'}
                </button>
              </div>
            </form>
          )}

          {modalType === 'workLog' && (
            <div className="space-y-4">
              <div><label className="block text-sm text-gray-600 mb-1">施工日</label><input type="date" value={formData.date || new Date().toISOString().split('T')[0]} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
              <div><label className="block text-sm text-gray-600 mb-1">作業内容</label><select value={formData.workType || ''} onChange={e => setFormData({ ...formData, workType: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">選択してください</option>
                {(masterData.workTypes || []).map(w => <option key={w} value={w}>{w}</option>)}
              </select></div>
              <div><label className="block text-sm text-gray-600 mb-1">現場状況</label><select value={formData.condition || ''} onChange={e => setFormData({ ...formData, condition: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">選択してください</option>
                <option value="良好">良好</option><option value="要注意">要注意</option><option value="問題あり">問題あり</option>
              </select></div>
              <div><label className="block text-sm text-gray-600 mb-1">使用薬剤</label><input type="text" value={formData.usedChemical || ''} onChange={e => setFormData({ ...formData, usedChemical: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
              <div><label className="block text-sm text-gray-600 mb-1">備考</label><textarea value={formData.note || ''} onChange={e => setFormData({ ...formData, note: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 h-20" /></div>
              <div><label className="block text-sm text-gray-600 mb-1">次回への申送り</label><textarea value={formData.nextNote || ''} onChange={e => setFormData({ ...formData, nextNote: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 h-16" /></div>
            </div>
          )}

          {modalType === 'contactLog' && (
            <div className="space-y-4">
              {(selectedCorp?.contactLogs || []).length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-2 mb-4 pb-4 border-b">
                  {selectedCorp.contactLogs.map(log => (
                    <div key={log.id} className="bg-gray-50 p-2 rounded text-sm">
                      <div className="flex justify-between"><span className="font-medium">{log.date}</span><span className={`text-xs px-1 rounded ${log.type === 'クレーム' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{log.type}</span></div>
                      <p className="text-gray-600">{log.content}</p>
                      <p className="text-gray-400 text-xs">{log.staff}</p>
                    </div>
                  ))}
                </div>
              )}
              <p className="font-medium text-gray-700">新規連絡を追加</p>
              <div><label className="block text-sm text-gray-600 mb-1">日付</label><input type="date" value={formData.date || new Date().toISOString().split('T')[0]} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
              <div><label className="block text-sm text-gray-600 mb-1">種別</label><select value={formData.type || '電話'} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="電話">電話</option><option value="メール">メール</option><option value="訪問">訪問</option><option value="クレーム">クレーム</option><option value="その他">その他</option>
              </select></div>
              <div><label className="block text-sm text-gray-600 mb-1">内容</label><textarea placeholder="内容を入力" value={formData.content || ''} onChange={e => setFormData({ ...formData, content: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 h-24" /></div>
            </div>
          )}

          {modalType === 'photo' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">写真をアップロードしてください（最大10枚、自動圧縮）</p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <input type="file" accept="image/*" multiple={true} id="photo-upload" className="hidden" onChange={async (e) => {
                  const files = Array.from(e.target.files).slice(0, 10); // 最大10枚
                  if (files.length === 0) return;

                  // 画像を圧縮
                  const compressImage = (file, maxWidth = 1200, quality = 0.7) => {
                    return new Promise((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        const img = new Image();
                        img.onload = () => {
                          const canvas = document.createElement('canvas');
                          let width = img.width;
                          let height = img.height;

                          if (width > maxWidth) {
                            height = (height * maxWidth) / width;
                            width = maxWidth;
                          }

                          canvas.width = width;
                          canvas.height = height;
                          const ctx = canvas.getContext('2d');
                          ctx.drawImage(img, 0, 0, width, height);
                          resolve(canvas.toDataURL('image/jpeg', quality));
                        };
                        img.onerror = reject;
                        img.src = e.target.result;
                      };
                      reader.onerror = reject;
                      reader.readAsDataURL(file);
                    });
                  };

                  try {
                    // 全ファイルを並列圧縮
                    const compressPromises = files.map(file => compressImage(file));
                    const compressed = await Promise.all(compressPromises);
                    const photos = compressed.map((data, i) => ({
                      imageData: data,
                      fileName: files[i].name,
                      size: Math.round(data.length / 1024)
                    }));
                    setFormData({ ...formData, selectedPhotos: photos });
                  } catch (err) {
                    alert('画像の処理に失敗しました: ' + err.message);
                  }
                }} />
                <label htmlFor="photo-upload" className="cursor-pointer block">
                  <div className="flex justify-center mb-2"><Icons.Camera /></div>
                  <p className="text-gray-600">タップして写真を撮影・選択</p>
                  <p className="text-xs text-gray-400">JPG, PNG対応（最大10枚）</p>
                </label>
              </div>
              {/* 複数写真プレビュー */}
              {formData.selectedPhotos && formData.selectedPhotos.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">{formData.selectedPhotos.length}/10枚選択中</p>
                  <div className="grid grid-cols-3 gap-2">
                    {formData.selectedPhotos.map((photo, i) => (
                      <div key={i} className="relative aspect-square">
                        <img src={photo.imageData} alt="" className="w-full h-full object-cover rounded-lg" />
                        <button type="button" onClick={() => {
                          const newPhotos = formData.selectedPhotos.filter((_, idx) => idx !== i);
                          setFormData({ ...formData, selectedPhotos: newPhotos });
                        }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">×</button>
                        <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1 rounded">{photo.size}KB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <input type="date" name="photo-date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full border border-gray-300 rounded-lg px-3 py-2" style={{ backgroundColor: '#ffffff', WebkitAppearance: 'none' }} />
              <input type="text" name="photo-note" placeholder="メモ（任意・全写真共通）" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => { setShowModal(false); setFormData({ ...formData, selectedPhotos: [] }); }} className="flex-1 bg-gray-100 py-2 rounded-lg">キャンセル</button>
                <button type="button" onClick={async () => {
                  const photos = formData.selectedPhotos || [];
                  if (photos.length === 0) { alert('写真を選択してください'); return; }
                  setSaving(true);
                  try {
                    const photoDate = document.querySelector('[name="photo-date"]').value;
                    const photoNote = document.querySelector('[name="photo-note"]').value;
                    // 順次アップロード
                    for (const photo of photos) {
                      await api.createPhoto({
                        siteId: selectedSite.id,
                        imageData: photo.imageData,
                        date: photoDate,
                        note: photoNote
                      });
                    }
                    await loadData();
                    setShowModal(false);
                    setFormData({ ...formData, selectedPhotos: [] });
                  } catch (err) {
                    alert('保存に失敗しました: ' + err.message);
                  } finally {
                    setSaving(false);
                  }
                }} className="flex-1 text-white py-2 rounded-lg flex items-center justify-center" style={{ background: '#00B894' }} disabled={saving}>
                  {saving ? <Icons.Loader className="animate-spin" /> : `アップロード${formData.selectedPhotos?.length > 0 ? ` (${formData.selectedPhotos.length}枚)` : ''}`}
                </button>
              </div>
            </div>
          )}

          {modalType === 'yearlyPlan' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-2">{selectedSite?.name} の年間施工計画</p>

              {/* 一括操作パネル */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">一括操作</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllMonths}
                      className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                    >
                      全選択
                    </button>
                    <button
                      type="button"
                      onClick={clearAllMonths}
                      className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                    >
                      全解除
                    </button>
                  </div>
                </div>

                {/* 一括日付・作業項目設定 */}
                <div className="flex gap-2 items-center flex-wrap">
                  <span className="text-xs text-gray-500">選択月に一括適用:</span>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="固定日"
                    className="w-16 border border-gray-300 rounded px-2 py-1 text-sm"
                    onChange={e => e.target.value && setAllDates(e.target.value)}
                  />
                  <select
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                    onChange={e => {
                      if (e.target.value) {
                        const newData = { ...yearlyPlanData };
                        Object.keys(newData).forEach(month => {
                          if (newData[month]?.scheduled) {
                            newData[month] = { ...newData[month], dateType: 'relative', datePattern: e.target.value, date: null };
                          }
                        });
                        setYearlyPlanData(newData);
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>相対日付</option>
                    <optgroup label="日曜日">
                      <option value="first_sun">第1日曜</option>
                      <option value="second_sun">第2日曜</option>
                      <option value="third_sun">第3日曜</option>
                      <option value="fourth_sun">第4日曜</option>
                      <option value="last_sun">最終日曜</option>
                    </optgroup>
                    <optgroup label="月曜日">
                      <option value="first_mon">第1月曜</option>
                      <option value="second_mon">第2月曜</option>
                      <option value="third_mon">第3月曜</option>
                      <option value="fourth_mon">第4月曜</option>
                      <option value="last_mon">最終月曜</option>
                    </optgroup>
                    <optgroup label="火曜日">
                      <option value="first_tue">第1火曜</option>
                      <option value="second_tue">第2火曜</option>
                      <option value="third_tue">第3火曜</option>
                      <option value="fourth_tue">第4火曜</option>
                      <option value="last_tue">最終火曜</option>
                    </optgroup>
                    <optgroup label="水曜日">
                      <option value="first_wed">第1水曜</option>
                      <option value="second_wed">第2水曜</option>
                      <option value="third_wed">第3水曜</option>
                      <option value="fourth_wed">第4水曜</option>
                      <option value="last_wed">最終水曜</option>
                    </optgroup>
                    <optgroup label="木曜日">
                      <option value="first_thu">第1木曜</option>
                      <option value="second_thu">第2木曜</option>
                      <option value="third_thu">第3木曜</option>
                      <option value="fourth_thu">第4木曜</option>
                      <option value="last_thu">最終木曜</option>
                    </optgroup>
                    <optgroup label="金曜日">
                      <option value="first_fri">第1金曜</option>
                      <option value="second_fri">第2金曜</option>
                      <option value="third_fri">第3金曜</option>
                      <option value="fourth_fri">第4金曜</option>
                      <option value="last_fri">最終金曜</option>
                    </optgroup>
                    <optgroup label="土曜日">
                      <option value="first_sat">第1土曜</option>
                      <option value="second_sat">第2土曜</option>
                      <option value="third_sat">第3土曜</option>
                      <option value="fourth_sat">第4土曜</option>
                      <option value="last_sat">最終土曜</option>
                    </optgroup>
                  </select>
                  <select
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                    onChange={e => e.target.value && setAllWorkTypes(e.target.value)}
                    defaultValue=""
                  >
                    <option value="" disabled>作業項目</option>
                    {(masterData.workTypes || []).map(w => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {months.map(m => {
                  const plan = yearlyPlanData[m];
                  const isActive = plan?.scheduled;
                  const isRelative = plan?.dateType === 'relative';
                  const patternLabels = {
                    'first_sun': '第1日曜', 'second_sun': '第2日曜', 'third_sun': '第3日曜', 'fourth_sun': '第4日曜', 'last_sun': '最終日曜',
                    'first_mon': '第1月曜', 'second_mon': '第2月曜', 'third_mon': '第3月曜', 'fourth_mon': '第4月曜', 'last_mon': '最終月曜',
                    'first_tue': '第1火曜', 'second_tue': '第2火曜', 'third_tue': '第3火曜', 'fourth_tue': '第4火曜', 'last_tue': '最終火曜',
                    'first_wed': '第1水曜', 'second_wed': '第2水曜', 'third_wed': '第3水曜', 'fourth_wed': '第4水曜', 'last_wed': '最終水曜',
                    'first_thu': '第1木曜', 'second_thu': '第2木曜', 'third_thu': '第3木曜', 'fourth_thu': '第4木曜', 'last_thu': '最終木曜',
                    'first_fri': '第1金曜', 'second_fri': '第2金曜', 'third_fri': '第3金曜', 'fourth_fri': '第4金曜', 'last_fri': '最終金曜',
                    'first_sat': '第1土曜', 'second_sat': '第2土曜', 'third_sat': '第3土曜', 'fourth_sat': '第4土曜', 'last_sat': '最終土曜'
                  };
                  return (
                    <div key={m} className={`p-2 rounded-lg border-2 ${isActive ? (isRelative ? 'border-blue-400 bg-blue-50' : 'border-green-400 bg-green-50') : 'border-gray-200 bg-gray-50'}`}>
                      <label className="flex items-center gap-2 cursor-pointer mb-2">
                        <input type="checkbox" checked={isActive || false} onChange={() => toggleMonth(m)} className="w-4 h-4" />
                        <span className="font-medium">{m}月</span>
                      </label>
                      {isActive && (
                        <div className="space-y-1">
                          {/* タブ切り替え */}
                          <div className="flex rounded overflow-hidden border border-gray-300 mb-1">
                            <button type="button" onClick={() => updateMonthPlan(m, 'dateType', 'absolute')}
                              className={`flex-1 py-1 text-xs ${!isRelative ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'}`}>固定</button>
                            <button type="button" onClick={() => updateMonthPlan(m, 'dateType', 'relative')}
                              className={`flex-1 py-1 text-xs ${isRelative ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}>相対</button>
                          </div>
                          {isRelative ? (
                            <select value={plan?.datePattern || ''} onChange={e => updateMonthPlan(m, 'datePattern', e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs">
                              <option value="">選択</option>
                              <optgroup label="日曜">
                                <option value="first_sun">第1</option><option value="second_sun">第2</option>
                                <option value="third_sun">第3</option><option value="fourth_sun">第4</option><option value="last_sun">最終</option>
                              </optgroup>
                              <optgroup label="月曜">
                                <option value="first_mon">第1</option><option value="second_mon">第2</option>
                                <option value="third_mon">第3</option><option value="fourth_mon">第4</option><option value="last_mon">最終</option>
                              </optgroup>
                              <optgroup label="火曜">
                                <option value="first_tue">第1</option><option value="second_tue">第2</option>
                                <option value="third_tue">第3</option><option value="fourth_tue">第4</option><option value="last_tue">最終</option>
                              </optgroup>
                              <optgroup label="水曜">
                                <option value="first_wed">第1</option><option value="second_wed">第2</option>
                                <option value="third_wed">第3</option><option value="fourth_wed">第4</option><option value="last_wed">最終</option>
                              </optgroup>
                              <optgroup label="木曜">
                                <option value="first_thu">第1</option><option value="second_thu">第2</option>
                                <option value="third_thu">第3</option><option value="fourth_thu">第4</option><option value="last_thu">最終</option>
                              </optgroup>
                              <optgroup label="金曜">
                                <option value="first_fri">第1</option><option value="second_fri">第2</option>
                                <option value="third_fri">第3</option><option value="fourth_fri">第4</option><option value="last_fri">最終</option>
                              </optgroup>
                              <optgroup label="土曜">
                                <option value="first_sat">第1</option><option value="second_sat">第2</option>
                                <option value="third_sat">第3</option><option value="fourth_sat">第4</option><option value="last_sat">最終</option>
                              </optgroup>
                            </select>
                          ) : (
                            <input type="number" min="1" max="31" value={plan?.date || 15}
                              onChange={e => updateMonthPlan(m, 'date', parseInt(e.target.value))}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="日" />
                          )}
                          <select value={plan?.workType || ''} onChange={e => updateMonthPlan(m, 'workType', e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                            {(masterData.workTypes || []).map(w => <option key={w} value={w}>{w}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {modalType !== 'corp' && modalType !== 'site' && modalType !== 'photo' && (
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 py-2 rounded-lg" disabled={saving}>キャンセル</button>
              <button type="button" onClick={handleSave} className="flex-1 text-white py-2 rounded-lg flex items-center justify-center" style={{ background: '#00B894' }} disabled={saving}>
                {saving ? <Icons.Loader /> : '保存'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: '#F5F6FA' }}>
      <header className="bg-white px-4 py-3 sticky top-0 z-40" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div className="flex justify-between items-center max-w-5xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div style={{ width: '36px', height: '36px', background: '#00B894', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: '14px' }}>CS</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: '17px', color: '#2D3436' }}>CSM業務管理</span>
          </div>
          <div className="flex items-center gap-3">
            <span style={{ color: '#636E72', fontSize: '13px' }}>{currentUser?.name}</span>
            <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600"><Icons.LogOut /></button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 pb-24">
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'corporations' && (
          <>
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2D3436', margin: 0 }}>顧客一覧</h2>
                  <p style={{ fontSize: '13px', color: '#636E72', margin: '2px 0 0' }}>{corporations.length}社 / {totalSites}現場</p>
                </div>
                <button onClick={() => { setModalType('corp'); setEditingItem(null); setShowModal(true); }}
                  className="flex items-center gap-1 text-white px-4 py-2 text-sm font-medium" style={{ background: 'linear-gradient(135deg, #00B894, #00D2A0)', borderRadius: '12px', border: 'none' }}>
                  <Icons.Plus /> 法人追加
                </button>
              </div>
              <input type="text" placeholder="法人名・現場名で検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '14px 16px', border: '1.5px solid #E9ECEF', borderRadius: '12px', fontSize: '14px', background: '#FAFBFC', outline: 'none' }} autoComplete="off" />
            </div>
            <CorporationList />
          </>
        )}
        {currentView === 'sites' && <SiteList />}
        {currentView === 'site' && <SiteDetail />}
        {currentView === 'calendar' && <MonthlyCalendar />}
        {currentView === 'invoices' && <InvoiceView />}
        {currentView === 'settings' && <SettingsView />}
        {currentView === 'dailyReports' && <DailyReportList />}
        {currentView === 'dailyReportForm' && <DailyReportForm />}
        {currentView === 'timecard' && <TimecardView />}
        {currentView === 'menu' && <AdminMenuView />}
        {currentView === 'adminDailyReports' && <DailyReportAdminView />}
        {currentView === 'adminTimecards' && <TimecardAdminView />}
        {currentView === 'adminAuditLogs' && <AuditLogView />}
        {currentView === 'inventory' && <InventoryView />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white z-20" style={{ borderTop: '1px solid #E9ECEF', padding: '8px 0 24px' }}>
        <div className="max-w-5xl mx-auto flex">
          <button onClick={() => navigate('/')} className="flex-1 text-center" style={{ color: currentView === 'dashboard' ? '#00B894' : '#B2BEC3', fontSize: '10px' }}>
            <div className="flex justify-center mb-0.5"><Icons.Home /></div><div>ホーム</div>
          </button>
          <button onClick={() => navigate('/corporations')} className="flex-1 text-center"
            style={{ color: ['corporations', 'sites', 'site'].includes(currentView) ? '#00B894' : '#B2BEC3', fontSize: '10px' }}>
            <div className="flex justify-center mb-0.5"><Icons.Building /></div><div>顧客</div>
          </button>
          <button onClick={() => navigate('/calendar')} className="flex-1 text-center" style={{ color: currentView === 'calendar' ? '#00B894' : '#B2BEC3', fontSize: '10px' }}>
            <div className="flex justify-center mb-0.5"><Icons.Calendar /></div><div>カレンダー</div>
          </button>
          <button onClick={() => navigate('/inventory')} className="flex-1 text-center" style={{ color: currentView === 'inventory' ? '#00B894' : '#B2BEC3', fontSize: '10px' }}>
            <div className="flex justify-center mb-0.5"><Icons.Package /></div><div>在庫</div>
          </button>
          {userRole === 'admin' || userRole === 'master' ? (
            <>
              <button onClick={() => navigate('/invoices')} className="flex-1 text-center" style={{ color: currentView === 'invoices' ? '#00B894' : '#B2BEC3', fontSize: '10px' }}>
                <div className="flex justify-center mb-0.5"><Icons.Calculator /></div><div>請求</div>
              </button>
              <button onClick={() => navigate('/menu')} className="flex-1 text-center"
                style={{ color: ['menu', 'settings', 'adminDailyReports', 'adminTimecards'].includes(currentView) ? '#00B894' : '#B2BEC3', fontSize: '10px' }}>
                <div className="flex justify-center mb-0.5"><Icons.Menu /></div><div>メニュー</div>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => navigate('/daily-reports')} className="flex-1 text-center"
                style={{ color: ['dailyReports', 'dailyReportForm'].includes(currentView) ? '#00B894' : '#B2BEC3', fontSize: '10px' }}>
                <div className="flex justify-center mb-0.5"><Icons.ClipboardList /></div><div>日報</div>
              </button>
              <button onClick={() => navigate('/timecard')} className="flex-1 text-center" style={{ color: currentView === 'timecard' ? '#00B894' : '#B2BEC3', fontSize: '10px' }}>
                <div className="flex justify-center mb-0.5"><Icons.Clock /></div><div>打刻</div>
              </button>
            </>
          )}
        </div>
      </nav>

      {showModal && <Modal />}

      {lightboxPhoto && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-[60]" onClick={() => setLightboxPhoto(null)}>
          <button className="absolute top-4 right-4 text-white text-3xl font-bold z-10 w-10 h-10 flex items-center justify-center" onClick={() => setLightboxPhoto(null)}>&times;</button>
          {selectedSite?.photos?.length > 1 && (
            <>
              <button className="absolute left-2 top-1/2 -translate-y-1/2 text-white text-4xl font-bold z-10 w-12 h-12 flex items-center justify-center"
                onClick={(e) => { e.stopPropagation(); const photos = selectedSite.photos; const prev = (lightboxIndex - 1 + photos.length) % photos.length; setLightboxIndex(prev); setLightboxPhoto(photos[prev]); }}>&lsaquo;</button>
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-4xl font-bold z-10 w-12 h-12 flex items-center justify-center"
                onClick={(e) => { e.stopPropagation(); const photos = selectedSite.photos; const next = (lightboxIndex + 1) % photos.length; setLightboxIndex(next); setLightboxPhoto(photos[next]); }}>&rsaquo;</button>
            </>
          )}
          <img src={lightboxPhoto.url} alt="" className="max-w-full max-h-[85vh] object-contain" onClick={(e) => e.stopPropagation()} />
          <div className="text-white text-sm mt-2">
            {formatDate(lightboxPhoto.date)}{lightboxPhoto.note ? ` - ${lightboxPhoto.note}` : ''}
            {selectedSite?.photos?.length > 1 && ` (${lightboxIndex + 1}/${selectedSite.photos.length})`}
          </div>
        </div>
      )}
    </div>
  );
}

// HashRouterでラップしたアプリケーション
function AppWrapper() {
  return (
    <HashRouter>
      <App />
    </HashRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AppWrapper />);