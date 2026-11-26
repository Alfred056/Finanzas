"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { COLOR_SWATCHES, DEFAULT_CATEGORY_COLOR, withAlpha } from "@/domain/categoryColors";
import type { Category } from "@/lib/api";

export const categoryColor = (categories: Category[], name: string) =>
  categories.find((c) => c.name === name)?.color ?? DEFAULT_CATEGORY_COLOR;

/**
 * Píldora de categoría: el color tiñe fondo, borde y punto; el texto se mantiene claro para asegurar contraste.
 * Todo va en estilos inline: el color viene de la BD y no depende del CSS generado.
 */
export function CategoryBadge({ name, color, children }: { name: string; color: string; children?: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, maxWidth: "100%",
        padding: "2px 10px", borderRadius: 9999, borderWidth: 1, borderStyle: "solid",
        backgroundColor: withAlpha(color, 0.18), borderColor: withAlpha(color, 0.6), color: "#fff",
        fontSize: 12, fontWeight: 500,
      }}
    >
      <span style={{ width: 8, height: 8, flexShrink: 0, borderRadius: 9999, backgroundColor: color, boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.2)" }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      {children}
    </span>
  );
}

/** Swatches rápidos + color libre. Envía el valor en el formulario bajo `name`. */
export function ColorPicker({ name, label }: { name: string; label: string }) {
  const [color, setColor] = useState(DEFAULT_CATEGORY_COLOR);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const form = input.current?.form;
    const reset = () => setColor(DEFAULT_CATEGORY_COLOR);
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);

  return (
    <fieldset className="col-span-2 min-w-0 text-xs text-zinc-400">
      <legend className="mb-1">{label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {COLOR_SWATCHES.map((s) => (
          <button
            key={s} type="button" aria-label={`Color ${s}`} aria-pressed={color === s} onClick={() => setColor(s)}
            className={`h-6 w-6 rounded-full border border-white/20 ${color === s ? "outline-2 outline-offset-2 outline-white" : ""}`}
            style={{ background: s }}
          />
        ))}
        <input
          ref={input} type="color" name={name} value={color} onChange={(e) => setColor(e.target.value)}
          aria-label="Color personalizado" title="Color personalizado" className="color-input"
        />
      </div>
    </fieldset>
  );
}
