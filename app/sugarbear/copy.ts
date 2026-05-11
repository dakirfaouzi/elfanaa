/**
 * All Arabic copy lives here so the brand voice is editable in one file.
 * The voice: emotional, feminine, luxurious, warm. Never clinical.
 */

/**
 * Brand hierarchy for this page:
 *   • House brand (dominant chrome): فناء — the maison this page belongs to.
 *   • Product:                       Sugarbear Hair Vitamins — the item being sold.
 *
 * The house brand fronts the header and footer; the product wordmark stays
 * on the bottle and in the product identifier line. This keeps the page
 * connected to the wider فناء site instead of feeling like an isolated
 * landing page.
 */
export const brand = {
  house: "فناء",
  houseTagline: "بيتٌ هادئ للجمال الأنثوي",
  houseLatin: "MAISON FANAA",
  productName: "Sugarbear",
  productLineAr: "فيتامينات الشعر اليومية",
  productLineFull: "Sugarbear · فيتامينات الشعر اليومية",
  byHouse: "من تشكيلة فناء",
};

export const navCopy = {
  home: "الرئيسية",
  homeAria: "العودة إلى الرئيسية",
  collection: "تشكيلة العناية",
};

export const heroCopy = {
  eyebrow: "العناية اللي يبان أثرها",
  headline: "شعر أكثر كثافة…\nولمعان يبان من أول نظرة.",
  subheadline:
    "تركيبة يومية تدعم كثافة الشعر، تقلّل مظهر الضعف والتقصف، وتمنحكِ نعومة ولمعاناً يبان مع كل صباح.",
  imageCaption: "جمال يومي لشعركِ",
  rating: { stars: 4.9, count: 12647 },
  trust: ["نباتية ١٠٠٪", "خالٍ من الجلوتين", "بنكهة التوت الطبيعية", "صُنعت بحب"],
  delivery: "توصيل خلال ٢٤ ساعة لدول الخليج",
  cod: "ادفعي عند الاستلام · بدون أي مخاطرة",
  urgency: "الشحن المجاني متاح لفترة محدودة",
  ctaPrimary: "ابدئي طقس العناية بشعركِ",
  ctaSecondary: "اختاري روتينكِ اليومي",
  unitsLabel: { 1: "علبة واحدة", 2: "علبتان", 3: "ثلاث علب" } as Record<number, string>,
};

/**
 * Sticky CTA — the floating bar that appears once the hero is scrolled past.
 * Same emotional register as the hero CTA, but slightly more inviting.
 * Used for both mobile and desktop variants.
 */
export const stickyCtaCopy = {
  eyebrowDesktop: "طقسكِ في انتظاركِ",
  ctaDesktop: "ابدئي طقس جمالكِ",
  ctaMobile: "ابدئي طقس جمالك",
  savingPrefix: "وفّري",
};

export const transformationCopy = {
  eyebrow: "طقسٌ يومي",
  headline: "كل صباح يبدأ\nبلحظة اهتمام بنفسك.",
  body:
    "روتين يومي هادئ يمنح شعركِ نعومة ولمعاناً وكثافة تشعرين بها مع كل نظرة في المرآة.",
  // Minimalist emotional tag-line beneath the body. Rendered as a single
  // inline row separated by gold middots — no chips, no boxes, no clutter.
  tags: ["نعومة", "لمعان", "كثافة"] as const,
  // Pillar data is preserved so other surfaces (footer manifesto, future
  // ritual modules) can re-use it. The Transformation section itself no
  // longer renders this row — its new direction is editorial, not didactic.
  pillars: [
    { num: "01", title: "ثقة", body: "شعرٌ تشعرين بحضوره، لا تخفينه." },
    { num: "02", title: "طقس", body: "دقيقة لكِ. كل يوم. بدون عناء." },
    { num: "03", title: "صحّة", body: "غذاء حقيقي للشعر من الداخل." },
  ],
};

export const beforeAfterCopy = {
  eyebrow: "نتائج تُلاحظ مع الاستمرار",
  headline: "فرق تشعرين به…\nولمعان يُلاحظ.",
  body:
    "مع العناية اليومية والانتظام، يستعيد الشعر نعومته ولمعانه ومظهره الصحي بشكل طبيعي ومتدرج.",
  // Editorial reassurance line — sits beneath the diptych in soft
  // low-contrast typography, luxury skincare style. Honest, not clinical.
  disclaimer:
    "النتائج تختلف من شخص لآخر بحسب طبيعة الشعر والالتزام اليومي.",
  // Before/after labels are *baked into the image* (Arabic typography
  // by the campaign art-director), so we keep the strings here only as
  // a11y reference for the image alt text. No overlay, no chips, no
  // floating badges.
  beforeLabel: "قبل الانتظام",
  afterLabel: "بعد الانتظام",
};

