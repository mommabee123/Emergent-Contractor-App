import { Trash2, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../lib/api";
import { categoryLabel, billableAmount } from "../lib/expenses";
import { money, usDate } from "../lib/format";
import { useReceipts } from "../context/ReceiptContext";
import AuthImage from "./AuthImage";

export const ExpenseList = ({ expenses, showJob = false }) => {
  const { openReceipt, refreshExpenses } = useReceipts();
  const remove = async (expense) => {
    if (!window.confirm(`Delete ${expense.vendor} expense for ${money(expense.amount)}?`)) return;
    try { await api.delete(`/expenses/${expense.id}`); refreshExpenses(); toast.success("Expense removed"); }
    catch { toast.error("Could not remove expense"); }
  };
  return <div className="space-y-3">
    {expenses.map((expense) => <article key={expense.id} data-testid={`expense-item-${expense.id}`} className="surface-card">
      <div className="flex gap-3 items-start">
        {expense.receipt_photo_id && <button data-testid={`expense-photo-${expense.id}`} className="shrink-0" aria-label={`Review ${expense.vendor} receipt`} onClick={() => openReceipt({ expense })}>
          <AuthImage fileId={expense.receipt_photo_id} alt={`${expense.vendor} receipt thumbnail`} className="w-14 h-20 object-cover rounded-md" />
        </button>}
        <div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <h3 className="font-bold break-words">{expense.vendor}</h3><span data-testid={`expense-amount-${expense.id}`} className="text-2xl font-bold font-mono-num">{money(expense.amount)}</span>
        </div><p className="text-[#A39990]">{usDate(expense.date)} · {categoryLabel(expense.category)}</p>
          {showJob && (expense.job_id ? <Link data-testid={`expense-job-${expense.id}`} to={`/jobs/${expense.job_id}?tab=expenses`} className="tap-min inline-flex items-center">#{expense.job_number} · {expense.job_title}</Link> : <p data-testid={`expense-unassigned-${expense.id}`} className="text-[#A39990] mt-1">No job assigned</p>)}
          <p data-testid={`expense-billable-${expense.id}`} className="text-[#A39990] mt-2">{expense.billable !== false ? `Billable ${money(billableAmount(expense))} · ${expense.markup_percent || 0}% markup` : "Non-billable · job cost only"}</p>
          {expense.description && <p className="mt-1 text-[#A39990] break-words">{expense.description}</p>}
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3"><button data-testid={`expense-edit-${expense.id}`} className="btn-elev" onClick={() => openReceipt({ expense })}><Pencil className="w-4 h-4" />Review</button>
        <button data-testid={`expense-delete-${expense.id}`} aria-label={`Delete ${expense.vendor} expense`} className="btn-elev" onClick={() => remove(expense)}><Trash2 className="w-4 h-4" /></button></div>
    </article>)}
    {!expenses.length && <p data-testid="expenses-empty" className="py-8 text-[#A39990]">No expenses here yet.</p>}
  </div>;
};
