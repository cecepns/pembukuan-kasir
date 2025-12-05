import React, { useState, useEffect } from 'react';
import { Banknote, Plus, X } from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';

const TarikTunai = () => {
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    bank: '',
    nominal_tarik: '',
    biaya_tarik: '',
    keterangan: ''
  });
  
  const [tarikTunai, setTarikTunai] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalSaldoKeseluruhan, setTotalSaldoKeseluruhan] = useState(0);
  const { user } = useAuth();

  const banks = [
    'BCA', 'BRI', 'Mandiri', 'BNI', 'CIMB', 'Danamon', 
    'BTN', 'BSI', 'Permata', 'OCBC NISP', 'Maybank'
  ];

  useEffect(() => {
    loadTarikTunai();
  }, [startDate, endDate]);

  const loadTarikTunai = async () => {
    try {
      let url = '/tarik-tunai';
      const params = new URLSearchParams();
      
      // Date filtering
      if (startDate) {
        params.append('startDate', startDate);
      }
      if (endDate) {
        params.append('endDate', endDate);
      }
      
      if (params.toString()) {
        url += '?' + params.toString();
      }
      
      const response = await api.get(url);
      setTarikTunai(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Error loading tarik tunai:', error);
      setTarikTunai([]);
    }
  };

  const loadTotalSaldoKeseluruhan = async () => {
    try {
      const response = await api.get('/saldo/total');
      setTotalSaldoKeseluruhan(response.total || 0);
    } catch (error) {
      console.error('Error loading total saldo:', error);
      setTotalSaldoKeseluruhan(0);
    }
  };

  useEffect(() => {
    loadTotalSaldoKeseluruhan();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/tarik-tunai', {
        ...formData,
        nominal_tarik: formData.nominal_tarik ? parseFloat(formData.nominal_tarik) : 0,
        biaya_tarik: formData.biaya_tarik ? parseFloat(formData.biaya_tarik) : 0,
      });
      
      setFormData({
        tanggal: new Date().toISOString().split('T')[0],
        bank: '',
        nominal_tarik: '',
        biaya_tarik: '',
        keterangan: ''
      });
      
      setShowForm(false);
      loadTarikTunai();
      loadTotalSaldoKeseluruhan();
      
      alert('Tarik tunai berhasil disimpan!');
    } catch (error) {
      console.error('Error saving tarik tunai:', error);
      alert('Gagal menyimpan tarik tunai');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center">
            <Banknote className="h-8 w-8 text-red-600 mr-3" />
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">Tarik Tunai</h2>
              <p className="text-gray-600">Kelola penarikan tunai dari berbagai bank</p>
            </div>
          </div>
          
          {user?.role !== 'owner' && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition duration-300 flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Tarik Tunai Baru
            </button>
          )}
        </div>
      </div>

      {/* Info Box */}
      {user?.role !== 'owner' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <Banknote className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Catatan Tarik Tunai</h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Nominal tarik akan mengurangi saldo</li>
                  <li>Biaya tarik akan menambah saldo (pendapatan)</li>
                  <li>Saldo boleh minus untuk transaksi tarik tunai</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Total Saldo Keseluruhan */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">TOTAL SALDO KESELURUHAN</h3>
        <div className="text-3xl font-bold text-green-600">
          {formatCurrency(totalSaldoKeseluruhan)}
        </div>
      </div>

      {/* Form Tarik Tunai */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Form Tarik Tunai</h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tanggal
                </label>
                <input
                  type="date"
                  value={formData.tanggal}
                  onChange={(e) => setFormData({...formData, tanggal: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bank
                </label>
                <input
                  type="text"
                  value={formData.bank}
                  onChange={(e) => setFormData({...formData, bank: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Nama Bank"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nominal Tarik
                </label>
                <input
                  type="text"
                  value={formData.nominal_tarik ? formatCurrency(parseInt(formData.nominal_tarik)) : ''}
                  onChange={(e) => {
                    const numeric = (e.target.value || '').replace(/[^0-9]/g, '');
                    setFormData({ ...formData, nominal_tarik: numeric });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Nominal yang ditarik"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Biaya Tarik
                </label>
                <input
                  type="text"
                  value={formData.biaya_tarik ? formatCurrency(parseInt(formData.biaya_tarik)) : ''}
                  onChange={(e) => {
                    const numeric = (e.target.value || '').replace(/[^0-9]/g, '');
                    setFormData({ ...formData, biaya_tarik: numeric });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Biaya tarik tunai"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Keterangan
              </label>
              <textarea
                value={formData.keterangan}
                onChange={(e) => setFormData({...formData, keterangan: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                rows="3"
                placeholder="Keterangan tarik tunai"
              />
            </div>

            {/* Impact Display */}
            {formData.nominal_tarik && formData.biaya_tarik && (
              <div className="bg-red-50 p-4 rounded-lg">
                <h4 className="font-semibold text-red-900 mb-2">Dampak pada Saldo:</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Nominal Tarik (mengurangi saldo):</span>
                    <span className="text-red-600">-{formatCurrency(parseInt(formData.nominal_tarik))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Biaya Tarik (menambah saldo):</span>
                    <span className="text-green-600">+{formatCurrency(parseInt(formData.biaya_tarik))}</span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between font-semibold">
                    <span>Total Dampak Saldo:</span>
                    <span className={parseInt(formData.biaya_tarik) - parseInt(formData.nominal_tarik) >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(parseInt(formData.biaya_tarik) - parseInt(formData.nominal_tarik))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition duration-300 disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan Tarik Tunai'}
              </button>
              
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition duration-300"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tarik Tunai List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Riwayat Tarik Tunai</h3>
            {/* Date Range Filter */}
            <div className="flex flex-wrap gap-4 items-center">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="mt-6 px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                  title="Reset Filter"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nominal Tarik
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Biaya Tarik
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Keterangan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tarikTunai.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(item.tanggal).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.bank}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                    -{formatCurrency(item.nominal_tarik)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                    +{formatCurrency(item.biaya_tarik)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.keterangan}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                      item.status === 'lunas' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {item.status || 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Ringkasan Tarik Tunai</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-red-600">Total Transaksi</div>
            <div className="text-xl md:text-2xl font-bold text-red-900">
              {tarikTunai.length}
            </div>
          </div>
          
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-red-600">Total Ditarik</div>
            <div className="text-xl md:text-2xl font-bold text-red-900">
              {formatCurrency(tarikTunai.reduce((total, item) => total + parseInt(item.nominal_tarik), 0))}
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-green-600">Total Biaya</div>
            <div className="text-xl md:text-2xl font-bold text-green-900">
              {formatCurrency(tarikTunai.reduce((total, item) => total + parseInt(item.biaya_tarik), 0))}
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-gray-600">TOTAL SALDO KESELURUHAN</div>
            <div className="text-xl md:text-2xl font-bold text-gray-900">
              {formatCurrency(totalSaldoKeseluruhan)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TarikTunai;