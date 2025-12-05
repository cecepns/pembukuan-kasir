import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  BarChart3 
} from 'lucide-react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const Dashboard = () => {
  const [saldoTotal, setSaldoTotal] = useState(0);
  const [modalKasTotal, setModalKasTotal] = useState(0);
  const [ringkasan, setRingkasan] = useState({
    totalDeposit: 0,
    totalTransfer: 0,
    totalBiayaTransfer: 0,
    totalBiayaTransferDebit: 0,
    totalTarikTunai: 0,
    totalBiayaTarikTunai: 0
  });
  const [grafikData, setGrafikData] = useState({
    harian: [],
    mingguan: [],
    bulanan: []
  });
  const [periode, setPeriode] = useState('harian');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load saldo total
      const saldoResponse = await api.get('/saldo/total');
      setSaldoTotal(saldoResponse.total || 0);

      // For owner role: Load modal_kas total from all kasirs
      if (user?.role === 'owner') {
        try {
          const modalResponse = await api.get('/modal');
          const modalData = Array.isArray(modalResponse) ? modalResponse : [];
          // Get latest modal_kas for each user_id
          const modalKasMap = new Map();
          modalData
            .filter(m => m.modal_type === 'modal_kas')
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .forEach(m => {
              if (!modalKasMap.has(m.user_id)) {
                modalKasMap.set(m.user_id, parseFloat(m.nominal) || 0);
              }
            });
          const totalModalKas = Array.from(modalKasMap.values()).reduce((sum, val) => sum + val, 0);
          setModalKasTotal(totalModalKas);
        } catch (error) {
          console.error('Error loading modal kas:', error);
          setModalKasTotal(0);
        }
      }

      // Load ringkasan transaksi
      const laporanResponse = await api.get('/laporan');
      setRingkasan(laporanResponse || {
        totalDeposit: 0,
        totalTransfer: 0,
        totalBiayaTransfer: 0,
        totalBiayaTransferDebit: 0,
        totalTarikTunai: 0,
        totalBiayaTarikTunai: 0
      });

      // Load data grafik
      const [harianResponse, mingguanResponse, bulananResponse] = await Promise.all([
        api.get('/grafik/harian'),
        api.get('/grafik/mingguan'),
        api.get('/grafik/bulanan')
      ]);

      setGrafikData({
        harian: Array.isArray(harianResponse) ? harianResponse : [],
        mingguan: Array.isArray(mingguanResponse) ? mingguanResponse : [],
        bulanan: Array.isArray(bulananResponse) ? bulananResponse : []
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
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

  // Different stat cards for owner vs kasir
  const statCards = user?.role === 'owner' ? [
    {
      title: 'TOTAL KESELURUHAN SALDO KASIR',
      value: saldoTotal,
      icon: DollarSign,
      color: 'bg-blue-500',
      textColor: 'text-blue-600'
    },
    {
      title: 'TOTAL MODAL APLIKASI 7/ MODAL KAS Seluruh Kasir',
      value: modalKasTotal,
      icon: TrendingUp,
      color: 'bg-green-500',
      textColor: 'text-green-600'
    },
    {
      title: 'Total Transfer Seluruh Kasir',
      value: ringkasan.totalTransfer,
      icon: CreditCard,
      color: 'bg-purple-500',
      textColor: 'text-purple-600'
    },
    {
      title: 'Total Tarik Tunai Seluruh Kasir',
      value: ringkasan.totalTarikTunai,
      icon: TrendingDown,
      color: 'bg-red-500',
      textColor: 'text-red-600'
    },
    {
      title: 'Total Biaya Tarik Tunai Seluruh Kasir',
      value: ringkasan.totalBiayaTarikTunai,
      icon: TrendingUp,
      color: 'bg-orange-500',
      textColor: 'text-orange-600'
    },
    {
      title: 'Total Biaya Transfer Pakai Kartu Debit Seluruh Kasir',
      value: ringkasan.totalBiayaTransferDebit,
      icon: CreditCard,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-600'
    }
  ] : [
    {
      title: 'Total Saldo',
      value: saldoTotal,
      icon: DollarSign,
      color: 'bg-blue-500',
      textColor: 'text-blue-600'
    },
    {
      title: 'Total Deposit',
      value: ringkasan.totalDeposit,
      icon: TrendingUp,
      color: 'bg-green-500',
      textColor: 'text-green-600'
    },
    {
      title: 'Total Transfer',
      value: ringkasan.totalTransfer,
      icon: CreditCard,
      color: 'bg-purple-500',
      textColor: 'text-purple-600'
    },
    {
      title: 'Total Tarik Tunai',
      value: ringkasan.totalTarikTunai,
      icon: TrendingDown,
      color: 'bg-red-500',
      textColor: 'text-red-600'
    }
  ];

  const chartData = {
    labels: grafikData[periode]?.map(item => item.tanggal) || [],
    datasets: [
      {
        label: 'Total Transaksi',
        data: grafikData[periode]?.map(item => item.total) || [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
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
        text: `Grafik Transaksi ${periode.charAt(0).toUpperCase() + periode.slice(1)}`,
      },
    },
  };

  const doughnutData = {
    labels: ['Transfer', 'Tarik Tunai', 'Biaya Transfer', 'Biaya Tarik Tunai'],
    datasets: [
      {
        data: [
          ringkasan.totalTransfer,
          ringkasan.totalTarikTunai,
          ringkasan.totalBiayaTransfer + ringkasan.totalBiayaTransferDebit,
          ringkasan.totalBiayaTarikTunai
        ],
        backgroundColor: [
          '#8B5CF6',
          '#EF4444',
          '#F59E0B',
          '#10B981'
        ],
      },
    ],
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Message */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 text-white">
        <h2 className="text-xl md:text-2xl font-bold mb-2">
          Selamat datang, {user?.username}!
        </h2>
        <p className="text-blue-100">
          {user?.role === 'owner' 
            ? 'Ini adalah ringkasan aktivitas pembukuan seluruh kasir.' 
            : 'Ini adalah ringkasan aktivitas pembukuan kasir Anda hari ini.'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${user?.role === 'owner' ? 'lg:grid-cols-3' : ''} gap-6`}>
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className={`text-xl md:text-2xl font-bold ${stat.textColor}`}>
                  {formatCurrency(stat.value)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Grafik Transaksi</h3>
            <select
              value={periode}
              onChange={(e) => setPeriode(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value="harian">Harian</option>
              <option value="mingguan">Mingguan</option>
              <option value="bulanan">Bulanan</option>
            </select>
          </div>
          <Line data={chartData} options={chartOptions} />
        </div>

        {/* Doughnut Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Distribusi Transaksi
          </h3>
          <div className="w-full h-64">
            <Doughnut data={doughnutData} />
          </div>
        </div>
      </div>

      {/* Detailed Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Ringkasan Detail
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Total Biaya Transfer</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(ringkasan.totalBiayaTransfer)}
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Total Biaya Transfer Debit</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(ringkasan.totalBiayaTransferDebit)}
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Total Biaya Tarik Tunai</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(ringkasan.totalBiayaTarikTunai)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;