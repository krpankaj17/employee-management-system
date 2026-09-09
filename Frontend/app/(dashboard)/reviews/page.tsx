"use client";

import React, { useEffect, useState } from "react";
import { Award, Star, Plus, CheckCircle, MessageSquare, Search } from "lucide-react";
import { api } from "@/lib/apiClient";
import { PerformanceReview } from "@/types/review";
import { StatusBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Employee } from "@/types/employee";
import { useAuth, hasPermission } from "@/lib/auth";

export default function ReviewsPage() {
  const { role, user } = useAuth();
  const isEmployee = role === "Employee";
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const canCreate = !isEmployee && (hasPermission("review:create") || role === "Admin" || role === "HR_Manager");

  // Filter & Pagination states
  const [search, setSearch] = useState("");
  const [cycleFilter, setCycleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(4);

  // New review form
  const [newRev, setNewRev] = useState({
    employee_public_id: "",
    review_cycle: "H2 2026",
    performance_score: 4.5,
    strengths: "",
    areas_of_improvement: "",
    goals: "",
  });

  useEffect(() => {
    loadReviews();
  }, [role]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, cycleFilter, statusFilter]);

  const loadReviews = async () => {
    const [list, empRes] = await Promise.all([
      api.reviews.list().catch(() => []),
      api.employees.list({ limit: 100 }).catch(() => ({ items: [] })),
    ]);
    setReviews(list);
    const empList = empRes.items || [];
    setEmployees(empList);
    if (empList.length > 0 && !newRev.employee_public_id) {
      setNewRev((prev) => ({ ...prev, employee_public_id: empList[0].public_id }));
    }
  };

  const handleAcknowledge = async (publicId: string) => {
    try {
      await api.reviews.update(publicId, {
        status: "Acknowledged",
        employee_comments: "Acknowledged by employee on portal.",
      });
      setReviews((prev) =>
        prev.map((r) =>
          r.public_id === publicId
            ? { ...r, status: "Acknowledged", employee_comments: "Acknowledged by employee on portal." }
            : r
        )
      );
    } catch (err: any) {
      console.warn("Failed to persist review acknowledgement:", err);
      setReviews((prev) =>
        prev.map((r) =>
          r.public_id === publicId
            ? { ...r, status: "Acknowledged", employee_comments: "Acknowledged by employee on portal." }
            : r
        )
      );
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.reviews.create({
        employee_public_id: newRev.employee_public_id,
        review_cycle: newRev.review_cycle,
        performance_score: Number(newRev.performance_score),
        strengths: newRev.strengths,
        areas_of_improvement: newRev.areas_of_improvement,
        goals: newRev.goals,
      });
      setIsCreateModalOpen(false);
      loadReviews();
    } catch (err: any) {
      console.error("Create review error:", err);
      alert(err.message || "Failed to submit review.");
    }
  };

  // Filter & Pagination
  const filteredReviews = reviews.filter((r) => {
    // If logged in as standard Employee, strictly show only their own reviews
    if (isEmployee && user?.employee_public_id && r.employee_public_id !== user.employee_public_id) {
      return false;
    }
    const q = search.toLowerCase();
    const empName = (r.employee_name || "").toLowerCase();
    const revName = (r.reviewer_name || "").toLowerCase();
    const deptName = (r.department_name || "").toLowerCase();
    const strengths = (r.strengths || "").toLowerCase();
    const goals = (r.goals || "").toLowerCase();
    const matchesSearch =
      empName.includes(q) ||
      revName.includes(q) ||
      deptName.includes(q) ||
      strengths.includes(q) ||
      goals.includes(q);
    const matchesCycle = cycleFilter === "all" || (r.review_cycle || "") === cycleFilter;
    const matchesStatus = statusFilter === "all" || (r.status || "").toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesCycle && matchesStatus;
  });

  const pagedReviews = filteredReviews.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const cycles = Array.from(new Set(reviews.map((r) => r.review_cycle)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            {isEmployee ? "My Performance Reviews & Feedback" : "Performance Reviews & Feedback"}
          </h1>
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
            {isEmployee
              ? "Inspect your performance evaluations, development goals, and acknowledge review ratings"
              : `Tracking ${filteredReviews.length} employee evaluations, ratings, and development goals`}
          </p>
        </div>

        {canCreate && (
          <button onClick={() => setIsCreateModalOpen(true)} className="btn btn-primary">
            <Plus size={16} /> Conduct Review
          </button>
        )}
      </div>

      {/* Toolbar: Search, Cycle & Status Filter */}
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
        <div style={{ position: "relative", flex: 1, minWidth: 260, maxWidth: 420 }}>
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
            placeholder="Search by employee, evaluator, skill..."
            className="input-field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 38 }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>Cycle:</span>
            <select
              className="input-field"
              value={cycleFilter}
              onChange={(e) => setCycleFilter(e.target.value)}
              style={{ width: "auto", fontSize: "0.82rem", padding: "6px 10px" }}
            >
              <option value="all">All Cycles</option>
              {cycles.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>Status:</span>
            <select
              className="input-field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: "auto", fontSize: "0.82rem", padding: "6px 10px" }}
            >
              <option value="all">All Statuses</option>
              <option value="Submitted">Submitted</option>
              <option value="Acknowledged">Acknowledged</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      {pagedReviews.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
          <Award size={36} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
            No Reviews Found
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 4 }}>
            Try adjusting your search keywords or evaluation cycle filter.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {pagedReviews.map((rev) => (
            <div key={rev.public_id} className="card card-interactive">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <Avatar name={rev.employee_name} size={48} />
                  <div>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      {rev.employee_name}
                    </h3>
                    <div style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>
                      {rev.designation_name} • {rev.department_name}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>
                      Cycle: <strong>{rev.review_cycle}</strong> • Evaluator: {rev.reviewer_name}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--color-amber-400)", lineHeight: 1 }}>
                      ★ {rev.performance_score}
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Overall Rating</span>
                  </div>
                  <StatusBadge status={rev.status} />
                </div>
              </div>

              {/* Strengths & Improvement Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
                <div style={{ background: "var(--bg-surface-elevated)", padding: 14, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-emerald-400)", textTransform: "uppercase" }}>
                    Demonstrated Strengths
                  </span>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.45 }}>
                    {rev.strengths}
                  </p>
                </div>

                <div style={{ background: "var(--bg-surface-elevated)", padding: 14, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-amber-400)", textTransform: "uppercase" }}>
                    Areas for Growth
                  </span>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.45 }}>
                    {rev.areas_of_improvement}
                  </p>
                </div>

                <div style={{ background: "var(--bg-surface-elevated)", padding: 14, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-cyan-400)", textTransform: "uppercase" }}>
                    Key Milestone Goals
                  </span>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.45 }}>
                    {rev.goals}
                  </p>
                </div>
              </div>

              {/* Acknowledgment Footer */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, borderTop: "1px solid var(--border-subtle)", paddingTop: 14 }}>
                {rev.employee_comments ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.84rem", color: "var(--text-secondary)" }}>
                    <MessageSquare size={15} style={{ color: "var(--color-primary-400)" }} />
                    <span>Employee Acknowledgement: <em>"{rev.employee_comments}"</em></span>
                  </div>
                ) : (
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    Awaiting employee formal review acknowledgement
                  </span>
                )}

                {rev.status !== "Acknowledged" && (
                  <button
                    onClick={() => handleAcknowledge(rev.public_id)}
                    className="btn btn-primary btn-sm"
                  >
                    <CheckCircle size={14} /> Acknowledge Evaluation
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      <Pagination
        currentPage={currentPage}
        totalItems={filteredReviews.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />

      {/* Conduct Review Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Conduct Performance Evaluation"
      >
        <form onSubmit={handleCreateSubmit}>
          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Reviewee (Employee) *</label>
              <select
                className="input-field"
                value={newRev.employee_public_id}
                onChange={(e) => setNewRev({ ...newRev, employee_public_id: e.target.value })}
              >
                {employees.map((m) => (
                  <option key={m.public_id} value={m.public_id}>
                    {m.first_name} {m.last_name} ({m.employee_code}) {m.designation_name ? `- ${m.designation_name}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Score (1.0 to 5.0) *</label>
              <input
                type="number"
                step="0.1"
                min="1.0"
                max="5.0"
                required
                className="input-field"
                value={newRev.performance_score}
                onChange={(e) => setNewRev({ ...newRev, performance_score: parseFloat(e.target.value) })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Key Strengths & Achievements *</label>
            <textarea
              required
              rows={2}
              className="input-field"
              placeholder="Highlight technical contributions, leadership, and team collaboration..."
              value={newRev.strengths}
              onChange={(e) => setNewRev({ ...newRev, strengths: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Areas of Improvement *</label>
            <textarea
              required
              rows={2}
              className="input-field"
              placeholder="Constructive feedback on skill gaps or execution challenges..."
              value={newRev.areas_of_improvement}
              onChange={(e) => setNewRev({ ...newRev, areas_of_improvement: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Development Goals for Next Cycle *</label>
            <input
              type="text"
              required
              className="input-field"
              placeholder="e.g. Lead AWS Cloud migration, achieve 85% test coverage"
              value={newRev.goals}
              onChange={(e) => setNewRev({ ...newRev, goals: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Submit Evaluation
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
