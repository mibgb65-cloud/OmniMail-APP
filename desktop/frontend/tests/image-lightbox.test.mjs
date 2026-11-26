import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  analyzeImageElementSurface,
  analyzeRgbaPixels,
  inferFallbackSurfaceFromSource,
  resolveLightboxPresentation,
} from "../src/components/overlays/lightbox/imageSurfaceAnalysis.ts";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function buildSamplePixels(total, fillPixel) {
  const buf = new Uint8ClampedArray(total * 4);
  for (let i = 0; i < total; i += 1) {
    const [r, g, b, a] = fillPixel(i);
    const idx = i * 4;
    buf[idx] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
    buf[idx + 3] = a;
  }
  return buf;
}

test("imageSurfaceAnalysis：透明深色图推荐 light、透明浅色图推荐 dark、中性透明推荐 checker、普通照片返回 none", () => {
  // 黑色 Meta 文字 Logo（70% 透明，30% 深色像素 #1C2B33）
  const darkLogoPixels = buildSamplePixels(1024, (i) =>
    i < 720 ? [0, 0, 0, 0] : [28, 43, 51, 255],
  );
  const darkReport = analyzeRgbaPixels(darkLogoPixels, 336, 68);
  assert.equal(darkReport.hasTransparency, true);
  assert.equal(darkReport.isSmallLogo, true);
  assert.equal(darkReport.recommendedSurface, "light");

  // 纯白透明 Logo（75% 透明，25% 纯白像素 #FFFFFF）
  const whiteLogoPixels = buildSamplePixels(1024, (i) =>
    i < 768 ? [0, 0, 0, 0] : [255, 255, 255, 255],
  );
  const whiteReport = analyzeRgbaPixels(whiteLogoPixels, 280, 72);
  assert.equal(whiteReport.hasTransparency, true);
  assert.equal(whiteReport.recommendedSurface, "dark");

  // 中性亮度透明图（60% 透明，40% 中灰像素 #A0A0A0，亮度约 160）
  const midTransparentPixels = buildSamplePixels(1024, (i) =>
    i < 620 ? [0, 0, 0, 0] : [160, 160, 160, 255],
  );
  const midReport = analyzeRgbaPixels(midTransparentPixels, 900, 600);
  assert.equal(midReport.hasTransparency, true);
  assert.equal(midReport.recommendedSurface, "checker");

  // 普通非透明大图照片（100% 不透明）
  const opaquePhotoPixels = buildSamplePixels(1024, () => [80, 120, 160, 255]);
  const photoReport = analyzeRgbaPixels(opaquePhotoPixels, 1920, 1080);
  assert.equal(photoReport.hasTransparency, false);
  assert.equal(photoReport.isSmallLogo, false);
  assert.equal(photoReport.recommendedSurface, "none");
});

test("imageSurfaceAnalysis：跨域 CORS SecurityError 时按扩展名与尺寸平滑回退且绝不抛错", () => {
  const prevDoc = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        clearRect: () => {},
        drawImage: () => {},
        getImageData: () => {
          const err = new Error("Tainted canvases may not be exported.");
          err.name = "SecurityError";
          throw err;
        },
      }),
    }),
  };
  try {
    const logoFallback = analyzeImageElementSurface(
      { naturalWidth: 336, naturalHeight: 68 },
      "https://cdn.meta.com/assets/meta_logo.png?ver=2",
      "meta_logo.png",
    );
    assert.equal(logoFallback.corsFallback, true);
    assert.equal(logoFallback.recommendedSurface, "light");

    const largePngFallback = inferFallbackSurfaceFromSource(
      "https://cdn.example.com/diagram.webp",
      "diagram.webp",
      1600,
      900,
    );
    assert.equal(largePngFallback.recommendedSurface, "checker");

    const jpegFallback = inferFallbackSurfaceFromSource(
      "https://cdn.example.com/photo.jpg",
      "photo.jpg",
      1920,
      1080,
    );
    assert.equal(jpegFallback.recommendedSurface, "none");
  } finally {
    globalThis.document = prevDoc;
  }
});

test("resolveLightboxPresentation：自动推荐与用户手动切换底板（棋盘格/浅灰/纯黑）优先级正确", () => {
  const darkLogoReport = {
    hasTransparency: true,
    transparentRatio: 0.7,
    avgLuminance: 36,
    isSmallLogo: true,
    recommendedSurface: "light",
    corsFallback: false,
  };
  const autoDarkTheme = resolveLightboxPresentation({
    appTheme: "dark",
    manualSurface: null,
    report: darkLogoReport,
  });
  assert.equal(autoDarkTheme.matSurface, "light");
  assert.equal(autoDarkTheme.autoHintKind, "light");
  assert.equal(autoDarkTheme.canvasTone, "dark");

  const manualPureBlack = resolveLightboxPresentation({
    appTheme: "light",
    manualSurface: "dark",
    report: darkLogoReport,
  });
  assert.equal(manualPureBlack.canvasTone, "dark");
  assert.equal(manualPureBlack.pureDark, true);
  assert.equal(manualPureBlack.matSurface, null);

  const manualChecker = resolveLightboxPresentation({
    appTheme: "dark",
    manualSurface: "checker",
    report: darkLogoReport,
  });
  assert.equal(manualChecker.matSurface, "checker");
  assert.equal(manualChecker.autoHintKind, null);
});

test("ImageLightboxModal、Topbar 与 OverlayRouter：底板切换器、去重保存按钮、开合层分离与退场生命周期", () => {
  const topbarSrc = readFileSync(
    path.join(
      rootDir,
      "src/components/overlays/lightbox/ImageLightboxTopbar.tsx",
    ),
    "utf8",
  );
  const modalSrc = readFileSync(
    path.join(
      rootDir,
      "src/components/overlays/lightbox/ImageLightboxModal.tsx",
    ),
    "utf8",
  );
  const routerSrc = readFileSync(
    path.join(rootDir, "src/components/overlays/OverlayRouter.tsx"),
    "utf8",
  );
  const motionCss = readFileSync(
    path.join(rootDir, "src/styles/image-lightbox-motion.css"),
    "utf8",
  );

  // 1. 顶部渲染棋盘格 / 浅灰底板 / 纯黑三段开关，且移除重复「另存为」按钮
  assert.match(topbarSrc, /lightbox-surface-switcher/);
  assert.match(topbarSrc, /"checker",\s*"light",\s*"dark"/s);
  assert.doesNotMatch(topbarSrc, /saveAsBtn|onSave/);

  // 2. .lightbox-stage-frame 独立承载开合动效，内层承载 translate3d/scale/rotate，img 无冲突内联 transform
  assert.match(modalSrc, /className="lightbox-stage-frame"/);
  assert.match(modalSrc, /lightbox-media-mat/);
  assert.doesNotMatch(
    modalSrc,
    /<img[\s\S]*?style=\{\{\s*transform:/,
    "禁止在 <img /> 上直接写与开合动画冲突的 transform",
  );
  assert.match(motionCss, /\.lightbox-stage-frame\s*\{[\s\S]*?220ms/);
  assert.match(motionCss, /\[data-closing="true"\]\s*\.lightbox-stage-frame/);

  // 3. OverlayRouter 保持 >= 180ms 退场延时并向 Lightbox 传递 data-closing="true"
  assert.match(routerSrc, /OVERLAY_EXIT_MS\s*=\s*180/);
  assert.match(routerSrc, /useValuePresence\(active,\s*OVERLAY_EXIT_MS\)/);
  assert.match(routerSrc, /data-closing=\{closing \? "true" : "false"\}/);
  assert.match(routerSrc, /closing=\{closing\}/);
});
