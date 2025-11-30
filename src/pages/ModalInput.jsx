import React, { useState, useEffect } from 'react';
import { PlusCircle, PencilIcon, Save, X } from 'lucide-react';
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
  const { user } = useAuth();

  const modalApps = [
    { id: 'karangsari', name: 'Aplikasi-1 / KARANGSARI', label: 'KARANGSARI', color: 'bg-blue-500' },
    { id: 'fastpay', name: 'Aplikasi-2 / FASTPAY', label: 'FASTPAY', color: 'bg-green-500' },
    { id: 'mmbc', name: 'Aplikasi-3 / MMBC', label: 'MMBC', color: 'bg-purple-500' },
    { id: 'payfazz', name: 'Aplikasi-4 / PAYFAZZ', label: 'PAYFAZZ', color: 'bg-orange-500' },
    { id: 'posfin', name: 'Aplikasi-5 / POSFIN', label: 'POSFIN', color: 'bg-red-500' },
    { id: 'buku_agen', name: 'Aplikasi-6 / BUKU AGEN/BUKU WARUNG', label: 'BUKU AGEN/BUKU WARUNG', color: 'bg-yellow-500' },
    ...(user?.role === 'owner' ? [{ id: 'modal_kas', name: 'Aplikasi-7 / MODAL KAS', label: 'MODAL KAS', color: 'bg-gray-600' }] : [])
  ];

  useEffect(() => {
    loadModalData();
    loadModalHistory();
  }, []);

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
      setModalHistory(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Error loading modal history:', error);
      setModalHistory([]);
    }
  };

  const handleEdit = (id, currentValue) => {
    setEditingId(id);
    setEditValue(currentValue.toString());
  };

  const handleSave = async (modalType) => {
    if (!editValue || isNaN(editValue)) {
      alert('Nominal harus berupa angka yang valid');
      return;
    }

    const nominal = parseFloat(editValue);
    
    // Validasi untuk MODAL KAS: jika 0 tidak perlu diisi
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

  const handleCancelHistoryEdit = () => {
    setEditingHistoryId(null);
    setEditHistoryValue('');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount);
  };

  const getCurrentValue = (modalType) => {
    // Get the latest entry for this modal_type
    let modals;
    if (user?.role === 'kasir') {
      modals = modalData.filter(m => m.modal_type === modalType && m.user_id === user.id);
    } else {
      modals = modalData.filter(m => m.modal_type === modalType);
    }
    
    // Sort by created_at descending and get the latest
    const sorted = modals.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return sorted.length > 0 ? parseFloat(sorted[0].nominal) : 0;
  };

  const getTotalSaldoDeposit = () => {
    // Calculate total from all deposit history
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

  const getModalTypeLabel = (modalType) => {
    const app = modalApps.find(a => a.id === modalType);
    return app ? app.label : modalType.toUpperCase();
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
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
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
                        onClick={() => handleEdit(app.id, currentValue)}
                        className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-300 flex items-center justify-center"
                      >
                        <PencilIcon className="h-4 w-4 mr-2" />
                        Edit Nominal
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Total Modal Saat Ini</h3>
          <div className="text-3xl font-bold text-blue-600">
            {formatCurrency(
              modalApps.reduce((total, app) => {
                const value = getCurrentValue(app.id);
                return total + value;
              }, 0)
            )}
          </div>
          <p className="text-gray-600 mt-2">
            Total dari {modalApps.length} aplikasi modal
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">TOTAL SALDO DEPOSIT</h3>
          <div className="text-3xl font-bold text-green-600">
            {formatCurrency(getTotalSaldoDeposit())}
          </div>
          <p className="text-gray-600 mt-2">
            Total semua deposit yang pernah dilakukan
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