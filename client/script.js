document.addEventListener('DOMContentLoaded', () => {
  const doctorsDiv = document.getElementById('doctors');
  const doctorSelect = document.getElementById('doctor');
  const dateInput = document.getElementById('date');
  const timeSelect = document.getElementById('time');
  const form = document.getElementById('bookingForm');
  const messageDiv = document.getElementById('message');

  // Fetch doctors
  fetch('/doctors')
    .then(res => res.json())
    .then(doctors => {
      doctors.forEach(doc => {
        const div = document.createElement('div');
        div.className = 'doctor';
        div.innerHTML = `<h3>${doc.name}</h3><p>${doc.specialization} - ${doc.experience}</p>`;
        doctorsDiv.appendChild(div);

        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = doc.name;
        doctorSelect.appendChild(option);
      });
    })
    .catch(err => console.error('Error fetching doctors:', err));

  // On doctor or date change, fetch slots
  const updateSlots = () => {
    const doctorId = doctorSelect.value;
    const date = dateInput.value;
    if (!doctorId || !date) return;
    fetch(`/slots?doctorId=${doctorId}&date=${date}`)
      .then(res => res.json())
      .then(slots => {
        timeSelect.innerHTML = '<option value="">Select Time</option>';
        slots.forEach(slot => {
          const option = document.createElement('option');
          option.value = slot;
          option.textContent = slot;
          timeSelect.appendChild(option);
        });
      })
      .catch(err => console.error('Error fetching slots:', err));
  };

  doctorSelect.addEventListener('change', updateSlots);
  dateInput.addEventListener('change', updateSlots);

  // Set min date to today
  const today = new Date().toISOString().split('T')[0];
  dateInput.min = today;

  // Form submit
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const doctorId = doctorSelect.value;
    const date = dateInput.value;
    const time = timeSelect.value;

    if (!name || !phone || !doctorId || !date || !time) {
      messageDiv.style.color = 'red';
      messageDiv.textContent = 'All fields are required.';
      return;
    }

    if (!/^\d{10}$/.test(phone)) {
      messageDiv.style.color = 'red';
      messageDiv.textContent = 'Phone number must be 10 digits.';
      return;
    }

    fetch('/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, doctorId, date, time })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        messageDiv.style.color = 'red';
        messageDiv.textContent = data.error;
      } else {
        messageDiv.style.color = 'green';
        messageDiv.textContent = 'Booking successful!';
        form.reset();
        updateSlots(); // Refresh slots
      }
    })
    .catch(err => {
      messageDiv.style.color = 'red';
      messageDiv.textContent = 'An error occurred. Please try again.';
      console.error('Error booking:', err);
    });
  });
});