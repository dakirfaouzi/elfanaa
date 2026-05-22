"use client";

import {
  SECTION_LABELS,
  type BenefitItem,
  type BeforeAfterPair,
  type FaqItem,
  type MediaRef,
  type Section,
  type SectionKind,
  type TestimonialItem,
} from "@platform/builder-schema";
import { MediaSlot } from "./MediaSlot";

/**
 * SectionEditor — switches on section.kind and renders the right
 * controlled form.
 *
 * # Why one file for all editors
 *
 * The editor surface is small (~10 sections × <10 fields each), and a
 * single file lets the IDE auto-import everything. The discriminated
 * union pays off here: each branch sees the narrowed `Section` type.
 *
 * # Patch flow
 *
 * Every input change calls `onPatch({ <field>: <value> })`. The parent
 * dispatches `UPDATE_SECTION { sectionId, patch }`, the reducer
 * shallow-merges, and the rendered preview updates on the next tick.
 *
 * # Server safety
 *
 * Editors are CLIENT components (they own form state and call
 * fetch via the asset picker). The runtime renderer that displays
 * the preview is a server component imported into the builder
 * client tree; React 19 supports that mixing.
 */

export function SectionEditor(props: {
  section: Section;
  draftId: string;
  onPatch: (patch: Partial<Section>) => void;
}) {
  const { section, onPatch, draftId } = props;
  switch (section.kind) {
    case "hero":
      return (
        <div className="builder-grid">
          <LocalePair
            label="Title"
            value={section.title}
            onChange={(t) => onPatch({ title: t })}
          />
          <LocalePair
            label="Subtitle"
            value={section.subtitle ?? {}}
            onChange={(t) => onPatch({ subtitle: t })}
          />
          <div className="field-row">
            <LocalePair
              label="CTA label"
              value={section.ctaLabel ?? {}}
              onChange={(t) => onPatch({ ctaLabel: t })}
            />
            <TextField
              label="CTA href"
              value={section.ctaHref ?? ""}
              onChange={(v) => onPatch({ ctaHref: v })}
            />
          </div>
          <EnumField
            label="Alignment"
            value={section.align}
            options={[
              { value: "center", label: "Center" },
              { value: "left", label: "Left" },
            ]}
            onChange={(v) => onPatch({ align: v as "left" | "center" })}
          />
          <MediaSlot
            label="Hero media"
            draftId={draftId}
            media={section.media}
            allowed={["image", "video", "gif"]}
            onChange={(m) => onPatch({ media: m })}
          />
        </div>
      );

    case "benefits":
      return (
        <div className="builder-grid">
          <LocalePair
            label="Eyebrow"
            value={section.eyebrow ?? {}}
            onChange={(t) => onPatch({ eyebrow: t })}
          />
          <LocalePair
            label="Title"
            value={section.title ?? {}}
            onChange={(t) => onPatch({ title: t })}
          />
          <EnumField
            label="Columns"
            value={String(section.columns)}
            options={[
              { value: "2", label: "2" },
              { value: "3", label: "3" },
              { value: "4", label: "4" },
            ]}
            onChange={(v) =>
              onPatch({ columns: Number(v) as 2 | 3 | 4 })
            }
          />
          <ItemList<BenefitItem>
            label="Items"
            items={section.items}
            onChange={(items) => onPatch({ items })}
            blankItem={(id) => ({ id, icon: "★", title: { en: "" }, body: { en: "" } })}
            renderItem={(item, patch) => (
              <div className="builder-grid">
                <TextField
                  label="Icon (emoji or short)"
                  value={item.icon ?? ""}
                  onChange={(v) => patch({ icon: v })}
                />
                <LocalePair
                  label="Item title"
                  value={item.title}
                  onChange={(t) => patch({ title: t })}
                />
                <LocalePair
                  label="Item body"
                  value={item.body ?? {}}
                  onChange={(t) => patch({ body: t })}
                />
              </div>
            )}
          />
        </div>
      );

    case "before_after":
      return (
        <div className="builder-grid">
          <LocalePair
            label="Title"
            value={section.title ?? {}}
            onChange={(t) => onPatch({ title: t })}
          />
          <EnumField
            label="Layout"
            value={section.layout}
            options={[
              { value: "side_by_side", label: "Side by side" },
              { value: "stacked", label: "Stacked" },
            ]}
            onChange={(v) =>
              onPatch({ layout: v as "side_by_side" | "stacked" })
            }
          />
          <ItemList<BeforeAfterPair>
            label="Pairs"
            items={section.pairs}
            onChange={(pairs) => onPatch({ pairs })}
            blankItem={(id) => ({
              id,
              before: { kind: "image", desktopSrc: "", alt: "" },
              after: { kind: "image", desktopSrc: "", alt: "" },
              caption: { en: "" },
            })}
            renderItem={(pair, patch) => (
              <div className="builder-grid">
                <MediaSlot
                  label="Before"
                  draftId={draftId}
                  media={pair.before}
                  allowed={["image", "gif"]}
                  required
                  onChange={(m) => m && patch({ before: m })}
                />
                <MediaSlot
                  label="After"
                  draftId={draftId}
                  media={pair.after}
                  allowed={["image", "gif"]}
                  required
                  onChange={(m) => m && patch({ after: m })}
                />
                <LocalePair
                  label="Caption"
                  value={pair.caption ?? {}}
                  onChange={(t) => patch({ caption: t })}
                />
              </div>
            )}
          />
        </div>
      );

    case "testimonials":
      return (
        <div className="builder-grid">
          <LocalePair
            label="Title"
            value={section.title ?? {}}
            onChange={(t) => onPatch({ title: t })}
          />
          <EnumField
            label="Display"
            value={section.display}
            options={[
              { value: "grid", label: "Grid" },
              { value: "carousel", label: "Carousel" },
            ]}
            onChange={(v) =>
              onPatch({ display: v as "grid" | "carousel" })
            }
          />
          <ItemList<TestimonialItem>
            label="Reviews"
            items={section.items}
            onChange={(items) => onPatch({ items })}
            blankItem={(id) => ({
              id,
              author: "",
              city: "",
              rating: 5,
              quote: { en: "" },
              avatar: null,
            })}
            renderItem={(item, patch) => (
              <div className="builder-grid">
                <div className="field-row">
                  <TextField
                    label="Author"
                    value={item.author}
                    onChange={(v) => patch({ author: v })}
                  />
                  <TextField
                    label="City"
                    value={item.city ?? ""}
                    onChange={(v) => patch({ city: v })}
                  />
                </div>
                <NumberField
                  label="Rating (1-5)"
                  value={item.rating ?? 5}
                  min={1}
                  max={5}
                  onChange={(v) => patch({ rating: v as 1 | 2 | 3 | 4 | 5 })}
                />
                <LocalePair
                  label="Quote"
                  value={item.quote}
                  onChange={(t) => patch({ quote: t })}
                />
              </div>
            )}
          />
        </div>
      );

    case "cta":
      return (
        <div className="builder-grid">
          <LocalePair
            label="Title"
            value={section.title}
            onChange={(t) => onPatch({ title: t })}
          />
          <LocalePair
            label="Subtitle"
            value={section.subtitle ?? {}}
            onChange={(t) => onPatch({ subtitle: t })}
          />
          <div className="field-row">
            <LocalePair
              label="Primary label"
              value={section.primaryLabel}
              onChange={(t) => onPatch({ primaryLabel: t })}
            />
            <TextField
              label="Primary href"
              value={section.primaryHref}
              onChange={(v) => onPatch({ primaryHref: v })}
            />
          </div>
          <div className="field-row">
            <LocalePair
              label="Secondary label"
              value={section.secondaryLabel ?? {}}
              onChange={(t) => onPatch({ secondaryLabel: t })}
            />
            <TextField
              label="Secondary href"
              value={section.secondaryHref ?? ""}
              onChange={(v) => onPatch({ secondaryHref: v })}
            />
          </div>
          <EnumField
            label="Variant"
            value={section.variant}
            options={[
              { value: "solid", label: "Solid" },
              { value: "outline", label: "Outline" },
              { value: "soft", label: "Soft" },
            ]}
            onChange={(v) =>
              onPatch({ variant: v as "solid" | "outline" | "soft" })
            }
          />
        </div>
      );

    case "faq":
      return (
        <div className="builder-grid">
          <LocalePair
            label="Title"
            value={section.title ?? {}}
            onChange={(t) => onPatch({ title: t })}
          />
          <ItemList<FaqItem>
            label="Questions"
            items={section.items}
            onChange={(items) => onPatch({ items })}
            blankItem={(id) => ({
              id,
              question: { en: "" },
              answer: { en: "" },
            })}
            renderItem={(item, patch) => (
              <div className="builder-grid">
                <LocalePair
                  label="Question"
                  value={item.question}
                  onChange={(t) => patch({ question: t })}
                />
                <LocalePair
                  label="Answer"
                  value={item.answer}
                  onChange={(t) => patch({ answer: t })}
                  multiline
                />
              </div>
            )}
          />
        </div>
      );

    case "sticky_cta":
      return (
        <div className="builder-grid">
          <LocalePair
            label="Label"
            value={section.label}
            onChange={(t) => onPatch({ label: t })}
          />
          <TextField
            label="Href"
            value={section.href}
            onChange={(v) => onPatch({ href: v })}
          />
          <NumberField
            label="Bottom offset (px)"
            value={section.bottomOffsetPx}
            min={0}
            max={200}
            onChange={(v) => onPatch({ bottomOffsetPx: v })}
          />
        </div>
      );

    case "video":
      return (
        <div className="builder-grid">
          <LocalePair
            label="Title"
            value={section.title ?? {}}
            onChange={(t) => onPatch({ title: t })}
          />
          <MediaSlot
            label="Video file"
            draftId={draftId}
            media={section.media}
            allowed={["video"]}
            onChange={(m) => onPatch({ media: m })}
          />
          <div className="field-row">
            <BoolField
              label="Autoplay"
              value={section.autoplay}
              onChange={(v) => onPatch({ autoplay: v })}
            />
            <BoolField
              label="Loop"
              value={section.loop}
              onChange={(v) => onPatch({ loop: v })}
            />
          </div>
          <div className="field-row">
            <BoolField
              label="Muted"
              value={section.muted}
              onChange={(v) => onPatch({ muted: v })}
            />
            <BoolField
              label="Controls"
              value={section.controls}
              onChange={(v) => onPatch({ controls: v })}
            />
          </div>
        </div>
      );

    case "image_gallery":
      return (
        <div className="builder-grid">
          <LocalePair
            label="Title"
            value={section.title ?? {}}
            onChange={(t) => onPatch({ title: t })}
          />
          <EnumField
            label="Columns"
            value={String(section.columns)}
            options={[
              { value: "2", label: "2" },
              { value: "3", label: "3" },
              { value: "4", label: "4" },
            ]}
            onChange={(v) =>
              onPatch({ columns: Number(v) as 2 | 3 | 4 })
            }
          />
          <ItemList<MediaRef>
            label="Images"
            items={section.items}
            onChange={(items) => onPatch({ items })}
            blankItem={() => ({ kind: "image", desktopSrc: "", alt: "" })}
            renderItem={(item, patch) => (
              <MediaSlot
                label="Image"
                draftId={draftId}
                media={item}
                allowed={["image", "gif"]}
                required
                onChange={(m) => m && patch(m as Partial<MediaRef>)}
              />
            )}
          />
        </div>
      );

    case "rich_text":
      return (
        <div className="builder-grid">
          <EnumField
            label="Width"
            value={section.width}
            options={[
              { value: "narrow", label: "Narrow" },
              { value: "wide", label: "Wide" },
            ]}
            onChange={(v) =>
              onPatch({ width: v as "narrow" | "wide" })
            }
          />
          <LocalePair
            label="Body (markdown-lite, **bold** allowed)"
            value={section.body}
            onChange={(t) => onPatch({ body: t })}
            multiline
          />
        </div>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Reusable inputs
// ─────────────────────────────────────────────────────────────────────────

function TextField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <label>{props.label}</label>
      <input
        type="text"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}

function NumberField(props: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <label>{props.label}</label>
      <input
        type="number"
        value={Number.isFinite(props.value) ? props.value : 0}
        min={props.min}
        max={props.max}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </div>
  );
}

function BoolField(props: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className="field"
      style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
    >
      <input
        type="checkbox"
        checked={props.value}
        onChange={(e) => props.onChange(e.target.checked)}
        style={{ width: 18, height: 18 }}
      />
      <span>{props.label}</span>
    </label>
  );
}

