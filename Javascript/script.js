// script.js

const industryEl = document.getElementById('industry');
const projectTypeEl = document.getElementById('projectType');
const generateBtn = document.getElementById('generateBtn');
const exportBtn = document.getElementById('exportBtn');
const outputEl = document.getElementById('output');
const tokensLeftEl = document.getElementById('tokensLeft');
const diffBtns = document.querySelectorAll('.diff-btn');
const modal = document.getElementById('modal');
const modalOkBtn = document.getElementById('modalOkBtn');
const modalMessage = document.getElementById('modalMessage');
const modalNextTime = document.getElementById('modalNextTime');

let currentIdea = null;

// Token persistence and cooldown logic
const TOKEN_KEY = 'capstone_tokensLeft';
const COOLDOWN_KEY = 'capstone_nextTime';

function saveTokens() {
  localStorage.setItem(TOKEN_KEY, tokensLeft);
}
function saveCooldown(nextTime) {
  localStorage.setItem(COOLDOWN_KEY, nextTime);
}
function loadTokens() {
  const t = localStorage.getItem(TOKEN_KEY);
  return t !== null ? parseInt(t, 10) : 10000;
}
function loadCooldown() {
  return localStorage.getItem(COOLDOWN_KEY);
}

// On load, restore tokens and cooldown
let tokensLeft = loadTokens();
let cooldownUntil = loadCooldown();

// Check cooldown on load
function checkCooldownOnLoad() {
  if (cooldownUntil) {
    const now = Date.now();
    if (now < parseInt(cooldownUntil, 1)) {
      showModal();
      generateBtn.disabled = true;
    } else {
      // Cooldown expired, reset tokens
      tokensLeft = 10000;
      saveTokens();
      localStorage.removeItem(COOLDOWN_KEY);
      updateTokenUI();
      generateBtn.disabled = false;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  tokensLeftEl.textContent = `Tokens left: ${tokensLeft}`;
  checkCooldownOnLoad();
  // Only show modal and disable button if tokensLeft is 0
  if (!cooldownUntil && tokensLeft === 0) {
    showModal();
    generateBtn.disabled = true;
  } else {
    generateBtn.disabled = false;
  }
});

// Difficulty selection logic
let selectedDifficulty = 'All';
diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    diffBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedDifficulty = btn.dataset.diff;
  });
});

// --- UI update ---
function updateTokenUI() {
  tokensLeftEl.textContent = `Tokens left: ${tokensLeft}`;
  saveTokens();
  // Only disable if tokensLeft is 0
  generateBtn.disabled = tokensLeft === 0;
}

// Modal show/hide logic
modalOkBtn.addEventListener('click', () => {
  modal.style.display = 'none';
});

function showModal() {
  let nextTime;
  if (tokensLeft === 0) {
    if (cooldownUntil && Date.now() < parseInt(cooldownUntil, 10)) {
      nextTime = new Date(parseInt(cooldownUntil, 10));
    } else {
      nextTime = new Date(Date.now() + 5 * 60 * 60 * 1000);
      saveCooldown(nextTime.getTime());
    }
    modalNextTime.textContent = `You can use this again at: ${nextTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    modal.style.display = 'flex';
  }
}

// Generate Idea
generateBtn.addEventListener('click', async () => {
  if (tokensLeft === 0) {
    showModal();
    return;
  }

  outputEl.innerHTML = '<div class="placeholder"><span style="font-size:2em;vertical-align:middle;"></span> Generating idea...</div>';
  exportBtn.disabled = true;

  const industry = industryEl.value;
  const projectType = projectTypeEl.value;
  let difficulty = selectedDifficulty;

  let randomDiff = '';
  if (difficulty === 'All') {
    const diffArr = ['Easy', 'Medium', 'Hard'];
    randomDiff = diffArr[Math.floor(Math.random() * diffArr.length)];
  }

  let prompt = `
You are an assistant that generates capstone project ideas for students.
ALWAYS respond ONLY in valid JSON with these keys: "title", "description", "duration", "techStack", "difficulty".
- "difficulty" must be one of: Easy, Medium, or Hard.
- "techStack" must be an array of technologies/tools.
- "duration" must be in months (e.g. "3 months") or weeks if less than a month (e.g. "2 weeks").
Industry: ${industry}
Project Type: ${projectType}
`;

  if (difficulty === "All") {
    prompt += `You must generate an idea STRICTLY for a ${randomDiff.toLowerCase()} level student. Do NOT generate ideas for any other difficulty. Only generate for: ${randomDiff}. Set the \"difficulty\" key to \"${randomDiff}\" only. This is required.`;
  } else {
    prompt += `You must generate an idea STRICTLY for a ${difficulty.toLowerCase()} level student. Do NOT generate ideas for any other difficulty. Only generate for: ${difficulty}. Set the \"difficulty\" key to \"${difficulty}\" only. This is required.`;
  }

  prompt += " The description must be concise, clear, and strictly limited to 3-4 sentences. Respond ONLY with a valid JSON object, no extra text, no markdown, no explanation, no code block, no label, no prefix, no suffix. If you cannot answer, respond with an empty JSON object: {}.";

  try {
    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt
      }),
    });

    const data = await response.json();
    let ideaGenerated = false;
    if (data.idea) {
      currentIdea = data.idea;
      renderIdea(data.idea);
      exportBtn.disabled = false;
      ideaGenerated = true;
    } else if (data.error) {
      outputEl.innerHTML = `<pre style=\"color:#ef4444;\">${data.error}<br>${data.details ? JSON.stringify(data.details) : ''}</pre>`;
    } else {
      outputEl.innerHTML = `<div class=\"placeholder\">No idea generated. Try again.</div>`;
    }

    // After successful idea generation:
    tokensLeft = Math.max(0, tokensLeft - 1000);
    updateTokenUI();
  } catch (err) {
    outputEl.innerHTML = `<div class="placeholder">Error generating idea. Check your API key or internet connection.</div>`;
  }
});

