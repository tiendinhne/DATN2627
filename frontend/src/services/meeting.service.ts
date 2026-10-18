import type { JoinMeetingResponse, Meeting, MeetingListResponse } from '@/types/backend';
import { request } from './api';

export const startMeeting = (token: string, roomId: string, title: string) =>
  request<Meeting>(token, `/rooms/${roomId}/meetings`, { method: 'POST', body: JSON.stringify({ title }) });

// 20 buổi gần nhất — theo backend spec §11.2
export const listMeetings = (token: string, roomId: string) =>
  request<MeetingListResponse>(token, `/rooms/${roomId}/meetings?page=1&limit=20`);

export const joinMeeting = (token: string, meetingId: string) =>
  request<JoinMeetingResponse>(token, `/meetings/${meetingId}/join`, { method: 'POST' });

export const endMeeting = (token: string, meetingId: string) =>
  request<void>(token, `/meetings/${meetingId}/end`, { method: 'POST' });
