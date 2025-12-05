import React, { useState, useEffect } from 'react';
import { PlusCircle, PencilIcon, Save, X } from 'lucide-react';
import Select from 'react-select';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';

const ModalInput = () => {
  const [modalData, setModalData] = useState([]);
  const [modalHistory, setModalHistory] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editingHistoryId, setEditingHistoryId] = useState(null);
  const [editHistoryValue, setEditHistoryValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [cashiers, setCashiers] = useState([]);
  const [selectedCashier, setSelectedCashier] = useState(null);
  const [modalKasInput, setModalKasInput] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [totalSaldoKeseluruhan, setTotalSaldoKeseluruhan] = useState(0);
  const { user } = useAuth();

  const modalApps = [
    { id: 'karangsari', name: 'Aplikasi-1 / KARANGSARI', label: 'KARANGSARI', color: 'bg-blue-500' },
    { id: 'fastpay', name: 'Aplikasi-2 / FASTPAY', label: 'FASTPAY', color: 'bg-green-500' },
    { id: 'mmbc', name: 'Aplikasi-3 / MMBC', label: 'MMBC', color: 'bg-purple-500' },
    { id: 'payfazz', name: 'Aplikasi-4 / PAYFAZZ', label: 'PAYFAZZ', color: 'bg-orange-500' },
    { id: 'posfin', name: 'Aplikasi-5 / POSFIN', label: 'POSFIN', color: 'bg-red-500' },
    { id: 'buku_agen', name: 'Aplikasi-6 / BUKU AGEN/BUKU WARUNG', label: 'BUKU AGEN/BUKU WARUNG', color: 'bg-yellow-500' },
    // Aplikasi-7 / MODAL KAS selalu ditampilkan.
    // Untuk kasir bersifat read-only (diinput oleh owner/admin).
    { id: 'modal_kas', name: 'Aplikasi-7 / MODAL KAS', label: 'MODAL KAS', color: 'bg-gray-600' }
  ];

  useEffect(() => {
    loadModalData();
    loadModalHistory();
    loadTotalSaldoKeseluruhan();
    if (user?.role === 'owner') {
      loadCashiers();
    }
  }, []);

  const loadTotalSaldoKeseluruhan = async () => {
    try {
      const response = await api.get('/saldo/total');
      setTotalSaldoKeseluruhan(response.total || 0);
    } catch (error) {
      console.error('Error loading total saldo:', error);
      setTotalSaldoKeseluruhan(0);
    }
  };

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

  const loadModalData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/modal');
      setModalData(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Error loading modal data:', error);
      setModalData([]);
    } finally {
      setLoading(false);
    }
  };

  const loadModalHistory = async () => {
    try {
      const response = await api.get('/modal/history');
      // For owner, filter only modal_kas
      let history = Array.isArray(response) ? response : [];
      if (user?.role === 'owner') {
        history = history.filter(m => m.modal_type === 'modal_kas');
      }
      setModalHistory(history);
    } catch (error) {
      console.error('Error loading modal history:', error);
      setModalHistory([]);
    }
  };

  const handleEdit = (id, currentValue) => {
    setEditingId(id);
    setEditValue(currentValue.toString());
  };

  const handleSave = async (modalType, targetUserId = null) => {
    if (user?.role === 'owner' && modalType === 'modal_kas') {
      // For owner adding modal kas to kasir
      if (!selectedCashier) {
        alert('Pilih kasir terlebih dahulu');
        return;
      }
      if (!modalKasInput || isNaN(modalKasInput)) {
        alert('Nominal harus berupa angka yang valid');
        return;
      }
      const nominal = parseFloat(modalKasInput);
      if (nominal <= 0) {
        alert('Nominal harus lebih dari 0');
        return;
      }

      try {
        setSaving(true);
        // We need to send as owner but for specific kasir
        // Since API uses req.user.id, we need backend to support user_id in body for owner
        await api.post('/modal', {
          modal_type: 'modal_kas',
          nominal: nominal,
          user_id: selectedCashier.value // Send target user_id for owner
        });
        
        setSelectedCashier(null);
        setModalKasInput('');
        setShowForm(false);
        await loadModalData();
        await loadModalHistory();
        await loadTotalSaldoKeseluruhan();
        alert('Modal Kas berhasil ditambahkan untuk kasir');
      } catch (error) {
        console.error('Error saving modal kas:', error);
        alert('Gagal menyimpan data modal kas');
      } finally {
        setSaving(false);
      }
      return;
    }

    // Original logic for kasir
    if (!editValue || isNaN(editValue)) {
      alert('Nominal harus berupa angka yang valid');
      return;
    }

    const nominal = parseFloat(editValue);
    
    if (modalType === 'modal_kas' && nominal === 0) {
      alert('Modal Kas tidak perlu diisi jika nominal 0');
      return;
    }

    try {
      setSaving(true);
      await api.post('/modal', {
        modal_type: modalType,
        nominal: parseFloat(editValue)
      });
      
      setEditingId(null);
      setEditValue('');
      loadModalData();
      loadModalHistory();
    } catch (error) {
      console.error('Error saving modal:', error);
      alert('Gagal menyimpan data modal');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue('');
    setShowForm(false);
    setSelectedCashier(null);
    setModalKasInput('');
  };

  const handleEditHistory = (id, currentValue) => {
    setEditingHistoryId(id);
    setEditHistoryValue(currentValue.toString());
  };

  const handleUpdateHistory = async (historyId) => {
    if (!editHistoryValue || isNaN(editHistoryValue)) {
      alert('Nominal harus berupa angka yang valid');
      return;
    }

    const nominal = parseFloat(editHistoryValue);

    try {
      setSaving(true);
      await api.put(`/modal/${historyId}`, {
        nominal: nominal
      });
      
      setEditingHistoryId(null);
      setEditHistoryValue('');
      loadModalData();
      loadModalHistory();
      alert('Modal berhasil diupdate');
    } catch (error) {
      console.error('Error updating modal:', error);
      alert(error.message || 'Gagal mengupdate data modal');
    } finally {
      setSaving(false);
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

  const handleRupiahInputChange = (setter) => (e) => {
    const raw = e.target.value || '';
    const numeric = raw.replace(/[^0-9]/g, '');
    setter(numeric);
  };

  const handleCancelHistoryEdit = () => {
    setEditingHistoryId(null);
    setEditHistoryValue('');
  };

  const getCurrentValue = (modalType, userId = null) => {
    let modals;
    if (user?.role === 'kasir') {
      modals = modalData.filter(m => m.modal_type === modalType && m.user_id === user.id);
    } else if (user?.role === 'owner' && userId) {
      modals = modalData.filter(m => m.modal_type === modalType && m.user_id === userId);
    } else {
      modals = modalData.filter(m => m.modal_type === modalType);
    }
    
    const sorted = modals.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return sorted.length > 0 ? parseFloat(sorted[0].nominal) : 0;
  };

  const getTotalSaldoDeposit = () => {
    let total = 0;
    if (user?.role === 'kasir') {
      total = modalHistory
        .filter(m => m.user_id === user.id)
        .reduce((sum, m) => sum + parseFloat(m.nominal || 0), 0);
    } else {
      total = modalHistory.reduce((sum, m) => sum + parseFloat(m.nominal || 0), 0);
    }
    return total;
  };

  const getTotalModalKasAllCashiers = () => {
    if (user?.role !== 'owner') return 0;
    const modalKasMap = new Map();
    modalData
      .filter(m => m.modal_type === 'modal_kas')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .forEach(m => {
        if (!modalKasMap.has(m.user_id)) {
          modalKasMap.set(m.user_id, parseFloat(m.nominal) || 0);
        }
      });
    return Array.from(modalKasMap.values()).reduce((sum, val) => sum + val, 0);
  };


  const getModalTypeLabel = (modalType) => {
    const app = modalApps.find(a => a.id === modalType);
    return app ? app.label : modalType.toUpperCase();
  };

  // Owner-specific: Get modal kas per kasir
  const getModalKasByCashier = () => {
    const kasirMap = new Map();
    cashiers.forEach(cashier => {
      kasirMap.set(cashier.id, {
        id: cashier.id,
        username: cashier.username,
        modalKas: 0
      });
    });

    modalData
      .filter(m => m.modal_type === 'modal_kas')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .forEach(m => {
        if (kasirMap.has(m.user_id)) {
          const kasir = kasirMap.get(m.user_id);
          if (kasir.modalKas === 0) {
            kasir.modalKas = parseFloat(m.nominal) || 0;
          }
        }
      });

    return Array.from(kasirMap.values());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Owner View - Only MODAL KAS
  if (user?.role === 'owner') {
    const cashierOptions = cashiers.map(c => ({
      value: c.id,
      label: c.username
    }));
    const modalKasByCashier = getModalKasByCashier();

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center">
              <PlusCircle className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">Input Modal Aplikasi 7 / MODAL KAS</h2>
                <p className="text-gray-600">Kelola modal kas untuk setiap kasir</p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-300 flex items-center"
            >
              <PlusCircle className="h-5 w-5 mr-2" />
              Tambah Modal Kas
            </button>
          </div>
        </div>

        {/* Form Input Modal Kas */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tambah Modal Kas ke Kasir</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pilih Kasir
                </label>
                <Select
                  value={selectedCashier}
                  onChange={setSelectedCashier}
                  options={cashierOptions}
                  placeholder="Pilih kasir..."
                  className="w-full"
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderColor: '#d1d5db',
                      '&:hover': {
                        borderColor: '#9ca3af',
                      },
                    }),
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nominal Modal Kas
                </label>
                <input
                  type="text"
                  value={modalKasInput ? formatCurrency(parseFloat(modalKasInput)) : ''}
                  onChange={handleRupiahInputChange(setModalKasInput)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Masukkan nominal modal kas"
                />
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={() => handleSave('modal_kas')}
                  disabled={saving || !selectedCashier || !modalKasInput}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition duration-300 disabled:opacity-50 flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Menyimpan...' : 'Simpan Modal Kas'}
                </button>
                <button
                  onClick={handleCancel}
                  className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition duration-300 flex items-center"
                >
                  <X className="h-4 w-4 mr-2" />
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* List Modal Kas per Kasir */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Daftar Modal Kas per Kasir</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    NO
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    NAMA KASIR
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MODAL KAS
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {modalKasByCashier.map((kasir, index) => (
                  <tr key={kasir.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {kasir.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatCurrency(kasir.modalKas)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Total Modal Aplikasi 7/ Modal Kas Seluruh Kasir</h3>
            <div className="text-3xl font-bold text-blue-600">
              {formatCurrency(getTotalModalKasAllCashiers())}
            </div>
            <p className="text-gray-600 mt-2">
              Total dari {modalKasByCashier.length} kasir
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">TOTAL SALDO SELURUH KASIR</h3>
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(totalSaldoKeseluruhan)}
            </div>
            <p className="text-gray-600 mt-2">
              Total saldo dari semua kasir
            </p>
          </div>
        </div>

        {/* Riwayat Deposit Modal Kas */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Riwayat Deposit Modal Kas</h3>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              {showHistory ? 'Sembunyikan' : 'Tampilkan'} Riwayat
            </button>
          </div>
          
          {showHistory && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      NO
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      TGL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      NAMA KASIR
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      DEPOSIT
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      WAKTU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      AKSI
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {modalHistory.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                        Belum ada riwayat deposit modal kas
                      </td>
                    </tr>
                  ) : (
                    modalHistory.map((item, index) => {
                      const isEditing = editingHistoryId === item.id;
                      return (
                        <tr key={item.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {index + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div>{item.tanggal_formatted || new Date(item.created_at).toLocaleDateString('id-ID')}</div>
                            <div className="text-xs text-gray-500">
                              {item.hari && item.hari.charAt(0).toUpperCase() + item.hari.slice(1).toLowerCase()}, 
                              {item.bulan && ' ' + item.bulan.charAt(0).toUpperCase() + item.bulan.slice(1).toLowerCase()} {item.tahun}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.username || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editHistoryValue ? formatCurrency(parseFloat(editHistoryValue)) : ''}
                                onChange={handleRupiahInputChange(setEditHistoryValue)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Masukkan nominal"
                              />
                            ) : (
                              formatCurrency(parseFloat(item.nominal || 0))
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.jam || new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {isEditing ? (
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleUpdateHistory(item.id)}
                                  disabled={saving}
                                  className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition duration-300 disabled:opacity-50 flex items-center"
                                  title="Simpan"
                                >
                                  <Save className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={handleCancelHistoryEdit}
                                  disabled={saving}
                                  className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 transition duration-300 disabled:opacity-50 flex items-center"
                                  title="Batal"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleEditHistory(item.id, item.nominal)}
                                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition duration-300 flex items-center"
                                title="Edit"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {modalHistory.length > 0 && (
                    <tr className="bg-yellow-50 font-bold">
                      <td colSpan="3" className="px-6 py-4 text-right text-sm text-gray-900">
                        TOTAL
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        {formatCurrency(getTotalSaldoDeposit())}
                      </td>
                      <td colSpan="2"></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Original Kasir View (keep existing functionality)
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <PlusCircle className="h-8 w-8 text-blue-600 mr-3" />
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">Input Modal</h2>
            <p className="text-gray-600">Kelola modal dari berbagai aplikasi pembayaran</p>
          </div>
        </div>
      </div>

      {/* Modal Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modalApps.map((app) => {
          const currentValue = getCurrentValue(app.id);
          const isEditing = editingId === app.id;
          const isModalKas = app.id === 'modal_kas';
          
          return (
            <div key={app.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
              {/* Header */}
              <div className={`${app.color} p-4`}>
                <h3 className="text-white text-lg font-semibold">{app.name}</h3>
                <p className="text-white text-xs opacity-90 mt-1">Input Modal SETOR {app.label}</p>
              </div>
              
              {/* Content */}
              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nominal Modal
                  </label>
                  
                  {isEditing ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editValue ? formatCurrency(parseFloat(editValue)) : ''}
                        onChange={handleRupiahInputChange(setEditValue)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Masukkan nominal"
                      />
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleSave(app.id)}
                          disabled={saving}
                          className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-300 disabled:opacity-50 flex items-center justify-center"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Simpan
                        </button>
                        
                        <button
                          onClick={handleCancel}
                          className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition duration-300 flex items-center justify-center"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-xl md:text-2xl font-bold text-gray-900">
                        {formatCurrency(currentValue)}
                      </div>
                      
                      <button
                        onClick={() => {
                          if (!isModalKas) {
                            handleEdit(app.id, currentValue);
                          }
                        }}
                        disabled={isModalKas}
                        className={`w-full px-4 py-2 rounded-lg transition duration-300 flex items-center justify-center ${
                          isModalKas
                            ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        <PencilIcon className="h-4 w-4 mr-2" />
                        {isModalKas ? 'Diatur oleh Owner/Admin' : 'Edit Nominal'}
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="text-xs text-gray-500">
                  Terakhir diupdate: {(() => {
                    let modals;
                    if (user?.role === 'kasir') {
                      modals = modalData.filter(m => m.modal_type === app.id && m.user_id === user.id);
                    } else {
                      modals = modalData.filter(m => m.modal_type === app.id);
                    }
                    if (modals.length > 0) {
                      const sorted = modals.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                      return new Date(sorted[0].created_at).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                    }
                    return 'Belum ada data';
                  })()}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">TOTAL SALDO APLIKASI TERPAKAI (1-7)</h3>
          <div className="text-3xl font-bold text-blue-600">
            {formatCurrency(
              modalApps.reduce((total, app) => {
                const value = getCurrentValue(app.id);
                return total + value;
              }, 0)
            )}
          </div>
          <p className="text-gray-600 mt-2">
            Total saldo dari {modalApps.length} aplikasi modal yang terpakai
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">TOTAL SALDO KESELURUHAN</h3>
          <div className="text-3xl font-bold text-green-600">
            {formatCurrency(totalSaldoKeseluruhan)}
          </div>
          <p className="text-gray-600 mt-2">
            Total saldo keseluruhan setelah semua transaksi
          </p>
        </div>
      </div>

      {/* Riwayat Deposit */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Riwayat Deposit</h3>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            {showHistory ? 'Sembunyikan' : 'Tampilkan'} Riwayat
          </button>
        </div>
        
        {showHistory && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    NO
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    TGL
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    NAMA APLIKASI
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    DEPOSIT
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    USER
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    WAKTU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    AKSI
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {modalHistory.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center text-sm text-gray-500">
                      Belum ada riwayat deposit
                    </td>
                  </tr>
                ) : (
                  modalHistory.map((item, index) => {
                    const isEditing = editingHistoryId === item.id;
                    return (
                      <tr key={item.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>{item.tanggal_formatted || new Date(item.created_at).toLocaleDateString('id-ID')}</div>
                          <div className="text-xs text-gray-500">
                            {item.hari && item.hari.charAt(0).toUpperCase() + item.hari.slice(1).toLowerCase()}, 
                            {item.bulan && ' ' + item.bulan.charAt(0).toUpperCase() + item.bulan.slice(1).toLowerCase()} {item.tahun}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getModalTypeLabel(item.modal_type)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editHistoryValue}
                              onChange={(e) => setEditHistoryValue(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Masukkan nominal"
                            />
                          ) : (
                            formatCurrency(parseFloat(item.nominal || 0))
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.username || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.jam || new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {isEditing ? (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleUpdateHistory(item.id)}
                                disabled={saving}
                                className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition duration-300 disabled:opacity-50 flex items-center"
                                title="Simpan"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                              <button
                                onClick={handleCancelHistoryEdit}
                                disabled={saving}
                                className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 transition duration-300 disabled:opacity-50 flex items-center"
                                title="Batal"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEditHistory(item.id, item.nominal)}
                              className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition duration-300 flex items-center"
                              title="Edit"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
                {modalHistory.length > 0 && (
                  <tr className="bg-yellow-50 font-bold">
                    <td colSpan="3" className="px-6 py-4 text-right text-sm text-gray-900">
                      TOTAL
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {formatCurrency(getTotalSaldoDeposit())}
                    </td>
                    <td colSpan="3"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">Catatan Penting</h3>
            <div className="mt-2 text-sm text-yellow-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Modal hanya bisa diedit, tidak bisa dihapus</li>
                <li>Modal Kas hanya tersedia untuk role Owner/Admin</li>
                <li>Semua perubahan modal akan tercatat dalam log sistem</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalInput;
