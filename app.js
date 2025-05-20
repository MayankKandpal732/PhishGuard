importScripts('config.js');

const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.section');
function showSection(sectionId) {
  sections.forEach(sec => sec.classList.remove('active'));
  document.getElementById(sectionId).classList.add('active');
}
navLinks.forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    const sectionId = link.getAttribute('href').replace('#', '');
    showSection(sectionId);
    document.querySelector('main').scrollIntoView({ behavior: 'smooth' });
  });
});
showSection('dashboard');

function applyDarkMode() {
  const theme = document.body.getAttribute('data-theme');
  if (theme === 'dark') {
    document.getElementById('darkModeToggle').textContent = '☀️';
  } else {
    document.getElementById('darkModeToggle').textContent = '🌙';
  }
  renderFaqs();
}
document.getElementById('darkModeToggle').addEventListener('click', () => {
  const theme = document.body.getAttribute('data-theme') === 'dark' ? '' : 'dark';
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('phish_theme', theme);
  applyDarkMode();
});
if (localStorage.getItem('phish_theme') === 'dark') {
  document.body.setAttribute('data-theme', 'dark');
  applyDarkMode();
} else {
  applyDarkMode();
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

async function checkPhishing(url) {
  const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${API_KEY}`;
  const body = {
    client: { clientId: "phishguard", clientVersion: "1.0" },
    threatInfo: {
      threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
      platformTypes: ["ANY_PLATFORM"],
      threatEntryTypes: ["URL"],
      threatEntries: [{ url }]
    }
  };
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error('API error: ' + res.status);
    const data = await res.json();
    if (data.matches && data.matches.length > 0) {
      return { unsafe: true, threat: data.matches[0].threatType };
    }
    return { safe: true };
  } catch (err) {
    return { error: err.message };
  }
}

function getHistory() {
  return JSON.parse(localStorage.getItem('phish_history') || '[]');
}
function setHistory(arr) {
  localStorage.setItem('phish_history', JSON.stringify(arr.slice(-200)));
}
function addHistory(entry) {
  const arr = getHistory();
  arr.push(entry);
  setHistory(arr);
}
function updateStats() {
  const arr = getHistory();
  document.getElementById('totalChecks').textContent = arr.length;
  document.getElementById('unsafeCount').textContent = arr.filter(e => e.status === 'Unsafe').length;
  document.getElementById('safeCount').textContent = arr.filter(e => e.status === 'Safe').length;
}

function showResultCard(result, url) {
  const card = document.getElementById('resultCard');
  card.className = 'result-card';
  if (result.safe) {
    card.textContent = `✅ This site is SAFE.`;
    card.classList.add('safe');
  } else if (result.unsafe) {
    card.textContent = `🚨 UNSAFE: ${result.threat}`;
    card.classList.add('unsafe');
    const alert1 = new Audio('assets/alert.mp3');
    alert1.play().then(() => {
      setTimeout(() => {
        const alert2 = new Audio('assets/alert.mp3');
        alert2.play();
      }, 1000);
    });
  } else {
    card.textContent = `⚠️ Could not determine site safety.`;
    card.classList.add('error');
  }
  card.style.animation = 'popIn 0.7s';
  setTimeout(() => card.style.animation = '', 800);
}

const phishForm = document.getElementById('phishForm');
phishForm.addEventListener('submit', async e => {
  e.preventDefault();
  const url = document.getElementById('phishUrl').value.trim();
  if (!url) return;
  showResultCard({ safe: false }, '');
  document.getElementById('resultCard').textContent = 'Checking...';
  const result = await checkPhishing(url);
  if (result.error) {
    showResultCard({}, url);
    showToast('API Error: ' + result.error);
    updateStats();
    updateCharts();
    return;
  }
  showResultCard(result, url);
  if (result.safe || result.unsafe) {
    addHistory({
      timestamp: new Date().toISOString(),
      url,
      status: result.unsafe ? 'Unsafe' : 'Safe',
      threat: result.threat || ''
    });
  }
  updateStats();
  updateHistoryTable();
  updateCharts();
});

function updateHistoryTable() {
  const arr = getHistory().slice().reverse();
  const tbody = document.querySelector('#historyTable tbody');
  tbody.innerHTML = '';
  arr.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${e.timestamp.replace('T',' ').slice(0,19)}</td><td>${e.url}</td><td class="${e.status === 'Unsafe' ? 'unsafe' : 'safe'}">${e.status}${e.threat ? ' ('+e.threat+')' : ''}</td>`;
    tbody.appendChild(tr);
  });
}
updateHistoryTable();
updateStats();

