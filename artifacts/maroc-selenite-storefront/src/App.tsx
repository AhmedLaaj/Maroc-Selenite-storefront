import { createContext, useContext, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import { ArrowLeft, ArrowRight, ArrowUpRight, Menu, Minus, Plus, Search, ShoppingBag, X } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import '@/index.css';

type Locale = 'fr' | 'en' | 'ar';
type Product = { id: string; slug: string; category: string; price: number; image: string; tone: string; title: Record<Locale,string>; subtitle: Record<Locale,string>; description: Record<Locale,string> };
type CartItem = { id: string; quantity: number };
type StoreContextValue = { locale: Locale; setLocale: (locale: Locale) => void; cart: CartItem[]; add: (id:string, quantity?:number) => void; change: (id:string, delta:number) => void; remove: (id:string) => void; t: (key:string) => string };
const StoreContext = createContext<StoreContextValue | null>(null);
const localeLabels: Record<Locale,string> = { fr:'FR', en:'EN', ar:'عربي' };
const copy: Record<Locale,Record<string,string>> = {
  fr: {
    notice:'Aperçu de la boutique — contenus, visuels et prix présentés à titre illustratif. Aucun stock ni offre réelle n’est confirmé.', info:'Informations', heroKicker:'MARRAKECH · OBJETS & MATIÈRES', tileMaterial:'MATIÈRES', tileHome:'MAISON', tileTexture:'SCULPTURES', visualStudy:'ÉTUDE VISUELLE',
    home:'Accueil', collections:'Collections', story:'Notre histoire', contact:'Contact', search:'Recherche', cart:'Panier', all:'Tout voir', explore:'Explorer la collection', discover:'Découvrir les pièces', edit:'La matière, en toute simplicité', intro:'Objets de maison et minéraux choisis pour leur présence, leur texture et leur calme.', collectionsKicker:'La collection', collectionTitle:'Des formes qui laissent respirer.', collectionDesc:'Une sélection illustrative à parcourir. Chaque objet présenté ici est un aperçu, et non une confirmation de disponibilité.', pieces:'Pièces en aperçu', sort:'Trier', sortFeatured:'Sélection', sortLow:'Prix croissant', sortHigh:'Prix décroissant', sortAZ:'Nom A–Z', category:'Catégorie', allCategories:'Toutes les catégories', mineral:'Minéraux', homeObjects:'Objets de maison', textile:'Sculptures', add:'Ajouter au panier aperçu', preview:'Aperçu uniquement', sample:'Prix indicatif', productNote:'Cette fiche est une présentation de démonstration. La disponibilité, la provenance, les dimensions et les caractéristiques sont à confirmer par la boutique.', cartTitle:'Votre panier aperçu', cartEmpty:'Votre panier est encore vide.', cartEmptyHint:'Parcourez les pièces en aperçu pour commencer.', continue:'Continuer la découverte', qty:'Quantité', remove:'Retirer', subtotal:'Sous-total indicatif', shipping:'Livraison', notCalculated:'Non disponible dans cet aperçu', checkout:'Continuer', checkoutNotice:'Les commandes en ligne et le paiement ne sont pas activés. Aucun achat ne sera créé depuis cet aperçu.', searchTitle:'Chercher une pièce', searchPlaceholder:'Minéraux, objets, matières…', searchResults:'résultats en aperçu', noResults:'Aucune pièce ne correspond à cette recherche.', searchTip:'Essayez « sélénite », « maison » ou « sculpture ».', ourStory:'Une maison de curiosités', storyLead:'Maroc Sélénite imagine une maison ouverte aux matières, aux gestes et aux objets qui invitent à ralentir.', storyText:'Née d’un regard tourné vers Marrakech, cette boutique en devenir rassemble des idées pour habiter les espaces avec plus de douceur. Les pièces présentées sur ce site sont des visuels de démonstration : elles ne décrivent pas une collection confirmée.', storySub:'Un projet en préparation', storyDetail:'Notre sélection, nos informations de provenance et nos services seront précisés par la boutique avant toute mise en vente. Cette expérience donne à voir une direction créative, pas une offre commerciale.', visit:'Écrire à la boutique', contactTitle:'Parlons ensemble', contactLead:'Pour une demande, une question ou une collaboration, les coordonnées officielles seront ajoutées ici par la boutique.', contactPlaceholder:'Coordonnées à renseigner par le propriétaire de la boutique.', name:'Nom', email:'E-mail', message:'Message', send:'Prévisualiser le message', formNoSend:'Aucun message n’a été envoyé. Les formulaires de contact ne sont pas encore connectés.', faqTitle:'Questions fréquentes', faqLead:'Les informations opérationnelles seront publiées par la boutique dès qu’elles seront confirmées.', shippingTitle:'Livraison & retours', privacyTitle:'Confidentialité', termsTitle:'Conditions d’utilisation', wholesaleTitle:'Pour les professionnels', wholesaleLead:'Vous êtes architecte, décorateur ou concept-store ? L’espace professionnel est en préparation.', placeholderTitle:'Informations à confirmer', placeholderCopy:'Cette rubrique est en préparation. Les informations et conditions réelles seront renseignées par le propriétaire de la boutique. Aucun engagement de livraison, de paiement, de retour ou de service n’est communiqué dans cet aperçu.', newsletter:'Des nouvelles, à votre rythme.', newsletterText:'La lettre de la boutique sera bientôt disponible.', subscribe:'S’inscrire', emailPlaceholder:'Votre adresse e-mail', footerLine:'Objets et matières, depuis Marrakech.', footerLegal:'Aperçu de démonstration — aucune vente en ligne.', language:'Langue', empty:'Rien à afficher pour le moment.', sortLabel:'Ordre d’affichage', homeMinerals:'Minéraux & matières', homeObjectsTitle:'Objets de maison', homeTextiles:'Formes sculptées', homeEditorial:'Une invitation à regarder autrement', homeEditorialText:'Textures naturelles, lignes sobres, lumière changeante. Une proposition éditoriale autour de la maison et des matières — conçue comme un premier regard.', noticeTiny:'Visuels générés à titre illustratif. Les pièces ne représentent pas un stock réel.', categorySelenite:'Sélénite', categoryVessels:'Vases & coupes', categoryObjects:'Objets décoratifs', categoryTextiles:'Sculptures', demoPrice:'Prix de démonstration', clickSearch:'Lancer la recherche'
  },
  en: {
    notice:'Store preview — content, imagery and prices are illustrative. No stock or real offer is confirmed.', info:'Information', heroKicker:'MARRAKECH · OBJECTS & MATERIALS', tileMaterial:'MATERIALS', tileHome:'HOME', tileTexture:'SCULPTURE', visualStudy:'VISUAL STUDY',
    home:'Home', collections:'Collections', story:'Our story', contact:'Contact', search:'Search', cart:'Bag', all:'View all', explore:'Explore the collection', discover:'Discover the pieces', edit:'Material, considered simply', intro:'Home objects and minerals selected for their presence, texture and quiet.', collectionsKicker:'The collection', collectionTitle:'Forms that leave room to breathe.', collectionDesc:'An illustrative selection to explore. Every object shown here is a preview, not a confirmation of availability.', pieces:'Preview pieces', sort:'Sort', sortFeatured:'Featured', sortLow:'Price: low to high', sortHigh:'Price: high to low', sortAZ:'Name A–Z', category:'Category', allCategories:'All categories', mineral:'Minerals', homeObjects:'Home objects', textile:'Sculptures', add:'Add to preview bag', preview:'Preview only', sample:'Sample price', productNote:'This product page is for demonstration. Availability, provenance, dimensions and attributes must be confirmed by the shop.', cartTitle:'Your preview bag', cartEmpty:'Your bag is still empty.', cartEmptyHint:'Explore the preview pieces to begin.', continue:'Continue exploring', qty:'Quantity', remove:'Remove', subtotal:'Indicative subtotal', shipping:'Shipping', notCalculated:'Not available in this preview', checkout:'Continue', checkoutNotice:'Online orders and payment are not enabled. No purchase will be created from this preview.', searchTitle:'Find a piece', searchPlaceholder:'Minerals, objects, materials…', searchResults:'preview results', noResults:'No pieces match this search.', searchTip:'Try “selenite”, “home” or “sculpture”.', ourStory:'A house of curiosities', storyLead:'Maroc Sélénite imagines a home open to materials, gestures and objects that invite a slower pace.', storyText:'With a gaze turned toward Marrakech, this future boutique brings together ideas for living with a little more softness. The pieces shown on this site are demonstration visuals: they do not describe a confirmed collection.', storySub:'A project in the making', storyDetail:'Our selection, provenance information and services will be specified by the shop before anything is offered for sale. This experience shares a creative direction, not a commercial offer.', visit:'Write to the shop', contactTitle:'Let’s talk', contactLead:'For an enquiry, a question or a collaboration, official contact details will be added here by the shop.', contactPlaceholder:'Contact details to be supplied by the shop owner.', name:'Name', email:'Email', message:'Message', send:'Preview message', formNoSend:'No message was sent. Contact forms are not connected yet.', faqTitle:'Frequently asked questions', faqLead:'Operational information will be published by the shop once confirmed.', shippingTitle:'Shipping & returns', privacyTitle:'Privacy', termsTitle:'Terms of use', wholesaleTitle:'For professionals', wholesaleLead:'Are you an architect, interior designer or concept store? Our trade area is in preparation.', placeholderTitle:'Details to be confirmed', placeholderCopy:'This section is being prepared. Real information and terms will be supplied by the shop owner. No shipping, payment, returns or service commitments are stated in this preview.', newsletter:'Notes from the shop, in time.', newsletterText:'The shop letter will be available soon.', subscribe:'Sign up', emailPlaceholder:'Your email address', footerLine:'Objects and materials, from Marrakech.', footerLegal:'Demonstration preview — online sales are not available.', language:'Language', empty:'Nothing to show just yet.', sortLabel:'Display order', homeMinerals:'Minerals & materials', homeObjectsTitle:'Objects for home', homeTextiles:'Sculptural forms', homeEditorial:'An invitation to look again', homeEditorialText:'Natural textures, unhurried lines, shifting light. An editorial thought about home and material — offered as a first glimpse.', noticeTiny:'Images are generated illustrations. The pieces do not represent real stock.', categorySelenite:'Selenite', categoryVessels:'Vessels & bowls', categoryObjects:'Decorative objects', categoryTextiles:'Sculptures', demoPrice:'Demonstration price', clickSearch:'Search'
  },
  ar: {
    notice:'معاينة المتجر — المحتوى والصور والأسعار توضيحية. لا يوجد مخزون أو عرض حقيقي مؤكد.', info:'معلومات', heroKicker:'مراكش · أغراض ومواد', tileMaterial:'مواد', tileHome:'المنزل', tileTexture:'منحوتات', visualStudy:'دراسة بصرية',
    home:'الرئيسية', collections:'المجموعات', story:'قصتنا', contact:'اتصل بنا', search:'بحث', cart:'الحقيبة', all:'عرض الكل', explore:'استكشف المجموعة', discover:'اكتشف القطع', edit:'المادة ببساطة مدروسة', intro:'قطع منزلية ومعادن مختارة لحضورها وملمسها وهدوئها.', collectionsKicker:'المجموعة', collectionTitle:'أشكال تترك مجالاً للتنفس.', collectionDesc:'مجموعة توضيحية للاستكشاف. كل قطعة معروضة هنا معاينة وليست تأكيداً للتوفر.', pieces:'قطع للمعاينة', sort:'ترتيب', sortFeatured:'مختارة', sortLow:'السعر: من الأقل', sortHigh:'السعر: من الأعلى', sortAZ:'الاسم أ–ي', category:'الفئة', allCategories:'كل الفئات', mineral:'معادن', homeObjects:'أغراض منزلية', textile:'منحوتات', add:'أضف إلى حقيبة المعاينة', preview:'للمعاينة فقط', sample:'سعر افتراضي', productNote:'صفحة المنتج هذه للعرض التوضيحي. يجب تأكيد التوفر والمنشأ والأبعاد والخصائص من المتجر.', cartTitle:'حقيبة المعاينة', cartEmpty:'حقيبتك فارغة حالياً.', cartEmptyHint:'استكشف القطع المعروضة للبدء.', continue:'تابع الاستكشاف', qty:'الكمية', remove:'إزالة', subtotal:'المجموع التقريبي', shipping:'الشحن', notCalculated:'غير متاح في هذه المعاينة', checkout:'متابعة', checkoutNotice:'الطلبات والدفع عبر الإنترنت غير مفعّلين. لن يتم إنشاء أي عملية شراء من هذه المعاينة.', searchTitle:'ابحث عن قطعة', searchPlaceholder:'معادن، أغراض، مواد…', searchResults:'نتائج للمعاينة', noResults:'لا توجد قطع تطابق هذا البحث.', searchTip:'جرّب «سيلينيت» أو «منزل» أو «منحوتات».', ourStory:'دار من الفضول', storyLead:'يتخيل ماروك سيلينيت منزلاً منفتحاً على المواد واللمسات والأغراض التي تدعو إلى التمهل.', storyText:'من منظور يتجه نحو مراكش، يجمع هذا المتجر المرتقب أفكاراً للسكن بمزيد من الهدوء. القطع المعروضة هنا صور توضيحية ولا تصف مجموعة مؤكدة.', storySub:'مشروع قيد التحضير', storyDetail:'سيحدد المتجر اختياراته ومعلومات المنشأ والخدمات قبل عرض أي شيء للبيع. تقدم هذه التجربة اتجاهاً إبداعياً لا عرضاً تجارياً.', visit:'راسل المتجر', contactTitle:'لنتحدث', contactLead:'ستُضاف بيانات التواصل الرسمية هنا من قبل المتجر للاستفسارات والأسئلة والتعاون.', contactPlaceholder:'بيانات التواصل يضيفها مالك المتجر.', name:'الاسم', email:'البريد الإلكتروني', message:'الرسالة', send:'معاينة الرسالة', formNoSend:'لم تُرسل أي رسالة. نموذج التواصل غير متصل حالياً.', faqTitle:'الأسئلة الشائعة', faqLead:'سينشر المتجر المعلومات التشغيلية بعد تأكيدها.', shippingTitle:'الشحن والإرجاع', privacyTitle:'الخصوصية', termsTitle:'شروط الاستخدام', wholesaleTitle:'للمهنيين', wholesaleLead:'هل أنت مهندس معماري أو مصمم داخلي أو متجر متخصص؟ قسم المهنيين قيد الإعداد.', placeholderTitle:'معلومات بانتظار التأكيد', placeholderCopy:'يجري إعداد هذا القسم. سيضيف مالك المتجر المعلومات والشروط الحقيقية. لا تتضمن هذه المعاينة وعوداً بالشحن أو الدفع أو الإرجاع أو الخدمة.', newsletter:'ملاحظات من المتجر، حين يحين وقتها.', newsletterText:'ستتوفر رسالة المتجر قريباً.', subscribe:'التسجيل', emailPlaceholder:'بريدك الإلكتروني', footerLine:'أغراض ومواد من مراكش.', footerLegal:'معاينة توضيحية — البيع عبر الإنترنت غير متاح.', language:'اللغة', empty:'لا شيء للعرض حالياً.', sortLabel:'طريقة العرض', homeMinerals:'معادن ومواد', homeObjectsTitle:'أغراض للمنزل', homeTextiles:'أشكال منحوتة', homeEditorial:'دعوة إلى النظر من جديد', homeEditorialText:'ملامس طبيعية وخطوط هادئة وضوء متغير. تصور تحريري للمنزل والمواد — لمحة أولى فحسب.', noticeTiny:'صور مولّدة لأغراض توضيحية. القطع لا تمثل مخزوناً حقيقياً.', categorySelenite:'سيلينيت', categoryVessels:'أوانٍ وأوعية', categoryObjects:'أغراض للزينة', categoryTextiles:'منحوتات', demoPrice:'سعر توضيحي', clickSearch:'بحث'
  }
};

const products: Product[] = [
  { id:'sel-bowl', slug:'coupe-selenite', category:'selenite', price:680, image:'/selenite-bowl.png', tone:'mineral', title:{fr:'Coupe sélénite',en:'Selenite bowl',ar:'وعاء سيلينيت'}, subtitle:{fr:'Minéral · pièce de démonstration',en:'Mineral · demonstration piece',ar:'معدن · قطعة توضيحية'}, description:{fr:'Une forme douce imaginée autour de la translucidité et des strates minérales.',en:'A quiet form imagined around translucency and mineral striations.',ar:'شكل هادئ مستوحى من الشفافية والطبقات المعدنية.'} },
  { id:'sel-tower', slug:'forme-minerale', category:'selenite', price:420, image:'/atelier-hero.png', tone:'sand', title:{fr:'Forme minérale',en:'Mineral form',ar:'تشكيل معدني'}, subtitle:{fr:'Minéral · étude visuelle',en:'Mineral · visual study',ar:'معدن · دراسة بصرية'}, description:{fr:'Une silhouette sculpturale qui capte la lumière, présentée comme une étude de matière.',en:'A sculptural silhouette that catches the light, shown as a material study.',ar:'هيئة نحتية تلتقط الضوء، معروضة كدراسة للمواد.'} },
  { id:'vase-argile', slug:'vase-argile', category:'vessels', price:560, image:'/atelier-hero.png', tone:'clay', title:{fr:'Vase aux lignes libres',en:'Vase, free lines',ar:'مزهرية بخطوط حرة'}, subtitle:{fr:'Objet de maison · illustration',en:'Home object · illustration',ar:'غرض منزلي · رسم توضيحي'}, description:{fr:'Un volume aux contours simples, imaginé dans une palette pierre et ivoire.',en:'A simple outlined volume, imagined in a palette of stone and ivory.',ar:'حجم بخطوط بسيطة، متخيّل بألوان الحجر والعاج.'} },
  { id:'bol-ivoire', slug:'bol-ivoire', category:'vessels', price:390, image:'/selenite-bowl.png', tone:'ivory', title:{fr:'Bol ivoire',en:'Ivory bowl',ar:'وعاء عاجي'}, subtitle:{fr:'Objet de maison · aperçu',en:'Home object · preview',ar:'غرض منزلي · معاينة'}, description:{fr:'Un objet de table aux courbes épurées, proposé ici comme aperçu éditorial.',en:'A tabletop object with pared-back curves, offered here as an editorial preview.',ar:'غرض للطاولة بمنحنيات هادئة، معروض كمعاينة تحريرية.'} },
  { id:'objet-ligne', slug:'objet-ligne', category:'objects', price:310, image:'/atelier-hero.png', tone:'stone', title:{fr:'Objet ligne',en:'Line object',ar:'قطعة خطية'}, subtitle:{fr:'Objet décoratif · visuel généré',en:'Decorative object · generated visual',ar:'غرض زخرفي · صورة مولّدة'}, description:{fr:'Une composition abstraite autour de la ligne, du rythme et de la lumière.',en:'An abstract composition around line, rhythm and light.',ar:'تكوين تجريدي حول الخط والإيقاع والضوء.'} },
  { id:'sculpture-stele', slug:'stele-minerale', category:'sculptures', price:450, image:'/atelier-hero.png', tone:'navy', title:{fr:'Stèle minérale',en:'Mineral stele',ar:'مسلة معدنية'}, subtitle:{fr:'Sculpture · étude visuelle',en:'Sculpture · visual study',ar:'منحوتة · دراسة بصرية'}, description:{fr:'Une étude imaginaire de hauteur, de ligne et de lumière, présentée uniquement comme aperçu.',en:'An imagined study in height, line and light, shown only as a preview.',ar:'دراسة تخيلية للارتفاع والخط والضوء، معروضة للمعاينة فقط.'} },
];
const fmt = (n:number, locale:Locale) => new Intl.NumberFormat(locale === 'ar' ? 'fr-FR' : locale === 'fr' ? 'fr-FR' : 'en-GB', { style:'currency', currency:'MAD', maximumFractionDigits:0 }).format(n);
const useStore = () => { const value = useContext(StoreContext); if (!value) throw new Error('Store context missing'); return value; };
const copyProduct = (product:Product, locale:Locale) => product.title[locale];

function Header() {
  const { locale, setLocale, cart, t } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const lang = (event: ChangeEvent<HTMLSelectElement>) => setLocale(event.target.value as Locale);
  const navigateSearch = () => setLocation('/search');
  return <>
    <div className="announcement" data-testid="text-demo-notice">{t('notice')}</div>
    <header className="header">
      <div className="header-inner">
        <button className="icon-button mobile-menu" aria-label={locale==='fr'?'Ouvrir le menu':locale==='ar'?'فتح القائمة':'Open menu'} data-testid="button-menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={19}/> : <Menu size={20}/>}</button>
        <Link href="/" className="brand" data-testid="link-brand"><span className="brand-main">MAROC SÉLÉNITE</span><span className="brand-sub">MAISON · MATIÈRE · MARRAKECH</span></Link>
        <nav className="nav-links" aria-label="Primary navigation">
          <Link href="/collections/maison">{t('collections')}</Link><Link href="/our-story">{t('story')}</Link><Link href="/contact">{t('contact')}</Link>
        </nav>
        <div className="header-tools">
          <button className="icon-button utility-search" aria-label={t('search')} data-testid="button-open-search" onClick={navigateSearch}><Search size={18}/></button>
          <label className="sr-only" htmlFor="language-select">{t('language')}</label>
          <select id="language-select" value={locale} onChange={lang} className="lang-select" aria-label={t('language')} data-testid="select-language">
            <option value="fr">FR</option><option value="en">EN</option><option value="ar">عربي</option>
          </select>
          <Link href="/cart" className="icon-button" aria-label={t('cart')} data-testid="link-cart"><ShoppingBag size={18}/>{cart.reduce((n,item)=>n+item.quantity,0)>0 && <span className="cart-count" data-testid="text-cart-count">{cart.reduce((n,item)=>n+item.quantity,0)}</span>}</Link>
        </div>
      </div>
      {menuOpen && <nav className="mobile-nav">
        <Link href="/collections/maison" onClick={()=>setMenuOpen(false)}>{t('collections')}</Link>
        <Link href="/our-story" onClick={()=>setMenuOpen(false)}>{t('story')}</Link>
        <Link href="/contact" onClick={()=>setMenuOpen(false)}>{t('contact')}</Link>
        <Link href="/search" onClick={()=>setMenuOpen(false)}>{t('search')}</Link>
      </nav>}
    </header>
    <div className="notice-strip"><strong>{t('preview')}:</strong> {t('noticeTiny')}</div>
  </>;
}

function Footer() {
  const { t } = useStore();
  return <footer className="footer">
    <div className="footer-grid">
      <div className="footer-brand"><Link href="/" className="brand"><span className="brand-main">MAROC SÉLÉNITE</span><span className="brand-sub">MAISON · MATIÈRE · MARRAKECH</span></Link><p>{t('footerLine')}</p></div>
      <div className="footer-column"><h4>{t('collections')}</h4><Link href="/collections/selenite">{t('mineral')}</Link><Link href="/collections/maison">{t('homeObjects')}</Link><Link href="/collections/sculptures">{t('textile')}</Link></div>
      <div className="footer-column"><h4>{t('story')}</h4><Link href="/our-story">{t('story')}</Link><Link href="/wholesale">{t('wholesaleTitle')}</Link><Link href="/contact">{t('contact')}</Link></div>
      <div className="footer-column"><h4>{t('info')}</h4><Link href="/faq">{t('faqTitle')}</Link><Link href="/shipping-returns">{t('shippingTitle')}</Link><Link href="/privacy">{t('privacyTitle')}</Link><Link href="/terms">{t('termsTitle')}</Link></div>
    </div>
    <div className="footer-bottom"><span>© MAROC SÉLÉNITE</span><span>{t('footerLegal')}</span></div>
  </footer>;
}

function ProductCard({ product }: { product:Product }) {
  const { locale, t } = useStore();
  return <Link href={`/products/${product.slug}`} className="product-card" data-testid={`card-product-${product.id}`}>
    <div className={`product-image tone-${product.tone}`}><img src={product.image} alt={copyProduct(product,locale)} loading="lazy"/><span className="preview-tag">{t('preview')}</span></div>
    <div className="product-meta"><div><h3>{copyProduct(product,locale)}</h3><p>{product.subtitle[locale]}</p></div><span className="price">{fmt(product.price,locale)}</span></div>
  </Link>;
}

function ProductGrid({ items }: { items:Product[] }) {
  const { t } = useStore();
  if (!items.length) return <div className="notice-box" data-testid="text-empty-results">{t('empty')}</div>;
  return <div className="products-grid">{items.map(product=><ProductCard key={product.id} product={product}/>)}</div>;
}

function Home() {
  const { t, locale } = useStore();
  const heroTitle = locale === 'ar' ? <>البيت،<br/><em>على مهل.</em></> : locale === 'fr' ? <>La maison,<br/><em>à son rythme.</em></> : <>A home,<br/><em>at its own pace.</em></>;
  return <main>
    <section className="hero">
      <div className="hero-copy fade-up"><div className="eyebrow">{t('heroKicker')}</div><h1>{heroTitle}</h1><p>{t('intro')}</p><Link href="/collections/maison" className="button-primary" data-testid="link-explore">{t('explore')} <ArrowUpRight size={14}/></Link></div>
      <div className="hero-visual fade-up delay-1"><img src="/atelier-hero.png" alt={t('noticeTiny')}/><span className="visual-label">{t('visualStudy')} · 01 / 06</span></div>
    </section>
    <div className="page-wrap">
      <section className="section">
        <div className="section-heading"><div><div className="eyebrow">{t('collectionsKicker')}</div><h2>{t('edit')}</h2></div><p>{t('collectionDesc')}</p></div>
        <div className="collection-tiles">
          <Link href="/collections/selenite" className="collection-tile"><img src="/selenite-bowl.png" alt=""/><div className="tile-copy"><small>01 / {t('tileMaterial')}</small><h3>{t('homeMinerals')}</h3></div></Link>
          <Link href="/collections/maison" className="collection-tile"><img src="/atelier-hero.png" alt=""/><div className="tile-copy"><small>02 / {t('tileHome')}</small><h3>{t('homeObjectsTitle')}</h3></div></Link>
          <Link href="/collections/sculptures" className="collection-tile"><img src="/atelier-hero.png" alt=""/><div className="tile-copy"><small>03 / {t('tileTexture')}</small><h3>{t('homeTextiles')}</h3></div></Link>
        </div>
      </section>
      <section className="section">
        <div className="section-heading"><div><div className="eyebrow">{t('preview')} · 06</div><h2>{t('pieces')}</h2></div><Link href="/collections/maison" className="utility-link">{t('all')} <ArrowRight size={13}/></Link></div>
        <ProductGrid items={products.slice(0,4)}/>
      </section>
      <section className="editorial-band">
        <div className="editorial-image"><img src="/atelier-hero.png" alt={t('homeEditorial')}/></div>
        <div className="editorial-copy"><div className="eyebrow">MAROC SÉLÉNITE · NOTE 01</div><h2>{t('homeEditorial')}</h2><p>{t('homeEditorialText')}</p><Link href="/our-story" className="button-outline">{t('story')} <ArrowUpRight size={14}/></Link></div>
      </section>
    </div>
    <Newsletter/>
  </main>;
}

function Newsletter() {
  const { t } = useStore();
  const [submitted,setSubmitted] = useState(false);
  const submit = (event:FormEvent<HTMLFormElement>) => { event.preventDefault(); setSubmitted(true); };
  return <section className="newsletter"><div><h2>{t('newsletter')}</h2><p>{t('newsletterText')}</p></div>{submitted ? <p className="success-message">{t('formNoSend')}</p> : <form onSubmit={submit}><input type="email" placeholder={t('emailPlaceholder')} aria-label={t('email')} required data-testid="input-newsletter-email"/><button data-testid="button-newsletter">{t('subscribe')} <ArrowRight size={13}/></button></form>}</section>;
}

function Collection() {
  const params = useParams<{slug:string}>();
  const { t } = useStore();
  const [category,setCategory] = useState(params.slug === 'selenite' ? 'selenite' : params.slug === 'sculptures' ? 'sculptures' : params.slug === 'vessels' ? 'vessels' : 'all');
  const [sort,setSort] = useState('featured');
  useEffect(()=>setCategory(params.slug === 'selenite' ? 'selenite' : params.slug === 'sculptures' ? 'sculptures' : params.slug === 'vessels' ? 'vessels' : 'all'),[params.slug]);
  const filtered = useMemo(()=>{
    let result = category==='all' ? [...products] : products.filter(product=>product.category===category);
    if(sort==='low') result.sort((a,b)=>a.price-b.price);
    if(sort==='high') result.sort((a,b)=>b.price-a.price);
    if(sort==='az') result.sort((a,b)=>a.title.en.localeCompare(b.title.en));
    return result;
  },[category,sort]);
  return <main className="page-wrap">
    <header className="page-header"><div className="eyebrow">{t('collectionsKicker')} / MAROC SÉLÉNITE</div><h1>{t('collectionTitle')}</h1><p>{t('collectionDesc')}</p></header>
    <div className="catalog-controls"><div className="category-chips" aria-label={t('category')}>
      {[['all',t('allCategories')],['selenite',t('categorySelenite')],['vessels',t('categoryVessels')],['objects',t('categoryObjects')],['sculptures',t('categoryTextiles')]].map(([id,label])=><button className={`chip ${category===id?'active':''}`} key={id} onClick={()=>setCategory(id)} data-testid={`button-filter-${id}`}>{label}</button>)}
    </div><label className="sort-label"><span className="sr-only">{t('sortLabel')}</span><select value={sort} onChange={e=>setSort(e.target.value)} className="sort-select" data-testid="select-sort"><option value="featured">{t('sortFeatured')}</option><option value="low">{t('sortLow')}</option><option value="high">{t('sortHigh')}</option><option value="az">{t('sortAZ')}</option></select></label></div>
    <p className="results-count" data-testid="text-product-count">{filtered.length} · {t('pieces')}</p><ProductGrid items={filtered}/>
  </main>;
}

function ProductDetail() {
  const { slug } = useParams<{slug:string}>();
  const { locale,t,add } = useStore();
  const product = products.find(item=>item.slug===slug);
  const [quantity,setQuantity] = useState(1);
  if(!product) return <NotFound/>;
  return <main className="page-wrap">
    <div className="detail-layout">
      <div className="detail-image"><img src={product.image} alt={copyProduct(product,locale)}/></div>
      <div className="detail-copy"><div className="eyebrow">{product.subtitle[locale]}</div><h1>{copyProduct(product,locale)}</h1><span className="price">{fmt(product.price,locale)} · {t('sample')}</span><p>{product.description[locale]}</p>
        <div className="detail-note">{t('productNote')}</div>
        <div className="detail-actions"><div className="quantity"><button aria-label={locale==='fr'?'Diminuer la quantité':locale==='ar'?'تقليل الكمية':'Decrease quantity'} onClick={()=>setQuantity(Math.max(1,quantity-1))} data-testid="button-quantity-minus"><Minus size={14}/></button><span data-testid="text-quantity">{quantity}</span><button aria-label={locale==='fr'?'Augmenter la quantité':locale==='ar'?'زيادة الكمية':'Increase quantity'} onClick={()=>setQuantity(quantity+1)} data-testid="button-quantity-plus"><Plus size={14}/></button></div><button className="button-primary" onClick={()=>add(product.id,quantity)} data-testid="button-add-cart">{t('add')} <ShoppingBag size={14}/></button></div>
        <Link href="/collections/maison" className="utility-link"><ArrowLeft size={13}/> {t('continue')}</Link>
      </div>
    </div>
    <section className="section"><div className="section-heading"><div><div className="eyebrow">{t('preview')}</div><h2>{t('discover')}</h2></div></div><ProductGrid items={products.filter(item=>item.id!==product.id).slice(0,4)}/></section>
  </main>;
}

function SearchPage() {
  const { t,locale } = useStore();
  const [location,setLocation] = useLocation();
  const query = new URLSearchParams(location.split('?')[1] || '').get('q') || '';
  const [value,setValue] = useState(query);
  useEffect(()=>setValue(query),[query]);
  const results = useMemo(()=>products.filter(product=>(product.title[locale]+' '+product.subtitle[locale]+' '+product.description[locale]).toLocaleLowerCase().includes(query.toLocaleLowerCase())),[query,locale]);
  const submit = (event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setLocation(`/search?q=${encodeURIComponent(value.trim())}`);};
  return <main className="page-wrap"><header className="page-header"><div className="eyebrow">{t('collections')}</div><h1>{t('searchTitle')}</h1><p>{t('searchTip')}</p></header>
    <form className="search-form" onSubmit={submit}><input value={value} onChange={e=>setValue(e.target.value)} autoFocus placeholder={t('searchPlaceholder')} aria-label={t('search')} data-testid="input-search"/><button aria-label={t('clickSearch')} data-testid="button-search"><Search size={20}/></button></form>
    {query ? <><p className="results-count">{results.length} {t('searchResults')} · “{query}”</p>{results.length ? <ProductGrid items={results}/> : <div className="notice-box" data-testid="text-no-results">{t('noResults')}</div>}</> : <p className="results-count">{t('searchTip')}</p>}
  </main>;
}

function Cart() {
  const { t,locale,cart,change,remove } = useStore();
  const entries = cart.map(item=>({item,product:products.find(product=>product.id===item.id)})).filter((entry):entry is {item:CartItem;product:Product}=>!!entry.product);
  const total = entries.reduce((sum,entry)=>sum+entry.product.price*entry.item.quantity,0);
  return <main className="page-wrap">
    <header className="page-header"><div className="eyebrow">{t('preview')}</div><h1>{t('cartTitle')}</h1></header>
    {!entries.length ? <div className="cart-empty"><ShoppingBag size={25} strokeWidth={1}/><h2>{t('cartEmpty')}</h2><p>{t('cartEmptyHint')}</p><Link href="/collections/maison" className="button-primary">{t('continue')} <ArrowRight size={14}/></Link></div> :
      <div className="cart-layout"><div>{entries.map(({item,product})=><article className="cart-row" key={item.id} data-testid={`row-cart-${item.id}`}><Link href={`/products/${product.slug}`}><img src={product.image} alt={product.title[locale]}/></Link><div><Link href={`/products/${product.slug}`} className="utility-link"><h3>{product.title[locale]}</h3></Link><p>{product.subtitle[locale]}</p><div className="quantity"><button aria-label={locale==='fr'?'Diminuer la quantité':locale==='ar'?'تقليل الكمية':'Decrease quantity'} onClick={()=>change(item.id,-1)} data-testid={`button-qty-minus-${item.id}`}><Minus size={12}/></button><span>{item.quantity}</span><button aria-label={locale==='fr'?'Augmenter la quantité':locale==='ar'?'زيادة الكمية':'Increase quantity'} onClick={()=>change(item.id,1)} data-testid={`button-qty-plus-${item.id}`}><Plus size={12}/></button></div><button className="cart-remove" onClick={()=>remove(item.id)} data-testid={`button-remove-${item.id}`}>{t('remove')}</button></div><span className="price">{fmt(product.price*item.quantity,locale)}</span></article>)}</div>
      <aside className="cart-summary"><h2>{t('cartTitle')}</h2><div className="summary-line"><span>{t('subtotal')}</span><span>{fmt(total,locale)}</span></div><div className="summary-line"><span>{t('shipping')}</span><span>{t('notCalculated')}</span></div><div className="summary-line total"><span>{t('demoPrice')}</span><span>{fmt(total,locale)}</span></div><div className="notice-box">{t('checkoutNotice')}</div><button className="button-primary" style={{width:'100%',marginTop:16}} disabled data-testid="button-checkout">{t('checkout')} <ArrowRight size={14}/></button></aside></div>}
  </main>;
}

function EditorialPage({ type }: { type:'story'|'shipping'|'privacy'|'terms'|'wholesale' }) {
  const { t } = useStore();
  const content:Record<typeof type,{title:string;lead:string;body:string;sub:string}> = {
    story:{title:t('ourStory'),lead:t('storyLead'),body:t('storyText'),sub:t('storySub')},
    shipping:{title:t('shippingTitle'),lead:t('placeholderTitle'),body:t('placeholderCopy'),sub:t('preview')},
    privacy:{title:t('privacyTitle'),lead:t('placeholderTitle'),body:t('placeholderCopy'),sub:t('preview')},
    terms:{title:t('termsTitle'),lead:t('placeholderTitle'),body:t('placeholderCopy'),sub:t('preview')},
    wholesale:{title:t('wholesaleTitle'),lead:t('wholesaleLead'),body:t('placeholderCopy'),sub:t('preview')}
  };
  const item=content[type];
  return <main className="content-page"><div className="eyebrow">MAROC SÉLÉNITE · {item.sub}</div><h1>{item.title}</h1><p className="lead">{item.lead}</p><div className="editorial-band" style={{margin:'35px 0'}}><div className="editorial-image"><img src="/atelier-hero.png" alt={t('noticeTiny')}/></div><div className="editorial-copy"><div className="eyebrow">{t('preview')}</div><p>{item.body}</p>{type==='story' && <p>{t('storyDetail')}</p>}{type==='story' && <Link href="/contact" className="button-outline">{t('visit')} <ArrowUpRight size={14}/></Link>}</div></div></main>;
}

function FAQ() {
  const {t,locale}=useStore();
  const [open,setOpen]=useState<number|null>(null);
  const questions:Record<Locale,[string,string][]> = {
    fr:[['Les pièces présentées sont-elles disponibles ?','Non. Les visuels et produits sont des exemples de présentation ; le stock réel n’est pas confirmé.'],['Puis-je commander en ligne ?','Les commandes et le paiement en ligne ne sont pas activés dans cet aperçu.'],['Quels sont les délais de livraison ?','Aucun délai n’est communiqué ici. Les informations seront ajoutées après confirmation par la boutique.'],['Comment contacter la boutique ?','Les coordonnées officielles seront renseignées par le propriétaire de la boutique sur la page Contact.']],
    en:[['Are the pieces shown available?','No. Products and imagery are presentation examples; real stock is not confirmed.'],['Can I order online?','Online orders and payment are not enabled in this preview.'],['What are the delivery times?','No delivery time is stated here. Information will be added once confirmed by the shop.'],['How can I contact the shop?','Official contact details will be supplied by the shop owner on the Contact page.']],
    ar:[['هل القطع المعروضة متاحة؟','لا. المنتجات والصور أمثلة للعرض، ولم يتم تأكيد المخزون الحقيقي.'],['هل يمكنني الطلب عبر الإنترنت؟','الطلبات والدفع عبر الإنترنت غير مفعّلين في هذه المعاينة.'],['ما مواعيد التوصيل؟','لا نذكر موعداً للتوصيل هنا. ستضاف المعلومات بعد تأكيدها من المتجر.'],['كيف أتواصل مع المتجر؟','سيضيف مالك المتجر بيانات التواصل الرسمية في صفحة التواصل.']]
  };
  return <main className="content-page"><div className="eyebrow">MAROC SÉLÉNITE · INFORMATIONS</div><h1>{t('faqTitle')}</h1><p className="lead">{t('faqLead')}</p><div style={{marginTop:40}}>{questions[locale].map(([q,a],index)=><div className="faq-item" key={q}><button className="faq-question" onClick={()=>setOpen(open===index?null:index)} aria-expanded={open===index} data-testid={`button-faq-${index}`}>{q}{open===index?<Minus size={15}/>:<Plus size={15}/>}</button>{open===index&&<div className="faq-answer" data-testid={`text-faq-answer-${index}`}>{a}</div>}</div>)}</div></main>;
}

function Contact() {
  const {t}=useStore();
  const [sent,setSent]=useState(false);
  const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setSent(true);};
  return <main className="content-page"><div className="eyebrow">MAROC SÉLÉNITE · CONTACT</div><h1>{t('contactTitle')}</h1><p className="lead">{t('contactLead')}</p><div className="contact-grid"><div><div className="notice-box">{t('contactPlaceholder')}</div><p>{t('placeholderCopy')}</p></div><div>{sent?<div className="success-message" data-testid="text-form-preview">{t('formNoSend')}</div>:<form onSubmit={submit}><div className="form-field"><label htmlFor="contact-name">{t('name')}</label><input required id="contact-name" data-testid="input-contact-name"/></div><div className="form-field"><label htmlFor="contact-email">{t('email')}</label><input required type="email" id="contact-email" data-testid="input-contact-email"/></div><div className="form-field"><label htmlFor="contact-message">{t('message')}</label><textarea required id="contact-message" data-testid="input-contact-message"/></div><button className="button-primary" data-testid="button-contact-submit">{t('send')} <ArrowRight size={14}/></button><p>{t('formNoSend')}</p></form>}</div></div></main>;
}

