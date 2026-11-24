import assert from "node:assert/strict";
import test from "node:test";
import {
  extractAttachmentIdFromSrc,
  extractBodyImagesFromHtml,
  isZoomableImageSize,
  mergeMailLightboxGallery,
} from "../src/components/mail/reader/mailImageGallery.ts";

test("自然尺寸阈值过滤 1x1 追踪像素与极小图标", () => {
  assert.equal(isZoomableImageSize(1, 1), false);
  assert.equal(isZoomableImageSize(32, 32), false);
  assert.equal(isZoomableImageSize(120, 47), false);
  assert.equal(isZoomableImageSize(48, 48), true);
  assert.equal(isZoomableImageSize(1920, 1080), true);
});

test("从 /omnimail-cid 与 /omnimail-attachment 准确提取附件 ID", () => {
  assert.equal(
    extractAttachmentIdFromSrc("/omnimail-cid/msg1-att-2?retry=123"),
    "msg1-att-2",
  );
  assert.equal(
    extractAttachmentIdFromSrc("/omnimail-attachment/att%209"),
    "att 9",
  );
  assert.equal(
    extractAttachmentIdFromSrc("https://cdn.example.com/a.png", "cid-custom-1"),
    "cid-custom-1",
  );
  assert.equal(
    extractAttachmentIdFromSrc("https://cdn.example.com/a.png"),
    undefined,
  );
});

test("正文图片与图片附件合并画廊并按 attachmentId / src 去重", () => {
  const bodyImages = [
    {
      id: "b1",
      src: "/omnimail-cid/msg1-att-1",
      name: "架构图",
      attachmentId: "msg1-att-1",
      width: 1200,
      height: 800,
    },
    {
      id: "b2",
      src: "https://cdn.example.com/hero.png",
      name: "hero.png",
    },
  ];
  const attachments = [
    {
      id: "msg1-att-1",
      name: "diagram.png",
      ext: "PNG",
      sizeText: "320 KB",
      kind: "image",
      status: "ready",
      previewUrl: "/omnimail-attachment/msg1-att-1",
    },
    {
      id: "msg1-att-3",
      name: "screenshot.jpg",
      ext: "JPG",
      sizeText: "1.2 MB",
      kind: "image",
      status: "ready",
      previewUrl: "/omnimail-attachment/msg1-att-3",
    },
    {
      id: "msg1-att-4",
      name: "contract.pdf",
      ext: "PDF",
      sizeText: "540 KB",
      kind: "pdf",
      status: "ready",
    },
  ];

  const merged = mergeMailLightboxGallery(bodyImages, attachments, {
    body: "邮件正文内嵌图",
    attachment: "邮件附件",
  });
  assert.equal(merged.length, 3);
  assert.equal(merged[0].attachmentId, "msg1-att-1");
  assert.equal(merged[1].src, "https://cdn.example.com/hero.png");
  assert.equal(merged[2].attachmentId, "msg1-att-3");
  assert.equal(merged[2].sourceLabel, "邮件附件");
});

test("从邮件 HTML 列表提取正文图片并去重", () => {
  const imgs = extractBodyImagesFromHtml(
    [
      '<p><img src="/omnimail-cid/m1-att-1" data-omnimail-cid="m1-att-1" alt="报表" /></p>',
      '<p><img src="/omnimail-cid/m1-att-1" /><img src="https://img.example.com/photo.webp" /></p>',
    ],
    "正文图片",
    "邮件正文内嵌图",
  );
  assert.equal(imgs.length, 2);
  assert.equal(imgs[0].name, "报表");
  assert.equal(imgs[0].attachmentId, "m1-att-1");
  assert.equal(imgs[1].name, "photo.webp");
});
