import { useEffect, useState } from "react";
import { getCompanies, getChannels, getMessages } from "../services/api";
import ConversationList from "../components/ConversationList";
import MessageViewer from "../components/MessageViewer";

export default function Conversations() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);

  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);

  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);

  // =========================
  // LOAD COMPANIES on mount
  // =========================
  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const data = await getCompanies();
      setCompanies(data);

      if (data.length > 0) {
        setSelectedCompany(data[0].id);
      }
    } catch (err) {
      console.error("Error fetching companies:", err);
    }
  };

  // =========================
  // LOAD CHANNELS when company changes
  // =========================
  useEffect(() => {
    if (!selectedCompany) return;

    fetchChannels(selectedCompany);
  }, [selectedCompany]);

  const fetchChannels = async (companyId) => {
    try {
      const data = await getChannels(companyId);
      setChannels(data);

      if (data.length > 0) {
        setSelectedChannel(data[0].id);
      } else {
        setSelectedChannel(null);
        setConversations([]);
        setSelectedConv(null);
      }
    } catch (err) {
      console.error("Error fetching channels:", err);
    }
  };

  // =========================
  // LOAD CONVERSATIONS when channel changes
  // =========================
  useEffect(() => {
    if (!selectedChannel) return;

    fetchConversations(selectedChannel);
  }, [selectedChannel]);

  const fetchConversations = async (channelId) => {
    try {
      const res = await fetch(
        `http://localhost:8000/api/v1/conversations?channel_id=${channelId}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );
      const data = await res.json();

      // 🔥 fetch messages for each conversation
      const fullData = await Promise.all(
        data.map(async (c) => {
          const messages = await getMessages(c.id);
          return messages;
        })
      );

      setConversations(fullData);

      if (fullData.length > 0) {
        setSelectedConv(fullData[0]);
      } else {
        setSelectedConv(null);
      }
    } catch (err) {
      console.error("Error fetching conversations:", err);
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* LEFT PANEL */}
      <div style={{ width: "320px", borderRight: "1px solid #ddd", display: "flex", flexDirection: "column" }}>
        {/* Company select */}
        <select
          value={selectedCompany || ""}
          onChange={(e) => setSelectedCompany(e.target.value)}
          style={{ padding: "8px", margin: "8px" }}
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Channel select */}
        <select
          value={selectedChannel || ""}
          onChange={(e) => setSelectedChannel(e.target.value)}
          style={{ padding: "8px", margin: "8px" }}
        >
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name} {ch.is_active ? "" : "(disabled)"}
            </option>
          ))}
        </select>

        {/* Conversation list */}
        <ConversationList
          conversations={conversations}
          onSelect={setSelectedConv}
        />
      </div>

      {/* RIGHT PANEL */}
      <MessageViewer conversation={selectedConv} />
    </div>
  );
}