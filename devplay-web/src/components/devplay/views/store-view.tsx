'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { storeService } from '@/services/devplay-service'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useUIStore } from '@/lib/stores'
import { cn } from '@/lib/utils'
import { TimeAgo } from '@/components/devplay/shared/shared'
import {
  ShoppingBag,
  Coins,
  Check,
  Lock,
  TrendingUp,
  Crown,
  Sparkles,
  Rocket,
  Palette,
  Film,
  BadgeCheck,
  BarChart3,
  SwatchBook,
  Package,
  Gem,
  Trophy,
  History,
  ChevronDown,
  Zap,
  ShoppingCart,
  Gift,
  ArrowUpRight,
  ArrowDownRight,
  type LucideIcon,
} from 'lucide-react'
import type {
  StoreItem,
  StoreCategory,
  StorePurchase,
  DevCoinTransaction,
} from '@/types/devplay'

// Mapa de iconos -> componente Lucide
const ICON_MAP: Record<string, LucideIcon> = {
  Rocket,
  TrendingUp,
  Sparkles,
  Crown,
  Palette,
  Film,
  BadgeCheck,
  BarChart3,
  SwatchBook,
  Package,
  Gem,
  Trophy,
}

// La Tienda está en preparación: se muestra como catálogo, sin compras (cambiar a false cuando abra)
const STORE_CLOSED = true

// ===== Letrero grande: tienda próximamente =====
function StoreClosedBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-lg border-2 border-primary/50 px-6 py-14 sm:px-10 sm:py-20 text-center select-none"
      style={{
        background:
          'linear-gradient(140deg, color-mix(in oklch, var(--primary) 88%, black) 0%, color-mix(in oklch, var(--primary) 78%, var(--accent)) 55%, color-mix(in oklch, var(--primary) 88%, black) 100%)',
        boxShadow:
          '8px 8px 0 color-mix(in oklch, var(--primary) 25%, transparent), 0 24px 60px rgba(0,0,0,0.22)',
      }}
    >
      {/* Marco de bombillas arriba y abajo (estilo letrero de neón retro) */}
      <div
        aria-hidden
        className="absolute inset-x-6 top-3.5 h-2"
        style={{
          backgroundImage: 'radial-gradient(circle, oklch(0.88 0.14 88) 2.2px, transparent 3px)',
          backgroundSize: '20px 8px',
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'center',
          opacity: 0.9,
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-6 bottom-3.5 h-2"
        style={{
          backgroundImage: 'radial-gradient(circle, oklch(0.88 0.14 88) 2.2px, transparent 3px)',
          backgroundSize: '20px 8px',
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'center',
          opacity: 0.9,
        }}
      />
      {/* Destello cálido central */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, oklch(0.9 0.1 85), transparent 70%)' }}
      />

      <div className="relative flex flex-col items-center gap-4">
        <span className="label-caps !text-[10px] !tracking-[0.32em] text-white/70">✦ DevPlay Tienda ✦</span>
        <h2 className="font-display text-5xl sm:text-7xl font-black leading-none tracking-tight text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.25)]">
          ¡MUY PRONTO!
        </h2>
        <p className="max-w-md text-sm sm:text-base text-white/85 font-medium leading-relaxed">
          Estamos endulzando la tienda: power-ups, avatares y sorpresas para tu perfil.
          Sigue ganando DevCoins, que el día del estreno las vas a querer gastar 🪙
        </p>
        <span className="mt-1 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-xs font-bold text-white backdrop-blur">
          <ShoppingBag className="h-3.5 w-3.5" />
          Apertura muy pronto
        </span>
      </div>
    </motion.div>
  )
}

/**
 * Componente que renderiza un icono por nombre (evita "create components during render").
 */
