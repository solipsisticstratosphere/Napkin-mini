import { useState, useMemo, useCallback, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  Panel,
  applyNodeChanges,
} from "reactflow"; // Добавляем applyNodeChanges
import axios from "axios";

import NodeComponent from "./NodeComponent";
import "reactflow/dist/style.css";
import "./App.css";

// Backend API endpoints
const API_ENDPOINTS = {
  preprocess: "https://preprocess-service.onrender.com",
  parse: "https://parce-service.onrender.com",
  visualize: "https://visualize-service.onrender.com",
};

// Configure axios defaults (optional)
const api = axios.create({
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

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

  const nodeTypes = useMemo(() => ({ customNode: NodeComponent }), []);

  const checkServices = useCallback(async () => {
    const endpoints = [
      { url: `${API_ENDPOINTS.preprocess}/health`, service: "preprocess" },
      { url: `${API_ENDPOINTS.parse}/health`, service: "parse" },
      { url: `${API_ENDPOINTS.visualize}/health`, service: "visualize" },
    ];

    const newStatus = { ...services };

    for (const { url, service } of endpoints) {
      try {
        const response = await api.get(url);
        newStatus[service] = response.status === 200;
      } catch (e) {
        newStatus[service] = false;
      }
    }

    setServices(newStatus);
    return newStatus;
  }, [services]);

  useEffect(() => {
    checkServices();
  }, [checkServices]);

  // Обработчик изменения позиции узлов
  const onNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setNodes]
  );

  const handleExportGraphToClipboard = async () => {
    try {
      if (!nodes.length || !edges.length) {
        setError("Нет графа для экспорта");
        return;
      }

      const exportData = {
        nodes: nodes.map((node) => ({
          id: node.id,
          label: node.data.label,
          position: node.position, // Добавляем текущие позиции узлов
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          from: nodes.find((n) => n.id === edge.source).data.label,
          to: nodes.find((n) => n.id === edge.target).data.label,
        })),
      };

      const response = await api.post(
        `${API_ENDPOINTS.visualize}/export-graph-image`,
        exportData,
        { responseType: "blob" }
      );

      const blob = new Blob([response.data], { type: "image/png" });
      const item = new ClipboardItem({ "image/png": blob });
      await navigator.clipboard.write([item]);

      alert("Граф скопирован в буфер обмена! Вставьте в Word с помощью Ctrl+V");
    } catch (error) {
      console.error("Ошибка экспорта:", error);
      setError("Ошибка при экспорте графа в буфер обмена");
    }
  };

  const handlePreprocessText = async () => {
    if (!text.trim()) {
      setError("Пожалуйста, введите текст для анализа");
      return;
    }

    try {
      setCleanedText(null);
      setParsedData(null);
      setNodes([]);
      setEdges([]);

      setLoading((prev) => ({ ...prev, preprocess: true }));
      setError(null);

      if (!services.preprocess) {
        throw new Error(
          "Сервис предобработки текста недоступен. Пожалуйста, проверьте статус сервисов."
        );
      }

      const response = await api.post(
        `${API_ENDPOINTS.preprocess}/preprocess-text`,
        { text }
      );

      const { cleanedText, detectedFormats } = response.data;

      setCleanedText(cleanedText);
      console.log("Обнаруженные форматы:", detectedFormats);
    } catch (error) {
      console.error("Ошибка предобработки:", error);
      const errorMessage = error.response?.data?.error || error.message;
      setError(`Ошибка предобработки: ${errorMessage}`);
    } finally {
      setLoading((prev) => ({ ...prev, preprocess: false }));
    }
  };

  const handleParseText = async () => {
    const textToProcess = cleanedText || text;

    if (!textToProcess.trim()) {
      setError("Нет текста для анализа");
      return;
    }

    try {
      setNodes([]);
      setEdges([]);

      setLoading((prev) => ({ ...prev, parse: true }));
      setError(null);

      if (!services.parse) {
        throw new Error(
          "Сервис анализа связей недоступен. Пожалуйста, проверьте статус сервисов."
        );
      }

      const response = await api.post(`${API_ENDPOINTS.parse}/parse-text`, {
        text: textToProcess,
      });

      const data = response.data;

      if (!data.nodes || data.nodes.length === 0) {
        throw new Error(
          "Не удалось найти связи в тексте. Попробуйте использовать другой формат описания связей."
        );
      }

      setParsedData(data);
    } catch (error) {
      console.error("Ошибка парсинга:", error);
      const errorMessage = error.response?.data?.error || error.message;
      setError(`Ошибка разбора текста: ${errorMessage}`);
    } finally {
      setLoading((prev) => ({ ...prev, parse: false }));
    }
  };

  const handleGenerateVisual = async () => {
    if (!parsedData || !parsedData.nodes || parsedData.nodes.length === 0) {
      setError("Нет данных для визуализации");
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, visualize: true }));
      setError(null);

      if (!services.visualize) {
        throw new Error(
          "Сервис визуализации недоступен. Пожалуйста, проверьте статус сервисов."
        );
      }

      const response = await api.post(
        `${API_ENDPOINTS.visualize}/generate-visual`,
        parsedData
      );

      const visualData = response.data;

      setNodes(visualData.nodes.map((node) => ({ ...node, draggable: true }))); // Делаем узлы перетаскиваемыми
      setEdges(visualData.edges);
    } catch (error) {
      console.error("Ошибка визуализации:", error);
      const errorMessage = error.response?.data?.error || error.message;
      setError(`Ошибка создания визуализации: ${errorMessage}`);
    } finally {
      setLoading((prev) => ({ ...prev, visualize: false }));
    }
  };

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
              disabled={
                loading.preprocess || !text.trim() || !services.preprocess
              }
              className={`action-button ${loading.preprocess ? "loading" : ""}`}
            >
              {loading.preprocess ? "Обработка..." : "Предобработка текста"}
            </button>

            <button
              onClick={handleParseText}
              disabled={
                loading.parse ||
                (!text.trim() && !cleanedText) ||
                !services.parse
              }
              className={`action-button ${loading.parse ? "loading" : ""}`}
            >
              {loading.parse ? "Анализ..." : "Анализировать связи"}
            </button>

            <button
              onClick={handleGenerateVisual}
              disabled={loading.visualize || !parsedData || !services.visualize}
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
                onNodesChange={onNodesChange} // Добавляем обработчик изменений узлов
                fitView
                attributionPosition="bottom-right"
                onInit={(reactFlowInstance) => {
                  console.log("ReactFlow initialized");
                  setTimeout(() => reactFlowInstance.fitView(), 100);
                }}
              >
                <Background color="#f8f8f8" gap={16} />
                <Controls />
                <Panel position="top-right" className="download-panel">
                  <button onClick={handleExportGraphToClipboard}>
                    Скопировать граф в буфер
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
