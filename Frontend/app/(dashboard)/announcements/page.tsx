"use client";

import React, { useEffect, useState } from "react";
import {
  Megaphone,
  Pin,
  Plus,
  Calendar,
  AlertTriangle,
  Search,
  Filter,
  Trash2,
  PinOff,
  CheckCircle2,
  Building,
} from "lucide-react";
import { api } from "@/lib/apiClient";
import { Announcement } from "@/types/announcement";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { hasPermission, useAuth } from "@/lib/auth";

export default function AnnouncementsPage() {
  const { user, role, isHR, isAdmin, isEmployee: isEmployeeRole } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Frontend confirmation dialog states
  const [noticeToDelete, setNoticeToDelete] = useState<{ publicId: string; title: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const canCreate = !isEmployeeRole && (hasPermission("announcement:create") || isHR || isAdmin);
  const canDelete = !isEmployeeRole && (hasPermission("announcement:delete") || isHR || isAdmin);

  // New announcement form
  const [newAnn, setNewAnn] = useState({
    title: "",
    content: "",
    priority: "High" as "Low" | "Medium" | "High" | "Urgent",
    target_audience: "All" as "All" | "Engineering" | "Sales" | "Operations" | "Management",
    is_pinned: false,
  });

  useEffect(() => {
    loadAnnouncements();
  }, [role]);

  // Reset page to 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, priorityFilter, audienceFilter]);

  const loadAnnouncements = async () => {
    try {
      const list = await api.announcements.list();
      setAnnouncements(list || []);
    } catch (err: any) {
      console.warn("Failed to load announcements:", err);
      setAnnouncements([]);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const author = user?.display_name
        ? `${user.display_name} (${String(role || "Employee").replace(/_/g, " ")})`
        : "Executive Leadership";

      const created = await api.announcements.create({
        title: newAnn.title.trim(),
        content: newAnn.content.trim(),
        priority: newAnn.priority,
        target_audience: newAnn.target_audience,
        is_pinned: newAnn.is_pinned,
        author_name: author,
      });

      setAnnouncements([created, ...announcements]);
      setIsCreateModalOpen(false);
      setNewAnn({
        title: "",
        content: "",
        priority: "High",
        target_audience: "All",
        is_pinned: false,
      });
    } catch (err: any) {
      console.warn("Create announcement failed:", err);
      alert(err.message || "Failed to publish notice.");
    }
  };

  const handleTogglePin = async (publicId: string) => {
    try {
      const updated = await api.announcements.togglePin(publicId);
      if (updated) {
        setAnnouncements(
          announcements.map((a) => (a.public_id === publicId ? { ...a, is_pinned: updated.is_pinned } : a))
        );
      }
    } catch (err: any) {
      console.warn("Toggle pin failed:", err);
    }
  };

  const handleDeleteClick = (publicId: string, title: string) => {
    setNoticeToDelete({ publicId, title });
  };

  const handleConfirmDelete = async () => {
    if (!noticeToDelete) return;
    setDeleteLoading(true);
    try {
      await api.announcements.delete(noticeToDelete.publicId);
      setAnnouncements(announcements.filter((a) => a.public_id !== noticeToDelete.publicId));
      setFeedback({ type: "success", message: `Notice "${noticeToDelete.title}" was deleted.` });
      setTimeout(() => setFeedback(null), 4000);
      setNoticeToDelete(null);
    } catch (err: any) {
      console.warn("Delete announcement failed:", err);
      setFeedback({ type: "error", message: err.message || "Failed to delete announcement." });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filter & Search
  const filtered = announcements.filter((ann) => {
    const q = search.toLowerCase();
    const matchesSearch =
      ann.title.toLowerCase().includes(q) ||
      ann.content.toLowerCase().includes(q) ||
      ann.author_name.toLowerCase().includes(q);
    const matchesPriority = priorityFilter === "all" || ann.priority === priorityFilter;
    const matchesAudience = audienceFilter === "all" || ann.target_audience === audienceFilter;
    return matchesSearch && matchesPriority && matchesAudience;
  });

  // Sort: pinned notices first, then newest published_at
  const sorted = [...filtered].sort((a, b) => {
    if (a.is_pinned === b.is_pinned) {
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    }
    return a.is_pinned ? -1 : 1;
  });

  const pagedItems = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Company Announcements & Bulletins
          </h1>
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
            Important leadership updates, policy notices, and campus events
          </p>
        </div>

        {canCreate && (
          <button onClick={() => setIsCreateModalOpen(true)} className="btn btn-primary">
            <Plus size={16} /> Broadcast Notice
          </button>
        )}
      </div>

      {/* Filter & Search Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          background: "var(--bg-surface-elevated)",
          padding: 12,
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 260, maxWidth: 450 }}>
          <div style={{ position: "relative", width: "100%" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
            <input
              type="text"
              placeholder="Search announcements by keyword or author..."
              className="input-field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 38 }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* Priority Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>Priority:</span>
            <select
              className="input-field"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{ width: "auto", fontSize: "0.82rem", padding: "6px 10px" }}
            >
              <option value="all">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Audience Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>Audience:</span>
            <select
              className="input-field"
              value={audienceFilter}
              onChange={(e) => setAudienceFilter(e.target.value)}
              style={{ width: "auto", fontSize: "0.82rem", padding: "6px 10px" }}
            >
              <option value="all">All Audiences</option>
              <option value="All">All Organization</option>
              <option value="Engineering">Engineering</option>
              <option value="Sales">Sales</option>
              <option value="Operations">Operations</option>
              <option value="Management">Management</option>
            </select>
          </div>
        </div>
      </div>

      {/* Announcements List */}
      {pagedItems.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
          <Megaphone size={36} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
            No Announcements Found
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 4 }}>
            Try adjusting your search query or priority filters.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {pagedItems.map((ann) => (
            <div
              key={ann.public_id}
              className="card card-interactive"
              style={{
                borderLeft: ann.is_pinned
                  ? "4px solid var(--color-primary-500)"
                  : "1px solid var(--border-subtle)",
                transition: "all var(--transition-fast)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {ann.is_pinned && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "var(--color-primary-400)",
                        background: "rgba(99, 102, 241, 0.15)",
                        padding: "2px 8px",
                        borderRadius: 4,
                      }}
                    >
                      <Pin size={11} /> PINNED NOTICE
                    </span>
                  )}
                  <StatusBadge status={ann.priority} />
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    Audience: <strong style={{ color: "var(--text-primary)" }}>{ann.target_audience}</strong>
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    {new Date(ann.published_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>

                  {/* Actions for Admin / HR */}
                  {(canCreate || canDelete) && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {canCreate && (
                        <button
                          type="button"
                          onClick={() => handleTogglePin(ann.public_id)}
                          className="btn btn-ghost btn-sm"
                          style={{
                            padding: "4px 8px",
                            color: ann.is_pinned ? "var(--color-primary-400)" : "var(--text-muted)",
                          }}
                          title={ann.is_pinned ? "Unpin notice" : "Pin notice to top"}
                        >
                          {ann.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(ann.public_id, ann.title)}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: "4px 8px", color: "var(--color-rose-400)" }}
                          title="Delete notice"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                {ann.title}
              </h2>

              <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
                {ann.content}
              </p>

              <div
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text-muted)",
                  borderTop: "1px solid var(--border-subtle)",
                  paddingTop: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>
                  Published by: <strong style={{ color: "var(--text-primary)" }}>{ann.author_name}</strong>
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>
                  {ann.public_id}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      <Pagination
        currentPage={currentPage}
        totalItems={sorted.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />

      {/* Broadcast Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Broadcast Announcement"
        size="md"
      >
        <form onSubmit={handleCreateSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Headline Title *</label>
            <input
              type="text"
              required
              className="input-field"
              placeholder="e.g. Scheduled Maintenance or Quarterly All-Hands"
              value={newAnn.title}
              onChange={(e) => setNewAnn({ ...newAnn, title: e.target.value })}
            />
          </div>

          <div className="grid-cols-2" style={{ gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Priority Level</label>
              <select
                className="input-field"
                value={newAnn.priority}
                onChange={(e) => setNewAnn({ ...newAnn, priority: e.target.value as any })}
              >
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Target Audience</label>
              <select
                className="input-field"
                value={newAnn.target_audience}
                onChange={(e) => setNewAnn({ ...newAnn, target_audience: e.target.value as any })}
              >
                <option value="All">All Organization</option>
                <option value="Engineering">Engineering Only</option>
                <option value="Sales">Sales Only</option>
                <option value="Operations">Operations</option>
                <option value="Management">Management</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Detailed Notice Content *</label>
            <textarea
              required
              rows={4}
              className="input-field"
              placeholder="Write the full announcement body..."
              value={newAnn.content}
              onChange={(e) => setNewAnn({ ...newAnn, content: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              id="is_pinned_checkbox"
              checked={newAnn.is_pinned}
              onChange={(e) => setNewAnn({ ...newAnn, is_pinned: e.target.checked })}
              style={{ cursor: "pointer" }}
            />
            <label htmlFor="is_pinned_checkbox" className="form-label" style={{ margin: 0, cursor: "pointer" }}>
              Pin this notice at the top of the announcement board
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
            <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Megaphone size={16} /> Broadcast Now
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Custom Frontend Confirm Modal: Delete Notice ── */}
      <ConfirmModal
        isOpen={!!noticeToDelete}
        onClose={() => setNoticeToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Announcement"
        message={
          noticeToDelete ? (
            <span>
              Are you sure you want to delete the notice <strong style={{ color: "var(--text-primary)" }}>&quot;{noticeToDelete.title}&quot;</strong>? This notice will be permanently removed from all employee feeds.
            </span>
          ) : ""
        }
        confirmText="Delete Notice"
        cancelText="Cancel"
        variant="danger"
        icon="trash"
        isLoading={deleteLoading}
      />
    </div>
  );
}
