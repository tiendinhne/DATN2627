export type WhiteboardTool =
  | "select"
  | "hand"
  | "shape"
  | "circle"
  | "pen"
  | "text"
  | "image"
  | "eraser";

export interface WhiteboardElement {
  id: string;
  type: string;
  x: number;
  y: number;
  text?: string;
}

export interface WhiteboardState {
  roomId: string;
  meetingId: string;
  elements: WhiteboardElement[];
  lastSaved: string;
}
