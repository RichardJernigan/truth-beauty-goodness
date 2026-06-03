'use client'

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'

interface Chip { id: string; text: string; x: number; y: number }

// ─── Design-space constants ───────────────────────────────────────────────────
const LW = 900   // logical canvas width
const LH = 720   // logical canvas height
const MIN_SCALE = 0.65   // floor for narrow phones (horizontal scroll below this)
const V_OVERHEAD = 200   // px reserved for title + form + margins (fixed, not scaled)

const T = { cx: 290, cy: 262, r: 188 }
const B = { cx: 580, cy: 262, r: 188 }
const G = { cx: 435, cy: 470, r: 188 }

// ─── Scale formula ────────────────────────────────────────────────────────────
// byWidth  = how much we can scale before overflowing viewport width
// byHeight = how much we can scale before overflowing viewport height
//
// Rule: scale up freely when height allows (≥ 920 px viewport, i.e. byHeight ≥ 1).
//       On short screens (laptops, phones) keep design-space size (cap = 1).
//       Always respect MIN_SCALE floor so narrow phones get a horizontal scroll.
function computeScale(vw: number, vh: number) {
  const byWidth  = (vw - 32) / LW
  const byHeight = (vh - V_OVERHEAD) / LH
  return Math.max(MIN_SCALE, Math.min(byWidth, Math.max(byHeight, 1)))
}

// ─── Default chip positions ───────────────────────────────────────────────────
// 42-px vertical gaps so chips don't overlap at MIN_SCALE (0.65 × 42 = 27 px > chip height)
const DEFAULTS: Chip[] = [
  // — Truth —
  { id: 't1', text: 'Facts',              x: 118, y: 163 },
  { id: 't2', text: 'Scientific inquiry', x: 100, y: 205 },
  { id: 't3', text: 'Honesty',            x: 128, y: 247 },
  { id: 't4', text: 'Integrity',          x: 118, y: 289 },
  { id: 't5', text: 'Intelligence',       x: 112, y: 323 },
  // — Beauty —
  { id: 'b1', text: 'Harmony',              x: 666, y: 163 },
  { id: 'b2', text: 'Aesthetic perception', x: 660, y: 205 },
  { id: 'b3', text: 'Visceral response',    x: 663, y: 247 },
  { id: 'b4', text: 'Heroic narrative',     x: 663, y: 289 },
  // — Truth + Beauty overlap —
  { id: 'tb1', text: 'Story telling', x: 398, y: 172 },
  // — Triple overlap —
  { id: 'c1', text: 'Justice',       x: 412, y: 342 },
  { id: 'c2', text: 'Understanding', x: 400, y: 384 },
  // — Goodness —
  { id: 'g1', text: 'Kindness',   x: 382, y: 514 },
  { id: 'g2', text: 'Compassion', x: 366, y: 556 },
  { id: 'g3', text: 'Empathy',    x: 382, y: 598 },
  { id: 'g4', text: 'Tolerance',  x: 368, y: 636 },
]

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