export const benefitsCopy = {
  eyebrow: "لماذا تختاره الكثير من النساء",
  headline: "أربع لمسات يومية…\nلفرق تشعرين به.",
  // Soft editorial intro paragraph — sits beneath the headline before
  // the card grid. Sets the calm premium tone ahead of the four cards.
  intro:
    "تركيبة يومية تمنح شعركِ العناية والنعومة والمظهر الصحي بطريقة بسيطة وأنيقة.",
  // Each card carries a luxury-line icon name (resolved in Benefits.tsx
  // to avoid coupling the copy file to React components).
  cards: [
    {
      icon: "strand" as const,
      title: "كثافة ولمعان",
      body: "مظهر أكثر امتلاءً ولمعاناً مع العناية اليومية المنتظمة.",
    },
    {
      icon: "bloom" as const,
      title: "دعم من الداخل",
      body: "تركيبة يومية تمنح شعركِ العناية التي يحتاجها باستمرار.",
    },
    {
      icon: "sunrise" as const,
      title: "روتين سهل يومياً",
      body: "خطوة بسيطة تضيفينها إلى روتينكِ اليومي بكل راحة.",
    },
    {
      icon: "sparkle" as const,
      title: "أنوثة واهتمام",
      body: "لحظات صغيرة من العناية تنعكس على شعركِ ومظهركِ.",
    },
  ],
};

export const ingredientsCopy = {
  eyebrow: "تركيبة يومية مدروسة",
  headline: "ثلاثة عناصر…\nوشعركِ يلاحظ الفرق.",
  body:
    "البيوتين، فيتامين C، وحمض الفوليك يعملون معاً لدعم مظهر شعر أكثر كثافة ولمعاناً — بتركيبة يومية بسيطة وأنيقة.",
  // Quiet finishing line beneath the three ingredient rows. Editorial
  // closure — never a marketing tagline.
  outro: "تركيبة هادئة… لنتيجة تشعرين بها مع الوقت.",
  items: [
    {
      name: "Biotin",
      arabic: "البيوتين",
      body: "يدعم مظهر الشعر الصحي والكثافة اليومية.",
    },
    {
      name: "Vitamin C",
      arabic: "فيتامين C",
      body: "يساعد على العناية اليومية ولمعان أكثر حيوية.",
    },
    {
      name: "Folic Acid",
      arabic: "حمض الفوليك",
      body: "جزء من روتين متوازن للعناية اليومية.",
    },
  ],
};

export const ritualCopy = {
  eyebrow: "طقسكِ اليومي",
  headline: "دقيقةٌ صغيرة…\nلشعور يدوم طوال اليوم.",
  body:
    "لحظة هادئة بينكِ وبين نفسكِ — تمنح شعركِ نعومة ولمعاناً وكثافة تشعرين بها مع كل نظرة في المرآة.",
  // Three quiet ritual moments — `time` reads as a soft gold label,
  // `value` is the editorial line beneath it. No body copy, no
  // numbered steps, no clinical language.
  steps: [
    { time: "مساءً", value: "قطعتان يومياً" },
    { time: "صباحاً", value: "شعر أكثر نعومة" },
    { time: "مع الوقت", value: "لمعان ومظهر أكثر حيوية" },
  ],
  // Final italic micro-line beneath the steps — quiet brand whisper.
  microline: "الجمال يبدأ من اللحظات الصغيرة.",
};

/* ──────────────────────────────────────────────────────────────────────
 *  SECTION 7 — Testimonials (editorial luxury, NOT ecommerce reviews)
 *
 *  Shape decisions:
 *    • No `verified` flag, no city+age clutter, no per-card star count.
 *    • One `featured` testimonial (large editorial quote card).
 *    • Three short `cards` (minimal feminine quotes, name only).
 *    • One global `rating` block — refined typography + small gold
 *      stars, never an ecommerce summary widget.
 * ──────────────────────────────────────────────────────────────────── */
export const reviewsCopy = {
  eyebrow: "تجارب يومية حقيقية",
  headline: "نساء كثيرات لاحظن الفرق…\nبطريقة هادئة وطبيعية.",
  body:
    "روتين بسيط أصبح جزءاً من يومهن — نعومة، لمعان، وإحساس يومي بالعناية.",
  rating: {
    value: "4.9",
    title: "متوسط التقييم",
    subtitle: "من آلاف المراجعات",
  },
  featured: {
    quote:
      "بعد أسابيع قليلة، بدأت ألاحظ فرقاً حقيقياً\nفي نعومة شعري ولمعانه.",
    name: "سارة",
    city: "الرياض",
  },
  cards: [
    { quote: "أصبح شعري يبدو أكثر ترتيباً\nوحيوية مع الوقت.", name: "نورة" },
    { quote: "أحببت فكرة الروتين اليومي البسيط.", name: "ريم" },
    { quote: "النعومة واللمعان كانا أول شيء لاحظته.", name: "دانة" },
  ],
};

