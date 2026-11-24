import { mailApi } from "../../../services/backendClient";
import { isWailsDesktop } from "../../../state/storageHelpers";
import type { LightboxImageItem } from "../../../types/ui";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = typeof reader.result === "string" ? reader.result : "";
      const comma = res.indexOf(",");
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    reader.onerror = () => reject(new Error("read blob failed"));
    reader.readAsDataURL(blob);
  });
}

function renderImageToPngBlob(imgEl: HTMLImageElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const w = imgEl.naturalWidth;
    const h = imgEl.naturalHeight;
    if (!w || !h) {
      reject(new Error("image not loaded"));
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("canvas unavailable"));
      return;
    }
    ctx.drawImage(imgEl, 0, 0);
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/png",
    );
  });
}

export async function copyLightboxImage(
  src: string,
  imgEl: HTMLImageElement | null,
): Promise<void> {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    throw new Error("clipboard image write unsupported");
  }
  let pngBlob: Blob | null = null;
  if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
    try {
      pngBlob = await renderImageToPngBlob(imgEl);
    } catch {
      pngBlob = null;
    }
  }
  if (!pngBlob) {
    const resp = await fetch(src);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const fetched = await resp.blob();
    if (fetched.type === "image/png") {
      pngBlob = fetched;
    } else {
      const bmp = await createImageBitmap(fetched);
      const canvas = document.createElement("canvas");
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas unavailable");
      ctx.drawImage(bmp, 0, 0);
      bmp.close();
      pngBlob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/png",
        ),
      );
    }
  }
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": pngBlob }),
  ]);
}

export async function saveLightboxImage(
  item: LightboxImageItem,
  imgEl: HTMLImageElement | null,
): Promise<string> {
  if (!isWailsDesktop()) {
    const link = document.createElement("a");
    link.href = item.src;
    link.download = item.name || "image.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return item.name || "image.png";
  }

  if (item.attachmentId && !item.attachmentId.startsWith("dimg-")) {
    try {
      return await mailApi.saveAttachmentAs(item.attachmentId);
    } catch {
      // 若附件记录不在 attachments 表中（如草稿内嵌图），回退到通用字节另存接口
    }
  }

  let base64 = "";
  if (item.src.startsWith("data:")) {
    base64 = item.src;
  } else {
    try {
      const resp = await fetch(item.src);
      if (resp.ok) {
        base64 = await blobToBase64(await resp.blob());
      }
    } catch {
      if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
        const blob = await renderImageToPngBlob(imgEl);
        base64 = await blobToBase64(blob);
      }
    }
  }
  if (!base64) {
    throw new Error("cannot read image payload");
  }
  return mailApi.saveImageDataAs(item.name || "image.png", base64);
}
