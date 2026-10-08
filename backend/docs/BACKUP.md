# Backups

Two things in this system cannot be recreated: the **database** and the
**uploaded images**. Everything else — the code, the dependencies — comes back
from the repository and a lock file. `.env` is configuration you hold, not data
you restore.

## Taking one

```bash
php artisan backup:run
```

Writes to `storage/backups/YYYY-MM-DD_HHMMSS/`:

| | |
|---|---|
| `database.sql` | every table, including the audit trail |
| `storage/` | the uploaded images |

Options:

| | |
|---|---|
| `--path=D:/backups` | write somewhere else — see *Off this machine* below |
| `--keep=30` | how many to leave in place (default 14; `0` keeps everything) |

The command deletes the whole directory if the dump fails. A half-written
backup is worse than none, because it looks like one.

### If it cannot find mysqldump

Set the full path in `.env`:

```
MYSQLDUMP_PATH="C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqldump.exe"
```

## Restoring one

> Read this before you need it. The middle of an incident is a bad time to
> find out a step is missing.

**1. Put the application into maintenance mode** so nothing writes while you
work:

```bash
php artisan down
```

**2. Restore the database.** This replaces everything in it:

```bash
mysql -u hagamra -p --default-character-set=utf8mb4 hagamra < path/to/database.sql
```

`--default-character-set=utf8mb4` is not optional. Without it MySQL may read
the file as latin1 and every Arabic name in your data comes back as question
marks — the file is fine, the restore is not, and you will not notice until
someone opens a page.

**3. Restore the images** by copying the backup's `storage/` folder over
`backend/storage/app/public/`.

**4. Bring it back up:**

```bash
php artisan up
```

## Scheduling it

### Windows (Task Scheduler)

```powershell
schtasks /create /tn "Hagamra backup" /tr "php D:\hagamra\backend\artisan backup:run" /sc daily /st 03:00
```

### Linux (cron)

```
0 3 * * * cd /var/www/hagamra/backend && php artisan backup:run >> storage/logs/backup.log 2>&1
```

## Off this machine

A backup on the same disk as the database protects you from a bad `DELETE`. It
protects you from nothing else — not a failed drive, not a lost laptop, not
ransomware, which looks for backup folders first.

Point `--path` at something that is not this machine:

```bash
php artisan backup:run --path=//nas/backups/hagamra
php artisan backup:run --path=D:/dropbox/hagamra   # or any synced folder
```

## Check it

An untested backup is a guess. Once, when you set this up, and then once every
few months:

```bash
# 1. Is the file real?
php artisan backup:run

# 2. Does it restore? Into a scratch database, never the live one.
mysql -u hagamra -p -e "CREATE DATABASE hagamra_check CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u hagamra -p --default-character-set=utf8mb4 hagamra_check < storage/backups/<latest>/database.sql

# 3. Did the Arabic survive? This is the step that catches an encoding fault.
mysql -u hagamra -p --default-character-set=utf8mb4 hagamra_check -e "SELECT name FROM companies LIMIT 5;"

# 4. Tidy up.
mysql -u hagamra -p -e "DROP DATABASE hagamra_check;"
```

If step 3 shows `????` instead of Arabic, the restore lost the encoding —
check that `--default-character-set=utf8mb4` is on both the dump and the
restore.

## What a backup holds

Every row, including `users`. Passwords are stored as bcrypt hashes and stay
hashes in the dump, so a leaked backup does not hand anyone a password — but it
does hand them every e-mail address, every company's data and the entire audit
trail.

`storage/backups` is in `.gitignore`. Keep it that way, and treat the files the
way you would treat the database itself.
