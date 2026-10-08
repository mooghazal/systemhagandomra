<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Exception\ProcessTimedOutException;
use Symfony\Component\Process\Process;

use function Laravel\Prompts\progress;

/**
 * Takes a backup of everything that cannot be recreated from the repository.
 *
 * That is two things and only two: the database, and the uploaded images.
 * The code is in git, the dependencies come from a lock file, and `.env` is
 * configuration an operator holds — none of those belong in a nightly tarball.
 *
 * The database password is passed to mysqldump through its environment rather
 * than on the command line, where every other process on the machine can read
 * it out of the process list.
 */
class BackupRun extends Command
{
    protected $signature = 'backup:run
                            {--path= : Where to write. Defaults to storage/backups}
                            {--keep=14 : How many previous backups to leave in place; 0 keeps everything}';

    protected $description = 'Back up the database and the uploaded images';

    public function handle(): int
    {
        $stamp = now()->format('Y-m-d_His');

        $directory = rtrim($this->option('path') ?: storage_path('backups'), '/\\');
        $target = $directory.DIRECTORY_SEPARATOR.$stamp;

        File::ensureDirectoryExists($target);

        $this->components->info("Backing up to {$target}");

        if (! $this->dumpDatabase($target.DIRECTORY_SEPARATOR.'database.sql')) {
            // A half-finished backup is worse than none: it looks like one.
            File::deleteDirectory($target);

            return self::FAILURE;
        }

        $this->copyUploads($target.DIRECTORY_SEPARATOR.'storage');

        $this->prune($directory);

        $this->components->info('Done. Check that the file is not empty before trusting it:');
        $this->line('  '.$target.DIRECTORY_SEPARATOR.'database.sql');

        return self::SUCCESS;
    }

    private function dumpDatabase(string $file): bool
    {
        $connection = config('database.default');
        $db = config("database.connections.{$connection}");

        if (($db['driver'] ?? null) !== 'mysql') {
            $this->components->error("backup:run only knows how to dump MySQL; this is '{$db['driver']}'.");

            return false;
        }

        $binary = $this->mysqldumpPath();

        if ($binary === null) {
            $this->components->error(
                'mysqldump was not found. Add the MySQL bin directory to PATH, '
                .'or set MYSQLDUMP_PATH in .env to its full path.'
            );

            return false;
        }

        $process = new Process([
            $binary,
            '--host='.$db['host'],
            '--port='.$db['port'],
            '--user='.$db['username'],
            // Rows are written as they are read rather than buffered in
            // memory, which matters once the audit log is large.
            '--quick',
            '--single-transaction',
            // Without this a restore silently loses scheduled jobs and
            // triggers, which is the kind of thing nobody notices until it
            // matters.
            '--routines',
            '--events',
            '--triggers',
            '--default-character-set=utf8mb4',
            '--result-file='.$file,
            $db['database'],
        ], env: [
            // Not --password=, which puts the secret in the process list for
            // anything else on the machine to read.
            'MYSQL_PWD' => (string) $db['password'],
        ]);

        $process->setTimeout(600);

        try {
            $process->run();
        } catch (ProcessTimedOutException) {
            $this->components->error('mysqldump took longer than ten minutes and was stopped.');

            return false;
        }

        if (! $process->isSuccessful()) {
            $this->components->error('mysqldump failed: '.trim($process->getErrorOutput()));

            return false;
        }

        $size = File::exists($file) ? File::size($file) : 0;

        if ($size === 0) {
            $this->components->error('mysqldump reported success but wrote an empty file.');

            return false;
        }

        $this->components->twoColumnDetail('database.sql', $this->humanSize($size));

        return true;
    }

    private function copyUploads(string $target): void
    {
        $source = storage_path('app/public');

        if (! File::isDirectory($source)) {
            $this->components->warn('No uploads directory; skipping images.');

            return;
        }

        File::ensureDirectoryExists($target);
        File::copyDirectory($source, $target);

        $bytes = 0;
        $count = 0;

        foreach (File::allFiles($target) as $file) {
            $bytes += $file->getSize();
            $count++;
        }

        $this->components->twoColumnDetail("storage ({$count} files)", $this->humanSize($bytes));
    }

    /**
     * Deletes the oldest backups beyond the retention count.
     *
     * Directories are named by timestamp, so sorting them by name sorts them
     * by age. Only directories matching that shape are considered — this
     * removes things, and it will not remove something it does not recognise.
     */
    private function prune(string $directory): void
    {
        $keep = max(0, (int) $this->option('keep'));

        if ($keep === 0) {
            return;
        }

        $backups = collect(File::directories($directory))
            ->filter(fn (string $path) => preg_match('/^\d{4}-\d{2}-\d{2}_\d{6}$/', basename($path)) === 1)
            ->sort()
            ->values();

        $stale = $backups->slice(0, max(0, $backups->count() - $keep));

        foreach ($stale as $path) {
            File::deleteDirectory($path);
            $this->components->twoColumnDetail('removed', basename($path));
        }
    }

    private function mysqldumpPath(): ?string
    {
        $configured = env('MYSQLDUMP_PATH');

        if (is_string($configured) && $configured !== '') {
            return is_file($configured) ? $configured : null;
        }

        $probe = new Process([PHP_OS_FAMILY === 'Windows' ? 'where' : 'which', 'mysqldump']);
        $probe->run();

        if (! $probe->isSuccessful()) {
            return null;
        }

        $first = strtok(trim($probe->getOutput()), "\r\n");

        return $first === false || $first === '' ? null : $first;
    }

    private function humanSize(int $bytes): string
    {
        foreach (['B', 'KB', 'MB', 'GB'] as $unit) {
            if ($bytes < 1024 || $unit === 'GB') {
                return round($bytes, 1).' '.$unit;
            }

            $bytes = (int) round($bytes / 1024);
        }

        return $bytes.' B';
    }
}
