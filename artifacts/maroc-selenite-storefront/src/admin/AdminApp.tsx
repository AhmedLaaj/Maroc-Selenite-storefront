import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import "./admin.css";

type Localized = { fr: string; en: string; ar: string };
type Category = { id: string; parentId: string | null; slug: string; name: Localized; sortOrder: number };
type ProductImage = { id: string; original: string; published: string };
type Product = {
  id: string; slug: string; categoryId: string | null; price: number; published: boolean; sortOrder: number; tone: string;
  title: Localized; subtitle: Localized; description: Localized; images: ProductImage[];
};
type HomeTile = { label: Localized; title: Localized; image: string; href: string };
type HomeContent = {
  announcement: Localized; heroKicker: Localized; heroTitle: Localized; heroIntro: Localized; heroImage: string;
  tiles: HomeTile[]; editorialKicker: Localized; editorialTitle: Localized; editorialText: Localized; editorialImage: string;
  featuredProductIds: string[];
};
type Store = {
  settings: { previewNotice: boolean; watermarkUrl: string | null; watermarkCorner: string; watermarkOpacity: number };
  home: HomeContent | null;
  categories: Category[];
  products: Product[];
};
type Order = {
  id: string; name: string; email: string; phone: string; city: string; note: string; status: string; createdAt: string;
  lines: { id: string; title: string; quantity: number; unitPrice: number }[];
};
type ContactMessage = { id: string; name: string; email: string; message: string; status: string; createdAt: string };

const emptyText = (): Localized => ({ fr: "", en: "", ar: "" });
const corners = [
  ["bottom-right", "Bas droite"],
  ["bottom-left", "Bas gauche"],
  ["top-right", "Haut droite"],
  ["top-left", "Haut gauche"],
  ["center", "Centre"],
] as const;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { message?: string }).message || "Action impossible");
  return data as T;
}

function TextFields({ label, value, onChange }: { label: string; value: Localized; onChange: (value: Localized) => void }) {
  return <div className="form-field">
    <label>{label}</label>
    <div className="lang-grid">
      {(["fr", "en", "ar"] as const).map((locale) => <textarea key={locale} aria-label={`${label} ${locale}`} value={value[locale]} onChange={(event) => onChange({ ...value, [locale]: event.target.value })} />)}
    </div>
  </div>;
}