function SearchResultRoute() { return <SearchPage/>; }

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AppShell() {
  const {locale}=useStore();
  const [location] = useLocation();
  useEffect(()=>{document.documentElement.lang=locale;document.documentElement.dir=locale==='ar'?'rtl':'ltr';},[locale]);
  useEffect(()=>{
    const path=location.split('?')[0];
    const productSlug=path.match(/^\/products\/([^/]+)/)?.[1];
    const product=products.find(item=>item.slug===productSlug);
    const pageHeading=product?.title[locale] || document.querySelector('main h1')?.textContent?.trim() || 'Maroc Sélénite';
    const description=product?.description[locale] || `${pageHeading}. ${copy[locale].noticeTiny}`;
    document.title=`${pageHeading} — Maroc Sélénite`;
    const descriptionTag=document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const ogTitle=document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    const ogDescription=document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if(descriptionTag) descriptionTag.content=description;
    if(ogTitle) ogTitle.content=document.title;
    if(ogDescription) ogDescription.content=description;
  },[location,locale]);
  return <div className="site-shell"><Header/><RoutedErrorBoundary><Switch>
   <Route path="/" component={Home}/>
    <Route path="/collections/:slug" component={Collection}/>
    <Route path="/products/:slug" component={ProductDetail}/>
    <Route path="/search" component={SearchResultRoute}/>
    <Route path="/cart" component={Cart}/>
    <Route path="/our-story">{()=><EditorialPage type="story"/>}</Route>
    <Route path="/contact" component={Contact}/>
    <Route path="/faq" component={FAQ}/>
    <Route path="/shipping-returns">{()=><EditorialPage type="shipping"/>}</Route>
    <Route path="/privacy">{()=><EditorialPage type="privacy"/>}</Route>
    <Route path="/terms">{()=><EditorialPage type="terms"/>}</Route>
    <Route path="/wholesale">{()=><EditorialPage type="wholesale"/>}</Route>
    <Route component={NotFound}/>
  </Switch></RoutedErrorBoundary><Footer/></div>;
}

