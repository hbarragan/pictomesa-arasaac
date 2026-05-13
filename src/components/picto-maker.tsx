"use client";

import { ArrowLeft, Download, Eraser, FileUp, Layers3, Move, Paintbrush, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppNav } from "@/components/app-nav";

const LOCAL_LIBRARY_KEY = "pictomesa-local-library-v1";

type DrawMode = "move" | "paint" | "erase";

type LocalPicto = {
  id: string;
  name: string;
  path: string;
  src: string;
};

type MakerLayer = {
  id: string;
  name: string;
  src: string;
  baseWidth: number;
  baseHeight: number;
  width: number;
  height: number;
  x: number;
  y: number;
  rotation: number;
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
  const imageCacheRef = useRef<Record<string, HTMLImageElement>>({});
  const inkCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const dragLayerRef = useRef<{ dx: number; dy: number; id: string } | null>(null);
  const [name, setName] = useState("Picto propio");
  const [text, setText] = useState("AYUDA");
  const [bg, setBg] = useState("#ffffff");
  const [borderColor, setBorderColor] = useState("#111827");
  const [borderWidth, setBorderWidth] = useState(4);
  const [radius, setRadius] = useState(0);
  const [brushColor, setBrushColor] = useState("#111827");
  const [brushSize, setBrushSize] = useState(12);
  const [drawMode, setDrawMode] = useState<DrawMode>("move");
  const [layers, setLayers] = useState<MakerLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [message, setMessage] = useState("Sube una o varias imagenes, muevelas y dibuja solo cuando lo necesites.");

  const selectedLayer = useMemo(
    () => layers.find((layer) => layer.id === selectedLayerId) ?? null,
    [layers, selectedLayerId],
  );
  const selectedLayerScale = useMemo(() => {
    if (!selectedLayer || selectedLayer.baseWidth <= 0) {
      return 100;
    }

    return Math.round((selectedLayer.width / selectedLayer.baseWidth) * 100);
  }, [selectedLayer]);

  const updateLayer = (id: string, patch: Partial<MakerLayer>) => {
    setLayers((current) => current.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)));
  };

  const resizeLayerToScale = (id: string, scalePercent: number) => {
    setLayers((current) =>
      current.map((layer) => {
        if (layer.id !== id) {
          return layer;
        }

        const nextScale = Math.min(320, Math.max(20, scalePercent));
        return {
          ...layer,
          width: (layer.baseWidth * nextScale) / 100,
          height: (layer.baseHeight * nextScale) / 100,
        };
      }),
    );
  };

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

    layers.forEach((layer) => {
      const image = imageCacheRef.current[layer.id];

      if (!image) {
        return;
      }

      ctx.save();
      ctx.translate(layer.x, layer.y);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.drawImage(image, -layer.width / 2, -layer.height / 2, layer.width, layer.height);

      if (layer.id === selectedLayerId) {
        ctx.strokeStyle = "#117c7a";
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 8]);
        ctx.strokeRect(-layer.width / 2, -layer.height / 2, layer.width, layer.height);
        ctx.setLineDash([]);
      }

      ctx.restore();
    });

    if (inkCanvasRef.current) {
      ctx.drawImage(inkCanvasRef.current, 0, 0, size, size);
    }

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
  }, [bg, borderColor, borderWidth, layers, radius, selectedLayerId, text]);

  const loadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      event.target.value = "";
      setMessage("Seleccion de imagen cancelada.");
      return;
    }

    const canvas = canvasRef.current;
    const size = canvas?.width ?? 900;
    const nextLayers: MakerLayer[] = [];

    for (const [index, file] of files.entries()) {
      const src = await fileToDataUrl(file);
      const image = new Image();

      await new Promise<void>((resolve) => {
        image.onload = () => resolve();
        image.src = src;
      });

      const id = uid("layer");
      imageCacheRef.current[id] = image;
      const imageRatio = image.width / image.height;
      const box = size * 0.36;
      const width = imageRatio >= 1 ? box : box * imageRatio;
      const height = imageRatio >= 1 ? box / imageRatio : box;

      nextLayers.push({
        id,
        name: file.name.replace(/\.[^.]+$/, ""),
        src,
        baseWidth: width,
        baseHeight: height,
        width,
        height,
        x: size / 2 + index * 26 - files.length * 13,
        y: size / 2 - 36 + index * 26,
        rotation: 0,
      });
    }

    setLayers((current) => [...current, ...nextLayers]);
    setSelectedLayerId(nextLayers.at(-1)?.id ?? null);
    if (files.length === 1) {
      setName(nextLayers[0]?.name ?? name);
    } else {
      setName("Montaje pictos");
    }
    setDrawMode("move");
    setMessage(`${files.length} imagen${files.length === 1 ? "" : "es"} cargada${files.length === 1 ? "" : "s"}. Puedes moverlas, girarlas y dibujar encima.`);
    event.target.value = "";
  };

  const canvasPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const hitLayer = (x: number, y: number) => {
    for (let index = layers.length - 1; index >= 0; index -= 1) {
      const layer = layers[index];
      if (
        x >= layer.x - layer.width / 2 &&
        x <= layer.x + layer.width / 2 &&
        y >= layer.y - layer.height / 2 &&
        y <= layer.y + layer.height / 2
      ) {
        return layer;
      }
    }

    return null;
  };

  const drawAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx || !drawingRef.current) {
      return;
    }

    if (!inkCanvasRef.current) {
      inkCanvasRef.current = document.createElement("canvas");
      inkCanvasRef.current.width = canvas.width;
      inkCanvasRef.current.height = canvas.height;
    }

    const inkContext = inkCanvasRef.current.getContext("2d");
    if (!inkContext) {
      return;
    }

    const point = canvasPoint(event);
    if (!point) {
      return;
    }

    inkContext.save();
    inkContext.globalCompositeOperation = drawMode === "erase" ? "destination-out" : "source-over";
    inkContext.fillStyle = drawMode === "erase" ? "#000000" : brushColor;
    inkContext.beginPath();
    inkContext.arc(point.x, point.y, brushSize, 0, Math.PI * 2);
    inkContext.fill();
    inkContext.restore();
    renderCanvas();
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
      <AppNav current="creador" subtitle="Creador de pictos" />

      <section className="maker-shell">
        <aside className="maker-panel">
          <Link className="back-link" href="/">
            <ArrowLeft size={17} />
            Herramientas
          </Link>
          <p className="eyebrow">Picto propio</p>
          <h1>Montador rapido de pictogramas</h1>
          <p>
            Sube una o varias imagenes, muevelas en el lienzo, anade texto, pinta encima y descarga un PNG listo para usar.
          </p>

          <label className="file-drop">
            <FileUp size={18} />
            Subir una o varias imagenes
            <input className="sr-only" type="file" accept="image/*" multiple onChange={loadImage} />
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
              <input
                type="number"
                step={15}
                min={-180}
                max={180}
                value={selectedLayer?.rotation ?? 0}
                onChange={(event) => selectedLayer && updateLayer(selectedLayer.id, { rotation: Number(event.target.value) })}
                disabled={!selectedLayer}
              />
            </label>
            <label>
              Tamano
              <input
                type="number"
                min={20}
                max={320}
                step={10}
                value={selectedLayerScale}
                onChange={(event) => selectedLayer && resizeLayerToScale(selectedLayer.id, Number(event.target.value))}
                disabled={!selectedLayer}
              />
            </label>
            <label>
              Pincel
              <input type="number" min={2} max={50} value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
            </label>
          </div>

          <div className="segmented full">
            <button className={drawMode === "move" ? "active" : ""} onClick={() => setDrawMode("move")}>
              <Move size={15} />
              Mover
            </button>
            <button className={drawMode === "paint" ? "active" : ""} onClick={() => setDrawMode("paint")}>
              <Paintbrush size={15} />
              Pintar
            </button>
            <button className={drawMode === "erase" ? "active" : ""} onClick={() => setDrawMode("erase")}>
              <Eraser size={15} />
              Borrar
            </button>
          </div>

          <div className="maker-layer-panel">
            <div className="designer-title">
              <Layers3 size={16} />
              Imagenes subidas
            </div>
            {layers.length > 0 ? (
              <div className="maker-layer-list">
                {layers.slice().reverse().map((layer) => (
                  <button
                    key={layer.id}
                    className={`maker-layer-item ${selectedLayerId === layer.id ? "active" : ""}`}
                    onClick={() => setSelectedLayerId(layer.id)}
                  >
                    {layer.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted">Aun no has subido imagenes.</p>
            )}
            <div className="maker-actions compact">
              <button
                className="command-button secondary compact"
                onClick={() => selectedLayer && resizeLayerToScale(selectedLayer.id, selectedLayerScale - 10)}
                disabled={!selectedLayer}
              >
                Mas pequena
              </button>
              <button
                className="command-button secondary compact"
                onClick={() => selectedLayer && resizeLayerToScale(selectedLayer.id, selectedLayerScale + 10)}
                disabled={!selectedLayer}
              >
                Mas grande
              </button>
              <button
                className="command-button secondary compact"
                onClick={() => {
                  if (!selectedLayer) {
                    return;
                  }
                  setLayers((current) => [...current.filter((layer) => layer.id !== selectedLayer.id), selectedLayer]);
                }}
                disabled={!selectedLayer}
              >
                Delante
              </button>
              <button
                className="command-button secondary compact"
                onClick={() => {
                  if (!selectedLayer) {
                    return;
                  }
                  setLayers((current) => [selectedLayer, ...current.filter((layer) => layer.id !== selectedLayer.id)]);
                }}
                disabled={!selectedLayer}
              >
                Detras
              </button>
              <button
                className="command-button danger compact"
                onClick={() => {
                  if (!selectedLayer) {
                    return;
                  }
                  setLayers((current) => current.filter((layer) => layer.id !== selectedLayer.id));
                  setSelectedLayerId(null);
                }}
                disabled={!selectedLayer}
              >
                <Trash2 size={15} />
                Quitar
              </button>
            </div>
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
            style={{ cursor: drawMode === "move" ? "grab" : drawMode === "erase" ? "cell" : "crosshair" }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              const point = canvasPoint(event);
              if (!point) {
                return;
              }

              if (drawMode === "move") {
                const hit = hitLayer(point.x, point.y);
                setSelectedLayerId(hit?.id ?? null);
                if (hit) {
                  dragLayerRef.current = {
                    dx: point.x - hit.x,
                    dy: point.y - hit.y,
                    id: hit.id,
                  };
                }
                return;
              }

              drawingRef.current = true;
              drawAt(event);
            }}
            onPointerMove={(event) => {
              if (drawMode === "move") {
                const point = canvasPoint(event);
                if (!point || !dragLayerRef.current) {
                  return;
                }
                updateLayer(dragLayerRef.current.id, {
                  x: point.x - dragLayerRef.current.dx,
                  y: point.y - dragLayerRef.current.dy,
                });
                return;
              }

              drawAt(event);
            }}
            onPointerUp={() => {
              drawingRef.current = false;
              dragLayerRef.current = null;
            }}
            onPointerCancel={() => {
              drawingRef.current = false;
              dragLayerRef.current = null;
            }}
          />
        </section>
      </section>
    </main>
  );
}
