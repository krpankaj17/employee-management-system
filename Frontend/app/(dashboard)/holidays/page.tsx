"use client";

import React, { useEffect, useState } from "react";
import { CalendarCheck2, Calendar, Sparkles, Search, Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "@/lib/apiClient";
import { Holiday } from "@/types/holiday";
import { StatusBadge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useAuth, hasPermission } from "@/lib/auth";

export default function HolidaysPage() {
  const { role, isHR, isAdmin, isEmployee: isEmployeeRole } = useAuth();
  const canManageHolidays = !isEmployeeRole && (isAdmin || isHR || hasPermission("attendance:update"));

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // Add Holiday Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [newHoliday, setNewHoliday] = useState({
    name: "",
    date: new Date().toISOString().split("T")[0],
    holiday_type: "National" as "National" | "Gazetted" | "Optional",
    region: "National",
    description: "",
  });

  // Delete Holiday State
  const [holidayToDelete, setHolidayToDelete] = useState<{ publicId: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadHolidays = async () => {
    try {
      const list = await api.holidays.list();
      setHolidays(list || []);
    } catch (err) {
      console.warn("Failed to load holidays:", err);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterType]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHoliday.name.trim()) {
      setFormError("Please enter the holiday name.");
      return;
    }
    setAddLoading(true);
    setFormError(null);
    try {
      const dt = new Date(newHoliday.date);
      const dayOfWeek = isNaN(dt.getTime())
        ? "Monday"
        : dt.toLocaleDateString("en-US", { weekday: "long" });

      await api.holidays.create({
        name: newHoliday.name.trim(),
        date: newHoliday.date,
        day_of_week: dayOfWeek,
        holiday_type: newHoliday.holiday_type,
        region: newHoliday.region,
        description: newHoliday.description.trim() || undefined,
      });

      await loadHolidays();
      setIsAddModalOpen(false);
      setNewHoliday({
        name: "",
        date: new Date().toISOString().split("T")[0],
        holiday_type: "National",
        region: "National",
        description: "",
      });
      setFeedback({ type: "success", message: `Holiday "${newHoliday.name}" scheduled successfully.` });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFormError(err.message || "Failed to create holiday entry.");
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!holidayToDelete) return;
    setDeleteLoading(true);
    try {
      await api.holidays.delete(holidayToDelete.publicId);
      await loadHolidays();
      setHolidayToDelete(null);
      setFeedback({ type: "success", message: `Holiday "${holidayToDelete.name}" deleted successfully.` });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to delete holiday entry." });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredHolidays = holidays.filter((h) => {
    const matchesType = filterType === "all" || h.holiday_type === filterType;
    const q = search.toLowerCase();
    const matchesSearch =
      h.name.toLowerCase().includes(q) ||
      (h.day_of_week || "").toLowerCase().includes(q) ||
      (h.description || "").toLowerCase().includes(q);
    return matchesType && matchesSearch;
  });

  // Dynamic upcoming holiday calculation from live backend list
  const nowTime = new Date().setHours(0, 0, 0, 0);
  const futureHolidays = holidays
    .filter((h) => {
      const d = new Date(h.date).getTime();
      return !isNaN(d) && d >= nowTime;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const upcomingHoliday = futureHolidays[0] || holidays[0] || null;
  const daysToGo = upcomingHoliday
    ? Math.max(0, Math.ceil((new Date(upcomingHoliday.date).getTime() - nowTime) / (1000 * 60 * 60 * 24)))
    : 0;

  const pagedHolidays = filteredHolidays.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Company Holiday Calendar
          </h1>
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
            Official declared national and gazetted festive non-working days
          </p>
        </div>

        {canManageHolidays && (
          <button onClick={() => setIsAddModalOpen(true)} className="btn btn-primary">
            <Plus size={16} /> Add Holiday
          </button>
        )}
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "var(--radius-md)",
            background:
              feedback.type === "success"
                ? "rgba(16, 185, 129, 0.15)"
                : "rgba(239, 68, 68, 0.15)",
            border: `1px solid ${
              feedback.type === "success"
                ? "rgba(16, 185, 129, 0.3)"
                : "rgba(239, 68, 68, 0.3)"
            }`,
            color:
              feedback.type === "success"
                ? "var(--color-emerald-400)"
                : "var(--color-rose-400)",
            fontSize: "0.88rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Upcoming Spotlight Card */}
      {upcomingHoliday && (
        <div
          className="card"
          style={{
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(34, 211, 238, 0.08))",
            border: "1px solid var(--border-strong)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 20,
          }}
        >
          <div>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--color-primary-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Next Upcoming Holiday
            </span>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>
              {upcomingHoliday.name}
            </h2>
            <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginTop: 2 }}>
              {upcomingHoliday.day_of_week}, {new Date(upcomingHoliday.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} • {upcomingHoliday.holiday_type} Holiday
            </p>
          </div>

          <div style={{ padding: "8px 16px", borderRadius: "var(--radius-md)", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Countdown</span>
            <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--color-cyan-400)" }}>
              {daysToGo === 0 ? "Today!" : `${daysToGo} Day${daysToGo === 1 ? "" : "s"} to Go`}
            </span>
          </div>
        </div>
      )}

      {/* Holidays Table */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
            Annual Schedule ({filteredHolidays.length} Official Holidays)
          </h3>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", width: 220 }}>
              <Search
                size={14}
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
              />
              <input
                type="text"
                placeholder="Search holiday..."
                className="input-field"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 32, fontSize: "0.82rem", padding: "6px 10px 6px 32px" }}
              />
            </div>

            <select
              className="input-field"
              style={{ width: 170, fontSize: "0.82rem", padding: "6px 10px" }}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All Holiday Types</option>
              <option value="National">National Holidays</option>
              <option value="Gazetted">Gazetted Holidays</option>
              <option value="Optional">Optional Holidays</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Holiday Name</th>
                <th>Calendar Date</th>
                <th>Day of Week</th>
                <th>Category</th>
                <th>Description</th>
                {canManageHolidays && <th style={{ textAlign: "right" }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {pagedHolidays.length === 0 ? (
                <tr>
                  <td colSpan={canManageHolidays ? 6 : 5} style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>
                    No holidays match your filter or search query.
                  </td>
                </tr>
              ) : (
                pagedHolidays.map((h) => (
                  <tr key={h.public_id || h.holiday_id}>
                    <td style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                      {h.name}
                    </td>
                    <td>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--color-primary-400)" }}>
                        {new Date(h.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500, color: "var(--text-secondary)" }}>
                      {h.day_of_week}
                    </td>
                    <td>
                      <StatusBadge status={h.holiday_type} />
                    </td>
                    <td style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      {h.description || "—"}
                    </td>
                    {canManageHolidays && (
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => setHolidayToDelete({ publicId: h.public_id || String(h.holiday_id), name: h.name })}
                          className="btn btn-ghost btn-sm"
                          style={{ color: "var(--color-rose-400)", padding: "4px 8px" }}
                          title="Delete holiday"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalItems={filteredHolidays.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Add Holiday Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Schedule Official Holiday"
      >
        <form onSubmit={handleAddSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {formError && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "var(--color-rose-400)",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Holiday Name *</label>
            <input
              type="text"
              required
              className="input-field"
              placeholder="e.g. Diwali / Deepavali"
              value={newHoliday.name}
              onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
            />
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Calendar Date *</label>
              <input
                type="date"
                required
                className="input-field"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Holiday Category</label>
              <select
                className="input-field"
                value={newHoliday.holiday_type}
                onChange={(e) => setNewHoliday({ ...newHoliday, holiday_type: e.target.value as any })}
              >
                <option value="National">National Holiday</option>
                <option value="Gazetted">Gazetted Holiday</option>
                <option value="Optional">Optional Holiday</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Applicable Region</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. National, All, or State"
              value={newHoliday.region}
              onChange={(e) => setNewHoliday({ ...newHoliday, region: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description (Optional)</label>
            <textarea
              className="input-field"
              rows={2}
              placeholder="Brief notes regarding festival or observance"
              value={newHoliday.description}
              onChange={(e) => setNewHoliday({ ...newHoliday, description: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
            <button
              type="button"
              disabled={addLoading}
              onClick={() => setIsAddModalOpen(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addLoading}
              className="btn btn-primary"
            >
              {addLoading ? "Scheduling..." : "Add Holiday"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(holidayToDelete)}
        onClose={() => setHolidayToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Holiday Entry"
        message={`Are you sure you want to delete the holiday "${holidayToDelete?.name}"? This action will remove it from the company calendar.`}
        confirmText={deleteLoading ? "Deleting..." : "Delete Holiday"}
        variant="danger"
        isLoading={deleteLoading}
      />
    </div>
  );
}