/* ──────────────────────────────────────────────────────────────────────
 *  SECTION 8 — Trust / Reassurance
 *
 *  Quiet luxury reassurance block (NOT an ecommerce trust strip):
 *    • centered editorial intro
 *    • 4 minimal cream cards
 *    • icon names map 1:1 to the line icons in components/Icons.tsx
 *      ("cash" / "truck" / "leaf" / "shield"), never coloured
 *      pictograms or emoji
 *    • soft italic micro-line beneath the cards
 * ──────────────────────────────────────────────────────────────────── */
export const trustCopy = {
  eyebrow: "ثقة يومية",
  headline: "كل ما تحتاجينه…\nببساطة واطمئنان.",
  body:
    "تركيبة يومية سهلة، مع تجربة شراء مريحة\nوشحن سريع ودفع عند الاستلام.",
  cards: [
    {
      icon: "cash" as const,
      title: "دفع عند الاستلام",
      body: "تجربة شراء سهلة وآمنة داخل الخليج.",
    },
    {
      icon: "truck" as const,
      title: "شحن سريع",
      body: "توصيل سريع ومتابعة مباشرة للطلب.",
    },
    {
      icon: "leaf" as const,
      title: "تركيبة نباتية",
      body: "خالٍ من الجلوتين وبنكهة محبوبة يومياً.",
    },
    {
      icon: "shield" as const,
      title: "ضمان راحة",
      body: "دعم سريع وتجربة مريحة من الطلب حتى الاستلام.",
    },
  ],
  microline: "تفاصيل صغيرة تمنح التجربة شعوراً أكثر راحة.",
};

/* ──────────────────────────────────────────────────────────────────────
 *  SECTION — Premium Offers (luxury editorial pricing, NOT ecommerce)
 *
 *  Three calm bundle cards driven by editorial still-life images
 *  (`/sugarbear/bundle-1.png`, `/bundle-2.png`, `/bundle-3.png`).
 *  Card 3 is gently emphasized as the featured tier — never loud.
 *
 *  Per-card features are encoded as ordered arrays so the cards
 *  scale with bundle size without conditional JSX gymnastics.
 *  CTA text differs only on the featured card ("الخيار المُفضل").
 * ──────────────────────────────────────────────────────────────────── */
export const offersCopy = {
  eyebrow: "اختاري مدتكِ",
  headline: "كم شهرًا\nتمنحين نفسكِ؟",
  body:
    "النتائج تبدأ من ٣٠ يومًا، لكن التحول الحقيقي يحتاج وقتًا.\nاختاري المدة التي تناسبكِ.",
  bundles: [
    {
      id: "1" as const,
      headline: "شهر واحد",
      sub: "للبداية",
      pieces: 1,
      image: "/sugarbear/bundle-1.png",
      price: 199,
      perBottleNote: "١٩٩ ريال للعلبة",
      saving: 0,
      tag: null,
      highlight: false,
      cta: "اختاري هذه",
      features: ["توصيل خلال ٤٨ ساعة", "الدفع عند الاستلام"],
    },
    {
      id: "2" as const,
      headline: "شهران",
      sub: "للالتزام",
      pieces: 2,
      image: "/sugarbear/bundle-2.png",
      price: 279,
      perBottleNote: "١٤٠ ريال للعلبة",
      saving: 119,
      tag: "وفّري ١١٩ ريال",
      highlight: false,
      cta: "اختاري هذه",
      features: [
        "توصيل خلال ٤٨ ساعة",
        "الدفع عند الاستلام",
        "شحن مجاني",
      ],
    },
    {
      id: "3" as const,
      headline: "ثلاثة أشهر",
      sub: "للتحول الحقيقي",
      pieces: 3,
      image: "/sugarbear/bundle-3.png",
      price: 349,
      perBottleNote: "١١٦ ريال للعلبة",
      saving: 248,
      tag: "وفّري ٢٤٨ ريال",
      highlight: true,
      cta: "الخيار المُفضل",
      features: [
        "توصيل خلال ٤٨ ساعة",
        "الدفع عند الاستلام",
        "شحن مجاني",
        "أولوية في الشحن",
      ],
    },
  ],
  trustRow: [
    "توصيل سريع داخل الخليج",
    "الدفع عند الاستلام",
    "إرجاع خلال ١٤ يوم",
  ],
};

