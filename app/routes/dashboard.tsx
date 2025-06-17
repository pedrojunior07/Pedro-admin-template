import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";

import Button from "~/components/Button";
import { GlobalErrorBoundary } from "~/components/GlobalErrorBoundary";
import DeleteIcon from "~/components/icons/Delete";
import EditIcon from "~/components/icons/Edit";
import ViewIcon from "~/components/icons/View";
import { formatDate } from "~/utils/formatDate";
import { getSupabaseClient } from "~/utils/getSupabaseClient";

type Cliente = {
  id: number;
  nome: string;
  nuit: string;
  telefone: string;
  endereco: string;
  created_at: string;
};

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
};

type Venda = {
  id: number;
  cliente_id: number;
  data_venda: string;
  valor_total: number;
  cliente?: Cliente;
  itens?: ItemVenda[];
};

type ItemVenda = {
  id: number;
  venda_id: number;
  produto_id: number;
  quantidade: number;
  subtotal: number;
  produto?: Produto;
};

type VendasStats = {
  totalVendas: number;
  vendasHoje: number;
  valorTotalHoje: number;
  valorTotalMes: number;
};

export const meta: MetaFunction = () => {
  return [
    {
      title: "Dashboard de Vendas | Sistema de Vendas",
    },
  ];
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get("action");
  const vendaId = formData.get("vendaId");

  const supabase = getSupabaseClient();

  if (action === "delete") {
    // Delete sale and its items (cascade will handle items)
    const { error } = await supabase
      .from("vendas")
      .delete()
      .eq("id", vendaId);

    if (error) {
      throw new Response(error.message, { status: 500 });
    }

    return Response.json({ message: "Venda eliminada com sucesso" });
  }

  return Response.json({ message: "Ação não reconhecida" });
}

export async function loader() {
  const supabase = getSupabaseClient();
  
  // Get current date for filtering
  const today = new Date();
  const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
  const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();
  
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

  // Fetch recent sales with client and items
  const { data: vendas } = await supabase
    .from("vendas")
    .select(`
      *,
      cliente:clientes(*),
      itens:itens_venda(
        *,
        produto:produtos(*)
      )
    `)
    .order("data_venda", { ascending: false })
    .limit(10);

  // Get sales statistics
  const { data: totalVendas } = await supabase
    .from("vendas")
    .select("id", { count: "exact" });

  const { data: vendasHoje } = await supabase
    .from("vendas")
    .select("id, valor_total", { count: "exact" })
    .gte("data_venda", todayStart)
    .lte("data_venda", todayEnd);

  const { data: vendasMes } = await supabase
    .from("vendas")
    .select("valor_total")
    .gte("data_venda", monthStart)
    .lte("data_venda", monthEnd);

  // Calculate totals
  const valorTotalHoje = vendasHoje?.reduce((sum, venda) => sum + Number(venda.valor_total), 0) || 0;
  const valorTotalMes = vendasMes?.reduce((sum, venda) => sum + Number(venda.valor_total), 0) || 0;

  const stats: VendasStats = {
    totalVendas: totalVendas?.length || 0,
    vendasHoje: vendasHoje?.length || 0,
    valorTotalHoje,
    valorTotalMes
  };

  return Response.json({ 
    vendas: vendas || [],
    stats
  });
}

