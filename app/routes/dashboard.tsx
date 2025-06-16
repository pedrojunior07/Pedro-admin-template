import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";

// Components
import Button from "~/components/Button";
import { GlobalErrorBoundary } from "~/components/GlobalErrorBoundary";
import DeleteIcon from "~/components/icons/Delete";
import EditIcon from "~/components/icons/Edit";
import ViewIcon from "~/components/icons/View";
import StatusBadge from "../components/StatusBadge";
import MobileTable from "../components/MobileTable";
import { formatCurrency } from "./formatCurrency";
import { formatDate } from "~/utils/formatDate";
import { getSupabaseClient } from "~/utils/getSupabaseClient";

// Types
type Produto = {
  id: number;
  nome: string;
  descricao: string;
  preco: number;
  quantidade: number;
  fabricante: string;
  categoria: string;
  imagem_url: string;
  created_at: string;
  status: boolean;
};

type Venda = {
  id: number;
  cliente_nome: string;
  data_venda: string;
  valor_total: number;
  metodo_pagamento: string;
  itens: {
    produto_nome: string;
    quantidade: number;
    preco_unitario: number;
  }[];
};

type Usuario = {
  id: number;
  nome: string;
  email: string;
  role: "admin" | "farmaceutico" | "caixa";
  status: boolean;
  last_login: string;
};

type Estatisticas = {
  totalVendasHoje: number;
  totalReceitaHoje: number;
  produtosBaixoEstoque: number;
  produtosMaisVendidos: Produto[];
};

export const meta: MetaFunction = () => {
  return [
    {
      title: "Painel de Controlo | Farmácia",
    },
  ];
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("actionType");
  const table = formData.get("table");
  const id = formData.get("id");
  const status = formData.get("status");

  const supabase = getSupabaseClient();

  if (actionType === "delete") {
    const { error } = await supabase.from(table).delete().eq("id", id);

    if (error) {
      throw new Response(error.message, { status: 500 });
    }

    return Response.json({ message: "Item eliminado com sucesso" });
  }

  if (actionType === "toggleStatus") {
    const { error } = await supabase
      .from(table)
      .update({ status: status === "true" ? false : true })
      .eq("id", id);

    if (error) {
      throw new Response(error.message, { status: 500 });
    }

    return Response.json({ 
      message: "Status atualizado com sucesso",
      newStatus: status === "true" ? false : true
    });
  }

  return Response.json({ message: "Ação inválida" }, { status: 400 });
}

