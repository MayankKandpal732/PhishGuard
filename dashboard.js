importScripts('config.js');

(function() {
  const darkToggle = document.getElementById('darkModeToggle');
  function applyDarkMode() {
    const theme = document.body.getAttribute('data-theme');
    if (darkToggle) darkToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
  if (darkToggle) {
    darkToggle.addEventListener('click', () => {
      const theme = document.body.getAttribute('data-theme') === 'dark' ? '' : 'dark';
      document.body.setAttribute('data-theme', theme);
      localStorage.setItem('phish_theme', theme);
      applyDarkMode();
      setTimeout(() => { if (typeof updateCharts === 'function') updateCharts(); }, 100);
    });
  }
  if (localStorage.getItem('phish_theme') === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
  }
  applyDarkMode();
})();

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
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
  if (!document.getElementById('totalChecks')) return;
  const arr = getHistory();
  document.getElementById('totalChecks').textContent = arr.length;
  document.getElementById('unsafeCount').textContent = arr.filter(e => e.status === 'Unsafe').length;
  document.getElementById('safeCount').textContent = arr.filter(e => e.status === 'Safe').length;
}

function showResultCard(result, url) {
  const card = document.getElementById('resultCard');
  if (!card) return;
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
if (phishForm) {
  phishForm.addEventListener('submit', async e => {
    e.preventDefault();
    const urlInput = document.getElementById('phishUrl');
    if (!urlInput) return;
    
    let url = urlInput.value.trim();
    if (!url) {
      showToast('Please enter a URL');
      return;
    }
    
    if (url.startsWith('@')) {
      url = url.substring(1);
    }
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }
    
    try {
      new URL(url);
    } catch (err) {
      showToast('Please enter a valid URL');
      return;
    }

    const resultCard = document.getElementById('resultCard');
    const daaResult = document.getElementById('daaResult');
    
    if (resultCard) {
      resultCard.textContent = 'Analyzing...';
      resultCard.className = 'result-card';
    }
    
    if (daaResult) {
      daaResult.innerHTML = '<div class="loading">Analyzing...</div>';
    }
    
    resetScoreVisualization();

    try {
      const phishResult = await Promise.race([
        checkPhishing(url),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        )
      ]);
      
      if (!phishResult) {
        throw new Error('No result from API');
      }
      
      const scores = {
        domainMatch: phishResult.safe ? 40 : 10,
        urlStructure: phishResult.safe ? 30 : 10,
        contentAnalysis: phishResult.safe ? 30 : 5,
        total: phishResult.safe ? 98 : 25
      };
      
      updateScoreVisualization(scores);
      showResultCard(phishResult, url);
      showDaaResults(url, phishResult);

      if (phishResult.safe || phishResult.unsafe) {
        addHistory({
          timestamp: new Date().toISOString(),
          url,
          status: phishResult.unsafe ? 'Unsafe' : 'Safe',
          threat: phishResult.threat || '',
          score: scores.total
        });
      }
      updateStats();
      updateCharts();

    } catch (error) {
      console.error('Analysis error:', error);
      showToast('Analysis Error: ' + error.message);
      
      if (resultCard) {
        resultCard.textContent = '⚠️ Analysis failed. Please try again.';
        resultCard.className = 'result-card error';
      }
      
      if (daaResult) {
        daaResult.innerHTML = '<div class="error-message">Analysis failed. Please try again.</div>';
      }
    }
  });
}

