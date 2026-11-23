import { observe } from "@agent-crossing/world/perception";
import type { Username } from "@agent-crossing/world/values";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";

import type { Numbered } from "./journal.ts";
import {
  nearbyText,
  ownEventsText,
  rejectionText,
  tileText,
} from "./narration.ts";
import { lookText, selfText } from "./sight.ts";
import type { CatchUp, Report } from "./wire.ts";

const SINCE_LAST_CALL = "since your last call";

const sections = (...parts: readonly string[]) =>
  Arr.join(
    Arr.filter(parts, (part) => part !== ""),
    "\n\n"
  );

export const refusalOf = (report: Report) =>
  report.verdict._tag === "Rejected"
    ? Option.some(
        sections(
          `Refused: ${rejectionText(report.world, report.verdict.rejection, report.now)}`,
          nearbyText(report.world, report.nearby, report.now, SINCE_LAST_CALL)
        )
      )
    : Option.none<string>();

const ownText = (report: Report, self: Username) =>
  report.verdict._tag === "Accepted"
    ? ownEventsText(report.world, self, report.verdict.events, report.now)
    : "";

export const actedText = (report: Report, self: Username) =>
  sections(
    ownText(report, self),
    nearbyText(report.world, report.nearby, report.now, SINCE_LAST_CALL)
  );

export const lookedText = (report: Report, self: Username) =>
  sections(
    ownText(report, self),
    Option.match(observe(report.world, self, report.now), {
      onNone: () => "",
      onSome: (observation) => lookText(report.world, observation),
    }),
    nearbyText(report.world, report.nearby, report.now, SINCE_LAST_CALL)
  );

export const arrivedText = (
  departure: Report,
  arrival: CatchUp,
  self: Username
) => {
  const nearby: readonly Numbered[] = Arr.appendAll(
    departure.nearby,
    arrival.nearby
  );

  const departed =
    departure.verdict._tag === "Accepted" ? departure.verdict.events : [];

  const walked = Arr.findFirst(departed, (event) =>
    event._tag === "WalkStarted" && event.actor === self
      ? Option.some(
          event.path.length === 1
            ? `You were already at ${tileText(Arr.headNonEmpty(event.path))}.`
            : `You walked from ${tileText(Arr.headNonEmpty(event.path))} to ${tileText(Arr.lastNonEmpty(event.path))}, ${event.path.length - 1} steps, and have arrived.`
        )
      : Option.none()
  );

  return sections(
    Arr.join(
      Arr.filter(
        [
          ownEventsText(
            departure.world,
            self,
            departed,
            departure.now,
            (event) => event._tag !== "WalkStarted"
          ),
          Option.getOrElse(walked, () => "You were already there."),
          Option.match(observe(arrival.world, self, arrival.now), {
            onNone: () => "",
            onSome: (observation) => selfText(arrival.world, observation),
          }),
        ],
        (line) => line !== ""
      ),
      "\n"
    ),
    nearbyText(arrival.world, nearby, arrival.now, SINCE_LAST_CALL)
  );
};
