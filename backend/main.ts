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
import { formatDate, getTodaysDate } from "./src/util/date.ts";
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

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode("data: Starting processing...\n\n"),
          );
          const responses = new Map<string, string>();
          for (
            const week of selectedWeeks.map((w) => ({
              from: new Date(w.from),
              to: new Date(w.to),
            }))
          ) {
            controller.enqueue(encoder.encode(
              `data: Processing week starting ${formatDate(week.from)}...\n\n`,
            ));
            const text = await getTextForWeek(user, week, (msg: string) => {
              controller.enqueue(encoder.encode(`data: ${msg}\n\n`));
            });
            responses.set(week.from.toISOString(), text);
            controller.enqueue(encoder.encode(
              `data: Completed week ${formatDate(week.from)}\n\n`,
            ));
          }
          controller.enqueue(
            encoder.encode("data: Finished processing all weeks.\n\n"),
          );
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify(Object.fromEntries(responses))}\n\n`,
          ));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    } else if (url.pathname === "/approve") {
      if (req.method !== "POST") {
        return new Response(null, { status: 405, headers: corsHeaders });
      }

      const payload = await req.json();

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          for (const [key, value] of Object.entries(payload)) {
            const weekFrom = new Date(key);
            controller.enqueue(
              encoder.encode(
                `data: Processing approval for week ${
                  formatDate(weekFrom)
                }...\n\n`,
              ),
            );
            const weekNumberAndCookie = await getWeekNumberForDateAndCookie(
              weekFrom,
              true,
              (msg: string) => {
                controller.enqueue(encoder.encode(`data: ${msg}\n\n`));
              },
            );
            await applyActivityToNumber(
              weekFrom,
              weekNumberAndCookie.number ?? "10",
              weekNumberAndCookie.cookies,
              encodeURI(formatTextWithHTML(value as string)),
              undefined,
              (msg: string) => {
                controller.enqueue(encoder.encode(`data: ${msg}\n\n`));
              },
            );
            controller.enqueue(
              encoder.encode(
                `data: Approved entry for week ${formatDate(weekFrom)}\n\n`,
              ),
            );
          }
          controller.enqueue(
            encoder.encode("data: Approval process completed.\n\n"),
          );
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    } else if (url.pathname === "/checkout") {
      if (req.method !== "GET") {
        return new Response(null, { status: 405, headers: corsHeaders });
      }

      const today = getTodaysDate();
      const commits = await getCommitsForUser(user.uuid!, today);
      const filteredCommits = [
        ...new Map(
          commits.map(
            (commit) => [commitMessageToTicket(commit.message ?? ""), commit],
          ),
        ).values(),
      ];
      interface Message {
        ticket: string;
        ticketHeading: string;
        emoji: string;
      }
      const messages: Array<Message> = [];
      for (const commit of filteredCommits) {
        const ticket = commitMessageToTicket(commit.message ?? "");
        if (!ticket || !commit.hash) continue;
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
      messages.sort((a, b) =>
        a.emoji === b.emoji
          ? a.ticket.localeCompare(b.ticket)
          : a.emoji.localeCompare(b.emoji)
      );
      return new Response(JSON.stringify(messages), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(null, { status: 404, headers: corsHeaders });
  });
}
