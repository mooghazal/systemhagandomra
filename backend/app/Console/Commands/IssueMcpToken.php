<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\RequestSource;
use Illuminate\Console\Command;

class IssueMcpToken extends Command
{
    protected $signature = 'mcp:token
                            {email : The account the agent will act as}
                            {--name=mcp-agent : A label for this token, shown in the audit trail}
                            {--revoke-existing : Revoke the account\'s other MCP tokens first}';

    protected $description = 'Issue an access token for the MCP server to act on behalf of a user';

    public function handle(): int
    {
        $user = User::query()->where('email', mb_strtolower($this->argument('email')))->first();

        if ($user === null) {
            $this->components->error('No account with that e-mail address.');

            return self::FAILURE;
        }

        if (! $user->is_active) {
            $this->components->error('That account is disabled; a token would be refused on every request.');

            return self::FAILURE;
        }

        if (! $user->companyIsActive()) {
            $this->components->error('That account\'s company is disabled; a token would be refused on every request.');

            return self::FAILURE;
        }

        /*
         * A super admin has no company of their own, so the backend requires
         * them to name one on every write — something the MCP tools
         * deliberately do not let the agent do. The token still works for
         * reads, but creating anything through it will fail, so say so now
         * rather than leaving it to be discovered mid-conversation.
         */
        if ($user->isSuperAdmin()) {
            $this->components->warn(
                'This is a super admin. The agent will be able to read across companies but not create '
                .'anything, because it cannot name a company. Issue the token to a company owner instead.'
            );

            if (! $this->confirm('Issue it anyway?', false)) {
                return self::FAILURE;
            }
        }

        if ($this->option('revoke-existing')) {
            $revoked = $user->tokens()
                ->whereJsonContains('abilities', RequestSource::MCP_ABILITY)
                ->delete();

            $this->components->info("Revoked {$revoked} existing MCP token(s).");
        }

        /*
         * The `mcp` ability is the only thing that distinguishes this token.
         * It grants nothing — the account's role and permissions decide what
         * the agent may do, exactly as they do in the dashboards. All it does
         * is label the audit trail, so an operation made through the agent is
         * distinguishable from one a person made by hand.
         */
        $token = $user->createToken(
            $this->option('name'),
            [RequestSource::MCP_ABILITY],
        );

        $this->newLine();
        $this->components->info("Token issued for {$user->name} ({$user->role->label()}).");

        $this->newLine();
        $this->line('  <fg=yellow>'.$token->plainTextToken.'</>');
        $this->newLine();

        $this->components->warn(
            'This is shown once. Put it in the MCP server\'s HAGAMRA_API_TOKEN and keep it out of source control.'
        );

        $this->components->bulletList([
            'The agent acts as this account: same company, same permissions.',
            'Revoke it with: php artisan mcp:token '.$user->email.' --revoke-existing',
        ]);

        return self::SUCCESS;
    }
}
