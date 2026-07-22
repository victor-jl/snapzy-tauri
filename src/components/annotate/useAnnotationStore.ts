import { create } from "zustand";

export type AnnotationTool =
  | "select"
  | "arrow"
  | "rectangle"
  | "ellipse"
  | "line"
  | "text"
  | "blur"
  | "crop"
  | "highlighter"
  | "pen"
  | "mosaic"
  | "stepCounter";

export interface AnnotationPoint {
  x: number;
  y: number;
}

export interface Annotation {
  id: string;
  type: Exclude<AnnotationTool, "select">;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
  opacity: number;
  rotation: number;
  points: AnnotationPoint[];
  text: string;
  fontSize?: number;
  fontFamily?: string;
  data: Record<string, unknown>;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
}

const MAX_HISTORY = 50;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function createSnapshot(annotations: Annotation[]): Annotation[] {
  return annotations.map((a) => ({
    ...a,
    points: a.points.map((p) => ({ ...p })),
    data: { ...a.data },
  }));
}

interface AnnotationState {
  annotations: Annotation[];
  activeTool: AnnotationTool;
  selectedAnnotationId: string | null;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  fontSize: number;
  fontFamily: string;
  blurIntensity: number;
  zoom: number;
  panOffset: { x: number; y: number };
  undoStack: Annotation[][];
  redoStack: Annotation[][];
  isDrawing: boolean;
  drawingAnnotation: Annotation | null;

  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  removeSelectedAnnotation: () => void;
  selectAnnotation: (id: string | null) => void;
  setTool: (tool: AnnotationTool) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setOpacity: (opacity: number) => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setBlurIntensity: (intensity: number) => void;
  undo: () => void;
  redo: () => void;
  setZoom: (zoom: number) => void;
  setPan: (offset: { x: number; y: number }) => void;
  clearAll: () => void;
  setIsDrawing: (drawing: boolean) => void;
  setDrawingAnnotation: (annotation: Annotation | null) => void;
  saveHistorySnapshot: () => void;
  createAnnotation: (
    type: Exclude<AnnotationTool, "select">,
    overrides?: Partial<Annotation>
  ) => Annotation;
}

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  annotations: [],
  activeTool: "select",
  selectedAnnotationId: null,
  strokeColor: "#FF453A",
  strokeWidth: 3,
  opacity: 100,
  fontSize: 24,
  fontFamily: "Inter, system-ui, sans-serif",
  blurIntensity: 50,
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  undoStack: [],
  redoStack: [],
  isDrawing: false,
  drawingAnnotation: null,

  addAnnotation: (annotation) => {
    const state = get();
    const snapshot = createSnapshot(state.annotations);
    set({
      annotations: [...state.annotations, annotation],
      undoStack: [...state.undoStack.slice(-MAX_HISTORY + 1), snapshot],
      redoStack: [],
      selectedAnnotationId: annotation.id,
    });
  },

  updateAnnotation: (id, updates) => {
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    }));
  },

  removeAnnotation: (id) => {
    const state = get();
    const snapshot = createSnapshot(state.annotations);
    set({
      annotations: state.annotations.filter((a) => a.id !== id),
      undoStack: [...state.undoStack.slice(-MAX_HISTORY + 1), snapshot],
      redoStack: [],
      selectedAnnotationId:
        state.selectedAnnotationId === id ? null : state.selectedAnnotationId,
    });
  },

  removeSelectedAnnotation: () => {
    const state = get();
    if (state.selectedAnnotationId) {
      const snapshot = createSnapshot(state.annotations);
      set({
        annotations: state.annotations.filter(
          (a) => a.id !== state.selectedAnnotationId
        ),
        undoStack: [...state.undoStack.slice(-MAX_HISTORY + 1), snapshot],
        redoStack: [],
        selectedAnnotationId: null,
      });
    }
  },

  selectAnnotation: (id) => set({ selectedAnnotationId: id }),

  setTool: (tool) => set({ activeTool: tool, selectedAnnotationId: null }),

  setStrokeColor: (color) => set({ strokeColor: color }),

  setStrokeWidth: (width) => set({ strokeWidth: width }),

  setOpacity: (opacity) => set({ opacity: Math.max(10, Math.min(100, opacity)) }),

  setFontSize: (size) => set({ fontSize: size }),

  setFontFamily: (family) => set({ fontFamily: family }),

  setBlurIntensity: (intensity) =>
    set({ blurIntensity: Math.max(1, Math.min(100, intensity)) }),

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return;
    const prevSnapshot = state.undoStack[state.undoStack.length - 1];
    const currentSnapshot = createSnapshot(state.annotations);
    set({
      annotations: prevSnapshot,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [
        ...state.redoStack.slice(-MAX_HISTORY + 1),
        currentSnapshot,
      ],
      selectedAnnotationId: null,
    });
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return;
    const nextSnapshot = state.redoStack[state.redoStack.length - 1];
    const currentSnapshot = createSnapshot(state.annotations);
    set({
      annotations: nextSnapshot,
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [
        ...state.undoStack.slice(-MAX_HISTORY + 1),
        currentSnapshot,
      ],
      selectedAnnotationId: null,
    });
  },

  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5, zoom)) }),

  setPan: (offset) => set({ panOffset: offset }),

  clearAll: () => {
    const state = get();
    const snapshot = createSnapshot(state.annotations);
    set({
      annotations: [],
      undoStack: [...state.undoStack.slice(-MAX_HISTORY + 1), snapshot],
      redoStack: [],
      selectedAnnotationId: null,
    });
  },

  setIsDrawing: (drawing) => set({ isDrawing: drawing }),

  setDrawingAnnotation: (annotation) => set({ drawingAnnotation: annotation }),

  saveHistorySnapshot: () => {
    const state = get();
    const snapshot = createSnapshot(state.annotations);
    set({
      undoStack: [...state.undoStack.slice(-MAX_HISTORY + 1), snapshot],
      redoStack: [],
    });
  },

  createAnnotation: (type, overrides = {}) => {
    const state = get();
    return {
      id: generateId(),
      type,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      color: state.strokeColor,
      strokeWidth: type === "highlighter" ? 20 : state.strokeWidth,
      opacity: state.opacity,
      rotation: 0,
      points: [],
      text: "",
      fontSize: state.fontSize,
      fontFamily: state.fontFamily,
      data: {},
      ...overrides,
    };
  },
}));
