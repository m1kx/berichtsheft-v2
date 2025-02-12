import {
  getCommitsForUser,
  getPullRequestForCommit,
  getUser,
} from "./src/api/bitbucket.ts";
import { getTicketHeading, getTicketStatus } from "./src/api/jira.ts";
import { loadConfig, writeConfig } from "./src/util/config.ts";

import {
  commitMessageToTicket,
  formatTextWithHTML,
} from "./src/util/format.ts";
import { getTodaysDate } from "./src/util/date.ts";
import { getStatusEmoji } from "./src/util/status.ts";
import { config } from "./src/util/config.ts";
import type { TimeRange } from "./src/types/time.ts";
import { getTextForWeek } from "./src/runner.ts";
import { applyActivityToNumber } from "./src/api/azubiheft.ts";
import { getWeekNumberForDateAndCookie } from "./src/api/azubiheft.ts";

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

if (Deno.args.includes("serve")) {
  Deno.serve(async (req) => {
    // Define CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(req.url);

    if (url.pathname === "/generate") {
      if (req.method !== "POST") {
        return new Response(null, { status: 405, headers: corsHeaders });
      }

      const payload = await req.json();

      const selectedWeeks: TimeRange[] | undefined | null =
        payload.selectedWeeks;
      if (!selectedWeeks) {
        return new Response(null, { status: 400, headers: corsHeaders });
      }

      if (selectedWeeks.length === 0) {
        return new Response(null, { status: 400, headers: corsHeaders });
      }

      const responses = new Map<string, string>();
      for (
        const week of selectedWeeks.map((w) => ({
          from: new Date(w.from),
          to: new Date(w.to),
        }))
      ) {
        const text = await getTextForWeek(user, week);
        responses.set(week.from.toISOString(), text);
      }

      return new Response(JSON.stringify(Object.fromEntries(responses)), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    } else if (url.pathname === "/approve") {
      if (req.method !== "POST") {
        return new Response(null, { status: 405, headers: corsHeaders });
      }

      const payload = await req.json();

      for (const [key, value] of Object.entries(payload)) {
        const weekFrom = new Date(key);
        const weekNumberAndCookie = await getWeekNumberForDateAndCookie(
          weekFrom,
          true,
        );
        await applyActivityToNumber(
          weekFrom,
          weekNumberAndCookie.number ?? "10",
          weekNumberAndCookie.cookies,
          encodeURI(formatTextWithHTML(value as string)),
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    return new Response(null, { status: 404, headers: corsHeaders });
  });
}

if (Deno.args.includes("checkout")) {
  const today = getTodaysDate();
  const commits = await getCommitsForUser(user.uuid!, today);
  const filteredCommits = [
    ...new Map(
      commits.map(
        (
          commit,
        ) => [commitMessageToTicket(commit.message ?? ""), commit],
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
      (new Date(pr[0].created_on) > today.from &&
          !["Ready for Release", "Geschlossen"].includes(status))
        ? "Heute erstellt"
        : status,
    );

    if (!emoji) {
      continue;
    }

    const ticketHeading = await getTicketHeading(ticket);

    if (ticketHeading === "") {
      continue;
    }

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
