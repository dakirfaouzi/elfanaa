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
  headline: "شعر يبدو أكثر صحة،\nولمعان يُرى من أول فرق.",
  body:
    "مع العناية اليومية والانتظام، يبدأ الشعر باستعادة نعومته ولمعانه ومظهره الصحي بشكل تدريجي وطبيعي.",
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
  eyebrow: "ما تشعرين به",
  headline: "أربعة وعود.\nتلمسينها يومياً.",
  cards: [
    {
      title: "تقوية من الجذور",
      body: "Biotin بتركيز يومي يدعم بنية الشعرة من الداخل، فتقاوم الكسر وتنمو أقوى.",
    },
    {
      title: "لمعان ونعومة طبيعية",
      body: "Vitamin C يساعد على إنتاج الكولاجين الذي يمنح الشعر بريقه الحريري.",
    },
    {
      title: "دعم يومي للشعر الصحي",
      body: "تركيبة متوازنة تعمل بهدوء كل يوم — لا قمم، لا انخفاضات. فقط استمرار.",
    },
    {
      title: "روتين سهل ولذيذ",
      body: "حلوى توت طبيعية واحدة في اليوم. بدون كبسولات. بدون مرارة. بدون عناء.",
    },
  ],
};

export const ingredientsCopy = {
  eyebrow: "التركيبة",
  headline: "ثلاثة عناصر.\nواختيارٌ واحد لكِ.",
  body:
    "اخترنا فقط ما تحتاجه شعرتكِ فعلاً. لا حشو. لا مبالغة. كل عنصر له دور واضح في القصة.",
  items: [
    {
      name: "Biotin",
      arabic: "البيوتين",
      amount: "5000 mcg",
      lede: "البطل الهادئ.",
      body:
        "البيوتين عنصر أساسي لبنية الكيراتين — البروتين الذي يصنع شعرتكِ. نعطيكِ الجرعة التي تستخدمها أكثر اختصاصيّات التجميل، يومياً، بدون ضجيج.",
    },
    {
      name: "Vitamin C",
      arabic: "فيتامين سي",
      amount: "60 mg",
      lede: "البريق الذي تلاحظينه.",
      body:
        "يدعم إنتاج الكولاجين، ويُحسّن امتصاص الحديد الذي يحتاجه الشعر. لمعانٌ يأتي من الداخل، لا من زجاجة بخّاخ.",
    },
    {
      name: "Folic Acid",
      arabic: "حمض الفوليك",
      amount: "1000 mcg",
      lede: "النمو من العمق.",
      body:
        "يُسهم في تجديد خلايا فروة الرأس وصحة بصيلة الشعر. ركيزة هادئة، لكنها تصنع الفرق على المدى البعيد.",
    },
  ],
};

export const ritualCopy = {
  eyebrow: "الطقس اليومي",
  headline: "دقيقة\nلكِ.",
  body:
    "ضعي الزجاجة بجانب فنجان قهوتكِ. اختاري قطعتين كل صباح. هذه هي اللحظة التي تقولين فيها لنفسكِ: «أهتمّ بنفسي.»",
  steps: [
    {
      time: "٧:٠٠ صباحاً",
      title: "الإيقاظ",
      body: "القهوة الأولى. ضوءٌ هادئ. لحظة لكِ وحدكِ.",
    },
    {
      time: "٧:٠٥",
      title: "الطقس",
      body: "قطعتان من Sugarbear. نكهة توت طبيعية.",
    },
    {
      time: "اليوم كله",
      title: "الإشراق",
      body: "تشعرين أن شعركِ يأخذ ما يحتاجه. ببساطة.",
    },
  ],
};

export const reviewsCopy = {
  eyebrow: "أصواتٌ حقيقية",
  headline: "ما تقوله نساؤنا.",
  summary: { score: "٤٫٩ / ٥", count: "بناءً على ١٢٫٦٠٠ تقييم" },
  reviews: [
    {
      name: "نورة العتيبي",
      city: "الرياض",
      age: "٢٩ سنة",
      stars: 5,
      title: "صار جزء من صباحي.",
      body:
        "بعد شهرين، صديقاتي بدأن يسألنني وش غيّرت في شعري. ما غيّرت شي، فقط أصبحت ملتزمة. الطعم لذيذ والنتيجة هادئة لكنها واضحة.",
      verified: true,
    },
    {
      name: "لمى الدوسري",
      city: "جدة",
      age: "٣٤ سنة",
      stars: 5,
      title: "اللمعان أول شي لاحظته.",
      body:
        "كنت أبحث عن منتج يعطي لمعان طبيعي بدون زيوت ثقيلة. هذا اللي حصلت عليه. بعد ٤٥ يوم، شعري يعكس الضوء بشكل مختلف.",
      verified: true,
    },
    {
      name: "ريم الزهراني",
      city: "الدمام",
      age: "٢٧ سنة",
      stars: 5,
      title: "الأطراف توقفت تتقصّف.",
      body:
        "كانت أطرافي خفيفة وهشّة. بعد ٣ أشهر بدأت ألاحظ سُمكاً جديداً عند الجذور. الفرق ليس درامياً، لكنه حقيقي.",
      verified: true,
    },
    {
      name: "سارة الحربي",
      city: "أبوظبي",
      age: "٣١ سنة",
      stars: 5,
      title: "أحبه لأنه ما يحس وكأنه دواء.",
      body:
        "جرّبت كبسولات قبله، كنت أنساها. هذا أحبه — حلوى يومية تذكّرني أهتمّ بنفسي. ابنتي تقول: «ماما، شعرك صار أنعم.»",
      verified: true,
    },
  ],
};

