function applyDarkMode() {
  const theme = document.body.getAttribute('data-theme');
  document.getElementById('darkModeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
}
document.getElementById('darkModeToggle').addEventListener('click', () => {
  const theme = document.body.getAttribute('data-theme') === 'dark' ? '' : 'dark';
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('phish_theme', theme);
  applyDarkMode();
});
if (localStorage.getItem('phish_theme') === 'dark') {
  document.body.setAttribute('data-theme', 'dark');
}
applyDarkMode();

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function getHistory() {
  return JSON.parse(localStorage.getItem('phish_history') || '[]');
}
function setHistory(arr) {
  localStorage.setItem('phish_history', JSON.stringify(arr.slice(-200)));
}
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
    const merged = getHistory().concat(newHistory).slice(-200);
    setHistory(merged);
    updateHistoryTable();
    updateCharts();
    showToast('History imported!');
  };
  reader.readAsText(file);
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
  
  const last10 = arr.slice(-10);
  const labels = last10.map(e => e.timestamp.replace('T',' ').slice(11,19)); 
  const data = last10.map(e => e.status === 'Unsafe' ? 2 : 1); 
  if (!lineChart) {
    lineChart = new Chart(document.getElementById('lineChart').getContext('2d'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Last 10 Checks',
          data: data,
          fill: true,
          borderColor: '#1976d2',
          backgroundColor: 'rgba(25, 118, 210, 0.10)',
          pointBackgroundColor: '#1976d2',
          pointBorderColor: '#fff',
          pointRadius: 8,
          pointHoverRadius: 11,
          borderDash: [6, 6],
          tension: 0.3
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        animation: { duration: 900 },
        scales: {
          y: {
            display: false,
            min: 0,
            max: 3
          }
        }
      }
    });
  } else {
    lineChart.data.labels = labels;
    lineChart.data.datasets[0].data = data;
    lineChart.update();
  }
}
updateCharts();
updateHistoryTable();
updateCharts();
  