export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  calendarLabel: string;
  meetingLink?: string;
  attendees?: string[];
  location?: string;
}

export interface GoogleCredentials {
  label: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarIds?: string[];
}
