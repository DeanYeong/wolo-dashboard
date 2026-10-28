import Link from "next/link";
import type { ValueItem } from "./SettingsForm";

// Core values, shown at the bottom of every signed-in page. Editing happens on the Update page.
export default function Footer({ values, editHref }: { values: ValueItem[]; editHref?: string }) {
  const shown = values.filter((v) => v.t.trim() || v.d.trim());
  if (!shown.length && !editHref) return null;
  return (
    <footer className="footer" aria-label="Core values">
      <p className="eyebrow">Core values</p>
      {shown.length ? (
        <div className="grid4">
          {shown.map((v, i) => (
            <div className="val" key={i}>
              <h3>{v.t || "Untitled"}</h3>
              {v.d && <p>{v.d}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="empty">Not written yet. <Link href={editHref!}>Add them</Link></p>
      )}
    </footer>
  );
}
