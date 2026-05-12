import { ArrowUpRight, Brush, Grid2X2, Library, Settings2 } from "lucide-react";
import Link from "next/link";

const tools = [
  {
    href: "/herramientas/pictogramas",
    icon: Grid2X2,
    title: "Tableros de pictogramas",
    text: "Crea escenarios, tableros imprimibles, filas, columnas, pictos propios y proyectos organizados para el aula.",
    status: "Disponible",
  },
  {
    href: "/herramientas/creador-pictos",
    icon: Brush,
    title: "Creador de pictos propios",
    text: "Monta una imagen, anade texto, ajusta marco y descarga un picto PNG para incorporarlo a tu biblioteca.",
    status: "Nuevo",
  },
  {
    href: "/herramientas/pictogramas",
    icon: Library,
    title: "Bibliotecas educativas",
    text: "Combina proveedor publico de pictogramas con imagenes locales del centro, clase, tema o alumno.",
    status: "En crecimiento",
  },
];

export default function Home() {
  return (
    <main className="home-page">
      <nav className="home-nav" aria-label="Navegacion principal">
        <Link className="home-brand" href="/">
          <span>Amaretea</span>
          <small>Herramientas educativas</small>
        </Link>
        <div>
          <Link href="/herramientas/pictogramas">Pictogramas</Link>
          <Link href="/herramientas/creador-pictos">Crear picto</Link>
          <a href="https://amaretea.es/" target="_blank" rel="noreferrer">
            amaretea.es
          </a>
        </div>
      </nav>

      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">Recursos digitales para educacion</p>
          <h1>Herramientas sencillas para preparar apoyos visuales, materiales y rutinas de aula.</h1>
          <p>
            Este espacio nace vinculado a <a href="https://amaretea.es/" target="_blank" rel="noreferrer">amaretea.es</a>,
            un proyecto impulsado por Yolanda y Monica, maestras de educacion especial, para compartir experiencia,
            recursos y acompanamiento en torno al TEA y la educacion inclusiva.
          </p>
          <div className="home-actions">
            <Link className="command-button primary" href="/herramientas/pictogramas">
              Abrir pictogramas
              <ArrowUpRight size={18} />
            </Link>
            <Link className="command-button secondary" href="/herramientas/creador-pictos">
              Crear picto propio
            </Link>
          </div>
        </div>

        <div className="home-hero-panel" aria-label="Resumen de herramientas">
          <div>
            <Settings2 size={20} />
            <strong>Suite en crecimiento</strong>
          </div>
          <p>
            La web se organiza como un conjunto de herramientas para docentes, familias y profesionales del sector
            educativo. El editor de pictogramas es el primer modulo; el menu ira incorporando nuevos recursos.
          </p>
        </div>
      </section>

      <section className="tools-section" aria-labelledby="tools-title">
        <div className="section-heading">
          <p className="eyebrow">Herramientas</p>
          <h2 id="tools-title">Modulos disponibles</h2>
        </div>
        <div className="tool-cards">
          {tools.map((tool) => {
            const Icon = tool.icon;

            return (
              <Link key={tool.title} className="tool-card" href={tool.href}>
                <div>
                  <Icon size={22} />
                  <span>{tool.status}</span>
                </div>
                <h3>{tool.title}</h3>
                <p>{tool.text}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="home-note">
        <p>
          Los proyectos se guardan en el navegador. Exporta copias periodicamente si usas estas herramientas con
          materiales importantes del aula.
        </p>
      </section>
    </main>
  );
}
