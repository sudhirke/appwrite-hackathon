import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function QRCodeImage({ value, label }: { value: string; label: string }) {
  const [source, setSource] = useState("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { width: 320, margin: 2, errorCorrectionLevel: "H", color: { dark: "#1f2d27", light: "#ffffff" } })
      .then((url) => { if (active) setSource(url); });
    return () => { active = false; };
  }, [value]);

  return source ? <img src={source} alt={`QR code for ${label}`} /> : <span className="qr-loading">Generating QR…</span>;
}
