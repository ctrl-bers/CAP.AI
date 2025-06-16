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
    if (now < parseInt(cooldownUntil, 10)) {
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
  generateBtn.disabled = tokensLeft < 200;
  if (tokensLeft < 200) {
    showModal();
  }
}

// Modal show/hide logic
modalOkBtn.addEventListener('click', () => {
  modal.style.display = 'none';
});

function showModal() {
  let nextTime;
  if (tokensLeft < 200) {
    // If already in cooldown, use stored time, else set new cooldown
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
  if (tokensLeft < 200) {
    showModal();
    return;
  }

  // Insert time icon while generating
  outputEl.innerHTML = '<div class="placeholder"><span style="font-size:2em;vertical-align:middle;"></span> Generating idea...</div>';
  exportBtn.disabled = true;

  const industry = industryEl.value;
  const projectType = projectTypeEl.value;
  let difficulty = selectedDifficulty;

  // If 'All' is selected, pick a random difficulty for the prompt
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

  prompt += `\nMake the description detailed and comprehensive. Do not include any explanation or extra text, only the JSON object.`;

  // --- Generate button logic ---
  if (tokensLeft < 1000) {
    outputEl.innerHTML = '<div class="placeholder" style="color:#ef4444;">You have reached your daily token limit. Please try again tomorrow.</div>';
    generateBtn.disabled = true;
    return;
  }

  try {
    const apiKey = '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'; // <-- Replace with your OpenAI API key
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3-70b-instruct',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
      }),
    });

    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      let idea;
      try {
        let content = data.choices[0].message.content.trim();
        if (content.startsWith("```")) {
          content = content.replace(/```(json)?/g, '').trim();
        }
        if (content.startsWith('{') && content.endsWith('}')) {
          idea = JSON.parse(content);
        } else {
          outputEl.innerHTML = `<pre style=\"color:#ef4444;\">AI response is not a valid capstone idea. Please try again.</pre>`;
          return;
        }
      } catch {
        outputEl.innerHTML = `<pre style=\"color:#ef4444;\">AI response could not be parsed as JSON. Try again.<br><br>${data.choices[0].message.content}</pre>`;
        return;
      }
      currentIdea = idea;
      renderIdea(idea);
      exportBtn.disabled = false;
      // Deduct 200 tokens per generation
      tokensLeft -= 1000;
      if (tokensLeft < 0) tokensLeft = 0;
      updateTokenUI();
      if (tokensLeft < 200) {
        generateBtn.disabled = true;
      }
    } else {
      outputEl.innerHTML = `<div class=\"placeholder\">No idea generated. Try again.</div>`;
    }
  } catch (err) {
    outputEl.innerHTML = `<div class="placeholder">Error generating idea. Check your API key or internet connection.</div>`;
  }
});

// Render idea to output
function renderIdea(idea) {
  // Difficulty color coding and icon
// No difficulty color or icon
let diffColor = '';
let diffIcon = '';
  // Add clock icon for duration
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

// Export to PDF
exportBtn.addEventListener('click', () => {
  if (!currentIdea) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 20;
  // Modern header (removed background for title)
  // doc.setFillColor(34, 197, 94);
  // doc.roundedRect(5, 10, 200, 15, 5, 5, 'F');
  doc.setFontSize(15); // was 18, now smaller
  doc.setTextColor(34,197,94); // Use green for title text
  doc.text(currentIdea.title, 12, 21);
  y += 10;
  // Section styling
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
  // Footer
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

// Toggle dropdown
dropdownToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  customDropdown.classList.toggle('open');
});

// Select item
dropdownItems.forEach(item => {
  item.addEventListener('click', () => {
    const icon = item.querySelector('i').outerHTML;
    const text = item.textContent.trim();
    dropdownToggle.innerHTML = `${icon} <span>${text}</span> <i class='bi bi-caret-down-fill dropdown-caret'></i>`;
    hiddenInput.value = item.getAttribute('data-value');
    customDropdown.classList.remove('open');
  });
});

// Close dropdown on outside click
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