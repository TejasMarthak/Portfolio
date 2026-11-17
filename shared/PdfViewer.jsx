import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw } from 'lucide-react';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let pdfjsPromise;

function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist')
      .then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        return pdfjs;
      })
      .catch((error) => {
        pdfjsPromise = null;
        throw error;
      });
  }
  return pdfjsPromise;
}

export default function PdfViewer({ src, title }) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let loadingTask;
    setPdfDocument(null);
    setPageNumber(1);
    setPageCount(0);
    setZoom(1);
    setLoading(true);
    setError('');

    loadPdfJs()
      .then(({ getDocument }) => {
        if (cancelled) return null;
        loadingTask = getDocument({ url: src, withCredentials: false });
        return loadingTask.promise;
      })
      .then((document) => {
        if (!document || cancelled) return;
        setPdfDocument(document);
        setPageCount(document.numPages);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        setError('This PDF could not be displayed. Check the connection and try again.');
      });

    return () => {
      cancelled = true;
      loadingTask?.destroy();
    };
  }, [retry, src]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setStageSize({
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height)
      });
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdfDocument || !stageSize.width || !stageSize.height) return undefined;
    let cancelled = false;
    let renderTask;
    setError('');

    pdfDocument.getPage(pageNumber)
      .then((page) => {
        if (cancelled || !canvasRef.current) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = Math.min(
          (stageSize.width - 32) / baseViewport.width,
          (stageSize.height - 32) / baseViewport.height
        );
        const displayScale = Math.max(0.1, fitScale) * zoom;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: displayScale * pixelRatio });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('Canvas rendering is unavailable.');

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${Math.ceil(baseViewport.width * displayScale)}px`;
        canvas.style.height = `${Math.ceil(baseViewport.height * displayScale)}px`;
        renderTask = page.render({ canvasContext: context, viewport });
        return renderTask.promise;
      })
      .catch((renderError) => {
        if (!cancelled && renderError.name !== 'RenderingCancelledException') {
          setError('This PDF page could not be rendered. Try another page or reopen the file.');
        }
      });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pageNumber, pdfDocument, stageSize, zoom]);

  return (
    <section className="site-pdf-viewer" aria-label={`${title} PDF viewer`}>
      <div className="site-pdf-toolbar">
        <button type="button" onClick={() => setPageNumber((current) => Math.max(1, current - 1))} disabled={pageNumber <= 1} aria-label="Previous PDF page">
          <ChevronLeft size={17} />
        </button>
        <span className="site-pdf-page-count" aria-live="polite">Page {pageCount ? pageNumber : '—'} of {pageCount || '—'}</span>
        <button type="button" onClick={() => setPageNumber((current) => Math.min(pageCount, current + 1))} disabled={!pageCount || pageNumber >= pageCount} aria-label="Next PDF page">
          <ChevronRight size={17} />
        </button>
        <span className="site-pdf-toolbar-divider" aria-hidden="true" />
        <button type="button" onClick={() => setZoom((current) => Math.max(0.5, Number((current - 0.25).toFixed(2))))} disabled={zoom <= 0.5} aria-label="Zoom out">
          <Minus size={16} />
        </button>
        <button type="button" className="site-pdf-fit-page" onClick={() => setZoom(1)} aria-label="Fit PDF page to screen">
          <span>Fit page</span>
        </button>
        <button type="button" onClick={() => setZoom((current) => Math.min(3, Number((current + 0.25).toFixed(2))))} disabled={zoom >= 3} aria-label="Zoom in">
          <Plus size={16} />
        </button>
      </div>
      <div className="site-pdf-page-stage" ref={stageRef}>
        {loading && <p className="site-pdf-status" role="status">Loading PDF…</p>}
        {error && (
          <div className="site-pdf-error" role="alert">
            <p>{error}</p>
            <div>
              <button type="button" onClick={() => setRetry((current) => current + 1)}><RotateCcw size={14} />Retry</button>
              <a href={src} target="_blank" rel="noreferrer">Open in new tab</a>
            </div>
          </div>
        )}
        {!error && <canvas ref={canvasRef} role="img" aria-label={`${title}, page ${pageNumber} of ${pageCount || 'PDF'}`} />}
      </div>
    </section>
  );
}