function calculateScores(url, html, phishResult, legitDomains) {
  const scores = {
    domainMatch: 0,
    urlStructure: 0,
    contentAnalysis: 0,
    total: 0
  };

  if (phishResult.safe) {
    scores.domainMatch = 40;
    scores.urlStructure = 30;
    scores.contentAnalysis = 30;
    scores.total = 98; 
  } else if (phishResult.unsafe) {
    scores.domainMatch = 10;
    scores.urlStructure = 10;
    scores.contentAnalysis = 5;
    scores.total = 25; 
  } else {
    const inputDomain = url.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
    const scored = legitDomains.map(d => ({d, dist: levenshtein(inputDomain, d)}));
    scored.sort((a, b) => a.dist - b.dist);
    const minDist = scored[0].dist;
    scores.domainMatch = Math.max(0, 40 - (minDist * 10));

    const features = extractFeatures(url);
    scores.urlStructure = 30;
    if (!features['Uses HTTPS']) scores.urlStructure -= 10;
    if (features['Has @']) scores.urlStructure -= 10;
    if (features['Has IP']) scores.urlStructure -= 10;
    if (features['Num Dots'] > 3) scores.urlStructure -= 5;

    const patterns = detectPatterns(html);
    scores.contentAnalysis = 30;
    if (patterns.hiddenForms) scores.contentAnalysis -= 10;
    if (patterns.obfuscatedJS) scores.contentAnalysis -= 10;

    scores.total = Math.round(scores.domainMatch + scores.urlStructure + scores.contentAnalysis);
  }

  return scores;
}

function resetScoreVisualization() {
  const circle = document.querySelector('.circle');
  const percentage = document.querySelector('.percentage');
  const progressBars = document.querySelectorAll('.progress');
  
  if (circle) circle.style.strokeDasharray = '0 100';
  if (percentage) percentage.textContent = '0';
  progressBars.forEach(bar => {
    bar.style.width = '0%';
    bar.setAttribute('data-score', '0');
  });
}

function updateScoreVisualization(scores) {
  const circle = document.querySelector('.circle');
  const percentage = document.querySelector('.percentage');
  const progressBars = document.querySelectorAll('.progress');
  
  if (circle) {
    const circumference = 2 * Math.PI * 15.9155;
    const dashArray = `${(scores.total / 100) * circumference} ${circumference}`;
    circle.style.strokeDasharray = dashArray;
    circle.style.stroke = getScoreColor(scores.total);
  }
  
  if (percentage) {
    percentage.textContent = scores.total;
  }
  
  const categories = ['domainMatch', 'urlStructure', 'contentAnalysis'];
  progressBars.forEach((bar, index) => {
    const score = scores[categories[index]];
    bar.style.width = `${score}%`;
    bar.setAttribute('data-score', score);
  });
}

function getScoreColor(score) {
  if (score >= 80) return '#43cea2';
  if (score >= 60) return '#ffb300';
  return '#e53935';
}

