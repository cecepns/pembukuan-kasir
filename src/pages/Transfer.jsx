import React, { useState, useEffect } from 'react';
import { Trash as TransferIcon, Plus, Star, Printer, Download, CheckCircle, Edit, Search, X, BarChart3 } from 'lucide-react';
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
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const Transfer = () => {
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    bank_tujuan: '',
    nomor_rekening: '',
    nama_pemilik: '',
    nominal: '',
    biaya: '',
    total_uang: '',
    keterangan: ''
  });
  
  const [favorit, setFavorit] = useState([]);
  const [favoritSearch, setFavoritSearch] = useState('');
  const [transfers, setTransfers] = useState([]);
  const [transferSearch, setTransferSearch] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState(null);
  const [selectedCashier, setSelectedCashier] = useState('all');
  const [cashiers, setCashiers] = useState([]);
  const [periode, setPeriode] = useState('harian');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]); // For owner: filter by date
  const [grafikData, setGrafikData] = useState({
    harian: [],
    mingguan: [],
    bulanan: []
  });
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role === 'owner') {
      loadCashiers();
    }
  }, [user]);

  useEffect(() => {
    loadTransfers();
  }, [selectedCashier, pagination.page, dateFilter]);

  // Debounce search untuk mengurangi request
  useEffect(() => {
    const timer = setTimeout(() => {
      loadTransfers();
    }, 500);

    return () => clearTimeout(timer);
  }, [transferSearch]);

  useEffect(() => {
    loadFavorit();
  }, [favoritSearch]);

  useEffect(() => {
    loadGrafik();
  }, [periode, selectedCashier]);

  const loadTransfers = async () => {
    try {
      let url = '/transfer?';
      const params = new URLSearchParams();
      
      if (selectedCashier !== 'all' && user?.role === 'owner') {
        params.append('cashier_id', selectedCashier);
      }
      
      // For owner: filter by date (today or selected date)
      if (user?.role === 'owner' && dateFilter) {
        params.append('startDate', dateFilter);
        params.append('endDate', dateFilter);
      }
      
      if (transferSearch) {
        params.append('search', transferSearch);
      }
      
      params.append('page', pagination.page);
      params.append('limit', pagination.limit);
      
      url += params.toString();
      
      const response = await api.get(url);
      
      if (response.data && response.pagination) {
        let transfersData = Array.isArray(response.data) ? response.data : [];
        // For owner: only show today's or latest date transfers
        if (user?.role === 'owner') {
          // Filter to show only transfers from selected date
          transfersData = transfersData.filter(t => {
            const transferDate = new Date(t.tanggal).toISOString().split('T')[0];
            return transferDate === dateFilter;
          });
        }
        setTransfers(transfersData);
        setPagination(response.pagination);
      } else {
        // Fallback untuk response lama
        let transfersData = Array.isArray(response) ? response : [];
        if (user?.role === 'owner') {
          transfersData = transfersData.filter(t => {
            const transferDate = new Date(t.tanggal).toISOString().split('T')[0];
            return transferDate === dateFilter;
          });
        }
        setTransfers(transfersData);
      }
    } catch (error) {
      console.error('Error loading transfers:', error);
      setTransfers([]);
    }
  };

  const loadCashiers = async () => {
    try {
      const response = await api.get('/user');
      // Filter hanya kasir
      const kasirList = Array.isArray(response) ? response.filter(u => u.role === 'kasir') : [];
      setCashiers(kasirList);
    } catch (error) {
      console.error('Error loading cashiers:', error);
      setCashiers([]);
    }
  };

  const loadFavorit = async () => {
    try {
      let url = '/transfer-favorit';
      if (favoritSearch) {
        url += `?search=${encodeURIComponent(favoritSearch)}`;
      }
      const response = await api.get(url);
      setFavorit(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Error loading favorit:', error);
      setFavorit([]);
    }
  };

  const loadGrafik = async () => {
    try {
      const response = await api.get(`/transfer/grafik/${periode}`);
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
      if (editingTransfer) {
        // Update existing transfer
        await api.put(`/transfer/${editingTransfer.id}`, formData);
        alert('Transfer berhasil diupdate!');
        setEditingTransfer(null);
      } else {
        // Create new transfer
        await api.post('/transfer', formData);
        alert('Transfer berhasil disimpan!');
      }
      
      // Reset form
      setFormData({
        tanggal: new Date().toISOString().split('T')[0],
        bank_tujuan: '',
        nomor_rekening: '',
        nama_pemilik: '',
        nominal: '',
        biaya: '',
        total_uang: '',
        keterangan: ''
      });
      
      setShowForm(false);
      // Reset to first page after save
      setPagination(prev => ({ ...prev, page: 1 }));
      await loadTransfers();
      await loadFavorit();
    } catch (error) {
      console.error('Error saving transfer:', error);
      alert('Gagal menyimpan transfer');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (transfer) => {
    setEditingTransfer(transfer);
    setFormData({
      tanggal: transfer.tanggal,
      bank_tujuan: transfer.bank_tujuan,
      nomor_rekening: transfer.nomor_rekening,
      nama_pemilik: transfer.nama_pemilik,
      nominal: transfer.nominal,
      biaya: transfer.biaya,
      total_uang: '',
      keterangan: transfer.keterangan || ''
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingTransfer(null);
    setFormData({
      tanggal: new Date().toISOString().split('T')[0],
      bank_tujuan: '',
      nomor_rekening: '',
      nama_pemilik: '',
      nominal: '',
      biaya: '',
      total_uang: '',
      keterangan: ''
    });
    setShowForm(false);
  };

  const handleUseFavorit = (favItem) => {
    setFormData({
      ...formData,
      bank_tujuan: favItem.bank_tujuan,
      nomor_rekening: favItem.nomor_rekening,
      nama_pemilik: favItem.nama_pemilik
    });
    setShowForm(true);
  };

  const cetakStruk = (transfer) => {
    // Format untuk dot matrix printer (A4/4 atau A6)
    // Menggunakan format text sederhana yang bisa dicetak langsung ke dot matrix
    const receiptText = `
================================
        STRUK TRANSFER
================================

Tanggal: ${new Date(transfer.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}

Nama Bank Tujuan: ${transfer.bank_tujuan}

Nomor Rek Tujuan: ${transfer.nomor_rekening}

Nama Pemilik Rekening Tujuan: ${transfer.nama_pemilik}

Nominal: Rp ${Number(transfer.nominal).toLocaleString('id-ID')}

Total: Rp ${(Number(transfer.nominal) + Number(transfer.biaya)).toLocaleString('id-ID')}

Keterangan: ${transfer.keterangan || '-'}

================================
    Terima Kasih
================================
`;

    // Create PDF untuk preview/print
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 120] // A6 size untuk dot matrix
    });

    doc.setFontSize(12);
    doc.text('STRUK TRANSFER', 40, 10, { align: 'center' });
    
    let y = 20;
    doc.setFontSize(9);
    doc.text(`Tanggal: ${new Date(transfer.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, 5, y);
    y += 7;
    doc.text(`Nama Bank Tujuan: ${transfer.bank_tujuan}`, 5, y);
    y += 7;
    doc.text(`Nomor Rek Tujuan: ${transfer.nomor_rekening}`, 5, y);
    y += 7;
    doc.text(`Nama Pemilik Rekening Tujuan: ${transfer.nama_pemilik}`, 5, y);
    y += 7;
    doc.text(`Nominal: Rp ${Number(transfer.nominal).toLocaleString('id-ID')}`, 5, y);
    y += 7;
    doc.text(`Total: Rp ${(Number(transfer.nominal) + Number(transfer.biaya)).toLocaleString('id-ID')}`, 5, y);
    y += 7;
    doc.text(`Keterangan: ${transfer.keterangan || '-'}`, 5, y);
    
    // Print to dot matrix printer (membuka print dialog)
    // User bisa memilih EPSON LX-310 dari print dialog
    doc.autoPrint();
    doc.save(`struk-transfer-${transfer.id}.pdf`);
    
    // Alternative: Copy text to clipboard untuk paste ke printer software
    navigator.clipboard.writeText(receiptText).then(() => {
      console.log('Receipt text copied to clipboard');
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount);
  };

  const formatCurrencySimple = (amount) => {
    return `Rp ${Number(amount).toLocaleString('id-ID')}`;
  };

  const handleMarkAsLunas = async (transferId) => {
    if (!window.confirm('Apakah Anda yakin ingin menandai transfer ini sebagai LUNAS?')) {
      return;
    }

    try {
      await api.put(`/transfer/${transferId}/status`, { status: 'lunas' });
      alert('Status transfer berhasil diubah menjadi LUNAS');
      await loadTransfers();
    } catch (error) {
      console.error('Error updating transfer status:', error);
      alert('Gagal mengubah status transfer: ' + (error.message || 'Unknown error'));
    }
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleSearchChange = (value) => {
    setTransferSearch(value);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page on search
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(16);
    doc.text('Laporan Transfer', 105, y, { align: 'center' });
    y += 10;

    const periodeText = periode === 'harian' ? 'Harian' : periode === 'mingguan' ? 'Mingguan' : 'Bulanan';
    doc.setFontSize(12);
    doc.text(`Periode: ${periodeText}`, 105, y, { align: 'center' });
    y += 5;
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 105, y, { align: 'center' });
    y += 10;

    // Summary statistics
    const totalTransaksi = Array.isArray(grafikData[periode])
      ? grafikData[periode].reduce((sum, item) => sum + (parseInt(item.total) || 0), 0)
      : 0;
    const totalNominal = Array.isArray(grafikData[periode])
      ? grafikData[periode].reduce((sum, item) => sum + (parseFloat(item.total_nominal) || 0), 0)
      : 0;
    const totalBiaya = Array.isArray(grafikData[periode])
      ? grafikData[periode].reduce((sum, item) => sum + (parseFloat(item.total_biaya) || 0), 0)
      : 0;
    const totalAll = Array.isArray(grafikData[periode])
      ? grafikData[periode].reduce((sum, item) => sum + (parseFloat(item.total_all) || 0), 0)
      : 0;

    doc.setFontSize(10);
    doc.text(`Total Jumlah Transaksi: ${totalTransaksi}`, 14, y);
    y += 7;
    doc.text(`Total Nominal Transfer: ${formatCurrencySimple(totalNominal)}`, 14, y);
    y += 7;
    doc.text(`Total Biaya Admin: ${formatCurrencySimple(totalBiaya)}`, 14, y);
    y += 7;
    doc.text(`Total Keseluruhan: ${formatCurrencySimple(totalAll)}`, 14, y);
    y += 10;

    // Table header
    doc.setFontSize(9);
    doc.setFillColor(240, 240, 240);
    doc.rect(14, y, 180, 8, 'F');
    y += 6;
    doc.text('Tanggal', 16, y);
    doc.text('Jml Transaksi', 60, y);
    doc.text('Total Nominal', 100, y);
    doc.text('Total Biaya', 150, y);
    doc.text('Total', 180, y);
    y += 4;

    // Table rows
    doc.setFontSize(8);
    grafikData[periode]?.forEach((item, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.text(item.tanggal || '-', 16, y);
      doc.text(item.total?.toString() || '0', 60, y);
      doc.text(formatCurrencySimple(item.total_nominal || 0), 100, y);
      doc.text(formatCurrencySimple(item.total_biaya || 0), 150, y);
      doc.text(formatCurrencySimple(item.total_all || 0), 180, y);
      y += 6;
    });

    // Detail transfers if needed
    if (transfers.length > 0) {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      y += 5;
      doc.setFontSize(10);
      doc.text('Detail Transaksi (Sample):', 14, y);
      y += 7;

      doc.setFontSize(8);
      doc.setFillColor(240, 240, 240);
      doc.rect(14, y, 180, 8, 'F');
      y += 6;
      doc.text('Tanggal', 16, y);
      doc.text('Bank', 50, y);
      doc.text('Nominal', 100, y);
      doc.text('Biaya', 140, y);
      doc.text('Total', 170, y);
      y += 4;

      transfers.slice(0, 20).forEach((transfer) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(new Date(transfer.tanggal).toLocaleDateString('id-ID'), 16, y);
        doc.text(transfer.bank_tujuan?.substring(0, 15) || '-', 50, y);
        doc.text(formatCurrencySimple(transfer.nominal || 0), 100, y);
        doc.text(formatCurrencySimple(transfer.biaya || 0), 140, y);
        doc.text(formatCurrencySimple((transfer.nominal || 0) + (transfer.biaya || 0)), 170, y);
        y += 6;
      });
    }

    doc.save(`laporan-transfer-${periode}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportToExcel = () => {
    // Summary data
    const summaryData = [
      ['LAPORAN TRANSFER'],
      [`Periode: ${periode === 'harian' ? 'Harian' : periode === 'mingguan' ? 'Mingguan' : 'Bulanan'}`],
      [`Dicetak pada: ${new Date().toLocaleString('id-ID')}`],
      [''],
      ['RINGKASAN'],
      ['Total Jumlah Transaksi', Array.isArray(grafikData[periode])
        ? grafikData[periode].reduce((sum, item) => sum + (parseInt(item.total) || 0), 0)
        : 0],
      ['Total Nominal Transfer', Array.isArray(grafikData[periode])
        ? grafikData[periode].reduce((sum, item) => sum + (parseFloat(item.total_nominal) || 0), 0)
        : 0],
      ['Total Biaya Admin', Array.isArray(grafikData[periode])
        ? grafikData[periode].reduce((sum, item) => sum + (parseFloat(item.total_biaya) || 0), 0)
        : 0],
      ['Total Keseluruhan', Array.isArray(grafikData[periode])
        ? grafikData[periode].reduce((sum, item) => sum + (parseFloat(item.total_all) || 0), 0)
        : 0],
      [''],
      [''],
      ['DATA PERIODE'],
      ['Tanggal', 'Jumlah Transaksi', 'Total Nominal', 'Total Biaya', 'Total']
    ];

    // Add period data
    grafikData[periode]?.forEach(item => {
      summaryData.push([
        item.tanggal || '-',
        item.total || 0,
        item.total_nominal || 0,
        item.total_biaya || 0,
        item.total_all || 0
      ]);
    });

    summaryData.push(['']);
    summaryData.push(['']);
    summaryData.push(['DETAIL TRANSAKSI']);
    summaryData.push(['Tanggal', 'Bank', 'Nomor Rekening', 'Nama Pemilik', 'Nominal', 'Biaya', 'Total', 'Status']);

    // Add transfer details
    transfers.forEach(transfer => {
      summaryData.push([
        new Date(transfer.tanggal).toLocaleDateString('id-ID'),
        transfer.bank_tujuan || '-',
        transfer.nomor_rekening || '-',
        transfer.nama_pemilik || '-',
        transfer.nominal || 0,
        transfer.biaya || 0,
        (transfer.nominal || 0) + (transfer.biaya || 0),
        transfer.status || 'Pending'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Transfer');
    
    const periodeText = periode === 'harian' ? 'Harian' : periode === 'mingguan' ? 'Mingguan' : 'Bulanan';
    XLSX.writeFile(wb, `laporan-transfer-${periodeText}-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const total = formData.nominal && formData.biaya ? 
    Number(formData.nominal) + Number(formData.biaya) : 0;
  
  const kembalian = formData.total_uang && total > 0 ? 
    Number(formData.total_uang) - total : 0;

  const chartData = {
    labels: grafikData[periode]?.map(item => item.tanggal) || [],
    datasets: [
      {
        label: 'Jumlah Transaksi',
        data: grafikData[periode]?.map(item => item.total) || [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Total Nominal',
        data: grafikData[periode]?.map(item => item.total_nominal) || [],
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
        yAxisID: 'y1',
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
        text: `Grafik Transfer ${periode.charAt(0).toUpperCase() + periode.slice(1)}`,
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
          text: 'Total (Rp)'
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
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <TransferIcon className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">Transfer Uang</h2>
              <p className="text-gray-600">Proses transfer uang dan kelola favorit</p>
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
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-300 flex items-center"
              >
                <Plus className="h-5 w-5 mr-2" />
                Transfer Baru
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Form Transfer */}
      {showForm && user?.role !== 'owner' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingTransfer ? 'Edit Transfer' : 'Transfer Baru'}
            </h3>
            {editingTransfer && (
              <button
                onClick={handleCancelEdit}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bank Tujuan
                </label>
                <input
                  type="text"
                  value={formData.bank_tujuan}
                  onChange={(e) => setFormData({...formData, bank_tujuan: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Contoh: BCA, BRI, Mandiri"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nomor Rekening
                </label>
                <input
                  type="text"
                  value={formData.nomor_rekening}
                  onChange={(e) => setFormData({...formData, nomor_rekening: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Masukkan nomor rekening"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Pemilik Rekening
                </label>
                <input
                  type="text"
                  value={formData.nama_pemilik}
                  onChange={(e) => setFormData({...formData, nama_pemilik: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nama pemilik rekening"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nominal
                </label>
                <input
                  type="number"
                  value={formData.nominal}
                  onChange={(e) => setFormData({...formData, nominal: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nominal transfer"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Biaya Admin
                </label>
                <input
                  type="number"
                  value={formData.biaya}
                  onChange={(e) => setFormData({...formData, biaya: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Biaya admin"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total Uang (Uang Diterima)
                </label>
                <input
                  type="number"
                  value={formData.total_uang}
                  onChange={(e) => setFormData({...formData, total_uang: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Uang yang diterima dari customer"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
                placeholder="Keterangan transfer"
              />
            </div>

            {/* Total Display */}
            {total > 0 && (
              <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                <div className="text-lg font-semibold text-blue-900">
                  Total: {formatCurrency(total)}
                </div>
                <div className="text-sm text-blue-700">
                  Nominal: {formatCurrency(Number(formData.nominal || 0))} + 
                  Biaya: {formatCurrency(Number(formData.biaya || 0))}
                </div>
                {formData.total_uang && (
                  <>
                    <div className="text-sm text-blue-700">
                      Total Uang: {formatCurrency(Number(formData.total_uang || 0))}
                    </div>
                    {kembalian >= 0 ? (
                      <div className="text-sm font-semibold text-green-700">
                        Kembalian: {formatCurrency(kembalian)}
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-red-700">
                        Kurang: {formatCurrency(Math.abs(kembalian))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-300 disabled:opacity-50"
              >
                {loading ? (editingTransfer ? 'Mengupdate...' : 'Menyimpan...') : (editingTransfer ? 'Update Transfer' : 'Simpan Transfer')}
              </button>
              
              <button
                type="button"
                onClick={handleCancelEdit}
                className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition duration-300"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grafik Monitoring */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Grafik Monitoring Transfer
          </h3>
          <select
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-xs font-medium text-blue-600">Total Transaksi</div>
            <div className="text-lg font-bold text-blue-900">
              {Array.isArray(grafikData[periode]) 
                ? grafikData[periode].reduce((sum, item) => sum + (parseInt(item.total) || 0), 0)
                : 0}
            </div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="text-xs font-medium text-green-600">Total Nominal</div>
            <div className="text-lg font-bold text-green-900">
              {formatCurrency(
                Array.isArray(grafikData[periode])
                  ? grafikData[periode].reduce((sum, item) => sum + (parseFloat(item.total_nominal) || 0), 0)
                  : 0
              )}
            </div>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg">
            <div className="text-xs font-medium text-purple-600">Total Biaya</div>
            <div className="text-lg font-bold text-purple-900">
              {formatCurrency(
                Array.isArray(grafikData[periode])
                  ? grafikData[periode].reduce((sum, item) => sum + (parseFloat(item.total_biaya) || 0), 0)
                  : 0
              )}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-xs font-medium text-gray-600">Total Keseluruhan</div>
            <div className="text-lg font-bold text-gray-900">
              {formatCurrency(
                Array.isArray(grafikData[periode])
                  ? grafikData[periode].reduce((sum, item) => sum + (parseFloat(item.total_all) || 0), 0)
                  : 0
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Favorit */}
      {user?.role !== 'owner' && favorit.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Star className="h-5 w-5 text-yellow-500 mr-2" />
              Transfer Favorit
            </h3>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={favoritSearch}
                onChange={(e) => setFavoritSearch(e.target.value)}
                placeholder="Cari favorit..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorit.slice(0, 5).map((item, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="font-semibold text-gray-900">{item.nama_pemilik}</div>
                <div className="text-sm text-gray-600">{item.bank_tujuan}</div>
                <div className="text-sm text-gray-600">{item.nomor_rekening}</div>
                <button
                  onClick={() => handleUseFavorit(item)}
                  className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Gunakan
                </button>
              </div>
            ))}
          </div>
          {favorit.length === 0 && favoritSearch && (
            <p className="text-center text-gray-500 py-4">Tidak ada favorit yang ditemukan</p>
          )}
          {favorit.length > 5 && (
            <p className="text-center text-gray-500 py-2 text-sm">
              Menampilkan 5 favorit terbaru. Gunakan pencarian untuk mencari favorit lainnya.
            </p>
          )}
        </div>
      )}

      {/* Transfer List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {user?.role === 'owner' ? 'Riwayat Transfer Kasir' : 'Riwayat Transfer'}
            </h3>
            <div className="flex items-center space-x-4">
              {/* Date Filter for Owner */}
              {user?.role === 'owner' && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Filter Tanggal</label>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => {
                      setDateFilter(e.target.value);
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              {/* Search Transfer */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={transferSearch}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Cari transfer..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                />
              </div>
              {user?.role === 'owner' && cashiers.length > 0 && (
                <select
                  value={selectedCashier}
                  onChange={(e) => {
                    setSelectedCashier(e.target.value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  Bank & Rekening
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nama Pemilik
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nominal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transfers.map((transfer) => (
                <tr key={transfer.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(transfer.tanggal).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{transfer.bank_tujuan}</div>
                    <div className="text-sm text-gray-500">{transfer.nomor_rekening}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transfer.nama_pemilik}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(transfer.nominal)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(Number(transfer.nominal) + Number(transfer.biaya))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                      transfer.status === 'lunas' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {transfer.status || 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => cetakStruk(transfer)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Cetak Struk"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    {user?.role === 'owner' && (
                      <>
                        <button
                          onClick={() => handleEdit(transfer)}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="Edit Transfer"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {transfer.status === 'pending' && (
                          <button
                            onClick={() => handleMarkAsLunas(transfer.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Proses Menjadi Lunas"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="p-6 border-t flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Menampilkan {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} dari {pagination.total} transfer
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Sebelumnya
              </button>
              <span className="px-4 py-2 text-sm text-gray-700">
                Halaman {pagination.page} dari {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Transfer;