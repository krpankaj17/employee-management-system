import datetime

LOG_FILE = "activity.log"


def log_action(action, details=""):
    """Appends a single timestamped line to the activity log.

    Never lets a logging failure break the app - if the log file can't be
    written for some reason, the error is swallowed silently.
    """
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {action}"
    if details:
        line += f" - {details}"
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as myfile:
            myfile.write(line + "\n")
    except Exception:
        pass


def read_log(limit=None):
    """Returns the log lines, most recent first. Optionally limited to the
    last `limit` entries."""
    try:
        with open(LOG_FILE, "r", encoding="utf-8") as myfile:
            lines = [line.rstrip("\n") for line in myfile]
    except FileNotFoundError:
        return []
    lines.reverse()
    if limit:
        lines = lines[:limit]
    return lines