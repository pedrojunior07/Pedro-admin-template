import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";

// Components
import Button from "~/components/Button";
import { GlobalErrorBoundary } from "~/components/GlobalErrorBoundary";
import DeleteIcon from "~/components/icons/Delete";
import EditIcon from "~/components/icons/Edit";
import ViewIcon from "~/components/icons/View";
import StatusBadge from "~/components/StatusBadge";
import MobileTable from "~/components/MobileTable";
import { formatDate } from "~/utils/formatDate";
import { getSupabaseClient } from "~/utils/getSupabaseClient";

// Tipos com propriedades opcionais para segurança
type Produto = {
  id?: number;
  nome?: string;
  preco?: number;
  quantidade?: number;
  categoria?: string;
  fabricante?: string;
  status?: boolean;
  // outras propriedades...
};

type Venda = {
  id?: number;
  cliente_nome?: string;
  data_venda?: string;
  valor_total?: number;
  metodo_pagamento?: string;
  itens?: Array<{
    produto_nome?: string;
    quantidade?: number;
    preco_unitario?: number;
  }>;
};

type Usuario = {
  id?: number;
  nome?: string;
  email?: string;
  role?: "admin" | "farmaceutico" | "caixa";
  status?: boolean;
  last_login?: string;
};

type Estatisticas = {
  totalVendasHoje?: number;
  totalReceitaHoje?: number;
  produtosBaixoEstoque?: number;
  produtosMaisVendidos?: Produto[];
};

export const meta: MetaFunction = () => {
  return [{ title: "Painel de Controlo | Farmácia" }];
};

