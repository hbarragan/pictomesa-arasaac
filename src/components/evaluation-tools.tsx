"use client";

import { ArrowLeft, Download, Plus, Save, Settings, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";

type Classes = Record<string, string[]>;

type LegacyGradeHistoryItem = {
  date: string;
  className: string;
  taskName: string;
  studentName: string;
  grade: number;
};

type HistoryMode = "tradicional" | "especial";

type EvaluationHistoryItem = {
  id: string;
  date: string;
  className: string;
  sessionName: string;
  studentName: string;
  mode: HistoryMode;
  itemName: string;
  result: string;
  grade?: number;
};

type SpecialQuestion = {
  id: string;
  label: string;
  options: string[];
};

type EvalTab = "tradicional" | "especial" | "historial";

const CLASSES_KEY = "amaretea-eval-classes-v1";
const HISTORY_KEY = "amaretea-eval-history-v2";
const LEGACY_HISTORY_KEY = "amaretea-eval-history-v1";
const SPECIAL_TEMPLATE_KEY = "amaretea-eval-special-template-v1";
const DEFAULT_GRADE = 5;

const initialClasses: Classes = {
  "Clase de muestra": ["Juan Ejemplo", "Maria Prueba", "Pedro Alumno", "Ana Estudiante"],
};

const initialSpecialQuestions: SpecialQuestion[] = [
  {
    id: "question-bata",
    label: "Ponerse la bata",
    options: ["Solo", "Ayuda visual", "Ayuda fisica", "Ayuda completa"],
  },
  {
    id: "question-rutina",
    label: "Seguir la rutina de entrada",
    options: ["Solo", "Con recordatorio", "Con apoyo visual", "Con apoyo completo"],
  },
];

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

function normalizeQuestionOptions(options: string[]) {
  const cleaned = options.map((option) => option.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : ["Pendiente de definir"];
}

function normalizeHistory(raw: unknown): EvaluationHistoryItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const current = item as Partial<EvaluationHistoryItem>;
    if (current.mode === "tradicional" || current.mode === "especial") {
      return [
        {
          id: current.id ?? uid("history"),
          date: current.date ?? new Date().toLocaleDateString("es-ES"),
          className: current.className ?? "",
          sessionName: current.sessionName ?? "",
          studentName: current.studentName ?? "",
          mode: current.mode,
          itemName: current.itemName ?? (current.mode === "tradicional" ? "Nota" : "Observacion"),
          result: current.result ?? "",
          grade: typeof current.grade === "number" ? current.grade : undefined,
        },
      ];
    }

    const legacy = item as Partial<LegacyGradeHistoryItem>;
    if (typeof legacy.grade !== "number") {
      return [];
    }

    return [
      {
        id: uid("history"),
        date: legacy.date ?? new Date().toLocaleDateString("es-ES"),
        className: legacy.className ?? "",
        sessionName: legacy.taskName ?? "",
        studentName: legacy.studentName ?? "",
        mode: "tradicional",
        itemName: "Nota",
        result: legacy.grade.toFixed(1).replace(".", ","),
        grade: legacy.grade,
      },
    ];
  });
}

