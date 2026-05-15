import { AppNav } from "@/components/app-nav";
import { ArrowRight, Brush, Grid2X2, LayoutDashboard } from "lucide-react";
import Link from "next/link";

const tools = [
  {
    href: "/herramientas/pictogramas",
    icon: Grid2X2,
    title: "Editor de pictogramas",
    text: "Crear tableros, proyectos y materiales listos para imprimir.",
  },
  {
    href: "/herramientas/disenador",
    icon: LayoutDashboard,
    title: "Disenador libre",
    text: "Montar escenas, mensajes y apoyos visuales en un lienzo abierto.",
  },
  {
    href: "/herramientas/creador-pictos",
    icon: Brush,
    title: "Crear picto propio",
    text: "Subir imagenes, ajustarlas y guardarlas como pictos para tu biblioteca.",
  },
];

export default function Home() {
  return (
    <main className="home-page">
      <AppNav current="home" showExternal subtitle="Herramientas educativas" />

      <section className="home-simple">
        <div className="home-simple-copy">
          <p className="eyebrow">Amaretea</p>
          <h1>Herramientas claras para preparar apoyos visuales.</h1>
          <p>
            Un espacio sencillo para crear tableros, montar pictogramas propios y construir materiales de apoyo para el
            aula.
          </p>
          <div className="home-actions">
            <Link className="command-button primary" href="/herramientas/pictogramas">
              Abrir editor
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        <div className="home-simple-note">
          <strong>amaretea.es</strong>
          <p>
            Proyecto impulsado por maestras de educacion especial para compartir recursos practicos y faciles de usar.
          </p>
          <a href="https://amaretea.es/" target="_blank" rel="noreferrer">
            Ir a amaretea.es
          </a>
        </div>
      </section>

      <section className="tools-section home-tools-minimal" aria-labelledby="tools-title">
        <div className="section-heading">
          <p className="eyebrow">Herramientas</p>
          <h2 id="tools-title">Accesos principales</h2>
        </div>
        <div className="tool-cards">
          {tools.map((tool) => {
            const Icon = tool.icon;

            return (
              <Link key={tool.title} className="tool-card" href={tool.href}>
                <div className="tool-card-icon">
                  <Icon size={22} />
                </div>
                <h3>{tool.title}</h3>
                <p>{tool.text}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
