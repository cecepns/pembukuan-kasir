const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads-pembukuan-kasir'));

// Ensure upload directory exists
const uploadDir = 'uploads-pembukuan-kasir';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Database connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pembukuan_kasir'
});

db.connect((err) => {
  if (err) {
    console.error('Database connection error:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token tidak tersedia' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token tidak valid' });
    }
    req.user = user;
    next();
  });
};

// Routes

// Auth Routes
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.promise().execute(
      'SELECT * FROM users WHERE username = ? AND status = "aktif"',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Username atau password salah' });
    }

    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ message: 'Username atau password salah' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Log login action
    await createLog(
      user.id,
      'LOGIN',
      'users',
      user.id,
      null,
      { username: user.username, role: user.role },
      req
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Modal Routes
app.get('/modal', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.role === 'kasir' ? req.user.id : null;
    let query = 'SELECT * FROM modal';
    let params = [];

    if (userId) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }

    const [rows] = await db.promise().execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching modal:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/modal', authenticateToken, async (req, res) => {
  const { modal_type, nominal, user_id: target_user_id } = req.body;
  // For owner role, allow specifying target user_id, otherwise use authenticated user's id
  let user_id = req.user.id;
  
  // If owner specifies user_id, use it (for adding modal to kasir)
  if (req.user.role === 'owner' && target_user_id) {
    // Validate that target user exists and is a kasir
    try {
      const [userRows] = await db.promise().execute(
        'SELECT id, role FROM users WHERE id = ? AND status = "aktif"',
        [target_user_id]
      );
      if (userRows.length === 0) {
        return res.status(400).json({ message: 'User tidak ditemukan atau tidak aktif' });
      }
      if (userRows[0].role !== 'kasir') {
        return res.status(400).json({ message: 'Hanya bisa menambahkan modal untuk kasir' });
      }
      user_id = target_user_id;
    } catch (error) {
      console.error('Error validating target user:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  }

  try {
    // Always insert new record for history tracking
    // Remove UNIQUE constraint by inserting with IGNORE or always insert
    const [result] = await db.promise().execute(
      'INSERT INTO modal (modal_type, nominal, user_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [modal_type, nominal, user_id]
    );

    // Update saldo - ensure it completes successfully
    try {
      await updateSaldo(user_id);
      console.log(`[POST /modal] Saldo updated successfully for user ${user_id} after deposit ${nominal}`);
    } catch (saldoError) {
      console.error('[POST /modal] Error updating saldo:', saldoError);
      // Don't fail the request, but log the error
    }

    // Log the action (use authenticated user's id for logging)
    await createLog(
      req.user.id,
      'INSERT',
      'modal',
      result.insertId,
      null,
      { modal_type, nominal, user_id, added_by_owner: req.user.role === 'owner' && target_user_id ? true : false },
      req
    );

    res.json({ message: 'Modal berhasil disimpan' });
  } catch (error) {
    console.error('Error saving modal:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update modal by id
app.put('/modal/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { nominal } = req.body;
  const user_id = req.user.id;

  try {
    // Validate nominal
    if (!nominal || isNaN(nominal)) {
      return res.status(400).json({ message: 'Nominal harus berupa angka yang valid' });
    }

    // Check if modal exists and user has permission
    const [existingModal] = await db.promise().execute(
      'SELECT * FROM modal WHERE id = ?',
      [id]
    );

    if (existingModal.length === 0) {
      return res.status(404).json({ message: 'Modal tidak ditemukan' });
    }

    const modal = existingModal[0];

    // Check permission: kasir can only edit their own modals
    if (req.user.role === 'kasir' && modal.user_id !== user_id) {
      return res.status(403).json({ message: 'Tidak memiliki izin untuk mengedit modal ini' });
    }

    // Store old values for logging
    const oldValues = {
      modal_type: modal.modal_type,
      nominal: modal.nominal,
      user_id: modal.user_id
    };

    // Update modal
    await db.promise().execute(
      'UPDATE modal SET nominal = ?, updated_at = NOW() WHERE id = ?',
      [nominal, id]
    );

    // Update saldo for the user who owns this modal
    await updateSaldo(modal.user_id);

    // Log the action
    await createLog(
      user_id,
      'UPDATE',
      'modal',
      parseInt(id),
      oldValues,
      { modal_type: modal.modal_type, nominal, user_id: modal.user_id },
      req
    );

    res.json({ message: 'Modal berhasil diupdate' });
  } catch (error) {
    console.error('Error updating modal:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get modal history
app.get('/modal/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.role === 'kasir' ? req.user.id : null;
    let query = `
      SELECT 
        m.id,
        m.modal_type,
        m.nominal,
        m.user_id,
        u.username,
        DATE(m.created_at) as tanggal,
        DATE_FORMAT(m.created_at, '%d/%m/%Y') as tanggal_formatted,
        DATE_FORMAT(m.created_at, '%W') as hari,
        DATE_FORMAT(m.created_at, '%M') as bulan,
        YEAR(m.created_at) as tahun,
        DATE_FORMAT(m.created_at, '%H:%i:%s') as jam,
        m.created_at,
        m.updated_at
      FROM modal m
      LEFT JOIN users u ON m.user_id = u.id
    `;
    let params = [];

    if (userId) {
      query += ' WHERE m.user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY m.created_at DESC';

    const [rows] = await db.promise().execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching modal history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Transfer Routes
app.get('/transfer', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.role === 'kasir' ? req.user.id : null;
    const cashierId = req.query.cashier_id;
    const search = req.query.search || '';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    let query = 'SELECT t.*, u.username as kasir_name FROM transfer t LEFT JOIN users u ON t.user_id = u.id';
    let countQuery = 'SELECT COUNT(*) as total FROM transfer t';
    let params = [];
    let conditions = [];

    if (userId) {
      conditions.push('t.user_id = ?');
      params.push(userId);
    }

    if (cashierId && req.user.role === 'owner' && cashierId !== 'all') {
      conditions.push('t.user_id = ?');
      params.push(cashierId);
    }

    // Date filtering
    if (startDate && endDate) {
      conditions.push('DATE(t.tanggal) BETWEEN ? AND ?');
      params.push(startDate, endDate);
    } else if (startDate) {
      conditions.push('DATE(t.tanggal) >= ?');
      params.push(startDate);
    } else if (endDate) {
      conditions.push('DATE(t.tanggal) <= ?');
      params.push(endDate);
    }

    // Search functionality
    if (search) {
      conditions.push(`(
        t.bank_tujuan LIKE ? OR 
        t.nomor_rekening LIKE ? OR 
        t.nama_pemilik LIKE ? OR
        t.keterangan LIKE ?
      )`);
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await db.promise().execute(query, params);
    const [countRows] = await db.promise().execute(countQuery, params.slice(0, params.length - 2));
    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching transfers:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/transfer', authenticateToken, async (req, res) => {
  const { tanggal, bank_tujuan, nomor_rekening, nama_pemilik, nominal, biaya, keterangan } = req.body;
  const user_id = req.user.id;

  try {
    // Insert transfer
    const [result] = await db.promise().execute(
      'INSERT INTO transfer (tanggal, bank_tujuan, nomor_rekening, nama_pemilik, nominal, biaya, keterangan, user_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "pending", NOW())',
      [tanggal, bank_tujuan, nomor_rekening, nama_pemilik, nominal, biaya, keterangan, user_id]
    );

    // Save to favorites
    await db.promise().execute(
      'INSERT IGNORE INTO transfer_favorit (bank_tujuan, nomor_rekening, nama_pemilik, user_id, created_at) VALUES (?, ?, ?, ?, NOW())',
      [bank_tujuan, nomor_rekening, nama_pemilik, user_id]
    );

    // Update saldo menggunakan fungsi updateSaldo untuk konsistensi
    await updateSaldo(user_id);

    // Log the action
    await createLog(
      user_id,
      'INSERT',
      'transfer',
      result.insertId,
      null,
      { tanggal, bank_tujuan, nomor_rekening, nama_pemilik, nominal, biaya, keterangan, user_id, status: 'pending' },
      req
    );

    res.json({ message: 'Transfer berhasil disimpan', id: result.insertId });
  } catch (error) {
    console.error('Error saving transfer:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/transfer/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ message: 'Access denied. Hanya owner yang dapat mengedit transfer.' });
  }

  const { id } = req.params;
  const { tanggal, bank_tujuan, nomor_rekening, nama_pemilik, nominal, biaya, keterangan } = req.body;

  try {
    // Get old transfer data to calculate saldo difference
    const [oldRows] = await db.promise().execute(
      'SELECT * FROM transfer WHERE id = ?',
      [id]
    );

    if (oldRows.length === 0) {
      return res.status(404).json({ message: 'Transfer tidak ditemukan' });
    }

    const oldTransfer = oldRows[0];
    const oldTotal = Number(oldTransfer.nominal) + Number(oldTransfer.biaya);
    const newTotal = Number(nominal) + Number(biaya);
    // Jika transfer baru lebih besar, saldo berkurang lebih banyak (negatif)
    // Jika transfer baru lebih kecil, saldo berkurang lebih sedikit (positif)
    const saldoDiff = oldTotal - newTotal;

    // Store old values for logging
    const oldValues = {
      tanggal: oldTransfer.tanggal,
      bank_tujuan: oldTransfer.bank_tujuan,
      nomor_rekening: oldTransfer.nomor_rekening,
      nama_pemilik: oldTransfer.nama_pemilik,
      nominal: oldTransfer.nominal,
      biaya: oldTransfer.biaya,
      keterangan: oldTransfer.keterangan
    };

    // Update transfer
    await db.promise().execute(
      'UPDATE transfer SET tanggal = ?, bank_tujuan = ?, nomor_rekening = ?, nama_pemilik = ?, nominal = ?, biaya = ?, keterangan = ?, updated_at = NOW() WHERE id = ?',
      [tanggal, bank_tujuan, nomor_rekening, nama_pemilik, nominal, biaya, keterangan, id]
    );

    // Update saldo menggunakan fungsi updateSaldo untuk konsistensi
    await updateSaldo(oldTransfer.user_id);

    // Log the action
    await createLog(
      req.user.id,
      'UPDATE',
      'transfer',
      parseInt(id),
      oldValues,
      { tanggal, bank_tujuan, nomor_rekening, nama_pemilik, nominal, biaya, keterangan },
      req
    );

    res.json({ message: 'Transfer berhasil diupdate' });
  } catch (error) {
    console.error('Error updating transfer:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/transfer/:id/status', authenticateToken, async (req, res) => {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ message: 'Access denied. Hanya owner yang dapat mengubah status transfer.' });
  }

  const { id } = req.params;
  const { status } = req.body;

  try {
    // Validate status
    if (status !== 'pending' && status !== 'lunas') {
      return res.status(400).json({ message: 'Status tidak valid. Gunakan "pending" atau "lunas"' });
    }

    // Get old status for logging
    const [oldRows] = await db.promise().execute(
      'SELECT status FROM transfer WHERE id = ?',
      [id]
    );

    if (oldRows.length === 0) {
      return res.status(404).json({ message: 'Transfer tidak ditemukan' });
    }

    const oldStatus = oldRows[0].status;

    // Update transfer status
    await db.promise().execute(
      'UPDATE transfer SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );

    // Log the action
    await createLog(
      req.user.id,
      'UPDATE_STATUS',
      'transfer',
      parseInt(id),
      { status: oldStatus },
      { status },
      req
    );

    res.json({ message: `Status transfer berhasil diubah menjadi ${status}` });
  } catch (error) {
    console.error('Error updating transfer status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Transfer Favorit Routes
app.get('/transfer-favorit', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.role === 'kasir' ? req.user.id : null;
    const search = req.query.search || '';
    
    let query = 'SELECT * FROM transfer_favorit';
    let params = [];
    let conditions = [];

    if (userId) {
      conditions.push('user_id = ?');
      params.push(userId);
    }

    // Search functionality
    if (search) {
      conditions.push(`(
        bank_tujuan LIKE ? OR 
        nomor_rekening LIKE ? OR 
        nama_pemilik LIKE ?
      )`);
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC LIMIT 5';

    const [rows] = await db.promise().execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching transfer favorit:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Transfer Debit Routes
app.get('/transfer-debit', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.role === 'kasir' ? req.user.id : null;
    const { startDate, endDate } = req.query;
    
    let query = 'SELECT td.*, u.username as kasir_name FROM transfer_debit td LEFT JOIN users u ON td.user_id = u.id';
    let params = [];
    let conditions = [];

    if (userId) {
      conditions.push('td.user_id = ?');
      params.push(userId);
    }

    if (startDate && endDate) {
      conditions.push('DATE(td.tanggal) BETWEEN ? AND ?');
      params.push(startDate, endDate);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY td.created_at DESC';

    const [rows] = await db.promise().execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching transfer debit:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Transfer Grafik Routes
app.get('/transfer/grafik/harian', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.role === 'kasir' ? req.user.id : null;
    let whereClause = '';
    let params = [];

    if (userId) {
      whereClause = ' AND user_id = ?';
      params.push(userId);
    }

    const [rows] = await db.promise().execute(`
      SELECT 
        DATE(tanggal) as tanggal,
        COUNT(*) as total,
        COALESCE(SUM(nominal), 0) as total_nominal,
        COALESCE(SUM(biaya), 0) as total_biaya,
        COALESCE(SUM(nominal + biaya), 0) as total_all
      FROM transfer
      WHERE DATE(tanggal) >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${whereClause}
      GROUP BY DATE(tanggal)
      ORDER BY tanggal
    `, params);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching transfer daily chart:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/transfer/grafik/mingguan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.role === 'kasir' ? req.user.id : null;
    let whereClause = '';
    let params = [];

    if (userId) {
      whereClause = ' AND user_id = ?';
      params.push(userId);
    }

    const [rows] = await db.promise().execute(`
      SELECT 
        CONCAT('Week ', WEEK(tanggal)) as tanggal,
        COUNT(*) as total,
        COALESCE(SUM(nominal), 0) as total_nominal,
        COALESCE(SUM(biaya), 0) as total_biaya,
        COALESCE(SUM(nominal + biaya), 0) as total_all
      FROM transfer
      WHERE DATE(tanggal) >= DATE_SUB(NOW(), INTERVAL 4 WEEK) ${whereClause}
      GROUP BY WEEK(tanggal)
      ORDER BY WEEK(tanggal)
    `, params);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching transfer weekly chart:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/transfer/grafik/bulanan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.role === 'kasir' ? req.user.id : null;
    let whereClause = '';
    let params = [];

    if (userId) {
      whereClause = ' AND user_id = ?';
      params.push(userId);
    }

    const [rows] = await db.promise().execute(`
      SELECT 
        DATE_FORMAT(tanggal, '%Y-%m') as tanggal,
        COUNT(*) as total,
        COALESCE(SUM(nominal), 0) as total_nominal,
        COALESCE(SUM(biaya), 0) as total_biaya,
        COALESCE(SUM(nominal + biaya), 0) as total_all
      FROM transfer
      WHERE DATE(tanggal) >= DATE_SUB(NOW(), INTERVAL 6 MONTH) ${whereClause}
      GROUP BY DATE_FORMAT(tanggal, '%Y-%m')
      ORDER BY tanggal
    `, params);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching transfer monthly chart:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Transfer Debit Grafik Routes
app.get('/transfer-debit/grafik/harian', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.role === 'kasir' ? req.user.id : null;
    let whereClause = '';
    let params = [];

    if (userId) {
      whereClause = ' AND user_id = ?';
      params.push(userId);
    }

    const [rows] = await db.promise().execute(`
      SELECT 
        DATE(tanggal) as tanggal,
        COUNT(*) as total,
        COALESCE(SUM(biaya), 0) as total_biaya
      FROM transfer_debit
      WHERE DATE(tanggal) >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${whereClause}
      GROUP BY DATE(tanggal)
      ORDER BY tanggal
    `, params);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching transfer debit daily chart:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/transfer-debit/grafik/mingguan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.role === 'kasir' ? req.user.id : null;
    let whereClause = '';
    let params = [];

    if (userId) {
      whereClause = ' AND user_id = ?';
      params.push(userId);
    }

    const [rows] = await db.promise().execute(`
      SELECT 
        CONCAT('Week ', WEEK(tanggal)) as tanggal,
        COUNT(*) as total,
        COALESCE(SUM(biaya), 0) as total_biaya
      FROM transfer_debit
      WHERE DATE(tanggal) >= DATE_SUB(NOW(), INTERVAL 4 WEEK) ${whereClause}
      GROUP BY WEEK(tanggal)
      ORDER BY WEEK(tanggal)
    `, params);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching transfer debit weekly chart:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/transfer-debit/grafik/bulanan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.role === 'kasir' ? req.user.id : null;
    let whereClause = '';
    let params = [];

    if (userId) {
      whereClause = ' AND user_id = ?';
      params.push(userId);
    }

    const [rows] = await db.promise().execute(`
      SELECT 
        DATE_FORMAT(tanggal, '%Y-%m') as tanggal,
        COUNT(*) as total,
        COALESCE(SUM(biaya), 0) as total_biaya
      FROM transfer_debit
      WHERE DATE(tanggal) >= DATE_SUB(NOW(), INTERVAL 6 MONTH) ${whereClause}
      GROUP BY DATE_FORMAT(tanggal, '%Y-%m')
      ORDER BY tanggal
    `, params);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching transfer debit monthly chart:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/transfer-debit', authenticateToken, async (req, res) => {
  const { tanggal, biaya, keterangan } = req.body;
  const user_id = req.user.id;

  try {
    const [result] = await db.promise().execute(
      'INSERT INTO transfer_debit (tanggal, biaya, keterangan, user_id, status, created_at) VALUES (?, ?, ?, ?, "lunas", NOW())',
      [tanggal, biaya, keterangan, user_id]
    );

    // Update saldo menggunakan fungsi updateSaldo untuk konsistensi
    await updateSaldo(user_id);

    // Log the action
    await createLog(
      user_id,
      'INSERT',
      'transfer_debit',
      result.insertId,
      null,
      { tanggal, biaya, keterangan, user_id, status: 'lunas' },
      req
    );

    res.json({ message: 'Transfer debit berhasil disimpan' });
  } catch (error) {
    console.error('Error saving transfer debit:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Tarik Tunai Routes
app.get('/tarik-tunai', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.role === 'kasir' ? req.user.id : null;
    const { startDate, endDate } = req.query;
    
    let query = 'SELECT * FROM tarik_tunai';
    let params = [];
    let conditions = [];

    if (userId) {
      conditions.push('user_id = ?');
      params.push(userId);
    }

    // Date filtering
    if (startDate && endDate) {
      conditions.push('DATE(tanggal) BETWEEN ? AND ?');
      params.push(startDate, endDate);
    } else if (startDate) {
      conditions.push('DATE(tanggal) >= ?');
      params.push(startDate);
    } else if (endDate) {
      conditions.push('DATE(tanggal) <= ?');
      params.push(endDate);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await db.promise().execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching tarik tunai:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/tarik-tunai', authenticateToken, async (req, res) => {
  const { tanggal, bank, nominal_tarik, biaya_tarik, keterangan } = req.body;
  const user_id = req.user.id;

  try {
    const [result] = await db.promise().execute(
      'INSERT INTO tarik_tunai (tanggal, bank, nominal_tarik, biaya_tarik, keterangan, user_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, "lunas", NOW())',
      [tanggal, bank, nominal_tarik, biaya_tarik, keterangan, user_id]
    );

    // Update saldo menggunakan fungsi updateSaldo untuk konsistensi
    // Logika: biaya_tarik menambah saldo, nominal_tarik mengurangi saldo
    // saldo_change = biaya_tarik - nominal_tarik
    await updateSaldo(user_id);

    // Log the action
    await createLog(
      user_id,
      'INSERT',
      'tarik_tunai',
      result.insertId,
      null,
      { tanggal, bank, nominal_tarik, biaya_tarik, keterangan, user_id, status: 'lunas' },
      req
    );

    res.json({ message: 'Tarik tunai berhasil disimpan' });
  } catch (error) {
    console.error('Error saving tarik tunai:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Laporan Routes
app.get('/laporan', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    const userId = req.user.role === 'kasir' ? req.user.id : null;

    // Base where clause
    let whereClause = '';
    let params = [];

    if (startDate && endDate) {
      whereClause += ' WHERE DATE(created_at) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    if (userId) {
      whereClause += whereClause ? ' AND user_id = ?' : ' WHERE user_id = ?';
      params.push(userId);
    }

    // Get modal total
    const [modalRows] = await db.promise().execute(
      `SELECT COALESCE(SUM(nominal), 0) as total FROM modal${whereClause}`,
      params
    );

    // Get transfer total
    const [transferRows] = await db.promise().execute(
      `SELECT COALESCE(SUM(nominal), 0) as total_transfer, COALESCE(SUM(biaya), 0) as total_biaya FROM transfer${whereClause}`,
      params
    );

    // Get transfer debit total
    const [transferDebitRows] = await db.promise().execute(
      `SELECT COALESCE(SUM(biaya), 0) as total FROM transfer_debit${whereClause}`,
      params
    );

    // Get tarik tunai total
    const [tarikTunaiRows] = await db.promise().execute(
      `SELECT COALESCE(SUM(nominal_tarik), 0) as total_tarik, COALESCE(SUM(biaya_tarik), 0) as total_biaya FROM tarik_tunai${whereClause}`,
      params
    );
    
    // Hitung sisa saldo langsung dari total-total transaksi
    const modalAmount = Number(modalRows[0].total) || 0;
    const transferNominal = Number(transferRows[0].total_transfer) || 0;
    const transferBiaya = Number(transferRows[0].total_biaya) || 0;
    const transferDebitAmount = Number(transferDebitRows[0].total) || 0;
    const tarikTunaiNominal = Number(tarikTunaiRows[0].total_tarik) || 0;
    const tarikTunaiBiaya = Number(tarikTunaiRows[0].total_biaya) || 0;
    const tarikTunaiNet = tarikTunaiBiaya - tarikTunaiNominal;

    // Konsisten dengan rumus updateSaldo:
    // Total saldo = Modal (deposit) + Transfer (nominal+biaya) + Transfer Debit - Tarik Tunai (nominal - biaya)
    const sisaSaldo =
      modalAmount +
      transferNominal +
      transferBiaya +
      transferDebitAmount +
      tarikTunaiNet;

    const laporan = {
      totalDeposit: modalRows[0].total,
      totalTransfer: transferRows[0].total_transfer,
      totalBiayaTransfer: transferRows[0].total_biaya,
      totalBiayaTransferDebit: transferDebitRows[0].total,
      totalTarikTunai: tarikTunaiRows[0].total_tarik,
      totalBiayaTarikTunai: tarikTunaiRows[0].total_biaya,
      sisaSaldo
    };

    res.json(laporan);
  } catch (error) {
    console.error('Error generating laporan:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// User Routes (Owner only)
app.get('/user', authenticateToken, async (req, res) => {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const [rows] = await db.promise().execute(
      'SELECT id, username, role, status, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/user', authenticateToken, async (req, res) => {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const { username, password, role, status } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [result] = await db.promise().execute(
      'INSERT INTO users (username, password, role, status, created_at) VALUES (?, ?, ?, ?, NOW())',
      [username, hashedPassword, role, status]
    );

    // Create saldo record for new user
    await db.promise().execute(
      'INSERT INTO saldo (user_id, total_saldo, created_at, updated_at) VALUES (?, 0, NOW(), NOW())',
      [result.insertId]
    );

    // Log the action (exclude password)
    await createLog(
      req.user.id,
      'INSERT',
      'users',
      result.insertId,
      null,
      { username, role, status },
      req
    );

    res.json({ message: 'User berhasil ditambahkan' });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/user/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const { id } = req.params;
  const { username, password, role, status } = req.body;

  try {
    // Get old values for logging
    const [oldRows] = await db.promise().execute(
      'SELECT username, role, status FROM users WHERE id = ?',
      [id]
    );

    if (oldRows.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    const oldUser = oldRows[0];

    let query = 'UPDATE users SET username = ?, role = ?, status = ?';
    let params = [username, role, status];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await db.promise().execute(query, params);

    // Log the action (exclude password)
    const newValues = { username, role, status };
    if (password) {
      newValues.password_changed = true;
    }

    await createLog(
      req.user.id,
      'UPDATE',
      'users',
      parseInt(id),
      oldUser,
      newValues,
      req
    );

    res.json({ message: 'User berhasil diupdate' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Saldo Routes
app.get('/saldo/total', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.role === 'kasir' ? req.user.id : null;
    let query = 'SELECT COALESCE(SUM(total_saldo), 0) as total FROM saldo';
    let params = [];

    if (userId) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }

    const [rows] = await db.promise().execute(query, params);
    res.json({ total: rows[0].total });
  } catch (error) {
    console.error('Error fetching total saldo:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Grafik Routes
app.get('/grafik/harian', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.role === 'kasir' ? req.user.id : null;
    let whereClause = '';
    let params = [];

    if (userId) {
      whereClause = ' AND user_id = ?';
      params.push(userId);
    }

    const [rows] = await db.promise().execute(`
      SELECT 
        DATE(created_at) as tanggal,
        COUNT(*) as total
      FROM (
        SELECT created_at, user_id FROM transfer WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${whereClause}
        UNION ALL
        SELECT created_at, user_id FROM transfer_debit WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${whereClause}
        UNION ALL
        SELECT created_at, user_id FROM tarik_tunai WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${whereClause}
      ) as all_transactions
      GROUP BY DATE(created_at)
      ORDER BY tanggal
    `, [...params, ...params, ...params]);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching daily chart:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/grafik/mingguan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.role === 'kasir' ? req.user.id : null;
    let whereClause = '';
    let params = [];

    if (userId) {
      whereClause = ' AND user_id = ?';
      params.push(userId);
    }

    const [rows] = await db.promise().execute(`
      SELECT 
        CONCAT('Week ', WEEK(created_at)) as tanggal,
        COUNT(*) as total
      FROM (
        SELECT created_at, user_id FROM transfer WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 4 WEEK) ${whereClause}
        UNION ALL
        SELECT created_at, user_id FROM transfer_debit WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 4 WEEK) ${whereClause}
        UNION ALL
        SELECT created_at, user_id FROM tarik_tunai WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 4 WEEK) ${whereClause}
      ) as all_transactions
      GROUP BY WEEK(created_at)
      ORDER BY WEEK(created_at)
    `, [...params, ...params, ...params]);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching weekly chart:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/grafik/bulanan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.role === 'kasir' ? req.user.id : null;
    let whereClause = '';
    let params = [];

    if (userId) {
      whereClause = ' AND user_id = ?';
      params.push(userId);
    }

    const [rows] = await db.promise().execute(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as tanggal,
        COUNT(*) as total
      FROM (
        SELECT created_at, user_id FROM transfer WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 6 MONTH) ${whereClause}
        UNION ALL
        SELECT created_at, user_id FROM transfer_debit WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 6 MONTH) ${whereClause}
        UNION ALL
        SELECT created_at, user_id FROM tarik_tunai WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 6 MONTH) ${whereClause}
      ) as all_transactions
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY tanggal
    `, [...params, ...params, ...params]);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching monthly chart:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logs Routes (Owner only)
app.get('/logs', authenticateToken, async (req, res) => {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ message: 'Access denied. Hanya owner yang dapat melihat logs.' });
  }

  try {
    const { startDate, endDate, action, table_name, user_id, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;
    
    let query = `
      SELECT 
        l.*,
        u.username
      FROM logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    let countQuery = `
      SELECT COUNT(*) as total
      FROM logs l
      WHERE 1=1
    `;
    let params = [];

    if (startDate && endDate) {
      query += ' AND DATE(l.created_at) BETWEEN ? AND ?';
      countQuery += ' AND DATE(l.created_at) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    if (action) {
      query += ' AND l.action = ?';
      countQuery += ' AND l.action = ?';
      params.push(action);
    }

    if (table_name) {
      query += ' AND l.table_name = ?';
      countQuery += ' AND l.table_name = ?';
      params.push(table_name);
    }

    if (user_id) {
      query += ' AND l.user_id = ?';
      countQuery += ' AND l.user_id = ?';
      params.push(user_id);
    }

    query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const [rows] = await db.promise().execute(query, params);
    const [countRows] = await db.promise().execute(countQuery, params.slice(0, params.length - 2));
    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limitNum);
    
    // Parse JSON fields
    const logs = rows.map(log => ({
      ...log,
      old_values: log.old_values ? JSON.parse(log.old_values) : null,
      new_values: log.new_values ? JSON.parse(log.new_values) : null
    }));

    res.json({
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to create log entry
async function createLog(userId, action, tableName, recordId, oldValues = null, newValues = null, req = null) {
  try {
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip) : null;
    const userAgent = req ? req.headers['user-agent'] : null;

    await db.promise().execute(
      'INSERT INTO logs (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [
        userId,
        action,
        tableName,
        recordId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent
      ]
    );
  } catch (error) {
    console.error('Error creating log:', error);
    // Don't throw error, just log it so it doesn't break the main operation
  }
}

// Helper function to update saldo
async function updateSaldo(userId) {
  try {
    // Get total from all sources
    // Modal deposit: menambah saldo (uang masuk)
    const [modalTotal] = await db.promise().execute(
      'SELECT COALESCE(SUM(nominal), 0) as total FROM modal WHERE user_id = ?',
      [userId]
    );
    const modalAmount = parseFloat(modalTotal[0].total) || 0;

    // Transfer: MENAMBAH saldo (misalnya uang masuk dari hasil transfer)
    // nominal + biaya = total uang yang masuk
    const [transferTotal] = await db.promise().execute(
      'SELECT COALESCE(SUM(nominal + biaya), 0) as total FROM transfer WHERE user_id = ?',
      [userId]
    );
    const transferAmount = parseFloat(transferTotal[0].total) || 0;

    // Transfer debit: menambah saldo (biaya yang diterima)
    const [transferDebitTotal] = await db.promise().execute(
      'SELECT COALESCE(SUM(biaya), 0) as total FROM transfer_debit WHERE user_id = ?',
      [userId]
    );
    const transferDebitAmount = parseFloat(transferDebitTotal[0].total) || 0;

    // Tarik tunai: nominal_tarik mengurangi saldo, biaya_tarik menambah saldo
    // Net effect = biaya_tarik - nominal_tarik
    const [tarikTunaiNominal] = await db.promise().execute(
      'SELECT COALESCE(SUM(nominal_tarik), 0) as total FROM tarik_tunai WHERE user_id = ?',
      [userId]
    );
    const [tarikTunaiBiaya] = await db.promise().execute(
      'SELECT COALESCE(SUM(biaya_tarik), 0) as total FROM tarik_tunai WHERE user_id = ?',
      [userId]
    );
    const tarikTunaiNominalAmount = parseFloat(tarikTunaiNominal[0].total) || 0;
    const tarikTunaiBiayaAmount = parseFloat(tarikTunaiBiaya[0].total) || 0;
    const tarikTunaiNet = tarikTunaiBiayaAmount - tarikTunaiNominalAmount;

    // Total saldo = Modal (deposit) + Transfer + Transfer Debit - Tarik Tunai (nominal - biaya)
    const totalSaldo = modalAmount + transferAmount + transferDebitAmount + tarikTunaiNet;

    // Update saldo
    await db.promise().execute(
      'INSERT INTO saldo (user_id, total_saldo, created_at, updated_at) VALUES (?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE total_saldo = ?, updated_at = NOW()',
      [userId, totalSaldo, totalSaldo]
    );

    // Log for debugging
    console.log(`[updateSaldo] User ${userId}: Modal=${modalAmount}, Transfer=-${transferAmount}, TransferDebit=+${transferDebitAmount}, TarikTunai=${tarikTunaiNet}, Total=${totalSaldo}`);

  } catch (error) {
    console.error('Error updating saldo:', error);
    throw error; // Re-throw to see the error in the calling function
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});