function showDaaResults(url, phishResult) {
  const daaResult = document.getElementById('daaResult');
  if (!daaResult) return;

  const features = extractFeatures(url);
  const riskLevel = phishResult.safe ? 'Low' : 'High';
  const riskColor = phishResult.safe ? '#43cea2' : '#e53935';
  const riskBg = phishResult.safe ? 'rgba(67, 206, 162, 0.1)' : 'rgba(229, 57, 53, 0.1)';

  const isSuspicious = {
    protocol: !features['Uses HTTPS'],
    atSymbol: features['Has @'],
    ipAddress: features['Has IP'],
    subdomains: features['Num Dots'] > 3
  };

  daaResult.innerHTML = `
    <h3>Detailed Analysis</h3>
    <div class="analysis-grid">
      <div class="analysis-item" style="border-left: 4px solid ${riskColor}">
        <h4>Risk Assessment</h4>
        <div style="display: flex; align-items: center; gap: 1rem; margin: 1rem 0;">
          <div style="background: ${riskBg}; color: ${riskColor}; padding: 0.5rem 1rem; border-radius: 8px; font-weight: bold;">
            ${riskLevel} Risk
          </div>
          <div style="color: ${riskColor}; font-weight: bold;">
            ${phishResult.safe ? '✅ Safe Site' : '🚨 Unsafe Site'}
          </div>
        </div>
        ${phishResult.threat ? `<p><strong>Threat Type:</strong> ${phishResult.threat}</p>` : ''}
      </div>
      
      <div class="analysis-item">
        <h4>URL Analysis</h4>
        <div style="margin: 1rem 0;">
          <p>
            <strong>Protocol:</strong> 
            ${isSuspicious.protocol ? 
              '<span style="color: #e53935;">❌ HTTP (Insecure)</span>' : 
              '<span style="color: #43cea2;">✅ HTTPS (Secure)</span>'}
          </p>
          <p><strong>Length:</strong> ${features['URL Length']} characters</p>
          <p><strong>Suspicious Elements:</strong></p>
          <ul style="list-style: none; padding-left: 0;">
            <li>
              ${isSuspicious.atSymbol ? 
                '<span style="color: #e53935;">❌ Contains @ symbol (Suspicious)</span>' : 
                '<span style="color: #43cea2;">✅ No @ symbol</span>'}
            </li>
            <li>
              ${isSuspicious.ipAddress ? 
                '<span style="color: #e53935;">❌ Uses IP address (Suspicious)</span>' : 
                '<span style="color: #43cea2;">✅ Uses domain name</span>'}
            </li>
            <li>
              ${isSuspicious.subdomains ? 
                '<span style="color: #e53935;">❌ Multiple subdomains (Suspicious)</span>' : 
                '<span style="color: #43cea2;">✅ Normal domain structure</span>'}
            </li>
          </ul>
        </div>
      </div>
      
      <div class="analysis-item">
        <h4>Recommendations</h4>
        <div style="margin: 1rem 0;">
          ${phishResult.safe ? 
            '<p>✅ This site appears to be safe based on our analysis.</p>' :
            '<p>⚠️ Exercise caution with this site. Consider:</p>' +
            '<ul style="list-style: none; padding-left: 0;">' +
            '<li>🔒 Verifying the site through official channels</li>' +
            '<li>🔍 Double-checking the URL for typos</li>' +
            '<li>⚠️ Avoiding entering sensitive information</li>' +
            '</ul>'
          }
        </div>
      </div>
    </div>
  `;
}

let pieChart, lineChart, domainHeatMap;
function getHeatMapGradient(ctx) {
  const isDark = document.body.getAttribute('data-theme') === 'dark';
  const gradient = ctx.createLinearGradient(0, 0, 400, 0);
  if (isDark) {
    gradient.addColorStop(0, '#ff5252');
    gradient.addColorStop(0.5, '#ffd740');
    gradient.addColorStop(1, '#00e676');
  } else {
    gradient.addColorStop(0, '#e53935');
    gradient.addColorStop(0.5, '#ffb300');
    gradient.addColorStop(1, '#43cea2');
  }
  return gradient;
}
function updateCharts() {
  if (!document.getElementById('pieChart') || !document.getElementById('lineChart') || !document.getElementById('domainHeatMap')) return;
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
  const domainCounts = {};
  arr.forEach(e => {
    try {
      const url = new URL(e.url.startsWith('http') ? e.url : 'http://' + e.url);
      const domain = url.hostname.replace(/^www\./, '');
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    } catch {}
  });
  const sortedDomains = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const domainLabels = sortedDomains.map(([d]) => d);
  const domainData = sortedDomains.map(([, c]) => c);
  const ctx = document.getElementById('domainHeatMap').getContext('2d');
  const gradient = getHeatMapGradient(ctx);
  const isDark = document.body.getAttribute('data-theme') === 'dark';
  const axisColor = isDark ? '#90caf9' : '#1976d2';
  if (!domainHeatMap) {
    domainHeatMap = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: domainLabels,
        datasets: [{
          label: 'Most Targeted Domains',
          data: domainData,
          backgroundColor: gradient,
          borderRadius: 12,
          borderSkipped: false,
          barPercentage: 0.7,
          categoryPercentage: 0.7
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Most Targeted Domains',
            color: axisColor,
            font: { size: 18, weight: 'bold' }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: isDark ? 'rgba(144,202,249,0.08)' : 'rgba(25,118,210,0.08)' },
            ticks: { color: axisColor, font: { weight: 'bold' } }
          },
          y: {
            grid: { display: false },
            ticks: { color: axisColor, font: { weight: 'bold' } }
          }
        },
        animation: { duration: 900 }
      }
    });
  } else {
    domainHeatMap.data.labels = domainLabels;
    domainHeatMap.data.datasets[0].data = domainData;
    domainHeatMap.data.datasets[0].backgroundColor = gradient;
    domainHeatMap.options.plugins.title.color = axisColor;
    domainHeatMap.options.scales.x.ticks.color = axisColor;
    domainHeatMap.options.scales.y.ticks.color = axisColor;
    domainHeatMap.options.scales.x.grid.color = isDark ? 'rgba(144,202,249,0.08)' : 'rgba(25,118,210,0.08)';
    domainHeatMap.update();
  }
}
updateCharts();

