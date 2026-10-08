const express = require('express');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = {
  type: "service_account",
  project_id: "carepoint-clinic-5bc8a",
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
app.use(express.json());

// Predefined slots: 10AM to 5PM, every hour
const predefinedSlots = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

app.get('/doctors', async (req, res) => {
  try {
    // For demo, return static data since we don't have a doctors collection
    const doctors = [
      { id: "1", name: "Dr. Alice Johnson", specialization: "Cardiology", experience: "10 years" },
      { id: "2", name: "Dr. Bob Smith", specialization: "Dermatology", experience: "8 years" },
      { id: "3", name: "Dr. Carol Lee", specialization: "Pediatrics", experience: "12 years" },
      { id: "4", name: "Dr. David Kim", specialization: "Orthopedics", experience: "15 years" }
    ];
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching doctors' });
  }
});

app.get('/slots', async (req, res) => {
  const { doctorId, date } = req.query;
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
  try {
    const snapshot = await db.collection('bookings').where('doctorId', '==', doctorId).where('date', '==', date).where('time', '==', time).get();
    if (snapshot.size >= 3) {
      return res.status(400).json({ error: 'Slot full' });
    }
    const newBooking = { id: Date.now().toString(), name, phone, doctorId, date, time };
    await db.collection('bookings').doc(newBooking.id).set(newBooking);
    res.json({ message: 'Booking successful', booking: newBooking });
  } catch (error) {
    res.status(500).json({ error: 'Error booking appointment' });
  }
});

app.get('/appointments', async (req, res) => {
  try {
    const snapshot = await db.collection('bookings').get();
    const bookings = snapshot.docs.map(doc => doc.data());
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching appointments' });
  }
});

module.exports = app;