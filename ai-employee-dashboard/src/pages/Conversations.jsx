import { useEffect, useState } from "react";
import {
  getCompanies,
  getChannels,
  getMessages,
  getConversations,
} from "../services/api";

import MessageViewer from "../components/MessageViewer";

export default function Conversations() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);

  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);

  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMessages, setShowMessages] = useState(false);

  // ================= RESPONSIVE =================
  useEffect(() => {
    const resize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ================= COMPANIES =================
  useEffect(() => {
    (async () => {
      const data = await getCompanies();
      setCompanies(data || []);
      if (data?.length) setSelectedCompany(data[0].id);
    })();
  }, []);

  // ================= CHANNELS =================
  useEffect(() => {
    if (!selectedCompany) return;

    (async () => {
      const data = await getChannels(selectedCompany);
      setChannels(data || []);
      if (data?.length) setSelectedChannel(data[0].id);
    })();
  }, [selectedCompany]);

  // ================= CONVERSATIONS =================
  useEffect(() => {
    if (!selectedChannel) return;

    (async () => {
      setLoading(true);
      const data = await getConversations(selectedChannel);
      setConversations(data || []);
      setSelectedConv(null);
      setLoading(false);
    })();
  }, [selectedChannel]);

  // ================= LOAD MESSAGES =================
  const loadMessages = async (conv) => {
    setLoadingMsg(true);

    const msgs = await getMessages(conv.id);

    setSelectedConv({
      ...conv,
      messages: msgs || [],
    });

    setLoadingMsg(false);
  };

  const handleSelectConv = (conv) => {
    loadMessages(conv);
    if (isMobile) setShowMessages(true);
  };

  const handleBack = () => setShowMessages(false);

  // ================= RENDER ITEM =================
  const renderConversation = (c) => {
    const isComment = c.kind === "comment";

    return (
      <div
        key={c.id}
        onClick={() => handleSelectConv(c)}
        style={{
          padding: 10,
          borderBottom: "1px solid #eee",
          cursor: "pointer",
        }}
      >
        {/* TITLE */}
        <div style={{ fontWeight: "bold" }}>
          {isComment
            ? "📝 Bài viết"
            : c.customer_name || "Khách"}
        </div>

        {/* MESSAGE */}
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {c.last_message}
        </div>
      </div>
    );
  };

  // ================= UI =================
  return (
    <div style={container}>
      {/* LEFT */}
      {(!isMobile || !showMessages) && (
        <div style={leftPane}>
          <div style={filterBox}>
            <select
              value={selectedCompany || ""}
              onChange={(e) => setSelectedCompany(e.target.value)}
              style={select}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={selectedChannel || ""}
              onChange={(e) => setSelectedChannel(e.target.value)}
              style={select}
            >
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div style={listBox}>
            {loading ? (
              <div style={center}>Loading...</div>
            ) : (
              conversations.map(renderConversation)
            )}
          </div>
        </div>
      )}

      {/* RIGHT */}
      {(!isMobile || showMessages) && (
        <div style={rightPane}>
          {isMobile && (
            <div style={mobileHeader}>
              <div onClick={handleBack}>←</div>
              <b>{selectedConv?.customer_name || "Chat"}</b>
            </div>
          )}

          <div style={messageBox}>
            {loadingMsg ? (
              <div style={center}>Loading...</div>
            ) : (
              <MessageViewer conversation={selectedConv} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* STYLE giữ nguyên */
const container = { display: "flex", height: "100vh" };
const leftPane = { width: 320, borderRight: "1px solid #eee", display: "flex", flexDirection: "column" };
const rightPane = { flex: 1, display: "flex", flexDirection: "column" };
const filterBox = { padding: 10, borderBottom: "1px solid #eee", display: "flex", flexDirection: "column", gap: 6 };
const select = { padding: 8, borderRadius: 6, border: "1px solid #ddd" };
const listBox = { flex: 1, overflowY: "auto" };
const messageBox = { flex: 1, overflowY: "auto", background: "#fafafa" };
const center = { padding: 20, textAlign: "center" };
const mobileHeader = { display: "flex", gap: 10, padding: 10, borderBottom: "1px solid #eee" };