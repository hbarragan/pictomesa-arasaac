"use client";

import {
  ArrowLeft,
  Download,
  FileDown,
  FileUp,
  Grid2X2,
  Image as ImageIcon,
  MessageSquare,
  MousePointer2,
  Plus,
  Search,
  Shapes,
  Type,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";

type DesignerTool = "select" | "symbol" | "text" | "shape" | "message";
type DesignerObjectKind = "symbol" | "text" | "shape" | "message";
type PickerMode = "symbol" | "shape" | null;

type DesignerObject = {
  id: string;
  kind: DesignerObjectKind;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  src?: string;
  bg: string;
  border: string;
  radius: number;
  fontSize: number;
  speak?: boolean;
};

type SymbolResult = {
  _id: number;
  keywords?: ({ keyword?: string } | string)[];
};

const DESIGNER_KEY = "amaretea-boardmaker-designer-v1";

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

function labelFromResult(result: SymbolResult) {
  const first = result.keywords?.[0];
  return typeof first === "string" ? first : first?.keyword ?? `Picto ${result._id}`;
}

function pictogramUrl(id: number) {
  return `/api/arasaac/pictograms/${id}?download=false&color=true&resolution=500&skin=white&hair=brown`;
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const templateObjects: Record<string, DesignerObject[]> = {
  blank: [],
  communication: Array.from({ length: 12 }, (_, index) => ({
    id: uid("obj"),
    kind: "symbol" as const,
    x: 50 + (index % 4) * 145,
    y: 70 + Math.floor(index / 4) * 145,
    w: 118,
    h: 118,
    text: "",
    bg: "#ffffff",
    border: "#111827",
    radius: 10,
    fontSize: 20,
    speak: true,
  })),
  firstThen: [
    {
      id: uid("obj"),
      kind: "text",
      x: 80,
      y: 40,
      w: 190,
      h: 54,
      text: "PRIMERO",
      bg: "#fef3c7",
      border: "#111827",
      radius: 8,
      fontSize: 28,
    },
    {
      id: uid("obj"),
      kind: "text",
      x: 360,
      y: 40,
      w: 190,
      h: 54,
      text: "DESPUES",
      bg: "#dcfce7",
      border: "#111827",
      radius: 8,
      fontSize: 28,
    },
  ],
};

export function BoardmakerDesigner() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [objects, setObjects] = useState<DesignerObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<DesignerTool>("select");
  const [query, setQuery] = useState("comer");
  const [results, setResults] = useState<SymbolResult[]>([]);
  const [message, setMessage] = useState("Lienzo libre: arrastra, redimensiona, imprime y exporta.");
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [template, setTemplate] = useState("blank");
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [pendingObject, setPendingObject] = useState<Partial<DesignerObject> | null>(null);
  const [expanded, setExpanded] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => objects.find((object) => object.id === selectedId) ?? null, [objects, selectedId]);

  useEffect(() => {
    queueMicrotask(() => {
      const cached = localStorage.getItem(DESIGNER_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as DesignerObject[];
          setObjects(parsed);
        } catch {
          setMessage("No pude recuperar el disenador guardado.");
        }
      }
    });
  }, []);

  useEffect(() => {
    localStorage.setItem(DESIGNER_KEY, JSON.stringify(objects));
  }, [objects]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if (!isTyping && (event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        setObjects((current) => current.filter((object) => object.id !== selectedId));
        setSelectedId(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId]);

  const runSearch = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const response = await fetch(`/api/arasaac/pictograms/es/search/${encodeURIComponent(query.trim())}`);
    if (!response.ok) {
      setMessage("No pude consultar el proveedor de pictogramas.");
      return;
    }
    const data = (await response.json()) as SymbolResult[];
    setResults(Array.isArray(data) ? data.slice(0, 24) : []);
  };

  const updateObject = (id: string, patch: Partial<DesignerObject>) => {
    setObjects((current) => current.map((object) => (object.id === id ? { ...object, ...patch } : object)));
  };

  const addObject = (kind: DesignerObjectKind, patch: Partial<DesignerObject> = {}) => {
    const object: DesignerObject = {
      id: uid("obj"),
      kind,
      x: 80,
      y: 80,
      w: kind === "message" ? 300 : 150,
      h: kind === "message" ? 110 : 130,
      text: kind === "shape" ? "" : "Texto",
      bg: kind === "text" ? "transparent" : kind === "shape" ? "#dbeafe" : "#ffffff",
      border: kind === "text" ? "transparent" : "#111827",
      radius: kind === "text" ? 0 : kind === "shape" ? 999 : 8,
      fontSize: 22,
      speak: kind === "symbol" || kind === "text" || kind === "message",
      ...patch,
    };

    setObjects((current) => [...current, object]);
    setSelectedId(object.id);
  };

  const addSymbol = (result: SymbolResult) => {
    setPendingObject({
      kind: "symbol",
      src: pictogramUrl(result._id),
      text: labelFromResult(result),
      bg: "#ffffff",
      w: 140,
      h: 150,
    });
    setPickerMode(null);
    setTool("symbol");
    setMessage("Simbolo preparado. Haz clic en el lienzo para pegarlo.");
  };

  const chooseShape = (shape: "rect" | "round" | "circle" | "message") => {
    const shapeConfig: Record<typeof shape, Partial<DesignerObject>> = {
      rect: { kind: "shape", w: 170, h: 110, bg: "#dbeafe", border: "#111827", radius: 0, text: "" },
      round: { kind: "shape", w: 170, h: 110, bg: "#dcfce7", border: "#111827", radius: 18, text: "" },
      circle: { kind: "shape", w: 130, h: 130, bg: "#fef3c7", border: "#111827", radius: 999, text: "" },
      message: { kind: "message", w: 260, h: 110, bg: "#ffffff", border: "#111827", radius: 18, text: "Mensaje" },
    };

    setPendingObject(shapeConfig[shape]);
    setPickerMode(null);
    setTool("shape");
    setMessage("Forma preparada. Haz clic en el lienzo para pegarla.");
  };

  const loadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    addObject("symbol", {
      src: await fileToDataUrl(file),
      text: file.name.replace(/\.[^.]+$/, ""),
    });
    event.target.value = "";
  };

  const onCanvasPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || tool === "select") {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const prepared = pendingObject;

    if ((tool === "symbol" || tool === "shape") && !prepared) {
      setPickerMode(tool);
      return;
    }

    addObject((prepared?.kind ?? tool) as DesignerObjectKind, { ...prepared, x, y });
    setPendingObject(null);
    setTool("select");
  };

  const exportJson = () => {
    downloadBlob(JSON.stringify(objects, null, 2), `disenador-amaretea-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
  };

  const exportPng = async () => {
    if (!canvasRef.current) {
      return;
    }

    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(canvasRef.current, {
      backgroundColor: "#ffffff",
      cacheBust: true,
      pixelRatio: 2,
    });
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `disenador-amaretea-${new Date().toISOString().slice(0, 10)}.png`;
    anchor.click();
  };

  const symbolateSelected = async () => {
    if (!selected?.text.trim()) {
      return;
    }

    const words = selected.text
      .split(/\s+/)
      .map((word) => word.replace(/[.,;:!?]/g, "").trim())
      .filter(Boolean)
      .slice(0, 8);
    const created: DesignerObject[] = [];

    for (const [index, word] of words.entries()) {
      try {
        const response = await fetch(`/api/arasaac/pictograms/es/bestsearch/${encodeURIComponent(word)}`);
        const data = response.ok ? ((await response.json()) as SymbolResult[]) : [];
        const first = data[0];
        created.push({
          id: uid("obj"),
          kind: "symbol",
          x: selected.x + index * 112,
          y: selected.y + selected.h + 18,
          w: 100,
          h: 112,
          text: word,
          src: first ? pictogramUrl(first._id) : undefined,
          bg: "#ffffff",
          border: "#111827",
          radius: 8,
          fontSize: 16,
          speak: true,
        });
      } catch {
        created.push({
          id: uid("obj"),
          kind: "text",
          x: selected.x + index * 112,
          y: selected.y + selected.h + 18,
          w: 100,
          h: 70,
          text: word,
          bg: "#ffffff",
          border: "#111827",
          radius: 8,
          fontSize: 16,
          speak: true,
        });
      }
    }

    setObjects((current) => [...current, ...created]);
    setMessage(`Symbolate creado con ${created.length} elementos.`);
  };

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const imported = JSON.parse(await file.text()) as DesignerObject[];
    if (Array.isArray(imported)) {
      setObjects(imported);
      setMessage("Disenador importado.");
    }
    event.target.value = "";
  };

  const printCanvas = () => {
    const style = document.createElement("style");
    style.id = "designer-print-style";
    style.textContent = `@page { size: A4 landscape; margin: 8mm; }`;
    document.head.appendChild(style);
    const cleanup = () => style.remove();
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1200);
  };

  return (
    <main className="designer-page">
      <nav className="home-nav maker-nav" aria-label="Navegacion disenador">
        <Link className="home-brand" href="/">
          <span>Amaretea</span>
          <small>Disenador tipo Boardmaker</small>
        </Link>
        <div>
          <Link href="/herramientas/pictogramas">Tableros</Link>
          <Link href="/herramientas/creador-pictos">Crear picto</Link>
          <Link href="/herramientas/evaluacion">Evaluacion</Link>
        </div>
      </nav>

      <section className={`designer-shell ${expanded ? "expanded" : ""}`}>
        <aside className="designer-panel">
          <Link className="back-link" href="/">
            <ArrowLeft size={17} />
            Herramientas
          </Link>
          <p className="eyebrow">Designer</p>
          <h1>Disenador libre</h1>
          <p>
            Cubre el flujo tipo Boardmaker: plantillas, objetos, simbolos, etiquetas, mensajes, estilos,
            acciones de voz, impresion y exportacion.
          </p>

          <div className="designer-toolgrid">
            <button className={tool === "select" ? "active" : ""} onClick={() => setTool("select")}><MousePointer2 size={16} /> Seleccionar</button>
            <button
              className={tool === "symbol" ? "active" : ""}
              onClick={() => {
                setTool("symbol");
                setPickerMode("symbol");
              }}
            >
              <Grid2X2 size={16} /> Simbolo
            </button>
            <button className={tool === "text" ? "active" : ""} onClick={() => setTool("text")}><Type size={16} /> Texto</button>
            <button
              className={tool === "shape" ? "active" : ""}
              onClick={() => {
                setTool("shape");
                setPickerMode("shape");
              }}
            >
              <Shapes size={16} /> Forma
            </button>
            <button className={tool === "message" ? "active" : ""} onClick={() => setTool("message")}><MessageSquare size={16} /> Mensaje</button>
            <button className={expanded ? "active" : ""} onClick={() => setExpanded((current) => !current)}>
              Ampliado
            </button>
          </div>

          <div className="control-group stacked">
            <label>Plantilla</label>
            <select
              value={template}
              onChange={(event) => {
                const next = event.target.value;
                setTemplate(next);
                setObjects(templateObjects[next]?.map((object) => ({ ...object, id: uid("obj") })) ?? []);
              }}
            >
              <option value="blank">Lienzo en blanco</option>
              <option value="communication">Comunicador 4x3</option>
              <option value="firstThen">Primero / despues</option>
            </select>
          </div>

          <div className="search-box">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void runSearch()} />
          </div>
          <button className="command-button compact" onClick={() => void runSearch()}>
            Buscar simbolos
          </button>
          <button className="command-button secondary compact" onClick={() => fileInputRef.current?.click()}>
            <ImageIcon size={16} />
            Imagen local
          </button>
          <input ref={fileInputRef} className="sr-only" type="file" accept="image/*" onChange={loadImage} />

          <div className="designer-symbols">
            {results.map((result) => {
              const label = labelFromResult(result);
              return (
                <button key={result._id} onClick={() => addSymbol(result)}>
                  <img src={pictogramUrl(result._id)} alt={label} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="designer-actions">
            <button className="command-button secondary compact" onClick={exportJson}><FileDown size={16} /> JSON</button>
            <button className="command-button secondary compact" onClick={() => void exportPng()}><Download size={16} /> PNG</button>
            <label className="command-button secondary compact">
              <FileUp size={16} />
              Importar
              <input className="sr-only" type="file" accept="application/json" onChange={importJson} />
            </label>
            <button className="command-button primary compact" onClick={printCanvas}><Download size={16} /> Imprimir</button>
          </div>
          <p className="local-library-message">{message}</p>
        </aside>

        <section className="designer-workspace">
          <div ref={canvasRef} className="designer-canvas" onPointerDown={onCanvasPointerDown}>
            {objects.map((object) => (
              <div
                key={object.id}
                className={`designer-object ${selectedId === object.id ? "selected" : ""} ${object.kind}`}
                style={{
                  left: object.x,
                  top: object.y,
                  width: object.w,
                  height: object.h,
                  backgroundColor: object.bg,
                  borderColor: object.border,
                  borderRadius: object.radius,
                  fontSize: object.fontSize,
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setSelectedId(object.id);
                  const rect = canvasRef.current?.getBoundingClientRect();
                  setDrag({
                    id: object.id,
                    dx: event.clientX - (rect?.left ?? 0) - object.x,
                    dy: event.clientY - (rect?.top ?? 0) - object.y,
                  });
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (drag?.id === object.id) {
                    const rect = canvasRef.current?.getBoundingClientRect();
                    updateObject(object.id, {
                      x: Math.max(0, event.clientX - (rect?.left ?? 0) - drag.dx),
                      y: Math.max(0, event.clientY - (rect?.top ?? 0) - drag.dy),
                    });
                  }
                }}
                onPointerUp={() => setDrag(null)}
                onDoubleClick={() => {
                  if (object.speak && object.text && "speechSynthesis" in window) {
                    window.speechSynthesis.speak(new SpeechSynthesisUtterance(object.text));
                  }
                }}
              >
                {object.src ? <img src={object.src} alt={object.text} /> : null}
                {object.text ? <span>{object.text}</span> : null}
              </div>
            ))}
          </div>
        </section>

        <aside className="designer-properties">
          <p className="eyebrow">Propiedades</p>
          {selected ? (
            <>
              <div className="control-group stacked">
                <label>Texto / etiqueta</label>
                <input value={selected.text} onChange={(event) => updateObject(selected.id, { text: event.target.value })} />
              </div>
              <div className="designer-prop-grid">
                <label>X<input type="number" value={Math.round(selected.x)} onChange={(event) => updateObject(selected.id, { x: Number(event.target.value) })} /></label>
                <label>Y<input type="number" value={Math.round(selected.y)} onChange={(event) => updateObject(selected.id, { y: Number(event.target.value) })} /></label>
                <label>Ancho<input type="number" value={Math.round(selected.w)} onChange={(event) => updateObject(selected.id, { w: Number(event.target.value) })} /></label>
                <label>Alto<input type="number" value={Math.round(selected.h)} onChange={(event) => updateObject(selected.id, { h: Number(event.target.value) })} /></label>
                <label>Texto<input type="number" value={selected.fontSize} onChange={(event) => updateObject(selected.id, { fontSize: Number(event.target.value) })} /></label>
                <label>Radio<input type="number" value={selected.radius} onChange={(event) => updateObject(selected.id, { radius: Number(event.target.value) })} /></label>
              </div>
              <div className="designer-prop-grid">
                <label>Fondo<input type="color" value={selected.bg} onChange={(event) => updateObject(selected.id, { bg: event.target.value })} /></label>
                <label>Marco<input type="color" value={selected.border} onChange={(event) => updateObject(selected.id, { border: event.target.value })} /></label>
              </div>
              <label className="toggle-line">
                <input type="checkbox" checked={Boolean(selected.speak)} onChange={(event) => updateObject(selected.id, { speak: event.target.checked })} />
                <Volume2 size={16} />
                Leer al hacer doble clic
              </label>
              <div className="designer-actions">
                <button className="command-button secondary compact" onClick={() => void symbolateSelected()}>
                  Symbolate
                </button>
                <button
                  className="command-button secondary compact"
                  onClick={() =>
                    setObjects((current) => [...current.filter((object) => object.id !== selected.id), selected])
                  }
                >
                  Delante
                </button>
                <button
                  className="command-button secondary compact"
                  onClick={() =>
                    setObjects((current) => [selected, ...current.filter((object) => object.id !== selected.id)])
                  }
                >
                  Detras
                </button>
                <button className="command-button secondary compact" onClick={() => setObjects((current) => [...current, { ...selected, id: uid("obj"), x: selected.x + 20, y: selected.y + 20 }])}>
                  <Plus size={16} />
                  Duplicar
                </button>
                <button className="command-button danger compact" onClick={() => setObjects((current) => current.filter((object) => object.id !== selected.id))}>
                  Eliminar
                </button>
              </div>
            </>
          ) : (
            <p className="muted">Selecciona un objeto del lienzo para editarlo.</p>
          )}
        </aside>
      </section>

      {pickerMode ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="designer-picker-title">
          <div className="modal designer-picker-modal">
            <h2 id="designer-picker-title">{pickerMode === "symbol" ? "Seleccionar simbolo" : "Seleccionar forma"}</h2>
            {pickerMode === "symbol" ? (
              <>
                <div className="search-box">
                  <Search size={18} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && void runSearch()}
                    autoFocus
                  />
                </div>
                <button className="command-button compact" onClick={() => void runSearch()}>
                  Buscar simbolos
                </button>
                <div className="designer-symbols picker">
                  {results.map((result) => {
                    const label = labelFromResult(result);
                    return (
                      <button key={result._id} onClick={() => addSymbol(result)}>
                        <img src={pictogramUrl(result._id)} alt={label} />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="shape-picker-grid">
                <button onClick={() => chooseShape("rect")}><span className="shape-preview rect" /> Rectangulo</button>
                <button onClick={() => chooseShape("round")}><span className="shape-preview round" /> Redondeado</button>
                <button onClick={() => chooseShape("circle")}><span className="shape-preview circle" /> Circulo</button>
                <button onClick={() => chooseShape("message")}><span className="shape-preview message" /> Mensaje</button>
              </div>
            )}
            <button className="command-button secondary" onClick={() => setPickerMode(null)}>
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
