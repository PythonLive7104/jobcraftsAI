import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Button } from './ui/button';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';

function plainTextToHtml(text: string): string {
  if (!text?.trim()) return '<p></p>';
  return text
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line || '')}</p>`)
    .join('');
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

export type ResumeEditorHandle = {
  getText: () => string;
  getHTML: () => string;
};

type ResumeEditorProps = {
  content: string;
  contentKey?: string;
  contentMode?: 'text' | 'html';
  onChange?: (text: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
};

function contentToEditorValue(content: string, mode: 'text' | 'html'): string {
  if (!content?.trim()) return '<p></p>';
  return mode === 'html' ? content : plainTextToHtml(content);
}

export const ResumeEditor = forwardRef<ResumeEditorHandle, ResumeEditorProps>(function ResumeEditor(
  { content, contentKey, contentMode = 'text', onChange, placeholder, className = '', minHeight = '420px' },
  ref,
) {
  const initialContent = contentToEditorValue(content || '', contentMode);
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[200px] text-foreground',
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor || contentKey === undefined) return;
    editor.commands.setContent(contentToEditorValue(content || '', contentMode), false);
  }, [contentKey, content, contentMode, editor]);

  const handleUpdate = useCallback(() => {
    if (editor && onChange) {
      onChange(editor.getText());
    }
  }, [editor, onChange]);

  useEffect(() => {
    if (!editor) return;
    editor.on('update', handleUpdate);
    return () => editor.off('update', handleUpdate);
  }, [editor, handleUpdate]);

  useImperativeHandle(ref, () => ({
    getText: () => editor?.getText() ?? '',
    getHTML: () => editor?.getHTML() ?? '',
  }), [editor]);

  if (!editor) return null;

  return (
    <div className={`rounded-lg border border-border/60 bg-background ${className}`}>
      <div className="flex items-center gap-0.5 border-b border-border/60 px-2 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleBold().run()}
          data-active={editor.isActive('bold')}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          data-active={editor.isActive('italic')}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          data-active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          data-active={editor.isActive('orderedList')}
          title="Numbered list"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>
      <div
        className="overflow-auto p-4"
        style={{ minHeight }}
      >
        <EditorContent editor={editor} />
      </div>
      <style>{`
        .ProseMirror p { margin: 0.5em 0; }
        .ProseMirror ul, .ProseMirror ol { padding-left: 1.5em; margin: 0.5em 0; }
        .ProseMirror:focus { outline: none; }
        .ProseMirror p.is-editor-empty:first-child::before { color: #94a3b8; content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
        [data-active="true"] { background: hsl(var(--primary) / 0.2); }
      `}</style>
    </div>
  );
});
