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
  RotateCw,
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
  shapeType?: string;
  bg: string;
  border: string;
  radius: number;
  fontSize: number;
  rotation: number;
  speak?: boolean;
};

const DESIGNER_KEY = "amaretea-boardmaker-designer-v1";
const ASCII_SYMBOLS = ["OK", "X", "?", "!", "+", "-", "=", "*", "#", "@", "->", "<-", "^", "v", "<->", ":)", ":(", ":|", "1", "2", "3", "A", "B", "C"];
const RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type ResizeHandle = (typeof RESIZE_HANDLES)[number];
type ShapeChoice =
  | "rect"
  | "round"
  | "circle"
  | "message"
  | "line"
  | "arrow-right"
  | "arrow-left"
  | "arrow-up"
  | "arrow-down"
  | "double-arrow"
  | "curve-right"
  | "curve-left";

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
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

function displayFontSize(object: DesignerObject) {
  if (object.kind !== "symbol" || object.src || !object.text) {
    return object.fontSize;
  }

  const textFactor = Math.max(1, object.text.length * 0.58);
  const fittedByWidth = object.w / textFactor;
  const fittedByHeight = object.h * 0.82;
  return Math.max(object.fontSize, Math.min(fittedByWidth, fittedByHeight));
}

function asciiArrowShape(symbol: string) {
  const shapes: Record<string, string> = {
    "->": "ascii-arrow-right",
    "<-": "ascii-arrow-left",
    "<->": "ascii-arrow-double",
    "^": "ascii-arrow-up",
    v: "ascii-arrow-down",
  };

  return shapes[symbol];
}

function normalizeDesignerObject(object: Partial<DesignerObject>) {
  return {
    id: object.id ?? uid("obj"),
    kind: object.kind ?? "symbol",
    x: object.x ?? 80,
    y: object.y ?? 80,
    w: object.w ?? 150,
    h: object.h ?? 130,
    text: object.text ?? "",
    src: object.src,
    shapeType: object.shapeType,
    bg: object.bg ?? "#ffffff",
    border: object.border ?? "#111827",
    radius: object.radius ?? 8,
    fontSize: object.fontSize ?? 22,
    rotation: object.rotation ?? 0,
    speak: object.speak,
  } satisfies DesignerObject;
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
    rotation: 0,
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
      rotation: 0,
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
      rotation: 0,
    },
  ],
};

