import { api } from "./api";

export const EXPENSE_CATEGORIES = [
  ["material", "Materials"], ["fuel", "Fuel"], ["equipment", "Equipment"],
  ["disposal", "Disposal"], ["labor", "Labor"], ["other", "Other"],
];
export const categoryLabel = (value) => EXPENSE_CATEGORIES.find(([id]) => id === value)?.[1] || "Unassigned";
export const billableAmount = (expense) => expense.billable === false ? 0 : Math.round(Number(expense.amount || 0) * (1 + Number(expense.markup_percent || 0) / 100) * 100) / 100;
export const apiError = (error, fallback) => typeof error.response?.data?.detail === "string" ? error.response.data.detail : fallback;

export const uploadReceipt = async (file, setProgress) => {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use a JPEG, PNG or WebP photo.");
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error("Choose a receipt photo under 20 MB.");
  const { data: upload } = await api.post("/receipts/uploads", { filename: file.name, content_type: file.type, size: file.size });
  const count = Math.ceil(file.size / upload.chunk_size);
  for (let index = 0; index < count; index++) {
    await api.put(`/receipts/uploads/${upload.id}/chunks/${index}`, file.slice(index * upload.chunk_size, (index + 1) * upload.chunk_size), {
      headers: { "Content-Type": "application/octet-stream" },
      onUploadProgress: (event) => setProgress(`Uploading receipt · ${Math.round((index + (event.progress || 0)) / count * 100)}%`),
    });
  }
  setProgress("Compressing photo and generating thumbnail…");
  const { data } = await api.post(`/receipts/uploads/${upload.id}/complete`);
  return data.id;
};
