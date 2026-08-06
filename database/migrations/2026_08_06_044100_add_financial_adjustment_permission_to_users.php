<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'can_manage_financial_adjustments')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->boolean('can_manage_financial_adjustments')->default(false)->after('is_active');
            });
        }

        DB::table('users')->where('role', 'admin')->update(['can_manage_financial_adjustments' => true]);
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'can_manage_financial_adjustments')) {
            Schema::table('users', fn (Blueprint $table) => $table->dropColumn('can_manage_financial_adjustments'));
        }
    }
};