export default function AdminApp() {
  const [location, setLocation] = useLocation();
  const parts = location.split("?")[0].split("/").filter(Boolean);
  const section = parts[1] || "home";
  const id = parts[2];
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [store, setStore] = useState<Store | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [nextStore, nextOrders, nextMessages] = await Promise.all([
      api<Store>("/api/admin/store"),
      api<Order[]>("/api/admin/orders"),
      api<ContactMessage[]>("/api/admin/messages"),
    ]);
    setStore(nextStore);
    setOrders(nextOrders);
    setMessages(nextMessages);
  }

  useEffect(() => {
    api("/api/admin/session").then(() => setAuthed(true)).catch(() => setAuthed(false)).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (authed) load().catch((reason: Error) => setError(reason.message));
  }, [authed]);

  async function run(work: () => Promise<void | string>) {
    setError("");
    setMessage("");
    try {
      const next = await work();
      setMessage("Enregistré");
      await load();
      if (next) setLocation(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action impossible");
    }
  }

  if (!ready) return <main className="admin-login"><p>Chargement…</p></main>;
  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;

  return <div className="admin-shell">
    <aside className="admin-nav">
      <Link href="/" className="brand"><span className="brand-main">MAROC SÉLÉNITE</span><span className="brand-sub">BACKOFFICE</span></Link>
      {[["home", "Accueil"], ["categories", "Catégories"], ["products", "Produits"], ["watermark", "Filigrane"], ["orders", "Demandes"], ["messages", "Messages"]].map(([key, label]) =>
        <Link key={key} href={`/admin/${key}`} className={section === key ? "active" : ""}>{label}</Link>)}
      <button className="linkish" onClick={() => api("/api/admin/logout", { method: "POST" }).finally(() => setAuthed(false))}>Quitter</button>
    </aside>
    <main className="admin-main">
      {error && <p className="admin-error">{error}</p>}
      {message && <p className="admin-ok">{message}</p>}
      {store && section === "home" && <HomeEditor store={store} onSave={(home, previewNotice) => run(async () => { await api("/api/admin/home", { method: "PUT", body: JSON.stringify(home) }); await api("/api/admin/settings", { method: "PUT", body: JSON.stringify({ previewNotice, watermarkCorner: store.settings.watermarkCorner, watermarkOpacity: store.settings.watermarkOpacity }) }); })} onUpload={async (file) => {
        const body = new FormData();
        body.append("file", file);
        return api<{ url: string }>("/api/admin/media", { method: "POST", body });
      }} />}
      {store && section === "categories" && <CategoriesEditor store={store} onCreate={(body) => run(async () => { await api("/api/admin/categories", { method: "POST", body: JSON.stringify(body) }); })} onUpdate={(categoryId, body) => run(async () => { await api(`/api/admin/categories/${categoryId}`, { method: "PUT", body: JSON.stringify(body) }); })} onDelete={(categoryId) => run(async () => { await api(`/api/admin/categories/${categoryId}`, { method: "DELETE" }); })} />}
      {store && section === "products" && <ProductsEditor store={store} id={id} open={(productId) => setLocation(productId ? `/admin/products/${productId}` : "/admin/products")} onCreate={(body) => run(async () => { const created = await api<{ id: string }>("/api/admin/products", { method: "POST", body: JSON.stringify(body) }); return `/admin/products/${created.id}`; })} onUpdate={(productId, body) => run(async () => { await api(`/api/admin/products/${productId}`, { method: "PUT", body: JSON.stringify(body) }); })} onDelete={(productId) => run(async () => { await api(`/api/admin/products/${productId}`, { method: "DELETE" }); return "/admin/products"; })} onUpload={async (productId, file) => { const body = new FormData(); body.append("file", file); await api(`/api/admin/products/${productId}/images`, { method: "POST", body }); await load(); }} onDeleteImage={(imageId) => run(async () => { await api(`/api/admin/images/${imageId}`, { method: "DELETE" }); })} />}
      {store && section === "watermark" && <WatermarkEditor store={store} onSave={(body) => run(() => api("/api/admin/settings", { method: "PUT", body: JSON.stringify(body) }).then(() => undefined))} onUpload={(file) => run(async () => { const body = new FormData(); body.append("file", file); await api("/api/admin/watermark", { method: "POST", body }); })} />}
      {section === "orders" && <OrdersEditor orders={orders} onStatus={(orderId, status) => run(async () => { await api(`/api/admin/orders/${orderId}`, { method: "PATCH", body: JSON.stringify({ status }) }); })} />}
      {section === "messages" && <MessagesEditor messages={messages} onStatus={(messageId, status) => run(async () => { await api(`/api/admin/messages/${messageId}`, { method: "PATCH", body: JSON.stringify({ status }) }); })} />}
    </main>
  </div>;
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const password = new FormData(event.currentTarget).get("password");
    try {
      await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
      onSuccess();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Connexion impossible");
    }
  };
  return <main className="admin-login"><form onSubmit={submit}><div className="eyebrow">MAROC SÉLÉNITE</div><h1>Backoffice</h1><div className="form-field"><label htmlFor="admin-password">Mot de passe</label><input id="admin-password" name="password" type="password" required data-testid="input-admin-password" /></div>{error && <p className="admin-error">{error}</p>}<button className="button-primary" data-testid="button-admin-login">Entrer</button></form></main>;
}