function StoreIcon({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const Icon = ICON_MAP[name] ?? Package
  return <Icon className={className} />
}

const CATEGORY_META: Record<
  StoreCategory,
  { label: string; icon: LucideIcon; gradient: string; description: string }
> = {
  powerup: {
    label: 'Power-ups',
    icon: Zap,
    gradient: 'from-amber-400 to-bronze-500',
    description: 'Impulsa tu contenido',
  },
  avatar: {
    label: 'Avatar',
    icon: Palette,
    gradient: 'from-wine-500 to-wine-700',
    description: 'Personaliza tu perfil',
  },
  premium: {
    label: 'Premium',
    icon: Crown,
    gradient: 'from-olive-400 to-sepia-500',
    description: 'Funciones exclusivas',
  },
  bundle: {
    label: 'Bundles',
    icon: Package,
    gradient: 'from-wine-400 to-wine-500',
    description: 'Ahorra comprando packs',
  },
}

const CATEGORY_ORDER: StoreCategory[] = ['powerup', 'avatar', 'premium', 'bundle']

export function StoreView() {
  const { user, isAuthed, isGuest } = useCurrentUser()
  const { openAuth } = useUIStore()
  const qc = useQueryClient()
  const [activeCategory, setActiveCategory] = useState<StoreCategory | 'all'>('all')
  const [txHistoryOpen, setTxHistoryOpen] = useState(false)

  // Query de artículos
  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['store-items'],
    queryFn: () => storeService.getItems(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Query de balance
  const {
    data: balanceData,
    isLoading: balanceLoading,
  } = useQuery({
    queryKey: ['store-balance'],
    queryFn: () => storeService.getBalance(),
    enabled: !!user,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Query de mis items
  const { data: myItemsData, isLoading: myItemsLoading } = useQuery({
    queryKey: ['store-my-items'],
    queryFn: () => storeService.getMyItems(),
    enabled: !!user,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Mutación de compra
  const buyMutation = useMutation({
    mutationFn: (itemId: string) => storeService.buy(itemId),
    onSuccess: (data) => {
      toast.success(`Compra realizada: ${data.purchase.item.name}`, {
        description: `-${data.purchase.pricePaid} DevCoins · Balance: ${data.balance}`,
      })
      // Invalidar queries relacionadas
      qc.invalidateQueries({ queryKey: ['store-balance'] })
      qc.invalidateQueries({ queryKey: ['store-my-items'] })
    },
    onError: (err: Error) => {
      toast.error('No se pudo completar la compra', {
        description: err.message,
      })
    },
  })

  const allItems: StoreItem[] = itemsData?.items ?? []
  const ownedItemIds = useMemo(
    () => new Set((myItemsData?.items ?? []).map((p) => p.itemId)),
    [myItemsData]
  )
  const balance: number = balanceData?.balance ?? 0
  const myItems: StorePurchase[] = myItemsData?.items ?? []
  const transactions: DevCoinTransaction[] = balanceData?.transactions ?? []

  const visibleItems = useMemo(() => {
    if (activeCategory === 'all') return allItems
    return allItems.filter((i) => i.category === activeCategory)
  }, [allItems, activeCategory])

  const grouped = useMemo(() => {
    const g: Record<StoreCategory, StoreItem[]> = {
      powerup: [],
      avatar: [],
      premium: [],
      bundle: [],
    }
    for (const it of allItems) g[it.category].push(it)
    return g
  }, [allItems])

  // Para invitados o no logueados
  if (!user && !isAuthed) {
    return (
      <div className="space-y-6">
        <StoreHeader balance={0} loading={false} />
        <StoreClosedBanner />
        <div className="glass-card p-12 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <Lock className="h-8 w-8" />
          </div>
          <p className="font-semibold text-lg">Inicia sesión para comprar</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Necesitas una cuenta para ganar y gastar DevCoins en la tienda
          </p>
          <Button onClick={() => openAuth('login')} className="btn-gradient-primary rounded-sm">
            Entrar
          </Button>
        </div>

        {/* Cómo funciona DevCoins — llena el vacío con guía editorial */}
        <div className="glass-card frame-double p-5 sm:p-6">
          <div className="text-center mb-5">
            <p className="label-caps mb-1">La economía de la casa</p>
            <h3 className="font-display text-xl font-bold">Cómo funcionan los DevCoins</h3>
            <div className="rule-ornate w-40 mx-auto mt-3 opacity-60">
              <span className="text-[9px]">◆</span>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { n: 'I', icon: Rocket, title: 'Gana', text: 'Publica devlogs, ayuda en betas y recibe likes. Cada aporte suma monedas.' },
              { n: 'II', icon: Coins, title: 'Ahorra', text: 'Tu balance se guarda en tu cuenta. Sigue contribuyendo para los artículos premium.' },
              { n: 'III', icon: Gem, title: 'Gasta', text: 'Canjea power-ups, marcos para tu avatar y funciones premium exclusivas.' },
            ].map((step) => (
              <div key={step.n} className="text-center px-2">
                <div className="relative inline-flex items-center justify-center mb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-sm frame-double bg-primary/10 text-primary">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold font-display">
                    {step.n}
                  </span>
                </div>
                <p className="font-display font-bold text-sm mb-1">{step.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
          <div className="rule-ornate w-40 mx-auto mt-5 opacity-60">
            <span className="text-[9px]">◆</span>
          </div>
          <p className="text-center text-xs text-muted-foreground italic mt-4">
            Los DevCoins no se compran con dinero real — se ganan participando.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con balance */}
      <StoreHeader balance={balance} loading={balanceLoading && !balanceData} />

      {/* Aviso: tienda próximamente */}
      <StoreClosedBanner />

      {/* Aviso invitado */}
      {isGuest && (
        <div className="glass-card card-rose p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Los invitados no pueden comprar en la tienda. Crea una cuenta gratis para empezar a ganar DevCoins.
          </p>
          <Button
            onClick={() => openAuth('register')}
            className="btn-gradient-primary rounded-sm mt-3"
            size="sm"
          >
            Crear cuenta
          </Button>
        </div>
      )}

      {/* Tabs de categoría */}
      <div className="flex gap-1 border-b border-border/40 sticky top-16 z-10 bg-background/80 backdrop-blur-sm overflow-x-auto custom-scroll">
        <CategoryTab
          id="all"
          label="Todos"
          icon={ShoppingBag}
          active={activeCategory === 'all'}
          onClick={() => setActiveCategory('all')}
          count={allItems.length}
        />
        {CATEGORY_ORDER.map((cat) => (
          <CategoryTab
            key={cat}
            id={cat}
            label={CATEGORY_META[cat].label}
            icon={CATEGORY_META[cat].icon}
            active={activeCategory === cat}
            onClick={() => setActiveCategory(cat)}
            count={grouped[cat].length}
          />
        ))}
      </div>

      {/* Contenido */}
      {itemsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <EmptyState />
      ) : activeCategory === 'all' ? (
        // En "Todos" mostramos agrupado por categoría
        <div className="space-y-8">
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped[cat]
            if (items.length === 0) return null
            const meta = CATEGORY_META[cat]
            return (
              <section key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white',
                      meta.gradient
                    )}
                  >
                    <meta.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-bold text-base">{meta.label}</h3>
                    <p className="text-[11px] text-muted-foreground">{meta.description}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((item, i) => (
                    <StoreCard
                      key={item.id}
                      item={item}
                      owned={ownedItemIds.has(item.id)}
                      canAfford={balance >= item.price}
                      disabled={isGuest}
                      comingSoon={STORE_CLOSED}
                      buying={buyMutation.isPending && buyMutation.variables === item.id}
                      onBuy={() => buyMutation.mutate(item.id)}
                      index={i}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        // Vista de categoría individual
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleItems.map((item, i) => (
            <StoreCard
              key={item.id}
              item={item}
              owned={ownedItemIds.has(item.id)}
              canAfford={balance >= item.price}
              disabled={isGuest}
              comingSoon={STORE_CLOSED}
              buying={buyMutation.isPending && buyMutation.variables === item.id}
              onBuy={() => buyMutation.mutate(item.id)}
              index={i}
            />
          ))}
        </div>
      )}

      {/* ===== Mis artículos ===== */}
      <section className="pt-4">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-lg">Mis artículos</h3>
          {myItems.length > 0 && (
            <Badge variant="secondary" className="rounded-full">
              {myItems.length}
            </Badge>
          )}
        </div>

        {myItemsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-md" />
            ))}
          </div>
        ) : myItems.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Gift className="mx-auto mb-2 h-10 w-10 text-muted-foreground/60" />
            <p className="font-semibold">Aún no tienes artículos</p>
            <p className="text-sm text-muted-foreground mt-1">
              Explora la tienda y compra tu primer artículo
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {myItems.map((p, i) => (
              <OwnedItemCard key={p.id} purchase={p} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* ===== Historial de transacciones (colapsible) ===== */}
      <section className="pt-2">
        <Collapsible open={txHistoryOpen} onOpenChange={setTxHistoryOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between rounded-md bg-secondary/40 px-4 py-3 hover:bg-secondary/60 transition">
              <span className="flex items-center gap-2 font-semibold">
                <History className="h-4 w-4 text-primary" />
                Historial de transacciones
                {transactions.length > 0 && (
                  <Badge variant="secondary" className="rounded-full">
                    {transactions.length}
                  </Badge>
                )}
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform',
                  txHistoryOpen && 'rotate-180'
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 rounded-md border border-border/40 bg-secondary/20 divide-y divide-border/30">
              {transactions.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No hay transacciones todavía
                </div>
              ) : (
                transactions.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} />
                ))
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </section>

      <div className="h-4" />
    </div>
  )
}

// ===== Header con balance =====
function StoreHeader({ balance, loading }: { balance: number; loading: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-3"
    >
      <h1 className="text-section flex items-center justify-center gap-2">
        <ShoppingBag className="h-7 w-7 text-wine-600 dark:text-wine-400" />
        Tienda DevPlay
      </h1>
      <p className="text-sm text-muted-foreground">
        Gasta tus DevCoins en power-ups, items para tu avatar y funciones premium
      </p>

      {/* Card de balance — tarjeta editorial con doble filete */}
      <div className="mx-auto max-w-md">
        <div className="frame-double rounded-sm bg-card px-6 py-4">
          <div className="flex items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-wine-100 dark:bg-wine-500/15 text-wine-600 dark:text-wine-400">
              <Coins className="h-6 w-6" />
            </div>
            <div className="text-left">
              <p className="label-caps">
                Tu balance
              </p>
              {loading ? (
                <Skeleton className="h-7 w-24 bg-secondary" />
              ) : (
                <AnimatedBalance value={balance} />
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ===== Balance animado =====
function AnimatedBalance({ value }: { value: number }) {
  return (
    <motion.div
      key={value}
      initial={{ scale: 1.2, opacity: 0.5 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 18, stiffness: 300 }}
      className="text-3xl font-bold tabular-nums text-wine-600 dark:text-wine-400"
    >
      {value.toLocaleString('es')}
      <span className="ml-1 text-base font-semibold text-muted-foreground">DC</span>
    </motion.div>
  )
}

// ===== Tab de categoría =====
function CategoryTab({
  label,
  icon: Icon,
  active,
  onClick,
  count,
}: {
  id: string
  label: string
  icon: LucideIcon
  active: boolean
  onClick: () => void
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 text-sm font-medium transition relative flex items-center gap-1.5 whitespace-nowrap',
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span className="text-[10px] text-muted-foreground/70">({count})</span>
      {active && (
        <motion.div
          layoutId="store-tab-indicator"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
        />
      )}
    </button>
  )
}

// ===== Card de artículo =====
function StoreCard({
  item,
  owned,
  canAfford,
  disabled,
  comingSoon,
  buying,
  onBuy,
  index,
}: {
  item: StoreItem
  owned: boolean
  canAfford: boolean
  disabled: boolean
  comingSoon?: boolean
  buying: boolean
  onBuy: () => void
  index: number
}) {
  const meta = CATEGORY_META[item.category]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4) }}
      className={cn(
        'glass-card group relative flex flex-col overflow-hidden',
        owned && 'ring-1 ring-olive-400/40'
      )}
    >
      {/* Header con icono */}
      <div className={cn('relative h-28 bg-gradient-to-br', meta.gradient)}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: 'spring', damping: 15 }}
            className="flex h-16 w-16 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm"
          >
            <StoreIcon name={item.icon} className="h-8 w-8 text-white" />
          </motion.div>
        </div>
        {owned && (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-olive-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
            <Check className="h-3 w-3" />
            Ya comprado
          </div>
        )}
        <div className="absolute top-2 left-2 rounded-full bg-black/30 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-white uppercase tracking-wide">
          {meta.label}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-bold text-base line-clamp-1">{item.name}</h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-3 flex-1">
          {item.description}
        </p>

        {/* Metadata */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {item.duration ? (
            <Badge variant="secondary" className="rounded-full text-[10px]">
              {item.duration} día{item.duration > 1 ? 's' : ''}
            </Badge>
          ) : (
            <Badge variant="secondary" className="rounded-full text-[10px] bg-olive-100 text-olive-700 dark:bg-olive-500/20 dark:text-olive-300">
              Permanente
            </Badge>
          )}
        </div>

        {/* Precio + botón */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Coins className="h-4 w-4 text-amber-500" />
            <span className="font-black text-lg tabular-nums">{item.price}</span>
          </div>

          {owned ? (
            <Button disabled variant="outline" size="sm" className="rounded-full gap-1">
              <Check className="h-3.5 w-3.5" />
              Adquirido
            </Button>
          ) : comingSoon ? (
            <Button disabled variant="outline" size="sm" className="rounded-full gap-1 border-primary/40 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Pronto
            </Button>
          ) : disabled ? (
            <Button disabled variant="outline" size="sm" className="rounded-full gap-1">
              <Lock className="h-3.5 w-3.5" />
              Bloqueado
            </Button>
          ) : !canAfford ? (
            <Button disabled size="sm" className="rounded-full gap-1 opacity-60">
              <Coins className="h-3.5 w-3.5" />
              Insuficiente
            </Button>
          ) : (
            <Button
              onClick={onBuy}
              disabled={buying}
              size="sm"
              className="btn-gradient-primary rounded-sm gap-1.5"
            >
              {buying ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </motion.div>
              ) : (
                <ShoppingCart className="h-3.5 w-3.5" />
              )}
              {buying ? 'Comprando...' : 'Comprar'}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ===== Card de artículo propio =====
function OwnedItemCard({
  purchase,
  index,
}: {
  purchase: StorePurchase
  index: number
}) {
  const meta = CATEGORY_META[purchase.item.category]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className="glass-card flex items-center gap-3 p-3 ring-1 ring-olive-400/30"
    >
      <span
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white',
          meta.gradient
        )}
      >
        <StoreIcon name={purchase.item.icon} className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="font-semibold text-sm truncate">{purchase.item.name}</p>
          <Check className="h-3.5 w-3.5 text-olive-500 shrink-0" />
        </div>
        <p className="text-[10px] text-muted-foreground">
          {purchase.item.duration
            ? `${purchase.item.duration} día${purchase.item.duration > 1 ? 's' : ''} de duración`
            : 'Permanente'}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
            <Coins className="h-3 w-3" />
            {purchase.pricePaid}
          </span>
          <TimeAgo date={purchase.createdAt} className="text-[10px]" />
        </div>
      </div>
    </motion.div>
  )
}

// ===== Fila de transacción =====
function TransactionRow({ tx }: { tx: DevCoinTransaction }) {
  const isPositive = tx.amount > 0
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isPositive
            ? 'bg-olive-100 text-olive-600 dark:bg-olive-500/20 dark:text-olive-300'
            : 'bg-wine-100 text-wine-600 dark:bg-wine-500/20 dark:text-wine-300'
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{tx.description}</p>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="rounded-full text-[9px] py-0 h-4">
            {tx.type}
          </Badge>
          <TimeAgo date={tx.createdAt} className="text-[10px]" />
        </div>
      </div>
      <span
        className={cn(
          'font-bold tabular-nums text-sm',
          isPositive ? 'text-olive-600 dark:text-olive-400' : 'text-wine-600 dark:text-wine-400'
        )}
      >
        {isPositive ? '+' : ''}
        {tx.amount}
        <span className="ml-0.5 text-[10px] text-muted-foreground">DC</span>
      </span>
    </div>
  )
}

// ===== Empty state =====
function EmptyState() {
  return (
    <div className="glass-card p-12 text-center">
      <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-amber-300 to-yellow-400 text-white">
        <ShoppingBag className="h-8 w-8" />
      </div>
      <p className="font-semibold text-lg">No hay artículos disponibles</p>
      <p className="text-sm text-muted-foreground mt-1">
        Vuelve más tarde, estamos agregando nuevos productos
      </p>
    </div>
  )
}
