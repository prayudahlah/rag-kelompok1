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
import type { ActivePage } from "./types/chat";
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

  const [activePage, setActivePage] = useState<ActivePage>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, error]);

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
        collapsed={!sidebarOpen}
      />

      <div className="main">
        <Header
          hasMessages={messages.length > 0}
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
                mengenai dokumen hukum Pelindungan Data Pribadi di Indonesia, mencakup Undang-Undang
                Nomor 27 Tahun 2022 (UU PDP) dan Peraturan Pemerintah Nomor 71 Tahun 2019 (PP PSTE).
              </p>
              <p>
                Aplikasi ini dibangun dengan React, TypeScript, Express, LanceDB, dan terintegrasi
                dengan Gemini API untuk menghasilkan jawaban beserta sitasi pasal.
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
