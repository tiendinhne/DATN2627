/**
 * WebRTC Service stub.
 * Prepared for future WebRTC media server / signaling integration (mediasoup / Janus / LiveKit).
 * Currently operates in mock mode without active media server connections.
 */
export const webrtcService = {
  async initLocalMedia(constraints: MediaStreamConstraints = { audio: true, video: true }): Promise<null> {
    // In mock mode, media devices are not captured
    return null;
  },

  async joinRoom(roomId: string, participantId: string): Promise<{ success: boolean }> {
    return { success: true };
  },

  async leaveRoom(): Promise<void> {
    // Clean up peer connections
  },

  toggleAudio(muted: boolean): boolean {
    return !muted;
  },

  toggleVideo(enabled: boolean): boolean {
    return !enabled;
  },
};

export default webrtcService;
