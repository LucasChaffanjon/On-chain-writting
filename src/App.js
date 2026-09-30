import React, { useState } from "react";
import { encrypt } from "eciesjs";

function App() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  const RECIPIENT_PUBLIC_KEY = "";

  const BACKEND_URL = "";

  const uint8ToBase64 = (uint8Array) => {
    let binary = "";
    const bytes = new Uint8Array(uint8Array);
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const handleSend = async () => {
    if (!message.trim()) {
      setStatus("Tu n'as rien écrit");
      return;
    }

    try {
      setStatus("Crypting...");

      const data = new TextEncoder().encode(message);

      const encryptedBytes = encrypt(RECIPIENT_PUBLIC_KEY, data);
      const encryptedBase64 = uint8ToBase64(encryptedBytes);

      setStatus("envoi vers le vps...");

      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "APIKEY",
        },
        body: JSON.stringify({
          encrypted: encryptedBase64,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "servor error");
      }

      setStatus(`Envoyé ! ID : ${result.txHash}`);
      setMessage("");
    } catch (err) {
      console.error(err);
      setStatus("Aie.. " + err.message);
    }
  };

  return (
    <div
      style={{
        padding: "40px",
        maxWidth: "700px",
        margin: "0 auto",
        fontFamily: "Arial",
      }}
    >
      <h1>Ecriture on-chain</h1>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type here..."
        rows={6}
        style={{ width: "100%", padding: "15px", fontSize: "16px" }}
      />

      <br />
      <br />

      <button
        onClick={handleSend}
        style={{
          padding: "15px 30px",
          fontSize: "18px",
          background: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
        }}
      >
        Send
      </button>

      <p style={{ marginTop: "20px", fontWeight: "bold" }}>{status}</p>
    </div>
  );
}

export default App;