export async function loader() {
  const supabase = getSupabaseClient();
  
  // Data de hoje
  const hoje = new Date().toISOString().split('T')[0];
  
  // Estatísticas
  const { count: totalVendasHoje } = await supabase
    .from("vendas")
    .select("*", { count: 'exact' })
    .gte("data_venda", `${hoje}T00:00:00`)
    .lte("data_venda", `${hoje}T23:59:59`);

  const { data: receitaHojeData } = await supabase
    .from("vendas")
    .select("valor_total")
    .gte("data_venda", `${hoje}T00:00:00`)
    .lte("data_venda", `${hoje}T23:59:59`);

  const totalReceitaHoje = receitaHojeData?.reduce((acc, venda) => acc + venda.valor_total, 0) || 0;

  const { count: produtosBaixoEstoque } = await supabase
    .from("produtos")
    .select("*", { count: 'exact' })
    .lt("quantidade", 10)
    .eq("status", true);

  // Dados recentes
  const { data: recentProdutos } = await supabase
    .from("produtos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: recentVendas } = await supabase
    .from("vendas")
    .select("*, itens_venda:itens_venda(produto_nome, quantidade, preco_unitario)")
    .order("data_venda", { ascending: false })
    .limit(5);

  const { data: recentUsuarios } = await supabase
    .from("usuarios")
    .select("*")
    .order("last_login", { ascending: false })
    .limit(5);

  // Produtos mais vendidos (simplificado)
  const { data: produtosMaisVendidos } = await supabase
    .from("produtos")
    .select("*, vendas:itens_venda(quantidade)")
    .order("vendas.quantidade", { ascending: false, foreignTable: "itens_venda" })
    .limit(3);

  return Response.json({ 
    estatisticas: {
      totalVendasHoje: totalVendasHoje || 0,
      totalReceitaHoje,
      produtosBaixoEstoque: produtosBaixoEstoque || 0,
      produtosMaisVendidos: produtosMaisVendidos || []
    },
    recentProdutos: recentProdutos || [],
    recentVendas: recentVendas || [],
    recentUsuarios: recentUsuarios || []
  });
}

export default function Dashboard() {
  const { 
    estatisticas,
    recentProdutos, 
    recentVendas, 
    recentUsuarios 
  } = useLoaderData<{ 
    estatisticas: Estatisticas,
    recentProdutos: Produto[],
    recentVendas: Venda[],
    recentUsuarios: Usuario[]
  }>();

  const fetcher = useFetcher();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleToggleStatus = (table: string, id: number, currentStatus: boolean) => {
    fetcher.submit(
      {
        actionType: "toggleStatus",
        table,
        id: id.toString(),
        status: currentStatus.toString()
      },
      { method: "POST" }
    );
  };

  // Função para traduzir roles
  const translateRole = (role: string) => {
    const roles: Record<string, string> = {
      admin: "Administrador",
      farmaceutico: "Farmacêutico",
      caixa: "Caixa"
    };
    return roles[role] || role;
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
          {new Date().toLocaleDateString('pt-MZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Vendas Hoje" 
          value={estatisticas.totalVendasHoje} 
          icon="📊"
          trend="up"
          trendValue="5%"
        />
        <StatCard 
          title="Receita Hoje" 
          value={formatCurrency(estatisticas.totalReceitaHoje, 'MZN')} 
          icon="💰"
          trend="up"
          trendValue="12%"
        />
        <StatCard 
          title="Produtos com Baixo Stock" 
          value={estatisticas.produtosBaixoEstoque} 
          icon="⚠️"
          trend="down"
          trendValue="3%"
          warning={estatisticas.produtosBaixoEstoque > 0}
        />
        <StatCard 
          title="Produtos Populares" 
          value={estatisticas.produtosMaisVendidos.length} 
          icon="🔥"
          trend="neutral"
        />
      </div>

      {/* Produtos em Destaque (Mobile) */}
      {isMobile && (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold text-lg mb-3">Produtos em Destaque</h2>
          <div className="space-y-3">
            {estatisticas.produtosMaisVendidos.map((produto) => (
              <div key={produto.id} className="flex items-center gap-3 p-2 border-b">
                <div className="bg-blue-100 rounded-lg w-12 h-12 flex items-center justify-center text-blue-800">
                  {produto.nome.charAt(0)}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{produto.nome}</h3>
                  <p className="text-sm text-gray-600">{formatCurrency(produto.preco, 'MZN')}</p>
                </div>
                <StatusBadge status={produto.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seção de Vendas Recentes */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="flex justify-between items-center p-4 md:p-6 border-b">
          <h2 className="font-semibold text-lg md:text-xl">Vendas Recentes</h2>
          <Button to="/vendas/nova" size="sm">
            Nova Venda
          </Button>
        </div>
        
        {isMobile ? (
          <MobileTable
            data={recentVendas}
            renderItem={(venda) => (
              <div className="py-3 border-b">
                <div className="flex justify-between">
                  <span className="font-medium">{venda.cliente_nome || "Cliente não especificado"}</span>
                  <span className="text-blue-600">{formatCurrency(venda.valor_total, 'MZN')}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600 mt-1">
                  <span>{formatDate(venda.data_venda)}</span>
                  <span>{venda.metodo_pagamento || "Desconhecido"}</span>
                </div>
                <div className="mt-2">
                  <Link 
                    to={`/vendas/${venda.id}`} 
                    className="text-blue-600 text-sm flex items-center gap-1"
                  >
                    <ViewIcon className="w-4 h-4" /> Ver detalhes
                  </Link>
                </div>
              </div>
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
                {recentVendas.map((venda) => (
                  <tr key={venda.id} className="hover:bg-gray-50">
                    <td className="p-3 whitespace-nowrap">
                      <div className="font-medium">{venda.cliente_nome || "Cliente não especificado"}</div>
                    </td>
                    <td className="p-3 whitespace-nowrap text-gray-600">
                      {formatDate(venda.data_venda)}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                        {venda.metodo_pagamento || "Desconhecido"}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap font-medium text-blue-600">
                      {formatCurrency(venda.valor_total, 'MZN')}
                    </td>
                    <td className="p-3 whitespace-nowrap text-right">
                      <Link
                        to={`/vendas/${venda.id}`}
                        className="inline-flex p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                        aria-label="Ver detalhes"
                      >
                        <ViewIcon className="w-5 h-5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Seção de Produtos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Produtos Recentes */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="flex justify-between items-center p-4 md:p-6 border-b">
            <h2 className="font-semibold text-lg md:text-xl">Stock de Produtos</h2>
            <Button to="/produtos/novo" size="sm">
              Adicionar Produto
            </Button>
          </div>
          
          {isMobile ? (
            <MobileTable
              data={recentProdutos}
              renderItem={(produto) => (
                <div className="py-3 border-b">
                  <div className="flex justify-between">
                    <span className="font-medium">{produto.nome}</span>
                    <span className="text-blue-600">{formatCurrency(produto.preco, 'MZN')}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 mt-1">
                    <span>Qtd: {produto.quantidade}</span>
                    <span>{produto.categoria || "Sem categoria"}</span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <StatusBadge status={produto.status} />
                    <div className="flex gap-2">
                      <Link 
                        to={`/produtos/${produto.id}/editar`} 
                        className="text-gray-600 text-sm flex items-center gap-1"
                      >
                        <EditIcon className="w-4 h-4" />
                      </Link>
                      <fetcher.Form method="POST">
                        <input type="hidden" name="actionType" value="toggleStatus" />
                        <input type="hidden" name="table" value="produtos" />
                        <input type="hidden" name="id" value={produto.id} />
                        <input type="hidden" name="status" value={produto.status.toString()} />
                        <button
                          type="submit"
                          className="text-gray-600 text-sm flex items-center gap-1"
                          aria-label={produto.status ? "Desativar" : "Ativar"}
                        >
                          {produto.status ? (
                            <span className="text-red-600">Desativar</span>
                          ) : (
                            <span className="text-green-600">Ativar</span>
                          )}
                        </button>
                      </fetcher.Form>
                    </div>
                  </div>
                </div>
              )}
              emptyMessage="Nenhum produto cadastrado"
            />
          ) : (
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
                  {recentProdutos.map((produto) => (
                    <tr key={produto.id} className="hover:bg-gray-50">
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-medium">{produto.nome}</div>
                        <div className="text-xs text-gray-500">{produto.fabricante}</div>
                      </td>
                      <td className="p-3 whitespace-nowrap font-medium">
                        {formatCurrency(produto.preco, 'MZN')}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          produto.quantidade < 10 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {produto.quantidade} unid.
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap text-gray-600">
                        {produto.categoria || '-'}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <StatusBadge status={produto.status} />
                      </td>
                      <td className="p-3 whitespace-nowrap text-right">
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
                            <input type="hidden" name="id" value={produto.id} />
                            <input type="hidden" name="status" value={produto.status.toString()} />
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Usuários Recentes */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="flex justify-between items-center p-4 md:p-6 border-b">
            <h2 className="font-semibold text-lg md:text-xl">Equipa</h2>
            <Button to="/usuarios/novo" size="sm">
              Adicionar Usuário
            </Button>
          </div>
          
          {isMobile ? (
            <MobileTable
              data={recentUsuarios}
              renderItem={(usuario) => (
                <div className="py-3 border-b">
                  <div className="flex justify-between">
                    <span className="font-medium">{usuario.nome}</span>
                    <span className="text-gray-600">{translateRole(usuario.role)}</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{usuario.email}</div>
                  <div className="mt-2 flex justify-between">
                    <StatusBadge status={usuario.status} />
                    <div className="flex gap-2">
                      <Link 
                        to={`/usuarios/${usuario.id}/editar`} 
                        className="text-gray-600 text-sm flex items-center gap-1"
                      >
                        <EditIcon className="w-4 h-4" />
                      </Link>
                      <fetcher.Form method="POST">
                        <input type="hidden" name="actionType" value="toggleStatus" />
                        <input type="hidden" name="table" value="usuarios" />
                        <input type="hidden" name="id" value={usuario.id} />
                        <input type="hidden" name="status" value={usuario.status.toString()} />
                        <button
                          type="submit"
                          className="text-gray-600 text-sm flex items-center gap-1"
                          aria-label={usuario.status ? "Desativar" : "Ativar"}
                        >
                          {usuario.status ? (
                            <span className="text-red-600">Desativar</span>
                          ) : (
                            <span className="text-green-600">Ativar</span>
                          )}
                        </button>
                      </fetcher.Form>
                    </div>
                  </div>
                </div>
              )}
              emptyMessage="Nenhum usuário cadastrado"
            />
          ) : (
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
                  {recentUsuarios.map((usuario) => (
                    <tr key={usuario.id} className="hover:bg-gray-50">
                      <td className="p-3 whitespace-nowrap font-medium">
                        {usuario.nome}
                      </td>
                      <td className="p-3 whitespace-nowrap text-gray-600">
                        {usuario.email}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                          {translateRole(usuario.role)}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <StatusBadge status={usuario.status} />
                      </td>
                      <td className="p-3 whitespace-nowrap text-right">
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
                            <input type="hidden" name="id" value={usuario.id} />
                            <input type="hidden" name="status" value={usuario.status.toString()} />
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Componente para cartões de estatística
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