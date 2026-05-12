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
  const [selectedCompany, setSelectedCompany] = useState(null);

  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);

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
      if (data?.length) {
        if (initialParams?.channel_id) {
          setSelectedChannel(initialParams.channel_id);
        } else {
          setSelectedChannel(data[0].id);
        }
      }
    })();
  }, [selectedCompany]);

  // ================= CONVERSATIONS =================
  useEffect(() => {
    if (!selectedChannel) return;

    let interval;

    const loadData = async () => {
      const data = await getConversations(selectedChannel);
      setConversations((prev) => {
        const map = new Map();

        prev.forEach((c) => map.set(c.id, c));
        (data || []).forEach((c) => map.set(c.id, c));

        return Array.from(map.values()).sort(
          (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
        );
      });

      // 🔥 giữ logic cũ (auto select)
      if (initialParams?.conversation_id) {
        const found = data.find(
          (c) => c.id === initialParams.conversation_id
        );

        if (found) {
          loadMessages(found);
          if (isMobile) setShowMessages(true);
        }
      }
    };

    // 🔥 load lần đầu
    loadData();

    // 🔥 polling mỗi 5s
    interval = setInterval(loadData, 5000);

    return () => clearInterval(interval);

  }, [selectedChannel, initialParams]);

  // ================= LOAD MESSAGES =================
  const loadMessages = async (conv) => {
    setLoadingMsg(true);

    const msgs = await getMessages(conv.id);
    const inbox = msgs.filter(m => m.kind === "inbox");
    const comments = msgs.filter(m => m.kind === "comment");

    const newConv = {
      ...conv,
      messages: inbox,
      comments: comments,
    };

    setSelectedConv(newConv);

    // 🔥 scroll tới message nếu có
    if (initialParams?.message_id) {
      setTimeout(() => {
        const el = document.getElementById(
          `msg-${initialParams.message_id}`
        );

        if (el) {
          el.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });

          // highlight nhẹ
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
    loadMessages(conv);
    if (isMobile) setShowMessages(true);
  };

  const handleBack = () => setShowMessages(false);


  return (
    <div style={container}>
      {/* LEFT */}
      {(!isMobile || !showMessages) && (
        <ConversationList
          conversations={conversations}
          onSelect={handleSelectConv}
          companyId={selectedCompany}
        />
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

/* STYLE */
const container = { display: "flex", height: "100vh" };
const rightPane = { flex: 1, display: "flex", flexDirection: "column" };
const messageBox = { flex: 1, overflowY: "auto", background: "#fafafa" };
const center = { padding: 20, textAlign: "center" };
const mobileHeader = {
  display: "flex",
  gap: 10,
  padding: 10,
  borderBottom: "1px solid #eee",
};