export const offersCopy = {
  eyebrow: "اختاري طقسكِ",
  headline: "كم شهراً\nتمنحين نفسكِ؟",
  body:
    "النتائج تبدأ من ٣٠ يوماً، لكن التحوّل الحقيقي يحتاج ٩٠ يوماً. اختاري المدة التي تليق بكِ.",
  bundles: [
    {
      id: "1" as const,
      headline: "شهر واحد",
      sub: "للتجربة",
      pieces: 1,
      price: 199,
      perBottleNote: "١٩٩ ريال للعلبة",
      saving: 0,
      tag: null,
      highlight: false,
    },
    {
      id: "2" as const,
      headline: "شهران",
      sub: "للالتزام",
      pieces: 2,
      price: 279,
      perBottleNote: "١٤٠ ريال للعلبة",
      saving: 119,
      tag: "وفّري ١١٩ ريال",
      highlight: false,
    },
    {
      id: "3" as const,
      headline: "ثلاثة أشهر",
      sub: "للتحوّل الحقيقي",
      pieces: 3,
      price: 349,
      perBottleNote: "١١٦ ريال للعلبة",
      saving: 248,
      tag: "أفضل قيمة",
      highlight: true,
    },
  ],
};

export const faqCopy = {
  eyebrow: "أسئلة قبل الطلب",
  headline: "كل ما تودّين معرفته.",
  items: [
    {
      q: "كيف أستخدم Sugarbear؟",
      a: "قطعتان يومياً، يفضّل في الصباح بعد الفطور. لا تحتاجين ماءً. النكهة طبيعية ولذيذة. اجعليها بجانب فنجان قهوتكِ كي لا تنسي.",
    },
    {
      q: "متى أبدأ ألاحظ النتائج؟",
      a: "أغلب نسائنا يلاحظن لمعاناً ونعومة خلال ٣٠ يوماً. الكثافة تحتاج وقتاً أطول — عادةً ٦٠ إلى ٩٠ يوماً من الانتظام. الانتظام أهم من الجرعة.",
    },
    {
      q: "هل المنتج آمن للاستخدام اليومي؟",
      a: "نعم. التركيبة مدروسة لتُؤخذ يومياً، خالية من الجلوتين، نباتية ١٠٠٪، وخالية من المواد الحافظة الصناعية. إذا كنتِ حاملاً أو مرضعة، استشيري طبيبتكِ.",
    },
    {
      q: "ما هي مدة التوصيل؟",
      a: "نوصِل خلال ٢٤ ساعة في الرياض وجدة، ومن ٢ إلى ٣ أيام لباقي مدن الخليج. الطلب يصلكِ في تغليف هادئ يحفظ خصوصيتكِ.",
    },
    {
      q: "هل أستطيع الدفع عند الاستلام؟",
      a: "نعم. الدفع عند الاستلام متاح في كل دول الخليج، بدون أي مبلغ مقدّم. تدفعين فقط عندما تستلمين الطلب وتتأكدين من حالته.",
    },
    {
      q: "ماذا لو لم تعجبني التجربة؟",
      a: "لكِ ١٤ يوماً للاسترجاع، بدون أسئلة. نريدكِ أن تشعري بالأمان مع كل خطوة. تواصلي معنا واتساب وفريقنا يهتمّ بالباقي.",
    },
  ],
};

export const finalCtaCopy = {
  eyebrow: "ابدئي اليوم",
  headline: "شعركِ يستحقّ\nطقساً يومياً.",
  body:
    "أنتِ لستِ بحاجة لروتين معقّد. تحتاجين قطعتين كل صباح. وستينٍ من الانتظام. بقيّة الحكاية ستلاحظينها وحدكِ.",
  ctaIdle: "ابدئي طقس جمالكِ",
  ctaCart: "امنحي شعركِ عنايته اليومية",
  reassurance: ["توصيل ٢٤ ساعة", "دفع عند الاستلام", "إرجاع خلال ١٤ يوم"],
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
