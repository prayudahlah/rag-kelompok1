import { useState, useRef, useEffect } from "react";
import { useChat } from "./hooks/useChat";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { ChatMessage } from "./components/ChatMessage";
import { ChatInput } from "./components/ChatInput";
import { LoadingIndicator } from "./components/LoadingIndicator";
import { ErrorCard } from "./components/ErrorCard";
import { HistoryList } from "./components/HistoryList";
import type { ActivePage, AppMode } from "./types/chat";
import "./App.css";

function App() {
  const {
    messages,
    loading,
    error,
    history,
    sendMessage,
    clearChat,
    dismissError,
    loadSession,
    deleteHistorySession,
  } = useChat();

  const [mode, setMode] = useState<AppMode>(
    import.meta.env.VITE_USE_MOCK === "true" ? "mock" : "live"
  );
  const [activePage, setActivePage] = useState<ActivePage>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, error]);

  function handleToggleMode() {
    setMode((prev) => (prev === "mock" ? "live" : "mock"));
  }

  function handleRetry() {
    dismissError();
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      sendMessage(lastUserMsg.content);
    }
  }

  function handleSelectSession(session: ReturnType<typeof useChat>["history"][0]) {
    loadSession(session);
    setActivePage("chat");
  }

  return (
    <div className="app">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        mode={mode}
        collapsed={!sidebarOpen}
      />

      <div className="main">
        <Header
          mode={mode}
          hasMessages={messages.length > 0}
          onToggleMode={handleToggleMode}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onClearChat={clearChat}
        />

        <div className="chat-area">
          {activePage === "chat" && (
            <>
              {messages.length === 0 && !loading ? (
                <WelcomeScreen onSend={sendMessage} />
              ) : (
                <div className="chat-messages">
                  {messages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))}
                  {loading && <LoadingIndicator />}
                  {error && <ErrorCard message={error} onRetry={handleRetry} />}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </>
          )}

          {activePage === "riwayat" && (
            <HistoryList
              sessions={history}
              onSelect={handleSelectSession}
              onDelete={deleteHistorySession}
            />
          )}

          {activePage === "tentang" && (
            <div className="placeholder-page">
              <h2>Tentang PDP Assistant</h2>
              <p>
                PDP Assistant adalah aplikasi RAG (Retrieval-Augmented Generation) untuk tanya jawab
                mengenai Undang-Undang Republik Indonesia Nomor 27 Tahun 2022 tentang Pelindungan
                Data Pribadi.
              </p>
              <p>
                Aplikasi ini dibangun dengan React, TypeScript, dan terintegrasi dengan Gemini API
                untuk menghasilkan jawaban yang akurat berdasarkan dokumen hukum.
              </p>
            </div>
          )}
        </div>

        {activePage === "chat" && (
          <div className="chat-footer">
            <ChatInput onSend={sendMessage} disabled={loading} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