function HomeEditor({ store, onSave, onUpload }: { store: Store; onSave: (home: HomeContent, previewNotice: boolean) => void; onUpload: (file: File) => Promise<{ url: string }> }) {
  const [previewNotice, setPreviewNotice] = useState(store.settings.previewNotice);
  const [home, setHome] = useState<HomeContent>(store.home || {
    announcement: emptyText(), heroKicker: emptyText(), heroTitle: emptyText(), heroIntro: emptyText(), heroImage: "",
    tiles: [0, 1, 2].map(() => ({ label: emptyText(), title: emptyText(), image: "", href: "/collections/maison" })),
    editorialKicker: emptyText(), editorialTitle: emptyText(), editorialText: emptyText(), editorialImage: "", featuredProductIds: [],
  });
  useEffect(() => { if (store.home) setHome(store.home); setPreviewNotice(store.settings.previewNotice); }, [store.home, store.settings.previewNotice]);
  const setTile = (index: number, patch: Partial<HomeTile>) => setHome({ ...home, tiles: home.tiles.map((tile, tileIndex) => tileIndex === index ? { ...tile, ...patch } : tile) });
  const uploadInto = async (file: File | undefined, apply: (url: string) => void) => {
    if (!file) return;
    const uploaded = await onUpload(file);
    apply(uploaded.url);
  };
  return <form onSubmit={(event) => { event.preventDefault(); onSave(home, previewNotice); }}>
    <div className="eyebrow">PAGE D’ACCUEIL</div><h1>Accueil</h1>
    <label className="admin-row"><span>Afficher l’annonce d’aperçu</span><input type="checkbox" checked={previewNotice} onChange={(event) => setPreviewNotice(event.target.checked)} data-testid="input-preview-notice" /></label>
    <TextFields label="Annonce" value={home.announcement} onChange={(announcement) => setHome({ ...home, announcement })} />
    <TextFields label="Surtitre" value={home.heroKicker} onChange={(heroKicker) => setHome({ ...home, heroKicker })} />
    <TextFields label="Titre (deuxième ligne en italique)" value={home.heroTitle} onChange={(heroTitle) => setHome({ ...home, heroTitle })} />
    <TextFields label="Introduction" value={home.heroIntro} onChange={(heroIntro) => setHome({ ...home, heroIntro })} />
    <div className="form-field"><label>Image du hero</label><input value={home.heroImage} onChange={(event) => setHome({ ...home, heroImage: event.target.value })} /><input type="file" accept="image/*" onChange={(event) => uploadInto(event.target.files?.[0], (heroImage) => setHome({ ...home, heroImage }))} /></div>
    {home.tiles.slice(0, 3).map((tile, index) => <div className="admin-card" key={index}>
      <h2>Vignette {index + 1}</h2>
      <TextFields label="Étiquette" value={tile.label} onChange={(label) => setTile(index, { label })} />
      <TextFields label="Titre" value={tile.title} onChange={(title) => setTile(index, { title })} />
      <div className="form-field"><label>Lien</label><input value={tile.href} onChange={(event) => setTile(index, { href: event.target.value })} /></div>
      <div className="form-field"><label>Image</label><input value={tile.image} onChange={(event) => setTile(index, { image: event.target.value })} /><input type="file" accept="image/*" onChange={(event) => uploadInto(event.target.files?.[0], (image) => setTile(index, { image }))} /></div>
    </div>)}
    <TextFields label="Bandeau — surtitre" value={home.editorialKicker} onChange={(editorialKicker) => setHome({ ...home, editorialKicker })} />
    <TextFields label="Bandeau — titre" value={home.editorialTitle} onChange={(editorialTitle) => setHome({ ...home, editorialTitle })} />
    <TextFields label="Bandeau — texte" value={home.editorialText} onChange={(editorialText) => setHome({ ...home, editorialText })} />
    <div className="form-field"><label>Image du bandeau</label><input value={home.editorialImage} onChange={(event) => setHome({ ...home, editorialImage: event.target.value })} /><input type="file" accept="image/*" onChange={(event) => uploadInto(event.target.files?.[0], (editorialImage) => setHome({ ...home, editorialImage }))} /></div>
    <div className="form-field"><label>Pièces mises en avant</label>{store.products.map((product) => <label key={product.id} className="admin-row"><span>{product.title.fr}</span><input type="checkbox" checked={home.featuredProductIds.includes(product.id)} onChange={(event) => setHome({ ...home, featuredProductIds: event.target.checked ? [...home.featuredProductIds, product.id] : home.featuredProductIds.filter((item) => item !== product.id) })} /></label>)}</div>
    <button className="button-primary" data-testid="button-save-home">Enregistrer l’accueil</button>
  </form>;
}

