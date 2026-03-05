import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eraser, PenLine, Type } from 'lucide-react';

interface SignatureCanvasProps {
  signature: string;
  signatureImage: string | null;
  onSignatureChange: (signature: string) => void;
  onSignatureImageChange: (imageData: string | null) => void;
  tableColor: string;
}

export function SignatureCanvas({
  signature,
  signatureImage,
  onSignatureChange,
  onSignatureImageChange,
  tableColor,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState<'type' | 'draw'>(signatureImage ? 'draw' : 'type');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 100;

    // Set up drawing styles
    ctx.strokeStyle = tableColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // If there's existing signature image, draw it
    if (signatureImage) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = signatureImage;
    }
  }, [tableColor, signatureImage]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    ctx.strokeStyle = tableColor;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Save the canvas as image data
    const imageData = canvas.toDataURL('image/png');
    onSignatureImageChange(imageData);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onSignatureImageChange(null);
  };

  return (
    <div className="space-y-3">
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'type' | 'draw')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="type" className="gap-2">
            <Type className="w-4 h-4" />
            Type
          </TabsTrigger>
          <TabsTrigger value="draw" className="gap-2">
            <PenLine className="w-4 h-4" />
            Draw
          </TabsTrigger>
        </TabsList>

        <TabsContent value="type" className="mt-3 space-y-3">
          <div>
            <Label>Your Signature (Name)</Label>
            <Input
              value={signature}
              onChange={(e) => onSignatureChange(e.target.value)}
              placeholder="Type your signature here"
              className="font-serif italic text-lg"
            />
          </div>
          {signature && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Preview:</p>
              <p className="font-serif italic text-xl" style={{ color: tableColor }}>
                {signature}
              </p>
              <div className="border-b border-muted-foreground/30 w-32 mt-1"></div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="draw" className="mt-3 space-y-3">
          <div>
            <Label>Draw Your Signature</Label>
            <div className="mt-2 border border-border rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                className="w-full cursor-crosshair touch-none"
                style={{ height: '100px' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            <div className="flex justify-end mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearCanvas}
              >
                <Eraser className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
          {signatureImage && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Saved Signature:</p>
              <img 
                src={signatureImage} 
                alt="Signature" 
                className="max-h-16"
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
      <p className="text-xs text-muted-foreground">
        This will appear as an authorized signature on the invoice
      </p>
    </div>
  );
}