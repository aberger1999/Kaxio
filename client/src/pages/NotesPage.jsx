import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Pin, Trash2, ArrowLeft, X, StickyNote, Check } from 'lucide-react';
import RichTextEditor from '../components/RichTextEditor';
import TagSelector from '../components/TagSelector';
import { notesApi, goalsApi } from '../api/client';

const TILE_COLORS = {
  '': { label: 'White', light: '', dark: '', swatch: 'bg-white dark:bg-slate-800' },
  blue: { label: 'Blue', light: 'bg-blue-100', dark: 'dark:bg-blue-900/40', swatch: 'bg-blue-200' },
  red: { label: 'Red', light: 'bg-red-100', dark: 'dark:bg-red-900/40', swatch: 'bg-red-200' },
  yellow: { label: 'Yellow', light: 'bg-yellow-100', dark: 'dark:bg-yellow-900/40', swatch: 'bg-yellow-200' },
  orange: { label: 'Orange', light: 'bg-orange-100', dark: 'dark:bg-orange-900/40', swatch: 'bg-orange-200' },
  green: { label: 'Green', light: 'bg-green-100', dark: 'dark:bg-green-900/40', swatch: 'bg-green-200' },
  purple: { label: 'Purple', light: 'bg-purple-100', dark: 'dark:bg-purple-900/40', swatch: 'bg-purple-200' },
  pink: { label: 'Pink', light: 'bg-pink-100', dark: 'dark:bg-pink-900/40', swatch: 'bg-pink-200' },
};

function getTileColorClasses(color) {
  const c = TILE_COLORS[color || ''];
  if (!c || (!c.light && !c.dark)) return '';
  return `${c.light} ${c.dark}`;
}

