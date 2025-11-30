import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Search, Filter, Calendar, Download, RefreshCw } from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import jsPDF from 'jspdf';

const Logs = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    action: '',
    table_name: '',
    user_id: ''
  });
  const [users, setUsers] = useState([]);
  const [actionTypes, setActionTypes] = useState([]);
  const [tableNames, setTableNames] = useState([]);

  const loadUsers = async () => {
    try {
      const response = await api.get('/user');
      setUsers(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      let url = '/logs?';
      const params = new URLSearchParams();

      if (filters.startDate) {
        params.append('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params.append('endDate', filters.endDate);
      }
      if (filters.action) {
        params.append('action', filters.action);
      }
      if (filters.table_name) {
        params.append('table_name', filters.table_name);
      }
      if (filters.user_id) {
        params.append('user_id', filters.user_id);
      }

      // Add pagination
      params.append('page', pagination.page);
      params.append('limit', pagination.limit);

      url += params.toString();
      const response = await api.get(url);
      
      if (response.data && response.pagination) {
        setLogs(Array.isArray(response.data) ? response.data : []);
        setPagination(response.pagination);
      } else {
        // Fallback for old API format
        setLogs(Array.isArray(response) ? response : []);
      }
    } catch (error) {
      console.error('Error loading logs:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    if (user?.role === 'owner') {
      loadUsers();
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === 'owner') {
      loadLogs();
    }
  }, [user, loadLogs]);

  useEffect(() => {
    if (logs.length > 0) {
      // Extract unique action types and table names
      const uniqueActions = [...new Set(logs.map(log => log.action))].sort();
      const uniqueTables = [...new Set(logs.map(log => log.table_name))].sort();
      setActionTypes(uniqueActions);
      setTableNames(uniqueTables);
    }
  }, [logs]);

  useEffect(() => {
    // Reset to page 1 when filters change (except page itself)
    if (pagination.page !== 1) {
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  }, [filters.startDate, filters.endDate, filters.action, filters.table_name, filters.user_id]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      action: '',
      table_name: '',
      user_id: ''
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const getActionBadgeColor = (action) => {
    switch (action) {
      case 'INSERT':
        return 'bg-green-100 text-green-800';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800';
      case 'UPDATE_STATUS':
        return 'bg-yellow-100 text-yellow-800';
      case 'LOGIN':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatValues = (values, action, tableName) => {
    if (!values || typeof values !== 'object') return '-';
    
    // Special handling for LOGIN action
    if (action === 'LOGIN') {
      if (values.username && values.role) {
        return `Username: ${values.username}\nRole: ${values.role}`;
      }
    }

    // Special handling for UPDATE_STATUS
    if (action === 'UPDATE_STATUS') {
      if (values.status) {
        return `Status: ${values.status}`;
      }
    }

    // Format as key-value pairs
    const formatted = Object.entries(values)
      .map(([key, value]) => {
        // Format key to be more readable
        const formattedKey = key
          .replace(/_/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
        
        // Format value
        let formattedValue = value;
        if (value === null || value === undefined) {
          formattedValue = '-';
        } else if (typeof value === 'boolean') {
          formattedValue = value ? 'Ya' : 'Tidak';
        } else if (typeof value === 'object') {
          formattedValue = JSON.stringify(value);
        }
        
        return `${formattedKey}: ${formattedValue}`;
      })
      .join('\n');

    return formatted || '-';
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(16);
    doc.text('Riwayat Logs Sistem', 14, y);
    y += 10;

    doc.setFontSize(10);
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, y);
    y += 10;

    // Table header
    doc.setFontSize(9);
    doc.setFillColor(240, 240, 240);
    doc.rect(14, y, 180, 8, 'F');
    y += 6;
    doc.text('Tanggal', 16, y);
    doc.text('User', 50, y);
    doc.text('Action', 80, y);
    doc.text('Table', 110, y);
    doc.text('Record ID', 140, y);
    doc.text('Detail', 165, y);
    y += 4;

    // Table rows
    doc.setFontSize(8);
    logs.slice(0, 50).forEach((log, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.text(formatDate(log.created_at).substring(0, 16), 16, y);
      doc.text(log.username || '-', 50, y);
      doc.text(log.action, 80, y);
      doc.text(log.table_name, 110, y);
      doc.text(log.record_id ? log.record_id.toString() : '-', 140, y);
      
      const newValues = log.new_values ? JSON.stringify(log.new_values).substring(0, 30) : '-';
      doc.text(newValues, 165, y);
      
      y += 6;
    });

    doc.save(`logs-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (user?.role !== 'owner') {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-red-600">Akses ditolak. Hanya admin/owner yang dapat mengakses halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col gap-5 md:flex-row items-center justify-between">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Riwayat Logs Sistem</h2>
              <p className="text-gray-600">Audit trail untuk semua aktivitas sistem</p>
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
              onClick={loadLogs}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-300 flex items-center disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <Filter className="h-5 w-5 text-gray-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Filter</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tanggal Mulai
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tanggal Akhir
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Action
            </label>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Action</option>
              {actionTypes.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Table
            </label>
            <select
              value={filters.table_name}
              onChange={(e) => handleFilterChange('table_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Table</option>
              {tableNames.map(table => (
                <option key={table} value={table}>{table}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              User
            </label>
            <select
              value={filters.user_id}
              onChange={(e) => handleFilterChange('user_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua User</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.username}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition duration-300"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Table
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Record ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Old Values
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  New Values
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP Address
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                    Memuat data...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                    Tidak ada data logs
                  </td>
                </tr>
              ) : (
                logs.map((log, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.username || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.table_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.record_id || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                      {log.old_values ? (
                        <pre className="whitespace-pre-wrap text-xs bg-gray-50 p-2 rounded border border-gray-200">
                          {formatValues(log.old_values, log.action, log.table_name)}
                        </pre>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                      {log.new_values ? (
                        <pre className="whitespace-pre-wrap text-xs bg-blue-50 p-2 rounded border border-blue-200">
                          {formatValues(log.new_values, log.action, log.table_name)}
                        </pre>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.ip_address || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {pagination.totalPages > 0 && (
          <div className="p-4 border-t flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Menampilkan {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} dari {pagination.total} log entries
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1 || loading}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sebelumnya
              </button>
              <span className="text-sm text-gray-600">
                Halaman {pagination.page} dari {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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

export default Logs;

