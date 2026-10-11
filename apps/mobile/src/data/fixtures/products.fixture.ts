import type { Category, Product } from "../catalogRepository";

// Guard 1: Verify __DEV__ or environment to prevent accidental production leakage
if (process.env.NODE_ENV === "production" && !__DEV__) {
  throw new Error("Development fixtures must never be loaded in a production build.");
}

export const FIXTURE_CATEGORIES: readonly Category[] = [
  {
    slug: "fresh-produce",
    name: "Fresh Produce",
    nameAr: "خضار وفواكه طازجة",
    iconName: "leaf",
    itemCount: 42,
    imageUrl:
      "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=400&q=80",
  },
  {
    slug: "dairy-eggs",
    name: "Dairy & Eggs",
    nameAr: "ألبان وبيض",
    iconName: "cup",
    itemCount: 28,
    imageUrl:
      "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80",
  },
  {
    slug: "bakery-deli",
    name: "Bakery & Artisan",
    nameAr: "مخبوزات طازجة",
    iconName: "bread-slice",
    itemCount: 19,
    imageUrl:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80",
  },
  {
    slug: "pantry-oils",
    name: "Pantry & Oils",
    nameAr: "مؤونة وزيوت طبيعية",
    iconName: "bottle-tonic",
    itemCount: 35,
    imageUrl:
      "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80",
  },
  {
    slug: "beverages",
    name: "Pure Beverages",
    nameAr: "مشروبات وعصائر",
    iconName: "glass-cocktail",
    itemCount: 24,
    imageUrl:
      "https://images.unsplash.com/photo-1622484216805-4c070c797fb1?auto=format&fit=crop&w=400&q=80",
  },
  {
    slug: "organic-local",
    name: "Organic & Farm",
    nameAr: "منتجات عضوية ومحلية",
    iconName: "sprout",
    itemCount: 16,
    imageUrl:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80",
  },
];

