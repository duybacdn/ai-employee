import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import "./CandidateApproval.css";
import { formatVNDateTimeFull, formatVNDateTimeSmart } from "../utils/datetime";

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
  const [sendNow, setSendNow] = useState(true);


  const chatRef = useRef(null);
  const shouldStickBottomRef = useRef(true);

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

  const fetchCandidates = async (keepId = null) => {
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
        const targetId = keepId || prevSelected?.id;

        if (!targetId) {
          return list[0] || null;
        }

        const found = list.find((c) => c.id === targetId);

        return found || prevSelected || list[0] || null;
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
    if (!filters.company_id || !filters.channel_id) return;

    const id = setInterval(() => {
      if (!actionLoading) { 
        fetchCandidates(selected?.id);
      }
    }, 5000);

    return () => clearInterval(id);
  }, [filters.company_id, filters.channel_id, filters.status]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
    shouldStickBottomRef.current = true;
  }, [selected]);

  useEffect(() => {
    const el = chatRef.current;
    if (!el || !selected?.messages) return;
    if (!shouldStickBottomRef.current) return;

    el.scrollTop = el.scrollHeight;
  }, [selected?.id, selected?.messages?.length]);

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
        send_now: sendNow,
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

      const prevId = selected.id;

      /* await fetchCandidates(prevId); */
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

      const prevId = selected.id;

      await fetchCandidates(prevId);
    } catch (err) {
      console.error(err);
      alert("Bỏ qua thất bại");
    } finally {
      setActionLoading(null);
    }
  };

  const displayedList = candidates;

  const isUnread = (c) => c.status === "pending";

  const getStatusText = (status) => {
    if (status === "pending") return "Chờ duyệt";
    if (status === "approved") return "Đã duyệt";
    if (status === "rejected") return "Đã bỏ qua";
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

  const handleChatScroll = () => {
    const el = chatRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldStickBottomRef.current = gap < 40;
  };

  const CommentIcon = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M4 5h16v10H8l-4 4V5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const InboxIcon = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M3 12l3-6h12l3 6v7H3v-7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 13h5l2 3h4l2-3h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  useEffect(() => {
    setSendNow(true);
  }, [selected?.id]);



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
            <option value="rejected">Đã bỏ qua</option>
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
              <div className={`avatar ${c.kind === "comment" ? "comment" : "inbox"}`}>
                {c.kind === "comment" ? <CommentIcon /> : <InboxIcon />}
              </div>


              <div className="content">
                <div className="top">
                  <div className={`name ${isUnread(c) ? "bold" : ""}`}>
                    {c.kind === "comment" ? "Bình luận" : c.customer_name || "Khách"}
                  </div>
                    <div className="right-meta">
                      {c.pending_count > 1 && (
                        <span className="pending-badge">{c.pending_count} chờ duyệt</span>
                      )}
                    <div className="time">
                      {formatVNDateTimeSmart(c.created_at)}
                    </div>
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
              <div className="chat-box" ref={chatRef} onScroll={handleChatScroll}>
                {(selected.messages || []).map((m) => (
                  <div
                    key={m.id}
                    className={`msg-row ${m.direction === "outbound" ? "right" : "left"}`}
                  >
                    <div
                      className={`msg ${
                        m.direction === "outbound" ? "right" : "left"
                      }`}
                    >
                      {m.text}
                    </div>
                    <div
                      className={`msg-time ${m.direction === "outbound" ? "right" : "left"}`}
                    >
                      {formatVNDateTimeSmart(m.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selected.kind === "comment" && (
              <div className="comment-box">
                <div className="post-meta">
                  Thời gian bài đăng: {formatVNDateTimeFull(selected.created_at)}
                </div>
                <div className="post">{selected.post_context}</div>
                <div className="comment">{selected.message_text}</div>
                <div className="comment-time">
                  {formatVNDateTimeSmart(selected.created_at)}
                </div>
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
                  <div className="send-toggle">
                  <label className="send-toggle-label">
                    <input
                      type="checkbox"
                      checked={sendNow}
                      onChange={(e) => setSendNow(e.target.checked)}
                      disabled={!!actionLoading}
                    />
                    <span>
                      {selected.kind === "comment"
                        ? "Tự động Gửi bình luận"
                        : "Tự động Gửi tin nhắn"}
                    </span>
                  </label>
                </div>

                  <button
                    onClick={handleApprove}
                    disabled={!!actionLoading}
                    className={`approve-btn ${actionLoading === "approve" ? "loading" : ""}`}
                  >
                    {actionLoading === "approve" ? "Đang duyệt..." : "Duyệt"}
                  </button>

                  <button
                    onClick={handleReject}
                    disabled={!!actionLoading}
                    className={`reject-btn ${actionLoading === "reject" ? "loading" : ""}`}
                  >
                    {actionLoading === "reject" ? "Đang bỏ qua..." : "Bỏ qua"}
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
