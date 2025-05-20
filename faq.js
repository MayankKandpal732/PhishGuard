document.addEventListener('DOMContentLoaded', function() {
  renderFaqs();
});

function applyDarkMode() {
  const theme = document.body.getAttribute('data-theme');
  document.getElementById('darkModeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
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
}
applyDarkMode();

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

const faqForm = document.getElementById('faqForm');
faqForm.addEventListener('submit', e => {
  e.preventDefault();
  const q = document.getElementById('faqQuestion').value.trim();
  if (!q) return;
  document.getElementById('faqQuestion').value = '';
  showToast('Your question has been received and will be answered shortly.');
}); 