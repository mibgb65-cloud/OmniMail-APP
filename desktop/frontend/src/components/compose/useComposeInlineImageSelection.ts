import { useCallback, useRef, useState, type RefObject } from "react";

export function useComposeInlineImageSelection(
  wrapRef: RefObject<HTMLDivElement | null>,
  onRemoved: () => void,
) {
  const selectedImgRef = useRef<HTMLImageElement | null>(null);
  const [imgBtnPos, setImgBtnPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const clearSelectedImg = useCallback(() => {
    selectedImgRef.current?.removeAttribute("data-selected");
    selectedImgRef.current = null;
    setImgBtnPos(null);
  }, []);

  const resetSelectedImgRefOnly = useCallback(() => {
    selectedImgRef.current?.removeAttribute("data-selected");
    selectedImgRef.current = null;
  }, []);

  const removeSelectedImage = useCallback(() => {
    if (!selectedImgRef.current) return false;
    selectedImgRef.current.remove();
    clearSelectedImg();
    onRemoved();
    return true;
  }, [clearSelectedImg, onRemoved]);

  const handleEditorClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "IMG" && wrapRef.current) {
        const img = target as HTMLImageElement;
        if (selectedImgRef.current && selectedImgRef.current !== img) {
          selectedImgRef.current.removeAttribute("data-selected");
        }
        img.setAttribute("data-selected", "true");
        selectedImgRef.current = img;
        const w = wrapRef.current.getBoundingClientRect();
        const r = img.getBoundingClientRect();
        setImgBtnPos({
          top: Math.max(4, r.top - w.top + 6),
          left: Math.max(4, r.right - w.left - 30),
        });
        return;
      }
      if (selectedImgRef.current) clearSelectedImg();
    },
    [clearSelectedImg, wrapRef],
  );

  const hasSelectedImage = useCallback(
    () => Boolean(selectedImgRef.current),
    [],
  );

  return {
    imgBtnPos,
    clearSelectedImg,
    resetSelectedImgRefOnly,
    removeSelectedImage,
    handleEditorClick,
    hasSelectedImage,
  };
}
