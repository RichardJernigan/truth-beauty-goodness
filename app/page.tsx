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
type Lang = 'en' | 'es' | 'fr' | 'pt' | 'zh' | 'nl' | 'de' | 'it' | 'ru' | 'pl' | 'ro' | 'cs' | 'fi' | 'el' | 'lt' | 'tr' | 'et' | 'da' | 'hu' | 'bg' | 'he' | 'ar' | 'fa' | 'ko'

const RTL_LANGS = new Set<Lang>(['he', 'ar', 'fa'])

const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'bg', label: 'Български' },
  { code: 'zh', label: '中文' },
  { code: 'cs', label: 'Čeština' },
  { code: 'da', label: 'Dansk' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'et', label: 'Eesti' },
  { code: 'fi', label: 'Suomi' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'el', label: 'Ελληνικά' },
  { code: 'hu', label: 'Magyar' },
  { code: 'it', label: 'Italiano' },
  { code: 'lt', label: 'Lietuvių' },
  { code: 'pl', label: 'Polski' },
  { code: 'pt', label: 'Português' },
  { code: 'ro', label: 'Română' },
  { code: 'ru', label: 'Русский' },
  { code: 'es', label: 'Español' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ar', label: 'العربية' },
  { code: 'fa', label: 'فارسی' },
  { code: 'he', label: 'עברית' },
  { code: 'ko', label: '한국어' },
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
  zh: {
    instruction: "想想这三个词：真、美、善。你把哪些词语、短语或概念与它们联系在一起？输入你的词语或短语，每个词将被放在图表外面。根据它们与这三个主要概念以及彼此之间的关联程度来移动它们。",
    truth: '真', beauty: '美', goodness: '善',
    placeholder: '添加一个词或短语...',
    add: '添加', undo: '撤销', reset: '重置',
    hint: '自由拖动 · 点击 × 删除',
  },
  nl: {
    instruction: "Denk aan de drie woorden: Waarheid, Schoonheid en Goedheid. Welke woorden, zinnen of concepten associeer je met elk ervan? Typ je woorden of zinnen. Elk woord wordt buiten het diagram geplaatst. Verplaats ze op basis van hoe sterk ze verband houden (of niet) met de drie hoofdconcepten en met elkaar.",
    truth: 'WAARHEID', beauty: 'SCHOONHEID', goodness: 'GOEDHEID',
    placeholder: 'Voeg een woord of zin toe...',
    add: 'Toevoegen', undo: 'Ongedaan', reset: 'Opnieuw',
    hint: 'Vrij slepen · tik × om te verwijderen',
  },
  de: {
    instruction: "Denke an die drei Wörter: Wahrheit, Schönheit und Güte. Welche Wörter, Sätze oder Konzepte verbindest du mit jedem davon? Tippe deine Wörter oder Sätze ein. Jedes wird außerhalb des Diagramms platziert. Verschiebe sie je nachdem, wie stark sie mit den drei Hauptkonzepten und miteinander in Beziehung stehen.",
    truth: 'WAHRHEIT', beauty: 'SCHÖNHEIT', goodness: 'GÜTE',
    placeholder: 'Ein Wort oder eine Phrase hinzufügen...',
    add: 'Hinzufügen', undo: 'Rückgängig', reset: 'Zurücksetzen',
    hint: 'Frei ziehen · × tippen zum Entfernen',
  },
  it: {
    instruction: "Pensa alle tre parole: Verità, Bellezza e Bontà. Quali parole, frasi o concetti associ a ciascuna di esse? Digita le tue parole o frasi. Ognuna sarà posizionata fuori dal diagramma. Spostale in base a quanto si relazionano (o meno) con i tre concetti principali e tra loro.",
    truth: 'VERITÀ', beauty: 'BELLEZZA', goodness: 'BONTÀ',
    placeholder: 'Aggiungi una parola o una frase...',
    add: 'Aggiungi', undo: 'Annulla', reset: 'Reimposta',
    hint: 'Trascina liberamente · tocca × per rimuovere',
  },
  ru: {
    instruction: "Подумайте о трёх словах: Истина, Красота и Благость. Какие слова, фразы или понятия вы связываете с каждым из них? Введите свои слова или фразы. Каждое будет размещено за пределами диаграммы. Перемещайте их в зависимости от того, насколько они связаны (или нет) с тремя основными понятиями и друг с другом.",
    truth: 'ИСТИНА', beauty: 'КРАСОТА', goodness: 'БЛАГОСТЬ',
    placeholder: 'Добавьте слово или фразу...',
    add: 'Добавить', undo: 'Отменить', reset: 'Сбросить',
    hint: 'Перетаскивайте свободно · нажмите × для удаления',
  },
  pl: {
    instruction: "Pomyśl o trzech słowach: Prawda, Piękno i Dobroć. Jakie słowa, frazy lub pojęcia kojarzysz z każdym z nich? Wpisz swoje słowa lub frazy. Każde zostanie umieszczone poza diagramem. Przenoś je w zależności od tego, jak bardzo odnoszą się (lub nie) do trzech głównych pojęć i do siebie nawzajem.",
    truth: 'PRAWDA', beauty: 'PIĘKNO', goodness: 'DOBROĆ',
    placeholder: 'Dodaj słowo lub frazę...',
    add: 'Dodaj', undo: 'Cofnij', reset: 'Resetuj',
    hint: 'Przeciągaj swobodnie · dotknij × aby usunąć',
  },
  ro: {
    instruction: "Gândește-te la cele trei cuvinte: Adevăr, Frumusețe și Bunătate. Ce cuvinte, fraze sau concepte asociezi cu fiecare dintre ele? Scrie cuvintele sau frazele tale. Fiecare va fi plasată în afara diagramei. Mută-le în funcție de cât de mult se raportează (sau nu) la cele trei concepte principale și între ele.",
    truth: 'ADEVĂR', beauty: 'FRUMUSEȚE', goodness: 'BUNĂTATE',
    placeholder: 'Adaugă un cuvânt sau o frază...',
    add: 'Adaugă', undo: 'Anulează', reset: 'Resetează',
    hint: 'Trage liber · atinge × pentru a elimina',
  },
  cs: {
    instruction: "Zamyslete se nad třemi slovy: Pravda, Krása a Laskavost. Jaká slova, fráze nebo pojmy spojujete s každým z nich? Napište svá slova nebo fráze. Každé bude umístěno mimo diagram. Přesouvejte je podle toho, jak moc se vztahují (nebo nevztahují) ke třem hlavním pojmům a k sobě navzájem.",
    truth: 'PRAVDA', beauty: 'KRÁSA', goodness: 'LASKAVOST',
    placeholder: 'Přidejte slovo nebo frázi...',
    add: 'Přidat', undo: 'Zpět', reset: 'Resetovat',
    hint: 'Volně přetahujte · klepněte × pro odebrání',
  },
  fi: {
    instruction: "Mieti kolmea sanaa: Totuus, Kauneus ja Hyvyys. Mitä sanoja, lauseita tai käsitteitä yhdistät kuhunkin niistä? Kirjoita sanasi tai lauseesi. Jokainen sijoitetaan kaavion ulkopuolelle. Siirrä niitä sen mukaan, miten paljon ne liittyvät (tai eivät liity) kolmeen pääkäsitteeseen ja toisiinsa.",
    truth: 'TOTUUS', beauty: 'KAUNEUS', goodness: 'HYVYYS',
    placeholder: 'Lisää sana tai lause...',
    add: 'Lisää', undo: 'Kumoa', reset: 'Nollaa',
    hint: 'Vedä vapaasti · napauta × poistaaksesi',
  },
  el: {
    instruction: "Σκεφτείτε τις τρεις λέξεις: Αλήθεια, Ομορφιά και Καλοσύνη. Ποιες λέξεις, φράσεις ή έννοιες συνδέετε με καθεμία από αυτές; Πληκτρολογήστε τις λέξεις ή φράσεις σας. Κάθε μία θα τοποθετηθεί έξω από το διάγραμμα. Μετακινήστε τις ανάλογα με το πόσο σχετίζονται (ή όχι) με τις τρεις κύριες έννοιες και μεταξύ τους.",
    truth: 'ΑΛΉΘΕΙΑ', beauty: 'ΟΜΟΡΦΙΆ', goodness: 'ΚΑΛΟΣΎΝΗ',
    placeholder: 'Προσθέστε μια λέξη ή φράση...',
    add: 'Προσθήκη', undo: 'Αναίρεση', reset: 'Επαναφορά',
    hint: 'Σύρετε ελεύθερα · πατήστε × για κατάργηση',
  },
  lt: {
    instruction: "Pagalvokite apie tris žodžius: Tiesa, Grožis ir Gėris. Kokius žodžius, frazes ar sąvokas siejate su kiekvienu iš jų? Įveskite savo žodžius ar frazes. Kiekvienas bus patalpintas už diagramos ribų. Judinkite juos pagal tai, kiek jie susiję (ar nesusiję) su trimis pagrindinėmis sąvokomis ir tarpusavyje.",
    truth: 'TIESA', beauty: 'GROŽIS', goodness: 'GĖRIS',
    placeholder: 'Pridėkite žodį ar frazę...',
    add: 'Pridėti', undo: 'Atšaukti', reset: 'Atstatyti',
    hint: 'Vilkite laisvai · bakstelėkite × norėdami pašalinti',
  },
  tr: {
    instruction: "Üç kelimeyi düşünün: Gerçek, Güzellik ve İyilik. Bu kelimelerden her biriyle hangi sözcükleri, ifadeleri veya kavramları ilişkilendiriyorsunuz? Kelimelerinizi veya ifadelerinizi yazın. Her biri diyagramın dışına yerleştirilecek. Üç ana kavramla ve birbirleriyle ne kadar ilişkili olduklarına göre taşıyın.",
    truth: 'GERÇEK', beauty: 'GÜZELLİK', goodness: 'İYİLİK',
    placeholder: 'Bir kelime veya ifade ekleyin...',
    add: 'Ekle', undo: 'Geri Al', reset: 'Sıfırla',
    hint: 'Özgürce sürükleyin · × ile kaldırın',
  },
  et: {
    instruction: "Mõelge kolmele sõnale: Tõde, Ilu ja Headus. Milliseid sõnu, fraase või mõisteid seostate igaühega neist? Sisestage oma sõnad või fraasid. Iga sõna paigutatakse diagrammist välja. Liigutage neid vastavalt sellele, kui palju need seostuvad (või ei seostu) kolme põhimõistega ja üksteisega.",
    truth: 'TÕDE', beauty: 'ILU', goodness: 'HEADUS',
    placeholder: 'Lisa sõna või fraas...',
    add: 'Lisa', undo: 'Võta tagasi', reset: 'Lähtesta',
    hint: 'Lohista vabalt · puuduta × eemaldamiseks',
  },
  da: {
    instruction: "Tænk på de tre ord: Sandhed, Skønhed og Godhed. Hvilke ord, sætninger eller begreber forbinder du med hver af dem? Skriv dine ord eller sætninger. Hvert ord placeres uden for diagrammet. Flyt dem rundt baseret på, hvor meget de relaterer (eller ikke relaterer) til de tre hovedbegreber og til hinanden.",
    truth: 'SANDHED', beauty: 'SKØNHED', goodness: 'GODHED',
    placeholder: 'Tilføj et ord eller en sætning...',
    add: 'Tilføj', undo: 'Fortryd', reset: 'Nulstil',
    hint: 'Træk frit · tryk × for at fjerne',
  },
  hu: {
    instruction: "Gondolj a három szóra: Igazság, Szépség és Jóság. Milyen szavakat, kifejezéseket vagy fogalmakat társítasz mindegyikhez? Írd be szavaidat vagy kifejezéseidet. Mindegyik a diagram kívülére kerül. Mozgasd őket aszerint, hogy mennyire kapcsolódnak (vagy nem kapcsolódnak) a három fő fogalomhoz és egymáshoz.",
    truth: 'IGAZSÁG', beauty: 'SZÉPSÉG', goodness: 'JÓSÁG',
    placeholder: 'Adj hozzá egy szót vagy kifejezést...',
    add: 'Hozzáad', undo: 'Visszavon', reset: 'Visszaállít',
    hint: 'Húzd szabadon · érintsd × az eltávolításhoz',
  },
  bg: {
    instruction: "Помислете за трите думи: Истина, Красота и Добродетел. Какви думи, фрази или понятия свързвате с всяка от тях? Въведете вашите думи или фрази. Всяка ще бъде поставена извън диаграмата. Местете ги според това, доколко се свързват (или не) с трите основни понятия и помежду си.",
    truth: 'ИСТИНА', beauty: 'КРАСОТА', goodness: 'ДОБРОДЕТЕЛ',
    placeholder: 'Добавете дума или фраза...',
    add: 'Добави', undo: 'Отмени', reset: 'Нулирай',
    hint: 'Плъзгайте свободно · докоснете × за премахване',
  },
  he: {
    instruction: "חשבו על שלוש המילים: אמת, יופי וטוּב. אילו מילים, ביטויים או מושגים אתם מקשרים לכל אחת מהן? הקלידו את המילים או הביטויים שלכם. כל אחד יוצב מחוץ לדיאגרמה. הזיזו אותם בהתאם למידה שבה הם קשורים (או לא קשורים) לשלושת המושגים הראשיים ולאחד מהשני.",
    truth: 'אמת', beauty: 'יופי', goodness: 'טוּב',
    placeholder: 'הוסף מילה או ביטוי...',
    add: 'הוסף', undo: 'בטל', reset: 'אפס',
    hint: 'גרור בחופשיות · הקש × להסרה',
  },
  ar: {
    instruction: "فكّر في الكلمات الثلاث: الحق، والجمال، والخير. ما الكلمات أو العبارات أو المفاهيم التي تربطها بكل منها؟ اكتب كلماتك أو عباراتك. سيُوضع كل منها خارج المخطط. حرّكها بحسب مدى ارتباطها (أو عدم ارتباطها) بالمفاهيم الثلاثة الرئيسية وببعضها البعض.",
    truth: 'الحق', beauty: 'الجمال', goodness: 'الخير',
    placeholder: 'أضف كلمة أو عبارة...',
    add: 'أضف', undo: 'تراجع', reset: 'إعادة',
    hint: 'اسحب بحرية · اضغط × للإزالة',
  },
  fa: {
    instruction: "به سه کلمه فکر کنید: حقیقت، زیبایی و خوبی. چه کلمات، عبارات یا مفاهیمی را با هر یک از آن‌ها مرتبط می‌دانید؟ کلمات یا عبارات خود را بنویسید. هر کدام خارج از نمودار قرار می‌گیرند. آن‌ها را بر اساس میزان ارتباطشان (یا عدم ارتباط) با سه مفهوم اصلی و با یکدیگر جابجا کنید.",
    truth: 'حقیقت', beauty: 'زیبایی', goodness: 'خوبی',
    placeholder: 'یک کلمه یا عبارت اضافه کنید...',
    add: 'افزودن', undo: 'واگرد', reset: 'بازنشانی',
    hint: 'آزادانه بکشید · × را لمس کنید تا حذف شود',
  },
  ko: {
    instruction: "진리, 아름다움, 선, 이 세 단어를 생각해 보세요. 각각의 단어에서 어떤 단어, 구절, 또는 개념이 떠오르나요? 떠오르는 단어나 구절을 입력해 보세요. 입력한 내용은 다이어그램 밖에 배치됩니다. 세 가지 핵심 개념과의 연관성(또는 비연관성)을 바탕으로 자유롭게 위치를 조정해 보세요.",
    truth: '진리', beauty: '아름다움', goodness: '선',
    placeholder: '단어나 구절을 입력하세요...',
    add: '추가', undo: '실행 취소', reset: '초기화',
    hint: '자유롭게 드래그 · ×를 눌러 삭제',
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
  const isRtl = RTL_LANGS.has(lang)

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
            dir={isRtl ? 'rtl' : 'ltr'}
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
        dir={isRtl ? 'rtl' : 'ltr'}
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

      <p dir={isRtl ? 'rtl' : 'ltr'} style={{
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
