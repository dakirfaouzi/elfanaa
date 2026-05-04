import type { Product } from "@/lib/types";
import { siteConfig } from "./site";

const C = siteConfig.currency;

/**
 * ELFANAA — initial catalog.
 *
 * Three signature products, each engineered for Saudi COD funnels:
 *   • Single SAR price-point (199 base) so the offer reads instantly.
 *   • Volume bundle 1 = 199 · 2 = 279 · 3 = 349 — the 3-unit tier is the
 *     conversion sweet-spot.
 *   • Each product naturally lives in a *"buy 3 to complete the look"*
 *     story so the bundle nudge feels like advice, not a sales tactic.
 *
 * Every product carries the **full CRO surface**:
 *   headline · subheadline · benefits · reviews · faq · scarcity hint.
 *
 * The Python backend mirrors `id` and `price` shape in
 * `backend/app/services/catalog.py`; CRO copy lives only here because
 * the backend re-prices but does NOT render copy.
 */

const TIER_OFFER = {
  tiers: [
    { quantity: 1, total: { amount: 19900, currency: C } },
    { quantity: 2, total: { amount: 27900, currency: C } },
    { quantity: 3, total: { amount: 34900, currency: C } },
  ],
  unit: { amount: 19900, currency: C },
} as const;

const SIGNATURE_BADGE = {
  ar: "عرض ٣ بسعر مميز",
  en: "3-pack offer",
} as const;

