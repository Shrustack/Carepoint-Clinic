const functions = require('firebase-functions');
const express = require('express');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(express.json());

const doctorsFile = path.join(__dirname, 'doctors.json');

// Predefined slots: 10AM to 5PM, every hour
const predefinedSlots = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const doctors = JSON.parse(fs.readFileSync(doctorsFile, 'utf8'));
const isValidDate = date => {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === date;
};

app.get('/doctors', (req, res) => {
  res.json(doctors);
});

app.get('/slots', async (req, res) => {
  const { doctorId, date } = req.query;
  if (!doctors.some(doctor => doctor.id === doctorId) || !isValidDate(date)) {
    return res.status(400).json({ error: 'Choose a valid doctor and date' });
  }
  try {
    const snapshot = await db.collection('bookings').where('doctorId', '==', doctorId).where('date', '==', date).get();
    const doctorBookings = snapshot.docs.map(doc => doc.data());
    const slotCounts = {};
    predefinedSlots.forEach(slot => slotCounts[slot] = 0);
    doctorBookings.forEach(b => {
      if (slotCounts[b.time] !== undefined) slotCounts[b.time]++;
    });
    const availableSlots = predefinedSlots.filter(slot => slotCounts[slot] < 3);
    res.json(availableSlots);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching slots' });
  }
});

app.post('/book', async (req, res) => {
  const { name, phone, doctorId, date, time } = req.body;
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 240) : '';
  if (!trimmedName || !phone || !doctorId || !date || !time) {
    return res.status(400).json({ error: 'All fields required' });
  }
  if (trimmedName.length > 120 || typeof phone !== 'string' || !/^\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }
  const today = new Date().toISOString().split('T')[0];
  if (!doctors.some(doctor => doctor.id === doctorId) || !predefinedSlots.includes(time)) {
    return res.status(400).json({ error: 'Choose a valid doctor and appointment time' });
  }
  if (!isValidDate(date) || date < today) {
    return res.status(400).json({ error: 'Cannot book past dates' });
  }
  try {
    const bookingRef = db.collection('bookings').doc();
    const capacityRef = db.collection('slotCapacity').doc(`${doctorId}_${date}_${time}`);
    const bookingQuery = db.collection('bookings').where('doctorId', '==', doctorId).where('date', '==', date).where('time', '==', time);
    const isFull = await db.runTransaction(async transaction => {
      const capacitySnapshot = await transaction.get(capacityRef);
      const currentCount = capacitySnapshot.exists
        ? capacitySnapshot.data().count
        : (await transaction.get(bookingQuery)).size;
      if (currentCount >= 3) return true;
      transaction.set(capacityRef, { count: currentCount + 1 });
      transaction.set(bookingRef, { id: bookingRef.id, name: trimmedName, phone, doctorId, date, time, reason });
      return false;
    });
    if (isFull) return res.status(409).json({ error: 'Slot full' });
    const newBooking = { id: bookingRef.id, name: trimmedName, phone, doctorId, date, time, reason };
    res.json({ message: 'Booking successful', booking: newBooking });
  } catch (error) {
    res.status(500).json({ error: 'Error booking appointment' });
  }
});

exports.api = functions.https.onRequest(app);