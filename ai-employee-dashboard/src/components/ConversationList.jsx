import { useState, useEffect } from "react";
import api from "../services/api";

export default function ConversationList({
  conversations,
  onSelect,
  companyId,
}) {
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState("");

  // =========================
  // LOAD CHANNELS
  // =========================
  useEffect(() => {
    if (!companyId) return;

    const fetchChannels = async () => {
      try {
        const res = await api.get(
          `/channels?company_id=${companyId}`
        );

        setChannels(res.data || []);
      } catch (err) {
        console.error("Failed to load channels:", err);
      }
    };

    fetchChannels();
  }, [companyId]);

  // =========================
  // HANDLE CHANGE
  // =========================
  const handleChannelChange = (e) => {
    const channelId = e.target.value;
    setSelectedChannel(channelId);

    onSelect(null, channelId);
  };

  return (
    <div
      style={{
        width: "300px",
        borderRight: "1px solid #ddd",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* CHANNEL SELECT */}
      <div style={{ padding: "12px", borderBottom: "1px solid #eee" }}>
        <select
          value={selectedChannel}
          onChange={handleChannelChange}
          style={{ width: "100%" }}
        >
          <option value="">All Channels</option>

          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name}
            </option>
          ))}
        </select>
      </div>

      {/* CONVERSATION LIST */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {conversations.map((conv, index) => (
          <div
            key={conv.id}
            onClick={() => onSelect(conv, selectedChannel)}
            style={{
              padding: "12px",
              cursor: "pointer",
              borderBottom: "1px solid #eee",
            }}
          >
            <div>
              <b>Conversation {index + 1}</b>
            </div>
            <div style={{ fontSize: "12px", color: "#666" }}>
              {conv.last_message?.slice(0, 40)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}