import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";

import Button from "~/components/Button";
import { GlobalErrorBoundary } from "~/components/GlobalErrorBoundary";
import DeleteIcon from "~/components/icons/Delete";
import EditIcon from "~/components/icons/Edit";
import ViewIcon from "~/components/icons/View";
import { formatDate } from "~/utils/formatDate";
import { getInitials } from "~/utils/getInitials";
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

type Usuario = {
  id: number;
  username: string;
  role: string;
  status: boolean;
  email: string;
  created_at: string;
};

export const meta: MetaFunction = () => {
  return [
    {
      title: "Dashboard | Sistema de Vendas",
    },
  ];
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const table = formData.get("table");
  const id = formData.get("id");

  const supabase = getSupabaseClient();
  const { error } = await supabase.from(table).delete().eq("id", id);

  if (error) {
    throw new Response(error.message, { status: 500 });
  }

  return Response.json({ message: "Item deleted successfully" });
}

export async function loader() {
  const supabase = getSupabaseClient();
  
  // Fetch all tables data
  const { data: clientes } = await supabase
    .from("clientes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: produtos } = await supabase
    .from("produtos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: vendas } = await supabase
    .from("vendas")
    .select("*, clientes(*)")
    .order("data_venda", { ascending: false })
    .limit(5);

  const { data: usuarios } = await supabase
    .from("usuarios")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  return Response.json({ 
    recentClientes: clientes || [],
    recentProdutos: produtos || [],
    recentVendas: vendas || [],
    recentUsuarios: usuarios || []
  });
}

export default function Dashboard() {
  const { 
    recentClientes, 
    recentProdutos, 
    recentVendas, 
    recentUsuarios 
  } = useLoaderData<{ 
    recentClientes: Cliente[],
    recentProdutos: Produto[],
    recentVendas: Venda[],
    recentUsuarios: Usuario[]
  }>();

  const deleteFetcher = useFetcher();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900 lg:text-3xl">
        Dashboard
      </h1>

      {/* Recent Clients Section */}
      <div className="p-6 bg-white rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Clientes Recentes</h2>
          <Button to="/clientes/new">Adicionar Cliente</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-4 text-left">Nome</th>
                <th className="p-4 text-left">Telefone</th>
                <th className="p-4 text-left">NUIT</th>
                <th className="p-4 text-left">Criado em</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {recentClientes.map((cliente) => (
                <tr key={cliente.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="p-4">{cliente.nome}</td>
                  <td className="p-4">{cliente.telefone || '-'}</td>
                  <td className="p-4">{cliente.nuit || '-'}</td>
                  <td className="p-4">{formatDate(cliente.created_at)}</td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/clientes/${cliente.id}`}
                        className="p-2 text-slate-300 hover:text-cyan-600"
                        aria-label="Ver detalhes"
                      >
                        <ViewIcon />
                      </Link>
                      <Link
                        to={`/clientes/${cliente.id}/edit`}
                        className="p-2 text-slate-300 hover:text-cyan-600"
                        aria-label="Editar"
                      >
                        <EditIcon />
                      </Link>
                      <deleteFetcher.Form method="POST">
                        <input type="hidden" name="table" value="clientes" />
                        <input type="hidden" name="id" value={cliente.id} />
                        <button
                          type="submit"
                          className="p-2 text-slate-300 hover:text-cyan-600"
                          aria-label="Eliminar"
                        >
                          <DeleteIcon />
                        </button>
                      </deleteFetcher.Form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Products Section */}
      <div className="p-6 bg-white rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Produtos Recentes</h2>
          <Button to="/produtos/new">Adicionar Produto</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-4 text-left">Nome</th>
                <th className="p-4 text-left">Preço</th>
                <th className="p-4 text-left">Quantidade</th>
                <th className="p-4 text-left">Categoria</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {recentProdutos.map((produto) => (
                <tr key={produto.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="p-4">{produto.nome}</td>
                  <td className="p-4">{produto.preco.toFixed(2)}</td>
                  <td className="p-4">{produto.quantidade}</td>
                  <td className="p-4">{produto.categoria || '-'}</td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/produtos/${produto.id}`}
                        className="p-2 text-slate-300 hover:text-cyan-600"
                        aria-label="Ver detalhes"
                      >
                        <ViewIcon />
                      </Link>
                      <Link
                        to={`/produtos/${produto.id}/edit`}
                        className="p-2 text-slate-300 hover:text-cyan-600"
                        aria-label="Editar"
                      >
                        <EditIcon />
                      </Link>
                      <deleteFetcher.Form method="POST">
                        <input type="hidden" name="table" value="produtos" />
                        <input type="hidden" name="id" value={produto.id} />
                        <button
                          type="submit"
                          className="p-2 text-slate-300 hover:text-cyan-600"
                          aria-label="Eliminar"
                        >
                          <DeleteIcon />
                        </button>
                      </deleteFetcher.Form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Sales Section */}
      <div className="p-6 bg-white rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Vendas Recentes</h2>
          <Button to="/vendas/new">Nova Venda</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-4 text-left">Cliente</th>
                <th className="p-4 text-left">Data</th>
                <th className="p-4 text-left">Valor Total</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {recentVendas.map((venda) => (
                <tr key={venda.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="p-4">{venda.cliente?.nome || 'Cliente não especificado'}</td>
                  <td className="p-4">{formatDate(venda.data_venda)}</td>
                  <td className="p-4">{venda.valor_total.toFixed(2)}</td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/vendas/${venda.id}`}
                        className="p-2 text-slate-300 hover:text-cyan-600"
                        aria-label="Ver detalhes"
                      >
                        <ViewIcon />
                      </Link>
                      <deleteFetcher.Form method="POST">
                        <input type="hidden" name="table" value="vendas" />
                        <input type="hidden" name="id" value={venda.id} />
                        <button
                          type="submit"
                          className="p-2 text-slate-300 hover:text-cyan-600"
                          aria-label="Eliminar"
                        >
                          <DeleteIcon />
                        </button>
                      </deleteFetcher.Form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Users Section */}
      <div className="p-6 bg-white rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Usuários Recentes</h2>
          <Button to="/usuarios/new">Adicionar Usuário</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-4 text-left">Username</th>
                <th className="p-4 text-left">Email</th>
                <th className="p-4 text-left">Role</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {recentUsuarios.map((usuario) => (
                <tr key={usuario.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="p-4">{usuario.username}</td>
                  <td className="p-4">{usuario.email || '-'}</td>
                  <td className="p-4">{usuario.role}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      usuario.status ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {usuario.status ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/usuarios/${usuario.id}/edit`}
                        className="p-2 text-slate-300 hover:text-cyan-600"
                        aria-label="Editar"
                      >
                        <EditIcon />
                      </Link>
                      <deleteFetcher.Form method="POST">
                        <input type="hidden" name="table" value="usuarios" />
                        <input type="hidden" name="id" value={usuario.id} />
                        <button
                          type="submit"
                          className="p-2 text-slate-300 hover:text-cyan-600"
                          aria-label="Eliminar"
                        >
                          <DeleteIcon />
                        </button>
                      </deleteFetcher.Form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  return <GlobalErrorBoundary />;
}