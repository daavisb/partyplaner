// Entry point for Party Planner Pro+

import Confetti from './modules/confetti.js'; // hypothetical module path

class EventBus {
  constructor() { this.events = new Map(); }
  on(evt, fn) { (this.events.get(evt) || this.events.set(evt, []).get(evt)).push(fn); }
  emit(evt, data) { (this.events.get(evt) || []).forEach(fn => fn(data)); }
}

class PartyModel {
  constructor() {
    this.bus = new EventBus();
    this.details = { date: null, desc: '', msg: '' };
    this.participants = [];
    this.lastRemoved = null;
  }
  setDetails(date, desc, msg) {
    this.details = { date, desc, msg };
    this.bus.emit('detailsUpdated', this.details);
  }
  addParticipant(p) {
    this.participants.push(p);
    this.bus.emit('participantsUpdated', this.participants);
  }
  removeParticipant(idx) {
    this.lastRemoved = { idx, participant: this.participants[idx] };
    this.participants.splice(idx, 1);
    this.bus.emit('participantsUpdated', this.participants);
  }
  undoRemove() {
    if (!this.lastRemoved) return;
    this.participants.splice(this.lastRemoved.idx, 0, this.lastRemoved.participant);
    this.bus.emit('participantsUpdated', this.participants);
    this.lastRemoved = null;
  }
  exportCSV() {
    const header = ['First Name', 'Last Name'].join(',');
    const rows = this.participants.map(p => [p.first, p.last].join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'participants.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}

class PartyView {
  constructor(bus, model) {
    this.bus = bus;
    this.model = model;
    this.container = document.getElementById('party-app');
    this.snackbar = document.getElementById('snackbar');
    this.confetti = document.getElementById('confetti');

    this.init();
  }
  init() {
    this.container.innerHTML = `
      <section class="section" id="setup">
        <div class="section__header">
          <h2>Setup Your Party</h2>
          <button class="button" id="export-btn" title="Export Guest List (Alt+E)">Export CSV</button>
        </div>
        <div class="form-group">
          <label for="date">Party Date & Time</label>
          <input type="datetime-local" id="date">
        </div>
        <div class="form-group">
          <label for="desc">Description</label>
          <textarea id="desc" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label for="msg">Invite Message</label>
          <textarea id="msg" rows="2"></textarea>
        </div>
        <button class="button" id="save-btn" title="Save Party (Alt+S)">Save Details</button>
      </section>
      <section class="section hidden" id="preview">
        <div class="countdown" role="timer"></div>
        <h2>Invite Preview</h2>
        <p><strong>Date:</strong> <span id="preview-date"></span></p>
        <p><strong>Description:</strong> <span id="preview-desc"></span></p>
        <p id="preview-msg"></p>
      </section>
      <section class="section hidden" id="registration">
        <h2>Join the Party</h2>
        <input type="text" id="search" class="search-input" placeholder="Search participants...">
        <div class="form-group" style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
          <input type="text" id="first" placeholder="First Name">
          <input type="text" id="last" placeholder="Last Name">
        </div>
        <button class="button" id="join-btn" title="Join Party (Alt+J)">Join</button>
        <ul class="participants-list" id="list"></ul>
      </section>
    `;

    this.cache();
    this.bind();
    this.confettiEngine = new Confetti(this.confetti);
    this.loadTheme();
  }
  cache() {
    this.setupSection = document.getElementById('setup');
    this.previewSection = document.getElementById('preview');
    this.regSection = document.getElementById('registration');
    this.saveBtn = document.getElementById('save-btn');
    this.dateIn = document.getElementById('date');
    this.descIn = document.getElementById('desc');
    this.msgIn = document.getElementById('msg');
    this.previewDate = document.getElementById('preview-date');
    this.previewDesc = document.getElementById('preview-desc');
    this.previewMsg = document.getElementById('preview-msg');
    this.countdownEl = this.previewSection.querySelector('.countdown');
    this.searchIn = document.getElementById('search');
    this.firstIn = document.getElementById('first');
    this.lastIn = document.getElementById('last');
    this.joinBtn = document.getElementById('join-btn');
    this.listEl = document.getElementById('list');
    this.exportBtn = document.getElementById('export-btn');
    this.toggleThemeBtn = document.getElementById('toggle-theme');
  }
  bind() {
    this.saveBtn.addEventListener('click', () => this.bus.emit('save'));
    this.joinBtn.addEventListener('click', () => this.bus.emit('join'));
    this.exportBtn.addEventListener('click', () => this.bus.emit('export'));
    this.searchIn.addEventListener('input', () => this.bus.emit('search', this.searchIn.value));
    this.toggleThemeBtn.addEventListener('click', () => this.bus.emit('toggleTheme'));

    document.addEventListener('keydown', e => {
      if (e.altKey && e.key.toLowerCase()==='s') this.bus.emit('save');
      if (e.altKey && e.key.toLowerCase()==='j') this.bus.emit('join');
      if (e.altKey && e.key.toLowerCase()==='e') this.bus.emit('export');
    });

    this.bus.on('detailsUpdated', data => this.renderPreview(data));
    this.bus.on('participantsUpdated', list => this.renderList(list));
    this.bus.on('countdown', text => this.countdownEl.textContent = text);
    this.bus.on('snackbar', msg => this.showSnackbar(msg));
    this.bus.on('confetti', () => this.confettiEngine.fire());
    this.bus.on('theme', mode => this.applyTheme(mode));
  }
  renderPreview({ date, desc, msg }) {
    const dt = new Date(date);
    this.previewDate.textContent = dt.toLocaleString(undefined, { dateStyle:'full', timeStyle:'short' });
    this.previewDesc.textContent = desc;
    this.previewMsg.textContent = msg;
    this.setupSection.classList.add('hidden');
    this.previewSection.classList.remove('hidden');
    this.regSection.classList.remove('hidden');
  }
  renderList(list) {
    const term = this.searchIn.value.toLowerCase();
    this.listEl.innerHTML = list.map((p,i) => {
      const name = `${p.first} ${p.last}`;
      if (term && !name.toLowerCase().includes(term)) return '';
      return `
      <li class="participant">
        <span>${i+1}. ${name}</span>
        <button aria-label="Remove ${name}" data-idx="${i}">✖</button>
      </li>`;
    }).join('');
    this.listEl.querySelectorAll('button').forEach(btn => btn.addEventListener('click', e => this.bus.emit('remove', +e.target.dataset.idx)));
  }
  showSnackbar(message) {
    this.snackbar.innerHTML = `${message} <button id="undo-btn">UNDO</button>`;
    this.snackbar.classList.remove('hidden');
    document.getElementById('undo-btn').addEventListener('click', () => this.bus.emit('undo'));
    setTimeout(() => this.snackbar.classList.add('hidden'), 5000);
  }
  applyTheme(mode) {
    document.body.classList.toggle('dark', mode==='dark');
    localStorage.setItem('theme', mode);
  }
  loadTheme() {
    const mode = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    this.bus.emit('theme', mode);
  }
}

class PartyController {
  constructor() {
    this.model = new PartyModel();
    this.view = new PartyView(this.model.bus, this.model);
    this.bind();
  }
  bind() {
    const bus = this.model.bus;
    bus.on('save', () => {
      const date = this.view.dateIn.value;
      const desc = this.view.descIn.value.trim();
      const msg = this.view.msgIn.value.trim();
      if (!date || !desc || !msg) return;
      this.model.setDetails(date, desc, msg);
      this.startCountdown();
    });
    bus.on('join', () => {
      const first = this.view.firstIn.value.trim();
      const last = this.view.lastIn.value.trim();
      if (!first || !last) return;
      this.model.addParticipant({ first, last });
      this.view.firstIn.value = '';
      this.view.lastIn.value = '';
    });
    bus.on('remove', idx => {
      this.model.removeParticipant(idx);
      bus.emit('snackbar', 'Participant removed');
    });
    bus.on('undo', () => this.model.undoRemove());
    bus.on('export', () => this.model.exportCSV());
    bus.on('search', () => bus.emit('participantsUpdated', this.model.participants));
    bus.on('toggleTheme', () => bus.emit('theme', document.body.classList.contains('dark') ? 'light' : 'dark'));
  }
  startCountdown() {
    const tick = () => {
      const now = Date.now();
      const then = new Date(this.model.details.date).getTime();
      const diff = then - now;
      if (diff <= 0) {
        this.model.bus.emit('countdown', "It's party time!");
        this.model.bus.emit('confetti');
        return;
      }
      const days = Math.floor(diff/86400000);
      const hrs = Math.floor((diff%86400000)/3600000);
      const mins = Math.floor((diff%3600000)/60000);
      const secs = Math.floor((diff%60000)/1000);
      this.model.bus.emit('countdown', `${days}d ${hrs}h ${mins}m ${secs}s`);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => new PartyController());
