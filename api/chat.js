import fs from "fs";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";

/* =========================
   PATH HELPER
========================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, "..");

/* =========================
   LOAD JSON
========================= */
const loadJSON = (name) =>
  JSON.parse(fs.readFileSync(path.join(root, "data", name), "utf-8"));

const teamsDetail = loadJSON("teams_detail.json");
const standings = loadJSON("standings.json");
const scheduleRaw = loadJSON("schedule.json");

const schedule = Array.isArray(scheduleRaw)
  ? scheduleRaw
  : Object.values(scheduleRaw || {}).flat();

/* =========================
   UTIL
========================= */
const clean = (t) =>
  t.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

/* =========================
   ALIAS
========================= */
const TEAM_ALIAS = {
  AE: ["ae", "alter", "alter ego"],
  RRQ: ["rrq", "rex"],
  ONIC: ["onic"],
  BTR: ["btr", "bigetron"],
  EVOS: ["evos"],
  AURA: ["aura"],
  GEEK: ["geek"],
  DEWA: ["dewa"]
};

const ROLE_ALIAS = {
  COACH: ["coach", "pelatih"],
  JUNGLE: ["jungler", "jungle", "jg"],
  MID: ["mid"],
  GOLD: ["gold", "marksman", "mm"],
  EXP: ["exp"],
  ROAM: ["roam", "support"]
};

const PLAYER_KEYWORDS = [
  "pemain",
  "player",
  "roster",
  "skuad",
  "anggota",
  "lineup"
];

function matchAlias(text, map) {
  for (const key in map) {
    for (const a of map[key]) {
      if (text.includes(a)) return key;
    }
  }
  return null;
}

/* =========================
   OPENROUTER – POLISH
========================= */
async function polish(text) {
  if (!process.env.OPENROUTER_API_KEY) return text;

  try {
    const r = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model:
          process.env.OPENROUTER_MODEL ||
          "meta-llama/llama-3.1-8b-instruct",
        messages: [
          {
            role: "system",
            content:
              "Perhalus kalimat berikut agar natural dan singkat. Jangan mengubah informasi."
          },
          { role: "user", content: text }
        ],
        temperature: 0.2
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return r.data.choices[0].message.content;
  } catch {
    return text;
  }
}

/* =========================
   OPENROUTER – AI FALLBACK (MPL ONLY)
========================= */
async function askMPLAI(question) {
  if (!process.env.OPENROUTER_API_KEY) {
    return "Maaf, informasi detail belum tersedia saat ini.";
  }

  try {
    const r = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model:
          process.env.OPENROUTER_MODEL ||
          "meta-llama/llama-3.1-8b-instruct",
        messages: [
          {
            role: "system",
            content: `
Kamu adalah asisten khusus MPL Indonesia.

ATURAN WAJIB:
- HANYA jawab seputar MPL Indonesia.
- JANGAN mengarang roster, jadwal, hasil pertandingan, atau klasemen.
- Jika data spesifik tidak pasti, jawab secara UMUM.
- Jawaban singkat, informatif, netral, dan edukatif.
`
          },
          { role: "user", content: question }
        ],
        temperature: 0.3
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return r.data.choices[0].message.content;
  } catch {
    return "Maaf, saya belum dapat menjawab pertanyaan tersebut saat ini.";
  }
}

/* =========================
   HANDLER
========================= */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const msg = clean(req.body?.message || "");
  if (!msg) return res.json({ answer: "Pesan kosong." });

  const team = matchAlias(msg, TEAM_ALIAS);
  const role = matchAlias(msg, ROLE_ALIAS);

  /* ===== ROLE QUERY ===== */
  if (team && role) {
    const t = teamsDetail.find((x) => x.team === team);
    if (!t) return res.json({ answer: "Tim tidak ditemukan." });

    const found = t.players.filter((p) =>
      p.role.toUpperCase().includes(role)
    );

    if (!found.length) {
      return res.json({
        answer: `Data ${role.toLowerCase()} tim ${team} belum tersedia.`
      });
    }

    const names = found.map((p) => p.name).join(", ");
    return res.json({
      answer: await polish(`${role} tim ${team} adalah ${names}.`)
    });
  }

  /* ===== SEMUA PEMAIN ===== */
  if (team && PLAYER_KEYWORDS.some((k) => msg.includes(k))) {
    const t = teamsDetail.find((x) => x.team === team);
    if (!t) return res.json({ answer: "Tim tidak ditemukan." });

    const players = t.players.filter(
      (p) =>
        !p.role.toUpperCase().includes("COACH") &&
        !p.role.toUpperCase().includes("ANALYST")
    );

    const list = players
      .map((p) => `• ${p.name} (${p.role})`)
      .join("\n");

    return res.json({
      answer: await polish(`Daftar pemain tim ${team}:\n${list}`)
    });
  }

  /* ===== KLASMEN ===== */
  if (msg.includes("klasemen")) {
    const valid = standings.filter(
      (t) => t.teamName && t.matchPoint
    );

    if (!valid.length) {
      return res.json({
        answer: "Data klasemen belum tersedia saat ini."
      });
    }

    const text = valid
      .slice(0, 8)
      .map((t, i) => `${i + 1}. ${t.teamName} (${t.matchPoint})`)
      .join("\n");

    return res.json({
      answer: `Klasemen MPL saat ini:\n${text}`
    });
  }

  /* ===== JADWAL HARI INI ===== */
  if (msg.includes("jadwal")) {
    const today = new Date().toLocaleDateString("id-ID");
    const todayMatches = schedule.filter(
      (m) => m.date === today
    );

    if (!todayMatches.length) {
      return res.json({
        answer: "Tidak ada pertandingan MPL hari ini."
      });
    }

    const text = todayMatches
      .map((m) => `${m.team1} vs ${m.team2}`)
      .join("\n");

    return res.json({
      answer: `Jadwal MPL hari ini:\n${text}`
    });
  }

  /* ===== AI FALLBACK (MPL ONLY) ===== */
  if (
    /(mpl|mobile legends|rrq|onic|evos|alter|bigetron|dewa|aura|geek)/.test(
      msg
    )
  ) {
    const aiAnswer = await askMPLAI(msg);
    return res.json({ answer: aiAnswer });
  }

  /* ===== DEFAULT ===== */
  return res.json({
    answer:
      "Maaf, saya hanya dapat menjawab pertanyaan seputar MPL Indonesia."
  });
}