function CategoriesEditor({ store, onCreate, onUpdate, onDelete }: { store: Store; onCreate: (body: Omit<Category, "id">) => void; onUpdate: (id: string, body: Omit<Category, "id">) => void; onDelete: (id: string) => void }) {
  const [draft, setDraft] = useState<Omit<Category, "id">>({ parentId: null, slug: "", name: emptyText(), sortOrder: store.categories.length + 1 });
  return <section>
    <div className="eyebrow">CATALOGUE</div><h1>Catégories</h1>
    {store.categories.map((category) => <CategoryForm key={category.id} category={category} categories={store.categories} onUpdate={onUpdate} onDelete={onDelete} />)}
    <form className="admin-card" onSubmit={(event) => { event.preventDefault(); onCreate(draft); setDraft({ parentId: null, slug: "", name: emptyText(), sortOrder: store.categories.length + 1 }); }}>
      <h2>Nouvelle catégorie</h2>
      <CategoryFields value={draft} categories={store.categories} selfId="" onChange={setDraft} />
      <button className="button-primary">Ajouter</button>
    </form>
  </section>;
}

function CategoryForm({ category, categories, onUpdate, onDelete }: { category: Category; categories: Category[]; onUpdate: (id: string, body: Omit<Category, "id">) => void; onDelete: (id: string) => void }) {
  const [value, setValue] = useState<Omit<Category, "id">>(category);
  useEffect(() => setValue(category), [category]);
  return <form className="admin-card" onSubmit={(event) => { event.preventDefault(); onUpdate(category.id, value); }}>
    <CategoryFields value={value} categories={categories} selfId={category.id} onChange={setValue} />
    <div className="admin-actions"><button className="button-primary">Enregistrer</button><button type="button" className="button-outline" onClick={() => onDelete(category.id)}>Supprimer</button></div>
  </form>;
}

function CategoryFields({ value, categories, selfId, onChange }: { value: Omit<Category, "id">; categories: Category[]; selfId: string; onChange: (value: Omit<Category, "id">) => void }) {
  return <>
    <TextFields label="Nom" value={value.name} onChange={(name) => onChange({ ...value, name })} />
    <div className="lang-grid">
      <div className="form-field"><label>Slug</label><input value={value.slug} onChange={(event) => onChange({ ...value, slug: event.target.value })} required /></div>
      <div className="form-field"><label>Parent</label><select value={value.parentId || ""} onChange={(event) => onChange({ ...value, parentId: event.target.value || null })}><option value="">Aucun</option>{categories.filter((item) => item.id !== selfId).map((item) => <option key={item.id} value={item.id}>{item.name.fr}</option>)}</select></div>
      <div className="form-field"><label>Ordre</label><input type="number" value={value.sortOrder} onChange={(event) => onChange({ ...value, sortOrder: Number(event.target.value) })} /></div>
    </div>
  </>;
}

function ProductsEditor({ store, id, open, onCreate, onUpdate, onDelete, onUpload, onDeleteImage }: {
  store: Store; id?: string; open: (id?: string) => void;
  onCreate: (body: Omit<Product, "id" | "images">) => void;
  onUpdate: (id: string, body: Omit<Product, "id" | "images">) => void;
  onDelete: (id: string) => void;
  onUpload: (id: string, file: File) => Promise<void>;
  onDeleteImage: (id: string) => void;
}) {
  const product = store.products.find((item) => item.id === id);
  if (!id) return <section>
    <div className="eyebrow">CATALOGUE</div><h1>Produits</h1>
    <button className="button-primary" onClick={() => open("new")}>Nouveau produit</button>
    <div style={{ marginTop: 18 }}>{store.products.map((item) => <button key={item.id} className="admin-row" onClick={() => open(item.id)} style={{ width: "100%", background: "transparent", border: 0, color: "inherit", cursor: "pointer" }}><span>{item.title.fr}</span><span>{item.price} MAD · {item.published ? "publié" : "masqué"}</span></button>)}</div>
  </section>;
  if (id !== "new" && !product) return <section><h1>Produit introuvable</h1></section>;
  return <ProductForm product={product ?? null} categories={store.categories} onCreate={onCreate} onUpdate={onUpdate} onDelete={onDelete} onUpload={onUpload} onDeleteImage={onDeleteImage} />;
}

