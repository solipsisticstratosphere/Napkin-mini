const express = require("express");
const cors = require("cors");
const app = express();
app.use(express.json());
app.use(cors());

// Извлечение связей из текста
const extractRelationships = (text) => {
  if (!text) return { nodes: [], edges: [] };

  // Набор различных паттернов для извлечения связей
  const patterns = [
    // Стандартный формат "A is connected to B"
    {
      regex:
        /([a-zа-я0-9_]+)\s+is\s+connected\s+to\s+([a-zа-я0-9_]+(\s+[a-zа-я0-9_]+)*)/gi,
      process: (match) => ({ from: match[1].trim(), to: match[2].trim() }),
    },
    // Поиск связей через двоеточие "связь: A -> B"
    {
      regex: /связь\s*:\s*([a-zа-я0-9_]+)\s*->\s*([a-zа-я0-9_]+)/gi,
      process: (match) => ({ from: match[1].trim(), to: match[2].trim() }),
    },
    // Формат с использованием стрелок "A -> B"
    {
      regex: /([a-zа-я0-9_]+)\s*->\s*([a-zа-я0-9_]+)/gi,
      process: (match) => ({ from: match[1].trim(), to: match[2].trim() }),
    },
  ];

  const nodes = new Set();
  const edges = [];
  const sentences = text.split(/[.;\n]/); // Разделяем по точке, точке с запятой или новой строке

  // Применяем все паттерны ко всем предложениям
  for (const sentence of sentences) {
    if (!sentence.trim()) continue;

    for (const pattern of patterns) {
      // Используем exec для итерации по всем совпадениям в предложении
      const regex = new RegExp(pattern.regex);
      let match;

      // Обрабатываем все совпадения в текущем предложении
      while ((match = regex.exec(sentence)) !== null) {
        try {
          const relationship = pattern.process(match);
          if (relationship.from && relationship.to) {
            nodes.add(relationship.from);
            nodes.add(relationship.to);
            edges.push(relationship);
          }
        } catch (e) {
          console.warn(
            `Ошибка при обработке совпадения "${match[0]}":`,
            e.message
          );
        }
      }
    }
  }

  // Преобразуем набор узлов в массив
  const nodeList = Array.from(nodes).map((label, index) => ({
    id: index + 1,
    label,
  }));

  // Форматируем ребра
  const edgeList = edges.map((edge, index) => ({
    id: index + 1,
    from: edge.from,
    to: edge.to,
  }));

  return { nodes: nodeList, edges: edgeList };
};

app.post("/parse-text", (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Текст не предоставлен" });
    }

    console.log("Parsing text:", text);

    // Извлекаем связи из текста
    const result = extractRelationships(text);

    console.log("Parsing result:", {
      nodeCount: result.nodes.length,
      edgeCount: result.edges.length,
    });

    // Возвращаем информацию о найденных узлах и связях
    res.json({
      nodes: result.nodes,
      edges: result.edges,
      stats: {
        nodeCount: result.nodes.length,
        edgeCount: result.edges.length,
        density:
          result.nodes.length > 0
            ? result.edges.length /
              (result.nodes.length * (result.nodes.length - 1))
            : 0,
      },
    });
  } catch (error) {
    console.error("Parsing error:", error);
    res.status(500).json({
      error: "Ошибка при парсинге текста",
      details: error.message,
    });
  }
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "parser",
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Сервис парсинга текста запущен на порту ${PORT}`);
});
