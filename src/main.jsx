import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Se qualquer erro acontecer dentro do app, em vez de deixar a tela
// preta/branca em branco, isso mostra a mensagem do erro na tela —
// assim dá pra saber exatamente o que quebrou (e mandar print pra corrigir).
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }
  static getDerivedStateFromError(erro) {
    return { erro };
  }
  render() {
    if (this.state.erro) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#0B0F0E",
            color: "#F2F5F3",
            fontFamily: "system-ui, sans-serif",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0 }}>⚠️ O app encontrou um erro</h2>
          <p style={{ color: "#9BA3A0", fontSize: 14 }}>
            Tire um print desta tela e mande pro suporte/Claude corrigir.
          </p>
          <pre
            style={{
              background: "#151A18",
              padding: 12,
              borderRadius: 8,
              fontSize: 12,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {String(this.state.erro?.message || this.state.erro)}
            {"\n\n"}
            {String(this.state.erro?.stack || "")}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#8CF56A",
              color: "#0B0F0E",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              fontWeight: 600,
            }}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Registra o service worker (permite instalar como app / funcionar offline)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