function EnumField(props: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <label>{props.label}</label>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function LocalePair(props: {
  label: string;
  value: { ar?: string; en?: string };
  onChange: (v: { ar?: string; en?: string }) => void;
  multiline?: boolean;
}) {
  const InputTag = props.multiline ? "textarea" : "input";
  return (
    <div className="field">
      <label>{props.label}</label>
      <div className="field-row">
        <div className="field">
          <small style={{ color: "var(--text-faint)", fontSize: 10 }}>EN</small>
          <InputTag
            {...(props.multiline ? { rows: 3 } : { type: "text" })}
            value={props.value.en ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              props.onChange({ ...props.value, en: e.target.value })
            }
          />
        </div>
        <div className="field" style={{ direction: "rtl" }}>
          <small style={{ color: "var(--text-faint)", fontSize: 10, direction: "ltr" }}>AR</small>
          <InputTag
            {...(props.multiline ? { rows: 3 } : { type: "text" })}
            value={props.value.ar ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              props.onChange({ ...props.value, ar: e.target.value })
            }
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Generic list editor — used by Benefits, FAQ, Testimonials, etc.
// ─────────────────────────────────────────────────────────────────────────

function ItemList<T extends object>(props: {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  blankItem: (id: string) => T;
  renderItem: (item: T, patch: (p: Partial<T>) => void) => React.ReactNode;
}) {
  function mkId(): string {
    return `it_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  function patch(i: number, p: Partial<T>) {
    props.onChange(
      props.items.map((it, idx) => (idx === i ? { ...it, ...p } : it)),
    );
  }
  function remove(i: number) {
    props.onChange(props.items.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const dest = i + dir;
    if (dest < 0 || dest >= props.items.length) return;
    const copy = props.items.slice();
    const [m] = copy.splice(i, 1);
    copy.splice(dest, 0, m);
    props.onChange(copy);
  }
  function add() {
    props.onChange([...props.items, props.blankItem(mkId())]);
  }
  return (
    <div className="field">
      <label>{props.label}</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {props.items.map((item, i) => (
          <div
            key={(item as { id?: string }).id ?? `i_${i}`}
            style={{
              border: "1px dashed var(--border)",
              borderRadius: 12,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-small btn-icon"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                className="btn btn-small btn-icon"
                onClick={() => move(i, 1)}
                disabled={i === props.items.length - 1}
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                className="btn btn-small btn-icon btn-danger"
                onClick={() => remove(i)}
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
            {props.renderItem(item, (p) => patch(i, p))}
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-small" onClick={add}>
        + Add
      </button>
    </div>
  );
}

export function sectionKindLabel(kind: SectionKind): string {
  return SECTION_LABELS[kind];
}