/* ──────────────────────────────────────────────────────────────────────
 *  SECTION 9 — FAQ (luxury feminine reassurance, NOT support-page)
 *
 *  Six calm Q/A pairs covering the GCC COD buyer's quiet hesitations:
 *  dosage · daily fit · COD · shipping · vegan · halal-friendly.
 *  Closing micro-line keeps the brand voice present after the list.
 * ──────────────────────────────────────────────────────────────────── */
export const faqCopy = {
  eyebrow: "أسئلة شائعة",
  headline: "كل ما قد ترغبين بمعرفته…\nببساطة ووضوح.",
  body:
    "تفاصيل صغيرة تساعدك على تجربة شراء أكثر راحة واطمئناناً.",
  items: [
    {
      q: "كم حبة يتم تناولها يومياً؟",
      a: "يُنصح بتناول حبتين يومياً كجزء من الروتين اليومي.",
    },
    {
      q: "هل المنتج مناسب للاستخدام اليومي؟",
      a: "تم تصميم التركيبة لتكون سهلة ومريحة ضمن الروتين اليومي.",
    },
    {
      q: "هل يتوفر الدفع عند الاستلام؟",
      a: "نعم، يتوفر الدفع عند الاستلام داخل معظم دول الخليج.",
    },
    {
      q: "كم يستغرق الشحن؟",
      a: "يختلف وقت التوصيل حسب مدن المملكة، وغالباً يصل الطلب خلال أيام قليلة مع متابعة مباشرة للشحنة.",
    },
    {
      q: "هل التركيبة نباتية؟",
      a: "نعم، التركيبة نباتية وخالية من الجلوتين.",
    },
    {
      q: "هل المنتج مناسب ضمن نظام غذائي حلال؟",
      a: "التركيبة نباتية وخالية من الجيلاتين، وتم اختيار المكونات لتناسب نمط الحياة اليومي بكل راحة واطمئنان.",
    },
  ],
  microline: "وإذا احتجتِ أي مساعدة، فريقنا دائماً هنا لدعمكِ.",
};

/* ──────────────────────────────────────────────────────────────────────
 *  SECTION 10 — Final CTA / Closing Section
 *
 *  The final emotional invitation before purchase. The voice is calm
 *  and premium — never urgency-driven, never countdown-style.
 *
 *  Reassurance is intentionally split into TWO calm signals:
 *    • `reassuranceLine` — one editorial sentence ("دفع عند
 *      الاستلام • شحن سريع داخل المملكة")
 *    • `trustChips`      — three quiet 1-word reassurance pills
 *      under the CTA, each with a soft gold check
 * ──────────────────────────────────────────────────────────────────── */
export const finalCtaCopy = {
  eyebrow: "لحظة أخيرة",
  headline:
    "العناية الصغيرة التي تبدأ اليوم…\nقد تصبح أجمل عادة يومية.",
  body:
    "روتين بسيط يمنح شعركِ نعومة ولمعاناً\nويضيف لحظات هادئة من العناية كل يوم.",
  microCopy: "العناية اليومية تبدأ بخطوة بسيطة.",
  ctaIdle: "ابدئي طقس جمالكِ اليوم",
  ctaCart: "امنحي شعركِ عنايته اليومية",
  reassuranceLine: "دفع عند الاستلام • شحن سريع داخل المملكة",
  trustChips: ["توصيل ٢٤ ساعة", "دفع عند الاستلام", "إرجاع خلال ١٤ يوم"],
  microline: "لأن العناية بنفسكِ تستحق لحظة هادئة كل يوم.",
};

export const footerCopy = {
  manifesto:
    "فناء بيتٌ هادئ للجمال الأنثوي. نختار، بعنايةٍ، ما يستحقّ أن يكون جزءاً من طقسكِ اليومي.",
  links: [
    { label: "الرئيسية", href: "/" },
    { label: "تشكيلة العناية", href: "/" },
    { label: "تواصلي معنا", href: "/" },
    { label: "الشحن والإرجاع", href: "/" },
  ],
  legal: "© فناء · جميع الحقوق محفوظة",
  productCredit: "Sugarbear · فيتامينات الشعر · حصرياً عبر فناء",
};

export const microcopy = {
  currency: "ريال",
  perBottle: "للعلبة",
  save: "وفّري",
  bestValue: "أفضل قيمة",
  selected: "الخيار المُختار",
  selectThis: "اختاري هذه",
  free: "مجاناً",
  freeShipping: "شحن مجاني",
  inStock: "نتيجة من العلبة الأولى",
  verified: "عميلة موثّقة",
  reviewLabel: "تقييم",
};
