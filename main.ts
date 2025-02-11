import {
  applyActivityToNumber,
  getWeekNumberForDateAndCookie,
} from "./src/api/azubiheft.ts";
import {
  getCommitsForUser,
  getPullRequestForCommit,
  getPullrequestsForUser,
  getUser,
} from "./src/api/bitbucket.ts";
import {
  getIssueDescription,
  getTicketHeading,
  getTicketStatus,
} from "./src/api/jira.ts";
import { loadConfig, writeConfig } from "./src/util/config.ts";

import {
  commitMessageToTicket,
  formatTextWithHTML,
} from "./src/util/format.ts";
import { getLastWeeks, getTodaysDate } from "./src/util/date.ts";
import { ticketDescriptionToActivity } from "./src/util/ollama.ts";
import {
  auth,
  getPeriodContent,
  getTimeTable,
  PeriodInfo,
} from "./src/api/webuntis.ts";
import { formatDateRange, getCurrentWeek } from "./src/util/date.ts";
import chalk from "npm:chalk";
import { checkbox } from "npm:@inquirer/prompts";
import { getAbsences } from "./src/api/absence.ts";
import { getStatusEmoji } from "./src/util/status.ts";
import { config } from "./src/util/config.ts";

try {
  await Deno.lstat("config.json");
} catch (err) {
  if (!(err instanceof Deno.errors.NotFound)) {
    throw err;
  }
  await writeConfig();
}

const configOk = await loadConfig();

if (!configOk) {
  throw new Error("Couldn't load config file");
}

const user = await getUser();

if (!user.uuid) {
  throw new Error("Couldn't fetch bitbucket user account. Wrong api key?");
}

interface Data {
  issueDescription: string;
  issueHeading: string;
}

interface Message {
  ticket: string;
  ticketHeading: string;
  emoji: string;
}

if (Deno.args.includes("checkout")) {
  const today = getTodaysDate();
  const commits = await getCommitsForUser(user.uuid!, today);
  const filteredCommits = [
    ...new Map(
      commits.map(
        (commit) => [commitMessageToTicket(commit.message ?? ""), commit],
      ),
    ).values(),
  ];

  const messages: Array<Message> = [];

  for (const commit of filteredCommits) {
    const ticket = commitMessageToTicket(commit.message ?? "");
    if (!ticket) {
      continue;
    }

    if (!commit.hash) {
      continue;
    }
    const pr = (await Promise.all(config.bb_repos!.map((repo) =>
      getPullRequestForCommit(commit.hash!, repo)
    ))).filter((val) =>
      val !== null
    );
    if (!pr[0] || !pr[0].created_on) {
      continue;
    }

    const status = await getTicketStatus(ticket);
    const emoji = getStatusEmoji(
      status,
    );

    if (!emoji) {
      continue;
    }

    const ticketHeading = await getTicketHeading(ticket);

    messages.push({
      ticket,
      ticketHeading,
      emoji,
    });
  }

  messages.sort((a, b) => {
    if (a.emoji === b.emoji) {
      return a.ticket.localeCompare(b.ticket);
    }
    return a.emoji.localeCompare(b.emoji);
  });

  for (const message of messages) {
    console.log(
      `${message.ticket}: ${message.ticketHeading} ${message.emoji}`,
    );
  }

  Deno.exit();
}

const weeks = getLastWeeks(20);

const selectedWeeks = await checkbox({
  message: "Welches Datum soll verwendet werden?",
  loop: false,
  choices: [{
    name: "Aktuelle Woche",
    value: getCurrentWeek(),
  }, {
    name: "Nur heutiges Datum",
    value: getTodaysDate(),
  }].concat(weeks.map((week) => {
    return {
      name: formatDateRange(week.from, week.to, true),
      value: week,
    };
  })),
});

if (selectedWeeks.length === 0) {
  throw new Error("No weeks selected");
}

for (const week of selectedWeeks) {
  const weekNumberAndCookie = await getWeekNumberForDateAndCookie(week.from);

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
      continue;
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

    await applyActivityToNumber(
      week.from,
      weekNumberAndCookie.number ?? "10",
      weekNumberAndCookie.cookies,
      encodeURI(formatTextWithHTML(text)),
    );
    continue;
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
    continue;
  }

  console.log(`Uploading data...`);
  await applyActivityToNumber(
    week.from,
    weekNumberAndCookie.number ?? "10",
    weekNumberAndCookie.cookies,
    encodeURI(formatTextWithHTML(finalString)),
    `${40 - totalHoursLost}:00`,
  );
}

Deno.exit();