export function BoardmakerDesigner() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [objects, setObjects] = useState<DesignerObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<DesignerTool>("select");
  const [message, setMessage] = useState("Lienzo libre: arrastra, redimensiona, imprime y exporta.");
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [resize, setResize] = useState<{
    handle: ResizeHandle;
    id: string;
    startH: number;
    startW: number;
    startX: number;
    startY: number;
    startObjectX: number;
    startObjectY: number;
  } | null>(null);
  const [rotate, setRotate] = useState<{
    centerX: number;
    centerY: number;
    id: string;
    startAngle: number;
    startRotation: number;
  } | null>(null);
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
          setObjects(parsed.map((object) => normalizeDesignerObject(object)));
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

  useEffect(() => {
    if (!resize) {
      return;
    }

    const onPointerMove = (event: globalThis.PointerEvent) => {
      const dx = event.clientX - resize.startX;
      const dy = event.clientY - resize.startY;
      const minW = 32;
      const minH = 28;
      let nextX = resize.startObjectX;
      let nextY = resize.startObjectY;
      let nextW = resize.startW;
      let nextH = resize.startH;

      if (resize.handle.includes("e")) {
        nextW = resize.startW + dx;
      }
      if (resize.handle.includes("s")) {
        nextH = resize.startH + dy;
      }
      if (resize.handle.includes("w")) {
        nextW = resize.startW - dx;
        nextX = resize.startObjectX + dx;
      }
      if (resize.handle.includes("n")) {
        nextH = resize.startH - dy;
        nextY = resize.startObjectY + dy;
      }

      if (nextW < minW) {
        if (resize.handle.includes("w")) {
          nextX = resize.startObjectX + resize.startW - minW;
        }
        nextW = minW;
      }
      if (nextH < minH) {
        if (resize.handle.includes("n")) {
          nextY = resize.startObjectY + resize.startH - minH;
        }
        nextH = minH;
      }

      setObjects((current) =>
        current.map((object) =>
          object.id === resize.id
            ? {
                ...object,
                h: nextH,
                w: nextW,
                x: Math.max(0, nextX),
                y: Math.max(0, nextY),
              }
            : object,
        ),
      );
    };

    const onPointerUp = () => setResize(null);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [resize]);

  useEffect(() => {
    if (!rotate) {
      return;
    }

    const onPointerMove = (event: globalThis.PointerEvent) => {
      const currentAngle = Math.atan2(event.clientY - rotate.centerY, event.clientX - rotate.centerX);
      const deltaDegrees = ((currentAngle - rotate.startAngle) * 180) / Math.PI;

      setObjects((current) =>
        current.map((object) =>
          object.id === rotate.id
            ? {
                ...object,
                rotation: Math.round(rotate.startRotation + deltaDegrees),
              }
            : object,
        ),
      );
    };

    const onPointerUp = () => setRotate(null);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [rotate]);

  const updateObject = (id: string, patch: Partial<DesignerObject>) => {
    setObjects((current) => current.map((object) => (object.id === id ? { ...object, ...patch } : object)));
  };

  const addObject = (kind: DesignerObjectKind, patch: Partial<DesignerObject> = {}) => {
    const object = normalizeDesignerObject({
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
      rotation: 0,
      speak: kind === "symbol" || kind === "text" || kind === "message",
      ...patch,
    });

    setObjects((current) => [...current, object]);
    setSelectedId(object.id);
  };

  const chooseAsciiSymbol = (symbol: string) => {
    const shapeType = asciiArrowShape(symbol);

    setPendingObject({
      kind: "symbol",
      src: undefined,
      text: symbol,
      bg: "transparent",
      border: shapeType ? "#111827" : "transparent",
      radius: 0,
      shapeType,
      fontSize: 44,
      w: 96,
      h: 72,
      rotation: 0,
      speak: false,
    });
    setPickerMode(null);
    setTool("symbol");
    setMessage("Simbolo ASCII preparado. Haz clic en el lienzo para pegarlo.");
  };

  const chooseShape = (shape: ShapeChoice) => {
    const shapeConfig: Record<ShapeChoice, Partial<DesignerObject>> = {
      rect: { kind: "shape", shapeType: "rect", w: 170, h: 110, bg: "#dbeafe", border: "#111827", radius: 0, text: "" },
      round: { kind: "shape", shapeType: "round", w: 170, h: 110, bg: "#dcfce7", border: "#111827", radius: 18, text: "" },
      circle: { kind: "shape", shapeType: "circle", w: 130, h: 130, bg: "#fef3c7", border: "#111827", radius: 999, text: "" },
      message: { kind: "message", shapeType: "message", w: 260, h: 110, bg: "#ffffff", border: "#111827", radius: 18, text: "Mensaje" },
      line: { kind: "shape", shapeType: "line", w: 220, h: 30, bg: "transparent", border: "#111827", radius: 0, text: "" },
      "arrow-right": { kind: "shape", shapeType: "arrow-right", w: 220, h: 42, bg: "transparent", border: "#111827", radius: 0, text: "" },
      "arrow-left": { kind: "shape", shapeType: "arrow-left", w: 220, h: 42, bg: "transparent", border: "#111827", radius: 0, text: "" },
      "arrow-up": { kind: "shape", shapeType: "arrow-up", w: 42, h: 220, bg: "transparent", border: "#111827", radius: 0, text: "" },
      "arrow-down": { kind: "shape", shapeType: "arrow-down", w: 42, h: 220, bg: "transparent", border: "#111827", radius: 0, text: "" },
      "double-arrow": { kind: "shape", shapeType: "double-arrow", w: 240, h: 42, bg: "transparent", border: "#111827", radius: 0, text: "" },
      "curve-right": { kind: "shape", shapeType: "curve-right", w: 170, h: 120, bg: "transparent", border: "#111827", radius: 0, text: "" },
      "curve-left": { kind: "shape", shapeType: "curve-left", w: 170, h: 120, bg: "transparent", border: "#111827", radius: 0, text: "" },
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

    const words = selected.text.split(/\s+/).filter(Boolean).slice(0, 8);
    const created: DesignerObject[] = words.map((word, index) => ({
      id: uid("obj"),
      kind: "symbol",
      x: selected.x + index * 86,
      y: selected.y + selected.h + 18,
      w: 76,
      h: 58,
      text: word.slice(0, 2).toUpperCase(),
      bg: "transparent",
      border: "transparent",
      radius: 0,
      fontSize: 28,
      rotation: 0,
      speak: false,
    }));

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
      setObjects(imported.map((object) => normalizeDesignerObject(object)));
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

  const startResize = (event: PointerEvent<HTMLButtonElement>, object: DesignerObject, handle: ResizeHandle) => {
    event.stopPropagation();
    setSelectedId(object.id);
    setDrag(null);
    setRotate(null);
    setResize({
      handle,
      id: object.id,
      startH: object.h,
      startW: object.w,
      startX: event.clientX,
      startY: event.clientY,
      startObjectX: object.x,
      startObjectY: object.y,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startRotate = (event: PointerEvent<HTMLButtonElement>, object: DesignerObject) => {
    event.stopPropagation();
    setSelectedId(object.id);
    setDrag(null);
    setResize(null);

    const rect = canvasRef.current?.getBoundingClientRect();
    const centerX = (rect?.left ?? 0) + object.x + object.w / 2;
    const centerY = (rect?.top ?? 0) + object.y + object.h / 2;

    setRotate({
      centerX,
      centerY,
      id: object.id,
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
      startRotation: object.rotation,
    });

    event.currentTarget.setPointerCapture(event.pointerId);
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
                setObjects(templateObjects[next]?.map((object) => normalizeDesignerObject({ ...object, id: uid("obj") })) ?? []);
              }}
            >
              <option value="blank">Lienzo en blanco</option>
              <option value="communication">Comunicador 4x3</option>
              <option value="firstThen">Primero / despues</option>
            </select>
          </div>

          <button className="command-button compact" onClick={() => setPickerMode("symbol")}>
            Abrir simbolos ASCII
          </button>
          <button className="command-button secondary compact" onClick={() => setPickerMode("shape")}>
            <Shapes size={16} />
            Formas y conectores
          </button>
          <button className="command-button secondary compact" onClick={() => fileInputRef.current?.click()}>
            <ImageIcon size={16} />
            Imagen local
          </button>
          <input ref={fileInputRef} className="sr-only" type="file" accept="image/*" onChange={loadImage} />

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
            {objects.map((object) => {
              const isStretchArrow = Boolean(object.shapeType?.startsWith("ascii-arrow"));

              return (
                <div
                  key={object.id}
                  className={`designer-object ${selectedId === object.id ? "selected" : ""} ${object.kind} shape-${object.shapeType ?? "plain"}`}
                  style={{
                    left: object.x,
                    top: object.y,
                    width: object.w,
                    height: object.h,
                    backgroundColor: object.bg,
                    borderColor: object.border,
                    borderRadius: object.radius,
                    color:
                    object.shapeType?.includes("arrow") || object.shapeType?.includes("curve") || object.shapeType === "line"
                        ? object.border
                        : undefined,
                    fontSize: displayFontSize(object),
                    transform: `rotate(${object.rotation}deg)`,
                    transformOrigin: "center center",
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    if (resize || rotate) {
                      return;
                    }
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
                  onPointerUp={() => {
                    setDrag(null);
                    setResize(null);
                    setRotate(null);
                  }}
                  onDoubleClick={() => {
                    if (object.speak && object.text && "speechSynthesis" in window) {
                      window.speechSynthesis.speak(new SpeechSynthesisUtterance(object.text));
                    }
                  }}
                >
                  {object.src ? <img src={object.src} alt={object.text} /> : null}
                  {object.text && !isStretchArrow ? <span>{object.text}</span> : null}
                  {selectedId === object.id
                    ? RESIZE_HANDLES.map((handle) => (
                        <button
                          key={handle}
                          aria-label={`Redimensionar ${handle}`}
                          className={`resize-handle ${handle}`}
                          onPointerDown={(event) => startResize(event, object, handle)}
                          onPointerUp={() => setResize(null)}
                        />
                      ))
                    : null}
                  <button
                    aria-label="Rotar objeto"
                    className="rotate-handle"
                    onPointerDown={(event) => startRotate(event, object)}
                    onPointerUp={() => setRotate(null)}
                  >
                    <RotateCw size={14} />
                  </button>
                </div>
              );
            })}
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
                <label>Rotacion<input type="number" value={selected.rotation} onChange={(event) => updateObject(selected.id, { rotation: Number(event.target.value) })} /></label>
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
                <button className="command-button secondary compact" onClick={() => updateObject(selected.id, { rotation: selected.rotation - 15 })}>
                  Girar -15
                </button>
                <button className="command-button secondary compact" onClick={() => updateObject(selected.id, { rotation: selected.rotation + 15 })}>
                  Girar +15
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
              <div className="ascii-symbol-grid">
                {ASCII_SYMBOLS.map((symbol) => (
                  <button key={symbol} onClick={() => chooseAsciiSymbol(symbol)}>
                    <span>{symbol}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="shape-picker-grid">
                <button onClick={() => chooseShape("rect")}><span className="shape-preview rect" /> Rectangulo</button>
                <button onClick={() => chooseShape("round")}><span className="shape-preview round" /> Redondeado</button>
                <button onClick={() => chooseShape("circle")}><span className="shape-preview circle" /> Circulo</button>
                <button onClick={() => chooseShape("message")}><span className="shape-preview message" /> Mensaje</button>
                <button onClick={() => chooseShape("line")}><span className="shape-preview connector line" /> Linea</button>
                <button onClick={() => chooseShape("arrow-right")}><span className="shape-preview connector arrow-right" /> Flecha derecha</button>
                <button onClick={() => chooseShape("arrow-left")}><span className="shape-preview connector arrow-left" /> Flecha izquierda</button>
                <button onClick={() => chooseShape("arrow-up")}><span className="shape-preview connector arrow-up" /> Flecha arriba</button>
                <button onClick={() => chooseShape("arrow-down")}><span className="shape-preview connector arrow-down" /> Flecha abajo</button>
                <button onClick={() => chooseShape("double-arrow")}><span className="shape-preview connector double-arrow" /> Doble flecha</button>
                <button onClick={() => chooseShape("curve-right")}><span className="shape-preview connector curve-right" /> Flecha curva derecha</button>
                <button onClick={() => chooseShape("curve-left")}><span className="shape-preview connector curve-left" /> Flecha curva izquierda</button>
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
