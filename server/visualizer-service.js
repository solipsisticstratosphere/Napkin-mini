const express = require("express");
const cors = require("cors");
const app = express();
app.use(express.json());
app.use(cors());

// Генерация позиций узлов с использованием алгоритма "силового отталкивания"
const generateNodePositions = (nodes, edges) => {
  // Базовые настройки для размещения узлов
  const width = 800;
  const height = 600;
  const padding = 50;

  // Случай, когда узлов немного - размещаем по кругу
  if (nodes.length <= 8) {
    return nodes.map((node, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI;
      const radius = Math.min(width, height) / 2.5 - padding;
      return {
        ...node,
        position: {
          x: width / 2 + radius * Math.cos(angle),
          y: height / 2 + radius * Math.sin(angle),
        },
      };
    });
  }

  // Для большего количества узлов - используем более сложное размещение
  // Инициализация случайных позиций
  let positionedNodes = nodes.map((node) => ({
    ...node,
    position: {
      x: padding + Math.random() * (width - 2 * padding),
      y: padding + Math.random() * (height - 2 * padding),
    },
    velocity: { x: 0, y: 0 },
  }));

  // Упрощенная симуляция физических сил для размещения узлов
  const iterations = 50;
  const k = 30; // коэффициент отталкивания

  for (let iter = 0; iter < iterations; iter++) {
    // Обновляем силы для всех узлов
    for (let i = 0; i < positionedNodes.length; i++) {
      let node = positionedNodes[i];
      node.velocity = { x: 0, y: 0 };

      // Силы отталкивания между всеми узлами
      for (let j = 0; j < positionedNodes.length; j++) {
        if (i === j) continue;

        let otherNode = positionedNodes[j];
        let dx = node.position.x - otherNode.position.x;
        let dy = node.position.y - otherNode.position.y;
        let distance = Math.sqrt(dx * dx + dy * dy) || 1;

        // Отталкивание
        let force = k / (distance * distance);
        node.velocity.x += (dx / distance) * force;
        node.velocity.y += (dy / distance) * force;
      }
    }

    // Силы притяжения для связанных узлов
    for (const edge of edges) {
      const sourceNode = positionedNodes.find(
        (n) =>
          n.id === positionedNodes.find((node) => node.label === edge.from)?.id
      );
      const targetNode = positionedNodes.find(
        (n) =>
          n.id === positionedNodes.find((node) => node.label === edge.to)?.id
      );

      if (sourceNode && targetNode) {
        let dx = targetNode.position.x - sourceNode.position.x;
        let dy = targetNode.position.y - sourceNode.position.y;
        let distance = Math.sqrt(dx * dx + dy * dy) || 1;

        // Притяжение (логарифмическое)
        let force = Math.log(distance) * 0.3;
        sourceNode.velocity.x += (dx / distance) * force;
        sourceNode.velocity.y += (dy / distance) * force;
        targetNode.velocity.x -= (dx / distance) * force;
        targetNode.velocity.y -= (dy / distance) * force;
      }
    }

    // Обновляем позиции с учетом вычисленных сил
    for (let node of positionedNodes) {
      node.position.x += Math.min(Math.max(node.velocity.x, -10), 10);
      node.position.y += Math.min(Math.max(node.velocity.y, -10), 10);

      // Ограничиваем позиции пределами экрана
      node.position.x = Math.max(
        padding,
        Math.min(width - padding, node.position.x)
      );
      node.position.y = Math.max(
        padding,
        Math.min(height - padding, node.position.y)
      );
    }
  }

  return positionedNodes;
};

app.post("/generate-visual", (req, res) => {
  try {
    const { nodes, edges } = req.body;

    if (!nodes || !edges) {
      return res.status(400).json({ error: "Данные не предоставлены" });
    }

    console.log("Generating visualization for:", {
      nodeCount: nodes.length,
      edgeCount: edges.length,
    });

    // Определяем позиции узлов
    const positionedNodes = generateNodePositions(nodes, edges);

    // Форматируем узлы для ReactFlow
    const flowNodes = positionedNodes.map((node) => ({
      id: String(node.id),
      type: "customNode",
      position: node.position,
      data: {
        label: node.label,
        connections: edges.filter(
          (e) => e.from === node.label || e.to === node.label
        ).length,
      },
    }));

    // Форматируем рёбра для ReactFlow
    const flowEdges = edges
      .map((edge) => {
        const sourceNode = nodes.find((n) => n.label === edge.from);
        const targetNode = nodes.find((n) => n.label === edge.to);

        if (!sourceNode || !targetNode) return null;

        return {
          id: `e${edge.id}`,
          source: String(sourceNode.id),
          target: String(targetNode.id),
          animated: true,
          style: {
            stroke: getEdgeColor(edge),
            strokeWidth: 2,
          },
          markerEnd: {
            type: "arrowclosed",
            color: getEdgeColor(edge),
          },
        };
      })
      .filter(Boolean);

    // Формируем и возвращаем результат
    const result = {
      nodes: flowNodes,
      edges: flowEdges,
      layout: "force-directed",
      theme: "light",
      metadata: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        graphDensity:
          nodes.length > 1
            ? (edges.length / (nodes.length * (nodes.length - 1))) * 2
            : 0,
      },
    };

    res.json(result);
  } catch (error) {
    console.error("Visualization error:", error);
    res.status(500).json({
      error: "Ошибка при генерации визуализации",
      details: error.message,
    });
  }
});

// Вспомогательная функция для получения цвета ребра
function getEdgeColor(edge) {
  // Можно реализовать разные цвета в зависимости от типа связи
  return "#555";
}

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "visualizer",
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Сервис визуализации запущен на порту ${PORT}`);
});