// Função auxiliar segura para converter para string
const safeString = (value: any): string => {
  if (value === undefined || value === null) return '';
  return String(value);
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  
  // Obter valores com segurança
  const actionType = safeString(formData.get("actionType"));
  const table = safeString(formData.get("table"));
  const id = safeString(formData.get("id"));
  const status = formData.get("status");

  if (!actionType || !table || !id) {
    return Response.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  try {
    if (actionType === "delete") {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      return Response.json({ message: "Item eliminado com sucesso" });
    }

    if (actionType === "toggleStatus") {
      const newStatus = status?.toString() !== "true";
      const { error } = await supabase
        .from(table)
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
      return Response.json({ message: "Status atualizado", newStatus });
    }

    return Response.json({ message: "Ação inválida" }, { status: 400 });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

export async function loader() {
  const supabase = getSupabaseClient();
  const hoje = new Date().toISOString().split('T')[0];

  try {
    // Consultas com tratamento de erro
    const [
      vendasHoje,
      receitaHoje,
      produtosBaixoEstoque,
      recentProdutos,
      recentVendas,
      recentUsuarios,
      produtosMaisVendidos
    ] = await Promise.all([
      supabase.from("vendas").select("*", { count: 'exact' })
        .gte("data_venda", `${hoje}T00:00:00`)
        .lte("data_venda", `${hoje}T23:59:59`),
      supabase.from("vendas").select("valor_total")
        .gte("data_venda", `${hoje}T00:00:00`)
        .lte("data_venda", `${hoje}T23:59:59`),
      supabase.from("produtos").select("*", { count: 'exact' })
        .lt("quantidade", 10).eq("status", true),
      supabase.from("produtos").select("*").order("created_at", { ascending: false }).limit(5),
      supabase.from("vendas").select("*, itens_venda:itens_venda(produto_nome, quantidade, preco_unitario)")
        .order("data_venda", { ascending: false }).limit(5),
      supabase.from("usuarios").select("*").order("last_login", { ascending: false }).limit(5),
      supabase.from("produtos").select("*, vendas:itens_venda(quantidade)")
        .order("vendas.quantidade", { ascending: false, foreignTable: "itens_venda" }).limit(3)
    ]);

    const totalReceitaHoje = receitaHoje.data?.reduce((acc, venda) => acc + (venda.valor_total || 0), 0) || 0;

    return Response.json({
      estatisticas: {
        totalVendasHoje: vendasHoje.count || 0,
        totalReceitaHoje,
        produtosBaixoEstoque: produtosBaixoEstoque.count || 0,
        produtosMaisVendidos: produtosMaisVendidos.data || []
      },
      recentProdutos: recentProdutos.data || [],
      recentVendas: recentVendas.data || [],
      recentUsuarios: recentUsuarios.data || []
    });
  } catch (error) {
    console.error("Erro no loader:", error);
    return Response.json({
      estatisticas: {
        totalVendasHoje: 0,
        totalReceitaHoje: 0,
        produtosBaixoEstoque: 0,
        produtosMaisVendidos: []
      },
      recentProdutos: [],
      recentVendas: [],
      recentUsuarios: []
    });
  }
}

export default function Dashboard() {
  const { 
    estatisticas = {
      totalVendasHoje: 0,
      totalReceitaHoje: 0,
      produtosBaixoEstoque: 0,
      produtosMaisVendidos: []
    },
    recentProdutos = [], 
    recentVendas = [], 
    recentUsuarios = [] 
  } = useLoaderData<{
    estatisticas?: Estatisticas;
    recentProdutos?: Produto[];
    recentVendas?: Venda[];
    recentUsuarios?: Usuario[];
  }>();

  const fetcher = useFetcher();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleToggleStatus = (table: string, id?: number, currentStatus?: boolean) => {
    if (!id || currentStatus === undefined) return;
    
    fetcher.submit(
      {
        actionType: "toggleStatus",
        table,
        id: safeString(id),
        status: safeString(currentStatus)
      },
      { method: "POST" }
    );
  };

  const translateRole = (role?: string) => {
    const roles: Record<string, string> = {
      admin: "Administrador",
      farmaceutico: "Farmacêutico",
      caixa: "Caixa"
    };
    return role ? roles[role] || role : "Não definido";
  };

  const formatMZN = (value?: number) => {
    return new Intl.NumberFormat('pt-MZ', {
      style: 'currency',
      currency: 'MZN',
      minimumFractionDigits: 2
    }).format(value || 0);
  };

  // Renderização segura de componentes
  const renderProdutoRow = (produto?: Produto) => {
    if (!produto) return null;
    
    return (
      <tr key={produto.id || Math.random()} className="hover:bg-gray-50">
        <td className="p-3 whitespace-nowrap">
          <div className="font-medium">{produto.nome || "Sem nome"}</div>
          <div className="text-xs text-gray-500">{produto.fabricante || "Sem fabricante"}</div>
        </td>
        <td className="p-3 whitespace-nowrap font-medium">{formatMZN(produto.preco)}</td>
        <td className="p-3 whitespace-nowrap">
          <span className={`px-2 py-1 text-xs rounded-full ${
            (produto.quantidade || 0) < 10 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
          }`}>
            {produto.quantidade || 0} unid.
          </span>
        </td>
        <td className="p-3 whitespace-nowrap text-gray-600">{produto.categoria || '-'}</td>
        <td className="p-3 whitespace-nowrap">
          <StatusBadge status={produto.status || false} />
        </td>
        <td className="p-3 whitespace-nowrap text-right">
          {produto.id && (
            <div className="flex justify-end gap-1">
              <Link
                to={`/produtos/${produto.id}/editar`}
                className="inline-flex p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                aria-label="Editar"
              >
                <EditIcon className="w-5 h-5" />
              </Link>
              <fetcher.Form method="POST">
                <input type="hidden" name="actionType" value="toggleStatus" />
                <input type="hidden" name="table" value="produtos" />
                <input type="hidden" name="id" value={safeString(produto.id)} />
                <input type="hidden" name="status" value={safeString(produto.status)} />
                <button
                  type="submit"
                  className="inline-flex p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                  aria-label={produto.status ? "Desativar" : "Ativar"}
                >
                  {produto.status ? (
                    <span className="text-red-600 text-sm">Desativar</span>
                  ) : (
                    <span className="text-green-600 text-sm">Ativar</span>
                  )}
                </button>
              </fetcher.Form>
            </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel de Controlo</h1>
          <p className="text-gray-600">Bem-vinda à gestão da sua farmácia</p>
        </div>
        <div className="text-sm bg-blue-50 text-blue-800 px-4 py-2 rounded-full">
          {new Date().toLocaleDateString('pt-MZ', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Vendas Hoje" 
          value={estatisticas.totalVendasHoje || 0} 
          icon="📊"
          trend="up"
          trendValue="5%"
        />
        <StatCard 
          title="Receita Hoje" 
          value={formatMZN(estatisticas.totalReceitaHoje)} 
          icon="💰"
          trend="up"
          trendValue="12%"
        />
        <StatCard 
          title="Produtos com Baixo Stock" 
          value={estatisticas.produtosBaixoEstoque || 0} 
          icon="⚠️"
          trend="down"
          trendValue="3%"
          warning={(estatisticas.produtosBaixoEstoque || 0) > 0}
        />
        <StatCard 
          title="Produtos Populares" 
          value={estatisticas.produtosMaisVendidos?.length || 0} 
          icon="🔥"
          trend="neutral"
        />
      </div>

      {/* Seção de Vendas Recentes */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="flex justify-between items-center p-4 md:p-6 border-b">
          <h2 className="font-semibold text-lg md:text-xl">Vendas Recentes</h2>
          <Button to="/vendas/nova" size="sm">Nova Venda</Button>
        </div>
        
        {isMobile ? (
          <MobileTable
            data={recentVendas}
            renderItem={(venda) => (
              venda ? (
                <div className="py-3 border-b">
                  <div className="flex justify-between">
                    <span className="font-medium">{venda.cliente_nome || "Cliente não especificado"}</span>
                    <span className="text-blue-600">{formatMZN(venda.valor_total)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 mt-1">
                    <span>{venda.data_venda ? formatDate(venda.data_venda) : "Data não disponível"}</span>
                    <span>{venda.metodo_pagamento || "Desconhecido"}</span>
                  </div>
                  {venda.id && (
                    <div className="mt-2">
                      <Link 
                        to={`/vendas/${venda.id}`} 
                        className="text-blue-600 text-sm flex items-center gap-1"
                      >
                        <ViewIcon className="w-4 h-4" /> Ver detalhes
                      </Link>
                    </div>
                  )}
                </div>
              ) : null
            )}
            emptyMessage="Nenhuma venda recente"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Cliente</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Data</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Método</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Valor</th>
                  <th className="p-3 text-right text-sm font-medium text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentVendas.map(venda => (
                  venda ? (
                    <tr key={venda.id || Math.random()} className="hover:bg-gray-50">
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-medium">{venda.cliente_nome || "Cliente não especificado"}</div>
                      </td>
                      <td className="p-3 whitespace-nowrap text-gray-600">
                        {venda.data_venda ? formatDate(venda.data_venda) : "Data não disponível"}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                          {venda.metodo_pagamento || "Desconhecido"}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap font-medium text-blue-600">
                        {formatMZN(venda.valor_total)}
                      </td>
                      <td className="p-3 whitespace-nowrap text-right">
                        {venda.id && (
                          <Link
                            to={`/vendas/${venda.id}`}
                            className="inline-flex p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                            aria-label="Ver detalhes"
                          >
                            <ViewIcon className="w-5 h-5" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  ) : null
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Seção de Produtos e Usuários */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Produtos Recentes */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="flex justify-between items-center p-4 md:p-6 border-b">
            <h2 className="font-semibold text-lg md:text-xl">Stock de Produtos</h2>
            <Button to="/produtos/novo" size="sm">Adicionar Produto</Button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Produto</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Preço</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Stock</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Categoria</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Status</th>
                  <th className="p-3 text-right text-sm font-medium text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentProdutos.length > 0 ? (
                  recentProdutos.map(renderProdutoRow)
                ) : (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-gray-500">
                      Nenhum produto cadastrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Usuários Recentes */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="flex justify-between items-center p-4 md:p-6 border-b">
            <h2 className="font-semibold text-lg md:text-xl">Equipa</h2>
            <Button to="/usuarios/novo" size="sm">Adicionar Usuário</Button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Nome</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Email</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Função</th>
                  <th className="p-3 text-left text-sm font-medium text-gray-500">Status</th>
                  <th className="p-3 text-right text-sm font-medium text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentUsuarios.length > 0 ? (
                  recentUsuarios.map(usuario => (
                    usuario ? (
                      <tr key={usuario.id || Math.random()} className="hover:bg-gray-50">
                        <td className="p-3 whitespace-nowrap font-medium">
                          {usuario.nome || "Usuário sem nome"}
                        </td>
                        <td className="p-3 whitespace-nowrap text-gray-600">
                          {usuario.email || "Sem email"}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                            {translateRole(usuario.role)}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <StatusBadge status={usuario.status || false} />
                        </td>
                        <td className="p-3 whitespace-nowrap text-right">
                          {usuario.id && (
                            <div className="flex justify-end gap-1">
                              <Link
                                to={`/usuarios/${usuario.id}/editar`}
                                className="inline-flex p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                                aria-label="Editar"
                              >
                                <EditIcon className="w-5 h-5" />
                              </Link>
                              <fetcher.Form method="POST">
                                <input type="hidden" name="actionType" value="toggleStatus" />
                                <input type="hidden" name="table" value="usuarios" />
                                <input type="hidden" name="id" value={safeString(usuario.id)} />
                                <input type="hidden" name="status" value={safeString(usuario.status)} />
                                <button
                                  type="submit"
                                  className="inline-flex p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                                  aria-label={usuario.status ? "Desativar" : "Ativar"}
                                >
                                  {usuario.status ? (
                                    <span className="text-red-600 text-sm">Desativar</span>
                                  ) : (
                                    <span className="text-green-600 text-sm">Ativar</span>
                                  )}
                                </button>
                              </fetcher.Form>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : null
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-gray-500">
                      Nenhum usuário cadastrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente StatCard com TypeScript
function StatCard({ 
  title, 
  value, 
  icon, 
  trend, 
  trendValue,
  warning = false
}: {
  title: string;
  value: string | number;
  icon: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  warning?: boolean;
}) {
  const trendColors = {
    up: "text-green-600 bg-green-100",
    down: "text-red-600 bg-red-100",
    neutral: "text-gray-600 bg-gray-100"
  };

  return (
    <div className={`bg-white rounded-xl shadow p-4 ${warning ? 'border-l-4 border-red-500' : ''}`}>
      <div className="flex justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
        </div>
        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${trendColors[trend]}`}>
            {trend === "up" && "↑"}
            {trend === "down" && "↓"}
            {trend === "neutral" && "→"}
            {trendValue}
          </span>
          <span className="ml-2 text-xs text-gray-500">vs. ontem</span>
        </div>
      )}
    </div>
  );
}

export function ErrorBoundary() {
  return <GlobalErrorBoundary />;
}