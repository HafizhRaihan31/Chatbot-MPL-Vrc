import fs from "fs";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";

/* =========================
   PATH
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
const schedule = loadJSON("schedule.json");
const standings = loadJSON("standings.json");

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
  RRQ: ["rrq"],
  ONIC: ["onic"],
  EVOS: ["evos"],
  BTR: ["btr", "bigetron"],
  DEWA: ["dewa"],
  GEEK: ["geek"]
};

const ROLE_ALIAS = {
  JUNGLE: ["jungler", "jungle", "jg"],
  GOLD: ["gold", "gold lane", "marksman", "mm"],
  MID: ["mid", "midlane"],
  EXP: ["exp", "exp lane"],
  ROAM: ["roam", "roamer", "support"],
  COACH: ["coach", "pelatih"]
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
   AI POLISHER (NO NEW DATA)
========================= */
async function polishWithAI(text) {
  if (!process.env.OPENROUTER_API_KEY) return text;

  try {
    const r = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: process.env.OPENROUTER_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Rapikan dan ringkas jawaban berikut tanpa menambah informasi baru."
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
   GLOBAL DATA AGGREGATOR
========================= */
function getAllByRole(role) {
  const result = [];

  for (const team of teamsDetail) {
    for (const p of team.players) {
      if (p.role.toUpperCase().includes(role)) {
        result.push({
          name: p.name,
          team: team.team
        });
      }
    }
  }

  return result;
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

  /* ======================
     CASE 1: GLOBAL ROLE QUERY
     ex: "semua jungler mpl"
  ====================== */
  if (msg.includes("semua") && role) {
    const players = getAllByRole(role);

    if (!players.length) {
      return res.json({
        answer: `Data ${role.toLowerCase()} MPL belum tersedia.`
      });
    }

    const grouped = players.reduce((acc, p) => {
      acc[p.team] = acc[p.team] || [];
      acc[p.team].push(p.name);
      return acc;
    }, {});

    let text = `Daftar ${role.toLowerCase()} di MPL Indonesia:\n`;
    for (const t in grouped) {
      text += `\n${t}: ${grouped[t].join(", ")}`;
    }

    return res.json({
      answer: await polishWithAI(text)
    });
  }

  /* ======================
     CASE 2: ROLE + TEAM
     ex: "jungler onic"
  ====================== */
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
      answer: await polishWithAI(
        `${role} tim ${team} adalah ${names}.`
      )
    });
  }

  /* ======================
     CASE 3: ALL PLAYERS BY TEAM
  ====================== */
  if (team && msg.includes("pemain")) {
    const t = teamsDetail.find((x) => x.team === team);
    if (!t) return res.json({ answer: "Tim tidak ditemukan." });

    const list = t.players
      .map((p) => `• ${p.name} (${p.role})`)
      .join("\n");

    return res.json({
      answer: await polishWithAI(
        `Daftar pemain tim ${team}:\n${list}`
      )
    });
  }

  /* ======================
     CASE 4: AI EDUKATIF (NO DATA)
  ====================== */
  if (
    /(mpl|mobile legends|jungler|roamer|midlane|gold lane)/.test(
      msg
    )
  ) {
    return res.json({
      answer:
        "Pertanyaan tersebut bersifat umum. Silakan ajukan pertanyaan yang lebih spesifik, misalnya:\n" +
        "• siapa jungler ONIC\n" +
        "• siapa pemain RRQ\n" +
        "• peran jungler di MPL"
    });
  }

  /* ======================
     DEFAULT
  ====================== */
  return res.json({
    answer:
      "Maaf, saya hanya dapat menjawab pertanyaan seputar MPL Indonesia."
  });
}
