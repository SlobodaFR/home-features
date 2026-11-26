import { useEffect, useRef, useState } from 'react';
import { cellInputClass } from '../ui';

interface ValueEditorProps {
  label: string;
  value: string;
  onSave: (value: string) => Promise<boolean>;
}

/**
 * Saves on blur (or Enter) when the draft differs; Escape drops the edit. While the user is
 * editing (dirty), a refreshed stored value never overwrites the draft: the draft follows the
 * stored value only when it is untouched, or once the edit is saved or cancelled. A rejected
 * save puts the stored value back instead of leaving text the server never kept.
 */
export function ValueEditor({ label, value, onSave }: ValueEditorProps) {
  const [draft, setDraft] = useState(value);
  const dirty = useRef(false);
  const valueRef = useRef(value);
  const draftRef = useRef(draft);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!dirty.current) setDraft(value);
  }, [value]);

  function commit() {
    if (!dirty.current) return;
    const submitted = draft;
    if (submitted === valueRef.current) {
      dirty.current = false;
      return;
    }
    void onSave(submitted).then((saved) => {
      // Typing resumed while the save was in flight: that newer edit stays.
      if (draftRef.current !== submitted) return;
      dirty.current = false;
      setDraft(saved ? submitted : valueRef.current);
    });
  }

  return (
    <input
      className={cellInputClass}
      aria-label={label}
      value={draft}
      onChange={(event) => {
        dirty.current = true;
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          dirty.current = false;
          setDraft(valueRef.current);
          event.currentTarget.blur();
        }
      }}
    />
  );
}
