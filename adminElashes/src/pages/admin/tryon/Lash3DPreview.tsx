import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { RenderProfile, OptionGroups } from '@/core/services/tryon/tryon.service';
import { buildPreviewMesh } from './previewGeometry';
import type { PreviewSelection } from './previewGeometry';
import { profileSvg } from './profilePreview';
export type PreviewCamera = {
    yaw: number;
    pitch: number;
    zoom: number;
};
type Orbit = PreviewCamera;
const initial: Orbit = { yaw: -.18, pitch: .25, zoom: 1 };
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const vertexSource = `attribute vec3 position;attribute vec3 normal;attribute float shade;
uniform float yaw;uniform float pitch;uniform float zoom;uniform float aspect;uniform float guideMode;uniform vec3 center;uniform float radius;
varying vec3 color;
vec3 rotate(vec3 p){float a=cos(yaw),b=sin(yaw),c=cos(pitch),d=sin(pitch);vec3 q=vec3(a*p.x+b*p.z,p.y,-b*p.x+a*p.z);return vec3(q.x,c*q.y-d*q.z,d*q.y+c*q.z);}
void main(){vec3 p=rotate(position-center);gl_Position=vec4(p.x/(radius*max(1.0,aspect))*zoom,p.y/(radius*max(1.0,1.0/aspect))*zoom,-p.z/radius*.7,1.0);
float light=.65+.35*abs(dot(normalize(rotate(normal)),normalize(vec3(.3,.7,1.0))));color=mix(vec3(shade*light),vec3(.055,.42,.28),guideMode);}`;
const fragmentSource = `precision mediump float;varying vec3 color;void main(){gl_FragColor=vec4(color,1.0);}`;
interface Renderer {
    draw: (orbit: Orbit) => void;
    setMesh: (mesh: ReturnType<typeof buildPreviewMesh>) => void;
    dispose: () => void;
}
function makeRenderer(canvas: HTMLCanvasElement, mesh: ReturnType<typeof buildPreviewMesh>): Renderer {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: true });
    if (!gl)
        throw new Error('WebGL no disponible');
    const shaders: WebGLShader[] = [], buffers: WebGLBuffer[] = [];
    let program: WebGLProgram | null = null;
    const cleanup = () => {
        for (const b of buffers)
            gl.deleteBuffer(b);
        for (const s of shaders)
            gl.deleteShader(s);
        if (program)
            gl.deleteProgram(program);
    };
    try {
        const compile = (kind: number, source: string) => {
            const s = gl.createShader(kind);
            if (!s)
                throw new Error('Shader no disponible');
            shaders.push(s);
            gl.shaderSource(s, source);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
                throw new Error('No se pudo preparar la vista 3D');
            return s;
        };
        program = gl.createProgram();
        if (!program)
            throw new Error('Vista 3D no disponible');
        gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
            throw new Error('No se pudo preparar la vista 3D');
        const attributes = { position: gl.getAttribLocation(program, 'position'), normal: gl.getAttribLocation(program, 'normal'), shade: gl.getAttribLocation(program, 'shade') };
        const uniforms = Object.fromEntries(['yaw', 'pitch', 'zoom', 'aspect', 'guideMode', 'center', 'radius'].map(k => [k, gl.getUniformLocation(program!, k)]));
        const upload = (data: Float32Array) => {
            const b = gl.createBuffer();
            if (!b)
                throw new Error('Vista 3D no disponible');
            buffers.push(b);
            gl.bindBuffer(gl.ARRAY_BUFFER, b);
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
            return b;
        };
        const fibers = upload(mesh.vertices), guide = upload(mesh.guide);
        return { setMesh: (next) => {
                mesh = next;
                gl.bindBuffer(gl.ARRAY_BUFFER, fibers);
                gl.bufferData(gl.ARRAY_BUFFER, next.vertices, gl.DYNAMIC_DRAW);
                gl.bindBuffer(gl.ARRAY_BUFFER, guide);
                gl.bufferData(gl.ARRAY_BUFFER, next.guide, gl.DYNAMIC_DRAW);
            }, draw: (orbit) => {
                const ratio = Math.min(window.devicePixelRatio || 1, 2), width = Math.max(1, Math.round(canvas.clientWidth * ratio)), height = Math.max(1, Math.round(canvas.clientHeight * ratio));
                if (canvas.width !== width || canvas.height !== height) {
                    canvas.width = width;
                    canvas.height = height;
                }
                gl.viewport(0, 0, width, height);
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                gl.enable(gl.DEPTH_TEST);
                gl.disable(gl.CULL_FACE);
                gl.useProgram(program);
                for (const key of ['yaw', 'pitch', 'zoom'] as const)
                    gl.uniform1f(uniforms[key], orbit[key]);
                gl.uniform1f(uniforms.aspect, width / height);
                gl.uniform3fv(uniforms.center, mesh.center);
                gl.uniform1f(uniforms.radius, mesh.radius);
                gl.bindBuffer(gl.ARRAY_BUFFER, fibers);
                gl.enableVertexAttribArray(attributes.position);
                gl.vertexAttribPointer(attributes.position, 3, gl.FLOAT, false, 28, 0);
                gl.enableVertexAttribArray(attributes.normal);
                gl.vertexAttribPointer(attributes.normal, 3, gl.FLOAT, false, 28, 12);
                gl.enableVertexAttribArray(attributes.shade);
                gl.vertexAttribPointer(attributes.shade, 1, gl.FLOAT, false, 28, 24);
                gl.uniform1f(uniforms.guideMode, 0);
                gl.drawArrays(gl.TRIANGLES, 0, mesh.vertices.length / 7);
                gl.bindBuffer(gl.ARRAY_BUFFER, guide);
                gl.vertexAttribPointer(attributes.position, 3, gl.FLOAT, false, 12, 0);
                gl.disableVertexAttribArray(attributes.normal);
                gl.vertexAttrib3f(attributes.normal, 0, 0, 1);
                gl.disableVertexAttribArray(attributes.shade);
                gl.vertexAttrib1f(attributes.shade, .1);
                gl.depthFunc(gl.LEQUAL);
                gl.uniform1f(uniforms.guideMode, 1);
                gl.drawArrays(gl.LINE_STRIP, 0, mesh.guide.length / 3);
                gl.depthFunc(gl.LESS);
            }, dispose: cleanup };
    }
    catch (e) {
        cleanup();
        throw e;
    }
}
export default function Lash3DPreview({ profile, selection, options, initialView, canExpand = true, cinematic = false, camera }: {
    cinematic?: boolean;
    camera?: PreviewCamera;
    initialView?: 'front' | 'profile';
    canExpand?: boolean;
    profile: RenderProfile;
    selection: PreviewSelection;
    options: OptionGroups;
}) {
    const defaultOrbit = useMemo(() => initialView === 'profile' ? { yaw: 1.15, pitch: .12, zoom: 1 } : initialView === 'front' ? { yaw: 0, pitch: 0, zoom: 1 } : initial, [initialView]);
    const canvas = useRef<HTMLCanvasElement>(null), renderer = useRef<Renderer | null>(null), orbitRef = useRef(defaultOrbit), pointers = useRef(new Map<number, {
        x: number;
        y: number;
    }>());
    const [expanded, setExpanded] = useState(false);
    const container = useRef<HTMLDivElement>(null), expandButton = useRef<HTMLButtonElement>(null), wasExpanded = useRef(false);
    const [orbit, setOrbit] = useState(defaultOrbit), [closed, setClosed] = useState(false), [unavailable, setUnavailable] = useState(false);
    const mesh = useMemo(() => buildPreviewMesh(profile, selection, options, closed), [profile, selection, options, closed]);
    const meshRef = useRef(mesh);
    useEffect(() => {
        const node = canvas.current;
        if (!node)
            return;
        let current: Renderer | undefined;
        const init = () => {
            try {
                current = makeRenderer(node, meshRef.current);
                renderer.current = current;
                setUnavailable(false);
                current.draw(orbitRef.current);
            }
            catch {
                setUnavailable(true);
            }
        };
        const lost = (e: Event) => { e.preventDefault(); renderer.current = null; setUnavailable(true); };
        const restored = () => { current?.dispose(); init(); };
        node.addEventListener('webglcontextlost', lost);
        node.addEventListener('webglcontextrestored', restored);
        init();
        const resize = new ResizeObserver(() => renderer.current?.draw(orbitRef.current));
        resize.observe(node);
        return () => {
            resize.disconnect();
            node.removeEventListener('webglcontextlost', lost);
            node.removeEventListener('webglcontextrestored', restored);
            current?.dispose();
            renderer.current = null;
            if (!node.isConnected) {
                const gl = node.getContext('webgl');
                gl?.getExtension('WEBGL_lose_context')?.loseContext();
            }
        };
    }, [expanded]);
    useEffect(() => { meshRef.current = mesh; renderer.current?.setMesh(mesh); renderer.current?.draw(orbitRef.current); }, [mesh]);
    useEffect(() => { const view = camera ?? orbit; orbitRef.current = view; const frame = requestAnimationFrame(() => renderer.current?.draw(view)); return () => cancelAnimationFrame(frame); }, [orbit, camera]);
    useEffect(() => {
        const node = canvas.current;
        if (!node || cinematic)
            return;
        const wheel = (e: WheelEvent) => { e.preventDefault(); setOrbit(o => ({ ...o, zoom: clamp(o.zoom * Math.exp(-e.deltaY * .001), .65, 2.6) })); };
        node.addEventListener('wheel', wheel, { passive: false });
        return () => node.removeEventListener('wheel', wheel);
    }, [expanded, cinematic]);
    useEffect(() => {
        if (expanded === wasExpanded.current)
            return;
        wasExpanded.current = expanded;
        pointers.current.clear();
        const frame = requestAnimationFrame(() => {
            if (expanded)
                canvas.current?.focus();
            else
                expandButton.current?.focus();
        });
        return () => cancelAnimationFrame(frame);
    }, [expanded]);
    function move(e: ReactPointerEvent<HTMLCanvasElement>) {
        const previous = pointers.current.get(e.pointerId);
        if (!previous)
            return;
        const old = [...pointers.current.values()];
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const next = [...pointers.current.values()];
        if (next.length === 2) {
            const a = Math.hypot(old[0].x - old[1].x, old[0].y - old[1].y), b = Math.hypot(next[0].x - next[1].x, next[0].y - next[1].y);
            if (a > 0)
                setOrbit(o => ({ ...o, zoom: clamp(o.zoom * b / a, .65, 2.6) }));
        }
        else if (next.length === 1)
            setOrbit(o => ({ ...o, yaw: o.yaw + (e.clientX - previous.x) * .012, pitch: clamp(o.pitch + (e.clientY - previous.y) * .012, -1.55, 1.55) }));
    }
    function keyboard(e: KeyboardEvent<HTMLCanvasElement>) {
        const key = e.key;
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', 'Home'].includes(key))
            return;
        e.preventDefault();
        setOrbit(o => key === 'Home' ? defaultOrbit : { yaw: o.yaw + (key === 'ArrowLeft' ? -.15 : key === 'ArrowRight' ? .15 : 0), pitch: clamp(o.pitch + (key === 'ArrowUp' ? -.15 : key === 'ArrowDown' ? .15 : 0), -1.55, 1.55), zoom: clamp(o.zoom * (key === '+' ? 1.15 : key === '-' ? 1 / 1.15 : 1), .65, 2.6) });
    }
    const button = 'rounded-sm border border-[#edebe9] bg-white px-2 py-1.5 text-xs text-[#323130] hover:bg-[#f3f2f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#094732]';
    function expandedKeys(e: KeyboardEvent<HTMLDivElement>) {
        if (!expanded)
            return;
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setExpanded(false);
            return;
        }
        if (e.key === 'Tab') {
            const items = container.current?.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]');
            if (!items?.length)
                return;
            const first = items[0], last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
            else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }
    const content = <div ref={container} role={expanded ? 'dialog' : undefined} aria-modal={expanded ? true : undefined} aria-label={expanded ? 'Vista ampliada de la pestaña' : undefined} onKeyDown={expandedKeys} onClick={e => e.stopPropagation()} className={expanded ? 'w-full max-w-[1400px] max-h-[94dvh] overflow-y-auto rounded-sm border border-[#edebe9] bg-white p-4 space-y-3' : 'space-y-3'}>
  {!cinematic && <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-medium text-[#605e5c]">Vista 3D · {mesh.fibers} fibras</span><div className="flex flex-wrap gap-1">{canExpand && <button ref={expandButton} type="button" className={`${button} inline-flex items-center gap-1`} aria-label={expanded ? "Reducir vista 3D" : "Ampliar vista 3D"} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={14}/> : <Maximize2 size={14}/>} {expanded ? "Reducir" : "Ampliar"}</button>}{[false, true].map(value => <button type="button" key={String(value)} aria-pressed={closed === value} className={`${button} ${closed === value ? '!border-[#094732] !bg-[#eaf4ef]' : ''}`} onClick={() => setClosed(value)}>{value ? 'Cerrado' : 'Abierto'}</button>)}</div></div>}
  <div className="relative overflow-hidden rounded-sm border border-[#edebe9] bg-[#f7f9f7]" style={{ backgroundImage: 'radial-gradient(circle at 50% 40%, #ffffff, #edf3ef)' }}>
   <canvas ref={canvas} className={`${cinematic ? 'h-[min(48dvh,480px)]' : expanded ? 'h-[min(65dvh,720px)]' : 'h-[280px]'} w-full touch-none ${cinematic ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#094732] ${unavailable ? 'invisible' : ''}`} aria-label={cinematic ? "Demostración 3D del ajuste" : "Pestaña 3D interactiva: arrastra para girar, rueda para acercar"} tabIndex={cinematic ? -1 : 0} onKeyDown={cinematic ? undefined : keyboard} onPointerDown={e => {
            if (cinematic)
                return;
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            e.currentTarget.setPointerCapture(e.pointerId);
        }} onPointerMove={cinematic ? undefined : move} onPointerUp={e => pointers.current.delete(e.pointerId)} onPointerCancel={e => pointers.current.delete(e.pointerId)} onLostPointerCapture={e => pointers.current.delete(e.pointerId)}/>
   {unavailable && <div className="absolute inset-0 flex flex-col justify-center p-4"><div dangerouslySetInnerHTML={{ __html: profileSvg(profile, selection.length, selection.technique, selection.thickness, closed, options) }}/><p role="status" className="text-center text-xs text-[#605e5c]">Vista 2D: la aceleración 3D no está disponible en este navegador.</p></div>}
  </div>
  {!cinematic && <div className="flex flex-wrap items-center gap-1" aria-label="Ángulos de la pestaña"><button type="button" className={button} onClick={() => setOrbit(o => ({ ...o, yaw: 0, pitch: 0 }))}>Frente</button><button type="button" className={button} onClick={() => setOrbit(o => ({ ...o, yaw: 1.15, pitch: .12 }))}>Perfil</button><button type="button" className={button} onClick={() => setOrbit(o => ({ ...o, yaw: 0, pitch: 1.4 }))}>Desde arriba</button><button type="button" className={button} aria-label="Alejar pestaña" onClick={() => setOrbit(o => ({ ...o, zoom: clamp(o.zoom / 1.2, .65, 2.6) }))}><ZoomOut size={14}/></button><button type="button" className={button} aria-label="Acercar pestaña" onClick={() => setOrbit(o => ({ ...o, zoom: clamp(o.zoom * 1.2, .65, 2.6) }))}><ZoomIn size={14}/></button><button type="button" className={button} aria-label="Restablecer vista 3D" onClick={() => setOrbit(defaultOrbit)}><RotateCcw size={14}/></button></div>}
  {!cinematic && <p className="text-xs text-[#605e5c]">Arrastra para girar. Usa la rueda o dos dedos para acercar. Con el teclado, usa las flechas y +/−.</p>}
 </div>;
    return expanded ? createPortal(<div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#021a12]/60 p-3 backdrop-blur-[2px]" onClick={() => setExpanded(false)}>{content}</div>, document.body) : content;
}
