import { config } from "../util/config.ts";
import setCookie from "npm:set-cookie-parser";

interface Auth {
  cookie: string;
  token: string;
}

interface Period {
  date: number;
  startTime: number;
  endTime: number;
  content?: string | null;
}

export interface PeriodInfo {
  content: string;
  name: string;
  date: string;
  minutesTaken: number;
}

const formatDateTime = (date: number, time: number): string => {
  const year = Math.floor(date / 10000);
  const month = Math.floor((date % 10000) / 100);
  const day = date % 100;
  const hour = Math.floor(time / 100);
  const minute = time % 100;
  const formattedDate = `${year.toString().padStart(4, "0")}-${
    month.toString().padStart(2, "0")
  }-${day.toString().padStart(2, "0")}`;
  const formattedTime = `${hour.toString().padStart(2, "0")}:${
    minute.toString().padStart(2, "0")
  }:00`;
  return `${formattedDate}T${formattedTime}`;
};

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getMinutesBetweenTimes = (startTime: number, endTime: number): number => {
  const startHour = Math.floor(startTime / 100);
  const startMinute = startTime % 100;
  const endHour = Math.floor(endTime / 100);
  const endMinute = endTime % 100;
  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;
  return endTotalMinutes - startTotalMinutes;
};

export const auth = async (): Promise<Auth> => {
  const cookiesResponse = await fetch(
    "https://ajax.webuntis.com/WebUntis/j_spring_security_check",
    {
      "headers": {
        "accept": "application/json",
        "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
        "cache-control": "no-cache",
        "content-type": "application/x-www-form-urlencoded",
        "pragma": "no-cache",
        "priority": "u=1, i",
        "sec-ch-ua": '"Not?A_Brand";v="99", "Chromium";v="130"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "tenant-id": "90849",
        "Referer": "https://ajax.webuntis.com/WebUntis/",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      "body":
        `school=heinrich-hertz-schule&j_username=${config.untis_username}&j_password=${
          encodeURIComponent(config.untis_password)
        }&token=`,
      "method": "POST",
    },
  );
  const cookie = setCookie.parse(
    setCookie.splitCookiesString(cookiesResponse.headers.get("Set-Cookie")),
    {
      map: true,
    },
  );
  const cookies =
    `JSESSIONID=${cookie.JSESSIONID.value}; schoolname=${cookie.schoolname.value}; Tenant-Id=${
      cookie["Tenant-Id"].value
    }";`;
  //console.log(cookie)
  const tokenResponse = await fetch(
    "https://ajax.webuntis.com/WebUntis/api/token/new",
    {
      "headers": {
        "accept": "application/json, text/plain, */*",
        "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "priority": "u=1, i",
        "sec-ch-ua": '"Not?A_Brand";v="99", "Chromium";v="130"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "cookie": cookies,
        "Referer": "https://ajax.webuntis.com/",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      "body": null,
      "method": "GET",
    },
  );

  const token = await tokenResponse.text();

  return {
    cookie: cookies,
    token,
  };
};

const getElementId = async (auth: Auth): Promise<number> => {
  const response = await fetch(
    `https://ajax.webuntis.com/WebUntis/api/public/timetable/weekly/pageconfig?type=5&date=${
      (new Date()).toLocaleDateString().split(".").reverse().join("-")
    }&isMyTimetableSelected=true`,
    {
      "headers": {
        "accept": "application/json",
        "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "priority": "u=1, i",
        "sec-ch-ua": '"Not?A_Brand";v="99", "Chromium";v="130"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "tenant-id": "6338400",
        "cookie": auth.cookie,
        "Referer":
          "https://ajax.webuntis.com/WebUntis/embedded.do?showSidebar=false",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      "body": null,
      "method": "GET",
    },
  );
  if (!response.ok) {
    throw new Error("Couldn't fetch element id 1");
  }
  const json = await response.json();
  const id = json?.data?.elements[0]?.id;
  if (json?.data?.elements[0]?.id) {
    return id;
  } else {
    throw new Error("Couldn't fetch element id 2");
  }
};

export const getTimeTable = async (
  auth: Auth,
  weekStart: Date,
): Promise<Map<number, Period[]> | null> => {
  const elementId = await getElementId(auth);
  const response = await fetch(
    `https://ajax.webuntis.com/WebUntis/api/public/timetable/weekly/data?elementType=5&elementId=${elementId}&date=${
      formatDate(weekStart)
    }&formatId=5`,
    {
      "headers": {
        "accept": "application/json",
        "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "priority": "u=1, i",
        "sec-ch-ua": '"Not?A_Brand";v="99", "Chromium";v="130"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "tenant-id": "6338400",
        "cookie": auth.cookie,
        "Referer":
          "https://ajax.webuntis.com/WebUntis/embedded.do?showSidebar=false",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      "body": null,
      "method": "GET",
    },
  );
  const json = await response.json();
  const days = new Map();
  const periods: Period[] = json?.data?.result?.data?.elementPeriods["35347"] ??
    null;
  if (!periods || periods.length === 0) {
    return null;
  }
  for (const period of periods) {
    if (days.has(period.date)) {
      days.set(period.date, [...days.get(period.date), period]);
    } else {
      days.set(period.date, [period]);
    }
  }
  return days;
};

export const getPeriodContent = async (
  auth: Auth,
  period: Period,
): Promise<PeriodInfo | null> => {
  const response = await fetch(
    `https://ajax.webuntis.com/WebUntis/api/rest/view/v2/calendar-entry/detail?elementId=35347&elementType=5&endDateTime=${
      encodeURI(formatDateTime(period.date, period.endTime))
    }&homeworkOption=DUE&startDateTime=${
      encodeURI(formatDateTime(period.date, period.startTime))
    }`,
    {
      "headers": {
        "accept": "application/json, text/plain, */*",
        "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
        "authorization": `Bearer ${auth.token}`,
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "priority": "u=1, i",
        "sec-ch-ua": '"Not?A_Brand";v="99", "Chromium";v="130"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "tenant-id": "6338400",
        "x-webuntis-api-school-year-id": "16",
        "cookie": auth.cookie,
        "Referer":
          "https://ajax.webuntis.com/timetable-students-my/2024-09-16/modal/details/2037903/false/35347/5/2024-09-20T09%3A30%3A00%2B02%3A00/2024-09-20T10%3A15%3A00%2B02%3A00/class-register",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      "body": null,
      "method": "GET",
    },
  );
  const json = await response.json();
  if (!json.calendarEntries || json.calendarEntries.length === 0) return null;
  if (json.calendarEntries[0].teachingContent) {
    return {
      content: json.calendarEntries[0].teachingContent,
      name: `${json.calendarEntries[0]?.subject?.shortName ?? "-"} - ${
        json.calendarEntries[0]?.teachers[0]?.longName ?? "-"
      }`,
      date: formatDateTime(period.date, period.startTime),
      minutesTaken: getMinutesBetweenTimes(period.startTime, period.endTime),
    };
  }
  for (const entry of json.calendarEntries) {
    if (!entry.teachingContent) {
      continue;
    }
    return {
      content: entry.teachingContent,
      name: `${entry?.subject?.shortName ?? "-"} - ${
        entry?.teachers[0]?.longName ?? ""
      }`,
      date: formatDateTime(period.date, period.startTime),
      minutesTaken: getMinutesBetweenTimes(period.startTime, period.endTime),
    };
  }
  return null;
};
