const { useState, useEffect, useMemo } = React;
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
    const json = await res.json();
    
    if (!res.ok) {
      throw new Error(json.error || 'API Error');
    }
    
    return json;
  },
  
  login: (username, password) => api.call('login', 'POST', { username, password }),
  logout: () => api.call('logout', 'POST'),
  checkAuth: () => api.call('check-auth'),
  
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
  getCorrectionRequests: (params) => api.call('time-correction-requests', 'GET', null, params),
  submitCorrectionRequest: (data) => api.call('time-correction-requests', 'POST', data),
  processCorrectionRequest: (data) => api.call('process-time-correction', 'POST', data),

  // 車両マスターAPI
  getVehicles: () => api.call('vehicles'),
  addVehicle: (name) => api.call('vehicles', 'POST', { name }),
  deleteVehicle: (id) => api.call('vehicle', 'DELETE', null, { id }),

  // 履歴API（管理者のみ）
  getLoginLogs: () => api.call('login-logs'),
  getKeyboxLogs: () => api.call('keybox-log')
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
  Trash2: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>)
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
      setCurrentUser(user);
      setIsLoggedIn(true);
      await loadData(user.role);
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
    setIsLoggedIn(false);
    setCurrentUser(null);
    setLoginForm({ username: '', password: '' });
    navigate('/');
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
  const generateNotifications = useMemo(() => {
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
          if (plan?.scheduled && plan.date === tomorrowDate) {
            notifs.push({ id: `work-${site.id}`, type: 'work', title: '明日施工予定', message: `${corp.name} - ${site.name}`, corpId: corp.id, siteId: site.id, priority: 'medium' });
          }
        }
      });
    });
    return notifs;
  }, [corporations]);

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
            if (plan?.scheduled && plan.date === date) {
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-white" style={{ backgroundColor: '#5bbd56' }}><Icons.Lock /></div>
            <h1 className="text-2xl font-bold text-gray-800">CSM業務管理</h1>
            <p className="text-gray-500 text-sm mt-2">ログインしてください</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-gray-600 text-sm font-medium">ユーザー名</label>
              <input type="text" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 mt-1" placeholder="ユーザー名を入力" />
            </div>
            <div>
              <label className="text-gray-600 text-sm font-medium">パスワード</label>
              <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()} className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 mt-1" placeholder="パスワードを入力" />
            </div>
            {loginError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2"><span className="text-red-500"><Icons.AlertCircle /></span><p className="text-red-600 text-sm">{loginError}</p></div>}
            <button onClick={handleLogin} className="w-full text-white py-3 rounded-lg font-medium" style={{ backgroundColor: '#5bbd56' }}>ログイン</button>
          </div>
        </div>
      </div>
    );
  }

  // ダッシュボード
  const Dashboard = () => {
    const [workTab, setWorkTab] = useState('today');
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
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-800">ダッシュボード</h2>
          <p className="text-gray-500 text-sm">{today.getMonth() + 1}月{today.getDate()}日（{dayNames[today.getDay()]}）</p>
        </div>

        {(() => {
          // スタッフは請求・入金関連の通知を非表示
          const filteredNotifications = userRole === 'admin'
            ? generateNotifications
            : generateNotifications.filter(n => n.type !== 'invoice' && n.type !== 'payment');
          return filteredNotifications.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="font-bold text-amber-700 flex items-center gap-2 mb-3"><Icons.Bell /> 通知 ({filteredNotifications.length})</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {filteredNotifications.slice(0, 5).map(n => (
                  <div key={n.id} className={`text-sm p-2 rounded ${n.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    <span className="font-medium">{n.title}:</span> {n.message}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex border-b border-gray-200">
            {[
              { key: 'today', label: `今日 (${todayWorks.length})` },
              { key: 'week', label: `今週 (${thisWeekWorks.length})` },
              { key: 'month', label: `今月 (${thisMonthWorks.length})` }
            ].map(tab => (
              <button key={tab.key} onClick={() => setWorkTab(tab.key)}
                className={`flex-1 py-3 text-center text-sm font-medium ${workTab === tab.key ? 'text-white' : 'text-gray-500 bg-gray-50'}`}
                style={workTab === tab.key ? { backgroundColor: '#5bbd56' } : {}}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="p-4 max-h-80 overflow-y-auto">
            {displayWorks.length === 0 ? (
              <p className="text-gray-400 text-center py-8">予定はありません</p>
            ) : (
              <div className="space-y-2">
                {displayWorks.map((work, i) => {
                  const isToday = work.scheduledDate.toDateString() === today.toDateString();
                  const dateStr = workTab === 'today' ? '' : `${work.scheduledDate.getMonth() + 1}/${work.scheduledDate.getDate()}(${dayNames[work.scheduledDate.getDay()]})`;
                  return (
                    <div key={i} onClick={() => {
                      navigate(`/sites/${work.id}`);
                    }} className={`flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-gray-100 ${isToday && workTab !== 'today' ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                      <div className="flex-1 min-w-0">
                        {workTab !== 'today' && (
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${isToday ? 'text-white' : 'bg-gray-200 text-gray-600'}`} style={isToday ? { backgroundColor: '#5bbd56' } : {}}>
                              {dateStr}
                            </span>
                            {isToday && <span className="text-xs font-bold" style={{ color: '#5bbd56' }}>本日</span>}
                          </div>
                        )}
                        <p className="font-medium text-gray-800 truncate mt-1">{work.corpName}</p>
                        <p className="text-gray-500 text-sm truncate">{work.name} - {work.workType}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {userRole === 'admin' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer" onClick={() => navigate('/invoices')}>
              <p className="text-gray-500 text-sm">請求未送付</p>
              <p className={`text-2xl font-bold ${unsentCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>{unsentCount}件</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer" onClick={() => navigate('/invoices')}>
              <p className="text-gray-500 text-sm">入金待ち</p>
              <p className={`text-2xl font-bold ${unpaidCount > 0 ? 'text-amber-500' : 'text-gray-400'}`}>{unpaidCount}件</p>
            </div>
          </div>
        )}

        {userRole === 'admin' && contractAlerts.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
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
                className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition-all hover:border-green-400">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400"><Icons.Building /></span>
                      <h3 className="font-bold text-gray-800 text-lg truncate">{corp.name}</h3>
                    </div>
                    {corp.address && (
                      <div className="flex items-center gap-1 text-gray-500 text-sm mt-1">
                        <Icons.MapPin /><span className="truncate">{corp.address}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-500">
                      {corp.contactPerson && <span className="flex items-center gap-1"><Icons.User />{corp.contactPerson}</span>}
                      {corp.contact && <span className="flex items-center gap-1"><Icons.Phone />{corp.contact}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm font-medium" style={{ color: '#5bbd56' }}>{(corp.sites || []).length}現場</span>
                      {userRole === 'admin' && <span className={`text-xs px-2 py-0.5 rounded border ${billingColor.bg} ${billingColor.text} ${billingColor.border}`}>{corp.billingCycle}</span>}
                    </div>
                  </div>
                  <div className="text-gray-300"><Icons.ChevronRight /></div>
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
          <button onClick={() => navigate('/corporations')} className="text-gray-400 hover:text-gray-600"><Icons.ChevronLeft /></button>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-800 truncate">{selectedCorp?.name}</h2>
            <p className="text-gray-500 text-sm">{(selectedCorp?.sites || []).length}現場</p>
          </div>
          {userRole === 'admin' && (
            <div className="flex items-center gap-2">
              <button onClick={() => { setModalType('corp'); setEditingItem(selectedCorp); setShowModal(true); }} className="text-gray-400 hover:text-gray-600">
                <Icons.Edit />
              </button>
              <button onClick={() => setShowDeleteConfirm(true)} className="text-red-400 hover:text-red-600">
                <Icons.Trash />
              </button>
            </div>
          )}
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {selectedCorp?.address && (
              <div className="flex items-center gap-2">
                <Icons.MapPin className="text-gray-400" /><span className="flex-1">{selectedCorp.address}</span>
                <a href={getGoogleMapUrl(selectedCorp.address)} target="_blank" rel="noopener noreferrer" className="p-1" style={{ color: '#5bbd56' }}><Icons.Map /></a>
              </div>
            )}
            {selectedCorp?.contact && <div className="flex items-center gap-2"><Icons.Phone className="text-gray-400" /><span>{selectedCorp.contact}</span></div>}
            {selectedCorp?.contactPerson && <div className="flex items-center gap-2"><Icons.User className="text-gray-400" /><span>担当: {selectedCorp.contactPerson}</span></div>}
            {selectedCorp?.memo && <div className="col-span-full flex items-start gap-2"><Icons.FileText className="text-gray-400 mt-0.5" /><span className="text-gray-600 whitespace-pre-wrap">{selectedCorp.memo}</span></div>}
          </div>
          {userRole === 'admin' && (
            <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-500">
              <div>請求: {selectedCorp?.billingCycle} / {selectedCorp?.billingDay}日</div>
              {selectedCorp?.billingMonth && <div>請求月: {selectedCorp.billingMonth}</div>}
              {selectedCorp?.contractAmount > 0 && <div>契約金額: ¥{selectedCorp.contractAmount?.toLocaleString()}</div>}
              {selectedCorp?.contractType && <div>契約種別: {selectedCorp.contractType}</div>}
            </div>
          )}
        </div>

        {userRole === 'admin' && (
          <button onClick={() => { setModalType('contactLog'); setShowModal(true); }}
            className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-lg p-3 text-gray-600 hover:bg-gray-50">
            <Icons.MessageCircle /> 連絡履歴 ({(selectedCorp?.contactLogs || []).length})
          </button>
        )}

        <div className="flex justify-between items-center mb-2 mt-4">
          <h3 className="text-gray-600 font-medium flex items-center gap-2"><Icons.Store /> 現場一覧</h3>
          {userRole === 'admin' && (
            <button onClick={() => { setModalType('site'); setEditingItem(null); setShowModal(true); }}
              className="flex items-center gap-1 text-white px-3 py-1.5 rounded-lg text-sm" style={{ backgroundColor: '#5bbd56' }}>
              <Icons.Plus /> 現場追加
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(selectedCorp?.sites || []).map((site) => (
            <div key={site.id} onClick={() => navigate(`/sites/${site.id}`)}
              className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-green-400">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800">{site.name}</h3>
                <div className="flex items-center gap-2">
                  {userRole === 'admin' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingSite(site); setShowSiteDeleteConfirm(true); }}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Icons.Trash />
                    </button>
                  )}
                  <Icons.ChevronRight />
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
          <button onClick={() => { setShowKeybox(false); navigate(`/corporations/${selectedCorp?.id}`); }} className="text-gray-400"><Icons.ChevronLeft /></button>
          <div className="flex-1">
            <p className="text-gray-500 text-sm truncate">{selectedCorp?.name}</p>
            <h2 className="text-xl font-bold text-gray-800">{selectedSite?.name}</h2>
          </div>
          <button onClick={() => { setModalType('site'); setEditingItem(selectedSite); setShowModal(true); }} className="text-gray-400"><Icons.Edit /></button>
        </div>

        <div
          className={`border-2 rounded-2xl p-5 cursor-pointer transition-all ${selectedSite?.keybox ? '' : 'bg-gray-50 border-gray-200'}`}
          style={selectedSite?.keybox ? { backgroundColor: 'rgba(91, 189, 86, 0.1)', borderColor: '#5bbd56' } : {}}
          onClick={async () => {
            if (selectedSite?.keybox && !showKeybox) {
              setShowKeybox(true);
              // キーボックス閲覧ログを記録
              try {
                await api.call('keybox-log', 'POST', { siteId: selectedSite.id, siteName: selectedSite.name });
              } catch (e) {
                console.error('Failed to log keybox access:', e);
              }
            }
          }}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: selectedSite?.keybox ? '#5bbd56' : '#9ca3af' }}><Icons.Key /></div>
            <div>
              <p className="text-sm" style={{ color: selectedSite?.keybox ? '#5bbd56' : '#9ca3af' }}>キーボックス暗証番号</p>
              {selectedSite?.keybox ? (
                showKeybox ? (
                  <><p className={`font-black ${selectedSite.keybox.length > 4 ? 'text-3xl tracking-[0.15em]' : 'text-4xl tracking-[0.3em]'}`} style={{ color: '#5bbd56' }}>{selectedSite.keybox}</p>
                  {selectedSite?.keyboxLocation && <p className="text-gray-600 text-sm">{selectedSite.keyboxLocation}</p>}</>
                ) : (
                  <p className="font-medium text-lg" style={{ color: '#5bbd56' }}>タップして表示 <Icons.Eye className="inline w-5 h-5" /></p>
                )
              ) : <p className="text-gray-400">未登録</p>}
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
          {[{ key: 'info', label: '基本情報' }, { key: 'plan', label: '年間計画' }, { key: 'logs', label: '作業履歴' }, { key: 'photos', label: '写真' }, { key: 'docs', label: '書類' }].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${activeTab === tab.key ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'info' && (
          <div className="space-y-4">
            {selectedSite?.address && (
              <div className="flex items-center gap-2 text-gray-600">
                <Icons.MapPin /><span className="flex-1">{selectedSite.address}</span>
                <a href={getGoogleMapUrl(selectedSite.address)} target="_blank" className="p-1" style={{ color: '#5bbd56' }}><Icons.Map /></a>
              </div>
            )}
            <div>
              <p className="text-gray-400 text-sm mb-1">対象害虫</p>
              <div className="flex flex-wrap gap-1">
                {(selectedSite?.pests || []).map((p, i) => <span key={i} className="bg-red-50 text-red-600 text-sm px-2 py-1 rounded border border-red-200">{p}</span>)}
              </div>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">作業内容</p>
              <div className="flex flex-wrap gap-1">
                {(selectedSite?.workTypes || []).map((t, i) => <span key={i} className="bg-blue-50 text-blue-600 text-sm px-2 py-1 rounded border border-blue-200">{t}</span>)}
              </div>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">作業箇所</p>
              <div className="flex flex-wrap gap-1">
                {(selectedSite?.workAreas || []).length > 0 ? (
                  selectedSite.workAreas.map((a, i) => <span key={i} className="bg-purple-50 text-purple-600 text-sm px-2 py-1 rounded border border-purple-200">{a}</span>)
                ) : (
                  <span className="text-gray-400 text-sm">未登録</span>
                )}
              </div>
            </div>
            {selectedSite?.memo && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-gray-400 text-sm mb-1">メモ</p>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedSite.memo}</p>
              </div>
            )}
            <div>
              <p className="text-gray-400 text-sm mb-1">請求月</p>
              <div className="flex flex-wrap gap-1">
                {(selectedSite?.billingMonths || []).length > 0 ? (
                  selectedSite.billingMonths.sort((a, b) => a - b).map((m, i) => <span key={i} className="bg-orange-50 text-orange-600 text-sm px-2 py-1 rounded border border-orange-200">{m}月</span>)
                ) : (
                  <span className="text-gray-400 text-sm">法人設定に準拠</span>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'plan' && (
          <div className="space-y-3">
            {userRole === 'admin' && (
              <button onClick={() => { setModalType('yearlyPlan'); setShowModal(true); }}
                className="w-full flex items-center justify-center gap-2 text-white py-2 rounded-lg" style={{ backgroundColor: '#5bbd56' }}>
                <Icons.Edit /> 年間計画を編集
              </button>
            )}
            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50">{months.map(m => <th key={m} className="px-2 py-2 text-center min-w-[50px]">{m}月</th>)}</tr></thead>
                <tbody><tr>
                  {months.map(m => {
                    const plan = selectedSite?.yearlyPlan?.[m];
                    return (
                      <td key={m} className="px-1 py-2 text-center border-t">
                        {plan?.scheduled ? (
                          <div>
                            <div className="w-7 h-7 mx-auto rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: '#5bbd56' }}>{plan.date}</div>
                            <div className="text-xs mt-1 text-gray-500 truncate">{plan.workType}</div>
                          </div>
                        ) : (
                          <div className="w-7 h-7 mx-auto rounded-full border-2 border-dashed border-gray-200" />
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
              className="w-full flex items-center justify-center gap-2 bg-white border-2 border-dashed border-gray-300 rounded-lg p-3 text-gray-500 hover:border-green-400 hover:text-green-600">
              <Icons.Plus /> 作業報告を追加
            </button>
            {(selectedSite?.workLogs || []).length === 0 ? (
              <p className="text-center text-gray-400 py-8">作業履歴がありません</p>
            ) : (
              <div className="space-y-3">
                {[...(selectedSite?.workLogs || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).map(log => (
                  <div key={log.id} className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-sm font-medium px-2 py-0.5 rounded" style={{ backgroundColor: '#5bbd56', color: 'white' }}>{formatDate(log.date)}</span>
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
                    <img src={photo.url} alt="" className="w-full h-full object-cover" />
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
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Icons.Calculator /> 請求管理</h2>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {[{ key: 'thisMonth', label: `今月 (${thisMonthBillingCorps.length})` }, { key: 'all', label: `全て (${corporations.length})` }, { key: '毎月', label: '毎月' }, { key: '半年', label: '半年' }, { key: '年間', label: '年間' }].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${filter === f.key ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
              style={filter === f.key ? { backgroundColor: '#5bbd56' } : {}}>
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
    const [keyboxLogs, setKeyboxLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      const loadLogs = async () => {
        setLoading(true);
        try {
          if (logsType === 'login') {
            const data = await api.getLoginLogs();
            setLoginLogs(data);
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

    const formatDate = (dateStr) => {
      const d = new Date(dateStr);
      return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    };

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <button onClick={() => setLogsType('login')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${logsType === 'login' ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
            style={logsType === 'login' ? { backgroundColor: '#5bbd56' } : {}}>
            ログイン履歴
          </button>
          <button onClick={() => setLogsType('keybox')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${logsType === 'keybox' ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
            style={logsType === 'keybox' ? { backgroundColor: '#5bbd56' } : {}}>
            キーボックス閲覧履歴
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : logsType === 'login' ? (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-gray-100">
              {loginLogs.length === 0 ? (
                <div className="p-4 text-center text-gray-500">ログイン履歴がありません</div>
              ) : loginLogs.map(log => (
                <div key={log.id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-sm">
                      {log.user_name?.charAt(0) || '?'}
                    </div>
                    <span className="font-medium">{log.user_name}</span>
                  </div>
                  <span className="text-gray-500 text-sm">{formatDate(log.login_at)}</span>
                </div>
              ))}
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

    useEffect(() => {
      if (settingsTab === 'users' && users.length === 0) {
        api.getUsers().then(setUsers).catch(console.error);
      }
    }, [settingsTab, users.length]);

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

    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Icons.Settings /> 設定</h2>

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
              className="w-full flex items-center justify-center gap-2 text-white py-2 rounded-lg" style={{ backgroundColor: '#5bbd56' }}>
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
                <button type="submit" className="px-3 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: '#5bbd56' }}>追加</button>
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
                <button type="submit" className="px-3 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: '#5bbd56' }}>追加</button>
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
                <button type="submit" className="px-3 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: '#5bbd56' }}>追加</button>
              </form>
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
                  <button type="submit" className="flex-1 text-white py-2 rounded-lg" style={{ backgroundColor: '#5bbd56' }}>保存</button>
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
          <h2 className="text-xl font-bold text-gray-800">{year}年{month + 1}月</h2>
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
                  <span className="text-sm font-medium mr-2 px-2 py-0.5 rounded" style={{ backgroundColor: '#5bbd56', color: 'white' }}>{work.date}日</span>
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
          <h2 className="text-xl font-bold text-gray-800">日報</h2>
          <button onClick={() => navigate('/daily-reports/new')}
            className="flex items-center gap-1 text-white px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: '#5bbd56' }}>
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
          <h2 className="text-xl font-bold text-gray-800">{isNew ? '日報作成' : '日報編集'}</h2>
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
              <button onClick={addDetail} className="text-sm px-3 py-1 rounded" style={{ backgroundColor: '#5bbd56', color: 'white' }}>
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
                    <input type="number" min="1" value={detail.workerCount} onChange={(e) => updateDetail(i, 'workerCount', parseInt(e.target.value) || 1)}
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
            className="flex-1 text-white py-3 rounded-lg font-medium" style={{ backgroundColor: '#5bbd56' }}>
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
    const [correctionCard, setCorrectionCard] = useState(null);
    const [correctionForm, setCorrectionForm] = useState({ clock_in: '', clock_out: '', reason: '' });
    const [myRequests, setMyRequests] = useState([]);

    useEffect(() => {
      const timer = setInterval(() => setCurrentTime(new Date()), 1000);
      return () => clearInterval(timer);
    }, []);

    useEffect(() => {
      loadTodayCard();
      loadMonthCards();
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
        const data = await api.getCorrectionRequests();
        setMyRequests(data);
      } catch (e) { console.error(e); }
    };

    useEffect(() => { loadMyRequests(); }, []);

    const handleSubmitCorrection = async () => {
      try {
        await api.submitCorrectionRequest({
          work_date: correctionCard.work_date,
          clock_in: correctionForm.clock_in ? correctionForm.clock_in + ':00' : null,
          clock_out: correctionForm.clock_out ? correctionForm.clock_out + ':00' : null,
          reason: correctionForm.reason
        });
        setShowCorrectionModal(false);
        setCorrectionCard(null);
        setCorrectionForm({ clock_in: '', clock_out: '', reason: '' });
        loadMyRequests();
        alert('修正申請を送信しました');
      } catch (e) { alert('申請に失敗しました: ' + e.message); }
    };

    const correctionStatusLabel = (status) => {
      switch (status) {
        case 'pending': return { label: '申請中', color: 'bg-yellow-100 text-yellow-700' };
        case 'approved': return { label: '承認済', color: 'bg-green-100 text-green-700' };
        case 'rejected': return { label: '却下', color: 'bg-red-100 text-red-700' };
        default: return { label: status, color: 'bg-gray-100 text-gray-600' };
      }
    };

    const handleClockIn = async () => {
      try {
        await api.clockIn({ type: 'auto' });
        loadTodayCard();
        loadMonthCards();
      } catch (e) {
        alert(e.message);
      }
    };

    const handleClockOut = async () => {
      try {
        await api.clockOut({ type: 'auto' });
        loadTodayCard();
        loadMonthCards();
      } catch (e) {
        alert(e.message);
      }
    };

    const handleManualClockIn = async () => {
      const time = prompt('出勤時刻を入力 (HH:MM)', currentTime.toTimeString().slice(0, 5));
      if (time) {
        try {
          await api.clockIn({ time: time + ':00', type: 'manual' });
          loadTodayCard();
          loadMonthCards();
        } catch (e) {
          alert(e.message);
        }
      }
    };

    const handleManualClockOut = async () => {
      const time = prompt('退勤時刻を入力 (HH:MM)', currentTime.toTimeString().slice(0, 5));
      if (time) {
        try {
          await api.clockOut({ time: time + ':00', type: 'manual' });
          loadTodayCard();
          loadMonthCards();
        } catch (e) {
          alert(e.message);
        }
      }
    };

    const formatTime = (time) => time ? time.slice(0, 5) : '--:--';

    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-800">タイムカード</h2>

        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <p className="text-4xl font-bold text-gray-800 mb-2">
            {currentTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
          <p className="text-gray-500 mb-4">
            {currentTime.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>

          <div className="flex gap-3 justify-center mb-4">
            {!todayCard?.clock_in ? (
              <>
                <button onClick={handleClockIn}
                  className="px-8 py-4 rounded-xl text-white text-lg font-bold" style={{ backgroundColor: '#5bbd56' }}>
                  出勤
                </button>
                <button onClick={handleManualClockIn}
                  className="px-4 py-4 rounded-xl bg-gray-200 text-gray-600 text-sm">
                  手入力
                </button>
              </>
            ) : !todayCard?.clock_out ? (
              <>
                <button onClick={handleClockOut}
                  className="px-8 py-4 rounded-xl text-white text-lg font-bold bg-orange-500">
                  退勤
                </button>
                <button onClick={handleManualClockOut}
                  className="px-4 py-4 rounded-xl bg-gray-200 text-gray-600 text-sm">
                  手入力
                </button>
              </>
            ) : (
              <p className="text-green-600 font-medium">本日の打刻完了</p>
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
                  <span className="font-medium text-gray-700">{card.work_date}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{formatTime(card.clock_in)} - {formatTime(card.clock_out)}</span>
                    {currentUser?.role === 'admin' ? (
                      <button onClick={() => { setEditingCard(card); setShowEditModal(true); }}
                        className="text-gray-400 hover:text-gray-600"><Icons.Edit /></button>
                    ) : (
                      <button onClick={() => {
                        setCorrectionCard(card);
                        setCorrectionForm({
                          clock_in: card.clock_in?.slice(0, 5) || '',
                          clock_out: card.clock_out?.slice(0, 5) || '',
                          reason: ''
                        });
                        setShowCorrectionModal(true);
                      }} className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">修正申請</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {currentUser?.role !== 'admin' && myRequests.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-bold text-gray-700 mb-3">修正申請一覧</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {myRequests.map(req => {
                const st = correctionStatusLabel(req.status);
                return (
                  <div key={req.id} className="p-2 bg-gray-50 rounded-lg text-sm">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{req.work_date}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${st.color}`}>{st.label}</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">
                      出勤: {req.requested_clock_in?.slice(0, 5) || '--:--'} / 退勤: {req.requested_clock_out?.slice(0, 5) || '--:--'}
                    </p>
                    <p className="text-gray-400 text-xs">理由: {req.reason}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {showCorrectionModal && correctionCard && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm">
              <h3 className="font-bold text-lg mb-2">修正申請</h3>
              <p className="text-gray-500 mb-4">{correctionCard.work_date}</p>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-500">出勤時刻</label>
                  <input type="time" value={correctionForm.clock_in}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, clock_in: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-gray-500">退勤時刻</label>
                  <input type="time" value={correctionForm.clock_out}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, clock_out: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-gray-500">理由 <span className="text-red-500">*</span></label>
                  <textarea value={correctionForm.reason}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                    placeholder="修正理由を入力してください"
                    className="w-full border border-gray-300 rounded px-3 py-2 h-20 resize-none" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => { setShowCorrectionModal(false); setCorrectionCard(null); }}
                  className="flex-1 bg-gray-200 py-2 rounded-lg">キャンセル</button>
                <button onClick={handleSubmitCorrection}
                  disabled={!correctionForm.reason}
                  className="flex-1 text-white py-2 rounded-lg disabled:opacity-50" style={{ backgroundColor: '#5bbd56' }}>申請する</button>
              </div>
            </div>
          </div>
        )}

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
                }} className="flex-1 text-white py-2 rounded-lg" style={{ backgroundColor: '#5bbd56' }}>保存</button>
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
      </div>
    );
  };

  // ========== 管理者メニュー ==========
  const AdminMenuView = () => {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-800">メニュー</h2>

        <div className="space-y-3">
          <button onClick={() => navigate('/settings')}
            className="w-full bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 text-left hover:bg-gray-50">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(91, 189, 86, 0.1)' }}>
              <Icons.Settings style={{ color: '#5bbd56' }} />
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
              <Icons.ClipboardList style={{ color: '#5bbd56' }} />
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
              <Icons.Clock style={{ color: '#5bbd56' }} />
            </div>
            <div>
              <p className="font-bold text-gray-800">タイムカード管理</p>
              <p className="text-sm text-gray-500">全スタッフの勤怠確認・集計</p>
            </div>
            <Icons.ChevronRight className="ml-auto text-gray-400" />
          </button>
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
          <h2 className="text-xl font-bold text-gray-800">日報管理</h2>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-center">
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2" />
          <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2">
            <option value="">全員</option>
            {users.filter(u => u.role === 'staff').map(u => (
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
                <button onClick={handleSaveHours} className="flex-1 text-white py-2 rounded-lg" style={{ backgroundColor: '#5bbd56' }}>保存</button>
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
    const [timecards, setTimecards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [selectedUser, setSelectedUser] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingCard, setEditingCard] = useState(null);
    const [activeTab, setActiveTab] = useState('timecards');
    const [correctionRequests, setCorrectionRequests] = useState([]);
    const [correctionLoading, setCorrectionLoading] = useState(false);

    useEffect(() => {
      loadTimecards();
    }, [selectedMonth, selectedUser]);

    useEffect(() => {
      if (activeTab === 'corrections') {
        loadCorrectionRequests();
      }
    }, [activeTab]);

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

    const loadCorrectionRequests = async () => {
      setCorrectionLoading(true);
      try {
        const data = await api.getCorrectionRequests();
        setCorrectionRequests(data);
      } catch (e) { console.error(e); }
      setCorrectionLoading(false);
    };

    const handleProcessCorrection = async (requestId, action) => {
      const actionLabel = action === 'approved' ? '承認' : '却下';
      if (!confirm(`この修正申請を${actionLabel}しますか？`)) return;
      try {
        await api.processCorrectionRequest({ id: requestId, action });
        loadCorrectionRequests();
        if (action === 'approved') loadTimecards();
      } catch (e) {
        alert(`${actionLabel}処理に失敗しました: ` + e.message);
      }
    };

    const handleExport = () => {
      const params = new URLSearchParams({ year_month: selectedMonth });
      if (selectedUser) params.append('user_id', selectedUser);
      const basePath = window.location.pathname.replace(/\/[^\/]*$/, '/');
      window.open(`${basePath}api/index.php?action=timecards-export&${params.toString()}`, '_blank');
    };

    const pendingCount = correctionRequests.filter(r => r.status === 'pending').length;

    // 集計計算（user_idでグループ化）
    const summary = useMemo(() => {
      const byUser = {};
      timecards.forEach(tc => {
        const key = tc.user_id;
        if (!byUser[key]) {
          byUser[key] = { name: tc.user_name, days: 0, totalHours: 0 };
        }
        byUser[key].days++;
        if (tc.clock_in && tc.clock_out) {
          const inTime = new Date(`2000-01-01T${tc.clock_in}`);
          const outTime = new Date(`2000-01-01T${tc.clock_out}`);
          byUser[key].totalHours += (outTime - inTime) / 3600000;
        }
      });
      return byUser;
    }, [timecards]);

    const correctionStatusLabel = (status) => {
      switch (status) {
        case 'pending': return { label: '申請中', color: 'bg-yellow-100 text-yellow-700' };
        case 'approved': return { label: '承認済', color: 'bg-green-100 text-green-700' };
        case 'rejected': return { label: '却下', color: 'bg-red-100 text-red-700' };
        default: return { label: status, color: 'bg-gray-100 text-gray-600' };
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/menu')} className="text-gray-500"><Icons.ChevronLeft /></button>
          <h2 className="text-xl font-bold text-gray-800">タイムカード管理</h2>
        </div>

        {/* タブ切り替え */}
        <div className="flex border-b border-gray-200">
          <button onClick={() => setActiveTab('timecards')}
            className={`flex-1 py-3 text-center text-sm font-medium border-b-2 ${activeTab === 'timecards' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
            タイムカード
          </button>
          <button onClick={() => setActiveTab('corrections')}
            className={`flex-1 py-3 text-center text-sm font-medium border-b-2 relative ${activeTab === 'corrections' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
            修正申請
            {pendingCount > 0 && (
              <span className="absolute -top-1 right-4 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{pendingCount}</span>
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
                {users.filter(u => u.role === 'staff').map(u => (
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
          /* 修正申請タブ */
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-bold text-gray-700 mb-3">修正申請一覧</h3>
            {correctionLoading ? (
              <div className="text-center py-8"><Icons.Loader /></div>
            ) : correctionRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-400">修正申請はありません</div>
            ) : (
              <div className="space-y-3">
                {correctionRequests.map(req => {
                  const st = correctionStatusLabel(req.status);
                  return (
                    <div key={req.id} className="border border-gray-200 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-bold text-gray-800">{req.user_name}</span>
                          <span className="ml-3 text-gray-600">{req.work_date}</span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${st.color}`}>{st.label}</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        出勤: {req.requested_clock_in?.slice(0, 5) || '--:--'} 〜 退勤: {req.requested_clock_out?.slice(0, 5) || '--:--'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">理由: {req.reason}</p>
                      {req.status === 'pending' && (
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => handleProcessCorrection(req.id, 'approved')}
                            className="flex-1 py-2 text-white rounded-lg text-sm font-medium" style={{ backgroundColor: '#5bbd56' }}>承認</button>
                          <button onClick={() => handleProcessCorrection(req.id, 'rejected')}
                            className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-medium">却下</button>
                        </div>
                      )}
                    </div>
                  );
                })}
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
                      className="text-sm px-2 py-1 rounded text-white" style={{ backgroundColor: '#5bbd56' }}><Icons.Plus /> 追加</button>
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
                <button type="submit" className="flex-1 text-white py-2 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#5bbd56' }} disabled={saving}>
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
                <p className="text-sm font-medium mb-2" style={{ color: '#5bbd56' }}>キーボックス</p>
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
                <button type="submit" className="flex-1 text-white py-2 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#5bbd56' }} disabled={saving}>
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
              <p className="text-sm text-gray-500">写真をアップロードしてください（自動的に圧縮されます）</p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <input type="file" accept="image/*" multiple={false} id="photo-upload" className="hidden" onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  
                  // 画像を圧縮
                  const compressImage = (file, maxWidth = 1200, quality = 0.7) => {
                    return new Promise((resolve) => {
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
                        img.src = e.target.result;
                      };
                      reader.readAsDataURL(file);
                    });
                  };
                  
                  try {
                    const compressed = await compressImage(file);
                    setFormData({ ...formData, imageData: compressed, fileName: file.name });
                    document.getElementById('photo-preview').src = compressed;
                    document.getElementById('photo-preview').style.display = 'block';
                    document.getElementById('photo-size').textContent = `圧縮後: ${Math.round(compressed.length / 1024)}KB`;
                  } catch (err) {
                    alert('画像の処理に失敗しました: ' + err.message);
                  }
                }} />
                <label htmlFor="photo-upload" className="cursor-pointer block">
                  <div className="flex justify-center mb-2"><Icons.Camera /></div>
                  <p className="text-gray-600">タップして写真を撮影・選択</p>
                  <p className="text-xs text-gray-400">JPG, PNG対応</p>
                </label>
              </div>
              <img id="photo-preview" src="" alt="" className="w-full rounded-lg hidden" />
              <p id="photo-size" className="text-xs text-gray-400"></p>
              <input type="date" name="photo-date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full border border-gray-300 rounded-lg px-3 py-2" style={{ backgroundColor: '#ffffff', WebkitAppearance: 'none' }} />
              <input type="text" name="photo-note" placeholder="メモ（任意）" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 py-2 rounded-lg">キャンセル</button>
                <button type="button" onClick={async () => {
                  if (!formData.imageData) { alert('写真を選択してください'); return; }
                  setSaving(true);
                  try {
                    const photoDate = document.querySelector('[name="photo-date"]').value;
                    const photoNote = document.querySelector('[name="photo-note"]').value;
                    await api.createPhoto({ 
                      siteId: selectedSite.id, 
                      imageData: formData.imageData,
                      date: photoDate,
                      note: photoNote
                    });
                    await loadData();
                    setShowModal(false);
                  } catch (err) {
                    alert('保存に失敗しました: ' + err.message);
                  } finally {
                    setSaving(false);
                  }
                }} className="flex-1 text-white py-2 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#5bbd56' }} disabled={saving}>
                  {saving ? <Icons.Loader /> : 'アップロード'}
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
                    placeholder="日"
                    className="w-16 border border-gray-300 rounded px-2 py-1 text-sm"
                    onChange={e => e.target.value && setAllDates(e.target.value)}
                  />
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
                  return (
                    <div key={m} className={`p-2 rounded-lg border-2 ${isActive ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                      <label className="flex items-center gap-2 cursor-pointer mb-2">
                        <input type="checkbox" checked={isActive || false} onChange={() => toggleMonth(m)} className="w-4 h-4" />
                        <span className="font-medium">{m}月</span>
                      </label>
                      {isActive && (
                        <div className="space-y-1">
                          <input type="number" min="1" max="31" value={plan?.date || 15}
                            onChange={e => updateMonthPlan(m, 'date', parseInt(e.target.value))}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="日" />
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
              <button type="button" onClick={handleSave} className="flex-1 text-white py-2 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#5bbd56' }} disabled={saving}>
                {saving ? <Icons.Loader /> : '保存'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-40 shadow-sm">
        <div className="flex justify-between items-center max-w-5xl mx-auto">
          <h1 className="font-bold text-lg" style={{ color: '#5bbd56' }}>CSM業務管理</h1>
          <div className="flex items-center gap-3">
            <span className="text-gray-600 text-sm">{currentUser?.name}</span>
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
                  <h2 className="text-xl font-bold text-gray-800">顧客一覧</h2>
                  <p className="text-gray-500 text-sm">{corporations.length}社 / {totalSites}現場</p>
                </div>
                {userRole === 'admin' && (
                  <button onClick={() => { setModalType('corp'); setEditingItem(null); setShowModal(true); }}
                    className="flex items-center gap-1 text-white px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: '#5bbd56' }}>
                    <Icons.Plus /> 法人追加
                  </button>
                )}
              </div>
              <input type="text" placeholder="法人名・現場名で検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 mb-4" autoComplete="off" />
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
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-5xl mx-auto flex">
          <button onClick={() => navigate('/')} className={`flex-1 py-3 text-center ${currentView === 'dashboard' ? '' : 'text-gray-400'}`} style={currentView === 'dashboard' ? { color: '#5bbd56' } : {}}>
            <div className="flex justify-center mb-1"><Icons.Home /></div><p className="text-xs">ホーム</p>
          </button>
          <button onClick={() => navigate('/corporations')}
            className={`flex-1 py-3 text-center ${['corporations', 'sites', 'site'].includes(currentView) ? '' : 'text-gray-400'}`}
            style={['corporations', 'sites', 'site'].includes(currentView) ? { color: '#5bbd56' } : {}}>
            <div className="flex justify-center mb-1"><Icons.Building /></div><p className="text-xs">顧客</p>
          </button>
          <button onClick={() => navigate('/calendar')} className={`flex-1 py-3 text-center ${currentView === 'calendar' ? '' : 'text-gray-400'}`} style={currentView === 'calendar' ? { color: '#5bbd56' } : {}}>
            <div className="flex justify-center mb-1"><Icons.Calendar /></div><p className="text-xs">カレンダー</p>
          </button>
          {userRole === 'admin' ? (
            <>
              <button onClick={() => navigate('/invoices')} className={`flex-1 py-3 text-center ${currentView === 'invoices' ? '' : 'text-gray-400'}`} style={currentView === 'invoices' ? { color: '#5bbd56' } : {}}>
                <div className="flex justify-center mb-1"><Icons.Calculator /></div><p className="text-xs">請求</p>
              </button>
              <button onClick={() => navigate('/menu')} className={`flex-1 py-3 text-center ${['menu', 'settings', 'adminDailyReports', 'adminTimecards'].includes(currentView) ? '' : 'text-gray-400'}`} style={['menu', 'settings', 'adminDailyReports', 'adminTimecards'].includes(currentView) ? { color: '#5bbd56' } : {}}>
                <div className="flex justify-center mb-1"><Icons.Menu /></div><p className="text-xs">メニュー</p>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => navigate('/daily-reports')} className={`flex-1 py-3 text-center ${['dailyReports', 'dailyReportForm'].includes(currentView) ? '' : 'text-gray-400'}`} style={['dailyReports', 'dailyReportForm'].includes(currentView) ? { color: '#5bbd56' } : {}}>
                <div className="flex justify-center mb-1"><Icons.ClipboardList /></div><p className="text-xs">日報</p>
              </button>
              <button onClick={() => navigate('/timecard')} className={`flex-1 py-3 text-center ${currentView === 'timecard' ? '' : 'text-gray-400'}`} style={currentView === 'timecard' ? { color: '#5bbd56' } : {}}>
                <div className="flex justify-center mb-1"><Icons.Clock /></div><p className="text-xs">打刻</p>
              </button>
            </>
          )}
        </div>
      </nav>

      {showModal && <Modal />}
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