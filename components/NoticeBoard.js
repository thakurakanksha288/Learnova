""use client";

// ─────────────────────────────────────────────────────────────────────────────
//  NoticeCreationForm.jsx
//  Issue #2008 — Real-time character counter for notice creation form
//
//  • CharacterCounter component (inline — no extra file needed)
//  • Strict maxLength="1000" on description textarea
//  • Counter turns amber at 900 chars, red at 1000 chars
//  • Textarea border shifts colour alongside the counter
//  • Submit button disabled when description exceeds limit
//  • Fully integrated with the existing Learnova dark-slate design system
// ─────────────────────────────────────────────────────────────────────────────

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { db } from "@/lib/firebaseConfig";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "./Navbar";

// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

const DESCRIPTION_MAX   = 1000;
const DESCRIPTION_WARN  = 900;
const TITLE_MAX         = 150;
const TITLE_WARN        = 120;
const TAGS_MAX          = 200;

const CATEGORIES = [
  { id: "academic",       label: "Academic"       },
  { id: "administrative", label: "Administrative" },
  { id: "financial",      label: "Financial"      },
  { id: "general",        label: "General"        },
  { id: "technical",      label: "Technical"      },
];

const PRIORITIES = [
  { id: "low",    label: "Low",    dot: "bg-slate-400"  },
  { id: "normal", label: "Normal", dot: "bg-blue-400"   },
  { id: "high",   label: "High",   dot: "bg-red-400"    },
];

// ─────────────────────────────────────────────────────────────────────────────
//  CharacterCounter
//  A small presentational component that renders the live "used / max" counter.
//  Exported so it can be tested independently if needed.
// ─────────────────────────────────────────────────────────────────────────────

