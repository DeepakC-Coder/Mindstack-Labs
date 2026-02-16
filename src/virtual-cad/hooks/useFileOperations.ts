 import { useCallback } from 'react';
 import { CADStateAPI } from './useCADState';
 import { CADState, DrawingFile } from '../types/cad.types';
 
 export function useFileOperations(cadState: CADStateAPI) {
   const newDrawing = useCallback(() => {
     if (cadState.objects.length > 0) {
       const confirmed = window.confirm('Create a new drawing? Unsaved changes will be lost.');
       if (!confirmed) return;
     }
     cadState.newDrawing();
   }, [cadState]);
   
   const saveDrawing = useCallback((filename?: string) => {
     const state = cadState.getState();
     const file: DrawingFile = {
       name: filename || 'untitled.vcad',
       version: '1.0',
       created: new Date().toISOString(),
       modified: new Date().toISOString(),
       state
     };
     
     const json = JSON.stringify(file, null, 2);
     const blob = new Blob([json], { type: 'application/json' });
     const url = URL.createObjectURL(blob);
     
     const a = document.createElement('a');
     a.href = url;
     a.download = file.name;
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
     URL.revokeObjectURL(url);
     
     return file.name;
   }, [cadState]);
   
   const openDrawing = useCallback(() => {
     const input = document.createElement('input');
     input.type = 'file';
     input.accept = '.vcad,.json';
     
     input.onchange = (e) => {
       const file = (e.target as HTMLInputElement).files?.[0];
       if (!file) return;
       
       const reader = new FileReader();
       reader.onload = (event) => {
         try {
           const json = event.target?.result as string;
           const drawingFile: DrawingFile = JSON.parse(json);
           
           if (!drawingFile.state || !drawingFile.version) {
             throw new Error('Invalid file format');
           }
           
           cadState.loadState(drawingFile.state);
         } catch (err) {
           alert('Failed to open file. Invalid format.');
           console.error(err);
         }
       };
       reader.readAsText(file);
     };
     
     input.click();
   }, [cadState]);
   
   const exportToPNG = useCallback((canvas: HTMLCanvasElement | null, filename: string = 'drawing.png') => {
     if (!canvas) {
       alert('No canvas available for export');
       return;
     }
     
     // Create a white background version
     const exportCanvas = document.createElement('canvas');
     exportCanvas.width = canvas.width;
     exportCanvas.height = canvas.height;
     const ctx = exportCanvas.getContext('2d');
     
     if (ctx) {
       ctx.fillStyle = '#ffffff';
       ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
       ctx.drawImage(canvas, 0, 0);
     }
     
     const url = exportCanvas.toDataURL('image/png');
     const a = document.createElement('a');
     a.href = url;
     a.download = filename;
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
   }, []);
   
   const exportToSVG = useCallback((filename: string = 'drawing.svg') => {
     const objects = cadState.objects;
     const viewState = cadState.viewState;
     
     // Calculate bounds
     let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
     objects.forEach(obj => {
       const bounds = getObjectBounds(obj);
       minX = Math.min(minX, bounds.minX);
       minY = Math.min(minY, bounds.minY);
       maxX = Math.max(maxX, bounds.maxX);
       maxY = Math.max(maxY, bounds.maxY);
     });
     
     if (!isFinite(minX)) {
       minX = minY = 0;
       maxX = maxY = 100;
     }
     
     const padding = 20;
     const width = maxX - minX + padding * 2;
     const height = maxY - minY + padding * 2;
     
     let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
 <svg xmlns="http://www.w3.org/2000/svg" 
      width="${width}" height="${height}" 
      viewBox="${minX - padding} ${minY - padding} ${width} ${height}">
   <rect x="${minX - padding}" y="${minY - padding}" width="${width}" height="${height}" fill="white"/>
 `;
     
     objects.forEach(obj => {
       if (!obj.visible) return;
       const color = `rgb(${obj.color.r}, ${obj.color.g}, ${obj.color.b})`;
       const strokeWidth = obj.lineWeight || 1;
       const dashArray = obj.lineType === 'dashed' ? '5,5' : 
                         obj.lineType === 'dotted' ? '2,2' : 
                         obj.lineType === 'dashdot' ? '5,2,2,2' : '';
       
       switch (obj.type) {
         case 'line': {
           const data = obj.data as any;
           svgContent += `  <line x1="${data.start.x}" y1="${data.start.y}" x2="${data.end.x}" y2="${data.end.y}" 
     stroke="${color}" stroke-width="${strokeWidth}" ${dashArray ? `stroke-dasharray="${dashArray}"` : ''}/>\n`;
           break;
         }
         case 'circle': {
           const data = obj.data as any;
           svgContent += `  <circle cx="${data.center.x}" cy="${data.center.y}" r="${data.radius}" 
     fill="none" stroke="${color}" stroke-width="${strokeWidth}" ${dashArray ? `stroke-dasharray="${dashArray}"` : ''}/>\n`;
           break;
         }
         case 'rectangle': {
           const data = obj.data as any;
           const x = Math.min(data.corner1.x, data.corner2.x);
           const y = Math.min(data.corner1.y, data.corner2.y);
           const w = Math.abs(data.corner2.x - data.corner1.x);
           const h = Math.abs(data.corner2.y - data.corner1.y);
           svgContent += `  <rect x="${x}" y="${y}" width="${w}" height="${h}" 
     fill="none" stroke="${color}" stroke-width="${strokeWidth}" ${dashArray ? `stroke-dasharray="${dashArray}"` : ''}/>\n`;
           break;
         }
         case 'polyline': {
           const data = obj.data as any;
           const points = data.points.map((p: any) => `${p.x},${p.y}`).join(' ');
           const element = data.closed ? 'polygon' : 'polyline';
           svgContent += `  <${element} points="${points}" 
     fill="none" stroke="${color}" stroke-width="${strokeWidth}" ${dashArray ? `stroke-dasharray="${dashArray}"` : ''}/>\n`;
           break;
         }
         case 'arc': {
           const data = obj.data as any;
           const startX = data.center.x + data.radius * Math.cos(data.startAngle);
           const startY = data.center.y + data.radius * Math.sin(data.startAngle);
           const endX = data.center.x + data.radius * Math.cos(data.endAngle);
           const endY = data.center.y + data.radius * Math.sin(data.endAngle);
           const largeArc = Math.abs(data.endAngle - data.startAngle) > Math.PI ? 1 : 0;
           svgContent += `  <path d="M ${startX} ${startY} A ${data.radius} ${data.radius} 0 ${largeArc} 1 ${endX} ${endY}" 
     fill="none" stroke="${color}" stroke-width="${strokeWidth}" ${dashArray ? `stroke-dasharray="${dashArray}"` : ''}/>\n`;
           break;
         }
         case 'text': {
           const data = obj.data as any;
           svgContent += `  <text x="${data.position.x}" y="${data.position.y}" 
     fill="${color}" font-size="${data.height}" transform="rotate(${(data.rotation || 0) * 180 / Math.PI} ${data.position.x} ${data.position.y})">${data.content}</text>\n`;
           break;
         }
       }
     });
     
     svgContent += '</svg>';
     
     const blob = new Blob([svgContent], { type: 'image/svg+xml' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = filename;
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
     URL.revokeObjectURL(url);
   }, [cadState.objects]);
   
   const printDrawing = useCallback((canvas: HTMLCanvasElement | null) => {
     if (!canvas) {
       alert('No canvas available for printing');
       return;
     }
     
     const dataUrl = canvas.toDataURL('image/png');
     const printWindow = window.open('', '_blank');
     
     if (printWindow) {
       printWindow.document.write(`
         <html>
           <head>
             <title>Print Drawing</title>
             <style>
               body { margin: 0; display: flex; justify-content: center; align-items: center; }
               img { max-width: 100%; max-height: 100vh; }
               @media print {
                 body { margin: 0; }
                 img { width: 100%; height: auto; }
               }
             </style>
           </head>
           <body>
             <img src="${dataUrl}" onload="window.print(); window.close();" />
           </body>
         </html>
       `);
       printWindow.document.close();
     }
   }, []);
   
   return {
     newDrawing,
     saveDrawing,
     openDrawing,
     exportToPNG,
     exportToSVG,
     printDrawing
   };
 }
 
 function getObjectBounds(obj: any): { minX: number; minY: number; maxX: number; maxY: number } {
   const data = obj.data;
   
   switch (obj.type) {
     case 'line':
       return {
         minX: Math.min(data.start.x, data.end.x),
         minY: Math.min(data.start.y, data.end.y),
         maxX: Math.max(data.start.x, data.end.x),
         maxY: Math.max(data.start.y, data.end.y)
       };
     case 'circle':
       return {
         minX: data.center.x - data.radius,
         minY: data.center.y - data.radius,
         maxX: data.center.x + data.radius,
         maxY: data.center.y + data.radius
       };
     case 'rectangle':
       return {
         minX: Math.min(data.corner1.x, data.corner2.x),
         minY: Math.min(data.corner1.y, data.corner2.y),
         maxX: Math.max(data.corner1.x, data.corner2.x),
         maxY: Math.max(data.corner1.y, data.corner2.y)
       };
     case 'polyline':
       const xs = data.points.map((p: any) => p.x);
       const ys = data.points.map((p: any) => p.y);
       return {
         minX: Math.min(...xs),
         minY: Math.min(...ys),
         maxX: Math.max(...xs),
         maxY: Math.max(...ys)
       };
     default:
       return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
   }
 }
 
 export type FileOperationsAPI = ReturnType<typeof useFileOperations>;