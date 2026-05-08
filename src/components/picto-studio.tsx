"use client";

import {
  ArrowDownToLine,
  Bot,
  Columns3,
  Copy,
  Download,
  Eraser,
  FileDown,
  FileUp,
  Grid2X2,
  Info,
  Layers3,
  Library,
  Plus,
  Printer,
  Rows3,
  Save,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Volume2,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type Language = "es" | "en" | "fr" | "pt" | "ca" | "it" | "de";
type SearchMode = "search" | "bestsearch" | "new";
type LabelPosition = "bottom" | "top";
type PrintOrientation = "portrait" | "landscape";
type PictoSource = "arasaac" | "local";

type ImageOptions = {
  color: boolean;
  resolution: 500 | 2500;
  skin: SkinKey;
  hair: HairKey;
};

type PictoCell = {
  id: string;
  label: string;
  source?: PictoSource;
  pictoId?: number;
  localPictoId?: string;
  localSrc?: string;
  bg: string;
  options: ImageOptions;
  note?: string;
};

type Board = {
  id: string;
  title: string;
  rows: number;
  cols: number;
  gap: number;
  labelPosition: LabelPosition;
  fontSize: number;
  printCellCm?: number;
  cells: PictoCell[];
};

type Project = {
  id: string;
  name: string;
  updatedAt: string;
  activeBoardId: string;
  boards: Board[];
};

type PictoKeyword = {
  keyword?: string;
  plural?: string;
  meaning?: string;
};

type PictoResult = {
  _id: number;
  keywords?: PictoKeyword[] | string[];
  tags?: string[];
  categories?: string[];
  skin?: boolean;
  hair?: boolean;
  aac?: boolean;
  aacColor?: boolean;
  schematic?: boolean;
};

type LocalPicto = {
  id: string;
  name: string;
  path: string;
  src: string;
};

type DragPictoPayload =
  | { source: "arasaac"; id: number; label: string; aac?: boolean; aacColor?: boolean }
  | { source: "local"; id: string; label: string; src: string };

type SkinKey = "white" | "black" | "assian" | "mulatto" | "aztec";
type HairKey = "brown" | "blonde" | "red" | "black" | "gray" | "darkGray" | "darkBrown";

const CACHE_KEY = "pictomesa-projects-v1";
const ACTIVE_KEY = "pictomesa-active-project-v1";
const LOCAL_LIBRARY_KEY = "pictomesa-local-library-v1";

const languages: { code: Language; label: string }[] = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "pt", label: "PT" },
  { code: "ca", label: "CA" },
  { code: "it", label: "IT" },
  { code: "de", label: "DE" },
];

const skinColors: Record<SkinKey, string> = {
  white: "#F5E5DE",
  black: "#A65C17",
  assian: "#F4ECAD",
  mulatto: "#E3AB72",
  aztec: "#CF9D7C",
};

const hairColors: Record<HairKey, string> = {
  brown: "#A65E26",
  blonde: "#FDD700",
  red: "#ED4120",
  black: "#020100",
  gray: "#E1E1E1",
  darkGray: "#AAABAB",
  darkBrown: "#6A2703",
};

const cellColors = [
  "#ffffff",
  "#fef3c7",
  "#dbeafe",
  "#dcfce7",
  "#fee2e2",
  "#f3e8ff",
  "#e0f2fe",
  "#f1f5f9",
  "#111827",
];

const defaultOptions: ImageOptions = {
  color: true,
  resolution: 500,
  skin: "white",
  hair: "brown",
};

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

function makeCells(count: number): PictoCell[] {
  return Array.from({ length: count }, () => ({
    id: uid("cell"),
    label: "",
    bg: "#ffffff",
    options: { ...defaultOptions },
  }));
}

function makeBoard(title = "Tablero principal", rows = 4, cols = 5): Board {
  return {
    id: uid("board"),
    title,
    rows,
    cols,
    gap: 10,
    labelPosition: "bottom",
    fontSize: 18,
    printCellCm: 5,
    cells: makeCells(rows * cols),
  };
}

function makeProject(name = "Mi tablero Amaretea"): Project {
  const board = makeBoard();

  return {
    id: uid("project"),
    name,
    updatedAt: new Date().toISOString(),
    activeBoardId: board.id,
    boards: [board],
  };
}

function getKeywordLabel(result: PictoResult) {
  const first = result.keywords?.[0];

  if (!first) {
    return `Picto ${result._id}`;
  }

  if (typeof first === "string") {
    return first;
  }

  return first.keyword ?? `Picto ${result._id}`;
}

function getAllWords(result: PictoResult) {
  return (result.keywords ?? [])
    .map((keyword) => (typeof keyword === "string" ? keyword : keyword.keyword))
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
}

