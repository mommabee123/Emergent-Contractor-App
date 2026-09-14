import { useEffect, useState } from "react";
import { fileUrl } from "../lib/api";

export default function AuthImage({ fileId, thumb = true, className = "", alt = "" }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (!fileId) return;
    setSrc(fileUrl(fileId, thumb));
  }, [fileId, thumb]);
  if (!fileId || !src) return null;
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}
