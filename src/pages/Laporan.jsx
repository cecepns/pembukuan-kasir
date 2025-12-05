import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, Filter } from 'lucide-react';
import { api } from '../utils/api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

const Laporan = () => {
  const [laporan, setLaporan] = useState({
    totalDeposit: 0,
    totalTransfer: 0,
    totalBiayaTransfer: 0,
    totalBiayaTransferDebit: 0,
    totalTarikTunai: 0,
    totalBiayaTarikTunai: 0,
    sisaSaldo: 0
  });
  
  const [filter, setFilter] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    type: 'all'
  });
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLaporan();
  }, [filter]);

  const loadLaporan = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/laporan?startDate=${filter.startDate}&endDate=${filter.endDate}&type=${filter.type}`);
      setLaporan(response || {
        totalDeposit: 0,
        totalTransfer: 0,
        totalBiayaTransfer: 0,
        totalBiayaTransferDebit: 0,
        totalTarikTunai: 0,
        totalBiayaTarikTunai: 0,
        sisaSaldo: 0
      });
    } catch (error) {
      console.error('Error loading laporan:', error);
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

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('LAPORAN PEMBUKUAN KASIR', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Periode: ${filter.startDate} s/d ${filter.endDate}`, 105, 30, { align: 'center' });
    
    let y = 50;
    
    const data = [
      ['TOTAL SALDO APLIKASI TERPAKAI (1-7)', formatCurrency(laporan.totalDeposit)],
      ['Total Transfer', formatCurrency(laporan.totalTransfer)],
      ['Total Biaya Transfer', formatCurrency(laporan.totalBiayaTransfer)],
      ['Total Biaya Transfer Debit', formatCurrency(laporan.totalBiayaTransferDebit)],
      ['Total Tarik Tunai', formatCurrency(laporan.totalTarikTunai)],
      ['Total Biaya Tarik Tunai', formatCurrency(laporan.totalBiayaTarikTunai)],
      ['', ''],
      ['TOTAL SALDO KESELURUHAN', formatCurrency(laporan.sisaSaldo)]
    ];
    
    data.forEach(([label, value]) => {
      doc.text(label, 20, y);
      doc.text(value, 120, y);
      y += 10;
    });
    
    doc.save(`laporan-${filter.startDate}-${filter.endDate}.pdf`);
  };

  const exportToExcel = () => {
    const data = [
      ['Laporan Pembukuan Kasir'],
      [`Periode: ${filter.startDate} s/d ${filter.endDate}`],
      [''],
      ['Keterangan', 'Jumlah'],
      ['TOTAL SALDO APLIKASI TERPAKAI (1-7)', laporan.totalDeposit],
      ['Total Transfer', laporan.totalTransfer],
      ['Total Biaya Transfer', laporan.totalBiayaTransfer],
      ['Total Biaya Transfer Debit', laporan.totalBiayaTransferDebit],
      ['Total Tarik Tunai', laporan.totalTarikTunai],
      ['Total Biaya Tarik Tunai', laporan.totalBiayaTarikTunai],
      [''],
      ['TOTAL SALDO KESELURUHAN', laporan.sisaSaldo]
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan');
    
    XLSX.writeFile(wb, `laporan-${filter.startDate}-${filter.endDate}.xlsx`);
  };

  const laporanItems = [
    {
      title: 'TOTAL SALDO APLIKASI TERPAKAI (1-7)',
      value: laporan.totalDeposit,
      color: 'bg-green-500',
      textColor: 'text-green-600'
    },
    {
      title: 'Total Transfer',
      value: laporan.totalTransfer,
      color: 'bg-blue-500',
      textColor: 'text-blue-600'
    },
    {
      title: 'Total Biaya Transfer',
      value: laporan.totalBiayaTransfer,
      color: 'bg-purple-500',
      textColor: 'text-purple-600'
    },
    {
      title: 'Total Biaya Transfer Debit',
      value: laporan.totalBiayaTransferDebit,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-600'
    },
    {
      title: 'Total Tarik Tunai',
      value: laporan.totalTarikTunai,
      color: 'bg-red-500',
      textColor: 'text-red-600'
    },
    {
      title: 'Total Biaya Tarik Tunai',
      value: laporan.totalBiayaTarikTunai,
      color: 'bg-orange-500',
      textColor: 'text-orange-600'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">Laporan Pembukuan</h2>
              <p className="text-gray-600">Laporan keuangan lengkap dengan export PDF dan Excel</p>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={exportToPDF}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition duration-300 flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              PDF
            </button>
            
            <button
              onClick={exportToExcel}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-300 flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Excel
            </button>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Filter className="h-5 w-5 mr-2" />
          Filter Laporan
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tanggal Mulai
            </label>
            <input
              type="date"
              value={filter.startDate}
              onChange={(e) => setFilter({...filter, startDate: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tanggal Selesai
            </label>
            <input
              type="date"
              value={filter.endDate}
              onChange={(e) => setFilter({...filter, endDate: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Jenis Laporan
            </label>
            <select
              value={filter.type}
              onChange={(e) => setFilter({...filter, type: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">Semua Transaksi</option>
              <option value="transfer">Transfer Saja</option>
              <option value="tarik_tunai">Tarik Tunai Saja</option>
              <option value="modal">Modal Saja</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Memuat laporan...</p>
        </div>
      )}

      {/* Laporan Cards */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {laporanItems.map((item, index) => (
            <div key={index} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className={`${item.color} p-3 rounded-lg`}>
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{item.title}</p>
                  <p className={`text-xl font-bold ${item.textColor}`}>
                    {formatCurrency(item.value)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sisa Saldo */}
      {!loading && (
        <div className="bg-gradient-to-r from-green-600 to-green-800 rounded-lg shadow p-6 text-white">
          <h3 className="text-xl md:text-2xl font-bold mb-2">TOTAL SALDO KESELURUHAN</h3>
          <div className="text-4xl font-bold">
            {formatCurrency(laporan.sisaSaldo)}
          </div>
          <p className="text-green-100 mt-2">
            Periode: {filter.startDate} s/d {filter.endDate}
          </p>
        </div>
      )}

      {/* Summary Table */}
      {!loading && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Detail Laporan</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Keterangan
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Masuk (+)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Keluar (-)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    TOTAL SALDO APLIKASI TERPAKAI (1-7)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right">
                    {formatCurrency(laporan.totalDeposit)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    -
                  </td>
                </tr>
                
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Total Transfer
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right">
                    {formatCurrency(laporan.totalTransfer)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    -
                  </td>
                </tr>
                
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Biaya Transfer
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right">
                    {formatCurrency(laporan.totalBiayaTransfer)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    -
                  </td>
                </tr>
                
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Biaya Transfer Debit
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right">
                    {formatCurrency(laporan.totalBiayaTransferDebit)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    -
                  </td>
                </tr>
                
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Total Tarik Tunai
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    -
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right">
                    {formatCurrency(laporan.totalTarikTunai)}
                  </td>
                </tr>
                
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Biaya Tarik Tunai
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right">
                    {formatCurrency(laporan.totalBiayaTarikTunai)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    -
                  </td>
                </tr>
                
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    TOTAL SALDO KESELURUHAN
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right" colSpan="2">
                    {formatCurrency(laporan.sisaSaldo)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Laporan;