export const products: Product[] = [
  {
    id: "p_001",
    slug: "majlis-floor-cushion",
    title: { ar: "وسادة مجلس أرضية", en: "Majlis Floor Cushion" },
    headline: {
      ar: "خلّ مجلسك ركن يحبّه الكل،\nويتذكّره من زاره.",
      en: "Build the majlis your guests\ntalk about long after the night.",
    },
    subheadline: {
      ar: "وسادة كبيرة بحشوة قطنية وغطاء كتان قابل للغسل — تكفي وحدة لزاوية، وثلاث لمجلس كامل.",
      en: "A generous cotton-filled cushion with a washable linen cover — one warms a corner, three build a full majlis.",
    },
    description: {
      ar: "حُشيت يدوياً بطبقتين من القطن المضغوط لتبقى مرتفعة طول السنة، وغُلّفت بكتّان فاخر يمر على الغسالة بدون ما يفقد ملمسه. زرّ نحاسي صغير على الحافة هو توقيعنا.",
      en: "Hand-stuffed with two layers of pressed cotton so it holds its shape year-round, wrapped in a premium linen cover that survives the washing machine without losing its hand. A small brass button on the corner is our signature.",
    },
    images: [
      {
        src: "https://images.unsplash.com/photo-1540932239986-30128078f3c5?w=1400&q=85",
        alt: { ar: "وسادة مجلس أرضية", en: "Majlis floor cushion" },
      },
      {
        src: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=1400&q=85",
        alt: { ar: "تفاصيل القماش الكتاني", en: "Linen detail" },
      },
      {
        src: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1400&q=85",
        alt: { ar: "تركيب الوسائد في المجلس", en: "Cushions arranged in a majlis" },
      },
    ],
    lifestyleImage: {
      src: "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=1600&q=85",
      alt: { ar: "مجلس مكتمل", en: "A full majlis evening" },
    },
    price: TIER_OFFER.unit,
    offerTiers: [...TIER_OFFER.tiers],
    badges: [SIGNATURE_BADGE, { ar: "الأكثر مبيعاً", en: "Best seller" }],
    rating: { value: 4.9, count: 268 },
    collection: "majlis",
    upsellIds: ["p_002", "p_003"],
    stockLeft: 14,
    recentBuyers: 27,
    benefits: [
      {
        icon: "Sparkles",
        title: {
          ar: "ملمس فاخر، حتى بعد الغسيل",
          en: "Luxurious feel, even after washing",
        },
        body: {
          ar: "غطاء كتاني فاخر يمر على الغسالة بدون ما يخسر طراوته أو لونه.",
          en: "Premium linen cover survives the washing machine — keeps its hand and its colour.",
        },
      },
      {
        icon: "Wind",
        title: {
          ar: "حشوة تبقى مرتفعة طول السنة",
          en: "Filling that holds its shape, all year",
        },
        body: {
          ar: "طبقتان من القطن المضغوط — ما تكبس مع الوقت ولا تحتاج تنفّخها كل أسبوع.",
          en: "Two layers of pressed cotton — no slumping, no weekly fluffing.",
        },
      },
      {
        icon: "Sun",
        title: {
          ar: "ألوان دافئة تكمل أي مجلس",
          en: "Warm tones that finish any majlis",
        },
        body: {
          ar: "صُبغت ألوانها بعناية لتركّب على بعض ولا تتعارض مع ديكورك الحالي.",
          en: "Hand-dyed in palettes that layer effortlessly — they won't fight your existing decor.",
        },
      },
      {
        icon: "Hand",
        title: {
          ar: "تفاصيل تحسّها بإيدك",
          en: "Details you can feel",
        },
        body: {
          ar: "زرّ نحاسي على الحافة، خياطة يدوية على الزوايا، وطباعة هادئة لاسم العلامة.",
          en: "A brass button on the corner, hand-stitched corners, and a quiet brand stamp.",
        },
      },
    ],
    reviews: [
      {
        name: { ar: "سارة المحمدي", en: "Sara Al-Muhammadi" },
        city: { ar: "الرياض", en: "Riyadh" },
        rating: 5,
        body: {
          ar: "اشتريت ثلاث وسادات لمجلس البيت. الفرق في الراحة والمنظر بان من اليوم الأول. حرفياً أهلي صاروا يجلسون على الأرض أكثر من الكنبة.",
          en: "Bought three for our majlis. The difference was visible from day one — my family now prefers the floor over the sofa.",
        },
        date: "2026-04-12",
        verified: true,
      },
      {
        name: { ar: "عبدالله الشهري", en: "Abdullah Al-Shahri" },
        city: { ar: "جدة", en: "Jeddah" },
        rating: 5,
        body: {
          ar: "الكتان فعلاً درجة فاخرة. غسلتها بعد ثلاث أسابيع ورجعت أحلى من اول. ينصح فيها.",
          en: "The linen is genuinely premium. Washed it after three weeks and it came back better than new. Highly recommend.",
        },
        date: "2026-03-29",
        verified: true,
      },
      {
        name: { ar: "ريم العتيبي", en: "Reem Al-Otaibi" },
        city: { ar: "الدمام", en: "Dammam" },
        rating: 5,
        body: {
          ar: "وصلت سريع وجبت اثنين بسعر ٢٧٩. القماش أنيق والشكل يكمل غرفة الجلسة العائلية. بأطلب وحدة كمان.",
          en: "Arrived quickly and grabbed two for 279 SAR. The fabric is elegant and finished our family room. I'm ordering one more.",
        },
        date: "2026-03-15",
        verified: true,
      },
      {
        name: { ar: "محمد القحطاني", en: "Mohammed Al-Qahtani" },
        city: { ar: "الخبر", en: "Khobar" },
        rating: 4,
        body: {
          ar: "الخامة ممتازة والحشوة متينة. أتمنى لو فيه ألوان أكثر للاختيار. عموماً تجربة ممتازة.",
          en: "The material is excellent and the filling is dense. I wish there were more colour choices. Solid experience overall.",
        },
        date: "2026-02-28",
        verified: true,
      },
    ],
    faq: [
      {
        q: { ar: "هل الغطاء قابل للغسل؟", en: "Is the cover machine-washable?" },
        a: {
          ar: "نعم. الغطاء بسحاب مخفي تشلّه وتغسله في الغسالة على ٣٠ درجة. الحشوة الداخلية تبقى نظيفة وجافة.",
          en: "Yes. The cover unzips and goes in the machine at 30°C. The inner filling stays clean and dry.",
        },
      },
      {
        q: { ar: "كم مقاس الوسادة؟", en: "What size is the cushion?" },
        a: {
          ar: "٧٠ × ٧٠ سم — مقاس مجلس عربي تقليدي. مرتفعة بحدود ١٥ سم بعد ما تتنفّخ.",
          en: "70 × 70 cm — traditional majlis size. About 15 cm tall once fluffed.",
        },
      },
      {
        q: { ar: "خلال كم يوم بتوصلني؟", en: "How long is delivery?" },
        a: {
          ar: "٤٨ ساعة في الرياض وجدة، و٣ إلى ٥ أيام لباقي مدن المملكة. توصيل مجاني للطلبات فوق ٤٩٩ ريال.",
          en: "Within 48 hours in Riyadh and Jeddah, 3–5 days nationwide. Free shipping over 499 SAR.",
        },
      },
      {
        q: { ar: "وش لو ما عجبتني؟", en: "What if I don't love it?" },
        a: {
          ar: "إرجاع مجاني خلال ١٤ يوم بدون أسئلة. نمر نستلمها من بيتك ونرجّع المبلغ كامل.",
          en: "Free 14-day returns, no questions. We pick it up from your door and refund in full.",
        },
      },
    ],
  },
  {
    id: "p_002",
    slug: "courtyard-lantern",
    title: { ar: "فانوس الفناء", en: "Courtyard Lantern" },
    headline: {
      ar: "ضوء يبطّئ الوقت،\nويخلّي الأمسية تطول.",
      en: "A light that slows time —\nso the evening stays a little longer.",
    },
    subheadline: {
      ar: "فانوس بإطار حديد أسود مطفي وزجاج معتّق، يوزّع ضوء دافئ يكسر العتمة بدون ما يضايق العين.",
      en: "A matte black iron frame with aged glass — casts a warm light that softens the dark without ever glaring.",
    },
    description: {
      ar: "صُنع الإطار من حديد مطفي يصمد للشمس والمطر، والزجاج معتّق يدوياً ليعطي ضوء ذهبي دافئ. يستخدم شموع T-light عادية أو لمبة E14 صغيرة. يصلح للداخل والخارج.",
      en: "The frame is matte iron built for sun and rain, the glass is hand-aged for a warm golden glow. Takes standard T-lights or a small E14 bulb. Equally at home indoors and out.",
    },
    images: [
      {
        src: "https://images.unsplash.com/photo-1611348586804-61bf6c080437?w=1400&q=85",
        alt: { ar: "فانوس الفناء", en: "Courtyard lantern" },
      },
      {
        src: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=1400&q=85",
        alt: { ar: "ضوء الفانوس على الجدار", en: "Lantern glow on a wall" },
      },
      {
        src: "https://images.unsplash.com/photo-1532372576444-dda954194ad0?w=1400&q=85",
        alt: { ar: "تفاصيل الزجاج المعتّق", en: "Aged glass detail" },
      },
    ],
    lifestyleImage: {
      src: "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=1600&q=85",
      alt: { ar: "أمسية في الفناء", en: "An evening in the courtyard" },
    },
    price: TIER_OFFER.unit,
    offerTiers: [...TIER_OFFER.tiers],
    badges: [SIGNATURE_BADGE, { ar: "للحديقة", en: "Garden" }],
    rating: { value: 4.8, count: 156 },
    collection: "lighting",
    upsellIds: ["p_001", "p_003"],
    stockLeft: 9,
    recentBuyers: 19,
    benefits: [
      {
        icon: "Sun",
        title: {
          ar: "ضوء دافئ، ما يضايق العين",
          en: "Warm light that never glares",
        },
        body: {
          ar: "زجاج معتّق يدوياً يلطّف الضوء ويعطيك جوّ أمسية حقيقية، مو إنارة مكتب.",
          en: "Hand-aged glass softens the light into something that feels like an evening — not an office.",
        },
      },
      {
        icon: "ShieldCheck",
        title: {
          ar: "يصمد للشمس والمطر",
          en: "Built for sun and rain",
        },
        body: {
          ar: "إطار حديد بطلاء مطفي مقاوم للصدأ. اتركه في الفناء طول السنة بدون قلق.",
          en: "Matte iron frame with rust-resistant finish. Leave it outside year-round without worry.",
        },
      },
      {
        icon: "Flame",
        title: {
          ar: "شموع أو لمبة — أنت تختار",
          en: "Candle or bulb — your call",
        },
        body: {
          ar: "يقبل شموع T-light عادية أو لمبة E14 صغيرة. غيّر الإحساس على راحتك.",
          en: "Takes standard T-lights or a small E14 bulb. Switch the mood on demand.",
        },
      },
      {
        icon: "Sparkles",
        title: {
          ar: "ثلاث فوانيس = إيقاع مختلف",
          en: "Three lanterns, a different rhythm",
        },
        body: {
          ar: "فانوس وحد يلفت النظر. اثنين ينظّمون الجلسة. ثلاثة يصنعون أمسية كاملة.",
          en: "One catches the eye. Two frame the seating. Three make a whole evening.",
        },
      },
    ],
    reviews: [
      {
        name: { ar: "نورة العسيري", en: "Noura Al-Aseeri" },
        city: { ar: "أبها", en: "Abha" },
        rating: 5,
        body: {
          ar: "اشتريت ثلاث فوانيس للفناء وصاروا قطعة الديكور الأهم. الأطفال يحبّون الضوء والجو يصير سحري بعد المغرب.",
          en: "Bought three for the courtyard and they became the main decor piece. The kids love the light and the mood after sunset is magical.",
        },
        date: "2026-04-22",
        verified: true,
      },
      {
        name: { ar: "خالد الزهراني", en: "Khalid Al-Zahrani" },
        city: { ar: "الطائف", en: "Taif" },
        rating: 5,
        body: {
          ar: "الجودة أحسن من المتوقع بكثير. الزجاج المعتّق يعطي إحساس قطعة قديمة بقيمة. مرتاح من الشراء.",
          en: "Quality way above expectations. The aged glass gives it a heritage feel that's worth the price.",
        },
        date: "2026-04-05",
        verified: true,
      },
      {
        name: { ar: "هند الحربي", en: "Hind Al-Harbi" },
        city: { ar: "الرياض", en: "Riyadh" },
        rating: 5,
        body: {
          ar: "وصل بسرعة وغلّف بطريقة فخمة. حطيتهم في البلكونة وصاروا نقطة جلستنا المفضلة.",
          en: "Arrived fast and packaged beautifully. We put them on the balcony and it's now our favourite spot.",
        },
        date: "2026-03-18",
        verified: true,
      },
      {
        name: { ar: "ياسر بن عبدالله", en: "Yasser bin Abdullah" },
        city: { ar: "بريدة", en: "Buraidah" },
        rating: 4,
        body: {
          ar: "ممتاز. أتمنى يكون فيه مقاس أكبر شوي. الضوء جداً مريح.",
          en: "Excellent. Wish there was a slightly larger size. The light is genuinely soothing.",
        },
        date: "2026-02-09",
        verified: true,
      },
    ],
    faq: [
      {
        q: { ar: "هل يصلح للخارج طول السنة؟", en: "Is it weatherproof year-round?" },
        a: {
          ar: "نعم. الحديد مطلي بطبقة مقاومة للصدأ، والزجاج مقاوم للحرارة. اتركه في الفناء بدون قلق.",
          en: "Yes. The iron carries a rust-resistant coating and the glass is heat-tempered. Safe to leave out year-round.",
        },
      },
      {
        q: { ar: "أبعاد الفانوس؟", en: "What are the dimensions?" },
        a: {
          ar: "ارتفاع ٣٢ سم، قاعدة ١٥ × ١٥ سم. يدخل بسهولة في أركان البلكونة أو الطاولة.",
          en: "32 cm tall, 15 × 15 cm base. Fits easily on a balcony corner or a side table.",
        },
      },
      {
        q: { ar: "يجي معاه شموع؟", en: "Does it come with candles?" },
        a: {
          ar: "نوفّر معاه شمعتين T-light هدية. اللمبة الكهربائية اختيارية وتباع منفصلة.",
          en: "We include two T-light candles as a starter. The electric bulb is optional and sold separately.",
        },
      },
      {
        q: { ar: "كم مدة التوصيل؟", en: "How fast is delivery?" },
        a: {
          ar: "٤٨ ساعة في الرياض وجدة، و٣ إلى ٥ أيام لباقي مدن المملكة.",
          en: "Within 48 hours in Riyadh and Jeddah, 3–5 days for the rest of Saudi Arabia.",
        },
      },
    ],
  },
  {
    id: "p_003",
    slug: "ceramic-vase",
    title: { ar: "مزهرية سيراميك", en: "Ceramic Vase" },
    headline: {
      ar: "قطعة هادئة، تصنع زاوية\nيلتفت لها كل من يدخل.",
      en: "A quiet piece that makes\nthe corner everyone notices.",
    },
    subheadline: {
      ar: "مزهرية مصنوعة يدوياً بلمسة مطفية، مقاومة للماء — اجمع ثلاث بأحجام متدرجة لتكوين فاخر.",
      en: "A hand-thrown vase with a soft matte finish, water-tight inside — group three at graduated heights for a striking arrangement.",
    },
    description: {
      ar: "صُبّت من الطين الأبيض وطُليت يدوياً بلمسة مطفية ناعمة. فتحة واسعة تستقبل أزهار طبيعية أو مجففة، وقاعدة ثقيلة ما تتقلّب. كل قطعة فيها تفاوت بسيط — لأنها مصنوعة يد.",
      en: "Cast from white clay and hand-glazed with a soft matte finish. A wide neck for fresh or dried stems, a weighted base that won't tip. Each piece carries small variations — that's the hand at work.",
    },
    images: [
      {
        src: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=1400&q=85",
        alt: { ar: "مزهرية سيراميك مطفية", en: "Matte ceramic vase" },
      },
      {
        src: "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=1400&q=85",
        alt: { ar: "تفاصيل اللمسة المطفية", en: "Matte finish detail" },
      },
      {
        src: "https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=1400&q=85",
        alt: { ar: "تركيب مزهريات بأحجام متدرجة", en: "Vases grouped at graduated heights" },
      },
    ],
    lifestyleImage: {
      src: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=1600&q=85",
      alt: { ar: "ركن هادئ", en: "A quiet corner" },
    },
    price: TIER_OFFER.unit,
    offerTiers: [...TIER_OFFER.tiers],
    badges: [SIGNATURE_BADGE, { ar: "جديد", en: "New" }],
    rating: { value: 4.9, count: 213 },
    collection: "decor",
    upsellIds: ["p_001", "p_002"],
    stockLeft: 11,
    recentBuyers: 22,
    benefits: [
      {
        icon: "Hand",
        title: {
          ar: "مصنوعة يداً، ما تتكرّر",
          en: "Hand-thrown, never identical",
        },
        body: {
          ar: "كل مزهرية فيها لمسة بسيطة مختلفة — لأنها صُنعت يد، مو خط إنتاج.",
          en: "Each vase carries a small variation — because it's a hand, not a machine.",
        },
      },
      {
        icon: "Droplet",
        title: {
          ar: "مغلّفة من الداخل، تستحمل الماء",
          en: "Sealed inside, holds water",
        },
        body: {
          ar: "السطح مطفي والداخل مغلّف بطبقة عازلة — للأزهار الطبيعية والمجففة.",
          en: "Matte exterior, sealed interior — for both fresh and dried arrangements.",
        },
      },
      {
        icon: "Sparkles",
        title: {
          ar: "ثلاث = تكوين فاخر",
          en: "Three = a curated grouping",
        },
        body: {
          ar: "كل مزهرية بحجم وارتفاع مختلف. اجمعهم سوا للتركيب الكلاسيكي.",
          en: "Each at a different height. Grouped, they make the classic curated arrangement.",
        },
      },
      {
        icon: "Anchor",
        title: {
          ar: "قاعدة ثقيلة، ما تتقلّب",
          en: "Weighted base, won't tip",
        },
        body: {
          ar: "ثقل القاعدة محسوب — تستحمل أغصان طويلة بدون ما تضربك في وسط الجلسة.",
          en: "The base is weighted on purpose — it holds tall stems without tipping mid-evening.",
        },
      },
    ],
    reviews: [
      {
        name: { ar: "لمى الدوسري", en: "Lama Al-Dossari" },
        city: { ar: "الرياض", en: "Riyadh" },
        rating: 5,
        body: {
          ar: "اشتريت ثلاث وحطيتهم على الكونسول. كل ضيف يجي البيت يسأل عنهم. اللمسة المطفية فعلاً مختلفة.",
          en: "Bought three for the console. Every guest asks about them. The matte finish is genuinely different.",
        },
        date: "2026-04-18",
        verified: true,
      },
      {
        name: { ar: "أحمد الشمري", en: "Ahmed Al-Shammari" },
        city: { ar: "حائل", en: "Hail" },
        rating: 5,
        body: {
          ar: "حطيت فيها أزهار مجففة ولونها يكمّل لون البيت. وصلت مغلّفة بعناية وما فيها أي كسر.",
          en: "Filled it with dried stems and the colour matches the house perfectly. Arrived padded and undamaged.",
        },
        date: "2026-04-02",
        verified: true,
      },
      {
        name: { ar: "بدور القحطاني", en: "Budour Al-Qahtani" },
        city: { ar: "جدة", en: "Jeddah" },
        rating: 5,
        body: {
          ar: "السعر ممتاز للجودة. القطعة فيها تفاصيل يدوية واضحة — حسيت إنها قطعة مميزة فعلاً.",
          en: "Excellent value for the quality. You can see the handmade details — feels genuinely special.",
        },
        date: "2026-03-21",
        verified: true,
      },
      {
        name: { ar: "فهد العنزي", en: "Fahad Al-Anzi" },
        city: { ar: "تبوك", en: "Tabuk" },
        rating: 4,
        body: {
          ar: "تجربة جيدة، والشكل أنيق. أتمنى لو فيه مقاس أكبر للمدخل.",
          en: "Good experience, elegant shape. Wish there was a larger size for entryways.",
        },
        date: "2026-03-04",
        verified: true,
      },
    ],
    faq: [
      {
        q: { ar: "هل تستحمل الأزهار الطبيعية بالماء؟", en: "Can it hold fresh flowers with water?" },
        a: {
          ar: "نعم. الداخل مغلّف بطبقة عازلة مقاومة للماء، تستخدم للأزهار الطبيعية والمجففة.",
          en: "Yes. The inside is sealed with a water-tight glaze, suitable for fresh and dried.",
        },
      },
      {
        q: { ar: "كم الأبعاد؟", en: "What's the size?" },
        a: {
          ar: "ارتفاع ٢٨ سم، قطر فتحة ١٢ سم — مقاس مثالي لتركيب فوق طاولة الكونسول أو الجلسة.",
          en: "28 cm tall, 12 cm neck — ideal for a console table or coffee table arrangement.",
        },
      },
      {
        q: { ar: "كيف أنظّفها؟", en: "How do I clean it?" },
        a: {
          ar: "ماء فاتر وصابون لطيف من الداخل. اللمسة المطفية الخارجية تتنظّف بقطعة قماش جافة.",
          en: "Warm water and gentle soap inside. The matte exterior wipes clean with a dry cloth.",
        },
      },
      {
        q: { ar: "هل القطع متطابقة؟", en: "Are the pieces identical?" },
        a: {
          ar: "كل مزهرية فيها تفاوت بسيط لأنها مصنوعة يداً — هذا ما يجعل القطعة قطعة، مو سلعة جاهزة.",
          en: "Each carries small variations because it's hand-thrown — that's what makes a piece a piece, not a product.",
        },
      },
    ],
  },
];

/* ------------------------------- Selectors ------------------------------- */

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductsByIds(ids: string[]): Product[] {
  return ids.map(getProductById).filter((p): p is Product => Boolean(p));
}

export function getRelatedProducts(productId: string, limit = 4): Product[] {
  const current = getProductById(productId);
  if (!current) return [];
  return products.filter((p) => p.id !== productId).slice(0, limit);
}

/**
 * Curated bestseller list — kept distinct from a raw rating sort so
 * merchandising stays in our hands.
 */
export const bestSellerIds = ["p_001", "p_002", "p_003"] as const;
export function getBestSellers(): Product[] {
  return getProductsByIds([...bestSellerIds]);
}
