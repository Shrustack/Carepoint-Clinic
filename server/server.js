const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const doctorsFile = path.join(__dirname, 'doctors.json');
const bookingsFile = path.join(__dirname, 'bookings.json');

// Predefined slots: 10AM to 5PM, every hour
const predefinedSlots = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

app.get('/doctors', (req, res) => {
  const doctors = JSON.parse(fs.readFileSync(doctorsFile, 'utf8'));
  res.json(doctors);
});

app.get('/slots', (req, res) => {
  const { doctorId, date } = req.query;
  const bookings = JSON.parse(fs.readFileSync(bookingsFile, 'utf8'));
  const doctorBookings = bookings.filter(b => b.doctorId === doctorId && b.date === date);
  const slotCounts = {};
  predefinedSlots.forEach(slot => slotCounts[slot] = 0);
  doctorBookings.forEach(b => {
    if (slotCounts[b.time] !== undefined) slotCounts[b.time]++;
  });
  const availableSlots = predefinedSlots.filter(slot => slotCounts[slot] < 3);
  res.json(availableSlots);
});

app.post('/book', (req, res) => {
  const { name, phone, doctorId, date, time } = req.body;
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 240) : '';
  // Validation
  if (!name || !phone || !doctorId || !date || !time) {
    return res.status(400).json({ error: 'All fields required' });
  }
  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }
  const today = new Date().toISOString().split('T')[0];
  if (date < today) {
    return res.status(400).json({ error: 'Cannot book past dates' });
  }
  const bookings = JSON.parse(fs.readFileSync(bookingsFile, 'utf8'));
  const existing = bookings.filter(b => b.doctorId === doctorId && b.date === date && b.time === time);
  if (existing.length >= 3) {
    return res.status(400).json({ error: 'Slot full' });
  }
  const newBooking = { id: Date.now().toString(), name, phone, doctorId, date, time, reason };
  bookings.push(newBooking);
  fs.writeFileSync(bookingsFile, JSON.stringify(bookings, null, 2));
  res.json({ message: 'Booking successful', booking: newBooking });
});

app.get('/appointments', (req, res) => {
  const bookings = JSON.parse(fs.readFileSync(bookingsFile, 'utf8'));
  res.json(bookings);
});

app.listen(3000, () => console.log('Server running on port 3000'));