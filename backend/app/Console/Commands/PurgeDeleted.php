<?php

namespace App\Console\Commands;

use App\Models\Bus;
use App\Models\Company;
use App\Models\Hotel;
use App\Models\Package;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

use function Laravel\Prompts\confirm;

/**
 * Permanently removes records that were soft-deleted long enough ago.
 *
 * Deleting is reversible here on purpose: a mistake can be undone and the
 * audit trail keeps pointing at something real. The cost is that nothing ever
 * actually leaves, so the tables grow with rows nobody will see again.
 *
 * This is the other half of that decision, and it is deliberately reluctant.
 * Nothing recent is touched, the default is a long wait, and it will not run
 * without being told to in as many words.
 *
 * Images are left alone. They are small, and a row's `image_path` is the only
 * record of which file belonged to it — so once the row is gone the link is
 * gone, and a pass that deleted files would have no way to tell an orphan from
 * a file still in use.
 */
class PurgeDeleted extends Command
{
    protected $signature = 'purge:deleted
                            {--days=90 : Only remove records deleted at least this long ago}
                            {--dry-run : Show what would go, change nothing}
                            {--force : Skip the confirmation, for a scheduled run}';

    protected $description = 'Permanently remove long-deleted records';

    /**
     * Children first.
     *
     * A company's packages hold a foreign key to it, and the users table has a
     * stored generated column deriving from company_id, so the database
     * refuses to delete a company while anything still points at it.
     *
     * @var array<int, class-string<Model>>
     */
    private const ORDER = [
        Package::class,
        Hotel::class,
        Bus::class,
        User::class,
        Company::class,
    ];

    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));
        $cutoff = now()->subDays($days);
        $dryRun = (bool) $this->option('dry-run');

        $this->components->info(
            ($dryRun ? 'Would remove' : 'Removing')
            ." records deleted before {$cutoff->toDateString()} ({$days} days)."
        );

        $counts = [];
        $total = 0;

        foreach (self::ORDER as $model) {
            $count = $this->staleQuery($model, $cutoff)->count();

            $counts[$model] = $count;
            $total += $count;

            $this->components->twoColumnDetail(class_basename($model), (string) $count);
        }

        if ($total === 0) {
            $this->components->info('Nothing old enough to remove.');

            return self::SUCCESS;
        }

        if ($dryRun) {
            $this->components->warn("Dry run — {$total} records left untouched.");

            return self::SUCCESS;
        }

        if (! $this->option('force') && ! confirm(
            label: "Permanently remove {$total} records?",
            default: false,
            hint: 'This cannot be undone. Take a backup first: php artisan backup:run',
        )) {
            $this->components->info('Cancelled.');

            return self::SUCCESS;
        }

        /*
         * One transaction. A purge that stopped halfway could leave a company
         * deleted while its packages survived, pointing at a row that is no
         * longer there.
         */
        DB::transaction(function () use ($counts, $cutoff): void {
            foreach (self::ORDER as $model) {
                if ($counts[$model] === 0) {
                    continue;
                }

                // forceDelete through the model rather than a mass delete, so
                // the pivot rows a user owns go with them.
                $this->staleQuery($model, $cutoff)
                    ->cursor()
                    ->each(fn (Model $record) => $record->forceDelete());
            }
        });

        $this->components->info("Removed {$total} records.");

        return self::SUCCESS;
    }

    /**
     * @param  class-string<Model>  $model
     */
    private function staleQuery(string $model, \DateTimeInterface $cutoff): \Illuminate\Database\Eloquent\Builder
    {
        // withoutGlobalScopes() drops the tenant scope as well as the
        // soft-delete one: this is an operator's command, not a request, and
        // there is no company to scope it to.
        return $model::withoutGlobalScopes()
            ->whereNotNull('deleted_at')
            ->where('deleted_at', '<', $cutoff);
    }
}
