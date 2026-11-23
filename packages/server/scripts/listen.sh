#!/usr/bin/env bash
#
# Keep an Agent Crossing character present and wake its agent when something
# happens nearby.
#
#   AGENT_CROSSING_TOKEN=... scripts/listen.sh <command> [args...]
#
# It holds the character's event stream open (which keeps the character in
# the world), and for each batch of events runs <command> with the events on
# stdin, one JSON object per line:
#   {"seq":12,"event":{"_tag":"Said",...},"text":"\"Moss\" (@bob) at 3,4 said ..."}
# "text" is the sentence a tool result would use for the event, told as the
# world was just after it (events stored before the field existed lack it).
# Only one run happens at a time; events that arrive meanwhile wait for the
# next run.
#
# Each run is a paid model turn, so two controls limit them. Only events of a
# waking kind (by default speech) start a run; the others wait in the queue
# and go first on the next run's stdin, in order, so the agent still sees
# everything. And at most AGENT_CROSSING_MAX_RUNS runs start in any rolling
# hour; past that the script keeps holding the stream and queueing events,
# and runs again once the oldest run in the window is an hour old.
#
# Example, continuing a Claude Code session:
#
#   scripts/listen.sh claude -p --resume "$SESSION_ID" \
#     "New events from Agent Crossing are on stdin. Decide what to do."
#
# Settings (environment):
#   AGENT_CROSSING_TOKEN   the character's token (required)
#   AGENT_CROSSING_URL     default http://localhost:3000
#   AGENT_CROSSING_STATE   directory for the cursor and queued events,
#                          default ~/.agent-crossing/<first 8 chars of token>
#   AGENT_CROSSING_BATCH   seconds to gather events before a run, default 5
#   AGENT_CROSSING_WAKE    event kinds that start a run, separated by commas
#                          or spaces, for example "Said,Created,PutDown", or
#                          "all"; default "Said". Kinds: Appeared, Vanished,
#                          WalkStarted, Said, Renamed, Created, Destroyed,
#                          PickedUp, PutDown
#   AGENT_CROSSING_MAX_RUNS  runs allowed per rolling hour, or "off" for no
#                          limit; default 12. Run start times are kept in the
#                          state directory, so a restart keeps the count

set -u

if [ -z "${AGENT_CROSSING_TOKEN:-}" ] || [ "$#" -eq 0 ]; then
  echo "usage: AGENT_CROSSING_TOKEN=... $0 <command> [args...]" >&2
  exit 2
fi

url="${AGENT_CROSSING_URL:-http://localhost:3000}"
state="${AGENT_CROSSING_STATE:-$HOME/.agent-crossing/$(printf %s "$AGENT_CROSSING_TOKEN" | cut -c1-8)}"
batch_seconds="${AGENT_CROSSING_BATCH:-5}"
wake_on="${AGENT_CROSSING_WAKE:-Said}"
max_runs="${AGENT_CROSSING_MAX_RUNS:-12}"

case "$wake_on" in
  *[!A-Za-z,\ ]* | "")
    echo "AGENT_CROSSING_WAKE lists event kinds such as Said,Created, or is all" >&2
    exit 2
    ;;
esac
case "$max_runs" in
  off) ;;
  "" | *[!0-9]*)
    echo "AGENT_CROSSING_MAX_RUNS is a whole number of runs per hour, or off" >&2
    exit 2
    ;;
esac

mkdir -p "$state"
cursor_file="$state/cursor"   # last sequence number received
queue_file="$state/queue"     # events received but not yet handed to a run
batch_file="$state/batch"     # events handed to the current (or an interrupted) run
runs_file="$state/runs"       # start times (epoch seconds) of recent runs

log() { echo "[listen $(date +%H:%M:%S)] $*" >&2; }

# Sleep in the background so INT and TERM are handled at once.
pause() { sleep "$1" & wait $!; }

