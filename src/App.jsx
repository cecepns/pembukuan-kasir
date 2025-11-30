import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ModalInput from './pages/ModalInput';
import Transfer from './pages/Transfer';
import TransferDebit from './pages/TransferDebit';
import TarikTunai from './pages/TarikTunai';
import Laporan from './pages/Laporan';
import UserManagement from './pages/UserManagement';
import Logs from './pages/Logs';
import Layout from './layouts/Layout';
import { AuthProvider } from './hooks/useAuth';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
          <Route path="/modal" element={<Layout><ModalInput /></Layout>} />
          <Route path="/transfer" element={<Layout><Transfer /></Layout>} />
          <Route path="/transfer-debit" element={<Layout><TransferDebit /></Layout>} />
          <Route path="/tarik-tunai" element={<Layout><TarikTunai /></Layout>} />
          <Route path="/laporan" element={<Layout><Laporan /></Layout>} />
          <Route path="/users" element={<Layout><UserManagement /></Layout>} />
          <Route path="/logs" element={<Layout><Logs /></Layout>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;