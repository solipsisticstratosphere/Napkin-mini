import { useState, useMemo, useCallback, useEffect } from "react";
import ReactFlow, { Background, Controls, Panel } from "reactflow";

import NodeComponent from "./NodeComponent";
import "reactflow/dist/style.css";
import "./App.css";

function App() {
  const [text, setText] = useState("");
  const [cleanedText, setCleanedText] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState({
    preprocess: false,
    parse: false,
    visualize: false,
  });
  const [error, setError] = useState(null);
  const [services, setServices] = useState({
    preprocess: false,
    parse: false,
    visualize: false,
  });

  // Мемоизируем nodeTypes
  const nodeTypes = useMemo(() => ({ customNode: NodeComponent }), []);

  // Проверка доступности сервисов
  const checkServices = useCallback(async () => {
    const endpoints = [
      { url: "http://localhost:3003/health", service: "preprocess" },
      { url: "http://localhost:3001/health", service: "parse" },
      { url: "http://localhost:3002/health", service: "visualize" },
    ];

    const newStatus = { ...services };

    for (const { url, service } of endpoints) {
      try {
        const response = await fetch(url, { method: "GET" });
        newStatus[service] = response.ok;
      } catch (e) {
        newStatus[service] = false;
      }
    }

    setServices(newStatus);

    return newStatus;
  }, [services]);

  // FIXED: Use useEffect instead of useState for component mount logic
  useEffect(() => {
    console.log("Current nodes:", nodes);
    console.log("Current edges:", edges);
    console.log("Node types:", nodeTypes);
  }, [nodes, edges, nodeTypes]);

  // Обработка предварительной обработки текста
  const handlePreprocessText = async () => {
    if (!text.trim()) {
      setError("Пожалуйста, введите текст для анализа");
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, preprocess: true }));
      setError(null);

      // Проверяем, доступен ли сервис предобработки
      if (!services.preprocess) {
        // Если сервис недоступен, используем упрощенную локальную обработку
        console.log(
          "Сервис предобработки недоступен, используем локальную обработку"
        );
        setCleanedText(text.toLowerCase());
        setLoading((prev) => ({ ...prev, preprocess: false }));
        return;
      }

      const response = await fetch("http://localhost:3003/preprocess-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ошибка предобработки текста");
      }

      const { cleanedText, detectedFormats } = await response.json();

      setCleanedText(cleanedText);
      console.log("Обнаруженные форматы:", detectedFormats);
    } catch (error) {
      console.error("Ошибка предобработки:", error);
      setError(`Ошибка предобработки: ${error.message}`);

      // Если произошла ошибка, используем исходный текст
      setCleanedText(text);
    } finally {
      setLoading((prev) => ({ ...prev, preprocess: false }));
    }
  };

  // Обработка парсинга текста
  const handleParseText = async () => {
    const textToProcess = cleanedText || text;

    if (!textToProcess.trim()) {
      setError("Нет текста для анализа");
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, parse: true }));
      setError(null);

      const response = await fetch("http://localhost:3001/parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToProcess }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ошибка парсинга текста");
      }

      const data = await response.json();

      if (!data.nodes || data.nodes.length === 0) {
        setError(
          "Не удалось найти связи в тексте. Попробуйте использовать другой формат описания связей."
        );
        return;
      }

      setParsedData(data);

      // Если сервис визуализации недоступен, сразу генерируем визуализацию локально
      if (!services.visualize) {
        generateLocalVisualization(data);
      }
    } catch (error) {
      console.error("Ошибка парсинга:", error);
      setError(`Ошибка разбора текста: ${error.message}`);
    } finally {
      setLoading((prev) => ({ ...prev, parse: false }));
    }
  };

  // Генерация визуализации
  const handleGenerateVisual = async () => {
    if (!parsedData || !parsedData.nodes || parsedData.nodes.length === 0) {
      setError("Нет данных для визуализации");
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, visualize: true }));
      setError(null);

      if (!services.visualize) {
        // Если сервис визуализации недоступен, используем локальную визуализацию
        generateLocalVisualization(parsedData);
        return;
      }

      const response = await fetch("http://localhost:3002/generate-visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ошибка визуализации");
      }

      const data = await response.json();

      setNodes(data.nodes);
      setEdges(data.edges);
    } catch (error) {
      console.error("Ошибка визуализации:", error);
      setError(`Ошибка создания визуализации: ${error.message}`);

      // В случае ошибки пытаемся создать визуализацию локально
      generateLocalVisualization(parsedData);
    } finally {
      setLoading((prev) => ({ ...prev, visualize: false }));
    }
  };

  // Локальная генерация визуализации (резервный вариант)
  const generateLocalVisualization = (data) => {
    if (!data || !data.nodes || !data.edges) {
      console.error("Invalid data format for visualization:", data);
      setError("Неверный формат данных для визуализации");
      return;
    }

    // Create a map of label to id for quick lookups
    const labelToIdMap = {};
    data.nodes.forEach((node) => {
      labelToIdMap[node.label] = String(node.id);
    });

    console.log("Label to ID map:", labelToIdMap);

    // Create nodes with properly calculated connections
    const flowNodes = data.nodes.map((node, index) => {
      // Count connections for this node
      const connectionCount = data.edges.filter(
        (e) => e.from === node.label || e.to === node.label
      ).length;

      return {
        id: String(node.id),
        type: "customNode", // Ensure this matches the key in nodeTypes
        position: {
          x: 150 + (index % 3) * 250,
          y: 150 + Math.floor(index / 3) * 200,
        },
        data: {
          label: node.label,
          connections: connectionCount,
        },
      };
    });

    // Create edges using the labelToIdMap for proper node references
    const flowEdges = data.edges
      .map((edge, index) => {
        const sourceId = labelToIdMap[edge.from];
        const targetId = labelToIdMap[edge.to];

        if (!sourceId || !targetId) {
          console.warn(`Edge ${index} has missing source or target:`, edge);
          return null;
        }

        return {
          id: `e${index}`,
          source: sourceId,
          target: targetId,
          animated: true,
          style: { stroke: "#555", strokeWidth: 2 },
          markerEnd: {
            type: "arrowclosed",
          },
        };
      })
      .filter(Boolean);

    console.log("Generated nodes:", flowNodes);
    console.log("Generated edges:", flowEdges);

    // Set state only if we have valid nodes
    if (flowNodes.length > 0) {
      setNodes(flowNodes);
      setEdges(flowEdges);
    } else {
      setError("Не удалось создать узлы для визуализации");
    }
  };

  // Пример текста для быстрой вставки
  const insertExampleText = (example) => {
    switch (example) {
      case "simple":
        setText("apple is connected to banana. banana is connected to orange");
        break;
      case "mixed":
        setText(
          "яблоко связано с банан. tomato connects to carrot. связь: grape -> strawberry"
        );
        break;
      case "arrows":
        setText("A -> B -> C -> D. E -> A. B -> E");
        break;
      default:
        setText("");
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Анализатор связей в тексте</h1>
        <div className="service-status">
          {Object.entries(services).map(([key, status]) => (
            <div
              key={key}
              className={`status-indicator ${status ? "online" : "offline"}`}
              title={`Сервис ${key}: ${status ? "доступен" : "недоступен"}`}
            >
              {key}
            </div>
          ))}
          <button onClick={checkServices} className="refresh-button">
            ⟳
          </button>
        </div>
      </header>

      <main className="app-main">
        <section className="input-section">
          <div className="text-input-container">
            <label htmlFor="text-input">Введите описание связей:</label>
            <textarea
              id="text-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Введите текст в любом формате, например:
- apple is connected to banana
- яблоко связано с грушей
- A -> B
- связь: grape -> strawberry"
              rows={5}
            />
            <div className="example-buttons">
              <span>Примеры:</span>
              <button onClick={() => insertExampleText("simple")}>
                Простой
              </button>
              <button onClick={() => insertExampleText("mixed")}>
                Смешанный
              </button>
              <button onClick={() => insertExampleText("arrows")}>
                Со стрелками
              </button>
            </div>
          </div>

          <div className="action-buttons">
            <button
              onClick={handlePreprocessText}
              disabled={loading.preprocess || !text.trim()}
              className={`action-button ${loading.preprocess ? "loading" : ""}`}
            >
              {loading.preprocess ? "Обработка..." : "Предобработка текста"}
            </button>

            <button
              onClick={handleParseText}
              disabled={loading.parse || (!text.trim() && !cleanedText)}
              className={`action-button ${loading.parse ? "loading" : ""}`}
            >
              {loading.parse ? "Анализ..." : "Анализировать связи"}
            </button>

            <button
              onClick={handleGenerateVisual}
              disabled={loading.visualize || !parsedData}
              className={`action-button ${loading.visualize ? "loading" : ""}`}
            >
              {loading.visualize ? "Создание..." : "Визуализировать"}
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}

          {cleanedText && cleanedText !== text && (
            <div className="preprocessed-text">
              <h3>Предобработанный текст:</h3>
              <p>{cleanedText}</p>
            </div>
          )}

          {parsedData && parsedData.nodes && (
            <div className="parsed-data">
              <h3>Обнаруженные элементы:</h3>
              <div className="elements-summary">
                <div className="element-count">
                  <span className="count">{parsedData.nodes.length}</span>
                  <span className="label">узлов</span>
                </div>
                <div className="element-count">
                  <span className="count">{parsedData.edges.length}</span>
                  <span className="label">связей</span>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="visualization-section">
          {nodes.length > 0 && edges.length > 0 ? (
            <div className="flow-container">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                attributionPosition="bottom-right"
                onInit={(reactFlowInstance) => {
                  console.log("ReactFlow initialized:", reactFlowInstance);
                  setTimeout(() => reactFlowInstance.fitView(), 100);
                }}
              >
                <Background color="#f8f8f8" gap={16} />
                <Controls />
                <Panel position="top-right" className="download-panel">
                  <button
                    onClick={() => {
                      console.log("Current nodes:", nodes);
                      console.log("Current edges:", edges);
                      alert(
                        "Функция экспорта будет добавлена в следующей версии"
                      );
                    }}
                  >
                    Экспорт графа
                  </button>
                </Panel>
              </ReactFlow>
            </div>
          ) : (
            <div className="no-visualization-message">
              <p>Визуализация появится здесь после анализа данных</p>
              <p className="steps-hint">
                1. Введите текст с описанием связей
                <br />
                2. Нажмите Предобработка текста
                <br />
                3. Нажмите Анализировать связи
                <br />
                4. Нажмите Визуализировать
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
