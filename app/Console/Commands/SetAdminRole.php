<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;

class SetAdminRole extends Command
{
    protected $signature = 'admin:set-role {email} {role=admin}';
    protected $description = 'Set the role for a specific user';

    public function handle(): void
    {
        $email = $this->argument('email');
        $role  = $this->argument('role');

        $affected = User::where('email', $email)->update(['role' => $role]);

        if ($affected) {
            $user = User::where('email', $email)->first();
            $this->info("User updated:");
            $this->table(['id', 'name', 'email', 'role'], [[$user->id, $user->name, $user->email, $user->role]]);
        } else {
            $this->error("No user found with email: {$email}");
        }
    }
}