const clamp = (min: number, v: number, max: number) => Math.min(max, Math.max(min, v))

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Page() {
  const [chips, setChips] = useState<Chip[]>(DEFAULTS)
  const [input, setInput]  = useState('')
  const [scale, setScale]  = useState(1)
  const canvasRef  = useRef<HTMLDivElement>(null)
  const drag       = useRef<{ id: string; ox: number; oy: number } | null>(null)
  const scaleRef   = useRef(scale)
  useEffect(() => { scaleRef.current = scale }, [scale])

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
  }, [])
  useEffect(() => {
    localStorage.setItem('tbg-chips', JSON.stringify(chips))
  }, [chips])

  // Drag — offsets stored in design-space coords so they survive viewport resize
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, id: string) => {
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const rect = el.getBoundingClientRect()
    const s = scaleRef.current
    drag.current = { id, ox: (e.clientX - rect.left) / s, oy: (e.clientY - rect.top) / s }
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (!drag.current || drag.current.id !== id) return
    const cr = canvasRef.current!.getBoundingClientRect()
    const s = scaleRef.current
    setChips(prev => prev.map(c =>
      c.id === id
        ? { ...c, x: (e.clientX - cr.left) / s - drag.current!.ox, y: (e.clientY - cr.top) / s - drag.current!.oy }
        : c
    ))
  }, [])

  const onPointerUp = useCallback(() => { drag.current = null }, [])

  const removeChip = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setChips(prev => prev.filter(c => c.id !== id))
  }, [])

  const addChip = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setChips(prev => [...prev, { id: `u${Date.now()}`, text, x: LW / 2 - 50, y: LH / 2 - 16 }])
    setInput('')
  }

  const reset = () => { setChips(DEFAULTS); localStorage.removeItem('tbg-chips') }

  const cw = Math.round(LW * scale)
  const ch = Math.round(LH * scale)

  // Scale-responsive UI sizes — form/title grow with the canvas on large screens
  const titleSize  = clamp(11, Math.round(11  * scale), 20)
  const formFont   = clamp(14, Math.round(15  * scale), 24)
  const formPadV   = clamp(10, Math.round(11  * scale), 18)
  const formPadH   = clamp(18, Math.round(22  * scale), 40)
  const hintSize   = clamp(10, Math.round(11  * scale), 17)

  // True when the canvas is wider than the viewport — needs horizontal scroll
  const needsHScroll = typeof window !== 'undefined' && cw > window.innerWidth - 32

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

      <h1 style={{
        fontSize: titleSize,
        fontWeight: 600,
        letterSpacing: '0.32em',
        textTransform: 'uppercase',
        color: '#a090aa',
        marginBottom: Math.round(20 * Math.min(scale, 1.5)),
        userSelect: 'none',
        paddingInline: 16,
      }}>
        Truth · Beauty · Goodness
      </h1>

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
            {/* Labels — fontSize in viewBox units, so they scale with the SVG automatically */}
            <text x={T.cx} y={T.cy} textAnchor="middle" dominantBaseline="middle" fill="#c85858" fontSize="18" fontWeight="700" letterSpacing="6" opacity="0.60">TRUTH</text>
            <text x={B.cx} y={B.cy} textAnchor="middle" dominantBaseline="middle" fill="#3a8050" fontSize="18" fontWeight="700" letterSpacing="6" opacity="0.60">BEAUTY</text>
            <text x={G.cx} y={G.cy} textAnchor="middle" dominantBaseline="middle" fill="#6040a0" fontSize="18" fontWeight="700" letterSpacing="6" opacity="0.60">GOODNESS</text>
          </svg>

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

      {/* Form — proportionally larger on presentation screens */}
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
          placeholder="Add a word or phrase…"
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
          Add
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
          Reset
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
        Drag chips freely · tap × to remove
      </p>
    </main>
  )
}

// ─── Chip component ───────────────────────────────────────────────────────────

interface ChipElProps {
  chip:         Chip
  scale:        number
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, id: string) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>, id: string) => void
  onPointerUp:  () => void
  onRemove:     (e: React.MouseEvent, id: string) => void
}

function ChipEl({ chip, scale, onPointerDown, onPointerMove, onPointerUp, onRemove }: ChipElProps) {
  const [hoverX,   setHoverX]   = useState(false)
  const [dragging, setDragging] = useState(false)

  // All chip dimensions scale with the canvas so chips stay proportional
  // at every size from MIN_SCALE (mobile) to 2.7× (4K display)
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
      onPointerDown={e => { setDragging(true);  onPointerDown(e, chip.id) }}
      onPointerMove={e => onPointerMove(e, chip.id)}
      onPointerUp={() => { setDragging(false); onPointerUp() }}
      onPointerCancel={() => { setDragging(false); onPointerUp() }}
      style={{
        position:  'absolute',
        left:  0,
        top:   0,
        // GPU-composited transform — smoother than animating left/top
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
        touchAction: 'none',    // stops browser scroll-hijack during drag
        whiteSpace: 'nowrap',
        zIndex:    dragging ? 100 : 10,
        scale:     dragging ? '1.04' : '1',
        transition: 'box-shadow 0.12s, scale 0.12s',
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
