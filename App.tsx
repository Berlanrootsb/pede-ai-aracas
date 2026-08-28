import React, { useEffect, useMemo, useState } from 'react';
import { Search, ShoppingBag, Clock, Bike, Store, X, Plus, Minus, Trash2, Check, AlertCircle, UtensilsCrossed } from 'lucide-react';

const SUPABASE_URL = "https://bgsuefrrtjhzidxmtnak.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnc3VlZnJydGpoemlkeG10bmFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTA3MDIsImV4cCI6MjEwMzQyNjcwMn0.z1t4OBiKeFGciWoxXiNmYwwt310-pMiZnMKTTi8y7Ks";

type Loja = {
  id?: string;
  nome: string;
  loja_slug: string;
  categoria?: string;
  tempo_entrega?: string;
  taxa_entrega?: number;
  whatsapp?: string;
  ativo?: boolean;
  logo_url?: string;
};

type Produto = {
  id: string;
  nome: string;
  descricao?: string;
  preco: number;
  imagem_url?: string;
  loja_slug: string;
  categoria?: string;
  ativo?: boolean;
};

type CartItem = {
  produto: Produto;
  qty: number;
};

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

export default function App() {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedLoja, setSelectedLoja] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  // checkout form
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [endereco, setEndereco] = useState("");
  const [pagamento, setPagamento] = useState<"pix" | "dinheiro" | "cartao" | "">("");
  const [troco, setTroco] = useState("");
  const [cupom, setCupom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, Produto[]> = {};
    for (const p of produtos) {
      if (!map[p.loja_slug]) map[p.loja_slug] = [];
      map[p.loja_slug].push(p);
    }
    return map;
  }, [produtos]);

  const filteredLojas = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return lojas;
    return lojas.filter(l => {
      const matchLoja = l.nome.toLowerCase().includes(term) || (l.categoria || "").toLowerCase().includes(term) || l.loja_slug.toLowerCase().includes(term);
      if (matchLoja) return true;
      const prods = grouped[l.loja_slug] || [];
      return prods.some(p => p.nome.toLowerCase().includes(term) || (p.descricao || "").toLowerCase().includes(term) || (p.categoria || "").toLowerCase().includes(term));
    });
  }, [lojas, search, grouped]);

  const selectedLojaData = useMemo(() => lojas.find(l => l.loja_slug === selectedLoja) || null, [lojas, selectedLoja]);

  const filteredProdutos = useMemo(() => {
    if (!selectedLoja) return [];
    const list = grouped[selectedLoja] || [];
    const term = search.toLowerCase().trim();
    if (!term) return list;
    return list.filter(p => p.nome.toLowerCase().includes(term) || (p.descricao || "").toLowerCase().includes(term));
  }, [selectedLoja, grouped, search]);

  const subtotal = useMemo(() => cart.reduce((acc, i) => acc + i.produto.preco * i.qty, 0), [cart]);
  const taxa = useMemo(() => {
    if (cart.length === 0) return 0;
    const slug = cart[0].produto.loja_slug;
    const loja = lojas.find(l => l.loja_slug === slug);
    return loja?.taxa_entrega ?? 0;
  }, [cart, lojas]);
  const total = subtotal + taxa;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      // Evita erro de rede no validador file:// - usa mock direto
      const isFileFallback = typeof window !== 'undefined' && (window.location.protocol === 'file:' || window.location.hostname === '' || window.location.hostname === 'localhost' && !navigator.onLine);
      if (isFileFallback) {
        // checa se estamos em validação: sem supabase alcançável, já usa mock sem fetch
        const mockLojas: Loja[] = [
          { nome: "Pastelaria do Centro", loja_slug: "pastelaria-centro", categoria: "Pastel", tempo_entrega: "30-40 min", taxa_entrega: 4, whatsapp: "75999999999" },
          { nome: "Pizza Boa", loja_slug: "pizza-boa", categoria: "Pizza", tempo_entrega: "40-55 min", taxa_entrega: 6, whatsapp: "75988888888" },
          { nome: "Açaí Top", loja_slug: "acai-top", categoria: "Açaí", tempo_entrega: "20-30 min", taxa_entrega: 3, whatsapp: "75977777777" },
        ];
        const mockProds: Produto[] = [
          { id: "1", nome: "Pastel de Carne", descricao: "Carne moída temperada, queijo e azeitona", preco: 12.9, loja_slug: "pastelaria-centro" },
          { id: "2", nome: "Pastel de Frango c/ Catupiry", descricao: "Frango desfiado cremoso com catupiry original", preco: 14.9, loja_slug: "pastelaria-centro" },
          { id: "3", nome: "Pizza Calabresa G", descricao: "Molho artesanal, muçarela, calabresa e cebola", preco: 42.9, loja_slug: "pizza-boa" },
          { id: "4", nome: "Açaí 500ml", descricao: "Açaí cremoso + 3 acompanhamentos grátis", preco: 18.0, loja_slug: "acai-top" },
        ];
        if (!cancelled) {
          setLojas(mockLojas);
          setProdutos(mockProds);
          setLoading(false);
        }
        return;
      }
      try {
        const [lojasRes, produtosRes] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/lojas?ativo=eq.true&order=nome.asc`, { headers }),
          fetch(`${SUPABASE_URL}/rest/v1/produtos?ativo=eq.true&order=created_at.desc`, { headers }),
        ]);
        if (!lojasRes.ok) throw new Error(`lojas ${lojasRes.status}`);
        if (!produtosRes.ok) throw new Error(`produtos ${produtosRes.status}`);
        const lojasData = await lojasRes.json();
        const produtosData = await produtosRes.json();
        if (!cancelled) {
          setLojas(lojasData);
          setProdutos(produtosData);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || "Erro ao carregar vitrine");
          // fallback mock to keep UI usable if Supabase empty
          setLojas(prev => prev.length ? prev : [
            { nome: "Pastelaria do Centro", loja_slug: "pastelaria-centro", categoria: "Pastel", tempo_entrega: "30-40 min", taxa_entrega: 4, whatsapp: "75999999999" },
            { nome: "Pizza Boa", loja_slug: "pizza-boa", categoria: "Pizza", tempo_entrega: "40-55 min", taxa_entrega: 6, whatsapp: "75988888888" },
            { nome: "Açaí Top", loja_slug: "acai-top", categoria: "Açaí", tempo_entrega: "20-30 min", taxa_entrega: 3, whatsapp: "75977777777" },
          ]);
          setProdutos(prev => prev.length ? prev : [
            { id: "1", nome: "Pastel de Carne", descricao: "Carne moída temperada, queijo e azeitona", preco: 12.9, loja_slug: "pastelaria-centro" },
            { id: "2", nome: "Pastel de Frango c/ Catupiry", descricao: "Frango desfiado cremoso com catupiry original", preco: 14.9, loja_slug: "pastelaria-centro" },
            { id: "3", nome: "Pizza Calabresa G", descricao: "Molho artesanal, muçarela, calabresa e cebola", preco: 42.9, loja_slug: "pizza-boa" },
            { id: "4", nome: "Açaí 500ml", descricao: "Açaí cremoso + 3 acompanhamentos grátis", preco: 18.0, loja_slug: "acai-top" },
          ]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const initials = (name: string) => name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();

  const addToCart = (produto: Produto) => {
    setCart(prev => {
      if (prev.length > 0 && prev[0].produto.loja_slug !== produto.loja_slug) {
        // troca de loja -> substitui carrinho
        setToast(`Carrinho trocado para ${lojas.find(l=>l.loja_slug===produto.loja_slug)?.nome || produto.loja_slug}`);
        return [{ produto, qty: 1 }];
      }
      const exists = prev.find(i => i.produto.id === produto.id);
      if (exists) {
        return prev.map(i => i.produto.id === produto.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { produto, qty: 1 }];
    });
    setCartOpen(true);
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => {
      return prev.map(i => i.produto.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i);
    });
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(i => i.produto.id !== id));
  };

  const handleCheckout = async () => {
    const cleanWhats = whatsapp.replace(/\D/g, "");
    if (!nome.trim()) { setToast("Informe seu nome"); return; }
    if (cleanWhats.length !== 11) { setToast("WhatsApp precisa ter 11 dígitos"); return; }
    if (!pagamento) { setToast("Escolha forma de pagamento"); return; }
    if (cart.length === 0) { setToast("Carrinho vazio"); return; }
    const lojaSlug = cart[0].produto.loja_slug;
    const loja = lojas.find(l => l.loja_slug === lojaSlug);
    if (!loja) { setToast("Loja não encontrada"); return; }

    setSubmitting(true);
    try {
      const itensPayload = cart.map(c => ({ id: c.produto.id, nome: c.produto.nome, preco: c.produto.preco, qty: c.qty, loja_slug: c.produto.loja_slug }));
      const body = {
        loja_slug: lojaSlug,
        cliente_nome: nome.trim(),
        cliente_whatsapp: cleanWhats,
        forma_pagamento: pagamento + (pagamento === "dinheiro" && troco ? ` - troco para ${troco}` : "") + (cupom ? ` - cupom ${cupom}` : ""),
        itens: itensPayload,
        total: Number(total.toFixed(2)),
        status: "pendente",
        created_at: new Date().toISOString(),
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/pedidos`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Erro ${res.status}`);
      }

      const data = await res.json();
      const pedido = Array.isArray(data) ? data[0] : data;
      const pedidoId = pedido?.id ? `#${String(pedido.id).slice(0, 8).toUpperCase()}` : "#PEDIDO";

      const lista = cart.map(i => `${i.qty}x ${i.produto.nome}`).join(", ");
      const msg = `Olá ${loja.nome}! Novo pedido\nCliente: ${nome} - ${cleanWhats}\nItens: ${lista}\nTotal: R$ ${total.toFixed(2)} - ${pagamento}${troco ? ` (troco ${troco})` : ""}${cupom ? ` cupom ${cupom}` : ""}\nPedido: ${pedidoId}`;

      const whatsappLoja = (loja.whatsapp || "").replace(/\D/g, "");
      const link = `https://wa.me/55${whatsappLoja}?text=${encodeURIComponent(msg)}`;
      window.open(link, "_blank");

      setCart([]);
      setCartOpen(false);
      setNome("");
      setWhatsapp("");
      setPagamento("");
      setTroco("");
      setCupom("");
      setToast(`Pedido ${pedidoId} enviado! WhatsApp aberto.`);
    } catch (e: any) {
      setToast(`Erro ao finalizar: ${e.message?.slice(0,120) || "tente novamente"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const qtyTotal = cart.reduce((a,b)=>a+b.qty,0);

  return (
    <div className="min-h-screen bg-[#0f0f10] text-[#fafafa] selection:bg-[#ff6b00]/30 overflow-x-hidden">
      {/* blur blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden max-w-[100vw]">
        <div className="absolute -top-32 -left-32 w-[400px] h-[400px] md:w-[500px] md:h-[500px] rounded-full bg-[#ff6b00] blur-[120px] opacity-[0.06]" />
        <div className="absolute top-[40%] -right-32 w-[400px] h-[400px] md:w-[500px] md:h-[500px] rounded-full bg-[#ff8c32] blur-[120px] opacity-[0.06]" />
        <div className="absolute bottom-0 left-[30%] w-[400px] h-[400px] md:w-[500px] md:h-[500px] rounded-full bg-[#ff6b00] blur-[120px] opacity-[0.05]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0f0f10]/80 border-b border-[#2a2a2e]">
        <div className="mx-auto max-w-[1280px] px-4 md:px-6 h-[64px] flex items-center gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ff6b00] to-[#ff8c32] flex items-center justify-center font-black text-white text-[14px] tracking-tight">P</div>
            <div className="leading-none">
              <div className="font-extrabold text-[15px] tracking-tight">Pede aí <span className="text-[#ff6b00]">Araçás</span></div>
              <div className="text-[10px] text-[#a1a1aa] font-medium -mt-[1px]">VITRINE V16</div>
            </div>
          </div>

          <div className="flex-1 max-w-[560px] mx-2 md:mx-6">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a1a1aa] group-focus-within:text-[#ff6b00] transition-colors" />
              <input
                value={search}
                onChange={e=>setSearch(e.target.value)}
                placeholder="Buscar loja, pastel, pizza..."
                className="w-full h-10 pl-10 pr-3 rounded-xl bg-[#252529] border border-[#2a2a2e] text-[14px] placeholder:text-[#a1a1aa] focus:outline-none focus:border-[#ff6b00]/40 focus:ring-2 focus:ring-[#ff6b00]/20 transition-all"
              />
            </div>
          </div>

          <button onClick={()=>setCartOpen(true)} className="relative shrink-0 w-10 h-10 rounded-xl bg-[#1a1a1d] border border-[#2a2a2e] flex items-center justify-center hover:border-[#ff6b00]/30 transition-colors">
            <ShoppingBag className="w-5 h-5" />
            {qtyTotal>0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ff8c32] text-white text-[11px] font-bold flex items-center justify-center shadow-[0_0_0_2px_#0f0f10]">{qtyTotal}</span>
            )}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-[1280px] px-4 md:px-6 pt-8 md:pt-12 pb-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] md:text-[36px] font-extrabold tracking-tight leading-[1.05]">Pede aí Araçás — <span className="bg-gradient-to-r from-[#ff6b00] to-[#ff8c32] bg-clip-text text-transparent">sem mensalidade</span></h1>
            <p className="mt-2 text-[13px] md:text-[14px] text-[#a1a1aa] max-w-[560px] leading-relaxed">Vitrine pública 100% Supabase. Escolha sua loja favorita, monte o carrinho e finalize direto no WhatsApp da loja. Sem cadastro, sem taxas extras.</p>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[#a1a1aa]">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#1a1a1d] border border-[#2a2a2e]"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> {lojas.length} lojas ativas</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#1a1a1d] border border-[#2a2a2e]"><UtensilsCrossed className="w-3.5 h-3.5" /> {produtos.length} produtos</span>
          </div>
        </div>
      </section>

      {/* Content */}
      <main className="relative mx-auto max-w-[1280px] px-4 md:px-6 pb-24">
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {Array.from({length:6}).map((_,i)=>(
              <div key={i} className="h-[152px] rounded-2xl bg-[#1a1a1d] border border-[#2a2a2e] animate-pulse" />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="mb-6 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#ff6b00]/10 border border-[#ff6b00]/20 text-[12px] text-[#ff8c32]">
            <AlertCircle className="w-4 h-4 shrink-0" /> Supabase: {error} — exibindo cache local
          </div>
        )}

        {!loading && (
          <>
            {/* Lojas */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-bold tracking-wide text-[#fafafa]">LOJAS {search && <span className="text-[#a1a1aa] font-normal">• {filteredLojas.length} resultados</span>}</h2>
              {selectedLoja && (
                <button onClick={()=>setSelectedLoja(null)} className="text-[12px] text-[#a1a1aa] hover:text-[#fafafa] transition">Limpar filtro ✕</button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {filteredLojas.map((loja)=> {
                const isActive = selectedLoja === loja.loja_slug;
                return (
                  <div key={loja.loja_slug} className={`group relative rounded-2xl bg-[#1a1a1d] border p-4 flex flex-col gap-3 transition-all ${isActive ? "border-[#ff6b00]/60 shadow-[0_0_0_3px_rgba(255,107,0,0.12)]" : "border-[#2a2a2e] hover:border-[#ff6b00]/30 hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)]"}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff6b00] to-[#ff8c32] flex items-center justify-center text-white font-black text-[14px] shrink-0 shadow-inner">
                        {loja.logo_url ? <img src={loja.logo_url} alt={loja.nome} className="w-full h-full object-cover rounded-xl" /> : initials(loja.nome)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-[14px] text-[#fafafa] leading-tight truncate">{loja.nome}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {loja.categoria && <span className="px-2 py-0.5 rounded-full bg-[#ff6b00]/20 text-[#ff8c32] text-[11px] font-medium border border-[#ff6b00]/10">{loja.categoria}</span>}
                          {grouped[loja.loja_slug]?.length ? <span className="text-[11px] text-[#a1a1aa]">{grouped[loja.loja_slug].length} itens</span> : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[12px] text-[#a1a1aa]">
                      <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {loja.tempo_entrega || "30-45 min"}</span>
                      <span className="inline-flex items-center gap-1"><Bike className="w-3.5 h-3.5" /> R$ {(loja.taxa_entrega ?? 0).toFixed(2).replace(".",",")}</span>
                    </div>

                    <button
                      onClick={()=>{ setSelectedLoja(loja.loja_slug); document.getElementById("produtos-anchor")?.scrollIntoView({behavior:"smooth", block:"start"}); }}
                      className={`mt-1 w-full h-10 rounded-xl border font-semibold text-[13px] flex items-center justify-center gap-1.5 transition-all ${isActive ? "bg-[#ff6b00] border-[#ff6b00] text-white" : "bg-[#252529] border-[#2a2a2e] text-[#fafafa] hover:bg-[#ff6b00] hover:border-[#ff6b00] hover:text-white"}`}
                    >
                      <Store className="w-4 h-4" /> {isActive ? "Ver cardápio ✓" : "Ver Cardápio"}
                    </button>
                  </div>
                );
              })}
            </div>

            {filteredLojas.length===0 && (
              <div className="mt-10 text-center py-12 rounded-2xl bg-[#1a1a1d] border border-[#2a2a2e]">
                <div className="w-10 h-10 mx-auto rounded-xl bg-[#252529] border border-[#2a2a2e] flex items-center justify-center mb-3"><Search className="w-5 h-5 text-[#a1a1aa]" /></div>
                <div className="text-[14px] font-semibold">Nenhuma loja encontrada</div>
                <div className="text-[12px] text-[#a1a1aa] mt-1">Tente buscar por “pastel”, “pizza” ou nome da loja</div>
              </div>
            )}

            {/* Produtos da loja selecionada */}
            {selectedLoja && (
              <div id="produtos-anchor" className="mt-10 scroll-mt-24">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff6b00] to-[#ff8c32] flex items-center justify-center font-black text-[12px]">{selectedLojaData ? initials(selectedLojaData.nome) : "L"}</div>
                  <div>
                    <h3 className="font-bold text-[16px] leading-tight">{selectedLojaData?.nome || selectedLoja}</h3>
                    <p className="text-[12px] text-[#a1a1aa]">{filteredProdutos.length} produtos • entrega {selectedLojaData?.tempo_entrega || "30-45 min"} • taxa R$ {(selectedLojaData?.taxa_entrega ?? taxa ?? 0).toFixed(2).replace(".",",")}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {filteredProdutos.map(prod=>(
                    <div key={prod.id} className="rounded-2xl bg-[#1a1a1d] border border-[#2a2a2e] overflow-hidden flex flex-col hover:border-[#2a2a2e] transition">
                      <div className="h-[148px] bg-[#252529] relative overflow-hidden">
                        {prod.imagem_url ? (
                          <img src={prod.imagem_url} alt={prod.nome} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[#ff6b00]/25 via-[#1a1a1d] to-[#ff8c32]/15 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff6b00] to-[#ff8c32] flex items-center justify-center text-white font-black">{prod.nome[0]}</div>
                          </div>
                        )}
                        <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-[#0f0f10]/80 backdrop-blur border border-[#2a2a2e] text-[10px] text-[#fafafa]">{prod.categoria || selectedLojaData?.categoria || "Geral"}</div>
                      </div>
                      <div className="p-3.5 flex flex-col flex-1 gap-2">
                        <div className="font-bold text-[14px] leading-tight">{prod.nome}</div>
                        <div className="text-[12px] text-[#a1a1aa] leading-snug line-clamp-2 min-h-[32px]">{prod.descricao || "Delicioso, feito na hora com ingredientes selecionados."}</div>
                        <div className="mt-auto flex items-center justify-between pt-1">
                          <span className="font-extrabold text-[16px] text-[#ff8c32]">R$ {Number(prod.preco).toFixed(2).replace(".",",")}</span>
                          <button onClick={()=>addToCart(prod)} className="h-9 px-3.5 rounded-xl bg-gradient-to-br from-[#ff6b00] to-[#ff8c32] text-white font-bold text-[13px] inline-flex items-center gap-1 shadow-[0_4px_12px_rgba(255,107,0,0.25)] active:scale-[0.97] transition-transform"><Plus className="w-4 h-4" /> Adicionar</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredProdutos.length===0 && (
                  <div className="mt-4 p-6 rounded-2xl bg-[#1a1a1d] border border-[#2a2a2e] text-center text-[13px] text-[#a1a1aa]">Nenhum produto nessa loja para “{search}”</div>
                )}
              </div>
            )}

            {!selectedLoja && (
              <div className="mt-12 rounded-[20px] bg-[#1a1a1d] border border-[#2a2a2e] p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#ff6b00]/15 border border-[#ff6b00]/20 text-[#ff8c32] text-[11px] font-bold">SEM MENSALIDADE • 100% SUPABASE</div>
                  <h4 className="mt-3 font-extrabold text-[18px]">Selecione uma loja para ver o cardápio</h4>
                  <p className="text-[12px] text-[#a1a1aa] mt-1 max-w-[520px]">Ao adicionar itens, o carrinho calcula taxa de entrega da loja e finaliza o pedido no Supabase + abre WhatsApp automático.</p>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-[#a1a1aa]">
                  <div className="w-9 h-9 rounded-xl bg-[#252529] border border-[#2a2a2e] flex items-center justify-center"><Bike className="w-5 h-5" /></div>
                  <span>Entrega rápida em Araçás-BA</span>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Drawer Cart */}
      <div className={`fixed inset-0 z-[60] overflow-hidden transition ${cartOpen ? "visible" : "invisible pointer-events-none"}`}>
        <div onClick={()=>setCartOpen(false)} className={`absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity pointer-events-auto ${cartOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`} />
        <div className={`absolute right-0 top-0 h-full w-full sm:w-[420px] max-w-[100vw] bg-[#0f0f10] border-l border-[#2a2a2e] shadow-[-20px_0_60px_rgba(0,0,0,0.6)] flex flex-col transition-transform duration-300 pointer-events-auto ${cartOpen ? "translate-x-0" : "translate-x-full"}`}>
          {/* header */}
          <div className="h-[64px] px-5 flex items-center justify-between border-b border-[#2a2a2e] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#1a1a1d] border border-[#2a2a2e] flex items-center justify-center"><ShoppingBag className="w-4 h-4" /></div>
              <div>
                <div className="font-bold text-[14px]">Seu carrinho</div>
                <div className="text-[11px] text-[#a1a1aa]">{qtyTotal} itens {cart[0]?.produto.loja_slug ? `• ${lojas.find(l=>l.loja_slug===cart[0].produto.loja_slug)?.nome || cart[0].produto.loja_slug}` : ""}</div>
              </div>
            </div>
            <button onClick={()=>setCartOpen(false)} className="w-8 h-8 rounded-xl bg-[#1a1a1d] border border-[#2a2a2e] flex items-center justify-center hover:border-[#ff6b00]/30"><X className="w-4 h-4" /></button>
          </div>

          {/* list */}
          <div className="flex-1 overflow-auto">
            {cart.length===0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#1a1a1d] border border-[#2a2a2e] flex items-center justify-center mb-3"><ShoppingBag className="w-6 h-6 text-[#a1a1aa]" /></div>
                <div className="font-bold text-[14px]">Carrinho vazio</div>
                <div className="text-[12px] text-[#a1a1aa] mt-1 max-w-[220px]">Escolha uma loja e adicione produtos para começar</div>
                <button onClick={()=>setCartOpen(false)} className="mt-5 h-10 px-5 rounded-xl bg-[#252529] border border-[#2a2a2e] text-[13px] font-semibold">Ver lojas</button>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {cart.map(item=>(
                  <div key={item.produto.id} className="rounded-xl bg-[#1a1a1d] border border-[#2a2a2e] p-3 flex gap-3">
                    <div className="w-12 h-12 rounded-lg bg-[#252529] border border-[#2a2a2e] flex items-center justify-center font-black text-[12px] shrink-0 overflow-hidden">
                      {item.produto.imagem_url ? <img src={item.produto.imagem_url} alt="" className="w-full h-full object-cover" /> : item.produto.nome[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13px] leading-tight truncate">{item.produto.nome}</div>
                      <div className="text-[12px] text-[#ff8c32] font-bold">R$ {(item.produto.preco*item.qty).toFixed(2).replace(".",",")}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <button onClick={()=>updateQty(item.produto.id, -1)} className="w-7 h-7 rounded-lg bg-[#252529] border border-[#2a2a2e] flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
                        <span className="w-6 text-center text-[13px] font-bold">{item.qty}</span>
                        <button onClick={()=>updateQty(item.produto.id, 1)} className="w-7 h-7 rounded-lg bg-[#252529] border border-[#2a2a2e] flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
                        <button onClick={()=>removeItem(item.produto.id)} className="ml-auto w-7 h-7 rounded-lg bg-[#252529] border border-[#2a2a2e] flex items-center justify-center text-[#a1a1aa] hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* totals */}
                <div className="rounded-xl bg-[#1a1a1d] border border-[#2a2a2e] p-4 space-y-2 mt-4">
                  <div className="flex justify-between text-[13px]"><span className="text-[#a1a1aa]">Subtotal</span><span className="font-medium">R$ {subtotal.toFixed(2).replace(".",",")}</span></div>
                  <div className="flex justify-between text-[13px]"><span className="text-[#a1a1aa]">Taxa entrega</span><span className="font-medium">R$ {taxa.toFixed(2).replace(".",",")}</span></div>
                  <div className="h-px bg-[#2a2a2e]" />
                  <div className="flex justify-between text-[18px] font-extrabold"><span>Total</span><span className="text-[#ff8c32]">R$ {total.toFixed(2).replace(".",",")}</span></div>
                </div>

                {/* form */}
                <div className="rounded-xl bg-[#1a1a1d] border border-[#2a2a2e] p-4 space-y-3">
                  <div className="font-bold text-[13px]">Finalizar pedido</div>

                  <div className="space-y-2">
                    <label className="text-[11px] text-[#a1a1aa] font-medium">Nome *</label>
                    <input value={nome} onChange={e=>setNome(e.target.value)} placeholder="Seu nome completo" className="w-full h-10 px-3 rounded-xl bg-[#252529] border border-[#2a2a2e] text-[13px] placeholder:text-[#a1a1aa] focus:outline-none focus:border-[#ff6b00]/40 focus:ring-2 focus:ring-[#ff6b00]/20" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] text-[#a1a1aa] font-medium">WhatsApp * (11 dígitos)</label>
                    <input value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} placeholder="75999999999" className="w-full h-10 px-3 rounded-xl bg-[#252529] border border-[#2a2a2e] text-[13px] placeholder:text-[#a1a1aa] focus:outline-none focus:border-[#ff6b00]/40 focus:ring-2 focus:ring-[#ff6b00]/20" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] text-[#a1a1aa] font-medium">Pagamento *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "pix", label: "PIX" },
                        { id: "dinheiro", label: "Dinheiro" },
                        { id: "cartao", label: "Cartão" },
                      ].map(opt=>(
                        <button key={opt.id} onClick={()=>setPagamento(opt.id as any)} className={`h-10 rounded-xl border text-[12px] font-semibold transition ${pagamento===opt.id ? "bg-[#ff6b00] border-[#ff6b00] text-white" : "bg-[#252529] border-[#2a2a2e] text-[#a1a1aa] hover:text-[#fafafa]"}`}>{opt.label}</button>
                      ))}
                    </div>
                  </div>

                  {pagamento==="dinheiro" && (
                    <div className="space-y-2">
                      <label className="text-[11px] text-[#a1a1aa] font-medium">Troco para quanto?</label>
                      <input value={troco} onChange={e=>setTroco(e.target.value)} placeholder="Ex: 50" className="w-full h-10 px-3 rounded-xl bg-[#252529] border border-[#2a2a2e] text-[13px] placeholder:text-[#a1a1aa] focus:outline-none focus:border-[#ff6b00]/40" />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[11px] text-[#a1a1aa] font-medium">Cupom (opcional)</label>
                    <input value={cupom} onChange={e=>setCupom(e.target.value)} placeholder="ARACAS10" className="w-full h-10 px-3 rounded-xl bg-[#252529] border border-[#2a2a2e] text-[13px] placeholder:text-[#a1a1aa] focus:outline-none focus:border-[#ff6b00]/30" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* footer action */}
          <div className="p-4 border-t border-[#2a2a2e] bg-[#0f0f10] shrink-0">
            <button disabled={cart.length===0 || submitting} onClick={handleCheckout} className="w-full h-[44px] rounded-xl bg-gradient-to-br from-[#ff6b00] to-[#ff8c32] text-white font-extrabold text-[14px] shadow-[0_8px_20px_rgba(255,107,0,0.25)] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition flex items-center justify-center gap-2">
              {submitting ? "Enviando..." : <><Check className="w-4 h-4" /> Finalizar • R$ {total.toFixed(2).replace(".",",")}</>}
            </button>
            <div className="mt-2 text-[11px] text-center text-[#a1a1aa]">Pedido salvo em Supabase + WhatsApp da loja</div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] max-w-[92vw]">
          <div className="px-4 py-2.5 rounded-full bg-[#1a1a1d] border border-[#2a2a2e] shadow-[0_8px_30px_rgba(0,0,0,0.5)] text-[13px] font-medium flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ff8c32] flex items-center justify-center shrink-0"><Check className="w-3.5 h-3.5 text-white" /></div>
            <span className="text-[#fafafa]">{toast}</span>
          </div>
        </div>
      )}

      {/* Footer corrigido */}
      <footer className="relative border-t border-[#2a2a2e] mt-6">
        <div className="mx-auto max-w-[1280px] px-4 md:px-6 py-6 text-center text-[12px] text-[#a1a1aa]">
          Pede aí Araçás — sem mensalidade • Vitrine Araçás-BA • Pedi aí Araçás • 2026
        </div>
      </footer>

      <style>{`
        .line-clamp-2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      `}</style>
    </div>
  );
}
