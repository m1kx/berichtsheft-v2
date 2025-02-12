import { config } from "./util/config.ts";
import { type AbsenceData, getAbsences } from "./api/absence.ts";
import { getWeekNumberForDateAndCookie } from "./api/azubiheft.ts";
import { getCommitsForUser, getPullrequestsForUser } from "./api/bitbucket.ts";
import { getIssueDescription, getTicketHeading } from "./api/jira.ts";
import {
  type Auth,
  auth,
  getPeriodContent,
  getTimeTable,
  type Period,
  type PeriodInfo,
} from "./api/webuntis.ts";
import type { TimeRange } from "./types/time.ts";
import chalk from "npm:chalk";
import { ticketDescriptionToActivity } from "./util/ollama.ts";
import type { User } from "./types/bitbucket.ts";

interface Data {
  issueDescription: string;
  issueHeading: string;
}

const getTextForSchoolWeek = async (
  days: Map<number, Period[]> | null,
  untisAuth: Auth,
  absences: AbsenceData,
): Promise<string | null> => {
  const allSubjectsInWeek: PeriodInfo[] = [];
  let minutes = 0;

  const keys = days!.keys();

  for (const key of Array.from(keys).sort((a, b) => a - b)) {
    const day = days?.get(key);
    if (!day) continue;
    day.sort((a, b) => a.startTime - b.startTime);
    for (const period of day) {
      const info = await getPeriodContent(untisAuth, period);
      if (info) {
        minutes += info.minutesTaken;
        if (
          allSubjectsInWeek.some((value) => value.content === info.content)
        ) {
          continue;
        }
        allSubjectsInWeek.push(info);
      }
    }
  }

  if (allSubjectsInWeek.length === 0) {
    console.log(chalk.green("Status: No school"));
    return null;
  }

  let text = absences.holidays.map((holiday) => {
    return `${
      (new Date(holiday.date)).toLocaleDateString("de-DE")
    }: ${holiday.reason}\n`;
  }).join("");

  text += text === "" ? "" : "\n";

  text += allSubjectsInWeek.map((info) => {
    return `Fach: ${info.name}\nInhalt: ${info.content}\n`;
  }).join("\n");

  return text;
};

export const getTextForWeek = async (
  user: User,
  week: TimeRange,
): Promise<string> => {
  if (!user.uuid) {
    return "";
  }

  const weekNumberAndCookie = await getWeekNumberForDateAndCookie(
    week.from,
    false,
  );

  console.log(
    `Fetching data for Week from [${
      chalk.bgBlueBright(week.from.toLocaleDateString("de-DE"))
    }] to [${
      chalk.bgBlueBright(week.to.toLocaleDateString("de-DE"))
    }] Number: [${weekNumberAndCookie.number}]`,
  );

  const untisAuth = await auth();
  const days = await getTimeTable(untisAuth, week.from);

  const [absences, isSchool] = await getAbsences({
    from: week.from,
    to: week.to,
  });

  if (!days || !isSchool) {
    console.log(chalk.yellow("Status: No school week detected"));
  } else {
    console.log(
      chalk.green(
        `Status: School week detected ${isSchool ? "from absence" : ""}`,
      ),
    );
    return await getTextForSchoolWeek(days!, untisAuth, absences) ?? "";
  }

  console.log(
    `Scraping week number and deleting data for ${
      week.from.toLocaleDateString("de-DE")
    }`,
  );

  const allActivity = new Map<string, Data>();
  const commits = await getCommitsForUser(user.uuid, {
    from: week.from,
    to: week.to,
  });
  for (const commit of commits) {
    const match = commit.rendered.message.raw.match(/([A-Z]+-\d+)/);
    const result = match ? match[0] : null;
    if (!result || allActivity.has(result)) continue;
    const heading = await getTicketHeading(result);
    const description = await getIssueDescription(result);
    allActivity.set(result, {
      issueHeading: heading,
      issueDescription: description,
    });
  }

  const pullrequests = await getPullrequestsForUser(user.uuid, {
    from: week.from,
    to: week.to,
  });

  if (!pullrequests?.values) {
    Deno.exit();
  }

  for (const pullrequest of pullrequests.values) {
    const match = pullrequest.title.match(/([A-Z]+-\d+)/);
    const result = match ? match[0] : null;
    if (!result || allActivity.has(result)) continue;
    const heading = await getTicketHeading(result);
    const description = await getIssueDescription(result);
    allActivity.set(result, {
      issueHeading: heading,
      issueDescription: description,
    });
  }

  let totalHoursLost = 0;
  let finalString = absences.absences.map((absence) => {
    totalHoursLost += absence.hours;
    return `${(new Date(absence.date)).toLocaleDateString("de-DE")}:${
      absence.hours === 4 ? " 1/2 Tag" : ""
    } ${absence.reason}\n`;
  }).join("");

  finalString += absences.holidays.map((holiday) => {
    totalHoursLost += holiday.hours;
    return `${(new Date(holiday.date)).toLocaleDateString("de-DE")}:${
      holiday.hours === 4 ? " 1/2 Tag" : ""
    } ${holiday.reason}\n`;
  }).join("");

  finalString += finalString === "" ? "" : "\n";

  if (config.ai_method === "gpt") {
    finalString += (await Promise.all(
      Array.from(allActivity.entries()).map(async ([key, data]) => {
        const activity = await ticketDescriptionToActivity(
          data.issueDescription,
        );
        return `${key}: ${data.issueHeading}\n${activity}\n`;
      }),
    )).join("");
  } else {
    let finalString = "";
    for (const [key, data] of allActivity.entries()) {
      const activity = await ticketDescriptionToActivity(
        data.issueDescription,
      );
      finalString += `${key}: ${data.issueHeading}\n${activity}\n`;
    }
  }

  if (finalString === "") {
    console.log(chalk.red("Status: No Data"));
    return "";
  }

  return finalString;
};
