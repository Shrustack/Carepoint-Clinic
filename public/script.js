document.addEventListener('DOMContentLoaded', () => {
  const doctorsGrid = document.getElementById('doctors');
  const doctorSelect = document.getElementById('doctor');
  const dateInput = document.getElementById('date');
  const timeSelect = document.getElementById('time');
  const form = document.getElementById('bookingForm');
  const message = document.getElementById('message');
  const submitButton = form.querySelector('button[type="submit"]');
  const apiBase = window.location.hostname.endsWith('github.io')
    ? 'https://us-central1-carepoint-clinic-5bc8a.cloudfunctions.net/api'
    : '';
  const categoryFilter = document.getElementById('category-filter');
  const areaFilter = document.getElementById('area-filter');
  const searchInput = document.getElementById('doctor-search');
  const sortFilter = document.getElementById('sort-filter');
  const resultsSummary = document.getElementById('results-summary');
  const selectedDoctor = document.getElementById('selected-doctor');
  const formStep = document.getElementById('form-step');
  let doctors = [];
  let slotsRequest = 0;

  const localDate = new Date();
  localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
  dateInput.min = localDate.toISOString().slice(0, 10);

  const setMessage = (text, state = '') => {
    message.textContent = text;
    message.className = `form-message${state ? ` is-${state}` : ''}`;
  };

  const addText = (parent, tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    parent.append(element);
    return element;
  };

  const makeDoctorCard = doctor => {
    const card = document.createElement('article');
    card.className = 'doctor-card';
    const cardTop = document.createElement('div');
    cardTop.className = 'doctor-card-top';
    addText(cardTop, 'span', 'doctor-specialty', doctor.specialization);
    if (doctor.bestDoctor) addText(cardTop, 'span', 'best-tag', '★ Best doctor');
    card.append(cardTop);
    addText(card, 'h3', 'doctor-name', doctor.name);
    addText(card, 'p', 'doctor-area', `⌖ ${doctor.area}`);
    const stats = document.createElement('div');
    stats.className = 'doctor-stats';
    addText(stats, 'span', '', `${doctor.experience} years experience`);
    addText(stats, 'span', '', `${doctor.patientsTreated.toLocaleString()}+ happy patients`);
    addText(stats, 'span', '', `${doctor.surgeries.toLocaleString()} successful procedures`);
    card.append(stats);
    addText(card, 'p', 'doctor-award', `Award · ${doctor.award}`);
    addText(card, 'span', 'doctor-rating', `★ ${doctor.rating.toFixed(1)} patient rating`);
    const link = document.createElement('a');
    link.href = '#appointment';
    link.className = 'doctor-link';
    link.textContent = 'Book with this doctor';
    link.addEventListener('click', () => {
      doctorSelect.value = doctor.id;
      doctorSelect.dispatchEvent(new Event('change'));
    });
    card.append(link);
    return card;
  };

  const renderDoctors = () => {
    const search = searchInput.value.trim().toLowerCase();
    const filtered = doctors.filter(doctor => {
      const matchesCategory = !categoryFilter.value || doctor.specialization === categoryFilter.value;
      const matchesArea = !areaFilter.value || doctor.area === areaFilter.value;
      const searchable = `${doctor.name} ${doctor.specialization} ${doctor.area} ${doctor.award}`.toLowerCase();
      return matchesCategory && matchesArea && searchable.includes(search);
    });
    const sorters = {
      rating: (first, second) => second.rating - first.rating || second.experience - first.experience,
      experience: (first, second) => second.experience - first.experience || second.rating - first.rating,
      patients: (first, second) => second.patientsTreated - first.patientsTreated
    };
    filtered.sort(sorters[sortFilter.value] || sorters.rating);
    doctorsGrid.replaceChildren(...filtered.map(makeDoctorCard));
    resultsSummary.textContent = `${filtered.length} ${filtered.length === 1 ? 'doctor' : 'doctors'} available${categoryFilter.value ? ` in ${categoryFilter.value}` : ''}${areaFilter.value ? ` near ${areaFilter.value}` : ''}`;
    if (!filtered.length) addText(doctorsGrid, 'p', 'loading-state', 'No doctors match those filters. Try another specialty or area.');
  };

  const showSelectedDoctor = () => {
    const doctor = doctors.find(item => item.id === doctorSelect.value);
    selectedDoctor.replaceChildren();
    selectedDoctor.hidden = !doctor;
    if (!doctor) return;
    addText(selectedDoctor, 'span', 'selected-doctor-label', 'YOUR DOCTOR');
    addText(selectedDoctor, 'strong', '', doctor.name);
    addText(selectedDoctor, 'span', '', `${doctor.specialization} · ${doctor.area} · ${doctor.experience} years`);
  };

  const updateProgress = () => {
    const step = timeSelect.value ? 3 : (doctorSelect.value && dateInput.value ? 2 : 1);
    formStep.textContent = `0${step} — 03`;
  };

  const loadDoctors = async () => {
    try {
      let response = await fetch(`${apiBase}/doctors`);
      if (!response.ok) response = await fetch('./doctors.json');
      if (!response.ok) throw new Error('Doctors could not be loaded.');
      doctors = await response.json();
      if (!Array.isArray(doctors) || !doctors.length) throw new Error('No doctors available.');
      [...new Set(doctors.map(doctor => doctor.specialization))].sort().forEach(category => categoryFilter.append(new Option(category, category)));
      [...new Set(doctors.map(doctor => doctor.area))].sort().forEach(area => areaFilter.append(new Option(area, area)));
      doctors.forEach(doctor => {
        const option = document.createElement('option');
        option.value = doctor.id;
        option.textContent = `${doctor.name} · ${doctor.specialization} · ${doctor.area}`;
        doctorSelect.append(option);
      });
      renderDoctors();
    } catch {
      const error = document.createElement('p');
      error.className = 'loading-state';
      error.textContent = 'Our care team could not load right now. Please refresh and try again.';
      doctorsGrid.replaceChildren(error);
      resultsSummary.textContent = 'Doctor directory unavailable';
      setMessage('We could not load the doctor list. Please refresh the page.', 'error');
    }
  };

  const updateSlots = async () => {
    const requestId = ++slotsRequest;
    const { value: doctorId } = doctorSelect;
    const { value: date } = dateInput;
    timeSelect.disabled = true;
    timeSelect.replaceChildren(new Option(doctorId && date ? 'Checking availability...' : 'Select a doctor and date first', ''));
    if (!doctorId || !date) return;

    try {
      const params = new URLSearchParams({ doctorId, date });
      const response = await fetch(`${apiBase}/slots?${params}`);
      if (!response.ok) throw new Error('Availability could not be loaded.');
      const slots = await response.json();
      if (requestId !== slotsRequest) return;
      timeSelect.replaceChildren(new Option(slots.length ? 'Select a time' : 'No times available', ''));
      slots.forEach(slot => {
        const [hour, minute] = slot.split(':').map(Number);
        const label = new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        timeSelect.append(new Option(label, slot));
      });
      timeSelect.disabled = slots.length === 0;
      if (!slots.length) setMessage('No appointments are available at this time. Try another date.', 'error');
      else setMessage();
    } catch {
      if (requestId !== slotsRequest) return;
      timeSelect.replaceChildren(new Option('Availability unavailable', ''));
      setMessage('We could not check availability. Please try again.', 'error');
    }
  };

  [categoryFilter, areaFilter, sortFilter].forEach(filter => filter.addEventListener('change', renderDoctors));
  searchInput.addEventListener('input', renderDoctors);
  doctorSelect.addEventListener('change', () => {
    showSelectedDoctor();
    updateProgress();
    updateSlots();
  });
  dateInput.addEventListener('change', () => {
    updateProgress();
    updateSlots();
  });
  timeSelect.addEventListener('change', updateProgress);
  form.addEventListener('input', updateProgress);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submitButton.disabled = true;
    submitButton.innerHTML = 'Sending request...';
    setMessage('Checking your appointment request...');

    const payload = {
      name: document.getElementById('name').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      doctorId: doctorSelect.value,
      date: dateInput.value,
      time: timeSelect.value,
      reason: document.getElementById('reason').value
    };

    try {
      const response = await fetch(`${apiBase}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'We could not book that appointment.');
      const selectedDoctor = doctors.find(doctor => doctor.id === payload.doctorId);
      setMessage(`Appointment requested with ${selectedDoctor.name} for ${dateInput.value} at ${timeSelect.options[timeSelect.selectedIndex].text}.`, 'success');
      form.reset();
      showSelectedDoctor();
      updateProgress();
      timeSelect.disabled = true;
      timeSelect.replaceChildren(new Option('Select a doctor and date first', ''));
    } catch (error) {
      setMessage(error.message || 'Something went wrong. Please try again.', 'error');
      if (error.message === 'Slot full') await updateSlots();
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = 'Request appointment <span aria-hidden="true">↗</span>';
    }
  });

  const chatPanel = document.getElementById('chat-panel');
  const chatLauncher = document.getElementById('chat-launcher');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatForm = document.getElementById('chat-form');

  const addChatMessage = (text, sender) => addText(chatMessages, 'p', `chat-bubble ${sender}-bubble`, text);
  const respondTo = question => {
    const query = question.toLowerCase();
    if (/book|appointment|slot|time/.test(query)) return 'Choose a doctor, date, and available time in the appointment form. Requests are sent to the clinic for confirmation.';
    if (/area|location|near|where/.test(query)) return `Our listed clinic areas are ${[...new Set(doctors.map(doctor => doctor.area))].join(', ')}. Choose an area filter to see nearby specialists.`;
    if (/heart|cardio/.test(query)) return 'For heart and circulation concerns, browse our Cardiology team. For urgent symptoms, contact emergency services now.';
    if (/women|pregnan|gyn|period/.test(query)) return 'Our Gynecology team can help with women’s health visits. Choose Gynecology in the specialty filter to compare clinicians.';
    if (/bone|joint|ortho|injur/.test(query)) return 'Browse Orthopedics for bone, joint, and mobility visits. For an emergency injury, contact emergency services.';
    if (/ear|nose|throat|ent/.test(query)) return 'Our ENT team sees ear, nose, and throat appointments. Select ENT in the specialty filter to see the team.';
    if (/skin|derm/.test(query)) return 'Browse Dermatology for skin and hair consultations. Select Dermatology in the specialty filter to compare clinicians.';
    if (/child|baby|pediatr/.test(query)) return 'Our Pediatrics team provides visits for children. Select Pediatrics in the specialty filter to find a clinician.';
    if (/special|doctor|choose|help/.test(query)) return 'I can point you to a specialty, but I can’t assess symptoms or diagnose. Tell me the specialty you’re looking for, or contact the clinic for personal guidance.';
    return 'I can help with specialties, clinic areas, and appointment booking. For medical advice, please contact a qualified clinician.';
  };

  const sendChat = question => {
    const trimmed = question.trim();
    if (!trimmed) return;
    addChatMessage(trimmed, 'visitor');
    addChatMessage(respondTo(trimmed), 'assistant');
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  chatLauncher.addEventListener('click', () => {
    const open = chatPanel.hidden;
    chatPanel.hidden = !open;
    chatLauncher.setAttribute('aria-expanded', String(open));
    if (open) chatInput.focus();
  });
  document.getElementById('chat-close').addEventListener('click', () => {
    chatPanel.hidden = true;
    chatLauncher.setAttribute('aria-expanded', 'false');
    chatLauncher.focus();
  });
  document.querySelectorAll('.chat-prompts button').forEach(button => button.addEventListener('click', () => sendChat(button.dataset.question)));
  chatForm.addEventListener('submit', event => {
    event.preventDefault();
    sendChat(chatInput.value);
    chatInput.value = '';
  });

  loadDoctors();
});