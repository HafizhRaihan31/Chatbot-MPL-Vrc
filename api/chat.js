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
const schedule = loadJSON("schedule.json");

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

function matchAlias(text, map) {
  for (const key in map) {
    for (const a of map[key]) {
      if (text.includes(a)) return key;
    }
  }
  return null;
}

/* =========================
   OPENROUTER POLISH
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
              "Perhalus kalimat berikut agar natural dan singkat. Jangan mengubah isi."
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
   HANDLER
========================= */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const msg = clean(req.body?.message || "");
  if (!msg) return res.json({ answer: "Pesan kosong." });

  // 🔒 Filter MPL
  if (
    !/(mpl|rrq|onic|alter|btr|evos|aura|dewa|geek|jadwal|klasemen|pemain|pelatih|jungler|gold|mid|exp|roam)/.test(
      msg
    )
  ) {
    return res.json({
      answer: "Maaf, saya hanya melayani pertanyaan seputar MPL Indonesia."
    });
  }

  const team = matchAlias(msg, TEAM_ALIAS);
  const role = matchAlias(msg, ROLE_ALIAS);

  // ROLE QUERY
  if (team && role) {
    const t = teamsDetail.find((x) => x.team === team);
    if (!t) return res.json({ answer: "Tim tidak ditemukan." });

    const found = t.players.filter((p) =>
      p.role.toUpperCase().includes(role)
    );

    const names = found.map((p) => p.name).join(", ");
    return res.json({
      answer: await polish(`${role} tim ${team} adalah ${names}.`)
    });
  }

  // KLASMEN
  if (msg.includes("klasemen")) {
    const text = standings
      .slice(0, 8)
      .map((t, i) => `${i + 1}. ${t.teamName} (${t.matchPoint})`)
      .join("\n");

    return res.json({ answer: `Klasemen MPL:\n${text}` });
  }

  // JADWAL
  if (msg.includes("jadwal")) {
    const today = new Date().toLocaleDateString("id-ID");
    const todayMatches = schedule.filter((m) => m.date === today);

    if (!todayMatches.length) {
      return res.json({
        answer: "Tidak ada pertandingan MPL hari ini."
      });
    }

    return res.json({
      answer: todayMatches
        .map((m) => `${m.team1} vs ${m.team2}`)
        .join("\n")
    });
  }

  return res.json({
    answer:
      "Format belum dikenali.\nContoh:\n• siapa jungler ONIC\n• klasemen MPL\n• jadwal MPL hari ini"
  });
}
