import { useEffect, useState } from "react";
import {
  getCompanies,
  getChannels,
  getMessages,
  getConversations,
} from "../services/api";

import ConversationList from "../components/ConversationList";
import MessageViewer from "../components/MessageViewer";

export default function Conversations() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);

  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);

  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);

  const [loading, setLoading] = useState(false);

  // mobile state
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMessages, setShowMessages] = useState(false);

  // =========================
  // RESPONSIVE
  // =========================
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // =========================
  // LOAD COMPANIES
  // =========================
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const data = await getCompanies();
        const safeData = Array.isArray(data) ? data : [];

        setCompanies(safeData);
        if (safeData.length > 0) {
          setSelectedCompany(safeData[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchCompanies();
  }, []);

  // =========================
  // LOAD CHANNELS
  // =========================
  useEffect(() => {
    if (!selectedCompany) return;

    const fetchChannels = async () => {
      try {
        const data = await getChannels(selectedCompany);
        const safeData = Array.isArray(data) ? data : [];

        setChannels(safeData);

        if (safeData.length > 0) {
          setSelectedChannel(safeData[0].id);
        } else {
          setSelectedChannel(null);
          setConversations([]);
          setSelectedConv(null);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchChannels();
  }, [selectedCompany]);

  // =========================
  // LOAD CONVERSATIONS
  // =========================
  useEffect(() => {
    if (!selectedChannel) return;

    const fetchConversations = async () => {
      setLoading(true);

      try {
        const data = await getConversations(selectedChannel);

        // 🔥 FIX crash: đảm bảo luôn là array
        const safeList = Array.isArray(data) ? data : [];

        // 👉 vì API của bạn trả về chỉ id (chưa có messages)
        const fullData = await Promise.all(
          safeList.map(async (c) => {
            try {
              const messages = await getMessages(c.id);

              return {
                ...c,
                messages: Array.isArray(messages) ? messages : [],
              };
            } catch (err) {
              console.error("load messages fail:", err);
              return { ...c, messages: [] };
            }
          })
        );

        setConversations(fullData);

        if (fullData.length > 0) {
          setSelectedConv(fullData[0]);
        } else {
          setSelectedConv(null);
        }
      } catch (err) {
        console.error(err);
        setConversations([]);
      }

      setLoading(false);
    };

    fetchConversations();
  }, [selectedChannel]);

  // =========================
  // SELECT CONVERSATION
  // =========================
  const handleSelectConv = (conv) => {
    setSelectedConv(conv);

    if (isMobile) {
      setShowMessages(true);
    }
  };

  const handleBack = () => {
    setShowMessages(false);
  };

  // =========================
  // UI
  // =========================
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        flexDirection: isMobile ? "column" : "row",
      }}
    >
      {/* LEFT (LIST) */}
      {(!isMobile || !showMessages) && (
        <div
          style={{
            width: isMobile ? "100%" : 320,
            borderRight: isMobile ? "none" : "1px solid #ddd",
            borderBottom: isMobile ? "1px solid #ddd" : "none",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* FILTER */}
          <div style={{ padding: 10 }}>
            <select
              style={{ width: "100%", marginBottom: 8 }}
              value={selectedCompany || ""}
              onChange={(e) => setSelectedCompany(e.target.value)}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              style={{ width: "100%" }}
              value={selectedChannel || ""}
              onChange={(e) => setSelectedChannel(e.target.value)}
            >
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name}
                </option>
              ))}
            </select>
          </div>

          {/* LIST */}
          <div style={{ flex: 1, overflow: "auto" }}>
            {loading ? (
              <div style={{ padding: 16 }}>Loading...</div>
            ) : (
              <ConversationList
                conversations={conversations}
                onSelect={handleSelectConv}
              />
            )}
          </div>
        </div>
      )}

      {/* RIGHT (MESSAGES) */}
      {(!isMobile || showMessages) && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* MOBILE BACK */}
          {isMobile && (
            <div
              style={{
                padding: 10,
                borderBottom: "1px solid #ddd",
                cursor: "pointer",
              }}
              onClick={handleBack}
            >
              ← Quay lại
            </div>
          )}

          <MessageViewer conversation={selectedConv} />
        </div>
      )}
    </div>
  );
}