function downloadCsv(history: EvaluationHistoryItem[]) {
  const headers = ["FECHA", "MODALIDAD", "CLASE", "SESION", "ALUMNO", "ITEM", "RESULTADO"];
  const rows = history.map((item) =>
    [
      item.date,
      item.mode === "tradicional" ? "Educacion tradicional" : "Educacion especial",
      item.className,
      `"${item.sessionName.replace(/"/g, '""')}"`,
      item.studentName,
      `"${item.itemName.replace(/"/g, '""')}"`,
      `"${item.result.replace(/"/g, '""')}"`,
    ].join(";"),
  );
  const blob = new Blob([`\uFEFF${[headers.join(";"), ...rows].join("\n")}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `historial_evaluacion_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function EvaluationTools() {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<EvalTab>("tradicional");
  const [classes, setClasses] = useState<Classes>(initialClasses);
  const [selectedClass, setSelectedClass] = useState("Clase de muestra");
  const [sessionName, setSessionName] = useState("");
  const [grades, setGrades] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<EvaluationHistoryItem[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftClassName, setDraftClassName] = useState("Clase de muestra");
  const [draftStudents, setDraftStudents] = useState(initialClasses["Clase de muestra"].join("\n"));
  const [specialQuestions, setSpecialQuestions] = useState<SpecialQuestion[]>(initialSpecialQuestions);
  const [specialResponses, setSpecialResponses] = useState<Record<string, Record<string, string>>>({});
  const [message, setMessage] = useState("Los datos se guardan solo en este navegador.");

  const classNames = useMemo(() => Object.keys(classes), [classes]);
  const students = useMemo(() => classes[selectedClass] ?? [], [classes, selectedClass]);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const storedClasses = localStorage.getItem(CLASSES_KEY);
        const storedHistory = localStorage.getItem(HISTORY_KEY) ?? localStorage.getItem(LEGACY_HISTORY_KEY);
        const storedTemplate = localStorage.getItem(SPECIAL_TEMPLATE_KEY);
        const loadedClasses = storedClasses ? (JSON.parse(storedClasses) as Classes) : initialClasses;
        const names = Object.keys(loadedClasses);
        const firstClass = names[0] ?? "";

        setClasses(loadedClasses);
        setSelectedClass(firstClass);
        setDraftClassName(firstClass || "Clase de muestra");
        setDraftStudents((loadedClasses[firstClass] ?? []).join("\n"));

        if (storedHistory) {
          const normalized = normalizeHistory(JSON.parse(storedHistory));
          setHistory(normalized);
          localStorage.setItem(HISTORY_KEY, JSON.stringify(normalized));
          localStorage.removeItem(LEGACY_HISTORY_KEY);
        }

        if (storedTemplate) {
          const parsed = JSON.parse(storedTemplate) as SpecialQuestion[];
          setSpecialQuestions(parsed.length > 0 ? parsed : initialSpecialQuestions);
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

  const persistSpecialQuestions = (nextQuestions: SpecialQuestion[]) => {
    setSpecialQuestions(nextQuestions);
    localStorage.setItem(SPECIAL_TEMPLATE_KEY, JSON.stringify(nextQuestions));
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

  const saveTraditionalEvaluation = () => {
    if (!sessionName.trim()) {
      setMessage("Escribe el nombre de la tarea o sesion.");
      return;
    }

    if (students.length === 0) {
      setMessage("No hay alumnos en esta clase.");
      return;
    }

    const date = new Date().toLocaleDateString("es-ES");
    const newItems = students.map((student) => {
      const grade = grades[student] ?? DEFAULT_GRADE;
      return {
        id: uid("history"),
        date,
        className: selectedClass,
        sessionName: sessionName.trim(),
        studentName: student,
        mode: "tradicional" as const,
        itemName: "Nota",
        result: grade.toFixed(1).replace(".", ","),
        grade,
      };
    });
    const nextHistory = [...history, ...newItems];
    setHistory(nextHistory);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    setSessionName("");
    setMessage(`Guardadas ${newItems.length} notas de educacion tradicional para "${selectedClass}".`);
  };

  const saveSpecialEvaluation = () => {
    if (!sessionName.trim()) {
      setMessage("Escribe el nombre de la rutina, actividad o sesion.");
      return;
    }

    if (students.length === 0) {
      setMessage("No hay alumnos en esta clase.");
      return;
    }

    if (specialQuestions.length === 0) {
      setMessage("Anade al menos un criterio para educacion especial.");
      return;
    }

    const date = new Date().toLocaleDateString("es-ES");
    const newItems = students.flatMap((student) =>
      specialQuestions.map((question) => ({
        id: uid("history"),
        date,
        className: selectedClass,
        sessionName: sessionName.trim(),
        studentName: student,
        mode: "especial" as const,
        itemName: question.label.trim() || "Criterio sin nombre",
        result: getSpecialResponse(student, question),
      })),
    );

    const nextHistory = [...history, ...newItems];
    setHistory(nextHistory);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    setSessionName("");
    setMessage(`Guardadas ${newItems.length} observaciones de educacion especial para "${selectedClass}".`);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
    setMessage("Historial eliminado del navegador.");
  };

  const addSpecialQuestion = () => {
    persistSpecialQuestions([
      ...specialQuestions,
      {
        id: uid("question"),
        label: "",
        options: ["Solo", "Ayuda visual", "Ayuda fisica"],
      },
    ]);
    setMessage("Nuevo criterio anadido a educacion especial.");
  };

  const updateSpecialQuestion = (id: string, patch: Partial<SpecialQuestion>) => {
    persistSpecialQuestions(
      specialQuestions.map((question) => (question.id === id ? { ...question, ...patch } : question)),
    );
  };

  const removeSpecialQuestion = (id: string) => {
    persistSpecialQuestions(specialQuestions.filter((question) => question.id !== id));
    setMessage("Criterio eliminado.");
  };

  const getSpecialResponse = (student: string, question: SpecialQuestion) =>
    specialResponses[student]?.[question.id] ?? normalizeQuestionOptions(question.options)[0];

  if (!loaded) {
    return (
      <main className="eval-page">
        <div className="eval-loading">Cargando evaluacion...</div>
      </main>
    );
  }

  return (
    <main className="eval-page">
      <AppNav current="evaluacion" subtitle="Herramientas de evaluacion" />

      <section className="eval-shell">
        <header className="eval-hero">
          <Link className="back-link" href="/">
            <ArrowLeft size={17} />
            Herramientas
          </Link>
          <p className="eyebrow">Evaluacion</p>
          <h1>Evaluador educacion</h1>
          <p>
            Reune en un mismo espacio la evaluacion tradicional con notas numericas y una evaluacion de educacion
            especial basada en criterios y apoyos personalizables por pregunta.
          </p>
        </header>

        <div className="eval-tabs" role="tablist" aria-label="Herramientas de evaluacion">
          <button className={tab === "tradicional" ? "active" : ""} onClick={() => setTab("tradicional")}>
            Tradicional
          </button>
          <button className={tab === "especial" ? "active" : ""} onClick={() => setTab("especial")}>
            Educacion especial
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
            value={sessionName}
            onChange={(event) => setSessionName(event.target.value)}
            placeholder="Nombre de la tarea, rutina o sesion"
            aria-label="Nombre de la tarea, rutina o sesion"
          />
          <button className="icon-button eval-settings-button" onClick={() => setSettingsOpen(true)} title="Configurar clases">
            <Settings size={18} />
          </button>
        </section>

        {tab === "tradicional" ? (
          <section className="eval-card">
            <div className="eval-card-heading">
              <div>
                <p className="eyebrow">Educacion tradicional</p>
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
              <button className="command-button primary" onClick={saveTraditionalEvaluation}>
                <Save size={18} />
                Guardar notas
              </button>
              <button className="command-button secondary" onClick={() => history.length > 0 && downloadCsv(history)}>
                <Download size={18} />
                Descargar CSV
              </button>
            </div>
          </section>
        ) : null}

        {tab === "especial" ? (
          <div className="eval-special-layout">
            <section className="eval-card">
              <div className="eval-card-heading">
                <div>
                  <p className="eyebrow">Plantilla editable</p>
                  <h2>Criterios y apoyos</h2>
                </div>
                <span>{specialQuestions.length} criterios</span>
              </div>
              <p className="eval-subcopy">
                Cada criterio tiene sus propias opciones. Puedes usar apoyos distintos en cada pregunta y dejar la
                plantilla preparada para siguientes sesiones.
              </p>

              <div className="special-template-list">
                {specialQuestions.map((question, index) => (
                  <article className="special-question-card" key={question.id}>
                    <div className="special-question-head">
                      <strong>Criterio {index + 1}</strong>
                      <button className="command-button danger compact" onClick={() => removeSpecialQuestion(question.id)}>
                        <Trash2 size={15} />
                        Eliminar
                      </button>
                    </div>

                    <div className="control-group stacked">
                      <label>Pregunta o habilidad</label>
                      <input
                        value={question.label}
                        onChange={(event) => updateSpecialQuestion(question.id, { label: event.target.value })}
                        placeholder="Ej. Ponerse la bata"
                      />
                    </div>

                    <div className="control-group stacked">
                      <label>Opciones, una por linea</label>
                      <textarea
                        rows={5}
                        value={question.options.join("\n")}
                        onChange={(event) =>
                          updateSpecialQuestion(question.id, {
                            options: event.target.value.split(/\r?\n/),
                          })
                        }
                      />
                    </div>

                    <div className="special-options-preview">
                      {normalizeQuestionOptions(question.options).map((option) => (
                        <span className="special-option-chip" key={`${question.id}-${option}`}>{option}</span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              <div className="eval-actions">
                <button className="command-button secondary" onClick={addSpecialQuestion}>
                  <Plus size={17} />
                  Anadir criterio
                </button>
              </div>
            </section>

            <section className="eval-card">
              <div className="eval-card-heading">
                <div>
                  <p className="eyebrow">Registro por alumno</p>
                  <h2>{selectedClass || "Sin clase seleccionada"}</h2>
                </div>
                <span>{students.length} alumnos</span>
              </div>

              {students.length > 0 && specialQuestions.length > 0 ? (
                <div className="special-student-list">
                  {students.map((student) => (
                    <article className="special-student-card" key={student}>
                      <div className="special-student-head">
                        <strong>{student}</strong>
                      </div>

                      <div className="special-answer-grid">
                        {specialQuestions.map((question) => (
                          <label className="control-group stacked" key={`${student}-${question.id}`}>
                            <span>{question.label.trim() || "Criterio sin nombre"}</span>
                            <select
                              value={getSpecialResponse(student, question)}
                              onChange={(event) =>
                                setSpecialResponses((current) => ({
                                  ...current,
                                  [student]: {
                                    ...current[student],
                                    [question.id]: event.target.value,
                                  },
                                }))
                              }
                            >
                              {normalizeQuestionOptions(question.options).map((option) => (
                                <option key={`${question.id}-${option}`} value={option}>{option}</option>
                              ))}
                            </select>
                          </label>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="eval-empty">
                  {students.length === 0
                    ? "No hay alumnos en esta clase. Abre configuracion para anadirlos."
                    : "No hay criterios creados. Anade al menos uno para empezar."}
                </div>
              )}

              <div className="eval-actions">
                <button className="command-button primary" onClick={saveSpecialEvaluation}>
                  <Save size={18} />
                  Guardar observaciones
                </button>
                <button className="command-button secondary" onClick={() => history.length > 0 && downloadCsv(history)}>
                  <Download size={18} />
                  Descargar CSV
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {tab === "historial" ? (
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

            <div className="history-table" role="table" aria-label="Historial de evaluacion">
              <div className="history-head" role="row">
                <span>Fecha</span>
                <span>Modalidad</span>
                <span>Clase</span>
                <span>Sesion</span>
                <span>Alumno</span>
                <span>Item</span>
                <span>Resultado</span>
              </div>
              {history.slice().reverse().map((item, index) => (
                <div className="history-row" role="row" key={`${item.id}-${index}`}>
                  <span>{item.date}</span>
                  <span>{item.mode === "tradicional" ? "Tradicional" : "Especial"}</span>
                  <span>{item.className}</span>
                  <span>{item.sessionName}</span>
                  <span>{item.studentName}</span>
                  <span>{item.itemName}</span>
                  <strong>{item.result}</strong>
                </div>
              ))}
            </div>

            <button className="command-button danger eval-clear" onClick={clearHistory} disabled={history.length === 0}>
              <Trash2 size={17} />
              Borrar historial
            </button>
          </section>
        ) : null}

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
