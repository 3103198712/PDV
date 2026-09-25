import { useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/api";
import { useState } from "react";
import { brl, dateTimeBR } from "@/lib/format";

const SECTOR_LABEL = { cozinha_quente: "COZINHA QUENTE", cozinha_fria: "COZINHA FRIA", bar: "BAR", buffet: "BUFFET" };

const printStyle = `
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; margin: 0; padding: 6px; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: 700; }
  .lg { font-size: 15px; }
  .xl { font-size: 20px; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 6px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 2px 0; font-size: 12px; }
  .qty { width: 26px; }
  .price { text-align: right; width: 60px; font-family: 'Courier New', monospace; }
  h2 { margin: 4px 0; font-size: 16px; text-align:center; }
  .badge { display:inline-block; border:1px solid #000; padding: 2px 6px; font-weight: 700; }
  @media print { .no-print { display: none; } }
`;

function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return null;
}

export function KitchenTicket() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  useEffect(() => { api.get(`/orders/${id}`).then(r => setOrder(r.data)); }, [id]);
  if (!order) return null;

  // Group unprinted items by sector
  const groups = {};
  order.items.forEach(it => {
    if (it.printed) return;
    if (!groups[it.sector]) groups[it.sector] = [];
    groups[it.sector].push(it);
  });

  const heading = order.channel === "mesa" ? `MESA ${order.table_number}` :
    order.channel === "hotel" ? `HOTEL Qto ${order.hotel_room}` :
    order.channel === "ifood" ? `IFOOD #${order.ifood_number || "-"}` : `BUFFET ${order.event_name || ""}`;

  const sectors = Object.keys(groups);

  return (
    <div style={{ background: "#fff" }}>
      <style>{printStyle}</style>
      <AutoPrint />
      {sectors.length === 0 && <div className="center">Nenhum item novo para imprimir.</div>}
      {sectors.map((s, idx) => (
        <div key={s} style={{ pageBreakAfter: idx < sectors.length - 1 ? "always" : "auto" }}>
          <div className="center bold xl">{SECTOR_LABEL[s] || s}</div>
          <div className="center bold lg">{heading}</div>
          <div className="center">Comanda {order.code}</div>
          <div className="center">{dateTimeBR(new Date().toISOString())}</div>
          <div className="center">Garçom: {order.operator_name}</div>
          <div className="sep" />
          <table>
            <tbody>
              {groups[s].map(it => (
                <tr key={it.id}>
                  <td className="qty bold">{it.quantity}x</td>
                  <td>
                    <div className="bold">{it.product_name}</div>
                    {it.notes && <div>* {it.notes}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="sep" />
          <div className="center bold">*** PREPARAR ***</div>
          <div className="no-print center" style={{ marginTop: 12 }}>
            <button onClick={() => window.print()}>Imprimir novamente</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PreConta() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  useEffect(() => { api.get(`/orders/${id}`).then(r => setOrder(r.data)); }, [id]);
  if (!order) return null;

  const subtotal = order.subtotal;
  const service = subtotal * 0.1;
  const total = subtotal + service;

  const heading = order.channel === "mesa" ? `Mesa ${order.table_number}` :
    order.channel === "hotel" ? `Quarto ${order.hotel_room}` :
    order.channel === "ifood" ? `iFood #${order.ifood_number || "-"}` :
    `Buffet ${order.event_name || ""}`;

  return (
    <div style={{ background: "#fff" }}>
      <style>{printStyle}</style>
      <AutoPrint />
      <h2>*** PRÉ-CONTA ***</h2>
      <div className="center bold">PDV Pro Restaurante</div>
      <div className="center">Sem valor fiscal</div>
      <div className="sep" />
      <div><span className="bold">{heading}</span></div>
      <div>Comanda: {order.code}</div>
      <div>Data: {dateTimeBR(new Date().toISOString())}</div>
      <div>Garçom: {order.operator_name}</div>
      <div className="sep" />
      <table>
        <thead>
          <tr><th>Item</th><th className="qty">Qt</th><th className="price">Total</th></tr>
        </thead>
        <tbody>
          {order.items.map(it => (
            <tr key={it.id}>
              <td>{it.product_name}</td>
              <td className="qty">{it.quantity}</td>
              <td className="price">{brl(it.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sep" />
      <div className="row"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
      <div className="row"><span>Serviço (10%)</span><span>{brl(service)}</span></div>
      <div className="row bold lg" style={{ marginTop: 4 }}><span>TOTAL</span><span>{brl(total)}</span></div>
      <div className="sep" />
      <div className="center">Obrigado pela preferência!</div>
      <div className="no-print center" style={{ marginTop: 12 }}>
        <button onClick={() => window.print()}>Imprimir novamente</button>
      </div>
    </div>
  );
}

export function Cupom() {
  const { id } = useParams(); // sale id
  const [sale, setSale] = useState(null);
  useEffect(() => { api.get(`/sales/${id}`).then(r => setSale(r.data)); }, [id]);
  if (!sale) return null;

  const PAY = { pix: "Pix", credito: "Cartão Crédito", debito: "Cartão Débito", dinheiro: "Dinheiro", hotel_lancamento: "Lançado no quarto" };

  return (
    <div style={{ background: "#fff" }}>
      <style>{printStyle}</style>
      <AutoPrint />
      <h2>*** CUPOM DE VENDA ***</h2>
      <div className="center bold">PDV Pro Restaurante</div>
      <div className="sep" />
      <div>{sale.customer_name}</div>
      <div>Venda: {sale.code}</div>
      <div>Data: {dateTimeBR(sale.created_at)}</div>
      <div>Atendente: {sale.operator_name}</div>
      <div className="sep" />
      <table>
        <tbody>
          {sale.items.map((it, i) => (
            <tr key={i}>
              <td>{it.quantity}× {it.product_name}</td>
              <td className="price">{brl(it.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sep" />
      <div className="row"><span>Subtotal</span><span>{brl(sale.subtotal)}</span></div>
      {sale.service_fee > 0 && <div className="row"><span>Serviço</span><span>{brl(sale.service_fee)}</span></div>}
      {sale.discount > 0 && <div className="row"><span>Desconto</span><span>-{brl(sale.discount)}</span></div>}
      <div className="row bold lg" style={{ marginTop: 4 }}><span>TOTAL</span><span>{brl(sale.total)}</span></div>
      <div>Pagamento: {PAY[sale.payment_method] || sale.payment_method}</div>
      <div className="sep" />
      <div className="center">Obrigado e volte sempre!</div>
      <div className="no-print center" style={{ marginTop: 12 }}>
        <button onClick={() => window.print()}>Imprimir novamente</button>
      </div>
    </div>
  );
}
