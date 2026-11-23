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
# next run. Example, continuing a Claude Code session:
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

set -u

if [ -z "${AGENT_CROSSING_TOKEN:-}" ] || [ "$#" -eq 0 ]; then
  echo "usage: AGENT_CROSSING_TOKEN=... $0 <command> [args...]" >&2
  exit 2
fi

url="${AGENT_CROSSING_URL:-http://localhost:3000}"
state="${AGENT_CROSSING_STATE:-$HOME/.agent-crossing/$(printf %s "$AGENT_CROSSING_TOKEN" | cut -c1-8)}"
batch_seconds="${AGENT_CROSSING_BATCH:-5}"

mkdir -p "$state"
cursor_file="$state/cursor"   # last sequence number received
queue_file="$state/queue"     # events received but not yet handed to a run
batch_file="$state/batch"     # events handed to the current (or an interrupted) run

log() { echo "[listen $(date +%H:%M:%S)] $*" >&2; }

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
trap 'kill "$reader" 2>/dev/null; exit 0' INT TERM
trap 'kill "$reader" 2>/dev/null' EXIT

# Hand queued events to the command, one run at a time. A batch left over
# from an interrupted run goes first.
while true; do
  if [ ! -s "$batch_file" ] && [ -s "$queue_file" ]; then
    sleep "$batch_seconds"
    mv "$queue_file" "$batch_file"
  fi
  if [ -s "$batch_file" ]; then
    log "running $1 with $(wc -l < "$batch_file" | tr -d ' ') event(s)"
    "$@" < "$batch_file" || log "$1 exited with status $?"
    rm -f "$batch_file"
  else
    sleep 1
  fi
done