function ProductForm({ product, categories, onCreate, onUpdate, onDelete, onUpload, onDeleteImage }: {
  product: Product | null; categories: Category[];
  onCreate: (body: Omit<Product, "id" | "images">) => void;
  onUpdate: (id: string, body: Omit<Product, "id" | "images">) => void;
  onDelete: (id: string) => void;
  onUpload: (id: string, file: File) => Promise<void>;
  onDeleteImage: (id: string) => void;
}) {
  const [value, setValue] = useState<Omit<Product, "id" | "images">>(() => product ? (({ id: _id, images: _images, ...rest }) => rest)(product) : { slug: "", categoryId: null, price: 0, published: false, sortOrder: 0, tone: "mineral", title: emptyText(), subtitle: emptyText(), description: emptyText() });
  useEffect(() => { if (product) setValue((({ id: _id, images: _images, ...rest }) => rest)(product)); }, [product]);
  const save = (event: FormEvent) => { event.preventDefault(); if (product) onUpdate(product.id, value); else onCreate(value); };
  return <form onSubmit={save}>
    <div className="eyebrow">PRODUIT</div><h1>{product ? product.title.fr : "Nouveau produit"}</h1>
    <TextFields label="Titre" value={value.title} onChange={(title) => setValue({ ...value, title })} />
    <TextFields label="Sous-titre" value={value.subtitle} onChange={(subtitle) => setValue({ ...value, subtitle })} />
    <TextFields label="Description" value={value.description} onChange={(description) => setValue({ ...value, description })} />
    <div className="lang-grid">
      <div className="form-field"><label>Slug</label><input value={value.slug} required onChange={(event) => setValue({ ...value, slug: event.target.value })} /></div>
      <div className="form-field"><label>Prix MAD</label><input type="number" min={0} value={value.price} onChange={(event) => setValue({ ...value, price: Number(event.target.value) })} /></div>
      <div className="form-field"><label>Catégorie</label><select value={value.categoryId || ""} onChange={(event) => setValue({ ...value, categoryId: event.target.value || null })}><option value="">Aucune</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.parentId ? "— " : ""}{category.name.fr}</option>)}</select></div>
      <div className="form-field"><label>Ordre</label><input type="number" value={value.sortOrder} onChange={(event) => setValue({ ...value, sortOrder: Number(event.target.value) })} /></div>
      <div className="form-field"><label>Ton</label><select value={value.tone} onChange={(event) => setValue({ ...value, tone: event.target.value })}>{["mineral", "sand", "clay", "ivory", "stone", "navy"].map((tone) => <option key={tone}>{tone}</option>)}</select></div>
      <label className="admin-row"><span>Publié</span><input type="checkbox" checked={value.published} onChange={(event) => setValue({ ...value, published: event.target.checked })} /></label>
    </div>
    {product && <div className="admin-photos">{product.images.map((image) => <figure key={image.id}><img src={image.published} alt="" /><button type="button" onClick={() => onDeleteImage(image.id)}>Retirer</button></figure>)}<label className="button-outline">Ajouter une photo<input type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(product.id, file); }} /></label></div>}
    <div className="admin-actions"><button className="button-primary" data-testid="button-save-product">Enregistrer</button>{product && <button type="button" className="button-outline" onClick={() => onDelete(product.id)}>Supprimer</button>}</div>
  </form>;
}

