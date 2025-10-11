const express = require('express');
const pool = require('./event_db');
const cors = require('cors');
const path = require('path');
const { exec } = require('child_process');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name FROM categories ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/organizations', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, description, contact_email, phone FROM organizations');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/events/upcoming', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT e.id,e.name,e.short_description,e.event_date,e.location,e.price,e.image_url,c.name AS category, e.status, e.goal_amount, e.raised_amount FROM events e JOIN categories c ON e.category_id=c.id WHERE e.status='active' AND DATE(e.event_date) >= CURDATE() ORDER BY e.event_date ASC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/events/past', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT e.id,e.name,e.short_description,e.event_date,e.location,e.price,e.image_url,c.name AS category, e.status, e.goal_amount, e.raised_amount FROM events e JOIN categories c ON e.category_id=c.id WHERE e.status='active' AND DATE(e.event_date) < CURDATE() ORDER BY e.event_date DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/events', async (req, res) => {
  try {
    const { category, location, start_date, end_date, q } = req.query;
    let sql = "SELECT e.id,e.name,e.short_description,e.event_date,e.location,e.price,e.image_url,c.name AS category,e.status,e.goal_amount,e.raised_amount FROM events e JOIN categories c ON e.category_id=c.id WHERE e.status='active'";
    const params = [];
    if (category) {
      sql += " AND e.category_id = ?";
      params.push(category);
    }
    if (location) {
      sql += " AND e.location LIKE ?";
      params.push('%' + location + '%');
    }
    if (start_date) {
      sql += " AND DATE(e.event_date) >= ?";
      params.push(start_date);
    }
    if (end_date) {
      sql += " AND DATE(e.event_date) <= ?";
      params.push(end_date);
    }
    if (q) {
      sql += " AND (e.name LIKE ? OR e.short_description LIKE ? OR e.description LIKE ?)";
      const like = '%' + q + '%';
      params.push(like, like, like);
    }
    sql += " ORDER BY e.event_date ASC";
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/events/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await pool.query(
      "SELECT e.*, c.name AS category, o.name AS organization, o.contact_email, o.phone FROM events e JOIN categories c ON e.category_id=c.id JOIN organizations o ON e.org_id=o.id WHERE e.id = ?",
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Event not found' });
    const event = rows[0];
    const [images] = await pool.query('SELECT url,caption FROM event_images WHERE event_id = ?', [id]);
    const [tickets] = await pool.query('SELECT type, price, quantity FROM tickets WHERE event_id = ?', [id]);
    const [registrations] = await pool.query('SELECT id, name, contact_email, phone, number_of_tickets, amount_paid, registration_date FROM registrations WHERE event_id = ? ORDER BY registration_date DESC', [id]);
    event.images = images;
    event.tickets = tickets;
    event.registrations = registrations;
    event.progress = event.goal_amount && event.goal_amount > 0 ? Math.min(100, (event.raised_amount / event.goal_amount) * 100) : 0;
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: 'Server error',req });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const { date, location, category } = req.query;
    let sql = "SELECT e.id,e.name,e.short_description,e.event_date,e.location,e.price,e.image_url,c.name AS category FROM events e JOIN categories c ON e.category_id=c.id WHERE e.status='active'";
    const params = [];
    if (date) {
      sql += " AND DATE(e.event_date) = ?";
      params.push(date);
    }
    if (location) {
      sql += " AND e.location LIKE ?";
      params.push('%' + location + '%');
    }
    if (category) {
      sql += " AND e.category_id = ?";
      params.push(category);
    }
    sql += " ORDER BY e.event_date ASC";
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/home', async (req, res) => {
  try {
    const [upcoming] = await pool.query(
      "SELECT e.id,e.name,e.short_description,e.event_date,e.location,e.price,e.image_url,c.name AS category,e.goal_amount,e.raised_amount FROM events e JOIN categories c ON e.category_id=c.id WHERE e.status='active' AND DATE(e.event_date) >= CURDATE() ORDER BY e.event_date ASC LIMIT 8"
    );
    const [popular] = await pool.query(
      "SELECT e.id,e.name,e.short_description,e.event_date,e.location,e.price,e.image_url,c.name AS category,e.goal_amount,e.raised_amount FROM events e JOIN categories c ON e.category_id=c.id WHERE e.status='active' ORDER BY e.raised_amount DESC LIMIT 4"
    );
    res.json({ upcoming, popular });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    const body = req.body;
    const fields = ['org_id','category_id','name','short_description','description','event_date','location','address','price','capacity','image_url','goal_amount','raised_amount','status'];
    const values = fields.map(f => body[f] !== undefined ? body[f] : null);
    const placeholders = fields.map(() => '?').join(',');
    const [result] = await pool.query(`INSERT INTO events (${fields.join(',')}) VALUES (${placeholders})`, values);
    const [rows] = await pool.query('SELECT * FROM events WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/events/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body;
    const allowed = ['org_id','category_id','name','short_description','description','event_date','location','address','price','capacity','image_url','goal_amount','raised_amount','status'];
    const sets = [];
    const params = [];
    allowed.forEach(k => {
      if (body[k] !== undefined) {
        sets.push(`${k} = ?`);
        params.push(body[k]);
      }
    });
    if (!sets.length) return res.status(400).json({ message: 'No fields to update' });
    params.push(id);
    await pool.query(`UPDATE events SET ${sets.join(',')} WHERE id = ?`, params);
    const [rows] = await pool.query('SELECT * FROM events WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const [regs] = await pool.query('SELECT COUNT(*) AS cnt FROM registrations WHERE event_id = ?', [id]);
    if (regs[0].cnt > 0) return res.status(400).json({ message: 'Cannot delete event with registrations' });
    await pool.query('DELETE FROM event_images WHERE event_id = ?', [id]);
    await pool.query('DELETE FROM tickets WHERE event_id = ?', [id]);
    await pool.query('DELETE FROM events WHERE id = ?', [id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/registrations', async (req, res) => {
  try {
    const { event_id, name, contact_email, phone, number_of_tickets } = req.body;
    if (!event_id || !name || !contact_email || !number_of_tickets) return res.status(400).json({ message: 'Missing fields' });
    const [existing] = await pool.query('SELECT COUNT(*) AS cnt FROM registrations WHERE event_id = ? AND contact_email = ?', [event_id, contact_email]);
    if (existing[0].cnt > 0) return res.status(400).json({ message: 'You have already registered for this event' });
    const [eRows] = await pool.query('SELECT price, capacity, raised_amount FROM events WHERE id = ?', [event_id]);
    if (!eRows.length) return res.status(404).json({ message: 'Event not found' });
    const event = eRows[0];
    const total = parseFloat(event.price || 0) * parseInt(number_of_tickets, 10);
    await pool.query('INSERT INTO registrations (event_id, name, contact_email, phone, number_of_tickets, amount_paid) VALUES (?,?,?,?,?,?)', [event_id, name, contact_email, phone || null, number_of_tickets, total]);
    await pool.query('UPDATE events SET raised_amount = COALESCE(raised_amount,0) + ? WHERE id = ?', [total, event_id]);
    const [rows] = await pool.query('SELECT id, name, contact_email, phone, number_of_tickets, amount_paid, registration_date FROM registrations WHERE event_id = ? AND contact_email = ?', [event_id, contact_email]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/events-admin', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT e.id,e.name,e.short_description,e.event_date,e.location,e.price,e.image_url,c.name AS category,e.status,e.goal_amount,e.raised_amount FROM events e JOIN categories c ON e.category_id=c.id ORDER BY e.event_date DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/registrations', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT r.id, r.event_id, r.name, r.contact_email, r.phone, r.number_of_tickets, r.amount_paid, r.registration_date, e.name AS event_name FROM registrations r JOIN events e ON r.event_id = e.id ORDER BY r.registration_date DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api/')) return next();
  if (path.extname(req.path)) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function openUrl(url) {
  if (process.platform === 'win32') {
    exec(`start "" "${url}"`);
  } else if (process.platform === 'darwin') {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  const url = `http://localhost:${PORT}/`;
  console.log(`Server listening at ${url}`);
  try {
    openUrl(url);
  } catch (e) {}
});
