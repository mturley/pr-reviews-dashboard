// Google Calendar API queries and transforms

import { googleRequest } from "./client.js";
import type { GoogleCredentials, CalendarEvent } from "../../types/google.js";

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  hangoutLink?: string;
  conferenceData?: { entryPoints?: Array<{ entryPointType: string; uri: string }> };
  attendees?: Array<{ email: string; displayName?: string }>;
  location?: string;
}

interface GoogleCalendarListResponse {
  items: GoogleCalendarEvent[];
}

function transformEvent(event: GoogleCalendarEvent, calendarLabel: string): CalendarEvent {
  const isAllDay = !event.start.dateTime;
  const startTime = event.start.dateTime ?? event.start.date ?? "";
  const endTime = event.end.dateTime ?? event.end.date ?? "";

  // Extract meeting link from hangoutLink or conferenceData
  let meetingLink = event.hangoutLink;
  if (!meetingLink && event.conferenceData?.entryPoints) {
    const videoEntry = event.conferenceData.entryPoints.find(
      (e) => e.entryPointType === "video",
    );
    meetingLink = videoEntry?.uri;
  }

  return {
    id: event.id,
    title: event.summary ?? "(No title)",
    startTime,
    endTime,
    isAllDay,
    calendarLabel,
    meetingLink,
    attendees: event.attendees?.map((a) => a.displayName ?? a.email),
    location: event.location,
  };
}

// Fetch events for a single day from a single account
async function fetchAccountEvents(
  credentials: GoogleCredentials,
  date: string, // YYYY-MM-DD
): Promise<CalendarEvent[]> {
  const timeMin = new Date(`${date}T00:00:00`).toISOString();
  const timeMax = new Date(`${date}T23:59:59`).toISOString();

  // If specific calendar IDs are configured, fetch from each; otherwise use "primary"
  const calendarIds = credentials.calendarIds?.length ? credentials.calendarIds : ["primary"];

  const allEvents: CalendarEvent[] = [];
  for (const calendarId of calendarIds) {
    try {
      const response = await googleRequest<GoogleCalendarListResponse>(
        credentials,
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          timeMin,
          timeMax,
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "50",
        },
      );
      for (const event of response.items ?? []) {
        allEvents.push(transformEvent(event, credentials.label));
      }
    } catch (err) {
      console.error(`[google] Failed to fetch calendar "${calendarId}" for "${credentials.label}":`, err);
      // Continue with other calendars rather than failing entirely
    }
  }

  return allEvents;
}

// Fetch events for a day across all configured Google accounts, merged and sorted
export async function fetchDayEvents(
  accounts: GoogleCredentials[],
  date: string,
): Promise<CalendarEvent[]> {
  const results = await Promise.allSettled(
    accounts.map((account) => fetchAccountEvents(account, date)),
  );

  const allEvents: CalendarEvent[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allEvents.push(...result.value);
    }
  }

  // Sort by start time, all-day events first
  allEvents.sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    return a.startTime.localeCompare(b.startTime);
  });

  return allEvents;
}
