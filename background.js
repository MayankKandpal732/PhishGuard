importScripts('config.js');

async function checkUrlSafety(urlToCheck) {
  const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${API_KEY}`;

  const body = {
    client: { clientId: "yourcompanyname", clientVersion: "1.0" },
    threatInfo: {
      threatTypes: ["MALWARE", "SOCIAL_ENGINEERING"],
      platformTypes: ["ANY_PLATFORM"],
      threatEntryTypes: ["URL"],
      threatEntries: [{ url: urlToCheck }]
    }
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.error('API response not ok:', response.status);
      return { error: 'API error: ' + response.status };
    }

    const data = await response.json();
    const match = data.matches && data.matches.length > 0 ? data.matches[0].threatType : null;

    updateCSV(urlToCheck, !!match);
    showNotification(urlToCheck, !!match, match);

    return match
      ? { unsafe: true, threat: match }
      : { safe: true };
  } catch (err) {
    console.error('Error:', err);
    return { error: err.message || true };
  }
}

function updateCSV(url, isUnsafe) {
  const timestamp = new Date().toISOString();
  const csvLine = `"${timestamp}","${url}","${isUnsafe ? 'Unsafe' : 'Safe'}"\n`;

  chrome.storage.local.get(["urlHistory"], (result) => {
    let csvData = result.urlHistory || "Timestamp,URL,Status\n";
    let lines = csvData.trim().split("\n");
    if (lines.length === 1) lines.push(csvLine.trim());
    else lines.push(csvLine.trim());
    if (lines.length > 201) lines = [lines[0], ...lines.slice(-200)];
    csvData = lines.join("\n") + "\n";
    chrome.storage.local.set({ urlHistory: csvData });
  });
}

function playSound() {
  const audio = new Audio(chrome.runtime.getURL("icons/alert.mp3"));
  audio.play().catch(e => console.error("Audio play failed:", e));
}

function showNotification(url, isUnsafe, threatType) {
  const options = {
    type: "basic",
    iconUrl: isUnsafe ? "icons/icon128.png" : "icons/icon48.png",
    title: isUnsafe ? "UNSAFE Site Detected!" : "Site is Safe",
    message: isUnsafe ? `The site (${url}) is unsafe! Threat: ${threatType}` : `The site (${url}) is safe.`
  };
  
  const uniqueId = "urlCheck_" + Date.now();
  chrome.notifications.create(uniqueId, options);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "check_url") {
    checkUrlSafety(message.url).then((result) => {
      sendResponse(result);
    });
    return true;
  }
});
