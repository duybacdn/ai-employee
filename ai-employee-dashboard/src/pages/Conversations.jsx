// ai-employee-dashboard/src/pages/Conversations.jsx
import { useEffect, useState } from "react";
import {
  getCompanies,
  getChannels,
  getMessages,
  getConversations,
} from "../services/api";
import { useLocation } from "react-router-dom";
import CommentViewer from "../components/CommentViewer";
import MessageViewer from "../components/MessageViewer";
import ConversationList from "../components/ConversationList";

export default function Conversations() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");

  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState("");

  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);

  const [loadingMsg, setLoadingMsg] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMessages, setShowMessages] = useState(false);

  const location = useLocation();
  const [initialParams, setInitialParams] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cid = params.get("cid");
    const mid = params.get("mid");
    const chid = params.get("chid");

    if (cid) {
      setInitialParams({
        conversation_id: cid,
        message_id: mid,
        channel_id: chid,
      });
    }
  }, [location.search]);

  useEffect(() => {
    const resize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    (async () => {
      const data = await getCompanies();
      const list = Array.isArray(data) ? data : [];
      setCompanies(list);
      if (list.length) setSelectedCompany(list[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!selectedCompany) return;

    setSelectedChannel("");
    setSelectedConv(null);
    setConversations([]);

    (async () => {
      const data = await getChannels(selectedCompany);
      const list = Array.isArray(data) ? data : [];
      setChannels(list);

      if (!list.length) return;

      const wanted = initialParams?.channel_id;
      const found = wanted
        ? list.find((ch) => String(ch.id) === String(wanted))
        : null;

      setSelectedChannel(found ? found.id : list[0].id);
    })();
  }, [selectedCompany, initialParams?.channel_id]);

  useEffect(() => {
    if (!selectedCompany) return;

    let interval;

    const loadData = async () => {
      const data = await getConversations(selectedChannel || undefined);
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      setConversations(list);

      if (initialParams?.conversation_id) {
        const found = list.find((c) => c.id === initialParams.conversation_id);
        if (found) {
          await loadMessages(found);
          if (isMobile) setShowMessages(true);
        }
      }
    };

    loadData();
    interval = setInterval(loadData, 5000);

    return () => clearInterval(interval);
  }, [selectedCompany, selectedChannel, initialParams?.conversation_id, isMobile]);

  const loadMessages = async (conv) => {
    setLoadingMsg(true);

    const msgs = await getMessages(conv.id);
    const inbox = msgs.filter((m) => m.kind === "inbox");
    const comments = msgs.filter((m) => m.kind === "comment");

    setSelectedConv({
      ...conv,
      messages: inbox,
      comments,
    });

    if (initialParams?.message_id) {
      setTimeout(() => {
        const el = document.getElementById(`msg-${initialParams.message_id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.style.background = "#fff3cd";
          setTimeout(() => {
            el.style.background = "";
          }, 1500);
        }
      }, 300);
    }

    setLoadingMsg(false);
  };

  const handleSelectConv = (conv) => {
    if (!conv) {
      setSelectedConv(null);
      return;
    }

    loadMessages(conv);
    if (isMobile) setShowMessages(true);
  };

  const handleBack = () => setShowMessages(false);

  return (
    <div style={container}>
      {(!isMobile || !showMessages) && (
        <div style={leftPane}>
          {/* Company + Channel filter theo kiểu Candidate: company ở trên, channel ở dưới */}
          <div style={filterBox}>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              style={select}
            >
              <option value="">Công ty</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={selectedChannel}
              onChange={(e) => {
                setSelectedChannel(e.target.value);
                setSelectedConv(null);
              }}
              disabled={!selectedCompany}
              style={{
                ...select,
                opacity: !selectedCompany ? 0.5 : 1,
                cursor: !selectedCompany ? "not-allowed" : "pointer",
              }}
            >
              <option value="">Kênh</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name}
                </option>
              ))}
            </select>
          </div>

          <ConversationList
            conversations={conversations}
            onSelect={handleSelectConv}
          />
        </div>
      )}

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
            ) : selectedConv?.kind === "comment" ? (
              <CommentViewer conversation={selectedConv} />
            ) : (
              <MessageViewer conversation={selectedConv} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const container = {
  display: "flex",
  height: "100vh",
};

const leftPane = {
  width: 340,
  borderRight: "1px solid #e5e7eb",
  display: "flex",
  flexDirection: "column",
  background: "#fff",
};

const filterBox = {
  padding: 10,
  borderBottom: "1px solid #eee",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const select = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 13,
};

const rightPane = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
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

const mobileHeader = {
  display: "flex",
  gap: 10,
  padding: 10,
  borderBottom: "1px solid #eee",
};
