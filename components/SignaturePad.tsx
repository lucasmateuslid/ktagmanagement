import React, { useRef, useState, useEffect } from "react";

interface SignaturePadProps {
  onSave: (signatureDataUrl: string) => void;
  onCancel: () => void;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
      }
      
      // Handle resize to fix mapping
      const resizeCanvas = () => {
         const rect = canvas.parentElement?.getBoundingClientRect();
         if (rect) {
             canvas.width = rect.width;
             canvas.height = 200; // Fixed height
         }
      }
      window.addEventListener('resize', resizeCanvas);
      resizeCanvas();
      
      return () => window.removeEventListener('resize', resizeCanvas);
    }
  }, []);

  const getCoordinates = (event: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    if ('touches' in event) {
      return {
        x: event.touches[0].clientX - rect.left,
        y: event.touches[0].clientY - rect.top
      };
    } else {
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    }
  };

  const startDrawing = (event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    const { x, y } = getCoordinates(event);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
      }
    }
  };

  const draw = (event: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    event.preventDefault();
    const { x, y } = getCoordinates(event);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.closePath();
        }
      }
      setIsDrawing(false);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL("image/png");
      onSave(dataUrl);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="border-2 border-zinc-300 dark:border-zinc-700 rounded-2xl bg-white overflow-hidden touch-none relative">
         <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-[200px] cursor-crosshair touch-none"
        />
        <div className="absolute top-2 right-2 pointer-events-none opacity-50 text-xs font-bold text-zinc-400">
            ASSINATURA AQUI
        </div>
      </div>
      <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-2">
        <button
          onClick={clearCanvas}
          className="w-full sm:w-auto px-4 py-3 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl order-2 sm:order-1"
        >
          Limpar
        </button>
        <div className="flex gap-2 w-full sm:w-auto order-1 sm:order-2">
            <button
            onClick={onCancel}
            className="flex-1 sm:flex-none px-4 py-3 text-xs font-bold uppercase tracking-widest text-red-500 bg-red-50 hover:bg-red-100 rounded-xl"
            >
            Cancelar
            </button>
            <button
            onClick={handleSave}
            className="flex-1 sm:flex-none px-6 py-3 bg-primary-500 text-primary-950 font-black uppercase tracking-widest rounded-xl hover:bg-primary-600 border border-primary-600 shadow-md"
            >
            Confirmar
            </button>
        </div>
      </div>
    </div>
  );
};
