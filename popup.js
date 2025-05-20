const goToBtn = document.getElementById("goToBtn");

document.getElementById("checkBtn").addEventListener("click", () => {
  const url = document.getElementById("urlInput").value.trim();
  const status = document.getElementById("status");

  if (!url) {
    status.textContent = "Please enter a URL.";
    status.className = "error";
    goToBtn.disabled = true;
    return;
  }

  status.textContent = "Checking...";
  status.className = "";
  goToBtn.disabled = true;

  chrome.runtime.sendMessage({ type: "check_url", url }, (response) => {
    if (chrome.runtime.lastError || response.error) {
      status.textContent = "Error checking URL: " + (chrome.runtime.lastError ? chrome.runtime.lastError.message : response.error);
      status.className = "error";
      goToBtn.disabled = true;
      return;
    }

    if (response.safe) {
      status.textContent = " SAFE";
      status.className = "safe";
      goToBtn.disabled = false;
    } else if (response.unsafe) {
      status.textContent = ` UNSAFE: ${response.threat}`;
      status.className = "unsafe";
      goToBtn.disabled = false;
    
      const alert1 = new Audio(chrome.runtime.getURL("icons/alert.mp3"));
      alert1.play().then(() => {
        setTimeout(() => {
          const alert2 = new Audio(chrome.runtime.getURL("icons/alert.mp3"));
          alert2.play().catch((err) => console.error("2nd alert failed:", err));
        }, 1000);
      }).catch((err) => console.error("1st alert failed:", err));
    }
     else {
      status.textContent = "⚠️ Could not determine site safety.";
      status.className = "error";
      goToBtn.disabled = true;
    }
  });
});

goToBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: 'http://127.0.0.1:5500' });
});

document.getElementById("downloadLogBtn").addEventListener("click", () => {
  chrome.storage.local.get("urlHistory", (result) => {
    const blob = new Blob([result.urlHistory || ""], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
      url: url,
      filename: "SafeBrowsingLog.csv",
      saveAs: true
    });
  });
});