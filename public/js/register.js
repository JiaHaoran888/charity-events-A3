function queryParam(name){
  const url = new URL(location.href);
  return url.searchParams.get(name);
}
async function loadEventSummary(){
  const id = queryParam('id');
  const el = document.getElementById('event-info');
  if(!id){ el.innerHTML = '<div class="card"><p>Event not specified.</p></div>'; return; }
  const res = await fetch('/api/events/' + encodeURIComponent(id));
  if(res.status === 404){ el.innerHTML = '<div class="card"><p>Event not found.</p></div>'; return; }
  const ev = await res.json();
  const img = ev.image_url || '/assets/placeholder.jpg';
  const date = new Date(ev.event_date).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  const priceLabel = parseFloat(ev.price) === 0 ? 'Free' : '$'+parseFloat(ev.price).toFixed(2);
  el.innerHTML = `
    <div class="event-media" style="display:flex;gap:16px;align-items:flex-start">
      <img src="${img}" alt="${ev.name}" style="width:200px;height:120px;object-fit:cover;border-radius:8px">
      <div style="flex:1">
        <h3>${ev.name}</h3>
        <p class="muted">${ev.category} · ${ev.location} · ${date}</p>
        <p style="margin-top:8px">${ev.short_description}</p>
        <div style="margin-top:8px"><strong>Price:</strong> ${priceLabel}</div>
      </div>
    </div>
  `;
}
async function submitRegistration(ev){
  ev.preventDefault();
  const id = queryParam('id');
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const tickets = parseInt(document.getElementById('tickets').value,10) || 1;
  const msg = document.getElementById('reg-message');
  msg.textContent = '';
  if(!name || !email || tickets < 1){ msg.textContent = 'Please provide valid name, email and ticket count.'; return; }
  try {
    const res = await fetch('/api/registrations', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ event_id: id, name, contact_email: email, phone, number_of_tickets: tickets })
    });
    const data = await res.json();
    if(!res.ok){ msg.textContent = data.message || 'Registration failed'; return; }
    msg.textContent = 'Registration successful. Thank you!';
    setTimeout(()=>{ location.href = '/event.html?id=' + id }, 1500);
  } catch (e) {
    msg.textContent = 'An error occurred. Please try again.';
  }
}
document.addEventListener('DOMContentLoaded', ()=>{
  loadEventSummary();
  const form = document.getElementById('reg-form');
  form.addEventListener('submit', submitRegistration);
  document.getElementById('cancel').addEventListener('click', ()=>{ const id = queryParam('id'); if(id) location.href = '/event.html?id=' + id; else location.href = '/'; });
});
