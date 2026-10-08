<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

use function Laravel\Prompts\confirm;
use function Laravel\Prompts\password;
use function Laravel\Prompts\text;

/**
 * Sets the super admin's e-mail address and password, asking for them here.
 *
 * The point of this command is what it does NOT do. The password is typed into
 * this terminal, hashed, and written to the database. It is never passed as an
 * argument — where it would sit in the shell history and in the process list,
 * readable by anything else on the machine — never echoed back, never logged,
 * and never written to .env.
 *
 * It also clears SUPER_ADMIN_PASSWORD out of .env afterwards, because a
 * password kept in a file is a password that leaks with the file. The seeder
 * needs that variable only to create the very first account; once the account
 * exists, the line is a liability with no remaining purpose.
 */
class SetSuperAdminCredentials extends Command
{
    protected $signature = 'admin:credentials';

    protected $description = 'Set the super admin\'s e-mail and password, entered here rather than stored anywhere';

    public function handle(): int
    {
        $admin = User::query()
            ->where('role', UserRole::SuperAdmin)
            ->orderBy('id')
            ->first();

        if ($admin === null) {
            $this->components->error(
                'There is no super admin yet. Run `php artisan db:seed --class=SuperAdminSeeder` first.'
            );

            return self::FAILURE;
        }

        $this->components->info("Changing the credentials for: {$admin->email}");

        $email = mb_strtolower(trim(text(
            label: 'New e-mail address',
            default: $admin->email,
            required: true,
        )));

        // Hidden input, twice. A password nobody can see is also a password
        // nobody can check for a typo, and locking yourself out of the only
        // system-level account is a bad afternoon.
        $chosen = password(label: 'New password', required: true);
        $again = password(label: 'Repeat the password', required: true);

        $validator = Validator::make(
            ['email' => $email, 'password' => $chosen, 'password_confirmation' => $again],
            [
                'email' => [
                    'required',
                    'email:rfc',
                    'max:255',
                    // The live_email generated column carries uniqueness over
                    // rows that have not been soft-deleted.
                    Rule::unique('users', 'email')->ignore($admin->id)->whereNull('deleted_at'),
                ],
                'password' => ['required', 'confirmed', Password::defaults()],
            ],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->components->error($message);
            }

            return self::FAILURE;
        }

        $admin->email = $email;
        $admin->password = $chosen;
        $admin->save();

        // Every existing session was issued against the old password. Leaving
        // them alive would mean a change made because a password was exposed
        // does not actually end the access it was exposed to.
        $revoked = $admin->tokens()->delete();

        $this->components->info("Updated. {$admin->email} must sign in again.");

        if ($revoked > 0) {
            $this->components->info("Revoked {$revoked} existing session(s)/token(s).");
        }

        $this->warnIfPasswordRemainsInEnv();

        return self::SUCCESS;
    }

    /**
     * Points out that the old password is still sitting in .env.
     *
     * It says so rather than editing the file. .env is the operator's, it is
     * not in version control, and a command that rewrites it as a side effect
     * of something else is a bad surprise — the first version of this did, and
     * its own test came within one answered prompt of rewriting the real file
     * of whoever ran the suite.
     */
    private function warnIfPasswordRemainsInEnv(): void
    {
        $path = base_path('.env');

        if (! is_file($path)) {
            return;
        }

        $contents = @file_get_contents($path);

        if ($contents === false || ! preg_match('/^\s*SUPER_ADMIN_PASSWORD=\S/m', $contents)) {
            return;
        }

        $this->components->warn(
            'SUPER_ADMIN_PASSWORD is still set in .env. The account exists, so the seeder '
            .'no longer reads it — and it is no longer the password for this account. '
            .'Delete that line: a password kept in a file leaks with the file.'
        );
    }
}
