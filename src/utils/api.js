const BASE_URL = 'https://api-inventory.isavralabel.com/aplikasi-pembukuan-kasir';

class ApiService {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = localStorage.getItem('token');
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Request failed');
      }
      
      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  upload(endpoint, formData) {
    const token = localStorage.getItem('token');
    return fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: formData,
    });
  }
}

export const api = new ApiService(BASE_URL);

// Endpoint helpers
export const endpoints = {
  // Auth
  login: '/login',
  
  // Modal
  modal: '/modal',
  
  // Transfer
  transfer: '/transfer',
  transferFavorit: '/transfer-favorit',
  transferDebit: '/transfer-debit',
  
  // Tarik Tunai
  tarikTunai: '/tarik-tunai',
  
  // Laporan
  laporan: '/laporan',
  
  // User
  user: '/user',
  
  // Saldo
  saldoTotal: '/saldo/total',
  
  // Grafik
  grafikHarian: '/grafik/harian',
  grafikMingguan: '/grafik/mingguan',
  grafikBulanan: '/grafik/bulanan',
};