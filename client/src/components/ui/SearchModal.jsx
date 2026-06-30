import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { searchApi } from '../../services/api'
import { Search, Loader2, ListChecks, FolderOpen, Tag, MessageSquare, X } from 'lucide-react'

// ── Highlight matching text ───────────────────────────────────
function Highlight({ text = '', query = '' }) {
  if (!query || !text) return <span>{text}</span>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-yellow-100 text-yellow-900 rounded px-0.5 not-italic">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </span>
  )
}

// ── Result row ────────────────────────────────────────────────
function ResultRow({ icon: Icon, iconColor, label, sub, onClick, query }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-warm-50 transition-colors text-left rounded-lg"
    >
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-warm-900 truncate">
          <Highlight text={label} query={query} />
        </p>
        {sub && <p className="text-xs text-warm-400 truncate">{sub}</p>}
      </div>
    </button>
  )
}

// ── Section header ────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div>
      <p className="px-4 py-1.5 text-xs font-semibold text-warm-400 uppercase tracking-wide">{title}</p>
      {children}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────
export default function SearchModal({ open, onClose }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const debounceRef = useRef(null)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handler(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) onClose()
        else open || onClose() // parent handles toggle
      }
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const search = useCallback((q) => {
    if (!q || q.length < 2) { setResults(null); return }
    setLoading(true)
    searchApi.query(q)
      .then(r => setResults(r.data.data))
      .catch(() => setResults(null))
      .finally(() => setLoading(false))
  }, [])

  function handleChange(e) {
    const q = e.target.value
    setQuery(q)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 220)
  }

  function go(path) {
    navigate(path)
    onClose()
  }

  const hasResults = results && (
    results.tasks?.length || results.projects?.length ||
    results.topics?.length || results.discussions?.length
  )

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-warm-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-warm-200">
          {loading
            ? <Loader2 className="w-4 h-4 text-warm-400 shrink-0 animate-spin" />
            : <Search className="w-4 h-4 text-warm-400 shrink-0" />
          }
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            placeholder="Search tasks, projects, topics, discussions…"
            className="flex-1 bg-transparent text-sm text-warm-900 placeholder-warm-400 outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults(null); inputRef.current?.focus() }} className="text-warm-400 hover:text-warm-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-xs text-warm-400 bg-warm-100 rounded border border-warm-200">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!query && (
            <p className="text-center text-sm text-warm-400 py-8">
              Start typing to search…
            </p>
          )}
          {query && query.length < 2 && (
            <p className="text-center text-sm text-warm-400 py-8">Type at least 2 characters</p>
          )}
          {query.length >= 2 && !loading && results && !hasResults && (
            <p className="text-center text-sm text-warm-400 py-8">No results for "{query}"</p>
          )}

          {results?.tasks?.length > 0 && (
            <Section title="Tasks">
              {results.tasks.map(t => (
                <ResultRow
                  key={t.id}
                  icon={ListChecks}
                  iconColor="bg-blue-50 text-blue-600"
                  label={t.title}
                  sub={t.projects?.name}
                  query={query}
                  onClick={() => go('/lists')}
                />
              ))}
            </Section>
          )}

          {results?.projects?.length > 0 && (
            <Section title="Projects">
              {results.projects.map(p => (
                <ResultRow
                  key={p.id}
                  icon={FolderOpen}
                  iconColor="bg-violet-50 text-violet-600"
                  label={p.name}
                  query={query}
                  onClick={() => go(`/projects/${p.id}`)}
                />
              ))}
            </Section>
          )}

          {results?.topics?.length > 0 && (
            <Section title="Topics">
              {results.topics.map(t => (
                <ResultRow
                  key={t.id}
                  icon={Tag}
                  iconColor="bg-amber-50 text-amber-600"
                  label={t.title}
                  sub={t.projects?.name}
                  query={query}
                  onClick={() => go(`/topics/${t.id}`)}
                />
              ))}
            </Section>
          )}

          {results?.discussions?.length > 0 && (
            <Section title="Discussions">
              {results.discussions.map(d => (
                <ResultRow
                  key={d.id}
                  icon={MessageSquare}
                  iconColor="bg-green-50 text-green-600"
                  label={(d.raw_text || '').slice(0, 80)}
                  sub={d.projects?.name}
                  query={query}
                  onClick={() => go('/log')}
                />
              ))}
            </Section>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-warm-100 px-4 py-2 flex items-center gap-4 text-xs text-warm-400">
          <span><kbd className="px-1 py-0.5 bg-warm-100 rounded border border-warm-200">↵</kbd> to navigate</span>
          <span><kbd className="px-1 py-0.5 bg-warm-100 rounded border border-warm-200">Esc</kbd> to close</span>
          <span className="ml-auto"><kbd className="px-1 py-0.5 bg-warm-100 rounded border border-warm-200">⌘K</kbd> toggle</span>
        </div>
      </div>
    </div>,
    document.body
  )
}
