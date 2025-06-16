import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { useState } from "react";

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
  status: string;
  observacoes?: string;
  cliente?: Cliente;
  itens?: ItemVenda[];
};

type ItemVenda = {
  id: number;
  venda_id: number;
  produto_id: number;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  produto?: Produto;
};

type VendasStats = {
  totalVendas: number;
  vendasHoje: number;
  valorTotalMes: number;
  ticketMedio: number;
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
  const action = formData.get("_action");
  const id = formData.get("id");

  const supabase = getSupabaseClient();

  switch (action) {
    case "delete_venda":
      // Primeiro deletar os itens da venda
      await supabase.from("itens_venda").delete().eq("venda_id", id);
      // Depois deletar a venda
      const { error } = await supabase.from("vendas").delete().eq("id", id);
      
      if (error) {
        throw new Response(error.message, { status: 500 });
      }
      break;

    case "update_status":
      const status = formData.get("status");
      const { error: statusError } = await supabase
        .from("vendas")
        .update({ status })
        .eq("id", id);
      
      if (statusError) {
        throw new Response(statusError.message, { status: 500 });
      }
      break;

    default:
      throw new Response("Ação não reconhecida", { status: 400 });
  }

  return Response.json({ message: "Operação realizada com sucesso" });
}

export async function loader() {
  const supabase = getSupabaseClient();
  
  // Buscar estatísticas de vendas
  const hoje = new Date().toISOString().split('T')[0];
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  
  // Total de vendas
  const { count: totalVendas } = await supabase
    .from("vendas")
    .select("*", { count: 'exact', head: true });

  // Vendas de hoje
  const { count: vendasHoje } = await supabase
    .from("vendas")
    .select("*", { count: 'exact', head: true })
    .gte("data_venda", hoje);

  // Valor total do mês
  const { data: vendasMes } = await supabase
    .from("vendas")
    .select("valor_total")
    .gte("data_venda", inicioMes);

  const valorTotalMes = vendasMes?.reduce((sum, venda) => sum + venda.valor_total, 0) || 0;
  const ticketMedio = totalVendas > 0 ? valorTotalMes / totalVendas : 0;

  // Buscar vendas recentes com detalhes
  const { data: vendas } = await supabase
    .from("vendas")
    .select(`
      *,
      clientes(*),
      itens_venda(
        *,
        produtos(*)
      )
    `)
    .order("data_venda", { ascending: false })
    .limit(20);

  // Buscar vendas por status para o resumo
  const { data: vendasPorStatus } = await supabase
    .from("vendas")
    .select("status")
    .order("data_venda", { ascending: false });

  const statusCount = vendasPorStatus?.reduce((acc, venda) => {
    acc[venda.status] = (acc[venda.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return Response.json({ 
    vendas: vendas || [],
    stats: {
      totalVendas: totalVendas || 0,
      vendasHoje: vendasHoje || 0,
      valorTotalMes,
      ticketMedio
    } as VendasStats,
    statusCount
  });
}

export default function VendasDashboard() {
  const { vendas, stats, statusCount } = useLoaderData<{ 
    vendas: Venda[],
    stats: VendasStats,
    statusCount: Record<string, number>
  }>();

  const deleteFetcher = useFetcher();
  const statusFetcher = useFetcher();
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [expandedVenda, setExpandedVenda] = useState<number | null>(null);

  const vendasFiltradas = filtroStatus === "todos" 
    ? vendas 
    : vendas.filter(venda => venda.status === filtroStatus);

  const getStatusBadge = (status: string) => {
    const badges = {
      'pendente': 'bg-yellow-100 text-yellow-800',
      'confirmada': 'bg-blue-100 text-blue-800',
      'entregue': 'bg-green-100 text-green-800',
      'cancelada': 'bg-red-100 text-red-800'
    };
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const toggleVendaDetails = (vendaId: number) => {
    setExpandedVenda(expandedVenda === vendaId ? null : vendaId);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-slate-900 lg:text-3xl">
          Dashboard de Vendas
        </h1>
        <Button to="/vendas/new">Nova Venda</Button>
      </div>

      {/* Estatísticas de Vendas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-white rounded-xl shadow-md">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide">
            Total de Vendas
          </h3>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {stats.totalVendas}
          </p>
        </div>
        
        <div className="p-6 bg-white rounded-xl shadow-md">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide">
            Vendas Hoje
          </h3>
          <p className="text-3xl font-bold text-cyan-600 mt-2">
            {stats.vendasHoje}
          </p>
        </div>
        
        <div className="p-6 bg-white rounded-xl shadow-md">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide">
            Faturamento do Mês
          </h3>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {stats.valorTotalMes.toFixed(2)} MT
          </p>
        </div>
        
        <div className="p-6 bg-white rounded-xl shadow-md">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide">
            Ticket Médio
          </h3>
          <p className="text-3xl font-bold text-purple-600 mt-2">
            {stats.ticketMedio.toFixed(2)} MT
          </p>
        </div>
      </div>

      {/* Resumo por Status */}
      <div className="p-6 bg-white rounded-xl shadow-md">
        <h2 className="text-xl font-semibold mb-4">Resumo por Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(statusCount).map(([status, count]) => (
            <div key={status} className="text-center">
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(status)}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </div>
              <p className="text-2xl font-bold mt-2">{count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de Vendas */}
      <div className="p-6 bg-white rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Vendas Recentes</h2>
          
          {/* Filtro por Status */}
          <select 
            value={filtroStatus} 
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          >
            <option value="todos">Todos os Status</option>
            <option value="pendente">Pendente</option>
            <option value="confirmada">Confirmada</option>
            <option value="entregue">Entregue</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-4 text-left">ID</th>
                <th className="p-4 text-left">Cliente</th>
                <th className="p-4 text-left">Data</th>
                <th className="p-4 text-left">Valor Total</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {vendasFiltradas.map((venda) => (
                <>
                  <tr 
                    key={venda.id} 
                    className="border-b border-slate-200 hover:bg-slate-50 cursor-pointer"
                    onClick={() => toggleVendaDetails(venda.id)}
                  >
                    <td className="p-4 font-mono text-sm">#{venda.id}</td>
                    <td className="p-4">{venda.cliente?.nome || 'Cliente não especificado'}</td>
                    <td className="p-4">{formatDate(venda.data_venda)}</td>
                    <td className="p-4 font-semibold">{venda.valor_total.toFixed(2)} MT</td>
                    <td className="p-4">
                      <statusFetcher.Form method="POST" className="inline">
                        <input type="hidden" name="_action" value="update_status" />
                        <input type="hidden" name="id" value={venda.id} />
                        <select
                          name="status"
                          defaultValue={venda.status}
                          onChange={(e) => {
                            const form = e.target.closest('form');
                            if (form) statusFetcher.submit(form);
                          }}
                          className={`px-2 py-1 text-xs rounded-full border-none ${getStatusBadge(venda.status)}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="confirmada">Confirmada</option>
                          <option value="entregue">Entregue</option>
                          <option value="cancelada">Cancelada</option>
                        </select>
                      </statusFetcher.Form>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/vendas/${venda.id}`}
                          className="p-2 text-slate-300 hover:text-cyan-600"
                          aria-label="Ver detalhes"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ViewIcon />
                        </Link>
                        <Link
                          to={`/vendas/${venda.id}/edit`}
                          className="p-2 text-slate-300 hover:text-cyan-600"
                          aria-label="Editar"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <EditIcon />
                        </Link>
                        <deleteFetcher.Form method="POST">
                          <input type="hidden" name="_action" value="delete_venda" />
                          <input type="hidden" name="id" value={venda.id} />
                          <button
                            type="submit"
                            className="p-2 text-slate-300 hover:text-red-600"
                            aria-label="Eliminar"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!confirm('Tem certeza que deseja eliminar esta venda?')) {
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
                  
                  {/* Detalhes expandidos da venda */}
                  {expandedVenda === venda.id && venda.itens && venda.itens.length > 0 && (
                    <tr className="bg-slate-50">
                      <td colSpan={6} className="p-4">
                        <div className="space-y-3">
                          <h4 className="font-semibold text-slate-700">Itens da Venda:</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {venda.itens.map((item) => (
                              <div key={item.id} className="bg-white p-3 rounded-lg border border-slate-200">
                                <p className="font-medium text-slate-900">
                                  {item.produto?.nome || 'Produto não encontrado'}
                                </p>
                                <p className="text-sm text-slate-600">
                                  Qtd: {item.quantidade} × {item.preco_unitario?.toFixed(2) || '0.00'} MT
                                </p>
                                <p className="text-sm font-semibold text-slate-900">
                                  Subtotal: {item.subtotal.toFixed(2)} MT
                                </p>
                              </div>
                            ))}
                          </div>
                          {venda.observacoes && (
                            <div className="mt-3">
                              <h5 className="font-medium text-slate-700">Observações:</h5>
                              <p className="text-sm text-slate-600 bg-white p-2 rounded border">
                                {venda.observacoes}
                              </p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          
          {vendasFiltradas.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              Nenhuma venda encontrada para o filtro selecionado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  return <GlobalErrorBoundary />;
}