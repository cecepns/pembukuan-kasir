import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Download, BarChart3, X } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const TransferDebit = () => {
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    biaya: '',
    keterangan: ''
  });
  
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [periode, setPeriode] = useState('harian');
  const [cashiers, setCashiers] = useState([]);
  const [selectedCashier, setSelectedCashier] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalSaldoAllCashiers, setTotalSaldoAllCashiers] = useState(0);
  const [grafikData, setGrafikData] = useState({
    harian: [],
    mingguan: [],
    bulanan: []
  });
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role === 'owner') {
      loadCashiers();
      loadTotalSaldoAllCashiers();
    }
    loadTransfers();
    loadGrafik();
  }, [periode, selectedCashier, startDate, endDate]);

  const loadCashiers = async () => {
    try {
      const response = await api.get('/user');
      const kasirList = Array.isArray(response) 
        ? response.filter(u => u.role === 'kasir' && u.status === 'aktif')
        : [];
      setCashiers(kasirList);
    } catch (error) {
      console.error('Error loading cashiers:', error);
      setCashiers([]);
    }
  };

  const loadTotalSaldoAllCashiers = async () => {
    try {
      const response = await api.get('/saldo/total');
      setTotalSaldoAllCashiers(response.total || 0);
    } catch (error) {
      console.error('Error loading total saldo:', error);
      setTotalSaldoAllCashiers(0);
    }
  };

  const loadTransfers = async () => {
    try {
      let url = '/transfer-debit';
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
      let transfersData = Array.isArray(response) ? response : [];
      
      // Filter by cashier on frontend if owner
      if (user?.role === 'owner' && selectedCashier !== 'all') {
        transfersData = transfersData.filter(t => t.user_id === parseInt(selectedCashier));
      }
      
      setTransfers(transfersData);
    } catch (error) {
      console.error('Error loading transfer debit:', error);
      setTransfers([]);
    }
  };

  const loadGrafik = async () => {
    try {
      const response = await api.get(`/transfer-debit/grafik/${periode}`);
      setGrafikData(prev => ({
        ...prev,
        [periode]: Array.isArray(response) ? response : []
      }));
    } catch (error) {
      console.error('Error loading grafik:', error);
      setGrafikData(prev => ({
        ...prev,
        [periode]: []
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/transfer-debit', formData);
      
      setFormData({
        tanggal: new Date().toISOString().split('T')[0],
        biaya: '',
        keterangan: ''
      });
      
      setShowForm(false);
      loadTransfers();
      
      alert('Transfer debit berhasil disimpan!');
    } catch (error) {
      console.error('Error saving transfer debit:', error);
      alert('Gagal menyimpan transfer debit');
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

  const getKasirName = (transfer) => {
    // First try to get from kasir_name (from backend JOIN)
    if (transfer.kasir_name) {
      return transfer.kasir_name;
    }
    // Fallback: find from cashiers list
    if (transfer.user_id && cashiers.length > 0) {
      const cashier = cashiers.find(c => c.id === transfer.user_id);
      return cashier ? cashier.username : 'N/A';
    }
    return 'N/A';
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(16);
    doc.text('Laporan Transfer Debit', 14, y);
    y += 10;

    doc.setFontSize(10);
    const periodeText = periode === 'harian' ? 'Harian' : periode === 'mingguan' ? 'Mingguan' : 'Bulanan';
    doc.text(`Periode: ${periodeText}`, 14, y);
    y += 5;
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, y);
    y += 10;

    // Table header
    doc.setFontSize(9);
    doc.setFillColor(240, 240, 240);
    doc.rect(14, y, 180, 8, 'F');
    y += 6;
    doc.text('No', 16, y);
    doc.text('Tanggal', 30, y);
    doc.text('Biaya', 80, y);
    doc.text('Keterangan', 120, y);
    y += 4;

    // Table rows
    doc.setFontSize(8);
    transfers.forEach((transfer, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.text((index + 1).toString(), 16, y);
      doc.text(new Date(transfer.tanggal).toLocaleDateString('id-ID'), 30, y);
      doc.text(formatCurrency(transfer.biaya), 80, y);
      doc.text(transfer.keterangan.substring(0, 40), 120, y);
      y += 6;
    });

    // Total
    y += 5;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    const totalBiaya = transfers.reduce((total, t) => total + Number(t.biaya), 0);
    doc.text(`Total Biaya: ${formatCurrency(totalBiaya)}`, 14, y);

    doc.save(`laporan-transfer-debit-${periode}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportToExcel = () => {
    const data = transfers.map((transfer, index) => ({
      'No': index + 1,
      'Tanggal': new Date(transfer.tanggal).toLocaleDateString('id-ID'),
      'Biaya': transfer.biaya,
      'Keterangan': transfer.keterangan,
      'Status': transfer.status || 'Pending'
    }));

    const totalBiaya = transfers.reduce((total, t) => total + Number(t.biaya), 0);
    data.push({
      'No': '',
      'Tanggal': '',
      'Biaya': totalBiaya,
      'Keterangan': 'TOTAL',
      'Status': ''
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transfer Debit');
    
    const periodeText = periode === 'harian' ? 'Harian' : periode === 'mingguan' ? 'Mingguan' : 'Bulanan';
    XLSX.writeFile(wb, `laporan-transfer-debit-${periodeText}-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const chartData = {
    labels: grafikData[periode]?.map(item => item.tanggal) || [],
    datasets: [
      {
        label: 'Total Transaksi',
        data: grafikData[periode]?.map(item => item.total) || [],
        borderColor: 'rgb(147, 51, 234)',
        backgroundColor: 'rgba(147, 51, 234, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Total Biaya',
        data: grafikData[periode]?.map(item => item.total_biaya) || [],
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        tension: 0.4,
        yAxisID: 'y1',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: `Grafik Transfer Debit ${periode.charAt(0).toUpperCase() + periode.slice(1)}`,
      },
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Jumlah Transaksi'
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Total Biaya (Rp)'
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center">
            <CreditCard className="h-8 w-8 text-purple-600 mr-3" />
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">Transfer Pakai Kartu Debit</h2>
              <p className="text-gray-600">Kelola transfer menggunakan kartu debit</p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={exportToPDF}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-300 flex items-center"
            >
              <Download className="h-5 w-5 mr-2" />
              Export PDF
            </button>
            <button
              onClick={exportToExcel}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-300 flex items-center"
            >
              <Download className="h-5 w-5 mr-2" />
              Export Excel
            </button>
            {user?.role !== 'owner' && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition duration-300 flex items-center"
              >
                <Plus className="h-5 w-5 mr-2" />
                Transfer Debit Baru
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <CreditCard className="h-5 w-5 text-purple-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-purple-800">Catatan Transfer Debit</h3>
            <div className="mt-2 text-sm text-purple-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Hanya biaya yang akan menambah total saldo</li>
                <li>Nominal transfer tidak dihitung dalam saldo</li>
                <li>Biaya ini merupakan pendapatan dari jasa transfer debit</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Form Transfer Debit */}
      {showForm && user?.role !== 'owner' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Form Transfer Debit</h3>
          
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Biaya Transfer Debit
                </label>
                <input
                  type="text"
                  value={formData.biaya ? formatCurrency(parseFloat(formData.biaya)) : ''}
                  onChange={(e) => {
                    const numeric = (e.target.value || '').replace(/[^0-9]/g, '');
                    setFormData({ ...formData, biaya: numeric });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Masukkan biaya transfer"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows="3"
                placeholder="Keterangan transfer debit"
                required
              />
            </div>

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition duration-300 disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan Transfer Debit'}
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

      {/* Transfer List - Moved before Grafik for Owner */}
      {user?.role === 'owner' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Riwayat Transfer Debit Kasir</h3>
              <div className="flex flex-wrap gap-4 items-end">
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
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                {cashiers.length > 0 && (
                  <select
                    value={selectedCashier}
                    onChange={(e) => {
                      setSelectedCashier(e.target.value);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">Semua Kasir</option>
                    {cashiers.map((cashier) => (
                      <option key={cashier.id} value={cashier.id}>
                        {cashier.username}
                      </option>
                    ))}
                  </select>
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
                    Kasir
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Biaya
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Keterangan
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transfers.map((transfer) => (
                  <tr key={transfer.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(transfer.tanggal).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getKasirName(transfer)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(transfer.biaya)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transfer.keterangan}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grafik Monitoring */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Grafik Monitoring Transfer Debit
          </h3>
          <select
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="harian">Harian</option>
            <option value="mingguan">Mingguan</option>
            <option value="bulanan">Bulanan</option>
          </select>
        </div>
        <div className="h-64 mb-4">
          <Line data={chartData} options={chartOptions} />
        </div>
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
          <div className="bg-purple-50 p-3 rounded-lg">
            <div className="text-xs font-medium text-purple-600">Total Transaksi</div>
            <div className="text-lg font-bold text-purple-900">
              {grafikData[periode]?.reduce((sum, item) => sum + (item.total || 0), 0) || 0}
            </div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="text-xs font-medium text-green-600">Total Biaya</div>
            <div className="text-lg font-bold text-green-900">
              {formatCurrency(grafikData[periode]?.reduce((sum, item) => sum + (item.total_biaya || 0), 0) || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Transfer List - For Kasir only, or show saldo for owner */}
      {user?.role !== 'owner' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Riwayat Transfer Debit</h3>
              {/* Date Range Filter */}
              <div className="flex items-center space-x-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Dari Tanggal</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                    Biaya
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Keterangan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dibuat
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transfers.map((transfer) => (
                  <tr key={transfer.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(transfer.tanggal).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(transfer.biaya)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transfer.keterangan}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        transfer.status === 'lunas' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {transfer.status || 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(transfer.created_at).toLocaleDateString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Saldo Seluruh Kasir for Owner */}
      {user?.role === 'owner' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Saldo Seluruh Kasir</h3>
          <div className="text-3xl font-bold text-purple-600">
            {formatCurrency(totalSaldoAllCashiers)}
          </div>
          <p className="text-gray-600 mt-2">
            Total saldo dari semua kasir
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Ringkasan Transfer Debit</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-purple-600">Total Transaksi</div>
            <div className="text-xl md:text-2xl font-bold text-purple-900">
              {transfers.length}
            </div>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-purple-600">Total Biaya</div>
            <div className="text-xl md:text-2xl font-bold text-purple-900">
              {formatCurrency(transfers.reduce((total, transfer) => total + parseInt(transfer.biaya), 0))}
            </div>
          </div>

          {user?.role === 'owner' ? (
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-purple-600">Saldo Seluruh Kasir</div>
              <div className="text-xl md:text-2xl font-bold text-purple-900">
                {formatCurrency(totalSaldoAllCashiers)}
              </div>
            </div>
          ) : (
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-purple-600">Status Lunas</div>
              <div className="text-xl md:text-2xl font-bold text-purple-900">
                {transfers.filter(t => t.status === 'lunas').length}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransferDebit;