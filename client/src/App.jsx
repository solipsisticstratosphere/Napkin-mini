import { useState, useMemo, useCallback, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  Panel,
  applyNodeChanges,
} from "reactflow";
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

  const onNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setNodes]
  );

  const handleExportGraphToClipboard = async () => {
    try {
      if (!nodes.length || !edges.length) {
        setError("No graph to export");
        return;
      }

      const exportData = {
        nodes: nodes.map((node) => ({
          id: node.id,
          label: node.data.label,
          position: node.position,
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

      alert("Graph copied to clipboard! Paste in Word using Ctrl+V");
    } catch (error) {
      console.error("Export error:", error);
      setError("Error exporting graph to clipboard");
    }
  };

  const handlePreprocessText = async () => {
    if (!text.trim()) {
      setError("Please enter text for analysis");
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
          "Text preprocessing service is unavailable. Please check service status."
        );
      }

      const response = await api.post(
        `${API_ENDPOINTS.preprocess}/preprocess-text`,
        { text }
      );

      const { cleanedText, detectedFormats } = response.data;

      setCleanedText(cleanedText);
      console.log("Detected formats:", detectedFormats);
    } catch (error) {
      console.error("Preprocessing error:", error);
      const errorMessage = error.response?.data?.error || error.message;
      setError(`Preprocessing error: ${errorMessage}`);
    } finally {
      setLoading((prev) => ({ ...prev, preprocess: false }));
    }
  };

  const handleParseText = async () => {
    const textToProcess = cleanedText || text;

    if (!textToProcess.trim()) {
      setError("No text for analysis");
      return;
    }

    try {
      setNodes([]);
      setEdges([]);

      setLoading((prev) => ({ ...prev, parse: true }));
      setError(null);

      if (!services.parse) {
        throw new Error(
          "Relationship analysis service is unavailable. Please check service status."
        );
      }

      const response = await api.post(`${API_ENDPOINTS.parse}/parse-text`, {
        text: textToProcess,
      });

      const data = response.data;

      if (!data.nodes || data.nodes.length === 0) {
        throw new Error(
          "Could not find relationships in text. Try using a different relationship description format."
        );
      }

      setParsedData(data);
    } catch (error) {
      console.error("Parsing error:", error);
      const errorMessage = error.response?.data?.error || error.message;
      setError(`Text parsing error: ${errorMessage}`);
    } finally {
      setLoading((prev) => ({ ...prev, parse: false }));
    }
  };

  const handleGenerateVisual = async () => {
    if (!parsedData || !parsedData.nodes || parsedData.nodes.length === 0) {
      setError("No data for visualization");
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, visualize: true }));
      setError(null);

      if (!services.visualize) {
        throw new Error(
          "Visualization service is unavailable. Please check service status."
        );
      }

      const response = await api.post(
        `${API_ENDPOINTS.visualize}/generate-visual`,
        parsedData
      );

      const visualData = response.data;

      setNodes(visualData.nodes.map((node) => ({ ...node, draggable: true })));
      setEdges(visualData.edges);
    } catch (error) {
      console.error("Visualization error:", error);
      const errorMessage = error.response?.data?.error || error.message;
      setError(`Visualization creation error: ${errorMessage}`);
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
          "apple is connected to banana. tomato connects to carrot. relationship: grape -> strawberry"
        );
        break;
      case "arrows":
        setText("A -> B -> C -> D. E -> A. B -> E");
        break;
      default:
        setText("");
    }
  };

  const wakeServices = useCallback(async () => {
    const endpoints = [
      { url: `${API_ENDPOINTS.preprocess}/health`, service: "preprocess" },
      { url: `${API_ENDPOINTS.parse}/health`, service: "parse" },
      { url: `${API_ENDPOINTS.visualize}/health`, service: "visualize" },
    ];

    setLoading((prev) => ({
      ...prev,
      preprocess: true,
      parse: true,
      visualize: true,
    }));

    try {
      await Promise.all(
        endpoints.map(({ url }) =>
          api.get(url, { timeout: 5000 }).catch((e) => {
            console.log(`Failed to wake service: ${url}`, e.message);
            return null;
          })
        )
      );

      await checkServices();
      alert("Service wake attempt completed");
    } catch (error) {
      console.error("Error waking services:", error);
      setError("Failed to wake services");
    } finally {
      setLoading((prev) => ({
        ...prev,
        preprocess: false,
        parse: false,
        visualize: false,
      }));
    }
  }, [checkServices]);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Text Relationship Analyzer</h1>
        <div className="service-status">
          {Object.entries(services).map(([key, status]) => (
            <div
              key={key}
              className={`status-indicator ${status ? "online" : "offline"}`}
              title={`Service ${key}: ${status ? "available" : "unavailable"}`}
            >
              {key}
            </div>
          ))}
          <button onClick={checkServices} className="refresh-button">
            ⟳
          </button>
          <button
            onClick={wakeServices}
            disabled={loading.preprocess || loading.parse || loading.visualize}
            className={`wake-button ${loading.preprocess ? "loading" : ""}`}
          >
            {loading.preprocess ? "Waking..." : "Wake Services"}
          </button>
        </div>
      </header>

      <main className="app-main">
        <section className="input-section">
          <div className="text-input-container">
            <label htmlFor="text-input">Enter relationship description:</label>
            <textarea
              id="text-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter text in any format, for example:
- apple is connected to banana
- apple is connected to pear
- A -> B
- relationship: grape -> strawberry"
              rows={5}
            />
            <div className="example-buttons">
              <span>Examples:</span>
              <button onClick={() => insertExampleText("simple")}>
                Simple
              </button>
              <button onClick={() => insertExampleText("mixed")}>Mixed</button>
              <button onClick={() => insertExampleText("arrows")}>
                With Arrows
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
              {loading.preprocess ? "Processing..." : "Preprocess Text"}
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
              {loading.parse ? "Analyzing..." : "Analyze Relationships"}
            </button>

            <button
              onClick={handleGenerateVisual}
              disabled={loading.visualize || !parsedData || !services.visualize}
              className={`action-button ${loading.visualize ? "loading" : ""}`}
            >
              {loading.visualize ? "Creating..." : "Visualize"}
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}

          {cleanedText && cleanedText !== text && (
            <div className="preprocessed-text">
              <h3>Preprocessed Text:</h3>
              <p>{cleanedText}</p>
            </div>
          )}

          {parsedData && parsedData.nodes && (
            <div className="parsed-data">
              <h3>Detected Elements:</h3>
              <div className="elements-summary">
                <div className="element-count">
                  <span className="count">{parsedData.nodes.length}</span>
                  <span className="label">nodes</span>
                </div>
                <div className="element-count">
                  <span className="count">{parsedData.edges.length}</span>
                  <span className="label">relationships</span>
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
                onNodesChange={onNodesChange}
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
                    Copy Graph to Clipboard
                  </button>
                </Panel>
              </ReactFlow>
            </div>
          ) : (
            <div className="no-visualization-message">
              <p>Visualization will appear here after data analysis</p>
              <p className="steps-hint">
                1. Enter text with relationship description
                <br />
                2. Click Preprocess Text
                <br />
                3. Click Analyze Relationships
                <br />
                4. Click Visualize
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
