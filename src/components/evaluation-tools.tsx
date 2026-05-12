"use client";

import { ArrowLeft, Download, Save, Settings, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Classes = Record<string, string[]>;

type GradeHistoryItem = {
  date: string;
  className: string;
  taskName: string;
  studentName: string;
  grade: number;
};

type EvalTab = "evaluador" | "historial";

const CLASSES_KEY = "amaretea-eval-classes-v1";
const HISTORY_KEY = "amaretea-eval-history-v1";
const DEFAULT_GRADE = 5;

const initialClasses: Classes = {
  "Clase de muestra": ["Juan Ejemplo", "Maria Prueba", "Pedro Alumno", "Ana Estudiante"],
};

function downloadCsv(history: GradeHistoryItem[]) {
  const headers = ["FECHA", "CLASE", "TAREA", "ALUMNO", "NOTA"];
  const rows = history.map((item) =>
    [
      item.date,
      item.className,
      `"${item.taskName.replace(/"/g, '""')}"`,
      item.studentName,
      item.grade.toLocaleString("es-ES"),
    ].join(";"),
  );
  const blob = new Blob([`\uFEFF${[headers.join(";"), ...rows].join("\n")}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `historial_notas_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function EvaluationTools() {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<EvalTab>("evaluador");
  const [classes, setClasses] = useState<Classes>(initialClasses);
  const [selectedClass, setSelectedClass] = useState("Clase de muestra");
  const [taskName, setTaskName] = useState("");
  const [grades, setGrades] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<GradeHistoryItem[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftClassName, setDraftClassName] = useState("Clase de muestra");
  const [draftStudents, setDraftStudents] = useState(initialClasses["Clase de muestra"].join("\n"));
  const [message, setMessage] = useState("Los datos se guardan solo en este navegador.");

  const classNames = useMemo(() => Object.keys(classes), [classes]);
  const students = useMemo(() => classes[selectedClass] ?? [], [classes, selectedClass]);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const storedClasses = localStorage.getItem(CLASSES_KEY);
        const storedHistory = localStorage.getItem(HISTORY_KEY);
        const loadedClasses = storedClasses ? (JSON.parse(storedClasses) as Classes) : initialClasses;
        const names = Object.keys(loadedClasses);

        setClasses(loadedClasses);
        setSelectedClass(names[0] ?? "");
        setDraftClassName(names[0] ?? "Clase de muestra");
        setDraftStudents((loadedClasses[names[0]] ?? []).join("\n"));

        if (storedHistory) {
          setHistory(JSON.parse(storedHistory) as GradeHistoryItem[]);
        }
      } catch {
        setClasses(initialClasses);
        setSelectedClass("Clase de muestra");
        setMessage("No pude recuperar los datos guardados. He cargado una clase de muestra.");
      } finally {
        setLoaded(true);
      }
    });
  }, []);

  const persistClasses = (nextClasses: Classes) => {
    setClasses(nextClasses);
    localStorage.setItem(CLASSES_KEY, JSON.stringify(nextClasses));
  };

  const saveClassDraft = () => {
    const name = draftClassName.trim();
    const nextStudents = draftStudents
      .split(/\r?\n/)
      .map((student) => student.trim())
      .filter(Boolean);

    if (!name) {
      setMessage("La clase necesita un nombre.");
      return;
    }

    const nextClasses = { ...classes, [name]: nextStudents };
    persistClasses(nextClasses);
    setSelectedClass(name);
    setSettingsOpen(false);
    setMessage(`Clase "${name}" guardada con ${nextStudents.length} alumnos.`);
  };

  const deleteSelectedClass = () => {
    const nextClasses = { ...classes };
    delete nextClasses[selectedClass];
    const fallbackName = Object.keys(nextClasses)[0] ?? "";
    persistClasses(nextClasses);
    setSelectedClass(fallbackName);
    setDraftClassName(fallbackName);
    setDraftStudents((nextClasses[fallbackName] ?? []).join("\n"));
    setMessage("Clase eliminada del navegador.");
  };

  const saveGrades = () => {
    if (!taskName.trim()) {
      setMessage("El nombre de la tarea es obligatorio.");
      return;
    }

    if (students.length === 0) {
      setMessage("No hay alumnos en esta clase.");
      return;
    }

    const date = new Date().toLocaleDateString("es-ES");
    const newItems = students.map((student) => ({
      date,
      className: selectedClass,
      taskName: taskName.trim(),
      studentName: student,
      grade: grades[student] ?? DEFAULT_GRADE,
    }));
    const nextHistory = [...history, ...newItems];
    setHistory(nextHistory);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    setTaskName("");
    setMessage(`Guardadas ${newItems.length} notas para "${selectedClass}".`);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
    setMessage("Historial eliminado del navegador.");
  };

  if (!loaded) {
    return (
      <main className="eval-page">
        <div className="eval-loading">Cargando evaluacion...</div>
      </main>
    );
  }

  return (
    <main className="eval-page">
      <nav className="home-nav maker-nav" aria-label="Navegacion evaluacion">
        <Link className="home-brand" href="/">
          <span>Amaretea</span>
          <small>Herramientas de evaluacion</small>
        </Link>
        <div>
          <Link href="/herramientas/pictogramas">Pictogramas</Link>
          <Link href="/herramientas/creador-pictos">Crear picto</Link>
          <a href="https://amaretea.es/" target="_blank" rel="noreferrer">amaretea.es</a>
        </div>
      </nav>

      <section className="eval-shell">
        <header className="eval-hero">
          <Link className="back-link" href="/">
            <ArrowLeft size={17} />
            Herramientas
          </Link>
          <p className="eyebrow">Evaluacion</p>
          <h1>Seguimiento rapido de tareas por clase</h1>
          <p>
            Esta propuesta encaja como primera herramienta de evaluacion: seleccionas una clase, introduces una tarea,
            ajustas notas por alumno y descargas el historial en CSV.
          </p>
        </header>

        <div className="eval-tabs" role="tablist" aria-label="Herramientas de evaluacion">
          <button className={tab === "evaluador" ? "active" : ""} onClick={() => setTab("evaluador")}>
            Evaluador Pro
          </button>
          <button className={tab === "historial" ? "active" : ""} onClick={() => setTab("historial")}>
            Historial
          </button>
        </div>

        <section className="eval-toolbar">
          <select
            value={selectedClass}
            onChange={(event) => {
              const next = event.target.value;
              setSelectedClass(next);
              setDraftClassName(next);
              setDraftStudents((classes[next] ?? []).join("\n"));
            }}
            aria-label="Seleccionar clase"
          >
            {classNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <input
            value={taskName}
            onChange={(event) => setTaskName(event.target.value)}
            placeholder="Nombre de la tarea"
            aria-label="Nombre de la tarea"
          />
          <button className="icon-button eval-settings-button" onClick={() => setSettingsOpen(true)} title="Configurar clases">
            <Settings size={18} />
          </button>
        </section>

        {tab === "evaluador" ? (
          <section className="eval-card">
            <div className="eval-card-heading">
              <div>
                <p className="eyebrow">Alumnos</p>
                <h2>{selectedClass || "Sin clase seleccionada"}</h2>
              </div>
              <span>{students.length} alumnos</span>
            </div>

            {students.length > 0 ? (
              <div className="grade-list">
                {students.map((student) => (
                  <div className="grade-row" key={student}>
                    <div>
                      <strong>{student}</strong>
                      <span>{(grades[student] ?? DEFAULT_GRADE).toFixed(1).replace(".", ",")}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={0.5}
                      value={grades[student] ?? DEFAULT_GRADE}
                      onChange={(event) => setGrades((current) => ({ ...current, [student]: Number(event.target.value) }))}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="eval-empty">
                No hay alumnos en esta clase. Abre configuracion para anadirlos.
              </div>
            )}

            <div className="eval-actions">
              <button className="command-button primary" onClick={saveGrades}>
                <Save size={18} />
                Guardar notas
              </button>
              <button className="command-button secondary" onClick={() => history.length > 0 && downloadCsv(history)}>
                <Download size={18} />
                Descargar CSV
              </button>
            </div>
          </section>
        ) : (
          <section className="eval-card">
            <div className="eval-card-heading">
              <div>
                <p className="eyebrow">Historial</p>
                <h2>{history.length} registros guardados</h2>
              </div>
              <button className="command-button secondary compact" onClick={() => downloadCsv(history)} disabled={history.length === 0}>
                <Download size={16} />
                CSV
              </button>
            </div>

            <div className="history-table" role="table" aria-label="Historial de notas">
              <div className="history-head" role="row">
                <span>Fecha</span>
                <span>Clase</span>
                <span>Tarea</span>
                <span>Alumno</span>
                <span>Nota</span>
              </div>
              {history.slice().reverse().map((item, index) => (
                <div className="history-row" role="row" key={`${item.date}-${item.studentName}-${index}`}>
                  <span>{item.date}</span>
                  <span>{item.className}</span>
                  <span>{item.taskName}</span>
                  <span>{item.studentName}</span>
                  <strong>{item.grade.toFixed(1).replace(".", ",")}</strong>
                </div>
              ))}
            </div>

            <button className="command-button danger eval-clear" onClick={clearHistory} disabled={history.length === 0}>
              <Trash2 size={17} />
              Borrar historial
            </button>
          </section>
        )}

        <p className="eval-message">{message}</p>
      </section>

      {settingsOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="eval-settings-title">
          <div className="modal eval-modal">
            <h2 id="eval-settings-title">Configurar clases</h2>
            <p>Escribe el nombre de la clase y un alumno por linea. Todo queda guardado en este navegador.</p>
            <div className="control-group stacked">
              <label>Clase</label>
              <input value={draftClassName} onChange={(event) => setDraftClassName(event.target.value)} />
            </div>
            <div className="control-group stacked">
              <label>Alumnos</label>
              <textarea
                value={draftStudents}
                onChange={(event) => setDraftStudents(event.target.value)}
                rows={8}
              />
            </div>
            <div className="eval-actions">
              <button className="command-button primary" onClick={saveClassDraft}>
                Guardar clase
              </button>
              <button className="command-button danger" onClick={deleteSelectedClass} disabled={!selectedClass}>
                Eliminar clase
              </button>
              <button className="command-button secondary" onClick={() => setSettingsOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
