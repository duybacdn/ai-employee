import { useEffect, useState, useRef } from "react";
import api from "../services/api";
import "./CandidateApproval.css";

export default function CandidateApproval() {
  const [candidates, setCandidates] = useState([]);
  const [grouped, setGrouped] = useState([]);
  const [selected, setSelected] = useState(null);
  const [edited, setEdited] = useState({});
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    company_id: "",
    channel_id: "",
    status: "pending",
  });

  const [companies, setCompanies] = useState([]);
  const [channels, setChannels] = useState([]);

  const bottomRef = useRef(null);

  // ================= LOAD =================
  useEffect(() => {
    api.get("/companies").then(res => setCompanies(res.data || []));
  }, []);

  useEffect(() => {
    if (!filters.company_id) return;
    api.get(`/channels?company_id=${filters.company_id}`)
      .then(res => setChannels(res.data || []));
  }, [filters.company_id]);

  // ================= GROUP =================
  const groupByConversation = (list) => {
    const map = new Map();

    list.forEach((c) => {
      const key = c.conversation_id;

      if (!map.has(key)) {
        map.set(key, {
          ...c,
          items: [c],
          last_message: c.message_text,
          updated_at: c.created_at,
          unread: c.status === "pending",
        });
      } else {
        const g = map.get(key);

        g.items.push(c);

        if (new Date(c.created_at) > new Date(g.updated_at)) {
          g.last_message = c.message_text;
          g.updated_at = c.created_at;
        }

        if (c.status === "pending") {
          g.unread = true;
        }
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
    );
  };

  // ================= FETCH =================
  const fetchCandidates = async () => {
    setLoading(true);

    try {
      const query = new URLSearchParams();

      if (filters.status) query.append("status", filters.status);
      if (filters.channel_id) query.append("channel_id", filters.channel_id);
      if (filters.company_id) query.append("company_id", filters.company_id);

      const res = await api.get(`/candidates?${query.toString()}`);
      const list = res.data || [];

      setCandidates(list);

      const groupedData = groupByConversation(list);
      setGrouped(groupedData);

      if (!selected && groupedData.length) {
        setSelected(groupedData[0]);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [filters]);

  // ================= SCROLL =================
  useEffect(() => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [selected]);

  // ================= ACTION =================
  const handleApprove = async () => {
    if (!selected) return;

    const item = selected.items.find(i => i.status === "pending");
    if (!item) return;

    const finalText = edited[selected.conversation_id] || item.draft_text || "";

    if (!finalText.trim()) {
      alert("Không được rỗng");
      return;
    }

    await api.post(`/candidates/${item.id}/approve`, {
      final_text: finalText,
    });

    fetchCandidates();
  };

  const handleReject = async () => {
    if (!selected) return;

    const item = selected.items.find(i => i.status === "pending");
    if (!item) return;

    await api.post(`/candidates/${item.id}/reject`);
    fetchCandidates();
  };

  // ================= RENDER =================
  return (
    <div className="ca-container">

      {/* LEFT */}
      <div className="ca-left">

        {/* FILTER */}
        <div className="ca-filter">
          <select
            value={filters.company_id}
            onChange={(e) =>
              setFilters({
                ...filters,
                company_id: e.target.value,
                channel_id: "",
              })
            }
          >
            <option value="">Công ty</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={filters.channel_id}
            onChange={(e) =>
              setFilters({ ...filters, channel_id: e.target.value })
            }
          >
            <option value="">Kênh</option>
            {channels.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) =>
              setFilters({ ...filters, status: e.target.value })
            }
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
          </select>
        </div>

        {/* LIST */}
        <div className="ca-list">
          {grouped.map((g) => (
            <div
              key={g.conversation_id}
              className={`ca-item ${selected?.conversation_id === g.conversation_id ? "active" : ""}`}
              onClick={() => setSelected(g)}
            >
              <div className="avatar">
                {g.kind === "comment" ? "📝" : "👤"}
              </div>

              <div className="content">
                <div className="top">
                  <div className={`name ${g.unread ? "bold" : ""}`}>
                    {g.customer_name}
                  </div>
                  <div className="time">
                    {new Date(g.updated_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                <div className={`preview ${g.unread ? "bold" : ""}`}>
                  {g.last_message}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CENTER */}
      <div className="ca-center">

        {!selected && <div className="empty">Chọn hội thoại</div>}

        {selected && (
          <>
            <div className="chat-box">
              {selected.messages?.map((m) => (
                <div
                  key={m.id}
                  className={m.direction === "outbound" ? "msg right" : "msg left"}
                >
                  {m.text}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {selected.kind === "comment" && (
              <div className="post-box">
                <b>📌 Bài viết</b>
                <div>{selected.post_context}</div>
              </div>
            )}

            <div className="editor">
              <textarea
                value={edited[selected.conversation_id] || ""}
                onChange={(e) =>
                  setEdited({
                    ...edited,
                    [selected.conversation_id]: e.target.value,
                  })
                }
              />

              <div className="actions">
                <button onClick={handleApprove}>Duyệt</button>
                <button onClick={handleReject}>Từ chối</button>
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
}