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
      ar: "سيروم يومي مركّز يشتغل على التبقّع وعدم التجانس — مناسب للرجال والنساء، مختبر للمناخ السعودي.",
      en: "A concentrated daily serum targeting dark spots and uneven tone — tested for the Saudi climate, for both men and women.",
    },
    description: {
      ar: "صُمّم خصيصاً لمناخ السعودية الجاف والحار. تركيبة مركّزة تعمل على التبقّع الناتج عن الشمس والتلوث — تستخدمه صباحاً قبل المرطّب، ونتائجه تبدأ تظهر من الأسبوع الثاني.",
      en: "Formulated for Saudi Arabia's dry, hot climate. A concentrated blend that targets sun and pollution-induced dark spots — apply in the morning before moisturiser, and see results from week two.",
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
          ar: "نتائج تبدأ من الأسبوع الثاني",
          en: "Results from week two",
        },
        body: {
          ar: "تركيبة مركّزة بنسب فعّالة — مش بس مرطّب خفيف بمكوّنات رمزية.",
          en: "A concentrated formula at effective ratios — not just a light moisturiser with token ingredients.",
        },
      },
      {
        icon: "Sun",
        title: {
          ar: "مصمّم للمناخ السعودي",
          en: "Built for the Saudi climate",
        },
        body: {
          ar: "الحرارة والغبار والشمس — ثلاث أعداء لبشرتك. السيروم صُمّم خصيصاً لهذه الظروف.",
          en: "Heat, dust, and sun — three enemies your skin faces daily. This serum was formulated specifically for these conditions.",
        },
      },
      {
        icon: "Wind",
        title: {
          ar: "مناسب للرجال والنساء",
          en: "For both men and women",
        },
        body: {
          ar: "لا رائحة قوية، لا ملمس ثقيل — يختفي بسرعة ويترك البشرة ناعمة.",
          en: "No heavy scent, no greasy feel — absorbs quickly and leaves skin smooth.",
        },
      },
      {
        icon: "ShieldCheck",
        title: {
          ar: "بدون مواد ضارة",
          en: "No harmful ingredients",
        },
        body: {
          ar: "مختبر ومعتمد — بدون بارابين، بدون كحول جاف، بدون تبييض كيميائي قاسٍ.",
          en: "Lab-tested and certified — no parabens, no drying alcohol, no harsh chemical bleaching.",
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
        q: { ar: "كيف أستخدمه؟", en: "How do I use it?" },
        a: {
          ar: "قطرتين أو ثلاث على وجهك الناشف بعد التنظيف صباحاً — دلّكه بلطف ثم ضع مرطّبك فوقه. ما تحتاج أكثر من ٣٠ ثانية.",
          en: "Two to three drops on clean, dry skin each morning — gently press in, then layer your moisturiser on top. Takes under 30 seconds.",
        },
      },
      {
        q: { ar: "مناسب لكل أنواع البشرة؟", en: "Is it suitable for all skin types?" },
        a: {
          ar: "نعم — مختبر على البشرة الجافة والمختلطة والدهنية. امتصاص سريع بدون ما يترك ملمس دهني.",
          en: "Yes — tested on dry, combination, and oily skin types. Fast absorption without greasy residue.",
        },
      },
      {
        q: { ar: "خلال كم يوم بتوصلني؟", en: "How long is delivery?" },
        a: {
          ar: "٤٨ ساعة في الرياض وجدة، و٣ إلى ٤ أيام لباقي مناطق المملكة. الدفع عند الاستلام.",
          en: "48 hours in Riyadh and Jeddah, 3–4 days for the rest of Saudi Arabia. Cash on delivery.",
        },
      },
      {
        q: { ar: "وش لو ما عجبني؟", en: "What if I don't love it?" },
        a: {
          ar: "إرجاع مجاني خلال ١٤ يوم بدون أسئلة. ما تدفع شي إلا لما توصلك وتشوفه بعينك.",
          en: "Free 14-day returns, no questions. You don't pay anything until it arrives at your door.",
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
      ar: "الأناقة الحقيقية\nتبدأ من الجلد.",
      en: "Real elegance\nstarts with your skin.",
    },
    subheadline: {
      ar: "زيت رجالي جاف الامتصاص — يرطّب الوجه واللحية معاً، مناسب للمناخ السعودي الجاف.",
      en: "A dry-absorbing men's oil — moisturises face and beard together, formulated for Saudi Arabia's dry climate.",
    },
    description: {
      ar: "مزيج من الزيوت الطبيعية ذات الامتصاص السريع — لا يترك لمعة، لا رائحة مزعجة، يرطّب اللحية ويليّن بشرة الوجه في نفس الوقت. ٣٠ ثانية في اليوم، وفرق تحسّه بعد أول استخدام.",
      en: "A blend of fast-absorbing natural oils — no shine, no overpowering scent, simultaneously moisturises beard and facial skin. 30 seconds a day, with a difference you feel from the first use.",
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
      { ar: "للرجال", en: "For men" },
      { ar: "بدون لمعة — جاف الامتصاص", en: "No shine — dry absorption" },
    ],
    rating: { value: 4.8, count: 187 },
    collection: "grooming",
    upsellIds: ["p_001", "p_003"],
    stockLeft: 9,
    recentBuyers: 22,
    benefits: [
      {
        icon: "Wind",
        title: {
          ar: "جاف الامتصاص — بدون لمعة",
          en: "Dry absorption — no shine",
        },
        body: {
          ar: "يتسرّب بسرعة ويترك البشرة ناعمة مش دهنية. يصلح للبشرة الدهنية والمختلطة.",
          en: "Absorbs fast and leaves skin smooth, not greasy. Works for oily and combination skin.",
        },
      },
      {
        icon: "Sparkles",
        title: {
          ar: "للوجه واللحية معاً",
          en: "For face and beard together",
        },
        body: {
          ar: "منتج واحد يخدم اثنين — يرطّب بشرة الوجه ويليّن اللحية في نفس الوقت.",
          en: "One product, two jobs — moisturises the face and softens the beard simultaneously.",
        },
      },
      {
        icon: "Sun",
        title: {
          ar: "يحمي من الجفاف اليومي",
          en: "Shields against daily dryness",
        },
        body: {
          ar: "التكيّف والشمس والجو الجاف يسرقون رطوبة بشرتك يومياً — الزيت يعوّضها.",
          en: "AC, sun, and dry air steal your skin's moisture daily — the oil replenishes it.",
        },
      },
      {
        icon: "Hand",
        title: {
          ar: "٣٠ ثانية فقط — بدون تعقيد",
          en: "30 seconds — no complexity",
        },
        body: {
          ar: "نقطتين في الكف، دلّكه على وجهك ولحيتك. خلاص. ما في روتين معقد.",
          en: "Two drops in your palm, press into face and beard. Done. No complex routine.",
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
        q: { ar: "هل يناسب اللحى الكثيفة؟", en: "Does it work for thick beards?" },
        a: {
          ar: "نعم. التركيبة مصممة لكل أنواع اللحى — خفيفة أو كثيفة. يخترق الشعر ويصل لبشرة الوجه تحته.",
          en: "Yes. The formula is designed for all beard types — light or thick. It penetrates the hair and reaches the skin underneath.",
        },
      },
      {
        q: { ar: "هل يترك لمعة على الوجه؟", en: "Does it leave shine on the face?" },
        a: {
          ar: "لا. يُصنَّف كزيت 'جاف' — يُمتص خلال دقيقة بدون أثر لامع أو ثقيل.",
          en: "No. Classified as a 'dry' oil — absorbed within a minute, no shiny or heavy residue.",
        },
      },
      {
        q: { ar: "كم مدة التوصيل؟", en: "How fast is delivery?" },
        a: {
          ar: "٤٨ ساعة في الرياض وجدة، و٣ إلى ٤ أيام لباقي مناطق المملكة.",
          en: "48 hours in Riyadh and Jeddah, 3–4 days nationwide.",
        },
      },
      {
        q: { ar: "وش لو ما عجبني؟", en: "What if I don't love it?" },
        a: {
          ar: "إرجاع مجاني خلال ١٤ يوم. ما تدفع شي إلا لما توصلك.",
          en: "Free 14-day returns. You don't pay anything until it arrives.",
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
      ar: "شعرك يستاهل\nأكثر من شامبو.",
      en: "Your hair deserves\nmore than shampoo.",
    },
    subheadline: {
      ar: "قناع أسبوعي عميق يرجّع الحيوية اللي أخذها منك الحر والتمشيط — نتائج تحسّيها من أول استخدام.",
      en: "A weekly deep-nourishment mask that restores the vitality stolen by heat and styling — results you feel from the very first use.",
    },
    description: {
      ar: "الشعر السعودي يتعرض لضغط مضاعف: حرارة التمشيط، جفاف التكيّف، والطقس الحار. الشامبو يُنظّف بس ما يعوّض. القناع يعمل عمقاً — يرطّب من داخل الخيط إلى طرفه — ويترك الشعر أملس وأكثر لمعاناً.",
      en: "Saudi hair faces double pressure: styling heat, AC dryness, and hot weather. Shampoo cleans but doesn't restore. The mask works deep — moisturising from root to tip — leaving hair smoother and more radiant.",
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
      { ar: "للنساء", en: "For women" },
      { ar: "ترطيب من أول استخدام", en: "Softness from first use" },
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
          ar: "ترطيب عميق من الجذر للطرف",
          en: "Deep moisture from root to tip",
        },
        body: {
          ar: "الشامبو يصل لسطح الشعر. القناع يدخل عميقاً ويرطّب الطبقة الداخلية التي تصنع الفرق.",
          en: "Shampoo reaches the surface. The mask penetrates deep and moisturises the inner layer that makes the real difference.",
        },
      },
      {
        icon: "Sparkles",
        title: {
          ar: "نتائج تحسّيها من الاستخدام الأول",
          en: "Results from first use",
        },
        body: {
          ar: "شعر أملس وأكثر لمعاناً بعد أول جلسة — مش بعد أسبوعين.",
          en: "Smoother and shinier hair after the first session — not after two weeks.",
        },
      },
      {
        icon: "Sun",
        title: {
          ar: "يكافح الجفاف السعودي",
          en: "Combats Saudi dryness",
        },
        body: {
          ar: "مصمّم خصيصاً لمناخ الجزيرة العربية — حرارة + تكييف + شمس = شعر يحتاج ترطيباً عميقاً أسبوعياً.",
          en: "Specifically formulated for the Arabian Peninsula climate — heat + AC + sun = hair that needs weekly deep hydration.",
        },
      },
      {
        icon: "Hand",
        title: {
          ar: "٥ دقائق أسبوعياً — بس",
          en: "Just 5 minutes a week",
        },
        body: {
          ar: "طبّقيه بعد الشامبو، انتظري ٥ دقائق، اشطفي. روتين بسيط، نتائج واضحة.",
          en: "Apply after shampooing, wait 5 minutes, rinse. Simple routine, visible results.",
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
        q: { ar: "مناسب لكل أنواع الشعر؟", en: "Suitable for all hair types?" },
        a: {
          ar: "نعم. الصيغة متوازنة لكل الأنواع — ناعم أو خشن، كثيف أو خفيف. للشعر الكيميائي والطبيعي.",
          en: "Yes. The formula is balanced for all types — fine or coarse, thick or thin. For both chemically treated and natural hair.",
        },
      },
      {
        q: { ar: "كم مرة في الأسبوع؟", en: "How many times a week?" },
        a: {
          ar: "مرة واحدة أسبوعياً تكفي — بعد الشامبو، اتركيه ٥ دقائق، اشطفي بماء بارد لإغلاق الحراشف.",
          en: "Once a week is enough — after shampooing, leave for 5 minutes, rinse with cool water to seal the cuticle.",
        },
      },
      {
        q: { ar: "كم مدة التوصيل؟", en: "How long is delivery?" },
        a: {
          ar: "٤٨ ساعة في الرياض وجدة، و٣ إلى ٤ أيام لباقي مناطق المملكة. الدفع عند الاستلام.",
          en: "48 hours in Riyadh and Jeddah, 3–4 days nationwide. Cash on delivery.",
        },
      },
      {
        q: { ar: "وش لو ما عجبني؟", en: "What if I don't love it?" },
        a: {
          ar: "إرجاع مجاني خلال ١٤ يوم بدون أسئلة.",
          en: "Free 14-day returns, no questions asked.",
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
