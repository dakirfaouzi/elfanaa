import type { Product } from "@/lib/types";
import { siteConfig } from "./site";

const C = siteConfig.currency;

/**
 * ELFANAA — Health & Beauty catalog.
 *
 * Three signature products, each built for Saudi COD funnels:
 *   • Single SAR price-point (199 base) so the offer reads instantly.
 *   • Volume bundle 1 = 199 · 2 = 279 · 3 = 349 — the 3-unit tier is the
 *     conversion sweet-spot.
 *   • Each product naturally lives in a *"complete your routine"* story
 *     so the bundle nudge feels like advice, not a sales tactic.
 *
 * Every product carries the **full CRO surface**:
 *   headline · subheadline · benefits · reviews · faq · scarcity hint.
 *
 * The Python backend mirrors `id` and `price` shape in
 * `backend/app/services/catalog.py`; CRO copy lives only here because
 * the backend re-prices but does NOT render copy.
 *
 * Collections: face · hair · routine
 */

const TIER_OFFER = {
  tiers: [
    { quantity: 1, total: { amount: 19900, currency: C } },
    { quantity: 2, total: { amount: 27900, currency: C } },
    { quantity: 3, total: { amount: 34900, currency: C } },
  ],
  unit: { amount: 19900, currency: C },
} as const;

