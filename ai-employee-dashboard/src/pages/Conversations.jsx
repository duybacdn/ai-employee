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
  const res = await api.get(
    `/conversations?channel_id=${channelId}`
  );
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);

  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);

  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);

  // =========================
  // LOAD COMPANIES
  // =========================
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const data = await getCompanies();
        setCompanies(data);

        if (data.length > 0) {
          setSelectedCompany(data[0].id);
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
        setChannels(data);

        if (data.length > 0) {
          setSelectedChannel(data[0].id);
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
      try {
        const data = await getConversations(selectedChannel);

        // ⚠️ vẫn giữ messages load nhưng sẽ tối ưu sau
        const fullData = await Promise.all(
          data.map(async (c) => {
            const messages = await getMessages(c.id);
            return {
              ...c,
              messages,
            };
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
      }
    };

    fetchConversations();
  }, [selectedChannel]);

  // =========================
  // UI (GIỮ NGUYÊN)
  // =========================
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* LEFT */}
      <div style={{ width: 320, borderRight: "1px solid #ddd" }}>
        <select
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
          value={selectedChannel || ""}
          onChange={(e) => setSelectedChannel(e.target.value)}
        >
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name}
            </option>
          ))}
        </select>

        <ConversationList
          conversations={conversations}
          onSelect={setSelectedConv}
        />
      </div>

      {/* RIGHT */}
      <MessageViewer conversation={selectedConv} />
    </div>
  );
}