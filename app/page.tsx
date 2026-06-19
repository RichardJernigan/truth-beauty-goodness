'use client'

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'

interface Chip { id: string; text: string; x: number; y: number }

// ─── Design-space constants ───────────────────────────────────────────────────
const LW = 900   // logical canvas width
const LH = 864   // logical canvas height (20 % taller than circles for instruction text)
const MIN_SCALE = 0.65   // floor for narrow phones (horizontal scroll below this)
const V_OVERHEAD = 200   // px reserved for title + form + margins (fixed, not scaled)

// Circles shifted down 144 px (= 20 % of old LH) to make room for instruction text above
const T = { cx: 290, cy: 406, r: 188 }
const B = { cx: 580, cy: 406, r: 188 }
const G = { cx: 435, cy: 614, r: 188 }

// Top of T/B circles in design space — instruction text lives in [0, INSTR_TOP)
const INSTR_TOP = 218   // = cy(406) − r(188)

// ─── Scale formula ────────────────────────────────────────────────────────────
function computeScale(vw: number, vh: number) {
  const byWidth  = (vw - 32) / LW
  const byHeight = (vh - V_OVERHEAD) / LH
  return Math.max(MIN_SCALE, Math.min(byWidth, Math.max(byHeight, 1)))
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

const clamp = (min: number, v: number, max: number) => Math.min(max, Math.max(min, v))

// ─── Translations ─────────────────────────────────────────────────────────────
type Lang = 'en' | 'es' | 'fr' | 'pt'

const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
]

