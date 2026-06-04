import type { Locale } from "@/lib/types";

/**
 * Legal / policy page content — single source of truth.
 *
 * PLACEHOLDER — pending legal review.
 * --------------------------------------------------------------------------
 * The copy below is brand-coherent, GCC-appropriate placeholder content for a
 * Saudi cash-on-delivery beauty store. It is written to read professionally to
 * customers, but the wording (especially Privacy & Terms) MUST be reviewed and
 * signed off by legal before this is treated as the binding policy. Swap any
 * paragraph in place — the page chrome adapts automatically.
 *
 * Business identifiers (VAT / CR) are intentionally NOT hard-coded here; they
 * live in `data/site.ts` (`siteConfig.business`) and are env-driven so the same
 * build can serve staging and production without a code change.
 *
 * Shape:
 *   • `sections[]` → prose documents (privacy, terms, shipping/returns).
 *   • `faqs[]`     → accordion document (faq).
 * A document may use either, and `PolicyPage` renders the matching layout.
 */

export type PolicySection = {
  heading: string;
  /** One entry per paragraph. */
  body: string[];
};

export type FaqItem = {
  q: string;
  a: string;
};

export type PolicyDoc = {
  eyebrow: string;
  title: string;
  intro: string;
  /** Human "last updated" line, e.g. "آخر تحديث: مايو 2026". */
  updated: string;
  sections?: PolicySection[];
  faqs?: FaqItem[];
};

export type PolicyKey = "privacy" | "terms" | "shipping" | "faq";

