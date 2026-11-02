interface Item {
  title: string;
  text: string;
}

interface Props {
  idPrefix: string;
  items: Item[];
  min: number;
  max: number;
  noun: string;
  onChange: (items: Item[]) => void;
}

/** Editable list of title/text items (gallery cards, scroll-reveal steps). Buttons, never drag-only. */
export function ItemsEditor({ idPrefix, items, min, max, noun, onChange }: Props) {
  const set = (index: number, patch: Partial<Item>) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <fieldset className="fieldset items-editor">
      <legend>
        {noun[0]!.toUpperCase() + noun.slice(1)}s ({items.length}, {min}–{max})
      </legend>
      {items.map((item, i) => (
        <div key={i} className="items-editor__row">
          <div className="field">
            <label htmlFor={`${idPrefix}-title-${i}`}>
              {noun} {i + 1} title
            </label>
            <input id={`${idPrefix}-title-${i}`} value={item.title} maxLength={120} onChange={(e) => set(i, { title: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`${idPrefix}-text-${i}`}>
              {noun} {i + 1} text
            </label>
            <input id={`${idPrefix}-text-${i}`} value={item.text} maxLength={600} onChange={(e) => set(i, { text: e.target.value })} />
          </div>
          <button type="button" className="btn btn--ghost btn--small" disabled={items.length <= min} onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Remove ${noun} ${i + 1}`}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn btn--ghost btn--small" disabled={items.length >= max} onClick={() => onChange([...items, { title: `New ${noun}`, text: '' }])}>
        Add {noun}
      </button>
    </fieldset>
  );
}

export const ITEM_LIMITS = { gallery: { min: 2, max: 8, noun: 'card' }, 'scroll-reveal': { min: 2, max: 5, noun: 'step' } } as const;
