"use client";

import { ArrowLeft, Download, Eraser, FileUp, Paintbrush, Save } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, PointerEvent, useEffect, useRef, useState } from "react";

const LOCAL_LIBRARY_KEY = "pictomesa-local-library-v1";

type DrawMode = "paint" | "erase";

type LocalPicto = {
  id: string;
  name: string;
  path: string;
  src: string;
};

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function PictoMaker() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef(false);
  const [name, setName] = useState("Picto propio");
  const [text, setText] = useState("AYUDA");
  const [bg, setBg] = useState("#ffffff");
  const [borderColor, setBorderColor] = useState("#111827");
  const [borderWidth, setBorderWidth] = useState(4);
  const [radius, setRadius] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [brushColor, setBrushColor] = useState("#f26d5b");
  const [brushSize, setBrushSize] = useState(12);
  const [drawMode, setDrawMode] = useState<DrawMode>("paint");
  const [message, setMessage] = useState("Sube una imagen o dibuja directamente sobre el lienzo.");

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx) {
      return;
    }

    const size = canvas.width;
    ctx.save();
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    if (imageRef.current) {
      const image = imageRef.current;
      const imageRatio = image.width / image.height;
      const box = size * 0.68;
      const drawWidth = imageRatio >= 1 ? box : box * imageRatio;
      const drawHeight = imageRatio >= 1 ? box / imageRatio : box;
      ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2 - 18, drawWidth, drawHeight);
    }
    ctx.restore();

    ctx.fillStyle = "#111827";
    ctx.font = "bold 54px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, size / 2, size - 74, size - 40);

    if (borderWidth > 0) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      const inset = borderWidth / 2;
      const width = size - borderWidth;
      const r = Math.min(radius, width / 2);
      ctx.beginPath();
      ctx.roundRect(inset, inset, width, width, r);
      ctx.stroke();
    }
    ctx.restore();
  };

  useEffect(() => {
    renderCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bg, borderColor, borderWidth, radius, rotation, text]);

  const loadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const dataUrl = await fileToDataUrl(file);
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setName(file.name.replace(/\.[^.]+$/, ""));
      renderCanvas();
      setMessage("Imagen cargada. Puedes pintar encima, borrar trazos, girar y descargar.");
    };
    image.src = dataUrl;
    event.target.value = "";
  };

  const drawAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx || !drawingRef.current) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    ctx.save();
    ctx.globalCompositeOperation = drawMode === "erase" ? "destination-out" : "source-over";
    ctx.fillStyle = drawMode === "erase" ? "#000000" : brushColor;
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const getPng = () => {
    renderCanvas();
    return canvasRef.current?.toDataURL("image/png") ?? "";
  };

  const saveToLibrary = () => {
    const dataUrl = getPng();
    const picto: LocalPicto = {
      id: uid("local"),
      name,
      path: `creador/${name}.png`,
      src: dataUrl,
    };

    try {
      const cached = localStorage.getItem(LOCAL_LIBRARY_KEY);
      const parsed = cached ? (JSON.parse(cached) as { path?: string; pictos?: LocalPicto[] }) : {};
      const pictos = Array.isArray(parsed.pictos) ? parsed.pictos : [];
      localStorage.setItem(
        LOCAL_LIBRARY_KEY,
        JSON.stringify({ path: parsed.path ?? "C:/pictrogramas", pictos: [picto, ...pictos] }),
      );
      setMessage("Picto guardado en la biblioteca local del navegador. Lo veras en la herramienta de tableros.");
    } catch {
      setMessage("No se pudo guardar en cache. Descargalo como PNG para conservarlo.");
    }
  };

  return (
    <main className="maker-page">
      <nav className="home-nav maker-nav" aria-label="Navegacion creador">
        <Link className="home-brand" href="/">
          <span>Amaretea</span>
          <small>Creador de pictos</small>
        </Link>
        <div>
          <Link href="/herramientas/pictogramas">Tableros</Link>
          <a href="https://amaretea.es/" target="_blank" rel="noreferrer">amaretea.es</a>
        </div>
      </nav>

      <section className="maker-shell">
        <aside className="maker-panel">
          <Link className="back-link" href="/">
            <ArrowLeft size={17} />
            Herramientas
          </Link>
          <p className="eyebrow">Picto propio</p>
          <h1>Montador rapido de pictogramas</h1>
          <p>
            Sube una imagen, anade texto, pinta encima, borra trazos y descarga un PNG listo para usar en tus tableros.
          </p>

          <label className="file-drop">
            <FileUp size={18} />
            Subir PNG/JPG
            <input className="sr-only" type="file" accept="image/*" onChange={loadImage} />
          </label>

          <div className="control-group stacked">
            <label>Nombre</label>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="control-group stacked">
            <label>Texto</label>
            <input value={text} onChange={(event) => setText(event.target.value)} />
          </div>

          <div className="maker-grid-controls">
            <label>
              Fondo
              <input type="color" value={bg} onChange={(event) => setBg(event.target.value)} />
            </label>
            <label>
              Marco
              <input type="color" value={borderColor} onChange={(event) => setBorderColor(event.target.value)} />
            </label>
            <label>
              Borde
              <input type="number" min={0} max={20} value={borderWidth} onChange={(event) => setBorderWidth(Number(event.target.value))} />
            </label>
            <label>
              Radio
              <input type="number" min={0} max={80} value={radius} onChange={(event) => setRadius(Number(event.target.value))} />
            </label>
            <label>
              Giro
              <input type="number" step={90} min={-180} max={180} value={rotation} onChange={(event) => setRotation(Number(event.target.value))} />
            </label>
            <label>
              Pincel
              <input type="number" min={2} max={50} value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
            </label>
          </div>

          <div className="segmented full">
            <button className={drawMode === "paint" ? "active" : ""} onClick={() => setDrawMode("paint")}>
              <Paintbrush size={15} />
              Pintar
            </button>
            <button className={drawMode === "erase" ? "active" : ""} onClick={() => setDrawMode("erase")}>
              <Eraser size={15} />
              Borrar
            </button>
          </div>

          <label className="brush-color">
            Color pincel
            <input type="color" value={brushColor} onChange={(event) => setBrushColor(event.target.value)} />
          </label>

          <div className="maker-actions">
            <button className="command-button secondary" onClick={() => downloadDataUrl(getPng(), `${name}.png`)}>
              <Download size={18} />
              Descargar
            </button>
            <button className="command-button primary" onClick={saveToLibrary}>
              <Save size={18} />
              Guardar
            </button>
          </div>
          <p className="local-library-message">{message}</p>
        </aside>

        <section className="maker-canvas-wrap">
          <canvas
            ref={canvasRef}
            width={900}
            height={900}
            onPointerDown={(event) => {
              drawingRef.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              drawAt(event);
            }}
            onPointerMove={drawAt}
            onPointerUp={() => {
              drawingRef.current = false;
            }}
            onPointerCancel={() => {
              drawingRef.current = false;
            }}
          />
        </section>
      </section>
    </main>
  );
}
