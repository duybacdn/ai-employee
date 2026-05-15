import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import "./CandidateApproval.css";

export default function CandidateApproval() {
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [edited, setEdited] = useState({});

  const [filters, setFilters] = useState({
    company_id: "",
    channel_id: "",
    status: "pending",
  });

  const [companies, setCompanies] = useState([]);
  const [channels, setChannels] = useState([]);

  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [channelLoading, setChannelLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const chatRef = useRef(null);

  useEffect(() => {
    setCompaniesLoading(true);

    api.get("/companies")
      .then((res) => {
        const list = res.data || [];
        setCompanies(list);

        if (list.length) {
          setFilters((prev) => ({
            ...prev,
            company_id: prev.company_id || list[0].id,
            status: "pending",
          }));
        }
      })
      .catch(() => setCompanies([]))
      .finally(() => setCompaniesLoading(false));
  }, []);

  useEffect(() => {
    if (!filters.company_id) {
      setChannels([]);
      setFilters((prev) => ({
        ...prev,
        channel_id: "",
        status: "pending",
      }));
      return;
    }

    setChannelLoading(true);

    api.get(`/channels?company_id=${filters.company_id}`)
      .then((res) => {
        const list = res.data || [];
        setChannels(list);

        setFilters((prev) => ({
          ...prev,
          channel_id: prev.channel_id || list[0]?.id || "",
          status: "pending",
        }));
      })
      .catch(() => setChannels([]))
      .finally(() => setChannelLoading(false));
  }, [filters.company_id]);

  const fetchCandidates = async () => {
    if (!filters.company_id || !filters.channel_id) {
      setCandidates([]);
      setSelected(null);
      return;
    }

    try {
      setListLoading(true);

      const query = new URLSearchParams();

      if (filters.company_id) query.append("company_id", filters.company_id);
      if (filters.channel_id) query.append("channel_id", filters.channel_id);
      if (filters.status) query.append("status", filters.status);

      const res = await api.get(`/candidates?${query.toString()}`);
      const list = Array.isArray(res.data) ? res.data : [];

      setCandidates(list);

      setSelected((prevSelected) => {
        if (prevSelected) {
          const found = list.find((c) => c.id === prevSelected.id);
          return found || list[0] || null;
        }

        return list[0] || null;
      });
    } catch (err) {
      console.error(err);
      setCandidates([]);
      setSelected(null);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [filters]);

  useEffect(() => {
    const ws = new WebSocket("wss://ai-employee-api.onrender.com/ws/global");

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type !== "new_message") return;

      const msg = data.message;

      setCandidates((prev) => {
        const list = [...prev];
        const idx = list.findIndex(
          (c) => c.conversation_id === msg.conversation_id
        );

        if (idx === -1) return prev;

        const item = { ...list[idx] };

        item.messages = [
          ...(item.messages || []),
          {
            id: msg.id,
            text: msg.text,
            direction: msg.direction,
            created_at: msg.created_at,
          },
        ];

        item.message_text = msg.text;
        item.created_at = msg.created_at;
        item.status = "pending";

        list.splice(idx, 1);
        list.unshift(item);

        return list;
      });
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [selected]);

  const handleApprove = async () => {
    if (!selected || actionLoading) return;

    const candidateId = selected.id;
    const finalText = edited[candidateId] ?? selected.draft_text ?? "";

    if (!finalText.trim()) {
      alert("Không được để trống");
      return;
    }

    try {
      setActionLoading("approve");

      await api.post(`/candidates/${candidateId}/approve`, {
        final_text: finalText,
      });

      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId
            ? { ...c, status: "approved", is_sent: true }
            : c
        )
      );

      setSelected((prev) =>
        prev?.id === candidateId
          ? { ...prev, status: "approved", is_sent: true }
          : prev
      );

      await fetchCandidates();
    } catch (err) {
      console.error(err);
      alert("Duyệt thất bại");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!selected || actionLoading) return;

    const candidateId = selected.id;

    try {
      setActionLoading("reject");

      await api.post(`/candidates/${candidateId}/reject`);

      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId
            ? { ...c, status: "rejected" }
            : c
        )
      );

      setSelected((prev) =>
        prev?.id === candidateId
          ? { ...prev, status: "rejected" }
          : prev
      );

      await fetchCandidates();
    } catch (err) {
      console.error(err);
      alert("Từ chối thất bại");
    } finally {
      setActionLoading(null);
    }
  };

  const displayedList = [...candidates].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  const isUnread = (c) => c.status === "pending";

  const getStatusText = (status) => {
    if (status === "pending") return "Chờ duyệt";
    if (status === "approved") return "Đã duyệt";
    if (status === "rejected") return "Đã từ chối";
    return status || "";
  };

  const getPreviewText = (c) => {
    const lastMsg =
      c.messages?.[c.messages.length - 1]?.text || c.message_text || "";

    if (c.kind === "comment") {
      const name = c.customer_name || "Khách";
      const post = (c.post_context || "").replace(/\s+/g, " ").trim();
      return `${name} đã bình luận bài đăng: ${post || lastMsg}`;
    }

    return `${c.customer_name || "Khách"}: "${lastMsg.slice(0, 60)}"`;
  };

  return (
    <div className="ca2-container">
      <div className="ca2-left">
        <div className="ca2-filter">
          <select
            value={filters.company_id}
            disabled={companiesLoading}
            className={companiesLoading ? "loading-filter" : ""}
            onChange={(e) =>
              setFilters({
                ...filters,
                company_id: e.target.value,
                channel_id: "",
                status: "pending",
              })
            }
          >
            <option value="">
              {companiesLoading ? "Đang tải công ty..." : "Công ty"}
            </option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={filters.channel_id}
            disabled={!filters.company_id || channelLoading}
            className={
              !filters.company_id || channelLoading
                ? "disabled-filter loading-filter"
                : ""
            }
            onChange={(e) =>
              setFilters({
                ...filters,
                channel_id: e.target.value,
                status: "pending",
              })
            }
          >
            <option value="">
              {channelLoading ? "Đang tải kênh..." : "Kênh"}
            </option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            disabled={!filters.company_id || !filters.channel_id || listLoading}
            className={
              !filters.company_id || !filters.channel_id || listLoading
                ? "disabled-filter loading-filter"
                : ""
            }
            onChange={(e) =>
              setFilters({
                ...filters,
                status: e.target.value,
              })
            }
          >
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Đã từ chối</option>
            <option value="">Tất cả</option>
          </select>
        </div>

        <div className={`ca2-list ${listLoading ? "loading" : ""}`}>
          {displayedList.map((c) => (
            <div
              key={c.id}
              className={`ca2-item ${selected?.id === c.id ? "active" : ""}`}
              onClick={() => setSelected(c)}
            >
              <div className="avatar">
                {c.kind === "comment" ? "C" : "I"}
              </div>

              <div className="content">
                <div className="top">
                  <div className={`name ${isUnread(c) ? "bold" : ""}`}>
                    {c.kind === "comment" ? "Bình luận" : c.customer_name || "Khách"}
                  </div>

                  <div className="time">
                    {new Date(c.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                <div
                  className={`preview ${
                    c.kind === "comment" ? "comment-preview" : ""
                  } ${isUnread(c) ? "bold" : ""}`}
                >
                  {getPreviewText(c)}
                </div>

                <div className={`ca2-status ${c.status}`}>
                  {getStatusText(c.status)}
                </div>
              </div>

              {isUnread(c) && <div className="dot" />}
            </div>
          ))}

          {!listLoading && displayedList.length === 0 && (
            <div className="empty-list">Không có dữ liệu</div>
          )}
        </div>
      </div>

      <div className="ca2-main">
        {!selected && <div className="empty">Chọn hội thoại</div>}

        {selected && (
          <>
            {selected.kind === "inbox" && (
              <div className="chat-box" ref={chatRef}>
                {(selected.messages || []).map((m) => (
                  <div
                    key={m.id}
                    className={`msg ${
                      m.direction === "outbound" ? "right" : "left"
                    }`}
                  >
                    {m.text}
                  </div>
                ))}
              </div>
            )}

            {selected.kind === "comment" && (
              <div className="comment-box">
                <div className="post">{selected.post_context}</div>
                <div className="comment">{selected.message_text}</div>
              </div>
            )}

            <div className="reply-box">
              <textarea
                value={edited[selected.id] ?? selected.draft_text ?? ""}
                disabled={selected.status !== "pending" || !!actionLoading}
                onChange={(e) =>
                  setEdited({
                    ...edited,
                    [selected.id]: e.target.value,
                  })
                }
              />

              {selected.status === "pending" && (
                <div className="actions">
                  <button
                    onClick={handleApprove}
                    disabled={!!actionLoading}
                    className={actionLoading === "approve" ? "loading" : ""}
                  >
                    {actionLoading === "approve" ? "Đang duyệt..." : "Duyệt"}
                  </button>

                  <button
                    onClick={handleReject}
                    disabled={!!actionLoading}
                    className={actionLoading === "reject" ? "loading" : ""}
                  >
                    {actionLoading === "reject" ? "Đang từ chối..." : "Từ chối"}
                  </button>
                </div>
              )}

              <div className={`status-box ${selected.status}`}>
                {getStatusText(selected.status)} ·{" "}
                {selected.is_sent ? "Đã gửi" : "Chưa gửi"}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
