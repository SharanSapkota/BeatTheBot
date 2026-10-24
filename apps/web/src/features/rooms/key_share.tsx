import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { rooms_copy } from "./copy";
import styles from "./key_share.module.css";

/** The join link that the QR code and Share point to. */
export function join_link(key: string): string {
  return `${window.location.origin}/rooms/join/${encodeURIComponent(key)}`;
}

async function copy_text(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

interface KeyShareProps {
  room_name: string;
  join_key: string;
}

/** The key in big letters, Copy, Share (navigator.share, else copy the link) and a QR code. */
export function KeyShare({ room_name, join_key }: KeyShareProps) {
  const [copied, set_copied] = useState(false);
  const [qr_url, set_qr_url] = useState<string | null>(null);
  const link = join_link(join_key);

  useEffect(() => {
    let is_current = true;
    QRCode.toDataURL(link, { margin: 1, width: 360, errorCorrectionLevel: "M" })
      .then((url) => {
        if (is_current) {
          set_qr_url(url);
        }
      })
      .catch(() => set_qr_url(null));
    return () => {
      is_current = false;
    };
  }, [link]);

  const show_copied = (ok: boolean) => {
    set_copied(ok);
    if (ok) {
      window.setTimeout(() => set_copied(false), 2000);
    }
  };

  const share = async () => {
    const data = {
      title: rooms_copy.share_title(room_name),
      text: rooms_copy.share_text(join_key),
      url: link,
    };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(data);
        return;
      } catch {
        // Cancelled or not allowed: copy the link instead.
      }
    }
    show_copied(await copy_text(link));
  };

  return (
    <div className={styles.share}>
      <p className={styles.label}>{rooms_copy.key_label}</p>
      <p className={styles.key} data-testid="join_key">
        {join_key}
      </p>
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.button}
          onClick={() => void copy_text(join_key).then(show_copied)}
        >
          {copied ? rooms_copy.copied : rooms_copy.copy_key}
        </button>
        <button type="button" className={styles.button} onClick={() => void share()}>
          {rooms_copy.share}
        </button>
      </div>
      {qr_url && <img className={styles.qr} src={qr_url} alt={rooms_copy.qr_label} />}
    </div>
  );
}