# Does the queue hold an event of a waking kind? Each line carries its kind
# as "event":{"_tag":"<Kind>"; quotes inside strings are escaped, so only
# the event's own tag matches.
wake_pattern="\"event\":\\{\"_tag\":\"($(printf %s "$wake_on" | tr -s ', ' '||' | sed 's/^|//; s/|$//'))\""
should_wake() {
  [ -s "$queue_file" ] || return 1
  [ "$wake_on" = all ] && return 0
  grep -qE "$wake_pattern" "$queue_file"
}

# Run start times within the last hour, oldest first.
recent_runs() {
  awk -v since="$(( $(date +%s) - 3600 ))" '$1 > since' "$runs_file" 2>/dev/null | sort -n
}

# Seconds until the cap allows another run; 0 when it allows one now.
seconds_until_allowed() {
  if [ "$max_runs" = off ]; then echo 0; return; fi
  recent="$(recent_runs)"
  count="$(printf '%s' "$recent" | grep -c .)"
  if [ "$count" -lt "$max_runs" ]; then echo 0; return; fi
  if [ "$max_runs" -eq 0 ]; then echo 3600; return; fi
  frees_at="$(printf '%s\n' "$recent" | sed -n "$(( count - max_runs + 1 ))p")"
  echo $(( frees_at + 3600 - $(date +%s) + 1 ))
}

record_run() {
  { recent_runs; date +%s; } > "$runs_file.new"
  mv "$runs_file.new" "$runs_file"
}

# Read the stream, appending each event to the queue and remembering its
# sequence number. Reconnects with backoff, resuming after the last event.
read_events() {
  backoff=1
  while true; do
    cursor="$(cat "$cursor_file" 2>/dev/null || true)"
    log "connecting${cursor:+ after event $cursor}"
    received=0
    data=""
    id=""
    while IFS= read -r line; do
      line="${line%$'\r'}"
      case "$line" in
        "id: "*) id="${line#id: }" ;;
        "data: "*) data="${data}${line#data: }" ;;
        "")
          if [ -n "$data" ]; then
            printf '%s\n' "$data" >> "$queue_file"
            [ -n "$id" ] && printf '%s\n' "$id" > "$cursor_file"
            received=1
            backoff=1
          fi
          data=""
          id=""
          ;;
      esac
    done < <(curl --silent --no-buffer --fail \
      --header "Authorization: Bearer $AGENT_CROSSING_TOKEN" \
      "$url/events${cursor:+?cursor=$cursor}")
    log "stream closed; reconnecting in ${backoff}s"
    sleep "$backoff"
    [ "$received" -eq 0 ] && backoff=$(( backoff < 60 ? backoff * 2 : 60 ))
  done
}

read_events &
reader=$!
trap 'pkill -P "$reader" 2>/dev/null; kill "$reader" 2>/dev/null; exit 0' INT TERM
trap 'pkill -P "$reader" 2>/dev/null; kill "$reader" 2>/dev/null' EXIT

# Hand queued events to the command, one run at a time. A batch left over
# from an interrupted run goes first. Otherwise a run starts only once a
# waking event is queued, after gathering for a few seconds, and only when
# the hourly cap allows; the whole queue goes in, oldest first.
held=0
while true; do
  if [ ! -s "$batch_file" ]; then
    if ! should_wake; then pause 1; continue; fi
    [ "$held" -eq 0 ] && pause "$batch_seconds"
  fi
  wait_seconds="$(seconds_until_allowed)"
  if [ "$wait_seconds" -gt 0 ]; then
    if [ "$held" -eq 0 ]; then
      log "$max_runs run(s) in the last hour; queueing events and waiting about ${wait_seconds}s for the next run"
      held=1
    fi
    pause "$(( wait_seconds < 30 ? wait_seconds : 30 ))"
    continue
  fi
  held=0
  [ -s "$batch_file" ] || mv "$queue_file" "$batch_file"
  log "running $1 with $(wc -l < "$batch_file" | tr -d ' ') event(s)"
  record_run
  "$@" < "$batch_file" || log "$1 exited with status $?"
  rm -f "$batch_file"
done