export const legalContent: Record<PolicyKey, Record<Locale, PolicyDoc>> = {
  privacy: {
    ar: {
      eyebrow: "سياسة الخصوصية",
      title: "خصوصيتك أمانة عندنا.",
      intro:
        "نوضح في هذه الصفحة البيانات التي نجمعها منك، وكيف نستخدمها لحماية طلبك وتحسين تجربتك. نجمع الحد الأدنى فقط، ولا نبيع بياناتك لأي طرف.",
      updated: "آخر تحديث: مايو 2026",
      sections: [
        {
          heading: "البيانات التي نجمعها",
          body: [
            "نجمع الاسم ورقم الجوال والمدينة والعنوان عند تأكيد الطلب، لأنها ضرورية للتوصيل والتأكيد عبر المكالمة.",
            "نجمع بيانات تصفّح غير شخصية (مثل الصفحات التي تزورها) لتحسين المتجر وقياس فعالية الإعلانات.",
          ],
        },
        {
          heading: "كيف نستخدم بياناتك",
          body: [
            "نستخدم بياناتك لتجهيز طلبك، والاتصال بك لتأكيد العنوان، وإرسال تحديثات الشحن.",
            "قد نستخدم بريدك الإلكتروني — إذا اشتركت في النشرة — لإرسال العروض والمنتجات الجديدة، ويمكنك إلغاء الاشتراك في أي وقت.",
          ],
        },
        {
          heading: "المشاركة مع أطراف خارجية",
          body: [
            "نشارك الحد الأدنى من بياناتك مع شركاء التوصيل لإيصال طلبك فقط.",
            "لا نبيع بياناتك الشخصية أو نؤجّرها لأي جهة لأغراض تسويقية.",
          ],
        },
        {
          heading: "حقوقك",
          body: [
            "يحق لك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها. تواصل معنا عبر واتساب أو البريد الإلكتروني وننفّذ طلبك في أسرع وقت.",
          ],
        },
      ],
    },
    en: {
      eyebrow: "Privacy policy",
      title: "Your privacy is a trust we keep.",
      intro:
        "This page explains the data we collect, and how we use it to protect your order and improve your experience. We collect only the minimum, and we never sell your data.",
      updated: "Last updated: May 2026",
      sections: [
        {
          heading: "Data we collect",
          body: [
            "We collect your name, mobile number, city, and address when you confirm an order — these are required for delivery and the confirmation call.",
            "We collect non-personal browsing data (such as the pages you visit) to improve the store and measure ad performance.",
          ],
        },
        {
          heading: "How we use your data",
          body: [
            "We use your data to prepare your order, call you to confirm the address, and send shipping updates.",
            "If you join our newsletter, we may use your email to share offers and new products — you can unsubscribe at any time.",
          ],
        },
        {
          heading: "Sharing with third parties",
          body: [
            "We share the minimum data with our delivery partners solely to deliver your order.",
            "We do not sell or rent your personal data to anyone for marketing purposes.",
          ],
        },
        {
          heading: "Your rights",
          body: [
            "You may request access to, correction of, or deletion of your data. Contact us on WhatsApp or by email and we'll action it promptly.",
          ],
        },
      ],
    },
  },
  terms: {
    ar: {
      eyebrow: "الشروط والأحكام",
      title: "الشروط والأحكام.",
      intro:
        "باستخدامك لمتجر فناء وتقديم طلب، فإنك توافق على الشروط التالية. كتبناها بلغة واضحة حتى تكون على بيّنة من حقوقك والتزاماتنا.",
      updated: "آخر تحديث: مايو 2026",
      sections: [
        {
          heading: "الطلبات والدفع",
          body: [
            "جميع الطلبات بنظام الدفع عند الاستلام داخل المملكة العربية السعودية. لا تدفع أي مبلغ قبل استلام منتجك.",
            "نحتفظ بحق رفض أو إلغاء أي طلب في حال وجود بيانات غير صحيحة أو اشتباه في إساءة الاستخدام.",
          ],
        },
        {
          heading: "الأسعار والعروض",
          body: [
            "الأسعار المعروضة بالريال السعودي وتشمل ضريبة القيمة المضافة حيثما تنطبق.",
            "قد تكون بعض العروض لفترة محدودة أو بكميات محدودة، ونوضح ذلك عند توفّره.",
          ],
        },
        {
          heading: "المنتجات والاستخدام",
          body: [
            "منتجاتنا للعناية والتجميل، ويُرجى اتباع تعليمات الاستخدام المرفقة. في حال وجود حساسية معروفة، استشر مختصاً قبل الاستخدام.",
          ],
        },
        {
          heading: "حدود المسؤولية",
          body: [
            "نبذل أقصى جهد لضمان دقة المعلومات في المتجر، لكننا لا نضمن خلوها التام من الأخطاء. مسؤوليتنا تقتصر على قيمة المنتج المطلوب.",
          ],
        },
      ],
    },
    en: {
      eyebrow: "Terms of service",
      title: "Terms & conditions.",
      intro:
        "By using the Fanaa store and placing an order, you agree to the following terms. We've written them in plain language so you're clear on your rights and our obligations.",
      updated: "Last updated: May 2026",
      sections: [
        {
          heading: "Orders & payment",
          body: [
            "All orders are cash on delivery within Saudi Arabia. You pay nothing before you receive your product.",
            "We reserve the right to refuse or cancel any order in case of incorrect details or suspected misuse.",
          ],
        },
        {
          heading: "Prices & offers",
          body: [
            "Prices are shown in Saudi Riyal and include VAT where applicable.",
            "Some offers may be time-limited or limited in quantity; we make this clear where relevant.",
          ],
        },
        {
          heading: "Products & usage",
          body: [
            "Our products are for beauty and personal care. Please follow the included usage instructions. If you have a known allergy, consult a specialist before use.",
          ],
        },
        {
          heading: "Limitation of liability",
          body: [
            "We make every effort to keep store information accurate, but we cannot guarantee it is entirely error-free. Our liability is limited to the value of the ordered product.",
          ],
        },
      ],
    },
  },
  shipping: {
    ar: {
      eyebrow: "الشحن والإرجاع",
      title: "الشحن والإرجاع.",
      intro:
        "نوصّل لكل مدن المملكة، وندفع نحن قيمة الشحن. وإذا ما عجبك المنتج، ترجعه خلال 14 يوم بدون أسئلة.",
      updated: "آخر تحديث: مايو 2026",
      sections: [
        {
          heading: "مدة وتكلفة التوصيل",
          body: [
            "الشحن مجاني داخل جميع مدن المملكة. توصيل خلال 48 ساعة للرياض وجدة، ومن 3 إلى 4 أيام لباقي المدن.",
            "نرسل لك رابط تتبّع مباشر بمجرد خروج طلبك من المستودع.",
          ],
        },
        {
          heading: "تأكيد الطلب",
          body: [
            "نتصل بك من رقم سعودي رسمي لتأكيد العنوان وموعد التوصيل قبل الشحن. المكالمة أقل من دقيقة ولا تطلب أي بيانات بنكية.",
          ],
        },
        {
          heading: "سياسة الإرجاع والاستبدال",
          body: [
            "تقدر ترجع المنتج خلال 14 يوم من الاستلام إذا ما عجبك — بدون أسئلة.",
            "للإرجاع، تواصل معنا عبر واتساب ومعك رقم الطلب، وننسّق معك عملية الاسترجاع أو الاستبدال.",
            "نطلب أن يكون المنتج بحالته الأصلية قدر الإمكان لضمان سرعة المعالجة.",
          ],
        },
      ],
    },
    en: {
      eyebrow: "Shipping & returns",
      title: "Shipping & returns.",
      intro:
        "We deliver to every city in the Kingdom and we cover shipping. And if you don't love it, return it within 14 days — no questions asked.",
      updated: "Last updated: May 2026",
      sections: [
        {
          heading: "Delivery time & cost",
          body: [
            "Shipping is free across all Saudi cities. Delivery within 48 hours for Riyadh and Jeddah, and 3 to 4 days for other cities.",
            "We send you a live tracking link the moment your order leaves our warehouse.",
          ],
        },
        {
          heading: "Order confirmation",
          body: [
            "We call you from an official Saudi number to confirm your address and delivery time before shipping. The call is under a minute and asks for no banking details.",
          ],
        },
        {
          heading: "Returns & exchanges",
          body: [
            "You can return a product within 14 days of receiving it if you don't love it — no questions asked.",
            "To return, contact us on WhatsApp with your order number and we'll arrange the return or exchange with you.",
            "We ask that the product be in its original condition where possible so we can process it quickly.",
          ],
        },
      ],
    },
  },
  faq: {
    ar: {
      eyebrow: "الأسئلة الشائعة",
      title: "كل اللي تحتاج تعرفه.",
      intro:
        "جمعنا أكثر الأسئلة تكراراً عن الطلب والتوصيل والدفع والإرجاع. ما لقيت سؤالك؟ راسلنا واتساب ونجاوبك فوراً.",
      updated: "آخر تحديث: مايو 2026",
      faqs: [
        {
          q: "كيف أطلب؟ وهل أدفع مقدماً؟",
          a: "اختر منتجك، أدخل اسمك ورقم جوالك ومدينتك، وأكّد الطلب. لا تدفع أي مبلغ مقدماً — الدفع عند الاستلام فقط.",
        },
        {
          q: "كم تستغرق مدة التوصيل؟",
          a: "خلال 48 ساعة للرياض وجدة، ومن 3 إلى 4 أيام لباقي مدن المملكة، مع رابط تتبّع مباشر.",
        },
        {
          q: "هل الشحن مجاني؟",
          a: "نعم، الشحن مجاني داخل جميع مدن المملكة. ما تدفع شيئاً زيادة على سعر المنتج.",
        },
        {
          q: "هل أقدر أرجع المنتج؟",
          a: "أكيد. تقدر ترجع المنتج خلال 14 يوم من الاستلام بدون أسئلة. تواصل معنا واتساب ومعك رقم الطلب.",
        },
        {
          q: "ليش يتصل عليّ رقم سعودي ما أعرفه؟",
          a: "الرقم سعودي رسمي من فريق التأكيد، يتصل فقط لتأكيد العنوان وموعد التوصيل. المكالمة أقل من دقيقة ولا تطلب أي بيانات بنكية.",
        },
        {
          q: "هل أحصل على فاتورة ضريبية؟",
          a: "نعم، تستلم الفاتورة الضريبية المعتمدة مع الطرد، وتقدر تطلب نسخة PDF من فريق الدعم.",
        },
      ],
    },
    en: {
      eyebrow: "FAQ",
      title: "Everything you need to know.",
      intro:
        "We've gathered the most common questions about ordering, delivery, payment, and returns. Didn't find yours? Message us on WhatsApp and we'll answer right away.",
      updated: "Last updated: May 2026",
      faqs: [
        {
          q: "How do I order? Do I pay in advance?",
          a: "Pick your product, enter your name, mobile number, and city, then confirm. You pay nothing in advance — cash on delivery only.",
        },
        {
          q: "How long does delivery take?",
          a: "Within 48 hours for Riyadh and Jeddah, and 3 to 4 days for other Saudi cities, with a live tracking link.",
        },
        {
          q: "Is shipping free?",
          a: "Yes, shipping is free across all Saudi cities. You pay nothing on top of the product price.",
        },
        {
          q: "Can I return a product?",
          a: "Absolutely. You can return a product within 14 days of receiving it, no questions asked. Contact us on WhatsApp with your order number.",
        },
        {
          q: "Why is an unknown Saudi number calling me?",
          a: "It's an official Saudi number from our confirmation team, calling only to confirm your address and delivery time. The call is under a minute and asks for no banking details.",
        },
        {
          q: "Do I get a tax invoice?",
          a: "Yes, you receive the certified tax invoice with your parcel, and you can request a PDF copy from support.",
        },
      ],
    },
  },
};