function pictogramUrl(id: number, options: ImageOptions) {
  const params = new URLSearchParams({
    download: "false",
    color: String(options.color),
    resolution: String(options.resolution),
    skin: options.skin,
    hair: options.hair,
  });

  return `/api/arasaac/pictograms/${id}?${params.toString()}`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function labelFromFileName(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

function isImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(file.name);
}

function resizeCells(board: Board, rows: number, cols: number) {
  const total = rows * cols;
  const cells = board.cells.slice(0, total);

  while (cells.length < total) {
    cells.push(...makeCells(1));
  }

  return { ...board, rows, cols, cells };
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

export function PictoStudio() {
  const [projects, setProjects] = useState<Project[]>([makeProject()]);
  const [activeProjectId, setActiveProjectId] = useState(projects[0].id);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [query, setQuery] = useState("comer");
  const [language, setLanguage] = useState<Language>("es");
  const [searchMode, setSearchMode] = useState<SearchMode>("search");
  const [results, setResults] = useState<PictoResult[]>([]);
  const [useArasaac, setUseArasaac] = useState(true);
  const [useLocalLibrary, setUseLocalLibrary] = useState(true);
  const [localPath, setLocalPath] = useState("C:/pictrogramas");
  const [localPictos, setLocalPictos] = useState<LocalPicto[]>([]);
  const [localLibraryMessage, setLocalLibraryMessage] = useState(
    "Pulsa Carpeta y selecciona C:/pictrogramas para cargar tus imagenes.",
  );
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [apiStatus, setApiStatus] = useState("Proveedor de imagenes pendiente de consultar");
  const [dragCellId, setDragCellId] = useState<string | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [printOrientation, setPrintOrientation] = useState<PrintOrientation>("landscape");
  const boardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLElement>(null);
  const libraryRef = useRef<HTMLElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localFolderInputRef = useRef<HTMLInputElement>(null);
  const localFilesInputRef = useRef<HTMLInputElement>(null);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? projects[0],
    [activeProjectId, projects],
  );

  const activeBoard = useMemo(
    () =>
      activeProject.boards.find((board) => board.id === activeProject.activeBoardId) ??
      activeProject.boards[0],
    [activeProject],
  );

  const effectiveSelectedCellId =
    selectedCellId && activeBoard.cells.some((cell) => cell.id === selectedCellId)
      ? selectedCellId
      : (activeBoard.cells[0]?.id ?? null);

  const selectedCell = useMemo(
    () => activeBoard.cells.find((cell) => cell.id === effectiveSelectedCellId) ?? null,
    [activeBoard.cells, effectiveSelectedCellId],
  );

  const printableCells = useMemo(
    () => activeBoard.cells.filter((cell) => Boolean(cell.pictoId || cell.localSrc)),
    [activeBoard.cells],
  );

  const localResults = useMemo(() => {
    if (!useLocalLibrary) {
      return [];
    }

    const normalized = query.trim().toLowerCase();
    const matches = normalized
      ? localPictos.filter((picto) => `${picto.name} ${picto.path}`.toLowerCase().includes(normalized))
      : localPictos;

    return matches.slice(0, 80);
  }, [localPictos, query, useLocalLibrary]);

  const lastSaved = useMemo(
    () => new Date(activeProject.updatedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
    [activeProject.updatedAt],
  );

  useEffect(() => {
    queueMicrotask(() => {
      const cached = localStorage.getItem(CACHE_KEY);
      const activeId = localStorage.getItem(ACTIVE_KEY);
      const cachedLocal = localStorage.getItem(LOCAL_LIBRARY_KEY);

      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Project[];

          if (Array.isArray(parsed) && parsed.length > 0) {
            setProjects(parsed);
            setActiveProjectId(
              activeId && parsed.some((project) => project.id === activeId) ? activeId : parsed[0].id,
            );
          }
        } catch {
          setNoticeOpen(true);
        }
      } else {
        setNoticeOpen(true);
      }

      if (cachedLocal) {
        try {
          const parsed = JSON.parse(cachedLocal) as { path?: string; pictos?: LocalPicto[] };

          if (parsed.path) {
            setLocalPath(parsed.path);
          }

          if (Array.isArray(parsed.pictos) && parsed.pictos.length > 0) {
            setLocalPictos(parsed.pictos);
            setUseLocalLibrary(true);
            setLocalLibraryMessage(`${parsed.pictos.length} imagenes locales recuperadas de la cache del navegador.`);
          }
        } catch {
          setLocalLibraryMessage("No pude recuperar la biblioteca local guardada. Selecciona la carpeta otra vez.");
        }
      }

      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    localStorage.setItem(CACHE_KEY, JSON.stringify(projects));
    localStorage.setItem(ACTIVE_KEY, activeProjectId);
  }, [activeProjectId, hydrated, projects]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    try {
      localStorage.setItem(LOCAL_LIBRARY_KEY, JSON.stringify({ path: localPath, pictos: localPictos }));
    } catch {
      queueMicrotask(() => {
        setLocalLibraryMessage(
          "Las imagenes locales son demasiado grandes para guardarlas en cache. Seguiran disponibles hasta refrescar.",
        );
      });
    }
  }, [hydrated, localPath, localPictos]);

  const updateActiveProject = (updater: (project: Project) => Project) => {
    setProjects((current) =>
      current.map((project) =>
        project.id === activeProject.id ? { ...updater(project), updatedAt: new Date().toISOString() } : project,
      ),
    );
  };

  const updateActiveBoard = (updater: (board: Board) => Board) => {
    updateActiveProject((project) => ({
      ...project,
      boards: project.boards.map((board) => (board.id === activeBoard.id ? updater(board) : board)),
    }));
  };

  const updateCell = (cellId: string, patch: Partial<PictoCell>) => {
    updateActiveBoard((board) => ({
      ...board,
      cells: board.cells.map((cell) => (cell.id === cellId ? { ...cell, ...patch } : cell)),
    }));
  };

  const runSearch = async (mode = searchMode) => {
    if (!useArasaac) {
      setResults([]);
      setApiError("");
      setApiStatus("Proveedor de pictogramas desactivado");
      return;
    }

    setLoading(true);
    setApiError("");
    setApiStatus("Conectando con proveedor de pictogramas...");

    try {
      const path =
        mode === "new"
          ? `/api/arasaac/pictograms/${language}/new/60`
          : `/api/arasaac/pictograms/${language}/${mode}/${encodeURIComponent(query.trim())}`;

      if (mode !== "new" && !query.trim()) {
        setResults([]);
        setApiStatus("Escribe una busqueda para consultar el proveedor de pictogramas");
        return;
      }

      const response = await fetch(path);

      if (!response.ok) {
        throw new Error(`El proveedor de pictogramas respondio con ${response.status}`);
      }

      const data = (await response.json()) as PictoResult[];
      setResults(Array.isArray(data) ? data : []);
      setApiStatus(`Proveedor ARASAAC conectado: ${Array.isArray(data) ? data.length : 0} resultados`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo consultar el proveedor de pictogramas";
      setApiError(message);
      setApiStatus(`Error del proveedor de pictogramas: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void runSearch("new"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localFolderInputRef.current?.setAttribute("webkitdirectory", "");
    localFolderInputRef.current?.setAttribute("directory", "");
  }, []);

  const addLocalFiles = async (files: FileList | File[]) => {
    const images = Array.from(files).filter(isImageFile);

    if (images.length === 0) {
      setLocalLibraryMessage("No encontre imagenes en la seleccion. Revisa que sean PNG, JPG, SVG, WEBP, GIF o BMP.");
      return;
    }

    const pictos = await Promise.all(
      images.map(async (file) => {
        const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;

        return {
          id: uid("local"),
          name: labelFromFileName(file.name),
          path: relativePath.replaceAll("\\", "/"),
          src: await fileToDataUrl(file),
        };
      }),
    );

    const firstPath = pictos[0]?.path;
    if (firstPath?.includes("/")) {
      setLocalPath(`C:/pictrogramas/${firstPath.split("/").slice(0, -1).join("/")}`);
    }

    setUseLocalLibrary(true);
    setLocalPictos((current) => [...pictos, ...current]);
    setLocalLibraryMessage(`${pictos.length} imagenes locales cargadas. Ya puedes buscarlas por nombre o subcarpeta.`);
  };

  const readDirectoryHandle = async (directoryHandle: {
    name: string;
    values: () => AsyncIterable<unknown>;
  }) => {
    const files: File[] = [];

    const walk = async (handle: { name: string; values: () => AsyncIterable<unknown> }, prefix = "") => {
      for await (const entry of handle.values()) {
        const item = entry as {
          kind?: string;
          name: string;
          getFile?: () => Promise<File>;
          values?: () => AsyncIterable<unknown>;
        };

        if (item.kind === "file" && item.getFile) {
          const file = await item.getFile();
          Object.defineProperty(file, "webkitRelativePath", {
            configurable: true,
            value: `${prefix}${item.name}`,
          });
          files.push(file);
        }

        if (item.kind === "directory" && item.values) {
          await walk(item as { name: string; values: () => AsyncIterable<unknown> }, `${prefix}${item.name}/`);
        }
      }
    };

    await walk(directoryHandle);
    setLocalPath(`C:/${directoryHandle.name}`);
    await addLocalFiles(files);
  };

  const selectLocalFolder = async () => {
    const browserWindow = window as Window & {
      showDirectoryPicker?: () => Promise<{ name: string; values: () => AsyncIterable<unknown> }>;
    };

    if (browserWindow.showDirectoryPicker) {
      try {
        const handle = await browserWindow.showDirectoryPicker();
        await readDirectoryHandle(handle);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setLocalLibraryMessage("No pude abrir la carpeta con el selector moderno. Prueba con el selector clasico.");
      }
    }

    localFolderInputRef.current?.click();
  };

  const setCellFromDragPayload = (cellId: string, payload: DragPictoPayload) => {
    if (payload.source === "local") {
      updateCell(cellId, {
        source: "local",
        localPictoId: payload.id,
        localSrc: payload.src,
        pictoId: undefined,
        label: payload.label,
      });
      return;
    }

    updateCell(cellId, {
      source: "arasaac",
      pictoId: payload.id,
      localPictoId: undefined,
      localSrc: undefined,
      label: payload.label,
      options: {
        ...(activeBoard.cells.find((cell) => cell.id === cellId)?.options ?? defaultOptions),
        color: payload.aacColor || payload.aac ? true : true,
      },
    });
  };

  const addPictoToBoard = (result: PictoResult) => {
    const target =
      selectedCell ??
      activeBoard.cells.find((cell) => !cell.pictoId && !cell.label) ??
      activeBoard.cells[0];

    if (!target) {
      return;
    }

    updateCell(target.id, {
      source: "arasaac",
      pictoId: result._id,
      localPictoId: undefined,
      localSrc: undefined,
      label: getKeywordLabel(result),
      options: {
        ...target.options,
        color: result.aacColor || result.aac ? true : target.options.color,
      },
    });
    setSelectedCellId(target.id);

    if (window.matchMedia("(max-width: 860px)").matches) {
      setLibraryCollapsed(true);
      window.setTimeout(() => {
        canvasRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  };

  const addLocalPictoToBoard = (picto: LocalPicto) => {
    const target =
      selectedCell ??
      activeBoard.cells.find((cell) => !cell.pictoId && !cell.localSrc && !cell.label) ??
      activeBoard.cells[0];

    if (!target) {
      return;
    }

    updateCell(target.id, {
      source: "local",
      localPictoId: picto.id,
      localSrc: picto.src,
      pictoId: undefined,
      label: picto.name,
    });
    setSelectedCellId(target.id);

    if (window.matchMedia("(max-width: 860px)").matches) {
      setLibraryCollapsed(true);
      window.setTimeout(() => {
        canvasRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  };

  const swapCells = (fromId: string, toId: string) => {
    if (fromId === toId) {
      return;
    }

    updateActiveBoard((board) => {
      const fromIndex = board.cells.findIndex((cell) => cell.id === fromId);
      const toIndex = board.cells.findIndex((cell) => cell.id === toId);

      if (fromIndex < 0 || toIndex < 0) {
        return board;
      }

      const cells = [...board.cells];
      const from = cells[fromIndex];
      cells[fromIndex] = { ...cells[toIndex], id: from.id };
      cells[toIndex] = { ...from, id: cells[toIndex].id };

      return { ...board, cells };
    });
  };

  const speakBoard = () => {
    const text = activeBoard.cells
      .map((cell) => cell.label)
      .filter(Boolean)
      .join(". ");

    if (!text || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  const exportPng = async () => {
    if (!boardRef.current) {
      return;
    }

    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(boardRef.current, {
      backgroundColor: "#ffffff",
      cacheBust: true,
      pixelRatio: 2,
    });
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `${activeProject.name.replace(/\W+/g, "-").toLowerCase()}-${activeBoard.title.replace(/\W+/g, "-").toLowerCase()}.png`;
    anchor.click();
  };

  const printBoard = () => {
    const style = document.createElement("style");
    style.id = "pictomesa-print-style";
    style.textContent = `@page { size: A4 ${printOrientation}; margin: 10mm; }`;
    document.head.appendChild(style);

    const cleanup = () => {
      style.remove();
      window.removeEventListener("afterprint", cleanup);
    };

    window.addEventListener("afterprint", cleanup);
    window.print();
    window.setTimeout(cleanup, 1200);
  };

  const exportProject = () => {
    downloadBlob(
      JSON.stringify(activeProject, null, 2),
      `${activeProject.name.replace(/\W+/g, "-").toLowerCase()}.pictomesa.json`,
      "application/json",
    );
  };

  const importProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const text = await file.text();
    const imported = JSON.parse(text) as Project;
    const project = {
      ...imported,
      id: uid("project"),
      name: `${imported.name} importado`,
      updatedAt: new Date().toISOString(),
    };

    setProjects((current) => [project, ...current]);
    setActiveProjectId(project.id);
    event.target.value = "";
  };

  return (
    <main className="min-h-screen bg-[#f8f6f1] text-slate-950">
      <section className="studio-shell">
        <aside className="studio-rail">
          <div>
            <div className="brand-mark">
              <Bot size={22} aria-hidden />
            </div>
            <p className="brand-kicker">Amaretea</p>
          </div>

          <nav className="rail-actions" aria-label="Acciones rápidas">
            <button title="Fuentes de pictogramas" aria-label="Fuentes de pictogramas">
              <Library size={20} />
            </button>
            <button title="Tableros" aria-label="Tableros">
              <Layers3 size={20} />
            </button>
            <button title="Ajustes" aria-label="Ajustes">
              <Settings2 size={20} />
            </button>
            <button title="Información legal" aria-label="Información legal" onClick={() => setLegalOpen(true)}>
              <Info size={20} />
            </button>
          </nav>
        </aside>

        <section className="workspace">
          <header className="topbar">
            <div>
              <p className="eyebrow">Editor visual de apoyos CAA</p>
              <input
                className="project-title"
                value={activeProject.name}
                onChange={(event) =>
                  updateActiveProject((project) => ({
                    ...project,
                    name: event.target.value,
                  }))
                }
                aria-label="Nombre del proyecto"
              />
            </div>

            <div className="topbar-actions">
              <select
                value={activeProjectId}
                onChange={(event) => setActiveProjectId(event.target.value)}
                aria-label="Proyecto activo"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <button
                className="icon-button"
                title="Nuevo proyecto"
                onClick={() => {
                  const project = makeProject("Nuevo proyecto");
                  setProjects((current) => [project, ...current]);
                  setActiveProjectId(project.id);
                }}
              >
                <Plus size={18} />
              </button>
              <button className="command-button" onClick={exportProject}>
                <FileDown size={18} />
                Proyecto
              </button>
              <button className="command-button" onClick={() => fileInputRef.current?.click()}>
                <FileUp size={18} />
                Importar
              </button>
              <input ref={fileInputRef} className="sr-only" type="file" accept="application/json" onChange={importProject} />
            </div>
          </header>

          <div className="cache-warning">
            <Info size={18} />
            <p>
              Los proyectos se guardan solo en la cache/localStorage de este navegador. Si borras la cache o los datos
              del sitio, perderas los proyectos. Esta herramienta no guarda datos en servidor y solo consulta fuentes
              externas cuando las activas.
            </p>
            <button onClick={() => setNoticeOpen(true)}>Ver aviso</button>
          </div>

          <div className="amaretea-notice">
            <Info size={18} />
            <p>
              Esta web ha sido creada desde <a href="https://www.amaretea.com" target="_blank" rel="noreferrer">www.amaretea.com</a> sin animo de comercializar pictogramas, con el fin de ayudar en el dia a dia de docentes de educacion especial. Cada usuario es responsable del uso final, adaptacion, impresion o distribucion de sus materiales.
            </p>
            <button onClick={() => setLegalOpen(true)}>Ver legal</button>
          </div>

          <nav className="mobile-jumpbar" aria-label="Navegacion movil">
            <button onClick={() => canvasRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              Tablero
            </button>
            <button
              onClick={() => {
                setLibraryCollapsed(false);
                libraryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Buscar pictos
            </button>
            <button
              onClick={() => {
                setLibraryCollapsed((current) => !current);
                libraryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {libraryCollapsed ? "Abrir" : "Plegar"}
            </button>
            <button onClick={() => inspectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              Ajustes
            </button>
          </nav>

          <div className="studio-grid">
            <aside className="library-panel" aria-label="Biblioteca de pictogramas" ref={libraryRef}>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Fuentes de imagenes</p>
                  <h2>Biblioteca viva</h2>
                </div>
                <div className="panel-heading-actions">
                  <button
                    className="collapse-button"
                    onClick={() => setLibraryCollapsed((current) => !current)}
                    aria-expanded={!libraryCollapsed}
                  >
                    {libraryCollapsed ? "Mostrar" : "Minimizar"}
                  </button>
                  <Sparkles size={20} aria-hidden />
                </div>
              </div>

              <div className={libraryCollapsed ? "collapsible-content collapsed" : "collapsible-content"}>
              <div className="source-toggles" aria-label="Fuentes de pictogramas">
                <label>
                  <input type="checkbox" checked={useArasaac} onChange={(event) => setUseArasaac(event.target.checked)} />
                  Proveedor ARASAAC
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={useLocalLibrary}
                    onChange={(event) => setUseLocalLibrary(event.target.checked)}
                  />
                  Biblioteca local
                </label>
              </div>

              <div className="local-library-box">
                <div>
                  <strong>Ruta local sugerida</strong>
                  <span>{localPath}</span>
                </div>
                <div className="local-library-actions">
                  <button className="command-button secondary compact" onClick={() => void selectLocalFolder()}>
                    <FileUp size={16} />
                    Carpeta
                  </button>
                  <button className="command-button secondary compact" onClick={() => localFilesInputRef.current?.click()}>
                    <Plus size={16} />
                    Imagenes
                  </button>
                </div>
                <input
                  ref={localFolderInputRef}
                  className="sr-only"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(event) => {
                    if (event.target.files) {
                      void addLocalFiles(event.target.files);
                    }
                    event.target.value = "";
                  }}
                />
                <input
                  ref={localFilesInputRef}
                  className="sr-only"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(event) => {
                    if (event.target.files) {
                      void addLocalFiles(event.target.files);
                    }
                    event.target.value = "";
                  }}
                />
                <p>
                  Por seguridad del navegador, la web no puede abrir una ruta sola aunque exista. Selecciona
                  C:/pictrogramas o C:/pictogramas con el boton Carpeta y se leeran las imagenes, incluidas
                  subcarpetas.
                </p>
                <p className="local-library-message">{localLibraryMessage}</p>
              </div>

              <div className="search-box">
                <Search size={18} aria-hidden />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void runSearch();
                    }
                  }}
                  placeholder="Buscar pictograma..."
                  aria-label="Buscar pictograma"
                />
              </div>

              <div className="segmented">
                {(["search", "bestsearch", "new"] as SearchMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={searchMode === mode ? "active" : ""}
                    onClick={() => {
                      setSearchMode(mode);
                      void runSearch(mode);
                    }}
                  >
                    {mode === "search" ? "Buscar" : mode === "bestsearch" ? "Mejor" : "Nuevo"}
                  </button>
                ))}
              </div>

              <div className="library-filters">
                <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
                  {languages.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <button className="command-button compact" onClick={() => void runSearch()}>
                  <Search size={16} />
                  Buscar
                </button>
              </div>

              {apiError ? <p className="error-text">{apiError}</p> : null}
              {loading ? <p className="muted">Consultando proveedor de pictogramas...</p> : null}
              <div className={`api-status ${apiError ? "error" : ""}`}>{apiStatus}</div>

              {useLocalLibrary ? (
                <div className="local-results-summary">
                  {localPictos.length} imagenes locales cargadas
                  {localResults.length !== localPictos.length ? `, ${localResults.length} coinciden` : ""}
                </div>
              ) : null}

              {useLocalLibrary && localPictos.length === 0 ? (
                <div className="empty-library-note">
                  La biblioteca local esta activa pero aun no hay imagenes cargadas. Pulsa <strong>Carpeta</strong> y
                  selecciona la carpeta que has creado en C:.
                </div>
              ) : null}

              <div className="results-grid">
                {localResults.map((picto) => (
                  <button
                    key={picto.id}
                    className="result-tile local-result"
                    onClick={() => addLocalPictoToBoard(picto)}
                    draggable
                    onDragStart={(event) => {
                      setDragCellId(null);
                      event.dataTransfer.setData(
                        "application/json",
                        JSON.stringify({ source: "local", id: picto.id, label: picto.name, src: picto.src }),
                      );
                    }}
                  >
                    <img src={picto.src} alt={picto.name} loading="lazy" />
                    <span>{picto.name}</span>
                    <small>{picto.path}</small>
                  </button>
                ))}
                {results.map((result) => {
                  const label = getKeywordLabel(result);

                  return (
                    <button
                      key={result._id}
                      className="result-tile"
                      onClick={() => addPictoToBoard(result)}
                      draggable
                      onDragStart={(event) => {
                        setDragCellId(null);
                        event.dataTransfer.setData(
                          "application/json",
                          JSON.stringify({
                            source: "arasaac",
                            id: result._id,
                            label,
                            aac: result.aac,
                            aacColor: result.aacColor,
                          }),
                        );
                      }}
                    >
                      <img src={pictogramUrl(result._id, defaultOptions)} alt={label} loading="lazy" />
                      <span>{label}</span>
                      <small>{getAllWords(result)}</small>
                    </button>
                  );
                })}
              </div>
              </div>
            </aside>

            <section className="canvas-zone" ref={canvasRef}>
              <div className="board-tabs" aria-label="Tableros del proyecto">
                {activeProject.boards.map((board) => (
                  <button
                    key={board.id}
                    className={board.id === activeBoard.id ? "active" : ""}
                    onClick={() =>
                      updateActiveProject((project) => ({
                        ...project,
                        activeBoardId: board.id,
                      }))
                    }
                  >
                    {board.title}
                  </button>
                ))}
                <button
                  className="add-board"
                  title="Añadir tablero"
                  onClick={() => {
                    const board = makeBoard(`Tablero ${activeProject.boards.length + 1}`);
                    updateActiveProject((project) => ({
                      ...project,
                      activeBoardId: board.id,
                      boards: [...project.boards, board],
                    }));
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="board-toolbar">
                <div className="board-title-wrap">
                  <Grid2X2 size={19} />
                  <input
                    value={activeBoard.title}
                    onChange={(event) => updateActiveBoard((board) => ({ ...board, title: event.target.value }))}
                    aria-label="Titulo del tablero"
                  />
                </div>

                <div className="toolbar-buttons">
                  <button className="icon-button" title="Leer tablero" onClick={speakBoard}>
                    <Volume2 size={18} />
                  </button>
                  <button className="command-button secondary" title="Exportar tablero como PNG" onClick={() => void exportPng()}>
                    <Download size={18} />
                    PNG
                  </button>
                  <button className="command-button print-action" title="Imprimir tablero activo" onClick={printBoard}>
                    <Printer size={18} />
                    Imprimir tablero
                  </button>
                </div>
              </div>

              <div className="print-frame" ref={boardRef}>
                <div
                  className="communication-board"
                  style={{
                    gridTemplateColumns: `repeat(${activeBoard.cols}, minmax(0, 1fr))`,
                    gap: activeBoard.gap,
                  }}
                >
                  {activeBoard.cells.map((cell) => {
                    const selected = cell.id === effectiveSelectedCellId;

                    return (
                      <button
                        key={cell.id}
                        className={`board-cell ${selected ? "selected" : ""} ${cell.bg === "#111827" ? "dark-cell" : ""}`}
                        style={{ backgroundColor: cell.bg }}
                        onClick={() => setSelectedCellId(cell.id)}
                        draggable
                        onDragStart={() => setDragCellId(cell.id)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          const payload = event.dataTransfer.getData("application/json");
                          if (payload) {
                            try {
                              setCellFromDragPayload(cell.id, JSON.parse(payload) as DragPictoPayload);
                              setSelectedCellId(cell.id);
                              setDragCellId(null);
                              return;
                            } catch {
                              setDragCellId(null);
                            }
                          }

                          if (dragCellId) {
                            swapCells(dragCellId, cell.id);
                          }
                        }}
                      >
                        {activeBoard.labelPosition === "top" ? (
                          <span style={{ fontSize: activeBoard.fontSize }}>{cell.label || " "}</span>
                        ) : null}
                        <div className="picto-image-wrap">
                          {cell.localSrc ? (
                            <img src={cell.localSrc} alt={cell.label} draggable={false} />
                          ) : cell.pictoId ? (
                            <img src={pictogramUrl(cell.pictoId, cell.options)} alt={cell.label} draggable={false} />
                          ) : (
                            <Plus size={26} aria-hidden />
                          )}
                        </div>
                        {activeBoard.labelPosition === "bottom" ? (
                          <span style={{ fontSize: activeBoard.fontSize }}>{cell.label || " "}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div
                  className="communication-board print-only-board"
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(activeBoard.cols, Math.max(printableCells.length, 1))}, ${activeBoard.printCellCm ?? 5}cm)`,
                    gap: activeBoard.gap,
                  }}
                >
                  {printableCells.map((cell) => (
                    <div
                      key={`print-${cell.id}`}
                      className={`board-cell print-cell ${cell.bg === "#111827" ? "dark-cell" : ""}`}
                      style={{
                        backgroundColor: cell.bg,
                        height: `${activeBoard.printCellCm ?? 5}cm`,
                        width: `${activeBoard.printCellCm ?? 5}cm`,
                      }}
                    >
                      {activeBoard.labelPosition === "top" ? (
                        <span style={{ fontSize: activeBoard.fontSize }}>{cell.label || " "}</span>
                      ) : null}
                      <div className="picto-image-wrap">
                        <img
                          src={cell.localSrc ?? pictogramUrl(cell.pictoId!, cell.options)}
                          alt={cell.label}
                          draggable={false}
                        />
                      </div>
                      {activeBoard.labelPosition === "bottom" ? (
                        <span style={{ fontSize: activeBoard.fontSize }}>{cell.label || " "}</span>
                      ) : null}
                    </div>
                  ))}
                </div>

                <p className="print-attribution">
                  Proveedor de pictogramas: ARASAAC. Autor: Sergio Palao. Titular: Gobierno de Aragon. Origen:
                  https://arasaac.org. Licencia: Creative Commons BY-NC-SA. Documento generado con una herramienta no
                  comercial creada desde www.amaretea.com para apoyar a docentes de educacion especial. El usuario es
                  responsable del uso, adaptacion, impresion, revision de derechos y distribucion de este material.
                </p>
              </div>
            </section>

            <aside className="inspector-panel" aria-label="Inspector" ref={inspectorRef}>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Inspector</p>
                  <h2>Tablero y celda</h2>
                </div>
                <div className="panel-heading-actions">
                  <button
                    className="collapse-button"
                    onClick={() => setInspectorCollapsed((current) => !current)}
                    aria-expanded={!inspectorCollapsed}
                  >
                    {inspectorCollapsed ? "Mostrar" : "Minimizar"}
                  </button>
                  <Save size={20} aria-hidden />
                </div>
              </div>

              <div className={inspectorCollapsed ? "collapsible-content collapsed" : "collapsible-content"}>
              <div className="control-group">
                <label>
                  <Rows3 size={16} />
                  Filas
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={activeBoard.rows}
                  onChange={(event) =>
                    updateActiveBoard((board) => resizeCells(board, Number(event.target.value), board.cols))
                  }
                />
              </div>

              <div className="control-group">
                <label>
                  <Columns3 size={16} />
                  Columnas
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={activeBoard.cols}
                  onChange={(event) =>
                    updateActiveBoard((board) => resizeCells(board, board.rows, Number(event.target.value)))
                  }
                />
              </div>

              <div className="control-group">
                <label>Separacion</label>
                <input
                  type="range"
                  min={0}
                  max={22}
                  value={activeBoard.gap}
                  onChange={(event) => updateActiveBoard((board) => ({ ...board, gap: Number(event.target.value) }))}
                />
              </div>

              <div className="control-group">
                <label>Tamano texto</label>
                <input
                  type="range"
                  min={12}
                  max={30}
                  value={activeBoard.fontSize}
                  onChange={(event) =>
                    updateActiveBoard((board) => ({ ...board, fontSize: Number(event.target.value) }))
                  }
                />
              </div>

              <div className="segmented full">
                {(["bottom", "top"] as LabelPosition[]).map((position) => (
                  <button
                    key={position}
                    className={activeBoard.labelPosition === position ? "active" : ""}
                    onClick={() => updateActiveBoard((board) => ({ ...board, labelPosition: position }))}
                  >
                    {position === "bottom" ? "Texto abajo" : "Texto arriba"}
                  </button>
                ))}
              </div>

              <div className="control-group">
                <label>
                  <Printer size={16} />
                  Impresion
                </label>
                <select
                  value={printOrientation}
                  onChange={(event) => setPrintOrientation(event.target.value as PrintOrientation)}
                  aria-label="Orientacion de impresion"
                >
                  <option value="landscape">A4 horizontal</option>
                  <option value="portrait">A4 vertical</option>
                </select>
              </div>

              <div className="control-group">
                <label>Tamano picto print</label>
                <input
                  type="number"
                  min={2}
                  max={18}
                  step={0.5}
                  value={activeBoard.printCellCm ?? 5}
                  onChange={(event) =>
                    updateActiveBoard((board) => ({ ...board, printCellCm: Number(event.target.value) || 5 }))
                  }
                />
              </div>

              <button className="command-button print-wide" onClick={printBoard}>
                <Printer size={18} />
                Imprimir tablero activo
              </button>

              <div className="divider" />

              {selectedCell ? (
                <>
                  <div className="control-group stacked">
                    <label>Texto de la celda</label>
                    <input value={selectedCell.label} onChange={(event) => updateCell(selectedCell.id, { label: event.target.value })} />
                  </div>

                  <div className="swatches" aria-label="Color de celda">
                    {cellColors.map((color) => (
                      <button
                        key={color}
                        style={{ backgroundColor: color }}
                        className={selectedCell.bg === color ? "active" : ""}
                        title={color}
                        onClick={() => updateCell(selectedCell.id, { bg: color })}
                      />
                    ))}
                  </div>

                  <label className="toggle-line">
                    <input
                      type="checkbox"
                      checked={selectedCell.options.color}
                      onChange={(event) =>
                        updateCell(selectedCell.id, {
                          options: { ...selectedCell.options, color: event.target.checked },
                        })
                      }
                    />
                    Color del proveedor
                  </label>

                  <div className="control-group">
                    <label>Resolucion</label>
                    <select
                      value={selectedCell.options.resolution}
                      onChange={(event) =>
                        updateCell(selectedCell.id, {
                          options: { ...selectedCell.options, resolution: Number(event.target.value) as 500 | 2500 },
                        })
                      }
                    >
                      <option value={500}>500 px</option>
                      <option value={2500}>2500 px</option>
                    </select>
                  </div>

                  <div className="control-group stacked">
                    <label>Piel</label>
                    <div className="swatches">
                      {(Object.keys(skinColors) as SkinKey[]).map((skin) => (
                        <button
                          key={skin}
                          style={{ backgroundColor: skinColors[skin] }}
                          className={selectedCell.options.skin === skin ? "active" : ""}
                          onClick={() =>
                            updateCell(selectedCell.id, {
                              options: { ...selectedCell.options, skin },
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div className="control-group stacked">
                    <label>Pelo</label>
                    <div className="swatches">
                      {(Object.keys(hairColors) as HairKey[]).map((hair) => (
                        <button
                          key={hair}
                          style={{ backgroundColor: hairColors[hair] }}
                          className={selectedCell.options.hair === hair ? "active" : ""}
                          onClick={() =>
                            updateCell(selectedCell.id, {
                              options: { ...selectedCell.options, hair },
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div className="cell-actions">
                    <button
                      className="command-button"
                      onClick={() =>
                        updateCell(selectedCell.id, {
                          source: undefined,
                          pictoId: undefined,
                          localPictoId: undefined,
                          localSrc: undefined,
                          label: "",
                          note: "",
                        })
                      }
                    >
                      <Eraser size={17} />
                      Limpiar
                    </button>
                    <button
                      className="command-button"
                      onClick={() => {
                        const text = selectedCell.label;
                        if (text && "speechSynthesis" in window) {
                          window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
                        }
                      }}
                    >
                      <Volume2 size={17} />
                      Leer
                    </button>
                    <button
                      className="command-button"
                      onClick={() => {
                        const empty = activeBoard.cells.find((cell) => !cell.pictoId && !cell.localSrc && !cell.label);
                        if (empty) {
                          updateCell(empty.id, { ...selectedCell, id: empty.id });
                          setSelectedCellId(empty.id);
                        }
                      }}
                    >
                      <Copy size={17} />
                      Copiar
                    </button>
                    <button
                      className="command-button danger"
                      onClick={() => {
                        if (projects.length === 1) {
                          setProjects([makeProject()]);
                          return;
                        }

                        const next = projects.filter((project) => project.id !== activeProject.id);
                        setProjects(next);
                        setActiveProjectId(next[0].id);
                      }}
                    >
                      <Trash2 size={17} />
                      Proyecto
                    </button>
                  </div>
                </>
              ) : (
                <p className="muted">Selecciona una celda para editarla.</p>
              )}

              <div className="cache-status">
                <ArrowDownToLine size={17} />
                Guardado local a las {lastSaved}
              </div>
              </div>
            </aside>
          </div>
        </section>
      </section>

      {noticeOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cache-title">
          <div className="modal">
            <h2 id="cache-title">Aviso sobre cache y proyectos</h2>
            <p>
              Esta web funciona sin cuentas y sin base de datos propia. Los proyectos se guardan en la cache/localStorage
              del navegador. Si limpias la cache, cambias de navegador o borras datos del sitio, esos proyectos se
              perderan.
            </p>
            <p>
              Para conservarlos fuera del navegador usa <strong>Proyecto</strong> y descarga un archivo JSON que despues
              puedes importar.
            </p>
            <button className="command-button primary" onClick={() => setNoticeOpen(false)}>
              Entendido
            </button>
          </div>
        </div>
      ) : null}

      {legalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="legal-title">
          <div className="modal legal-modal">
            <h2 id="legal-title">Aviso legal y uso de imagenes</h2>
            <p>
              Esta web ha sido creada desde <a href="https://www.amaretea.com" target="_blank" rel="noreferrer">www.amaretea.com</a> sin animo de comercializar pictogramas ni generar ingresos por su uso, con el fin de ayudar en el dia a dia de docentes de educacion especial.
            </p>
            <p>
              ARASAAC se utiliza unicamente como proveedor publico de pictogramas cuando esa fuente esta activada. Sus
              pictogramas son de Sergio Palao, titularidad del Gobierno de Aragon, y se distribuyen bajo licencia
              Creative Commons BY-NC-SA, que exige atribucion, uso no comercial y compartir bajo la misma licencia
              cuando corresponda.
            </p>
            <p>
              La herramienta no esta afiliada ni respaldada por ARASAAC o el Gobierno de Aragon. No almacena proyectos,
              pictogramas ni imagenes locales en servidor; el guardado de proyectos y biblioteca local ocurre en este
              navegador.
            </p>
            <p>
              Cada usuario es responsable de revisar la idoneidad pedagogica o clinica de los materiales, los derechos
              de las imagenes locales que cargue, la atribucion cuando corresponda y el cumplimiento de la licencia,
              normas de su centro y leyes aplicables. Este aviso es informativo y no sustituye asesoramiento legal.
            </p>
            <div className="legal-links">
              <a href="https://arasaac.org/developers/api" target="_blank" rel="noreferrer">
                API del proveedor
              </a>
              <a href="https://aulaabierta.arasaac.org/condiciones-de-uso" target="_blank" rel="noreferrer">
                Condiciones de uso
              </a>
              <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">
                CC BY-NC-SA
              </a>
            </div>
            <button className="command-button primary" onClick={() => setLegalOpen(false)}>
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