function WatermarkEditor({ store, onSave, onUpload }: { store: Store; onSave: (body: { previewNotice: boolean; watermarkCorner: string; watermarkOpacity: number }) => void; onUpload: (file: File) => void }) {
  const [corner, setCorner] = useState(store.settings.watermarkCorner);
  const [opacity, setOpacity] = useState(store.settings.watermarkOpacity);
  useEffect(() => { setCorner(store.settings.watermarkCorner); setOpacity(store.settings.watermarkOpacity); }, [store.settings]);
  const sample = store.products.find((product) => product.images.length)?.images[0]?.published;
  return <section>
    <div className="eyebrow">PHOTOS</div><h1>Filigrane</h1>
    <p>Le logo ou la signature est appliqué aux photos produit. Les images de l’accueil restent sans filigrane.</p>
    {store.settings.watermarkUrl && <img src={store.settings.watermarkUrl} alt="Logo ou signature" style={{ maxWidth: 180, background: "#fff", padding: 8 }} />}
    <div className="form-field"><label>Logo ou signature</label><input type="file" accept="image/*" data-testid="input-watermark" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); }} /></div>
    <form onSubmit={(event) => { event.preventDefault(); onSave({ previewNotice: store.settings.previewNotice, watermarkCorner: corner, watermarkOpacity: opacity }); }}>
      <div className="form-field"><label>Coin</label><select value={corner} onChange={(event) => setCorner(event.target.value)}>{corners.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div className="form-field"><label>Opacité {Math.round(opacity * 100)}%</label><input type="range" min={0.15} max={1} step={0.01} value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} /></div>
      <button className="button-primary">Appliquer le placement</button>
    </form>
    <div className="watermark-sample admin-card">{sample ? <img src={`${sample}?v=${encodeURIComponent(store.settings.watermarkUrl || "")}`} alt="Exemple de photo produit" /> : <p>Ajoutez un produit avec une photo pour voir un exemple.</p>}</div>
  </section>;
}

function MessagesEditor({ messages, onStatus }: { messages: ContactMessage[]; onStatus: (id: string, status: string) => void }) {
  const labels: Record<string, string> = { new: "Nouveau", contacted: "Contacté", closed: "Fermé" };
  const when = (value: string) => new Date(value).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
  return <section>
    <div className="eyebrow">BOUTIQUE</div><h1>Messages</h1>
    <p>Les messages envoyés depuis la page Contact.</p>
    {!messages.length && <p>Aucun message pour le moment.</p>}
    {messages.map((item) => <article className="admin-card" key={item.id} data-testid={`message-${item.id}`}>
      <div className="admin-row"><strong>{item.name}</strong><span className="admin-status">{labels[item.status] || item.status}</span></div>
      <p>{item.email} · {when(item.createdAt)}</p>
      <p style={{ whiteSpace: "pre-wrap" }}>{item.message}</p>
      <div className="admin-actions">
        <button type="button" className="button-outline" onClick={() => onStatus(item.id, "contacted")}>Marquer contacté</button>
        <button type="button" className="button-outline" onClick={() => onStatus(item.id, "closed")}>Fermer</button>
      </div>
    </article>)}
  </section>;
}

function OrdersEditor({ orders, onStatus }: { orders: Order[]; onStatus: (id: string, status: string) => void }) {
  const labels: Record<string, string> = { new: "Nouvelle", contacted: "Contactée", closed: "Fermée" };
  return <section>
    <div className="eyebrow">BOUTIQUE</div><h1>Demandes</h1>
    {!orders.length && <p>Aucune demande pour le moment.</p>}
    {orders.map((order) => <article className="admin-card" key={order.id} data-testid={`order-${order.id}`}>
      <div className="admin-row"><strong>{order.name}</strong><span className="admin-status">{labels[order.status] || order.status}</span></div>
      <p>{order.email} · {order.phone} · {order.city}</p>
      {order.note && <p>{order.note}</p>}
      <ul>{order.lines.map((line) => <li key={line.id}>{line.quantity} × {line.title} — {line.unitPrice} MAD</li>)}</ul>
      <div className="admin-actions">
        <button type="button" className="button-outline" onClick={() => onStatus(order.id, "contacted")}>Marquer contactée</button>
        <button type="button" className="button-outline" onClick={() => onStatus(order.id, "closed")}>Fermer</button>
      </div>
    </article>)}
  </section>;
}