export const products: Product[] = [
  /* ──────────────────────────────────────────────────────────
   * P_001  سيروم الإشراق — Glow Serum  [Face]
   * Problem: dark spots, dull skin from KSA sun + pollution
   * Solution: concentrated daily serum, visible results in 2 weeks
   * ────────────────────────────────────────────────────────── */
  {
    id: "p_001",
    slug: "glow-serum",
    sku: "FN-SERUM-001",
    title: { ar: "سيروم الإشراق", en: "Glow Serum" },
    headline: {
      ar: "ذهب التبقّع،\nجاء الإشراق.",
      en: "Spots fade.\nGlow arrives.",
    },
    subheadline: {
      ar: "سيروم يومي بفيتامين C ١٢٪ ونياسيناميد ٥٪ — يفتّت البقع الداكنة والكلف، ويرجّع التوحّد لبشرتك. مختبر على بشرة سعودية في حر الجزيرة.",
      en: "A daily serum with 12% Vitamin C + 5% Niacinamide — breaks down dark spots and melasma, restores even tone. Lab-tested on Saudi skin in Arabian heat.",
    },
    description: {
      ar: "البقعة اللي تشوفينها في المرايا ما تجي من الجينات — تجي من الشمس. فيتامين C بنسبة علاجية + نياسيناميد + حمض الترانيكساميك يفتّتون البقعة من جذرها، ما يخفونها بس. قطرتين صباحاً قبل واقي الشمس، ونتائج تبدأ تبان من الأسبوع الثاني.",
      en: "The spot you see in the mirror isn't genetic — it's from the sun. Therapeutic-grade Vitamin C + Niacinamide + Tranexamic Acid break the spot down at its root, not just hide it. Two drops in the morning before SPF, results visible from week two.",
    },
    images: [
      {
        src: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=1400&q=85",
        alt: { ar: "سيروم الإشراق — فناء", en: "Fanaa Glow Serum" },
      },
      {
        src: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=1400&q=85",
        alt: { ar: "تفاصيل السيروم", en: "Serum texture detail" },
      },
      {
        src: "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=1400&q=85",
        alt: { ar: "روتين العناية بالبشرة", en: "Skincare routine" },
      },
    ],
    lifestyleImage: {
      src: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=1600&q=85",
      alt: { ar: "بشرة مشرقة وصحية", en: "Glowing healthy skin" },
    },
    price: TIER_OFFER.unit,
    offerTiers: [...TIER_OFFER.tiers],
    badges: [
      { ar: "الأكثر طلباً في السعودية", en: "Most ordered in KSA" },
      { ar: "نتائج خلال ١٤ يوم", en: "Results in 14 days" },
      { ar: "+٣١٢ تقييم سعودي", en: "312+ Saudi reviews" },
    ],
    rating: { value: 4.9, count: 312 },
    collection: "face",
    productType: "serum",
    target: "women",
    problems: ["dark-spots", "dryness", "uneven-tone"],
    upsellIds: ["p_002", "p_003"],
    stockLeft: 14,
    recentBuyers: 31,
    ingredients: [
      { name: { ar: "فيتامين C (١٢٪)", en: "Vitamin C (12%)" }, role: { ar: "تفتيح البقع الداكنة وتوحيد اللون", en: "Brightens dark spots and evens tone" } },
      { name: { ar: "نياسيناميد (٥٪)", en: "Niacinamide (5%)" }, role: { ar: "تقوية حاجز البشرة وتقليل المسام", en: "Strengthens skin barrier and minimizes pores" } },
      { name: { ar: "حمض الترانيكساميك (٢٪)", en: "Tranexamic Acid (2%)" }, role: { ar: "منع تكوّن تصبغات جديدة", en: "Prevents formation of new pigmentation" } },
    ],
    benefits: [
      {
        icon: "Sparkles",
        title: {
          ar: "يفتّت البقعة من جذرها",
          en: "Breaks the spot from its root",
        },
        body: {
          ar: "فيتامين C ١٢٪ بنسبة علاجية + نياسيناميد ٥٪ + ترانيكساميك ٢٪. ما يخفي البقعة — يحطّمها. ٣١٢ سعودي وسعودية شافوا الفرق.",
          en: "Therapeutic-grade 12% Vitamin C + 5% Niacinamide + 2% Tranexamic Acid. Doesn't hide the spot — dismantles it. 312 Saudi reviews say so.",
        },
      },
      {
        icon: "Sun",
        title: {
          ar: "مختبر على بشرة سعودية",
          en: "Tested on Saudi skin",
        },
        body: {
          ar: "أغلب السيرومات الغربية مختبرة في مناخ بارد ورطب. تركيبتنا مختبرة في الرياض وجدة، على بشرة تعيش ٤٥ درجة وغبار يومي.",
          en: "Most Western serums are tested in cold, humid climates. Ours is tested in Riyadh and Jeddah, on skin living at 45°C with daily dust.",
        },
      },
      {
        icon: "ShieldCheck",
        title: {
          ar: "آمن — حتى للحوامل والمرضعات",
          en: "Safe — even for pregnancy & nursing",
        },
        body: {
          ar: "بدون هايدروكينون، بدون بارابين، بدون كحول مجفّف. مناسب للبشرة الحساسة، وآمن للحوامل والمرضعات.",
          en: "No hydroquinone, no parabens, no drying alcohol. Safe for sensitive skin, and safe during pregnancy and nursing.",
        },
      },
      {
        icon: "Clock",
        title: {
          ar: "٣٠ ثانية صباحاً — وخلاص",
          en: "30 seconds in the morning — done",
        },
        body: {
          ar: "قطرتين على وجه ناشف بعد التنظيف، دلّكه، حط واقي شمسك فوقه. ما يحتاج روتين ١٠ خطوات.",
          en: "Two drops on dry skin after cleansing, press in, layer SPF on top. No 10-step routine needed.",
        },
      },
    ],
    reviews: [
      {
        name: { ar: "سارة المحمدي", en: "Sara Al-Muhammadi" },
        city: { ar: "الرياض", en: "Riyadh" },
        rating: 5,
        body: {
          ar: "جرّبت منتجات كثيرة للتبقّع ولا شيء اشتغل. بعد أسبوعين من السيروم حسّيت فرق واضح — بشرتي أنعم وأشرق. والدفع عند الاستلام أراحني.",
          en: "Tried so many products for dark spots and nothing worked. After two weeks with this serum I noticed a clear difference — smoother and brighter. COD made me feel safe ordering.",
        },
        date: "2026-04-15",
        verified: true,
      },
      {
        name: { ar: "نورة العتيبي", en: "Noura Al-Otaibi" },
        city: { ar: "الدمام", en: "Dammam" },
        rating: 5,
        body: {
          ar: "وصل سريع وأنيق التغليف. البشرة دايماً تتأثر من الجو الجاف عندنا بالدمام — هذا السيروم هو الأفضل اللي جرّبته.",
          en: "Arrived fast and beautifully packaged. My skin always suffers in Dammam's dry weather — this is the best serum I've tried.",
        },
        date: "2026-03-20",
        verified: true,
      },
      {
        name: { ar: "لمياء الشهري", en: "Lamya Al-Shahri" },
        city: { ar: "جدة", en: "Jeddah" },
        rating: 5,
        body: {
          ar: "ما كنت أتوقع النتيجة بهالسرعة. الكلف خف بنسبة ٧٠٪ في شهر. طلبت العرض الثلاثي.",
          en: "Didn't expect results this fast. Melasma faded by 70% in a month. Ordered the trio bundle.",
        },
        date: "2026-04-02",
        verified: true,
      },
    ],
    faq: [
      {
        q: { ar: "وش الفرق بينه وبين سيروم فيتامين سي اللي في الصيدلية؟", en: "How is this different from a pharmacy Vitamin C serum?" },
        a: {
          ar: "النسبة. أغلب المنتجات الجاهزة بنسبة ٢٪–٥٪ — وهي رمزية. تركيبتنا ١٢٪، وهي النسبة العلاجية الفعلية اللي توصّل لطبقة البشرة وتفتّت البقعة. الفرق يبان من نسبة المكوّن، مش من الاسم على القارورة.",
          en: "Concentration. Most off-the-shelf serums sit at 2-5% — that's a token amount. Ours runs at 12%, the actual therapeutic level that penetrates the skin and breaks down the spot. The difference is in the ratio, not the label.",
        },
      },
      {
        q: { ar: "هل يحرق أو يقشّر البشرة؟", en: "Does it sting or peel the skin?" },
        a: {
          ar: "لا. تركيبة بـ pH متوازن (٣.٥-٤) — قوّة العلاج بدون التقشير القاسي. لو حسّيت بوخز خفيف أول ٣ أيام، هذا طبيعي ويختفي. مختبر على البشرة الحساسة.",
          en: "No. pH-balanced (3.5-4) — therapeutic strength without harsh peeling. A mild tingle in the first 3 days is normal and disappears. Tested on sensitive skin.",
        },
      },
      {
        q: { ar: "هل آمن للحوامل والمرضعات؟", en: "Is it safe during pregnancy or nursing?" },
        a: {
          ar: "نعم. بدون ريتينول، بدون هايدروكينون، بدون أحماض ساليسيليك بنسب عالية. كل المكوّنات معتمدة آمنة للحوامل والمرضعات.",
          en: "Yes. No retinol, no hydroquinone, no high-concentration salicylic acid. Every ingredient is certified safe during pregnancy and nursing.",
        },
      },
      {
        q: { ar: "خلال كم يوم بيوصلني؟", en: "How long is delivery?" },
        a: {
          ar: "٤٨ ساعة في الرياض وجدة، و٣ إلى ٤ أيام لباقي مناطق المملكة. الدفع عند الاستلام، ورابط تتبّع للسائق.",
          en: "48 hours in Riyadh and Jeddah, 3-4 days nationwide. Cash on delivery, with a live courier tracking link.",
        },
      },
      {
        q: { ar: "وش لو ما عجبني؟", en: "What if I don't love it?" },
        a: {
          ar: "إرجاع مجاني خلال ١٤ يوم بدون أسئلة. ما تدفع ريال إلا لما توصلك القارورة وتشوفها بعينك.",
          en: "Free 14-day returns, no questions. You don't pay a riyal until the bottle arrives and you see it.",
        },
      },
    ],
  },

  /* ──────────────────────────────────────────────────────────
   * P_002  كريم ترميم الحاجز — Barrier Repair Cream  [Face]
   * Problem: dry skin, compromised barrier from KSA heat, AC, hard water
   * Solution: deep ceramide hydration, locks in the serum
   * ────────────────────────────────────────────────────────── */
  {
    id: "p_002",
    slug: "barrier-cream",
    sku: "FN-CREAM-002",
    title: { ar: "كريم ترميم الحاجز", en: "Barrier Repair Cream" },
    headline: {
      ar: "الجفاف ليس نوع بشرة.\nإنه حاجز مكسور.",
      en: "Dryness isn't a skin type.\nIt's a broken barrier.",
    },
    subheadline: {
      ar: "كريم يومي غني بـ ٥ أنواع من السيراميد وحمض الهيالورونيك. يرمّم حاجز البشرة المتضرر من التكييف والشمس، ويقفل الترطيب لـ ٢٤ ساعة.",
      en: "A daily cream rich in 5 types of Ceramides and Hyaluronic Acid. Repairs the skin barrier damaged by AC and sun, locking in moisture for 24 hours.",
    },
    description: {
      ar: "أكثر شكوى في السعودية: بشرة تشرب المرطبات وتبقى جافة. السبب؟ التكييف المستمر والمياه الثقيلة يكسرون 'حاجز' البشرة، فتتبخر السوائل. هذا الكريم لا يرطب سطحياً فقط، بل يبني جداراً من السيراميد يمنع فقدان الماء. الخطوة الثانية الأساسية بعد السيروم.",
      en: "The biggest complaint in KSA: skin drinks moisturizers and stays dry. The cause? Constant AC and hard water break the skin's 'barrier', letting fluids evaporate. This cream doesn't just hydrate the surface; it builds a ceramide wall to prevent water loss. The essential second step after your serum.",
    },
    images: [
      {
        src: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=1400&q=85",
        alt: { ar: "كريم ترميم الحاجز", en: "Fanaa Barrier Cream" },
      },
      {
        src: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=1400&q=85",
        alt: { ar: "قوام الكريم", en: "Cream texture" },
      },
      {
        src: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1400&q=85",
        alt: { ar: "عناية يومية", en: "Daily care" },
      },
    ],
    lifestyleImage: {
      src: "https://images.unsplash.com/photo-1554057009-cb4c82c22119?w=1600&q=85",
      alt: { ar: "بشرة مرطبة وصحية", en: "Hydrated healthy skin" },
    },
    price: TIER_OFFER.unit,
    offerTiers: [...TIER_OFFER.tiers],
    badges: [
      { ar: "ترطيب ٢٤ ساعة", en: "24-hour hydration" },
      { ar: "بدون عطور", en: "Fragrance-free" },
      { ar: "مختبر طبياً", en: "Clinically tested" },
    ],
    rating: { value: 4.8, count: 187 },
    collection: "face",
    productType: "cream",
    target: "unisex",
    problems: ["dryness", "barrier-damage", "sensitive-skin"],
    upsellIds: ["p_001", "p_003"],
    stockLeft: 9,
    recentBuyers: 22,
    ingredients: [
      { name: { ar: "مركب السيراميد (٥ أنواع)", en: "Ceramide Complex (5 types)" }, role: { ar: "إعادة بناء جدار البشرة الواقي", en: "Rebuilds the skin's protective wall" } },
      { name: { ar: "حمض الهيالورونيك", en: "Hyaluronic Acid" }, role: { ar: "سحب الماء لداخل الخلايا", en: "Draws water into the cells" } },
      { name: { ar: "زبدة الشيا النقية", en: "Pure Shea Butter" }, role: { ar: "تنعيم السطح ومنع التبخر", en: "Softens surface and prevents evaporation" } },
    ],
    benefits: [
      {
        icon: "Shield",
        title: {
          ar: "يبني جدار حماية",
          en: "Builds a protective wall",
        },
        body: {
          ar: "السيراميد هو الإسمنت اللي يمسك خلايا بشرتك. تركيبتنا تعوّض السيراميد المفقود بسبب الجو، وتمنع جفاف البشرة.",
          en: "Ceramides are the cement holding your skin cells together. Our formula replaces ceramides lost to the weather, preventing skin dehydration.",
        },
      },
      {
        icon: "Droplets",
        title: {
          ar: "يقفل ترطيب السيروم",
          en: "Locks in serum hydration",
        },
        body: {
          ar: "السيروم يعالج، والكريم يحميه. استخدامه بعد سيروم الإشراق يضاعف النتيجة ويضمن عدم تبخر المواد الفعالة.",
          en: "The serum treats, the cream protects. Using it after the Glow Serum doubles the result and ensures active ingredients don't evaporate.",
        },
      },
      {
        icon: "Wind",
        title: {
          ar: "بدون عطور — للبشرة الحساسة",
          en: "Fragrance-free — for sensitive skin",
        },
        body: {
          ar: "العطور تهيّج الحاجز المكسور. كريمنا خالي تماماً من العطور والزيوت العطرية، ليريح البشرة المتهيجة فوراً.",
          en: "Fragrances irritate a broken barrier. Our cream is completely free of fragrances and essential oils, instantly soothing irritated skin.",
        },
      },
      {
        icon: "CheckCircle",
        title: {
          ar: "لا يسد المسام",
          en: "Non-comedogenic",
        },
        body: {
          ar: "رغم ترطيبه العميق، تركيبته مدروسة لتسمح للبشرة بالتنفس ولا تسبب ظهور الحبوب.",
          en: "Despite its deep hydration, the formula is designed to let skin breathe and won't cause breakouts.",
        },
      },
    ],
    reviews: [
      {
        name: { ar: "أمل الزهراني", en: "Amal Al-Zahrani" },
        city: { ar: "الرياض", en: "Riyadh" },
        rating: 5,
        body: {
          ar: "أخيراً لقيت كريم يخلي وجهي مرطب لليوم الثاني. تكييف الدوام كان يدمر بشرتي، هذا الكريم أنقذني.",
          en: "Finally found a cream that keeps my face hydrated until the next day. Office AC was destroying my skin, this cream saved me.",
        },
        date: "2026-04-20",
        verified: true,
      },
      {
        name: { ar: "عمر الشمري", en: "Omar Al-Shammari" },
        city: { ar: "جدة", en: "Jeddah" },
        rating: 5,
        body: {
          ar: "ممتاز جداً بعد الحلاقة أو التعرض للشمس. يمتص بسرعة ولا يترك لمعة مزعجة. أستخدمه أنا وزوجتي.",
          en: "Excellent after shaving or sun exposure. Absorbs quickly and doesn't leave an annoying shine. My wife and I both use it.",
        },
        date: "2026-04-06",
        verified: true,
      },
      {
        name: { ar: "منى الغامدي", en: "Mona Al-Ghamdi" },
        city: { ar: "أبها", en: "Abha" },
        rating: 5,
        body: {
          ar: "وصل بسرعة والتغليف محترم. خفف الاحمرار اللي كان يجيني من الجفاف. واضح إن المنتج مدروس.",
          en: "Arrived quickly, professional packaging. Reduced the redness I used to get from dryness. The product is clearly well thought out.",
        },
        date: "2026-03-22",
        verified: true,
      },
    ],
    faq: [
      {
        q: { ar: "متى أستخدمه في روتيني؟", en: "When do I use it in my routine?" },
        a: {
          ar: "مرتين يومياً. صباحاً بعد السيروم وقبل واقي الشمس، ومساءً كآخر خطوة لترميم البشرة أثناء النوم.",
          en: "Twice daily. Morning after serum and before SPF, and evening as the final step to repair skin while you sleep.",
        },
      },
      {
        q: { ar: "هل يسبّب حبوب أو احمرار؟", en: "Will it cause acne or redness?" },
        a: {
          ar: "لا. مصنّف Non-comedogenic — يعني ما يسد المسام. مختبر على البشرة المعرضة للحبوب والحساسة.",
          en: "No. Classified non-comedogenic — won't clog pores. Tested on acne-prone and sensitive skin.",
        },
      },
      {
        q: { ar: "هل يلمع على الوجه؟", en: "Will it shine on the face?" },
        a: {
          ar: "يعطي لمسة نضارة طبيعية (Dewy finish) بدون لمعان زيتي ثقيل. يمتص خلال دقائق.",
          en: "Gives a natural dewy finish without heavy oily shine. Absorbs within minutes.",
        },
      },
      {
        q: { ar: "كم مدة التوصيل؟", en: "How fast is delivery?" },
        a: {
          ar: "٤٨ ساعة في الرياض وجدة، و٣ إلى ٤ أيام لباقي مدن السعودية. الدفع عند الاستلام.",
          en: "48 hours in Riyadh and Jeddah, 3-4 days nationwide. Cash on delivery.",
        },
      },
      {
        q: { ar: "وش لو ما عجبني؟", en: "What if I don't love it?" },
        a: {
          ar: "إرجاع مجاني خلال ١٤ يوم بدون أسئلة. ما تدفع ريال إلا لما توصلك القارورة.",
          en: "Free 14-day returns, no questions. You don't pay a riyal until the bottle arrives.",
        },
      },
    ],
  },

  /* ──────────────────────────────────────────────────────────
   * P_003  قناع الترميم العميق — Deep Repair Mask  [Hair]
   * Problem: dry, damaged hair from heat styling + hard water + KSA climate
   * Solution: weekly deep mask, visible softness from first use
   * ────────────────────────────────────────────────────────── */
  {
    id: "p_003",
    slug: "hair-mask",
    sku: "FN-HAIRMASK-003",
    title: { ar: "قناع الترميم العميق", en: "Deep Repair Mask" },
    headline: {
      ar: "تكسّر، تقصّف، جفاف...\nترجع الحياة بـ ٥ دقائق.",
      en: "Breakage, dryness, damage...\nlife returns in 5 minutes.",
    },
    subheadline: {
      ar: "قناع أسبوعي بزبدة الشيا والأرغان والكيراتين — يصلّح الشعر التالف من الحرارة، الصبغات، والمياه الثقيلة. النعومة تبدأ من أول استخدام.",
      en: "A weekly shea butter + argan + keratin mask — repairs hair damaged by heat, dye, and hard water. Softness from the very first use.",
    },
    description: {
      ar: "الشعر في السعودية يتعرّض لثلاث ضغوط: حرارة التمشيط، المياه الثقيلة (المالحة)، وجفاف التكييف. الشامبو ينظّف بس ما يصلّح. القناع يدخل عميق في الخيط، يصلّح الكسور من داخل، ويرجّع البروتين اللي ضاع. ٥ دقائق مرّة في الأسبوع — والفرق يخلّيك ما ترضى بغيره.",
      en: "Hair in Saudi faces three pressures: styling heat, hard (salty) water, and AC dryness. Shampoo cleans but doesn't repair. The mask penetrates deep into each strand, mends breakage from within, and restores lost protein. 5 minutes once a week — and the difference will spoil you.",
    },
    images: [
      {
        src: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1400&q=85",
        alt: { ar: "قناع الترميم العميق — فناء", en: "Fanaa Deep Repair Mask" },
      },
      {
        src: "https://images.unsplash.com/photo-1519735777090-ec97162dc266?w=1400&q=85",
        alt: { ar: "عناية بالشعر", en: "Hair care" },
      },
      {
        src: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=1400&q=85",
        alt: { ar: "شعر صحي ومشرق", en: "Healthy shiny hair" },
      },
    ],
    lifestyleImage: {
      src: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1600&q=85",
      alt: { ar: "شعر صحي وقوي", en: "Healthy strong hair" },
    },
    price: TIER_OFFER.unit,
    offerTiers: [...TIER_OFFER.tiers],
    badges: [
      { ar: "للشعر التالف والمصبوغ", en: "For damaged & colored hair" },
      { ar: "نعومة من أول استخدام", en: "Softness from first use" },
      { ar: "+٢٤١ تقييم سعودي", en: "241+ Saudi reviews" },
    ],
    rating: { value: 4.9, count: 241 },
    collection: "hair",
    productType: "mask",
    target: "women",
    problems: ["hair-damage", "hair-dryness", "breakage", "color-treated"],
    upsellIds: ["p_001", "p_002"],
    stockLeft: 11,
    recentBuyers: 26,
    ingredients: [
      { name: { ar: "كيراتين نباتي", en: "Vegan Keratin" }, role: { ar: "تعبئة الفراغات في بنية الشعرة", en: "Fills gaps in hair structure" } },
      { name: { ar: "زيت الأرغان العضوي", en: "Organic Argan Oil" }, role: { ar: "تنعيم وإعطاء لمعان طبيعي", en: "Softens and gives natural shine" } },
      { name: { ar: "زبدة الشيا", en: "Shea Butter" }, role: { ar: "ترطيب عميق وحماية من التقصف", en: "Deep hydration and split-end protection" } },
    ],
    benefits: [
      {
        icon: "Droplet",
        title: {
          ar: "يصلّح التلف من داخل الخيط",
          en: "Repairs damage from within the strand",
        },
        body: {
          ar: "الكيراتين الطبيعي + زيت الأرغان يدخلون لطبقة القشرة الداخلية ويصلّحون الكسور. ما يغطّيها — يصلّحها فعلاً.",
          en: "Natural keratin + argan oil enter the inner cortex and mend the breakage. Doesn't coat damage — actually repairs it.",
        },
      },
      {
        icon: "Sparkles",
        title: {
          ar: "نعومة تحسّها من أول جلسة",
          en: "Softness you feel from session one",
        },
        body: {
          ar: "شعر أنعم، ألمع، وخفيف — بعد أول استخدام. مش وعد بعد أسبوعين، فرق تحسّه وأنت تشطفه.",
          en: "Softer, shinier, lighter hair — after the very first session. Not a two-week promise, a difference you feel as you rinse.",
        },
      },
      {
        icon: "Sun",
        title: {
          ar: "بدون سيليكون — ما يثقّل الشعر",
          en: "Silicone-free — won't weigh hair down",
        },
        body: {
          ar: "أغلب أقنعة السوق تعطي لمعان مؤقت بسيليكون يخفي التلف. تركيبتنا بدون سيليكون — اللمعان من الترميم الفعلي، والشعر يبقى خفيف.",
          en: "Most masks fake shine with silicone that just coats the damage. Ours is silicone-free — the shine comes from real repair, and hair stays light.",
        },
      },
      {
        icon: "Clock",
        title: {
          ar: "٥ دقائق مرّة في الأسبوع",
          en: "5 minutes, once a week",
        },
        body: {
          ar: "بعد الشامبو، حطّه على الشعر المبلول، انتظر ٥ دقائق، اشطف بماء بارد. هذا كله. روتين أسبوعي بسيط.",
          en: "After shampooing, apply to damp hair, wait 5 minutes, rinse with cool water. That's it. A simple weekly ritual.",
        },
      },
    ],
    reviews: [
      {
        name: { ar: "ريم الدوسري", en: "Reem Al-Dossari" },
        city: { ar: "الرياض", en: "Riyadh" },
        rating: 5,
        body: {
          ar: "شعري كان جاف ومتقصّف من التمشيط والتكييف. بعد أول استخدام حسّيت إن شيء تغيّر. بعد ثلاث أسابيع الفرق واضح جداً.",
          en: "My hair was dry and breaking from styling and AC. After the first use I felt something change. After three weeks the difference is very clear.",
        },
        date: "2026-04-18",
        verified: true,
      },
      {
        name: { ar: "هند العتيبي", en: "Hind Al-Otaibi" },
        city: { ar: "جدة", en: "Jeddah" },
        rating: 5,
        body: {
          ar: "جرّبت كل الأقنعة اللي في السوق. هذا القناع يختلف — يبقى تأثيره لأيام مش ساعة. الشعر ناعم وخفيف.",
          en: "Tried every mask on the market. This one is different — the effect lasts for days, not an hour. Hair is soft and light.",
        },
        date: "2026-04-04",
        verified: true,
      },
      {
        name: { ar: "محمد القحطاني", en: "Mohammed Al-Qahtani" },
        city: { ar: "تبوك", en: "Tabuk" },
        rating: 4,
        body: {
          ar: "ممتاز لكل أنواع الشعر. شعري الكثيف يحتاج وقت أطول قليلاً — لكن النتيجة تستاهل.",
          en: "Great for all hair types. My thick hair needs a little more time — but the result is worth it.",
        },
        date: "2026-03-10",
        verified: true,
      },
    ],
    faq: [
      {
        q: { ar: "هل آمن للشعر المصبوغ أو المعالج بكيراتين؟", en: "Is it safe for color-treated or keratin-treated hair?" },
        a: {
          ar: "نعم. بدون كبريتات، بدون سيليكون، ودرجة pH متوازنة (٤.٥-٥). آمن على الصبغات، البروتين، والكيراتين الكيميائي. كثير من عملائنا يستخدمونه بعد جلسات الكيراتين لإطالة عمرها.",
          en: "Yes. Sulfate-free, silicone-free, and pH-balanced (4.5-5). Safe for color, protein treatments, and chemical keratin. Many of our customers use it post-keratin to extend the treatment's life.",
        },
      },
      {
        q: { ar: "هل يخلّي الشعر دهني أو ثقيل؟", en: "Will it make my hair greasy or weigh it down?" },
        a: {
          ar: "لا. تركيبة خفيفة بدون سيليكون — تعطي ترطيب حقيقي بدون لمعان زيتي أو ثقل. مناسب للشعر الناعم والكيرلي والكثيف.",
          en: "No. A lightweight, silicone-free formula — real moisture without an oily shine or heaviness. Works for fine, curly, and thick hair.",
        },
      },
      {
        q: { ar: "متى يبان الفرق على التقصّف والتكسّر؟", en: "When does breakage actually reduce?" },
        a: {
          ar: "النعومة من أول استخدام، التقصّف يقل واضحاً بعد ٤ أسابيع من الاستخدام الأسبوعي. ما يصلّح التقصّف الموجود — لكن يوقف توسّعه ويرجّع قوّة الشعر الجديد.",
          en: "Softness from the first use, breakage drops noticeably after 4 weeks of weekly use. It won't reverse existing split ends — but it stops them spreading and rebuilds the strength of new growth.",
        },
      },
      {
        q: { ar: "كم مدة التوصيل؟", en: "How fast is delivery?" },
        a: {
          ar: "٤٨ ساعة في الرياض وجدة، و٣ إلى ٤ أيام لباقي مدن السعودية. الدفع عند الاستلام، مع رابط تتبّع للسائق.",
          en: "48 hours in Riyadh and Jeddah, 3-4 days nationwide. Cash on delivery, with a live courier tracking link.",
        },
      },
      {
        q: { ar: "وش لو ما عجبني؟", en: "What if I don't love it?" },
        a: {
          ar: "إرجاع مجاني خلال ١٤ يوم بدون أسئلة. ما تدفع ريال إلا لما يوصلك القناع.",
          en: "Free 14-day returns, no questions. You don't pay a riyal until the mask arrives.",
        },
      },
    ],
  },

  /* ──────────────────────────────────────────────────────────
   * P_004  فيتامينات سوجاربير للشعر — Sugarbear Hair Vitamins  [Hair]
   * Dedicated to the /sugarbear landing page. Tier pricing mirrors the
   * page's own bundle state (1 = 199 / 2 = 279 / 3 = 349 SAR).
   * CRO copy lives in app/sugarbear/copy.ts; only cart-surface fields
   * are needed here.
   * ────────────────────────────────────────────────────────── */
  {
    id: "p_004",
    slug: "sugarbear-hair",
    /*
     * Sugarbear ships its own premium landing experience at /sugarbear
     * (hero, ritual, reviews, sticky CTA — see app/sugarbear/*). We
     * collapse all routing onto that single canonical URL:
     *   – Every internal link goes to /sugarbear via productHref()
     *   – /products/sugarbear-hair 308-redirects to /sugarbear
     *     (next.config.mjs + runtime safety net in the [slug] page)
     *   – The slug is preserved so cart/SKU lookups and the redirect
     *     source URL keep working.
     */
    landingPath: "/sugarbear",
    sku: "FN-SUG-004",
    title: { ar: "فيتامينات سوجاربير للشعر", en: "Sugarbear Hair Vitamins" },
    description: {
      ar: "فيتامينات يومية بتركيبة نباتية تدعم مظهر شعر أكثر كثافة ولمعاناً وصحة.",
      en: "Daily vegan vitamins that support the appearance of thicker, shinier, healthier hair.",
    },
    images: [
      {
        src: "/sugarbear/bundle-3.png",
        alt: { ar: "ثلاث علب سوجاربير للشعر", en: "Sugarbear Hair Vitamins 3-pack" },
      },
      {
        src: "/sugarbear/bundle-2.png",
        alt: { ar: "علبتان سوجاربير للشعر", en: "Sugarbear Hair Vitamins 2-pack" },
      },
      {
        src: "/sugarbear/bundle-1.png",
        alt: { ar: "علبة سوجاربير للشعر", en: "Sugarbear Hair Vitamins 1-pack" },
      },
    ],
    price: { amount: 19900, currency: C },
    offerTiers: [
      { quantity: 1, total: { amount: 19900, currency: C } },
      { quantity: 2, total: { amount: 27900, currency: C } },
      { quantity: 3, total: { amount: 34900, currency: C } },
    ],
    badges: [
      { ar: "تركيبة نباتية ١٠٠٪", en: "100% Vegan" },
      { ar: "خالٍ من الجلوتين", en: "Gluten Free" },
      { ar: "بنكهة التوت الطبيعية", en: "Natural Berry Flavor" },
    ],
    rating: { value: 4.9, count: 12647 },
    collection: "hair",
    upsellIds: ["p_002", "p_003"],
    stockLeft: 23,
    recentBuyers: 47,
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
export const bestSellerIds = [
  "p_001",
  "p_002",
  "p_003",
] as const;
export function getBestSellers(): Product[] {
  return getProductsByIds([...bestSellerIds]);
}
