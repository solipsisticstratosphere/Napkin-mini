const express = require("express");
const cors = require("cors");
const app = express();
app.use(express.json());
app.use(cors());

// Функция нормализации текста
const normalizeText = (text) => {
  // Преобразуем текст в нижний регистр
  let normalized = text.toLowerCase();

  // Заменяем различные варианты связей на стандартный формат
  const replacements = [
    // Русские варианты
    {
      pattern: /([а-яa-z0-9_]+)\s+связан(?:а|о)?\s+с\s+([а-яa-z0-9_]+)/gi,
      replacement: "$1 is connected to $2",
    },
    {
      pattern: /([а-яa-z0-9_]+)\s+соединен(?:а|о)?\s+с\s+([а-яa-z0-9_]+)/gi,
      replacement: "$1 is connected to $2",
    },
    {
      pattern: /связь\s+между\s+([а-яa-z0-9_]+)\s+и\s+([а-яa-z0-9_]+)/gi,
      replacement: "$1 is connected to $2",
    },

    // Английские варианты (дополнительные)
    {
      pattern: /([a-z0-9_]+)\s+connects\s+to\s+([a-z0-9_]+)/gi,
      replacement: "$1 is connected to $2",
    },
    {
      pattern: /([a-z0-9_]+)\s+links\s+to\s+([a-z0-9_]+)/gi,
      replacement: "$1 is connected to $2",
    },
    {
      pattern: /([a-z0-9_]+)\s+and\s+([a-z0-9_]+)\s+are\s+connected/gi,
      replacement: "$1 is connected to $2",
    },
    {
      pattern: /connection\s+between\s+([a-z0-9_]+)\s+and\s+([a-z0-9_]+)/gi,
      replacement: "$1 is connected to $2",
    },
  ];

  for (const { pattern, replacement } of replacements) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized;
};

app.post("/preprocess-text", (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        error: "Текст не предоставлен",
      });
    }

    console.log("Received text for preprocessing:", text);

    // Нормализация текста
    const cleanedText = normalizeText(text);

    console.log("Preprocessed text:", cleanedText);

    res.json({
      originalText: text,
      cleanedText: cleanedText,
      detectedFormats: detectFormats(text),
    });
  } catch (error) {
    console.error("Preprocessing error:", error);
    res.status(500).json({
      error: "Ошибка предобработки текста",
      details: error.message,
    });
  }
});

// Определение используемых форматов в тексте
function detectFormats(text) {
  const formats = [];

  if (/is connected to/i.test(text)) formats.push("стандартный");
  if (/связан(а|о)? с/i.test(text)) formats.push("русский");
  if (/connects to/i.test(text)) formats.push("глагольный");
  if (/connection between/i.test(text)) formats.push("описательный");

  return formats.length ? formats : ["неопределенный"];
}

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "preprocessing",
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Сервис предобработки текста запущен на порту ${PORT}`);
});