const historySearch = document.getElementById('historySearch');
historySearch.addEventListener('input', () => {
  const val = historySearch.value.toLowerCase();
  const arr = getHistory().slice().reverse().filter(e => e.url.toLowerCase().includes(val));
  const tbody = document.querySelector('#historyTable tbody');
  tbody.innerHTML = '';
  arr.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${e.timestamp.replace('T',' ').slice(0,19)}</td><td>${e.url}</td><td class="${e.status === 'Unsafe' ? 'unsafe' : 'safe'}">${e.status}${e.threat ? ' ('+e.threat+')' : ''}</td>`;
    tbody.appendChild(tr);
  });
});

const downloadCsv = document.getElementById('downloadCsv');
downloadCsv.addEventListener('click', () => {
  const arr = getHistory();
  let csv = 'Timestamp,URL,Status,Threat\n';
  arr.forEach(e => {
    csv += `"${e.timestamp}","${e.url}","${e.status}","${e.threat || ''}"
`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'PhishGuard_History.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV downloaded!');
});

let pieChart, lineChart;
function updateCharts() {
  const arr = getHistory();
  const safe = arr.filter(e => e.status === 'Safe').length;
  const unsafe = arr.filter(e => e.status === 'Unsafe').length;
  
  if (!pieChart) {
    pieChart = new Chart(document.getElementById('pieChart').getContext('2d'), {
      type: 'pie',
      data: {
        labels: ['Safe', 'Unsafe'],
        datasets: [{
          data: [safe, unsafe],
          backgroundColor: ['#43cea2', '#e53935'],
          borderWidth: 0
        }]
      },
      options: {
        plugins: { legend: { display: true, position: 'bottom' } },
        animation: { animateScale: true }
      }
    });
  } else {
    pieChart.data.datasets[0].data = [safe, unsafe];
    pieChart.update();
  }
  const byDay = {};
  arr.forEach(e => {
    const day = e.timestamp.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  });
  let days = Object.keys(byDay).sort();
  let counts = days.map(d => byDay[d]);
  
  if (days.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    days = [today];
    counts = [0];
  }
  if (!lineChart) {
    lineChart = new Chart(document.getElementById('lineChart').getContext('2d'), {
      type: 'line',
      data: {
        labels: days,
        datasets: [{
          label: 'Checks per Day',
          data: counts,
          fill: true,
          borderColor: '#1976d2',
          backgroundColor: 'rgba(25, 118, 210, 0.1)',
          tension: 0.3
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        animation: { duration: 900 }
      }
    });
  } else {
    lineChart.data.labels = days;
    lineChart.data.datasets[0].data = counts;
    lineChart.update();
  }
}
updateCharts();

const defaultFaqs = [
  {
    q: "What is phishing?",
    a: "Phishing is a type of cyberattack where attackers impersonate legitimate organizations via email, text message, or other means to steal sensitive information."
  },
  {
    q: "How does this site detect phishing?",
    a: "We use Google's Safe Browsing API to check if a URL is known for phishing, malware, or other threats."
  },
  {
    q: "Is my data stored?",
    a: "Your check history is stored only in your browser (localStorage) and never sent to any server."
  },
  {
    q: "What should I do if I find a phishing site?",
    a: "Avoid entering any information and report the site to Google Safe Browsing or your IT department."
  },
  {
    q: "How can I protect myself from phishing?",
    a: "Be cautious with links, verify sender addresses, use security software, and never share sensitive info unless certain."
  },
  {
    q: "Can I use this tool on my phone or tablet?",
    a: "Yes! PhishGuard is fully responsive and works on all modern devices, including phones and tablets."
  }
];
function getFaqs() {
  return JSON.parse(localStorage.getItem('phish_faqs') || JSON.stringify(defaultFaqs));
}
function setFaqs(arr) {
  localStorage.setItem('phish_faqs', JSON.stringify(arr));
}
function reframeAndAnswerLatestFaq() {
  let faqs = getFaqs();
  if (faqs.length > defaultFaqs.length) {
    const last = faqs[faqs.length - 1];
    let reframedQ = last.q;
    let answer = last.a;
    if (/phish|fake|scam|detect|identify|spot|recognize/i.test(reframedQ)) {
      reframedQ = "How can I recognize a phishing website?";
      answer = "Look for suspicious URLs, poor grammar, urgent requests for personal info, and always verify the sender. Use tools like PhishGuard to check URLs before clicking.";
    } else if (/safe browsing|api|how does|how do/i.test(reframedQ)) {
      reframedQ = "How does the Safe Browsing API work for phishing detection?";
      answer = "The Safe Browsing API checks URLs against a constantly updated list of unsafe sites reported to Google, helping you avoid phishing and malware.";
    } else if (/dark mode|theme/i.test(reframedQ)) {
      reframedQ = "How do I enable dark mode on this site?";
      answer = "Click the moon/sun icon in the navbar to toggle dark mode for a more comfortable viewing experience.";
    } else {
      reframedQ = `User asked: ${last.q}`;
      answer = "Thank you for your question! Our team will review and answer it soon."
    }
    faqs[faqs.length - 1] = { q: reframedQ, a: answer };
    setFaqs(faqs);
  }
}
function renderFaqs() {
  reframeAndAnswerLatestFaq();
  const faqs = getFaqs();
  const faqList = document.getElementById('faqList');
  faqList.innerHTML = '';
  faqs.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'faq-item';
    item.innerHTML = `<div class="faq-question">${f.q}</div><div class="faq-answer">${f.a}</div>`;
    item.querySelector('.faq-question').addEventListener('click', () => {
      item.classList.toggle('open');
    });
    faqList.appendChild(item);
  });
}
renderFaqs();

const faqForm = document.getElementById('faqForm');
faqForm.addEventListener('submit', e => {
  e.preventDefault();
  const q = document.getElementById('faqQuestion').value.trim();
  if (!q) return;
  const faqs = getFaqs();
  faqs.push({ q, a: "Thank you for your question! Our team will review and answer it soon." });
  setFaqs(faqs);
  renderFaqs();
  document.getElementById('faqQuestion').value = '';
  showToast('Question submitted!');
});

const uploadCsv = document.getElementById('uploadCsv');
uploadCsv.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    const text = evt.target.result;
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return showToast('CSV is empty or invalid');
    const newHistory = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(s => s.replace(/^"|"$/g, ''));
      if (cols.length < 3) continue;
      newHistory.push({
        timestamp: cols[0],
        url: cols[1],
        status: cols[2],
        threat: cols[3] || ''
      });
    }
    if (newHistory.length === 0) return showToast('No valid rows in CSV');
    setHistory(newHistory);
    updateStats();
    updateHistoryTable();
    updateCharts();
    showToast('History imported!');
  };
  reader.readAsText(file);
});

const daaForm = document.getElementById('daaForm');
daaForm.addEventListener('submit', async e => {
  e.preventDefault();
  const url = document.getElementById('daaUrl').value.trim();
  if (!url) return;
  const daaResult = document.getElementById('daaResult');
  daaResult.innerHTML = 'Analyzing...';

  let html = '';
  try {
    html = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(url)).then(r => r.text());
  } catch {
    daaResult.innerHTML = '<span style="color:var(--danger);">Could not fetch page content.</span>';
    return;
  }

  const brandMatches = brandList.filter(brand => kmpSearch(brand, html.toLowerCase()).length);

  let closestDomain = '', minDist = 99, top3 = [];
  try {
    const legitDomains = ['google.com', 'facebook.com', 'amazon.com', 'microsoft.com', 'apple.com', 'netflix.com', 'twitter.com', 'linkedin.com', 'github.com', 'yahoo.com'];
    const inputDomain = url.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
    const scored = legitDomains.map(d => ({d, dist: levenshtein(inputDomain, d)}));
    scored.sort((a, b) => a.dist - b.dist);
    closestDomain = scored[0].d;
    minDist = scored[0].dist;
    top3 = scored.slice(0, 3);
  } catch {
    closestDomain = 'N/A'; minDist = 'N/A'; top3 = [];
  }

  const features = extractFeatures(url);

  const links = extractLinks(html);
  const graph = buildLinkGraph(links);
  const clusters = [];
  links.forEach(l => {
    const cluster = bfs(graph, l);
    if (cluster.size > 2) clusters.push(Array.from(cluster));
  });

  const patterns = detectPatterns(html);

  let risk = 'Low', badge = 'background:#43cea2;color:#222;';
  if (minDist <= 1) { risk = 'High'; badge = 'background:#e53935;color:#fff;'; }
  else if (minDist <= 3) { risk = 'Medium'; badge = 'background:#ffb300;color:#222;'; }

  daaResult.innerHTML = `
    <div style="margin-bottom:1em;">
      <b>Brand Names Detected:</b> ${brandMatches.length ? brandMatches.join(', ') : 'None'}<br>
      <b>Closest Legitimate Domain:</b> <code>${closestDomain}</code> (distance: ${minDist})<br>
      <b>Top 3 Matches:</b> ${top3.map(x => x.d + ' (' + x.dist + ')').join(', ')}<br>
      <b>URL Features:</b> ${Object.entries(features).map(([k, v]) => k + ': ' + v).join(', ')}<br>
      <b>Link Clusters:</b> ${clusters.length} clusters found<br>
      <b>Suspicious Patterns:</b> ${Object.entries(patterns).map(([k, v]) => k + ': ' + v).join(', ')}<br>
      <b>Risk Level:</b> <span style="padding:2px 8px;border-radius:4px;${badge}">${risk}</span>
    </div>
  `;
}); 