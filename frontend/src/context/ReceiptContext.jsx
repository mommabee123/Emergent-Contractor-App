import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Plus } from "lucide-react";
import { ReceiptCapture } from "../components/ReceiptCapture";

const ReceiptContext = createContext(null);
export const useReceipts = () => useContext(ReceiptContext);

export const ReceiptProvider = ({ children }) => {
  const [capture, setCapture] = useState(null);
  const [revision, setRevision] = useState(0);
  const [unsortedCount, setUnsortedCount] = useState(0);
  useEffect(() => { api.get("/expenses", { params: { unsorted: true } }).then(({ data }) => setUnsortedCount(data.unsorted_count)).catch(() => {}); }, [revision]);
  const refreshExpenses = () => setRevision((v) => v + 1);
  return <ReceiptContext.Provider value={{ openReceipt: (options = {}) => setCapture(options), revision, refreshExpenses, unsortedCount }}>
    {children}
    {!capture && <button data-testid="capture-receipt-global" aria-label="Capture receipt" onClick={() => setCapture({})}
      className="btn-bone fixed right-4 bottom-20 md:bottom-6 md:right-8 z-40 h-14 px-4 gap-2">
      <Plus className="w-6 h-6" /><span className="hidden sm:inline">Receipt</span>
    </button>}
    {capture && <ReceiptCapture options={capture} onClose={() => setCapture(null)} onSaved={() => { refreshExpenses(); setCapture(null); }} />}
  </ReceiptContext.Provider>;
};
