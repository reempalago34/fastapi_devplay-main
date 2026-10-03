'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ShieldCheck, FileText, Cookie, HeartHandshake, Mail } from 'lucide-react'

/**
 * Vista "Acerca de DevPlay" 📜
 * Información clara y honesta: qué es DevPlay y toda la letra importante
 * (privacidad, términos, cookies, reglas de la comunidad y contacto).
 */

interface LegalBlock {
  h: string
  p: string
}

interface LegalSection {
  id: string
  icon: any
  title: string
  intro: string
  blocks: LegalBlock[]
}

const SECTIONS: LegalSection[] = [
  {
    id: 'privacidad',
    icon: ShieldCheck,
    title: 'Política de Privacidad',
    intro: 'Tus datos son tuyos. Aquí te contamos, sin letra chiquita tramposa, cómo los cuidamos.',
    blocks: [
      {
        h: 'Qué información guardamos',
        p: 'Cuando creas tu cuenta nos das tu nombre de usuario, tu correo y una contraseña (que se guarda encriptada y nadie puede leerla, ni nosotros). Además, únicamente lo que tú decides poner en tu perfil: foto, biografía, redes sociales y tus creaciones. Nada de pedir más de lo necesario.',
      },
      {
        h: 'Tu contenido y tu privacidad',
        p: 'Tus publicaciones, betas, videos, encuestas y comentarios se muestran a la comunidad según tu configuración. Puedes hacer tu perfil privado cuando quieras desde la rueda ⚙️ de Configuración, y algo importante: tus logros y estadísticas siempre son privados, solo tú los ves.',
      },
      {
        h: 'Lo que NUNCA hacemos',
        p: 'No vendemos tus datos, no los compartimos con terceros para publicidad y no espiamos tus conversaciones. Punto. DevPlay es de la comunidad, no una fábrica de datos.',
      },
      {
        h: 'Tus derechos',
        p: 'Puedes ver, editar o borrar tu información cuando quieras. Si decides irte, puedes eliminar tu cuenta desde Configuración → Zona de peligro y tus datos se eliminan del sistema. Sin vueltas ni trámites eternos.',
      },
      {
        h: 'Cambios a esta política',
        p: 'Si algún día actualizamos algo de esta política, lo avisaremos con tiempo dentro de la app para que decidas con claridad.',
      },
    ],
  },
  {
    id: 'terminos',
    icon: FileText,
    title: 'Términos y Condiciones',
    intro: 'Las reglas del juego para que todos podamos disfrutar DevPlay en paz.',
    blocks: [
      {
        h: 'Tu cuenta',
        p: 'Una cuenta por persona y con datos honestos. Eres responsable de cuidar tu contraseña y de todo lo que haga tu cuenta. Para registrarte necesitas tener al menos 13 años, o la edad mínima que pida la ley de tu país.',
      },
      {
        h: 'Tu contenido es tuyo',
        p: 'Lo que publicas sigue siendo tuyo siempre. Al subirlo a DevPlay solo nos das permiso para mostrarlo dentro de la plataforma y que la comunidad lo disfrute. Nunca lo usaremos para otra cosa sin preguntarte.',
      },
      {
        h: 'Betas y descargas',
        p: 'Descargar y probar betas es bajo tu propio riesgo: son versiones en desarrollo y pueden traer sorpresas. Te recomendamos revisar bien los archivos antes de instalarlos y, sobre todo, apoyar a los creadores con feedback amable.',
      },
      {
        h: 'Lo que no está permitido',
        p: 'Acoso o discurso de odio, contenido ilegal, suplantar identidades, spam masivo, publicar trabajo ajeno haciéndolo pasar por tuyo o intentar dañar la plataforma. Romper estas reglas puede acabar en suspensión de tu cuenta.',
      },
      {
        h: 'Moderación y reportes',
        p: 'Puedes reportar publicaciones y bloquear usuarios desde cualquier perfil. El equipo revisa los reportes y actúa según estas reglas. Tú pones el límite, nosotros lo hacemos respetar.',
      },
      {
        h: 'DevCoins y Tienda',
        p: 'Los DevCoins son moneditas de la app para divertirse: no tienen valor real ni se pueden cambiar por dinero. La Tienda todavía está en preparación 🛒, así que por ahora solo se ganan participando.',
      },
      {
        h: 'Sobre el servicio',
        p: 'DevPlay se ofrece tal cual, en mejora constante. Podemos agregar, cambiar o quitar funciones, y actualizar estos términos; si un cambio es importante, lo avisaremos dentro de la app.',
      },
    ],
  },
  {
    id: 'cookies',
    icon: Cookie,
    title: 'Cookies',
    intro: 'Pequeñas ayudantas que hacen que todo funcione mejor.',
    blocks: [
      {
        h: 'Esenciales (siempre activas)',
        p: 'Mantienen tu sesión abierta y protegen tu cuenta. No se pueden apagar porque sin ellas DevPlay simplemente no funciona.',
      },
      {
        h: 'Preferencias (opcionales)',
        p: 'Recuerdan tus gustos: el tema claro u oscuro, dónde dejaste a Pixel, tu último chat abierto. Opcionales y se apagan con un clic.',
      },
      {
        h: 'Analíticas (opcionales)',
        p: 'Nos ayudan a entender qué secciones se usan más para mejorarlas. Son anónimas: nunca saben quién eres tú.',
      },
      {
        h: '¿Cómo las gestiono?',
        p: 'Entra a Configuración (la rueda ⚙️) → sección Cookies. Activas o apagas las que quieras cuando quieras.',
      },
    ],
  },
  {
    id: 'reglas',
    icon: HeartHandshake,
    title: 'Reglas de la Comunidad',
    intro: 'Poquitas y claritas, para que todos queramos volver.',
    blocks: [
      {
        h: 'Sé buena gente',
        p: 'Trata a los demás como te gusta que te traten. El feedback honesto siempre se puede dar con cariño: aquí se viene a crecer juntos, no a hundir proyectos.',
      },
      {
        h: 'Respeta el trabajo ajeno',
        p: 'No publiques juegos, arte o ideas de otras personas como si fueran tuyos. Da crédito, comparte con permiso y celebra los logros de tus compañeros.',
      },
      {
        h: 'Cuida el espacio',
        p: 'Sin spam, sin acoso y sin contenido que no le mostrarías a tu abuela. ¿Viste algo raro? Repórtalo: la plaza la cuidamos entre todos.',
      },
      {
        h: 'Disfruta y crea',
        p: 'DevPlay es un hogar para creadores indie. Comparte tus betas, pregunta sin miedo, colabora y diviértete haciendo juegos 💛',
      },
    ],
  },
  {
    id: 'contacto',
    icon: Mail,
    title: 'Contacto y Soporte',
    intro: '¿Dudas, problemas o ideas locas? Estamos para escucharte.',
    blocks: [
      {
        h: 'Escríbenos',
        p: 'Puedes escribir a soporte@devplay.app y te respondemos lo antes posible. Si tu caso es urgente, pon la palabra "urgente" en el asunto del correo.',
      },
      {
        h: 'O pregúntale a Pixel 🤖',
        p: 'Para dudas rápidas sobre cómo usar DevPlay, Pixel (el robotcito terracota que camina por tu pantalla) sabe de todo y responde al instante. Solo tienes que tocarlo.',
      },
      {
        h: 'Reportes y seguridad',
        p: 'Si alguien te molesta o ves contenido que rompe las reglas, usa el botón de reportar. También puedes bloquear a cualquier usuario desde su perfil, sin dar explicaciones.',
      },
    ],
  },
]