export default function VendasDashboard() {
  const { vendas, stats } = useLoaderData<{ 
    vendas: Venda[],
    stats: VendasStats
  }>();

  const deleteFetcher = useFetcher();

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-slate-900 lg:text-3xl">
          Dashboard de Vendas
        </h1>
        <Button to="/vendas/new">Nova Venda</Button>
      </div>

      {/* Sales Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-white rounded-xl shadow-md border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Total de Vendas</p>
              <p className="text-2xl font-bold text-slate-900">{stats.totalVendas}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-xl shadow-md border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Vendas Hoje</p>
              <p className="text-2xl font-bold text-slate-900">{stats.vendasHoje}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-xl shadow-md border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Valor Hoje</p>
              <p className="text-2xl font-bold text-slate-900">{stats.valorTotalHoje.toFixed(2)} MT</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-xl shadow-md border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Valor do Mês</p>
              <p className="text-2xl font-bold text-slate-900">{stats.valorTotalMes.toFixed(2)} MT</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sales Table */}
      <div className="p-6 bg-white rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Vendas Recentes</h2>
          <div className="flex gap-3">
            <Link 
              to="/vendas" 
              className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              Ver Todas
            </Link>
            <Button to="/vendas/new">Nova Venda</Button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-4 text-left font-medium text-slate-700">ID</th>
                <th className="p-4 text-left font-medium text-slate-700">Cliente</th>
                <th className="p-4 text-left font-medium text-slate-700">Data</th>
                <th className="p-4 text-left font-medium text-slate-700">Itens</th>
                <th className="p-4 text-left font-medium text-slate-700">Valor Total</th>
                <th className="p-4 text-right font-medium text-slate-700">Ações</th>
              </tr>
            </thead>
            <tbody>
              {vendas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Nenhuma venda encontrada
                  </td>
                </tr>
              ) : (
                vendas.map((venda) => (
                  <tr key={venda.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-4 font-medium text-slate-900">#{venda.id}</td>
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-slate-900">
                          {venda.cliente?.nome || 'Cliente não especificado'}
                        </p>
                        {venda.cliente?.telefone && (
                          <p className="text-sm text-slate-500">{venda.cliente.telefone}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-slate-600">
                      {formatDate(venda.data_venda)}
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        {venda.itens && venda.itens.length > 0 ? (
                          <div className="space-y-1">
                            {venda.itens.slice(0, 2).map((item) => (
                              <div key={item.id} className="text-slate-600">
                                {item.produto?.nome || 'Produto'} x{item.quantidade}
                              </div>
                            ))}
                            {venda.itens.length > 2 && (
                              <div className="text-slate-400">
                                +{venda.itens.length - 2} mais
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">Sem itens</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-semibold text-green-600">
                        {Number(venda.valor_total).toFixed(2)} MT
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/vendas/${venda.id}`}
                          className="p-2 text-slate-400 hover:text-cyan-600 transition-colors"
                          title="Ver detalhes"
                        >
                          <ViewIcon />
                        </Link>
                        <Link
                          to={`/vendas/${venda.id}/edit`}
                          className="p-2 text-slate-400 hover:text-yellow-600 transition-colors"
                          title="Editar venda"
                        >
                          <EditIcon />
                        </Link>
                        <deleteFetcher.Form method="POST">
                          <input type="hidden" name="action" value="delete" />
                          <input type="hidden" name="vendaId" value={venda.id} />
                          <button
                            type="submit"
                            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                            title="Eliminar venda"
                            onClick={(e) => {
                              if (!confirm('Tem certeza que deseja eliminar esta venda? Esta ação não pode ser desfeita.')) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <DeleteIcon />
                          </button>
                        </deleteFetcher.Form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/vendas/new"
          className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl shadow-md hover:from-blue-600 hover:to-blue-700 transition-all duration-200 transform hover:scale-105"
        >
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Nova Venda</h3>
            <p className="text-blue-100">Registrar uma nova venda</p>
          </div>
        </Link>

        <Link
          to="/vendas"
          className="p-6 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl shadow-md hover:from-green-600 hover:to-green-700 transition-all duration-200 transform hover:scale-105"
        >
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Todas as Vendas</h3>
            <p className="text-green-100">Ver histórico completo</p>
          </div>
        </Link>
 
        <Link
          to="/vendas/relatorios"
          className="p-6 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl shadow-md hover:from-purple-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105"
        >
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Relatórios</h3>
            <p className="text-purple-100">Análises e estatísticas</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  return <GlobalErrorBoundary />;
}