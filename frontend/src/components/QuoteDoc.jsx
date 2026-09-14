import { money, usDate } from "../lib/format";
import { fileUrl } from "../lib/api";
import { X, Printer } from "lucide-react";

// Fixed-width US Letter print document (8.5in = 816px @96dpi). Not the responsive app layout.
export default function QuoteDoc({ company, job, estimate, scope, onClose }) {
  const validUntil = new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const logoUrl = company?.logo_file_id ? fileUrl(company.logo_file_id, true) : null;

  return (
    <div className="fixed inset-0 z-50 bg-[#12110F] overflow-y-auto">
      {/* toolbar */}
      <div className="quote-no-print sticky top-0 z-10 bg-[#1C1A17] border-b border-[#2B2823] px-4 py-3 flex items-center justify-between">
        <span className="label-up mb-0">Quote preview</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            data-testid="quote-print-button"
            className="tap-min px-4 rounded-lg text-sm font-bold flex items-center gap-2"
            style={{ background: "var(--blue)", color: "#fff" }}
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={onClose}
            data-testid="quote-close-button"
            className="tap-min px-4 rounded-lg text-sm font-semibold bg-[#24211D] border border-[#2B2823] text-[#A39990]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* paper — fixed 816px (US Letter), horizontally scrollable on small screens */}
      <div className="quote-no-print-scroll" style={{ overflowX: "auto" }}>
        <div className="quote-doc mx-auto my-6 bg-white text-[#12110F]" style={{ width: 816, minHeight: 1056, padding: 48 }} data-testid="quote-document">
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #12110F", paddingBottom: 24 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {logoUrl && <img src={logoUrl} alt="" style={{ width: 64, height: 64, objectFit: "contain" }} />}
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "0.02em", textTransform: "uppercase" }}>
                {company?.business_name || "Your Company"}
              </div>
              <div style={{ fontSize: 12, color: "#555", marginTop: 4, lineHeight: 1.5 }}>
                {company?.address && <div>{company.address}</div>}
                <div>
                  {[company?.phone, company?.email].filter(Boolean).join(" · ")}
                </div>
                {company?.license_number && <div>License {company.license_number}</div>}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "0.04em", color: "#2F7DE1" }}>QUOTE</div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
              Job #{String(job?.job_number || 0).padStart(4, "0")}
              <br />
              {usDate(new Date().toISOString())}
            </div>
          </div>
        </div>

        {/* client */}
        <div style={{ display: "flex", gap: 48, marginTop: 28 }}>
          <div style={{ flex: 1 }}>
            <div style={lbl}>Prepared for</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{job?.client?.name || "—"}</div>
            <div style={{ fontSize: 13, color: "#555", marginTop: 2 }}>{job?.address}</div>
            {job?.client?.phone && <div style={{ fontSize: 13, color: "#555" }}>{job.client.phone}</div>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={lbl}>Project</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{job?.title}</div>
            <div style={{ fontSize: 13, color: "#555", marginTop: 2 }}>Valid through {validUntil}</div>
          </div>
        </div>

        {/* scope */}
        {scope && (
          <div style={{ marginTop: 28 }}>
            <div style={lbl}>Scope of work</div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "#333" }} data-testid="quote-scope-summary">{scope}</p>
          </div>
        )}

        {/* line items */}
        <table style={{ width: "100%", marginTop: 28, borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #12110F" }}>
              <th style={{ ...th, textAlign: "left" }}>Description</th>
              <th style={{ ...th, textAlign: "right", width: 70 }}>Qty</th>
              <th style={{ ...th, textAlign: "left", width: 70 }}>Unit</th>
              <th style={{ ...th, textAlign: "right", width: 100 }}>Unit price</th>
              <th style={{ ...th, textAlign: "right", width: 110 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(estimate?.line_items || []).map((l, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #E5E1D8" }} data-testid={`quote-line-${i}`}>
                <td style={{ ...td, textAlign: "left" }}>{l.description}</td>
                <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{l.quantity}</td>
                <td style={{ ...td, textAlign: "left", color: "#777" }}>{l.unit}</td>
                <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{money(l.unit_price)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{money(l.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <div style={{ width: 280 }}>
            <div style={totRow}>
              <span style={{ color: "#555" }}>Subtotal</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(estimate?.subtotal)}</span>
            </div>
            <div style={totRow}>
              <span style={{ color: "#555" }}>Tax ({estimate?.tax_rate || 0}%)</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(estimate?.tax)}</span>
            </div>
            <div style={{ ...totRow, borderTop: "2px solid #12110F", paddingTop: 10, marginTop: 6 }}>
              <span style={{ fontWeight: 800, fontSize: 15, textTransform: "uppercase", letterSpacing: "0.06em" }}>Total</span>
              <span style={{ fontWeight: 800, fontSize: 28, fontVariantNumeric: "tabular-nums" }} data-testid="quote-grand-total">
                {money(estimate?.total)}
              </span>
            </div>
          </div>
        </div>

        {/* terms */}
        <div style={{ marginTop: 36, borderTop: "1px solid #E5E1D8", paddingTop: 20 }}>
          <div style={lbl}>Terms</div>
          <p style={{ fontSize: 12, lineHeight: 1.7, color: "#555" }}>
            {company?.payment_instructions ||
              "50% deposit due upon approval; balance due on completion. This quote is valid for 30 days from the date above. Changes to scope may adjust the final total and will be confirmed in writing before work proceeds."}
          </p>
        </div>
      </div>
    </div>
    </div>
  );
}

const lbl = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "#999",
  marginBottom: 6,
};
const th = { padding: "8px 6px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#777" };
const td = { padding: "9px 6px" };
const totRow = { display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0", fontSize: 14 };