export const CharacterCounter = ({
  current = 0,
  max     = 1000,
  className = "",
}) => {
  const remaining = max - current;
  const pct       = current / max;

  /**
   * Colour ladder:
   *   normal  → slate-500   (muted, stays out of the way)
   *   warning → amber-400   (≥ 90 % capacity)
   *   limit   → red-400     (at or over the cap)
   */
  const colorClass =
    current >= max
      ? "text-red-400"
      : pct >= 0.9
      ? "text-amber-400"
      : "text-slate-500";

  /**
   * Progress bar — thin strip that fills up visually.
   * Colour tracks the same ladder as the text counter.
   */
  const barColor =
    current >= max
      ? "bg-red-500"
      : pct >= 0.9
      ? "bg-amber-400"
      : "bg-indigo-500";

  const barWidth = `${Math.min((current / max) * 100, 100)}%`;

  return (
    <div className={`mt-1.5 space-y-1 ${className}`}>
      {/* Progress bar */}
      <div className="h-0.5 w-full rounded-full bg-slate-800 overflow-hidden">
        <motion.div
          className={`h-full rounded-full transition-colors duration-300 ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: barWidth }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        />
      </div>

      {/* Text counter */}
      <p
        className={`text-right text-xs font-medium tabular-nums transition-colors duration-200 select-none ${colorClass}`}
        aria-live="polite"
        aria-atomic="true"
      >
        {current.toLocaleString()} / {max.toLocaleString()}
        {remaining <= 100 && remaining > 0 && (
          <span className="ml-1.5 opacity-70">
            ({remaining} left)
          </span>
        )}
        {current >= max && (
          <span className="ml-1.5 font-semibold">— limit reached</span>
        )}
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  TagInput  — comma-separated tag chips with keyboard support
// ─────────────────────────────────────────────────────────────────────────────

const TagInput = ({ tags, onChange }) => {
  const [raw, setRaw] = useState("");

  const commit = useCallback(() => {
    const trimmed = raw.trim().replace(/,+$/, "");
    if (!trimmed) return;
    const next = [
      ...new Set([
        ...tags,
        ...trimmed.split(",").map((t) => t.trim()).filter(Boolean),
      ]),
    ];
    onChange(next);
    setRaw("");
  }, [raw, tags, onChange]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        commit();
      }
      if (e.key === "Backspace" && !raw && tags.length > 0) {
        onChange(tags.slice(0, -1));
      }
    },
    [raw, tags, onChange, commit]
  );

  const removeTag = useCallback(
    (index) => onChange(tags.filter((_, i) => i !== index)),
    [tags, onChange]
  );

  return (
    <div className="w-full min-h-[46px] rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 flex flex-wrap gap-2 items-center
      focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500 transition-all cursor-text"
      onClick={() => document.getElementById("tag-raw-input")?.focus()}
    >
      <AnimatePresence>
        {tags.map((tag, i) => (
          <motion.span
            key={tag}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30
              text-indigo-300 text-xs font-medium px-2.5 py-1"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(i)}
              className="text-indigo-400 hover:text-red-400 transition-colors leading-none"
              aria-label={`Remove tag ${tag}`}
            >
              ×
            </button>
          </motion.span>
        ))}
      </AnimatePresence>

      <input
        id="tag-raw-input"
        type="text"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        placeholder={tags.length === 0 ? "Add tags (press Enter or comma)…" : ""}
        className="flex-1 min-w-[140px] bg-transparent text-white placeholder-slate-500 text-sm
          outline-none border-none focus:ring-0"
        maxLength={TAGS_MAX}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  FormField  — labelled wrapper with consistent spacing
// ─────────────────────────────────────────────────────────────────────────────

const FormField = ({ label, htmlFor, required, hint, children }) => (
  <div className="space-y-2">
    <div className="flex items-baseline justify-between">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-semibold text-slate-200"
      >
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && (
        <span className="text-xs text-slate-500">{hint}</span>
      )}
    </div>
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  PrioritySelector  — visual card-style picker
// ─────────────────────────────────────────────────────────────────────────────

const PrioritySelector = ({ value, onChange }) => (
  <div className="grid grid-cols-3 gap-3">
    {PRIORITIES.map(({ id, label, dot }) => {
      const active = value === id;
      return (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-200
            ${active
              ? "border-indigo-500 bg-indigo-500/15 text-white shadow-lg shadow-indigo-500/10"
              : "border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300"
            }`}
        >
          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dot}`} />
          {label}
        </button>
      );
    })}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  CategorySelector  — horizontal scrollable pill tabs
// ─────────────────────────────────────────────────────────────────────────────

const CategorySelector = ({ value, onChange }) => (
  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
    {CATEGORIES.map(({ id, label }) => {
      const active = value === id;
      return (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`flex-shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all duration-200
            ${active
              ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
              : "border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-200"
            }`}
        >
          {label}
        </button>
      );
    })}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  SuccessBanner  — shown after a notice is successfully published
// ─────────────────────────────────────────────────────────────────────────────

const SuccessBanner = ({ onDismiss }) => (
  <motion.div
    initial={{ opacity: 0, y: -12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -12 }}
    className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 flex items-start gap-4"
  >
    <div className="mt-0.5 flex-shrink-0 h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
      <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <div className="flex-1">
      <p className="font-semibold text-emerald-300 text-sm">Notice published!</p>
      <p className="text-slate-400 text-xs mt-0.5">
        It's now live and visible on the Smart Notice Board.
      </p>
    </div>
    <button
      type="button"
      onClick={onDismiss}
      className="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none"
      aria-label="Dismiss"
    >
      ×
    </button>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  ValidationError  — inline field-level error message
// ─────────────────────────────────────────────────────────────────────────────

const ValidationError = ({ message }) => (
  <AnimatePresence>
    {message && (
      <motion.p
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className="text-xs text-red-400 mt-1 font-medium"
      >
        {message}
      </motion.p>
    )}
  </AnimatePresence>
);

// ─────────────────────────────────────────────────────────────────────────────
//  useFormValidation  — validates fields and returns per-field error messages
// ─────────────────────────────────────────────────────────────────────────────

const useFormValidation = ({ title, description, touched }) => {
  return useMemo(() => {
    const errors = {};

    if (touched.title) {
      if (!title.trim()) {
        errors.title = "Title is required.";
      } else if (title.trim().length < 5) {
        errors.title = "Title must be at least 5 characters.";
      }
    }

    if (touched.description) {
      if (!description.trim()) {
        errors.description = "Description is required.";
      } else if (description.trim().length < 10) {
        errors.description = "Description must be at least 10 characters.";
      } else if (description.length > DESCRIPTION_MAX) {
        errors.description = `Description cannot exceed ${DESCRIPTION_MAX} characters.`;
      }
    }

    return errors;
  }, [title, description, touched]);
};

// ─────────────────────────────────────────────────────────────────────────────
//  NoticePreview  — read-only preview of how the notice will appear
// ─────────────────────────────────────────────────────────────────────────────

const NoticePreview = ({ title, description, category, priority, tags, isPinned, author }) => {
  const priorityBadge = {
    high:   "bg-red-500/15 text-red-300 border-red-500/30",
    normal: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    low:    "bg-slate-500/15 text-slate-300 border-slate-500/30",
  }[priority] || "bg-slate-500/15 text-slate-300 border-slate-500/30";

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-base leading-snug truncate">
            {title || <span className="text-slate-600 italic">Notice title will appear here…</span>}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            By <span className="text-slate-400">{author || "You"}</span> · Just now
          </p>
        </div>
        {isPinned && (
          <span className="flex-shrink-0 text-yellow-400 text-xs">📌 Pinned</span>
        )}
      </div>

      <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">
        {description || <span className="text-slate-600 italic">Description preview will appear here…</span>}
      </p>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border capitalize ${priorityBadge}`}>
          {priority}
        </span>
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border border-slate-600 bg-slate-700/50 text-slate-300 capitalize">
          {category}
        </span>
        {tags.map((tag) => (
          <span
            key={tag}
            className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300"
          >
            #{tag}
          </span>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  NoticeCreationForm  — main exported component
// ─────────────────────────────────────────────────────────────────────────────

const NoticeCreationForm = ({ onSuccess, onCancel }) => {
  const { user } = useAuth();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [category,    setCategory]    = useState("general");
  const [priority,    setPriority]    = useState("normal");
  const [tags,        setTags]        = useState([]);
  const [isPinned,    setIsPinned]    = useState(false);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [submitting,   setSubmitting]   = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [showPreview,  setShowPreview]  = useState(false);
  const [activeTab,    setActiveTab]    = useState("form"); // "form" | "preview"
  const [touched, setTouched] = useState({ title: false, description: false });

  const descTextareaRef = useRef(null);

  // ── Validation ──────────────────────────────────────────────────────────────
  const errors = useFormValidation({ title, description, touched });

  const isFormValid =
    title.trim().length >= 5 &&
    description.trim().length >= 10 &&
    description.length <= DESCRIPTION_MAX &&
    !submitting;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleTitleChange = useCallback((e) => {
    setTitle(e.target.value.slice(0, TITLE_MAX));
    setTouched((prev) => ({ ...prev, title: true }));
  }, []);

  const handleDescriptionChange = useCallback((e) => {
    // maxLength on the element already enforces the cap in browsers,
    // but we also slice here as a JS-level safety net.
    setDescription(e.target.value.slice(0, DESCRIPTION_MAX));
    setTouched((prev) => ({ ...prev, description: true }));
  }, []);

  const handleReset = useCallback(() => {
    setTitle("");
    setDescription("");
    setCategory("general");
    setPriority("normal");
    setTags([]);
    setIsPinned(false);
    setSubmitted(false);
    setTouched({ title: false, description: false });
    setActiveTab("form");
    descTextareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      // Mark all fields as touched to trigger validation display
      setTouched({ title: true, description: true });

      if (!isFormValid) return;

      setSubmitting(true);

      try {
        const payload = {
          title:       title.trim(),
          content:     description.trim(),
          category,
          priority,
          tags,
          isPinned,
          author:      user?.displayName || user?.email || "Anonymous",
          authorId:    user?.uid || "anonymous",
          createdAt:   serverTimestamp(),
          updatedAt:   serverTimestamp(),
        };

        await addDoc(collection(db, "notices"), payload);

        setSubmitted(true);
        toast.success("Notice published successfully!");
        onSuccess?.(payload);
      } catch (err) {
        console.error("Failed to publish notice:", err);
        toast.error("Failed to publish notice. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [isFormValid, title, description, category, priority, tags, isPinned, user, onSuccess]
  );

  // ── Textarea border colour driven by char count ─────────────────────────────
  const descBorderClass =
    description.length >= DESCRIPTION_MAX
      ? "border-red-500   focus:ring-red-500/30   focus:border-red-500"
      : description.length >= DESCRIPTION_WARN
      ? "border-amber-500 focus:ring-amber-500/30 focus:border-amber-500"
      : "border-slate-700 focus:ring-indigo-500/30 focus:border-indigo-500";

  const titleBorderClass =
    title.length >= TITLE_MAX
      ? "border-amber-500 focus:ring-amber-500/30 focus:border-amber-500"
      : "border-slate-700 focus:ring-indigo-500/30 focus:border-indigo-500";

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      <div className="mx-auto max-w-3xl px-4 py-10">

        {/* ── Page heading ──────────────────────────────────────────────── */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.35em] text-indigo-400 mb-2 font-semibold">
            Notice Center
          </p>
          <h1 className="text-4xl font-bold text-white">Create Notice</h1>
          <p className="mt-2 text-slate-400 text-sm">
            Publish a new notice to the Smart Notice Board. Fields marked{" "}
            <span className="text-red-400">*</span> are required.
          </p>
        </div>

        {/* ── Success banner ────────────────────────────────────────────── */}
        <AnimatePresence>
          {submitted && (
            <div className="mb-6">
              <SuccessBanner onDismiss={handleReset} />
            </div>
          )}
        </AnimatePresence>

        {/* ── Tab bar: Form / Preview ───────────────────────────────────── */}
        <div className="mb-6 flex gap-1.5 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-fit">
          {["form", "preview"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-all duration-200
                ${activeTab === tab
                  ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
                }`}
            >
              {tab === "form" ? "Edit" : "Preview"}
            </button>
          ))}
        </div>

        {/* ── Main card ─────────────────────────────────────────────────── */}
        <motion.div
          layout
          className="rounded-3xl border border-slate-800 bg-slate-900/70 shadow-2xl overflow-hidden"
        >
          <AnimatePresence mode="wait">

            {/* ── PREVIEW TAB ─────────────────────────────────────────────── */}
            {activeTab === "preview" && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="p-8 space-y-6"
              >
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Notice Preview</h2>
                  <p className="text-xs text-slate-500">
                    This is how your notice will appear on the board.
                  </p>
                </div>
                <NoticePreview
                  title={title}
                  description={description}
                  category={category}
                  priority={priority}
                  tags={tags}
                  isPinned={isPinned}
                  author={user?.displayName || user?.email}
                />
                <button
                  type="button"
                  onClick={() => setActiveTab("form")}
                  className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
                >
                  ← Back to editing
                </button>
              </motion.div>
            )}

            {/* ── FORM TAB ────────────────────────────────────────────────── */}
            {activeTab === "form" && (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                noValidate
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="p-8 space-y-7"
              >

                {/* ── Title ─────────────────────────────────────────────── */}
                <FormField
                  label="Title"
                  htmlFor="notice-title"
                  required
                  hint="Keep it concise and descriptive"
                >
                  <input
                    id="notice-title"
                    type="text"
                    value={title}
                    onChange={handleTitleChange}
                    onBlur={() => setTouched((p) => ({ ...p, title: true }))}
                    maxLength={TITLE_MAX}
                    required
                    placeholder="e.g. Mid-semester exam schedule update"
                    className={`w-full rounded-xl border bg-slate-800/60 px-4 py-3 text-white placeholder-slate-500
                      text-sm focus:outline-none focus:ring-2 transition-all ${titleBorderClass}`}
                  />
                  {/* Character counter for title */}
                  <CharacterCounter current={title.length} max={TITLE_MAX} />
                  <ValidationError message={errors.title} />
                </FormField>

                {/* ── Description ───────────────────────────────────────── */}
                <FormField
                  label="Description"
                  htmlFor="notice-description"
                  required
                  hint={`Max ${DESCRIPTION_MAX.toLocaleString()} characters`}
                >
                  <textarea
                    id="notice-description"
                    ref={descTextareaRef}
                    value={description}
                    onChange={handleDescriptionChange}
                    onBlur={() => setTouched((p) => ({ ...p, description: true }))}
                    maxLength={DESCRIPTION_MAX}
                    required
                    rows={7}
                    placeholder="Provide clear, detailed information about this notice…"
                    className={`w-full rounded-xl border bg-slate-800/60 px-4 py-3 text-white placeholder-slate-500
                      text-sm resize-y focus:outline-none focus:ring-2 transition-all leading-relaxed ${descBorderClass}`}
                  />

                  {/* ── Character counter — the core deliverable of issue #2008 ── */}
                  <CharacterCounter
                    current={description.length}
                    max={DESCRIPTION_MAX}
                  />

                  <ValidationError message={errors.description} />
                </FormField>

                {/* ── Category ──────────────────────────────────────────── */}
                <FormField label="Category" htmlFor="notice-category">
                  <CategorySelector value={category} onChange={setCategory} />
                </FormField>

                {/* ── Priority ──────────────────────────────────────────── */}
                <FormField label="Priority" htmlFor="notice-priority">
                  <PrioritySelector value={priority} onChange={setPriority} />
                </FormField>

                {/* ── Tags ──────────────────────────────────────────────── */}
                <FormField
                  label="Tags"
                  htmlFor="tag-raw-input"
                  hint="Press Enter or comma to add"
                >
                  <TagInput tags={tags} onChange={setTags} />
                  {tags.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      {tags.length} tag{tags.length !== 1 ? "s" : ""} added
                    </p>
                  )}
                </FormField>

                {/* ── Pin toggle ────────────────────────────────────────── */}
                <div className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-800/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      📌 Pin this notice
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pinned notices always appear at the top of the board.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isPinned}
                    onClick={() => setIsPinned((v) => !v)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                      transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                      focus:ring-offset-slate-900 ${isPinned ? "bg-indigo-500" : "bg-slate-700"}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform
                        duration-200 ease-in-out ${isPinned ? "translate-x-5" : "translate-x-0"}`}
                    />
                  </button>
                </div>

                {/* ── Character count summary strip ────────────────────── */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                    Content summary
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      {
                        label: "Title",
                        current: title.length,
                        max: TITLE_MAX,
                        warn: TITLE_WARN,
                      },
                      {
                        label: "Description",
                        current: description.length,
                        max: DESCRIPTION_MAX,
                        warn: DESCRIPTION_WARN,
                      },
                      {
                        label: "Tags",
                        current: tags.length,
                        max: 10,
                        warn: 8,
                        unit: "tags",
                      },
                      {
                        label: "Words",
                        current: description.trim()
                          ? description.trim().split(/\s+/).length
                          : 0,
                        max: null,
                        warn: null,
                        unit: "words",
                      },
                    ].map(({ label, current, max, warn, unit }) => {
                      const pct  = max ? current / max : 0;
                      const over = max ? current >= max : false;
                      const warn_ = warn ? current >= warn : false;

                      const valColor = over
                        ? "text-red-400"
                        : warn_
                        ? "text-amber-400"
                        : "text-white";

                      return (
                        <div
                          key={label}
                          className="rounded-lg bg-slate-800/60 p-2.5 text-center border border-slate-700/40"
                        >
                          <p className={`text-lg font-bold tabular-nums ${valColor}`}>
                            {current.toLocaleString()}
                            {max && (
                              <span className="text-slate-600 text-xs font-normal">
                                /{max.toLocaleString()}
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-0.5">
                            {unit || "chars"} · {label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Action buttons ────────────────────────────────────── */}
                <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800">
                  <div className="flex gap-2 w-full sm:w-auto">
                    {onCancel && (
                      <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 sm:flex-initial rounded-xl border border-slate-700 bg-slate-800/50 px-5 py-2.5
                          text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleReset}
                      className="flex-1 sm:flex-initial rounded-xl border border-slate-700 bg-slate-800/50 px-5 py-2.5
                        text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all"
                    >
                      Reset
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={!isFormValid}
                    className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-2.5
                      text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:opacity-90 active:scale-[0.98]
                      transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Publishing…
                      </>
                    ) : (
                      "Publish Notice"
                    )}
                  </button>
                </div>

              </motion.form>
            )}

          </AnimatePresence>
        </motion.div>

        {/* ── Keyboard shortcut hint ─────────────────────────────────────── */}
        <p className="mt-4 text-center text-xs text-slate-600">
          Tip: press <kbd className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-slate-400">Ctrl + Enter</kbd> to publish
        </p>

      </div>
    </div>
  );
};

export default NoticeCreationForm;