function getNotePreview(content) {
  if (!content) return { type: 'text', text: '' };

  const doc = new DOMParser().parseFromString(content, 'text/html');
  const listItems = Array.from(doc.querySelectorAll('li'))
    .map((item) => item.textContent?.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (listItems.length > 0) {
    return { type: 'bullets', items: listItems };
  }

  return {
    type: 'text',
    text: (doc.body.textContent || '').trim().slice(0, 150),
  };
}

function NoteEditor({ note, onClose, goals }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(note?.title || '');
  const [tags, setTags] = useState(
    note?.tags ? note.tags.split(',').map((t) => t.trim()).filter(Boolean) : []
  );
  const [isPinned, setIsPinned] = useState(note?.isPinned || false);
  const [goalId, setGoalId] = useState(note?.goalId || '');
  const [color, setColor] = useState(note?.color || '');
  const editorRef = useRef(null);

  const saveMut = useMutation({
    mutationFn: (data) =>
      note?.id ? notesApi.updateNote(note.id, data) : notesApi.createNote(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      onClose();
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => notesApi.deleteNote(note.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      onClose();
    },
  });

  const handleSave = () => {
    saveMut.mutate({
      title,
      content: editorRef.current?.getHTML() || '',
      tags: tags.join(','),
      isPinned,
      color,
      goalId: goalId || null,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
        >
          <ArrowLeft size={16} /> Back to notes
        </button>
        <div className="flex gap-2">
          {note?.id && (
            <button
              onClick={() => deleteMut.mutate()}
              className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
          <button
            onClick={handleSave}
            className="btn-gradient text-white text-sm px-4 py-2 rounded-lg"
          >
            Save
          </button>
        </div>
      </div>

      {note?.id && (
        <div className="flex gap-4 text-xs text-gray-400 dark:text-gray-500">
          <span>Created: {new Date(note.createdAt).toLocaleDateString()}</span>
          <span>Last Edit: {new Date(note.updatedAt).toLocaleDateString()}</span>
        </div>
      )}

      <input
        placeholder="Note title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-xl font-semibold border-0 border-b dark:border-slate-700 pb-2 outline-none bg-transparent text-gray-900 dark:text-white"
      />

      <div className="flex gap-3 items-center">
        <div className="flex-[2] min-w-0">
          <TagSelector selectedTags={tags} onChange={setTags} />
        </div>
        <select
          value={goalId}
          onChange={(e) => setGoalId(e.target.value)}
          className="flex-1 border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white"
        >
          <option value="">No goal</option>
          {goals?.map((g) => (
            <option key={g.id} value={g.id}>{g.title}</option>
          ))}
        </select>
        <button
          onClick={() => setIsPinned(!isPinned)}
          className={`p-2 rounded-lg ${isPinned ? 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Pin size={16} />
        </button>
      </div>

      <RichTextEditor
        content={note?.content || ''}
        placeholder="Write your note..."
        editorRef={editorRef}
      />

      {/* Tile color picker */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500 dark:text-gray-400">Tile Color</span>
        <div className="flex gap-1.5">
          {Object.entries(TILE_COLORS).map(([key, val]) => (
            <button
              key={key}
              type="button"
              title={val.label}
              onClick={() => setColor(key)}
              className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center ${val.swatch} ${
                color === key
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              {color === key && <Check size={14} className="text-primary" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function NotesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState(searchParams.get('new') ? {} : null);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('');

  const { data: notes = [] } = useQuery({
    queryKey: ['notes', search, activeTag],
    queryFn: () => {
      const params = {};
      if (search) params.search = search;
      if (activeTag) params.tag = activeTag;
      return notesApi.getNotes(params);
    },
  });

  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => goalsApi.getGoals(),
  });

  if (editing !== null) {
    return (
      <NoteEditor
        note={editing}
        goals={goals}
        onClose={() => {
          setEditing(null);
          searchParams.delete('new');
          setSearchParams(searchParams);
        }}
      />
    );
  }

  const allTags = [...new Set(notes.flatMap((n) => n.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)))];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Notes</h1>
        <button
          onClick={() => setEditing({})}
          className="flex items-center gap-1 btn-gradient text-white text-sm px-3 py-2 rounded-lg"
        >
          <Plus size={16} /> New Note
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          placeholder="Search notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border dark:border-slate-600 rounded-lg text-sm dark:bg-slate-800 dark:text-white"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Tags */}
      {allTags.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? '' : tag)}
              className={`text-xs px-2 py-1 rounded-full transition-colors ${
                activeTag === tag
                  ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                  : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
              }`}
            >
              {tag}
            </button>
          ))}
          {activeTag && (
            <button
              onClick={() => setActiveTag('')}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1"
            >
              <X size={12} className="inline" /> Clear filter
            </button>
          )}
        </div>
      )}

      {/* Notes grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {notes.map((note) => {
          const colorClasses = getTileColorClasses(note.color);
          const preview = getNotePreview(note.content);
          return (
            <button
              key={note.id}
              onClick={() => setEditing(note)}
              className={`text-left rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-4 hover:shadow-md transition-shadow ${
                colorClasses || 'bg-white dark:bg-slate-900'
              }`}
            >
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                  {note.title || 'Untitled'}
                </h3>
                {note.isPinned && <Pin size={14} className="text-amber-500 shrink-0" />}
              </div>
              {preview.type === 'bullets' ? (
                <div className="mt-2 space-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {preview.items.map((item, idx) => (
                    <div key={`${idx}-${item}`} className="flex gap-1.5 min-w-0">
                      <span className="shrink-0 leading-5">&bull;</span>
                      <span className="truncate leading-5">{item}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-3">
                  {preview.text}
                </p>
              )}
              {note.tags && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {note.tags.split(',').filter(Boolean).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded"
                    >
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-3 mt-2 text-xs text-gray-400">
                <span>Created: {new Date(note.createdAt).toLocaleDateString()}</span>
                <span>Last Edit: {new Date(note.updatedAt).toLocaleDateString()}</span>
              </div>
            </button>
          );
        })}
      </div>

      {notes.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <StickyNote size={40} className="mx-auto mb-3 opacity-50" />
          <p>No notes yet. Create your first one!</p>
        </div>
      )}
    </div>
  );
}
