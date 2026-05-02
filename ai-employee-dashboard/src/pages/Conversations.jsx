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
  const [loadingMsg, setLoadingMsg] = useState(false);

  // mobile
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
    const fetch = async () => {
      try {
        const data = await getCompanies();
        const safe = Array.isArray(data) ? data : [];

        setCompanies(safe);
        if (safe.length > 0) setSelectedCompany(safe[0].id);
      } catch (err) {
        console.error(err);
      }
    };
    fetch();
  }, []);

  // ================= CHANNELS =================
  useEffect(() => {
    if (!selectedCompany) return;

    const fetch = async () => {
      try {
        const data = await getChannels(selectedCompany);
        const safe = Array.isArray(data) ? data : [];

        setChannels(safe);

        if (safe.length > 0) {
          setSelectedChannel(safe[0].id);
        } else {
          setSelectedChannel(null);
          setConversations([]);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetch();
  }, [selectedCompany]);

  // ================= CONVERSATIONS =================
  useEffect(() => {
    if (!selectedChannel) return;

    const fetch = async () => {
      setLoading(true);
      try {
        const data = await getConversations(selectedChannel);
        const safe = Array.isArray(data) ? data : [];

        setConversations(safe);
        setSelectedConv(null); // reset
      } catch (err) {
        console.error(err);
        setConversations([]);
      }
      setLoading(false);
    };

    fetch();
  }, [selectedChannel]);

  // ================= LOAD MESSAGES (LAZY) =================
  const loadMessages = async (conv) => {
    if (!conv) return;

    setLoadingMsg(true);

    try {
      const msgs = await getMessages(conv.id);

      setSelectedConv({
        ...conv,
        messages: Array.isArray(msgs) ? msgs : [],
      });
    } catch (err) {
      console.error(err);
      setSelectedConv({ ...conv, messages: [] });
    }

    setLoadingMsg(false);
  };

  // ================= CLICK =================
  const handleSelectConv = (conv) => {
    loadMessages(conv);

    if (isMobile) {
      setShowMessages(true);
    }
  };

  const handleBack = () => {
    setShowMessages(false);
  };

  // ================= UI =================
  return (
    <div style={container}>
      {/* ===== LEFT: LIST ===== */}
      {(!isMobile || !showMessages) && (
        <div style={leftPane}>
          {/* FILTER */}
          <div style={filterBox}>
            <select
              style={select}
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
              style={select}
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
          <div style={listBox}>
            {loading ? (
              <div style={center}>Loading...</div>
            ) : (
              <ConversationList
                conversations={conversations}
                onSelect={handleSelectConv}
              />
            )}
          </div>
        </div>
      )}

      {/* ===== RIGHT: CHAT ===== */}
      {(!isMobile || showMessages) && (
        <div style={rightPane}>
          {/* MOBILE HEADER */}
          {isMobile && (
            <div style={mobileHeader}>
              <div onClick={handleBack} style={backBtn}>
                ←
              </div>
              <div style={{ fontWeight: "bold" }}>
                {selectedConv?.customer_name || "Chat"}
              </div>
            </div>
          )}

          {/* MESSAGE */}
          <div style={messageBox}>
            {loadingMsg ? (
              <div style={center}>Loading messages...</div>
            ) : (
              <MessageViewer conversation={selectedConv} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= STYLE ================= */

const container = {
  display: "flex",
  height: "100vh",
  overflow: "hidden",
};

const leftPane = {
  width: 320,
  borderRight: "1px solid #eee",
  display: "flex",
  flexDirection: "column",
};

const rightPane = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
};

const filterBox = {
  padding: 10,
  borderBottom: "1px solid #eee",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const select = {
  padding: 8,
  borderRadius: 6,
  border: "1px solid #ddd",
};

const listBox = {
  flex: 1,
  overflowY: "auto",
};

const messageBox = {
  flex: 1,
  overflowY: "auto",
  background: "#fafafa",
};

const center = {
  padding: 20,
  textAlign: "center",
};

/* ===== MOBILE ===== */

const mobileHeader = {
  display: "flex",
  alignItems: "center",
  padding: 10,
  borderBottom: "1px solid #eee",
  gap: 10,
};

const backBtn = {
  fontSize: 20,
  cursor: "pointer",
};