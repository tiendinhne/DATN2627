import type { WhiteboardState } from "../types";

export const whiteboardService = {
  async getSnapshot(meetingId: string): Promise<WhiteboardState> {
    return {
      roomId: "software-engineering",
      meetingId,
      elements: [],
      lastSaved: "14:32",
    };
  },

  async saveSnapshot(meetingId: string, state: Partial<WhiteboardState>): Promise<{ success: boolean }> {
    return { success: true };
  },

  async generateAIFlowchart(prompt: string): Promise<{ success: boolean; nodesCount: number }> {
    return { success: true, nodesCount: 4 };
  },
};

export default whiteboardService;