const queryClient = new QueryClient();
function App() {
  const [locale,setLocaleState] = useState<Locale>(()=>{ const stored=localStorage.getItem('maroc-locale'); return stored==='en'||stored==='ar'?stored:'fr'; });
  const [cart,setCart] = useState<CartItem[]>(()=>{try{return JSON.parse(localStorage.getItem('maroc-cart')||'[]') as CartItem[];}catch{return [];}});
  useEffect(()=>{localStorage.setItem('maroc-locale',locale);},[locale]);
  useEffect(()=>{localStorage.setItem('maroc-cart',JSON.stringify(cart));},[cart]);
  const add=(id:string,quantity=1)=>setCart(current=>current.some(item=>item.id===id)?current.map(item=>item.id===id?{...item,quantity:item.quantity+quantity}:item):[...current,{id,quantity}]);
  const change=(id:string,delta:number)=>setCart(current=>current.map(item=>item.id===id?{...item,quantity:item.quantity+delta}:item).filter(item=>item.quantity>0));
  const remove=(id:string)=>setCart(current=>current.filter(item=>item.id!==id));
  const value:StoreContextValue={locale,setLocale:setLocaleState,cart,add,change,remove,t:(key)=>copy[locale][key]??key};
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/,'')}><StoreContext.Provider value={value}><AppShell/></StoreContext.Provider></WouterRouter><Toaster/></TooltipProvider></QueryClientProvider>;
}

export default App;