export function AboutView() {
  const [open, setOpen] = useState<string | null>('privacidad')

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pt-8"
      >
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-lg">
          <img src="/logo-devplay.png" alt="DevPlay" className="h-14 w-14 rounded-lg object-cover" />
        </div>
        <h1 className="text-4xl font-bold gradient-text">DevPlay</h1>
        <p className="text-lg text-muted-foreground mt-2 max-w-2xl mx-auto">
          Red social para desarrolladores y testers de videojuegos indie
        </p>
        <p className="text-sm text-muted-foreground mt-1">v1.0 · MVP</p>
      </motion.div>

      {/* ¿Qué es? */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6 sm:p-8"
      >
        <h2 className="text-2xl font-bold mb-3">¿Qué es DevPlay?</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          DevPlay es una plataforma social diseñada específicamente para la comunidad de
          desarrolladores de videojuegos independientes. Al igual que YouTube conecta a creadores
          de contenido con su audiencia, DevPlay conecta a desarrolladores de juegos indie con
          jugadores, testers y otros creadores.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed mt-3">
          Aquí puedes compartir tus betas, publicar gameplays y devlogs, crear encuestas para
          obtener feedback, chatear en tiempo real con la comunidad y descubrir nuevos proyectos
          indie. Todo en un solo lugar, diseñado por y para amantes de los videojuegos.
        </p>
      </motion.section>

      {/* Papeles claritos: legal */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-2xl font-bold mb-1 text-center">Papeles claritos 📜</h2>
        <p className="text-sm text-muted-foreground text-center mb-5">
          Privacidad, términos, cookies y reglas: todo lo importante, explicado fácil.
        </p>
        <div className="space-y-2.5">
          {SECTIONS.map((s) => {
            const isOpen = open === s.id
            const Icon = s.icon
            return (
              <div key={s.id} className="glass-card overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : s.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/30 transition"
                  aria-expanded={isOpen}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="font-semibold text-sm block">{s.title}</span>
                    <span className="text-xs text-muted-foreground block truncate">{s.intro}</span>
                  </span>
                  <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0">
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-3 space-y-3 border-t border-border/40">
                        {s.blocks.map((b) => (
                          <div key={b.h}>
                            <h3 className="text-xs font-bold text-foreground/90 mb-0.5">{b.h}</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">{b.p}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </motion.section>

      {/* Nota de versión */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-center text-xs text-muted-foreground"
      >
        Documento actualizado en septiembre de 2026 · DevPlay v1.0
      </motion.p>
    </div>
  )
}
