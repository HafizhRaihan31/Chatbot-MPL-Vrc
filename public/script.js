const API_URL = "/api/chat";

const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const quickBox = document.getElementById("quick-questions");

/* ======================
   UTIL
====================== */
function hideQuickQuestions() {
  if (quickBox) quickBox.style.display = "none";
}

/* ======================
   CHAT BUBBLE
====================== */
function addMessage(text, sender) {
  const div = document.createElement("div");

  div.className = `flex items-start gap-3 ${
    sender === "user" ? "justify-end" : ""
  }`;

  const botStyle =
    "bg-white/15 backdrop-blur-md border border-white/20 text-white";
  const userStyle =
    "bg-gradient-to-r from-purple-500 to-blue-500 text-white";

  div.innerHTML = `
    ${sender === "bot"
      ? `<img src="assets/mpl.png" class="w-9 h-9 rounded-full shadow">`
      : ""
    }

    <div class="px-4 py-3 rounded-2xl max-w-[75%] ${
      sender === "user" ? userStyle : botStyle
    } shadow-lg">
      ${text}
    </div>

    ${sender === "user"
      ? `<img src="assets/user.jpg" class="w-9 h-9 rounded-full shadow">`
      : ""
    }
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
  div.className = "flex items-start gap-3";

  div.innerHTML = `
    <img src="assets/mpl.png" class="w-9 h-9 rounded-full shadow">
    <div class="px-4 py-3 rounded-2xl bg-white/15 backdrop-blur-md 
      border border-white/20 flex gap-2 shadow-lg">
      <span class="animate-bounce">●</span>
      <span class="animate-bounce delay-150">●</span>
      <span class="animate-bounce delay-300">●</span>
    </div>
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
      body: JSON.stringify({ message: msg }),
    });

    const data = await res.json();
    removeTyping();

    if (!res.ok) {
      addMessage("⚠ " + (data.error || "Terjadi kesalahan"), "bot");
      return;
    }

    addMessage(data.answer, "bot");
  } catch {
    removeTyping();
    addMessage("⚠ Tidak dapat menghubungi server", "bot");
  }
}

/* ======================
   EVENTS
====================== */
sendBtn.onclick = sendMessage;

input.addEventListener("input", () => {
  if (input.value.trim().length > 0) {
    hideQuickQuestions();
  }
});

input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});
