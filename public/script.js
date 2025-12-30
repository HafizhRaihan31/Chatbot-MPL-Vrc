const API_URL = "/api/chat";

const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const quickBox = document.getElementById("quick-questions");

/* ======================
   QUICK QUESTION HANDLER
====================== */
function hideQuickQuestions() {
  if (quickBox && quickBox.style.display !== "none") {
    quickBox.style.display = "none";
    setTimeout(() => {
      chatBox.scrollTop = chatBox.scrollHeight;
    }, 50);
  }
}

/* ======================
   CHAT BUBBLE
====================== */
function addMessage(text, sender) {
  const div = document.createElement("div");
  div.className = `flex items-start gap-3 ${sender === "user" ? "justify-end" : ""}`;

  const botStyle = "bg-white/15 border border-white/20";
  const userStyle = "bg-gradient-to-r from-purple-500 to-blue-500";

  div.innerHTML = `
    ${sender === "bot" ? `<img src="assets/mpl.png" class="w-8 h-8 rounded-full">` : ""}
    <div class="px-4 py-3 rounded-2xl max-w-[75%] ${sender === "user" ? userStyle : botStyle}">
      ${text}
    </div>
    ${sender === "user" ? `<img src="assets/user.jpg" class="w-8 h-8 rounded-full">` : ""}
  `;

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

/* ======================
   TYPING INDICATOR
====================== */
function showTyping() {
  const div = document.createElement("div");
  div.id = "typing";
  div.className = "flex items-center gap-2";
  div.innerHTML = `
    <img src="assets/mpl.png" class="w-8 h-8 rounded-full">
    <span class="opacity-70">AI sedang mengetik...</span>
  `;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById("typing");
  if (t) t.remove();
}

/* ======================
   SEND MESSAGE
====================== */
async function sendMessage() {
  const msg = input.value.trim();
  if (!msg) return;

  hideQuickQuestions();

  addMessage(msg, "user");
  input.value = "";
  showTyping();

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg })
    });

    const data = await res.json();
    removeTyping();
    addMessage(data.answer || "Tidak ada jawaban.", "bot");
  } catch {
    removeTyping();
    addMessage("⚠ Tidak dapat menghubungi server.", "bot");
  }
}

/* ======================
   EVENTS (FIXED)
====================== */
sendBtn.addEventListener("click", sendMessage);

// FIX ENTER (desktop + mobile)
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});

// Hide quick question when typing
input.addEventListener("input", () => {
  if (input.value.trim().length > 0) {
    hideQuickQuestions();
  }
});
