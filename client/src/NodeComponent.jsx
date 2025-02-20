import React from "react";
import { Handle, Position } from "reactflow";

// Styles inside the component
const styles = {
  node: {
    padding: "10px 15px",
    borderRadius: "8px",
    background: "white",
    border: "1px solid #ddd",
    boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
    minWidth: "100px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  label: {
    fontWeight: "bold",
    fontSize: "14px",
    marginBottom: "4px",
  },
  connections: {
    fontSize: "12px",
    color: "#555",
  },
  handle: {
    width: "8px",
    height: "8px",
    background: "#555",
    border: "1px solid #333",
  },
};

function NodeComponent({ data }) {
  // Add console logging to debug data
  console.log("Node data:", data);

  return (
    <div style={styles.node}>
      <Handle
        type="target"
        position={Position.Top}
        style={styles.handle}
        id="top"
      />
      <div style={styles.label}>{data?.label || "No Label"}</div>
      {data?.connections && (
        <div style={styles.connections}>Connections: {data.connections}</div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        style={styles.handle}
        id="bottom"
      />
      <Handle
        type="target"
        position={Position.Left}
        style={styles.handle}
        id="left"
      />
      <Handle
        type="source"
        position={Position.Right}
        style={styles.handle}
        id="right"
      />
    </div>
  );
}

export default NodeComponent;
