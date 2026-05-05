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
 * Collections: skincare · grooming · haircare
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
   * P_001  سيروم الإشراق — Glow Serum  [Unisex · Skincare]
   * Problem: dark spots, dull skin from KSA sun + pollution
   * Solution: concentrated daily serum, visible results in 2 weeks
   * ────────────────────────────────────────────────────────── */
  {
    id: "p_001",
    slug: "glow-serum",
    title: { ar: "سيروم الإشراق", en: "Glow Serum" },
    headline: {
      ar: "ذهب التبقّع،\nجه الإشراق.",
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
        src: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=1400&q=85",
        alt: { ar: "سيروم الإشراق — فناء", en: "Fanaa Glow Serum" },
      },
      {
        src: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=1400&q=85",
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
    collection: "skincare",
    upsellIds: ["p_002", "p_003"],
    stockLeft: 14,
    recentBuyers: 31,
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
        icon: "Wind",
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
        icon: "Hand",
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
        name: { ar: "خالد الشهري", en: "Khalid Al-Shahri" },
        city: { ar: "جدة", en: "Jeddah" },
        rating: 5,
        body: {
          ar: "ما كنت أتوقع إن رجل يحتاج سيروم. صراحة فرّق — البشرة صارت أنظف وأكثر حيوية. اشتريت ثلاث.",
          en: "Didn't think a man needed serum. Honestly it made a difference — skin feels cleaner and more alive. Bought three.",
        },
        date: "2026-04-02",
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
        name: { ar: "فيصل القحطاني", en: "Faisal Al-Qahtani" },
        city: { ar: "الخبر", en: "Khobar" },
        rating: 4,
        body: {
          ar: "نتائج ممتازة. أتمنى لو يجي بحجم أكبر. راضٍ جداً عن التجربة.",
          en: "Excellent results. Wish it came in a larger size. Very satisfied with the experience.",
        },
        date: "2026-03-05",
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
   * P_002  زيت العناية الأصيل — Grooming Oil  [Men · Grooming]
   * Problem: dry skin + rough beard from KSA heat, AC, hard water
   * Solution: fast-absorbing face + beard oil, 30-second daily routine
   * ────────────────────────────────────────────────────────── */
  {
    id: "p_002",
    slug: "grooming-oil",
    title: { ar: "زيت العناية الأصيل", en: "Grooming Oil" },
    headline: {
      ar: "اللحية القوية\nتبدأ من الجلد تحتها.",
      en: "A strong beard\nstarts with the skin beneath.",
    },
    subheadline: {
      ar: "زيت رجالي بـ ٥ زيوت طبيعية — يغذّي جذور اللحية، يرطّب الجلد تحتها، ويقفل الفراغات. ٣٠ ثانية في اليوم، نتيجة بـ ٢١ يوم.",
      en: "A men's oil blending 5 natural oils — feeds beard roots, hydrates the skin beneath, and fills patches. 30 seconds a day, results in 21 days.",
    },
    description: {
      ar: "أكثر شكوى عند الرجال السعوديين: لحية فيها فراغات، حكّة في الجلد تحتها، وبشرة الوجه جافة من التكييف والشمس. السبب واحد: الجلد تحت اللحية ما ياخذ ترطيبه. الزيت يخترق الشعر، يوصل للجلد، ويغذّي الجذور — يعمل ٣ مهام بمنتج واحد، وبثلاثين ثانية في اليوم.",
      en: "The biggest complaint among Saudi men: a patchy beard, itchy skin beneath, and dry facial skin from AC and sun. One root cause: the skin under the beard never gets moisture. This oil penetrates the hair, reaches the skin, and feeds the follicles — three jobs, one product, thirty seconds a day.",
    },
    images: [
      {
        src: "https://images.unsplash.com/photo-1621607512022-6aecc4fed814?w=1400&q=85",
        alt: { ar: "زيت العناية الأصيل", en: "Fanaa Grooming Oil" },
      },
      {
        src: "https://images.unsplash.com/photo-1559599101-f09722fb4948?w=1400&q=85",
        alt: { ar: "عناية رجالية", en: "Men's grooming" },
      },
      {
        src: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1400&q=85",
        alt: { ar: "روتين العناية الرجالية", en: "Men's skincare routine" },
      },
    ],
    lifestyleImage: {
      src: "https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=1600&q=85",
      alt: { ar: "رجل يهتم بمظهره", en: "Man who takes care of his appearance" },
    },
    price: TIER_OFFER.unit,
    offerTiers: [...TIER_OFFER.tiers],
    badges: [
      { ar: "للرجال — مختبر على ١٨٧ سعودي", en: "For men — tested on 187 Saudis" },
      { ar: "نتائج خلال ٢١ يوم", en: "Results in 21 days" },
      { ar: "بدون لمعة", en: "Zero shine" },
    ],
    rating: { value: 4.8, count: 187 },
    collection: "grooming",
    upsellIds: ["p_001", "p_003"],
    stockLeft: 9,
    recentBuyers: 22,
    benefits: [
      {
        icon: "Sparkles",
        title: {
          ar: "يقفل فراغات اللحية",
          en: "Fills in beard patches",
        },
        body: {
          ar: "زيت الأرز + زيت الخروع + زيت الجوجوبا — تركيبة مختبرة لتحفيز جذور الشعر في المناطق الفارغة. أغلب عملائنا يلاحظون امتلاء الفراغات بعد ٢١ يوم استخدام يومي.",
          en: "Cedar oil + castor oil + jojoba oil — a blend lab-tested to stimulate roots in patchy areas. Most of our customers see patches filling in after 21 days of daily use.",
        },
      },
      {
        icon: "Hand",
        title: {
          ar: "يوقف حكّة الجلد من أول استخدام",
          en: "Stops itch from the first use",
        },
        body: {
          ar: "الحكّة تحت اللحية ما تجي من الشعر — تجي من الجلد الجاف تحته. الزيت يرطّب الجلد ويوقف الحكّة من أول مرة، حتى لو لحيتك جديدة.",
          en: "Beard itch isn't from the hair — it's from the dry skin beneath. The oil moisturises that skin and stops the itch from the very first application, even if your beard is fresh.",
        },
      },
      {
        icon: "Wind",
        title: {
          ar: "بدون لمعة — مناسب لقبل الدوام",
          en: "Zero shine — work-day ready",
        },
        body: {
          ar: "زيت 'جاف' الامتصاص — يختفي خلال دقيقة. ما يلمع، ما يبقّع الكوفية أو الشماغ، ما يحس فيه أحد. عطره خفيف ورجالي.",
          en: "A 'dry' oil — absorbs in under a minute. No shine, no stains on a shemagh or shirt, no one notices. Subtle masculine scent.",
        },
      },
      {
        icon: "ShieldCheck",
        title: {
          ar: "ما يسبّب حبوب",
          en: "Won't cause breakouts",
        },
        body: {
          ar: "تركيبة غير سادّة للمسام (Non-comedogenic) — مختبرة على البشرة الدهنية والحساسة. زيت طبيعي ١٠٠٪، بدون مينوكسيديل، بدون كيماويات.",
          en: "Non-comedogenic formula — tested on oily and sensitive skin. 100% natural oils, no minoxidil, no chemicals.",
        },
      },
    ],
    reviews: [
      {
        name: { ar: "أحمد الزهراني", en: "Ahmed Al-Zahrani" },
        city: { ar: "الرياض", en: "Riyadh" },
        rating: 5,
        body: {
          ar: "كنت أظن إن هذا المنتجات مو لي. جرّبته وصدق اللحية صارت أكثر نعومة والبشرة شبه الشعر تحسّن. طلبت ثلاث.",
          en: "Thought these products weren't for me. Tried it and honestly the beard is softer and my skin under the beard improved. Ordered three.",
        },
        date: "2026-04-20",
        verified: true,
      },
      {
        name: { ar: "عمر الشمري", en: "Omar Al-Shammari" },
        city: { ar: "جدة", en: "Jeddah" },
        rating: 5,
        body: {
          ar: "الزيت ممتاز — يختفي بدون ما يحسسك إنك مطليت وجهك. ريحته طبيعية مريحة. ما توقعت الفرق يكون هذا الحجم.",
          en: "Excellent oil — disappears without making you feel like you've coated your face. Natural relaxing scent. Didn't expect the difference to be this big.",
        },
        date: "2026-04-06",
        verified: true,
      },
      {
        name: { ar: "محمد الغامدي", en: "Mohammed Al-Ghamdi" },
        city: { ar: "أبها", en: "Abha" },
        rating: 5,
        body: {
          ar: "وصل بسرعة والتغليف محترم. اللحية صارت أكثر لمعاناً وانتظاماً. واضح إن المنتج مدروس.",
          en: "Arrived quickly, professional packaging. Beard is noticeably shinier and better-shaped. The product is clearly well thought out.",
        },
        date: "2026-03-22",
        verified: true,
      },
      {
        name: { ar: "سعد العنزي", en: "Saad Al-Anzi" },
        city: { ar: "تبوك", en: "Tabuk" },
        rating: 4,
        body: {
          ar: "تجربة ممتازة. أتمنى يكون فيه نسخة بدون رائحة لمن يحبون ذلك.",
          en: "Great experience overall. Wish there was an unscented version for those who prefer it.",
        },
        date: "2026-03-08",
        verified: true,
      },
    ],
    faq: [
      {
        q: { ar: "متى تبدأ الفراغات تمتلئ؟", en: "When do the patches start filling in?" },
        a: {
          ar: "أغلب عملائنا يلاحظون ليونة وتنعّم اللحية من الأسبوع الأول، وامتلاء الفراغات يبدأ من الأسبوع الثالث. ٢١ يوم استخدام يومي = الفرق يبان في صور قبل-وبعد.",
          en: "Most customers notice softness and texture change in week one, with patches filling in from week three. 21 days of daily use = a visible before/after.",
        },
      },
      {
        q: { ar: "هل يسبّب حبوب أو احمرار؟", en: "Will it cause acne or redness?" },
        a: {
          ar: "لا. مصنّف Non-comedogenic — يعني ما يسد المسام. مختبر على البشرة الدهنية والحساسة. لو حسّيت بشي خلال أول يومين، خفّف الكمية لقطرة وحدة.",
          en: "No. Classified non-comedogenic — won't clog pores. Tested on oily and sensitive skin. If you feel any reaction in the first two days, drop to a single drop.",
        },
      },
      {
        q: { ar: "هل يلمع على الوجه أو يبقّع الشماغ؟", en: "Will it shine or stain a shemagh?" },
        a: {
          ar: "لا. زيت 'جاف' الامتصاص — يدخل البشرة خلال دقيقة بدون أي أثر لامع أو ثقيل، وما يبقّع القماش.",
          en: "No. A 'dry' oil — absorbs in under a minute with zero shine or residue, and won't stain fabric.",
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
   * P_003  قناع الشعر المُرطّب — Deep Hair Mask  [Women · Haircare]
   * Problem: dry, damaged hair from heat styling + abaya + KSA climate
   * Solution: weekly deep mask, visible softness from first use
   * ────────────────────────────────────────────────────────── */
  {
    id: "p_003",
    slug: "hair-mask",
    title: { ar: "قناع الشعر المُرطّب", en: "Deep Hair Mask" },
    headline: {
      ar: "تكسّر، تقصّف، جفاف...\nترجع الحياة بـ ٥ دقائق.",
      en: "Breakage, dryness, damage...\nlife returns in 5 minutes.",
    },
    subheadline: {
      ar: "قناع أسبوعي بزبدة الشيا والأرغان والكيراتين — يصلّح الشعر التالف من الحرارة، الصبغات، والشيلة. النعومة تبدأ من أول استخدام.",
      en: "A weekly shea butter + argan + keratin mask — repairs hair damaged by heat, dye, and friction. Softness from the very first use.",
    },
    description: {
      ar: "الشعر السعودي يتعرّض لثلاث ضغوط: حرارة التمشيط، احتكاك الشيلة والعباية، وجفاف التكييف والمياه الثقيلة. الشامبو ينظّف بس ما يصلّح. القناع يدخل عميق في الخيط، يصلّح الكسور من داخل، ويرجّع البروتين اللي ضاع. ٥ دقائق مرّة في الأسبوع — والفرق يخلّيك ما ترضين عن غيره.",
      en: "Saudi hair faces three pressures: styling heat, abaya and shemagh friction, and AC dryness with hard water. Shampoo cleans but doesn't repair. The mask penetrates deep into each strand, mends breakage from within, and restores lost protein. 5 minutes once a week — and the difference will spoil you.",
    },
    images: [
      {
        src: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1400&q=85",
        alt: { ar: "قناع الشعر المُرطّب — فناء", en: "Fanaa Deep Hair Mask" },
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
      alt: { ar: "امرأة بشعر صحي", en: "Woman with healthy hair" },
    },
    price: TIER_OFFER.unit,
    offerTiers: [...TIER_OFFER.tiers],
    badges: [
      { ar: "للنساء — +٢٤١ تقييم سعودي", en: "For women — 241+ Saudi reviews" },
      { ar: "نعومة من أول استخدام", en: "Softness from first use" },
      { ar: "آمن للشعر المصبوغ", en: "Safe for color-treated hair" },
    ],
    rating: { value: 4.9, count: 241 },
    collection: "haircare",
    upsellIds: ["p_001", "p_002"],
    stockLeft: 11,
    recentBuyers: 26,
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
          ar: "نعومة تحسّيها من أول جلسة",
          en: "Softness you feel from session one",
        },
        body: {
          ar: "شعر أنعم، ألمع، وخفيف — بعد أول استخدام. مش وعد بعد أسبوعين، فرق تحسّيه وأنت تشطفينه.",
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
        icon: "Hand",
        title: {
          ar: "٥ دقائق مرّة في الأسبوع",
          en: "5 minutes, once a week",
        },
        body: {
          ar: "بعد الشامبو، حطّيه على الشعر المبلول، انتظري ٥ دقائق، اشطفي بماء بارد. هذا كله. روتين أسبوعي بسيط.",
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
        name: { ar: "لمياء الشهري", en: "Lamya Al-Shahri" },
        city: { ar: "الدمام", en: "Dammam" },
        rating: 5,
        body: {
          ar: "السعر منطقي مقارنة بما تقدّمه. وصل سريع والتغليف أنيق. بطلبه كل شهر.",
          en: "Fair price for what it delivers. Arrived fast and elegantly packaged. I'll order it every month.",
        },
        date: "2026-03-25",
        verified: true,
      },
      {
        name: { ar: "منى القحطاني", en: "Mona Al-Qahtani" },
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
          ar: "نعم. بدون كبريتات، بدون سيليكون، ودرجة pH متوازنة (٤.٥-٥). آمن على الصبغات، البروتين، والكيراتين الكيميائي. كثير من عميلاتنا يستخدمنه بعد جلسات الكيراتين لإطالة عمرها.",
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
          ar: "إرجاع مجاني خلال ١٤ يوم بدون أسئلة. ما تدفعين ريال إلا لما يوصلك القناع.",
          en: "Free 14-day returns, no questions. You don't pay a riyal until the mask arrives.",
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