const T_STRINGS: Record<Lang, {
  instruction: string
  truth: string; beauty: string; goodness: string
  placeholder: string
  add: string; undo: string; reset: string
  hint: string
}> = {
  en: {
    instruction: "Think about the three words: Truth, Beauty, and Goodness. What words, phrases, or concepts do you associate with each of these? Type in your words or phrases. Each will be placed outside the diagram. Move them around based on how much they relate (or don't relate) to the main three concepts and to each other.",
    truth: 'TRUTH', beauty: 'BEAUTY', goodness: 'GOODNESS',
    placeholder: 'Add a word or phrase…',
    add: 'Add', undo: 'Undo', reset: 'Reset',
    hint: 'Drag chips freely · tap × to remove',
  },
  es: {
    instruction: "Piensa en las tres palabras: Verdad, Belleza y Bondad. ¿Qué palabras, frases o conceptos asocias con cada una de ellas? Escribe tus palabras o frases. Cada una se colocará fuera del diagrama. Muévelas según se relacionen (o no) con los tres conceptos principales y entre sí.",
    truth: 'VERDAD', beauty: 'BELLEZA', goodness: 'BONDAD',
    placeholder: 'Añade una palabra o frase...',
    add: 'Añadir', undo: 'Deshacer', reset: 'Reiniciar',
    hint: 'Arrastra libremente · toca × para eliminar',
  },
  fr: {
    instruction: "Pensez aux trois mots : Vérité, Beauté et Bonté. Quels mots, phrases ou concepts associez-vous à chacun d'eux ? Tapez vos mots ou phrases. Chacun sera placé en dehors du diagramme. Déplacez-les selon leur lien (ou non) avec les trois concepts principaux et entre eux.",
    truth: 'VÉRITÉ', beauty: 'BEAUTÉ', goodness: 'BONTÉ',
    placeholder: 'Ajoutez un mot ou une phrase...',
    add: 'Ajouter', undo: 'Annuler', reset: 'Réinitialiser',
    hint: 'Faites glisser · appuyez sur × pour supprimer',
  },
  pt: {
    instruction: "Pense nas três palavras: Verdade, Beleza e Bondade. Que palavras, frases ou conceitos você associa a cada uma delas? Digite suas palavras ou frases. Cada uma será colocada fora do diagrama. Mova-as de acordo com sua relação (ou não) com os três conceitos principais e entre si.",
    truth: 'VERDADE', beauty: 'BELEZA', goodness: 'BONDADE',
    placeholder: 'Adicione uma palavra ou frase...',
    add: 'Adicionar', undo: 'Desfazer', reset: 'Redefinir',
    hint: 'Arraste livremente · toque × para remover',
  },
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Page() {
  const [chips, setChips]     = useState<Chip[]>([])
  const [input, setInput]     = useState('')
  const [scale, setScale]     = useState(1)
  const [historyLen, setHistoryLen] = useState(0)
  const [lang, setLang]       = useState<Lang>('en')

  const canvasRef  = useRef<HTMLDivElement>(null)
  const chipsRef   = useRef<Chip[]>([])
  const historyRef = useRef<Chip[][]>([])

  const drag = useRef<{
    id: string; ox: number; oy: number; pointerId: number; preSnapshot: Chip[]
  } | null>(null)

  const undoRef  = useRef<() => void>(() => {})
  const scaleRef = useRef(scale)

  const t = T_STRINGS[lang]

  useEffect(() => { canvasRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      console.log('key pressed', e.key, e.metaKey)
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'z') return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      e.preventDefault()
      undoRef.current?.()
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [])

  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { chipsRef.current = chips },  [chips])

  // Responsive scale — runs before paint, no layout flash
  useIsomorphicLayoutEffect(() => {
    const update = () => setScale(computeScale(window.innerWidth, window.innerHeight))
    update()
    window.addEventListener('resize', update, { passive: true })
    return () => window.removeEventListener('resize', update)
  }, [])

  // localStorage persistence
  useEffect(() => {
    try { const s = localStorage.getItem('tbg-chips'); if (s) setChips(JSON.parse(s)) } catch {}
    try { const l = localStorage.getItem('tbg-lang'); if (l) setLang(l as Lang) } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('tbg-chips', JSON.stringify(chips)) } catch {}
  }, [chips])

  const changeLang = (l: Lang) => {
    setLang(l)
    try { localStorage.setItem('tbg-lang', l) } catch {}
  }

  // ─── Undo history ────────────────────────────────────────────────────────────
  const pushHistory = useCallback((snapshot: Chip[]) => {
    const next = [...historyRef.current, snapshot].slice(-20)
    historyRef.current = next
    setHistoryLen(next.length)
  }, [])

  const undo = useCallback(() => {
    const h = historyRef.current
    if (!h.length) return
    const snapshot = h[h.length - 1]
    historyRef.current = h.slice(0, -1)
    setHistoryLen(h.length - 1)
    setChips(snapshot)
  }, [])
  undoRef.current = undo

  // Drag handlers
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, id: string, chipX: number, chipY: number) => {
    try {
      if (drag.current) return
      e.preventDefault()
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* non-fatal */ }
      const canvas = canvasRef.current
      if (!canvas) return
      const cr = canvas.getBoundingClientRect()
      const s = scaleRef.current || 1
      drag.current = {
        id,
        pointerId: e.pointerId,
        ox: (e.clientX - cr.left) / s - chipX,
        oy: (e.clientY - cr.top) / s - chipY,
        preSnapshot: [...chipsRef.current],
      }
    } catch {
      drag.current = null
    }
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>, id: string) => {
    try {
      const d = drag.current
      if (!d || d.id !== id || d.pointerId !== e.pointerId) return
      const canvas = canvasRef.current
      if (!canvas) return
      const cr = canvas.getBoundingClientRect()
      const s = scaleRef.current || 1
      const newX = (e.clientX - cr.left) / s - d.ox
      const newY = (e.clientY - cr.top) / s - d.oy
      setChips(prev => prev.map(c => c.id === id ? { ...c, x: newX, y: newY } : c))
    } catch {
      drag.current = null
    }
  }, [])

  const onPointerUp = useCallback(() => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const after  = chipsRef.current.find(c => c.id === d.id)
    const before = d.preSnapshot.find(c => c.id === d.id)
    if (after && before && (Math.abs(after.x - before.x) > 2 || Math.abs(after.y - before.y) > 2)) {
      const next = [...historyRef.current, d.preSnapshot].slice(-20)
      historyRef.current = next
      setHistoryLen(next.length)
    }
    canvasRef.current?.focus()
  }, [])

  // Global safety net
  useEffect(() => {
    window.addEventListener('pointerup',     onPointerUp, { capture: true })
    window.addEventListener('pointercancel', onPointerUp, { capture: true })
    return () => {
      window.removeEventListener('pointerup',     onPointerUp, { capture: true })
      window.removeEventListener('pointercancel', onPointerUp, { capture: true })
    }
  }, [onPointerUp])

  const removeChip = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    pushHistory(chipsRef.current)
    setChips(prev => prev.filter(c => c.id !== id))
  }, [pushHistory])

  const commitChip = useCallback(() => {
    const text = input.trim()
    if (!text) return
    pushHistory(chipsRef.current)
    setChips(prev => [...prev, { id: `u${Date.now()}`, text, x: 635, y: 650 }])
    setInput('')
  }, [input, pushHistory])

  const addChip = (e: React.FormEvent) => {
    e.preventDefault()
    commitChip()
  }

  const reset = () => { pushHistory(chipsRef.current); setChips([]) }

  const cw = Math.round(LW * scale)
  const ch = Math.round(LH * scale)

  const titleSize  = clamp(11, Math.round(11  * scale), 20)
  const formFont   = clamp(14, Math.round(15  * scale), 24)
  const formPadV   = clamp(10, Math.round(11  * scale), 18)
  const formPadH   = clamp(18, Math.round(22  * scale), 40)
  const hintSize   = clamp(10, Math.round(11  * scale), 17)

  const needsHScroll = scale <= MIN_SCALE + 0.01

  return (
    <main style={{
      minHeight: '100dvh',
      background: '#f5f3ef',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 0 52px',
      boxSizing: 'border-box',
    }}>

      {/* Title row with language selector */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: Math.min(cw + 32, 900),
        paddingInline: 16,
        boxSizing: 'border-box',
        marginBottom: Math.round(20 * Math.min(scale, 1.5)),
        position: 'relative',
      }}>
        <h1 style={{
          fontSize: titleSize,
          fontWeight: 600,
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          color: '#a090aa',
          margin: 0,
          userSelect: 'none',
          flex: 1,
          textAlign: 'center',
        }}>
          Truth · Beauty · Goodness
        </h1>
        <select
          value={lang}
          onChange={e => changeLang(e.target.value as Lang)}
          style={{
            position: 'absolute',
            right: 16,
            fontSize: 12,
            color: '#a090aa',
            background: 'none',
            border: '1px solid #d4cdd8',
            borderRadius: 6,
            padding: '3px 6px',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {LANGS.map(l => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>

      {/* Horizontal scroll wrapper — active only on narrow phones */}
      <div
        className="canvas-scroll"
        style={{
          width: '100%',
          overflowX: needsHScroll ? 'auto' : 'visible',
          WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
          paddingInline: 16,
          boxSizing: 'border-box',
        }}
      >
        <div
          ref={canvasRef}
          data-canvas
          tabIndex={0}
          style={{
            position: 'relative',
            marginInline: 'auto',
            width: cw,
            height: ch,
            flexShrink: 0,
            background: '#fdfcfa',
            borderRadius: Math.round(20 * scale),
            boxShadow: `0 ${Math.round(2 * scale)}px ${Math.round(24 * scale)}px rgba(0,0,0,0.07)`,
          }}
        >
          {/* SVG — viewBox keeps geometry in design space; width/height scale everything */}
          <svg
            viewBox={`0 0 ${LW} ${LH}`}
            width={cw}
            height={ch}
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              overflow: 'hidden',
              borderRadius: Math.round(20 * scale),
            }}
          >
            <circle cx={T.cx} cy={T.cy} r={T.r} fill="#F08080" fillOpacity={0.22} stroke="#d86464" strokeWidth={1.5} strokeOpacity={0.4} />
            <circle cx={B.cx} cy={B.cy} r={B.r} fill="#8FBC8F" fillOpacity={0.22} stroke="#5a9a5a" strokeWidth={1.5} strokeOpacity={0.4} />
            <circle cx={G.cx} cy={G.cy} r={G.r} fill="#B39DDB" fillOpacity={0.22} stroke="#8060b8" strokeWidth={1.5} strokeOpacity={0.4} />
            <text x={T.cx} y={T.cy} textAnchor="middle" dominantBaseline="middle" fill="#c85858" fontSize="18" fontWeight="700" letterSpacing="6" opacity="0.60">{t.truth}</text>
            <text x={B.cx} y={B.cy} textAnchor="middle" dominantBaseline="middle" fill="#3a8050" fontSize="18" fontWeight="700" letterSpacing="6" opacity="0.60">{t.beauty}</text>
            <text x={G.cx} y={G.cy} textAnchor="middle" dominantBaseline="middle" fill="#6040a0" fontSize="18" fontWeight="700" letterSpacing="6" opacity="0.60">{t.goodness}</text>
          </svg>

          {/* Instruction text — sits in the 218 design-unit space above the circles */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: Math.round(INSTR_TOP * scale),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: `${Math.round(18 * scale)}px ${Math.round(52 * scale)}px`,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <p style={{
              margin: 0,
              fontSize: clamp(10, Math.round(12 * scale), 20),
              lineHeight: 1.7,
              color: '#a898b2',
              textAlign: 'center',
              fontWeight: 400,
              letterSpacing: '0.01em',
            }}>
              {t.instruction}
            </p>
          </div>

          {chips.map(chip => (
            <ChipEl
              key={chip.id}
              chip={chip}
              scale={scale}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onRemove={removeChip}
            />
          ))}
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={addChip}
        style={{
          marginTop: Math.round(20 * Math.min(scale, 1.5)),
          display: 'flex',
          gap: Math.round(8 * Math.min(scale, 1.5)),
          width: '100%',
          maxWidth: Math.min(cw + 32, 900),
          paddingInline: 16,
          boxSizing: 'border-box',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={t.placeholder}
          style={{
            flex: '1 1 160px',
            minWidth: 0,
            border: '1.5px solid #d4cdd8',
            borderRadius: 999,
            padding: `${formPadV}px ${formPadH}px`,
            fontSize: formFont,
            color: '#333',
            outline: 'none',
            background: '#fff',
            WebkitAppearance: 'none',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = '#9070c0')}
          onBlur={e => (e.currentTarget.style.borderColor = '#d4cdd8')}
        />
        <button
          type="submit"
          onClick={commitChip}
          style={{
            flexShrink: 0,
            background: '#9070c0',
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            padding: `${formPadV}px ${formPadH}px`,
            fontSize: formFont,
            fontWeight: 600,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {t.add}
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={historyLen === 0}
          style={{
            flexShrink: 0,
            background: 'none',
            color: historyLen > 0 ? '#9b8ea0' : '#ddd',
            border: `1.5px solid ${historyLen > 0 ? '#c8bdd0' : '#ece8f0'}`,
            borderRadius: 999,
            padding: `${formPadV - 1}px ${Math.round(formPadH * 0.7)}px`,
            fontSize: Math.round(formFont * 0.9),
            cursor: historyLen > 0 ? 'pointer' : 'default',
            WebkitTapHighlightColor: 'transparent',
            transition: 'color 0.15s, border-color 0.15s',
          }}
        >
          {t.undo}
        </button>
        <button
          type="button"
          onClick={reset}
          style={{
            flexShrink: 0,
            background: 'none',
            color: '#ccc',
            border: '1.5px solid #e0dce4',
            borderRadius: 999,
            padding: `${formPadV - 1}px ${Math.round(formPadH * 0.7)}px`,
            fontSize: Math.round(formFont * 0.9),
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {t.reset}
        </button>
      </form>

      <p style={{
        marginTop: Math.round(14 * Math.min(scale, 1.5)),
        fontSize: hintSize,
        color: '#ccc',
        letterSpacing: '0.05em',
        userSelect: 'none',
        textAlign: 'center',
        paddingInline: 16,
      }}>
        {t.hint}
      </p>
    </main>
  )
}

// ─── Chip component ───────────────────────────────────────────────────────────

interface ChipElProps {
  chip:         Chip
  scale:        number
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, id: string, x: number, y: number) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>, id: string) => void
  onPointerUp:  () => void
  onRemove:     (e: React.MouseEvent, id: string) => void
}

function ChipEl({ chip, scale, onPointerDown, onPointerMove, onPointerUp, onRemove }: ChipElProps) {
  const [hoverX,   setHoverX]   = useState(false)
  const [dragging, setDragging] = useState(false)

  const chipFont  = clamp( 8, Math.round( 9  * scale), 25)
  const chipPadV  = clamp( 1, Math.round( 2  * scale),  6)
  const chipPadL  = clamp( 7, Math.round( 9  * scale), 28)
  const chipPadR  = clamp( 3, Math.round( 4  * scale), 12)
  const chipGap   = clamp( 1, Math.round( 1  * scale),  4)
  const xBtnSize  = clamp(20, Math.round(19  * scale), 54)
  const xFontSize = clamp( 9, Math.round(12  * scale), 35)

  return (
    <div
      data-chip
      onPointerDown={e => { try { setDragging(true); onPointerDown(e, chip.id, chip.x, chip.y) } catch { setDragging(false) } }}
      onPointerMove={e => { try { onPointerMove(e, chip.id) } catch { /* non-fatal */ } }}
      onPointerUp={() => { try { setDragging(false); onPointerUp() } finally { setDragging(false) } }}
      onPointerCancel={() => { try { setDragging(false); onPointerUp() } finally { setDragging(false) } }}
      style={{
        position:  'absolute',
        left:  0,
        top:   0,
        transform: `translate(${Math.round(chip.x * scale)}px, ${Math.round(chip.y * scale)}px)`,
        willChange: 'transform',
        display:    'flex',
        alignItems: 'center',
        gap:        chipGap,
        background: 'rgba(255,255,255,0.95)',
        border:     '1px solid rgba(0,0,0,0.10)',
        borderRadius: 999,
        padding:   `${chipPadV}px ${chipPadR}px ${chipPadV}px ${chipPadL}px`,
        boxShadow:  dragging
          ? `0 ${Math.round(6*scale)}px ${Math.round(22*scale)}px rgba(0,0,0,0.18)`
          : `0 ${Math.round(1*scale)}px ${Math.round(5*scale)}px rgba(0,0,0,0.10)`,
        cursor:   dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        whiteSpace: 'nowrap',
        zIndex:    dragging ? 100 : 10,
        transition: 'box-shadow 0.12s',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ fontSize: chipFont, color: '#444', fontWeight: 500, lineHeight: 1.3 }}>
        {chip.text}
      </span>
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={e => onRemove(e, chip.id)}
        onMouseEnter={() => setHoverX(true)}
        onMouseLeave={() => setHoverX(false)}
        aria-label={`Remove ${chip.text}`}
        style={{
          flexShrink: 0,
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width:  xBtnSize,
          height: xBtnSize,
          padding: 0,
          background: hoverX ? 'rgba(220,70,70,0.08)' : 'none',
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer',
          fontSize: xFontSize,
          lineHeight: 1,
          color:  hoverX ? '#d84444' : '#c0b8c8',
          transition: 'color 0.14s, background 0.14s',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        ×
      </button>
    </div>
  )
}
