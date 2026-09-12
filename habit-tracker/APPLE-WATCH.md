# Getting Apple Watch data into Daily

Apple Health can't be read from a web page — HealthKit is closed to browsers.
The way in is an iOS Shortcut, which *can* read Health and open a URL. It opens
the app with your figures after a `#`.

The `#` is the whole point. Browsers never send anything after a `#` to the
server, so your numbers go from the watch to your phone and stop there. Nothing
health-related is published, committed, or visible to anyone else with the app.

## The Shortcut

One Shortcut, fourteen actions. Build it in the Shortcuts app.

### Steps

1. **Find Health Samples Where** — Type **Steps**, Start Date **is today**
2. **Calculate Statistics** — **Sum**
3. **Set Variable** → `Steps`

### Resting heart rate

4. **Find Health Samples Where** — Type **Resting Heart Rate**, Start Date **is today**
5. **Calculate Statistics** — **Average** (not Sum — summing heart rates gives a number in the thousands)
6. **Set Variable** → `HeartRate`

### Sleep

7. **Find Health Samples Where** — Type **Sleep Analysis**, Start Date **is in the last 24 hours**
8. **Get Details of Health Samples** → **Duration**
9. **Calculate Statistics** — **Sum**
10. **Set Variable** → `SleepSeconds`

Sleep uses *last 24 hours* rather than *today* on purpose: last night's sleep
started yesterday evening, so a "today" filter run in the morning would miss
most of it.

### Send it

11. **Text** — insert the variables where the names appear:

    ```
    {"steps":"Steps","restingHeartRate":"HeartRate","sleepSeconds":"SleepSeconds"}
    ```

12. **URL Encode** (mode: Encode), input = that Text
13. **Text**:

    ```
    https://peytonhacker07-max.github.io/business-research/#health=URLEncodedText
    ```

14. **Open URLs**, input = that last Text

## Why the quotes matter

Health returns values the way a person reads them — `8,432 count`, `58 bpm` —
so they arrive as strings with separators and units attached. Quoted, the app
pulls the number out of whatever shows up. Unquoted, `8,432` is invalid JSON
and the whole payload is thrown away.

## Did it work?

Run the Shortcut. The app opens, then under **Analytics** there should be a
**FROM YOUR WATCH** card reading *"1 day recorded. Patterns need about a week
before they mean anything."*

That message is the success signal. The observations themselves stay quiet
until there are five days of data — a confident claim drawn from four nights
would be worse than saying nothing.

## Build it in two sittings

Steps and heart rate are six near-identical actions and take about ten minutes.
Sleep is the fiddly part. Stop after action 6, use this Text instead —

```
{"steps":"Steps","restingHeartRate":"HeartRate"}
```

— and you have a complete working Shortcut. Adding sleep to something that
already runs is easy; debugging sleep inside something that has never run is
not.

## Once it works

Shortcuts → **Automation** → **Time of Day** so it runs itself each morning
instead of you tapping it.

## What the app accepts

Every field is optional. A missing one is left alone rather than recorded as a
zero, so a day with no heart-rate reading doesn't look like a heart rate of 0.

| Field | Meaning |
| --- | --- |
| `steps` | Step count |
| `restingHeartRate` or `hr` | Resting heart rate, bpm |
| `sleepMinutes`, `sleepSeconds`, or `sleepHours` | Time asleep, whichever unit is easiest |
| `activeEnergy` or `energy` | Active energy, kcal — stored, but nothing reads it yet |
| `date` | `YYYY-MM-DD`. Omit it for a single day and it means today. |

To backfill several days at once, send an array instead of one object. Each
entry then needs its own `date`, or every reading would pile onto today:

```
[{"date":"2026-09-10","steps":"8,432"},{"date":"2026-09-11","steps":"9,110"}]
```