// KMP String Matching
function kmpSearch(pattern, text) {
  if (!pattern) return [];
  const lps = Array(pattern.length).fill(0);
  let len = 0, i = 1;
  while (i < pattern.length) {
    if (pattern[i] === pattern[len]) lps[i++] = ++len;
    else if (len) len = lps[len - 1];
    else lps[i++] = 0;
  }
  const matches = [];
  let j = 0;
  for (let i = 0; i < text.length;) {
    if (pattern[j] === text[i]) { i++; j++; }
    if (j === pattern.length) { matches.push(i - j); j = lps[j - 1]; }
    else if (i < text.length && pattern[j] !== text[i]) j ? j = lps[j - 1] : i++;
  }
  return matches;
}
// Levenshtein Distance
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({length: m+1}, () => Array(n+1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i-1] === b[j-1]) dp[i][j] = dp[i-1][j-1];
      else dp[i][j] = 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}
//  Greedy algo
function extractFeatures(url) {
  const features = {};
  features['URL Length'] = url.length;
  features['Uses HTTPS'] = url.startsWith('https');
  features['Has @'] = url.includes('@');
  features['Has IP'] = !!url.match(/https?:\/\/(?:\d{1,3}\.){3}\d{1,3}/);
  features['Num Dots'] = (url.match(/\./g) || []).length;
  return features;
}
//  BFS for Links
function extractLinks(html) {
  const links = [];
  const regex = /<a\s[^>]*href=['"]([^'\"]+)['"]/gi;
  let match;
  while ((match = regex.exec(html))) {
    links.push(match[1]);
  }
  return links;
}
function buildLinkGraph(links) {
  
  const graph = {};
  links.forEach(l => { graph[l] = []; });
  for (let i = 0; i < links.length; i++) {
    for (let j = 0; j < links.length; j++) {
      if (i !== j && links[i].split('/')[2] === links[j].split('/')[2]) {
        graph[links[i]].push(links[j]);
      }
    }
  }
  return graph;
}
function bfs(graph, start) {
  const visited = new Set();
  const queue = [start];
  while (queue.length) {
    const node = queue.shift();
    if (!visited.has(node)) {
      visited.add(node);
      queue.push(...(graph[node] || []));
    }
  }
  return visited;
}
// Pattern Detection 
function detectPatterns(html) {
  return {
    hiddenForms: /<form[^>]*style=['\"][^'\"]*display\s*:\s*none/i.test(html),
    obfuscatedJS: /(eval\(|unescape\(|fromCharCode)/i.test(html)
  };
}

const daaForm = document.getElementById('daaForm');
const daaUrl = document.getElementById('daaUrl');
const daaResult = document.getElementById('daaResult');
const brandList = ['paypal', 'google', 'bank', 'apple', 'amazon', 'microsoft'];
if (daaForm && daaUrl && daaResult) {
  daaForm.addEventListener('submit', async e => {
    e.preventDefault();
    const url = daaUrl.value.trim();
    if (!url) return;
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

      const csv = await fetch('target.csv').then(r => r.text());
      const legitDomains = csv.split(/\r?\n/).map(x => x.trim().toLowerCase()).filter(Boolean);
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
}