export const FIXTURE_PRODUCTS: readonly Product[] = [
  {
    id: "prod-1",
    slug: "organic-avocado-hass",
    name: "Organic Hass Avocados",
    nameAr: "أفوكادو هاس عضوي فاخر",
    description:
      "Creamy, perfectly ripened organic Hass avocados rich in healthy fats and heart-friendly vitamins. Hand-selected from local sustainable farms.",
    descriptionAr:
      "أفوكادو هاس عضوي ناضج بعناية وغني بالدهون الصحية والفيتامينات المفيدة. قطف يدوي من مزارع محلية مستدامة.",
    categorySlug: "fresh-produce",
    priceMinor: 4850, // 48.50 EGP
    compareAtPriceMinor: 6500, // 65.00 EGP
    discountPercent: 25,
    unit: "500g (approx. 2 pcs)",
    unitAr: "٥٠٠ جم (حوالي حبتين)",
    stockQuantity: 18,
    inStock: true,
    isOrganic: true,
    isDeal: true,
    origin: "Ismailia Organic Farms",
    originAr: "مزارع الإسماعيلية العضوية",
    images: [
      "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1601039641847-7857b994d704?auto=format&fit=crop&w=800&q=80",
    ],
    variants: [
      {
        id: "v1-1",
        name: "500g Pack",
        nameAr: "عبوة ٥٠٠ جم",
        priceMinor: 4850,
        sku: "AVO-500G",
        inStock: true,
      },
      {
        id: "v1-2",
        name: "1 kg Value Box",
        nameAr: "صندوق ١ كجم توفيري",
        priceMinor: 8900,
        sku: "AVO-1KG",
        inStock: true,
      },
    ],
  },
  {
    id: "prod-2",
    slug: "local-cherry-tomatoes",
    name: "Sweet Local Cherry Tomatoes",
    nameAr: "طماطم كرزية محلية حلوة",
    description:
      "Naturally sweet, vine-ripened ruby cherry tomatoes bursting with fresh summer flavour. Perfect for salads and roasting.",
    descriptionAr:
      "طماطم كرزية ناضجة على أغصانها بنكهة طبيعية حلوة وغنية. مثالية للسلطات والأطباق المشوية.",
    categorySlug: "fresh-produce",
    priceMinor: 2400, // 24.00 EGP
    compareAtPriceMinor: 3000,
    discountPercent: 20,
    unit: "250g punnet",
    unitAr: "عبوة ٢٥٠ جم",
    stockQuantity: 32,
    inStock: true,
    isOrganic: false,
    isDeal: true,
    origin: "Salheya Valley",
    originAr: "وادي الصالحية",
    images: [
      "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    id: "prod-3",
    slug: "farmhouse-whole-milk",
    name: "Artisan Whole Milk (Pasteurized)",
    nameAr: "حليب بقري كامل الدسم مبستر",
    description:
      "Pure whole farm milk with natural cream on top. Gently pasteurized to preserve authentic dairy flavours and calcium richness.",
    descriptionAr:
      "حليب بقري طبيعي كامل الدسم مع طبقة قشطة طبيعية. مبستر بلطف للحفاظ على الطعم الأصيل وغناه بالكالسيوم.",
    categorySlug: "dairy-eggs",
    priceMinor: 3800, // 38.00 EGP
    unit: "1 Litre Glass Bottle",
    unitAr: "زجاجة ١ لتر",
    stockQuantity: 14,
    inStock: true,
    isOrganic: true,
    isDeal: false,
    origin: "Fayoum Dairy Cooperative",
    originAr: "تعاونية الفيوم للألبان",
    images: [
      "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    id: "prod-4",
    slug: "free-range-brown-eggs",
    name: "Farm Fresh Free-Range Eggs",
    nameAr: "بيض مزارع حر طازج",
    description:
      "Golden-yolked brown eggs laid by pasture-raised hens fed on 100% vegetarian grains. Unbleached and naturally nutritious.",
    descriptionAr:
      "بيض بني ذو صفار ذهبي من دجاج مزارع حرة يتغذى على حبوب نباتية ١٠٠٪. طبيعي ومغذي.",
    categorySlug: "dairy-eggs",
    priceMinor: 8500, // 85.00 EGP
    compareAtPriceMinor: 9500,
    discountPercent: 11,
    unit: "Pack of 15 eggs",
    unitAr: "طبق ١٥ بيضة",
    stockQuantity: 4, // Low stock demo!
    inStock: true,
    isOrganic: true,
    isDeal: true,
    origin: "Delta Free-Range Poultry",
    originAr: "مزارع الدلتا الحرة",
    images: [
      "https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    id: "prod-5",
    slug: "sourdough-country-loaf",
    name: "Artisan Sourdough Country Loaf",
    nameAr: "خبز ريفي ساوردو مخمر طبيعياً",
    description:
      "Slow-fermented for 36 hours with wild yeast starter. Crispy blistered crust with an airy, tender crumb and gentle tang.",
    descriptionAr:
      "مخمر ببطء لمدة ٣٦ ساعة ببادئة خميرة برية. قشرة ذهبية مقرمشة ولباب هوائي خفيف بنكهة أصيلة.",
    categorySlug: "bakery-deli",
    priceMinor: 5200, // 52.00 EGP
    unit: "650g Loaf",
    unitAr: "رغيف ٦٥٠ جم",
    stockQuantity: 9,
    inStock: true,
    isOrganic: false,
    isDeal: false,
    origin: "Zamalek Artisan Bakery",
    originAr: "مخبز الزمالك الحرفي",
    images: [
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    id: "prod-6",
    slug: "extra-virgin-olive-oil-sinai",
    name: "Cold-Pressed Sinai Extra Virgin Olive Oil",
    nameAr: "زيت زيتون سيناوي بكر ممتاز معصور على البارد",
    description:
      "First cold press from hand-harvested Sinai desert olives. Acidity below 0.4%, rich in polyphenols with vibrant grassy and peppery notes.",
    descriptionAr:
      "عصرة أولى على البارد من زيتون صحراء سيناء المقطوف يدوياً. حموضة أقل من ٠٫٤٪ وغني بمضادات الأكسدة.",
    categorySlug: "pantry-oils",
    priceMinor: 21500, // 215.00 EGP
    compareAtPriceMinor: 26000,
    discountPercent: 17,
    unit: "750ml Dark Glass",
    unitAr: "زجاجة معتمة ٧٥٠ مل",
    stockQuantity: 20,
    inStock: true,
    isOrganic: true,
    isDeal: true,
    origin: "North Sinai Groves",
    originAr: "مزارع شمال سيناء",
    images: [
      "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    id: "prod-7",
    slug: "fresh-squeezed-orange-juice",
    name: "Cold Pressed Valencia Orange Juice",
    nameAr: "عصير برتقال فالنسيا طازج معصور على البارد",
    description:
      "100% pure raw orange juice with natural pulp. No added sugar, no concentrates, and never pasteurized. Bottled daily.",
    descriptionAr:
      "عصير برتقال طبيعي ١٠٠٪ مع لب البرتقال الطبيعي. بدون سكر مضاف أو مركزات. معصور يومياً.",
    categorySlug: "beverages",
    priceMinor: 3200, // 32.00 EGP
    unit: "500ml Bottle",
    unitAr: "زجاجة ٥٠٠ مل",
    stockQuantity: 15,
    inStock: true,
    isOrganic: false,
    isDeal: false,
    origin: "Nile Valley Orchards",
    originAr: "بساتين وادي النيل",
    images: [
      "https://images.unsplash.com/photo-1622484216805-4c070c797fb1?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    id: "prod-8",
    slug: "wildflower-raw-honey",
    name: "Pure Egyptian Wildflower Honey",
    nameAr: "عسل نحل جبلي نقي زهور برية",
    description:
      "Unfiltered, unheated raw honey harvested from Egyptian blooming clover and wildflowers. Natural enzyme rich with crystalline goodness.",
    descriptionAr:
      "عسل خام نقي غير مفلتر وغير معالج بالحرارة من زهور البرسيم والزهور البرية المصرية. غني بالإنزيمات الطبيعية.",
    categorySlug: "organic-local",
    priceMinor: 11000, // 110.00 EGP
    unit: "450g Jar",
    unitAr: "برطمان ٤٥٠ جم",
    stockQuantity: 0, // Out of stock demo!
    inStock: false,
    isOrganic: true,
    isDeal: false,
    origin: "Beheira Apiaries",
    originAr: "مناحل البحيرة",
    images: [
      "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=80",
    ],
  },
];