function renderIdea(idea) {
  let diffColor = '';
  let diffIcon = '';
  outputEl.innerHTML = `
    <div>
      <div class="idea-title">${idea.title}</div>
      <div class="idea-section"><b>Description:</b><br>${idea.description}</div>
      <div class="idea-section"><b>Duration:</b> <span style='font-size:1.2em;vertical-align:middle;'>⏰</span> <span style='font-weight:600;color:#22c55e;'>${idea.duration}</span></div>
      <div class="idea-section"><b>Difficulty:</b> <span style='font-weight:600;color:${diffColor};text-transform:uppercase;'>${diffIcon} ${idea.difficulty || ''}</span></div>
      <div class="idea-section"><b>Tech Stack:</b> ${Array.isArray(idea.techStack) ? idea.techStack.join(', ') : idea.techStack}</div>
    </div>
  `;
}

exportBtn.addEventListener('click', () => {
  if (!currentIdea) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 20;
  doc.setFontSize(15);
  doc.setTextColor(34,197,94);
  doc.text(currentIdea.title, 12, 21);
  y += 10;
  doc.setFontSize(12);
  doc.setTextColor(33, 37, 41);
  doc.setFont('helvetica', 'bold');
  doc.text('Description:', 10, y+7);
  doc.setFont('helvetica', 'normal');
  let splitDesc = doc.splitTextToSize(currentIdea.description, 180);
  doc.text(splitDesc, 10, y+14);
  y += splitDesc.length * 6 + 18;
  doc.setFont('helvetica', 'bold');
  doc.text('Duration:', 10, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${currentIdea.duration}`, 35, y);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Difficulty:', 10, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${currentIdea.difficulty || ''}`, 35, y);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Tech Stack:', 10, y);
  doc.setFont('helvetica', 'normal');
  let techStack = Array.isArray(currentIdea.techStack) ? currentIdea.techStack.join(', ') : currentIdea.techStack;
  let splitTech = doc.splitTextToSize(techStack, 180);
  doc.text(splitTech, 10, y+7);
  doc.setFontSize(10);
  doc.setTextColor(180,180,180);
  doc.text('Generated by CAP AI', 10, 285);
  doc.save(`${currentIdea.title}.pdf`);
});

// Custom Project Type Dropdown
const customDropdown = document.getElementById('customProjectType');
const dropdownToggle = document.getElementById('selectedProjectType');
const dropdownMenu = customDropdown.querySelector('.dropdown-menu');
const dropdownItems = dropdownMenu.querySelectorAll('li');
const hiddenInput = document.getElementById('projectType');

dropdownToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  customDropdown.classList.toggle('open');
});

dropdownItems.forEach(item => {
  item.addEventListener('click', () => {
    const icon = item.querySelector('i').outerHTML;
    const text = item.textContent.trim();
    dropdownToggle.innerHTML = `${icon} <span>${text}</span> <i class='bi bi-caret-down-fill dropdown-caret'></i>`;
    hiddenInput.value = item.getAttribute('data-value');
    customDropdown.classList.remove('open');
  });
});

window.addEventListener('click', () => {
  customDropdown.classList.remove('open');
});

// Custom Industry Dropdown
const customIndustry = document.getElementById('customIndustry');
const industryToggle = document.getElementById('selectedIndustry');
const industryMenu = customIndustry.querySelector('.dropdown-menu');
const industryItems = industryMenu.querySelectorAll('li');
const industryInput = document.getElementById('industry');

industryToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  customIndustry.classList.toggle('open');
});

industryItems.forEach(item => {
  item.addEventListener('click', () => {
    const icon = item.querySelector('i').outerHTML;
    const text = item.textContent.trim();
    industryToggle.innerHTML = `${icon} <span>${text}</span> <i class='bi bi-caret-down-fill dropdown-caret'></i>`;
    industryInput.value = item.getAttribute('data-value');
    customIndustry.classList.remove('open');
  });
});

window.addEventListener('click', () => {
  customIndustry.classList.remove('open');
});
