import { useEffect, useState } from "react";
import {
  getCompanies,
  getChannels,
  getMessages,
  getConversations,
} from "../services/api";

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
      const data = await getConversations(selectedChannel);
      setConversations(data || []);
      setSelectedConv(null);
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