// ai-employee-dashboard/src/pages/Conversations.jsx
import { useEffect, useState, useRef } from "react";
import {
  getCompanies,
  getChannels,
  getMessages,
  getConversations,
} from "../services/api";
import api from "../services/api";
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
  const handleBack = () => setShowMessages(false);
  const [highlightMessageId, setHighlightMessageId] = useState(null);
  const hasUsedDeepLinkRef = useRef(false);

  const PAGE_SIZE = 20;

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // ================= URL PARAMS =================
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cid = params.get("cid");
    const mid = params.get("mid");
    const chid = params.get("chid");

    console.log("URL PARAMS:", {
      cid,
      mid,
      chid,
    });

    if (cid) {
      setInitialParams({
        conversation_id: cid,
        message_id: mid,
        channel_id: chid,
      });
    }
  }, [location.search]);

  // ================= RESPONSIVE =================
  useEffect(() => {
    const resize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ================= LOAD COMPANIES =================
  useEffect(() => {
    (async () => {
      const data = await getCompanies();
      const list = Array.isArray(data) ? data : [];

      const activeCompanies = list.filter(
        (c) => c.status === "active"
      );

      setCompanies(activeCompanies);

      if (list.length) {
        setSelectedCompany(list[0].id);
      }
    })();
  }, []);

  // ================= LOAD CHANNELS BY COMPANY =================
  useEffect(() => {
    if (!selectedCompany) return;

    // reset state when company changes
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

  // ================= POLLING CONVERSATIONS =================

  const hasInitFromUrlRef = useRef(false);

  useEffect(() => {
    if (!selectedCompany || page !== 0) return;

    let interval;

    const loadData = async () => {
      const res = await getConversations(
        selectedChannel || undefined,
        PAGE_SIZE,
        page * PAGE_SIZE
      );

      console.log("🔥 conversations:", res);

      const list = res?.items || [];
      const total = res?.total || 0;

      list.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

      setConversations((prev) => {
        const prevMap = new Map(prev.map(c => [c.id, c]));

        const merged = list.map((c) => {
          const old = prevMap.get(c.id);

          return {
            ...c,
            is_unread:
              old && old.is_unread === false
                ? false
                : c.is_unread,
          };
        });

        return page === 0 ? merged : [...prev, ...merged];
      });

      setHasMore((page + 1) * PAGE_SIZE < total);
    };

    loadData();
    interval = setInterval(loadData, 5000);

    return () => clearInterval(interval);
  }, [selectedCompany, selectedChannel, page, initialParams?.conversation_id, isMobile]);

  // ================= LOAD MESSAGES OF A CONVERSATION =================
  const loadMessages = async (conv) => {
    if (!conv) return;

    setLoadingMsg(true);

    try {
      // ✅ CHỈ MARK READ Ở ĐÂY
      await api.post(`/conversations/${conv.id}/mark-read`);

      // ✅ update UI ngay
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conv.id ? { ...c, is_unread: false } : c
        )
      );

      const msgs = await getMessages(conv.id);

      const inbox = msgs.filter((m) => m.kind === "inbox");
      const comments = msgs.filter((m) => m.kind === "comment");

      const newConv = {
        ...conv,
        messages: inbox,
        comments,
        is_unread: false,
      };

      setSelectedConv(newConv);

      // highlight
      setHighlightMessageId(null);

      // 🔥 chỉ dùng deep link 1 lần
      if (
        initialParams?.message_id &&
        !hasUsedDeepLinkRef.current
      ) {
        setHighlightMessageId(initialParams.message_id);
        hasUsedDeepLinkRef.current = true;
      } else {
        setHighlightMessageId(conv.last_message_id || null);
      }

    } catch (err) {
      console.error("loadMessages failed:", err);
    } finally {
      setLoadingMsg(false);
    }
  };

  const handleSelectConv = (conv) => {
    if (!conv) {
      setSelectedConv(null);
      setHighlightMessageId(null);
      return;
    }
    // 🔥 TẮT deep link mode
    hasUsedDeepLinkRef.current = true;
    window.history.replaceState({}, "", "/conversations");

    setHighlightMessageId(null);

    // ❗ KHÔNG mark read ở đây nữa
    loadMessages(conv);

    if (isMobile) setShowMessages(true);
  };

  return (
    <div style={container}>
      {/* LEFT */}
      {(!isMobile || !showMessages) && (
        <div style={leftPane}>
          {/* FILTER BOX: company trên, channel dưới */}
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

                setPage(0);
                setHasMore(true);
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
            key={selectedChannel}
            conversations={conversations}
            onSelect={handleSelectConv}
            onMarkRead={(id) => {
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === id ? { ...c, is_unread: false } : c
                )
              );
            }}
          />
          {hasMore && (
            <div style={{ padding: 10, textAlign: "center" }}>
              <button
                disabled={loadingMore}
                onClick={() => {
                  setLoadingMore(true);
                  setPage(prev => prev + 1);
                  setTimeout(() => setLoadingMore(false), 300);
                }}
              >
                {loadingMore ? "Đang tải..." : "Tải thêm"}
              </button>
            </div>
          )}
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
            {loadingMsg || !selectedConv ? (
              <div style={center}>Loading...</div>
            ) : selectedConv.kind === "comment" ? (
              <CommentViewer
                conversation={selectedConv}
                highlightMessageId={highlightMessageId}
              />
            ) : (
              <MessageViewer
                conversation={selectedConv}
                highlightMessageId={highlightMessageId}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* STYLE */
const container = { display: "flex", height: "100vh" };

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

const rightPane = { flex: 1, display: "flex", flexDirection: "column" };
const messageBox = { flex: 1, overflowY: "auto", background: "#fafafa" };
const center = { padding: 20, textAlign: "center" };
const mobileHeader = {
  display: "flex",
  gap: 10,
  padding: 10,
  borderBottom: "1px solid #eee",
};
